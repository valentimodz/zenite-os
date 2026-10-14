import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import {
  AlertTriangle,
  X,
  Package,
  Store,
  ArrowRight,
  RefreshCw,
  Bell
} from 'lucide-react';
import ModalDetalheEstoqueProduto from './ModalDetalheEstoqueProduto';

export interface AlertaEstoqueItem {
  id?: string;
  produto_id?: string;
  produto_nome?: string;
  nome?: string;
  filial_id?: string;
  filial_nome?: string;
  quantidade?: number;
  qtd?: number;
  categoria?: string;
  cor?: string;
  preco?: number;
  preco_venda?: number;
  [key: string]: any;
}

interface AlertaEstoqueBaixoProps {
  limiteMinimo?: number;
  filialAtivaId?: string | null;
  filiais?: Array<{ id: string | number; nome: string }>;
  userRole?: string | null;
  onNavegarEstoque?: (item?: AlertaEstoqueItem) => void;
}

const STORAGE_KEY_DESCARTADOS = 'alertas_stock_descartados';
const OITO_HORAS_MS = 8 * 60 * 60 * 1000;

export default function AlertaEstoqueBaixo({
  limiteMinimo = 3,
  filialAtivaId,
  filiais = [],
  userRole: userRoleProp,
  onNavegarEstoque
}: AlertaEstoqueBaixoProps) {
  const [roleUsuario, setRoleUsuario] = useState<string | null>(userRoleProp || null);
  const [checandoPerfil, setChecandoPerfil] = useState(!userRoleProp);
  const [alertas, setAlertas] = useState<AlertaEstoqueItem[]>([]);
  const [descartadosMap, setDescartadosMap] = useState<{ [chave: string]: number }>(() => {
    try {
      const salvo = localStorage.getItem(STORAGE_KEY_DESCARTADOS);
      return salvo ? JSON.parse(salvo) : {};
    } catch {
      return {};
    }
  });
  const [loading, setLoading] = useState(false);
  const [produtoModalSelecionado, setProdutoModalSelecionado] = useState<any | null>(null);

  // Sincronizar role se recebida via prop ou buscar via Supabase se não fornecida
  useEffect(() => {
    if (userRoleProp) {
      setRoleUsuario(userRoleProp);
      setChecandoPerfil(false);
      return;
    }

    let isMounted = true;
    const buscarPerfil = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user?.id) {
          if (isMounted) setChecandoPerfil(false);
          return;
        }

        const email = String(session.user.email || '').toLowerCase().trim();
        // Super admins / admins via e-mail direto
        if (email === 'valentimodz@gmail.com' || email === 'valentimodz2@gmail.com') {
          if (isMounted) {
            setRoleUsuario('ADMIN');
            setChecandoPerfil(false);
          }
          return;
        }

        const { data: profileData } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .maybeSingle();

        if (isMounted) {
          const role = profileData?.role || session.user.user_metadata?.role || '';
          setRoleUsuario(role);
          setChecandoPerfil(false);
        }
      } catch (err) {
        console.warn('[AlertaEstoqueBaixo] Erro ao carregar perfil:', err);
        if (isMounted) setChecandoPerfil(false);
      }
    };

    buscarPerfil();

    return () => {
      isMounted = false;
    };
  }, [userRoleProp]);

  // Verificar se o usuário autenticado possui role de ADMIN
  const ehAdmin = useMemo(() => {
    const roleUpper = String(roleUsuario || '').toUpperCase();
    return ['ADMIN', 'ADMINISTRADOR', 'SUPER_ADMIN', 'OWNER', 'DONO', 'MASTER'].includes(roleUpper);
  }, [roleUsuario]);

  // Mapa de filiais para lookup de nome
  const mapaFiliaisNome = useMemo(() => {
    const mapa: { [key: string]: string } = {};
    (filiais || []).forEach(f => {
      mapa[String(f.id)] = f.nome;
    });
    return mapa;
  }, [filiais]);

  // Função para verificar estoque baixo
  const verificarEstoqueBaixo = useCallback(async () => {
    // Se não for admin, não busca nada no Supabase
    if (!ehAdmin) return;

    setLoading(true);
    try {
      // 1. Tentar chamar a RPC dedicada 'obter_alertas_estoque_baixo'
      const { data: rpcData, error: rpcError } = await supabase.rpc('obter_alertas_estoque_baixo', {
        p_limite_minimo: limiteMinimo,
        p_filial_id: filialAtivaId || null
      });

      if (!rpcError && Array.isArray(rpcData) && rpcData.length > 0) {
        setAlertas(rpcData);
        setLoading(false);
        return;
      }

      // 2. Fallback resiliente: consulta direta na tabela 'produtos' agrupando por quantidade crítica
      let query = supabase
        .from('produtos')
        .select(`
          id,
          nome,
          filial_id,
          categoria,
          cor,
          quantidade,
          preco,
          preco_venda,
          status,
          filiais (id, nome),
          imeis (id, imei, status, vendido, filial_id)
        `)
        .order('quantidade', { ascending: true })
        .limit(20);

      if (filialAtivaId && filialAtivaId !== 'TODAS' && filialAtivaId !== 'todas' && filialAtivaId !== 'all') {
        query = query.eq('filial_id', filialAtivaId);
      }

      const { data: produtosData, error: prodError } = await query;

      if (!prodError && Array.isArray(produtosData)) {
        const itensAlerta: AlertaEstoqueItem[] = [];

        produtosData.forEach(p => {
          // Calcula quantidade real considerando seriais/imeis se disponíveis
          const imeisAtivos = Array.isArray(p.imeis)
            ? p.imeis.filter((i: any) => !i.vendido && String(i.status || '').toUpperCase() !== 'VENDIDO')
            : [];

          const qtdReal = imeisAtivos.length > 0 ? imeisAtivos.length : Number(p.quantidade || 0);

          if (qtdReal <= limiteMinimo && qtdReal >= 0) {
            const filialNome = p.filiais?.nome || mapaFiliaisNome[String(p.filial_id)] || 'Loja Principal';
            itensAlerta.push({
              id: p.id,
              produto_id: p.id,
              produto_nome: p.nome,
              nome: p.nome,
              filial_id: p.filial_id,
              filial_nome: filialNome,
              quantidade: qtdReal,
              qtd: qtdReal,
              categoria: p.categoria,
              cor: p.cor,
              preco: p.preco,
              preco_venda: p.preco_venda
            });
          }
        });

        setAlertas(itensAlerta);
      }
    } catch (err) {
      console.warn('[AlertaEstoqueBaixo] Erro ao consultar estoque baixo:', err);
    } finally {
      setLoading(false);
    }
  }, [limiteMinimo, filialAtivaId, mapaFiliaisNome]);

  // Checagem periódica: executa no mount e a cada 5 minutos
  useEffect(() => {
    verificarEstoqueBaixo();

    const interval = setInterval(() => {
      verificarEstoqueBaixo();
    }, 5 * 60 * 1000); // 5 minutos

    return () => clearInterval(interval);
  }, [verificarEstoqueBaixo]);

  // Descartar/fechar uma notificação específica salvando no localStorage com timestamp
  const descartarAlerta = (produtoIdOuKey: string) => {
    const agora = Date.now();
    setAlertas(prev => prev.filter(item => {
      const pId = String(item.produto_id || item.id);
      const key = `${pId}_${item.filial_id || 'all'}`;
      return pId !== produtoIdOuKey && key !== produtoIdOuKey;
    }));

    setDescartadosMap(prev => {
      const novos = { ...prev, [produtoIdOuKey]: agora };
      try {
        localStorage.setItem(STORAGE_KEY_DESCARTADOS, JSON.stringify(novos));
      } catch (e) {
        console.warn('[AlertaEstoqueBaixo] Erro ao salvar descartes no localStorage:', e);
      }
      return novos;
    });
  };

  // Filtrar itens que foram descartados há menos de 8 horas
  const alertasVisiveis = useMemo(() => {
    const agora = Date.now();

    return alertas.filter(item => {
      const pId = String(item.produto_id || item.id);
      const key = `${pId}_${item.filial_id || 'all'}`;

      // Checa se foi descartado por ID ou por Key composta
      const dataDescarte = descartadosMap[pId] || descartadosMap[key];
      if (!dataDescarte) return true;

      // Se foi descartado há menos de 8 horas, não exibir
      return (agora - dataDescarte) > OITO_HORAS_MS;
    });
  }, [alertas, descartadosMap]);

  // Se ainda estiver checando ou se NÃO for admin, não exibe absolutamente nada
  if (checandoPerfil || !ehAdmin) {
    return null;
  }

  // Se não houver alertas visíveis, não renderiza nada
  if (alertasVisiveis.length === 0) {
    return null;
  }

  // Apresentar no máximo 2 ou 3 cartões em simultâneo no ecrã para evitar obstrução visual
  const alertasParaExibir = alertasVisiveis.slice(0, 2);
  const totalRestantes = alertasVisiveis.length - alertasParaExibir.length;

  return (
    <>
      <div 
        role="region"
        aria-label="Notificações de Estoque Baixo"
        className="fixed bottom-6 right-6 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none"
      >
        {alertasParaExibir.map((item) => {
          const itemKey = `${item.produto_id || item.id}_${item.filial_id || 'all'}`;
          const prodNome = item.produto_nome || item.nome || 'Produto';
          const filialNome = item.filial_nome || 'Filial';
          const qtd = item.quantidade ?? item.qtd ?? 0;
          const isCriticoZero = qtd === 0;

          return (
            <div
              key={itemKey}
              className="pointer-events-auto bg-[#18181b]/95 backdrop-blur-md border border-amber-500/40 hover:border-amber-500/70 rounded-2xl p-4 shadow-2xl shadow-black/80 flex flex-col gap-2.5 transition-all transform animate-slideUp text-left"
            >
              {/* Header do Alerta */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                    isCriticoZero 
                      ? 'bg-red-950/60 border border-red-800/60 text-red-400' 
                      : 'bg-amber-950/60 border border-amber-800/60 text-amber-400'
                  }`}>
                    <AlertTriangle size={15} />
                  </div>
                  <div>
                    <h5 className="text-xs font-extrabold text-white uppercase tracking-wider flex items-center gap-1.5">
                      <span>{isCriticoZero ? 'Estoque Esgotado' : 'Estoque Baixo'}</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        {qtd} unid{qtd === 1 ? '' : 's'}
                      </span>
                    </h5>
                    <span className="text-[10px] text-zinc-400 font-medium flex items-center gap-1">
                      <Store size={10} className="text-zinc-500" />
                      {filialNome}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => descartarAlerta(itemKey)}
                  className="text-zinc-400 hover:text-white p-1 rounded-md hover:bg-zinc-800/60 transition-colors cursor-pointer"
                  title="Descartar notificação nesta sessão"
                >
                  <X size={15} />
                </button>
              </div>

              {/* Mensagem descritiva */}
              <p className="text-xs text-zinc-300 leading-snug">
                Há apenas <strong className="text-amber-400 font-bold">{qtd} unidade{qtd === 1 ? '' : 's'}</strong> de <span className="text-white font-semibold">"{prodNome}"</span> na filial {filialNome}.
              </p>

              {/* Ações Rápidas */}
              <div className="flex items-center justify-between pt-1 border-t border-zinc-800/60">
                <button
                  type="button"
                  onClick={() => {
                    setProdutoModalSelecionado({
                      id: item.produto_id || item.id,
                      nome: prodNome,
                      filial_id: item.filial_id,
                      categoria: item.categoria,
                      cor: item.cor,
                      preco: item.preco,
                      preco_venda: item.preco_venda,
                      quantidade: qtd
                    });
                  }}
                  className="text-xs font-bold text-amber-400 hover:text-amber-300 inline-flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Package size={13} />
                  <span>Ver Detalhes</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    descartarAlerta(itemKey);
                    if (onNavegarEstoque) {
                      onNavegarEstoque(item);
                    }
                  }}
                  className="text-xs font-bold text-purple-300 hover:text-white inline-flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <span>Ver Estoque</span>
                  <ArrowRight size={12} />
                </button>
              </div>
            </div>
          );
        })}

        {totalRestantes > 0 && (
          <div className="pointer-events-auto bg-[#121214]/90 border border-zinc-800 rounded-xl px-3 py-1.5 text-center shadow-lg text-[11px] text-zinc-400 font-medium">
            +{totalRestantes} outro{totalRestantes === 1 ? '' : 's'} produto{totalRestantes === 1 ? '' : 's'} com estoque baixo
          </div>
        )}
      </div>

      {/* Modal Detalhe do Produto acionado pelo alerta */}
      {produtoModalSelecionado && (
        <ModalDetalheEstoqueProduto
          isOpen={Boolean(produtoModalSelecionado)}
          onClose={() => setProdutoModalSelecionado(null)}
          produto={produtoModalSelecionado}
          filiais={filiais}
          onTransferir={() => {
            setProdutoModalSelecionado(null);
            if (onNavegarEstoque) {
              onNavegarEstoque();
            }
          }}
        />
      )}
    </>
  );
}
