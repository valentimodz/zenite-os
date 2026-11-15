-- =================================================================================
-- VIEW: public.vw_rastreabilidade_imeis
-- Consolida dados do aparelho (public.imeis + public.produtos + public.filiais)
-- com a última venda válida (public.vendas / public.itens_venda / public.clientes)
-- para o modal "🔍 Rastrear IMEI & Histórico de Vendas".
-- =================================================================================

CREATE OR REPLACE VIEW public.vw_rastreabilidade_imeis AS
SELECT
  i.id AS imei_id,
  i.imei,
  i.empresa_id,
  i.produto_id,
  COALESCE(p.nome, v_info.produto_nome, 'Aparelho') AS modelo,
  COALESCE(i.cor, p.cor) AS cor,
  CASE
    WHEN COALESCE(i.vendido, false) = true OR UPPER(TRIM(COALESCE(i.status, ''))) = 'VENDIDO' THEN 'VENDIDO'
    ELSE 'DISPONIVEL'
  END AS status,
  (COALESCE(i.vendido, false) = true OR UPPER(TRIM(COALESCE(i.status, ''))) = 'VENDIDO') AS vendido,
  COALESCE(i.filial_id, p.filial_id, v_info.filial_id) AS filial_id,
  COALESCE(f.nome, 'Filial') AS filial_nome,
  v_info.venda_id,
  v_info.cliente_id,
  v_info.cliente_nome,
  v_info.cliente_cpf,
  v_info.cliente_telefone,
  v_info.data_venda,
  COALESCE(v_info.valor_vendido, i.preco_venda, p.preco_venda, p.preco, 0) AS valor_vendido,
  v_info.vendedor_nome,
  v_info.forma_pagamento,
  i.created_at AS data_entrada
FROM public.imeis i
LEFT JOIN public.produtos p ON p.id = i.produto_id
LEFT JOIN public.filiais f ON f.id = COALESCE(i.filial_id, p.filial_id)
LEFT JOIN LATERAL (
  SELECT
    v.id AS venda_id,
    v.filial_id,
    v.produto_nome,
    v.cliente_id,
    COALESCE(v.cliente_nome, c.nome, 'Consumidor Final') AS cliente_nome,
    COALESCE(v.cliente_cpf_cnpj, c.cpf_cnpj, c.cpf) AS cliente_cpf,
    COALESCE(v.cliente_telefone, c.telefone) AS cliente_telefone,
    v.created_at AS data_venda,
    COALESCE(iv.preco_unitario_vendido, iv.valor_total, v.preco_unitario_vendido, v.valor_total) AS valor_vendido,
    v.vendedor_nome,
    v.forma_pagamento
  FROM public.vendas v
  LEFT JOIN public.itens_venda iv ON iv.venda_id = v.id AND iv.imei = i.imei
  LEFT JOIN public.clientes c ON c.id = v.cliente_id
  WHERE (v.imei = i.imei OR iv.imei = i.imei)
    AND COALESCE(UPPER(v.status), 'CONCLUIDA') NOT IN ('CANCELADA', 'ESTORNADA', 'EXCLUIDA')
  ORDER BY v.created_at DESC
  LIMIT 1
) v_info ON true;
