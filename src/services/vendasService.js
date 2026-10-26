import { supabase } from '../supabaseClient';

/**
 * Atualiza os metadados de uma venda após a criação via RPC.
 * Centraliza e valida apenas as colunas suportadas pela tabela 'vendas'.
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

    const payload = {
        empresa_id: empresaId,
        filial_id: filialId,
        caixa_id: caixaId || null,
        produto_nome: item?.produto?.nome || item?.nome || 'Produto',
        imei: item?.imei || null,

        // Dados do Cliente
        cliente_id: cliente?.id || null,
        cliente_nome: cliente?.nome || 'Consumidor Final',
        cliente_documento: cliente?.cpfCnpj || cliente?.documento || cliente?.cpf || null,
        cliente_cpf: cliente?.cpfCnpj || cliente?.documento || cliente?.cpf || null,
        cliente_cpf_cnpj: cliente?.cpfCnpj || cliente?.documento || cliente?.cpf || null,
        cliente_telefone: cliente?.telefone || null,
        cliente_email: cliente?.email || null,

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

    let { data, error } = await supabase
        .from('vendas')
        .update(payload)
        .eq('id', vendaId);

    // Fallback resiliente caso as colunas opcionais (valor_*, used_*, cliente_documento, cliente_cpf) não existam no schema remoto
    if (error && (error.code === '42703' || String(error.message).includes('used_') || String(error.message).includes('valor_') || String(error.message).includes('cliente_'))) {
        console.warn('⚠️ [vendasService] Colunas não encontradas em vendas, tentando update com fallback:', error.message);
        const fallbackPayload = { ...payload };
        if (String(error.message).includes('cliente_documento')) {
            delete fallbackPayload.cliente_documento;
        }
        if (String(error.message).includes('cliente_cpf') && !String(error.message).includes('cliente_cpf_cnpj')) {
            delete fallbackPayload.cliente_cpf;
        }
        if (String(error.message).includes('cliente_telefone')) {
            delete fallbackPayload.cliente_telefone;
        }
        if (String(error.message).includes('used_')) {
            delete fallbackPayload.used_produto_nome;
            delete fallbackPayload.used_imei;
            delete fallbackPayload.used_valor_avaliacao;
        }
        if (String(error.message).includes('valor_pix') || String(error.message).includes('valor_cartao') || String(error.message).includes('valor_dinheiro')) {
            delete fallbackPayload.valor_pix;
            delete fallbackPayload.valor_cartao;
            delete fallbackPayload.valor_dinheiro;
            delete fallbackPayload.valor_boleto;
            delete fallbackPayload.valor_troca;
        }
        const retryRes = await supabase
            .from('vendas')
            .update(fallbackPayload)
            .eq('id', vendaId);
        data = retryRes.data;
        error = retryRes.error;
    }

    if (error) {
        console.error('❌ [vendasService.atualizarVendaAposCriacao]:', error);
        throw error;
    }

    return data;
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

    // 2. Carregar os dados da empresa, filial (se houver) e as configurações fiscais (incluindo certificado A1)
    const filialId = venda.filial_id;
    const [empresaRes, configFiscalRes, filialRes] = await Promise.all([
        supabase.from('companies').select('*').eq('id', empresaId).single(),
        supabase.from('configuracoes_fiscais').select('*').eq('tenant_id', empresaId).maybeSingle(),
        filialId ? supabase.from('filiais').select('*').eq('id', filialId).maybeSingle() : Promise.resolve({ data: null })
    ]);

    const empresa = empresaRes.data;
    const configFiscal = configFiscalRes.data;
    const filial = filialRes?.data || null;

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
    const fiscalServiceBaseUrl = (import.meta.env.VITE_FISCAL_SERVICE_URL || 'http://localhost:8000').replace(/\/$/, '');
    
    // Gerar um número sequencial de NF-e caso não exista
    const numeroNfe = Number(venda.nfe_numero || Math.floor(1000 + Math.random() * 9000));
    const valorTotal = Number(venda.valor_total || (
        Number(venda.valor_pix || 0) +
        Number(venda.valor_cartao || 0) +
        Number(venda.valor_dinheiro || 0) +
        Number(venda.valor_boleto || 0)
    ) || 0);

    const localAmbiente = typeof localStorage !== 'undefined' ? localStorage.getItem(`fiscal_ambiente_${empresaId}`) : null;
    const ambienteFinal = Number(ambiente || configFiscal.ambiente || localAmbiente || 2);

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
            nome: venda.cliente_nome || 'Consumidor Final',
            cpf_cnpj: venda.cliente_cpf_cnpj || '00000000000',
            email: venda.cliente_email || null,
            telefone: venda.cliente_telefone || null,
            uf: 'PA'
        },
        itens: [
            {
                codigo: venda.imei || venda.id.slice(0, 8),
                nome: venda.produto_nome || 'Produto / Mercadoria',
                ncm: '85171300', // Padrão telecomunicações/smartphones
                cfop: '5102',
                ucom: 'UN',
                quantidade: 1.0,
                valor_unitario: valorTotal,
                valor_total: valorTotal,
                imei: venda.imei || null,
                codigo_barras: venda.codigo_barras || venda.ean || 'SEM GTIN',
                ean: venda.ean || venda.codigo_barras || 'SEM GTIN'
            }
        ],
        certificado_a1_url: certUrl,
        certificado_senha: configFiscal.certificado_senha_criptografada
    };

    // 5. Enviar ao micro-serviço Python
    try {
        const response = await fetch(`${fiscalServiceBaseUrl}/api/v1/nfe/emitir`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
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
                        cliente_nome: venda.cliente_nome || 'Consumidor Final',
                        cliente_documento: venda.cliente_cpf_cnpj || venda.cliente_cpf || null,
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
    const fiscalServiceBaseUrl = (import.meta.env.VITE_FISCAL_SERVICE_URL || 'http://localhost:8000').replace(/\/$/, '');
    const res = await fetch(`${fiscalServiceBaseUrl}/api/v1/nfe/status-sefaz`);
    if (!res.ok) throw new Error('Não foi possível consultar o status da SEFAZ.');
    return await res.json();
}