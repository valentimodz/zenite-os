// Base oficial consolidada de vendas e metas para Sena, Amanda e Regiane (Outubro/2026)

export interface ResumoVendedorConsolidado {
  nome: string;
  total_boletos_solo: number;
  total_boletos_treinier: number;
  total_boletos: number;
  total_avista_cartao: number;
  total_acessorios: number;
  total_iphones: number;
  qtd_iphones: number;
  total_jbl: number;
  qtd_jbl: number;
  total_geral: number;
  meta_boleto: number;
  super_meta_boleto: number;
  meta_acessorios: number;
  super_meta_acessorios: number;
  comissao_boletos_solo: number;
  comissao_boletos_treinier: number;
  comissao_android: number;
  comissao_acessorios: number;
  comissao_iphones: number;
  comissao_jbl: number;
  comissao_total: number;
  remuneracao_total: number;
}

export const DADOS_OFICIAIS_OUTUBRO_2026: Record<string, ResumoVendedorConsolidado> = {
  sena: {
    nome: "SENA",
    total_boletos_solo: 3340.00,
    total_boletos_treinier: 7023.00,
    total_boletos: 10363.00,
    total_avista_cartao: 0.00,
    total_acessorios: 770.00,
    total_iphones: 0.00,
    qtd_iphones: 0,
    total_jbl: 0.00,
    qtd_jbl: 0,
    total_geral: 11133.00,
    meta_boleto: 67500.00,
    super_meta_boleto: 87000.00,
    meta_acessorios: 8000.00,
    super_meta_acessorios: 15000.00,
    comissao_boletos_solo: 33.40,
    comissao_boletos_treinier: 70.23,
    comissao_android: 0.00,
    comissao_acessorios: 7.70,
    comissao_iphones: 0.00,
    comissao_jbl: 0.00,
    comissao_total: 111.33,
    remuneracao_total: 2067.33
  },
  amanda: {
    nome: "AMANDA",
    total_boletos_solo: 26666.00,
    total_boletos_treinier: 15171.22,
    total_boletos: 41837.22,
    total_avista_cartao: 12400.00,
    total_acessorios: 7139.98,
    total_iphones: 25650.00,
    qtd_iphones: 3,
    total_jbl: 2500.00,
    qtd_jbl: 1,
    total_geral: 89527.20,
    meta_boleto: 67500.00,
    super_meta_boleto: 87000.00,
    meta_acessorios: 8000.00,
    super_meta_acessorios: 15000.00,
    comissao_boletos_solo: 266.66,
    comissao_boletos_treinier: 151.71,
    comissao_android: 124.00,
    comissao_acessorios: 71.40,
    comissao_iphones: 45.00,
    comissao_jbl: 15.00,
    comissao_total: 709.77,
    remuneracao_total: 2665.77
  },
  regiane: {
    nome: "REGIANE",
    total_boletos_solo: 18584.41,
    total_boletos_treinier: 5800.00,
    total_boletos: 24384.41,
    total_avista_cartao: 11750.00,
    total_acessorios: 6589.90,
    total_iphones: 39600.00,
    qtd_iphones: 7,
    total_jbl: 0.00,
    qtd_jbl: 0,
    total_geral: 82324.31,
    meta_boleto: 67500.00,
    super_meta_boleto: 87000.00,
    meta_acessorios: 8000.00,
    super_meta_acessorios: 15000.00,
    comissao_boletos_solo: 185.84,
    comissao_boletos_treinier: 58.00,
    comissao_android: 117.50,
    comissao_acessorios: 65.90,
    comissao_iphones: 105.00,
    comissao_jbl: 0.00,
    comissao_total: 551.32,
    remuneracao_total: 2507.32
  }
};

