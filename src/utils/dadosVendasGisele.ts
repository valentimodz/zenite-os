/**
 * Base Oficial Consolidada de Vendas da Trainee Gisele Gomes (Outubro/2026 - 2026-10)
 * Inclui atuação multiloja (Pamela, Islayne, Marlon, Samilly, Amanda)
 * Total de Boletos: R$ 41.477,60 (26 vendas)
 * Total de Acessórios: R$ 349,99 (6 vendas)
 */

export interface VendaGiseleOficial {
  id: string;
  data_venda: string;
  created_at: string;
  vendedor_nome: string | null;
  trainee_nome: string;
  metodo_pagamento: string;
  forma_pagamento: string | null;
  valor_boleto: number;
  valor_total: number;
  categoria: string;
  produto_nome: string;
  teve_participacao_trainee: boolean;
  filial_id?: string;
  status: string;
}

export const VENDAS_BOLETOS_GISELE_RAW = [
  {
    id: "6ded4b47-1217-4a09-8bc9-72968e658789",
    data_venda: "2026-10-31 07:30:00",
    vendedor_nome: "PAMELA CRISTINA",
    trainee_nome: "GISELE GOMES",
    metodo_pagamento: "boleto",
    forma_pagamento: "BOLETO",
    valor_boleto: 1780.00,
    valor_total_venda: 1780.00
  },
  {
    id: "e6870268-ba3e-454a-a242-85dc33e1f1f9",
    data_venda: "2026-10-31 07:00:00",
    vendedor_nome: "PAMELA CRISTINA",
    trainee_nome: "GISELE GOMES",
    metodo_pagamento: "boleto",
    forma_pagamento: "BOLETO",
    valor_boleto: 1600.00,
    valor_total_venda: 1600.00
  },
  {
    id: "e2255b8a-4c18-487e-9969-32b647fc59f9",
    data_venda: "2026-10-30 16:03:18.890711",
    vendedor_nome: null,
    trainee_nome: "GISELE GOMES",
    metodo_pagamento: "boleto",
    forma_pagamento: "PIX",
    valor_boleto: 1600.00,
    valor_total_venda: 1600.00
  },
  {
    id: "8c054a6b-013d-408d-8da1-f9bad44211c2",
    data_venda: "2026-10-30 12:06:12.531",
    vendedor_nome: "ISLAYNE COELHO",
    trainee_nome: "GISELE GOMES",
    metodo_pagamento: "BOLETO",
    forma_pagamento: "BOLETO",
    valor_boleto: 1540.00,
    valor_total_venda: 1540.00
  },
  {
    id: "b27454f2-641c-49f9-8d95-efeed548b7cd",
    data_venda: "2026-10-29 12:07:02.58178",
    vendedor_nome: null,
    trainee_nome: "GISELE GOMES",
    metodo_pagamento: "boleto",
    forma_pagamento: "PIX",
    valor_boleto: 1484.60,
    valor_total_venda: 1484.60
  },
  {
    id: "967d80d7-62e5-4bd8-8417-754b958abee3",
    data_venda: "2026-10-28 20:04:29.56896",
    vendedor_nome: "ISLAYNE COELHO",
    trainee_nome: "GISELE GOMES",
    metodo_pagamento: "BOLETO",
    forma_pagamento: "BOLETO",
    valor_boleto: 1800.00,
    valor_total_venda: 1800.00
  },
  {
    id: "325a9401-46f4-441c-9141-4488b165e441",
    data_venda: "2026-10-28 17:41:38.378587",
    vendedor_nome: "ISLAYNE COELHO",
    trainee_nome: "GISELE GOMES",
    metodo_pagamento: "BOLETO",
    forma_pagamento: "BOLETO",
    valor_boleto: 1300.00,
    valor_total_venda: 1300.00
  },
  {
    id: "23ad030a-c2aa-4b6b-b35c-4eefbbc7e682",
    data_venda: "2026-10-27 18:04:59.455202",
    vendedor_nome: "ISLAYNE COELHO",
    trainee_nome: "GISELE GOMES",
    metodo_pagamento: "BOLETO",
    forma_pagamento: "BOLETO",
    valor_boleto: 1500.00,
    valor_total_venda: 1500.00
  },
  {
    id: "63cc1958-9b69-4ed8-a1d0-280779c5cc70",
    data_venda: "2026-10-27 15:56:26.448068",
    vendedor_nome: "ISLAYNE COELHO",
    trainee_nome: "GISELE GOMES",
    metodo_pagamento: "BOLETO",
    forma_pagamento: "BOLETO",
    valor_boleto: 1500.00,
    valor_total_venda: 1500.00
  },
  {
    id: "fa463575-6312-480f-ada8-4aa3ee672468",
    data_venda: "2026-10-27 12:19:39.789513",
    vendedor_nome: "ISLAYNE COELHO",
    trainee_nome: "GISELE GOMES",
    metodo_pagamento: "BOLETO",
    forma_pagamento: "BOLETO",
    valor_boleto: 1400.00,
    valor_total_venda: 1400.00
  },
  {
    id: "e42eaa24-0ff2-4960-aadf-b2a3c74ff250",
    data_venda: "2026-10-27 11:29:08.707701",
    vendedor_nome: "ISLAYNE COELHO",
    trainee_nome: "GISELE GOMES",
    metodo_pagamento: "BOLETO",
    forma_pagamento: "BOLETO",
    valor_boleto: 1700.00,
    valor_total_venda: 1700.00
  },
  {
    id: "e4109b5b-9d37-4167-850c-0aba73281cd9",
    data_venda: "2026-10-23 11:09:38.195403",
    vendedor_nome: "PAMELA CRISTINA",
    trainee_nome: "GISELE GOMES",
    metodo_pagamento: "BOLETO",
    forma_pagamento: "BOLETO",
    valor_boleto: 1500.00,
    valor_total_venda: 1500.00
  },
  {
    id: "f73d16d6-04fc-4391-9662-0f0d8a1c26ce",
    data_venda: "2026-10-22 18:55:45.707804",
    vendedor_nome: "PAMELA CRISTINA",
    trainee_nome: "GISELE GOMES",
    metodo_pagamento: "BOLETO",
    forma_pagamento: "BOLETO",
    valor_boleto: 1600.00,
    valor_total_venda: 1600.00
  },
  {
    id: "a4c955ef-a933-46c8-9c65-40daf8efb940",
    data_venda: "2026-10-22 14:50:43.997",
    vendedor_nome: "PAMELA CRISTINA",
    trainee_nome: "GISELE GOMES",
    metodo_pagamento: "boleto",
    forma_pagamento: "BOLETO",
    valor_boleto: 1200.00,
    valor_total_venda: 1200.00
  },
  {
    id: "e2786bc5-8aa2-4cff-b272-77cb214888ff",
    data_venda: "2026-10-20 14:09:23.329153",
    vendedor_nome: "AMANDA",
    trainee_nome: "GISELE GOMES",
    metodo_pagamento: "BOLETO + ENTRADA",
    forma_pagamento: "BOLETO + ENTRADA",
    valor_boleto: 1400.00,
    valor_total_venda: 1400.00
  },
  {
    id: "22433ce8-fe9a-4efc-a41e-6275e3cd893e",
    data_venda: "2026-10-19 18:26:08.887898",
    vendedor_nome: "SAMILLY VITÓRIA",
    trainee_nome: "GISELE GOMES",
    metodo_pagamento: "boleto",
    forma_pagamento: null,
    valor_boleto: 1400.00,
    valor_total_venda: 1400.00
  },
  {
    id: "01bcb24f-502f-44fc-8683-bd12c2d8fedb",
    data_venda: "2026-10-09 22:55:27",
    vendedor_nome: "PAMELA CRISTINA",
    trainee_nome: "GISELE GOMES",
    metodo_pagamento: "BOLETO",
    forma_pagamento: "BOLETO",
    valor_boleto: 2300.00,
    valor_total_venda: 2300.00
  },
  {
    id: "33ad4843-3fd0-4228-8381-44403ebc3ff4",
    data_venda: "2026-10-09 22:28:07",
    vendedor_nome: "PAMELA CRISTINA",
    trainee_nome: "GISELE GOMES",
    metodo_pagamento: "Boleto",
    forma_pagamento: "BOLETO",
    valor_boleto: 1573.00,
    valor_total_venda: 1573.00
  },
  {
    id: "bba3ada8-f92a-4bfa-b994-22fba1199a45",
    data_venda: "2026-10-08 18:27:23.047",
    vendedor_nome: "MARLON MAYCON",
    trainee_nome: "GISELE GOMES",
    metodo_pagamento: "Boleto",
    forma_pagamento: null,
    valor_boleto: 1500.00,
    valor_total_venda: 1500.00
  },
  {
    id: "998b0061-fc06-4bf4-86e1-9f88d727b162",
    data_venda: "2026-10-08 17:38:00.788",
    vendedor_nome: "MARLON MAYCON",
    trainee_nome: "GISELE GOMES",
    metodo_pagamento: "Boleto",
    forma_pagamento: null,
    valor_boleto: 1400.00,
    valor_total_venda: 1400.00
  },
  {
    id: "98d57182-511b-4016-95a8-4372c2a9de05",
    data_venda: "2026-10-08 10:03:42.158",
    vendedor_nome: "MARLON MAYCON",
    trainee_nome: "GISELE GOMES",
    metodo_pagamento: "Boleto",
    forma_pagamento: null,
    valor_boleto: 1450.00,
    valor_total_venda: 1450.00
  },
  {
    id: "67ae103e-b313-40b4-9dcc-6958b98690aa",
    data_venda: "2026-10-06 14:28:42",
    vendedor_nome: "MARLON MAYCON",
    trainee_nome: "GISELE GOMES",
    metodo_pagamento: "BOLETO",
    forma_pagamento: "BOLETO",
    valor_boleto: 1490.00,
    valor_total_venda: 1490.00
  },
  {
    id: "6b4abd1c-0f41-4d15-8b08-bf9180341019",
    data_venda: "2026-10-05 12:57:07.702",
    vendedor_nome: "MARLON MAYCON",
    trainee_nome: "GISELE GOMES",
    metodo_pagamento: "Boleto",
    forma_pagamento: null,
    valor_boleto: 1400.00,
    valor_total_venda: 1400.00
  },
  {
    id: "6529ed2c-3411-48f4-b5cb-587d3898a34b",
    data_venda: "2026-10-03 13:40:39.815",
    vendedor_nome: "SAMILLY VITÓRIA",
    trainee_nome: "GISELE GOMES",
    metodo_pagamento: "Boleto",
    forma_pagamento: "PIX",
    valor_boleto: 1600.00,
    valor_total_venda: 1600.00
  },
  {
    id: "1fdc01c5-aed9-4863-b094-50f8615eba50",
    data_venda: "2026-10-01 16:11:25.604",
    vendedor_nome: "SAMILLY VITÓRIA",
    trainee_nome: "GISELE GOMES",
    metodo_pagamento: "Boleto",
    forma_pagamento: "PIX",
    valor_boleto: 2600.00,
    valor_total_venda: 2600.00
  },
  {
    id: "26f94816-cffe-4407-b12e-afa322ce336d",
    data_venda: "2026-10-01 16:04:25",
    vendedor_nome: "SAMILLY VITÓRIA",
    trainee_nome: "GISELE GOMES",
    metodo_pagamento: "BOLETO",
    forma_pagamento: "BOLETO",
    valor_boleto: 1860.00,
    valor_total_venda: 1860.00
  }
];

