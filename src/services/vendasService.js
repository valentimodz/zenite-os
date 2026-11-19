import { supabase } from '../supabaseClient';

/**
 * Executa update resiliente em public.vendas removendo colunas opcionais inexistentes no schema
 * ou referências opcionais que violem FK sem comprometer outros campos.
 */
async function executarUpdateResilienteVendas(
    vendaId,
    initialPayload,
    { verifyUpdated = false, optionalGroups = [] } = {}
) {
    const attemptPayload = { ...initialPayload };
    let data = null;
    let error = null;

    for (let attempt = 0; attempt < 20; attempt++) {
        const query = supabase
            .from('vendas')
            .update(attemptPayload)
            .eq('id', vendaId);

        const res = verifyUpdated
            ? await query.select('id, cliente_id, cliente_nome')
            : await query;

        data = res.data;
        error = res.error;

        if (!error) {
            if (verifyUpdated && (!Array.isArray(data) || data.length === 0)) {
                console.warn('⚠️ [vendasService] UPDATE em vendas não retornou linhas atualizadas (verifique política RLS de UPDATE em public.vendas):', vendaId);
            }
            return { data, error: null };
        }

        const errText = `${error.message || ''} ${error.details || ''} ${error.hint || ''}`;
        const isMissingCol =
            error.code === '42703' ||
            error.code === 'PGRST204' ||
            /column .* does not exist|Could not find the '.*' column/i.test(errText);
        const isOptionalFkErr =
            error.code === '23503' ||
            /foreign key|violates foreign key constraint/i.test(errText);

        if (!isMissingCol && !isOptionalFkErr) break;

        console.warn(`⚠️ [vendasService] Ajuste resiliente de payload em vendas (tentativa ${attempt + 1}):`, error.message);

        let removedAny = false;

        if (isMissingCol) {
            const explicitMatch =
                errText.match(/Could not find the '([^']+)' column/i) ||
                errText.match(/column\s+(?:"?[a-zA-Z0-9_]+"?\.)?"?([a-zA-Z0-9_]+)"?\s+(?:of relation|does not exist)/i);

            if (explicitMatch && explicitMatch[1] && Object.prototype.hasOwnProperty.call(attemptPayload, explicitMatch[1])) {
                delete attemptPayload[explicitMatch[1]];
                removedAny = true;
            }
        }

        if (!removedAny) {
            for (const grp of optionalGroups) {
                if (grp.test.test(errText)) {
                    const keysToRemove = grp.keys || [grp.key];
                    for (const k of keysToRemove) {
                        if (Object.prototype.hasOwnProperty.call(attemptPayload, k)) {
                            delete attemptPayload[k];
                            removedAny = true;
                        }
                    }
                }
            }
        }

        if (!removedAny) break;
    }

    return { data, error };
}

/**
 * Atualiza os metadados de uma venda após a criação via RPC.
 * Persiste os dados do cliente em fase isolada e prioritária antes dos metadados operacionais.
 */