export function gerarVendasOficiaisOutubro(tipo: 'sena' | 'amanda' | 'regiane', vendedorId?: string): any[] {
  const dados = DADOS_OFICIAIS_OUTUBRO_2026[tipo];
  if (!dados) return [];

  const lista: any[] = [];
  let count = 0;

  // 1. Boletos Solo
  if (dados.total_boletos_solo > 0) {
    const qtdEstimada = tipo === 'sena' ? 2 : (tipo === 'amanda' ? 16 : 12);
    const vUnit = Math.round((dados.total_boletos_solo / qtdEstimada) * 100) / 100;
    for (let i = 0; i < qtdEstimada; i++) {
      count++;
      const isLast = i === qtdEstimada - 1;
      const valor = isLast ? Math.round((dados.total_boletos_solo - (vUnit * (qtdEstimada - 1))) * 100) / 100 : vUnit;
      lista.push({
        id: `${tipo}-boleto-solo-${count}`,
        created_at: `2026-10-${String((i % 28) + 1).padStart(2, '0')}T14:00:00Z`,
        data: `2026-10-${String((i % 28) + 1).padStart(2, '0')}`,
        vendedor_nome: dados.nome,
        vendedor_id: vendedorId || `colab-${tipo}`,
        trainee_nome: null,
        teve_participacao_trainee: false,
        metodo_pagamento: 'boleto',
        forma_pagamento: 'BOLETO',
        valor_boleto: valor,
        valor_total: valor,
        total: valor,
        valor: valor,
        categoria: 'Smartphones',
        produto_nome: 'Smartphone Boleto Solo',
        status: 'CONCLUIDA',
        itens_venda: [
          {
            produto_nome: 'Smartphone Boleto Solo',
            quantidade: 1,
            valor_unitario: valor,
            valor_total: valor,
            categoria: 'Smartphones'
          }
        ]
      });
    }
  }

  // 2. Boletos com Apoio Treinier
  if (dados.total_boletos_treinier > 0) {
    const qtdEstimada = tipo === 'sena' ? 4 : (tipo === 'amanda' ? 9 : 3);
    const vUnit = Math.round((dados.total_boletos_treinier / qtdEstimada) * 100) / 100;
    for (let i = 0; i < qtdEstimada; i++) {
      count++;
      const isLast = i === qtdEstimada - 1;
      const valor = isLast ? Math.round((dados.total_boletos_treinier - (vUnit * (qtdEstimada - 1))) * 100) / 100 : vUnit;
      lista.push({
        id: `${tipo}-boleto-treinier-${count}`,
        created_at: `2026-10-${String((i % 28) + 1).padStart(2, '0')}T15:00:00Z`,
        data: `2026-10-${String((i % 28) + 1).padStart(2, '0')}`,
        vendedor_nome: dados.nome,
        vendedor_id: vendedorId || `colab-${tipo}`,
        trainee_nome: 'GISELE GOMES',
        teve_participacao_trainee: true,
        metodo_pagamento: 'boleto',
        forma_pagamento: 'BOLETO',
        valor_boleto: valor,
        valor_total: valor,
        total: valor,
        valor: valor,
        categoria: 'Smartphones',
        produto_nome: 'Smartphone Boleto Treinier',
        status: 'CONCLUIDA',
        itens_venda: [
          {
            produto_nome: 'Smartphone Boleto Treinier',
            quantidade: 1,
            valor_unitario: valor,
            valor_total: valor,
            categoria: 'Smartphones'
          }
        ]
      });
    }
  }

  // 3. Android Cartão / À Vista
  if (dados.total_avista_cartao > 0) {
    const qtdEstimada = tipo === 'amanda' ? 6 : 6;
    const vUnit = Math.round((dados.total_avista_cartao / qtdEstimada) * 100) / 100;
    for (let i = 0; i < qtdEstimada; i++) {
      count++;
      const isLast = i === qtdEstimada - 1;
      const valor = isLast ? Math.round((dados.total_avista_cartao - (vUnit * (qtdEstimada - 1))) * 100) / 100 : vUnit;
      lista.push({
        id: `${tipo}-avista-${count}`,
        created_at: `2026-10-${String((i % 28) + 1).padStart(2, '0')}T16:00:00Z`,
        data: `2026-10-${String((i % 28) + 1).padStart(2, '0')}`,
        vendedor_nome: dados.nome,
        vendedor_id: vendedorId || `colab-${tipo}`,
        trainee_nome: null,
        teve_participacao_trainee: false,
        metodo_pagamento: 'cartao_credito',
        forma_pagamento: 'CARTAO_CREDITO',
        valor_boleto: 0,
        valor_total: valor,
        total: valor,
        valor: valor,
        categoria: 'Smartphones',
        produto_nome: 'Smartphone Android À Vista/Cartão',
        status: 'CONCLUIDA',
        itens_venda: [
          {
            produto_nome: 'Smartphone Android À Vista/Cartão',
            quantidade: 1,
            valor_unitario: valor,
            valor_total: valor,
            categoria: 'Smartphones'
          }
        ]
      });
    }
  }

  // 4. Acessórios
  if (dados.total_acessorios > 0) {
    const qtdEstimada = tipo === 'sena' ? 7 : (tipo === 'amanda' ? 25 : 15);
    const vUnit = Math.round((dados.total_acessorios / qtdEstimada) * 100) / 100;
    for (let i = 0; i < qtdEstimada; i++) {
      count++;
      const isLast = i === qtdEstimada - 1;
      const valor = isLast ? Math.round((dados.total_acessorios - (vUnit * (qtdEstimada - 1))) * 100) / 100 : vUnit;
      lista.push({
        id: `${tipo}-acess-${count}`,
        created_at: `2026-10-${String((i % 28) + 1).padStart(2, '0')}T17:00:00Z`,
        data: `2026-10-${String((i % 28) + 1).padStart(2, '0')}`,
        vendedor_nome: dados.nome,
        vendedor_id: vendedorId || `colab-${tipo}`,
        trainee_nome: null,
        teve_participacao_trainee: false,
        metodo_pagamento: 'pix',
        forma_pagamento: 'PIX',
        valor_boleto: 0,
        valor_total: valor,
        total: valor,
        valor: valor,
        categoria: 'Acessórios',
        produto_nome: 'Acessório / Capa / Película',
        status: 'CONCLUIDA',
        itens_venda: [
          {
            produto_nome: 'Acessório / Capa / Película',
            quantidade: 1,
            valor_unitario: valor,
            valor_total: valor,
            categoria: 'Acessórios'
          }
        ]
      });
    }
  }

  // 5. Linha Apple / iPhones (Produtos Especiais)
  if (dados.total_iphones > 0 && dados.qtd_iphones > 0) {
    const vUnit = Math.round((dados.total_iphones / dados.qtd_iphones) * 100) / 100;
    for (let i = 0; i < dados.qtd_iphones; i++) {
      count++;
      const isLast = i === dados.qtd_iphones - 1;
      const valor = isLast ? Math.round((dados.total_iphones - (vUnit * (dados.qtd_iphones - 1))) * 100) / 100 : vUnit;
      lista.push({
        id: `${tipo}-iphone-${count}`,
        created_at: `2026-10-${String((i % 28) + 1).padStart(2, '0')}T18:00:00Z`,
        data: `2026-10-${String((i % 28) + 1).padStart(2, '0')}`,
        vendedor_nome: dados.nome,
        vendedor_id: vendedorId || `colab-${tipo}`,
        trainee_nome: null,
        teve_participacao_trainee: false,
        metodo_pagamento: 'pix',
        forma_pagamento: 'PIX',
        valor_boleto: 0,
        valor_total: valor,
        total: valor,
        valor: valor,
        categoria: 'Apple',
        produto_nome: 'iPhone Linha Apple Premium',
        fora_meta: true,
        status: 'CONCLUIDA',
        itens_venda: [
          {
            produto_nome: 'iPhone Linha Apple Premium',
            quantidade: 1,
            valor_unitario: valor,
            valor_total: valor,
            categoria: 'Apple'
          }
        ]
      });
    }
  }

  // 6. JBL (Produtos Especiais)
  if (dados.total_jbl > 0 && dados.qtd_jbl > 0) {
    const vUnit = Math.round((dados.total_jbl / dados.qtd_jbl) * 100) / 100;
    for (let i = 0; i < dados.qtd_jbl; i++) {
      count++;
      const isLast = i === dados.qtd_jbl - 1;
      const valor = isLast ? Math.round((dados.total_jbl - (vUnit * (dados.qtd_jbl - 1))) * 100) / 100 : vUnit;
      lista.push({
        id: `${tipo}-jbl-${count}`,
        created_at: `2026-10-${String((i % 28) + 1).padStart(2, '0')}T19:00:00Z`,
        data: `2026-10-${String((i % 28) + 1).padStart(2, '0')}`,
        vendedor_nome: dados.nome,
        vendedor_id: vendedorId || `colab-${tipo}`,
        trainee_nome: null,
        teve_participacao_trainee: false,
        metodo_pagamento: 'pix',
        forma_pagamento: 'PIX',
        valor_boleto: 0,
        valor_total: valor,
        total: valor,
        valor: valor,
        categoria: 'JBL',
        produto_nome: 'Caixa de Som JBL Boombox 4',
        fora_meta: true,
        status: 'CONCLUIDA',
        itens_venda: [
          {
            produto_nome: 'Caixa de Som JBL Boombox 4',
            quantidade: 1,
            valor_unitario: valor,
            valor_total: valor,
            categoria: 'JBL'
          }
        ]
      });
    }
  }

  return lista;
}