export const VENDAS_ACESSORIOS_GISELE_RAW = [
  {
    id: "65ef7882-1884-46bf-8726-59c2724c51af",
    data_venda: "2026-10-05 14:21:40",
    vendedor_nome: "GISELE GOMES",
    trainee_nome: null,
    categoria: "Acessórios",
    valor: 69.99
  },
  {
    id: "5e9d5e0b-204b-4141-ae71-c12da6e425bc",
    data_venda: "2026-10-05 14:19:35",
    vendedor_nome: "GISELE GOMES",
    trainee_nome: null,
    categoria: "Acessórios",
    valor: 30.00
  },
  {
    id: "a7370bcb-a37a-483e-b813-3d88fb589eed",
    data_venda: "2026-09-24 15:00:00",
    vendedor_nome: "SAMILLY VITÓRIA",
    trainee_nome: "GISELE GOMES",
    categoria: "Acessórios",
    valor: 20.00
  },
  {
    id: "daf24d8a-e99a-4a79-9038-0b956fe3f4e3",
    data_venda: "2026-09-13 15:00:00",
    vendedor_nome: "GISELE GOMES",
    trainee_nome: null,
    categoria: "Acessórios",
    valor: 20.00
  },
  {
    id: "35225c3b-53f2-415d-b569-c65b99c20a14",
    data_venda: "2026-09-08 15:00:00",
    vendedor_nome: "SAMILLY VITÓRIA",
    trainee_nome: "GISELE GOMES",
    categoria: "Acessórios",
    valor: 60.00
  },
  {
    id: "231f20c5-fe68-486f-8d8b-679461916d0b",
    data_venda: "2026-09-05 15:00:00",
    vendedor_nome: "SAMILLY VITÓRIA",
    trainee_nome: "GISELE GOMES",
    categoria: "Acessórios",
    valor: 150.00
  }
];

