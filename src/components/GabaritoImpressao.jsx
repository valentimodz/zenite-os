import React, { useState, useEffect } from 'react';
import Barcode from 'react-barcode';
import { supabase } from '../supabaseClient';
import { Printer, Search, Filter, CheckSquare, Square, ArrowLeft, RefreshCw, AlertCircle, Tag, Package } from 'lucide-react';

export default function GabaritoImpressao({ session, onBack }) {
  const [produtos, setProdutos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  
  // Filtros
  const [categoriaFiltro, setCategoriaFiltro] = useState('TODAS');
  const [busca, setBusca] = useState('');
  const [apenasSemEan, setApenasSemEan] = useState(false);
  const [selecionados, setSelecionados] = useState(new Set());

  // Buscar produtos do catálogo no Supabase
  const carregarProdutos = async () => {
    setLoading(true);
    setErro('');
    try {
      let empresaId = null;

      if (session?.user?.id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('empresa_id')
          .eq('id', session.user.id)
          .single();
        empresaId = profile?.empresa_id;
      }

      let query = supabase.from('produtos_catalogo').select('*');
      if (empresaId) {
        query = query.eq('empresa_id', empresaId);
      }

      const { data: catData, error: catError } = await query.order('nome', { ascending: true });

      if (catError) {
        console.warn('Erro ao buscar produtos_catalogo, tentando fallback em produtos:', catError);
        // Fallback para a tabela produtos se produtos_catalogo falhar ou estiver vazia
        let queryProd = supabase.from('produtos').select('*');
        if (empresaId) queryProd = queryProd.eq('empresa_id', empresaId);
        const { data: prodsData, error: prodErr } = await queryProd;
        if (prodErr) throw prodErr;

        tratarEFormatarProdutos(prodsData || []);
      } else if (catData && catData.length > 0) {
        tratarEFormatarProdutos(catData);
      } else {
        // Se produtos_catalogo veio vazio, tentar produtos
        let queryProd = supabase.from('produtos').select('*');
        if (empresaId) queryProd = queryProd.eq('empresa_id', empresaId);
        const { data: prodsData } = await queryProd;
        tratarEFormatarProdutos(prodsData || []);
      }
    } catch (err) {
      console.log('Motivo do alerta vermelho:', err);
      console.error('Erro ao carregar catálogo para impressão:', err);
      setErro('Não foi possível carregar o catálogo de produtos.');
    } finally {
      setLoading(false);
    }
  };

  const tratarEFormatarProdutos = (lista) => {
    const formatados = lista.map((p) => {
      // Determinar o código de barras a ser impresso:
      // 1. codigo_barras oficial se existir
      // 2. sku do produto se existir
      // 3. Fallback inteligente gerado a partir do id ou nome
      let codigoFinal = p.codigo_barras || p.sku || p.codigoBarras || p.cod_sku;
      if (!codigoFinal || String(codigoFinal).trim() === '') {
        const prefixo = (p.categoria || p.tipo || 'ACC').substring(0, 3).toUpperCase();
        const idCurto = p.id ? String(p.id).replace(/-/g, '').substring(0, 6).toUpperCase() : Math.floor(100000 + Math.random() * 900000);
        codigoFinal = `${prefixo}-${idCurto}`;
      }

      return {
        id: p.id || Math.random().toString(),
        nome: p.nome || 'Produto sem nome',
        categoria: p.categoria || p.tipo || 'Acessórios',
        codigo_barras: String(codigoFinal).trim(),
        sku_original: p.sku || null,
        ean_oficial: p.codigo_barras || null,
        preco: p.preco || 0
      };
    });

    setProdutos(formatados);
    // Por padrão, marcar todos como selecionados
    setSelecionados(new Set(formatados.map(p => p.id)));
  };

  useEffect(() => {
    carregarProdutos();
  }, [session]);

  // Lista de categorias únicas extraídas
  const categoriasUnicas = ['TODAS', ...Array.from(new Set(produtos.map(p => p.categoria))).filter(Boolean)];

  // Filtragem dos produtos
  const produtosFiltrados = produtos.filter((p) => {
    const bateCategoria = categoriaFiltro === 'TODAS' || p.categoria.toLowerCase() === categoriaFiltro.toLowerCase();
    const q = busca.toLowerCase().trim();
    const bateBusca = !q || p.nome.toLowerCase().includes(q) || p.codigo_barras.toLowerCase().includes(q) || p.categoria.toLowerCase().includes(q);
    const bateSemEan = !apenasSemEan || !p.ean_oficial;
    return bateCategoria && bateBusca && bateSemEan;
  });

  // Produtos finais marcados para impressão
  const produtosParaImprimir = produtosFiltrados.filter(p => selecionados.has(p.id));

  // Toggle de seleção
  const toggleSelecao = (id) => {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selecionarTodos = () => {
    setSelecionados(new Set(produtosFiltrados.map(p => p.id)));
  };

  const deselecionarTodos = () => {
    setSelecionados(new Set());
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 font-sans print:bg-white print:text-black">
      {/* Estilos CSS para Impressão */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 10mm;
          }
          body {
            background-color: #ffffff !important;
            color: #000000 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .no-print {
            display: none !important;
          }
          .print-container {
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
          }
          .print-grid {
            display: grid !important;
            grid-template-columns: repeat(3, 1fr) !important;
            gap: 12px !important;
            width: 100% !important;
          }
          .print-card {
            border: 1px solid #d1d5db !important;
            border-radius: 6px !important;
            padding: 8px !important;
            background-color: #ffffff !important;
            break-inside: avoid !important;
            page-break-inside: avoid !important;
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            justify-content: center !important;
            text-align: center !important;
            box-shadow: none !important;
          }
          .print-card span {
            color: #000000 !important;
          }
        }
      `}</style>

      {/* Painel Superior (Não Impresso) */}
      <header className="no-print border-b border-neutral-800 bg-neutral-900/80 backdrop-blur sticky top-0 z-30 px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {onBack && (
              <button
                onClick={onBack}
                className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors"
                title="Voltar ao Sistema"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <div>
              <div className="flex items-center gap-2">
                <Tag className="w-5 h-5 text-[#a855f7]" />
                <h1 className="text-xl font-bold tracking-tight text-white">Caderno de PDV</h1>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#6A0DAD]/20 text-[#c084fc] border border-[#6A0DAD]/40 font-semibold">
                  Gabarito de Códigos de Barras
                </span>
              </div>
              <p className="text-xs text-neutral-400 mt-0.5">
                Gere e imprima folhas com códigos de barras bipáveis para balcão
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={carregarProdutos}
              disabled={loading}
              className="px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-xl text-sm font-medium transition-colors flex items-center gap-2"
              title="Atualizar lista do catálogo"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span>Atualizar</span>
            </button>

            <button
              onClick={handlePrint}
              disabled={produtosParaImprimir.length === 0}
              className="px-5 py-2.5 bg-gradient-to-r from-[#6A0DAD] to-[#9333EA] hover:from-[#7e12ca] hover:to-[#a855f7] text-white rounded-xl text-sm font-semibold shadow-lg shadow-purple-900/30 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir Catálogo ({produtosParaImprimir.length})</span>
            </button>
          </div>
        </div>
      </header>

      {/* Área de Filtros e Controles (Não Impressa) */}
      <section className="no-print max-w-7xl mx-auto px-6 py-6 space-y-4">
        <div className="bg-neutral-900/90 border border-neutral-800 rounded-2xl p-5 shadow-xl space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Campo de Busca */}
            <div className="relative">
              <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por produto, SKU ou código..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl pl-10 pr-4 py-2 text-sm text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-[#6A0DAD] transition-colors"
              />
            </div>

            {/* Filtro de Categoria */}
            <div className="relative">
              <Filter className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <select
                value={categoriaFiltro}
                onChange={(e) => setCategoriaFiltro(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl pl-10 pr-4 py-2 text-sm text-neutral-200 focus:outline-none focus:border-[#6A0DAD] transition-colors appearance-none"
              >
                {categoriasUnicas.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat === 'TODAS' ? 'Todas as Categorias' : `Categoria: ${cat}`}
                  </option>
                ))}
              </select>
            </div>

            {/* Checkbox Apenas Sem EAN */}
            <div className="flex items-center gap-3 bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2">
              <input
                type="checkbox"
                id="semEanCheck"
                checked={apenasSemEan}
                onChange={(e) => setApenasSemEan(e.target.checked)}
                className="w-4 h-4 accent-[#9333EA] rounded cursor-pointer"
              />
              <label htmlFor="semEanCheck" className="text-xs text-neutral-300 cursor-pointer font-medium">
                Apenas produtos sem EAN oficial
              </label>
            </div>
          </div>

          {/* Bar de Seleção em Lote */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-neutral-800 text-xs text-neutral-400">
            <div className="flex items-center gap-2">
              <span>Exibindo <strong>{produtosFiltrados.length}</strong> produtos</span>
              <span>•</span>
              <span className="text-[#c084fc] font-medium">
                <strong>{produtosParaImprimir.length}</strong> selecionados para impressão
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={selecionarTodos}
                className="px-3 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg font-medium transition-colors flex items-center gap-1.5"
              >
                <CheckSquare className="w-3.5 h-3.5 text-purple-400" />
                <span>Selecionar Todos</span>
              </button>
              <button
                onClick={deselecionarTodos}
                className="px-3 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg font-medium transition-colors flex items-center gap-1.5"
              >
                <Square className="w-3.5 h-3.5 text-neutral-400" />
                <span>Deselecionar Todos</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Conteúdo Principal / Gabarito de Impressão */}
      <main className="max-w-7xl mx-auto px-6 pb-12 print:max-w-none print:p-0 print:m-0 print:w-full">
        {loading ? (
          <div className="no-print flex flex-col items-center justify-center py-20 text-neutral-400 gap-3">
            <div className="w-10 h-10 border-4 border-[#6A0DAD] border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm font-medium">Carregando catálogo de produtos...</p>
          </div>
        ) : erro ? (
          <div className="no-print bg-red-950/30 border border-red-500/40 rounded-2xl p-6 text-center space-y-3">
            <AlertCircle className="w-8 h-8 text-red-400 mx-auto" />
            <p className="text-sm text-red-200">{erro}</p>
            <button
              onClick={carregarProdutos}
              className="px-4 py-2 bg-red-900/50 hover:bg-red-900 text-white rounded-xl text-xs font-semibold"
            >
              Tentar Novamente
            </button>
          </div>
        ) : produtosFiltrados.length === 0 ? (
          <div className="no-print bg-neutral-900/50 border border-neutral-800 rounded-2xl py-16 text-center space-y-2">
            <Package className="w-10 h-10 text-neutral-600 mx-auto" />
            <p className="text-base text-neutral-300 font-semibold">Nenhum produto encontrado</p>
            <p className="text-xs text-neutral-500 max-w-md mx-auto">
              Ajuste os filtros de busca ou categoria para listar os produtos do catálogo.
            </p>
          </div>
        ) : (
          <div className="print-container">
            {/* Cabeçalho exclusivo para o documento impresso */}
            <div className="hidden print:block mb-4 text-center border-b pb-2 border-gray-300">
              <h1 className="text-xl font-bold uppercase tracking-wider text-black">Caderno de PDV — Gabarito de Balcão</h1>
              <p className="text-xs text-gray-600">
                Impresso em {new Date().toLocaleDateString('pt-BR')} | Total de itens: {produtosParaImprimir.length}
              </p>
            </div>

            {/* Grid de Renderização dos Barcodes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 print-grid">
              {produtosFiltrados.map((produto) => {
                const isSelected = selecionados.has(produto.id);
                
                return (
                  <div
                    key={produto.id}
                    onClick={() => toggleSelecao(produto.id)}
                    className={`
                      relative group cursor-pointer transition-all rounded-xl p-4 border flex flex-col items-center justify-between text-center select-none print-card
                      ${isSelected
                        ? 'bg-neutral-900 border-[#9333EA]/60 shadow-lg shadow-purple-950/20 print:border-gray-300'
                        : 'bg-neutral-950/60 border-neutral-800 opacity-50 hover:opacity-80 print:hidden'
                      }
                    `}
                  >
                    {/* Badge de Seleção (Tela) */}
                    <div className="no-print absolute top-3 right-3">
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-[#c084fc]" />
                      ) : (
                        <Square className="w-4 h-4 text-neutral-600" />
                      )}
                    </div>

                    {/* Categoria do Produto */}
                    <span className="font-bold text-xs uppercase tracking-wider text-[#c084fc] print:text-black mb-1">
                      {produto.categoria}
                    </span>

                    {/* Nome do Produto */}
                    <span className="text-xs font-semibold text-neutral-200 print:text-black line-clamp-2 min-h-[32px] flex items-center justify-center px-1 mb-2">
                      {produto.nome}
                    </span>

                    {/* Renderização do Barcode (react-barcode) */}
                    <div className="bg-white p-2 rounded-lg w-full flex justify-center items-center print:p-0 print:bg-transparent">
                      <Barcode
                        value={produto.codigo_barras}
                        width={1.4}
                        height={38}
                        fontSize={11}
                        margin={2}
                        background="#ffffff"
                        lineColor="#000000"
                        displayValue={true}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