export async function atualizarVendaAposCriacao({
    vendaId,
    empresaId,
    filialId,
    caixaId,
    item,
    cliente,
    vendedor,
    formaPagamento,
    trainee,
    usedDevice,
    valoresPagamento
}) {
    if (!vendaId) {
        throw new Error('ID da venda não fornecido para atualização.');
    }

    const clienteIdLimpo =
        cliente?.id &&
        String(cliente.id).trim() &&
        String(cliente.id).trim() !== '00000000-0000-0000-0000-000000000000'
            ? String(cliente.id).trim()
            : null;
    const clienteNomeRaw = typeof cliente?.nome === 'string' ? cliente.nome.trim() : '';
    const isNomeGenerico = !clienteNomeRaw || clienteNomeRaw.toUpperCase() === 'CONSUMIDOR FINAL';
    const docCliente = cliente?.cpf_cnpj || cliente?.documento || cliente?.cpfCnpj || cliente?.cpf || null;

    // Fase 1 (prioritária e isolada): garante gravação de cliente_id e colunas espelhadas em public.vendas
    const clientePayload = {
        cliente_id: clienteIdLimpo,
        ...(clienteNomeRaw && !isNomeGenerico
            ? { cliente_nome: clienteNomeRaw }
            : (!clienteIdLimpo || cliente?.isConsumidorFinal === true ? { cliente_nome: 'Consumidor Final' } : {})),
        cliente_cpf_cnpj: docCliente,
        cliente_documento: docCliente,
        cliente_telefone: cliente?.telefone || null,
        cliente_email: cliente?.email || null
    };

    const clienteOptionalGroups = [
        { key: 'cliente_documento', test: /cliente_documento/i },
        { key: 'cliente_telefone', test: /cliente_telefone/i },
        { key: 'cliente_email', test: /cliente_email/i },
        { key: 'cliente_cpf_cnpj', test: /cliente_cpf_cnpj/i }
    ];

    const clienteRes = await executarUpdateResilienteVendas(vendaId, clientePayload, {
        verifyUpdated: true,
        optionalGroups: clienteOptionalGroups
    });

    if (clienteRes.error) {
        console.error('❌ [vendasService.atualizarVendaAposCriacao] Falha ao gravar dados do cliente na venda:', clienteRes.error);
        throw clienteRes.error;
    }

    // Fase 2: metadados operacionais/financeiros em chamada separada para nunca comprometer os campos do cliente
    const metaPayload = {
        empresa_id: empresaId,
        filial_id: filialId,
        caixa_id: caixaId || null,
        produto_nome: item?.produto?.nome || item?.nome || 'Produto',
        imei: item?.imei || null,

        // Dados do Vendedor
        vendedor_id: vendedor?.id || null,
        usuario_id: vendedor?.id || null,
        criado_por: vendedor?.id || null,
        vendedor_nome: vendedor?.nome || 'Vendedor',

        // Pagamento
        forma_pagamento: String(formaPagamento || 'DINHEIRO').toUpperCase().trim(),
        metodo_pagamento: String(formaPagamento || 'DINHEIRO').toUpperCase().trim(),
        valor_pix: Number(valoresPagamento?.valor_pix || 0),
        valor_cartao: Number(valoresPagamento?.valor_cartao || 0),
        valor_dinheiro: Number(valoresPagamento?.valor_dinheiro || 0),
        valor_boleto: Number(valoresPagamento?.valor_boleto || 0),
        valor_troca: Number(valoresPagamento?.valor_troca || 0),

        // Trainee
        trainee_id: trainee?.id || null,
        trainee_nome: trainee?.nome || null,
        teve_participacao_trainee: Boolean(trainee?.id),

        // Aparelho Usado na Troca (Trade-in)
        used_produto_nome: usedDevice?.produto_nome || usedDevice?.nome || null,
        used_imei: usedDevice?.imei || null,
        used_valor_avaliacao: Number(usedDevice?.valor_avaliacao ?? usedDevice?.valor ?? 0) || 0
    };

    const metaOptionalGroups = [
        { key: 'used_', keys: ['used_produto_nome', 'used_imei', 'used_valor_avaliacao'], test: /used_/i },
        { key: 'valor_', keys: ['valor_pix', 'valor_cartao', 'valor_dinheiro', 'valor_boleto', 'valor_troca'], test: /valor_(pix|cartao|dinheiro|boleto|troca)/i },
        { key: 'trainee_', keys: ['trainee_id', 'trainee_nome', 'teve_participacao_trainee'], test: /trainee/i },
        { key: 'caixa_id', test: /caixa_id|caixas/i },
        { key: 'criado_por', test: /criado_por/i },
        { key: 'usuario_id', test: /usuario_id/i },
        { key: 'imei', test: /\bimei\b/i },
        { key: 'metodo_pagamento', test: /metodo_pagamento/i },
        { key: 'forma_pagamento', test: /forma_pagamento/i }
    ];

    const metaRes = await executarUpdateResilienteVendas(vendaId, metaPayload, {
        verifyUpdated: false,
        optionalGroups: metaOptionalGroups
    });

    if (metaRes.error) {
        console.error('❌ [vendasService.atualizarVendaAposCriacao]:', metaRes.error);
        throw metaRes.error;
    }

    return metaRes.data || clienteRes.data;
}