export const METAS_GISELE_2026_10 = {
  total_boletos: 41477.60,
  total_acessorios: 349.99,
  total_acessorios_outubro: 99.99,
  volume_total: 41827.59,
  meta_boleto: 35000.00,
  super_meta_boleto: 45000.00,
  meta_acessorios: 5000.00,
  super_meta_acessorios: 7500.00
};

export function gerarVendasGisele202610(traineeId?: string): any[] {
  const lista: any[] = [];

  VENDAS_BOLETOS_GISELE_RAW.forEach((b, idx) => {
    lista.push({
      id: b.id || `gisele-boleto-${idx}`,
      created_at: b.data_venda,
      data: b.data_venda,
      vendedor_nome: b.vendedor_nome,
      trainee_nome: "GISELE GOMES",
      trainee_id: traineeId || "gisele-trainee-id",
      teve_participacao_trainee: true,
      metodo_pagamento: b.metodo_pagamento,
      forma_pagamento: b.forma_pagamento,
      valor_boleto: b.valor_boleto,
      valor_total: b.valor_total_venda,
      total: b.valor_total_venda,
      valor: b.valor_total_venda,
      categoria: "Smartphones",
      produto_nome: "Smartphone Financiado / Boleto",
      status: "CONCLUIDA",
      itens_venda: [
        {
          produto_nome: "Smartphone Financiado / Boleto",
          quantidade: 1,
          valor_unitario: b.valor_total_venda,
          valor_total: b.valor_total_venda,
          categoria: "Smartphones"
        }
      ]
    });
  });

  VENDAS_ACESSORIOS_GISELE_RAW.forEach((a, idx) => {
    lista.push({
      id: a.id || `gisele-acess-${idx}`,
      created_at: a.data_venda,
      data: a.data_venda,
      vendedor_nome: a.vendedor_nome || "GISELE GOMES",
      trainee_nome: a.trainee_nome || (a.vendedor_nome === "GISELE GOMES" ? null : "GISELE GOMES"),
      trainee_id: traineeId || "gisele-trainee-id",
      teve_participacao_trainee: Boolean(a.trainee_nome),
      metodo_pagamento: "pix",
      forma_pagamento: "PIX",
      valor_boleto: 0,
      valor_total: a.valor,
      total: a.valor,
      valor: a.valor,
      categoria: "Acessórios",
      produto_nome: "Acessório Premium",
      status: "CONCLUIDA",
      itens_venda: [
        {
          produto_nome: "Acessório Premium",
          quantidade: 1,
          valor_unitario: a.valor,
          valor_total: a.valor,
          categoria: "Acessórios"
        }
      ]
    });
  });

  return lista;
}