/**
 * Resolve a URL base e os cabeçalhos de autenticação do micro-serviço fiscal.
 */
function getFiscalServiceConfig() {
    const fiscalServiceBaseUrl = (import.meta.env.VITE_FISCAL_SERVICE_URL || 'http://localhost:8000').replace(/\/$/, '');
    const fiscalServiceToken = (
        import.meta.env.VITE_FISCAL_SERVICE_TOKEN ||
        import.meta.env.VITE_APP_SECRET_TOKEN ||
        'zenite_fiscal_token'
    ).trim();

    return {
        fiscalServiceBaseUrl,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${fiscalServiceToken}`,
            'X-API-Key': fiscalServiceToken
        }
    };
}

/**
 * Emite Nota Fiscal Eletrônica (NF-e modelo 55) via micro-serviço Python (FastAPI + PyNFe)
 * para a SEFAZ-PA (SVRS), utilizando o Certificado A1 configurado para o Tenant.
 *
 * @param {Object} params
 * @param {string} params.vendaId ID da venda no Supabase
 * @param {number} [params.ambiente] 1=Produção, 2=Homologação (default: 2)
 */
export async function emitirNfeVenda({ vendaId, ambiente = 2 }) {
    if (!vendaId) {
        throw new Error('ID da venda não fornecido para emissão fiscal.');
    }

    // 1. Carregar os dados completos da venda
    const { data: venda, error: vendaErr } = await supabase
        .from('vendas')
        .select('*')
        .eq('id', vendaId)
        .single();

    if (vendaErr || !venda) {
        throw new Error(`Erro ao obter dados da venda para emissão: ${vendaErr?.message || 'Venda não encontrada'}`);
    }

    const empresaId = venda.empresa_id;
    if (!empresaId) {
        throw new Error('Venda não possui vínculo com nenhuma empresa/tenant.');
    }

    // 2. Carregar empresa, filial, configurações fiscais, itens reais da venda e destinatário (public.clientes)
    const filialId = venda.filial_id;
    const [empresaRes, configFiscalRes, filialRes, itensVendaRes, clienteRes] = await Promise.all([
        supabase.from('companies').select('*').eq('id', empresaId).single(),
        supabase.from('configuracoes_fiscais').select('*').eq('tenant_id', empresaId).maybeSingle(),
        filialId ? supabase.from('filiais').select('*').eq('id', filialId).maybeSingle() : Promise.resolve({ data: null }),
        supabase.from('itens_venda').select('*').eq('venda_id', venda.id),
        venda.cliente_id
            ? supabase
                .from('clientes')
                .select('id, nome, cpf_cnpj, telefone, email, logradouro, numero, complemento, bairro, cidade, uf, cep')
                .eq('id', venda.cliente_id)
                .maybeSingle()
            : Promise.resolve({ data: null })
    ]);

    const empresa = empresaRes.data;
    const configFiscal = configFiscalRes.data;
    const filial = filialRes?.data || null;
    const itensVenda = Array.isArray(itensVendaRes?.data) ? itensVendaRes.data : [];

    // Fallback caso a tabela clientes ainda não possua a coluna complemento ou cliente_id não esteja vinculado
    let clienteDb = clienteRes?.data || null;
    if (venda.cliente_id && clienteRes?.error) {
        const { data: cliFallback } = await supabase
            .from('clientes')
            .select('id, nome, cpf_cnpj, telefone, email, logradouro, numero, bairro, cidade, uf, cep')
            .eq('id', venda.cliente_id)
            .maybeSingle();
        clienteDb = cliFallback || null;
    }

    const cpfBuscaFallback = String(venda.cliente_cpf_cnpj || venda.cliente_documento || '').trim();
    const cpfDigitsBusca = cpfBuscaFallback.replace(/\D/g, '');
    if (!clienteDb && cpfDigitsBusca) {
        const { data: cliByCpf } = await supabase
            .from('clientes')
            .select('id, nome, cpf_cnpj, telefone, email, logradouro, numero, bairro, cidade, uf, cep')
            .eq('empresa_id', empresaId)
            .or(`cpf_cnpj.eq.${cpfBuscaFallback},cpf_cnpj.eq.${cpfDigitsBusca}`)
            .limit(1)
            .maybeSingle();
        clienteDb = cliByCpf || null;
    }

    // Buscar dados dos produtos vinculados aos itens da venda (para sku, nome, ncm, cfop)
    const produtoIdsSet = new Set();
    itensVenda.forEach((it) => {
        if (it?.produto_id) produtoIdsSet.add(String(it.produto_id));
    });
    if (venda.produto_id) {
        produtoIdsSet.add(String(venda.produto_id));
    }

    const produtosMap = {};
    const produtoIds = Array.from(produtoIdsSet);
    if (produtoIds.length > 0) {
        const { data: produtosData } = await supabase
            .from('produtos')
            .select('*')
            .in('id', produtoIds);

        if (Array.isArray(produtosData)) {
            produtosData.forEach((p) => {
                if (p?.id) produtosMap[String(p.id)] = p;
            });
        }
    }

    if (!configFiscal || !configFiscal.certificado_senha_criptografada) {
        throw new Error('Configuração fiscal incompleta ou certificado digital A1 não configurado para esta empresa.');
    }

    // 3. Obter URL do certificado A1 (se for bucket privado, gera URL assinada temporária)
    let certUrl = configFiscal.certificado_a1_url;
    if (certUrl && !certUrl.startsWith('http')) {
        const { data: signedData } = await supabase.storage
            .from('fiscal-certificates')
            .createSignedUrl(certUrl, 120); // 120 segundos
        if (signedData?.signedUrl) {
            certUrl = signedData.signedUrl;
        }
    }

    // 4. Montar o payload para a rota do micro-serviço FastAPI
    const { fiscalServiceBaseUrl, headers: fiscalHeaders } = getFiscalServiceConfig();

    const valorTotal = Number(venda.valor_total || (
        Number(venda.valor_pix || 0) +
        Number(venda.valor_cartao || 0) +
        Number(venda.valor_dinheiro || 0) +
        Number(venda.valor_boleto || 0)
    ) || 0);

    const localAmbiente = typeof localStorage !== 'undefined' ? localStorage.getItem(`fiscal_ambiente_${empresaId}`) : null;
    const ambienteFinal = Number(ambiente || configFiscal.ambiente || localAmbiente || 2);

    const isPlaceholderTexto = (val) => {
        const limpo = String(val || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim()
            .toLowerCase();
        return !limpo || limpo === 'nao informado';
    };

    const clienteNomeFinal = String(clienteDb?.nome || venda.cliente_nome || 'Consumidor Final').trim();
    const clienteCpfDigits = String(
        clienteDb?.cpf_cnpj ||
        venda.cliente_cpf_cnpj ||
        venda.cliente_documento ||
        ''
    ).replace(/\D/g, '');
    const clienteCpfFinal = clienteCpfDigits || '00000000000';
    const clienteTelefoneFinal = String(clienteDb?.telefone || venda.cliente_telefone || '').trim() || null;
    const clienteEmailFinal = String(clienteDb?.email || venda.cliente_email || '').trim() || null;
    const clienteUfFinal = String(clienteDb?.uf || 'PA').trim().toUpperCase().slice(0, 2) || 'PA';
    const clienteCidadeFinal = !isPlaceholderTexto(clienteDb?.cidade)
        ? String(clienteDb.cidade).trim()
        : (clienteUfFinal === 'PA' ? 'Marabá' : 'Não Informado');
    const clienteLogradouroFinal = !isPlaceholderTexto(clienteDb?.logradouro)
        ? String(clienteDb.logradouro).trim()
        : 'Rua Principal';
    const clienteNumeroFinal = String(clienteDb?.numero || '').trim() || 'S/N';
    const clienteComplementoFinal = String(clienteDb?.complemento || '').trim() || null;
    const clienteBairroFinal = !isPlaceholderTexto(clienteDb?.bairro)
        ? String(clienteDb.bairro).trim()
        : 'Centro';
    const clienteCepDigits = String(clienteDb?.cep || '').replace(/\D/g, '');
    const clienteCepFinal = (clienteCepDigits.length === 8 && !/^0+$/.test(clienteCepDigits))
        ? clienteCepDigits
        : '68500000';

    const buildFiscalItem = ({
        nomeBase,
        imei,
        sku,
        codigo,
        codigoBarras,
        ean,
        ncm,
        cfop,
        quantidade,
        valorUnitario,
        valorTotalItem,
        produtoId
    }) => {
        const nomeLimpo = String(nomeBase || '').replace(/\s+/g, ' ').trim();
        const imeiLimpo = String(imei || '').trim() || null;
        const descricao = !nomeLimpo
            ? (imeiLimpo ? `Aparelho - IMEI: ${imeiLimpo}` : 'Produto / Mercadoria')
            : (imeiLimpo && !nomeLimpo.toUpperCase().includes(imeiLimpo.toUpperCase())
                ? `${nomeLimpo} - IMEI: ${imeiLimpo}`
                : nomeLimpo);

        const qtd = Number(quantidade || 1) || 1;
        const vTot = Number(valorTotalItem || 0);
        const vUnit = Number(valorUnitario || 0) || (qtd > 0 ? vTot / qtd : vTot);
        const ncmDigits = String(ncm || '').replace(/\D/g, '');
        const cfopDigits = String(cfop || '').replace(/\D/g, '');
        const codigoResolvido = String(
            sku ||
            codigo ||
            codigoBarras ||
            ean ||
            imeiLimpo ||
            (produtoId ? String(produtoId).slice(0, 8) : '') ||
            venda.id.slice(0, 8)
        ).trim();

        return {
            codigo: codigoResolvido,
            nome: descricao,
            ncm: ncmDigits.length === 8 ? ncmDigits : '85171300',
            cfop: cfopDigits.length === 4 ? cfopDigits : '5102',
            ucom: 'UN',
            quantidade: qtd,
            valor_unitario: Number(vUnit.toFixed(2)),
            valor_total: Number((vTot > 0 ? vTot : vUnit * qtd).toFixed(2)),
            imei: imeiLimpo,
            inf_ad_prod: imeiLimpo ? `IMEI: ${imeiLimpo}` : null,
            codigo_barras: codigoBarras || ean || 'SEM GTIN',
            ean: ean || codigoBarras || 'SEM GTIN'
        };
    };

    const itensPayload = itensVenda.length > 0
        ? itensVenda.map((it) => {
            const prod = it.produto_id ? produtosMap[String(it.produto_id)] : null;
            const singleFallbackNome = itensVenda.length === 1
                ? (venda.produto_nome || venda.produtos_descricao || venda.itens_resumo)
                : '';
            const imeiItem = it.imei || it.serial || it.numero_serie || (itensVenda.length === 1 ? (venda.imei || venda.imei_novo) : null);
            const qtdItem = Number(it.quantidade ?? it.qtd ?? 1) || 1;
            const vTotItem = Number(it.valor_total ?? it.subtotal ?? 0) || (itensVenda.length === 1 ? valorTotal : 0);
            const vUnitItem = Number(it.preco_unitario_vendido ?? it.preco_unitario ?? it.valor_unitario ?? it.preco ?? 0);

            return buildFiscalItem({
                nomeBase: it.produto_nome || it.nome || it.descricao || prod?.nome || singleFallbackNome,
                imei: imeiItem,
                sku: prod?.sku || it.sku,
                codigo: it.codigo,
                codigoBarras: prod?.codigo_barras || it.codigo_barras,
                ean: prod?.ean || it.ean,
                ncm: it.ncm || prod?.ncm,
                cfop: it.cfop || prod?.cfop,
                quantidade: qtdItem,
                valorUnitario: vUnitItem,
                valorTotalItem: vTotItem > 0 ? vTotItem : (vUnitItem * qtdItem),
                produtoId: it.produto_id || prod?.id
            });
        })
        : [
            (() => {
                const prodVenda = venda.produto_id ? produtosMap[String(venda.produto_id)] : null;
                return buildFiscalItem({
                    nomeBase: venda.produto_nome || prodVenda?.nome || venda.produtos_descricao || venda.itens_resumo,
                    imei: venda.imei || venda.imei_novo,
                    sku: prodVenda?.sku,
                    codigo: venda.codigo,
                    codigoBarras: prodVenda?.codigo_barras || venda.codigo_barras,
                    ean: prodVenda?.ean || venda.ean,
                    ncm: prodVenda?.ncm || venda.ncm,
                    cfop: prodVenda?.cfop || venda.cfop,
                    quantidade: venda.quantidade || 1,
                    valorUnitario: valorTotal / (Number(venda.quantidade || 1) || 1),
                    valorTotalItem: valorTotal,
                    produtoId: venda.produto_id || prodVenda?.id
                });
            })()
        ];

    const payload = {
        venda_id: venda.id,
        numero_nfe: null, // Deixa o microserviço fiscal determinar atomicamente via next_nfe_number
        serie: 2,         // Série 2 Fixa
        natureza_operacao: 'Venda de mercadoria adquirida ou recebida de terceiros',
        ambiente: ambienteFinal,
        forma_pagamento: venda.forma_pagamento || 'DINHEIRO',
        filial_id: filialId || null,
        filial_nome: filial?.nome || filial?.razao_social || venda.filial_nome || null,
        emitente: {
            cnpj: configFiscal.cnpj || filial?.cnpj || empresa?.cnpj || '51450569000190',
            razao_social: filial?.razao_social || empresa?.razao_social || empresa?.name || 'Empresa Emissora',
            nome_fantasia: filial?.nome || empresa?.name || null,
            inscricao_estadual: filial?.inscricao_estadual || configFiscal.inscricao_estadual || 'ISENTO',
            regime_tributario: configFiscal.regime_tributario === 'Lucro Presumido' ? '3' : '1',
            logradouro: filial?.logradouro || filial?.endereco || configFiscal.logradouro || 'Rua Principal',
            numero: filial?.numero || configFiscal.numero || 'S/N',
            bairro: filial?.bairro || configFiscal.bairro || 'Centro',
            municipio: filial?.cidade || filial?.municipio || configFiscal.municipio || 'Marabá',
            uf: filial?.estado || filial?.uf || 'PA',
            cep: filial?.cep || configFiscal.cep || '68500000',
            telefone: filial?.telefone || filial?.whatsapp || empresa?.telefone || null
        },
        cliente: {
            nome: clienteNomeFinal,
            cpf_cnpj: clienteCpfFinal,
            email: clienteEmailFinal,
            telefone: clienteTelefoneFinal,
            logradouro: clienteLogradouroFinal,
            numero: clienteNumeroFinal,
            complemento: clienteComplementoFinal,
            bairro: clienteBairroFinal,
            cidade: clienteCidadeFinal,
            municipio: clienteCidadeFinal,
            uf: clienteUfFinal,
            cep: clienteCepFinal
        },
        itens: itensPayload,
        certificado_a1_url: certUrl,
        certificado_senha: configFiscal.certificado_senha_criptografada
    };

    // 5. Enviar ao micro-serviço Python
    try {
        const response = await fetch(`${fiscalServiceBaseUrl}/api/v1/nfe/emitir`, {
            method: 'POST',
            headers: fiscalHeaders,
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errBody = await response.text();
            throw new Error(`Micro-serviço fiscal respondeu com status ${response.status}: ${errBody}`);
        }

        const data = await response.json();

        // 6. Atualizar a venda no Supabase com o resultado da SEFAZ
        if (data.sucesso && data.chave_acesso) {
            const numeroFinalNfe = parseInt(data.numero_nfe || 918, 10);
            const serieFinalNfe = parseInt(data.serie || 2, 10);

            await supabase
                .from('vendas')
                .update({
                    nfe_status: 'EMITIDA',
                    nfe_id: data.chave_acesso,
                    nfe_numero: numeroFinalNfe,
                    nfe_pdf_url: data.pdf_url || null,
                    nfe_xml_url: data.xml_url || null,
                    nfe_erro_detalhe: null
                })
                .eq('id', vendaId);

            // Persistir registro detalhado na tabela public.notas_fiscais
            try {
                await supabase
                    .from('notas_fiscais')
                    .insert({
                        empresa_id: empresaId,
                        filial_id: filialId || null,
                        venda_id: vendaId,
                        numero_nfe: numeroFinalNfe,
                        serie: serieFinalNfe,
                        chave_acesso: data.chave_acesso,
                        protocolo_autorizacao: data.protocolo || null,
                        status: 'AUTORIZADA',
                        cliente_nome: clienteNomeFinal,
                        cliente_documento: clienteCpfFinal !== '00000000000' ? clienteCpfFinal : null,
                        valor_total: valorTotal,
                        danfe_pdf_url: data.pdf_url || null,
                        xml_conteudo: data.xml_conteudo || null
                    });
            } catch (nfPersistErr) {
                console.error('⚠️ [vendasService] Erro ao persistir em notas_fiscais:', nfPersistErr);
            }
        } else {
            await supabase
                .from('vendas')
                .update({
                    nfe_status: 'ERRO',
                    nfe_erro_detalhe: data.motivo || 'Erro não especificado na transmissão SEFAZ.'
                })
                .eq('id', vendaId);
        }

        return data;
    } catch (networkErr) {
        console.error('❌ [vendasService.emitirNfeVenda] Falha na comunicação com o micro-serviço fiscal:', networkErr);
        const isOffline = networkErr.message?.includes('Failed to fetch') || networkErr.name === 'TypeError';
        const msgAmigavel = isOffline
            ? 'O Micro-serviço Fiscal local (porta 8000) não está em execução. Execute "start_service.bat" na pasta fiscal_service.'
            : networkErr.message;
        await supabase
            .from('vendas')
            .update({
                nfe_status: 'ERRO',
                nfe_erro_detalhe: `Falha de conexão com o serviço fiscal: ${msgAmigavel}`
            })
            .eq('id', vendaId);
        throw new Error(msgAmigavel);
    }
}

/**
 * Consulta o status operacional dos servidores da SEFAZ-PA (SVRS)
 */
export async function consultarStatusSefazPa() {
    const { fiscalServiceBaseUrl, headers: fiscalHeaders } = getFiscalServiceConfig();
    const res = await fetch(`${fiscalServiceBaseUrl}/api/v1/nfe/status-sefaz`, {
        headers: fiscalHeaders
    });
    if (!res.ok) throw new Error('Não foi possível consultar o status da SEFAZ.');
    return await res.json();
}
