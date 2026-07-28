import React, { useState, useEffect } from 'react';
import { supabase, supabaseAdmin, supabaseRegister } from '../supabaseClient';
import { 
  LogOut, User, Building, Shield, Plus, Users, ShoppingBag, UserPlus,
  BarChart3, AlertCircle, CheckCircle2, Store, Package, Database, 
  Smartphone, Tag, FileText as LucideFileText, Search, Upload, Award, DollarSign, 
  TrendingUp, Calendar, Eye, RefreshCw, Check, X, ClipboardList, Trash2, ChevronDown, ChevronRight,
  Truck, Loader2, Printer, Edit2, FileText, Download, CheckCircle, AlertTriangle, Megaphone, Bug, List,
  MessageSquare, Save, Key, HelpCircle, CreditCard, Menu, ChevronLeft, Settings, LayoutDashboard, Lock, UploadCloud
} from 'lucide-react';
import { emitirNfseStub } from '../services/fiscal';
import { hasFeature } from '../utils/featureFlags';
const FISCAL_MAP = {
  'Celulares': { ncm: '85171300', cest: '2105300', cfop: '5405', origem: '0' },
  'Tablets': { ncm: '85171300', cest: '2105300', cfop: '5405', origem: '0' },
  'Carregadores': { ncm: '85044010', cest: '2103300', cfop: '5102', origem: '0' },
  'Cabos': { ncm: '85044010', cest: '2103300', cfop: '5102', origem: '0' },
  'Películas': { ncm: '39269090', cest: '', cfop: '5102', origem: '0' },
  'Capas': { ncm: '39269090', cest: '', cfop: '5102', origem: '0' },
  'Acessórios': { ncm: '85044010', cest: '2103300', cfop: '5102', origem: '0' }
};

export default function Dashboard({ session, profileDataProps }) {
  const [profile, setProfile] = useState(profileDataProps || null);
  const [company, setCompany] = useState(null);
  const activeEmpresaId = profile?.empresa_id || company?.id;
  const [loading, setLoading] = useState(profileDataProps ? false : true);
  const [error, setError] = useState('');

  const [toast, setToast] = useState(null); // { message: '', type: 'success' | 'error' | 'info' }

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    // auto close after 4 seconds
    setTimeout(() => {
      setToast(prev => (prev && prev.message === message ? null : prev));
    }, 4000);
  };

  // Override window.alert to show our custom Toast instead
  useEffect(() => {
    const originalAlert = window.alert;
    window.alert = (msg) => {
      let type = 'info';
      const lowercaseMsg = msg.toLowerCase();
      if (
        lowercaseMsg.includes('erro') || 
        lowercaseMsg.includes('falha') || 
        lowercaseMsg.includes('inválido') || 
        lowercaseMsg.includes('não encontrado') || 
        lowercaseMsg.includes('duplicado') || 
        lowercaseMsg.includes('limite') || 
        lowercaseMsg.includes('obrigatório') ||
        lowercaseMsg.includes('indisponível')
      ) {
        type = 'error';
      } else if (
        lowercaseMsg.includes('sucesso') || 
        lowercaseMsg.includes('cadastrado') || 
        lowercaseMsg.includes('atualizado') || 
        lowercaseMsg.includes('gravadas') || 
        lowercaseMsg.includes('salvo') ||
        lowercaseMsg.includes('deletado') ||
        lowercaseMsg.includes('efetuada')
      ) {
        type = 'success';
      }
      showToast(msg, type);
    };
    return () => {
      window.alert = originalAlert;
    };
  }, []);

  // Listener de Conexão SRE
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Estados do Painel Supremo (ADMIN)
  const [allCompanies, setAllCompanies] = useState([]);
  
  // Controle de Faturas SaaS
  const [isFaturasModalOpen, setIsFaturasModalOpen] = useState(false);
  const [selectedFaturasCompany, setSelectedFaturasCompany] = useState(null);
  const [companyFaturas, setCompanyFaturas] = useState([]);
  const [isFiscalLoading, setIsFiscalLoading] = useState(false);
  const [loadingAdmin, setLoadingAdmin] = useState(false);

  // --- VEXTRON LAB: MURAL E DIAGNÓSTICO ---
  const [globalNotices, setGlobalNotices] = useState([]);
  const [newNoticeText, setNewNoticeText] = useState('');
  const [isDiagnosticModalOpen, setIsDiagnosticModalOpen] = useState(false);
  const [systemErrors, setSystemErrors] = useState([]);
  const [chamadosSuporte, setChamadosSuporte] = useState([]);

  // --- VEXTRON LAB: SRE (S.O.S e Offline) ---
  const [isSosModalOpen, setIsSosModalOpen] = useState(false);
  const [sosMessage, setSosMessage] = useState('');
  const [isSosSubmitting, setIsSosSubmitting] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [confirmingSosId, setConfirmingSosId] = useState(null);
  const [loadingFinalizarSos, setLoadingFinalizarSos] = useState(false);
  
  // --- VEXTRON LAB: GESTÃO DE ASSINATURAS ---
  const [faturasActiveTab, setFaturasActiveTab] = useState('config'); // 'config' | 'historico'
  const [licencaValor, setLicencaValor] = useState('');
  const [licencaDiaVencimento, setLicencaDiaVencimento] = useState(10);
  const [empresaTelefone, setEmpresaTelefone] = useState('');
  const [loadingConfigLicenca, setLoadingConfigLicenca] = useState(false);
  const [novaFaturaVencimento, setNovaFaturaVencimento] = useState('');
  const [novaFaturaValor, setNovaFaturaValor] = useState('');
  const [novaFaturaLink, setNovaFaturaLink] = useState('');
  const [loadingNovaFatura, setLoadingNovaFatura] = useState(false);
  
  // --- SUPERADMIN: PROVISIONAMENTO MULTI-TENANT ---
  const [provisionCompanyName, setProvisionCompanyName] = useState('');
  const [provisionCompLoading, setProvisionCompLoading] = useState(false);
  const [provisionCompMessage, setProvisionCompMessage] = useState({ text: '', type: '' });

  const [provisionUserEmail, setProvisionUserEmail] = useState('');
  const [provisionUserPassword, setProvisionUserPassword] = useState('');
  const [provisionUserName, setProvisionUserName] = useState('');
  const [provisionUserRole, setProvisionUserRole] = useState('VENDEDOR');
  const [provisionUserCompanyId, setProvisionUserCompanyId] = useState('');
  const [provisionUserLoading, setProvisionUserLoading] = useState(false);
  const [provisionUserMessage, setProvisionUserMessage] = useState({ text: '', type: '' });
  
  // --- VEXTRON LAB: SRE (Rascunho Automático PDV) ---
  const [showDraftModal, setShowDraftModal] = useState(false);
  const [draftDataToRestore, setDraftDataToRestore] = useState(null);

  // Estados para Módulo de Filiais
  const [filiais, setFiliais] = useState([]);
  const [nomeFilial, setNomeFilial] = useState('');
  const [tipoFilial, setTipoFilial] = useState('LOJA');
  const [cnpjFilial, setCnpjFilial] = useState('');
  const [telefoneFilial, setTelefoneFilial] = useState('');
  const [enderecoFilial, setEnderecoFilial] = useState(''); // 'LOJA' | 'ESTOQUE'
  const [loadingFilial, setLoadingFilial] = useState(false);
  const [logoFilialFile, setLogoFilialFile] = useState(null);

  // Estados para Módulo de Vendedores
  const [vendedores, setVendedores] = useState([]);
  const [metas, setMetas] = useState([]);
  const [nomeVendedor, setNomeVendedor] = useState('');
  const [emailVendedor, setEmailVendedor] = useState('');
  const [senhaVendedor, setSenhaVendedor] = useState('');
  const [filialVendedor, setFilialVendedor] = useState('');
  const [loadingVendedor, setLoadingVendedor] = useState(false);
  // Mapa de tipo de meta por vendedorId (controlado pelo dropdown do gerente)
  // { [vendedorId]: 'FATURAMENTO_GERAL' | 'BOLETO' }
  const [metaTipoMap, setMetaTipoMap] = useState({});

  // --- Novos Estados de Controle e Negócio (Estoque, PDV, Comissões e Relatórios) ---
  const [activeTab, setActiveTab] = useState('gestao'); // Para GERENTE: 'gestao' | 'estoque' | 'ranking' | 'fechamentos'
  const [activeSellerTab, setActiveSellerTab] = useState('pdv'); // Para VENDEDOR: 'pdv' | 'metas' | 'fechamento'

  // Estado de Filial Ativa do Vendedor
  const [activeFilialId, setActiveFilialId] = useState(() => localStorage.getItem('zenite_active_filial_id') || '');
  const [activeFilialNome, setActiveFilialNome] = useState(() => localStorage.getItem('zenite_active_filial_nome') || '');

  // Dados do Estoque (Gerente)
  const [produtos, setProdutos] = useState([]);
  const [loadingProdutos, setLoadingProdutos] = useState(false);
  const [nomeProduto, setNomeProduto] = useState('');
  const [tipoProduto, setTipoProduto] = useState('CELULAR'); // 'CELULAR' | 'ACESSORIO'
  const [categoriaProduto, setCategoriaProduto] = useState('IOS'); // 'IOS' | 'ANDROID' | 'APPLE_JBL_CONSOLE' | 'SERVICO'
  const [precoProduto, setPrecoProduto] = useState('');
  const [precoCustoProduto, setPrecoCustoProduto] = useState('');
  const [skuProduto, setSkuProduto] = useState('');
  const [condicaoProduto, setCondicaoProduto] = useState('NOVO'); // 'NOVO' | 'SEMINOVO' | 'GRADE_A' | 'GRADE_B' | 'LACRADO' | 'VITRINE'
  const [estoqueMinimoProduto, setEstoqueMinimoProduto] = useState('');
  const [qtdProduto, setQtdProduto] = useState('1'); // Usado para acessório/serviço
  const [imeisInput, setImeisInput] = useState(''); // Textarea para IMEIs (um por linha)
  const [filialProduto, setFilialProduto] = useState('');
  const [corCatalogoProduto, setCorCatalogoProduto] = useState('');
  const [buscaEstoque, setBuscaEstoque] = useState('');
  const [filtroFilialEstoque, setFiltroFilialEstoque] = useState('');

  // Estados para Categorias Dinâmicas
  const [categorias, setCategorias] = useState([]);
  const [loadingCategorias, setLoadingCategorias] = useState(false);
  const [novaCategoriaNome, setNovaCategoriaNome] = useState('');
  const [filtroCategoriaEstoque, setFiltroCategoriaEstoque] = useState('');
  const [filtroStatusEstoque, setFiltroStatusEstoque] = useState('');

  // Estados para Disponibilidade Multiloja
  const [selectedMultilojaProd, setSelectedMultilojaProd] = useState(null);
  const [multilojaStockData, setMultilojaStockData] = useState([]);
  const [loadingMultilojaStock, setLoadingMultilojaStock] = useState(false);

  // Estados para Gestão de Clientes
  const [clientes, setClientes] = useState([]);
  const [loadingClientes, setLoadingClientes] = useState(false);
  const [clienteNome, setClienteNome] = useState('');
  const [clienteCpfCnpj, setClienteCpfCnpj] = useState('');
  const [clienteEmail, setClienteEmail] = useState('');
  const [clienteTelefone, setClienteTelefone] = useState('');
  const [editingCliente, setEditingCliente] = useState(null);
  const [isClienteModalOpen, setIsClienteModalOpen] = useState(false);
  const [buscaCliente, setBuscaCliente] = useState('');

  // Novos campos para Clientes (Data de Nascimento & Endereço Inteligente)
  const [clienteDataNascimento, setClienteDataNascimento] = useState('');
  const [clienteCep, setClienteCep] = useState('');
  const [clienteLogradouro, setClienteLogradouro] = useState('');
  const [clienteNumero, setClienteNumero] = useState('');
  const [clienteBairro, setClienteBairro] = useState('');
  const [clienteCidade, setClienteCidade] = useState('');
  const [clienteUf, setClienteUf] = useState('');
  const [clienteComplemento, setClienteComplemento] = useState('');
  const [cepLookupLoading, setCepLookupLoading] = useState(false);
  const [cepLookupFailed, setCepLookupFailed] = useState(false);
  const clienteNumeroInputRef = React.useRef(null);

  // Estados para Correção de Vendas com Auditoria
  const [editingVenda, setEditingVenda] = useState(null);
  const [vendaNewQty, setVendaNewQty] = useState('');
  const [vendaNewValor, setVendaNewValor] = useState('');
  const [vendaNewComissao, setVendaNewComissao] = useState('');
  const [vendaJustificativa, setVendaJustificativa] = useState('');
  const [isVendaEditModalOpen, setIsVendaEditModalOpen] = useState(false);

  // Estados para Navegação via Sidebar Retrátil
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    const saved = localStorage.getItem('zenite_sidebar_open');
    return saved !== 'false';
  });
  const [currentView, setCurrentView] = useState('');
  const [estoqueSubMenuOpen, setEstoqueSubMenuOpen] = useState(true);

  // --- Tenant Configurations & SaaS Faturas ---
  const [tenantSettings, setTenantSettings] = useState({ enable_troca: true, enable_imei: true });
  const [tenantFaturas, setTenantFaturas] = useState([]);
  const [isLoadingFaturas, setIsLoadingFaturas] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // --- Gestão de Equipe (Tenant Owner RBAC) ---
  const [teamMembers, setTeamMembers] = useState([]);
  const [isLoadingTeamMembers, setIsLoadingTeamMembers] = useState(false);
  const [isAddCollaboratorModalOpen, setIsAddCollaboratorModalOpen] = useState(false);
  const [newColabNome, setNewColabNome] = useState('');
  const [newColabEmail, setNewColabEmail] = useState('');
  const [newColabSenha, setNewColabSenha] = useState('');
  const [newColabRole, setNewColabRole] = useState('VENDEDOR');
  const [newColabFilialId, setNewColabFilialId] = useState('');
  const [isSavingColaborador, setIsSavingColaborador] = useState(false);
  const [buscaColaborador, setBuscaColaborador] = useState('');
  const [filtroColaboradorRole, setFiltroColaboradorRole] = useState('TODOS');

  // --- Modal de Cadastro de Filial (Empty State) ---
  const [isCreateFilialModalOpen, setIsCreateFilialModalOpen] = useState(false);
  const [newFilialNome, setNewFilialNome] = useState('');
  const [newFilialCnpj, setNewFilialCnpj] = useState('');
  const [newFilialCidade, setNewFilialCidade] = useState('');
  const [newFilialTipo, setNewFilialTipo] = useState('LOJA');
  const [isSavingNewFilial, setIsSavingNewFilial] = useState(false);

  // Expandir IMEIs no Estoque do Gerente
  const [expandedProductImeis, setExpandedProductImeis] = useState({});
  const [productImeisMap, setProductImeisMap] = useState({});

  // --- Poka-Yoke: Módulo de Entrada de Estoque Avançado ---
  const [catalogoProdutos, setCatalogoProdutos] = useState([]); // Produtos_Catalogo
  const [editingCatalogoProduto, setEditingCatalogoProduto] = useState(null);
  const [entradaNomeProduto, setEntradaNomeProduto] = useState(''); // Campo de busca autocomplete
  const [entradaSugestoes, setEntradaSugestoes] = useState([]); // Sugestões filtradas
  const [entradaProdutoSelecionado, setEntradaProdutoSelecionado] = useState(null); // Produto do catálogo selecionado
  const [entradaFilial, setEntradaFilial] = useState('');
  const [entradaImeiAtual, setEntradaImeiAtual] = useState(''); // IMEI sendo digitado
  const [entradaImeisList, setEntradaImeisList] = useState([]); // Lista de IMEIs bipados [{imei, status, msg}]
  const [entradaQtdAcessorio, setEntradaQtdAcessorio] = useState('1');
  const [entradaIsSeminovo, setEntradaIsSeminovo] = useState(false);
  const [entradaCor, setEntradaCor] = useState('');
  const [entradaBateria, setEntradaBateria] = useState('');
  const [entradaPrecoCompra, setEntradaPrecoCompra] = useState('');
  const [entradaObs, setEntradaObs] = useState('');
  const [pdvMode, setPdvMode] = useState('venda'); // 'venda' | 'compra'
  const [loadingEntrada, setLoadingEntrada] = useState(false);
  const [loadingCatalogo, setLoadingCatalogo] = useState(false);
  const imeiInputRef = React.useRef(null);

  // Novos estados para a Entrada de Estoque (Item Físico / IMEI) de alta produtividade
  const [selectedProdutoMestre, setSelectedProdutoMestre] = useState(null);
  const [entradaImei, setEntradaImei] = useState('');
  const [entradaCorDispositivo, setEntradaCorDispositivo] = useState('');
  const [selectedFilialDestino, setSelectedFilialDestino] = useState('');
  const [ultimosRecebidos, setUltimosRecebidos] = useState([]);
  const [disponiveisImeis, setDisponiveisImeis] = useState([]);

  // Vendas e Fechamentos Globais
  const [vendas, setVendas] = useState([]);
  const [fechamentos, setFechamentos] = useState([]);
  const [loadingDados, setLoadingDados] = useState(false);
  const [filtroMes, setFiltroMes] = useState(() => new Date().toISOString().substring(0, 7)); // YYYY-MM

  // Estados para Correção de Fechamento de Caixa Diário
  const [modalAjusteCaixaOpen, setModalAjusteCaixaOpen] = useState(false);
  const [ajusteCaixaSelecionado, setAjusteCaixaSelecionado] = useState(null);
  const [ajusteValorDinheiro, setAjusteValorDinheiro] = useState('');
  const [ajusteValorCartao, setAjusteValorCartao] = useState('');
  const [ajusteValorPix, setAjusteValorPix] = useState('');
  const [ajusteMotivo, setAjusteMotivo] = useState('');
  const [loadingAjusteCaixa, setLoadingAjusteCaixa] = useState(false);

  // --- CONFIGURAÇÕES FISCAIS E NCM ---
  const [ncmProduto, setNcmProduto] = useState('');
  const [cestProduto, setCestProduto] = useState('');
  const [cfopProduto, setCfopProduto] = useState('5102');
  const [origemProduto, setOrigemProduto] = useState('0');
  const [pdvClienteNome, setPdvClienteNome] = useState('');
  const [pdvClienteCpfCnpj, setPdvClienteCpfCnpj] = useState('');
  const [pdvClienteEmail, setPdvClienteEmail] = useState('');
  const [pdvClienteTelefone, setPdvClienteTelefone] = useState('');
  const [pdvClienteSearchInput, setPdvClienteSearchInput] = useState('');
  const [pdvClienteSearchResults, setPdvClienteSearchResults] = useState([]);
  const [pdvClienteSearchLoading, setPdvClienteSearchLoading] = useState(false);
  const [isPdvClienteDropdownOpen, setIsPdvClienteDropdownOpen] = useState(false);
  const [selectedPdvClienteId, setSelectedPdvClienteId] = useState(null);
  const [isPdvClienteFieldsEditable, setIsPdvClienteFieldsEditable] = useState(false);
  const [pdvCart, setPdvCart] = useState([]);
  const [taxasCartao, setTaxasCartao] = useState([]);
  const [isLoadingTaxas, setIsLoadingTaxas] = useState(false);
  const [isSavingTaxas, setIsSavingTaxas] = useState(false);
  const [tempTaxasMap, setTempTaxasMap] = useState({});
  const [isQuickClientFormOpen, setIsQuickClientFormOpen] = useState(true);

  // Configurações Fiscais
  const [fiscalCnpj, setFiscalCnpj] = useState('');
  const [fiscalInscricaoEstadual, setFiscalInscricaoEstadual] = useState('');
  const [fiscalInscricaoMunicipal, setFiscalInscricaoMunicipal] = useState('');
  const [fiscalRegimeTributario, setFiscalRegimeTributario] = useState('Simples Nacional');
  const [fiscalCertificadoA1Url, setFiscalCertificadoA1Url] = useState('');
  const [fiscalCertificadoSenha, setFiscalCertificadoSenha] = useState('');
  const [showCertPassword, setShowCertPassword] = useState(false);
  const [isLoadingFiscalConfig, setIsLoadingFiscalConfig] = useState(false);
  const [isSavingFiscalConfig, setIsSavingFiscalConfig] = useState(false);
  const [certificadoUploadLoading, setCertificadoUploadLoading] = useState(false);

  // Estados do PDV (Vendedor)
  const [produtosFilial, setProdutosFilial] = useState([]);
  const [vendasVendedor, setVendasVendedor] = useState([]);
  const [pdvCategoria, setPdvCategoria] = useState('TUDO');
  const [pdvBusca, setPdvBusca] = useState('');
  const [pdvProdutoSelecionado, setPdvProdutoSelecionado] = useState(null);
  const [pdvImeisDisponiveis, setPdvImeisDisponiveis] = useState([]);
  const [pdvImeiSelecionado, setPdvImeiSelecionado] = useState('');
  const [pdvQuantidade, setPdvQuantidade] = useState(1);
  const [pdvValorUnitario, setPdvValorUnitario] = useState(0);
  const [pdvObsGarantia, setPdvObsGarantia] = useState('');
  const [pdvVendaTrainee, setPdvVendaTrainee] = useState(false);
  const [treenersFilial, setTreenersFilial] = useState([]);
  const [selectedTreenerId, setSelectedTreenerId] = useState('');
  const [pdvComissaoPrevia, setPdvComissaoPrevia] = useState(0);
  const [loadingPdvVenda, setLoadingPdvVenda] = useState(false);

  // Estados do PDV Híbrido com Crédito por Troca
  const [pdvScanImei, setPdvScanImei] = useState('');
  const [pdvMetodoPagamento, setPdvMetodoPagamento] = useState('pix'); // 'pix' | 'cartao' | 'dinheiro' | 'troca'
  const [pdvUsadoList, setPdvUsadoList] = useState([]); // Lista de aparelhos dados na troca
  const [pdvUsadoProdutoSelecionado, setPdvUsadoProdutoSelecionado] = useState(null);
  const [pdvUsadoNomeProduto, setPdvUsadoNomeProduto] = useState('');
  const [pdvUsadoSugestoes, setPdvUsadoSugestoes] = useState([]);
  const [pdvUsadoImei, setPdvUsadoImei] = useState('');
  const [pdvUsadoCor, setPdvUsadoCor] = useState('');
  const [pdvUsadoBateria, setPdvUsadoBateria] = useState('');
  const [pdvUsadoValor, setPdvUsadoValor] = useState('');
  const [pdvUsadoObs, setPdvUsadoObs] = useState('');
  const [pdvMetodoRestante, setPdvMetodoRestante] = useState('pix'); // 'pix' | 'cartao' | 'dinheiro'
  const [pdvCartaoParcelas, setPdvCartaoParcelas] = useState(1);
  
  // Recibo Modal
  const [pdvReciboAtivo, setPdvReciboAtivo] = useState(false);
  const [pdvReciboDados, setPdvReciboDados] = useState(null);
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const [hasPrinted, setHasPrinted] = useState(false);

  // Estados de Fechamento de Caixa (Vendedor)
  const [fechamentoDinheiro, setFechamentoDinheiro] = useState('');
  const [fechamentoCartao, setFechamentoCartao] = useState('');
  const [fechamentoPix, setFechamentoPix] = useState('');
  const [fechamentoBoleto, setFechamentoBoleto] = useState('');
  const [fechamentoTroca, setFechamentoTroca] = useState('');
  const [fechamentoComprovante, setFechamentoComprovante] = useState(''); // base64 string
  const [fechamentoObs, setFechamentoObs] = useState('');
  const [loadingFechamento, setLoadingFechamento] = useState(false);

  // Estados para Transferência de Mercadorias
  const [transferencias, setTransferencias] = useState([]);
  const [cargasPendentes, setCargasPendentes] = useState([]);
  const [loadingTransferencias, setLoadingTransferencias] = useState(false);
  const [transfOrigemId, setTransfOrigemId] = useState(''); // Autodetectado para ADMINs
  const [transfDestinoId, setTransfDestinoId] = useState('');
  const [transfItens, setTransfItens] = useState([]);
  const [transfRomaneioAtivo, setTransfRomaneioAtivo] = useState(false);
  const [transfRomaneioDados, setTransfRomaneioDados] = useState(null);
  const [fechamentoQtdSaida, setFechamentoQtdSaida] = useState(0);
  const [fechamentoQtdEntrada, setFechamentoQtdEntrada] = useState(0);
  const [transfImeiBusca, setTransfImeiBusca] = useState('');
  const [transfSubTab, setTransfSubTab] = useState('enviar'); // 'enviar' | 'receber'
  const [transfObs, setTransfObs] = useState('');

  // Estado para visualização de comprovante em Modal (Gerente)
  const [modalComprovante, setModalComprovante] = useState(null);

  // Estados para Torre de Controlo
  const [catalogoTab, setCatalogoTab] = useState(profile?.role === 'DONO' ? 'torre' : 'catalogo');
  const [torreData, setTorreData] = useState([]);
  const [torreFiliais, setTorreFiliais] = useState([]);
  const [torreLoading, setTorreLoading] = useState(false);
  const [torreSearch, setTorreSearch] = useState('');
  const [torreExpandedRows, setTorreExpandedRows] = useState({});
  const [torreSubTab, setTorreSubTab] = useState('visao'); // 'visao' | 'historico'

  // Estados para Auditoria de Descontos por Vendedor (Gerente & Admin)
  const [descontosLogs, setDescontosLogs] = useState([]);
  const [filtroDescontoVendedor, setFiltroDescontoVendedor] = useState('');
  const [filtroDescontoFilial, setFiltroDescontoFilial] = useState('');
  const [buscaDesconto, setBuscaDesconto] = useState('');

  // Estados para Edição de Informações do Colaborador (Nome, E-mail, Telefone, CPF, Senha, Role, Filial)
  const [editingColaborador, setEditingColaborador] = useState(null);
  const [editColabNome, setEditColabNome] = useState('');
  const [editColabEmail, setEditColabEmail] = useState('');
  const [editColabTelefone, setEditColabTelefone] = useState('');
  const [editColabCpf, setEditColabCpf] = useState('');
  const [editColabSenha, setEditColabSenha] = useState('');
  const [editColabRole, setEditColabRole] = useState('VENDEDOR');
  const [editColabFilialId, setEditColabFilialId] = useState('');
  const [isSavingEditColaborador, setIsSavingEditColaborador] = useState(false);

  // Estados para Remoção / Inativação de Colaborador (Modal e Loading)
  const [colaboradorToDelete, setColaboradorToDelete] = useState(null);
  const [isDeletingColaborador, setIsDeletingColaborador] = useState(false);

  // Estados para Rastreabilidade de Estoque e Movimentações
  const [estoqueMovimentacoes, setEstoqueMovimentacoes] = useState([]);
  const [buscaMovimentacao, setBuscaMovimentacao] = useState('');
  const [filtroMovTipo, setFiltroMovTipo] = useState('TODOS');
  const [movimentacoesLoading, setMovimentacoesLoading] = useState(false);

  // Estados para Ajuste Manual de Estoque
  const [isAjustarEstoqueModalOpen, setIsAjustarEstoqueModalOpen] = useState(false);
  const [ajusteProduto, setAjusteProduto] = useState(null);
  const [ajusteFilialId, setAjusteFilialId] = useState('');
  const [ajusteTipo, setAjusteTipo] = useState('ENTRADA');
  const [ajusteQuantidade, setAjusteQuantidade] = useState('1');
  const [ajusteImei, setAjusteImei] = useState('');
  const [estoqueAjusteMotivo, setEstoqueAjusteMotivo] = useState('');
  const [isSavingAjuste, setIsSavingAjuste] = useState(false);

  // Estados para Obrigatoriedade de Estoque Inicial no Catálogo
  const [catalogoFilialEstoque, setCatalogoFilialEstoque] = useState('');
  const [catalogoEstoqueInicial, setCatalogoEstoqueInicial] = useState('1');
  const [catalogoImeisIniciais, setCatalogoImeisIniciais] = useState('');

  // Estados para Alteração de Dados da Conta Pessoal (Configurações)
  const [profileNome, setProfileNome] = useState('');
  const [profileEmail, setProfileEmail] = useState('');
  const [profileSenha, setProfileSenha] = useState('');
  const [profileSenhaConfirm, setProfileSenhaConfirm] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  useEffect(() => {
    if (torreSearch.length >= 15) {
      const s = torreSearch.toLowerCase();
      const matchedRow = torreData.find(row => row.items.some(item => item.imei && item.imei.toLowerCase() === s));
      if (matchedRow) {
         setTorreExpandedRows(prev => ({ ...prev, [matchedRow.nome]: true }));
      }
    }
  }, [torreSearch, torreData]);

  const fetchTorreControlo = async () => {
    setTorreLoading(true);
    try {
      const { data: filiaisData, error: fErr } = await supabase
        .from('filiais')
        .select('id, nome')
        .eq('empresa_id', company.id)
        .order('nome', { ascending: true });
        
      if (fErr) throw fErr;

      const { data: imeisData, error: iErr } = await supabase
        .from('imeis')
        .select(`
          id, imei, status, vendido, created_at, is_seminovo, filial_id,
          produtos!inner (
            nome
          )
        `)
        .eq('empresa_id', company.id)
        .eq('vendido', false);

      if (iErr) throw iErr;

      const uniqueFiliaisMap = new Map();
      filiaisData.forEach(f => {
        if (!uniqueFiliaisMap.has(f.nome)) {
          uniqueFiliaisMap.set(f.nome, f);
        }
      });
      let uniqueFiliais = Array.from(uniqueFiliaisMap.values());

      const aggregation = {};
      const validImeis = (imeisData || []).filter(i => i.status !== 'VENDIDO' && i.status !== 'EM_TRANSITO');

      // Check for orphans
      const hasOrphans = validImeis.some(item => !item.filial_id);
      if (hasOrphans && !uniqueFiliaisMap.has('Não Alocado')) {
        uniqueFiliaisMap.set('Não Alocado', { id: 'NAO_ALOCADO', nome: 'Não Alocado' });
        uniqueFiliais = Array.from(uniqueFiliaisMap.values());
      }

      validImeis.forEach(item => {
        const prodName = item.produtos?.nome;
        let filialNome = 'Não Alocado';
        
        if (item.filial_id) {
          const filialObj = filiaisData.find(f => f.id === item.filial_id);
          if (filialObj) filialNome = filialObj.nome;
        }
        
        if (!prodName) return;

        if (!aggregation[prodName]) {
          aggregation[prodName] = { nome: prodName, total: 0, items: [] };
          uniqueFiliais.forEach(f => {
            aggregation[prodName][f.nome] = 0;
          });
        }

        if (aggregation[prodName][filialNome] !== undefined) {
          aggregation[prodName][filialNome] += 1;
        } else {
          aggregation[prodName][filialNome] = 1;
        }
        aggregation[prodName].total += 1;
        
        aggregation[prodName].items.push({
           id: item.id,
           imei: item.imei,
           localizacao: filialNome,
           condicao: item.is_seminovo ? 'SEMINOVO' : 'NOVO',
           data_entrada: item.created_at
        });
      });

      const tableData = Object.values(aggregation).sort((a, b) => a.nome.localeCompare(b.nome));

      setTorreFiliais(uniqueFiliais);
      setTorreData(tableData);
      fetchEstoqueMovimentacoes();
    } catch (error) {
      console.error(error);
      alert('Erro ao carregar Torre de Controlo');
    } finally {
      setTorreLoading(false);
    }
  };

  // Estados para Estoque Global (Catálogo)
  const [estoqueGlobalModalOpen, setEstoqueGlobalModalOpen] = useState(false);
  const [estoqueGlobalProduto, setEstoqueGlobalProduto] = useState(null);
  const [estoqueGlobalImeis, setEstoqueGlobalImeis] = useState([]);
  const [loadingEstoqueGlobal, setLoadingEstoqueGlobal] = useState(false);

  const openEstoqueGlobal = async (produtoCatalogo) => {
    setEstoqueGlobalProduto(produtoCatalogo);
    setEstoqueGlobalModalOpen(true);
    setLoadingEstoqueGlobal(true);
    setEstoqueGlobalImeis([]);
    
    try {
      const { data: prods, error: prodsErr } = await supabase
        .from('produtos')
        .select('id, filiais(nome)')
        .eq('empresa_id', company.id)
        .eq('nome', produtoCatalogo.nome);
        
      if (prodsErr) throw prodsErr;
      
      if (!prods || prods.length === 0) {
        setLoadingEstoqueGlobal(false);
        return;
      }
      
      const prodIds = prods.map(p => p.id);
      
      const { data: imeisData, error: imeisErr } = await supabase
        .from('imeis')
        .select('*, filiais(nome)')
        .in('produto_id', prodIds)
        .order('created_at', { ascending: false });
        
      if (imeisErr) throw imeisErr;
      
      const combinados = (imeisData || []).map(imeiObj => {
        return {
          ...imeiObj,
          filial_nome: imeiObj.filiais?.nome || 'Desconhecida'
        };
      });
      
      setEstoqueGlobalImeis(combinados);
    } catch (err) {
      console.error('Erro ao buscar estoque global:', err);
      alert('Erro ao buscar rastreio de estoque.');
    } finally {
      setLoadingEstoqueGlobal(false);
    }
  };

  useEffect(() => {
    fetchProfileAndCompany();
  }, [session]);

  useEffect(() => {
    const fetchNotices = async () => {
      try {
        let query = supabase.from('global_notices').select('*').order('created_at', { ascending: false });
        if (profile?.role !== 'SUPER_ADMIN') {
          query = query.eq('active', true);
        }
        const { data, error } = await query;
        if (error) throw error;
        setGlobalNotices(data || []);
      } catch (err) {
        console.error('Erro ao buscar avisos globais:', err);
      }
    };
    if (session) {
      fetchNotices();
    }
  }, [session, profile]);

  useEffect(() => {
    if (profile) {
      const tenantId = profile.empresa_id || company?.id;
      fetchFiliais(tenantId);
      fetchTeamMembers(tenantId);
      fetchVendedores(tenantId);

      if (profile.role === 'GERENTE' || profile.role === 'ESTOQUISTA') {
        fetchGerenteData(tenantId);
        fetchCatalogoProdutos(tenantId);
        if (profile.role === 'GERENTE') fetchTaxasCartao(tenantId);
        fetchCategorias(tenantId);
        if (activeFilialId) fetchTransferencias(activeFilialId, tenantId);
      } else if (profile.role === 'VENDEDOR') {
        // Se já tiver activeFilialId no localStorage, usar ele e buscar os dados
        if (activeFilialId) {
          fetchVendedorData(activeFilialId, session?.user?.id);
          fetchTransferencias(activeFilialId, tenantId);
        }
        fetchCatalogoProdutos(tenantId);
        fetchTaxasCartao(tenantId);
        fetchCategorias(tenantId);
      } else {
        // Perfis de Gestão (ADMIN, SUPER_ADMIN, OWNER, DONO, RH)
        fetchGerenteData(tenantId);
        fetchCatalogoProdutos(tenantId);
        fetchTaxasCartao(tenantId);
        fetchCategorias(tenantId);
        if (activeFilialId) fetchTransferencias(activeFilialId, tenantId);
      }
    }
  }, [profile, activeFilialId]);

  useEffect(() => {
    if (profile) {
      if (profile.role === 'ESTOQUISTA') {
        setCurrentView('estoque');
        setActiveTab('estoque');
      } else if (profile.role === 'VENDEDOR') {
        setCurrentView('pdv');
        setActiveSellerTab('pdv');
      } else if (profile.role === 'SUPER_ADMIN') {
        setCurrentView('supremo');
      } else {
        setCurrentView('gestao');
        setActiveTab('gestao');
      }
    }
  }, [profile]);

  useEffect(() => {
    if (categorias.length > 0 && (!categoriaProduto || categoriaProduto === 'IOS')) {
      const hasIos = categorias.some(c => c.nome === 'IOS');
      if (!hasIos) {
        setCategoriaProduto(categorias[0].nome);
      }
    }
  }, [categorias, categoriaProduto]);

  // Busca dos Treeners da Filial Ativa
  useEffect(() => {
    const fetchTreeners = async () => {
      if (!activeFilialId) {
        setTreenersFilial([]);
        return;
      }
      try {
        let { data, error } = await supabase
          .from('usuarios')
          .select('id, nome, role')
          .eq('filial_id', activeFilialId)
          .eq('status', 'ATIVO');

        if (error || !data || data.length === 0) {
          const { data: profs } = await supabase
            .from('profiles')
            .select('id, nome, role')
            .eq('filial_id', activeFilialId);
          if (profs && profs.length > 0) {
            data = profs;
          }
        }
        setTreenersFilial(data || []);
      } catch (err) {
        console.error('Erro ao carregar treeners da filial:', err);
      }
    };

    fetchTreeners();
  }, [activeFilialId]);

  useEffect(() => {
    if (pdvProdutoSelecionado) {
      const comissao = calcularComissao(pdvProdutoSelecionado, pdvQuantidade, profile?.is_treinner, pdvVendaTrainee, pdvValorUnitario);
      setPdvComissaoPrevia(comissao);
    }
  }, [pdvVendaTrainee, pdvProdutoSelecionado, pdvQuantidade, profile?.is_treinner, pdvValorUnitario]);

  // --- ATALHOS DE TECLADO PDV ---
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (activeSellerTab !== 'pdv' || profile?.role !== 'VENDEDOR') return;

      if (e.key === 'F2') {
        e.preventDefault();
        const searchInput = document.getElementById('pdv-busca-input');
        if (searchInput) searchInput.focus();
      } else if (e.key === 'F8') {
        e.preventDefault();
        setIsQuickClientFormOpen(true);
        setTimeout(() => {
          const searchInput = document.getElementById('pdv-cliente-busca-input');
          if (searchInput) searchInput.focus();
        }, 100);
      } else if (e.key === 'F9') {
        e.preventDefault();
        setPdvVendaTrainee(prev => !prev);
        showToast('Modo Venda Trainee alternado!', 'success');
      } else if (e.key === 'F10') {
        e.preventDefault();
        handleConfirmarVendaCarrinho();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setPdvCart([]);
        setPdvBusca('');
        showToast('Carrinho limpo!', 'info');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeSellerTab, pdvCart, pdvBusca, pdvClienteTelefone, pdvClienteNome, pdvClienteCpfCnpj, pdvClienteEmail, pdvMetodoPagamento, pdvCartaoParcelas, pdvUsadoList, pdvObsGarantia, pdvVendaTrainee, profile, taxasCartao, pdvClienteSearchInput, selectedPdvClienteId, isPdvClienteFieldsEditable]);

  // --- VEXTRON LAB: SRE (Rascunho Automático do PDV) ---
  useEffect(() => {
    if (pdvCart.length > 0) {
      const draft = {
        pdvCart,
        pdvObsGarantia,
        pdvVendaTrainee,
        pdvMetodoPagamento,
        pdvUsadoList,
        pdvMetodoRestante,
        pdvCartaoParcelas
      };
      sessionStorage.setItem('zenite_pdv_draft', JSON.stringify(draft));
    }
  }, [
    pdvCart, pdvObsGarantia, pdvVendaTrainee, pdvMetodoPagamento, 
    pdvUsadoList, pdvMetodoRestante, pdvCartaoParcelas
  ]);

  useEffect(() => {
    const savedDraft = sessionStorage.getItem('zenite_pdv_draft');
    if (savedDraft && profile?.role === 'VENDEDOR') {
      try {
        const parsed = JSON.parse(savedDraft);
        if (parsed && parsed.pdvCart && parsed.pdvCart.length > 0) {
          setDraftDataToRestore(parsed);
          setShowDraftModal(true);
        }
      } catch (e) {
        sessionStorage.removeItem('zenite_pdv_draft');
      }
    }
  }, [profile?.role]);

  // Autocomplete de clientes no PDV com debounce de 300ms
  useEffect(() => {
    if (!pdvClienteSearchInput.trim()) {
      setPdvClienteSearchResults([]);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      setPdvClienteSearchLoading(true);
      try {
        const empresaId = company?.id || profile?.empresa_id;
        if (!empresaId) return;

        const term = pdvClienteSearchInput.trim();
        // A busca na tabela public.clientes filtra obrigatoriamente por empresa_id e busca por correspondências em nome ou cpf_cnpj
        const { data, error } = await supabase
          .from('clientes')
          .select('*')
          .eq('empresa_id', empresaId)
          .or(`nome.ilike.%${term}%,cpf_cnpj.ilike.%${term}%`)
          .limit(10);

        if (error) throw error;
        setPdvClienteSearchResults(data || []);
      } catch (err) {
        console.error('Erro na busca de clientes:', err);
      } finally {
        setPdvClienteSearchLoading(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [pdvClienteSearchInput, company, profile]);

  const handleSelectPdvCliente = (client) => {
    setSelectedPdvClienteId(client.id);
    setPdvClienteNome(client.nome);
    setPdvClienteSearchInput(client.nome);
    setPdvClienteCpfCnpj(client.cpf_cnpj || '');
    setPdvClienteEmail(client.email || '');
    setPdvClienteTelefone(client.telefone || '');
    setIsPdvClienteFieldsEditable(false);
    setIsPdvClienteDropdownOpen(false);
  };

  useEffect(() => {
    if (pdvReciboAtivo) {
      const hasLogo = pdvReciboDados?.filial_logo && pdvReciboDados.filial_logo.trim() !== '';
      if (!hasLogo && !hasPrinted) {
        setHasPrinted(true);
        window.print();
      } else if (hasLogo && isImageLoaded && !hasPrinted) {
        setHasPrinted(true);
        window.print();
      }
    } else {
      setIsImageLoaded(false);
      setHasPrinted(false);
    }
  }, [pdvReciboAtivo, isImageLoaded, pdvReciboDados, hasPrinted]);

  const restoreDraft = () => {
    if (draftDataToRestore) {
      setPdvCart(draftDataToRestore.pdvCart || []);
      setPdvObsGarantia(draftDataToRestore.pdvObsGarantia || '');
      setPdvVendaTrainee(draftDataToRestore.pdvVendaTrainee || false);
      setPdvMetodoPagamento(draftDataToRestore.pdvMetodoPagamento || 'pix');
      setPdvUsadoList(draftDataToRestore.pdvUsadoList || []);
      setPdvMetodoRestante(draftDataToRestore.pdvMetodoRestante || 'pix');
      setPdvCartaoParcelas(draftDataToRestore.pdvCartaoParcelas || 1);
    }
    setShowDraftModal(false);
  };

  const discardDraft = () => {
    sessionStorage.removeItem('zenite_pdv_draft');
    setShowDraftModal(false);
    setDraftDataToRestore(null);
  };
  // --- VEXTRON LAB DIAGNOSTIC ERROR LOGGER ---
  const logDiagnosticError = async (errorMessage, pageLocation) => {
    try {
      if (!session?.user) return;
      await supabase.from('system_errors').insert({
        user_id: session.user.id,
        empresa_id: profile?.empresa_id || null,
        error_message: String(errorMessage),
        page_location: String(pageLocation)
      });
    } catch (e) {
      console.error('Falha ao registrar log de erro no DB:', e);
    }
  };

  const fetchProfileAndCompany = async () => {
    setLoading(true);
    setError('');
    try {
      // 1. Buscar perfil do usuário logado (usando maybeSingle para evitar erro PGRST116 se a tabela foi limpa)
      let { data: profileData, error: profileErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle();

      // Auto-recomposição do perfil caso registros de teste tenham sido apagados
      if (profileErr || !profileData) {
        console.warn('Perfil não encontrado no Supabase. Auto-recuperando perfil...', profileErr);
        const userEmail = (session?.user?.email || '').toLowerCase().trim();
        let fallbackRole = 'ADMIN';
        if (userEmail === 'valentimodz@gmail.com') fallbackRole = 'SUPER_ADMIN';
        else if (userEmail === 'valentimodz2@gmail.com') fallbackRole = 'ADMIN';
        else if (userEmail.includes('rodrigo')) fallbackRole = 'GERENTE';
        else if (userEmail.includes('estoque')) fallbackRole = 'ESTOQUISTA';

        profileData = {
          id: session.user.id,
          email: session.user.email,
          nome: session.user.user_metadata?.nome || userEmail.split('@')[0] || 'Usuário',
          role: fallbackRole,
          empresa_id: null,
          created_at: new Date().toISOString()
        };

        // Salvar perfil de contingência no Supabase
        const { error: upsertProfErr } = await supabase.from('profiles').upsert(profileData);
        if (upsertProfErr) console.warn('Aviso ao salvar perfil auto-gerado:', upsertProfErr);
      }

      // 1.5. Mapeamento forçado de Roles via E-mail (RBAC)
      const userEmail = (session.user.email || '').toLowerCase().trim();
      let userRole = profileData.role || 'ADMIN';
      if (userEmail === 'valentimodz@gmail.com') userRole = 'SUPER_ADMIN';
      else if (userEmail === 'valentimodz2@gmail.com') userRole = 'ADMIN';
      else if (userEmail === 'rodrigo.gerenciamonkeyshop@gmail.com' || userEmail === 'rodrigo.gerenciaredecred@gmail.com') userRole = 'GERENTE';
      else if (userEmail === 'estoque.redecred@gmail.com' || userEmail === 'estoquista@redecred.com') userRole = 'ESTOQUISTA';

      profileData.role = userRole;

      // 1.6. Vincular empresa_id do perfil aos dados das filiais cadastradas na empresa para todos os perfis
      const { data: existingFiliais } = await supabase.from('filiais').select('empresa_id').limit(1);
      if (existingFiliais && existingFiliais.length > 0 && existingFiliais[0].empresa_id) {
        const targetEmpId = existingFiliais[0].empresa_id;
        if (!profileData.empresa_id || profileData.empresa_id !== targetEmpId) {
          profileData.empresa_id = targetEmpId;
          await supabase.from('profiles').upsert({
            id: session.user.id,
            email: session.user.email,
            nome: profileData.nome || session.user.email.split('@')[0],
            role: userRole,
            empresa_id: targetEmpId
          }).catch(e => console.warn('Aviso ao sincronizar perfil do usuário:', e));
        }
      }

      setProfile(profileData);

      // 2. Se for SUPER_ADMIN, ele não precisa estar vinculado a uma empresa para gerenciar o sistema
      if (profileData?.role === 'SUPER_ADMIN') {
        setCompany({ nome: 'Vextron Lab - Soluções em Automação e Gestão', id: 'MASTER' });
        await fetchAdminData().catch(e => console.warn('Aviso ao buscar admin data:', e));
        setLoading(false);
        return;
      }

      // 3. Buscar ou vincular empresa do usuário logado
      let activeEmpresaId = profileData?.empresa_id;

      if (!activeEmpresaId) {
        // Tentar obter a empresa onde existem filiais cadastradas
        const { data: anyFilial } = await supabase.from('filiais').select('empresa_id').limit(1).maybeSingle();
        if (anyFilial && anyFilial.empresa_id) {
          activeEmpresaId = anyFilial.empresa_id;
        } else {
          const { data: anyCompany } = await supabase.from('companies').select('id').limit(1).maybeSingle();
          if (anyCompany && anyCompany.id) {
            activeEmpresaId = anyCompany.id;
          }
        }

        // Se ainda não houver nenhuma empresa no banco (tabela limpa), auto-gerar uma empresa padrão
        if (!activeEmpresaId) {
          const defaultCompanyId = '00000000-0000-0000-0000-000000000001';
          const defaultCompanyObj = {
            id: defaultCompanyId,
            nome: 'Rede Cred',
            nome_fantasia: 'Rede Cred',
            status: 'ATIVO',
            status_assinatura: 'ATIVO',
            created_at: new Date().toISOString()
          };
          const { error: compErr } = await supabase.from('companies').upsert(defaultCompanyObj);
          if (compErr) console.warn('Aviso auto-gerar empresa:', compErr);
          activeEmpresaId = defaultCompanyId;
        }

        if (activeEmpresaId) {
          profileData.empresa_id = activeEmpresaId;
          await supabase.from('profiles').update({ empresa_id: activeEmpresaId }).eq('id', session.user.id);
          await supabase.from('usuarios').update({ empresa_id: activeEmpresaId }).eq('id', session.user.id);
          setProfile(prev => prev ? { ...prev, empresa_id: activeEmpresaId } : prev);
        }
      }

      if (activeEmpresaId) {
        const { data: companyData } = await supabase
          .from('companies')
          .select('*')
          .eq('id', activeEmpresaId)
          .maybeSingle();

        if (companyData) {
          setCompany(companyData);

          // Bloqueio de Inadimplência ou Assinatura Suspenso
          if (companyData?.status === 'INATIVO' || companyData?.status_assinatura === 'BLOQUEADO') {
            setError('Acesso Suspenso. A assinatura desta empresa foi bloqueada por inadimplência ou decisão administrativa. Entre em contato com o suporte do Zênite.');
            setLoading(false);
            return;
          }

          // Bloqueio de Manutenção
          if (companyData?.em_manutencao) {
            setError('Zênite OS em manutenção programada pela Vextron Lab. Retornaremos em breve.');
            setLoading(false);
            return;
          }
        } else {
          setCompany({
            id: activeEmpresaId,
            nome: 'Rede Cred',
            status: 'ATIVO',
            status_assinatura: 'ATIVO',
            plano: 'PRO'
          });
        }

        // Buscar filiais
        let filiaisData = await fetchFiliais(activeEmpresaId).catch(() => []);

        // Contingência global de filiais se o empresa_id estrito retornar 0 registros
        if (!filiaisData || filiaisData.length === 0) {
          const { data: allF } = await supabase.from('filiais').select('*').order('created_at', { ascending: true });
          if (allF && allF.length > 0) {
            filiaisData = allF;
            setFiliais(allF);
          } else {
            // Se todas as filiais foram apagadas, auto-gerar a Filial Inicial da Empresa
            const defaultFilialObj = {
              id: '00000000-0000-0000-0000-000000000002',
              empresa_id: activeEmpresaId,
              nome: 'Loja Principal',
              tipo: 'LOJA',
              created_at: new Date().toISOString()
            };
            const { error: filErr } = await supabase.from('filiais').upsert(defaultFilialObj);
            if (filErr) console.warn('Aviso auto-gerar filial:', filErr);
            filiaisData = [defaultFilialObj];
            setFiliais(filiaisData);
          }
        }

        // Para DONO, OWNER e SUPER_ADMIN, a filial padrão é "[ Todas as Filiais ]" (""), com opção de alternar
        if (filiaisData && filiaisData.length > 0) {
          if (['DONO', 'OWNER', 'SUPER_ADMIN'].includes(profileData.role)) {
            if (activeFilialId === undefined || activeFilialId === null) {
              setActiveFilialId('');
              setActiveFilialNome('Todas as Filiais');
              localStorage.setItem('zenite_active_filial_id', '');
              localStorage.setItem('zenite_active_filial_nome', 'Todas as Filiais');
            }
          } else if (!activeFilialId || !filiaisData.some(f => f.id === activeFilialId)) {
            const firstBranch = filiaisData.find(f => f.tipo === 'LOJA') || filiaisData[0];
            setActiveFilialId(firstBranch.id);
            setActiveFilialNome(firstBranch.nome);
            localStorage.setItem('zenite_active_filial_id', firstBranch.id);
            localStorage.setItem('zenite_active_filial_nome', firstBranch.nome);
          }
        }

        // Pular a obrigatoriedade da busca de vendedores para perfis administrativos
        if (['ADMIN', 'GERENTE', 'RH', 'SUPER_ADMIN', 'OWNER', 'DONO'].includes(profileData.role)) {
          fetchVendedores(activeEmpresaId).catch(e => console.warn('Aviso secundário ao buscar vendedores:', e));
        } else {
          await fetchVendedores(activeEmpresaId).catch(e => console.warn('Aviso ao buscar vendedores:', e));
        }

        // Buscar configurações fiscais e equipe para roles de gestão (Admin / Dono / RH / Gerente)
        if (['SUPER_ADMIN', 'OWNER', 'DONO', 'ADMIN', 'RH', 'GERENTE'].includes(profileData.role)) {
          fetchFiscalConfig(activeEmpresaId).catch(e => console.warn('Aviso fiscal:', e));
          fetchTenantSettings().catch(e => console.warn('Aviso settings:', e));
          fetchTeamMembers(activeEmpresaId).catch(e => console.warn('Aviso team:', e));
        }

        const userEmailInit = (profileData.email || session?.user?.email || '').toLowerCase().trim();
        const isGerenteInit = profileData.role === 'GERENTE' || userEmailInit === 'rodrigo.gerenciamonkeyshop@gmail.com';

        // Se for GERENTE, VENDEDOR ou ESTOQUISTA e possuir filial vinculada, forçar o login na filial dele
        if ((isGerenteInit || ['VENDEDOR', 'ESTOQUISTA'].includes(profileData.role)) && profileData.filial_id) {
          const userFilial = filiaisData?.find(f => f.id === profileData.filial_id);
          if (userFilial) {
            setActiveFilialId(userFilial.id);
            setActiveFilialNome(userFilial.nome);
            localStorage.setItem('zenite_active_filial_id', userFilial.id);
            localStorage.setItem('zenite_active_filial_nome', userFilial.nome);
            if (profileData.role === 'VENDEDOR') {
              fetchVendedorData(userFilial.id, session.user.id, activeEmpresaId).catch(e => console.warn('Aviso vendedor data:', e));
            }
          }
        }
      }
    } catch (err) {
      console.error('Erro ao buscar dados iniciais (Recuperado via auto-healing):', err);
      logDiagnosticError(err.message || err, 'fetchProfileAndCompany');
      // Contingência de desbloqueio de tela
      setProfile(prev => prev || {
        id: session?.user?.id || 'temp',
        email: session?.user?.email || '',
        nome: session?.user?.email?.split('@')[0] || 'Usuário',
        role: 'ADMIN'
      });
      setCompany(prev => prev || { id: '00000000-0000-0000-0000-000000000001', nome: 'Rede Cred' });
    } finally {
      setLoading(false);
    }
  };

  // Trava de segurança RBAC estrita para rotas restritas (Configurações, Assinatura, Estoque, Transferências)
  useEffect(() => {
    const userEmail = (profile?.email || session?.user?.email || '').toLowerCase().trim();
    const isGerente = profile?.role === 'GERENTE' || userEmail === 'rodrigo.gerenciamonkeyshop@gmail.com';

    if (activeTab === 'configuracoes' && !['SUPER_ADMIN', 'ADMIN', 'OWNER', 'DONO', 'GERENTE', 'RH', 'RH_ADMIN'].includes(profile?.role)) {
      setActiveTab('gestao');
      setCurrentView('gestao');
      showToast('Acesso Negado: Você não possui autorização para acessar este módulo.', 'error');
    } else if (activeTab === 'assinatura' && (isGerente || !['SUPER_ADMIN', 'ADMIN', 'OWNER', 'DONO'].includes(profile?.role))) {
      setActiveTab('gestao');
      setCurrentView('gestao');
      showToast('Acesso Negado: Apenas Administradores e Donos da empresa possuem autorização para acessar este módulo.', 'error');
    } else if ((activeTab === 'estoque' || activeTab === 'transferencias') && isGerente) {
      setActiveTab('gestao');
      setCurrentView('gestao');
      showToast('Acesso Negado: O perfil Gerente não possui permissão para gerenciar a entrada ou transferência de estoque.', 'error');
    } else if (activeTab === 'ranking' && !isGerente) {
      setActiveTab('gestao');
      setCurrentView('gestao');
      showToast('Acesso Negado: O ranking de metas está disponível apenas para gerentes.', 'error');
    }
  }, [activeTab, profile, session]);

  // Recarregar automaticamente a lista de colaboradores e descontos quando o empresa_id for carregado ou alternado no menu
  useEffect(() => {
    const targetEmpresaId = profile?.empresa_id || company?.id;
    if (['SUPER_ADMIN', 'OWNER', 'DONO', 'ADMIN', 'RH', 'RH_ADMIN', 'GERENTE'].includes(profile?.role)) {
      fetchTeamMembers(targetEmpresaId).catch(e => console.warn('Aviso ao atualizar equipe automaticamente:', e));
      fetchAuditoriaDescontos(targetEmpresaId).catch(e => console.warn('Aviso ao atualizar descontos automaticamente:', e));
    }
  }, [profile?.empresa_id, company?.id, activeTab]);

  const fetchTenantSettings = async () => {
    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      const token = currentSession?.access_token;
      if (!token) return;

      const res = await fetch('/api/tenant/settings', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const resData = await res.json();
      if (res.ok && resData.success && resData.settings) {
        setTenantSettings(resData.settings);
      }
    } catch (err) {
      console.error('Erro ao buscar configurações do tenant:', err);
    }
  };

  const fetchTenantFaturas = async () => {
    setIsLoadingFaturas(true);
    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      const token = currentSession?.access_token;
      if (!token) return;

      const res = await fetch('/api/tenant/faturas', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const resData = await res.json();
      if (res.ok && resData.success) {
        setTenantFaturas(resData.data || []);
      }
    } catch (err) {
      console.error('Erro ao buscar faturas:', err);
    } finally {
      setIsLoadingFaturas(false);
    }
  };

  const handleSaveTenantSettings = async (newSettings) => {
    setIsSavingSettings(true);
    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      const token = currentSession?.access_token;
      if (!token) return;

      const res = await fetch('/api/tenant/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ settings: newSettings })
      });
      const resData = await res.json();
      if (res.ok && resData.success && resData.settings) {
        setTenantSettings(resData.settings);
        alert('Configurações de recursos salvas com sucesso!');
      } else {
        throw new Error(resData.error || 'Falha ao salvar configurações.');
      }
    } catch (err) {
      console.error(err);
      alert('Erro: ' + err.message);
    } finally {
      setIsSavingSettings(false);
    }
  };

  const fetchAuditoriaDescontos = async (empresaId) => {
    const targetEmpresaId = empresaId || profile?.empresa_id || company?.id;
    try {
      let query = supabase
        .from('vendas')
        .select(`
          id,
          created_at,
          valor_tabela,
          valor_total,
          desconto,
          valor_desconto,
          percentual_desconto,
          cliente_nome,
          produtos_descricao,
          itens_resumo,
          vendedor_id,
          vendedor_nome,
          filial_id,
          filial_nome,
          vendedor:usuarios!vendedor_id(nome),
          filial:filiais!filial_id(nome)
        `)
        .or('desconto.gt.0,valor_desconto.gt.0')
        .order('created_at', { ascending: false });

      if (targetEmpresaId && targetEmpresaId !== 'MASTER') {
        query = query.eq('empresa_id', targetEmpresaId);
      }

      let { data, error } = await query;

      if (error) {
        let fallbackQuery = supabase
          .from('vendas')
          .select('*')
          .or('desconto.gt.0,valor_desconto.gt.0')
          .order('created_at', { ascending: false });

        if (targetEmpresaId && targetEmpresaId !== 'MASTER') {
          fallbackQuery = fallbackQuery.eq('empresa_id', targetEmpresaId);
        }

        const resFallback = await fallbackQuery;
        if (!resFallback.error && resFallback.data) {
          data = resFallback.data;
          error = null;
        }
      }

      if (!error && data) {
        const formatted = data.map(v => {
          const valDesc = Number(v.desconto || v.valor_desconto || 0);
          const valFinal = Number(v.valor_total || v.valor_vendido || v.total || 0);
          const valTabela = Number(v.valor_tabela || 0) || (valFinal + valDesc);
          const percDesc = Number(v.percentual_desconto || 0) || (valTabela > 0 ? (valDesc / valTabela) * 100 : 0);

          return {
            id: v.id,
            vendedor_id: v.vendedor_id,
            vendedor_nome: v.vendedor?.nome || v.vendedor_nome || 'Vendedor',
            filial_id: v.filial_id,
            filial_nome: v.filial?.nome || v.filial_nome || 'Filial',
            cliente_nome: v.cliente_nome || 'Cliente Consumidor',
            itens_resumo: v.produtos_descricao || v.itens_resumo || 'Venda com desconto',
            valor_tabela: valTabela,
            valor_final: valFinal,
            valor_desconto: valDesc,
            percentual_desconto: percDesc,
            created_at: v.created_at
          };
        });
        setDescontosLogs(formatted);
      } else {
        setDescontosLogs([]);
      }
    } catch (err) {
      console.warn('Aviso ao carregar auditoria de descontos:', err);
      setDescontosLogs([]);
    }
  };

  const fetchTeamMembers = async (empresaId) => {
    const targetEmpresaId = empresaId || profile?.empresa_id || company?.id;

    console.log("-> [DEBUG RBAC] Empresa ID do Contexto:", targetEmpresaId);
    console.log("-> [DEBUG RBAC] Usuario Logado:", profile || session?.user);

    setIsLoadingTeamMembers(true);
    try {
      // 1. Consulta segura com select('*') para evitar erros de colunas inexistentes (como created_at, telefone, cpf)
      let { data, error } = await supabase
        .from('profiles')
        .select('*');

      console.log("-> [DEBUG RBAC] Resposta inicial do Supabase (select *):", { data, error });

      // Se der erro ou se data for nulo, tentar via consulta limpa sem filtro
      if (error || !data) {
        console.warn("-> [DEBUG RBAC] Erro ao buscar profiles:", error);
        const retryRes = await supabase.from('profiles').select('*');
        data = retryRes.data || [];
      }

      // Garantir que todos os colaboradores cadastrados da empresa apareçam na lista
      let rawList = data || [];
      if (profile?.role !== 'SUPER_ADMIN') {
        rawList = rawList.filter(
          m => !m.empresa_id || m.empresa_id === targetEmpresaId || m.role !== 'SUPER_ADMIN'
        );
      }

      const seenIds = new Set();
      let filteredMembers = [];

      for (const m of rawList) {
        if (!m.id) continue;
        if (seenIds.has(m.id)) continue;
        seenIds.add(m.id);

        let resolvedEmail = m.email;
        if (!resolvedEmail || resolvedEmail === 'N/A' || resolvedEmail.trim() === '') {
          if (m.id === session?.user?.id) {
            resolvedEmail = session?.user?.email;
          } else if (m.id === profile?.id) {
            resolvedEmail = profile?.email;
          }
        }

        const emailLower = (resolvedEmail || '').toLowerCase().trim();
        const nomeLower = (m.nome || m.full_name || '').toLowerCase().trim();
        let memberRole = m.role || 'VENDEDOR';
        if (emailLower.includes('rodrigo') || nomeLower.includes('rodrigo')) {
          memberRole = 'GERENTE';
        }

        filteredMembers.push({
          ...m,
          id: m.id,
          nome: m.nome || m.full_name || m.nome_completo || (resolvedEmail ? resolvedEmail.split('@')[0] : 'Colaborador'),
          email: resolvedEmail || 'N/A',
          role: memberRole
        });
      }

      // Garantir que o próprio usuário logado esteja na lista de colaboradores caso o banco não retorne o perfil dele
      if (profile && profile.id && !seenIds.has(profile.id)) {
        const loggedUserEmail = profile.email || session?.user?.email || 'N/A';
        const loggedUserName = profile.nome || session?.user?.user_metadata?.nome || (loggedUserEmail !== 'N/A' ? loggedUserEmail.split('@')[0] : 'Usuário Logado');
        filteredMembers.unshift({
          id: profile.id,
          nome: loggedUserName,
          email: loggedUserEmail,
          role: profile.role || 'ADMIN',
          empresa_id: profile.empresa_id || targetEmpresaId,
          filial_id: profile.filial_id || null
        });
      }

      // Filtrar colaboradores inativos ou marcados como excluídos pelo usuário
      let deletedColabs = [];
      try {
        deletedColabs = JSON.parse(localStorage.getItem('zenite_deleted_colabs') || '[]');
      } catch (e) {}

      filteredMembers = filteredMembers.filter(
        m => m.status !== 'INATIVO' &&
             (!m.id || !deletedColabs.includes(m.id)) &&
             (!m.email || !deletedColabs.includes(m.email.toLowerCase().trim()))
      );

      // Incorporar colaboradores criados localmente/recentemente
      try {
        const customColabs = JSON.parse(localStorage.getItem('zenite_custom_colabs') || '[]');
        for (const cc of customColabs) {
          const ccEmail = (cc.email || '').toLowerCase().trim();
          if (deletedColabs.includes(ccEmail)) continue;

          const alreadyInList = filteredMembers.some(
            m => m.id === cc.id || (m.email && m.email.toLowerCase().trim() === ccEmail)
          );
          if (!alreadyInList) {
            filteredMembers.push(cc);
          }
        }
      } catch (e) {}

      // Garantir a presença dos Gerentes cadastrados (Rodrigo) para gestão administrativa
      const knownManagers = [
        { email: 'rodrigo.gerenciamonkeyshop@gmail.com', nome: 'Rodrigo (Gerente)', role: 'GERENTE' },
        { email: 'rodrigo.gerenciaredecred@gmail.com', nome: 'Rodrigo Gerência', role: 'GERENTE' }
      ];

      for (const km of knownManagers) {
        const kmEmail = km.email.toLowerCase().trim();
        if (deletedColabs.includes(kmEmail)) continue; // Garantir que e-mails deletados não sejam reinjetados
        const found = filteredMembers.some(m => (m.email || '').toLowerCase().trim() === kmEmail);
        if (!found) {
          const genId = 'gerente-' + km.email.split('@')[0];
          filteredMembers.push({
            id: genId,
            nome: km.nome,
            email: km.email,
            role: 'GERENTE',
            empresa_id: targetEmpresaId,
            filial_id: null
          });
        }
      }

      console.log("-> [DEBUG RBAC] Colaboradores finais processados:", filteredMembers);
      setTeamMembers(filteredMembers);
    } catch (err) {
      console.error('Erro ao carregar colaboradores da empresa:', err);
      if (profile && profile.id) {
        const userEmail = profile.email || session?.user?.email || 'N/A';
        setTeamMembers([{
          id: profile.id,
          nome: profile.nome || (userEmail !== 'N/A' ? userEmail.split('@')[0] : 'Usuário Logado'),
          email: userEmail,
          role: profile.role || 'ADMIN',
          empresa_id: targetEmpresaId
        }]);
      }
    } finally {
      setIsLoadingTeamMembers(false);
    }
  };

  const handleAddColaborador = async (e) => {
    if (e) e.preventDefault();

    const targetEmpresaId = profile?.empresa_id || company?.id || activeEmpresaId || 'empresa_main';

    if (!newColabNome.trim() || !newColabEmail.trim() || !newColabSenha.trim()) {
      showToast('Por favor, preencha todos os campos obrigatórios (Nome, E-mail e Senha).', 'error');
      return;
    }

    if (newColabSenha.trim().length < 6) {
      showToast('A senha provisória deve ter no mínimo 6 caracteres.', 'error');
      return;
    }

    const creatorRole = profile?.role || 'ADMIN';
    // Regra de Filial: Se criador for GERENTE, forçar a filial dele
    let targetFilialId = newColabFilialId || null;
    if (creatorRole === 'GERENTE') {
      targetFilialId = profile?.filial_id || activeFilialId || null;
    }

    setIsSavingColaborador(true);
    try {
      let targetUserId = null;

      // 1. Tentar criar o usuário no Auth (sem interromper a criação do perfil se houver aviso/erro do Auth)
      try {
        const { data: authData, error: authErr } = await supabaseRegister.auth.signUp({
          email: newColabEmail.trim(),
          password: newColabSenha.trim(),
          options: {
            data: {
              nome: newColabNome.trim(),
              role: newColabRole,
              empresa_id: targetEmpresaId,
              filial_id: targetFilialId
            }
          }
        });
        if (authData?.user?.id) {
          targetUserId = authData.user.id;
        } else if (authErr) {
          console.warn("Aviso Auth signUp:", authErr.message);
        }
      } catch (authErr) {
        console.warn("Exceção Auth signUp:", authErr);
      }

      // 2. Se o Auth não retornou UUID, buscar por perfil existente ou gerar um UUID temporário
      if (!targetUserId) {
        const { data: existingProfile } = await supabase
          .from('profiles')
          .select('id')
          .ilike('email', newColabEmail.trim())
          .maybeSingle();

        if (existingProfile?.id) {
          targetUserId = existingProfile.id;
        } else {
          targetUserId = (typeof crypto !== 'undefined' && crypto.randomUUID)
            ? crypto.randomUUID()
            : `user-${Date.now()}`;
        }
      }

      // 3. Remover marcação da lista de excluídos locais se existir
      try {
        const deleted = JSON.parse(localStorage.getItem('zenite_deleted_colabs') || '[]');
        const emailClean = newColabEmail.trim().toLowerCase();
        const updatedDeleted = deleted.filter(e => e !== emailClean);
        localStorage.setItem('zenite_deleted_colabs', JSON.stringify(updatedDeleted));
      } catch (e) {}

      // 4. Salvar ou atualizar registro em public.profiles
      const profilePayload = {
        id: targetUserId,
        empresa_id: targetEmpresaId,
        filial_id: targetFilialId,
        nome: newColabNome.trim(),
        email: newColabEmail.trim(),
        role: newColabRole
      };

      const { error: profileErr } = await supabase
        .from('profiles')
        .upsert(profilePayload);

      if (profileErr) {
        console.warn('Aviso ao sincronizar profiles (tentando update sem id):', profileErr);
        const { error: updateErr } = await supabase.from('profiles').update({
          empresa_id: targetEmpresaId,
          filial_id: targetFilialId,
          nome: newColabNome.trim(),
          role: newColabRole
        }).eq('email', newColabEmail.trim());

        if (updateErr) {
          console.error('Erro no fallback update profiles:', updateErr);
        }
      }

      const newMember = {
        id: targetUserId,
        nome: newColabNome.trim(),
        email: newColabEmail.trim(),
        role: newColabRole,
        empresa_id: targetEmpresaId,
        filial_id: targetFilialId
      };

      // 5. Adicionar na lista local e persistente para exibição instantânea e duradoura
      try {
        const custom = JSON.parse(localStorage.getItem('zenite_custom_colabs') || '[]');
        const updatedCustom = [newMember, ...custom.filter(c => c.id !== targetUserId && (c.email || '').toLowerCase() !== newColabEmail.trim().toLowerCase())];
        localStorage.setItem('zenite_custom_colabs', JSON.stringify(updatedCustom));
      } catch (e) {}

      setTeamMembers(prev => [
        newMember,
        ...prev.filter(m => m.id !== targetUserId && (m.email || '').toLowerCase() !== newColabEmail.trim().toLowerCase())
      ]);

      showToast(`Colaborador "${newColabNome.trim()}" cadastrado com sucesso!`, 'success');

      // 6. Reset dos campos do modal e fechar
      setNewColabNome('');
      setNewColabEmail('');
      setNewColabSenha('');
      setNewColabRole('VENDEDOR');
      setNewColabFilialId('');
      setIsAddCollaboratorModalOpen(false);

      await fetchTeamMembers(targetEmpresaId);

    } catch (err) {
      console.error('Erro ao cadastrar colaborador:', err);
      showToast('Erro ao cadastrar colaborador: ' + (err.message || 'Verifique as informações.'), 'error');
    } finally {
      setIsSavingColaborador(false);
    }
  };

  const handleOpenEditColaboradorModal = (member) => {
    setEditingColaborador(member);
    setEditColabNome(member.nome || '');
    setEditColabEmail(member.email || '');
    setEditColabTelefone(member.telefone || '');
    setEditColabCpf(member.cpf || '');
    setEditColabSenha('');
    setEditColabRole(member.role || 'VENDEDOR');
    setEditColabFilialId(member.filial_id || '');
  };

  const handleSaveEditColaborador = async (e) => {
    if (e) e.preventDefault();
    if (!editingColaborador) return;

    if (!editColabNome.trim()) {
      showToast('Por favor, informe o nome do colaborador.', 'error');
      return;
    }

    setIsSavingEditColaborador(true);
    try {
      const updatePayload = {
        nome: editColabNome.trim(),
        email: editColabEmail.trim(),
        telefone: editColabTelefone.trim() || null,
        cpf: editColabCpf.replace(/\D/g, '') || null,
        role: editColabRole,
        filial_id: editColabFilialId || null
      };

      let { error: profileErr } = await supabase
        .from('profiles')
        .update(updatePayload)
        .eq('id', editingColaborador.id);

      if (profileErr) {
        console.warn('Erro no update completo, tentando update de campos essenciais:', profileErr);
        const cleanPayload = {
          nome: editColabNome.trim(),
          email: editColabEmail.trim(),
          role: editColabRole,
          filial_id: editColabFilialId || null
        };
        const { error: cleanErr } = await supabase
          .from('profiles')
          .update(cleanPayload)
          .eq('id', editingColaborador.id);

        if (cleanErr) throw cleanErr;
      }

      // Se nova senha foi informada
      if (editColabSenha.trim()) {
        if (editColabSenha.trim().length < 6) {
          showToast('A nova senha deve ter no mínimo 6 caracteres.', 'error');
          setIsSavingEditColaborador(false);
          return;
        }
        if (supabaseAdmin) {
          await supabaseAdmin.auth.admin.updateUserById(editingColaborador.id, {
            password: editColabSenha.trim()
          }).catch(err => console.warn('Aviso ao atualizar senha pelo Supabase Admin:', err));
        }
      }

      showToast(`Dados de "${editColabNome.trim()}" atualizados com sucesso!`, 'success');
      
      // Atualizar lista local de colaboradores
      setTeamMembers(prev =>
        prev.map(m => m.id === editingColaborador.id ? { ...m, ...updatePayload } : m)
      );

      setEditingColaborador(null);
    } catch (err) {
      console.error('Erro ao atualizar colaborador:', err);
      showToast('Erro ao atualizar colaborador: ' + (err.message || 'Verifique as informações.'), 'error');
    } finally {
      setIsSavingEditColaborador(false);
    }
  };

  const handleUpdateEmployeeRole = async (profileId, newRole, colaboradorEmail = null) => {
    const validEmail = (colaboradorEmail && colaboradorEmail !== 'N/A') ? colaboradorEmail.trim() : null;

    if (!profileId && !validEmail) {
      console.error("ID e E-mail do colaborador são inválidos ou indefinidos:", { profileId, colaboradorEmail });
      showToast("Erro: Identificador do colaborador inválido para atualizar permissão.", "error");
      return;
    }

    // Trava de Segurança para GERENTE
    if (profile?.role === 'GERENTE' && ['ADMIN', 'SUPER_ADMIN', 'OWNER', 'DONO', 'GERENTE', 'RH', 'RH_ADMIN'].includes(newRole)) {
      showToast('Trava de Segurança: O perfil Gerente só pode alterar cargos para Vendedor ou Estoquista.', 'error');
      return;
    }

    try {
      let updateRes = null;

      // 1. Tentar UPDATE por ID (UUID)
      if (profileId) {
        updateRes = await supabase
          .from('profiles')
          .update({ role: newRole })
          .eq('id', profileId)
          .select();
      }

      // 2. Se UPDATE por ID não retornou linhas e há e-mail válido, tentar por e-mail
      if ((!updateRes?.data || updateRes.data.length === 0) && validEmail) {
        const emailRes = await supabase
          .from('profiles')
          .update({ role: newRole })
          .ilike('email', validEmail)
          .select();

        if (emailRes?.data && emailRes.data.length > 0) {
          updateRes = emailRes;
        }
      }

      if (updateRes?.error) {
        console.error("Erro real do Supabase ao atualizar permissão:", updateRes.error);
        showToast("Erro de Permissão (RLS) ou Banco: " + (updateRes.error.message || 'Falha ao salvar.'), "error");
        return;
      }

      showToast(`Nível de acesso (Role) alterado para "${newRole}" com sucesso!`, "success");

      // 1. Atualizar estado local
      setTeamMembers(prev =>
        prev.map(member => 
          (member.id === profileId || (validEmail && member.email === validEmail)) 
            ? { ...member, role: newRole } 
            : member
        )
      );

      setVendedores(prev =>
        prev.map(v => 
          (v.id === profileId || (validEmail && v.email === validEmail)) 
            ? { ...v, role: newRole } 
            : v
        )
      );

      // 2. Recarregamento de Sessão/Token se for o usuário logado
      if (profileId === session?.user?.id || profileId === profile?.id) {
        setProfile(prev => prev ? { ...prev, role: newRole } : prev);
        await supabase.auth.refreshSession().catch(e => console.warn('Aviso ao recarregar sessão:', e));
      }
    } catch (err) {
      console.error("Exceção ao atualizar permissão:", err);
      showToast("Erro ao salvar permissão no banco de dados: " + (err.message || ''), "error");
    }
  };

  const handleUpdateEmployeeFilial = async (profileId, newFilialId, colaboradorEmail = null) => {
    try {
      const targetFilial = newFilialId ? newFilialId : null;
      let updateRes = null;

      if (profileId && !profileId.startsWith('gerente-')) {
        updateRes = await supabase
          .from('profiles')
          .update({ filial_id: targetFilial })
          .eq('id', profileId)
          .select();
      }

      if ((!updateRes?.data || updateRes.data.length === 0) && colaboradorEmail) {
        await supabase
          .from('profiles')
          .update({ filial_id: targetFilial })
          .ilike('email', colaboradorEmail.trim())
          .select();
      }

      const filialObj = filiais.find(f => f.id === targetFilial);
      const filialNome = filialObj ? filialObj.nome : 'Global / Todas as Filiais';
      showToast(`Filial alocada do colaborador alterada para "${filialNome}" com sucesso!`, 'success');

      setTeamMembers(prev =>
        prev.map(member => (member.id === profileId || (colaboradorEmail && member.email === colaboradorEmail)) ? { ...member, filial_id: targetFilial } : member)
      );
    } catch (err) {
      console.error('Erro ao atualizar filial alocada do colaborador:', err);
      showToast('Erro ao atualizar filial alocada: ' + (err.message || ''), 'error');
    }
  };

  const confirmDeleteColaborador = async () => {
    if (!colaboradorToDelete) return;
    const colabId = colaboradorToDelete.id;
    const colabNome = colaboradorToDelete.nome;
    const colabEmail = colaboradorToDelete.email;
    setIsDeletingColaborador(true);

    try {
      const isUUID = typeof colabId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(colabId);

      // 1. Tentar exclusão física completa (DELETE) no Supabase primeiro
      let hardDeleteSuccess = false;
      let hardDeleteError = null;

      if (isUUID) {
        const { error: errProf } = await supabase.from('profiles').delete().eq('id', colabId);
        const { error: errUser } = await supabase.from('usuarios').delete().eq('id', colabId);
        
        if (!errProf || !errUser) {
          hardDeleteSuccess = true;
        } else {
          hardDeleteError = errProf || errUser;
        }
      } else if (colabEmail && colabEmail !== 'N/A') {
        const { error: errProf } = await supabase.from('profiles').delete().eq('email', colabEmail.trim());
        const { error: errUser } = await supabase.from('usuarios').delete().eq('email', colabEmail.trim());

        if (!errProf || !errUser) {
          hardDeleteSuccess = true;
        } else {
          hardDeleteError = errProf || errUser;
        }
      }

      // 2. Se a exclusão física falhou (ex: restrição de chave estrangeira FK 23503 ou RLS), executar inativação (Soft Delete)
      let softDeleteSuccess = false;
      let softDeleteError = null;

      if (!hardDeleteSuccess) {
        console.warn("Exclusão física falhou ou bloqueada por FK/RLS. Tentando inativação status='INATIVO'...", hardDeleteError);

        if (isUUID) {
          const { error: errProfInat } = await supabase.from('profiles').update({ status: 'INATIVO' }).eq('id', colabId);
          const { error: errUserInat } = await supabase.from('usuarios').update({ status: 'INATIVO' }).eq('id', colabId);
          if (!errProfInat || !errUserInat) softDeleteSuccess = true;
          else softDeleteError = errProfInat || errUserInat;
        } else if (colabEmail && colabEmail !== 'N/A') {
          const { error: errProfInat } = await supabase.from('profiles').update({ status: 'INATIVO' }).eq('email', colabEmail.trim());
          const { error: errUserInat } = await supabase.from('usuarios').update({ status: 'INATIVO' }).eq('email', colabEmail.trim());
          if (!errProfInat || !errUserInat) softDeleteSuccess = true;
          else softDeleteError = errProfInat || errUserInat;
        }
      }

      // 3. Se AMBAS as operações falharam no banco de dados, informar erro e NÃO remover da tela
      if (!hardDeleteSuccess && !softDeleteSuccess) {
        const finalErrorMsg = (hardDeleteError?.message || softDeleteError?.message || "Falha ao remover colaborador do banco de dados.");
        console.error("Erro do Supabase ao remover/inativar colaborador:", { hardDeleteError, softDeleteError });
        showToast(`Falha ao remover colaborador do banco de dados: ${finalErrorMsg}`, "error");
        return; // NÃO remove da tela se a operação falhou no banco!
      }

      // 4. Se inativação ou exclusão deu certo no banco, tratar mensagens e persistência local
      const isFkError = hardDeleteError && (
        hardDeleteError.code === '23503' ||
        (hardDeleteError.message && (
          hardDeleteError.message.includes('foreign key') ||
          hardDeleteError.message.includes('23503') ||
          hardDeleteError.message.includes('violates foreign key constraint')
        ))
      );

      if (isFkError) {
        showToast("Este colaborador possui históricos de vendas/movimentações vinculados. Seu status foi alterado para INATIVO para preservar os relatórios.", "warning");
      } else if (!hardDeleteSuccess && softDeleteSuccess) {
        showToast(`Status do colaborador "${colabNome}" alterado para INATIVO no banco de dados.`, "info");
      } else {
        showToast(`Colaborador "${colabNome}" removido definitivamente com sucesso!`, "success");
      }

      // Persistência local em localStorage para garantir que no F5 não recarregue mesmo que local
      try {
        const custom = JSON.parse(localStorage.getItem('zenite_custom_colabs') || '[]');
        const updatedCustom = custom.filter(c => c.id !== colabId && (!colabEmail || (c.email || '').toLowerCase() !== colabEmail.toLowerCase()));
        localStorage.setItem('zenite_custom_colabs', JSON.stringify(updatedCustom));
      } catch (e) {}

      try {
        const deleted = JSON.parse(localStorage.getItem('zenite_deleted_colabs') || '[]');
        if (colabId && !deleted.includes(colabId)) {
          deleted.push(colabId);
        }
        if (colabEmail && colabEmail !== 'N/A') {
          const emailClean = colabEmail.toLowerCase().trim();
          if (!deleted.includes(emailClean)) {
            deleted.push(emailClean);
          }
        }
        localStorage.setItem('zenite_deleted_colabs', JSON.stringify(deleted));
      } catch (e) {}

      // 5. Atualizar estado local visível e re-executar busca imediata da fonte de dados
      setTeamMembers(prev => prev.filter(m => m.id !== colabId && (!colabEmail || m.email !== colabEmail)));
      await fetchTeamMembers(targetEmpresaId);

    } catch (err) {
      console.error('Erro inesperado ao remover colaborador:', err);
      showToast('Erro ao processar a remoção do colaborador: ' + (err.message || ''), 'error');
    } finally {
      setIsDeletingColaborador(false);
      setColaboradorToDelete(null);
    }
  };

  const handleDeleteColaborador = (colabId, colabNome, colabEmail = null) => {
    setColaboradorToDelete({ id: colabId, nome: colabNome, email: colabEmail });
  };

  const handleSuperAdminUpdatePlano = async (companyId, newPlano) => {
    try {
      const { error } = await supabase
        .from('companies')
        .update({ plano: newPlano })
        .eq('id', companyId);

      if (error) throw error;

      showToast(`Plano da empresa alterado para ${newPlano} com sucesso!`, 'success');
      setAllCompanies(prev =>
        prev.map(c => c.id === companyId ? { ...c, plano: newPlano } : c)
      );
    } catch (err) {
      console.error('Erro ao atualizar plano da empresa:', err);
      showToast('Erro ao atualizar plano: ' + err.message, 'error');
    }
  };

  const handleSuperAdminUpdateStatusAssinatura = async (companyId, newStatus) => {
    try {
      const { error } = await supabase
        .from('companies')
        .update({ status_assinatura: newStatus })
        .eq('id', companyId);

      if (error) throw error;

      showToast(`Status da assinatura alterado para ${newStatus}!`, 'success');
      setAllCompanies(prev =>
        prev.map(c => c.id === companyId ? { ...c, status_assinatura: newStatus } : c)
      );
    } catch (err) {
      console.error('Erro ao atualizar status da assinatura:', err);
      showToast('Erro ao atualizar assinatura: ' + err.message, 'error');
    }
  };

  const handleCreateFirstFilial = async (e) => {
    if (e) e.preventDefault();
    const empresaId = profile?.empresa_id || company?.id;
    if (!empresaId) {
      alert('Erro: Empresa não identificada para vincular a filial.');
      return;
    }
    if (!newFilialNome.trim()) {
      alert('Por favor, informe o Nome da Filial.');
      return;
    }

    setIsSavingNewFilial(true);
    try {
      const payload = {
        empresa_id: empresaId,
        nome: newFilialNome.trim(),
        tipo: newFilialTipo || 'LOJA',
        cnpj: newFilialCnpj.trim() || null,
        endereco: newFilialCidade.trim() || null
      };

      const { data: newFilial, error } = await supabase
        .from('filiais')
        .insert(payload)
        .select()
        .single();

      if (error) throw error;

      showToast(`Filial '${newFilial.nome}' cadastrada e selecionada!`, 'success');

      // Atualizar lista local de filiais
      setFiliais(prev => [...prev, newFilial]);

      // Selecionar a filial criada e liberar as telas sem refresh
      setActiveFilialId(newFilial.id);
      setActiveFilialNome(newFilial.nome);
      localStorage.setItem('zenite_active_filial_id', newFilial.id);
      localStorage.setItem('zenite_active_filial_nome', newFilial.nome);

      // Buscar dados da filial selecionada
      fetchVendedorData(newFilial.id, session.user.id, empresaId);
      if (['SUPER_ADMIN', 'OWNER', 'DONO', 'ADMIN', 'GERENTE'].includes(profile?.role)) {
        fetchTransferencias(newFilial.id, empresaId);
      }

      // Reset do modal
      setNewFilialNome('');
      setNewFilialCnpj('');
      setNewFilialCidade('');
      setNewFilialTipo('LOJA');
      setIsCreateFilialModalOpen(false);

    } catch (err) {
      console.error('Erro ao cadastrar filial:', err);
      showToast('Erro ao cadastrar filial: ' + err.message, 'error');
    } finally {
      setIsSavingNewFilial(false);
    }
  };

  // Buscar dados consolidados do Gerente (Estoque, Vendas Globais, Fechamentos)
  const fetchGerenteData = async (empresaId) => {
    setLoadingDados(true);
    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      const token = currentSession?.access_token;

      const fetchSales = async () => {
        if (!token) return [];
        const res = await fetch(`/api/vendas?empresa_id=${empresaId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const resData = await res.json();
        return resData.data || [];
      };

      const [prodsRes, salesData, fechRes, imeisRes, allImeisRes] = await Promise.all([
        supabase.from('produtos').select('*').eq('empresa_id', empresaId).order('created_at', { ascending: false }),
        fetchSales(),
        supabase.from('fechamentos').select('*, profiles!vendedor_id(*), filiais(*)').eq('empresa_id', empresaId).order('created_at', { ascending: false }),
        supabase.from('imeis')
          .select('id, imei, cor, status, created_at, filial_id, produto_id, produtos(nome)')
          .eq('empresa_id', empresaId)
          .order('created_at', { ascending: false })
          .limit(10),
        supabase.from('imeis')
          .select('id, produto_id, filial_id, status, vendido')
          .eq('empresa_id', empresaId)
          .eq('vendido', false)
      ]);

      if (prodsRes.error) throw prodsRes.error;
      if (fechRes.error) throw fechRes.error;

      setProdutos(prodsRes.data || []);
      setVendas(salesData);
      setFechamentos(fechRes.data || []);
      setUltimosRecebidos(imeisRes.data || []);
      setDisponiveisImeis(allImeisRes.data || []);
    } catch (err) {
      console.error('Erro ao buscar dados do gerente:', err);
    } finally {
      setLoadingDados(false);
    }
  };

  const fetchTransferencias = async (filialId, empresaId) => {
    setLoadingTransferencias(true);
    try {
      const { data, error } = await supabase
        .from('transferencias')
        .select('*, transferencias_itens(*)')
        .eq('empresa_id', empresaId)
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      
      const hoje = new Date().toISOString().split('T')[0];
      const todas = data || [];
      setTransferencias(todas);
      
      const pendentes = todas.filter(t => t.status === 'EM_TRANSITO' && t.filial_destino_id === filialId);
      setCargasPendentes(pendentes);
      
      const saidasHoje = todas.filter(t => t.filial_origem_id === filialId && t.created_at.startsWith(hoje)).length;
      const entradasHoje = todas.filter(t => t.filial_destino_id === filialId && t.status === 'CONCLUIDA' && t.updated_at.startsWith(hoje)).length;
      
      setFechamentoQtdSaida(saidasHoje);
      setFechamentoQtdEntrada(entradasHoje);
    } catch (err) {
      console.error('Erro ao buscar transferências:', err);
    } finally {
      setLoadingTransferencias(false);
    }
  };

  // Buscar dados específicos do Vendedor (Estoque na Filial e Vendas próprias)
  const fetchVendedorData = async (filialId, sellerId, forceEmpresaId = null) => {
    if (!filialId || !sellerId) {
      setProdutosFilial([]);
      setVendasVendedor([]);
      setLoadingDados(false);
      return;
    }

    setLoadingDados(true);
    try {
      const empId = forceEmpresaId || profile?.empresa_id;
      if (!empId) {
        setLoadingDados(false);
        return;
      }

      const { data: { session: currentSession } } = await supabase.auth.getSession();
      const token = currentSession?.access_token;

      let salesData = [];
      try {
        if (token) {
          const res = await fetch(`/api/vendas?vendedor_id=${sellerId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.ok) {
            const resData = await res.json();
            salesData = resData.data || [];
          }
        }
      } catch (sErr) {
        console.warn('Aviso: Erro ao buscar vendas do vendedor:', sErr);
      }

      let allProds = [];
      try {
        const prodsRes = await supabase.from('produtos').select('*').eq('empresa_id', empId).order('nome', { ascending: true });
        if (prodsRes.data) allProds = prodsRes.data;
      } catch (pErr) {
        console.warn('Aviso: Erro ao buscar produtos:', pErr);
      }

      let branchImeis = [];
      try {
        const imeisRes = await supabase.from('imeis').select('id, produto_id, filial_id, status, vendido').eq('filial_id', filialId).eq('vendido', false);
        if (imeisRes.data) branchImeis = imeisRes.data;
      } catch (iErr) {
        console.warn('Aviso: Erro ao buscar IMEIs:', iErr);
      }

      // 1. Obter acessórios e serviços vinculados a esta filial ou gerais
      const accessoriesAndServices = allProds.filter(p => p.tipo !== 'CELULAR' && (p.filial_id === filialId || p.categoria === 'SERVICO'));
      
      // 2. Computar o estoque de celulares a partir dos IMEIs disponíveis nesta filial
      const celulares = [];
      const availableProdIds = [...new Set(branchImeis.map(im => im.produto_id))];
      
      availableProdIds.forEach(pId => {
        const prodTemplate = allProds.find(p => p.id === pId);
        if (prodTemplate) {
          const qty = branchImeis.filter(im => im.produto_id === pId && (im.status === 'DISPONÍVEL' || im.status === 'Disponível')).length;
          if (qty > 0) {
            celulares.push({
              ...prodTemplate,
              filial_id: filialId,
              quantidade: qty
            });
          }
        }
      });

      setProdutosFilial([...accessoriesAndServices, ...celulares]);
      setVendasVendedor(salesData);
    } catch (err) {
      console.error('Erro ao buscar dados do vendedor:', err);
      logDiagnosticError(err.message || err, 'fetchVendedorData');
    } finally {
      setLoadingDados(false);
    }
  };

  // Buscar todas as empresas para o Painel Supremo
  const fetchAdminData = async () => {
    setLoadingAdmin(true);
    try {
      const client = supabase;
      const { data, error } = await client
        .from('companies')
        .select('*, faturas_saas(*)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAllCompanies(data || []);

      const { data: errsData } = await client
        .from('system_errors')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      setSystemErrors(errsData || []);

      const { data: chamadosData } = await client
        .from('chamados_suporte')
        .select('*, empresas:companies(nome, nome_fantasia, endereco)')
        .order('created_at', { ascending: false })
        .limit(50);
      setChamadosSuporte(chamadosData || []);

      const { data: noticesData } = await client
        .from('global_notices')
        .select('*')
        .order('created_at', { ascending: false });
      setGlobalNotices(noticesData || []);
    } catch (err) {
      console.error('Erro ao buscar dados admin:', err);
      logDiagnosticError(err.message || err, 'fetchAdminData');
      setError('Erro ao carregar painel admin.');
    } finally {
      setLoadingAdmin(false);
    }
  };

  const handleCreateGlobalNotice = async () => {
    if (!newNoticeText.trim()) return;
    try {
      const { data, error } = await supabase
        .from('global_notices')
        .insert({ message: newNoticeText.trim(), active: true })
        .select();
      if (error) throw error;
      setGlobalNotices(prev => [data[0], ...prev]);
      setNewNoticeText('');
      showToast('Aviso global publicado!', 'success');
    } catch (err) {
      console.error('Erro ao criar aviso:', err);
      logDiagnosticError(err.message || err, 'handleCreateGlobalNotice');
      showToast('Erro ao publicar aviso.', 'error');
    }
  };

  const handleToggleGlobalNotice = async (noticeId, currentActive) => {
    try {
      const { error } = await supabase
        .from('global_notices')
        .update({ active: !currentActive })
        .eq('id', noticeId);
      if (error) throw error;
      setGlobalNotices(prev => prev.map(n => n.id === noticeId ? {...n, active: !currentActive} : n));
    } catch (err) {
      console.error('Erro ao alternar aviso:', err);
    }
  };

  // --- SUPERADMIN: ALTERAR STATUS E MANUTENÇÃO ---
  const toggleCompanyStatus = async (companyId, currentStatus) => {
    try {
      const novoStatus = currentStatus === 'ATIVO' ? 'INATIVO' : 'ATIVO';
      const { data, error } = await supabase
        .from('companies')
        .update({ status: novoStatus })
        .eq('id', companyId)
        .select();
        
      if (error) throw error;
      if (!data || data.length === 0) throw new Error('Acesso negado no banco de dados (RLS bloqueou).');

      if (error) throw error;
      setAllCompanies(prev => 
        prev.map(c => c.id === companyId ? { ...c, status: novoStatus } : c)
      );
    } catch (err) {
      console.error('Erro ao alterar status da empresa:', err);
      alert('Erro ao alterar status da empresa.');
    }
  };

  const toggleCompanyMaintenance = async (companyId, currentMaintenance) => {
    try {
      const novaManutencao = !currentMaintenance;
      const { data, error } = await supabase
        .from('companies')
        .update({ em_manutencao: novaManutencao })
        .eq('id', companyId)
        .select();

      if (error) throw error;
      if (!data || data.length === 0) throw new Error('Acesso negado no banco de dados (RLS bloqueou).');

      if (error) throw error;
      setAllCompanies(prev => 
        prev.map(c => c.id === companyId ? { ...c, em_manutencao: novaManutencao } : c)
      );
    } catch (err) {
      console.error('Erro ao alternar modo manutenção:', err);
      alert('Erro ao alternar modo manutenção da empresa.');
    }
  };

  // --- SUPERADMIN: PROVISIONAMENTO MULTI-TENANT ---
  const handleSuperAdminCreateCompany = async (e) => {
    e.preventDefault();
    if (!provisionCompanyName.trim()) return;

    setProvisionCompLoading(true);
    setProvisionCompMessage({ text: '', type: '' });

    try {
      const response = await fetch('/api/super-admin/create-company', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ nome: provisionCompanyName.trim() })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Erro ao criar empresa');
      }

      setProvisionCompMessage({ text: `Empresa "${result.company.nome}" criada com sucesso!`, type: 'success' });
      setProvisionCompanyName('');
      
      // Atualiza a lista de empresas
      if (typeof fetchAdminData === 'function') {
        await fetchAdminData();
      }
    } catch (err) {
      setProvisionCompMessage({ text: err.message, type: 'error' });
    } finally {
      setProvisionCompLoading(false);
    }
  };

  const handleSuperAdminProvisionUser = async (e) => {
    e.preventDefault();
    const companyIdToUse = provisionUserCompanyId || (allCompanies.length > 0 ? allCompanies[0].id : '');
    
    if (!provisionUserEmail || !provisionUserPassword || !provisionUserName || !provisionUserRole || !companyIdToUse) {
      setProvisionUserMessage({ text: 'Por favor, preencha todos os campos do usuário.', type: 'error' });
      return;
    }

    if (provisionUserPassword.length < 6) {
      setProvisionUserMessage({ text: 'A senha temporária deve ter no mínimo 6 caracteres.', type: 'error' });
      return;
    }

    setProvisionUserLoading(true);
    setProvisionUserMessage({ text: '', type: '' });

    try {
      const response = await fetch('/api/super-admin/provision-user', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: provisionUserEmail,
          password: provisionUserPassword,
          role: provisionUserRole,
          empresa_id: companyIdToUse,
          nome: provisionUserName
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Erro ao provisionar usuário');
      }

      setProvisionUserMessage({
        text: `Usuário "${provisionUserName}" (${provisionUserEmail}) provisionado com sucesso com a role ${provisionUserRole}!`,
        type: 'success'
      });
      
      setProvisionUserEmail('');
      setProvisionUserPassword('');
      setProvisionUserName('');
      setProvisionUserRole('VENDEDOR');
    } catch (err) {
      setProvisionUserMessage({ text: err.message, type: 'error' });
    } finally {
      setProvisionUserLoading(false);
    }
  };

  // --- SUPERADMIN: FATURAS E MENSALIDADES ---
  const openFaturasModal = async (company) => {
    setSelectedFaturasCompany(company);
    setLicencaValor(company.valor_mensalidade || '');
    setLicencaDiaVencimento(company.dia_vencimento || 10);
    setEmpresaTelefone(company.telefone || '');
    setFaturasActiveTab('config');
    setIsFaturasModalOpen(true);
    setCompanyFaturas([]);
    
    try {
      const { data, error } = await supabase
        .from('faturas_saas')
        .select('*')
        .eq('tenant_id', company.id)
        .order('data_vencimento', { ascending: false });
        
      if (error) throw error;
      
      // Auto-generate fatura of current month if none exists
      const today = new Date();
      const vencimentoDia = company.dia_vencimento || 10;
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const yyyy = today.getFullYear();
      const vencimentoStr = `${yyyy}-${mm}-${String(vencimentoDia).padStart(2, '0')}`;
      
      const hasCurrentMonthFatura = data && data.some(f => {
        const parts = f.data_vencimento.split('-');
        return parseInt(parts[0]) === yyyy && parseInt(parts[1]) === today.getMonth() + 1;
      });

      if (!hasCurrentMonthFatura) {
        const { data: newFatura, error: insertErr } = await supabase
          .from('faturas_saas')
          .insert({
            tenant_id: company.id,
            valor_mensalidade: company.valor_mensalidade || 0,
            data_vencimento: vencimentoStr,
            status: 'PENDENTE'
          })
          .select()
          .single();
          
        if (!insertErr && newFatura) {
          setCompanyFaturas(prev => [newFatura, ...(data || [])]);
        } else {
          setCompanyFaturas(data || []);
        }
      } else {
        setCompanyFaturas(data || []);
      }
    } catch (err) {
      console.error('Erro ao carregar faturas:', err);
      showToast('Não foi possível carregar o histórico financeiro.', 'error');
    }
  };

  const handleSalvarConfigLicenca = async () => {
    if (!selectedFaturasCompany) return;
    setLoadingConfigLicenca(true);
    try {
      const val = parseFloat(licencaValor) || 0;
      const dia = parseInt(licencaDiaVencimento) || 10;
      
      const { error } = await supabase
        .from('companies')
        .update({
          valor_mensalidade: val,
          dia_vencimento: dia,
          telefone: empresaTelefone.trim()
        })
        .eq('id', selectedFaturasCompany.id);

      if (error) throw error;
      
      showToast('Configurações da assinatura salvas!', 'success');
      
      const updatedCompany = { 
        ...selectedFaturasCompany, 
        valor_mensalidade: val, 
        dia_vencimento: dia, 
        telefone: empresaTelefone.trim() 
      };
      setSelectedFaturasCompany(updatedCompany);
      
      setAllCompanies(prev => 
        prev.map(c => c.id === selectedFaturasCompany.id ? { ...c, ...updatedCompany } : c)
      );
    } catch (err) {
      console.error('Erro ao salvar config licenca:', err);
      showToast('Erro ao salvar as configurações.', 'error');
    } finally {
      setLoadingConfigLicenca(false);
    }
  };

  const handleCriarNovaFatura = async (e) => {
    e.preventDefault();
    if (!selectedFaturasCompany || !novaFaturaVencimento) {
      showToast('Data de vencimento é obrigatória.', 'error');
      return;
    }
    
    setLoadingNovaFatura(true);
    try {
      const valor = parseFloat(novaFaturaValor) || parseFloat(selectedFaturasCompany.valor_mensalidade) || 0;
      const { data, error } = await supabase
        .from('faturas_saas')
        .insert({
          tenant_id: selectedFaturasCompany.id,
          valor_mensalidade: valor,
          data_vencimento: novaFaturaVencimento,
          status: 'PENDENTE',
          link_pagamento: novaFaturaLink.trim() || null
        })
        .select()
        .single();
        
      if (error) throw error;
      
      showToast('Fatura gerada com sucesso!', 'success');
      setCompanyFaturas(prev => [data, ...prev]);
      
      setNovaFaturaVencimento('');
      setNovaFaturaValor('');
      setNovaFaturaLink('');
    } catch (err) {
      console.error('Erro ao criar fatura:', err);
      showToast('Erro ao gerar a fatura.', 'error');
    } finally {
      setLoadingNovaFatura(false);
    }
  };

  const handleEnviarCobrancaWhatsapp = (fatura) => {
    if (!selectedFaturasCompany) return;
    const rawPhone = selectedFaturasCompany.telefone || '';
    const cleanPhone = rawPhone.replace(/\D/g, '');
    
    if (!cleanPhone) {
      showToast('Por favor, configure o telefone da empresa na Aba 1.', 'error');
      return;
    }
    
    const parts = fatura.data_vencimento.split('-');
    const formattedDate = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : fatura.data_vencimento;
    const formattedValue = parseFloat(fatura.valor_mensalidade).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const link = fatura.link_pagamento || 'Link/PIX não cadastrado';
    
    const msg = `Olá, tudo bem?\n\nAqui é da equipe financeira da *House Software*.\n\nPassando para lembrar que a fatura da sua licença do sistema *Zênite* com vencimento em *${formattedDate}* no valor de *${formattedValue}* já está disponível.\n\nPara efetuar o pagamento, utilize o código/link abaixo:\n\n${link}\n\nAgradecemos a parceria! Se tiver qualquer dúvida, estamos à disposição.`;
    
    const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
    window.open(whatsappUrl, '_blank');
  };

  const baixarMensalidade = async (faturaId) => {
    if (!window.confirm('Confirmar baixa do pagamento desta fatura? O status mudará para PAGO.')) return;
    
    try {
      const { error } = await supabase
        .from('faturas_saas')
        .update({ status: 'PAGO' })
        .eq('id', faturaId);

      if (error) throw error;
      
      setCompanyFaturas(prev => 
        prev.map(f => f.id === faturaId ? { ...f, status: 'PAGO' } : f)
      );
      showToast('Mensalidade baixada com sucesso!', 'success');

      // Automatizar a emissão da NFS-e via Webhook
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        const token = currentSession?.access_token;
        if (token) {
          fetch('/api/webhooks/faturas-saas', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ fatura_id: faturaId })
          }).then(res => res.json())
            .then(data => {
              if (data.success) {
                showToast('NFS-e de mensalidade emitida via webhook com sucesso!', 'success');
                setCompanyFaturas(prev => 
                  prev.map(f => f.id === faturaId ? { ...f, status: 'PAGO', nfse_id: data.nfse_id, nfse_pdf_url: data.nfse_pdf_url } : f)
                );
              } else {
                console.error('Erro no webhook de fatura SaaS:', data.error);
              }
            }).catch(e => console.error('Erro na chamada do webhook de fatura SaaS:', e));
        }
      } catch (webhookErr) {
        console.error('Falha ao acionar webhook:', webhookErr);
      }
    } catch (err) {
      console.error('Erro ao baixar mensalidade:', err);
      showToast('Erro ao confirmar pagamento.', 'error');
    }
  };

  const handleEmitirNfse = async (fatura) => {
    setIsFiscalLoading(true);
    try {
      const result = await emitirNfseStub(selectedFaturasCompany, fatura);
      
      // 1. Mostrar o alerta com o ID da Nota
      alert(`${result.mensagem}\nNFS-e ID: ${result.nfe_id}`);

      // 2. Abrir o PDF dummy funcional em uma nova aba
      const dummyPdfUrl = 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf';
      window.open(dummyPdfUrl, '_blank');

      // 3. Fazer o download local do comprovante formatado como TXT (representando a nota)
      const element = document.createElement("a");
      const file = new Blob([
        `==================================================\n`,
        `          ZÊNITE OS - NOTA FISCAL DE SERVIÇO\n`,
        `==================================================\n`,
        `NFS-e ID: ${result.nfe_id}\n`,
        `Prestador: Vextron Lab - Soluções em Automação\n`,
        `Tomador: ${selectedFaturasCompany.nome}\n`,
        `Vencimento da Fatura: ${fatura.data_vencimento}\n`,
        `Valor Pago: R$ ${parseFloat(fatura.valor_mensalidade || 0).toFixed(2)}\n`,
        `Status: PAGO\n`,
        `Data de Emissão: ${new Date().toLocaleDateString('pt-BR')}\n`,
        `==================================================\n`,
        `Este é um recibo fiscal auxiliar simulado para o Zênite OS.\n`
      ], {type: 'text/plain;charset=utf-8'});
      element.href = URL.createObjectURL(file);
      element.download = `NFS-e_${result.nfe_id}_${selectedFaturasCompany.nome.replace(/\s+/g, '_')}.txt`;
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
      
    } catch (err) {
      console.error('Erro ao emitir NF', err);
      alert('Falha ao comunicar com o serviço fiscal.');
    } finally {
      setIsFiscalLoading(false);
    }
  };

  const fetchFiscalConfig = async (tenantId) => {
    if (!tenantId || tenantId === 'MASTER') return;
    setIsLoadingFiscalConfig(true);
    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      const token = currentSession?.access_token;
      if (!token) return;

      const response = await fetch(`/api/fiscal/configuracoes?tenant_id=${tenantId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (response.ok && data.success && data.config) {
        setFiscalCnpj(data.config.cnpj || '');
        setFiscalInscricaoEstadual(data.config.inscricao_estadual || '');
        setFiscalInscricaoMunicipal(data.config.inscricao_municipal || '');
        setFiscalRegimeTributario(data.config.regime_tributario || 'Simples Nacional');
        setFiscalCertificadoA1Url(data.config.certificado_a1_url || '');
        setFiscalCertificadoSenha(data.config.certificado_senha ? '••••••••' : '');
      } else {
        setFiscalCnpj('');
        setFiscalInscricaoEstadual('');
        setFiscalInscricaoMunicipal('');
        setFiscalRegimeTributario('Simples Nacional');
        setFiscalCertificadoA1Url('');
        setFiscalCertificadoSenha('');
      }
    } catch (err) {
      console.error('Erro ao buscar configurações fiscais:', err);
    } finally {
      setIsLoadingFiscalConfig(false);
    }
  };

  const handleSaveFiscalConfig = async (e) => {
    e.preventDefault();
    if (!company?.id) return;
    setIsSavingFiscalConfig(true);
    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      const token = currentSession?.access_token;
      if (!token) {
        alert('Erro: Sessão não encontrada.');
        return;
      }

      const payload = {
        tenant_id: company.id,
        cnpj: fiscalCnpj,
        inscricao_estadual: fiscalInscricaoEstadual,
        inscricao_municipal: fiscalInscricaoMunicipal,
        regime_tributario: fiscalRegimeTributario,
        certificado_a1_url: fiscalCertificadoA1Url
      };

      if (fiscalCertificadoSenha && fiscalCertificadoSenha !== '••••••••') {
        payload.certificado_senha = fiscalCertificadoSenha;
      }

      const response = await fetch('/api/fiscal/configuracoes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Falha ao salvar configurações fiscais.');
      }

      alert('Configurações fiscais salvas com sucesso!');
    } catch (err) {
      console.error('Erro ao salvar configurações fiscais:', err);
      alert('Erro: ' + err.message);
    } finally {
      setIsSavingFiscalConfig(false);
    }
  };

  const handleUploadCertificado = async (file) => {
    if (!file) return;
    if (!company?.id) {
      alert('Erro: Empresa não identificada.');
      return;
    }

    // Validar extensão
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext !== 'pfx' && ext !== 'p12') {
      alert('Por favor, envie apenas arquivos com extensão .pfx ou .p12');
      return;
    }

    setCertificadoUploadLoading(true);
    try {
      const folder = company.id;
      // Nome do arquivo com caracteres especiais limpos
      const filename = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const filePath = `${folder}/${filename}`;

      // Upload do arquivo para o bucket privado 'fiscal-certificates'
      const { data, error } = await supabase.storage
        .from('fiscal-certificates')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (error) throw error;

      // Armazena o path interno no estado
      setFiscalCertificadoA1Url(filePath);
      alert('Certificado enviado com sucesso!');
    } catch (err) {
      console.error('Erro no upload do certificado:', err);
      alert('Erro ao enviar certificado: ' + err.message);
    } finally {
      setCertificadoUploadLoading(false);
    }
  };

  const handleEmitirNfePdv = async (reciboDados) => {
    if (!hasFeature(company, 'emitir_nfe') && profile?.role !== 'SUPER_ADMIN') {
      alert('Recurso Indisponível: O plano atual da sua empresa (START/PRO) não possui suporte para Emissão de NF-e. Faça um upgrade para o plano ULTIMATE para utilizar esta funcionalidade.');
      return;
    }
    setIsFiscalLoading(true);
    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      const token = currentSession?.access_token;
      if (!token) {
        alert('Erro: Sessão não encontrada. Por favor, faça login novamente.');
        return;
      }

      const response = await fetch('/api/fiscal/emitir-nfe-pdv', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          venda_id: reciboDados.venda_id,
          cliente_cpf_cnpj: reciboDados.cliente_cpf_cnpj,
          cliente_nome: reciboDados.cliente_nome,
          cliente_email: reciboDados.cliente_email
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Falha ao emitir nota fiscal.');
      }

      alert(`NF-e emitida com sucesso!\nChave: ${data.nfe_id}`);
      
      setPdvReciboDados(prev => ({
        ...prev,
        nfe_id: data.nfe_id,
        nfe_pdf_url: data.nfe_pdf_url,
        nfe_status: 'EMITIDA'
      }));

      if (data.nfe_pdf_url) {
        window.open(data.nfe_pdf_url, '_blank');
      }

    } catch (err) {
      console.error('Erro ao emitir NF-e:', err);
      alert('Falha na Emissão: ' + err.message);
    } finally {
      setIsFiscalLoading(false);
    }
  };

  useEffect(() => {
    if (company?.id && company.id !== 'MASTER') {
      fetchFiscalConfig(company.id);
    }
  }, [company?.id]);

  const fetchFiliais = async (empresaId) => {
    try {
      let data = null;
      if (empresaId) {
        const { data: empData } = await supabase
          .from('filiais')
          .select('*')
          .eq('empresa_id', empresaId)
          .order('created_at', { ascending: true });
        data = empData;
      }
      
      // Contingência: carregar todas as filiais caso a busca com filtro não retorne dados
      if (!data || data.length === 0) {
        const { data: allData } = await supabase
          .from('filiais')
          .select('*')
          .order('created_at', { ascending: true });
        data = allData || [];
      }

      setFiliais(data || []);
      if (data && data.length > 0) {
        setFilialVendedor(data[0].id);
        setFilialProduto(data[0].id);
        setFiltroFilialEstoque(data[0].id);
        const estoques = data.filter(f => f.tipo === 'ESTOQUE');
        setEntradaFilial(estoques.length > 0 ? estoques[0].id : '');
      }
      return data || [];
    } catch (err) {
      console.error('Erro ao buscar filiais:', err);
      return [];
    }
  };

  const fetchVendedores = async (empresaId) => {
    try {
      let { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'VENDEDOR');

      if (error || !data || data.length === 0) {
        const retryRes = await supabase.from('profiles').select('*');
        data = (retryRes.data || []).filter(p => (p.role || '').toUpperCase() === 'VENDEDOR');
      }

      setVendedores(data || []);

      // Buscar metas do mês atual
      const dataAtual = new Date();
      const mesRef = `${dataAtual.getFullYear()}-${String(dataAtual.getMonth() + 1).padStart(2, '0')}`;
      const { data: metasData, error: metasError } = await supabase
        .from('metas')
        .select('*')
        .eq('tenant_id', empresaId)
        .eq('mes_referencia', mesRef);
        
      if (!metasError) {
        setMetas(metasData || []);
        // Popular o mapa de tipos para inicializar os dropdowns do gerente
        const tipoMap = {};
        (metasData || []).forEach(m => {
          tipoMap[m.vendedor_id] = m.tipo_meta || 'faturamento';
        });
        setMetaTipoMap(tipoMap);
      }
    } catch (err) {
      console.error('Erro ao buscar vendedores/metas:', err);
    }
  };

  const handleSignOut = async () => {
    localStorage.removeItem('zenite_active_filial_id');
    localStorage.removeItem('zenite_active_filial_nome');
    await supabase.auth.signOut();
  };

  // Cadastro de Filiais (Gerente / Admin)
  const handleAddFilial = async (e) => {
    if (e) e.preventDefault();

    if (!nomeFilial.trim() || !cnpjFilial.trim() || !telefoneFilial.trim() || !enderecoFilial.trim()) {
      showToast('Por favor, preencha todos os campos obrigatórios (Nome, CNPJ, Telefone e Endereço).', 'error');
      return;
    }

    if (!logoFilialFile) {
      showToast('Atenção: O envio da logo da filial é obrigatório.', 'error');
      return;
    }

    setLoadingFilial(true);
    try {
      // 1. Obter e validar o ID da empresa ativa (ou busca no Supabase como fallback)
      let targetEmpresaId = profile?.empresa_id || company?.id || activeEmpresaId;

      let isUUID = typeof targetEmpresaId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetEmpresaId);

      // Se o contexto não tiver um ID de empresa válido, busca no Supabase como fallback
      if (!isUUID) {
        const { data: empData } = await supabase
          .from('companies')
          .select('id')
          .limit(1)
          .maybeSingle();

        if (empData?.id) {
          targetEmpresaId = empData.id;
        } else {
          const { data: empFallback } = await supabase
            .from('empresas')
            .select('id')
            .limit(1)
            .maybeSingle();
          if (empFallback?.id) {
            targetEmpresaId = empFallback.id;
          }
        }
        isUUID = typeof targetEmpresaId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetEmpresaId);
      }

      // Se ainda assim não houver empresa cadastrada no banco, auto-gerar a empresa inicial no Supabase
      if (!isUUID) {
        const defaultCompanyId = '00000000-0000-0000-0000-000000000001';
        const { data: createdCompany } = await supabase.from('companies').upsert({
          id: defaultCompanyId,
          nome: 'Rede Cred',
          nome_fantasia: 'Rede Cred',
          status: 'ATIVO'
        }).select('id').maybeSingle();

        if (createdCompany?.id) {
          targetEmpresaId = createdCompany.id;
        } else {
          targetEmpresaId = defaultCompanyId;
        }
        isUUID = typeof targetEmpresaId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetEmpresaId);
      }

      if (!targetEmpresaId || !isUUID) {
        showToast('Erro: Nenhuma empresa encontrada para vincular a filial.', 'error');
        setLoadingFilial(false);
        return;
      }

      // 2. Upload da Logo se informada
      let logoUrl = null;
      if (logoFilialFile) {
        const fileExt = logoFilialFile.name.split('.').pop();
        const fileName = `${targetEmpresaId}/${Date.now()}.${fileExt}`;
        const { error: uploadErr } = await supabase.storage.from('logos_filiais').upload(fileName, logoFilialFile);
        
        if (uploadErr) {
          console.warn('Aviso ao fazer upload do logo:', uploadErr);
          showToast('Aviso: Houve um erro ao enviar a logo, cadastrando sem a imagem.', 'info');
        } else {
          const { data: pubUrlData } = supabase.storage.from('logos_filiais').getPublicUrl(fileName);
          logoUrl = pubUrlData.publicUrl;
        }
      }

      // 3. Executar o Insert garantindo o ID válido de empresa_id
      const filialPayload = {
        nome: nomeFilial.trim(),
        tipo: tipoFilial || 'LOJA',
        empresa_id: targetEmpresaId,
        cnpj: cnpjFilial.trim(),
        telefone: telefoneFilial.trim(),
        endereco: enderecoFilial.trim(),
        logo_url: logoUrl
      };

      const { data, error } = await supabase
        .from('filiais')
        .insert(filialPayload)
        .select()
        .single();

      if (error) {
        console.error('Erro ao cadastrar filial no Supabase:', error);

        const isFkError = error.code === '23503' || (
          error.message && (
            error.message.includes('filiais_empresa_id_fkey') ||
            error.message.includes('foreign key constraint') ||
            error.message.includes('23503')
          )
        );

        if (isFkError) {
          showToast('Erro: Nenhuma empresa encontrada para vincular a filial.', 'error');
          return;
        }

        const isRlsError = error.code === '42501' || (
          error.message && (
            error.message.includes('row-level security') ||
            error.message.includes('violates row-level security policy')
          )
        );

        if (isRlsError) {
          showToast('Permissão Insuficiente (RLS): Você não tem permissão para cadastrar novas filiais. É necessário ter nível de acesso de Administrador ou Dono da empresa.', 'error');
          return;
        }

        showToast('Erro ao cadastrar filial: ' + (error.message || 'Verifique as informações.'), 'error');
        return;
      }

      if (data) {
        setFiliais(prev => [...prev, data]);
      }
      setNomeFilial('');
      setCnpjFilial('');
      setTelefoneFilial('');
      setEnderecoFilial('');
      setLogoFilialFile(null);
      showToast('Filial cadastrada com sucesso!', 'success');

    } catch (err) {
      console.error('Erro inesperado ao adicionar filial:', err);
      showToast('Erro ao processar cadastro da filial: ' + (err.message || ''), 'error');
    } finally {
      setLoadingFilial(false);
    }
  };

  const handleDeleteFilial = async (filialId) => {
    if (!window.confirm("ATENÇÃO! Excluir esta filial removerá ela do sistema. Tem certeza absoluta que deseja excluir?")) return;
    try {
      const { error } = await supabase.from('filiais').delete().eq('id', filialId);
      if (error) throw error;
      setFiliais(prev => prev.filter(f => f.id !== filialId));
      alert("Filial excluída com sucesso.");
    } catch (err) {
      alert("Erro ao excluir filial: " + err.message);
    }
  };

  const handleEstornarVenda = async (vendaId) => {
    if (!window.confirm("ATENÇÃO! Tem certeza que deseja estornar (apagar) esta venda do histórico financeiro?")) return;
    try {
      const { error } = await supabase.from('vendas').delete().eq('id', vendaId);
      if (error) throw error;
      setVendas(prev => prev.filter(v => v.id !== vendaId));
      alert("Venda estornada com sucesso.");
    } catch (err) {
      alert("Erro ao estornar venda: " + err.message);
    }
  };

  // Cadastro de Vendedores (Gerente / RH)
  const handleAddVendedor = async (e) => {
    if (e) e.preventDefault();
    const currentEmpresaId = profile?.empresa_id || company?.id || activeEmpresaId;

    if (!currentEmpresaId) {
      showToast('Acesso Restrito: O seu utilizador de RH não está vinculado a nenhuma empresa.', 'error');
      return;
    }

    if (!nomeVendedor.trim() || !emailVendedor.trim() || !senhaVendedor.trim() || !filialVendedor) {
      showToast('Por favor, preencha todos os campos do vendedor.', 'error');
      return;
    }

    setLoadingVendedor(true);
    try {
      // 1. Criar o usuário no Supabase Auth usando o cliente de registro público (sem persistir sessão)
      const { data: authData, error: authError } = await supabaseRegister.auth.signUp({
        email: emailVendedor.trim(),
        password: senhaVendedor.trim(),
        options: {
          data: {
            nome_completo: nomeVendedor.trim(),
            role: 'VENDEDOR',
            empresa_id: currentEmpresaId,
            filial_id: filialVendedor
          }
        }
      });

      if (authError) {
        if (authError.message?.toLowerCase().includes('already registered')) {
          const { data: existingProfile } = await supabase
            .from('profiles')
            .select('*')
            .ilike('email', emailVendedor.trim())
            .maybeSingle();

          if (existingProfile) {
            await supabase
              .from('profiles')
              .update({
                empresa_id: currentEmpresaId,
                filial_id: filialVendedor,
                nome: nomeVendedor.trim(),
                role: 'VENDEDOR'
              })
              .eq('id', existingProfile.id);

            showToast(`O e-mail (${emailVendedor.trim()}) já possuía cadastro e foi vinculado com sucesso a esta filial!`, 'info');
          } else {
            showToast(`Aviso: O e-mail (${emailVendedor.trim()}) já possui cadastro no Auth.`, 'info');
          }
        } else {
          showToast(`Erro ao criar vendedor: ${authError.message}`, 'error');
          return;
        }
      } else if (authData?.user?.id) {
        await new Promise(resolve => setTimeout(resolve, 500));
        await supabase
          .from('profiles')
          .upsert({
            id: authData.user.id,
            empresa_id: currentEmpresaId,
            filial_id: filialVendedor,
            nome: nomeVendedor.trim(),
            email: emailVendedor.trim(),
            role: 'VENDEDOR'
          });
      }

      showToast(`Funcionário / Vendedor "${nomeVendedor.trim()}" cadastrado com sucesso!`, 'success');

      setNomeVendedor('');
      setEmailVendedor('');
      setSenhaVendedor('');
      fetchTeamMembers(company.id);
    } catch (err) {
      console.error('Erro ao cadastrar vendedor:', err);
      alert('Erro ao cadastrar vendedor: ' + err.message);
    } finally {
      setLoadingVendedor(false);
    }
  };

  // Alternar Status de Trainee de um Vendedor (Gerente)
  const handleUpdateMeta = async (vendedorId, rawMeta, tipoMeta = 'faturamento') => {
    try {
      const sanitized = String(rawMeta).replace(/[^\d.,]/g, '').replace(',', '.');
      const novaMeta = parseFloat(sanitized);
      
      if (isNaN(novaMeta)) {
        alert('Por favor, digite um valor numérico válido.');
        return;
      }
      const dataAtual = new Date();
      const mesRef = `${dataAtual.getFullYear()}-${String(dataAtual.getMonth() + 1).padStart(2, '0')}`;

      // Upsert logic (checking if exists first since Supabase UPSERT might require unique constraints we want to handle safely here)
      const { data: existing } = await supabase
        .from('metas')
        .select('id')
        .eq('vendedor_id', vendedorId)
        .eq('mes_referencia', mesRef)
        .single();

      if (existing) {
        const { error } = await supabase
          .from('metas')
          .update({ valor_meta: novaMeta, tipo_meta: tipoMeta })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('metas')
          .insert({
            vendedor_id: vendedorId,
            tenant_id: company.id,
            valor_meta: novaMeta,
            tipo_meta: tipoMeta,
            mes_referencia: mesRef
          });
        if (error) throw error;
      }
      
      // Update local state (valor + tipo)
      setMetas(prev => {
        const idx = prev.findIndex(m => m.vendedor_id === vendedorId && m.mes_referencia === mesRef);
        if (idx >= 0) {
          const arr = [...prev];
          arr[idx] = { ...arr[idx], valor_meta: novaMeta, tipo_meta: tipoMeta };
          return arr;
        }
        return [...prev, { vendedor_id: vendedorId, mes_referencia: mesRef, valor_meta: novaMeta, tipo_meta: tipoMeta }];
      });
      setMetaTipoMap(prev => ({ ...prev, [vendedorId]: tipoMeta }));
      alert('Meta atualizada com sucesso!');
    } catch (err) {
      console.error('Erro ao atualizar meta (detalhado):', err);
      alert(`Falha ao atualizar meta. Motivo: ${err.message || JSON.stringify(err)}`);
    }
  };

  const handleDeleteVendedor = async (vendedorId, vendedorNome) => {
    if (!window.confirm(`Tem certeza que deseja EXCLUIR DEFINITIVAMENTE o vendedor "${vendedorNome}"? Isso apagará o acesso dele ao sistema.`)) {
      return;
    }
    
    setLoadingVendedor(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', vendedorId);

      if (error) throw error;

      setVendedores(prev => prev.filter(v => v.id !== vendedorId));
      alert('Vendedor removido com sucesso!');
    } catch (err) {
      console.error('Erro ao excluir vendedor:', err);
      alert('Falha ao excluir vendedor.');
    } finally {
      setLoadingVendedor(false);
    }
  };

  const handleUpdateProdutoPreco = async (produtoId, nome, precoAtual) => {
    const novoPrecoStr = window.prompt(`Novo preço para ${nome}:`, precoAtual);
    if (novoPrecoStr === null) return; // User cancelled
    
    const sanitized = String(novoPrecoStr).replace(/[^\d.,]/g, '').replace(',', '.');
    const novoPreco = parseFloat(sanitized);
    
    if (isNaN(novoPreco)) {
      showToast('Por favor, digite um preço numérico válido.', 'error');
      return;
    }
    
    try {
      const { error } = await supabase
        .from('produtos')
        .update({ preco: novoPreco })
        .eq('id', produtoId);
        
      if (error) throw error;
      
      showToast('Preço atualizado com sucesso!', 'success');
      setProdutosFilial(prev => prev.map(p => p.id === produtoId ? { ...p, preco: novoPreco } : p));
    } catch (err) {
      console.error('Erro ao atualizar preço:', err);
      showToast('Falha ao atualizar preço. Verifique se você tem permissão (RLS).', 'error');
    }
  };

  const toggleVendedorTrainee = async (vendedorId, currentIsTreinner) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_treinner: !currentIsTreinner })
        .eq('id', vendedorId);

      if (error) throw error;
      
      setVendedores(prev => 
        prev.map(v => v.id === vendedorId ? { ...v, is_treinner: !currentIsTreinner } : v)
      );
      alert('Perfil do vendedor atualizado com sucesso!');
    } catch (err) {
      console.error('Erro ao alternar trainee:', err);
      alert('Erro ao atualizar perfil do vendedor: ' + err.message);
    }
  };

  // Abrir Modal de Ajuste de Fechamento de Caixa
  const handleAbrirAjusteCaixa = (fech) => {
    setAjusteCaixaSelecionado(fech);
    setAjusteValorDinheiro(fech.valor_dinheiro || 0);
    setAjusteValorCartao(fech.valor_cartao || 0);
    setAjusteValorPix(fech.valor_pix || 0);
    setAjusteMotivo('');
    setModalAjusteCaixaOpen(true);
  };

  // Salvar Correções de Caixa (Audit Trail)
  const handleSalvarAjusteCaixa = async () => {
    if (!ajusteCaixaSelecionado) return;
    if (!ajusteMotivo.trim()) {
      showToast('O motivo da correção é obrigatório.', 'error');
      return;
    }

    setLoadingAjusteCaixa(true);
    try {
      const valoresOriginais = {
        valor_dinheiro: ajusteCaixaSelecionado.valores_originais?.valor_dinheiro !== undefined 
          ? ajusteCaixaSelecionado.valores_originais.valor_dinheiro 
          : ajusteCaixaSelecionado.valor_dinheiro,
        valor_cartao: ajusteCaixaSelecionado.valores_originais?.valor_cartao !== undefined 
          ? ajusteCaixaSelecionado.valores_originais.valor_cartao 
          : ajusteCaixaSelecionado.valor_cartao,
        valor_pix: ajusteCaixaSelecionado.valores_originais?.valor_pix !== undefined 
          ? ajusteCaixaSelecionado.valores_originais.valor_pix 
          : ajusteCaixaSelecionado.valor_pix
      };

      const payload = {
        valor_dinheiro: parseFloat(ajusteValorDinheiro) || 0,
        valor_cartao: parseFloat(ajusteValorCartao) || 0,
        valor_pix: parseFloat(ajusteValorPix) || 0,
        motivo_alteracao: ajusteMotivo.trim(),
        alterado_por: session?.user?.id || profile?.id,
        data_alteracao: new Date().toISOString()
      };

      // Se for a primeira alteração, salvamos os valores originais.
      // Caso já tenha sido alterado antes, mantemos os valores_originais originais para integridade histórica.
      if (!ajusteCaixaSelecionado.alterado_por) {
        payload.valores_originais = valoresOriginais;
      }

      const { error } = await supabase
        .from('fechamentos')
        .update(payload)
        .eq('id', ajusteCaixaSelecionado.id);

      if (error) throw error;

      showToast('Fechamento de caixa corrigido com sucesso!', 'success');
      setModalAjusteCaixaOpen(false);
      
      // Recarregar os fechamentos para atualizar a UI
      const { data: newFechamentos, error: fetchErr } = await supabase
        .from('fechamentos')
        .select('*, profiles!vendedor_id(*), filiais(*)')
        .eq('empresa_id', profile.empresa_id)
        .order('created_at', { ascending: false });
        
      if (!fetchErr && newFechamentos) {
        setFechamentos(newFechamentos);
      }
    } catch (err) {
      console.error('Erro ao corrigir fechamento:', err);
      showToast('Erro ao salvar as alterações do fechamento.', 'error');
    } finally {
      setLoadingAjusteCaixa(false);
    }
  };

  // --- MOTOR DE NEGÓCIO E ESTOQUE ---

  // Validador de IMEI com Algoritmo de Luhn
  const validateLuhn = (imei) => {
    if (!/^\d{15}$/.test(imei)) return false;
    let sum = 0;
    for (let i = 0; i < 15; i++) {
      let digit = parseInt(imei.charAt(i), 10);
      if (i % 2 === 1) {
        digit *= 2;
        if (digit > 9) digit -= 9;
      }
      sum += digit;
    }
    return sum % 10 === 0;
  };

  // --- FUNÇÕES POKA-YOKE: ENTRADA DE ESTOQUE AVANÇADA ---

  // Buscar catálogo de produtos (Produtos_Catalogo)
  const fetchCatalogoProdutos = async (empresaId) => {
    setLoadingCatalogo(true);
    try {
      const { data, error } = await supabase
        .from('produtos_catalogo')
        .select('*')
        .eq('empresa_id', empresaId)
        .order('nome', { ascending: true });
      if (error) throw error;

      // Fetch aggregated stock for health indicator
      const { data: imeisData } = await supabase
        .from('imeis')
        .select('status, vendido, produtos!inner(nome)')
        .eq('empresa_id', empresaId)
        .eq('vendido', false);

      const counts = {};
      if (imeisData) {
        imeisData.forEach(i => {
          if (i.status !== 'VENDIDO' && i.status !== 'EM_TRANSITO') {
            const nome = i.produtos?.nome;
            if (nome) counts[nome] = (counts[nome] || 0) + 1;
          }
        });
      }

      const enrichedData = (data || []).map(p => ({
        ...p,
        estoque_atual: counts[p.nome] || 0
      }));

      setCatalogoProdutos(enrichedData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingCatalogo(false);
    }
  };

  const handleStartEditCatalogo = (p) => {
    setEditingCatalogoProduto(p);
    setNomeProduto(p.nome || '');
    setTipoProduto(p.tipo || 'CELULAR');
    setCategoriaProduto(p.categoria || '');
    setPrecoProduto(p.preco ? String(p.preco) : '');
    setPrecoCustoProduto(p.preco_custo ? String(p.preco_custo) : '');
    setSkuProduto(p.sku || '');
    setCondicaoProduto(p.condicao || 'NOVO');
    setEstoqueMinimoProduto(p.estoque_minimo ? String(p.estoque_minimo) : '');
    setCorCatalogoProduto(p.cor || '');
    setNcmProduto(p.ncm || '');
    setCestProduto(p.cest || '');
    setCfopProduto(p.cfop || '5102');
    setOrigemProduto(p.origem || '0');
    setTimeout(() => {
      document.getElementById('catalogo-nome')?.focus();
    }, 50);
  };

  const handleSaveCatalogoProduto = async (e) => {
    e.preventDefault();
    if (!nomeProduto || !precoProduto) {
      alert('Preencha nome e preço do produto.');
      return;
    }

    if (ncmProduto && ncmProduto.replace(/\D/g, '').length !== 8) {
      alert('O NCM deve conter exatamente 8 dígitos numéricos.');
      return;
    }

    const isEditing = !!editingCatalogoProduto;
    let parsedImeis = [];
    const initialQty = parseInt(catalogoEstoqueInicial, 10) || 0;

    if (!isEditing) {
      if (!catalogoFilialEstoque) {
        alert('Por favor, selecione a Filial de Destino do Estoque Inicial.');
        return;
      }
      if (initialQty < 1) {
        alert('A quantidade inicial de estoque deve ser de no mínimo 1.');
        return;
      }
      if (tipoProduto === 'CELULAR') {
        parsedImeis = catalogoImeisIniciais
          .split('\n')
          .map(line => line.trim())
          .filter(Boolean);

        if (parsedImeis.length !== initialQty) {
          alert(`Você informou a quantidade inicial de ${initialQty}, mas forneceu ${parsedImeis.length} IMEI(s). O número de IMEIs deve coincidir com a quantidade.`);
          return;
        }

        // Validar digitos e Luhn
        for (const imei of parsedImeis) {
          if (!/^\d{15}$/.test(imei)) {
            alert(`O IMEI '${imei}' é inválido. Deve possuir exatamente 15 dígitos numéricos.`);
            return;
          }
          if (!validateLuhn(imei)) {
            alert(`O IMEI '${imei}' não passou na validação Luhn.`);
            return;
          }
        }

        // Verificar duplicidades no banco de dados de uma vez
        const { data: existingImeis, error: existErr } = await supabase
          .from('imeis')
          .select('imei')
          .in('imei', parsedImeis);

        if (existErr) throw existErr;

        if (existingImeis && existingImeis.length > 0) {
          const dupList = existingImeis.map(i => i.imei).join(', ');
          alert(`Erro: O(s) seguinte(s) IMEI(s) já está(ão) cadastrado(s) no sistema: ${dupList}`);
          return;
        }
      }
    }

    try {
      let targetEmpresaId = profile?.empresa_id || company?.id || activeEmpresaId;

      if (!targetEmpresaId || targetEmpresaId === 'MASTER' || targetEmpresaId === '00000000-0000-0000-0000-000000000001') {
        const { data: empList } = await supabase.from('empresas').select('id').limit(1);
        if (empList && empList.length > 0) {
          targetEmpresaId = empList[0].id;
        }
      }

      if (!targetEmpresaId) {
        alert('Erro: ID da empresa não encontrado na sessão. Faça login novamente.');
        return;
      }

      const payload = {
        empresa_id: targetEmpresaId,
        nome: nomeProduto,
        tipo: tipoProduto,
        categoria: categoriaProduto,
        preco: parseFloat(precoProduto),
        sku: skuProduto || null,
        condicao: condicaoProduto,
        estoque_minimo: estoqueMinimoProduto ? parseInt(estoqueMinimoProduto) : null,
        cor: tipoProduto === 'CELULAR' ? (corCatalogoProduto.trim() || null) : null,
        ncm: ncmProduto || null,
        cest: cestProduto || null,
        cfop: cfopProduto || null,
        origem: origemProduto || '0'
      };

      if (profile?.role === 'SUPER_ADMIN' || profile?.role === 'OWNER') {
        payload.preco_custo = parseFloat(precoCustoProduto || 0);
      }

      if (editingCatalogoProduto) {
        const { error } = await supabase
          .from('produtos_catalogo')
          .update(payload)
          .eq('id', editingCatalogoProduto.id);

        if (error) throw error;

        alert('Produto atualizado com sucesso!');

        setCatalogoProdutos(prev =>
          prev.map(item =>
            item.id === editingCatalogoProduto.id
              ? { ...item, ...payload, id: item.id }
              : item
          )
        );

        setEditingCatalogoProduto(null);
      } else {
        if (!(profile?.role === 'SUPER_ADMIN' || profile?.role === 'OWNER')) {
          payload.preco_custo = 0;
        } else {
          payload.preco_custo = parseFloat(precoCustoProduto || 0);
        }

        console.log('=== DEBUG CATALOGO INSERT ===');
        console.log('profile.role:', profile?.role);
        console.log('targetEmpresaId:', targetEmpresaId);
        console.log('payload:', JSON.stringify(payload, null, 2));

        let data = null;
        const { data: insertedData, error } = await supabase
          .from('produtos_catalogo')
          .insert(payload)
          .select()
          .single();

        if (error) {
          if (error.code === '23505' || error.message?.includes('duplicate key')) {
            // Produto já existe no catálogo, buscar o existente e continuar
            const { data: existing } = await supabase
              .from('produtos_catalogo')
              .select('*')
              .eq('empresa_id', targetEmpresaId)
              .eq('nome', nomeProduto)
              .single();
            data = existing;
          } else if (error.code === 'PGRST204' || error.message?.includes('could not find the column') || error.message?.includes('does not exist')) {
            alert('Aviso: As colunas sku, condicao, estoque_minimo, cor, ncm, cest, cfop ou origem não existem no banco. Por favor, execute a migração SQL informada.');
          } else {
            throw error;
          }
        } else {
          data = insertedData;
        }

        if (data) {
            // 1. Inserir na tabela public.produtos
            const { data: newProd, error: newProdErr } = await supabase
              .from('produtos')
              .insert({
                empresa_id: targetEmpresaId,
                filial_id: catalogoFilialEstoque,
                nome: data.nome,
                tipo: data.tipo,
                categoria: data.categoria,
                preco: data.preco,
                preco_custo: data.preco_custo || 0,
                quantidade: initialQty
              })
              .select()
              .single();

            if (newProdErr) throw newProdErr;

            // 2. Se for Celular, cadastrar os IMEIs
            if (data.tipo === 'CELULAR' && parsedImeis.length > 0) {
              const imeiRows = parsedImeis.map(imei => ({
                produto_id: newProd.id,
                empresa_id: targetEmpresaId,
                filial_id: catalogoFilialEstoque,
                imei: imei,
                cor: (data.cor || 'Preto').trim(),
                status: 'DISPONÍVEL',
                vendido: false
              }));

              const { error: imeiInsertErr } = await supabase
                .from('imeis')
                .insert(imeiRows);

              if (imeiInsertErr) throw imeiInsertErr;
            }

            // 3. Registrar no histórico de movimentações de estoque
            try {
              if (data.tipo === 'CELULAR') {
                const movRows = parsedImeis.map(imei => ({
                  empresa_id: targetEmpresaId,
                  produto_id: newProd.id,
                  imei: imei,
                  tipo_movimentacao: 'ENTRADA_AQUISICAO',
                  filial_destino_id: catalogoFilialEstoque,
                  quantidade: 1,
                  observacao: 'Cadastro inicial obrigatório de produto no catálogo.',
                  criado_por: profile.id
                }));
                await supabase.from('estoque_movimentacoes').insert(movRows);
              } else {
                await supabase.from('estoque_movimentacoes').insert({
                  empresa_id: targetEmpresaId,
                  produto_id: newProd.id,
                  tipo_movimentacao: 'ENTRADA_AQUISICAO',
                  filial_destino_id: catalogoFilialEstoque,
                  quantidade: initialQty,
                  observacao: 'Cadastro inicial obrigatório de produto no catálogo.',
                  criado_por: profile.id
                });
              }
            } catch (movErr) {
              console.error('Erro ao salvar logs de movimentação de estoque inicial:', movErr);
            }

            alert('Produto adicionado ao catálogo e estoque inicial registrado!');
            setCatalogoProdutos(prev => [...prev, data].sort((a, b) => a.nome.localeCompare(b.nome)));
          } else {
            alert('Produto adicionado ao catálogo!');
            fetchCatalogoProdutos(company.id);
          }
          setCatalogoFilialEstoque('');
          setCatalogoEstoqueInicial('1');
          setCatalogoImeisIniciais('');
        }

      setNomeProduto('');
      setPrecoProduto('');
      setPrecoCustoProduto('');
      setSkuProduto('');
      setCondicaoProduto('NOVO');
      setEstoqueMinimoProduto('');
      setCorCatalogoProduto('');
      setNcmProduto('');
      setCestProduto('');
      setCfopProduto('5102');
      setOrigemProduto('0');
    } catch (err) {
      alert('Erro ao salvar no catálogo: ' + err.message);
    }
  };

  // Buscar categorias da empresa e preencher com o padrão se vazio
  const fetchCategorias = async (empresaId) => {
    if (!empresaId) return;
    setLoadingCategorias(true);
    try {
      const { data, error } = await supabase
        .from('categorias')
        .select('*')
        .eq('empresa_id', empresaId)
        .order('nome', { ascending: true });

      if (error) throw error;

      // Se não houver nenhuma categoria, criar as padrão
      if (!data || data.length === 0) {
        const defaultCategories = [
          'Tablets', 'Celulares', 'Acessórios', 'Capas', 
          'Películas', 'Carregadores', 'Cabos', 'Caixas de Som', 'Vídeo Games'
        ];
        
        const insertPayload = defaultCategories.map(nome => ({
          empresa_id: empresaId,
          nome: nome
        }));

        const { data: insertedData, error: insertError } = await supabase
          .from('categorias')
          .insert(insertPayload)
          .select();

        if (insertError) throw insertError;
        setCategorias(insertedData || []);
      } else {
        setCategorias(data || []);
      }
    } catch (err) {
      console.error('Erro ao buscar categorias:', err);
    } finally {
      setLoadingCategorias(false);
    }
  };

  // Cadastrar nova categoria dinamicamente
  const handleCreateCategoria = async (e) => {
    if (e) e.preventDefault();
    const nome = novaCategoriaNome.trim();
    if (!nome) {
      alert('Por favor, informe o nome da categoria.');
      return;
    }
    
    if (categorias.some(c => c.nome.toLowerCase() === nome.toLowerCase())) {
      alert('Esta categoria já existe.');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('categorias')
        .insert({
          empresa_id: company.id,
          nome: nome
        })
        .select()
        .single();

      if (error) throw error;
      
      alert('Categoria adicionada com sucesso!');
      setCategorias(prev => [...prev, data].sort((a, b) => a.nome.localeCompare(b.nome)));
      setNovaCategoriaNome('');
    } catch (err) {
      console.error(err);
      alert('Erro ao adicionar categoria: ' + err.message);
    }
  };

  // Excluir categoria
  const handleDeleteCategoria = async (id, nome) => {
    if (!confirm(`Deseja realmente excluir a categoria "${nome}"?`)) return;

    try {
      const { error } = await supabase
        .from('categorias')
        .delete()
        .eq('id', id);

      if (error) throw error;

      alert('Categoria excluída com sucesso!');
      setCategorias(prev => prev.filter(c => c.id !== id));
    } catch (err) {
      console.error(err);
      alert('Erro ao excluir categoria: ' + err.message);
    }
  };

  // Visualizador de Disponibilidade Multiloja
  const handleVerMultiloja = async (produto) => {
    setSelectedMultilojaProd(produto);
    setLoadingMultilojaStock(true);
    setMultilojaStockData([]);
    try {
      // Buscar todos os registros do produto com o mesmo nome na empresa
      const { data: prods, error: prodsErr } = await supabase
        .from('produtos')
        .select('id, nome, quantidade, tipo, categoria, filial_id')
        .eq('empresa_id', company.id)
        .eq('nome', produto.nome);

      if (prodsErr) throw prodsErr;

      const prodIds = (prods || []).map(p => p.id);
      let imeis = [];

      if (prodIds.length > 0) {
        const { data: imeisData, error: imeisErr } = await supabase
          .from('imeis')
          .select('produto_id, status, vendido')
          .in('produto_id', prodIds)
          .eq('vendido', false);

        if (imeisErr) throw imeisErr;
        imeis = imeisData || [];
      }

      // Mapear filiais para compor o estoque de cada uma
      const stockList = filiais.map(fil => {
        const matchedProd = (prods || []).find(p => p.filial_id === fil.id);
        let finalQty = matchedProd ? matchedProd.quantidade : 0;
        
        if (matchedProd && matchedProd.tipo === 'CELULAR') {
          finalQty = imeis.filter(
            im => im.produto_id === matchedProd.id && (im.status === 'Disponível' || im.status === 'DISPONÍVEL')
          ).length;
        }

        return {
          filialNome: fil.nome,
          filialTipo: fil.tipo,
          quantidade: finalQty,
          tipo: matchedProd ? matchedProd.tipo : (produto.tipo || 'OUTRO')
        };
      });

      setMultilojaStockData(stockList);
    } catch (err) {
      console.error('Erro ao buscar estoque multiloja:', err);
      alert('Erro ao buscar estoque multiloja: ' + err.message);
    } finally {
      setLoadingMultilojaStock(false);
    }
  };

  // Buscar clientes do banco, respeitando as regras RBAC (vendedor só vê os próprios)
  const fetchClientes = async (empresaId) => {
    if (!empresaId) return;
    setLoadingClientes(true);
    try {
      let query = supabase
        .from('clientes')
        .select('*')
        .eq('empresa_id', empresaId);
        
      if (profile?.role === 'VENDEDOR') {
        query = query.eq('vendedor_id', session.user.id);
      }

      const { data, error } = await query.order('nome', { ascending: true });
      if (error) throw error;
      setClientes(data || []);
    } catch (err) {
      console.error('Erro ao buscar clientes:', err);
    } finally {
      setLoadingClientes(false);
    }
  };

  // Salvar/Editar cliente respeitando a propriedade (vendedor só altera os próprios)
  const handleSaveCliente = async (e) => {
    if (e) e.preventDefault();
    const nome = clienteNome.trim();
    if (!nome) {
      alert('Por favor, informe o nome do cliente.');
      return;
    }

    // Converter DD/MM/AAAA para AAAA-MM-DD
    let dbDataNascimento = null;
    if (clienteDataNascimento && clienteDataNascimento.length === 10) {
      const parts = clienteDataNascimento.split('/');
      if (parts.length === 3) {
        dbDataNascimento = `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
    }

    // Validar data futura
    if (dbDataNascimento) {
      const birthDate = new Date(dbDataNascimento + 'T00:00:00');
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (birthDate > today) {
        alert('A data de nascimento não pode ser uma data futura.');
        return;
      }
    }

    try {
      const payload = {
        empresa_id: company?.id || profile?.empresa_id,
        vendedor_id: profile?.role === 'VENDEDOR' ? session.user.id : (editingCliente ? editingCliente.vendedor_id : session.user.id),
        nome: nome,
        cpf_cnpj: clienteCpfCnpj.trim() || null,
        email: clienteEmail.trim() || null,
        telefone: clienteTelefone.trim() || null,
        data_nascimento: dbDataNascimento,
        cep: clienteCep.trim() || null,
        logradouro: clienteLogradouro.trim() || null,
        numero: clienteNumero.trim() || null,
        bairro: clienteBairro.trim() || null,
        cidade: clienteCidade.trim() || null,
        uf: clienteUf.trim() || null,
        complemento: clienteComplemento.trim() || null
      };

      if (editingCliente) {
        const { error } = await supabase
          .from('clientes')
          .update(payload)
          .eq('id', editingCliente.id);

        if (error) throw error;
        alert('Cliente atualizado com sucesso!');
        // Atualiza os dados no PDV se for o cliente atualmente selecionado
        if (selectedPdvClienteId === editingCliente.id || pdvClienteNome === editingCliente.nome) {
          setPdvClienteNome(payload.nome);
          setPdvClienteSearchInput(payload.nome);
          setPdvClienteCpfCnpj(payload.cpf_cnpj || '');
          setPdvClienteEmail(payload.email || '');
          setPdvClienteTelefone(payload.telefone || '');
        }
      } else {
        const { data: insertedClients, error } = await supabase
          .from('clientes')
          .insert(payload)
          .select();

        if (error) throw error;
        alert('Cliente cadastrado com sucesso!');
        // Seleciona automaticamente o cliente recém-criado no PDV
        if (insertedClients && insertedClients.length > 0) {
          const newClient = insertedClients[0];
          setSelectedPdvClienteId(newClient.id);
          setPdvClienteNome(newClient.nome);
          setPdvClienteSearchInput(newClient.nome);
          setPdvClienteCpfCnpj(newClient.cpf_cnpj || '');
          setPdvClienteEmail(newClient.email || '');
          setPdvClienteTelefone(newClient.telefone || '');
          setIsPdvClienteFieldsEditable(false);
        }
      }

      setClienteNome('');
      setClienteCpfCnpj('');
      setClienteEmail('');
      setClienteTelefone('');
      setClienteDataNascimento('');
      setClienteCep('');
      setClienteLogradouro('');
      setClienteNumero('');
      setClienteBairro('');
      setClienteCidade('');
      setClienteUf('');
      setClienteComplemento('');
      setEditingCliente(null);
      setIsClienteModalOpen(false);
      fetchClientes(company?.id || profile?.empresa_id);
    } catch (err) {
      console.error(err);
      alert('Erro ao salvar cliente: ' + err.message);
    }
  };

  // Auxiliares para abrir modal de Novo Cliente e Edição
  const handleOpenNewClienteModal = (initialName = '') => {
    setEditingCliente(null);
    setClienteNome(typeof initialName === 'string' ? initialName : '');
    setClienteCpfCnpj('');
    setClienteEmail('');
    setClienteTelefone('');
    setClienteDataNascimento('');
    setClienteCep('');
    setClienteLogradouro('');
    setClienteNumero('');
    setClienteBairro('');
    setClienteCidade('');
    setClienteUf('');
    setClienteComplemento('');
    setCepLookupFailed(false);
    setIsClienteModalOpen(true);
  };

  const handleOpenEditClienteModal = (c) => {
    // Formatar data de nascimento de AAAA-MM-DD para DD/MM/AAAA
    let birthDateFormatted = '';
    if (c.data_nascimento) {
      const parts = c.data_nascimento.split('-');
      if (parts.length === 3) {
        birthDateFormatted = `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
    }

    setEditingCliente(c);
    setClienteNome(c.nome || '');
    setClienteCpfCnpj(c.cpf_cnpj || '');
    setClienteEmail(c.email || '');
    setClienteTelefone(c.telefone || '');
    setClienteDataNascimento(birthDateFormatted);
    setClienteCep(c.cep || '');
    setClienteLogradouro(c.logradouro || '');
    setClienteNumero(c.numero || '');
    setClienteBairro(c.bairro || '');
    setClienteCidade(c.cidade || '');
    setClienteUf(c.uf || '');
    setClienteComplemento(c.complemento || '');
    setCepLookupFailed(false);
    setIsClienteModalOpen(true);
  };

  const handleCepChange = async (val) => {
    const cleanCep = val.replace(/\D/g, '');
    let formatted = cleanCep;
    if (cleanCep.length > 5) {
      formatted = cleanCep.substring(0, 5) + '-' + cleanCep.substring(5, 8);
    }
    setClienteCep(formatted);

    if (cleanCep.length === 8) {
      setCepLookupLoading(true);
      setCepLookupFailed(false);
      try {
        const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
        const data = await res.json();
        if (data.erro) {
          setCepLookupFailed(true);
        } else {
          setClienteLogradouro(data.logradouro || '');
          setClienteBairro(data.bairro || '');
          setClienteCidade(data.localidade || '');
          setClienteUf(data.uf || '');
          setCepLookupFailed(false);
          setTimeout(() => {
            clienteNumeroInputRef.current?.focus();
          }, 50);
        }
      } catch (err) {
        console.error('Erro ao buscar CEP:', err);
        setCepLookupFailed(true);
      } finally {
        setCepLookupLoading(false);
      }
    }
  };

  const handleDataNascimentoChange = (val) => {
    const clean = val.replace(/\D/g, '');
    let formatted = '';
    if (clean.length > 0) {
      formatted += clean.substring(0, 2);
    }
    if (clean.length > 2) {
      formatted += '/' + clean.substring(2, 4);
    }
    if (clean.length > 4) {
      formatted += '/' + clean.substring(4, 8);
    }
    setClienteDataNascimento(formatted);
  };

  const isMenorDeIdade = React.useMemo(() => {
    if (!clienteDataNascimento || clienteDataNascimento.length !== 10) return false;
    const parts = clienteDataNascimento.split('/');
    if (parts.length !== 3) return false;
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const year = parseInt(parts[2], 10);
    const birthDate = new Date(year, month, day);
    if (isNaN(birthDate.getTime())) return false;
    
    const today = new Date();
    if (birthDate > today) return false;
    
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age < 18;
  }, [clienteDataNascimento]);

  const isDataFutura = React.useMemo(() => {
    if (!clienteDataNascimento || clienteDataNascimento.length !== 10) return false;
    const parts = clienteDataNascimento.split('/');
    if (parts.length !== 3) return false;
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const year = parseInt(parts[2], 10);
    const birthDate = new Date(year, month, day);
    if (isNaN(birthDate.getTime())) return false;
    
    const today = new Date();
    return birthDate > today;
  }, [clienteDataNascimento]);

  // Excluir cliente
  const handleDeleteCliente = async (id, nome) => {
    if (!confirm(`Deseja realmente excluir o cliente "${nome}"?`)) return;
    try {
      const { error } = await supabase
        .from('clientes')
        .delete()
        .eq('id', id);

      if (error) throw error;
      alert('Cliente excluído com sucesso!');
      fetchClientes(company?.id || profile?.empresa_id);
    } catch (err) {
      console.error(err);
      alert('Erro ao excluir cliente: ' + err.message);
    }
  };

  // Prepara modal de edição de venda corrigida
  const handleOpenEditVenda = (venda) => {
    setEditingVenda(venda);
    setVendaNewQty(venda.quantidade);
    setVendaNewValor(venda.valor_total);
    setVendaNewComissao(venda.comissao);
    setVendaJustificativa('');
    setIsVendaEditModalOpen(true);
  };

  // Invoca a RPC de correção de venda com auditoria de dados
  const handleSaveVendaEdit = async (e) => {
    if (e) e.preventDefault();
    if (!vendaJustificativa.trim()) {
      alert('Por favor, informe uma justificativa para esta alteração.');
      return;
    }

    try {
      const { error } = await supabase.rpc('corrigir_venda', {
        p_venda_id: editingVenda.id,
        p_new_qty: parseInt(vendaNewQty),
        p_new_valor_total: parseFloat(vendaNewValor),
        p_new_comissao: parseFloat(vendaNewComissao),
        p_justificativa: vendaJustificativa.trim()
      });

      if (error) throw error;

      alert('Venda corrigida com sucesso e log de auditoria gravado!');
      setIsVendaEditModalOpen(false);
      setEditingVenda(null);
      fetchGerenteData(company?.id || profile?.empresa_id);
    } catch (err) {
      console.error('Erro ao corrigir venda:', err);
      alert('Erro ao salvar correção: ' + err.message);
    }
  };

  // Função para navegação unificada na sidebar
  const handleNavigate = (view) => {
    const userEmail = (profile?.email || session?.user?.email || '').toLowerCase().trim();
    const isGerente = profile?.role === 'GERENTE' || userEmail === 'rodrigo.gerenciamonkeyshop@gmail.com';

    if (view === 'supremo') {
      if (profile?.role !== 'SUPER_ADMIN') {
        showToast('Acesso Negado: O Painel Supremo é restrito exclusivamente ao Super Admin do SaaS.', 'error');
        return;
      }
    }

    if (view === 'configuracoes') {
      if (!['SUPER_ADMIN', 'ADMIN', 'OWNER', 'DONO', 'GERENTE', 'RH', 'RH_ADMIN'].includes(profile?.role)) {
        showToast('Acesso Negado: Apenas Administradores, Gerentes e Recursos Humanos possuem autorização para acessar este módulo.', 'error');
        return;
      }
    }

    if (view === 'assinatura') {
      if (isGerente || !['SUPER_ADMIN', 'ADMIN', 'OWNER', 'DONO'].includes(profile?.role)) {
        showToast('Acesso Negado: Apenas Administradores e Donos da empresa possuem autorização para acessar este módulo.', 'error');
        return;
      }
    }

    if (view === 'estoque' || view === 'transferencias') {
      if (isGerente) {
        showToast('Acesso Negado: O perfil Gerente não possui permissão para acessar o módulo de Entrada/Transferência de Estoque.', 'error');
        return;
      }
    }

    setCurrentView(view);
    const tenantId = profile?.empresa_id;
    
    // Sincronizar com os estados legados de abas para manter retrocompatibilidade
    if (profile?.role === 'VENDEDOR') {
      setActiveSellerTab(view);
    } else {
      setActiveTab(view);
    }

    if (view === 'clientes') {
      fetchClientes(tenantId);
    } else if (view === 'transferencias') {
      if (activeFilialId) fetchTransferencias(activeFilialId, tenantId);
    } else if (view === 'categorias') {
      fetchCategorias(tenantId);
    } else if (view === 'configuracoes') {
      fetchTaxasCartao(tenantId);
      fetchTenantSettings();
      fetchTeamMembers(tenantId);
    } else if (view === 'gestao') {
      fetchGerenteData(tenantId);
      fetchCatalogoProdutos(tenantId);
    } else if (view === 'assinatura') {
      fetchTenantFaturas();
    }
  };

  // Feedback sonoro: beep de sucesso (WebAudio API)
  const playBeepSucesso = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.25);
    } catch (_) {}
  };

  // Feedback sonoro: beep de erro (WebAudio API)
  const playBeepErro = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.4);
    } catch (_) {}
  };

  // Handler: busca no autocomplete do catálogo
  const handleEntradaBusca = (valor) => {
    setEntradaNomeProduto(valor);
    setEntradaProdutoSelecionado(null); // Desselecionar ao digitar
    if (valor.trim().length < 2) {
      setEntradaSugestoes([]);
      return;
    }
    const filtro = catalogoProdutos.filter(p =>
      p.nome.toLowerCase().includes(valor.toLowerCase())
    );
    setEntradaSugestoes(filtro.slice(0, 8));
  };

  // Handler: selecionar produto do autocomplete
  const handleSelecionarProdutoCatalogo = (prod) => {
    setEntradaProdutoSelecionado(prod);
    setEntradaNomeProduto(prod.nome);
    setEntradaSugestoes([]);
    setEntradaImeisList([]);
    setEntradaImeiAtual('');
    // Auto-focar no campo de IMEI após selecionar
    if (prod.tipo === 'CELULAR') {
      setTimeout(() => imeiInputRef.current?.focus(), 100);
    }
  };

  // Handler principal: bipar IMEI (ao pressionar Enter ou Tab)
  const handleBiparImei = async (e) => {
    if (e.key !== 'Enter' && e.key !== 'Tab') return;
    e.preventDefault();

    const imei = entradaImeiAtual.trim();
    if (!imei) return;

    // 1. Validar formato (15 dígitos numéricos)
    if (!/^\d{15}$/.test(imei)) {
      playBeepErro();
      setEntradaImeisList(prev => [
        { imei, status: 'erro', msg: 'Formato inválido: deve ter exatamente 15 dígitos numéricos.' },
        ...prev
      ]);
      setEntradaImeiAtual('');
      return;
    }

    // 2. Validar Algoritmo de Luhn
    if (!validateLuhn(imei)) {
      playBeepErro();
      setEntradaImeisList(prev => [
        { imei, status: 'erro', msg: 'IMEI inválido: falhou na verificação de checksum (Luhn).' },
        ...prev
      ]);
      setEntradaImeiAtual('');
      return;
    }

    // 3. Verificar duplicidade LOCAL na lista atual
    const jaNaLista = entradaImeisList.some(i => i.imei === imei && i.status === 'ok');
    if (jaNaLista) {
      playBeepErro();
      setEntradaImeisList(prev => [
        { imei, status: 'erro', msg: 'IMEI duplicado: já foi inserido nesta entrada.' },
        ...prev
      ]);
      setEntradaImeiAtual('');
      return;
    }

    // 4. Verificar duplicidade REMOTA no banco de dados
    try {
      const { data: existente, error: checkErr } = await supabase
        .from('imeis')
        .select('imei')
        .eq('empresa_id', company.id)
        .eq('imei', imei)
        .maybeSingle();

      if (checkErr) throw checkErr;

      if (existente) {
        playBeepErro();
        setEntradaImeisList(prev => [
          { imei, status: 'erro', msg: 'IMEI já cadastrado no estoque desta empresa.' },
          ...prev
        ]);
        setEntradaImeiAtual('');
        return;
      }

      // 5. IMEI válido e único! Adicionar à lista
      playBeepSucesso();
      setEntradaImeisList(prev => [
        { imei, status: 'ok', msg: 'IMEI válido ✓' },
        ...prev
      ]);
      setEntradaImeiAtual('');
    } catch (err) {
      console.error('Erro ao verificar IMEI remoto:', err);
      setEntradaImeisList(prev => [
        { imei, status: 'erro', msg: 'Erro ao verificar no banco de dados.' },
        ...prev
      ]);
      setEntradaImeiAtual('');
    }
  };

  // Handler: remover IMEI da lista
  const handleRemoverImei = (imeiParaRemover) => {
    setEntradaImeisList(prev => prev.filter(i => i.imei !== imeiParaRemover));
  };

  // Handler para Adicionar Celular Semi-Novo (Compra de Cliente) com Questionário/Inspeção
  const handleAdicionarSeminovo = async () => {
    const imei = entradaImeiAtual.trim();
    if (!imei) {
      alert('Por favor, digite o IMEI.');
      return;
    }

    if (!entradaCor.trim()) {
      alert('Por favor, informe a cor do aparelho.');
      return;
    }

    if (!entradaBateria.trim()) {
      alert('Por favor, informe a saúde da bateria.');
      return;
    }

    if (!entradaPrecoCompra.trim()) {
      alert('Por favor, informe o preço pago ao cliente.');
      return;
    }

    // 1. Validar formato (15 dígitos numéricos)
    if (!/^\d{15}$/.test(imei)) {
      playBeepErro();
      alert('Formato inválido do IMEI: deve ter exatamente 15 dígitos numéricos.');
      return;
    }

    // 2. Validar Algoritmo de Luhn
    if (!validateLuhn(imei)) {
      playBeepErro();
      alert('IMEI inválido: falhou na verificação de checksum (Luhn).');
      return;
    }

    // 3. Verificar duplicidade LOCAL na lista atual
    const jaNaLista = entradaImeisList.some(i => i.imei === imei && i.status === 'ok');
    if (jaNaLista) {
      playBeepErro();
      alert('IMEI duplicado: já foi inserido nesta entrada.');
      return;
    }

    // 4. Verificar duplicidade REMOTA no banco de dados
    try {
      const { data: existente, error: checkErr } = await supabase
        .from('imeis')
        .select('imei')
        .eq('empresa_id', company.id)
        .eq('imei', imei)
        .maybeSingle();

      if (checkErr) throw checkErr;

      if (existente) {
        playBeepErro();
        alert('Este IMEI já consta no estoque desta empresa.');
        return;
      }

      // 5. IMEI válido e único! Adicionar à lista
      playBeepSucesso();
      setEntradaImeisList(prev => [
        { 
          imei, 
          status: 'ok', 
          msg: `Semi-Novo: ${entradaCor} · Bateria: ${entradaBateria}% · Pago: R$ ${parseFloat(entradaPrecoCompra).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
          cor: entradaCor,
          bateria_saude: parseInt(entradaBateria, 10),
          observacoes: entradaObs,
          preco_compra: parseFloat(entradaPrecoCompra),
          is_seminovo: true
        },
        ...prev
      ]);
      
      // Limpar campos
      setEntradaImeiAtual('');
      setEntradaCor('');
      setEntradaBateria('');
      setEntradaPrecoCompra('');
      setEntradaObs('');
    } catch (err) {
      console.error('Erro ao verificar IMEI remoto:', err);
      alert('Erro ao verificar IMEI no banco de dados.');
    }
  };

  // Filtro de modelos únicos para o dropdown de Entrada de Estoque (com base no catálogo)
  const produtosMestreOptions = React.useMemo(() => {
    const unique = [];
    const seen = new Set();
    catalogoProdutos.forEach(p => {
      if (p.tipo === 'CELULAR' && !seen.has(p.nome)) {
        seen.add(p.nome);
        unique.push(p);
      }
    });
    return unique;
  }, [catalogoProdutos]);

  const handleSalvarEstoqueFisico = async (e) => {
    if (e) e.preventDefault();
    if (!selectedProdutoMestre) {
      alert('Por favor, selecione um Produto Mestre.');
      return;
    }
    if (!selectedFilialDestino) {
      alert('Por favor, selecione a Filial de Destino.');
      return;
    }

    const imei = tenantSettings.enable_imei ? entradaImei.trim() : null;

    if (tenantSettings.enable_imei) {
      if (!imei) {
        alert('Por favor, informe o IMEI.');
        return;
      }
      if (!/^\d{15}$/.test(imei)) {
        alert('O IMEI deve ter exatamente 15 dígitos numéricos.');
        return;
      }
      if (!validateLuhn(imei)) {
        alert('O IMEI informado não passou na validação Luhn.');
        return;
      }
      if (!entradaCorDispositivo.trim()) {
        alert('Por favor, informe a Cor do dispositivo.');
        return;
      }
    }

    setLoadingEntrada(true);
    try {
      if (tenantSettings.enable_imei) {
        // 1. Verificar se IMEI é único no banco
        const { data: existente, error: checkErr } = await supabase
          .from('imeis')
          .select('imei')
          .eq('imei', imei)
          .maybeSingle();

        if (checkErr) throw checkErr;
        if (existente) {
          alert('Este IMEI já está registrado no sistema.');
          setLoadingEntrada(false);
          return;
        }
      }

      // 2. Localizar se o produto já existe na tabela de produtos desta filial
      let { data: existingProd, error: prodFindErr } = await supabase
        .from('produtos')
        .select('*')
        .eq('empresa_id', company.id)
        .eq('filial_id', selectedFilialDestino)
        .eq('nome', selectedProdutoMestre.nome)
        .maybeSingle();

      if (prodFindErr) throw prodFindErr;

      let targetProdutoId;
      const qtyToAdd = tenantSettings.enable_imei ? 1 : (parseInt(entradaQtdAcessorio, 10) || 1);

      if (!existingProd) {
        // Criar o produto para a filial se não existir
        const { data: newProd, error: newProdErr } = await supabase
          .from('produtos')
          .insert({
            empresa_id: company.id,
            filial_id: selectedFilialDestino,
            nome: selectedProdutoMestre.nome,
            tipo: selectedProdutoMestre.tipo,
            categoria: selectedProdutoMestre.categoria,
            preco: parseFloat(selectedProdutoMestre.preco || 0),
            quantidade: qtyToAdd
          })
          .select()
          .single();

        if (newProdErr) throw newProdErr;
        targetProdutoId = newProd.id;
      } else {
        // Incrementar a quantidade do produto existente
        const { error: updateErr } = await supabase
          .from('produtos')
          .update({ quantidade: (existingProd.quantidade || 0) + qtyToAdd })
          .eq('id', existingProd.id);

        if (updateErr) throw updateErr;
        targetProdutoId = existingProd.id;
      }

      // 3. Inserir registro na tabela imeis se habilitado
      if (tenantSettings.enable_imei) {
        const payload = {
          produto_id: targetProdutoId,
          empresa_id: company.id,
          imei: imei,
          cor: entradaCorDispositivo.trim(),
          filial_id: selectedFilialDestino,
          status: 'DISPONÍVEL',
          vendido: false
        };

        const { error: insertErr } = await supabase
          .from('imeis')
          .insert(payload);

        if (insertErr) throw insertErr;

        alert(`✅ IMEI ${imei} cadastrado com sucesso!`);
        setEntradaImei('');
        setTimeout(() => {
          if (imeiInputRef.current) {
            imeiInputRef.current.focus();
          }
        }, 50);
      } else {
        alert(`✅ Entrada de ${qtyToAdd} itens registrada com sucesso!`);
      }

      // Recarregar os dados do gerente para atualizar a interface
      fetchGerenteData(company?.id || profile?.empresa_id);
    } catch (err) {
      console.error(err);
      alert('Erro ao salvar no estoque físico: ' + err.message);
    } finally {
      setLoadingEntrada(false);
    }
  };

  // Handler: submeter entrada de estoque via catálogo
  const handleSubmeterEntrada = async (e) => {
    e.preventDefault();
    if (!entradaProdutoSelecionado || !entradaFilial) {
      alert('Selecione um produto do catálogo e uma filial de destino.');
      return;
    }

    const isCelular = entradaProdutoSelecionado.tipo === 'CELULAR' && tenantSettings.enable_imei;
    const imeisValidos = entradaImeisList.filter(i => i.status === 'ok');

    if (isCelular && imeisValidos.length === 0) {
      alert('Insira pelo menos um IMEI válido antes de cadastrar.');
      return;
    }

    if (isCelular && entradaImeisList.some(i => i.status === 'erro')) {
      alert('Existem IMEIs com erro na lista. Remova-os antes de prosseguir.');
      return;
    }

    setLoadingEntrada(true);
    try {
      // Validação Síncrona de Duplicidade de IMEI
      if (isCelular && imeisValidos.length > 0) {
        const imeiStrings = imeisValidos.map(i => i.imei);
        const { data: existingImeis, error: existErr } = await supabase
          .from('imeis')
          .select('imei')
          .in('imei', imeiStrings)
          .eq('empresa_id', company.id);
          
        if (existErr) throw existErr;
        
        if (existingImeis && existingImeis.length > 0) {
          setToast({ message: 'Erro: Este IMEI já está registrado no sistema.', type: 'error' });
          setLoadingEntrada(false);
          return;
        }
      }

      const qtd = isCelular ? imeisValidos.length : parseInt(entradaQtdAcessorio || 1, 10);
      const preco = parseFloat(entradaProdutoSelecionado.preco || 0);

      // 1. Inserir produto no estoque
      const { data: prodData, error: prodErr } = await supabase
        .from('produtos')
        .insert({
          empresa_id: company.id,
          filial_id: entradaFilial,
          nome: entradaProdutoSelecionado.nome,
          tipo: entradaProdutoSelecionado.tipo,
          categoria: entradaProdutoSelecionado.categoria,
          preco: preco,
          quantidade: qtd
        })
        .select()
        .single();

      if (prodErr) throw prodErr;

      // 2. Se celular, inserir IMEIs válidos
      if (isCelular && imeisValidos.length > 0) {
        const imeisData = imeisValidos.map(({ imei, cor, bateria_saude, observacoes, preco_compra, is_seminovo }) => ({
          produto_id: prodData.id,
          empresa_id: company.id,
          filial_id: entradaFilial,
          imei,
          status: 'DISPONÍVEL',
          vendido: false,
          cor: cor || null,
          bateria_saude: bateria_saude || null,
          observacoes: observacoes || null,
          preco_compra: preco_compra || 0,
          is_seminovo: !!is_seminovo
        }));

        console.log("PAYLOAD DE ENVIO:", imeisData.map(i => ({ imei: i.imei, filial_id: i.filial_id, status: i.status })));

        const { error: imeisErr } = await supabase.from('imeis').insert(imeisData);
        if (imeisErr) throw imeisErr;
      }

      alert(`✅ ${qtd} ${isCelular ? 'celular(es)' : 'unidade(s)'} de "${entradaProdutoSelecionado.nome}" inserido(s) com sucesso!`);

      // Resetar formulário
      setEntradaProdutoSelecionado(null);
      setEntradaNomeProduto('');
      setEntradaImeisList([]);
      setEntradaImeiAtual('');
      setEntradaIsSeminovo(false);
      setEntradaCor('');
      setEntradaBateria('');
      setEntradaPrecoCompra('');
      setEntradaObs('');
      const estoques = filiais.filter(f => f.tipo === 'ESTOQUE');
      setEntradaFilial(estoques.length > 0 ? estoques[0].id : '');
      setEntradaQtdAcessorio('1');

      // Recarregar estoque
      fetchGerenteData(company.id);
    } catch (err) {
      console.error('Erro ao submeter entrada:', err);
      alert('Erro ao inserir no estoque: ' + err.message);
    } finally {
      setLoadingEntrada(false);
    }
  };


  // Buscar histórico de movimentações de estoque
  const fetchEstoqueMovimentacoes = async () => {
    if (!company?.id) return;
    setMovimentacoesLoading(true);
    try {
      const { data, error } = await supabase
        .from('estoque_movimentacoes')
        .select(`
          id, imei, tipo_movimentacao, quantidade, observacao, created_at, criado_por,
          produtos (
            nome,
            tipo
          ),
          filial_origem:filial_origem_id (nome),
          filial_destino:filial_destino_id (nome)
        `)
        .eq('empresa_id', company.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setEstoqueMovimentacoes(data || []);
    } catch (err) {
      console.error('Erro ao buscar movimentações de estoque:', err);
    } finally {
      setMovimentacoesLoading(false);
    }
  };

  // Salvar ajuste manual de estoque
  const handleSaveEstoqueAjuste = async (e) => {
    if (e) e.preventDefault();
    if (!ajusteProduto) return;
    if (!ajusteFilialId) {
      alert('Por favor, selecione a filial.');
      return;
    }
    const qty = parseInt(ajusteQuantidade, 10) || 0;
    if (qty < 1) {
      alert('A quantidade deve ser maior ou igual a 1.');
      return;
    }
    if (!estoqueAjusteMotivo.trim()) {
      alert('Por favor, descreva o motivo do ajuste.');
      return;
    }

    const isCelular = ajusteProduto.tipo === 'CELULAR' && tenantSettings.enable_imei;
    let targetImei = isCelular ? ajusteImei.trim() : null;

    if (isCelular) {
      if (!targetImei) {
        alert('Por favor, informe o IMEI para o aparelho.');
        return;
      }
      if (!/^\d{15}$/.test(targetImei)) {
        alert('O IMEI deve ter exatamente 15 dígitos numéricos.');
        return;
      }
      if (!validateLuhn(targetImei)) {
        alert('O IMEI informado não passou na validação Luhn.');
        return;
      }
    }

    setIsSavingAjuste(true);
    try {
      let targetEmpresaId = profile?.empresa_id || company?.id || activeEmpresaId;
      if (!targetEmpresaId || targetEmpresaId === 'MASTER' || targetEmpresaId === '00000000-0000-0000-0000-000000000001') {
        const { data: empList } = await supabase.from('empresas').select('id').limit(1);
        if (empList && empList.length > 0) {
          targetEmpresaId = empList[0].id;
        }
      }

      // 1. Localizar produto na filial de forma segura (retorna array, pega 1º elemento)
      const { data: existingProds, error: prodFindErr } = await supabase
        .from('produtos')
        .select('*')
        .eq('empresa_id', targetEmpresaId)
        .eq('filial_id', ajusteFilialId)
        .eq('nome', ajusteProduto.nome);

      if (prodFindErr) throw prodFindErr;

      const existingProd = existingProds && existingProds.length > 0 ? existingProds[0] : null;
      let targetProdutoId;

      if (ajusteTipo === 'ENTRADA') {
        if (isCelular) {
          // Verificar de forma segura se IMEI já existe
          const { data: imeisEncontrados, error: checkErr } = await supabase
            .from('imeis')
            .select('imei')
            .eq('imei', targetImei);

          if (checkErr) throw checkErr;
          if (imeisEncontrados && imeisEncontrados.length > 0) {
            alert('Erro: Este IMEI já está registrado no sistema.');
            setIsSavingAjuste(false);
            return;
          }
        }

        if (!existingProd) {
          // Criar novo produto para filial
          const { data: newProds, error: newProdErr } = await supabase
            .from('produtos')
            .insert({
              empresa_id: targetEmpresaId,
              filial_id: ajusteFilialId,
              nome: ajusteProduto.nome,
              tipo: ajusteProduto.tipo,
              categoria: ajusteProduto.categoria,
              preco: parseFloat(ajusteProduto.preco || 0),
              quantidade: qty,
              ncm: ajusteProduto.ncm || null,
              cest: ajusteProduto.cest || null,
              cfop: ajusteProduto.cfop || null,
              origem: ajusteProduto.origem || '0'
            })
            .select();

          if (newProdErr) throw newProdErr;
          if (!newProds || newProds.length === 0) {
            throw new Error('Não foi possível registrar o produto.');
          }
          targetProdutoId = newProds[0].id;
        } else {
          // Incrementar quantidade
          const { error: updateErr } = await supabase
            .from('produtos')
            .update({ quantidade: (existingProd.quantidade || 0) + qty })
            .eq('id', existingProd.id);

          if (updateErr) throw updateErr;
          targetProdutoId = existingProd.id;
        }

        if (isCelular) {
          const { error: imeiErr } = await supabase
            .from('imeis')
            .insert({
              produto_id: targetProdutoId,
              empresa_id: targetEmpresaId,
              filial_id: ajusteFilialId,
              imei: targetImei,
              status: 'DISPONÍVEL',
              vendido: false,
              cor: (ajusteProduto.cor || 'Preto').trim()
            });

          if (imeiErr) throw imeiErr;
        }

        // Log da movimentação
        await supabase.from('estoque_movimentacoes').insert({
          empresa_id: targetEmpresaId,
          produto_id: targetProdutoId,
          imei: targetImei,
          tipo_movimentacao: 'AJUSTE_MANUAL_ENTRADA',
          filial_destino_id: ajusteFilialId,
          quantidade: qty,
          observacao: estoqueAjusteMotivo.trim(),
          criado_por: profile.id
        });

      } else {
        // ajusteTipo === 'SAIDA'
        if (!existingProd || (existingProd.quantidade || 0) < qty) {
          alert('Erro: Quantidade em estoque insuficiente nesta filial para realizar a saída.');
          setIsSavingAjuste(false);
          return;
        }

        targetProdutoId = existingProd.id;

        if (isCelular) {
          // Localizar o IMEI de forma segura sem .single() / .maybeSingle()
          const { data: imeiRecords, error: imeiRecordErr } = await supabase
            .from('imeis')
            .select('*')
            .eq('imei', targetImei)
            .eq('empresa_id', targetEmpresaId)
            .eq('filial_id', ajusteFilialId)
            .eq('vendido', false);

          if (imeiRecordErr) throw imeiRecordErr;
          if (!imeiRecords || imeiRecords.length === 0) {
            alert('Erro: Este IMEI não foi localizado ou não está disponível nesta filial.');
            setIsSavingAjuste(false);
            return;
          }
          const imeiRecord = imeiRecords[0];

          // Marcar vendido = true
          const { error: imeiUpdErr } = await supabase
            .from('imeis')
            .update({ vendido: true, status: 'VENDIDO' })
            .eq('id', imeiRecord.id);

          if (imeiUpdErr) throw imeiUpdErr;
        }

        // Decrementar quantidade
        const { error: updateErr } = await supabase
          .from('produtos')
          .update({ quantidade: Math.max(0, (existingProd.quantidade || 0) - qty) })
          .eq('id', existingProd.id);

        if (updateErr) throw updateErr;

        // Log da movimentação
        await supabase.from('estoque_movimentacoes').insert({
          empresa_id: targetEmpresaId,
          produto_id: targetProdutoId,
          imei: targetImei,
          tipo_movimentacao: 'AJUSTE_MANUAL_SAIDA',
          filial_origem_id: ajusteFilialId,
          quantidade: qty,
          observacao: estoqueAjusteMotivo.trim(),
          criado_por: profile.id
        });
      }

      alert('Ajuste de estoque realizado com sucesso!');
      setIsAjustarEstoqueModalOpen(false);
      setAjusteProduto(null);
      setAjusteFilialId('');
      setAjusteQuantidade('1');
      setAjusteImei('');
      setEstoqueAjusteMotivo('');

      // Recarregar dados
      fetchGerenteData(company.id);
      fetchTorreControlo();
      fetchEstoqueMovimentacoes();
    } catch (err) {
      console.error(err);
      alert('Erro ao processar ajuste de estoque: ' + err.message);
    } finally {
      setIsSavingAjuste(false);
    }
  };

  // Sync profile details into state
  useEffect(() => {
    if (profile) {
      setProfileNome(profile.nome || '');
      setProfileEmail(profile.email || '');
    }
  }, [profile]);

  // Salvar alterações da conta pessoal do usuário logado
  const handleSaveUserProfile = async (e) => {
    if (e) e.preventDefault();
    if (!profileNome.trim()) {
      showToast('Por favor, informe seu nome.', 'error');
      return;
    }
    if (!profileEmail.trim()) {
      showToast('Por favor, informe seu e-mail.', 'error');
      return;
    }

    if (profileSenha.trim()) {
      if (profileSenha.trim().length < 6) {
        showToast('A nova senha deve ter no mínimo 6 caracteres.', 'error');
        return;
      }
      if (profileSenha !== profileSenhaConfirm) {
        showToast('As senhas não coincidem.', 'error');
        return;
      }
    }

    setIsSavingProfile(true);
    try {
      // 1. Atualizar e-mail e/ou senha na auth do Supabase se houver alteração
      const authUpdates = {};
      let emailChanged = false;

      if (profileEmail.trim().toLowerCase() !== (profile?.email || '').toLowerCase()) {
        authUpdates.email = profileEmail.trim();
        emailChanged = true;
      }
      if (profileSenha.trim()) {
        authUpdates.password = profileSenha.trim();
      }

      if (Object.keys(authUpdates).length > 0) {
        const { error: authErr } = await supabase.auth.updateUser(authUpdates);
        if (authErr) throw authErr;
        if (emailChanged) {
          showToast('E-mail atualizado na autenticação. Verifique seu e-mail para confirmação se necessário.', 'info');
        }
      }

      // 2. Atualizar tabela profiles
      const { error: profileErr } = await supabase
        .from('profiles')
        .update({
          nome: profileNome.trim(),
          email: profileEmail.trim()
        })
        .eq('id', profile.id);

      if (profileErr) throw profileErr;

      // 3. Atualizar estado local
      setProfile(prev => ({
        ...prev,
        nome: profileNome.trim(),
        email: profileEmail.trim()
      }));

      // Limpar campos de senha
      setProfileSenha('');
      setProfileSenhaConfirm('');

      showToast('Seus dados de acesso foram atualizados com sucesso!', 'success');
    } catch (err) {
      console.error('Erro ao atualizar perfil:', err);
      showToast('Erro ao atualizar perfil: ' + (err.message || 'Erro desconhecido'), 'error');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleAddProduto = async (e) => {
    e.preventDefault();
    if (!nomeProduto || !precoProduto || !filialProduto) {
      alert('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    setLoadingProdutos(true);
    try {
      let imeisList = [];
      if (tipoProduto === 'CELULAR') {
        const lines = imeisInput.split('\n').map(l => l.trim()).filter(Boolean);
        if (lines.length === 0) {
          alert('Por favor, insira pelo menos um número de IMEI para o aparelho celular.');
          setLoadingProdutos(false);
          return;
        }

        // Validação Luhn
        for (let imei of lines) {
          if (!/^\d{15}$/.test(imei)) {
            alert(`O IMEI "${imei}" possui um formato inválido. Ele deve conter exatamente 15 dígitos numéricos.`);
            setLoadingProdutos(false);
            return;
          }
          if (!validateLuhn(imei)) {
            alert(`O IMEI "${imei}" não passou na validação de integridade (Checksum Luhn).`);
            setLoadingProdutos(false);
            return;
          }
          imeisList.push(imei);
        }

        // Verificar duplicados no campo
        const setImeis = new Set(imeisList);
        if (setImeis.size !== imeisList.length) {
          alert('Existem IMEIs duplicados informados no campo de texto.');
          setLoadingProdutos(false);
          return;
        }

        // Verificar duplicados no banco
        const { data: existingImeis, error: checkErr } = await supabase
          .from('imeis')
          .select('imei')
          .eq('empresa_id', company.id)
          .in('imei', imeisList);

        if (checkErr) throw checkErr;
        if (existingImeis && existingImeis.length > 0) {
          const list = existingImeis.map(i => i.imei).join(', ');
          alert(`Os seguintes IMEIs já estão cadastrados na sua empresa e não podem ser duplicados: ${list}`);
          setLoadingProdutos(false);
          return;
        }
      }

      const precoNum = parseFloat(precoProduto);
      const qtdNum = tipoProduto === 'CELULAR' ? imeisList.length : parseInt(qtdProduto || 1, 10);

      // 1. Inserir produto
      const { data: prodData, error: prodErr } = await supabase
        .from('produtos')
        .insert({
          empresa_id: company.id,
          filial_id: filialProduto,
          nome: nomeProduto,
          tipo: tipoProduto,
          categoria: categoriaProduto,
          preco: precoNum,
          quantidade: qtdNum
        })
        .select()
        .single();

      if (prodErr) throw prodErr;

      // 2. Se for celular, inserir IMEIs
      if (tipoProduto === 'CELULAR' && imeisList.length > 0) {
        const imeisInsertData = imeisList.map(imei => ({
          produto_id: prodData.id,
          empresa_id: company.id,
          filial_id: filialProduto,
          status: 'DISPONÍVEL',
          imei: imei,
          vendido: false
        }));

        console.log("PAYLOAD DE ENVIO:", imeisInsertData.map(i => ({ imei: i.imei, filial_id: i.filial_id, status: i.status })));

        const { error: imeisErr } = await supabase
          .from('imeis')
          .insert(imeisInsertData);

        if (imeisErr) throw imeisErr;
      }

      alert('Produto cadastrado e estoque atualizado com sucesso!');
      
      // Resetar form
      setNomeProduto('');
      setPrecoProduto('');
      setQtdProduto('1');
      setImeisInput('');
      
      // Recarregar estoque
      fetchGerenteData(company.id);
    } catch (err) {
      console.error('Erro ao adicionar produto:', err);
      alert('Erro ao cadastrar produto: ' + err.message);
    } finally {
      setLoadingProdutos(false);
    }
  };

  // Excluir Produto (Gerente)
  const handleDeleteProduto = async (prodId) => {
    if (!window.confirm('Tem certeza de que deseja deletar este produto? Todos os logs e IMEIs vinculados também serão removidos.')) return;
    try {
      const { error } = await supabase
        .from('produtos')
        .delete()
        .eq('id', prodId);

      if (error) throw error;
      alert('Produto deletado com sucesso!');
      fetchGerenteData(company.id);
    } catch (err) {
      console.error('Erro ao deletar produto:', err);
      alert('Erro ao deletar: ' + err.message);
    }
  };

  // Expandir e visualizar IMEIs cadastrados de um celular (Gerente)
  const toggleVerImeis = async (prodId) => {
    if (expandedProductImeis[prodId]) {
      setExpandedProductImeis(prev => ({ ...prev, [prodId]: false }));
      return;
    }

    try {
      const { data, error } = await supabase
        .from('imeis')
        .select('imei, vendido, cor, bateria_saude, observacoes, preco_compra, is_seminovo, filial_id, status')
        .eq('produto_id', prodId)
        .order('vendido', { ascending: true });

      if (error) throw error;
      setProductImeisMap(prev => ({ ...prev, [prodId]: data || [] }));
      setExpandedProductImeis(prev => ({ ...prev, [prodId]: true }));
    } catch (err) {
      console.error('Erro ao buscar IMEIs:', err);
    }
  };

  // --- MOTOR DE COMISSÕES E VENDAS ---

  const calcularComissao = (produto, quantidade, isTreinner, participouTrainee = false, precoCustomizado = null) => {
    const precoBase = precoCustomizado !== null && precoCustomizado > 0 ? precoCustomizado : (produto.preco || 0);
    const precoTotal = precoBase * quantidade;
    if (produto.categoria === 'ANDROID') {
      return precoTotal * 0.02; // Android 2%
    } else if (produto.categoria === 'IOS' || produto.categoria === 'APPLE_JBL_CONSOLE') {
      return 30 * quantidade; // Apple / JBL / Consoles R$ 30 fixo por item
    } else if (produto.categoria === 'SERVICO') {
      const taxa = (isTreinner || participouTrainee) ? 0.02 : 0.03; // Serviços: 3%, ou 2% se for trainee
      return precoTotal * taxa;
    } else if (produto.tipo === 'ACESSORIO') {
      return precoTotal * 0.025; // Acessórios 2.5%
    }
    return 0;
  };



  // Buscar taxas de cartão do banco
  const fetchTaxasCartao = async (tenantId) => {
    if (!tenantId) return;
    setIsLoadingTaxas(true);
    try {
      const { data, error } = await supabase
        .from('taxas_cartao')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('parcelas', { ascending: true });

      if (error) {
        if (error.code === '42P01') {
          console.warn('Tabela taxas_cartao não existe ainda. Usando taxas padrão locais.');
          const fallbackRates = Array.from({ length: 12 }, (_, i) => ({
            tenant_id: tenantId,
            parcelas: i + 1,
            taxa: 1.5 + i
          }));
          setTaxasCartao(fallbackRates);
          
          const ratesMap = {};
          for (let i = 1; i <= 12; i++) {
            ratesMap[i] = 1.5 + (i - 1);
          }
          setTempTaxasMap(ratesMap);
          return;
        }
        throw error;
      }

      if (!data || data.length === 0) {
        const defaultRates = Array.from({ length: 12 }, (_, i) => ({
          tenant_id: tenantId,
          parcelas: i + 1,
          taxa: 1.5 + i
        }));
        setTaxasCartao(defaultRates);
        
        const ratesMap = {};
        for (let i = 1; i <= 12; i++) {
          ratesMap[i] = 1.5 + (i - 1);
        }
        setTempTaxasMap(ratesMap);
      } else {
        setTaxasCartao(data);
        const ratesMap = {};
        for (let i = 1; i <= 12; i++) {
          const row = data.find(r => r.parcelas === i);
          ratesMap[i] = row ? row.taxa : (1.5 + (i - 1));
        }
        setTempTaxasMap(ratesMap);
      }
    } catch (err) {
      console.error('Erro ao buscar taxas de cartão:', err);
      const fallbackRates = Array.from({ length: 12 }, (_, i) => ({
        tenant_id: tenantId,
        parcelas: i + 1,
        taxa: 1.5 + i
      }));
      setTaxasCartao(fallbackRates);
      
      const ratesMap = {};
      for (let i = 1; i <= 12; i++) {
        ratesMap[i] = 1.5 + (i - 1);
      }
      setTempTaxasMap(ratesMap);
    } finally {
      setIsLoadingTaxas(false);
    }
  };

  // Salvar taxas de cartão
  const handleSaveTaxasCartao = async (e) => {
    e.preventDefault();
    if (!company?.id) return;
    setIsSavingTaxas(true);
    try {
      const upsertData = [];
      for (let i = 1; i <= 12; i++) {
        upsertData.push({
          tenant_id: company.id,
          parcelas: i,
          taxa: parseFloat(tempTaxasMap[i]) || 0
        });
      }

      const { error } = await supabase
        .from('taxas_cartao')
        .upsert(upsertData, { onConflict: 'tenant_id, parcelas' });

      if (error) throw error;
      
      await fetchTaxasCartao(company.id);
      alert('Taxas de parcelamento salvas com sucesso!');
    } catch (err) {
      console.error('Erro ao salvar taxas de cartão:', err);
      alert('Erro ao salvar taxas: ' + err.message);
    } finally {
      setIsSavingTaxas(false);
    }
  };

  // Adicionar item ao carrinho
  const handleAddToCart = async (produto, imei = null) => {
    let availableImeis = [];
    if (produto.tipo === 'CELULAR') {
      try {
        const { data, error } = await supabase
          .from('imeis')
          .select('*')
          .eq('produto_id', produto.id)
          .eq('status', 'DISPONIVEL')
          .eq('vendido', false);

        if (error) throw error;
        availableImeis = data || [];
        
        if (availableImeis.length === 0) {
          showToast(`Nenhum IMEI disponível para ${produto.nome}.`, 'error');
          return;
        }
        
        if (!imei) {
          imei = availableImeis[0].imei;
        }
      } catch (err) {
        console.error('Erro ao buscar IMEIs para o produto:', err);
        showToast('Erro ao carregar IMEIs.', 'error');
        return;
      }
    } else {
      if (produto.categoria !== 'SERVICO') {
        const countInCart = pdvCart
          .filter(item => item.produto.id === produto.id)
          .reduce((sum, item) => sum + item.quantidade, 0);

        if (countInCart + 1 > produto.quantidade) {
          showToast(`Quantidade solicitada excede o estoque disponível (${produto.quantidade} un.).`, 'error');
          return;
        }
      }
    }

    if (produto.tipo !== 'CELULAR' && pdvCart.some(item => item.produto.id === produto.id)) {
      setPdvCart(prev => prev.map(item => {
        if (item.produto.id === produto.id) {
          return { ...item, quantidade: item.quantidade + 1 };
        }
        return item;
      }));
      showToast(`Quantidade de ${produto.nome} incrementada!`, 'success');
      return;
    }

    if (produto.tipo === 'CELULAR' && pdvCart.some(item => item.imei === imei)) {
      showToast(`O IMEI ${imei} do aparelho ${produto.nome} já está no carrinho.`, 'error');
      return;
    }

    const novoItem = {
      cartId: crypto.randomUUID(),
      produto: produto,
      quantidade: 1,
      imei: imei,
      availableImeis: availableImeis,
      valorUnitario: parseFloat(produto.preco) || 0,
      vendaTrainee: pdvVendaTrainee
    };

    setPdvCart(prev => [...prev, novoItem]);
    showToast(`${produto.nome} adicionado ao carrinho!`, 'success');
  };

  // Remover item do carrinho
  const handleRemoveFromCart = (cartId) => {
    setPdvCart(prev => prev.filter(item => item.cartId !== cartId));
  };

  // Atualizar quantidade de item no carrinho
  const handleUpdateCartQty = (cartId, qty) => {
    const val = Math.max(1, parseInt(qty, 10) || 1);
    setPdvCart(prev => prev.map(item => {
      if (item.cartId === cartId) {
        if (item.produto.categoria !== 'SERVICO' && item.produto.tipo !== 'CELULAR') {
          if (val > item.produto.quantidade) {
            showToast(`Estoque insuficiente. Estoque disponível: ${item.produto.quantidade}`, 'error');
            return item;
          }
        }
        return { ...item, quantidade: val };
      }
      return item;
    }));
  };

  // Atualizar preço de item no carrinho (descontos)
  const handleUpdateCartPrice = (cartId, newPrice) => {
    const item = pdvCart.find(i => i.cartId === cartId);
    if (!item) return;

    const custo = item.produto.preco_custo || 0;
    if (newPrice < custo) {
      if (!['GERENTE', 'ADMIN', 'SUPER_ADMIN'].includes(profile?.role)) {
        showToast('Desconto bloqueado: Somente administradores ou gerentes podem conceder descontos abaixo do preço de custo.', 'error');
        return;
      }
    }

    setPdvCart(prev => prev.map(i => {
      if (i.cartId === cartId) {
        return { ...i, valorUnitario: parseFloat(newPrice) || 0 };
      }
      return i;
    }));
  };

  // Atualizar IMEI de item no carrinho
  const handleUpdateCartImei = (cartId, imeiVal) => {
    setPdvCart(prev => prev.map(item => {
      if (item.cartId === cartId) {
        return { ...item, imei: imeiVal };
      }
      return item;
    }));
  };

  // Busca textual ou código de barras / SKU / IMEI
  const handlePdvSearchSubmit = async (e) => {
    e.preventDefault();
    const query = pdvBusca.trim();
    if (!query) return;

    // Buscar correspondência direta na lista da filial
    const matchingProds = produtosFilial.filter(p => {
      const nameMatch = p.nome.toLowerCase().includes(query.toLowerCase());
      const skuMatch = p.sku && p.sku.toLowerCase() === query.toLowerCase();
      return nameMatch || skuMatch;
    });

    let matchedByImei = null;
    let matchedImeiString = '';
    try {
      const { data: imeiRows } = await supabase
        .from('imeis')
        .select('*, produtos(*)')
        .eq('imei', query)
        .eq('status', 'DISPONIVEL')
        .eq('vendido', false)
        .maybeSingle();

      if (imeiRows && imeiRows.produtos) {
        const p = produtosFilial.find(prod => prod.id === imeiRows.produto_id);
        if (p) {
          matchedByImei = p;
          matchedImeiString = imeiRows.imei;
        }
      }
    } catch (err) {
      console.warn('Erro ao verificar IMEI na busca:', err);
    }

    if (matchedByImei) {
      handleAddToCart(matchedByImei, matchedImeiString);
      setPdvBusca('');
      return;
    }

    if (matchingProds.length === 1) {
      handleAddToCart(matchingProds[0]);
      setPdvBusca('');
    } else if (matchingProds.length > 1) {
      showToast(`${matchingProds.length} produtos encontrados. Escolha na lista abaixo.`, 'info');
    } else {
      showToast('Nenhum produto encontrado.', 'error');
    }
  };

  // --- MÓDULO DE VENDAS HÍBRIDAS E TROCA ---

  // Bipar IMEI do produto novo (saída) no PDV e adicionar ao carrinho
  const handleBiparPdvNovo = async () => {
    const imei = pdvScanImei.trim();
    if (!imei) return;

    if (!/^\d{15}$/.test(imei)) {
      playBeepErro();
      alert('Formato inválido do IMEI: deve ter exatamente 15 dígitos numéricos.');
      return;
    }

    if (!validateLuhn(imei)) {
      playBeepErro();
      alert('IMEI inválido: falhou na verificação de checksum (Luhn).');
      return;
    }

    if (pdvCart.some(item => item.imei === imei)) {
      playBeepErro();
      alert('Este IMEI já está no carrinho.');
      return;
    }

    try {
      // Procurar o IMEI disponível no banco na filial atual
      const { data: imeiObj, error: imeiErr } = await supabase
        .from('imeis')
        .select('*, produtos(*)')
        .eq('empresa_id', profile.empresa_id)
        .eq('imei', imei)
        .eq('vendido', false)
        .maybeSingle();

      if (imeiErr) throw imeiErr;

      if (!imeiObj) {
        playBeepErro();
        alert('Este IMEI não foi encontrado ou já foi vendido no estoque desta filial.');
        return;
      }

      // Verificar se o IMEI pertence à filial ativa do vendedor
      if (imeiObj.filial_id !== activeFilialId) {
        playBeepErro();
        alert('Este IMEI pertence a outra filial. O vendedor só pode vender aparelhos da sua filial ativa.');
        return;
      }

      // Sucesso!
      playBeepSucesso();
      const prod = imeiObj.produtos;
      
      // Buscar todos os IMEIs para o produto para preencher a lista
      const { data: listData, error: listErr } = await supabase
        .from('imeis')
        .select('*')
        .eq('produto_id', prod.id)
        .eq('vendido', false);

      if (listErr) console.error('Erro ao buscar IMEIs para o produto:', listErr);

      const novoItem = {
        cartId: crypto.randomUUID(),
        produto: prod,
        quantidade: 1,
        imei: imei,
        availableImeis: listData || [imeiObj],
        valorUnitario: parseFloat(prod.preco) || 0,
        vendaTrainee: pdvVendaTrainee
      };

      setPdvCart(prev => [...prev, novoItem]);
      setPdvScanImei('');
      showToast(`${prod.nome} adicionado por IMEI com sucesso!`, 'success');
    } catch (err) {
      console.error('Erro ao buscar IMEI bipado:', err);
      alert('Erro ao buscar IMEI: ' + err.message);
    }
  };

  // Autocomplete do modelo usado recebido na troca
  const handlePdvUsadoBusca = (valor) => {
    setPdvUsadoNomeProduto(valor);
    setPdvUsadoProdutoSelecionado(null);
    if (valor.trim().length < 2) {
      setPdvUsadoSugestoes([]);
      return;
    }
    const filtro = catalogoProdutos.filter(p =>
      p.nome.toLowerCase().includes(valor.toLowerCase())
    );
    setPdvUsadoSugestoes(filtro.slice(0, 8));
  };

  const handlePdvUsadoSelecionar = (prod) => {
    setPdvUsadoProdutoSelecionado(prod);
    setPdvUsadoNomeProduto(prod.nome);
    setPdvUsadoSugestoes([]);
  };

  // Adicionar aparelho usado à fila de troca no PDV
  const handleAdicionarPdvUsado = async () => {
    const imei = pdvUsadoImei.trim();
    if (!imei) {
      alert('Por favor, digite o IMEI do aparelho usado.');
      return;
    }

    if (!pdvUsadoProdutoSelecionado) {
      alert('Por favor, selecione o modelo do aparelho usado no catálogo.');
      return;
    }

    if (!pdvUsadoCor.trim()) {
      alert('Por favor, informe a cor do aparelho usado.');
      return;
    }

    if (!pdvUsadoBateria.trim()) {
      alert('Por favor, informe a saúde da bateria.');
      return;
    }

    if (!pdvUsadoValor.trim() || parseFloat(pdvUsadoValor) <= 0) {
      alert('Por favor, informe um valor de avaliação válido (maior que zero).');
      return;
    }

    // 1. Validar formato (15 dígitos numéricos)
    if (!/^\d{15}$/.test(imei)) {
      playBeepErro();
      alert('Formato inválido do IMEI: deve ter exatamente 15 dígitos numéricos.');
      return;
    }

    // 2. Validar Algoritmo de Luhn
    if (!validateLuhn(imei)) {
      playBeepErro();
      alert('IMEI inválido: falhou na verificação de checksum (Luhn).');
      return;
    }

    // 3. Verificar duplicidade com aparelho novo sendo vendido
    if (imei === pdvImeiSelecionado) {
      playBeepErro();
      alert('O IMEI do aparelho usado não pode ser igual ao IMEI do aparelho novo sendo vendido.');
      return;
    }

    // 4. Verificar duplicidade LOCAL na lista atual de troca
    const jaNaLista = pdvUsadoList.some(i => i.imei === imei);
    if (jaNaLista) {
      playBeepErro();
      alert('Este IMEI já foi adicionado na lista de troca.');
      return;
    }

    // 5. Verificar duplicidade REMOTA no banco de dados
    try {
      const { data: existente, error: checkErr } = await supabase
        .from('imeis')
        .select('imei')
        .eq('empresa_id', profile.empresa_id)
        .eq('imei', imei)
        .maybeSingle();

      if (checkErr) throw checkErr;

      if (existente) {
        playBeepErro();
        alert('Este IMEI já consta no estoque da empresa.');
        return;
      }

      // Sucesso! Adicionar à lista
      playBeepSucesso();
      const novoUsado = {
        produto: pdvUsadoProdutoSelecionado,
        imei,
        cor: pdvUsadoCor,
        bateria: parseInt(pdvUsadoBateria, 10),
        valor: parseFloat(pdvUsadoValor),
        obs: pdvUsadoObs
      };

      setPdvUsadoList(prev => [...prev, novoUsado]);

      // Limpar campos locais do formulário do usado
      setPdvUsadoImei('');
      setPdvUsadoCor('');
      setPdvUsadoBateria('');
      setPdvUsadoValor('');
      setPdvUsadoObs('');
      setPdvUsadoNomeProduto('');
      setPdvUsadoProdutoSelecionado(null);

    } catch (err) {
      console.error('Erro ao verificar IMEI remoto:', err);
      alert('Erro ao verificar IMEI no banco de dados.');
    }
  };

  const handleRemoverPdvUsado = (imeiParaRemover) => {
    setPdvUsadoList(prev => prev.filter(i => i.imei !== imeiParaRemover));
  };



  // Efetuar Venda Consolidada Híbrida (Vendas de Saída + Entrada de Usado no Estoque + Recibo)
  const handleConfirmarVendaCarrinho = async () => {
    if (pdvCart.length === 0) {
      alert('O carrinho está vazio.');
      return;
    }

    const empresaId = profile?.empresa_id || company?.id;
    if (!empresaId) {
      alert('Erro: Empresa/Loja não identificada. A venda não pode ser finalizada.');
      return;
    }

    // 1. Validações
    for (const item of pdvCart) {
      if (item.produto.tipo === 'CELULAR' && tenantSettings.enable_imei && !item.imei) {
        alert(`Por favor, selecione o IMEI para o celular ${item.produto.nome}.`);
        return;
      }
      if (item.produto.tipo === 'ACESSORIO' && item.produto.categoria !== 'SERVICO') {
        const matchingItems = pdvCart.filter(i => i.produto.id === item.produto.id);
        const totalQty = matchingItems.reduce((sum, i) => sum + i.quantidade, 0);
        if (totalQty > item.produto.quantidade) {
          alert(`Quantidade solicitada de ${item.produto.nome} (${totalQty}) excede o estoque disponível (${item.produto.quantidade}).`);
          return;
        }
      }
    }

    const isTrocaAtiva = pdvMetodoPagamento === 'troca';
    if (isTrocaAtiva && pdvUsadoList.length === 0) {
      alert('Método de pagamento por Troca selecionado, mas nenhum aparelho usado foi adicionado.');
      return;
    }

    if (!pdvObsGarantia.trim()) {
      alert('Por favor, preencha as Observações de Garantia antes de concluir a venda.');
      return;
    }

    if (!pdvClienteNome.trim()) {
      alert('Por favor, preencha o Nome Completo do cliente (obrigatório).');
      return;
    }
    const cleanCpfCnpj = pdvClienteCpfCnpj.replace(/\D/g, '');
    if (!cleanCpfCnpj) {
      alert('Por favor, preencha o CPF / CNPJ do cliente (obrigatório).');
      return;
    }
    if (cleanCpfCnpj.length !== 11 && cleanCpfCnpj.length !== 14) {
      alert('Por favor, preencha um CPF válido (11 dígitos) ou CNPJ válido (14 dígitos).');
      return;
    }

    // Calcular valores do carrinho
    const subtotalCart = pdvCart.reduce((sum, item) => sum + item.valorUnitario * item.quantidade, 0);
    const valorUsadoTotal = isTrocaAtiva ? pdvUsadoList.reduce((acc, item) => acc + item.valor, 0) : 0;

    // Calcular juros/taxas do cartão se aplicável
    const metodoSaldo = isTrocaAtiva ? pdvMetodoRestante : pdvMetodoPagamento;
    const isCartao = metodoSaldo === 'cartao';
    const parcelas = isCartao ? parseInt(pdvCartaoParcelas, 10) : 1;
    
    let feePercent = 0;
    if (isCartao) {
      const feeObj = taxasCartao.find(t => t.parcelas === parcelas);
      feePercent = feeObj ? parseFloat(feeObj.taxa) : (1.5 + (parcelas - 1));
    }
    const feeFactor = 1 + (feePercent / 100);

    setLoadingPdvVenda(true);
    try {
      const createdVendaIds = [];
      const itemsForRecibo = [];

      // Loop para processar os itens
      for (let idx = 0; idx < pdvCart.length; idx++) {
        const item = pdvCart[idx];
        const valorTotalNovo = item.valorUnitario * item.quantidade * feeFactor;
        
        const comissaoCalculada = calcularComissao(
          item.produto,
          item.quantidade,
          profile?.is_treinner,
          item.vendaTrainee,
          item.valorUnitario * feeFactor
        );

        // Só vincula trocas e desconto de troca no primeiro item
        const itemTrocaJson = idx === 0 && isTrocaAtiva ? pdvUsadoList : [];
        const itemDescontoTroca = idx === 0 ? valorUsadoTotal : 0;

        const { data: rpcRes, error: rpcErr } = await supabase.rpc('registrar_venda_hibrida', {
          p_empresa_id: empresaId,
          p_filial_id: activeFilialId,
          p_vendedor_id: session.user.id,
          p_produto_novo_id: item.produto.id,
          p_quantidade_novo: item.quantidade,
          p_imei_novo: (item.produto.tipo === 'CELULAR' && tenantSettings.enable_imei) ? item.imei : null,
          p_valor_total_novo: valorTotalNovo,
          p_comissao: comissaoCalculada,
          p_metodo_pagamento: idx === 0 ? (isTrocaAtiva ? 'troca' : pdvMetodoPagamento) : (isTrocaAtiva ? pdvMetodoRestante : pdvMetodoPagamento),
          p_parcelas: parcelas,
          p_valor_desconto_troca: itemDescontoTroca,
          p_used_valor_avaliacao: itemDescontoTroca,
          p_trocas_json: itemTrocaJson,
          p_teve_participacao_trainee: item.vendaTrainee && item.produto.categoria === 'SERVICO',
          p_comissao_trainee: (item.vendaTrainee && item.produto.categoria === 'SERVICO') ? valorTotalNovo * 0.01 : 0
        });

        if (rpcErr) throw rpcErr;
        createdVendaIds.push(rpcRes.venda_id);

        // Registrar saída de estoque por venda
        try {
          await supabase.from('estoque_movimentacoes').insert({
            empresa_id: company.id,
            produto_id: item.produto.id,
            imei: (item.produto.tipo === 'CELULAR' && tenantSettings.enable_imei) ? item.imei : null,
            tipo_movimentacao: 'SAIDA_VENDA',
            filial_origem_id: activeFilialId,
            quantidade: item.quantidade,
            observacao: `Venda realizada no PDV (Venda ID: ${rpcRes.venda_id}).`,
            criado_por: profile.id
          });
        } catch (movErr) {
          console.error('Erro ao registrar histórico de movimentação de venda:', movErr);
        }

        // Atualizar dados de cliente e treener na venda recém-criada
        if (pdvClienteNome || pdvClienteCpfCnpj || pdvClienteEmail || pdvClienteTelefone || selectedPdvClienteId || selectedTreenerId) {
          const { error: clientUpdateErr } = await supabase
            .from('vendas')
            .update({
              cliente_nome: pdvClienteNome || null,
              cliente_cpf_cnpj: pdvClienteCpfCnpj || null,
              cliente_email: pdvClienteEmail || null,
              cliente_telefone: pdvClienteTelefone || null,
              cliente_id: selectedPdvClienteId || null,
              treener_id: selectedTreenerId || null
            })
            .eq('id', rpcRes.venda_id);
 
          if (clientUpdateErr) console.error('Erro ao salvar dados do cliente na venda:', clientUpdateErr);
 
          if (selectedPdvClienteId) {
            // Atualizar cliente existente
            const { error: extErr } = await supabase
              .from('clientes')
              .update({
                nome: pdvClienteNome,
                cpf_cnpj: pdvClienteCpfCnpj || null,
                email: pdvClienteEmail || null,
                telefone: pdvClienteTelefone || null
              })
              .eq('id', selectedPdvClienteId);
            if (extErr) console.error('Erro ao atualizar base de clientes:', extErr.message);
          } else if (pdvClienteNome) {
            // Cadastrar novo cliente
            const { data: newClient, error: extErr } = await supabase
              .from('clientes')
              .insert({
                empresa_id: empresaId,
                vendedor_id: session.user.id,
                nome: pdvClienteNome,
                cpf_cnpj: pdvClienteCpfCnpj || null,
                email: pdvClienteEmail || null,
                telefone: pdvClienteTelefone || null
              })
              .select()
              .single();
 
            if (extErr) {
              console.log('Cliente já cadastrado ou erro ao registrar na base global:', extErr.message);
            } else if (newClient) {
              setSelectedPdvClienteId(newClient.id);
              await supabase
                .from('vendas')
                .update({ cliente_id: newClient.id })
                .eq('id', rpcRes.venda_id);
            }
          }
        }

        // Se tiver comissão trainee de serviço
        if (item.vendaTrainee && item.produto.categoria === 'SERVICO') {
          const comissaoTrainee = valorTotalNovo * 0.01;
          await supabase.from('vendas').update({
            teve_participacao_trainee: true,
            comissao_trainee: comissaoTrainee
          }).eq('id', rpcRes.venda_id);
        }

        itemsForRecibo.push({
          nome: item.produto.nome,
          quantidade: item.quantidade,
          valor_unitario: item.valorUnitario * feeFactor,
          valor_total: valorTotalNovo,
          imei: item.imei
        });
      }

      // Preparar Recibo
      const filialDados = filiais.find(f => f.id === activeFilialId) || {};
      const totalNovoAjustado = subtotalCart * feeFactor;
      const finalSaldoPagar = Math.max(0, totalNovoAjustado - valorUsadoTotal);

      const dadosRecibo = {
        venda_id: createdVendaIds[0],
        vendas_ids: createdVendaIds,
        data: new Date().toISOString(),
        vendedor_nome: profile.nome,
        filial_nome: activeFilialNome,
        filial_logo: filialDados.logo_url || null,
        filial_endereco: filialDados.endereco || 'Endereço não cadastrado',
        filial_cnpj: filialDados.cnpj || 'CNPJ não cadastrado',
        filial_telefone: filialDados.telefone || 'Telefone não cadastrado',
        cliente_nome: pdvClienteNome || 'Consumidor Final',
        cliente_cpf_cnpj: pdvClienteCpfCnpj || '',
        cliente_email: pdvClienteEmail || '',
        cliente_telefone: pdvClienteTelefone || '',
        obs_garantia: pdvObsGarantia,
        itens: itemsForRecibo,
        financeiro: {
          total_novo: totalNovoAjustado,
          desconto_troca: valorUsadoTotal,
          saldo_pagar: finalSaldoPagar,
          metodo: isTrocaAtiva ? 'troca' : pdvMetodoPagamento,
          metodo_saldo: pdvMetodoRestante,
          parcelas: parcelas
        },
        trocas: pdvUsadoList
      };

      // Rastrear Auditoria de Desconto para Gerência e Administração
      const itemsComDesconto = pdvCart.filter(item => Number(item.valorUnitario) < Number(item.produto.preco));
      const totalTabelaCart = pdvCart.reduce((sum, i) => sum + (Number(i.produto.preco) * Number(i.quantidade)), 0);
      const totalVendidoCart = pdvCart.reduce((sum, i) => sum + (Number(i.valorUnitario) * Number(i.quantidade)), 0);
      const valorDescontoTotal = Math.max(0, totalTabelaCart - totalVendidoCart);

      if (itemsComDesconto.length > 0 || valorDescontoTotal > 0) {
        const resumoItensText = itemsComDesconto.map(i => `${i.produto.nome} (De R$ ${i.produto.preco.toFixed(2)} por R$ ${Number(i.valorUnitario).toFixed(2)})`).join(', ') || 'Desconto aplicado';
        const novoLogDesconto = {
          id: 'desc-' + Date.now(),
          vendedor_id: session.user.id,
          vendedor_nome: profile.nome || 'Vendedor',
          filial_id: activeFilialId,
          filial_nome: activeFilialNome || 'Filial',
          cliente_nome: pdvClienteNome || 'Cliente Balcão',
          itens_resumo: resumoItensText,
          valor_tabela: totalTabelaCart,
          valor_final: totalVendidoCart,
          valor_desconto: valorDescontoTotal,
          percentual_desconto: totalTabelaCart > 0 ? (valorDescontoTotal / totalTabelaCart) * 100 : 0,
          created_at: new Date().toISOString()
        };
        setDescontosLogs(prev => [novoLogDesconto, ...prev]);
        try {
          const storedStr = localStorage.getItem('zenite_descontos_logs');
          const stored = storedStr ? JSON.parse(storedStr) : [];
          localStorage.setItem('zenite_descontos_logs', JSON.stringify([novoLogDesconto, ...stored]));
        } catch (e) {}
      }

      setPdvReciboDados(dadosRecibo);
      setPdvReciboAtivo(true);
      showToast('Venda registrada com sucesso!', 'success');

      // Limpar estados do PDV
      setPdvCart([]);
      setPdvObsGarantia('');
      setSelectedTreenerId('');
      setPdvVendaTrainee(false);
      setPdvClienteNome('');
      setPdvClienteCpfCnpj('');
      setPdvClienteEmail('');
      setPdvClienteTelefone('');
      setPdvClienteSearchInput('');
      setPdvClienteSearchResults([]);
      setSelectedPdvClienteId(null);
      setIsPdvClienteFieldsEditable(false);
      setPdvUsadoList([]);
      setPdvMetodoPagamento('pix');
      setPdvMetodoRestante('pix');
      setPdvCartaoParcelas(1);
      setIsQuickClientFormOpen(true);

      // Recarregar dados
      fetchVendedorData(activeFilialId, session.user.id);
    } catch (err) {
      console.error('Erro ao registrar venda:', err);
      alert('Falha ao concluir venda: ' + (err.message || JSON.stringify(err)));
    } finally {
      setLoadingPdvVenda(false);
    }
  };
  // --- FECHAMENTO DE CAIXA (VENDEDOR) ---

  const handleComprovanteChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert('A imagem é muito grande. Escolha uma imagem de no máximo 2MB.');
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setFechamentoComprovante(reader.result);
    };
    reader.onerror = () => {
      alert('Falha ao processar imagem.');
    };
    reader.readAsDataURL(file);
  };

  // --- Manipuladores de Transferência de Mercadorias ---
  const handleTransfItemAdd = (e) => {
    e.preventDefault();
    if (!transfImeiBusca.trim()) return;

    const imei = transfImeiBusca.trim();
    
    supabase.from('imeis')
      .select('*, produtos(*)')
      .eq('imei', imei)
      .eq('empresa_id', profile.empresa_id)
      .in('status', ['DISPONÍVEL', 'DISPONIVEL', 'Disponível', 'Disponivel'])
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          alert('IMEI não encontrado ou não está disponível.');
          return;
        }
        const isAdmin = profile?.role === 'SUPER_ADMIN' || profile?.role === 'ADMIN' || profile?.role === 'OWNER';
        
        if (!isAdmin && data.filial_id !== activeFilialId) {
          alert('Este IMEI não pertence ao estoque desta filial.');
          return;
        }

        // Lock origin for the entire transfer batch
        if (transfItens.length === 0) {
          setTransfOrigemId(data.filial_id);
        } else {
          // Check if this new item belongs to the same origin branch
          const currentOrigem = transfOrigemId || activeFilialId;
          if (data.filial_id !== currentOrigem) {
            alert('Atenção: Você já iniciou uma transferência de outra filial.\n\nTodos os aparelhos de um único envio devem pertencer à mesma Filial de Origem.');
            return;
          }
        }

        if (transfItens.find(item => item.imei === imei)) {
          alert('IMEI já adicionado.');
          return;
        }
        setTransfItens(prev => [...prev, {
          produto_id: data.produto_id,
          nome: data.produtos.nome,
          tipo: data.produtos.tipo,
          categoria: data.produtos.categoria,
          imei: data.imei,
          quantidade: 1
        }]);
        setTransfImeiBusca('');
      });
  };

  const handleTransfItemRemove = (imeiToRemove) => {
    setTransfItens(prev => {
      const next = prev.filter(item => item.imei !== imeiToRemove);
      if (next.length === 0) setTransfOrigemId('');
      return next;
    });
  };

  const handleSubmeterTransferencia = async () => {
    if (!transfDestinoId) {
      alert('Selecione uma filial de destino.');
      return;
    }
    const finalOrigemId = transfOrigemId || activeFilialId;

    if (transfDestinoId === finalOrigemId) {
      alert('A filial de destino não pode ser a mesma da origem (' + (filiais.find(f => f.id === finalOrigemId)?.nome || 'Origem') + ').');
      return;
    }
    if (transfItens.length === 0) {
      alert('Adicione pelo menos um item para transferir.');
      return;
    }

    setLoadingTransferencias(true);
    try {
      const { data, error } = await supabase.rpc('registrar_transferencia_saida', {
        p_empresa_id: profile.empresa_id,
        p_filial_origem_id: finalOrigemId,
        p_filial_destino_id: transfDestinoId,
        p_criado_por: session.user.id,
        p_observacoes: transfObs || '',
        p_itens_json: transfItens
      });

      if (error) throw error;

      const filialDados = filiais.find(f => f.id === activeFilialId) || {};
      const filialDestinoNome = filiais.find(f => f.id === transfDestinoId)?.nome || 'Desconhecida';
      setTransfRomaneioDados({
        id: data.transferencia_id,
        data: new Date().toISOString(),
        origem: activeFilialNome,
        destino: filialDestinoNome,
        itens: transfItens,
        observacoes: transfObs,
        filial_logo: filialDados.logo_url || null
      });
      setTransfRomaneioAtivo(true);

      setTransfItens([]);
      setTransfDestinoId('');
      
      fetchTransferencias(activeFilialId, profile.empresa_id);
    } catch (error) {
      console.error(error);
      alert('Erro ao registrar transferência: ' + error.message);
    } finally {
      setLoadingTransferencias(false);
    }
  };

  const handleConfirmarRecebimento = async (transfId) => {
    if (!window.confirm('Confirma o recebimento desta carga? O estoque será atualizado na sua filial.')) return;
    
    setLoadingTransferencias(true);
    try {
      const { error } = await supabase.rpc('confirmar_recebimento_transferencia', {
        p_transferencia_id: transfId
      });

      if (error) throw error;

      alert('Recebimento confirmado com sucesso!');
      fetchTransferencias(activeFilialId, profile.empresa_id);
      fetchVendedorData(activeFilialId, session.user.id);
    } catch (error) {
      console.error(error);
      alert('Erro ao confirmar recebimento: ' + error.message);
    } finally {
      setLoadingTransferencias(false);
    }
  };

  const handleSubmeterFechamento = async (e) => {
    e.preventDefault();
    if (!fechamentoDinheiro && !fechamentoCartao && !fechamentoPix && !fechamentoBoleto && !fechamentoTroca) {
      alert('Por favor, preencha pelo menos um valor de fechamento.');
      return;
    }

    if (!fechamentoComprovante) {
      alert('O upload da foto do comprovante da maquininha é obrigatório para fechamento.');
      return;
    }

    setLoadingFechamento(true);
    try {
      const dinero = parseFloat(fechamentoDinheiro || 0);
      const cartao = parseFloat(fechamentoCartao || 0);
      const pix = parseFloat(fechamentoPix || 0);
      const boleto = parseFloat(fechamentoBoleto || 0);
      const troca = parseFloat(fechamentoTroca || 0);

      const { error } = await supabase
        .from('fechamentos')
        .insert({
          empresa_id: profile.empresa_id,
          filial_id: activeFilialId,
          vendedor_id: session.user.id,
          valor_dinheiro: dinero,
          valor_cartao: cartao,
          valor_pix: pix,
          valor_boleto: boleto,
          valor_troca: troca,
          qtd_transferencias_saida: fechamentoQtdSaida,
          qtd_transferencias_entrada: fechamentoQtdEntrada,
          comprovante_url: fechamentoComprovante,
          observacoes: fechamentoObs
        });

      if (error) throw error;

      alert('Fechamento de caixa enviado com sucesso para a gerência!');
      setFechamentoDinheiro('');
      setFechamentoCartao('');
      setFechamentoPix('');
      setFechamentoBoleto('');
      setFechamentoTroca('');
      setFechamentoComprovante('');
      setFechamentoObs('');
      setActiveSellerTab('pdv');
      
      fetchVendedorData(activeFilialId, session.user.id);
    } catch (err) {
      console.error('Erro ao enviar fechamento:', err);
      alert('Erro ao enviar fechamento de caixa: ' + err.message);
    } finally {
      setLoadingFechamento(false);
    }
  };

  // --- HELPERS DE METAS DINÂMICAS & REBRANDING ---
  const getNormalizedMetaTipo = (tipo) => {
    const t = (tipo || '').toLowerCase();
    if (t === 'faturamento_geral' || t === 'faturamento') return 'faturamento';
    if (t === 'boleto' || t === 'quantidade') return 'quantidade';
    if (t === 'ativacao' || t === 'ativacoes') return 'ativacao';
    return t || 'faturamento';
  };

  const isUnitMetric = (tipo) => {
    const norm = getNormalizedMetaTipo(tipo);
    return norm === 'quantidade' || norm === 'ativacao';
  };

  const getMetricLabel = (tipo) => {
    const norm = getNormalizedMetaTipo(tipo);
    if (norm === 'quantidade') return 'boletos';
    if (norm === 'ativacao') return 'ativações';
    return '';
  };

  const getMetricName = (tipo) => {
    const norm = getNormalizedMetaTipo(tipo);
    if (norm === 'quantidade') return 'Boleto Vendido';
    if (norm === 'ativacao') return 'Ativação';
    return 'Faturamento';
  };

  const formatMetaValue = (value, tipo) => {
    const norm = getNormalizedMetaTipo(tipo);
    if (isUnitMetric(norm)) {
      return `${Math.round(value)} ${getMetricLabel(norm)}`;
    }
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  // --- CALCULAR LEADERBOARD / METAS (MÊS CORRENTE) ---

  const getLeaderboard = () => {
    return vendedores.map(v => {
      const currentMonthSales = vendas.filter(sale => {
        if (sale.vendedor_id !== v.id) return false;
        const saleDate = new Date(sale.created_at);
        const [year, month] = filtroMes.split('-');
        return saleDate.getMonth() === parseInt(month, 10) - 1 && saleDate.getFullYear() === parseInt(year, 10);
      });

      const totalSalesVolume = currentMonthSales.reduce((acc, s) => acc + parseFloat(s.valor_total || 0), 0);
      const totalComission = currentMonthSales.reduce((acc, s) => acc + parseFloat(s.comissao || 0), 0);
      const salesCount = currentMonthSales.length;
      const ticketMedio = salesCount > 0 ? totalSalesVolume / salesCount : 0;

      return {
        ...v,
        totalSalesVolume,
        totalComission,
        salesCount,
        ticketMedio
      };
    }).sort((a, b) => b.totalSalesVolume - a.totalSalesVolume);
  };

  // Cálculo das Metas Pessoais do Vendedor com Motor de Progresso Condicional
  const getMetasVendedor = () => {
    const today = new Date();
    const mesRef = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    const m = metas.find(x => x.vendedor_id === session?.user?.id && x.mes_referencia === mesRef);
    const tipoMeta = m?.tipo_meta || 'faturamento';
    const normType = getNormalizedMetaTipo(tipoMeta);

    // Todas as vendas do mês corrente deste vendedor
    const currentMonthSales = vendasVendedor.filter(sale => {
      if (sale.vendedor_id !== session?.user?.id) return false;
      const saleDate = new Date(sale.created_at);
      return saleDate.getMonth() === today.getMonth() && saleDate.getFullYear() === today.getFullYear();
    });

    // MOTOR DE PROGRESSO CONDICIONAL: filtragem por tipo_meta
    let vendasParaMeta = currentMonthSales;
    if (normType === 'quantidade') {
      vendasParaMeta = currentMonthSales.filter(sale => {
        const mp = (sale.metodo_pagamento || '').toLowerCase();
        return mp === 'boleto';
      });
    } else if (normType === 'ativacao') {
      vendasParaMeta = currentMonthSales.filter(sale => {
        return sale.produtos?.categoria === 'SERVICO' || sale.categoria === 'SERVICO';
      });
    }

    const totalVendas = isUnitMetric(normType)
      ? vendasParaMeta.length
      : vendasParaMeta.reduce((acc, s) => acc + parseFloat(s.valor_total || 0), 0);
    const totalVendasGeral = currentMonthSales.reduce((acc, s) => acc + parseFloat(s.valor_total || 0), 0);
    const totalComissoes = currentMonthSales.reduce((acc, s) => acc + parseFloat(s.comissao || 0), 0);
    const salesCount = currentMonthSales.length;
    const ticketMedio = salesCount > 0 ? totalVendasGeral / salesCount : 0;
    
    const metaObjetivo = m ? Number(m.valor_meta) : (Number(profile?.meta_mensal) || 0);
    const progressoPercent = metaObjetivo > 0 ? Math.min(100, Math.round((totalVendas / metaObjetivo) * 100)) : 100;

    return {
      totalVendas,          // valor filtrado pelo tipo_meta (para o progresso)
      totalVendasGeral,     // total real independente do tipo (para KPI)
      totalComissoes,
      salesCount,
      ticketMedio,
      metaObjetivo,
      tipoMeta,
      progressoPercent,
      historico: currentMonthSales
    };
  };

  const metasInfo = profile?.role === 'VENDEDOR' ? getMetasVendedor() : null;

  // Métricas Globais do Gerente
  const getGerenteMetrics = () => {
    const mesSales = vendas.filter(sale => {
      const saleDate = new Date(sale.created_at);
      const [year, month] = filtroMes.split('-');
      return saleDate.getMonth() === parseInt(month, 10) - 1 && saleDate.getFullYear() === parseInt(year, 10);
    });

    const volumeTotal = mesSales.reduce((acc, s) => acc + parseFloat(s.valor_total || 0), 0);
    const comissoesTotal = mesSales.reduce((acc, s) => acc + parseFloat(s.comissao || 0), 0);
    
    // Melhor vendedor
    const leaderboard = getLeaderboard();
    const melhorVendedor = leaderboard.length > 0 && leaderboard[0].totalSalesVolume > 0 ? leaderboard[0] : null;

    return {
      volumeTotal,
      comissoesTotal,
      vendasCount: mesSales.length,
      melhorVendedor
    };
  };

  const gerenteMetrics = (['GERENTE', 'RH_ADMIN', 'ADMIN', 'OWNER', 'DONO', 'SUPER_ADMIN'].includes(profile?.role)) ? getGerenteMetrics() : null;

  // Simulação de Métricas do Administrador (SaaS)
  const totalCompanies = allCompanies.length;
  const activeCompanies = allCompanies.filter(c => c.status === 'ATIVO').length;
  const inactiveCompanies = allCompanies.filter(c => c.status === 'INATIVO').length;
  const simulatedSalesVolume = allCompanies
    .filter(c => c.status === 'ATIVO')
    .reduce((acc, c) => acc + (Number(c.valor_mensalidade) || 0) + (Number(c.valor_setup) || 0), 0);

  // Filtrar produtos de catálogo no Estoque (Gerente)
  const filteredProdutosEstoque = produtos.filter(p => {
    // 1. Filial filter
    const matchesFilial = filtroFilialEstoque ? p.filial_id === filtroFilialEstoque : true;
    
    // 2. Category filter
    const matchesCategoria = filtroCategoriaEstoque ? p.categoria === filtroCategoriaEstoque : true;
    
    // 3. Status filter (Disponibilidade)
    let matchesStatus = true;
    const isCelular = p.tipo === 'CELULAR';
    const isServico = p.categoria === 'SERVICO';
    
    // Calculate quantity
    let qty = p.quantidade;
    if (isCelular) {
      qty = disponiveisImeis.filter(im => im.produto_id === p.id && im.filial_id === p.filial_id && (im.status === 'DISPONÍVEL' || im.status === 'Disponível')).length;
    }
    
    if (filtroStatusEstoque === 'disponivel') {
      matchesStatus = isServico || qty > 0;
    } else if (filtroStatusEstoque === 'indisponivel') {
      matchesStatus = !isServico && qty === 0;
    }
    
    // 4. Text search (Name, SKU, Barcode/IMEI)
    let matchesSearch = true;
    if (buscaEstoque) {
      const searchLower = buscaEstoque.trim().toLowerCase();
      const nameMatch = p.nome.toLowerCase().includes(searchLower);
      const skuMatch = p.sku && p.sku.toLowerCase().includes(searchLower);
      
      // Check if search matches any IMEI for this product
      const imeiMatch = isCelular && disponiveisImeis.some(im => 
        im.produto_id === p.id && im.filial_id === p.filial_id && im.imei.toLowerCase().includes(searchLower)
      );
      
      matchesSearch = nameMatch || skuMatch || imeiMatch;
    }
    
    return matchesFilial && matchesCategoria && matchesStatus && matchesSearch;
  });

  // Filtrar produtos no PDV (Vendedor)
  const filteredProdutosPdv = produtosFilial.filter(p => {
    const matchesSearch = p.nome.toLowerCase().includes(pdvBusca.toLowerCase());
    const matchesCat = pdvCategoria === 'TUDO' 
      ? true 
      : pdvCategoria === 'IOS' && p.categoria === 'IOS'
      ? true
      : pdvCategoria === 'ANDROID' && p.categoria === 'ANDROID'
      ? true
      : pdvCategoria === 'APPLE_JBL_CONSOLE' && p.categoria === 'APPLE_JBL_CONSOLE'
      ? true
      : pdvCategoria === 'ACESSORIO' && p.tipo === 'ACESSORIO' && p.categoria !== 'SERVICO'
      ? true
      : pdvCategoria === 'SERVICO' && p.categoria === 'SERVICO';
    return matchesSearch && matchesCat;
  });

  // --- VISÃO DE TRANSFERÊNCIAS (COMPARTILHADA) ---
  const renderTransferencias = () => (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex gap-4 border-b border-[#222222] pb-2">
        <button
          onClick={() => setTransfSubTab('enviar')}
          className={`pb-2 text-sm font-bold uppercase tracking-wider transition-colors relative ${
            transfSubTab === 'enviar' ? 'text-[#6A0DAD]' : 'text-gray-500 hover:text-white'
          }`}
        >
          Enviar Mercadorias
          {transfSubTab === 'enviar' && (
            <span className="absolute bottom-[-9px] left-0 w-full h-[2px] bg-[#6A0DAD]"></span>
          )}
        </button>
        <button
          onClick={() => setTransfSubTab('receber')}
          className={`pb-2 text-sm font-bold uppercase tracking-wider transition-colors relative ${
            transfSubTab === 'receber' ? 'text-[#6A0DAD]' : 'text-gray-500 hover:text-white'
          }`}
        >
          Cargas Pendentes {cargasPendentes.length > 0 && <span className="ml-1 bg-[#6A0DAD] text-white text-[10px] px-2 py-0.5 rounded-full">{cargasPendentes.length}</span>}
          {transfSubTab === 'receber' && (
            <span className="absolute bottom-[-9px] left-0 w-full h-[2px] bg-[#6A0DAD]"></span>
          )}
        </button>
      </div>

      {transfSubTab === 'enviar' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-[#0A0A0A] border border-[#222222] rounded-xl p-6">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Truck size={18} className="text-[#6A0DAD]" /> Nova Transferência
            </h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Filial Origem (Autodetectado)</label>
                  <div className="w-full bg-[#111111] border border-[#222222] rounded px-3 py-2 text-sm text-gray-500 cursor-not-allowed">
                    {transfOrigemId ? (filiais.find(f => f.id === transfOrigemId)?.nome || 'Detectando...') : (profile?.role === 'ADMIN' || profile?.role === 'SUPER_ADMIN' || profile?.role === 'OWNER' ? 'Bipe o item p/ detectar' : (filiais.find(f => f.id === activeFilialId)?.nome || 'Sua Filial Atual'))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Filial Destino</label>
                  <select
                    value={transfDestinoId}
                    onChange={(e) => setTransfDestinoId(e.target.value)}
                    className="w-full bg-black border border-[#222222] focus:border-[#6A0DAD] rounded px-3 py-2 text-sm text-white outline-none"
                  >
                    <option value="">Selecione a Filial...</option>
                    {filiais.filter(f => f.id !== (transfOrigemId || activeFilialId)).map(f => (
                      <option key={f.id} value={f.id}>{f.nome}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Bipar IMEI do Celular</label>
                <form onSubmit={handleTransfItemAdd} className="flex gap-2">
                  <input
                    type="text"
                    value={transfImeiBusca}
                    onChange={(e) => setTransfImeiBusca(e.target.value)}
                    placeholder="Digite ou bipe o IMEI..."
                    className="flex-1 bg-black border border-[#222222] focus:border-[#6A0DAD] rounded px-3 py-2 text-sm text-white outline-none font-mono"
                  />
                  <button type="submit" className="bg-[#222222] hover:bg-[#333333] text-white px-4 py-2 rounded font-bold transition-colors">
                    Adicionar
                  </button>
                </form>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Observações (Opcional)</label>
                <textarea
                  value={transfObs}
                  onChange={(e) => setTransfObs(e.target.value)}
                  className="w-full bg-black border border-[#222222] focus:border-[#6A0DAD] rounded px-3 py-2 text-sm text-white outline-none min-h-[60px]"
                  placeholder="Nome do portador, motivo..."
                ></textarea>
              </div>
            </div>
          </div>

          <div className="bg-[#0A0A0A] border border-[#222222] rounded-xl p-6 flex flex-col">
            <h3 className="text-lg font-bold text-white mb-4">Itens a Transferir ({transfItens.length})</h3>
            <div className="flex-1 overflow-y-auto space-y-2 mb-4">
              {transfItens.length === 0 ? (
                <p className="text-sm text-gray-500 italic text-center mt-10">Nenhum item adicionado.</p>
              ) : (
                transfItens.map((item, idx) => (
                  <div key={idx} className="bg-black border border-[#222222] p-3 rounded flex justify-between items-center">
                    <div>
                      <p className="text-sm font-bold text-white">{item.nome}</p>
                      {item.imei && <p className="text-xs text-gray-500 font-mono">IMEI: {item.imei}</p>}
                    </div>
                    <button onClick={() => handleTransfItemRemove(item.imei)} className="text-red-500 hover:text-red-400 p-1">
                      <X size={16} />
                    </button>
                  </div>
                ))
              )}
            </div>
            <button
              onClick={handleSubmeterTransferencia}
              disabled={loadingTransferencias || transfItens.length === 0}
              className="w-full bg-[#6A0DAD] hover:bg-[#580b94] disabled:opacity-50 text-white font-black uppercase tracking-wider py-3 rounded-lg flex justify-center items-center gap-2 transition-colors"
            >
              {loadingTransferencias ? <Loader2 className="animate-spin" size={18} /> : <FileText size={18} />}
              Gerar Romaneio de Envio
            </button>
          </div>
        </div>
      )}

      {transfSubTab === 'receber' && (
        <div className="bg-[#0A0A0A] border border-[#222222] rounded-xl overflow-hidden">
          <div className="p-4 border-b border-[#222222]">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Package size={18} className="text-[#6A0DAD]" /> Cargas Pendentes
            </h3>
          </div>
          {cargasPendentes.length === 0 ? (
            <div className="p-10 text-center text-gray-500">
              Nenhuma carga pendente de recebimento.
            </div>
          ) : (
            <div className="divide-y divide-[#222222]">
              {cargasPendentes.map(carga => (
                <div key={carga.id} className="p-4 hover:bg-[#111111] transition-colors flex justify-between items-center">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs bg-yellow-900/30 text-yellow-500 border border-yellow-700/50 px-2 py-0.5 rounded-full font-bold uppercase">Em Trânsito</span>
                      <span className="text-sm text-gray-400">{new Date(carga.created_at).toLocaleString('pt-BR')}</span>
                    </div>
                    <p className="text-white font-bold">Origem: {carga.origem?.nome || 'Desconhecida'}</p>
                    <p className="text-xs text-gray-500 mt-1">{carga.transferencias_itens?.length || 0} Itens • Obs: {carga.observacoes || 'Nenhuma'}</p>
                  </div>
                  <button
                    onClick={() => handleConfirmarRecebimento(carga.id)}
                    disabled={loadingTransferencias}
                    className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-4 py-2 rounded font-bold transition-colors text-sm"
                  >
                    Confirmar Recebimento
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );


  // --- VEXTRON LAB: S.O.S BUTTON SUBMIT ---
  const handleSosSubmit = async () => {
    if (!sosMessage.trim() || !session) return;
    setIsSosSubmitting(true);
    try {
      const { error } = await supabase.from('chamados_suporte').insert({
        user_id: session.user.id,
        empresa_id: profile?.empresa_id || null,
        rota: window.location.pathname,
        mensagem: sosMessage.trim()
      });
      if (error) throw error;
      showToast('S.O.S enviado com sucesso! A equipe vai analisar.', 'success');
      setSosMessage('');
      setIsSosModalOpen(false);
    } catch (err) {
      console.error('Erro ao enviar S.O.S:', err);
      logDiagnosticError(err.message || err, 'handleSosSubmit');
      showToast('Erro ao enviar o chamado.', 'error');
    } finally {
      setIsSosSubmitting(false);
    }
  };

  // --- VEXTRON LAB: FINALIZAR CHAMADO S.O.S ---
  const handleFinalizarChamado = async (chamadoId) => {
    if (loadingFinalizarSos) return;
    setLoadingFinalizarSos(true);
    try {
      const { error } = await supabase
        .from('chamados_suporte')
        .update({ status: 'FINALIZADO' })
        .eq('id', chamadoId);

      if (error) throw error;

      showToast('Chamado finalizado com sucesso!', 'success');
      
      // Update local state reactively
      setChamadosSuporte(prev =>
        prev.map(c => c.id === chamadoId ? { ...c, status: 'FINALIZADO' } : c)
      );
      setConfirmingSosId(null);
    } catch (err) {
      console.error('Erro ao finalizar chamado:', err);
      logDiagnosticError(err.message || err, 'handleFinalizarChamado');
      showToast('Erro ao finalizar o chamado.', 'error');
    } finally {
      setLoadingFinalizarSos(false);
    }
  };

  
  // --- VISÃO DE AUDITORIA DE DESCONTOS (GERENTE & ADMIN) ---
  const renderAuditoriaDescontos = () => {
    const filteredDescontos = descontosLogs.filter(d => {
      const matchesVendedor = filtroDescontoVendedor ? d.vendedor_id === filtroDescontoVendedor || d.vendedor_nome === filtroDescontoVendedor : true;
      const matchesFilial = filtroDescontoFilial ? d.filial_id === filtroDescontoFilial || d.filial_nome === filtroDescontoFilial : true;
      const searchLower = buscaDesconto.trim().toLowerCase();
      const matchesSearch = !searchLower || 
        d.vendedor_nome.toLowerCase().includes(searchLower) ||
        (d.cliente_nome && d.cliente_nome.toLowerCase().includes(searchLower)) ||
        (d.itens_resumo && d.itens_resumo.toLowerCase().includes(searchLower));
      
      return matchesVendedor && matchesFilial && matchesSearch;
    });

    const totalDescontoValor = filteredDescontos.reduce((acc, d) => acc + (Number(d.valor_desconto) || 0), 0);
    const totalVendasComDesconto = filteredDescontos.length;
    const mediaDescontoPercent = filteredDescontos.length > 0 
      ? (filteredDescontos.reduce((acc, d) => acc + (Number(d.percentual_desconto) || 0), 0) / filteredDescontos.length)
      : 0;

    const vendorMap = {};
    filteredDescontos.forEach(d => {
      vendorMap[d.vendedor_nome] = (vendorMap[d.vendedor_nome] || 0) + Number(d.valor_desconto || 0);
    });
    let topVendor = '-';
    let topVendorAmount = 0;
    Object.entries(vendorMap).forEach(([vNome, amt]) => {
      if (amt > topVendorAmount) {
        topVendorAmount = amt;
        topVendor = vNome;
      }
    });

    return (
      <div className="space-y-6 animate-fadeIn font-sans">
        {/* CABEÇALHO */}
        <div className="bg-gradient-to-r from-[#0A001A] via-[#0A0A0A] to-[#0A0A0A] border border-[#6A0DAD]/30 p-6 rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-xl font-black text-white flex items-center gap-2.5">
              <Tag size={22} className="text-[#6A0DAD]" />
              Auditoria de Descontos Concedidos por Vendedores
            </h2>
            <p className="text-xs text-gray-400 mt-1">
              Painel de controle gerencial e rastreamento de abatimentos, descontos manuais e alterações de preço unitário no PDV.
            </p>
          </div>
          <span className="text-xs font-bold bg-[#6A0DAD]/20 text-purple-300 border border-[#6A0DAD]/40 px-3 py-1.5 rounded-full flex items-center gap-1.5">
            <Shield size={14} /> Visível para Gerente &amp; Admin
          </span>
        </div>

        {/* CARDS KPIS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-[#0A0A0A] border border-[#222222] p-5 rounded-xl">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total em Descontos</span>
              <DollarSign size={16} className="text-red-400" />
            </div>
            <p className="text-2xl font-black text-white font-mono">
              R$ {totalDescontoValor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
            <span className="text-[10px] text-gray-500 mt-1 block">Volume financeiro de abatimentos</span>
          </div>

          <div className="bg-[#0A0A0A] border border-[#222222] p-5 rounded-xl">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Vendas c/ Desconto</span>
              <ShoppingBag size={16} className="text-purple-400" />
            </div>
            <p className="text-2xl font-black text-white font-mono">{totalVendasComDesconto}</p>
            <span className="text-[10px] text-purple-400/80 mt-1 block">Operações com redução de valor</span>
          </div>

          <div className="bg-[#0A0A0A] border border-[#222222] p-5 rounded-xl">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Desconto Médio</span>
              <TrendingUp size={16} className="text-yellow-400" />
            </div>
            <p className="text-2xl font-black text-white font-mono">{mediaDescontoPercent.toFixed(1)}%</p>
            <span className="text-[10px] text-yellow-500/80 mt-1 block">Média percentual por transação</span>
          </div>

          <div className="bg-[#0A0A0A] border border-[#222222] p-5 rounded-xl">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Maior Concessor</span>
              <User size={16} className="text-blue-400" />
            </div>
            <p className="text-base font-black text-white truncate" title={topVendor}>{topVendor}</p>
            <span className="text-[10px] text-blue-400/80 mt-1 block">
              {topVendorAmount > 0 ? `R$ ${topVendorAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} em descontos` : 'Nenhum registro'}
            </span>
          </div>
        </div>

        {/* FILTROS E BUSCA */}
        <div className="bg-[#0A0A0A] border border-[#222222] p-4 rounded-xl flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="relative w-full sm:w-80">
            <Search size={14} className="absolute left-3 top-3 text-gray-500" />
            <input
              type="text"
              value={buscaDesconto}
              onChange={(e) => setBuscaDesconto(e.target.value)}
              placeholder="Buscar vendedor, cliente ou produto..."
              className="w-full bg-black border border-[#222222] focus:border-[#6A0DAD] rounded-lg text-white pl-9 pr-4 py-2 text-xs outline-none transition-all font-sans"
            />
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            {/* Filtro de Vendedor */}
            <select
              value={filtroDescontoVendedor}
              onChange={(e) => setFiltroDescontoVendedor(e.target.value)}
              className="bg-black border border-[#222222] focus:border-[#6A0DAD] text-white text-xs font-bold px-3 py-2 rounded-lg outline-none cursor-pointer"
            >
              <option value="">[ Todos os Vendedores ]</option>
              {vendedores.map(v => (
                <option key={v.id} value={v.id}>{v.nome}</option>
              ))}
            </select>

            {/* Filtro de Filial */}
            <select
              value={filtroDescontoFilial}
              onChange={(e) => setFiltroDescontoFilial(e.target.value)}
              className="bg-black border border-[#222222] focus:border-[#6A0DAD] text-white text-xs font-bold px-3 py-2 rounded-lg outline-none cursor-pointer"
            >
              <option value="">[ Todas as Filiais ]</option>
              {filiais.map(f => (
                <option key={f.id} value={f.id}>{f.nome}</option>
              ))}
            </select>
          </div>
        </div>

        {/* TABELA DE AUDITORIA DE DESCONTOS */}
        <div className="bg-[#0A0A0A] border border-[#222222] rounded-xl overflow-hidden shadow-2xl">
          <div className="p-4 border-b border-[#222222] flex justify-between items-center">
            <h3 className="text-xs font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
              <ClipboardList size={16} className="text-[#6A0DAD]" />
              Histórico Detalhado de Vendas com Abatimento / Desconto ({filteredDescontos.length})
            </h3>
          </div>

          {filteredDescontos.length === 0 ? (
            <div className="p-12 text-center text-gray-500 space-y-2">
              <Tag size={28} className="mx-auto opacity-30 text-[#6A0DAD]" />
              <p className="text-sm font-semibold text-gray-400">Nenhum desconto concedido registrado até o momento.</p>
              <p className="text-xs text-gray-600">As vendas onde o vendedor alterar o valor unitário dos produtos aparecerão nesta auditoria.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#222222] text-[10px] uppercase font-bold text-gray-500 bg-[#050505]">
                    <th className="py-3 px-4">Vendedor Responsável</th>
                    <th className="py-3 px-4">Filial</th>
                    <th className="py-3 px-4">Cliente</th>
                    <th className="py-3 px-4">Produtos / Itens</th>
                    <th className="py-3 px-4 text-right">Valor Tabela</th>
                    <th className="py-3 px-4 text-right">Valor Vendido</th>
                    <th className="py-3 px-4 text-right">Desconto (R$)</th>
                    <th className="py-3 px-4 text-center">% Desconto</th>
                    <th className="py-3 px-4 text-right">Data &amp; Hora</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#181818]">
                  {filteredDescontos.map((d, index) => (
                    <tr key={d.id || index} className="hover:bg-[#111111] transition-colors text-xs">
                      <td className="py-3 px-4 font-bold text-white">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-[#6A0DAD]/20 border border-[#6A0DAD]/40 text-[#6A0DAD] flex items-center justify-center font-bold text-xs uppercase">
                            {d.vendedor_nome ? d.vendedor_nome[0] : 'V'}
                          </div>
                          <div>
                            <span className="block font-bold text-white">{d.vendedor_nome}</span>
                            <span className="text-[10px] text-gray-500">Vendedor</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-gray-300">
                        <span className="inline-flex items-center gap-1 bg-[#111] border border-[#222] px-2 py-0.5 rounded text-[11px]">
                          <Store size={11} className="text-[#6A0DAD]" />
                          {d.filial_nome || 'Filial'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-300 font-medium">
                        {d.cliente_nome || 'Cliente Balcão'}
                      </td>
                      <td className="py-3 px-4 text-gray-300">
                        <span className="font-semibold text-purple-300">{d.itens_resumo}</span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-gray-400">
                        R$ {Number(d.valor_tabela || d.subtotal_original || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-white">
                        R$ {Number(d.valor_final || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-red-400">
                        - R$ {Number(d.valor_desconto || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="bg-red-950/40 text-red-400 border border-red-800/40 px-2 py-0.5 rounded text-[10px] font-bold font-mono">
                          -{Number(d.percentual_desconto || 0).toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right text-gray-500 font-mono text-[11px]">
                        {new Date(d.created_at).toLocaleString('pt-BR')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderPdvContent = () => {
    return (
      <div className="space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start animate-fadeIn">
                        
                        {/* COLUNA ESQUERDA: CATALOGO */}
                        <div className="bg-[#0A0A0A] border border-[#222222] rounded-xl p-6 lg:col-span-2 flex flex-col gap-6">
                          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                            <h3 className="text-base font-bold text-white flex items-center gap-2">
                              <Package size={18} className="text-[#6A0DAD]" />
                              Produtos Disponíveis nesta Filial
                            </h3>
                            
                            <form onSubmit={handlePdvSearchSubmit} className="relative w-full sm:w-64">
                              <Search size={14} className="absolute left-3 top-3 text-gray-500" />
                              <input
                                type="text"
                                id="pdv-busca-input"
                                value={pdvBusca}
                                onChange={(e) => setPdvBusca(e.target.value)}
                                placeholder="Busca, SKU ou Código... [F2]"
                                className="w-full bg-black border border-[#222222] focus:border-[#6A0DAD] rounded-md text-white pl-9 pr-4 py-2 text-xs outline-none transition-all font-sans"
                              />
                            </form>
                          </div>

                          {/* Filtros de Categoria */}
                          <div className="flex gap-2 flex-wrap border-b border-[#161616] pb-4">
                            {['TUDO', 'IOS', 'ANDROID', 'APPLE_JBL_CONSOLE', 'ACESSORIO', 'SERVICO'].map((cat) => (
                              <button
                                key={cat}
                                onClick={() => setPdvCategoria(cat)}
                                className={`px-3 py-1.5 rounded text-[10px] font-bold uppercase tracking-wider transition-all border ${
                                  pdvCategoria === cat
                                    ? 'bg-[#6A0DAD] text-white border-[#6A0DAD]'
                                    : 'bg-black text-gray-400 border-[#222222] hover:text-white'
                                }`}
                              >
                                {cat === 'TUDO' ? 'Tudo' : cat === 'APPLE_JBL_CONSOLE' ? 'Apple/JBL/Console' : cat}
                              </button>
                            ))}
                          </div>

                          {/* Grid de Produtos */}
                          {loadingDados ? (
                            <div className="flex flex-col items-center justify-center py-20 gap-3">
                              <Loader2 size={24} className="animate-spin text-[#6A0DAD]" />
                              <span className="text-xs text-gray-500">Buscando catálogo...</span>
                            </div>
                          ) : filteredProdutosPdv.length === 0 ? (
                            <div className="text-center py-20 text-gray-500 italic text-sm border border-dashed border-[#222] rounded-lg">
                              Nenhum produto em estoque correspondente aos filtros.
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[500px] overflow-y-auto pr-1">
                              {filteredProdutosPdv.map((prod) => {
                                const isSemEstoque = prod.categoria !== 'SERVICO' && prod.quantidade <= 0;
                                return (
                                  <button
                                    key={prod.id}
                                    disabled={isSemEstoque}
                                    onClick={() => handleAddToCart(prod)}
                                    className={`group bg-black border p-4 rounded-lg text-left flex flex-col gap-2 transition-all ${
                                      isSemEstoque
                                        ? 'border-[#161616] opacity-40 cursor-not-allowed'
                                        : pdvCart.some(i => i.produto.id === prod.id)
                                        ? 'border-[#6A0DAD] bg-[#6A0DAD]/5'
                                        : 'border-[#222222] hover:border-[#6A0DAD]/40'
                                    }`}
                                  >
                                    <div className="flex justify-between items-start w-full">
                                      <span className="font-extrabold text-sm text-white group-hover:text-purple-400 transition-colors">
                                        {prod.nome}
                                      </span>
                                      <span className={`px-2 py-0.5 rounded text-[8px] font-bold ${
                                        prod.categoria === 'IOS' ? 'bg-blue-950/20 text-blue-400 border border-blue-800/20' :
                                        prod.categoria === 'ANDROID' ? 'bg-green-950/20 text-green-400 border border-green-800/20' :
                                        prod.categoria === 'SERVICO' ? 'bg-pink-950/20 text-pink-400 border border-pink-800/20' :
                                        'bg-purple-950/20 text-purple-400 border border-purple-800/20'
                                      }`}>
                                        {prod.categoria}
                                      </span>
                                    </div>
                                    
                                    <div className="flex justify-between items-center w-full mt-2">
                                      <span className="font-mono font-bold text-xs text-white">
                                        R$ {prod.preco.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                      </span>
                                      <div className="flex items-center gap-2">
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleVerMultiloja(prod);
                                          }}
                                          className="px-2 py-0.5 bg-[#111] hover:bg-[#6A0DAD] text-[9px] font-bold text-gray-400 hover:text-white rounded border border-[#222] hover:border-[#6A0DAD] transition-all flex items-center gap-1"
                                          title="Ver estoque nas outras lojas"
                                        >
                                          <Store size={10} />
                                          Rede
                                        </button>
                                        <span className="text-[10px] text-gray-500 font-medium">
                                          {prod.categoria === 'SERVICO' ? 'Disponibilidade total' : `Estoque: ${prod.quantidade} un.`}
                                        </span>
                                      </div>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          )}

                          {/* Dicas de Atalhos */}
                          <div className="bg-[#111111]/45 border border-[#222222] p-4 rounded-lg flex flex-wrap gap-4 text-[10px] text-gray-500 font-medium">
                            <span className="font-bold text-gray-400 uppercase tracking-wider block w-full mb-1">Teclas de Atalho [PDV]:</span>
                            <span><kbd className="bg-black border border-[#333] px-1.5 py-0.5 rounded text-white mr-1.5 font-bold font-mono">F2</kbd> Buscar Produto</span>
                            <span><kbd className="bg-black border border-[#333] px-1.5 py-0.5 rounded text-white mr-1.5 font-bold font-mono">F8</kbd> Cadastro de Cliente</span>
                            <span><kbd className="bg-black border border-[#333] px-1.5 py-0.5 rounded text-white mr-1.5 font-bold font-mono">F9</kbd> Participação Trainee</span>
                            <span><kbd className="bg-black border border-[#333] px-1.5 py-0.5 rounded text-white mr-1.5 font-bold font-mono">F10</kbd> Finalizar Venda</span>
                            <span><kbd className="bg-black border border-[#333] px-1.5 py-0.5 rounded text-white mr-1.5 font-bold font-mono">Esc</kbd> Limpar Carrinho</span>
                          </div>
                        </div>

                        {/* COLUNA DIREITA: CART/CHECKOUT */}
                        <div className="bg-[#0A0A0A] border border-[#222222] rounded-xl p-6 flex flex-col gap-6 lg:col-span-1">
                          <div className="flex justify-between items-center pb-2 border-b border-[#222222]">
                            <h3 className="text-base font-bold text-white flex items-center gap-2">
                              <ShoppingBag size={18} className="text-[#6A0DAD]" />
                              Carrinho ({pdvCart.length})
                            </h3>
                            {pdvCart.length > 0 && (
                              <button 
                                onClick={() => setPdvCart([])} 
                                className="text-[10px] text-red-500 hover:text-red-400 font-bold uppercase transition-colors"
                              >
                                Limpar
                              </button>
                            )}
                          </div>

                          {/* Scanner de IMEI do Produto Novo (Saída) */}
                          {tenantSettings.enable_imei && (
                            <div className="space-y-1.5 bg-[#111111]/60 border border-[#222222] p-3 rounded-lg">
                              <label className="block text-[10px] font-black text-purple-400 uppercase tracking-wider">
                                ⚡ Bipar IMEI do Celular
                              </label>
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  value={pdvScanImei}
                                  onChange={(e) => setPdvScanImei(e.target.value.replace(/\D/g, '').slice(0, 15))}
                                  placeholder="Bipe o IMEI..."
                                  maxLength={15}
                                  className="flex-1 bg-black border border-[#222222] focus:border-[#6A0DAD] rounded px-3 py-2 text-xs text-white outline-none font-mono tracking-wider"
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      handleBiparPdvNovo();
                                    }
                                  }}
                                />
                                <button
                                  type="button"
                                  onClick={handleBiparPdvNovo}
                                  className="bg-[#6A0DAD] hover:bg-[#500885] px-3 py-2 rounded text-xs font-bold text-white transition-all shrink-0"
                                >
                                  Bipar
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Lista do Carrinho */}
                          {pdvCart.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 text-gray-600 text-center gap-2 border border-dashed border-[#222222] rounded-lg">
                              <ShoppingBag size={24} className="text-gray-800" />
                              <p className="text-xs italic leading-relaxed px-4">
                                Adicione produtos do catálogo ou bipe um IMEI de celular para começar.
                              </p>
                            </div>
                          ) : (
                            <div className="space-y-4 max-h-[320px] overflow-y-auto pr-1">
                              {pdvCart.map((item) => (
                                <div key={item.cartId} className="bg-black border border-[#222222] p-3 rounded-lg flex flex-col gap-2 relative">
                                  {/* Botão de Excluir Item */}
                                  <button 
                                    type="button" 
                                    onClick={() => handleRemoveFromCart(item.cartId)}
                                    className="absolute right-3 top-3 text-gray-500 hover:text-red-500 transition-colors"
                                  >
                                    <Trash2 size={13} />
                                  </button>

                                  <div className="pr-6">
                                    <h4 className="font-extrabold text-xs text-white truncate">{item.produto.nome}</h4>
                                    <span className="text-[8px] bg-[#1a1a1a] text-purple-400 border border-purple-900/30 px-1.5 py-0.5 rounded font-bold uppercase mt-1 inline-block">
                                      {item.produto.categoria}
                                    </span>
                                  </div>

                                  {/* Linha de IMEI/Quantidade e Preço */}
                                  <div className="flex justify-between items-end gap-3 border-t border-[#111] pt-2 mt-1">
                                    <div className="flex-1">
                                      {item.produto.tipo === 'CELULAR' && tenantSettings.enable_imei ? (
                                        <div className="space-y-1">
                                          <label className="block text-[8px] font-bold text-gray-500 uppercase tracking-wide">IMEI Selecionado</label>
                                          {item.availableImeis && item.availableImeis.length > 0 ? (
                                            <select
                                              value={item.imei}
                                              onChange={(e) => handleUpdateCartImei(item.cartId, e.target.value)}
                                              className="w-full bg-black border border-[#222222] focus:border-[#6A0DAD] rounded px-2 py-1 text-[10px] text-white outline-none font-mono tracking-wider"
                                            >
                                              {item.availableImeis.map((im) => (
                                                <option key={im.id} value={im.imei}>
                                                  {im.imei}
                                                </option>
                                              ))}
                                            </select>
                                          ) : (
                                            <span className="text-[10px] text-red-500 font-bold block">{item.imei || 'Nenhum'}</span>
                                          )}
                                        </div>
                                      ) : (
                                        <div className="space-y-1">
                                          <label className="block text-[8px] font-bold text-gray-500 uppercase tracking-wide">Qtd</label>
                                          <div className="flex items-center gap-1.5">
                                            <button 
                                              type="button"
                                              onClick={() => handleUpdateCartQty(item.cartId, item.quantidade - 1)}
                                              className="w-5 h-5 border border-[#222] bg-[#111] rounded flex items-center justify-center text-[10px] text-white hover:bg-[#222]"
                                            >
                                              -
                                            </button>
                                            <span className="text-xs font-mono font-bold text-white min-w-[12px] text-center">{item.quantidade}</span>
                                            <button 
                                              type="button"
                                              onClick={() => handleUpdateCartQty(item.cartId, item.quantidade + 1)}
                                              className="w-5 h-5 border border-[#222] bg-[#111] rounded flex items-center justify-center text-[10px] text-white hover:bg-[#222]"
                                            >
                                              +
                                            </button>
                                          </div>
                                        </div>
                                      )}
                                    </div>

                                    {/* Ajuste de Preço */}
                                    <div className="flex flex-col items-end gap-1">
                                      <label className="text-[8px] font-bold text-gray-500 uppercase tracking-wide">Valor Unitário</label>
                                      <div className="relative">
                                        <span className="absolute left-1.5 top-1 text-[10px] text-gray-500 font-bold font-mono">R$</span>
                                        <input
                                          type="number"
                                          step="0.01"
                                          value={item.valorUnitario}
                                          onChange={(e) => handleUpdateCartPrice(item.cartId, e.target.value)}
                                          className="w-20 bg-black border border-[#222] focus:border-[#6A0DAD] rounded pl-6 pr-1.5 py-0.5 text-xs text-white text-right outline-none font-mono font-semibold"
                                        />
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {pdvCart.length > 0 && (
                            <div className="space-y-4">
                              {/* CADASTRO RÁPIDO DE CLIENTE */}
                              <div className="border-t border-[#222222] pt-4">
                                <div className="flex justify-between items-center w-full text-xs font-bold text-gray-400">
                                  <span className="flex items-center gap-1.5">
                                    <User size={14} className="text-[#6A0DAD]" />
                                    Vincular Cliente (Obrigatório)
                                  </span>
                                </div>

                                <div className="grid grid-cols-2 gap-3 mt-3 bg-[#111111]/40 border border-[#222222] p-4 rounded-lg">
                                  <div className="col-span-2 relative">
                                    <label className="block text-[9px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Nome Completo <span className="text-red-500">*</span></label>
                                    <input
                                      type="text"
                                      id="pdv-cliente-busca-input"
                                      value={pdvClienteSearchInput}
                                      onChange={(e) => {
                                        setPdvClienteSearchInput(e.target.value);
                                        setIsPdvClienteDropdownOpen(true);
                                        // Limpa a seleção caso o usuário digite algo diferente do nome já selecionado
                                        if (pdvClienteNome && e.target.value !== pdvClienteNome) {
                                          setPdvClienteNome('');
                                          setSelectedPdvClienteId(null);
                                        }
                                      }}
                                      onFocus={() => setIsPdvClienteDropdownOpen(true)}
                                      onBlur={() => {
                                        // Delay para permitir que o clique nos itens do dropdown funcione
                                        setTimeout(() => {
                                          setIsPdvClienteDropdownOpen(false);
                                        }, 200);
                                      }}
                                      className="w-full bg-black border border-[#222222] focus:border-[#6A0DAD] rounded text-white px-2.5 py-1.5 text-xs outline-none"
                                      placeholder="Ex: João da Silva (digite para buscar...)"
                                    />
                                    
                                    {/* Dropdown do Autocomplete */}
                                    {isPdvClienteDropdownOpen && (pdvClienteSearchInput.trim() || pdvClienteSearchResults.length > 0) && (
                                      <div className="absolute left-0 right-0 mt-1 bg-neutral-950 border border-neutral-800 rounded-md shadow-2xl max-h-60 overflow-y-auto z-50 custom-scrollbar text-xs">
                                        {pdvClienteSearchLoading && (
                                          <div className="p-3 text-gray-500 text-center flex items-center justify-center gap-2">
                                            <Loader2 size={12} className="animate-spin text-[#6A0DAD]" />
                                            <span>Buscando clientes...</span>
                                          </div>
                                        )}
                                        
                                        {!pdvClienteSearchLoading && pdvClienteSearchResults.length === 0 && (
                                          <div className="p-3 text-gray-400 text-center">
                                            Nenhum cliente encontrado.
                                          </div>
                                        )}
                                        
                                        {!pdvClienteSearchLoading && pdvClienteSearchResults.map((client) => (
                                          <button
                                            key={client.id}
                                            type="button"
                                            onMouseDown={(e) => {
                                              e.preventDefault();
                                              handleSelectPdvCliente(client);
                                            }}
                                            className="w-full text-left px-3 py-2 hover:bg-[#6A0DAD]/10 border-b border-neutral-900 flex flex-col gap-0.5 text-white transition-colors"
                                          >
                                            <span className="font-bold">{client.nome}</span>
                                            <span className="text-[10px] text-gray-400 font-mono">
                                              CPF/CNPJ: {client.cpf_cnpj || 'Não informado'} | Tel: {client.telefone || 'Não informado'}
                                            </span>
                                          </button>
                                        ))}
                                        
                                        {pdvClienteSearchInput.trim() && (
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setIsPdvClienteDropdownOpen(false);
                                              handleOpenNewClienteModal(pdvClienteSearchInput);
                                            }}
                                            className="w-full text-left px-3 py-2.5 bg-[#6A0DAD]/5 hover:bg-[#6A0DAD]/15 text-[#9b5de5] hover:text-[#b587eb] font-bold border-t border-neutral-900 transition-colors flex items-center gap-1.5"
                                          >
                                            <span>+</span>
                                            <span>Cliente não encontrado. Clique aqui para cadastrar "{pdvClienteSearchInput}"</span>
                                          </button>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                  
                                  <div>
                                    <div className="flex justify-between items-center mb-1">
                                      <label className="block text-[9px] font-semibold text-gray-500 uppercase tracking-wider font-mono">CPF / CNPJ <span className="text-red-500">*</span></label>
                                      {selectedPdvClienteId !== null && !isPdvClienteFieldsEditable && (
                                        <button
                                          type="button"
                                          onClick={() => setIsPdvClienteFieldsEditable(true)}
                                          className="text-[9px] text-[#9b5de5] hover:text-[#b587eb] font-bold transition-colors underline"
                                        >
                                          Editar
                                        </button>
                                      )}
                                    </div>
                                    <input
                                      type="text"
                                      id="pdv-cliente-cpf-input"
                                      value={pdvClienteCpfCnpj}
                                      disabled={selectedPdvClienteId !== null && !isPdvClienteFieldsEditable}
                                      onChange={(e) => setPdvClienteCpfCnpj(e.target.value.replace(/[^\d]/g, ''))}
                                      className="w-full bg-black border border-[#222222] focus:border-[#6A0DAD] disabled:bg-neutral-900 disabled:text-gray-500 rounded text-white px-2.5 py-1.5 text-xs outline-none font-mono"
                                      placeholder="000.000.000-00"
                                    />
                                  </div>
                                  
                                  <div>
                                    <div className="flex justify-between items-center mb-1">
                                      <label className="block text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Telefone</label>
                                      {selectedPdvClienteId !== null && !isPdvClienteFieldsEditable && (
                                        <button
                                          type="button"
                                          onClick={() => setIsPdvClienteFieldsEditable(true)}
                                          className="text-[9px] text-[#9b5de5] hover:text-[#b587eb] font-bold transition-colors underline"
                                        >
                                          Editar
                                        </button>
                                      )}
                                    </div>
                                    <input
                                      type="text"
                                      value={pdvClienteTelefone}
                                      disabled={selectedPdvClienteId !== null && !isPdvClienteFieldsEditable}
                                      onChange={(e) => setPdvClienteTelefone(e.target.value)}
                                      className="w-full bg-black border border-[#222222] focus:border-[#6A0DAD] disabled:bg-neutral-900 disabled:text-gray-500 rounded text-white px-2.5 py-1.5 text-xs outline-none font-sans"
                                      placeholder="(11) 99999-9999"
                                    />
                                  </div>
                                  
                                  <div className="col-span-2">
                                    <div className="flex justify-between items-center mb-1">
                                      <label className="block text-[9px] font-semibold text-gray-500 uppercase tracking-wider">E-mail</label>
                                      {selectedPdvClienteId !== null && !isPdvClienteFieldsEditable && (
                                        <button
                                          type="button"
                                          onClick={() => setIsPdvClienteFieldsEditable(true)}
                                          className="text-[9px] text-[#9b5de5] hover:text-[#b587eb] font-bold transition-colors underline"
                                        >
                                          Editar
                                        </button>
                                      )}
                                    </div>
                                    <input
                                      type="email"
                                      value={pdvClienteEmail}
                                      disabled={selectedPdvClienteId !== null && !isPdvClienteFieldsEditable}
                                      onChange={(e) => setPdvClienteEmail(e.target.value)}
                                      className="w-full bg-black border border-[#222222] focus:border-[#6A0DAD] disabled:bg-neutral-900 disabled:text-gray-500 rounded text-white px-2.5 py-1.5 text-xs outline-none"
                                      placeholder="cliente@email.com"
                                    />
                                  </div>
                                </div>
                              </div>

                              {/* FORMA DE PAGAMENTO */}
                              <div className="border-t border-[#222222] pt-4 space-y-3">
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide">
                                  Forma de Pagamento
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                  {[
                                    { value: 'pix', label: 'Pix' },
                                    { value: 'cartao', label: 'Cartão' },
                                    { value: 'dinheiro', label: 'Dinheiro' },
                                    { value: 'boleto', label: 'Boleto' },
                                    ...(tenantSettings.enable_troca ? [{ value: 'troca', label: 'Troca de Celular' }] : [])
                                  ].map((m) => (
                                    <button
                                      key={m.value}
                                      type="button"
                                      onClick={() => {
                                        setPdvMetodoPagamento(m.value);
                                        setPdvCartaoParcelas(1);
                                        setPdvMetodoRestante('pix');
                                      }}
                                      className={`py-2 px-1 rounded text-[10px] font-bold uppercase tracking-wider transition-all border ${
                                        pdvMetodoPagamento === m.value
                                          ? 'bg-[#6A0DAD] text-white border-[#6A0DAD]'
                                          : 'bg-black text-gray-400 border-[#222222] hover:text-white'
                                      }`}
                                    >
                                      {m.label}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              {/* MÓDULO DE TROCA */}
                              {pdvMetodoPagamento === 'troca' && (
                                <div className="space-y-4 pt-4 border-t border-[#222222]">
                                  {pdvUsadoList.length > 0 && (
                                    <div className="space-y-2">
                                      <span className="block text-[10px] font-black text-purple-400 uppercase tracking-wider">
                                        Aparelhos na Troca ({pdvUsadoList.length})
                                      </span>
                                      <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                                        {pdvUsadoList.map((u, idx) => (
                                          <div key={idx} className="bg-black border border-[#222222] p-2.5 rounded flex items-center justify-between gap-3 text-xs">
                                            <div className="min-w-0 flex-1">
                                              <p className="font-bold text-white truncate">{u.produto.nome}</p>
                                              <p className="text-[10px] text-gray-500 truncate font-mono">
                                                IMEI: {u.imei} · Bateria: {u.bateria}% · {u.cor}
                                              </p>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                              <span className="font-mono font-bold text-purple-400">
                                                - R$ {u.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                              </span>
                                              <button
                                                type="button"
                                                onClick={() => handleRemoverPdvUsado(u.imei)}
                                                className="text-gray-500 hover:text-red-450 p-0.5 rounded transition-colors"
                                              >
                                                <X size={14} />
                                              </button>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  <div className="space-y-3 bg-black border border-[#222222] p-4 rounded-lg animate-fadeIn">
                                    <span className="block text-[10px] font-bold text-white uppercase tracking-wider mb-1">
                                      Ficha do Aparelho Usado
                                    </span>
                                    
                                    <div className="relative">
                                      <label className="block text-[9px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
                                        1. Modelo do Aparelho Usado (Catálogo)
                                      </label>
                                      <input
                                        type="text"
                                        value={pdvUsadoNomeProduto}
                                        onChange={(e) => handlePdvUsadoBusca(e.target.value)}
                                        placeholder="Buscar modelo..."
                                        className={`w-full bg-black border rounded text-xs text-white px-3 py-2 placeholder-gray-600 outline-none transition-all ${
                                          pdvUsadoProdutoSelecionado ? 'border-[#6A0DAD]' : 'border-[#222222] focus:border-[#6A0DAD]'
                                        }`}
                                        autoComplete="off"
                                      />

                                      {pdvUsadoProdutoSelecionado && (
                                        <div className="mt-1.5 flex items-center justify-between bg-[#6A0DAD]/10 border border-[#6A0DAD]/40 rounded px-2.5 py-1 text-[11px] text-white">
                                          <p className="font-bold truncate">{pdvUsadoProdutoSelecionado.nome}</p>
                                          <button 
                                            type="button"
                                            onClick={() => { setPdvUsadoProdutoSelecionado(null); setPdvUsadoNomeProduto(''); }} 
                                            className="text-gray-500 hover:text-red-400 shrink-0 ml-2"
                                          >
                                            <X size={12} />
                                          </button>
                                        </div>
                                      )}

                                      {pdvUsadoSugestoes.length > 0 && (
                                        <div className="absolute z-35 left-0 right-0 mt-1 bg-[#111] border border-[#333] rounded shadow-2xl max-h-40 overflow-y-auto">
                                          {pdvUsadoSugestoes.map((p) => (
                                            <button
                                              key={p.id}
                                              type="button"
                                              onClick={() => handlePdvUsadoSelecionar(p)}
                                              className="w-full text-left px-3 py-2 hover:bg-[#6A0DAD]/15 text-xs text-white border-b border-[#222] last:border-0"
                                            >
                                              {p.nome}
                                            </button>
                                          ))}
                                        </div>
                                      )}
                                    </div>

                                    <div>
                                      <label className="block text-[9px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
                                        2. IMEI do Aparelho Usado (15 dígitos)
                                      </label>
                                      <input
                                        type="text"
                                        inputMode="numeric"
                                        value={pdvUsadoImei}
                                        onChange={(e) => setPdvUsadoImei(e.target.value.replace(/\D/g, '').slice(0, 15))}
                                        placeholder="IMEI..."
                                        maxLength={15}
                                        className="w-full bg-black border border-[#222] focus:border-[#6A0DAD] rounded text-xs text-white px-3 py-2 font-mono tracking-wider outline-none"
                                      />
                                    </div>

                                    <div className="grid grid-cols-2 gap-2">
                                      <div>
                                        <label className="block text-[9px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Cor</label>
                                        <input
                                          type="text"
                                          value={pdvUsadoCor}
                                          onChange={(e) => setPdvUsadoCor(e.target.value)}
                                          placeholder="Ex: Grafite"
                                          className="w-full bg-black border border-[#222] focus:border-[#6A0DAD] rounded text-xs text-white px-3 py-2 outline-none"
                                        />
                                      </div>
                                      <div>
                                        <label className="block text-[9px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Saúde Bateria (%)</label>
                                        <input
                                          type="number"
                                          min="1"
                                          max="100"
                                          value={pdvUsadoBateria}
                                          onChange={(e) => setPdvUsadoBateria(e.target.value)}
                                          placeholder="Ex: 85"
                                          className="w-full bg-black border border-[#222] focus:border-[#6A0DAD] rounded text-xs text-white px-3 py-2 outline-none"
                                        />
                                      </div>
                                    </div>

                                    <div>
                                      <label className="block text-[9px] font-semibold text-purple-400 uppercase tracking-wider mb-1 font-bold">Valor Avaliação (Crédito)</label>
                                      <div className="relative">
                                        <span className="absolute left-3 top-2.5 text-xs text-gray-500 font-bold">R$</span>
                                        <input
                                          type="number"
                                          min="0"
                                          step="0.01"
                                          value={pdvUsadoValor}
                                          onChange={(e) => setPdvUsadoValor(e.target.value)}
                                          placeholder="0.00"
                                          className="w-full bg-black border border-[#6A0DAD]/30 focus:border-[#6A0DAD] rounded text-xs text-white pl-9 pr-3 py-2 outline-none font-mono font-bold"
                                        />
                                      </div>
                                    </div>

                                    <div>
                                      <label className="block text-[9px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Checklist Visual</label>
                                      <textarea
                                        value={pdvUsadoObs}
                                        onChange={(e) => setPdvUsadoObs(e.target.value)}
                                        placeholder="Riscos, detalhes..."
                                        rows={2}
                                        className="w-full bg-black border border-[#222] focus:border-[#6A0DAD] rounded text-xs text-white px-3 py-2 outline-none resize-none font-sans"
                                      />
                                    </div>

                                    <button
                                      type="button"
                                      onClick={handleAdicionarPdvUsado}
                                      className="w-full bg-[#6A0DAD]/20 hover:bg-[#6A0DAD]/40 border border-[#6A0DAD]/40 text-white font-bold py-2 px-4 rounded text-xs transition-all flex items-center justify-center gap-1.5"
                                    >
                                      <Plus size={14} /> Adicionar na Troca
                                    </button>
                                  </div>
                                </div>
                              )}

                              {/* PAGAMENTO RESTANTE DA TROCA */}
                              {pdvMetodoPagamento === 'troca' && pdvUsadoList.length > 0 && pdvCart.reduce((sum, item) => sum + item.valorUnitario * item.quantidade, 0) - pdvUsadoList.reduce((acc, item) => acc + item.valor, 0) > 0 && (
                                <div className="border-t border-[#222222] pt-4 space-y-3 animate-fadeIn">
                                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide">
                                    Forma de Pagamento do Saldo Restante
                                  </label>
                                  <div className="grid grid-cols-3 gap-2">
                                    {['pix', 'cartao', 'dinheiro'].map((m) => (
                                      <button
                                        key={m}
                                        type="button"
                                        onClick={() => setPdvMetodoRestante(m)}
                                        className={`py-2 rounded text-xs font-bold uppercase tracking-wider transition-all border ${
                                          pdvMetodoRestante === m
                                            ? 'bg-[#6A0DAD] text-white border-[#6A0DAD]'
                                            : 'bg-black text-gray-400 border-[#222222] hover:text-white'
                                        }`}
                                      >
                                        {m === 'cartao' ? 'Cartão' : m === 'pix' ? 'Pix' : 'Dinheiro'}
                                      </button>
                                    ))}
                                  </div>

                                  {pdvMetodoRestante === 'cartao' && (
                                    <div className="space-y-1.5 animate-fadeIn">
                                      <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                                        Selecione as Parcelas
                                      </label>
                                      <select
                                        value={pdvCartaoParcelas}
                                        onChange={(e) => setPdvCartaoParcelas(parseInt(e.target.value, 10))}
                                        className="w-full bg-black border border-[#222222] focus:border-[#6A0DAD] rounded px-3 py-2 text-xs text-white outline-none font-mono font-bold"
                                      >
                                        {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => {
                                          const saldo = Math.max(0, pdvCart.reduce((sum, item) => sum + item.valorUnitario * item.quantidade, 0) - pdvUsadoList.reduce((acc, item) => acc + item.valor, 0));
                                          
                                          const feeObj = taxasCartao.find(t => t.parcelas === n);
                                          const feePercent = feeObj ? parseFloat(feeObj.taxa) : (1.5 + (n - 1));
                                          const adjusted = saldo * (1 + feePercent / 100);
                                          const valorParc = adjusted / n;
                                          
                                          return (
                                            <option key={n} value={n}>
                                              {n}x de R$ {valorParc.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} ({feePercent.toFixed(2)}% juros)
                                            </option>
                                          );
                                        })}
                                      </select>
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* SE FOR PAGAMENTO NORMAL EM CARTÃO */}
                              {pdvMetodoPagamento === 'cartao' && (
                                <div className="border-t border-[#222222] pt-4 space-y-3 animate-fadeIn">
                                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide">
                                    Parcelamento (Cartão)
                                  </label>
                                  <select
                                    value={pdvCartaoParcelas}
                                    onChange={(e) => setPdvCartaoParcelas(parseInt(e.target.value, 10))}
                                    className="w-full bg-black border border-[#222222] focus:border-[#6A0DAD] rounded px-3 py-2 text-xs text-white outline-none font-mono font-bold"
                                  >
                                    {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => {
                                      const totalOriginal = pdvCart.reduce((sum, item) => sum + item.valorUnitario * item.quantidade, 0);
                                      const feeObj = taxasCartao.find(t => t.parcelas === n);
                                      const feePercent = feeObj ? parseFloat(feeObj.taxa) : (1.5 + (n - 1));
                                      const adjustedTotal = totalOriginal * (1 + feePercent / 100);
                                      const valorParc = adjustedTotal / n;

                                      return (
                                        <option key={n} value={n}>
                                          {n}x de R$ {valorParc.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} ({feePercent.toFixed(2)}% juros)
                                        </option>
                                      );
                                    })}
                                  </select>
                                </div>
                              )}

                              {/* OBSERVACÕES DE GARANTIA */}
                              <div className="space-y-2 mt-4 border-t border-[#222] pt-4">
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide">
                                  Observações de Garantia <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                  value={pdvObsGarantia}
                                  onChange={(e) => setPdvObsGarantia(e.target.value)}
                                  className="w-full bg-black border border-[#222222] focus:border-[#6A0DAD] rounded px-3 py-2 text-xs text-white outline-none min-h-[60px]"
                                  placeholder="Detalhes sobre a garantia..."
                                  required
                                ></textarea>
                              </div>

                              {/* PARTICIPAÇÃO TREENER */}
                              <div className="mt-3 space-y-1 border-t border-[#222] pt-3">
                                <label htmlFor="pdvTreenerSelect" className="block text-xs font-bold text-gray-400 uppercase tracking-wide flex items-center justify-between">
                                  <span>Treener Responsável (Participação)</span>
                                  {selectedTreenerId && (
                                    <span className="text-[10px] text-purple-400 bg-purple-950/40 px-1.5 py-0.5 rounded border border-purple-800/40 font-mono">
                                      Selecionado
                                    </span>
                                  )}
                                </label>
                                <select
                                  id="pdvTreenerSelect"
                                  value={selectedTreenerId}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setSelectedTreenerId(val);
                                    setPdvVendaTrainee(!!val);
                                  }}
                                  className="w-full bg-black border border-[#222222] focus:border-[#6A0DAD] rounded px-3 py-2 text-xs text-white outline-none cursor-pointer"
                                >
                                  <option value="">Sem participação de Treener</option>
                                  {treenersFilial.map((t) => (
                                    <option key={t.id} value={t.id}>
                                      {t.nome} {t.role ? `(${t.role})` : ''}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              {/* RESUMO FINANCEIRO */}
                              {(() => {
                                const subtotal = pdvCart.reduce((sum, item) => sum + item.valorUnitario * item.quantidade, 0);
                                const abatimento = pdvMetodoPagamento === 'troca' ? pdvUsadoList.reduce((acc, item) => acc + item.valor, 0) : 0;
                                const saldoOriginal = Math.max(0, subtotal - abatimento);
                                
                                const isCartao = (pdvMetodoPagamento === 'troca' && pdvUsadoList.length > 0 && saldoOriginal > 0 && pdvMetodoRestante === 'cartao') || pdvMetodoPagamento === 'cartao';
                                
                                let feePercent = 0;
                                if (isCartao) {
                                  const feeObj = taxasCartao.find(t => t.parcelas === pdvCartaoParcelas);
                                  feePercent = feeObj ? parseFloat(feeObj.taxa) : (1.5 + (pdvCartaoParcelas - 1));
                                }
                                
                                const valorJuros = saldoOriginal * (feePercent / 100);
                                const totalPagar = saldoOriginal + valorJuros;

                                return (
                                  <div className="border-t border-[#222222] pt-4 space-y-2 bg-[#111111]/40 p-3 rounded-lg border border-[#222222]/85">
                                    <div className="flex justify-between items-center text-xs">
                                      <span className="text-gray-400">Subtotal:</span>
                                      <span className="text-white font-mono">
                                        R$ {subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                      </span>
                                    </div>

                                    {abatimento > 0 && (
                                      <div className="flex justify-between items-center text-xs">
                                        <span className="text-purple-400">Abatimento por Troca:</span>
                                        <span className="text-purple-400 font-mono font-bold">
                                          - R$ {abatimento.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                        </span>
                                      </div>
                                    )}

                                    {valorJuros > 0 && (
                                      <div className="flex justify-between items-center text-xs">
                                        <span className="text-red-400">Taxa Máquina ({feePercent.toFixed(2)}%):</span>
                                        <span className="text-red-400 font-mono">
                                          + R$ {valorJuros.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                        </span>
                                      </div>
                                    )}

                                    <div className="flex justify-between items-center border-t border-[#222222] pt-2">
                                      <span className="text-xs font-black text-white uppercase tracking-wider">Total a Pagar:</span>
                                      <span className="text-lg font-mono font-black text-white">
                                        R$ {totalPagar.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })()}

                              {/* AÇÕES DE CHECKOUT */}
                              <div className="flex gap-2 border-t border-[#222222] pt-4">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setPdvCart([]);
                                    setPdvObsGarantia('');
                                    setPdvClienteNome('');
                                    setPdvClienteCpfCnpj('');
                                    setPdvClienteEmail('');
                                    setPdvClienteTelefone('');
                                    setPdvClienteSearchInput('');
                                    setPdvClienteSearchResults([]);
                                    setSelectedPdvClienteId(null);
                                    setIsPdvClienteFieldsEditable(false);
                                    setPdvUsadoList([]);
                                    setPdvMetodoPagamento('pix');
                                    setPdvMetodoRestante('pix');
                                    setPdvCartaoParcelas(1);
                                    setIsQuickClientFormOpen(true);
                                    sessionStorage.removeItem('zenite_pdv_draft');
                                  }}
                                  className="flex-1 border border-[#222222] hover:border-red-950 hover:text-red-400 bg-black text-xs font-bold py-3 rounded transition-all"
                                >
                                  Cancelar
                                </button>
                                <button
                                  type="button"
                                  onClick={handleConfirmarVendaCarrinho}
                                  disabled={
                                    loadingPdvVenda || 
                                    pdvCart.length === 0 ||
                                    (pdvMetodoPagamento === 'troca' && pdvUsadoList.length === 0) ||
                                    !pdvClienteNome.trim() ||
                                    !(pdvClienteCpfCnpj.replace(/\D/g, '').length === 11 || pdvClienteCpfCnpj.replace(/\D/g, '').length === 14)
                                  }
                                  className="flex-1 bg-[#6A0DAD] hover:bg-[#500885] disabled:bg-[#111111] disabled:text-gray-600 disabled:cursor-not-allowed text-xs font-bold py-3 rounded transition-all flex items-center justify-center gap-1 shadow-md shadow-[#6A0DAD]/20"
                                >
                                  {loadingPdvVenda ? 'Processando...' : 'Finalizar Venda [F10]'}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>

                      </div>
                    </div>
    );
  };

  const getTopRightHeaderName = () => {
    if (!profile) return 'Rede Cred';
    const role = profile.role;
    
    // Se for Vendedor ou Estoquista, tenta exibir o nome da filial dele
    if (['VENDEDOR', 'ESTOQUISTA'].includes(role)) {
      if (profile.filial_id && filiais && filiais.length > 0) {
        const userFilial = filiais.find(f => f.id === profile.filial_id);
        if (userFilial && userFilial.nome) {
          return userFilial.nome;
        }
      }
      if (activeFilialNome) {
        return activeFilialNome;
      }
      return 'Rede Cred';
    }
    
    return 'Rede Cred';
  };

  const getCertificadoFileName = (path) => {
    if (!path) return '';
    const parts = path.split('/');
    const rawName = parts[parts.length - 1];
    return rawName.replace(/^\d{13}_/, '');
  };

  const getViewLabel = () => {
    switch (currentView) {
      case 'supremo': return 'Painel Supremo';
      case 'gestao': return 'Dashboard';
      case 'pdv': return 'Frente de Caixa (PDV)';
      case 'clientes': return 'Cadastro de Clientes';
      case 'equipe': return 'Equipe / Funcionários';
      case 'descontos': return 'Auditoria de Descontos por Vendedor';
      case 'estoque': return 'Entrada de Estoque';
      case 'categorias': return 'Categorias';
      case 'transferencias': return 'Transferências de Estoque';
      case 'ranking': return 'Metas & Rankings';
      case 'metas': return 'Minhas Metas & Comissões';
      case 'fechamentos': return 'Relatórios & Fechamentos';
      case 'fechamento': return 'Fechamento de Caixa';
      case 'configuracoes': return 'Configurações';
      default: return 'Zênite';
    }
  };

  const renderSidebarItems = () => {
    if (!profile) return null;

    const currentRole = profile.role;
    const userEmail = (profile.email || session?.user?.email || '').toLowerCase().trim();
    
    // Checagem estrita por email e por role para o Gerente Rodrigo
    const isGerente = currentRole === 'GERENTE' || userEmail === 'rodrigo.gerenciamonkeyshop@gmail.com';
    const isAdmin = (currentRole === 'ADMIN' || currentRole === 'SUPER_ADMIN' || userEmail === 'valentimodz2@gmail.com' || userEmail === 'valentimodz2@gmail.com') && !isGerente;
    
    const itemClass = (view) => {
      const active = currentView === view;
      return `flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-bold transition-all w-full text-left ${
        active 
          ? 'bg-[#6A0DAD] text-white shadow-lg shadow-[#6A0DAD]/10' 
          : 'text-gray-400 hover:text-white hover:bg-white/5'
      }`;
    };

    const iconOnlyClass = (view) => {
      const active = currentView === view;
      return `flex items-center justify-center p-3 rounded-lg transition-all w-full ${
        active 
          ? 'bg-[#6A0DAD] text-white shadow-lg shadow-[#6A0DAD]/10' 
          : 'text-gray-400 hover:text-white hover:bg-white/5'
      }`;
    };

    const sidebarItem = (view, label, IconComponent) => {
      if (sidebarOpen) {
        return (
          <button
            key={view}
            onClick={() => handleNavigate(view)}
            className={itemClass(view)}
          >
            <IconComponent size={16} className="shrink-0" />
            <span>{label}</span>
          </button>
        );
      } else {
        return (
          <button
            key={view}
            onClick={() => handleNavigate(view)}
            className={iconOnlyClass(view)}
            title={label}
          >
            <IconComponent size={18} className="shrink-0" />
          </button>
        );
      }
    };

    const items = [];

    // 1. Painel Supremo
    if (currentRole === 'SUPER_ADMIN' && !isGerente) {
      items.push(sidebarItem('supremo', 'Painel Supremo', Shield));
    }

    // 2. Dashboard Home
    if (['SUPER_ADMIN', 'ADMIN', 'GERENTE', 'OWNER', 'DONO'].includes(currentRole)) {
      items.push(sidebarItem('gestao', 'Dashboard (Home)', LayoutDashboard));
    }

    // 3. Frente de Caixa (PDV) - Oculto para DONO (perfil executivo somente leitura)
    if (!isGerente && ['SUPER_ADMIN', 'ADMIN', 'OWNER', 'VENDEDOR'].includes(currentRole) && currentRole !== 'DONO') {
      items.push(sidebarItem('pdv', 'Frente de Caixa (PDV)', ShoppingBag));
    }

    // 4. Clientes - Oculto para DONO
    if (['SUPER_ADMIN', 'ADMIN', 'GERENTE', 'OWNER', 'VENDEDOR'].includes(currentRole) && currentRole !== 'DONO') {
      items.push(sidebarItem('clientes', 'Clientes', Users));
    }

    // 4.6. Transferências (Liberado para Vendedores) - Oculto para DONO
    if (currentRole === 'VENDEDOR') {
      items.push(sidebarItem('transferencias', 'Transferências', Truck));
    }

    // 4.5. Equipe / Funcionários (Visibilidade EXCLUSIVA para ADMIN, SUPER_ADMIN, OWNER, DONO, RH e GERENTE)
    if (['SUPER_ADMIN', 'ADMIN', 'GERENTE', 'OWNER', 'DONO', 'RH'].includes(currentRole)) {
      items.push(sidebarItem('equipe', 'Equipe / Funcionários', UserPlus));
    }

    // 4.7. Auditoria de Descontos (Visível para GERENTE, ADMIN, SUPER_ADMIN, OWNER, DONO)
    if (['SUPER_ADMIN', 'ADMIN', 'GERENTE', 'OWNER', 'DONO'].includes(currentRole)) {
      items.push(sidebarItem('descontos', 'Auditoria de Descontos', Tag));
    }

    // 5. Gestão de Estoque
    if (!isGerente && ['SUPER_ADMIN', 'ADMIN', 'OWNER', 'DONO', 'ESTOQUISTA'].includes(currentRole)) {
      const showEstoque = !isGerente;
      const showTransferencias = !isGerente && currentRole !== 'DONO';
      const showCategorias = !isGerente && currentRole !== 'DONO';

      if (sidebarOpen) {
        items.push(
          <div key="agrupador-estoque" className="space-y-1">
            <button
              onClick={() => setEstoqueSubMenuOpen(!estoqueSubMenuOpen)}
              className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-xs font-bold text-gray-500 hover:text-white w-full text-left transition-all"
            >
              <div className="flex items-center gap-3">
                <Package size={16} className="shrink-0" />
                <span>Gestão de Estoque</span>
              </div>
              <ChevronDown size={14} className={`transition-transform duration-200 ${estoqueSubMenuOpen ? 'rotate-180' : ''}`} />
            </button>
            {estoqueSubMenuOpen && (
              <div className="pl-4 space-y-1 border-l border-[#222222]/80 ml-5">
                {showEstoque && sidebarItem('estoque', currentRole === 'DONO' ? 'Torre de Controle (Estoque)' : 'Entrada de Estoque', Database)}
                {showCategorias && sidebarItem('categorias', 'Categorias', Tag)}
                {showTransferencias && sidebarItem('transferencias', 'Transferências', Truck)}
              </div>
            )}
          </div>
        );
      } else {
        if (showEstoque) items.push(sidebarItem('estoque', currentRole === 'DONO' ? 'Torre de Controle' : 'Entrada de Estoque', Database));
        if (showCategorias) items.push(sidebarItem('categorias', 'Categorias', Tag));
        if (showTransferencias) items.push(sidebarItem('transferencias', 'Transferências', Truck));
      }
    }

    // 6. Metas & Rankings
    if (['GERENTE'].includes(currentRole)) {
      items.push(sidebarItem('ranking', 'Metas & Rankings', Award));
    } else if (currentRole === 'VENDEDOR') {
      items.push(sidebarItem('metas', 'Minhas Metas & Comissões', Award));
    }

    // 7. Relatórios & Fechamentos
    if (['SUPER_ADMIN', 'ADMIN', 'GERENTE', 'OWNER', 'DONO'].includes(currentRole)) {
      items.push(sidebarItem('fechamentos', 'Relatórios & Fechamentos', ClipboardList));
    } else if (currentRole === 'VENDEDOR') {
      items.push(sidebarItem('fechamento', 'Fechamento de Caixa', ClipboardList));
    }

    // 8. Configurações - Oculto para DONO
    if (currentRole !== 'DONO') {
      items.push(sidebarItem('configuracoes', 'Configurações', Settings));
    }

    // 9. Assinatura & Faturas - Oculto para DONO
    if (!isGerente && (['SUPER_ADMIN', 'OWNER', 'ADMIN'].includes(currentRole) || isAdmin) && currentRole !== 'DONO') {
      items.push(sidebarItem('assinatura', 'Assinatura & Faturas', CreditCard));
    }

    // Filtro de segurança final extra
    return items.filter(item => {
      if (!item) return false;
      if (isGerente) {
        const key = item.key;
        if (['estoque', 'transferencias', 'assinatura', 'pdv'].includes(key)) {
          return false;
        }
      }
      if (currentRole === 'DONO') {
        const key = item.key;
        if (['pdv', 'clientes', 'categorias', 'transferencias', 'assinatura', 'configuracoes'].includes(key)) {
          return false;
        }
      }
      return true;
    });
  };

  return (
    <div className="min-h-screen bg-black text-white font-sans flex selection:bg-[#6A0DAD] selection:text-white w-full">
      {/* MENU LATERAL (SIDEBAR) */}
      <aside className={`bg-[#0A0A0A] border-r border-[#222222] min-h-screen flex flex-col transition-all duration-300 ${sidebarOpen ? 'w-64' : 'w-20'} sticky top-0 shrink-0 z-30 print:hidden`}>
        {/* LOGO */}
        <div className="p-4 border-b border-[#222222] flex items-center justify-between h-14">
          {sidebarOpen ? (
            <h1 className="text-lg font-extrabold tracking-tight text-white flex items-center gap-1.5 animate-fadeIn">
              Zênite<span className="text-[#6A0DAD]">.</span>
            </h1>
          ) : (
            <span className="text-lg font-extrabold text-[#6A0DAD] mx-auto">Z.</span>
          )}
          {sidebarOpen && (
            <button 
              onClick={() => { setSidebarOpen(false); localStorage.setItem('zenite_sidebar_open', 'false'); }}
              className="text-gray-500 hover:text-white transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
          )}
        </div>

        {/* SELETOR GLOBAL DE FILIAIS (SIDEBAR) */}
        {(() => {
          const userEmail = (profile?.email || session?.user?.email || '').toLowerCase().trim();
          const role = profile?.role;

          // VENDEDOR: Ocultar o seletor completamente do menu lateral
          if (role === 'VENDEDOR') {
            return null;
          }

          // Roles autorizadas a ver e usar o seletor: ADMIN, GERENTE, RH, SUPER_ADMIN, OWNER, DONO
          const canViewSelector = ['ADMIN', 'GERENTE', 'RH', 'SUPER_ADMIN', 'OWNER', 'DONO'].includes(role) || userEmail === 'valentimodz2@gmail.com';
          if (!canViewSelector) {
            return null;
          }

          const isRodrigoGerenteLocked = false;
          const gerenteFilialNome = activeFilialNome || filiais.find(f => f.id === profile?.filial_id)?.nome || 'Filial Vinculada';

          if (!sidebarOpen) {
            return (
              <div className="p-3 border-b border-[#222222] flex justify-center" title={`Filial Ativa: ${activeFilialNome || 'Todas as Filiais'}`}>
                <div className="w-9 h-9 rounded-lg bg-[#6A0DAD]/10 border border-[#6A0DAD]/30 flex items-center justify-center text-[#6A0DAD]">
                  <Store size={18} />
                </div>
              </div>
            );
          }

          return (
            <div className="px-3 py-3 border-b border-[#222222] bg-[#050505]">
              <div className="flex items-center justify-between mb-1.5 px-0.5">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                  <Store size={12} className="text-[#6A0DAD]" />
                  Filial de Operação
                </span>
                {isRodrigoGerenteLocked && (
                  <span className="text-[9px] bg-purple-950/80 text-purple-300 px-1.5 py-0.5 rounded border border-purple-800/50 font-mono flex items-center gap-1">
                    <Lock size={10} /> Trava Gerente
                  </span>
                )}
              </div>

              {isRodrigoGerenteLocked ? (
                <div className="bg-[#111111] border border-[#222222] text-gray-300 px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-between opacity-90 shadow-inner" title="Filial fixa associada ao perfil de Gerente">
                  <span className="truncate">{gerenteFilialNome}</span>
                  <Lock size={12} className="text-gray-500 shrink-0 ml-1" />
                </div>
              ) : (
                <div className="relative">
                  <select
                    value={activeFilialId || ''}
                    onChange={(e) => {
                      const selectedId = e.target.value;
                      const selectedFilial = filiais.find(f => f.id === selectedId);
                      const selectedNome = selectedFilial ? selectedFilial.nome : 'Todas as Filiais';
                      
                      setActiveFilialId(selectedId);
                      setActiveFilialNome(selectedNome);
                      localStorage.setItem('zenite_active_filial_id', selectedId);
                      localStorage.setItem('zenite_active_filial_nome', selectedNome);

                      const tenantId = profile?.empresa_id;
                      if (tenantId) {
                        fetchGerenteData(tenantId);
                        if (selectedId) {
                          fetchVendedorData(selectedId, session?.user?.id, tenantId);
                          fetchTransferencias(selectedId, tenantId);
                        }
                      }
                    }}
                    className="w-full bg-[#111111] border border-[#222222] focus:border-[#6A0DAD] text-white pl-2.5 pr-7 py-2 rounded-lg text-xs font-bold outline-none cursor-pointer transition-all hover:bg-[#161616] appearance-none"
                  >
                    <option value="">[ Todas as Filiais ]</option>
                    {filiais.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.nome} ({f.tipo === 'LOJA' ? 'PDV' : 'Estoque'})
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
              )}
            </div>
          );
        })()}
        
        {/* NAV ITEMS */}
        <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1.5 custom-scrollbar">
          {!sidebarOpen && (
            <button
              onClick={() => { setSidebarOpen(true); localStorage.setItem('zenite_sidebar_open', 'true'); }}
              className="w-full flex items-center justify-center p-3 text-gray-500 hover:text-white hover:bg-white/5 rounded-lg transition-all mb-4"
              title="Expandir Menu"
            >
              <Menu size={20} />
            </button>
          )}
          {renderSidebarItems()}
        </div>

        {/* SIDEBAR FOOTER */}
        <div className="p-4 border-t border-[#222222] flex items-center justify-center">
          <span className="text-[10px] text-gray-600 font-mono">{sidebarOpen ? 'Rede Cred v1.2' : 'v1.2'}</span>
        </div>
      </aside>

      {/* MAIN CONTAINER */}
      <div className="flex-1 flex flex-col min-h-screen min-w-0">
        {/* SLENDER FIXED NAVBAR */}
        <header className="border-b border-[#222222] bg-[#0A0A0A] py-3 px-6 md:px-12 flex justify-between items-center h-14 sticky top-0 z-20 print:hidden">
          <div className="flex items-center gap-2">
            {!sidebarOpen && (
              <button 
                onClick={() => { setSidebarOpen(true); localStorage.setItem('zenite_sidebar_open', 'true'); }}
                className="p-1 rounded-lg border border-[#222222] text-gray-400 hover:text-white bg-black hover:bg-[#111] transition-all mr-2"
                title="Expandir Menu"
              >
                <Menu size={16} />
              </button>
            )}
            <span className="text-xs bg-[#6A0DAD]/10 text-purple-400 border border-[#6A0DAD]/30 px-2.5 py-1 rounded font-bold uppercase tracking-wider">
              {getViewLabel()}
            </span>
          </div>

          <div className="flex items-center gap-4">
            {profile?.role === 'SUPER_ADMIN' && (
              <div className="flex items-center gap-2 mr-2">
                {window.location.pathname === '/super-admin' ? (
                  <>
                    <button
                      onClick={() => window.location.href = '/dashboard/ceo'}
                      className="text-xs bg-transparent hover:bg-white/5 text-gray-400 hover:text-white border border-gray-800 rounded px-2.5 py-1.5 font-medium transition-all"
                    >
                      Painel CEO
                    </button>
                    <button
                      onClick={() => window.location.href = '/'}
                      className="text-xs bg-transparent hover:bg-white/5 text-gray-400 hover:text-white border border-gray-800 rounded px-2.5 py-1.5 font-medium transition-all"
                    >
                      Painel Geral
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => window.location.href = '/super-admin'}
                    className="text-xs bg-[#6A0DAD]/10 hover:bg-[#6A0DAD]/20 text-purple-400 hover:text-purple-300 border border-[#6A0DAD]/30 rounded px-2.5 py-1.5 font-medium transition-all flex items-center gap-1"
                  >
                    <Shield size={12} />
                    Painel Super Admin
                  </button>
                )}
              </div>
            )}
            <div className="flex flex-col text-right">
              <span className="text-xs font-bold text-white leading-tight">{getTopRightHeaderName()}</span>
              <span className="text-[10px] text-gray-500 font-medium">
                {profile?.nome} | {profile?.role}
              </span>
            </div>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-1.5 border border-[#222222] hover:border-red-800/60 hover:text-red-400 bg-black px-3 py-1.5 rounded-md text-xs font-semibold transition-all"
            >
              <LogOut size={12} />
              <span>Sair</span>
            </button>
          </div>
        </header>

        {/* Global notice banner inside content container */}
        {globalNotices.filter(n => n.active).length > 0 && profile?.role !== 'SUPER_ADMIN' && (
          <div className="bg-[#6A0DAD] text-white p-2.5 text-center text-xs font-medium flex items-center justify-center gap-2 relative z-10 shadow-md">
            <Megaphone size={14} />
            {globalNotices.filter(n => n.active)[0].message}
          </div>
        )}

        {/* FLUID CONTENT AREA */}
        <main className="flex-1 p-6 md:p-8 w-full max-w-[1600px] mx-auto min-w-0">
          {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-12 h-12 border-4 border-[#6A0DAD] border-t-transparent rounded-full animate-spin"></div>
            <p className="text-gray-500 text-sm">Carregando informações do sistema...</p>
          </div>
        ) : error ? (
          <div className="bg-red-950/20 border border-red-800 rounded-lg p-8 max-w-xl mx-auto text-center flex flex-col items-center gap-4">
            <AlertCircle size={40} className="text-red-500" />
            <h3 className="text-lg font-bold text-white">Falha ao Inicializar Sessão</h3>
            <p className="text-sm text-red-400 leading-relaxed mb-2">{error}</p>
            <div className="flex flex-col sm:flex-row gap-3 w-full justify-center">
              <button
                onClick={fetchProfileAndCompany}
                className="bg-[#6A0DAD] hover:bg-[#500885] text-white px-6 py-2.5 rounded-md font-semibold text-sm transition-colors"
              >
                Tentar Novamente
              </button>
              <button
                onClick={handleSignOut}
                className="border border-[#222222] hover:border-red-800 hover:text-red-400 bg-black text-white px-6 py-2.5 rounded-md font-semibold text-sm transition-colors flex items-center justify-center gap-2"
              >
                <LogOut size={16} />
                Sair da Conta
              </button>
            </div>
          </div>
        ) : (profile?.role === 'SUPER_ADMIN' && currentView === 'supremo') ? (
          /* PAINEL SUPREMO DO ADMINISTRADOR */
          <div className="space-y-8">
            <div className="bg-gradient-to-r from-[#0C001C] to-black border border-purple-900/30 p-8 rounded-lg">
              <h2 className="text-2xl md:text-3xl font-extrabold text-white flex items-center gap-3">
                <Shield className="text-purple-400" size={32} />
                Painel Central do Administrador
              </h2>
              <p className="text-gray-400 text-sm mt-2">
                Controle central de licenças, status de pagamento e volume transacionado no Zênite.
              </p>
            </div>

            {/* Métricas Globais */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-[#0A0A0A] border border-[#222222] p-6 rounded-lg">
                <span className="text-xs text-gray-500 uppercase font-semibold tracking-wider">Total de Empresas</span>
                <div className="text-3xl font-black mt-2 text-white">{totalCompanies}</div>
              </div>
              <div className="bg-[#0A0A0A] border border-[#222222] p-6 rounded-lg border-l-4 border-l-green-500">
                <span className="text-xs text-gray-500 uppercase font-semibold tracking-wider">Empresas Ativas</span>
                <div className="text-3xl font-black mt-2 text-green-400">{activeCompanies}</div>
              </div>
              <div className="bg-[#0A0A0A] border border-[#222222] p-6 rounded-lg border-l-4 border-l-red-500">
                <span className="text-xs text-gray-500 uppercase font-semibold tracking-wider">Empresas Inativas (Inadimplência)</span>
                <div className="text-3xl font-black mt-2 text-red-400">{inactiveCompanies}</div>
              </div>
              <div className="bg-[#0A0A0A] border border-[#222222] p-6 rounded-lg border-l-4 border-l-purple-500">
                <span className="text-xs text-gray-500 uppercase font-semibold tracking-wider">Faturamento Estimado</span>
                <div className="text-3xl font-black mt-2 text-purple-400">
                  R$ {simulatedSalesVolume.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
            </div>

            {/* Módulo de Provisionamento Multi-Tenant (Vextron Lab) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* MÓDULO 1: CADASTRAR NOVA EMPRESA */}
              <div className="lg:col-span-5 bg-[#0A0A0A] border border-[#222222] rounded-lg p-6 flex flex-col shadow-xl">
                <div className="flex items-center gap-2 mb-4 border-b border-[#222222] pb-3">
                  <Building className="text-[#6A0DAD]" size={20} />
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                    Módulo 1: Cadastrar Nova Empresa (Tenant)
                  </h3>
                </div>

                {provisionCompMessage.text && (
                  <div
                    className={`mb-4 p-3 rounded-md text-xs border flex items-start gap-2 ${
                      provisionCompMessage.type === 'success'
                        ? 'bg-green-950/20 border-green-800 text-green-400'
                        : 'bg-red-950/20 border-red-800 text-red-400'
                    }`}
                  >
                    {provisionCompMessage.type === 'success' ? (
                      <CheckCircle2 size={16} className="shrink-0 mt-0.5 text-green-500" />
                    ) : (
                      <AlertTriangle size={16} className="shrink-0 mt-0.5 text-red-500" />
                    )}
                    <span>{provisionCompMessage.text}</span>
                  </div>
                )}

                <form onSubmit={handleSuperAdminCreateCompany} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                      Nome da Empresa / Tenant
                    </label>
                    <input
                      type="text"
                      value={provisionCompanyName}
                      onChange={(e) => setProvisionCompanyName(e.target.value)}
                      placeholder="Ex: Rede Cred, Tech Cell, etc."
                      className="w-full bg-black border border-[#333] focus:border-[#6A0DAD] rounded text-white px-3 py-2 text-xs placeholder-gray-600 outline-none transition-all"
                      required
                      disabled={provisionCompLoading}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={provisionCompLoading}
                    className="w-full bg-[#6A0DAD] hover:bg-[#500885] disabled:bg-gray-800 disabled:text-gray-500 text-white font-bold py-2 px-4 rounded transition-colors flex items-center justify-center gap-2 text-xs"
                  >
                    {provisionCompLoading ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      'Registrar Empresa'
                    )}
                  </button>
                </form>
              </div>

              {/* MÓDULO 2: PROVISIONAR USUÁRIO */}
              <div className="lg:col-span-7 bg-[#0A0A0A] border border-[#222222] rounded-lg p-6 flex flex-col shadow-xl">
                <div className="flex items-center gap-2 mb-4 border-b border-[#222222] pb-3">
                  <UserPlus className="text-[#6A0DAD]" size={20} />
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                    Módulo 2: Fábrica de Usuários (Provisionar Novo Acesso)
                  </h3>
                </div>

                {provisionUserMessage.text && (
                  <div
                    className={`mb-4 p-3 rounded-md text-xs border flex items-start gap-2 ${
                      provisionUserMessage.type === 'success'
                        ? 'bg-green-950/20 border-green-800 text-green-400'
                        : 'bg-red-950/20 border-red-800 text-red-400'
                    }`}
                  >
                    {provisionUserMessage.type === 'success' ? (
                      <CheckCircle2 size={16} className="shrink-0 mt-0.5 text-green-500" />
                    ) : (
                      <AlertTriangle size={16} className="shrink-0 mt-0.5 text-red-500" />
                    )}
                    <span>{provisionUserMessage.text}</span>
                  </div>
                )}

                <form onSubmit={handleSuperAdminProvisionUser} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                        Nome Completo
                      </label>
                      <input
                        type="text"
                        value={provisionUserName}
                        onChange={(e) => setProvisionUserName(e.target.value)}
                        placeholder="Ex: Pedro de Souza"
                        className="w-full bg-black border border-[#333] focus:border-[#6A0DAD] rounded text-white px-3 py-2 text-xs placeholder-gray-600 outline-none transition-all"
                        required
                        disabled={provisionUserLoading}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                        E-mail do Usuário
                      </label>
                      <input
                        type="email"
                        value={provisionUserEmail}
                        onChange={(e) => setProvisionUserEmail(e.target.value)}
                        placeholder="Ex: pedro@loja.com"
                        className="w-full bg-black border border-[#333] focus:border-[#6A0DAD] rounded text-white px-3 py-2 text-xs placeholder-gray-600 outline-none transition-all"
                        required
                        disabled={provisionUserLoading}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                        Senha Temporária
                      </label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center text-gray-505">
                          <Key size={12} className="text-gray-500" />
                        </span>
                        <input
                          type="text"
                          value={provisionUserPassword}
                          onChange={(e) => setProvisionUserPassword(e.target.value)}
                          placeholder="Mínimo 6 caracteres"
                          className="w-full bg-black border border-[#333] focus:border-[#6A0DAD] rounded text-white pl-8 pr-3 py-2 text-xs placeholder-gray-600 outline-none transition-all"
                          required
                          disabled={provisionUserLoading}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                        Nível de Acesso (Role)
                      </label>
                      <select
                        value={provisionUserRole}
                        onChange={(e) => setProvisionUserRole(e.target.value)}
                        className="w-full bg-black border border-[#333] focus:border-[#6A0DAD] rounded text-white px-3 py-2 text-xs outline-none transition-all"
                        required
                        disabled={provisionUserLoading}
                      >
                        <option value="DONO">DONO (Dono da Loja)</option>
                        <option value="OWNER">OWNER (Dono / C-Level)</option>
                        <option value="ADMIN">ADMIN (Gerente Geral)</option>
                        <option value="RH">RH (Recursos Humanos)</option>
                        <option value="RH_ADMIN">RH_ADMIN (Recursos Humanos)</option>
                        <option value="VENDEDOR">VENDEDOR (Operacional PDV)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                      Empresa Vinculada (Tenant)
                    </label>
                    {allCompanies.length === 0 ? (
                      <div className="text-xs text-amber-500 bg-amber-950/20 border border-amber-900/30 p-2.5 rounded flex items-center gap-2">
                        <HelpCircle size={14} />
                        <span>Cadastre uma empresa primeiro para poder provisionar usuários.</span>
                      </div>
                    ) : (
                      <select
                        value={provisionUserCompanyId}
                        onChange={(e) => setProvisionUserCompanyId(e.target.value)}
                        className="w-full bg-black border border-[#333] focus:border-[#6A0DAD] rounded text-white px-3 py-2 text-xs outline-none transition-all"
                        required
                        disabled={provisionUserLoading}
                      >
                        <option value="" disabled>Selecione uma empresa...</option>
                        {allCompanies.map((company) => (
                          <option key={company.id} value={company.id}>
                            {company.nome}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={provisionUserLoading || allCompanies.length === 0}
                    className="w-full bg-[#6A0DAD] hover:bg-[#500885] disabled:bg-gray-800 disabled:text-gray-500 text-white font-bold py-2.5 px-4 rounded transition-colors flex items-center justify-center gap-2 text-xs"
                  >
                    {provisionUserLoading ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      'Provisionar Acesso com Sucesso'
                    )}
                  </button>
                </form>
              </div>
            </div>

            {/* Ferramentas de Relacionamento (Vextron Lab) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Mural de Avisos Globais */}
              <div className="bg-[#0A0A0A] border border-[#222222] rounded-lg p-6 flex flex-col">
                <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
                  <Megaphone size={18} className="text-blue-400" />
                  Mural de Avisos Globais
                </h3>
                <div className="flex flex-col gap-3 flex-1">
                  <textarea
                    value={newNoticeText}
                    onChange={(e) => setNewNoticeText(e.target.value)}
                    placeholder="Digite um aviso que aparecerá para todas as lojas clientes..."
                    className="w-full bg-black border border-[#333] text-white p-3 rounded h-24 resize-none"
                  />
                  <button
                    onClick={handleCreateGlobalNotice}
                    disabled={!newNoticeText.trim()}
                    className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-2 px-4 rounded transition-colors self-end"
                  >
                    Publicar Aviso
                  </button>
                  <div className="mt-4 space-y-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                    {globalNotices.map(notice => (
                      <div key={notice.id} className="bg-white/5 p-3 rounded border border-[#333] flex items-center justify-between">
                        <div className="flex flex-col mr-2">
                          <span className="text-sm text-gray-300">{notice.message}</span>
                          <span className="text-xs text-gray-500">{new Date(notice.created_at).toLocaleString('pt-BR')}</span>
                        </div>
                        <button
                          onClick={() => handleToggleGlobalNotice(notice.id, notice.active)}
                          className={`px-3 py-1 text-xs font-bold rounded border whitespace-nowrap ${notice.active ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-gray-500/10 text-gray-400 border-gray-500/20'}`}
                        >
                          {notice.active ? 'Ativo' : 'Inativo'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Diagnóstico de Erros */}
              <div className="bg-[#0A0A0A] border border-[#222222] rounded-lg p-6 flex flex-col items-center justify-center text-center">
                <div className="bg-red-500/10 p-4 rounded-full mb-4">
                  <Bug size={32} className="text-red-400" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Diagnóstico de Erros do Sistema</h3>
                <p className="text-sm text-gray-400 mb-6 max-w-sm">
                  Visualize logs de erros capturados em tempo real nas lojas dos clientes para diagnóstico proativo.
                </p>
                <button
                  onClick={() => setIsDiagnosticModalOpen(true)}
                  className="bg-red-600 hover:bg-red-700 text-white font-bold py-2.5 px-6 rounded transition-colors flex items-center gap-2"
                >
                  <List size={18} />
                  Ver Logs de Erros ({systemErrors.length})
                </button>
              </div>
            </div>

            {/* Chamados S.O.S (Suporte Vextron Lab) */}
            <div className="bg-[#0A0A0A] border border-[#222222] rounded-lg p-6">
              <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-6">
                <AlertCircle size={18} className="text-red-500" />
                Chamados S.O.S (Suporte Vextron Lab)
              </h3>
              {chamadosSuporte.length === 0 ? (
                <p className="text-sm text-gray-500">Nenhum chamado S.O.S registrado no momento.</p>
              ) : (
                <div className="overflow-x-auto max-h-80 custom-scrollbar">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-[#222222] text-gray-500 font-semibold sticky top-0 bg-[#0A0A0A]">
                        <th className="pb-4">Data</th>
                        <th className="pb-4">Empresa / Rota</th>
                        <th className="pb-4">Mensagem</th>
                        <th className="pb-4">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#222222]">
                      {chamadosSuporte.map((chamado) => (
                         <tr key={chamado.id} className="hover:bg-red-950/5 transition-colors">
                          <td className="py-4 text-xs whitespace-nowrap text-gray-400">{new Date(chamado.created_at).toLocaleString('pt-BR')}</td>
                          <td className="py-4">
                            <div className="flex flex-col">
                              <strong className="text-white text-sm font-bold">
                                {chamado.empresas?.nome_fantasia || 'Empresa sem Nome'}
                              </strong>
                              <span className="text-xs text-gray-400 mt-0.5">
                                {chamado.empresas?.endereco || 'Endereço não cadastrado'}
                              </span>
                              {chamado.rota && (
                                <span className="text-[10px] text-purple-400 font-mono mt-1">
                                  Rota: {chamado.rota}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-4 text-white max-w-sm truncate" title={chamado.mensagem}>{chamado.mensagem}</td>
                          <td className="py-4">
                            {chamado.status?.toLowerCase() === 'aberto' ? (
                              <button
                                onClick={() => setConfirmingSosId(chamado.id)}
                                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase bg-red-950/30 text-red-400 border border-red-800/40 hover:bg-red-900/40 hover:text-red-300 transition-all cursor-pointer"
                                title="Clique para Finalizar Chamado"
                              >
                                Aberto
                              </button>
                            ) : chamado.status?.toUpperCase() === 'FINALIZADO' ? (
                              <button
                                disabled
                                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase bg-green-950/30 text-green-400 border border-green-800/40 opacity-75 cursor-not-allowed"
                              >
                                Finalizado
                              </button>
                            ) : (
                              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase ${
                                chamado.status?.toLowerCase() === 'em_analise' ? 'bg-yellow-950/30 text-yellow-400 border border-yellow-800/40' :
                                'bg-green-950/30 text-green-400 border border-green-800/40'
                              }`}>
                                {chamado.status}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Gestão de Licenças */}
            <div className="bg-[#0A0A0A] border border-[#222222] rounded-lg p-6">
              <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-6">
                <Building size={18} className="text-purple-400" />
                Empresas Clientes (Licenciadas)
              </h3>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-[#222222] text-gray-500 font-semibold">
                      <th className="pb-4">Nome da Empresa / Loja</th>
                      <th className="pb-4">UUID da Empresa</th>
                      <th className="pb-4">Plano SaaS</th>
                      <th className="pb-4">Status Assinatura</th>
                      <th className="pb-4">Status Geral</th>
                      <th className="pb-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#222222]">
                    {allCompanies.map((c) => {
                      const hasAtraso = c.faturas_saas?.some(f => {
                        if (f.status === 'ATRASADO') return true;
                        if (f.status === 'PENDENTE') {
                          const venc = new Date(f.data_vencimento);
                          const today = new Date();
                          venc.setHours(0,0,0,0);
                          today.setHours(0,0,0,0);
                          const diffTime = today - venc;
                          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                          return diffDays > 5;
                        }
                        return false;
                      });

                      return (
                        <tr key={c.id} className={`transition-colors ${hasAtraso ? 'bg-red-950/10 hover:bg-red-950/15 border border-red-900/20' : 'hover:bg-purple-950/5'}`}>
                          <td className="py-4 font-bold text-white">
                            <div className="flex flex-col">
                              <span>{c.nome}</span>
                              {hasAtraso && (
                                <span className="text-red-400 text-[10px] bg-red-950/40 border border-red-800/40 px-2 py-0.5 rounded font-mono mt-1 inline-block animate-pulse w-fit">
                                  ⚠️ INADIMPLENTE (Atraso &gt; 5 dias) - Sugerido Bloquear Acesso
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-4 text-xs font-mono text-gray-500 break-all select-all pr-4">{c.id}</td>
                          <td className="py-4">
                            <select
                              value={c.plano || 'START'}
                              onChange={(e) => handleSuperAdminUpdatePlano(c.id, e.target.value)}
                              className="bg-black border border-[#333] focus:border-[#6A0DAD] rounded text-white px-2 py-1 text-xs outline-none font-bold cursor-pointer"
                            >
                              <option value="START">START</option>
                              <option value="PRO">PRO</option>
                              <option value="ULTIMATE">ULTIMATE</option>
                            </select>
                          </td>
                          <td className="py-4">
                            <select
                              value={c.status_assinatura || 'ATIVO'}
                              onChange={(e) => handleSuperAdminUpdateStatusAssinatura(c.id, e.target.value)}
                              className={`border rounded px-2 py-1 text-xs font-bold outline-none cursor-pointer ${
                                c.status_assinatura === 'BLOQUEADO'
                                  ? 'bg-red-950/40 text-red-400 border-red-800'
                                  : 'bg-green-950/40 text-green-400 border-green-800'
                              }`}
                            >
                              <option value="ATIVO" className="bg-black text-green-400">ATIVO</option>
                              <option value="BLOQUEADO" className="bg-black text-red-400">BLOQUEADO</option>
                            </select>
                          </td>
                          <td className="py-4">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                              c.status === 'ATIVO' 
                                ? 'bg-green-950/30 text-green-400 border border-green-800/40' 
                                : 'bg-red-950/30 text-red-400 border border-red-800/40'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${c.status === 'ATIVO' ? 'bg-green-400' : 'bg-red-400'}`}></span>
                              {c.status}
                            </span>
                          </td>
                          <td className="py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => toggleCompanyMaintenance(c.id, c.em_manutencao)}
                                className={`px-3 py-1.5 rounded text-xs font-bold transition-all border ${
                                  c.em_manutencao
                                    ? 'bg-yellow-950/20 text-yellow-500 border-yellow-800/50 hover:bg-yellow-900/40'
                                    : 'bg-gray-900/50 text-gray-400 border-gray-700/50 hover:bg-gray-800/80 hover:text-white'
                                }`}
                                title="Modo Manutenção"
                              >
                                {c.em_manutencao ? 'Manutenção ON' : 'Manutenção OFF'}
                              </button>
                              
                              <button
                                onClick={() => openFaturasModal(c)}
                                className="px-3 py-1.5 rounded bg-blue-950/20 text-blue-400 border border-blue-800/50 hover:bg-blue-900/40 text-xs font-bold flex items-center gap-1 transition-all"
                                title="Histórico Financeiro"
                              >
                                <DollarSign size={14} /> Faturas
                              </button>
                              
                              <button
                                onClick={() => toggleCompanyStatus(c.id, c.status)}
                                className={`px-3 py-1.5 rounded text-xs font-bold transition-all ${
                                  c.status === 'ATIVO'
                                    ? 'bg-red-950/20 text-red-400 border border-red-800/50 hover:bg-red-900/40'
                                    : 'bg-green-950/20 text-green-400 border border-green-800/50 hover:bg-green-900/40'
                                }`}
                              >
                                {c.status === 'ATIVO' ? 'Bloquear Acesso' : 'Desbloquear Acesso'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            {isFaturasModalOpen && selectedFaturasCompany && (
              <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                <div className="bg-[#0A0A0A] border border-[#222222] rounded-xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[90vh] animate-fadeIn">
                  
                  {/* Modal Header */}
                  <div className="flex items-center justify-between p-6 border-b border-[#222222]">
                    <div>
                      <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Building size={20} className="text-[#6A0DAD]" />
                        Financeiro: {selectedFaturasCompany.nome}
                      </h2>
                      <p className="text-sm text-gray-500 mt-1">
                        Módulo de Gestão de Assinaturas & Cobrança
                      </p>
                    </div>
                    <button 
                      onClick={() => setIsFaturasModalOpen(false)}
                      className="text-gray-500 hover:text-white transition-colors"
                    >
                      <X size={24} />
                    </button>
                  </div>

                  {/* Tab Navigation */}
                  <div className="flex border-b border-[#222222] px-6 bg-[#050505]">
                    <button
                      onClick={() => setFaturasActiveTab('config')}
                      className={`py-3 px-4 text-sm font-bold border-b-2 transition-all ${
                        faturasActiveTab === 'config'
                          ? 'border-[#6A0DAD] text-white'
                          : 'border-transparent text-gray-500 hover:text-gray-300'
                      }`}
                    >
                      Configuração da Assinatura
                    </button>
                    <button
                      onClick={() => setFaturasActiveTab('historico')}
                      className={`py-3 px-4 text-sm font-bold border-b-2 transition-all ${
                        faturasActiveTab === 'historico'
                          ? 'border-[#6A0DAD] text-white'
                          : 'border-transparent text-gray-500 hover:text-gray-300'
                      }`}
                    >
                      Histórico e Cobrança
                    </button>
                  </div>

                  {/* Modal Body */}
                  <div className="overflow-y-auto">
                    {faturasActiveTab === 'config' && (
                      <div className="p-6 flex flex-col gap-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          <div className="flex flex-col gap-2">
                            <label className="text-xs text-gray-400 font-semibold uppercase">Valor da Licença (Mensal)</label>
                            <input
                              type="number"
                              value={licencaValor}
                              onChange={(e) => setLicencaValor(e.target.value)}
                              placeholder="Ex: 2500"
                              className="bg-black border border-[#222222] rounded p-2.5 text-white font-mono focus:border-[#6A0DAD] focus:outline-none"
                            />
                          </div>
                          
                          <div className="flex flex-col gap-2">
                            <label className="text-xs text-gray-400 font-semibold uppercase">Dia de Vencimento (1 a 31)</label>
                            <input
                              type="number"
                              min="1"
                              max="31"
                              value={licencaDiaVencimento}
                              onChange={(e) => setLicencaDiaVencimento(e.target.value)}
                              placeholder="Ex: 10"
                              className="bg-black border border-[#222222] rounded p-2.5 text-white font-mono focus:border-[#6A0DAD] focus:outline-none"
                            />
                          </div>

                          <div className="flex flex-col gap-2">
                            <label className="text-xs text-gray-400 font-semibold uppercase">Telefone de Cobrança (WhatsApp)</label>
                            <input
                              type="text"
                              value={empresaTelefone}
                              onChange={(e) => setEmpresaTelefone(e.target.value)}
                              placeholder="Ex: 5511999999999"
                              className="bg-black border border-[#222222] rounded p-2.5 text-white font-mono focus:border-[#6A0DAD] focus:outline-none"
                            />
                            <span className="text-[10px] text-gray-500">Incluir DDI (55) + DDD + Número</span>
                          </div>
                        </div>

                        <button
                          onClick={handleSalvarConfigLicenca}
                          disabled={loadingConfigLicenca}
                          className="bg-[#6A0DAD] hover:bg-[#8A2BE2] text-white py-2 px-6 rounded font-bold transition-all text-sm flex items-center gap-2 self-start disabled:opacity-50"
                        >
                          {loadingConfigLicenca ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                          Salvar Configurações
                        </button>
                      </div>
                    )}

                    {faturasActiveTab === 'historico' && (
                      <div className="p-6 flex flex-col gap-6">
                        {/* Form to manually create invoice */}
                        <form onSubmit={handleCriarNovaFatura} className="bg-black border border-[#1a1a1a] rounded-lg p-4 flex flex-col gap-4">
                          <h4 className="text-xs text-purple-400 font-bold uppercase tracking-wider">Gerar Fatura Manual</h4>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="flex flex-col gap-1.5">
                              <label className="text-[10px] text-gray-400 font-semibold uppercase">Data de Vencimento</label>
                              <input
                                type="date"
                                required
                                value={novaFaturaVencimento}
                                onChange={(e) => setNovaFaturaVencimento(e.target.value)}
                                className="bg-black border border-[#222222] rounded p-2 text-xs text-white focus:border-[#6A0DAD] focus:outline-none"
                              />
                            </div>
                            
                            <div className="flex flex-col gap-1.5">
                              <label className="text-[10px] text-gray-400 font-semibold uppercase">Valor (Opcional)</label>
                              <input
                                type="number"
                                value={novaFaturaValor}
                                onChange={(e) => setNovaFaturaValor(e.target.value)}
                                placeholder={`Padrão: R$ ${parseFloat(selectedFaturasCompany.valor_mensalidade || 0).toFixed(2)}`}
                                className="bg-black border border-[#222222] rounded p-2 text-xs text-white focus:border-[#6A0DAD] focus:outline-none"
                              />
                            </div>

                            <div className="flex flex-col gap-1.5">
                              <label className="text-[10px] text-gray-400 font-semibold uppercase">Link/PIX de Pagamento</label>
                              <input
                                type="text"
                                value={novaFaturaLink}
                                onChange={(e) => setNovaFaturaLink(e.target.value)}
                                placeholder="URL Boleto ou chave PIX copia e cola"
                                className="bg-black border border-[#222222] rounded p-2 text-xs text-white focus:border-[#6A0DAD] focus:outline-none"
                              />
                            </div>
                          </div>
                          <button
                            type="submit"
                            disabled={loadingNovaFatura}
                            className="bg-purple-950/40 border border-purple-800/40 text-purple-400 hover:bg-purple-900/30 py-1.5 px-4 rounded text-xs font-bold transition-all self-end disabled:opacity-50"
                          >
                            {loadingNovaFatura ? 'Gerando...' : 'Gerar Fatura'}
                          </button>
                        </form>

                        {/* Faturas list */}
                        {companyFaturas.length === 0 ? (
                          <div className="text-center py-12 border border-dashed border-[#222222] rounded-lg">
                            <DollarSign size={48} className="mx-auto text-[#222222] mb-4" />
                            <p className="text-gray-500 font-bold">Nenhuma fatura encontrada.</p>
                          </div>
                        ) : (
                          <div className="overflow-x-auto max-h-64 custom-scrollbar">
                            <table className="w-full text-left text-sm">
                              <thead>
                                <tr className="text-gray-500 border-b border-[#222222]">
                                  <th className="pb-3 font-medium">Vencimento</th>
                                  <th className="pb-3 font-medium">Valor</th>
                                  <th className="pb-3 font-medium">Status</th>
                                  <th className="pb-3 font-medium text-right">Ações</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-[#222222]">
                                {companyFaturas.map(fatura => {
                                  const isAtrasada = (() => {
                                    if (fatura.status === 'ATRASADO') return true;
                                    if (fatura.status === 'PENDENTE') {
                                      const venc = new Date(fatura.data_vencimento);
                                      const today = new Date();
                                      venc.setHours(0,0,0,0);
                                      today.setHours(0,0,0,0);
                                      const diffTime = today - venc;
                                      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                                      return diffDays > 5;
                                    }
                                    return false;
                                  })();

                                  const parts = fatura.data_vencimento.split('-');
                                  const formattedDate = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : fatura.data_vencimento;

                                  return (
                                    <tr key={fatura.id} className="hover:bg-white/5">
                                      <td className="py-3 font-mono text-gray-300">
                                        {formattedDate}
                                        {isAtrasada && (
                                          <span className="text-[9px] bg-red-950/40 text-red-400 border border-red-800/40 px-1 py-0.2 rounded font-sans ml-2 uppercase font-bold animate-pulse">
                                            Atrasada
                                          </span>
                                        )}
                                      </td>
                                      <td className="py-3 font-bold text-white">
                                        R$ {parseFloat(fatura.valor_mensalidade || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                      </td>
                                      <td className="py-3">
                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-bold uppercase ${
                                          fatura.status === 'PAGO' ? 'bg-green-500/10 text-green-400 border border-green-800/20' :
                                          isAtrasada ? 'bg-red-500/10 text-red-400 border border-red-800/20' :
                                          'bg-yellow-500/10 text-yellow-550 border border-yellow-800/20'
                                        }`}>
                                          {fatura.status === 'PAGO' ? 'Pago' : isAtrasada ? 'Atrasado' : 'Pendente'}
                                        </span>
                                      </td>
                                      <td className="py-3 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                          {fatura.status !== 'PAGO' && (
                                            <>
                                              <button
                                                onClick={() => baixarMensalidade(fatura.id)}
                                                className="px-2.5 py-1.5 rounded bg-green-950/30 text-green-400 border border-green-800/40 hover:bg-green-900/30 text-xs font-bold flex items-center gap-1 transition-all"
                                                title="Confirmar Pagamento Manual"
                                              >
                                                <Check size={12} /> Baixar
                                              </button>
                                              
                                              <button
                                                onClick={() => handleEnviarCobrancaWhatsapp(fatura)}
                                                className="px-2.5 py-1.5 rounded bg-[#25D366]/10 text-[#25D366] border border-[#25D366]/30 hover:bg-[#25D366]/20 text-xs font-bold flex items-center gap-1 transition-all"
                                                title="Enviar mensagem de cobrança via WhatsApp"
                                              >
                                                <MessageSquare size={12} /> Cobrança
                                              </button>
                                            </>
                                          )}
                                          {fatura.status === 'PAGO' && (
                                            <button
                                              onClick={() => handleEmitirNfse(fatura)}
                                              disabled={isFiscalLoading}
                                              className="px-2.5 py-1.5 rounded bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 disabled:opacity-50 text-xs font-bold transition-all border border-purple-500/20 flex items-center gap-1"
                                            >
                                              {isFiscalLoading ? <Loader2 size={12} className="animate-spin" /> : <FileText size={12} />} 
                                              NFS-e
                                            </button>
                                          )}
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Modal de Diagnóstico de Erros */}
            {isDiagnosticModalOpen && (
              <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                <div className="bg-[#0A0A0A] border border-[#222222] rounded-xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[90vh] animate-fadeIn">
                  <div className="flex items-center justify-between p-6 border-b border-[#222222]">
                    <div>
                      <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Bug size={20} className="text-red-400" />
                        Diagnóstico de Erros do Sistema
                      </h2>
                      <p className="text-sm text-gray-500 mt-1">Últimos {systemErrors.length} erros capturados.</p>
                    </div>
                    <button onClick={() => setIsDiagnosticModalOpen(false)} className="text-gray-500 hover:text-white transition-colors">
                      <X size={24} />
                    </button>
                  </div>
                  <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
                    {systemErrors.length === 0 ? (
                      <div className="text-center py-12">
                        <CheckCircle size={48} className="mx-auto text-green-500 mb-4" />
                        <p className="text-gray-500 font-bold">Nenhum erro registrado recentemente.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {systemErrors.map(err => (
                          <div key={err.id} className="bg-red-500/5 border border-red-500/20 p-4 rounded-lg">
                            <div className="flex justify-between items-start mb-2">
                            <span className="text-red-400 font-bold text-sm bg-red-500/10 px-2 py-0.5 rounded">
                                {err.page_location}
                              </span>
                              <span className="text-xs text-gray-500">
                                {new Date(err.created_at).toLocaleString('pt-BR')}
                              </span>
                            </div>
                            <p className="text-gray-300 text-sm font-mono whitespace-pre-wrap">{err.error_message}</p>
                            <div className="mt-3 flex gap-4 text-xs text-gray-500">
                              <span>User ID: {err.user_id || 'N/A'}</span>
                              <span>Empresa ID: {err.empresa_id || 'N/A'}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (['ADMIN', 'SUPER_ADMIN', 'OWNER', 'DONO', 'GERENTE', 'RH', 'RH_ADMIN', 'ESTOQUISTA'].includes(profile?.role)) ? (
          /* PAINEL DE CONTROLE GERENCIAL / ADMINISTRATIVO */
          <div className="space-y-8">

            {/* ABA 1: GESTÃO DE EQUIPE & FILIAIS / VISÃO CEO */}
            {activeTab === 'gestao' && (
              <div className="space-y-8 animate-fadeIn">
                {/* DASHBOARD CONSOLIDADO EXECUTIVO (VISÃO CEO / DONO DA EMPRESA) */}
                {['DONO', 'OWNER', 'SUPER_ADMIN', 'ADMIN'].includes(profile?.role) && (
                  <div className="space-y-6 bg-gradient-to-br from-[#0A001A] via-[#0A0A0A] to-black border border-[#6A0DAD]/30 p-6 rounded-2xl shadow-2xl">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-[#222222] pb-5">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="bg-[#6A0DAD]/20 text-purple-300 border border-[#6A0DAD]/40 text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
                            Visão CEO / Proprietário
                          </span>
                          <span className="text-xs text-gray-500 font-mono">
                            {company?.nome || 'Empresa'}
                          </span>
                        </div>
                        <h2 className="text-2xl font-extrabold text-white mt-1.5 flex items-center gap-2">
                          <TrendingUp className="text-[#6A0DAD]" size={26} />
                          Dashboard Executivo Consolidado
                        </h2>
                        <p className="text-xs text-gray-400 mt-1">
                          Acompanhamento em tempo real de faturamento, margem de lucro real, ROI, desempenho por vendedor e auditorias da empresa.
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 bg-black border border-[#222222] px-3 py-1.5 rounded-lg">
                          <Calendar size={14} className="text-purple-400" />
                          <span className="text-xs font-bold text-gray-400 uppercase">Mês:</span>
                          <input
                            type="month"
                            value={filtroMes}
                            onChange={(e) => setFiltroMes(e.target.value)}
                            className="bg-transparent text-white text-xs font-bold font-mono outline-none cursor-pointer"
                          />
                        </div>
                      </div>
                    </div>

                    {(() => {
                      // Métricas Consolidadas do Mês Selecionado
                      const [anoFiltro, mesFiltro] = filtroMes.split('-');
                      const vendasMes = vendas.filter(sale => {
                        const date = new Date(sale.created_at || sale.data);
                        return date.getMonth() === parseInt(mesFiltro, 10) - 1 && date.getFullYear() === parseInt(anoFiltro, 10);
                      });

                      const totalVendasCount = vendasMes.length;
                      const faturamentoBruto = vendasMes.reduce((acc, sale) => acc + (parseFloat(sale.valor_total || sale.preco * sale.quantidade) || 0), 0);

                      const custoTotal = vendasMes.reduce((acc, sale) => {
                        const prodObj = produtos.find(p => p.id === sale.produto_id || p.nome === sale.produtos?.nome);
                        const unitCost = parseFloat(sale.preco_custo || sale.produtos?.preco_custo || prodObj?.preco_custo || 0);
                        const qty = parseInt(sale.quantidade || 1, 10);
                        return acc + (unitCost * qty);
                      }, 0);

                      const lucroReal = faturamentoBruto - custoTotal;
                      const margemLucro = faturamentoBruto > 0 ? ((lucroReal / faturamentoBruto) * 100) : 0;
                      const roiCalculado = custoTotal > 0 ? ((lucroReal / custoTotal) * 100) : 0;

                      const vendasComDesconto = vendasMes.filter(s => parseFloat(s.desconto || s.valor_desconto || 0) > 0 || s.desconto_autorizado_por);
                      const totalDescontosConcedidos = vendasMes.reduce((acc, s) => acc + (parseFloat(s.desconto || s.valor_desconto || 0)), 0);

                      // Agrupamento por Vendedor com Ticket Médio e Comissões Geradas
                      const vendedorMap = {};
                      vendasMes.forEach(s => {
                        const vId = s.vendedor_id || s.profiles?.id || 'outros';
                        const vNome = s.profiles?.nome || s.vendedor_nome || 'Vendedor';
                        if (!vendedorMap[vId]) {
                          vendedorMap[vId] = { id: vId, nome: vNome, totalVendido: 0, qtdVendas: 0, comissaoTotal: 0 };
                        }
                        vendedorMap[vId].totalVendido += (parseFloat(s.valor_total) || 0);
                        vendedorMap[vId].qtdVendas += 1;
                        vendedorMap[vId].comissaoTotal += (parseFloat(s.comissao) || 0);
                      });

                      const rankingVendedores = Object.values(vendedorMap).sort((a, b) => b.totalVendido - a.totalVendido);

                      // Agrupamento por Filial com Faturamento e Estoque Parado
                      const filialMap = {};
                      filiais.forEach(f => {
                        filialMap[f.id] = {
                          id: f.id,
                          nome: f.nome,
                          totalVendido: 0,
                          qtdVendas: 0,
                          estoqueParadoQtd: 0,
                          estoqueParadoValor: 0
                        };
                      });

                      vendasMes.forEach(s => {
                        const fId = s.filial_id || 'sem_filial';
                        if (!filialMap[fId]) {
                          const fObj = filiais.find(f => f.id === fId);
                          filialMap[fId] = { id: fId, nome: fObj ? fObj.nome : 'Matriz', totalVendido: 0, qtdVendas: 0, estoqueParadoQtd: 0, estoqueParadoValor: 0 };
                        }
                        filialMap[fId].totalVendido += (parseFloat(s.valor_total) || 0);
                        filialMap[fId].qtdVendas += 1;
                      });

                      produtos.forEach(p => {
                        const fId = p.filial_id;
                        if (filialMap[fId]) {
                          const qty = p.tipo === 'CELULAR' 
                            ? disponiveisImeis.filter(im => im.produto_id === p.id && im.filial_id === fId && (im.status === 'DISPONÍVEL' || im.status === 'Disponível')).length
                            : parseInt(p.quantidade || 0, 10);
                          const unitPrice = parseFloat(p.preco_custo || p.preco || 0);
                          filialMap[fId].estoqueParadoQtd += qty;
                          filialMap[fId].estoqueParadoValor += (qty * unitPrice);
                        }
                      });

                      const comparativoFiliais = Object.values(filialMap).sort((a, b) => b.totalVendido - a.totalVendido);

                      return (
                        <div className="space-y-6">
                          {/* RELATÓRIO 1: FATURAMENTO TOTAL & ROI */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            {/* Card a: Faturamento Bruto */}
                            <div className="bg-black/60 border border-[#222222] p-5 rounded-xl flex flex-col justify-between">
                              <div>
                                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Faturamento Bruto</span>
                                <span className="text-xl font-extrabold text-white font-mono mt-1 block">
                                  R$ {faturamentoBruto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </span>
                              </div>
                              <div className="mt-3 pt-2 border-t border-[#222222] flex items-center justify-between text-[11px]">
                                <span className="text-gray-400">Total de Pedidos:</span>
                                <span className="font-bold text-purple-400">{totalVendasCount} vendas</span>
                              </div>
                            </div>

                            {/* Card b: Lucro Real & ROI Executivo */}
                            <div className="bg-black/60 border border-[#222222] p-5 rounded-xl flex flex-col justify-between">
                              <div>
                                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Lucro Real &amp; ROI</span>
                                <span className={`text-xl font-extrabold font-mono mt-1 block ${lucroReal >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                  R$ {lucroReal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </span>
                              </div>
                              <div className="mt-3 pt-2 border-t border-[#222222] flex items-center justify-between text-[11px]">
                                <span className="text-gray-400">ROI Estimado:</span>
                                <span className={`font-bold font-mono ${roiCalculado >= 20 ? 'text-green-400' : 'text-yellow-400'}`}>
                                  {roiCalculado.toFixed(1)}% ({margemLucro.toFixed(1)}% margem)
                                </span>
                              </div>
                            </div>

                            {/* Card c: Custo de Mercadorias (Saídas) */}
                            <div className="bg-black/60 border border-[#222222] p-5 rounded-xl flex flex-col justify-between">
                              <div>
                                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Custo de Produtos (CMV / Saídas)</span>
                                <span className="text-xl font-extrabold text-gray-300 font-mono mt-1 block">
                                  R$ {custoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </span>
                              </div>
                              <div className="mt-3 pt-2 border-t border-[#222222] flex items-center justify-between text-[11px]">
                                <span className="text-gray-400">Estoque Ativo:</span>
                                <span className="font-bold text-gray-300">{disponiveisImeis.length} un. disponíveis</span>
                              </div>
                            </div>

                            {/* Card d: Total em Descontos */}
                            <div className="bg-black/60 border border-[#222222] p-5 rounded-xl flex flex-col justify-between">
                              <div>
                                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Total em Descontos</span>
                                <span className="text-xl font-extrabold text-amber-400 font-mono mt-1 block">
                                  R$ {totalDescontosConcedidos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </span>
                              </div>
                              <div className="mt-3 pt-2 border-t border-[#222222] flex items-center justify-between text-[11px]">
                                <span className="text-gray-400">Vendas com Desconto:</span>
                                <span className="font-bold text-amber-400">{vendasComDesconto.length} ({totalVendasCount > 0 ? ((vendasComDesconto.length / totalVendasCount) * 100).toFixed(0) : 0}%)</span>
                              </div>
                            </div>
                          </div>

                          {/* RELATÓRIO 2: SEÇÃO DUPLA - DESEMPENHO POR VENDEDOR & VISÃO GERAL POR FILIAL */}
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Card e: Visão Geral por Filial & Estoque Parado */}
                            <div className="bg-black border border-[#222222] rounded-xl p-5 flex flex-col justify-between">
                              <div>
                                <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-4">
                                  <Store size={16} className="text-purple-400" />
                                  Visão Geral por Filial (Faturamento &amp; Estoque Parado)
                                </h3>
                                {comparativoFiliais.length === 0 ? (
                                  <p className="text-xs text-gray-500 italic py-6 text-center">Sem vendas registradas no mês.</p>
                                ) : (
                                  <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                                    {comparativoFiliais.map((f, idx) => {
                                      const pct = faturamentoBruto > 0 ? ((f.totalVendido / faturamentoBruto) * 100) : 0;
                                      return (
                                        <div key={idx} className="bg-[#0A0A0A] border border-[#222222] p-3.5 rounded-lg space-y-2">
                                          <div className="flex justify-between items-center text-xs">
                                            <span className="font-bold text-white flex items-center gap-2">
                                              <span className="w-5 h-5 rounded-full bg-purple-950/60 border border-purple-800/40 text-purple-400 text-[10px] font-extrabold flex items-center justify-center">
                                                {idx + 1}
                                              </span>
                                              {f.nome}
                                            </span>
                                            <span className="font-mono font-bold text-white">
                                              R$ {f.totalVendido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                            </span>
                                          </div>
                                          <div className="w-full bg-[#151515] h-2 rounded-full overflow-hidden">
                                            <div
                                              className="bg-gradient-to-r from-[#6A0DAD] to-purple-400 h-full rounded-full transition-all"
                                              style={{ width: `${Math.min(pct, 100)}%` }}
                                            />
                                          </div>
                                          <div className="flex justify-between items-center text-[10px] text-gray-400 font-mono border-t border-[#111] pt-1.5 mt-1">
                                            <span>{f.qtdVendas} venda(s) ({pct.toFixed(1)}%)</span>
                                            <span className="text-amber-400 font-bold">
                                              Estoque Parado: {f.estoqueParadoQtd} un. (R$ {f.estoqueParadoValor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})
                                            </span>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Card d: Desempenho por Vendedor (Ticket Médio & Comissões) */}
                            <div className="bg-black border border-[#222222] rounded-xl p-5 flex flex-col justify-between">
                              <div>
                                <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-4">
                                  <Award size={16} className="text-yellow-400" />
                                  Desempenho por Vendedor (Vendas, Ticket Médio &amp; Comissões)
                                </h3>
                                {rankingVendedores.length === 0 ? (
                                  <p className="text-xs text-gray-500 italic py-6 text-center">Nenhum vendedor faturou no mês.</p>
                                ) : (
                                  <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                                    {rankingVendedores.map((v, idx) => {
                                      const metaObj = metas.find(m => m.vendedor_id === v.id);
                                      const metaValor = metaObj ? parseFloat(metaObj.valor_meta) : 15000;
                                      const pctMeta = metaValor > 0 ? ((v.totalVendido / metaValor) * 100) : 0;
                                      const ticketMedio = v.qtdVendas > 0 ? (v.totalVendido / v.qtdVendas) : 0;

                                      return (
                                        <div key={idx} className="bg-[#0A0A0A] border border-[#222222] p-3 rounded-lg flex items-center justify-between gap-3">
                                          <div className="flex items-center gap-3 min-w-0">
                                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-extrabold border shrink-0 ${
                                              idx === 0 ? 'bg-yellow-950/60 text-yellow-400 border-yellow-700/60' :
                                              idx === 1 ? 'bg-gray-900 text-gray-300 border-gray-700' :
                                              'bg-amber-950/30 text-amber-600 border-amber-900/40'
                                            }`}>
                                              {idx + 1}º
                                            </div>
                                            <div className="truncate">
                                              <span className="block text-xs font-bold text-white truncate">{v.nome}</span>
                                              <span className="text-[10px] text-gray-400 font-mono">
                                                {v.qtdVendas} venda(s) · Tkt Médio: R$ {ticketMedio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                              </span>
                                            </div>
                                          </div>

                                          <div className="text-right shrink-0">
                                            <span className="block text-xs font-bold font-mono text-white">
                                              R$ {v.totalVendido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                            </span>
                                            <span className="block text-[10px] font-bold text-purple-400 font-mono">
                                              Comissão: R$ {v.comissaoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} ({pctMeta.toFixed(0)}% meta)
                                            </span>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* RELATÓRIO 3: AUDITORIA DE DESCONTOS & AUDITORIA DE ACESSOS DA EQUIPE */}
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Auditoria de Descontos */}
                            <div className="bg-black border border-[#222222] rounded-xl p-5 space-y-4">
                              <div className="flex items-center justify-between border-b border-[#222] pb-3">
                                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                  <Tag size={16} className="text-amber-400" />
                                  Auditoria de Descontos Concedidos
                                </h3>
                                <span className="text-[10px] bg-amber-950/40 text-amber-400 border border-amber-800/40 px-2 py-0.5 rounded font-bold uppercase">
                                  Auditoria Executiva
                                </span>
                              </div>

                              {vendasComDesconto.length === 0 ? (
                                <p className="text-xs text-gray-500 italic py-6 text-center">Nenhum desconto concedido neste mês.</p>
                              ) : (
                                <div className="overflow-x-auto max-h-60 overflow-y-auto">
                                  <table className="w-full text-left text-xs border-collapse">
                                    <thead>
                                      <tr className="border-b border-[#222222] text-gray-500 font-bold uppercase tracking-wider">
                                        <th className="pb-2">Data</th>
                                        <th className="pb-2">Vendedor</th>
                                        <th className="pb-2 text-right">Desconto (R$)</th>
                                        <th className="pb-2 text-right">Autorizador</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[#222222]/50">
                                      {vendasComDesconto.slice(0, 10).map((sale) => (
                                        <tr key={sale.id} className="hover:bg-white/5 transition-colors">
                                          <td className="py-2 text-gray-400 font-mono text-[11px]">
                                            {new Date(sale.created_at || sale.data).toLocaleDateString('pt-BR')}
                                          </td>
                                          <td className="py-2 text-gray-300 font-semibold text-[11px]">
                                            {sale.profiles?.nome || sale.vendedor_nome || 'Vendedor'}
                                          </td>
                                          <td className="py-3 text-right font-mono font-bold text-amber-400">
                                            - R$ {parseFloat(sale.desconto || sale.valor_desconto || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                          </td>
                                          <td className="py-3 text-right font-semibold text-purple-300">
                                            {sale.autorizador?.nome || sale.desconto_autorizado_por || 'Gerente / Dono'}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>

                            {/* Auditoria de Acessos & Logins da Equipe */}
                            <div className="bg-black border border-[#222222] rounded-xl p-5 space-y-4">
                              <div className="flex items-center justify-between border-b border-[#222] pb-3">
                                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                  <Shield size={16} className="text-[#6A0DAD]" />
                                  Auditoria de Acessos &amp; Atividade da Equipe
                                </h3>
                                <span className="text-[10px] bg-purple-950/40 text-purple-300 border border-purple-800/40 px-2 py-0.5 rounded font-bold uppercase">
                                  Logs de Acesso
                                </span>
                              </div>

                              {teamMembers.length === 0 ? (
                                <p className="text-xs text-gray-500 italic py-6 text-center">Nenhum registro de acesso encontrado.</p>
                              ) : (
                                <div className="overflow-x-auto max-h-60 overflow-y-auto">
                                  <table className="w-full text-left text-xs border-collapse">
                                    <thead>
                                      <tr className="border-b border-[#222222] text-gray-500 font-bold uppercase tracking-wider">
                                        <th className="pb-2">Colaborador</th>
                                        <th className="pb-2">Cargo</th>
                                        <th className="pb-2">Filial</th>
                                        <th className="pb-2 text-right">Status Acesso</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[#222222]/50">
                                      {teamMembers.map((member) => {
                                        const fObj = filiais.find(f => f.id === member.filial_id);
                                        return (
                                          <tr key={member.id} className="hover:bg-white/5 transition-colors">
                                            <td className="py-2 font-bold text-white flex items-center gap-2 text-[11px]">
                                              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                                              <span>{member.nome}</span>
                                            </td>
                                            <td className="py-2 text-gray-400 font-mono text-[10px]">
                                              {member.role}
                                            </td>
                                            <td className="py-2 text-gray-400 text-[11px]">
                                              {fObj ? fObj.nome : 'Todas / Global'}
                                            </td>
                                            <td className="py-2 text-right text-[10px]">
                                              <span className="bg-green-950/30 text-green-400 border border-green-800/40 px-2 py-0.5 rounded font-mono font-bold">
                                                Autenticado / Ativo
                                              </span>
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  
                  {/* CARD DE FILIAIS */}
                  {['ADMIN', 'SUPER_ADMIN', 'OWNER', 'GERENTE'].includes(profile?.role) && (
                    <div className="bg-[#0A0A0A] border border-[#222222] rounded-lg p-6 flex flex-col">
                      <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-6">
                        <Store size={18} className="text-[#6A0DAD]" />
                        Cadastrar Nova Filial
                      </h3>

                      {(profile?.role === 'SUPER_ADMIN' || profile?.role === 'GERENTE' || profile?.role === 'ADMIN' || profile?.role === 'OWNER') && (
                        <form onSubmit={handleAddFilial} className="space-y-4 mb-6">
                          <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                              Nome da Filial
                            </label>
                            <input
                              type="text"
                              value={nomeFilial}
                              onChange={(e) => setNomeFilial(e.target.value)}
                              className="w-full bg-black border border-[#6A0DAD]/40 focus:border-[#6A0DAD] rounded-md text-white px-4 py-2.5 text-sm placeholder-gray-600 outline-none transition-all"
                              placeholder="Ex: Shopping Central, Depósito Norte"
                              required
                            />
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                                CNPJ
                              </label>
                              <input
                                type="text"
                                value={cnpjFilial}
                                onChange={(e) => setCnpjFilial(e.target.value)}
                                className="w-full bg-black border border-[#6A0DAD]/40 focus:border-[#6A0DAD] rounded-md text-white px-4 py-2.5 text-sm outline-none transition-all"
                                placeholder="00.000.000/0000-00"
                                required
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                                Telefone
                              </label>
                              <input
                                type="text"
                                value={telefoneFilial}
                                onChange={(e) => setTelefoneFilial(e.target.value)}
                                className="w-full bg-black border border-[#6A0DAD]/40 focus:border-[#6A0DAD] rounded-md text-white px-4 py-2.5 text-sm outline-none transition-all"
                                placeholder="(00) 00000-0000"
                                required
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                              Endereço Completo
                            </label>
                            <input
                              type="text"
                              value={enderecoFilial}
                              onChange={(e) => setEnderecoFilial(e.target.value)}
                              className="w-full bg-black border border-[#6A0DAD]/40 focus:border-[#6A0DAD] rounded-md text-white px-4 py-2.5 text-sm outline-none transition-all"
                              placeholder="Rua, Número, Bairro, Cidade - Estado"
                              required
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                              Tipo de Filial
                            </label>
                            <select
                              value={tipoFilial}
                              onChange={(e) => setTipoFilial(e.target.value)}
                              className="w-full bg-black border border-[#6A0DAD]/40 focus:border-[#6A0DAD] rounded-md text-white px-4 py-2.5 text-sm outline-none transition-all"
                            >
                              <option value="LOJA">Loja (PDV / Vendas)</option>
                              <option value="ESTOQUE">Estoque Central (Armazenamento)</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                              LOGOTIPO DA FILIAL (OBRIGATÓRIO)
                            </label>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => setLogoFilialFile(e.target.files[0])}
                              className="w-full bg-black border border-[#6A0DAD]/40 focus:border-[#6A0DAD] rounded-md text-white px-4 py-2 text-sm outline-none transition-all file:mr-4 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-purple-900 file:text-purple-200 hover:file:bg-purple-800"
                              required
                            />
                          </div>

                          <button
                            type="submit"
                            disabled={loadingFilial}
                            className="w-full bg-[#6A0DAD] hover:bg-[#500885] disabled:bg-gray-800 disabled:text-gray-500 text-white font-bold py-2.5 px-4 rounded-md transition-colors flex items-center justify-center gap-2 text-sm"
                          >
                            <Plus size={16} />
                            {loadingFilial ? 'Adicionando...' : 'Cadastrar Nova Filial'}
                          </button>
                        </form>
                      )}

                      <div className="flex-1">
                        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Filiais Cadastradas</h4>
                        {filiais.length === 0 ? (
                          <p className="text-gray-600 text-sm italic">Nenhuma filial cadastrada.</p>
                        ) : (
                          <div className="space-y-2 max-h-60 overflow-y-auto">
                            {filiais.map(f => {
                              const isDepot = f.is_deposito === true || String(f.tipo || '').toUpperCase().includes('ESTOQUE') || String(f.tipo || '').toUpperCase().includes('DEPÓSITO') || String(f.tipo || '').toUpperCase().includes('DEPOSITO');
                              return (
                                <div key={f.id} className="flex justify-between items-center p-3 bg-black border border-[#222222] rounded-md">
                                  <div>
                                    <span className="block font-semibold text-sm text-white">{f.nome}</span>
                                    <span className="text-[10px] text-gray-500 uppercase tracking-wider flex items-center gap-1 mt-0.5">
                                      {isDepot ? '📦 ESTOQUE / DEPÓSITO' : '🏪 LOJA FÍSICA (PDV)'}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                      isDepot ? 'bg-blue-950/20 text-blue-400 border border-blue-800/30' : 'bg-[#6A0DAD]/20 text-purple-400 border border-[#6A0DAD]/30'
                                    }`}>
                                      {isDepot ? 'Estoque / Depósito' : 'Loja (PDV / Vendas)'}
                                    </span>
                                    {(profile?.role === 'SUPER_ADMIN' || profile?.role === 'GERENTE' || profile?.role === 'ADMIN' || profile?.role === 'OWNER') && (
                                      <button
                                        onClick={() => handleDeleteFilial(f.id)}
                                        className="p-1.5 text-gray-600 hover:text-red-400 hover:bg-red-950/20 rounded transition-colors"
                                        title="Excluir Filial"
                                      >
                                        <Trash2 size={14} />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* CARD DE VENDEDORES (Oculto para DONO) */}
                  {profile?.role !== 'DONO' && (
                    <div className="bg-[#0A0A0A] border border-[#222222] rounded-lg p-6 flex flex-col">
                      <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-6">
                        <Users size={18} className="text-[#6A0DAD]" />
                        Cadastrar Funcionário / Vendedor
                      </h3>

                      {!(profile?.empresa_id || company?.id || activeEmpresaId) ? (
                        <div className="bg-red-950/20 border border-red-800/40 rounded-lg p-6 text-center my-4">
                          <AlertCircle className="mx-auto text-red-500 mb-3" size={36} />
                          <h4 className="text-white font-bold mb-2">Acesso Restrito</h4>
                          <p className="text-sm text-gray-400">
                            O seu utilizador de RH não está vinculado a nenhuma empresa. Contacte o administrador.
                          </p>
                        </div>
                      ) : (
                        <form onSubmit={handleAddVendedor} className="space-y-4 mb-6">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                                Nome Completo
                              </label>
                              <input
                                type="text"
                                value={nomeVendedor}
                                onChange={(e) => setNomeVendedor(e.target.value)}
                                className="w-full bg-black border border-[#6A0DAD]/40 focus:border-[#6A0DAD] rounded-md text-white px-4 py-2.5 text-sm placeholder-gray-600 outline-none transition-all"
                                placeholder="Ex: Pedro Silva"
                                required
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                                Filial Vinculada
                              </label>
                              <select
                                value={filialVendedor}
                                onChange={(e) => setFilialVendedor(e.target.value)}
                                className="w-full bg-black border border-[#6A0DAD]/40 focus:border-[#6A0DAD] rounded-md text-white px-4 py-2.5 text-sm outline-none transition-all"
                                required
                              >
                                <option value="">Selecione...</option>
                                {filiais.map(f => (
                                  <option key={f.id} value={f.id}>{f.nome} ({f.tipo})</option>
                                ))}
                              </select>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                                E-mail
                              </label>
                              <input
                                type="email"
                                value={emailVendedor}
                                onChange={(e) => setEmailVendedor(e.target.value)}
                                className="w-full bg-black border border-[#6A0DAD]/40 focus:border-[#6A0DAD] rounded-md text-white px-4 py-2.5 text-sm placeholder-gray-600 outline-none transition-all"
                                placeholder="vendedor@loja.com"
                                required
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                                Senha
                              </label>
                              <input
                                type="password"
                                value={senhaVendedor}
                                onChange={(e) => setSenhaVendedor(e.target.value)}
                                className="w-full bg-black border border-[#6A0DAD]/40 focus:border-[#6A0DAD] rounded-md text-white px-4 py-2.5 text-sm placeholder-gray-600 outline-none transition-all"
                                placeholder="••••••"
                                minLength={6}
                                required
                              />
                            </div>
                          </div>

                          <button
                            type="submit"
                            disabled={loadingVendedor || filiais.length === 0}
                            className="w-full bg-[#6A0DAD] hover:bg-[#500885] disabled:bg-gray-800 disabled:text-gray-500 text-white font-bold py-2.5 px-4 rounded-md transition-colors flex items-center justify-center gap-2 text-sm"
                          >
                            <Plus size={16} />
                            {filiais.length === 0 ? 'Cadastre uma filial primeiro' : loadingVendedor ? 'Cadastrando...' : 'Cadastrar Vendedor'}
                          </button>
                        </form>
                      )}

                      <div className="flex-1">
                        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Vendedores Ativos</h4>
                        {vendedores.length === 0 ? (
                          <p className="text-gray-600 text-sm italic">Nenhum vendedor cadastrado.</p>
                        ) : (
                          <div className="space-y-2 max-h-60 overflow-y-auto">
                            {vendedores.map(v => (
                              <div key={v.id} className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4 items-center w-full p-4 border border-gray-800 bg-black rounded-lg hover:border-[#6A0DAD]/30 transition-all">
                                {/* Lado Esquerdo (Info) */}
                                <div className="flex flex-col gap-1">
                                  <span className="font-semibold text-sm text-white">{v.nome}</span>
                                  <span className="text-[10px] text-gray-500 break-all">{v.email}</span>
                                  <div className="mt-1 flex gap-2">
                                    <span className={`px-2 py-0.5 rounded-[4px] text-[9px] font-bold whitespace-nowrap ${
                                      v.is_treinner 
                                        ? 'bg-yellow-950/40 text-yellow-400 border border-yellow-800/30' 
                                        : 'bg-green-950/40 text-green-400 border border-green-800/30'
                                    }`}>
                                      {v.is_treinner ? 'Trainee (2% comissão serviço)' : 'Profissional (3% comissão serviço)'}
                                    </span>
                                  </div>
                                </div>

                                {/* Lado Direito (Ações / Leitura) */}
                                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto md:justify-end">
                                  {/* Grupo de Meta: Valor R$ + Tipo */}
                                  <div className="flex items-stretch gap-0 rounded-md border border-[#333] overflow-hidden h-10 w-full max-w-[260px] flex-shrink-0 bg-[#111]">
                                    {/* Prefixo R$ ou Qtd */}
                                    <span className="px-2 text-[10px] text-gray-400 font-bold flex items-center whitespace-nowrap bg-[#0A0A0A] border-r border-[#333]">
                                      {(() => {
                                        const dataAtual = new Date();
                                        const mesRef = `${dataAtual.getFullYear()}-${String(dataAtual.getMonth() + 1).padStart(2, '0')}`;
                                        const m = metas.find(x => x.vendedor_id === v.id && x.mes_referencia === mesRef);
                                        const tipoAtual = metaTipoMap[v.id] || m?.tipo_meta || 'faturamento';
                                        return isUnitMetric(tipoAtual) ? 'Meta Qtd' : 'Meta R$';
                                      })()}
                                    </span>
                                    {/* Valor */}
                                    <input 
                                      type="number"
                                      className="w-[70px] bg-transparent text-white text-xs outline-none py-1 px-2 border-r border-[#333]"
                                      placeholder={(() => {
                                        const dataAtual = new Date();
                                        const mesRef = `${dataAtual.getFullYear()}-${String(dataAtual.getMonth() + 1).padStart(2, '0')}`;
                                        const m = metas.find(x => x.vendedor_id === v.id && x.mes_referencia === mesRef);
                                        const tipoAtual = metaTipoMap[v.id] || m?.tipo_meta || 'faturamento';
                                        return isUnitMetric(tipoAtual) ? '90' : '15000';
                                      })()}
                                      defaultValue={(() => {
                                        const dataAtual = new Date();
                                        const mesRef = `${dataAtual.getFullYear()}-${String(dataAtual.getMonth() + 1).padStart(2, '0')}`;
                                        const m = metas.find(x => x.vendedor_id === v.id && x.mes_referencia === mesRef);
                                        return m ? m.valor_meta : (v.meta_mensal || 0);
                                      })()}
                                      onBlur={(e) => {
                                        const newVal = Number(e.target.value);
                                        const dataAtual = new Date();
                                        const mesRef = `${dataAtual.getFullYear()}-${String(dataAtual.getMonth() + 1).padStart(2, '0')}`;
                                        const m = metas.find(x => x.vendedor_id === v.id && x.mes_referencia === mesRef);
                                        const currentVal = m ? Number(m.valor_meta) : Number(v.meta_mensal || 0);
                                        const tipoAtual = metaTipoMap[v.id] || m?.tipo_meta || 'faturamento';
                                        if (newVal !== currentVal) {
                                          handleUpdateMeta(v.id, newVal, tipoAtual);
                                        }
                                      }}
                                    />
                                    {/* Dropdown Tipo da Meta */}
                                    <select
                                      className="bg-transparent text-purple-300 text-[10px] font-semibold outline-none px-1 cursor-pointer flex-1 min-w-0"
                                      title="Tipo da Meta"
                                      value={(() => {
                                        const dataAtual = new Date();
                                        const mesRef = `${dataAtual.getFullYear()}-${String(dataAtual.getMonth() + 1).padStart(2, '0')}`;
                                        const m = metas.find(x => x.vendedor_id === v.id && x.mes_referencia === mesRef);
                                        return metaTipoMap[v.id] || m?.tipo_meta || 'faturamento';
                                      })()}
                                      onChange={(e) => {
                                        const novoTipo = e.target.value;
                                        const dataAtual = new Date();
                                        const mesRef = `${dataAtual.getFullYear()}-${String(dataAtual.getMonth() + 1).padStart(2, '0')}`;
                                        const m = metas.find(x => x.vendedor_id === v.id && x.mes_referencia === mesRef);
                                        const valorAtual = m ? Number(m.valor_meta) : Number(v.meta_mensal || 0);
                                        setMetaTipoMap(prev => ({ ...prev, [v.id]: novoTipo }));
                                        handleUpdateMeta(v.id, valorAtual, novoTipo);
                                      }}
                                    >
                                      <option value="faturamento">Faturamento</option>
                                      <option value="quantidade">Boleto Vendido</option>
                                      <option value="ativacao">Ativações</option>
                                    </select>
                                  </div>

                                  {/* Botão de Ação: Tornar Trainee / Promover */}
                                  <button
                                    onClick={() => toggleVendedorTrainee(v.id, v.is_treinner)}
                                    className="px-4 h-10 text-xs font-bold border border-[#333333] hover:border-[#6A0DAD] hover:text-white rounded bg-transparent text-gray-300 transition-colors whitespace-nowrap flex-shrink-0"
                                  >
                                    {v.is_treinner ? 'Promover' : 'Tornar Trainee'}
                                  </button>

                                  {/* Filial: Badge Minimalista de Informação */}
                                  {v.filial_id ? (
                                    <span className="px-3 h-10 flex items-center justify-center rounded text-xs font-semibold bg-[#111111] text-purple-400 border border-[#222222] whitespace-nowrap flex-shrink-0">
                                      {filiais.find(f => f.id === v.filial_id)?.nome || 'Desconhecida'}
                                    </span>
                                  ) : (
                                    <span className="px-3 h-10 flex items-center justify-center rounded text-xs font-semibold bg-yellow-950/20 text-yellow-500 border border-yellow-900/35 whitespace-nowrap flex-shrink-0">
                                      ⚠️ Filial Pendente
                                    </span>
                                  )}

                                  {/* Botão Excluir (Lixeira) */}
                                  <button
                                    onClick={() => handleDeleteVendedor(v.id, v.nome)}
                                    className="h-10 w-10 flex items-center justify-center text-red-500 hover:bg-red-950/40 rounded border border-[#222222] hover:border-red-900/50 transition-colors flex-shrink-0"
                                    title="Excluir Vendedor"
                                  >
                                    <Trash2 size={15} />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                </div>

                {/* CARD DE CONFIGURAÇÕES FISCAIS (Oculto para GERENTE) */}
                {['SUPER_ADMIN', 'OWNER', 'ADMIN'].includes(profile?.role) && company?.id && company.id !== 'MASTER' && (
                  <div className="bg-[#0A0A0A] border border-[#6A0DAD]/20 rounded-xl p-6 space-y-6">
                    <div>
                      <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <Award size={18} className="text-[#6A0DAD]" />
                        Configurações Fiscais da Empresa
                      </h3>
                      <p className="text-xs text-gray-500 mt-1">Configure CNPJ, regime tributário e certificado digital A1 para emissão automática de NF-e e NFS-e.</p>
                    </div>

                    {isLoadingFiscalConfig ? (
                      <div className="flex items-center justify-center py-6 gap-2 text-gray-500">
                        <Loader2 size={18} className="animate-spin text-[#6A0DAD]" />
                        <span className="text-xs">Carregando configurações fiscais...</span>
                      </div>
                    ) : (
                      <form onSubmit={handleSaveFiscalConfig} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">CNPJ <span className="text-red-500">*</span></label>
                            <input
                              type="text"
                              value={fiscalCnpj}
                              onChange={(e) => setFiscalCnpj(e.target.value)}
                              className="w-full bg-black border border-[#222222] focus:border-[#6A0DAD] rounded-md text-white px-4 py-2.5 text-sm outline-none transition-all font-mono"
                              placeholder="00.000.000/0001-00"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Inscrição Estadual</label>
                            <input
                              type="text"
                              value={fiscalInscricaoEstadual}
                              onChange={(e) => setFiscalInscricaoEstadual(e.target.value)}
                              className="w-full bg-black border border-[#222222] focus:border-[#6A0DAD] rounded-md text-white px-4 py-2.5 text-sm outline-none transition-all"
                              placeholder="Inscrição Estadual"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Inscrição Municipal</label>
                            <input
                              type="text"
                              value={fiscalInscricaoMunicipal}
                              onChange={(e) => setFiscalInscricaoMunicipal(e.target.value)}
                              className="w-full bg-black border border-[#222222] focus:border-[#6A0DAD] rounded-md text-white px-4 py-2.5 text-sm outline-none transition-all"
                              placeholder="Inscrição Municipal"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Regime Tributário <span className="text-red-500">*</span></label>
                            <select
                              value={fiscalRegimeTributario}
                              onChange={(e) => setFiscalRegimeTributario(e.target.value)}
                              className="w-full bg-black border border-[#222222] focus:border-[#6A0DAD] rounded-md text-white px-4 py-2.5 text-sm outline-none transition-all"
                            >
                              <option value="Simples Nacional">Simples Nacional</option>
                              <option value="Lucro Presumido">Lucro Presumido</option>
                            </select>
                          </div>
                          <div className="md:col-span-2">
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                              Certificado Digital A1 (.pfx / .p12)
                            </label>
                            
                            {certificadoUploadLoading ? (
                              /* ESTADO CARREGANDO */
                              <div className="w-full bg-black/40 border border-dashed border-[#6A0DAD]/30 rounded-lg p-5 flex flex-col items-center justify-center gap-2 h-[88px] transition-all">
                                <Loader2 className="animate-spin text-[#6A0DAD]" size={24} />
                                <span className="text-xs text-gray-400 font-medium">Enviando certificado...</span>
                              </div>
                            ) : fiscalCertificadoA1Url ? (
                              /* ESTADO ATIVO */
                              <div className="w-full bg-[#0A0515]/60 border border-[#6A0DAD]/30 rounded-lg p-4 flex items-center justify-between gap-3 h-[88px] transition-all">
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className="p-2.5 bg-[#6A0DAD]/10 text-[#9b5de5] rounded-md">
                                    <Lock size={18} />
                                  </div>
                                  <div className="min-w-0 flex flex-col">
                                    <span className="text-xs font-bold text-white truncate">
                                      {getCertificadoFileName(fiscalCertificadoA1Url)}
                                    </span>
                                    <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1 mt-0.5">
                                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse"></span>
                                      Certificado Ativo e Protegido
                                    </span>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setFiscalCertificadoA1Url('')}
                                  className="text-xs bg-red-950/40 hover:bg-red-900/40 border border-red-800/40 hover:border-red-700/40 text-red-400 hover:text-red-300 rounded-md px-3 py-1.5 font-bold transition-all whitespace-nowrap"
                                >
                                  Substituir Certificado
                                </button>
                              </div>
                            ) : (
                              /* ESTADO VAZIO */
                              <div className="relative group">
                                <input
                                  type="file"
                                  accept=".pfx, .p12"
                                  onChange={(e) => handleUploadCertificado(e.target.files?.[0])}
                                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                />
                                <div className="w-full bg-black/20 hover:bg-[#6A0DAD]/5 border border-dashed border-neutral-800 group-hover:border-[#6A0DAD]/60 rounded-lg p-5 flex flex-col items-center justify-center gap-1.5 h-[88px] transition-all">
                                  <UploadCloud className="text-gray-500 group-hover:text-[#6A0DAD] transition-colors" size={24} />
                                  <span className="text-xs text-gray-400 group-hover:text-white font-medium transition-colors">
                                    Arraste ou clique para enviar o arquivo (.pfx, .p12)
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Senha do Certificado A1</label>
                            <div className="relative">
                              <input
                                type={showCertPassword ? "text" : "password"}
                                value={fiscalCertificadoSenha}
                                onChange={(e) => setFiscalCertificadoSenha(e.target.value)}
                                className="w-full bg-black border border-[#222222] focus:border-[#6A0DAD] rounded-md text-white pl-4 pr-10 py-2.5 text-sm outline-none transition-all font-mono"
                                placeholder="Senha do certificado A1"
                                autoComplete="new-password"
                              />
                              <button
                                type="button"
                                onClick={() => setShowCertPassword(!showCertPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors cursor-pointer"
                                title={showCertPassword ? "Ocultar Senha" : "Exibir Senha"}
                              >
                                {showCertPassword ? <Eye size={16} /> : <Lock size={16} />}
                              </button>
                            </div>
                          </div>
                          <div className="flex items-end">
                            <button
                              type="submit"
                              disabled={isSavingFiscalConfig}
                              className="w-full bg-[#6A0DAD] hover:bg-[#500885] disabled:bg-gray-800 disabled:text-gray-500 text-white font-bold py-2.5 px-4 rounded-md transition-colors flex items-center justify-center gap-2 text-sm"
                            >
                              <Save size={16} />
                              {isSavingFiscalConfig ? 'Salvando...' : 'Salvar Configurações Fiscais'}
                            </button>
                          </div>
                        </div>
                      </form>
                    )}
                  </div>
                )}



                {/* AREA CATÁLOGO E TORRE DE CONTROLO (Oculto para GERENTE e DONO no Dashboard Home) */}
                {profile?.role !== 'GERENTE' && profile?.role !== 'DONO' && (
                  <div className="bg-[#0A0A0A] border border-[#6A0DAD]/20 rounded-xl overflow-hidden">
                    {profile?.role !== 'DONO' && (
                      <div className="flex border-b border-[#222222]">
                        <button
                          onClick={() => setCatalogoTab('catalogo')}
                          className={`flex-1 py-4 text-sm font-bold transition-colors border-r border-[#222222] ${catalogoTab === 'catalogo' ? 'bg-[#6A0DAD]/10 text-white border-b-2 border-b-[#6A0DAD]' : 'text-gray-500 hover:bg-[#111111]'}`}
                        >
                          <Database size={16} className="inline mr-2" />
                          Catálogo Mestre de Produtos
                        </button>
                        <button
                          onClick={() => { setCatalogoTab('torre'); fetchTorreControlo(); }}
                          className={`flex-1 py-4 text-sm font-bold transition-colors ${catalogoTab === 'torre' ? 'bg-[#6A0DAD]/10 text-white border-b-2 border-b-[#6A0DAD]' : 'text-gray-500 hover:bg-[#111111]'}`}
                        >
                          <BarChart3 size={16} className="inline mr-2" />
                          Torre de Controlo (Visão Global)
                        </button>
                      </div>
                    )}

                  <div className="p-6">
                    {(catalogoTab === 'catalogo' && profile?.role !== 'DONO') && (
                      <>
                        <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-1">
                          <Database size={18} className="text-[#6A0DAD]" />
                          Catálogo Mestre de Produtos
                          <span className="text-[10px] bg-[#6A0DAD]/15 text-[#6A0DAD] border border-[#6A0DAD]/30 px-2 py-0.5 rounded-full font-semibold ml-1">Fonte do Poka-Yoke</span>
                        </h3>
                        <p className="text-xs text-gray-600 mb-5">Cadastre os modelos de produtos. O módulo de Entrada de Estoque usará este catálogo para evitar erros de digitação.</p>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                    {/* Formulário de cadastro de catálogo */}
                    <div className="space-y-3">
                      <div>
                        <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Nome do Produto / Modelo</label>
                        <input
                          id="catalogo-nome"
                          type="text"
                          value={nomeProduto}
                          onChange={(e) => setNomeProduto(e.target.value)}
                          className="w-full bg-black border border-[#222222] focus:border-[#6A0DAD] rounded-md text-white px-4 py-2.5 text-sm placeholder-gray-600 outline-none transition-all"
                          placeholder="Ex: iPhone 15 Pro Max 256GB"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Tipo</label>
                          <select
                            value={tipoProduto}
                            onChange={(e) => setTipoProduto(e.target.value)}
                            className="w-full bg-black border border-[#222222] focus:border-[#6A0DAD] rounded-md text-white px-3 py-2.5 text-sm outline-none transition-all"
                          >
                            <option value="CELULAR">Celular</option>
                            <option value="ACESSORIO">Acessório</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Categoria</label>
                          <select
                            value={categoriaProduto}
                            onChange={(e) => {
                              const newCat = e.target.value;
                              setCategoriaProduto(newCat);
                              const mapped = FISCAL_MAP[newCat];
                              if (mapped) {
                                setNcmProduto(mapped.ncm || '');
                                setCestProduto(mapped.cest || '');
                                setCfopProduto(mapped.cfop || '5102');
                                setOrigemProduto(mapped.origem || '0');
                              }
                            }}
                            className="w-full bg-black border border-[#222222] focus:border-[#6A0DAD] rounded-md text-white px-3 py-2.5 text-sm outline-none transition-all"
                          >
                            <option value="">Selecione a Categoria...</option>
                            {categorias.map(cat => (
                              <option key={cat.id} value={cat.nome}>{cat.nome}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">SKU / Código (Opcional)</label>
                          <input
                            type="text"
                            value={skuProduto}
                            onChange={(e) => setSkuProduto(e.target.value)}
                            className="w-full bg-black border border-[#222222] focus:border-[#6A0DAD] rounded-md text-white px-3 py-2.5 text-sm placeholder-gray-600 outline-none transition-all"
                            placeholder="Ex: IPH-17PM-256"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Condição</label>
                          <select
                            value={condicaoProduto}
                            onChange={(e) => setCondicaoProduto(e.target.value)}
                            className="w-full bg-black border border-[#222222] focus:border-[#6A0DAD] rounded-md text-white px-3 py-2.5 text-sm outline-none transition-all"
                          >
                            <option value="NOVO">Novo</option>
                            <option value="SEMINOVO">Seminovo</option>
                            <option value="GRADE_A">Grade A</option>
                            <option value="GRADE_B">Grade B</option>
                            <option value="LACRADO">Lacrado</option>
                            <option value="VITRINE">Vitrine</option>
                          </select>
                        </div>
                      </div>

                      {tipoProduto === 'CELULAR' && (
                        <div>
                          <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5 font-sans">Cor do Aparelho (Celular)</label>
                          <input
                            type="text"
                            value={corCatalogoProduto}
                            onChange={(e) => setCorCatalogoProduto(e.target.value)}
                            placeholder="Ex: Titânio Natural, Preto, Branco"
                            className="w-full bg-black border border-[#222222] focus:border-[#6A0DAD] rounded-md text-white px-3 py-2.5 text-sm placeholder-gray-600 outline-none transition-all"
                            list="cores-sugeridas-catalogo"
                          />
                          <datalist id="cores-sugeridas-catalogo">
                            <option value="Titânio Natural" />
                            <option value="Titânio Preto" />
                            <option value="Titânio Branco" />
                            <option value="Titânio Azul" />
                            <option value="Preto" />
                            <option value="Branco" />
                            <option value="Gold" />
                            <option value="Silver" />
                            <option value="Cinza Espacial" />
                          </datalist>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Estoque Mín. (Opcional)</label>
                          <input
                            type="number"
                            min="0"
                            value={estoqueMinimoProduto}
                            onChange={(e) => setEstoqueMinimoProduto(e.target.value)}
                            className="w-full bg-black border border-[#222222] focus:border-[#6A0DAD] rounded-md text-white px-3 py-2.5 text-sm placeholder-gray-600 outline-none transition-all"
                            placeholder="Ex: 3"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Preço de Venda Padrão (R$)</label>
                          <div className="relative">
                            <span className="absolute left-3 top-2.5 text-xs text-gray-500 font-bold">R$</span>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={precoProduto}
                              onChange={(e) => setPrecoProduto(e.target.value)}
                              className="w-full bg-black border border-[#222222] focus:border-[#6A0DAD] rounded-md text-white pl-9 pr-4 py-2.5 text-sm placeholder-gray-600 outline-none transition-all"
                              placeholder="0.00"
                            />
                          </div>
                        </div>

                        {(profile?.role === 'SUPER_ADMIN' || profile?.role === 'OWNER') && (
                          <div className="relative">
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Custo Base (Apenas Sócios)</label>
                            <span className="absolute left-3 top-9 text-xs text-red-500/50 font-bold">R$</span>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={precoCustoProduto}
                              onChange={(e) => setPrecoCustoProduto(e.target.value)}
                              className="w-full bg-black border border-red-900/30 focus:border-red-500 rounded-md text-red-400 pl-9 pr-4 py-2 text-sm placeholder-gray-600 outline-none transition-all"
                              placeholder="0.00"
                            />
                          </div>
                        )}
                      </div>

                      {/* OBRIGATORIEDADE DE ESTOQUE INICIAL (APENAS CADASTRO DE NOVO PRODUTO) */}
                      {!editingCatalogoProduto && (
                        <div className="border border-[#6A0DAD]/30 bg-purple-950/5 p-4 rounded-lg space-y-4">
                          <h5 className="text-[10px] font-bold text-[#6A0DAD] uppercase tracking-wider border-b border-[#222222]/80 pb-2 flex items-center gap-1.5 font-sans">
                            <Database size={12} className="text-[#6A0DAD]" />
                            Estoque Inicial Obrigatório
                          </h5>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                                Filial de Destino <span className="text-red-500">*</span>
                              </label>
                              <select
                                value={catalogoFilialEstoque}
                                onChange={(e) => setCatalogoFilialEstoque(e.target.value)}
                                className="w-full bg-black border border-[#222222] focus:border-[#6A0DAD] rounded-md text-white px-3 py-2.5 text-xs outline-none transition-all cursor-pointer font-semibold"
                                required={!editingCatalogoProduto}
                              >
                                <option value="">Selecione a Filial...</option>
                                {filiais.map((f) => (
                                  <option key={f.id} value={f.id}>
                                    {f.nome} {f.tipo === 'ESTOQUE' ? '📦' : '🏪'}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                                Quantidade Inicial <span className="text-red-500">*</span>
                              </label>
                              <input
                                type="number"
                                min="1"
                                value={catalogoEstoqueInicial}
                                onChange={(e) => setCatalogoEstoqueInicial(e.target.value)}
                                className="w-full bg-black border border-[#222222] focus:border-[#6A0DAD] rounded-md text-white px-3 py-2.5 text-sm placeholder-gray-600 outline-none transition-all font-mono"
                                placeholder="Mínimo 1"
                                required={!editingCatalogoProduto}
                              />
                            </div>
                          </div>

                          {tipoProduto === 'CELULAR' && (
                            <div>
                              <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                                IMEI(s) do(s) Aparelho(s) (1 por linha) <span className="text-red-500">*</span>
                              </label>
                              <textarea
                                value={catalogoImeisIniciais}
                                onChange={(e) => setCatalogoImeisIniciais(e.target.value)}
                                className="w-full h-24 bg-black border border-[#222222] focus:border-[#6A0DAD] rounded-md text-white p-3 text-xs outline-none transition-all font-mono"
                                placeholder="Bipe ou digite um IMEI de 15 dígitos por linha..."
                                required={!editingCatalogoProduto && tipoProduto === 'CELULAR'}
                              />
                              <p className="text-[10px] text-gray-500 mt-1 font-sans">
                                Insira exatamente {parseInt(catalogoEstoqueInicial, 10) || 0} IMEI(s) para bater com a quantidade informada.
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Seção de Dados Fiscais (Avançado) */}
                      <div className="border border-[#222222] bg-[#050505] p-4 rounded-lg space-y-4">
                        <h5 className="text-[10px] font-bold text-[#6A0DAD] uppercase tracking-wider border-b border-[#222222] pb-2 flex items-center gap-1.5 font-sans">
                          <Shield size={12} className="text-[#6A0DAD]" />
                          Dados Fiscais (Avançado)
                        </h5>
                        
                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <label className="block text-[9px] font-semibold text-gray-500 uppercase tracking-wider mb-1 font-sans">NCM (8 dig.)</label>
                            <input
                              type="text"
                              maxLength={8}
                              value={ncmProduto}
                              onChange={(e) => setNcmProduto(e.target.value.replace(/\D/g, ''))}
                              className="w-full bg-[#000] border border-[#222222] focus:border-[#6A0DAD] rounded-md text-white px-2.5 py-2 text-xs font-mono placeholder-gray-600 outline-none transition-all"
                              placeholder="Ex: 85171300"
                            />
                          </div>
                          <div>
                            <label className="block text-[9px] font-semibold text-gray-500 uppercase tracking-wider mb-1 font-sans">CEST (7 dig.)</label>
                            <input
                              type="text"
                              maxLength={7}
                              value={cestProduto}
                              onChange={(e) => setCestProduto(e.target.value.replace(/\D/g, ''))}
                              className="w-full bg-[#000] border border-[#222222] focus:border-[#6A0DAD] rounded-md text-white px-2.5 py-2 text-xs font-mono placeholder-gray-600 outline-none transition-all"
                              placeholder="Ex: 2105300"
                            />
                          </div>
                          <div>
                            <label className="block text-[9px] font-semibold text-gray-500 uppercase tracking-wider mb-1 font-sans">CFOP (4 dig.)</label>
                            <input
                              type="text"
                              maxLength={4}
                              value={cfopProduto}
                              onChange={(e) => setCfopProduto(e.target.value.replace(/\D/g, ''))}
                              className="w-full bg-[#000] border border-[#222222] focus:border-[#6A0DAD] rounded-md text-white px-2.5 py-2 text-xs font-mono placeholder-gray-600 outline-none transition-all"
                              placeholder="Ex: 5405"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-[9px] font-semibold text-gray-500 uppercase tracking-wider mb-1 font-sans">Origem da Mercadoria</label>
                          <select
                            value={origemProduto}
                            onChange={(e) => setOrigemProduto(e.target.value)}
                            className="w-full bg-[#000] border border-[#222222] focus:border-[#6A0DAD] rounded-md text-white px-2.5 py-2 text-xs outline-none transition-all"
                          >
                            <option value="0">0 - Nacional</option>
                            <option value="1">1 - Estrangeira - Importação Direta</option>
                            <option value="2">2 - Estrangeira - Adquirida no Mercado Interno</option>
                            <option value="3">3 - Nacional - Conteúdo de Importação &gt; 40%</option>
                            <option value="4">4 - Nacional - Produção em conformidade com PPB</option>
                            <option value="5">5 - Nacional - Conteúdo de Importação &lt;= 40%</option>
                            <option value="6">6 - Estrangeira - Importação Direta, sem similar nacional</option>
                            <option value="7">7 - Estrangeira - Adquirida no Mercado Interno, sem similar nacional</option>
                            <option value="8">8 - Nacional - Conteúdo de Importação &gt; 70%</option>
                          </select>
                        </div>
                      </div>

                      <div className="flex gap-2 pt-2">
                        {editingCatalogoProduto && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingCatalogoProduto(null);
                              setNomeProduto('');
                              setPrecoProduto('');
                              setPrecoCustoProduto('');
                              setSkuProduto('');
                              setCondicaoProduto('NOVO');
                              setEstoqueMinimoProduto('');
                              setCorCatalogoProduto('');
                              setNcmProduto('');
                              setCestProduto('');
                              setCfopProduto('5102');
                              setOrigemProduto('0');
                            }}
                            className="bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-2.5 px-4 rounded-md transition-colors text-sm"
                          >
                            Cancelar
                          </button>
                        )}
                        <button
                          onClick={handleSaveCatalogoProduto}
                          className="flex-1 bg-[#6A0DAD] hover:bg-[#500885] text-white font-bold py-2.5 px-4 rounded-md transition-colors flex items-center justify-center gap-2 text-sm"
                        >
                          {editingCatalogoProduto ? <Save size={15} /> : <Plus size={15} />}
                          {editingCatalogoProduto ? 'Salvar Alterações' : 'Adicionar ao Catálogo'}
                        </button>
                      </div>
                    </div>

                    {/* Lista do catálogo atual */}
                    <div>
                      <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-3">Modelos Cadastrados ({catalogoProdutos.length})</p>
                      {loadingCatalogo ? (
                        <div className="flex items-center justify-center py-8">
                          <div className="w-6 h-6 border-2 border-[#6A0DAD] border-t-transparent rounded-full animate-spin"></div>
                        </div>
                      ) : catalogoProdutos.length === 0 ? (
                        <div className="text-center py-8 text-gray-700 border border-dashed border-[#222222] rounded-lg">
                          <Package size={24} className="mx-auto mb-2 opacity-30" />
                          <p className="text-xs italic">Nenhum modelo cadastrado ainda.</p>
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                          {catalogoProdutos.map(p => (
                            <div key={p.id} className="flex items-center justify-between bg-black border border-[#222222] px-3 py-2 rounded-lg">
                              <div className="flex items-center gap-2">
                                {p.tipo === 'CELULAR' ? <Smartphone size={12} className="text-[#6A0DAD]" /> : <Tag size={12} className="text-pink-400" />}
                                <div className="flex flex-col gap-1">
                                  <p className="text-xs font-semibold text-white flex items-center gap-2">
                                    {p.nome} {p.cor && <span className="text-[#6A0DAD] font-normal">({p.cor})</span>}
                                    {p.estoque_minimo > 0 && p.estoque_atual <= p.estoque_minimo && (
                                      <AlertTriangle size={12} className="text-yellow-500 animate-pulse" title={`Estoque Crítico: ${p.estoque_atual} un. (Mínimo: ${p.estoque_minimo})`} />
                                    )}
                                  </p>
                                  <div className="flex items-center gap-2 text-[10px] text-gray-500">
                                    <span>{p.categoria}</span>
                                    <span>·</span>
                                    <span>R$ {parseFloat(p.preco).toFixed(2)}</span>
                                    {p.sku && (
                                      <>
                                        <span>·</span>
                                        <span className="font-mono text-gray-400">SKU: {p.sku}</span>
                                      </>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    {p.condicao && (
                                      <span className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider bg-[#222222] text-gray-300 border border-[#333333]">
                                        {p.condicao.replace('_', ' ')}
                                      </span>
                                    )}
                                    {p.estoque_minimo > 0 && (
                                      <span className="text-[9px] text-gray-500 italic">Mínimo ideal: {p.estoque_minimo} un.</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => openEstoqueGlobal(p)}
                                  title="Localizar Aparelhos na Rede"
                                  className="text-gray-700 hover:text-blue-400 transition-colors"
                                >
                                  <Eye size={12} />
                                </button>
                                {['ADMINISTRADOR', 'ADMIN', 'GERENTE', 'ESTOQUISTA', 'SUPER_ADMIN', 'OWNER'].includes(profile?.role) && (
                                  <button
                                    onClick={() => handleStartEditCatalogo(p)}
                                    title="Editar Produto"
                                    className="text-gray-700 hover:text-yellow-500 transition-colors"
                                  >
                                    <Edit2 size={12} />
                                  </button>
                                )}
                                <button
                                  onClick={async () => {
                                    if (!window.confirm(`Remover "${p.nome}" do catálogo?`)) return;
                                    try {
                                      const { error } = await supabase.from('produtos_catalogo').delete().eq('id', p.id);
                                      if (error) throw error;
                                      fetchCatalogoProdutos(company.id);
                                    } catch (err) {
                                      alert('Erro ao remover: ' + err.message);
                                    }
                                  }}
                                  className="text-gray-700 hover:text-red-400 transition-colors"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                        </div>
                      </>
                    )}

                    {(catalogoTab === 'torre' || profile?.role === 'DONO') && (
                      <div className="space-y-4 animate-fadeIn">
                        <div className="flex justify-between items-center mb-2">
                          <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            <BarChart3 size={18} className="text-[#6A0DAD]" />
                            Torre de Controlo de Stock
                          </h3>
                          <button 
                            onClick={() => {
                              if (torreSubTab === 'visao') fetchTorreControlo();
                              else fetchEstoqueMovimentacoes();
                            }} 
                            className="text-xs flex items-center gap-1 text-gray-400 hover:text-white transition-colors"
                          >
                            <RefreshCw size={12} className={(torreLoading || movimentacoesLoading) ? 'animate-spin' : ''} /> Atualizar
                          </button>
                        </div>

                        {/* Sub-abas da Torre de Controlo */}
                        <div className="flex border-b border-[#222222]/80 gap-6 mb-4">
                          <button
                            onClick={() => setTorreSubTab('visao')}
                            className={`pb-2 text-xs font-bold transition-all border-b-2 uppercase tracking-wider ${
                              torreSubTab === 'visao'
                                ? 'text-white border-[#6A0DAD]'
                                : 'text-gray-500 border-transparent hover:text-gray-300'
                            }`}
                          >
                            Visão Global do Estoque
                          </button>
                          <button
                            onClick={() => {
                              setTorreSubTab('historico');
                              fetchEstoqueMovimentacoes();
                            }}
                            className={`pb-2 text-xs font-bold transition-all border-b-2 uppercase tracking-wider ${
                              torreSubTab === 'historico'
                                ? 'text-white border-[#6A0DAD]'
                                : 'text-gray-500 border-transparent hover:text-gray-300'
                            }`}
                          >
                            Histórico de Movimentações (Origem/Destino)
                          </button>
                        </div>
                        
                        {torreSubTab === 'visao' && (
                          <>
                            <div className="mb-4 relative">
                              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Search size={16} className="text-gray-500" />
                              </div>
                              <input
                                type="text"
                                autoFocus
                                value={torreSearch}
                                onChange={(e) => setTorreSearch(e.target.value)}
                                className="w-full bg-[#111111] border border-[#222222] focus:border-[#6A0DAD] rounded-lg text-white pl-10 pr-4 py-3 text-sm outline-none transition-all"
                                placeholder="Buscar por IMEI ou Modelo... (Bipe aqui)"
                              />
                            </div>

                            {torreLoading ? (
                              <div className="flex flex-col items-center justify-center py-10 gap-3 text-gray-500">
                                <Loader2 size={24} className="animate-spin text-[#6A0DAD]" />
                                <p className="text-sm">Consolidando dados de toda a rede...</p>
                              </div>
                            ) : (
                              <div className="overflow-x-auto rounded-lg border border-[#222222]">
                                <table className="w-full text-left border-collapse whitespace-nowrap">
                                  <thead>
                                    <tr className="bg-[#111111] border-b border-[#222222] text-xs text-gray-400 uppercase tracking-wider">
                                      <th className="py-3 px-2 w-8"></th>
                                      <th className="py-3 px-4 font-bold border-r border-[#222222]">Nome do Produto</th>
                                      {torreFiliais.map(f => (
                                        <th key={f.id || f.nome} className="py-3 px-4 font-bold text-center border-r border-[#222222]">{f.nome}</th>
                                      ))}
                                      <th className="py-3 px-4 font-black text-center text-purple-400">Total na Rede</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-[#222222] bg-black">
                                    {torreData.length === 0 ? (
                                      <tr>
                                        <td colSpan={torreFiliais.length + 3} className="py-8 text-center text-gray-600 text-sm italic">
                                          Nenhum stock disponível na rede no momento.
                                        </td>
                                      </tr>
                                    ) : (
                                      torreData
                                        .filter(row => {
                                          if (!torreSearch) return true;
                                          const s = torreSearch.toLowerCase();
                                          if (row.nome.toLowerCase().includes(s)) return true;
                                          return row.items.some(i => i.imei && i.imei.toLowerCase().includes(s));
                                        })
                                        .map((row, idx) => {
                                          const isExpanded = !!torreExpandedRows[row.nome];
                                          return (
                                          <React.Fragment key={idx}>
                                            <tr 
                                              className="hover:bg-[#111111] transition-colors text-sm cursor-pointer"
                                              onClick={() => setTorreExpandedRows(prev => ({ ...prev, [row.nome]: !isExpanded }))}
                                            >
                                              <td className="py-3 px-2 text-gray-500 text-center">
                                                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                              </td>
                                              <td className="py-3 px-4 font-semibold text-white border-r border-[#222222]">
                                                <div className="flex items-center justify-between gap-3">
                                                  <span>{row.nome}</span>
                                                  <button
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      const catProd = catalogoProdutos.find(p => p.nome === row.nome) || {
                                                        nome: row.nome,
                                                        tipo: row.items[0]?.condicao ? 'CELULAR' : 'ACESSORIO',
                                                        categoria: 'OUTROS'
                                                      };
                                                      setAjusteProduto(catProd);
                                                      setAjusteTipo('ENTRADA');
                                                      setAjusteQuantidade('1');
                                                      setEstoqueAjusteMotivo('');
                                                      setAjusteImei('');
                                                      setAjusteFilialId('');
                                                      setIsAjustarEstoqueModalOpen(true);
                                                    }}
                                                    className="text-[10px] bg-zinc-900 hover:bg-[#6A0DAD] text-gray-300 hover:text-white px-2 py-0.5 rounded transition-all font-bold font-sans cursor-pointer flex items-center gap-1"
                                                  >
                                                    <Edit2 size={10} /> Ajustar
                                                  </button>
                                                </div>
                                              </td>
                                              {torreFiliais.map(f => (
                                                <td key={f.id || f.nome} className="py-3 px-4 text-center border-r border-[#222222] text-gray-300">
                                                  {row[f.nome] > 0 ? (
                                                    <span className="font-bold text-white">{row[f.nome]}</span>
                                                  ) : (
                                                    <span className="text-gray-700">-</span>
                                                  )}
                                                </td>
                                              ))}
                                              <td className="py-3 px-4 text-center font-black text-[#6A0DAD] bg-[#6A0DAD]/5">{row.total}</td>
                                            </tr>
                                            {isExpanded && row.items.length > 0 && (
                                              <tr className="bg-[#0a0a0a]">
                                                <td colSpan={torreFiliais.length + 3} className="p-0 border-b border-[#222222]">
                                                  <div className="p-4 pl-10">
                                                    <table className="w-full text-xs text-left border border-[#222222] rounded-md overflow-hidden">
                                                      <thead className="bg-[#111111]">
                                                        <tr className="text-gray-400">
                                                          <th className="py-2 px-3">IMEI</th>
                                                          <th className="py-2 px-3">Localização</th>
                                                          <th className="py-2 px-3">Condição</th>
                                                          <th className="py-2 px-3">Data de Entrada</th>
                                                        </tr>
                                                      </thead>
                                                      <tbody className="divide-y divide-[#222222]">
                                                        {row.items.map(item => {
                                                          const isHighlighted = torreSearch && item.imei && item.imei.toLowerCase().includes(torreSearch.toLowerCase());
                                                          return (
                                                          <tr key={item.id} className={isHighlighted ? 'bg-purple-900/20' : 'hover:bg-[#1a1a1a]'}>
                                                            <td className={`py-2 px-3 font-mono ${isHighlighted ? 'text-purple-400 font-bold' : 'text-gray-300'}`}>{item.imei}</td>
                                                            <td className="py-2 px-3 text-gray-400">
                                                              {item.localizacao === 'Não Alocado' ? (
                                                                <span className="text-red-400 flex items-center gap-1"><AlertTriangle size={10} /> Não Alocado</span>
                                                              ) : (
                                                                item.localizacao
                                                              )}
                                                            </td>
                                                            <td className="py-2 px-3">
                                                              <span className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider bg-[#222222] text-gray-300 border border-[#333333]">
                                                                {item.condicao}
                                                              </span>
                                                            </td>
                                                            <td className="py-2 px-3 text-gray-500 font-mono">
                                                              {new Date(item.data_entrada).toLocaleDateString('pt-BR')}
                                                            </td>
                                                          </tr>
                                                          );
                                                        })}
                                                      </tbody>
                                                    </table>
                                                  </div>
                                                </td>
                                              </tr>
                                            )}
                                          </React.Fragment>
                                          );
                                      })
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </>
                        )}

                        {torreSubTab === 'historico' && (
                          <div className="space-y-4 animate-fadeIn">
                            <div className="flex flex-col sm:flex-row gap-3">
                              <div className="flex-1 relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                  <Search size={14} className="text-gray-500" />
                                </div>
                                <input
                                  type="text"
                                  value={buscaMovimentacao}
                                  onChange={(e) => setBuscaMovimentacao(e.target.value)}
                                  className="w-full bg-[#111111] border border-[#222222] focus:border-[#6A0DAD] rounded-lg text-white pl-9 pr-4 py-2 text-xs outline-none transition-all"
                                  placeholder="Buscar por IMEI, Modelo ou Observação..."
                                />
                              </div>

                              <div className="w-full sm:w-48">
                                <select
                                  value={filtroMovTipo}
                                  onChange={(e) => setFiltroMovTipo(e.target.value)}
                                  className="w-full bg-[#111111] border border-[#222222] focus:border-[#6A0DAD] text-white text-xs font-bold py-2 px-3 rounded-lg outline-none cursor-pointer"
                                >
                                  <option value="TODOS">Todos os Tipos</option>
                                  <option value="ENTRADA_AQUISICAO">Entrada por Aquisição</option>
                                  <option value="SAIDA_VENDA">Saída por Venda</option>
                                  <option value="TRANSFERENCIA_SAIDA">Transferência (Saída)</option>
                                  <option value="TRANSFERENCIA_ENTRADA">Transferência (Entrada)</option>
                                  <option value="AJUSTE_MANUAL_ENTRADA">Ajuste Manual (Entrada)</option>
                                  <option value="AJUSTE_MANUAL_SAIDA">Ajuste Manual (Saída)</option>
                                </select>
                              </div>
                            </div>

                            {movimentacoesLoading ? (
                              <div className="flex flex-col items-center justify-center py-12 gap-2 text-gray-500">
                                <Loader2 size={20} className="animate-spin text-[#6A0DAD]" />
                                <span className="text-xs">Carregando movimentações...</span>
                              </div>
                            ) : (
                              <div className="overflow-x-auto rounded-lg border border-[#222222]">
                                <table className="w-full text-left text-xs border-collapse whitespace-nowrap">
                                  <thead>
                                    <tr className="bg-[#111111] border-b border-[#222222] text-gray-400 font-bold uppercase tracking-wider">
                                      <th className="py-2.5 px-4">Data/Hora</th>
                                      <th className="py-2.5 px-4">Produto</th>
                                      <th className="py-2.5 px-4">IMEI</th>
                                      <th className="py-2.5 px-4">Tipo</th>
                                      <th className="py-2.5 px-4">Origem</th>
                                      <th className="py-2.5 px-4">Destino</th>
                                      <th className="py-2.5 px-4 text-center">Qtd</th>
                                      <th className="py-2.5 px-4">Observação</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-[#222222] bg-black">
                                    {estoqueMovimentacoes.length === 0 ? (
                                      <tr>
                                        <td colSpan={8} className="py-8 text-center text-gray-600 text-sm italic">
                                          Nenhuma movimentação registrada no sistema.
                                        </td>
                                      </tr>
                                    ) : (
                                      estoqueMovimentacoes
                                        .filter(mov => {
                                          if (buscaMovimentacao) {
                                            const term = buscaMovimentacao.toLowerCase();
                                            const prodNome = mov.produtos?.nome || '';
                                            const imeiVal = mov.imei || '';
                                            const obs = mov.observacao || '';
                                            if (!prodNome.toLowerCase().includes(term) && !imeiVal.toLowerCase().includes(term) && !obs.toLowerCase().includes(term)) {
                                              return false;
                                            }
                                          }
                                          if (filtroMovTipo !== 'TODOS' && mov.tipo_movimentacao !== filtroMovTipo) {
                                            return false;
                                          }
                                          return true;
                                        })
                                        .map((mov) => {
                                          const typeLabels = {
                                            'ENTRADA_AQUISICAO': { text: 'Aquisição', color: 'bg-green-950/40 text-green-400 border-green-850/30' },
                                            'SAIDA_VENDA': { text: 'Venda', color: 'bg-blue-950/40 text-blue-400 border-blue-850/30' },
                                            'TRANSFERENCIA_SAIDA': { text: 'Transf. Saída', color: 'bg-yellow-950/40 text-yellow-400 border-yellow-850/30' },
                                            'TRANSFERENCIA_ENTRADA': { text: 'Transf. Entrada', color: 'bg-indigo-950/40 text-[#a5b4fc] border-indigo-850/30' },
                                            'AJUSTE_MANUAL_ENTRADA': { text: 'Ajuste In', color: 'bg-purple-950/40 text-purple-400 border-purple-850/30' },
                                            'AJUSTE_MANUAL_SAIDA': { text: 'Ajuste Out', color: 'bg-red-950/40 text-red-400 border-red-850/30' }
                                          };
                                          const label = typeLabels[mov.tipo_movimentacao] || { text: mov.tipo_movimentacao, color: 'bg-gray-800 text-gray-400 border-gray-700' };

                                          return (
                                            <tr key={mov.id} className="hover:bg-white/5 transition-colors text-gray-300">
                                              <td className="py-2.5 px-4 font-mono text-[10px] text-gray-500">
                                                {new Date(mov.created_at).toLocaleString('pt-BR')}
                                              </td>
                                              <td className="py-2.5 px-4 font-bold text-white">
                                                {mov.produtos?.nome || 'N/A'}
                                              </td>
                                              <td className="py-2.5 px-4 font-mono">
                                                {mov.imei || '-'}
                                              </td>
                                              <td className="py-2.5 px-4">
                                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${label.color}`}>
                                                  {label.text}
                                                </span>
                                              </td>
                                              <td className="py-2.5 px-4 text-gray-400">
                                                {mov.filial_origem?.nome || '-'}
                                              </td>
                                              <td className="py-2.5 px-4 text-gray-400">
                                                {mov.filial_destino?.nome || '-'}
                                              </td>
                                              <td className="py-2.5 px-4 text-center font-bold text-white font-mono">
                                                {mov.quantidade}
                                              </td>
                                              <td className="py-2.5 px-4 text-gray-400 max-w-xs truncate" title={mov.observacao}>
                                                {mov.observacao || '-'}
                                              </td>
                                            </tr>
                                          );
                                        })
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    </div>
                  </div>
                )}
              </div>
            )}



            
            {/* CONFIGURAÇÕES DO SISTEMA */}
            {activeTab === 'configuracoes' && company?.id && company.id !== 'MASTER' && (
              <div className="space-y-8 animate-fadeIn">
                <div className="bg-gradient-to-r from-[#0A001A] to-[#0A0A0A] border border-[#6A0DAD]/30 p-6 rounded-xl">
                  <h3 className="text-xl font-extrabold text-white flex items-center gap-2">
                    <Settings size={22} className="text-[#6A0DAD]" />
                    Configurações
                  </h3>
                  <p className="text-xs text-gray-500 mt-1">
                    Gerencie seus dados de acesso pessoais e os parâmetros globais da empresa.
                  </p>
                </div>

                {/* CARD DE PERFIL / MEUS DADOS DE ACESSO */}
                <div className="bg-[#0A0A0A] border border-[#6A0DAD]/20 rounded-xl p-6 space-y-6">
                  <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <User size={18} className="text-[#6A0DAD]" />
                      Meus Dados de Acesso
                    </h3>
                    <p className="text-xs text-gray-500 mt-1">Atualize seu nome completo, e-mail de login e redefina sua senha.</p>
                  </div>

                  <form onSubmit={handleSaveUserProfile} className="space-y-4 max-w-xl">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                          Nome Completo
                        </label>
                        <input
                          type="text"
                          value={profileNome}
                          onChange={(e) => setProfileNome(e.target.value)}
                          required
                          className="w-full bg-black border border-[#222222] focus:border-[#6A0DAD] rounded-md text-white px-4 py-2.5 text-sm outline-none transition-all font-semibold"
                          placeholder="Ex: João Silva"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                          E-mail / Login de Acesso
                        </label>
                        <input
                          type="email"
                          value={profileEmail}
                          onChange={(e) => setProfileEmail(e.target.value)}
                          required
                          className="w-full bg-black border border-[#222222] focus:border-[#6A0DAD] rounded-md text-white px-4 py-2.5 text-sm outline-none transition-all font-mono font-semibold"
                          placeholder="seuemail@exemplo.com"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                          Nova Senha (Opcional)
                        </label>
                        <input
                          type="password"
                          value={profileSenha}
                          onChange={(e) => setProfileSenha(e.target.value)}
                          className="w-full bg-black border border-[#222222] focus:border-[#6A0DAD] rounded-md text-white px-4 py-2.5 text-sm outline-none transition-all font-mono"
                          placeholder="Mínimo 6 caracteres"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                          Confirmar Nova Senha
                        </label>
                        <input
                          type="password"
                          value={profileSenhaConfirm}
                          onChange={(e) => setProfileSenhaConfirm(e.target.value)}
                          className="w-full bg-black border border-[#222222] focus:border-[#6A0DAD] rounded-md text-white px-4 py-2.5 text-sm outline-none transition-all font-mono"
                          placeholder="Confirme a nova senha"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end pt-2">
                      <button
                        type="submit"
                        disabled={isSavingProfile}
                        className="bg-[#6A0DAD] hover:bg-[#500885] disabled:bg-gray-800 disabled:text-gray-500 text-white font-bold py-2.5 px-6 rounded-md transition-all flex items-center gap-2 text-sm cursor-pointer"
                      >
                        {isSavingProfile ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                        {isSavingProfile ? 'Salvando...' : 'Salvar Dados'}
                      </button>
                    </div>
                  </form>
                </div>
            
            {/* SEÇÃO CONFIGURAÇÕES FISCAIS DA EMPRESA (Oculto para GERENTE) */}
            {profile?.role !== 'GERENTE' && ['SUPER_ADMIN', 'OWNER', 'DONO', 'ADMIN'].includes(profile?.role) && (
              <div className="space-y-8 animate-fadeIn">
                <div className="bg-gradient-to-r from-[#0A001A] to-[#0A0A0A] border border-[#6A0DAD]/30 p-6 rounded-xl">
                  <h3 className="text-xl font-extrabold text-white flex items-center gap-2">
                    <Settings size={22} className="text-[#6A0DAD]" />
                    Configurações do Sistema
                  </h3>
                  <p className="text-xs text-gray-500 mt-1">
                    Gerencie os parâmetros globais e as taxas operacionais das máquinas de cartão da Rede Cred.
                  </p>
                </div>

                {/* CARD DE TAXAS DE CARTÃO */}
                {['SUPER_ADMIN', 'OWNER', 'DONO', 'ADMIN'].includes(profile?.role) && company?.id && company.id !== 'MASTER' && (
                  <div className="bg-[#0A0A0A] border border-[#6A0DAD]/20 rounded-xl p-6 space-y-6">
                    <div>
                      <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <CreditCard size={18} className="text-[#6A0DAD]" />
                        Taxas de Parcelamento (Cartão)
                      </h3>
                      <p className="text-xs text-gray-500 mt-1">Defina as taxas cobradas pela máquina de cartão para cada número de parcelas (1x a 12x).</p>
                    </div>

                    {isLoadingTaxas ? (
                      <div className="flex items-center justify-center py-6 gap-2 text-gray-500">
                        <Loader2 size={18} className="animate-spin text-[#6A0DAD]" />
                        <span className="text-xs">Carregando taxas...</span>
                      </div>
                    ) : (
                      <form onSubmit={handleSaveTaxasCartao} className="space-y-6">
                        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-4">
                          {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                            <div key={n} className="bg-black border border-[#222222] p-3 rounded-lg flex flex-col gap-1.5 focus-within:border-[#6A0DAD]">
                              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{n}x Parcelas</label>
                              <div className="relative">
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={tempTaxasMap[n] !== undefined ? tempTaxasMap[n] : ''}
                                  onChange={(e) => setTempTaxasMap(prev => ({ ...prev, [n]: e.target.value }))}
                                  className="w-full bg-transparent border-0 text-white font-bold font-mono text-sm p-0 focus:ring-0 outline-none pr-5"
                                  placeholder="0.00"
                                  required
                                  />
                                <span className="absolute right-0 top-0.5 text-xs text-gray-500 font-bold">%</span>
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="flex justify-end">
                          <button
                            type="submit"
                            disabled={isSavingTaxas}
                            className="bg-[#6A0DAD] hover:bg-[#500885] disabled:bg-gray-800 disabled:text-gray-500 text-white font-bold py-2.5 px-6 rounded-md transition-colors flex items-center gap-2 text-sm"
                            >
                            <Save size={16} />
                            {isSavingTaxas ? 'Salvando...' : 'Salvar Taxas de Parcelamento'}
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                )}

                {/* CARD DE CONFIGURAÇÕES DE RECURSOS (NICHO) */}
                {['SUPER_ADMIN', 'OWNER', 'DONO', 'ADMIN'].includes(profile?.role) && company?.id && company.id !== 'MASTER' && (
                  <div className="bg-[#0A0A0A] border border-[#6A0DAD]/20 rounded-xl p-6 space-y-6">
                    <div>
                      <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <Smartphone size={18} className="text-[#6A0DAD]" />
                        Recursos de Nicho (Funcionalidades)
                      </h3>
                      <p className="text-xs text-gray-500 mt-1">
                        Ative ou desative recursos específicos da interface com base na operação da sua loja.
                      </p>
                    </div>

                    <div className="space-y-4">
                      {/* Alternador de Troca */}
                      <div className="flex items-center justify-between p-4 bg-black border border-[#222] rounded-lg">
                        <div>
                          <span className="block font-bold text-white text-sm">Habilitar Fluxo de Troca de Aparelhos</span>
                          <span className="text-[11px] text-gray-500 block mt-0.5">Permite receber aparelhos usados como parte do pagamento na finalização de vendas do PDV.</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleSaveTenantSettings({
                            ...tenantSettings,
                            enable_troca: !tenantSettings.enable_troca
                          })}
                          disabled={isSavingSettings}
                          className={`w-12 h-6 flex items-center rounded-full p-1 transition-all duration-300 ${
                            tenantSettings.enable_troca ? 'bg-[#6A0DAD] justify-end' : 'bg-gray-800 justify-start'
                          }`}
                        >
                          <span className="bg-white w-4 h-4 rounded-full shadow-md"></span>
                        </button>
                      </div>

                      {/* Alternador de IMEI */}
                      <div className="flex items-center justify-between p-4 bg-black border border-[#222] rounded-lg">
                        <div>
                          <span className="block font-bold text-white text-sm">Habilitar Controle de IMEI (Celulares)</span>
                          <span className="text-[11px] text-gray-500 block mt-0.5">Exige bipe ou registro de IMEI de 15 dígitos com validação Luhn para celulares.</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleSaveTenantSettings({
                            ...tenantSettings,
                            enable_imei: !tenantSettings.enable_imei
                          })}
                          disabled={isSavingSettings}
                          className={`w-12 h-6 flex items-center rounded-full p-1 transition-all duration-300 ${
                            tenantSettings.enable_imei ? 'bg-[#6A0DAD] justify-end' : 'bg-gray-800 justify-start'
                          }`}
                        >
                          <span className="bg-white w-4 h-4 rounded-full shadow-md"></span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* CARD DE GESTÃO DE FUNCIONÁRIOS E PERMISSÕES */}
                {['SUPER_ADMIN', 'OWNER', 'DONO', 'ADMIN', 'GERENTE', 'RH', 'RH_ADMIN'].includes(profile?.role) && company?.id && company.id !== 'MASTER' && (
                  <div className="bg-[#0A0A0A] border border-[#6A0DAD]/20 rounded-xl p-6 space-y-6">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[#222] pb-4">
                      <div>
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                          <Users size={18} className="text-[#6A0DAD]" />
                          Gestão de Funcionários & Permissões (RBAC Local)
                        </h3>
                        <p className="text-xs text-gray-500 mt-1">
                          Gerencie os colaboradores da sua empresa e atribua os níveis de acesso internos.
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          setNewColabNome('');
                          setNewColabEmail('');
                          setNewColabSenha('');
                          setNewColabRole('VENDEDOR');
                          setNewColabFilialId(profile?.role === 'GERENTE' ? (profile?.filial_id || activeFilialId || '') : '');
                          setIsAddCollaboratorModalOpen(true);
                        }}
                        className="bg-[#6A0DAD] hover:bg-[#500885] text-white px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-md"
                      >
                        <Plus size={14} /> Novo Colaborador
                      </button>
                    </div>

                    {isLoadingTeamMembers ? (
                      <div className="flex items-center justify-center py-8 gap-2 text-gray-500">
                        <Loader2 size={18} className="animate-spin text-[#6A0DAD]" />
                        <span className="text-xs">Carregando colaboradores da empresa...</span>
                      </div>
                    ) : teamMembers.length === 0 ? (
                      <p className="text-gray-600 text-sm italic py-4 text-center">Nenhum colaborador cadastrado para esta empresa.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-[#222222] text-gray-500 font-bold uppercase tracking-wider">
                              <th className="pb-3">Colaborador</th>
                              <th className="pb-3">E-mail</th>
                              <th className="pb-3">Nível de Acesso (Role)</th>
                              <th className="pb-3 text-right">Status RBAC</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#222222]/50">
                            {teamMembers.map((member) => (
                              <tr key={member.id} className="hover:bg-white/5 transition-colors">
                                <td className="py-3 font-bold text-white flex items-center gap-2">
                                  <User size={14} className="text-purple-400 shrink-0" />
                                  <span>{member.nome}</span>
                                </td>
                                <td className="py-3 text-gray-400 font-mono">{member.email || 'N/A'}</td>
                                <td className="py-3">
                                  <select
                                    value={member.role}
                                    onChange={(e) => handleUpdateEmployeeRole(member.id, e.target.value, member.email)}
                                    disabled={profile?.role === 'GERENTE' && ['DONO', 'OWNER', 'ADMIN', 'GERENTE'].includes(member.role)}
                                    className="bg-black border border-[#333] focus:border-[#6A0DAD] text-purple-300 font-bold px-2.5 py-1 rounded text-xs outline-none cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                                  >
                                    <option value="GERENTE">GERENTE (Gerente de Loja)</option>
                                    {profile?.role !== 'GERENTE' && (
                                      <>
                                        <option value="DONO">DONO (Proprietário / CEO)</option>
                                        <option value="OWNER">OWNER (Dono / C-Level)</option>
                                        <option value="ADMIN">ADMIN (Gerente Geral)</option>
                                        <option value="RH">RH (Recursos Humanos)</option>
                                        <option value="RH_ADMIN">RH_ADMIN (RH Admin)</option>
                                      </>
                                    )}
                                    <option value="ESTOQUISTA">ESTOQUISTA (Estoque)</option>
                                    <option value="VENDEDOR">VENDEDOR (Operacional PDV)</option>
                                    <option value="TRAINEE">TRAINEE (Vendedor Trainee)</option>
                                  </select>
                                </td>
                                <td className="py-3 text-right flex items-center justify-end gap-2">
                                  <span className="text-[10px] bg-green-950/20 text-green-400 border border-green-800/30 px-2 py-0.5 rounded font-mono font-bold">
                                    Ativo
                                  </span>
                                  {member.id !== session?.user?.id && (
                                    <button
                                      onClick={() => handleDeleteColaborador(member.id, member.nome, member.email)}
                                      className="p-1 border border-[#222222] hover:border-red-800/60 text-gray-500 hover:text-red-400 rounded bg-black transition-colors"
                                      title="Excluir Colaborador"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

            {/* ABA 9: ASSINATURA & FATURAS (MENSALIDADE SAAS) */}
            {activeTab === 'assinatura' && (
              <div className="space-y-8 animate-fadeIn font-sans">
                <div className="bg-gradient-to-r from-[#0A001A] to-[#0A0A0A] border border-[#6A0DAD]/30 p-6 rounded-xl">
                  <h3 className="text-xl font-extrabold text-white flex items-center gap-2">
                    <CreditCard size={22} className="text-[#6A0DAD]" />
                    Assinatura & Faturas
                  </h3>
                  <p className="text-xs text-gray-500 mt-1">
                    Visualize o status da sua assinatura, controle as mensalidades e faça o download de comprovantes ou notas fiscais emitidas.
                  </p>
                </div>

                <div className="bg-[#0A0A0A] border border-[#222222] rounded-xl p-6 space-y-6">
                  <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <DollarSign size={18} className="text-green-500" />
                      Status do Plano Contratado
                    </h3>
                    <p className="text-xs text-gray-500 mt-1">Dados de faturamento recorrente do seu Zênite SaaS.</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                    <div className="bg-black border border-[#222222] p-6 rounded-xl">
                      <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider block">Empresa</span>
                      <span className="text-lg font-bold text-white mt-1 block truncate">
                        {company?.nome || 'Minha Empresa'}
                      </span>
                    </div>
                    <div className="bg-black border border-[#222222] p-6 rounded-xl border-l-4 border-l-green-600">
                      <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider block">Assinatura Status</span>
                      <span className="text-lg font-bold text-green-500 mt-1 block">
                        ATIVO
                      </span>
                    </div>
                    <div className="bg-black border border-[#222222] p-6 rounded-xl">
                      <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider block">Periodicidade</span>
                      <span className="text-lg font-bold text-purple-400 mt-1 block">
                        Mensal
                      </span>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-[#222222]/80">
                    <h4 className="text-sm font-bold text-gray-300 mb-4 uppercase tracking-wider">Histórico de Faturas</h4>

                    {isLoadingFaturas ? (
                      <div className="flex items-center justify-center py-10 gap-2 text-gray-500">
                        <Loader2 size={18} className="animate-spin text-[#6A0DAD]" />
                        <span className="text-xs">Carregando faturas...</span>
                      </div>
                    ) : tenantFaturas.length === 0 ? (
                      <p className="text-gray-600 text-sm italic py-4 text-center">Nenhuma fatura localizada para esta conta.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-[#222222] text-gray-500 font-bold uppercase tracking-wider">
                              <th className="pb-3">Referência</th>
                              <th className="pb-3">Vencimento</th>
                              <th className="pb-3">Valor</th>
                              <th className="pb-3">Status</th>
                              <th className="pb-3 text-right">Ações</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#222222]/50">
                            {tenantFaturas.map((fatura) => (
                              <tr key={fatura.id} className="hover:bg-white/5 transition-colors">
                                <td className="py-3 font-semibold text-white">{fatura.mes_referencia}</td>
                                <td className="py-3 text-gray-400 font-mono">
                                  {new Date(fatura.data_vencimento).toLocaleDateString('pt-BR')}
                                </td>
                                <td className="py-3 font-mono font-bold text-white">
                                  R$ {parseFloat(fatura.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </td>
                                <td className="py-3">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                    fatura.status === 'PAGO' 
                                      ? 'bg-green-950/20 text-green-400 border border-green-800/30' 
                                      : fatura.status === 'ATRASADO'
                                      ? 'bg-red-950/20 text-red-400 border border-red-800/30 animate-pulse'
                                      : 'bg-yellow-950/20 text-yellow-400 border border-yellow-800/30'
                                  }`}>
                                    {fatura.status === 'PAGO' ? 'Pago' : fatura.status === 'ATRASADO' ? 'Atrasado' : 'Pendente'}
                                  </span>
                                </td>
                                <td className="py-3 text-right">
                                  <div className="flex justify-end gap-2">
                                    {fatura.status !== 'PAGO' && fatura.link_pagamento && (
                                      <a
                                        href={fatura.link_pagamento}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="bg-[#6A0DAD] hover:bg-[#500885] text-white px-3 py-1.5 rounded font-bold text-[10px] transition-colors"
                                      >
                                        Pagar Fatura
                                      </a>
                                    )}
                                    {fatura.nfe_status === 'EMITIDA' && fatura.nfe_pdf_url && (
                                      <a
                                        href={fatura.nfe_pdf_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="bg-black hover:bg-[#111] border border-[#222] text-gray-300 px-3 py-1.5 rounded font-bold text-[10px] transition-colors"
                                      >
                                        Nota Fiscal (PDF)
                                      </a>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* FRENTE DE CAIXA (PDV) PARA GERENTES */}
            {activeTab === 'pdv' && (
              <div className="space-y-6 animate-fadeIn">
                {!activeFilialId ? (
                  <div className="max-w-3xl mx-auto space-y-8 py-10">
                    <div className="text-center space-y-3">
                      <Store size={48} className="text-[#6A0DAD] mx-auto animate-pulse" />
                      <h2 className="text-2xl font-extrabold text-white">Escolha um Ponto de Venda</h2>
                      <p className="text-sm text-gray-500">Selecione em qual filial ou depósito você deseja operar o PDV.</p>
                    </div>

                    {filiais.filter(f => !f.tipo || f.tipo?.toUpperCase() !== 'ESTOQUE').length === 0 ? (
                      <div className="bg-[#0A0A0A] border border-dashed border-[#222222] p-8 text-center rounded-lg text-gray-500 space-y-4">
                        <p className="text-sm text-gray-400">Nenhuma filial ou loja cadastrada na sua empresa.</p>
                        {['SUPER_ADMIN', 'OWNER', 'DONO', 'ADMIN', 'GERENTE'].includes(profile?.role) && (
                          <button
                            onClick={() => setIsCreateFilialModalOpen(true)}
                            className="bg-[#6A0DAD] hover:bg-[#500885] text-white px-5 py-2.5 rounded-lg text-sm font-bold inline-flex items-center gap-2 transition-all shadow-lg shadow-[#6A0DAD]/20 cursor-pointer"
                          >
                            <Plus size={16} /> Cadastrar Primeira Filial
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {filiais.map((f) => (
                        <button
                          key={f.id}
                          onClick={() => {
                            setActiveFilialId(f.id);
                            setActiveFilialNome(f.nome);
                            localStorage.setItem('activeFilialId', f.id);
                            localStorage.setItem('activeFilialNome', f.nome);
                            fetchVendedorData(f.id, session.user.id);
                            fetchTransferencias(f.id, profile.empresa_id);
                          }}
                          className="bg-[#0A0A0A] border border-[#222222] hover:border-[#6A0DAD]/50 p-6 rounded-xl text-left transition-all hover:bg-[#6A0DAD]/5 flex items-center justify-between group"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-[#6A0DAD]/10 text-[#6A0DAD] rounded-lg flex items-center justify-center group-hover:bg-[#6A0DAD] group-hover:text-white transition-all">
                              <Store size={24} />
                            </div>
                            <div>
                              <span className="block text-sm font-bold text-white group-hover:text-[#A78BFA] transition-colors">{f.nome}</span>
                              <span className="text-xs text-gray-500 uppercase tracking-widest">
                                {f.is_deposito === true || String(f.tipo || '').toUpperCase().includes('ESTOQUE') || String(f.tipo || '').toUpperCase().includes('DEPÓSITO') || String(f.tipo || '').toUpperCase().includes('DEPOSITO') ? '📦 ESTOQUE / DEPÓSITO' : '🏪 LOJA FÍSICA (PDV)'}
                              </span>
                            </div>
                          </div>
                          <ChevronRight size={18} className="text-gray-500 group-hover:translate-x-1 transition-all" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                ) : (
                  <div>
                    <div className="flex justify-between items-center mb-6 bg-[#0A0A0A] border border-[#222222] px-4 py-2.5 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Store size={16} className="text-[#6A0DAD]" />
                        <span className="text-xs font-bold text-white">Operando em: {activeFilialNome}</span>
                      </div>
                      <button
                        onClick={() => {
                          setActiveFilialId('');
                          setActiveFilialNome('');
                          localStorage.removeItem('activeFilialId');
                          localStorage.removeItem('activeFilialNome');
                        }}
                        className="text-[10px] text-purple-400 hover:text-purple-300 font-bold transition-all underline"
                      >
                        Trocar Ponto de Venda
                      </button>
                    </div>
                    {renderPdvContent()}
                  </div>
                )}
              </div>
            )}

{/* ABA 2: ENTRADA DE ESTOQUE - POKA-YOKE */}
            {activeTab === 'estoque' && profile?.role !== 'RH_ADMIN' && profile?.role !== 'GERENTE' && (
              <div className="space-y-8 animate-fadeIn">

                {/* Cabeçalho da Aba */}
                <div className="bg-gradient-to-r from-[#0A001A] to-[#0A0A0A] border border-[#6A0DAD]/30 p-6 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <h3 className="text-xl font-extrabold text-white flex items-center gap-2">
                      <Package size={22} className="text-[#6A0DAD]" />
                      Entrada de Estoque
                      <span className="text-xs bg-[#6A0DAD]/20 text-[#6A0DAD] border border-[#6A0DAD]/40 px-2 py-0.5 rounded-full font-semibold ml-1">Poka-Yoke</span>
                    </h3>
                    <p className="text-xs text-gray-500 mt-1">Selecione um modelo do catálogo e bipe os IMEIs. Validação automática em tempo real.</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-600 border border-[#222222] px-4 py-2 rounded-lg">
                    <span className="w-2 h-2 rounded-full bg-[#6A0DAD] animate-pulse"></span>
                    Scanner Mode Ativo
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                  {/* FORMULÁRIO DE ENTRADA DE ESTOQUE (Oculto para DONO) */}
                  {profile?.role !== 'DONO' && (
                    <div className="lg:col-span-2 space-y-5">
                    <div className="bg-[#0A0A0A] border border-[#222222] rounded-xl p-5 space-y-4">
                      <h4 className="text-sm font-bold text-white flex items-center gap-2 border-b border-[#222222] pb-3 mb-2">
                        <Smartphone size={16} className="text-[#6A0DAD]" />
                        Entrada Física de Aparelhos (Recebimento)
                      </h4>

                      {/* Campo 1: Dropdown 'Produto Mestre' */}
                      <div>
                        <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                          Produto Mestre
                        </label>
                        <select
                          value={selectedProdutoMestre ? selectedProdutoMestre.id : ''}
                          onChange={(e) => {
                            const prodId = e.target.value;
                            const prod = catalogoProdutos.find(p => p.id === prodId);
                            setSelectedProdutoMestre(prod || null);
                          }}
                          className="w-full bg-black border border-[#222222] focus:border-[#6A0DAD] rounded-md text-white px-4 py-2.5 text-sm outline-none transition-all"
                        >
                          <option value="">Selecione o Produto Mestre...</option>
                          {produtosMestreOptions.map(p => (
                            <option key={p.id} value={p.id}>{p.nome}</option>
                          ))}
                        </select>
                      </div>

                      {/* Campo 2: Input de 'IMEI' ou Quantidade */}
                      {tenantSettings.enable_imei ? (
                        <div>
                          <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5 font-mono">
                            IMEI (Exclusivo, 15 dígitos)
                          </label>
                          <input
                            ref={imeiInputRef}
                            type="text"
                            inputMode="numeric"
                            value={entradaImei}
                            onChange={(e) => setEntradaImei(e.target.value.replace(/\D/g, '').slice(0, 15))}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleSalvarEstoqueFisico(e);
                              }
                            }}
                            placeholder="Digite ou bipe o IMEI..."
                            maxLength={15}
                            className="w-full bg-black border border-[#222222] focus:border-[#6A0DAD] rounded-md text-white px-4 py-2.5 text-sm outline-none font-mono tracking-widest transition-all"
                          />
                        </div>
                      ) : (
                        <div>
                          <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                            Quantidade
                          </label>
                          <input
                            type="number"
                            min="1"
                            value={entradaQtdAcessorio}
                            onChange={(e) => setEntradaQtdAcessorio(e.target.value)}
                            className="w-full bg-black border border-[#222222] focus:border-[#6A0DAD] rounded-md text-white px-4 py-2.5 text-sm outline-none transition-all font-mono"
                          />
                        </div>
                      )}

                      {/* Campo 3: Dropdown/Input de 'Cor' */}
                      <div>
                        <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                          Cor do Aparelho
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            value={entradaCorDispositivo}
                            onChange={(e) => setEntradaCorDispositivo(e.target.value)}
                            placeholder="Selecione ou digite a cor..."
                            className="w-full bg-black border border-[#222222] focus:border-[#6A0DAD] rounded-md text-white px-4 py-2.5 text-sm outline-none transition-all"
                            list="cores-sugeridas-recebimento"
                          />
                          <datalist id="cores-sugeridas-recebimento">
                            <option value="Titânio Natural" />
                            <option value="Titânio Preto" />
                            <option value="Titânio Branco" />
                            <option value="Titânio Azul" />
                            <option value="Preto" />
                            <option value="Branco" />
                            <option value="Gold" />
                            <option value="Silver" />
                            <option value="Cinza Espacial" />
                          </datalist>
                        </div>
                      </div>

                      {/* Campo 4: Dropdown de 'Filial de Destino' */}
                      <div>
                        <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                          Filial de Destino (Localização Física)
                        </label>
                        <select
                          value={selectedFilialDestino}
                          onChange={(e) => setSelectedFilialDestino(e.target.value)}
                          className="w-full bg-black border border-[#222222] focus:border-[#6A0DAD] rounded-md text-white px-4 py-2.5 text-sm outline-none transition-all"
                        >
                          <option value="">Selecione a Filial...</option>
                          {filiais.map(f => (
                            <option key={f.id} value={f.id}>{f.nome} {f.tipo === 'ESTOQUE' ? '📦' : '🏪'}</option>
                          ))}
                        </select>
                      </div>

                      <button
                        onClick={handleSalvarEstoqueFisico}
                        disabled={loadingEntrada || !selectedProdutoMestre || (tenantSettings.enable_imei && !entradaImei) || !selectedFilialDestino}
                        className="w-full bg-[#6A0DAD] hover:bg-[#500885] disabled:bg-[#111111] disabled:text-gray-600 disabled:cursor-not-allowed text-white font-extrabold py-3 px-6 rounded-xl transition-all flex items-center justify-center gap-2 text-sm shadow-lg shadow-[#6A0DAD]/20 hover:shadow-[#6A0DAD]/40 mt-4"
                      >
                        {loadingEntrada ? (
                          <>
                            <Loader2 className="animate-spin" size={16} />
                            Salvando...
                          </>
                        ) : (
                          <>
                            <CheckCircle2 size={16} />
                            Salvar Entrada Física
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                  {/* PAINEL DIREITO: Lista de IMEIs + Estoque */}
                  <div className={`${profile?.role === 'DONO' ? 'lg:col-span-5' : 'lg:col-span-3'} space-y-5`}>
                    {/* Últimas Entradas de Aparelhos (Histórico Recente) */}
                    <div className="bg-[#0A0A0A] border border-[#222222] rounded-xl p-5">
                      <h4 className="text-sm font-bold text-white flex items-center gap-2 mb-4 border-b border-[#222222] pb-3">
                        <ClipboardList size={15} className="text-[#6A0DAD]" />
                        Últimos Aparelhos Recebidos (Rede)
                      </h4>

                      {ultimosRecebidos.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 text-gray-700">
                          <Smartphone size={28} className="mb-2 opacity-30" />
                          <p className="text-xs italic">Nenhum aparelho recebido recentemente.</p>
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                          {ultimosRecebidos.map((item, idx) => (
                            <div
                              key={item.id || idx}
                              className="flex items-center justify-between rounded-lg px-3 py-2.5 border bg-black/40 border-[#222222] hover:border-[#6A0DAD]/30 transition-all"
                            >
                              <div className="flex items-center gap-3">
                                <Smartphone size={15} className="text-purple-400 flex-shrink-0" />
                                <div>
                                  <p className="text-xs font-bold text-white tracking-wider">
                                    {item.produtos?.nome || 'Modelo não identificado'}
                                  </p>
                                  <p className="text-[10px] text-gray-500 font-mono">
                                    IMEI: <span className="text-gray-300 font-semibold">{item.imei}</span> · Cor: <span className="text-gray-300 font-semibold">{item.cor || 'Sem Cor'}</span>
                                  </p>
                                </div>
                              </div>
                              <div>
                                <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wider ${
                                  item.status === 'VENDIDO' || item.status === 'Vendido'
                                    ? 'bg-red-950/20 text-red-400 border border-red-800/30'
                                    : 'bg-green-950/20 text-green-400 border border-green-800/30'
                                }`}>
                                  {item.status}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Estoque Consolidado */}
                    <div className="bg-[#0A0A0A] border border-[#222222] rounded-xl p-5 flex flex-col">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
                        <h4 className="text-sm font-bold text-white flex items-center gap-2">
                          <Database size={15} className="text-[#6A0DAD]" />
                          Estoque Consolidado
                        </h4>
                        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto flex-wrap">
                          <div className="relative flex-1 min-w-[150px] sm:w-44">
                            <Search size={13} className="absolute left-3 top-2.5 text-gray-600" />
                            <input
                              type="text"
                              value={buscaEstoque}
                              onChange={(e) => setBuscaEstoque(e.target.value)}
                              placeholder="Nome, SKU, IMEI..."
                              className="w-full bg-black border border-[#222222] focus:border-[#6A0DAD] rounded-md text-white pl-8 pr-4 py-2 text-xs outline-none transition-all"
                            />
                          </div>
                          <select
                            value={filtroFilialEstoque}
                            onChange={(e) => setFiltroFilialEstoque(e.target.value)}
                            className="bg-black border border-[#222222] rounded-md text-white px-3 py-2 text-xs outline-none focus:border-[#6A0DAD] min-w-[120px]"
                          >
                            <option value="">Todas as Filiais</option>
                            {filiais.map(f => (
                              <option key={f.id} value={f.id}>{f.nome}</option>
                            ))}
                          </select>
                          <select
                            value={filtroCategoriaEstoque}
                            onChange={(e) => setFiltroCategoriaEstoque(e.target.value)}
                            className="bg-black border border-[#222222] rounded-md text-white px-3 py-2 text-xs outline-none focus:border-[#6A0DAD] min-w-[120px]"
                          >
                            <option value="">Todas as Categorias</option>
                            {categorias.map(cat => (
                              <option key={cat.id} value={cat.nome}>{cat.nome}</option>
                            ))}
                          </select>
                          <select
                            value={filtroStatusEstoque}
                            onChange={(e) => setFiltroStatusEstoque(e.target.value)}
                            className="bg-black border border-[#222222] rounded-md text-white px-3 py-2 text-xs outline-none focus:border-[#6A0DAD] min-w-[125px]"
                          >
                            <option value="">Disponibilidade (Todas)</option>
                            <option value="disponivel">Disponível</option>
                            <option value="indisponivel">Indisponível</option>
                          </select>
                        </div>
                      </div>

                      {loadingDados ? (
                        <div className="flex flex-col items-center justify-center py-16 gap-3">
                          <div className="w-7 h-7 border-3 border-[#6A0DAD] border-t-transparent rounded-full animate-spin"></div>
                          <span className="text-xs text-gray-600">Carregando estoque...</span>
                        </div>
                      ) : filteredProdutosEstoque.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-gray-700">
                          <Package size={30} className="mb-2 opacity-30" />
                          <span className="text-sm italic">Nenhum produto no estoque.</span>
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="border-b border-[#222222] text-gray-600 font-bold uppercase tracking-wider">
                                <th className="pb-3">Produto</th>
                                <th className="pb-3">Filial</th>
                                <th className="pb-3">Cat.</th>
                                <th className="pb-3">Preço</th>
                                <th className="pb-3">Qtd</th>
                                <th className="pb-3 text-right">Ações</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#111111]">
                              {filteredProdutosEstoque.map(p => (
                                <React.Fragment key={p.id}>
                                  <tr className="hover:bg-[#6A0DAD]/5 transition-colors">
                                    <td className="py-2.5 font-semibold text-white">
                                      <div className="flex items-center gap-1.5">
                                        {p.tipo === 'CELULAR' ? <Smartphone size={12} className="text-[#6A0DAD]" /> : <Tag size={12} className="text-pink-400" />}
                                        <span className="truncate max-w-[120px]" title={p.nome}>{p.nome}</span>
                                      </div>
                                    </td>
                                    <td className="py-2.5 text-gray-500 truncate max-w-[80px]">{filiais.find(f => f.id === p.filial_id)?.nome || '-'}</td>
                                    <td className="py-2.5">
                                      <span className={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                        p.categoria === 'IOS' ? 'bg-blue-950/20 text-blue-400 border border-blue-800/20' :
                                        p.categoria === 'ANDROID' ? 'bg-green-950/20 text-green-400 border border-green-800/20' :
                                        p.categoria === 'SERVICO' ? 'bg-pink-950/20 text-pink-400 border border-pink-800/20' :
                                        'bg-purple-950/20 text-purple-400 border border-purple-800/20'
                                      }`}>{p.categoria}</span>
                                    </td>
                                    <td className="py-2.5 font-mono font-bold text-white text-[11px]">
                                      <div className="flex items-center gap-2">
                                        <span>R$ {p.preco.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                        {profile?.role !== 'DONO' && ['SUPER_ADMIN', 'ADMIN', 'GERENTE', 'ESTOQUISTA'].includes(profile?.role) && (
                                          <button 
                                            onClick={() => handleUpdateProdutoPreco(p.id, p.nome, p.preco)}
                                            className="text-gray-500 hover:text-[#6A0DAD] transition-colors"
                                            title="Editar Preço"
                                          >
                                            <Edit2 size={12} />
                                          </button>
                                        )}
                                      </div>
                                    </td>
                                    <td className="py-2.5">
                                      {p.tipo === 'CELULAR' ? (
                                        <button
                                          onClick={() => toggleVerImeis(p.id)}
                                          className="text-[#6A0DAD] underline font-bold hover:text-purple-300 transition-colors"
                                        >
                                          {disponiveisImeis.filter(im => im.produto_id === p.id && im.filial_id === p.filial_id && (im.status === 'DISPONÍVEL' || im.status === 'Disponível')).length} (IMEIs)
                                        </button>
                                      ) : (
                                        <span className="text-gray-300 font-semibold">{p.categoria === 'SERVICO' ? '∞' : p.quantidade}</span>
                                      )}
                                    </td>
                                    {profile?.role !== 'DONO' && (
                                      <td className="py-2.5 text-right">
                                        {['SUPER_ADMIN', 'ADMIN', 'GERENTE', 'ESTOQUISTA'].includes(profile?.role) && (
                                          <button
                                            onClick={() => handleDeleteProduto(p.id)}
                                            className="p-1 border border-[#222222] hover:border-red-800/60 text-gray-600 hover:text-red-400 rounded bg-black transition-colors"
                                            title="Remover produto"
                                          >
                                            <Trash2 size={12} />
                                          </button>
                                        )}
                                      </td>
                                    )}
                                  </tr>
                                  {expandedProductImeis[p.id] && (
                                    <tr className="bg-black">
                                      <td colSpan="6" className="py-3 px-4 border-l-2 border-l-[#6A0DAD]">
                                        <div className="bg-[#050505] border border-[#1A1A1A] p-3 rounded-lg">
                                          <span className="block text-[10px] font-bold text-gray-500 mb-2 uppercase tracking-wide">
                                            IMEIs de {p.nome} nesta filial
                                          </span>
                                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-1.5">
                                            {(!productImeisMap[p.id] || productImeisMap[p.id].filter(imObj => imObj.filial_id === p.filial_id).length === 0) ? (
                                              <span className="text-xs italic text-gray-700 col-span-3">Nenhum IMEI registrado nesta filial.</span>
                                            ) : (
                                              productImeisMap[p.id]?.filter(imObj => imObj.filial_id === p.filial_id).map((imObj, idx) => (
                                                <div key={idx} className="flex flex-col bg-black border border-[#222222] p-2.5 rounded text-xs font-mono gap-1">
                                                  <div className="flex justify-between items-center">
                                                    <span className="text-gray-400 tracking-wider font-bold">{imObj.imei}</span>
                                                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold ${
                                                      imObj.vendido
                                                        ? 'bg-red-950/20 text-red-400 border border-red-850/30'
                                                        : 'bg-green-950/20 text-green-400 border border-green-800/30'
                                                    }`}>
                                                      {imObj.vendido ? 'Vendido' : 'Disponível'}
                                                    </span>
                                                  </div>
                                                  {imObj.is_seminovo && (
                                                    <div className="text-[10px] text-gray-500 border-t border-[#111] pt-1 mt-1 space-y-0.5">
                                                      <p><span className="text-purple-400 font-bold">Semi-Novo:</span> {imObj.cor || 'Sem Cor'} · Bateria: {imObj.bateria_saude || '--'}% · Pago: R$ {parseFloat(imObj.preco_compra || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                                      {imObj.observacoes && <p className="italic text-gray-600">Obs: {imObj.observacoes}</p>}
                                                    </div>
                                                  )}
                                                </div>
                                              ))
                                            )}
                                          </div>
                                        </div>
                                      </td>
                                    </tr>
                                  )}
                                </React.Fragment>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                  </div>
                </div>
              </div>
            )}


            {/* ABA 3: RANKING & METAS (GERENTE) */}
            {activeTab === 'ranking' && profile?.role !== 'RH_ADMIN' && (
              <div className="space-y-8 animate-fadeIn">
                {/* Painel do Mês */}
                <div className="bg-[#0A0A0A] border border-[#222222] p-6 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <Award size={20} className="text-[#6A0DAD]" />
                      Ranking Geral de Vendas da Equipe
                    </h3>
                    <p className="text-xs text-gray-500 mt-1">Classificação em tempo real baseada no volume bruto faturado.</p>
                  </div>
                  
                  <div className="flex items-center gap-2 bg-black border border-[#222222] p-2 rounded">
                    <Calendar size={14} className="text-[#6A0DAD]" />
                    <span className="text-xs font-semibold text-gray-400">Filtrar Mês:</span>
                    <input
                      type="month"
                      value={filtroMes}
                      onChange={(e) => setFiltroMes(e.target.value)}
                      className="bg-black text-white text-xs font-bold focus:outline-none"
                    />
                  </div>
                </div>

                {/* Métricas do Mês do Gerente */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="bg-[#0A0A0A] border border-[#222222] p-6 rounded-xl">
                    <span className="text-xs text-gray-500 uppercase font-bold tracking-wider block">Faturamento Bruto</span>
                    <span className="text-2xl font-black text-white mt-2 block font-mono">
                      R$ {gerenteMetrics.volumeTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="bg-[#0A0A0A] border border-[#222222] p-6 rounded-xl border-l-4 border-l-[#6A0DAD]">
                    <span className="text-xs text-gray-500 uppercase font-bold tracking-wider block">Total Comissões Pagas</span>
                    <span className="text-2xl font-black text-[#6A0DAD] mt-2 block font-mono">
                      R$ {gerenteMetrics.comissoesTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="bg-[#0A0A0A] border border-[#222222] p-6 rounded-xl">
                    <span className="text-xs text-gray-500 uppercase font-bold tracking-wider block">Transações Efetuadas</span>
                    <span className="text-2xl font-black text-white mt-2 block">{gerenteMetrics.vendasCount} vendas</span>
                  </div>
                  <div className="bg-[#0A0A0A] border border-[#222222] p-6 rounded-xl border-l-4 border-l-yellow-500">
                    <span className="text-xs text-gray-500 uppercase font-bold tracking-wider block">Líder de Vendas 🏆</span>
                    <span className="text-sm font-extrabold text-white mt-2 block truncate">
                      {gerenteMetrics.melhorVendedor ? `${gerenteMetrics.melhorVendedor.nome} (R$ ${gerenteMetrics.melhorVendedor.totalSalesVolume.toLocaleString('pt-BR', { maximumFractionDigits: 0 })})` : 'Nenhum vendedor'}
                    </span>
                  </div>
                </div>

                {/* Tabela do Leaderboard */}
                <div className="bg-[#0A0A0A] border border-[#222222] rounded-xl p-6">
                  <h4 className="text-sm font-bold text-gray-300 mb-4 uppercase tracking-wider">Classificação de Vendedores</h4>
                  
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-[#222222] text-gray-500 font-bold uppercase tracking-wider">
                          <th className="pb-3">Posição</th>
                          <th className="pb-3">Vendedor</th>
                          <th className="pb-3">Filial</th>
                          <th className="pb-3">Perfil</th>
                          <th className="pb-3 text-center">Transações</th>
                          <th className="pb-3">Volume de Vendas</th>
                          <th className="pb-3">Ticket Médio</th>
                          <th className="pb-3 text-right">Comissão Acumulada</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#222222]/60">
                        {getLeaderboard().map((v, index) => {
                          const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}º`;
                          return (
                            <tr key={v.id} className="hover:bg-purple-950/5 transition-colors">
                              <td className="py-4 font-black text-sm text-center sm:text-left pr-4">{medal}</td>
                              <td className="py-4 font-extrabold text-white">{v.nome}</td>
                              <td className="py-4 text-gray-400">
                                {filiais.find(f => f.id === v.filial_id)?.nome || 'Sem filial'}
                              </td>
                              <td className="py-4">
                                <span className={`inline-flex px-2 py-0.5 rounded text-[9px] font-bold ${
                                  v.is_treinner 
                                    ? 'bg-yellow-950/20 text-yellow-400 border border-yellow-800/20' 
                                    : 'bg-green-950/20 text-green-400 border border-green-800/20'
                                }`}>
                                  {v.is_treinner ? 'Trainee' : 'Profissional'}
                                </span>
                              </td>
                              <td className="py-4 text-center font-bold text-gray-300">{v.salesCount}</td>
                              <td className="py-4 font-mono font-bold text-white">
                                R$ {v.totalSalesVolume.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </td>
                              <td className="py-4 font-mono font-bold text-blue-400">
                                R$ {v.ticketMedio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </td>
                              <td className="py-4 font-mono font-bold text-[#6A0DAD] text-right">
                                R$ {v.totalComission.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ABA 4: RELATÓRIOS & FECHAMENTOS (GERENTE) */}
            {activeTab === 'fechamentos' && profile?.role !== 'RH_ADMIN' && (
              <div className="space-y-8 animate-fadeIn">
                <div className="flex border-b border-[#222222] gap-4 mb-6">
                  <div className="flex items-center gap-2 bg-black border border-[#222222] px-3 py-1.5 rounded text-xs mb-2">
                    <Calendar size={14} className="text-[#6A0DAD]" />
                    <span className="text-gray-400 font-semibold">Mês do Relatório:</span>
                    <input
                      type="month"
                      value={filtroMes}
                      onChange={(e) => setFiltroMes(e.target.value)}
                      className="bg-black text-white text-xs font-bold focus:outline-none"
                    />
                  </div>
                  <button
                    onClick={() => window.print()}
                    className="flex items-center gap-2 border border-[#222222] hover:border-purple-800 hover:text-purple-300 bg-black text-xs font-bold py-1.5 px-4 rounded transition-all ml-auto self-start"
                  >
                    <FileText size={14} />
                    Imprimir Relatório
                  </button>
                </div>

                {/* 1. SEÇÃO DE FECHAMENTOS DIÁRIOS */}
                <div className="bg-[#0A0A0A] border border-[#222222] rounded-xl p-6 print:hidden">
                  <h3 className="text-base font-bold text-white flex items-center gap-2 mb-4">
                    <ClipboardList size={16} className="text-[#6A0DAD]" />
                    Fechamentos de Caixa Diários Recebidos
                  </h3>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-[#222222] text-gray-500 font-bold uppercase tracking-wider">
                          <th className="pb-3">Data / Hora</th>
                          <th className="pb-3">Vendedor</th>
                          <th className="pb-3">Filial</th>
                          <th className="pb-3">Dinheiro</th>
                          <th className="pb-3">Cartão</th>
                          <th className="pb-3">Pix</th>
                          <th className="pb-3">Total Reportado</th>
                          <th className="pb-3 text-center">Transf. Saída</th>
                          <th className="pb-3 text-center">Transf. Entrada</th>
                          <th className="pb-3">Comprovante</th>
                          <th className="pb-3 text-right">Obs</th>
                          {(profile?.role === 'ADMIN' || profile?.role === 'OWNER' || profile?.role === 'SUPER_ADMIN') && (
                            <th className="pb-3 text-center">Ações</th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#222222]/50">
                        {fechamentos.filter(fech => {
                          const date = new Date(fech.created_at);
                          const [year, month] = filtroMes.split('-');
                          return date.getMonth() === parseInt(month, 10) - 1 && date.getFullYear() === parseInt(year, 10);
                        }).length === 0 ? (
                          <tr>
                            <td colSpan={(profile?.role === 'ADMIN' || profile?.role === 'OWNER' || profile?.role === 'SUPER_ADMIN') ? "12" : "11"} className="py-6 text-center italic text-gray-600">Nenhum fechamento diário enviado neste mês.</td>
                          </tr>
                        ) : (
                          fechamentos.filter(fech => {
                            const date = new Date(fech.created_at);
                            const [year, month] = filtroMes.split('-');
                            return date.getMonth() === parseInt(month, 10) - 1 && date.getFullYear() === parseInt(year, 10);
                          }).map(fech => {
                            const total = parseFloat(fech.valor_dinheiro) + parseFloat(fech.valor_cartao) + parseFloat(fech.valor_pix);
                            return (
                              <tr key={fech.id} className="hover:bg-purple-950/5 transition-colors">
                                <td className="py-3 text-gray-400 font-mono">
                                  {new Date(fech.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                </td>
                                <td className="py-3 font-semibold text-white">{fech.profiles?.nome || 'Desconhecido'}</td>
                                <td className="py-3 text-gray-400">{fech.filiais?.nome || 'Sem filial'}</td>
                                <td className="py-3 font-mono text-gray-300">R$ {parseFloat(fech.valor_dinheiro).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                <td className="py-3 font-mono text-gray-300">R$ {parseFloat(fech.valor_cartao).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                <td className="py-3 font-mono text-gray-300">R$ {parseFloat(fech.valor_pix).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                <td className="py-3 font-mono font-bold text-white">
                                  <div className="flex items-center gap-1.5">
                                    <span>R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                    {fech.alterado_por && (
                                      <span 
                                        className="px-1.5 py-0.5 text-[9px] font-extrabold uppercase rounded bg-yellow-950/40 text-yellow-400 border border-yellow-800/30 cursor-help shrink-0"
                                        title={`Motivo da correção: "${fech.motivo_alteracao}"\nValores Originais:\n- Dinheiro: R$ ${parseFloat(fech.valores_originais?.valor_dinheiro || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n- Cartão: R$ ${parseFloat(fech.valores_originais?.valor_cartao || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n- Pix: R$ ${parseFloat(fech.valores_originais?.valor_pix || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                                      >
                                        [Corrigido]
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="py-3 text-center font-bold text-gray-300">
                                  {fech.qtd_transferencias_saida || 0} <span className="text-[10px] text-gray-600">un</span>
                                </td>
                                <td className="py-3 text-center font-bold text-gray-300">
                                  {fech.qtd_transferencias_entrada || 0} <span className="text-[10px] text-gray-600">un</span>
                                </td>
                                <td className="py-3">
                                  {fech.comprovante_url ? (
                                    <button
                                      onClick={() => setModalComprovante(fech.comprovante_url)}
                                      className="flex items-center gap-1 text-[#6A0DAD] hover:text-purple-400 font-bold outline-none"
                                    >
                                      <Eye size={12} />
                                      Ver Foto
                                    </button>
                                  ) : (
                                    <span className="text-gray-600 italic">Sem foto</span>
                                  )}
                                </td>
                                <td className="py-3 text-gray-400 text-right pr-2 truncate max-w-xs" title={fech.observacoes}>
                                  {fech.observacoes || '-'}
                                </td>
                                {(profile?.role === 'ADMIN' || profile?.role === 'OWNER' || profile?.role === 'SUPER_ADMIN') && (
                                  <td className="py-3 text-center">
                                    <button
                                      onClick={() => handleAbrirAjusteCaixa(fech)}
                                      className="flex items-center gap-1 text-[#6A0DAD] hover:text-purple-400 font-bold outline-none mx-auto"
                                      title="Corrigir Valores"
                                    >
                                      <Edit2 size={12} />
                                      Corrigir
                                    </button>
                                  </td>
                                )}
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 2. SEÇÃO DE RELATÓRIO GERAL DE VENDAS */}
                <div className="bg-[#0A0A0A] border border-[#222222] rounded-xl p-6 print:border-none print:bg-white print:text-black">
                  <h3 className="text-base font-bold text-white print:text-black flex items-center gap-2 mb-4">
                    <FileText size={16} className="text-[#6A0DAD] print:hidden" />
                    Relatório Detalhado de Vendas e Comissões
                  </h3>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-[#222222] text-gray-500 font-bold uppercase tracking-wider">
                          <th className="pb-3">Data</th>
                          <th className="pb-3">Vendedor</th>
                          <th className="pb-3">Produto</th>
                          <th className="pb-3">Filial</th>
                          <th className="pb-3 text-center">Qtd</th>
                          <th className="pb-3">Valor Total</th>
                          {['ADMIN', 'ADM', 'ADMINISTRADOR', 'RH', 'RH_ADMIN', 'GERENTE', 'SUPER_ADMIN', 'OWNER'].includes(profile?.role) && (
                            <th className="pb-3">Autorizado Por</th>
                          )}
                          <th className="pb-3 text-right">Comissão</th>
                          {(profile?.role === 'SUPER_ADMIN' || profile?.role === 'GERENTE') && (
                            <th className="pb-3 text-right print:hidden">Ações</th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#222222]/50">
                        {vendas.filter(sale => {
                          const date = new Date(sale.created_at);
                          const [year, month] = filtroMes.split('-');
                          return date.getMonth() === parseInt(month, 10) - 1 && date.getFullYear() === parseInt(year, 10);
                        }).length === 0 ? (
                          <tr>
                            <td colSpan={['ADMIN', 'ADM', 'ADMINISTRADOR', 'RH', 'RH_ADMIN', 'GERENTE', 'SUPER_ADMIN', 'OWNER'].includes(profile?.role) ? 9 : 7} className="py-6 text-center italic text-gray-600">Nenhuma venda faturada neste mês.</td>
                          </tr>
                        ) : (
                          vendas.filter(sale => {
                            const date = new Date(sale.created_at);
                            const [year, month] = filtroMes.split('-');
                            return date.getMonth() === parseInt(month, 10) - 1 && date.getFullYear() === parseInt(year, 10);
                          }).map(sale => (
                            <tr key={sale.id} className="hover:bg-purple-950/5 print:hover:bg-transparent transition-colors">
                              <td className="py-3 text-gray-400 font-mono">
                                {new Date(sale.created_at).toLocaleDateString('pt-BR')}
                              </td>
                              <td className="py-3 font-semibold text-white print:text-black">{sale.profiles?.nome || 'Vendedor'}</td>
                              <td className="py-3 font-semibold text-white print:text-black">{sale.produtos?.nome || 'Produto Removido'}</td>
                              <td className="py-3 text-gray-400">
                                {filiais.find(f => f.id === sale.filial_id)?.nome || 'Sem filial'}
                              </td>
                              <td className="py-3 text-center font-bold">{sale.quantidade}</td>
                              <td className="py-3 font-mono font-bold text-white print:text-black">R$ {parseFloat(sale.valor_total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                              {['ADMIN', 'ADM', 'ADMINISTRADOR', 'RH', 'RH_ADMIN', 'GERENTE', 'SUPER_ADMIN', 'OWNER'].includes(profile?.role) && (
                                <td className="py-3 text-gray-400">
                                  {sale.autorizador?.nome || sale.desconto_autorizado_por || '-'}
                                </td>
                              )}
                              <td className="py-3 font-mono font-bold text-[#6A0DAD] print:text-black text-right">R$ {parseFloat(sale.comissao).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                              {['SUPER_ADMIN', 'ADMIN', 'GERENTE', 'OWNER'].includes(profile?.role) && (
                                <td className="py-3 text-right print:hidden">
                                  <div className="flex justify-end items-center gap-1.5">
                                    <button
                                      onClick={() => handleOpenEditVenda(sale)}
                                      className="p-1.5 text-gray-600 hover:text-[#6A0DAD] hover:bg-[#6A0DAD]/10 rounded transition-colors"
                                      title="Editar Venda"
                                    >
                                      <Edit2 size={14} />
                                    </button>
                                    <button
                                      onClick={() => handleEstornarVenda(sale.id)}
                                      className="p-1.5 text-gray-600 hover:text-red-400 hover:bg-red-950/20 rounded transition-colors"
                                      title="Estornar Venda"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                </td>
                              )}
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'transferencias' && profile?.role !== 'RH_ADMIN' && profile?.role !== 'GERENTE' && renderTransferencias()}

            {activeTab === 'categorias' && profile?.role !== 'RH_ADMIN' && (
              <div className="space-y-8 animate-fadeIn">
                <div className="bg-gradient-to-r from-[#0A001A] to-[#0A0A0A] border border-[#6A0DAD]/30 p-6 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <h3 className="text-xl font-extrabold text-white flex items-center gap-2">
                      <Tag size={22} className="text-[#6A0DAD]" />
                      Categorias de Produtos
                    </h3>
                    <p className="text-xs text-gray-500 mt-1">
                      Gerencie as categorias de produtos da sua empresa. As categorias cadastradas aqui estarão disponíveis para o cadastro de produtos.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                  
                  {/* Formulário de Nova Categoria */}
                  <div className="bg-[#0A0A0A] border border-[#222222] rounded-xl p-5 space-y-4 lg:col-span-1">
                    <h4 className="text-sm font-bold text-white flex items-center gap-2 border-b border-[#222222] pb-3 mb-2">
                      <Plus size={16} className="text-[#6A0DAD]" />
                      Nova Categoria
                    </h4>
                    <form onSubmit={handleCreateCategoria} className="space-y-4">
                      <div>
                        <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                          Nome da Categoria
                        </label>
                        <input
                          type="text"
                          value={novaCategoriaNome}
                          onChange={(e) => setNovaCategoriaNome(e.target.value)}
                          placeholder="Ex: Smartwatches, Cabos..."
                          className="w-full bg-black border border-[#222222] focus:border-[#6A0DAD] rounded-md text-white px-4 py-2.5 text-sm outline-none transition-all"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={!novaCategoriaNome.trim()}
                        className="w-full bg-[#6A0DAD] hover:bg-[#500885] disabled:bg-[#111111] disabled:text-gray-600 disabled:cursor-not-allowed text-white font-extrabold py-3 px-6 rounded-xl transition-all flex items-center justify-center gap-2 text-sm shadow-lg shadow-[#6A0DAD]/20 hover:shadow-[#6A0DAD]/40"
                      >
                        <Plus size={16} />
                        Adicionar Nova Categoria
                      </button>
                    </form>
                  </div>

                  {/* Lista de Categorias */}
                  <div className="bg-[#0A0A0A] border border-[#222222] rounded-xl p-5 flex flex-col lg:col-span-2">
                    <h4 className="text-sm font-bold text-white flex items-center gap-2 mb-4 border-b border-[#222222] pb-3">
                      <Tag size={15} className="text-[#6A0DAD]" />
                      Categorias Cadastradas ({categorias.length})
                    </h4>
                    {loadingCategorias ? (
                      <div className="flex flex-col items-center justify-center py-16 gap-3">
                        <Loader2 className="animate-spin text-[#6A0DAD]" size={24} />
                        <span className="text-xs text-gray-600">Carregando categorias...</span>
                      </div>
                    ) : categorias.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-16 text-gray-700">
                        <Tag size={30} className="mb-2 opacity-30" />
                        <span className="text-sm italic">Nenhuma categoria cadastrada.</span>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-[#222222] text-gray-600 font-bold uppercase tracking-wider">
                              <th className="pb-3">Categoria</th>
                              <th className="pb-3">Data de Cadastro</th>
                              <th className="pb-3 text-right">Ações</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#111111]">
                            {categorias.map(cat => (
                              <tr key={cat.id} className="hover:bg-[#6A0DAD]/5 transition-colors">
                                <td className="py-3 font-semibold text-white">
                                  {cat.nome}
                                </td>
                                <td className="py-3 text-gray-500">
                                  {new Date(cat.created_at).toLocaleDateString('pt-BR')}
                                </td>
                                <td className="py-3 text-right">
                                  <button
                                    onClick={() => handleDeleteCategoria(cat.id, cat.nome)}
                                    className="p-1 border border-[#222222] hover:border-red-800/60 text-gray-600 hover:text-red-400 rounded bg-black transition-colors"
                                    title="Remover categoria"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                  
                </div>
              </div>
            )}

            {activeTab === 'clientes' && profile?.role !== 'ESTOQUISTA' && (
              <div className="space-y-8 animate-fadeIn">
                <div className="bg-gradient-to-r from-[#0A001A] to-[#0A0A0A] border border-[#6A0DAD]/30 p-6 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <h3 className="text-xl font-extrabold text-white flex items-center gap-2">
                      <Users size={22} className="text-[#6A0DAD]" />
                      Cadastro e Gestão de Clientes
                    </h3>
                    <p className="text-xs text-gray-500 mt-1">
                      Gerencie e visualize a base de clientes cadastrada no sistema.
                    </p>
                  </div>
                  <button
                    onClick={handleOpenNewClienteModal}
                    className="bg-[#6A0DAD] hover:bg-[#500885] text-white px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-lg shadow-[#6A0DAD]/20"
                  >
                    <Plus size={14} />
                    Adicionar Cliente
                  </button>
                </div>

                {/* Filtro de Busca */}
                <div className="bg-[#0A0A0A] border border-[#222222] p-4 rounded-xl flex items-center gap-3">
                  <Search size={16} className="text-gray-500" />
                  <input
                    type="text"
                    value={buscaCliente}
                    onChange={(e) => setBuscaCliente(e.target.value)}
                    placeholder="Buscar por nome, CPF/CNPJ, e-mail..."
                    className="bg-transparent text-sm text-white placeholder-gray-600 outline-none w-full"
                  />
                </div>

                {/* Tabela de Clientes */}
                <div className="bg-[#0A0A0A] border border-[#222222] rounded-xl p-5 flex flex-col">
                  {loadingClientes ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-3">
                      <Loader2 className="animate-spin text-[#6A0DAD]" size={24} />
                      <span className="text-xs text-gray-600">Carregando clientes...</span>
                    </div>
                  ) : clientes.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-gray-700">
                      <Users size={30} className="mb-2 opacity-30" />
                      <span className="text-sm italic">Nenhum cliente cadastrado.</span>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-[#222222] text-gray-600 font-bold uppercase tracking-wider">
                            <th className="pb-3">Nome</th>
                            <th className="pb-3">CPF / CNPJ</th>
                            <th className="pb-3">E-mail</th>
                            <th className="pb-3">Telefone</th>
                            <th className="pb-3">Data de Cadastro</th>
                            <th className="pb-3 text-right">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#111111]">
                          {clientes
                            .filter(c => {
                              const q = buscaCliente.toLowerCase().trim();
                              if (!q) return true;
                              return (
                                c.nome.toLowerCase().includes(q) ||
                                (c.cpf_cnpj && c.cpf_cnpj.includes(q)) ||
                                (c.email && c.email.toLowerCase().includes(q)) ||
                                (c.telefone && c.telefone.includes(q))
                              );
                            })
                            .map(c => (
                              <tr key={c.id} className="hover:bg-[#6A0DAD]/5 transition-colors">
                                <td className="py-3.5 font-semibold text-white">
                                  {c.nome}
                                </td>
                                <td className="py-3.5 text-gray-300 font-mono">
                                  {c.cpf_cnpj || '-'}
                                </td>
                                <td className="py-3.5 text-gray-300">
                                  {c.email || '-'}
                                </td>
                                <td className="py-3.5 text-gray-300 font-mono">
                                  {c.telefone || '-'}
                                </td>
                                <td className="py-3.5 text-gray-500">
                                  {new Date(c.created_at).toLocaleDateString('pt-BR')}
                                </td>
                                <td className="py-3.5 text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    <button
                                      onClick={() => handleOpenEditClienteModal(c)}
                                      className="p-1 border border-[#222222] hover:border-[#6A0DAD]/40 text-gray-500 hover:text-white rounded bg-black transition-colors"
                                      title="Editar cliente"
                                    >
                                      <Edit2 size={12} />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteCliente(c.id, c.nome)}
                                      className="p-1 border border-[#222222] hover:border-red-800/60 text-gray-600 hover:text-red-400 rounded bg-black transition-colors"
                                      title="Remover cliente"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ABA: GESTÃO DE EQUIPE / FUNCIONÁRIOS */}
            {activeTab === 'equipe' && ['ADMIN', 'SUPER_ADMIN', 'OWNER', 'DONO', 'RH', 'GERENTE'].includes(profile?.role) && (
              <div className="space-y-8 animate-fadeIn font-sans">
                {/* Header Banner */}
                <div className="bg-gradient-to-r from-[#0A001A] to-[#0A0A0A] border border-[#6A0DAD]/30 p-6 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <h3 className="text-xl font-extrabold text-white flex items-center gap-2">
                      <UserPlus size={22} className="text-[#6A0DAD]" />
                      Gestão de Equipe &amp; Colaboradores
                    </h3>
                    <p className="text-xs text-gray-500 mt-1">
                      Gerencie e cadastre colaboradores, permissões de acesso e alocação por filial na sua empresa.
                    </p>
                  </div>
                  {profile?.role !== 'DONO' && (
                    <button
                      onClick={() => {
                        setNewColabNome('');
                        setNewColabEmail('');
                        setNewColabSenha('');
                        setNewColabRole('VENDEDOR');
                        setNewColabFilialId(profile?.role === 'GERENTE' ? (profile?.filial_id || activeFilialId || '') : '');
                        setIsAddCollaboratorModalOpen(true);
                      }}
                      className="bg-[#6A0DAD] hover:bg-[#500885] text-white px-5 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 shadow-lg shadow-[#6A0DAD]/20 cursor-pointer"
                    >
                      <Plus size={16} />
                      Novo Colaborador
                    </button>
                  )}
                </div>

                {/* Filtros de Busca e Cargo */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2 bg-[#0A0A0A] border border-[#222222] p-3.5 rounded-xl flex items-center gap-3">
                    <Search size={16} className="text-gray-500" />
                    <input
                      type="text"
                      value={buscaColaborador}
                      onChange={(e) => setBuscaColaborador(e.target.value)}
                      placeholder="Buscar colaborador por nome, e-mail ou cargo..."
                      className="bg-transparent text-xs text-white placeholder-gray-600 outline-none w-full"
                    />
                  </div>

                  <div className="bg-[#0A0A0A] border border-[#222222] p-3 rounded-xl flex items-center gap-2">
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap pl-1">Cargo:</span>
                    <select
                      value={filtroColaboradorRole}
                      onChange={(e) => setFiltroColaboradorRole(e.target.value)}
                      className="w-full bg-black border border-[#222222] focus:border-[#6A0DAD] text-white text-xs font-bold py-1.5 px-2.5 rounded-lg outline-none cursor-pointer"
                    >
                      <option value="TODOS">Todos os Cargos</option>
                      <option value="TRAINEE">Trainees</option>
                      <option value="VENDEDOR">Vendedores</option>
                      <option value="ESTOQUISTA">Estoquistas</option>
                      <option value="GERENTE">Gerentes</option>
                      <option value="ADMIN">Administradores</option>
                    </select>
                  </div>
                </div>

                {/* Tabela de Colaboradores */}
                <div className="bg-[#0A0A0A] border border-[#222222] rounded-xl p-5 flex flex-col">
                  {isLoadingTeamMembers ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-3">
                      <Loader2 className="animate-spin text-[#6A0DAD]" size={24} />
                      <span className="text-xs text-gray-500">Carregando equipe de colaboradores...</span>
                    </div>
                  ) : teamMembers.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-gray-600 space-y-3">
                      <Users size={36} className="opacity-30" />
                      <p className="text-sm font-semibold">Nenhum colaborador encontrado.</p>
                      <button
                        onClick={() => setIsAddCollaboratorModalOpen(true)}
                        className="text-xs text-[#6A0DAD] hover:underline font-bold"
                      >
                        + Cadastrar primeiro colaborador
                      </button>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-[#222222] text-gray-500 font-bold uppercase tracking-wider">
                            <th className="pb-3.5">Colaborador</th>
                            <th className="pb-3.5">E-mail</th>
                            <th className="pb-3.5">Cargo / Função</th>
                            <th className="pb-3.5">Filial Alocada</th>
                            <th className="pb-3.5">Status</th>
                            {profile?.role !== 'DONO' && <th className="pb-3.5 text-right">Ações</th>}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#111111]">
                          {teamMembers
                            .filter(member => {
                              const q = buscaColaborador.toLowerCase().trim();
                              const matchSearch = !q || 
                                (member.nome && member.nome.toLowerCase().includes(q)) ||
                                (member.email && member.email.toLowerCase().includes(q)) ||
                                (member.role && member.role.toLowerCase().includes(q));

                              const matchRole = filtroColaboradorRole === 'TODOS' ||
                                (filtroColaboradorRole === 'ADMIN' && ['ADMIN', 'SUPER_ADMIN', 'OWNER', 'DONO'].includes(member.role)) ||
                                (filtroColaboradorRole === 'RH' && ['RH', 'RH_ADMIN'].includes(member.role)) ||
                                member.role === filtroColaboradorRole;

                              return matchSearch && matchRole;
                            })
                            .map((member) => {
                              const isGerenteCreator = profile?.role === 'GERENTE';
                              const emailLower = (member.email || '').toLowerCase().trim();
                              const nomeLower = (member.nome || '').toLowerCase().trim();
                              let memberRole = member.role || 'VENDEDOR';
                              if (emailLower.includes('rodrigo') || nomeLower.includes('rodrigo')) {
                                memberRole = 'GERENTE';
                              }
                              
                              let roleBadgeStyle = 'bg-blue-950/40 text-blue-400 border-blue-800/40';
                              if (['ADMIN', 'SUPER_ADMIN', 'OWNER', 'DONO'].includes(memberRole)) {
                                roleBadgeStyle = 'bg-red-950/40 text-red-400 border-red-800/40';
                    roleBadgeStyle = 'bg-teal-950/40 text-teal-400 border-teal-800/40';
                              }

                              const filialObj = filiais.find(f => f.id === member.filial_id);
                              const filialNome = filialObj ? filialObj.nome : 'Todas as Filiais / Global';

                              return (
                                <tr key={member.id} className="hover:bg-white/5 transition-colors">
                                  <td className="py-4">
                                    <div className="flex items-center gap-3">
                                      <div className="w-8 h-8 rounded-full bg-[#6A0DAD]/15 border border-[#6A0DAD]/30 text-[#6A0DAD] font-extrabold flex items-center justify-center text-xs shrink-0">
                                        {member.nome ? member.nome.charAt(0).toUpperCase() : 'U'}
                                      </div>
                                      <div>
                                        <span className="block font-bold text-white text-xs">{member.nome || 'Sem Nome'}</span>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="py-4 font-mono text-xs text-gray-400">
                                    {member.email || '-'}
                                  </td>
                                  <td className="py-4">
                                    {profile?.role !== 'DONO' && ['SUPER_ADMIN', 'ADMIN', 'OWNER', 'RH', 'GERENTE'].includes(profile?.role) ? (
                                      <select
                                        value={memberRole}
                                        onChange={(e) => handleUpdateEmployeeRole(member.id, e.target.value, member.email)}
                                        className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider outline-none cursor-pointer border ${roleBadgeStyle}`}
                                      >
                                        <option value="TRAINEE" className="bg-black text-white">TRAINEE</option>
                                        <option value="VENDEDOR" className="bg-black text-white">VENDEDOR</option>
                                        <option value="ESTOQUISTA" className="bg-black text-white">ESTOQUISTA</option>
                                        <option value="GERENTE" className="bg-black text-white">GERENTE</option>
                                        {profile?.role !== 'GERENTE' && (
                                          <>
                                            <option value="ADMIN" className="bg-black text-white">ADMINISTRADOR</option>
                                            {['SUPER_ADMIN', 'ADMIN', 'OWNER', 'DONO'].includes(profile?.role) && (
                                              <option value="DONO" className="bg-black text-white">DONO (Proprietário / CEO)</option>
                                            )}
                                          </>
                                        )}
                                      </select>
                                    ) : (
                                      <span className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider border ${roleBadgeStyle}`}>
                                        {memberRole}
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-4 text-gray-300 text-xs">
                                    {profile?.role !== 'DONO' && ['SUPER_ADMIN', 'ADMIN', 'GERENTE', 'OWNER', 'RH'].includes(profile?.role) ? (
                                      <select
                                        value={member.filial_id || ''}
                                        onChange={(e) => handleUpdateEmployeeFilial(member.id, e.target.value, member.email)}
                                        className="bg-black border border-[#222222] focus:border-[#6A0DAD] hover:border-[#6A0DAD]/60 text-white text-xs font-semibold px-2.5 py-1 rounded-md outline-none cursor-pointer transition-all shadow-sm"
                                      >
                                        <option value="" className="bg-black text-gray-400">[ Todas as Filiais / Global ]</option>
                                        {filiais.map((f) => (
                                          <option key={f.id} value={f.id} className="bg-black text-white font-semibold">
                                            {f.nome}
                                          </option>
                                        ))}
                                      </select>
                                    ) : (
                                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-black border border-[#222222] rounded text-[11px] font-medium">
                                        <Store size={12} className="text-[#6A0DAD]" />
                                        {filialNome}
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-4">
                                    <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-green-950/20 text-green-400 border border-green-800/30">
                                      Ativo
                                    </span>
                                  </td>
                                  {profile?.role !== 'DONO' && (
                                    <td className="py-4 text-right">
                                      <div className="flex items-center justify-end gap-2">
                                        <button
                                          onClick={() => handleOpenEditColaboradorModal(member)}
                                          className="p-1.5 border border-[#222222] hover:border-[#6A0DAD]/60 text-gray-400 hover:text-white rounded bg-black transition-colors cursor-pointer"
                                          title="Editar Informações do Colaborador (E-mail, Telefone, CPF, Senha)"
                                        >
                                          <Edit2 size={13} />
                                        </button>
                                        {(!isGerenteCreator || ['VENDEDOR', 'ESTOQUISTA'].includes(memberRole)) && member.id !== session?.user?.id && (
                                          <button
                                            onClick={() => handleDeleteColaborador(member.id, member.nome, member.email)}
                                            className="p-1.5 border border-[#222222] hover:border-red-800/60 text-gray-500 hover:text-red-400 rounded bg-black transition-colors"
                                            title="Excluir Colaborador"
                                          >
                                            <Trash2 size={13} />
                                          </button>
                                        )}
                                      </div>
                                    </td>
                                  )}
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* AUDITORIA DE DESCONTOS CONCEDIDOS */}
            {(activeTab === 'descontos' || currentView === 'descontos') && ['ADMIN', 'SUPER_ADMIN', 'OWNER', 'DONO', 'GERENTE'].includes(profile?.role) && renderAuditoriaDescontos()}
          </div>
        ) : (
          /* PAINEL DE CONTROLE DO VENDEDOR */
          <div className="space-y-8">
            
            {/* SE FILIAL ATIVA NÃO FOR ESCOLHIDA AINDA */}
            {!activeFilialId ? (
              <div className="max-w-3xl mx-auto space-y-8 animate-fadeIn">
                <div className="text-center space-y-3">
                  <Store size={48} className="text-[#6A0DAD] mx-auto animate-pulse" />
                  <h2 className="text-2xl md:text-3xl font-extrabold text-white">Escolha a Filial de Trabalho</h2>
                  <p className="text-gray-400 text-sm max-w-md mx-auto">
                    Selecione o ponto de venda (PDV) onde você está operando hoje para liberar as telas de caixa e metas.
                  </p>
                </div>

                {filiais
                  .filter(f => !f.tipo || f.tipo?.toUpperCase() !== 'ESTOQUE')
                  .filter(f => ['ADMIN', 'SUPER_ADMIN', 'GERENTE', 'OWNER', 'DONO'].includes(profile?.role) || !profile?.filial_id || f.id === profile.filial_id)
                  .length === 0 ? (
                  <div className="bg-[#0A0A0A] border border-dashed border-[#222222] p-8 text-center rounded-lg text-gray-500 space-y-4">
                    <p className="text-sm text-gray-400">Nenhum ponto de venda autorizado ou cadastrado na sua empresa.</p>
                    {['SUPER_ADMIN', 'OWNER', 'DONO', 'ADMIN', 'GERENTE'].includes(profile?.role) && (
                      <button
                        onClick={() => setIsCreateFilialModalOpen(true)}
                        className="bg-[#6A0DAD] hover:bg-[#500885] text-white px-5 py-2.5 rounded-lg text-sm font-bold inline-flex items-center gap-2 transition-all shadow-lg shadow-[#6A0DAD]/20 cursor-pointer"
                      >
                        <Plus size={16} /> Cadastrar Primeira Filial
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                    {filiais
                      .filter(f => !f.tipo || f.tipo?.toUpperCase() !== 'ESTOQUE')
                      .filter(f => ['ADMIN', 'SUPER_ADMIN', 'GERENTE', 'OWNER', 'DONO'].includes(profile?.role) || !profile?.filial_id || f.id === profile.filial_id)
                      .map(f => (
                      <button
                        key={f.id}
                        onClick={() => {
                          setActiveFilialId(f.id);
                          setActiveFilialNome(f.nome);
                          localStorage.setItem('zenite_active_filial_id', f.id);
                          localStorage.setItem('zenite_active_filial_nome', f.nome);
                          fetchVendedorData(f.id, session.user.id);
                        }}
                        className="group bg-[#0A0A0A] border border-[#222222] hover:border-[#6A0DAD] hover:bg-[#6A0DAD]/5 p-6 rounded-xl transition-all duration-300 text-left flex flex-col gap-4 shadow-lg hover:shadow-[#6A0DAD]/10"
                      >
                        <div className="w-10 h-10 bg-[#6A0DAD]/10 group-hover:bg-[#6A0DAD]/20 rounded-lg flex items-center justify-center text-[#6A0DAD] transition-all">
                          <Store size={20} />
                        </div>
                        <div>
                          <h4 className="font-extrabold text-base text-white group-hover:text-[#6A0DAD] transition-colors">{f.nome}</h4>
                          <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider mt-1 block">
                            🏬 Ponto de Venda (PDV)
                          </span>
                        </div>
                        <div className="mt-2 text-xs font-bold text-gray-400 group-hover:text-white flex items-center gap-1">
                          Selecionar Filial &rarr;
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* DASHBOARD DE VENDEDOR COM FILIAL ESCOLHIDA */
              <div className="space-y-8 animate-fadeIn">
                {/* Cabeçalho da Filial Ativa */}
                <div className="bg-gradient-to-r from-[#0A0A0A] to-[#120520]/20 border border-[#222222] p-6 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#6A0DAD]/20 text-[#6A0DAD] rounded-lg flex items-center justify-center">
                      <Store size={20} />
                    </div>
                    <div>
                      <span className="block text-[10px] text-gray-500 uppercase tracking-widest">Ponto de Venda Ativo</span>
                      <span className="text-base font-extrabold text-white">{activeFilialNome}</span>
                    </div>
                  </div>

                </div>

                {activeSellerTab === 'pdv' && renderPdvContent()}

                {/* VENDEDOR ABA 2: MINHAS METAS */}
                {activeSellerTab === 'metas' && (
                  <div className="space-y-8 animate-fadeIn">
                    
                    {/* Indicador de Perfil Trainee */}
                    {profile?.is_treinner && (
                      <div className="border border-yellow-800/40 bg-yellow-950/10 text-yellow-400 p-4 rounded-lg flex items-center gap-3 text-xs leading-relaxed">
                        <AlertCircle size={20} className="shrink-0" />
                        <div>
                          <strong>Perfil Trainee Ativo:</strong> De acordo com as normas da gerência, sua comissão sobre Serviços Técnicos é ajustada para 2%.
                        </div>
                      </div>
                    )}

                    {/* KPIs Pessoais */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="bg-[#0A0A0A] border border-[#222222] p-6 rounded-xl">
                        <span className="text-xs text-gray-500 uppercase font-bold tracking-wider block">Minhas Vendas (Mês Atual)</span>
                        <span className="text-2xl font-black text-white mt-2 block font-mono">
                          R$ {metasInfo.totalVendasGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="bg-[#0A0A0A] border border-[#222222] p-6 rounded-xl">
                        <span className="text-xs text-gray-500 uppercase font-bold tracking-wider block">Ticket Médio</span>
                        <span className="text-2xl font-black text-blue-400 mt-2 block font-mono">
                          R$ {metasInfo.ticketMedio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="bg-[#0A0A0A] border border-[#222222] p-6 rounded-xl border-l-4 border-l-[#6A0DAD]">
                        <span className="text-xs text-gray-500 uppercase font-bold tracking-wider block">Minhas Comissões (Mês Atual)</span>
                        <span className="text-2xl font-black text-[#6A0DAD] mt-2 block font-mono">
                          R$ {metasInfo.totalComissoes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="bg-[#0A0A0A] border border-[#222222] p-6 rounded-xl">
                        <span className="text-xs text-gray-500 uppercase font-bold tracking-wider block">Objetivo Mensal</span>
                        <span className="text-2xl font-black text-gray-400 mt-2 block font-mono">
                          {formatMetaValue(metasInfo.metaObjetivo, metasInfo.tipoMeta)}
                        </span>
                        {/* Badge de tipo */}
                        <span className={`mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                          isUnitMetric(metasInfo.tipoMeta)
                            ? 'bg-blue-950/40 text-blue-400 border border-blue-800/40'
                            : 'bg-purple-950/40 text-purple-400 border border-purple-800/40'
                        }`}>
                          {isUnitMetric(metasInfo.tipoMeta) ? `🧾 Meta de ${getMetricName(metasInfo.tipoMeta)}` : '📊 Faturamento Geral'}
                        </span>
                      </div>
                    </div>

                    {/* Medidor da Meta */}
                    <div className="bg-[#0A0A0A] border border-[#222222] p-6 rounded-xl space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-white uppercase tracking-wide flex items-center gap-1.5">
                          <TrendingUp size={14} className="text-[#6A0DAD]" />
                          Medidor de Meta
                          <span className={`ml-1 px-1.5 py-0.5 rounded text-[8px] font-bold ${
                            isUnitMetric(metasInfo.tipoMeta)
                              ? 'bg-blue-950/60 text-blue-300'
                              : 'bg-purple-950/60 text-purple-300'
                          }`}>
                            {isUnitMetric(metasInfo.tipoMeta) ? `🧾 ${getMetricName(metasInfo.tipoMeta)}` : '📊 Geral'}
                          </span>
                        </span>
                        <span className="text-sm font-black text-[#A78BFA]">{metasInfo.progressoPercent}% atingido</span>
                      </div>
                      
                      <div className="w-full bg-[#161616] rounded-full h-3.5 overflow-hidden border border-[#222222]">
                        <div 
                          className={`h-full rounded-full transition-all duration-500 ${
                            isUnitMetric(metasInfo.tipoMeta)
                              ? 'bg-gradient-to-r from-blue-700 to-blue-400 shadow-[0_0_8px_#3b82f6]'
                              : 'bg-gradient-to-r from-[#6A0DAD] to-pink-500 shadow-[0_0_8px_#6A0DAD]'
                          }`}
                          style={{ width: `${metasInfo.progressoPercent}%` }}
                        ></div>
                      </div>

                      <p className="text-xs text-gray-400 leading-relaxed">
                        {metasInfo.progressoPercent >= 100 
                          ? '🚀 Excelente! Você superou o seu objetivo de vendas para o mês. Continue faturando!'
                          : isUnitMetric(metasInfo.tipoMeta)
                            ? `Progresso em ${getMetricName(metasInfo.tipoMeta)}: ${Math.round(metasInfo.totalVendas)} de ${formatMetaValue(metasInfo.metaObjetivo, metasInfo.tipoMeta)}. Falta ${Math.max(0, Math.round(metasInfo.metaObjetivo - metasInfo.totalVendas))} ${getMetricLabel(metasInfo.tipoMeta)}.`
                            : `Falta ${(metasInfo.metaObjetivo - metasInfo.totalVendas).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} em vendas brutas para atingir seu objetivo.`}
                      </p>
                    </div>

                    {/* Minhas Vendas Recentes */}
                    <div className="bg-[#0A0A0A] border border-[#222222] rounded-xl p-6">
                      <h4 className="text-sm font-bold text-gray-300 mb-4 uppercase tracking-wider">Histórico Recente de Vendas</h4>
                      
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-[#222222] text-gray-500 font-bold uppercase tracking-wider">
                              <th className="pb-3">Data</th>
                              <th className="pb-3">Produto</th>
                              <th className="pb-3">Categoria</th>
                              <th className="pb-3 text-center">Quantidade</th>
                              <th className="pb-3">Total Bruto</th>
                              <th className="pb-3 text-right">Sua Comissão</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#222222]/50">
                            {metasInfo.historico.length === 0 ? (
                              <tr>
                                <td colSpan="6" className="py-6 text-center italic text-gray-600">Você ainda não registrou nenhuma venda neste mês.</td>
                              </tr>
                            ) : (
                              metasInfo.historico.map(sale => (
                                <tr key={sale.id} className="hover:bg-purple-950/5 transition-colors">
                                  <td className="py-3 text-gray-400 font-mono">
                                    {new Date(sale.created_at).toLocaleDateString('pt-BR')}
                                  </td>
                                  <td className="py-3 font-semibold text-white">{sale.produtos?.nome || 'Produto Removido'}</td>
                                  <td className="py-3">
                                    <span className="inline-flex px-2 py-0.5 rounded text-[9px] font-bold bg-[#6A0DAD]/10 text-purple-300">
                                      {sale.produtos?.categoria || 'Geral'}
                                    </span>
                                  </td>
                                  <td className="py-3 text-center font-bold text-gray-300">{sale.quantidade}</td>
                                  <td className="py-3 font-mono font-bold text-white">R$ {parseFloat(sale.valor_total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                  <td className="py-3 font-mono font-bold text-green-400 text-right">R$ {parseFloat(sale.comissao).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                  </div>
                )}

                {/* VENDEDOR ABA 3: FECHAMENTO DE CAIXA */}
                {activeSellerTab === 'fechamento' && (
                  <div className="max-w-xl mx-auto animate-fadeIn">
                    <div className="bg-[#0A0A0A] border border-[#222222] rounded-xl p-6 space-y-6">
                      <div className="space-y-1">
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                          <ClipboardList size={18} className="text-[#6A0DAD]" />
                          Fechamento de Caixa Diário
                        </h3>
                        <p className="text-xs text-gray-500 leading-relaxed">
                          Informe as vendas brutas processadas por meio de cada modalidade financeira hoje e anexe a foto do comprovante final emitido pela maquininha.
                        </p>
                      </div>

                      <form onSubmit={handleSubmeterFechamento} className="space-y-4">
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <label className="block text-[10px] font-bold text-gray-550 uppercase tracking-wider mb-2">
                              Espécie (R$)
                            </label>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={fechamentoDinheiro}
                              onChange={(e) => setFechamentoDinheiro(e.target.value)}
                              className="w-full bg-black border border-[#222222] focus:border-[#6A0DAD] rounded px-3 py-2 text-xs text-white outline-none"
                              placeholder="0.00"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-gray-550 uppercase tracking-wider mb-2">
                              Cartão (R$)
                            </label>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={fechamentoCartao}
                              onChange={(e) => setFechamentoCartao(e.target.value)}
                              className="w-full bg-black border border-[#222222] focus:border-[#6A0DAD] rounded px-3 py-2 text-xs text-white outline-none"
                              placeholder="0.00"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-gray-550 uppercase tracking-wider mb-2">
                              PIX (R$)
                            </label>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={fechamentoPix}
                              onChange={(e) => setFechamentoPix(e.target.value)}
                              className="w-full bg-black border border-[#222222] focus:border-[#6A0DAD] rounded px-3 py-2 text-xs text-white outline-none"
                              placeholder="0.00"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-gray-550 uppercase tracking-wider mb-2">
                              Boleto (R$)
                            </label>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={fechamentoBoleto}
                              onChange={(e) => setFechamentoBoleto(e.target.value)}
                              className="w-full bg-black border border-[#222222] focus:border-[#6A0DAD] rounded px-3 py-2 text-xs text-white outline-none"
                              placeholder="0.00"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-gray-550 uppercase tracking-wider mb-2">
                              Troca (R$)
                            </label>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={fechamentoTroca}
                              onChange={(e) => setFechamentoTroca(e.target.value)}
                              className="w-full bg-black border border-[#222222] focus:border-[#6A0DAD] rounded px-3 py-2 text-xs text-white outline-none"
                              placeholder="0.00"
                            />
                          </div>
                        </div>

                        {/* Comprovante Upload */}
                        <div className="space-y-2">
                          <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wide">
                            Foto do Comprovante da Maquininha (Obrigatório)
                          </label>
                          <div className="border border-dashed border-[#222222] hover:border-[#6A0DAD]/50 bg-black p-4 rounded text-center cursor-pointer relative transition-colors">
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleComprovanteChange}
                              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                              required
                            />
                            <div className="flex flex-col items-center gap-2">
                              <Upload size={20} className="text-gray-550" />
                              <span className="text-xs text-gray-400">Arraste ou clique para selecionar imagem do recibo</span>
                              <span className="text-[9px] text-gray-600">Formatos: PNG, JPG, JPEG (Máx 2MB)</span>
                            </div>
                          </div>
                        </div>

                        {/* Preview Imagem Comprovante */}
                        {fechamentoComprovante && (
                          <div className="bg-black border border-[#222222] p-3 rounded flex flex-col items-center gap-2">
                            <span className="text-[10px] text-gray-500 uppercase block self-start">Pré-visualização do Anexo</span>
                            <img 
                              src={fechamentoComprovante} 
                              alt="Recibo" 
                              className="max-h-48 object-contain rounded border border-[#161616]" 
                            />
                          </div>
                        )}

                        {/* Obs */}
                        <div>
                          <label className="block text-[10px] font-bold text-gray-450 uppercase tracking-wider mb-2">
                            Observações / Diferenças de Caixa
                          </label>
                          <textarea
                            rows="3"
                            value={fechamentoObs}
                            onChange={(e) => setFechamentoObs(e.target.value)}
                            placeholder="Descreva se ocorreu alguma divergência de valores ou observação importante."
                            className="w-full bg-black border border-[#222222] focus:border-[#6A0DAD] rounded p-3 text-xs text-white outline-none resize-none"
                          ></textarea>
                        </div>

                        <button
                          type="submit"
                          disabled={loadingFechamento}
                          className="w-full bg-[#6A0DAD] hover:bg-[#500885] disabled:bg-gray-800 disabled:text-gray-500 text-xs font-bold py-3 rounded transition-all shadow-md"
                        >
                          {loadingFechamento ? 'Enviando fechamento...' : 'Enviar Fechamento de Caixa'}
                        </button>
                      </form>
                    </div>
                  </div>
                )}

                {activeSellerTab === 'transferencias' && renderTransferencias()}

                {activeSellerTab === 'clientes' && (
                  <div className="space-y-8 animate-fadeIn">
                    <div className="bg-gradient-to-r from-[#0A001A] to-[#0A0A0A] border border-[#6A0DAD]/30 p-6 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div>
                        <h3 className="text-xl font-extrabold text-white flex items-center gap-2">
                          <Users size={22} className="text-[#6A0DAD]" />
                          Meus Clientes Cadastrados
                        </h3>
                        <p className="text-xs text-gray-500 mt-1">
                          Visualize e gerencie os clientes cadastrados por você.
                        </p>
                      </div>
                      <button
                        onClick={handleOpenNewClienteModal}
                        className="bg-[#6A0DAD] hover:bg-[#500885] text-white px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-lg shadow-[#6A0DAD]/20"
                      >
                        <Plus size={14} />
                        Cadastrar Cliente
                      </button>
                    </div>

                    {/* Filtro de Busca */}
                    <div className="bg-[#0A0A0A] border border-[#222222] p-4 rounded-xl flex items-center gap-3">
                      <Search size={16} className="text-gray-500" />
                      <input
                        type="text"
                        value={buscaCliente}
                        onChange={(e) => setBuscaCliente(e.target.value)}
                        placeholder="Buscar por nome, CPF/CNPJ, e-mail..."
                        className="bg-transparent text-sm text-white placeholder-gray-600 outline-none w-full"
                      />
                    </div>

                    {/* Tabela de Clientes */}
                    <div className="bg-[#0A0A0A] border border-[#222222] rounded-xl p-5 flex flex-col">
                      {loadingClientes ? (
                        <div className="flex flex-col items-center justify-center py-16 gap-3">
                          <Loader2 className="animate-spin text-[#6A0DAD]" size={24} />
                          <span className="text-xs text-gray-600">Carregando clientes...</span>
                        </div>
                      ) : clientes.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-gray-700">
                          <Users size={30} className="mb-2 opacity-30" />
                          <span className="text-sm italic">Nenhum cliente cadastrado por você ainda.</span>
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="border-b border-[#222222] text-gray-600 font-bold uppercase tracking-wider">
                                <th className="pb-3">Nome</th>
                                <th className="pb-3">CPF / CNPJ</th>
                                <th className="pb-3">E-mail</th>
                                <th className="pb-3">Telefone</th>
                                <th className="pb-3">Data de Cadastro</th>
                                <th className="pb-3 text-right">Ações</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#111111]">
                              {clientes
                                .filter(c => {
                                  const q = buscaCliente.toLowerCase().trim();
                                  if (!q) return true;
                                  return (
                                    c.nome.toLowerCase().includes(q) ||
                                    (c.cpf_cnpj && c.cpf_cnpj.includes(q)) ||
                                    (c.email && c.email.toLowerCase().includes(q)) ||
                                    (c.telefone && c.telefone.includes(q))
                                  );
                                })
                                .map(c => (
                                  <tr key={c.id} className="hover:bg-[#6A0DAD]/5 transition-colors">
                                    <td className="py-3.5 font-semibold text-white">
                                      {c.nome}
                                    </td>
                                    <td className="py-3.5 text-gray-300 font-mono">
                                      {c.cpf_cnpj || '-'}
                                    </td>
                                    <td className="py-3.5 text-gray-300">
                                      {c.email || '-'}
                                    </td>
                                    <td className="py-3.5 text-gray-300 font-mono">
                                      {c.telefone || '-'}
                                    </td>
                                    <td className="py-3.5 text-gray-500">
                                      {new Date(c.created_at).toLocaleDateString('pt-BR')}
                                    </td>
                                    <td className="py-3.5 text-right">
                                      <div className="flex items-center justify-end gap-2">
                                        <button
                                          onClick={() => handleOpenEditClienteModal(c)}
                                          className="p-1 border border-[#222222] hover:border-[#6A0DAD]/40 text-gray-500 hover:text-white rounded bg-black transition-colors"
                                          title="Editar cliente"
                                        >
                                          <Edit2 size={12} />
                                        </button>
                                        <button
                                          onClick={() => handleDeleteCliente(c.id, c.nome)}
                                          className="p-1 border border-[#222222] hover:border-red-800/60 text-gray-600 hover:text-red-400 rounded bg-black transition-colors"
                                          title="Remover cliente"
                                        >
                                          <Trash2 size={12} />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                )}

              </div>
            )}

          </div>
        )}
      </main>

      {/* Footer Branding */}
      <footer className="w-full text-center py-6 bg-black border-t border-[#111111] text-[#6B7280] text-xs font-medium mt-auto print:hidden font-sans">
        © 2026 Vextron Lab | Developed by @Valentim
      </footer>

      {/* MODAL PARA VER FOTO DO COMPROVANTE (GERENTE) */}
      {modalComprovante && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 animate-fadeIn">
          <div className="bg-[#0A0A0A] border border-[#222222] rounded-xl max-w-xl w-full p-6 space-y-4 flex flex-col relative max-h-[90vh]">
            <button
              onClick={() => setModalComprovante(null)}
              className="absolute right-4 top-4 p-1 rounded-md bg-black border border-[#222222] hover:border-red-950 text-gray-400 hover:text-red-400 transition-colors"
            >
              <X size={16} />
            </button>

            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Eye size={18} className="text-[#6A0DAD]" />
              Foto do Recibo do Caixa
            </h3>
            
            <div className="flex-1 overflow-auto bg-black rounded border border-[#222222] p-2 flex items-center justify-center">
              <img 
                src={modalComprovante} 
                alt="Comprovante de Maquininha" 
                className="max-h-[60vh] object-contain rounded"
              />
            </div>
            
            <button
              onClick={() => setModalComprovante(null)}
              className="w-full bg-[#6A0DAD] hover:bg-[#500885] text-xs font-bold py-2 rounded transition-all"
            >
              Fechar Visualização
            </button>
          </div>
        </div>
      )}

      {/* MODAL DE AJUSTE GERENCIAL DE FECHAMENTO DE CAIXA */}
      {modalAjusteCaixaOpen && ajusteCaixaSelecionado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-[#0A0A0A] border border-[#222222] rounded-xl max-w-md w-full p-6 space-y-4 flex flex-col relative">
            <button
              onClick={() => setModalAjusteCaixaOpen(false)}
              className="absolute right-4 top-4 p-1 rounded-md bg-black border border-[#222222] hover:border-red-950 text-gray-400 hover:text-red-400 transition-colors"
            >
              <X size={16} />
            </button>

            <h3 className="text-base font-bold text-white flex items-center gap-2 pb-2 border-b border-[#222222]">
              <Edit2 size={18} className="text-[#6A0DAD]" />
              Corrigir Fechamento de Caixa
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                  Valor em Dinheiro (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={ajusteValorDinheiro}
                  onChange={(e) => setAjusteValorDinheiro(e.target.value)}
                  className="w-full bg-black border border-[#222222] focus:border-[#6A0DAD] rounded px-3 py-2 text-xs text-white outline-none font-mono"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                  Valor em Cartão (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={ajusteValorCartao}
                  onChange={(e) => setAjusteValorCartao(e.target.value)}
                  className="w-full bg-black border border-[#222222] focus:border-[#6A0DAD] rounded px-3 py-2 text-xs text-white outline-none font-mono"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                  Valor em PIX (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={ajusteValorPix}
                  onChange={(e) => setAjusteValorPix(e.target.value)}
                  className="w-full bg-black border border-[#222222] focus:border-[#6A0DAD] rounded px-3 py-2 text-xs text-white outline-none font-mono"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                  Motivo da Correção <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={ajusteMotivo}
                  onChange={(e) => setAjusteMotivo(e.target.value)}
                  className="w-full bg-black border border-[#222222] focus:border-[#6A0DAD] rounded px-3 py-2 text-xs text-white outline-none min-h-[80px]"
                  placeholder="Ex: Vendedor esqueceu de somar a última venda no PIX..."
                  required
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setModalAjusteCaixaOpen(false)}
                className="flex-1 bg-black border border-[#222222] hover:border-red-950 text-gray-400 hover:text-red-400 text-xs font-bold py-2.5 rounded transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={loadingAjusteCaixa || !ajusteMotivo.trim()}
                onClick={handleSalvarAjusteCaixa}
                className="flex-1 bg-[#6A0DAD] hover:bg-[#500885] disabled:bg-gray-800 disabled:text-gray-500 text-xs font-bold py-2.5 rounded transition-all"
              >
                {loadingAjusteCaixa ? 'Salvando...' : 'Salvar Alterações'}
              </button>
            </div>
          </div>
        </div>
      )}


      {/* MODAL DE RESTAURAÇÃO DE RASCUNHO (SRE) */}
      {showDraftModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-[#0A0A0A] border border-[#222222] rounded-xl max-w-md w-full p-6 shadow-2xl relative">
            <div className="flex justify-center mb-4">
              <div className="bg-purple-900/20 p-4 rounded-full border border-purple-500/30">
                <Save size={32} className="text-purple-400" />
              </div>
            </div>
            <h3 className="text-xl font-bold text-white text-center mb-2">
              Venda em Andamento Encontrada
            </h3>
            <p className="text-sm text-gray-400 text-center mb-6">
              Detectamos que você não finalizou a última venda (produto: <span className="text-purple-400 font-bold">{draftDataToRestore?.pdvProdutoSelecionado?.nome}</span>). Deseja restaurar os dados preenchidos no carrinho ou iniciar um novo atendimento limpo?
            </p>
            <div className="flex gap-4">
              <button
                onClick={discardDraft}
                className="flex-1 bg-transparent hover:bg-white/5 border border-[#333] text-white font-bold py-3 rounded transition-colors"
              >
                Descartar Rascunho
              </button>
              <button
                onClick={restoreDraft}
                className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded transition-colors shadow-lg shadow-purple-900/50"
              >
                Restaurar Venda
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE ROMANEIO DE TRANSFERÊNCIA */}
      {transfRomaneioAtivo && transfRomaneioDados && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 overflow-y-auto animate-fadeIn print:bg-white">
          <div className="bg-[#0A0A0A] border border-[#222222] rounded-xl max-w-xl w-full p-6 space-y-6 relative print:border-none print:bg-white print:text-black">
            
            <button
              onClick={() => setTransfRomaneioAtivo(false)}
              className="absolute right-4 top-4 p-1 rounded-md bg-black border border-[#222222] hover:border-red-950 text-gray-400 hover:text-red-400 transition-colors print:hidden"
            >
              <X size={16} />
            </button>

            <div className="text-center space-y-2">
              <span className="text-[10px] bg-blue-950/40 text-blue-400 border border-blue-800/40 px-2 py-0.5 rounded-full font-bold uppercase print:hidden">
                Romaneio de Transferência
              </span>
              {transfRomaneioDados.filial_logo && transfRomaneioDados.filial_logo.trim() !== '' ? (
                <img 
                  src={transfRomaneioDados.filial_logo} 
                  alt="Logo da Filial" 
                  className="max-w-[150px] max-h-[80px] mx-auto object-contain mb-2 grayscale print:grayscale print:contrast-125" 
                />
              ) : (
                <h2 className="text-xl font-bold text-white print:text-black tracking-tight flex justify-center items-center gap-2">
                  <Truck className="text-blue-500" size={20} /> ZÊNITE TRANSFER
                </h2>
              )}
              <p className="text-[10px] text-gray-500 font-mono">ID: {transfRomaneioDados.id}</p>
              <p className="text-[10px] text-gray-550">
                {new Date(transfRomaneioDados.data).toLocaleString('pt-BR')}
              </p>
            </div>

            <hr className="border-[#222222] print:border-gray-300" />

            <div className="grid grid-cols-2 gap-4 text-xs font-mono">
              <div>
                <span className="block text-gray-500 uppercase tracking-wider mb-1 font-bold">Origem</span>
                <span className="text-white print:text-black font-black">{transfRomaneioDados.origem}</span>
              </div>
              <div className="text-right">
                <span className="block text-gray-500 uppercase tracking-wider mb-1 font-bold">Destino</span>
                <span className="text-white print:text-black font-black">{transfRomaneioDados.destino}</span>
              </div>
            </div>

            {transfRomaneioDados.observacoes && (
              <div className="bg-black/50 border border-[#222222] p-3 rounded-lg text-xs print:bg-white print:border-gray-300">
                <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider block mb-1">
                  Observações
                </span>
                <p className="text-white print:text-black">{transfRomaneioDados.observacoes}</p>
              </div>
            )}

            <div className="bg-black border border-[#222222] p-4 rounded-lg space-y-2.5 print:bg-white print:border-gray-300">
              <span className="text-[9px] text-blue-400 font-bold uppercase tracking-wider block print:text-blue-600">
                Itens Transferidos ({transfRomaneioDados.itens.length})
              </span>
              <div className="divide-y divide-[#222222] print:divide-gray-300">
                {transfRomaneioDados.itens.map((item, idx) => (
                  <div key={idx} className="py-2 flex justify-between items-center">
                    <div>
                      <p className="text-sm font-bold text-white print:text-black">{item.nome}</p>
                      {item.imei && <p className="text-xs text-gray-500 font-mono">IMEI: {item.imei}</p>}
                    </div>
                    <span className="text-sm font-black text-white print:text-black">{item.quantidade} un</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-6 mt-6 border-t border-dashed border-[#222222] print:border-gray-300 flex justify-between">
              <div className="w-1/2 text-center border-t border-[#222222] mx-2 pt-2">
                <span className="text-[10px] text-gray-500 uppercase tracking-wider">Assinatura Expedição</span>
              </div>
              <div className="w-1/2 text-center border-t border-[#222222] mx-2 pt-2">
                <span className="text-[10px] text-gray-500 uppercase tracking-wider">Assinatura Recebimento</span>
              </div>
            </div>

            <div className="pt-6 flex justify-center print:hidden">
              <button
                onClick={() => window.print()}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-lg shadow-lg flex items-center gap-2 transition-all uppercase tracking-wider text-sm"
              >
                <Printer size={18} />
                Imprimir Romaneio
              </button>
            </div>
          </div>
        </div>
      )}


      {/* MODAL DE RECIBO DE VENDA CONSOLIDADO */}
      {pdvReciboAtivo && pdvReciboDados && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 overflow-y-auto animate-fadeIn print:bg-white">
          <div className="bg-[#0A0A0A] border border-[#222222] rounded-xl max-w-xl w-full p-6 space-y-6 relative print:border-none print:bg-white print:text-black">
            
            {/* Botão de Fechar no topo */}
            <button
              onClick={() => setPdvReciboAtivo(false)}
              className="absolute right-4 top-4 p-1 rounded-md bg-black border border-[#222222] hover:border-red-950 text-gray-400 hover:text-red-400 transition-colors print:hidden"
            >
              <X size={16} />
            </button>

            {/* Cabeçalho */}
            <div className="text-center space-y-1">
              <span className="text-[10px] bg-purple-950/40 text-purple-400 border border-purple-800/40 px-2 py-0.5 rounded-full font-bold uppercase print:hidden">
                Recibo de Venda Consolidado
              </span>
              {pdvReciboDados.filial_logo && pdvReciboDados.filial_logo.trim() !== '' ? (
                <img 
                  src={pdvReciboDados.filial_logo} 
                  alt="Logo da Filial" 
                  onLoad={() => setIsImageLoaded(true)}
                  className="max-w-[150px] max-h-[80px] mx-auto object-contain mb-2 grayscale print:grayscale print:contrast-125" 
                />
              ) : (
                <h2 className="text-xl font-bold text-white print:text-black tracking-tight flex justify-center items-center gap-2 mb-2">
                  {pdvReciboDados.filial_nome}
                </h2>
              )}
              
              <div className="text-[10px] text-gray-500 font-mono leading-tight mb-2">
                <p className="font-bold">{pdvReciboDados.filial_nome}</p>
                <p>{pdvReciboDados.filial_endereco}</p>
                <p>CNPJ: {pdvReciboDados.filial_cnpj} | Tel: {pdvReciboDados.filial_telefone}</p>
              </div>

              {pdvReciboDados.is_trainee && (
                <div className="border border-dashed border-gray-400 p-2 text-center text-[10px] font-bold uppercase mb-2">
                  Teve participação de Trainee
                </div>
              )}

              <p className="text-[10px] text-gray-500 font-mono mt-2">ID da Venda: {pdvReciboDados.venda_id}</p>
              <p className="text-[10px] text-gray-550">
                {new Date(pdvReciboDados.data).toLocaleString('pt-BR')}
              </p>
            </div>



            <hr className="border-[#222222] print:border-gray-300" />

            {/* Informações Básicas */}
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-gray-500 block uppercase font-bold text-[9px]">Vendedor</span>
                <span className="text-white print:text-black font-semibold">{pdvReciboDados.vendedor_nome}</span>
              </div>
              <div>
                <span className="text-gray-500 block uppercase font-bold text-[9px]">Filial</span>
                <span className="text-white print:text-black font-semibold">{pdvReciboDados.filial_nome}</span>
              </div>
              
              {/* Cliente Vinculado */}
              {(pdvReciboDados.cliente_nome || pdvReciboDados.cliente_cpf_cnpj) && (
                <div className="col-span-2 border-t border-[#222222]/60 pt-2">
                  <span className="text-gray-500 block uppercase font-bold text-[9px]">Cliente Vinculado</span>
                  <p className="text-white print:text-black font-semibold">
                    {pdvReciboDados.cliente_nome || 'Consumidor Final'}
                    {pdvReciboDados.cliente_cpf_cnpj && ` (CPF/CNPJ: ${pdvReciboDados.cliente_cpf_cnpj})`}
                  </p>
                  {(pdvReciboDados.cliente_telefone || pdvReciboDados.cliente_email) && (
                    <p className="text-[10px] text-gray-500 font-medium">
                      {pdvReciboDados.cliente_telefone && `Tel: ${pdvReciboDados.cliente_telefone}`}
                      {pdvReciboDados.cliente_telefone && pdvReciboDados.cliente_email && ' · '}
                      {pdvReciboDados.cliente_email && `Email: ${pdvReciboDados.cliente_email}`}
                    </p>
                  )}
                </div>
              )}
            </div>

            {pdvReciboDados.obs_garantia && (
              <div className="bg-black/50 border border-[#222222] p-3 rounded-lg text-xs print:bg-white print:border-gray-300 mb-4">
                <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider block mb-1 print:text-gray-600">
                  Observações de Garantia
                </span>
                <p className="text-white print:text-black whitespace-pre-wrap">{pdvReciboDados.obs_garantia}</p>
              </div>
            )}

            {/* Itens de Saída (Carrinho) */}
            <div className="bg-black border border-[#222222] p-4 rounded-lg space-y-2.5 print:bg-white print:border-gray-300">
              <span className="text-[9px] text-purple-400 font-bold uppercase tracking-wider block print:text-purple-650">
                Itens de Venda (Saída)
              </span>
              <div className="space-y-3 divide-y divide-[#222222]/50 print:divide-gray-200">
                {pdvReciboDados.itens && pdvReciboDados.itens.length > 0 ? (
                  pdvReciboDados.itens.map((item, idx) => (
                    <div key={idx} className={`flex justify-between items-start ${idx > 0 ? 'pt-2' : ''}`}>
                      <div>
                        <h4 className="font-extrabold text-sm text-white print:text-black">{item.nome}</h4>
                        {item.imei && (
                          <p className="text-[10px] text-gray-550 font-mono mt-0.5">IMEI: {item.imei}</p>
                        )}
                        <p className="text-[10px] text-gray-450">Qtd: {item.quantidade} unidade(s)</p>
                      </div>
                      <div className="text-right">
                        <span className="font-mono text-xs font-bold text-white print:text-black">
                          R$ {item.valor_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-extrabold text-sm text-white print:text-black">{pdvReciboDados.produto_novo.nome}</h4>
                      {pdvReciboDados.produto_novo.imei && (
                        <p className="text-[10px] text-gray-550 font-mono mt-0.5">IMEI: {pdvReciboDados.produto_novo.imei}</p>
                      )}
                      <p className="text-[10px] text-gray-450">Qtd: {pdvReciboDados.produto_novo.quantidade} unidade(s)</p>
                    </div>
                    <div className="text-right">
                      <span className="font-mono text-xs font-bold text-white print:text-black">
                        R$ {pdvReciboDados.produto_novo.preco.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Aparelhos de Entrada (Troca) */}
            {pdvReciboDados.trocas && pdvReciboDados.trocas.length > 0 && (
              <div className="space-y-3">
                <span className="text-[9px] text-purple-400 font-bold uppercase tracking-wider block">
                  Aparelho(s) Recebido(s) na Troca
                </span>
                {pdvReciboDados.trocas.map((troca, idx) => (
                  <div key={idx} className="bg-purple-950/5 border border-[#6A0DAD]/30 p-4 rounded-lg flex justify-between items-start print:bg-white print:border-gray-300">
                    <div className="space-y-1">
                      <h4 className="font-extrabold text-sm text-white print:text-black">{troca.nome}</h4>
                      <p className="text-[10px] text-gray-400 font-mono">IMEI: {troca.imei}</p>
                      <p className="text-[10px] text-gray-450 font-semibold">
                        Cor: {troca.cor} · Bateria: {troca.bateria}%
                      </p>
                      {troca.obs && (
                        <p className="text-[9px] text-gray-500 italic">Checklist: {troca.obs}</p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-mono text-xs font-bold text-[#A78BFA] print:text-black">
                        - R$ {troca.valor_avaliacao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <hr className="border-[#222222] print:border-gray-300" />

            {/* Resumo Financeiro */}
            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-gray-400">
                <span>Subtotal (Novo):</span>
                <span className="font-mono">R$ {pdvReciboDados.financeiro.total_novo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              </div>
              {pdvReciboDados.trocas && pdvReciboDados.trocas.length > 0 && (
                <div className="flex justify-between text-[#A78BFA] print:text-black">
                  <span>Abatimento por Troca:</span>
                  <span className="font-mono">- R$ {pdvReciboDados.financeiro.desconto_troca.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
              )}
              <div className="flex justify-between text-white print:text-black font-extrabold text-sm border-t border-[#222222] pt-2">
                <span>Saldo Pago:</span>
                <span className="font-mono">R$ {pdvReciboDados.financeiro.saldo_pagar.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-gray-500 text-[10px] border-t border-[#222222]/50 pt-2">
                <span>Método de Pagamento:</span>
                <span className="font-bold uppercase text-white print:text-black">
                  {pdvReciboDados.financeiro.metodo === 'troca' ? (
                    pdvReciboDados.financeiro.saldo_pagar > 0 ? (
                      `Troca + ${pdvReciboDados.financeiro.metodo_saldo === 'cartao' ? `Cartão (${pdvReciboDados.financeiro.parcelas}x)` : pdvReciboDados.financeiro.metodo_saldo === 'pix' ? 'Pix' : 'Dinheiro'}`
                    ) : (
                      'Troca (Totalmente Abatido)'
                    )
                  ) : (
                    pdvReciboDados.financeiro.metodo === 'cartao' 
                      ? `Cartão (${pdvReciboDados.financeiro.parcelas}x)` 
                      : pdvReciboDados.financeiro.metodo === 'pix' 
                      ? 'Pix' 
                      : 'Dinheiro'
                  )}
                </span>
              </div>
            </div>

            {/* Ações */}
            <div className="flex flex-col gap-2 pt-2 print:hidden">
              {pdvReciboDados.nfe_status === 'EMITIDA' ? (
                <div className="flex gap-2 w-full">
                  <div className="flex-1 bg-green-950/20 border border-green-800/40 text-green-400 font-bold py-3 rounded text-xs flex items-center justify-center gap-1.5">
                    <CheckCircle2 size={14} /> NF-e Emitida com Sucesso
                  </div>
                  {pdvReciboDados.nfe_pdf_url && (
                    <a
                      href={pdvReciboDados.nfe_pdf_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-black hover:bg-[#111111] border border-[#222222] text-xs font-bold py-3 px-4 rounded transition-all flex items-center justify-center gap-1.5 text-white"
                    >
                      <Download size={14} /> Ver PDF da Nota
                    </a>
                  )}
                </div>
              ) : ['VENDEDOR', 'GERENTE'].includes(profile?.role) ? (
                <div className="w-full bg-[#111111] border border-red-950/30 text-red-400 text-center py-3 px-4 rounded text-[11px] font-semibold">
                  Apenas administradores ou RH possuem permissão para emitir documentos fiscais
                </div>
              ) : ['ADMIN', 'ADM', 'ADMINISTRADOR', 'RH', 'RH_ADMIN', 'SUPER_ADMIN', 'OWNER'].includes(profile?.role) ? (
                <button
                  type="button"
                  onClick={() => handleEmitirNfePdv(pdvReciboDados)}
                  disabled={isFiscalLoading}
                  className="w-full bg-[#6A0DAD] hover:bg-[#500885] disabled:bg-[#111111] disabled:text-gray-650 text-white font-bold py-3 rounded text-xs transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-[#6A0DAD]/20"
                >
                  {isFiscalLoading ? (
                    <>
                      <Loader2 size={14} className="animate-spin" /> Emitindo Nota Fiscal no SEFAZ...
                    </>
                  ) : (
                    <>
                      <FileText size={14} /> Emitir Nota Fiscal (NF-e)
                    </>
                  )}
                </button>
              ) : null}

              <div className="flex gap-2 w-full">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex-1 bg-black hover:bg-[#111111] border border-[#222222] text-xs font-bold py-3 rounded transition-all flex items-center justify-center gap-1.5"
                >
                  Imprimir Recibo
                </button>
                <button
                  type="button"
                  onClick={() => setPdvReciboAtivo(false)}
                  className="flex-1 bg-black hover:bg-[#111111] border border-[#222222] text-xs font-bold py-3 rounded transition-all"
                >
                  Fechar e Novo Pedido
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* MODAL ESTOQUE GLOBAL */}
      {estoqueGlobalModalOpen && estoqueGlobalProduto && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-[#0A0A0A] border border-[#222222] rounded-xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[90vh] animate-fadeIn">
            <div className="p-5 border-b border-[#222222] flex justify-between items-center bg-[#111111] rounded-t-xl">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Package size={20} className="text-[#6A0DAD]" />
                  Estoque Global: <span className="text-purple-400">{estoqueGlobalProduto.nome}</span>
                </h2>
                <p className="text-xs text-gray-400 mt-1">
                  Total em Rede: <span className="font-bold text-white">{estoqueGlobalImeis.filter(i => (!i.vendido && i.status !== 'VENDIDO')).length} aparelhos disponíveis no total</span>
                </p>
              </div>
              <button onClick={() => setEstoqueGlobalModalOpen(false)} className="text-gray-500 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="p-5 overflow-y-auto flex-1">
              {loadingEstoqueGlobal ? (
                <div className="flex flex-col items-center justify-center py-10 gap-3 text-gray-500">
                  <Loader2 size={24} className="animate-spin text-[#6A0DAD]" />
                  <p className="text-sm">Buscando rastreio na rede...</p>
                </div>
              ) : estoqueGlobalImeis.length === 0 ? (
                <div className="text-center py-10 text-gray-600">
                  <p>Nenhum aparelho deste modelo encontrado no estoque da rede.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[#222222] text-xs text-gray-500 uppercase tracking-wider">
                        <th className="pb-3 px-2 font-semibold">IMEI</th>
                        <th className="pb-3 px-2 font-semibold">Localização</th>
                        <th className="pb-3 px-2 font-semibold">Status</th>
                        <th className="pb-3 px-2 font-semibold">Data de Entrada</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#222222]">
                      {estoqueGlobalImeis.map((item, idx) => (
                        <tr key={item.id || idx} className="text-sm hover:bg-[#111111] transition-colors">
                          <td className="py-3 px-2 font-mono text-gray-300">{item.imei}</td>
                          <td className="py-3 px-2 text-white font-semibold">{item.filial_nome}</td>
                          <td className="py-3 px-2">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                              item.status === 'EM_TRANSITO' ? 'bg-blue-950/40 text-blue-400 border border-blue-800/40' :
                              (item.vendido || item.status === 'VENDIDO') ? 'bg-red-950/40 text-red-400 border border-red-800/40' : 
                              'bg-emerald-950/40 text-emerald-400 border border-emerald-800/40'
                            }`}>
                              {item.status === 'EM_TRANSITO' ? 'Em Trânsito' : (item.vendido || item.status === 'VENDIDO') ? 'Vendido' : 'Disponível'}
                            </span>
                          </td>
                          <td className="py-3 px-2 text-gray-500">
                            {new Date(item.created_at).toLocaleDateString('pt-BR')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* OFFLINE BANNER */}
      {isOffline && (
        <div className="fixed top-0 left-0 right-0 bg-red-600 text-white p-2 text-center text-xs font-bold flex items-center justify-center gap-2 z-[100] shadow-md animate-slideDown">
          <AlertCircle size={14} />
          Você está offline. O Zênite operará em Modo de Contingência.
        </div>
      )}

      {/* S.O.S BUTTON & MODAL (Para Logados) */}
      {session && profile?.role !== 'SUPER_ADMIN' && (
        <>
          <button
            onClick={() => setIsSosModalOpen(true)}
            className="fixed bottom-6 right-6 bg-red-600 hover:bg-red-700 text-white rounded-full p-4 shadow-2xl flex items-center justify-center z-50 transition-transform hover:scale-110"
            title="S.O.S Suporte"
          >
            <AlertCircle size={28} />
          </button>
          
          {isSosModalOpen && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
              <div className="bg-[#0A0A0A] border border-[#222222] rounded-xl shadow-2xl w-full max-w-md flex flex-col p-6 animate-fadeIn">
                <div className="flex justify-between items-start mb-4">
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <AlertCircle size={20} className="text-red-500" /> S.O.S Suporte
                  </h2>
                  <button onClick={() => setIsSosModalOpen(false)} className="text-gray-500 hover:text-white">
                    <X size={20} />
                  </button>
                </div>
                <p className="text-sm text-gray-400 mb-4">Descreva o problema que você está enfrentando. Nossa equipe de engenharia receberá o log imediatamente.</p>
                <textarea
                  value={sosMessage}
                  onChange={(e) => setSosMessage(e.target.value)}
                  placeholder="Ex: Não consigo finalizar a venda do celular X..."
                  className="w-full bg-black border border-[#333] text-white p-3 rounded h-28 resize-none mb-4"
                />
                <button
                  onClick={handleSosSubmit}
                  disabled={isSosSubmitting || !sosMessage.trim()}
                  className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold py-2 rounded transition-colors flex justify-center items-center gap-2"
                >
                  {isSosSubmitting ? <Loader2 size={16} className="animate-spin" /> : 'Enviar Chamado de Emergência'}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* MODAL DE CONFIRMAÇÃO DE FINALIZAÇÃO DE CHAMADO S.O.S */}
      {confirmingSosId && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center z-[70] p-4">
          <div className="bg-[#0A0A0A] border border-[#222222] rounded-xl shadow-2xl w-full max-w-sm flex flex-col p-6 animate-fadeIn">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-red-500/10 p-2.5 rounded-full text-red-500 shrink-0">
                <AlertCircle size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Finalizar Chamado</h3>
                <p className="text-xs text-gray-400 mt-0.5">Visão SUPER_ADMIN</p>
              </div>
            </div>
            
            <p className="text-sm text-gray-350 mb-6 leading-relaxed">
              Deseja marcar este chamado como <strong>Finalizado</strong>? Esta ação é irreversível e o chamado não será mais editável.
            </p>
            
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setConfirmingSosId(null)}
                disabled={loadingFinalizarSos}
                className="px-4 py-2 text-sm font-semibold rounded bg-gray-900 border border-gray-800 text-gray-400 hover:text-white hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleFinalizarChamado(confirmingSosId)}
                disabled={loadingFinalizarSos}
                className="px-4 py-2 text-sm font-semibold rounded bg-green-600 hover:bg-green-700 text-white transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                {loadingFinalizarSos ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Salvando...
                  </>
                ) : (
                  'Confirmar Finalização'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Visualizador de Disponibilidade Multiloja Modal */}
      {selectedMultilojaProd && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0A0A0A] border border-[#6A0DAD]/30 w-full max-w-md rounded-xl overflow-hidden shadow-2xl shadow-purple-950/20 animate-scaleUp">
            
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-[#0A001A] to-[#0A0A0A] p-5 border-b border-[#222222] flex justify-between items-center">
              <div className="flex items-center gap-2.5">
                <Store className="text-[#6A0DAD]" size={18} />
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">Disponibilidade Multiloja</h3>
                  <p className="text-[10px] text-gray-500 font-mono mt-0.5">{selectedMultilojaProd.nome}</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedMultilojaProd(null)}
                className="text-gray-500 hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 space-y-4">
              {loadingMultilojaStock ? (
                <div className="flex flex-col items-center justify-center py-10 gap-3">
                  <Loader2 className="animate-spin text-[#6A0DAD]" size={24} />
                  <span className="text-xs text-gray-500">Consultando estoque nas filiais...</span>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-[10px] font-bold text-gray-600 uppercase border-b border-[#222] pb-2 px-1">
                    <span>Filial</span>
                    <span>Qtd em Estoque</span>
                  </div>

                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {multilojaStockData.map((item, idx) => (
                      <div 
                        key={idx}
                        className={`flex items-center justify-between rounded-lg px-3 py-2.5 border bg-black/40 ${
                          item.filialNome === activeFilialNome 
                            ? 'border-[#6A0DAD]/50 bg-[#6A0DAD]/5' 
                            : 'border-[#222222]'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-white">
                            {item.filialNome}
                          </span>
                          <span className="text-[9px] bg-[#111] text-gray-500 px-1 rounded uppercase">
                            {item.filialTipo === 'ESTOQUE' ? 'Depósito' : 'Loja'}
                          </span>
                          {item.filialNome === activeFilialNome && (
                            <span className="text-[9px] text-[#6A0DAD] font-bold">(Atual)</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className={`text-xs font-bold font-mono ${
                            item.quantidade > 0 ? 'text-green-400' : 'text-red-550'
                          }`}>
                            {item.quantidade} un.
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="text-[10px] text-gray-400 bg-yellow-950/15 border border-yellow-800/20 p-2.5 rounded-lg flex items-start gap-1.5 mt-2">
                    <AlertCircle size={14} className="text-yellow-500 flex-shrink-0 mt-0.5" />
                    <span>Esta visualização é apenas para leitura. Para vender ou transferir mercadorias, utilize a aba de Transferências.</span>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="bg-[#050505] p-4 border-t border-[#222222] flex justify-end">
              <button
                onClick={() => setSelectedMultilojaProd(null)}
                className="bg-[#222] hover:bg-[#333] text-white px-4 py-2 rounded-md text-xs font-bold transition-all"
              >
                Fechar
              </button>
            </div>

          </div>
        </div>
      )}

      {isClienteModalOpen && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0A0A0A] border border-[#6A0DAD]/30 w-full max-w-2xl rounded-xl overflow-hidden shadow-2xl animate-scaleUp">
            <div className="bg-gradient-to-r from-[#0A001A] to-[#0A0A0A] p-5 border-b border-[#222222] flex justify-between items-center">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                {editingCliente ? 'Editar Cliente' : 'Novo Cliente'}
              </h3>
              <button 
                onClick={() => setIsClienteModalOpen(false)}
                className="text-gray-500 hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSaveCliente}>
              <div className="p-5 space-y-5 max-h-[70vh] overflow-y-auto custom-scrollbar">
                
                {/* DADOS PESSOAIS */}
                <div>
                  <h4 className="text-[10px] font-bold text-[#6A0DAD] uppercase tracking-wider mb-3">Dados Pessoais</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                        Nome Completo
                      </label>
                      <input
                        type="text"
                        value={clienteNome}
                        onChange={(e) => setClienteNome(e.target.value)}
                        placeholder="Nome do cliente..."
                        required
                        className="w-full bg-black border border-[#222222] focus:border-[#6A0DAD] rounded-md text-white px-4 py-2.5 text-sm outline-none transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5 font-mono">
                        CPF / CNPJ
                      </label>
                      <input
                        type="text"
                        value={clienteCpfCnpj}
                        onChange={(e) => setClienteCpfCnpj(e.target.value.replace(/\D/g, ''))}
                        placeholder="Apenas números..."
                        required
                        className="w-full bg-black border border-[#222222] focus:border-[#6A0DAD] rounded-md text-white px-4 py-2.5 text-sm outline-none font-mono transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5 font-mono">
                        Telefone
                      </label>
                      <input
                        type="text"
                        value={clienteTelefone}
                        onChange={(e) => setClienteTelefone(e.target.value)}
                        placeholder="Ex: (11) 99999-9999"
                        required
                        className="w-full bg-black border border-[#222222] focus:border-[#6A0DAD] rounded-md text-white px-4 py-2.5 text-sm outline-none font-mono transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                        E-mail
                      </label>
                      <input
                        type="email"
                        value={clienteEmail}
                        onChange={(e) => setClienteEmail(e.target.value)}
                        placeholder="cliente@email.com"
                        required
                        className="w-full bg-black border border-[#222222] focus:border-[#6A0DAD] rounded-md text-white px-4 py-2.5 text-sm outline-none transition-all"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-1.5">
                        <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider font-mono">
                          Data de Nascimento
                        </label>
                        {isMenorDeIdade && (
                          <span className="text-[9px] font-bold bg-red-950/60 text-red-400 border border-red-800/40 px-2 py-0.5 rounded">
                            Menor de Idade
                          </span>
                        )}
                        {isDataFutura && (
                          <span className="text-[9px] font-bold bg-red-950/60 text-red-500 border border-red-800 px-2 py-0.5 rounded animate-pulse">
                            Data Futura Inválida
                          </span>
                        )}
                      </div>
                      <input
                        type="text"
                        value={clienteDataNascimento}
                        onChange={(e) => handleDataNascimentoChange(e.target.value)}
                        placeholder="DD/MM/AAAA"
                        maxLength="10"
                        required
                        className={`w-full bg-black border rounded-md text-white px-4 py-2.5 text-sm outline-none font-mono transition-all ${
                          isDataFutura ? 'border-red-650 focus:border-red-500' : 'border-[#222222] focus:border-[#6A0DAD]'
                        }`}
                      />
                    </div>
                  </div>
                </div>

                {/* ENDEREÇO */}
                <div className="border-t border-[#222222]/60 pt-4">
                  <h4 className="text-[10px] font-bold text-[#6A0DAD] uppercase tracking-wider mb-3">Endereço</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                        <span>CEP</span>
                        {cepLookupLoading && <Loader2 size={10} className="animate-spin text-[#6A0DAD]" />}
                        {cepLookupFailed && <span className="text-[9px] text-red-500 font-bold lowercase italic">Não encontrado</span>}
                      </label>
                      <input
                        type="text"
                        value={clienteCep}
                        onChange={(e) => handleCepChange(e.target.value)}
                        placeholder="00000-000"
                        maxLength="9"
                        required
                        className={`w-full bg-black border rounded-md text-white px-4 py-2.5 text-sm outline-none font-mono transition-all ${
                          cepLookupFailed ? 'border-red-800 focus:border-red-500' : 'border-[#222222] focus:border-[#6A0DAD]'
                        }`}
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                        Número
                      </label>
                      <input
                        type="text"
                        ref={clienteNumeroInputRef}
                        value={clienteNumero}
                        onChange={(e) => setClienteNumero(e.target.value)}
                        placeholder="Ex: 123"
                        required
                        className="w-full bg-black border border-[#222222] focus:border-[#6A0DAD] rounded-md text-white px-4 py-2.5 text-sm outline-none transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5 font-mono">
                        UF (Estado)
                      </label>
                      <input
                        type="text"
                        value={clienteUf}
                        onChange={(e) => setClienteUf(e.target.value.toUpperCase())}
                        placeholder="Ex: SP"
                        maxLength="2"
                        required
                        readOnly={!!clienteUf && !cepLookupFailed && clienteCep.replace(/\D/g, '').length === 8}
                        className="w-full bg-black border border-[#222222] focus:border-[#6A0DAD] rounded-md text-white px-4 py-2.5 text-sm outline-none font-mono transition-all read-only:text-gray-500 read-only:bg-neutral-950/20"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                        Logradouro (Rua)
                      </label>
                      <input
                        type="text"
                        value={clienteLogradouro}
                        onChange={(e) => setClienteLogradouro(e.target.value)}
                        placeholder="Rua, Avenida, Travessa..."
                        required
                        readOnly={!!clienteLogradouro && !cepLookupFailed && clienteCep.replace(/\D/g, '').length === 8}
                        className="w-full bg-black border border-[#222222] focus:border-[#6A0DAD] rounded-md text-white px-4 py-2.5 text-sm outline-none transition-all read-only:text-gray-500 read-only:bg-neutral-950/20"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                        Bairro
                      </label>
                      <input
                        type="text"
                        value={clienteBairro}
                        onChange={(e) => setClienteBairro(e.target.value)}
                        placeholder="Bairro..."
                        required
                        readOnly={!!clienteBairro && !cepLookupFailed && clienteCep.replace(/\D/g, '').length === 8}
                        className="w-full bg-black border border-[#222222] focus:border-[#6A0DAD] rounded-md text-white px-4 py-2.5 text-sm outline-none transition-all read-only:text-gray-500 read-only:bg-neutral-950/20"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                        Cidade
                      </label>
                      <input
                        type="text"
                        value={clienteCidade}
                        onChange={(e) => setClienteCidade(e.target.value)}
                        placeholder="Cidade..."
                        required
                        readOnly={!!clienteCidade && !cepLookupFailed && clienteCep.replace(/\D/g, '').length === 8}
                        className="w-full bg-black border border-[#222222] focus:border-[#6A0DAD] rounded-md text-white px-4 py-2.5 text-sm outline-none transition-all read-only:text-gray-500 read-only:bg-neutral-950/20"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                        Complemento
                      </label>
                      <input
                        type="text"
                        value={clienteComplemento}
                        onChange={(e) => setClienteComplemento(e.target.value)}
                        placeholder="Ex: Apto 4"
                        className="w-full bg-black border border-[#222222] focus:border-[#6A0DAD] rounded-md text-white px-4 py-2.5 text-sm outline-none transition-all"
                      />
                    </div>
                  </div>
                </div>

              </div>
              <div className="bg-[#050505] p-4 border-t border-[#222222] flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsClienteModalOpen(false)}
                  className="bg-[#222] hover:bg-[#333] text-white px-4 py-2 rounded-md text-xs font-bold transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isDataFutura}
                  className="bg-[#6A0DAD] hover:bg-[#500885] disabled:bg-neutral-800 disabled:text-gray-600 disabled:cursor-not-allowed text-white px-4 py-2 rounded-md text-xs font-bold transition-all"
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE EDIÇÃO DE VENDA CONSOLIDADA COM AUDITORIA */}
      {isVendaEditModalOpen && editingVenda && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0A0A0A] border border-[#6A0DAD]/30 w-full max-w-md rounded-xl overflow-hidden shadow-2xl animate-scaleUp">
            <div className="bg-gradient-to-r from-[#0A001A] to-[#0A0A0A] p-5 border-b border-[#222222] flex justify-between items-center">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Edit2 size={16} className="text-[#6A0DAD]" />
                Corrigir Venda Concluída
              </h3>
              <button 
                onClick={() => { setIsVendaEditModalOpen(false); setEditingVenda(null); }}
                className="text-gray-500 hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSaveVendaEdit}>
              <div className="p-5 space-y-4">
                <div className="bg-purple-950/10 border border-purple-900/20 p-3 rounded-lg text-xs">
                  <p className="text-gray-400 font-semibold mb-1">Produto original:</p>
                  <p className="text-white font-bold">{editingVenda.produtos?.nome || 'Produto Removido'}</p>
                  <p className="text-gray-550 font-mono mt-1">ID da Venda: {editingVenda.id}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                      Quantidade
                    </label>
                    <input
                      type="number"
                      value={vendaNewQty}
                      onChange={(e) => setVendaNewQty(e.target.value)}
                      required
                      min="1"
                      className="w-full bg-black border border-[#222222] focus:border-[#6A0DAD] rounded-md text-white px-4 py-2.5 text-sm outline-none font-mono transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                      Valor Total (R$)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={vendaNewValor}
                      onChange={(e) => setVendaNewValor(e.target.value)}
                      required
                      min="0"
                      className="w-full bg-black border border-[#222222] focus:border-[#6A0DAD] rounded-md text-white px-4 py-2.5 text-sm outline-none font-mono transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                    Comissão do Vendedor (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={vendaNewComissao}
                    onChange={(e) => setVendaNewComissao(e.target.value)}
                    required
                    min="0"
                    className="w-full bg-black border border-[#222222] focus:border-[#6A0DAD] rounded-md text-white px-4 py-2.5 text-sm outline-none font-mono transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                    Justificativa da Alteração <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={vendaJustificativa}
                    onChange={(e) => setVendaJustificativa(e.target.value)}
                    placeholder="Descreva detalhadamente o motivo desta correção para auditoria..."
                    required
                    className="w-full bg-black border border-[#222222] focus:border-[#6A0DAD] rounded-md text-white p-3 text-xs outline-none h-20 resize-none transition-all"
                  />
                </div>
              </div>
              
              <div className="bg-[#050505] p-4 border-t border-[#222222] flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => { setIsVendaEditModalOpen(false); setEditingVenda(null); }}
                  className="bg-[#222] hover:bg-[#333] text-white px-4 py-2 rounded-md text-xs font-bold transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!vendaJustificativa.trim()}
                  className="bg-[#6A0DAD] hover:bg-[#500885] disabled:bg-[#111111] disabled:text-gray-600 disabled:cursor-not-allowed text-white px-4 py-2 rounded-md text-xs font-bold transition-all"
                >
                  Salvar Correção
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE CADASTRO DE PRIMEIRA FILIAL */}
      {isCreateFilialModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0A0A0A] border border-[#6A0DAD]/40 rounded-xl p-6 max-w-md w-full space-y-6 shadow-2xl animate-fadeIn">
            <div className="flex items-center justify-between border-b border-[#222] pb-4">
              <div className="flex items-center gap-2">
                <Store size={20} className="text-[#6A0DAD]" />
                <h3 className="text-lg font-bold text-white">Cadastrar Filial / Loja</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateFilialModalOpen(false)}
                className="text-gray-500 hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateFirstFilial} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                  Nome da Filial / Ponto de Venda <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newFilialNome}
                  onChange={(e) => setNewFilialNome(e.target.value)}
                  placeholder="Ex: Loja Centro, Filial Norte, Matriz..."
                  className="w-full bg-black border border-[#222] focus:border-[#6A0DAD] rounded-md text-white px-3.5 py-2 text-sm outline-none transition-all"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                  Tipo de Unidade
                </label>
                <select
                  value={newFilialTipo}
                  onChange={(e) => setNewFilialTipo(e.target.value)}
                  className="w-full bg-black border border-[#222] focus:border-[#6A0DAD] rounded-md text-white px-3.5 py-2 text-sm outline-none transition-all"
                >
                  <option value="LOJA">Ponto de Venda / Loja (Vendas e PDV)</option>
                  <option value="ESTOQUE">Depósito / Estoque Central</option>
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                    CNPJ (Opcional)
                  </label>
                  <input
                    type="text"
                    value={newFilialCnpj}
                    onChange={(e) => setNewFilialCnpj(e.target.value)}
                    placeholder="00.000.000/0001-00"
                    className="w-full bg-black border border-[#222] focus:border-[#6A0DAD] rounded-md text-white px-3.5 py-2 text-sm outline-none font-mono transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                    Cidade / Endereço (Opcional)
                  </label>
                  <input
                    type="text"
                    value={newFilialCidade}
                    onChange={(e) => setNewFilialCidade(e.target.value)}
                    placeholder="Ex: São Paulo - SP"
                    className="w-full bg-black border border-[#222] focus:border-[#6A0DAD] rounded-md text-white px-3.5 py-2 text-sm outline-none transition-all"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#222]">
                <button
                  type="button"
                  onClick={() => setIsCreateFilialModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-gray-400 hover:text-white transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingNewFilial || !newFilialNome.trim()}
                  className="bg-[#6A0DAD] hover:bg-[#500885] disabled:bg-gray-800 text-white font-bold px-5 py-2 rounded-lg text-xs flex items-center gap-2 transition-all shadow-md shadow-[#6A0DAD]/20 cursor-pointer"
                >
                  {isSavingNewFilial ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Cadastrando...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={14} />
                      Cadastrar e Liberar Contexto
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE CADASTRO DE NOVO COLABORADOR / FUNCIONÁRIO */}
      {isAddCollaboratorModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0A0A0A] border border-[#6A0DAD]/40 rounded-xl p-6 max-w-lg w-full space-y-6 shadow-2xl animate-scaleUp">
            <div className="flex items-center justify-between border-b border-[#222] pb-4">
              <div className="flex items-center gap-2.5">
                <UserPlus size={20} className="text-[#6A0DAD]" />
                <div>
                  <h3 className="text-base font-extrabold text-white">Cadastrar Novo Colaborador</h3>
                  <p className="text-xs text-gray-500">Crie o acesso do usuário e vincule o cargo na sua empresa.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddCollaboratorModalOpen(false)}
                className="text-gray-500 hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddColaborador} className="space-y-4 font-sans">
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                  Nome Completo <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newColabNome}
                  onChange={(e) => setNewColabNome(e.target.value)}
                  placeholder="Ex: João da Silva"
                  className="w-full bg-black border border-[#222] focus:border-[#6A0DAD] rounded-md text-white px-3.5 py-2.5 text-sm outline-none transition-all"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                  E-mail de Acesso <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={newColabEmail}
                  onChange={(e) => setNewColabEmail(e.target.value)}
                  placeholder="exemplo@suaempresa.com"
                  className="w-full bg-black border border-[#222] focus:border-[#6A0DAD] rounded-md text-white px-3.5 py-2.5 text-sm outline-none transition-all font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                  Senha Inicial Provisória <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newColabSenha}
                  onChange={(e) => setNewColabSenha(e.target.value)}
                  placeholder="Senha provisória (min. 6 caracteres)"
                  className="w-full bg-black border border-[#222] focus:border-[#6A0DAD] rounded-md text-white px-3.5 py-2.5 text-sm outline-none transition-all font-mono"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                    Cargo / Função <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={newColabRole}
                    onChange={(e) => setNewColabRole(e.target.value)}
                    className="w-full bg-black border border-[#222] focus:border-[#6A0DAD] rounded-md text-white px-3 py-2.5 text-xs outline-none transition-all cursor-pointer font-semibold"
                    required
                  >
                    <option value="TRAINEE">TRAINEE (Vendedor Trainee)</option>
                    <option value="VENDEDOR">VENDEDOR (Operacional PDV)</option>
                    <option value="ESTOQUISTA">ESTOQUISTA (Estoque)</option>
                    {profile?.role !== 'GERENTE' && (
                      <>
                        <option value="GERENTE">GERENTE (Gerente de Loja)</option>
                        <option value="ADMIN">ADMINISTRADOR (Acesso Total)</option>
                        {['SUPER_ADMIN', 'ADMIN', 'OWNER', 'DONO'].includes(profile?.role) && (
                          <option value="DONO">DONO (Proprietário / CEO)</option>
                        )}
                      </>
                    )}
                  </select>
                  {profile?.role === 'GERENTE' && (
                    <span className="text-[10px] text-purple-400 mt-1.5 block font-medium leading-tight">
                      🔒 Trava: O perfil Gerente pode cadastrar apenas Vendedores e Estoquistas.
                    </span>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                    Filial de Atuação
                  </label>
                  {profile?.role === 'GERENTE' ? (
                    <div className="bg-[#111111] border border-[#222] p-2.5 rounded-md text-xs font-bold text-gray-300 flex items-center justify-between shadow-inner">
                      <span className="truncate">
                        {filiais.find(f => f.id === (profile?.filial_id || activeFilialId))?.nome || 'Filial Atual'}
                      </span>
                      <Lock size={12} className="text-purple-400 shrink-0 ml-1" />
                    </div>
                  ) : (
                    <select
                      value={newColabFilialId}
                      onChange={(e) => setNewColabFilialId(e.target.value)}
                      className="w-full bg-black border border-[#222] focus:border-[#6A0DAD] rounded-md text-white px-3 py-2.5 text-xs outline-none transition-all cursor-pointer font-semibold"
                    >
                      <option value="">[ Todas as Filiais / Global ]</option>
                      {filiais.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.nome}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#222]">
                <button
                  type="button"
                  onClick={() => setIsAddCollaboratorModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-gray-400 hover:text-white transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingColaborador || !newColabNome.trim() || !newColabEmail.trim() || !newColabSenha.trim()}
                  className="bg-[#6A0DAD] hover:bg-[#500885] disabled:bg-gray-800 text-white font-bold px-5 py-2.5 rounded-lg text-xs flex items-center gap-2 transition-all shadow-md shadow-[#6A0DAD]/20 cursor-pointer"
                >
                  {isSavingColaborador ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Cadastrando...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={14} />
                      Salvar Colaborador
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE EDIÇÃO DE INFORMAÇÕES DO COLABORADOR */}
      {editingColaborador && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0A0A0A] border border-[#6A0DAD]/40 w-full max-w-lg rounded-xl overflow-hidden shadow-2xl shadow-purple-950/20 animate-scaleUp font-sans">
            
            {/* Header */}
            <div className="bg-gradient-to-r from-[#0A001A] to-[#0A0A0A] p-5 border-b border-[#222222] flex justify-between items-center">
              <div className="flex items-center gap-2.5">
                <Edit2 className="text-[#6A0DAD]" size={18} />
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">Editar Informações do Colaborador</h3>
                  <p className="text-[10px] text-gray-400 mt-0.5">{editingColaborador.nome}</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setEditingColaborador(null)}
                className="text-gray-500 hover:text-white transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Form Content */}
            <form onSubmit={handleSaveEditColaborador}>
              <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                
                <div>
                  <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                    Nome Completo <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={editColabNome}
                    onChange={(e) => setEditColabNome(e.target.value)}
                    required
                    className="w-full bg-black border border-[#222222] focus:border-[#6A0DAD] rounded-md text-white px-4 py-2.5 text-sm outline-none transition-all"
                    placeholder="Ex: João Silva"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                      E-mail / Login de Acesso <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      value={editColabEmail}
                      onChange={(e) => setEditColabEmail(e.target.value)}
                      required
                      className="w-full bg-black border border-[#222222] focus:border-[#6A0DAD] rounded-md text-white px-4 py-2.5 text-sm outline-none transition-all font-mono"
                      placeholder="colaborador@email.com"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                      Telefone / WhatsApp
                    </label>
                    <input
                      type="text"
                      value={editColabTelefone}
                      onChange={(e) => setEditColabTelefone(e.target.value)}
                      className="w-full bg-black border border-[#222222] focus:border-[#6A0DAD] rounded-md text-white px-4 py-2.5 text-sm outline-none transition-all font-mono"
                      placeholder="(11) 99999-9999"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                      CPF
                    </label>
                    <input
                      type="text"
                      value={editColabCpf}
                      onChange={(e) => setEditColabCpf(e.target.value)}
                      className="w-full bg-black border border-[#222222] focus:border-[#6A0DAD] rounded-md text-white px-4 py-2.5 text-sm outline-none transition-all font-mono"
                      placeholder="000.000.000-00"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                      Redefinir Senha (Opcional)
                    </label>
                    <input
                      type="password"
                      value={editColabSenha}
                      onChange={(e) => setEditColabSenha(e.target.value)}
                      className="w-full bg-black border border-[#222222] focus:border-[#6A0DAD] rounded-md text-white px-4 py-2.5 text-sm outline-none transition-all font-mono"
                      placeholder="Nova senha (min. 6 dígitos)"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                      Cargo / Função
                    </label>
                    <select
                      value={editColabRole}
                      onChange={(e) => setEditColabRole(e.target.value)}
                      className="w-full bg-black border border-[#222222] focus:border-[#6A0DAD] rounded-md text-white px-4 py-2.5 text-sm outline-none cursor-pointer transition-all font-semibold"
                    >
                      <option value="TRAINEE">TRAINEE (Vendedor Trainee)</option>
                      <option value="VENDEDOR">VENDEDOR (Operacional PDV)</option>
                      <option value="ESTOQUISTA">ESTOQUISTA (Estoque)</option>
                      {profile?.role !== 'GERENTE' && (
                        <>
                          <option value="GERENTE">GERENTE (Gerente de Loja)</option>
                          <option value="ADMIN">ADMINISTRADOR (Acesso Total)</option>
                          {['SUPER_ADMIN', 'ADMIN', 'OWNER', 'DONO'].includes(profile?.role) && (
                            <option value="DONO">DONO (Proprietário / CEO)</option>
                          )}
                        </>
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                      Filial Alocada
                    </label>
                    <select
                      value={editColabFilialId}
                      onChange={(e) => setEditColabFilialId(e.target.value)}
                      className="w-full bg-black border border-[#222222] focus:border-[#6A0DAD] rounded-md text-white px-4 py-2.5 text-sm outline-none cursor-pointer transition-all font-semibold"
                    >
                      <option value="">[ Todas as Filiais / Global ]</option>
                      {filiais.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.nome}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

              </div>

              {/* Footer */}
              <div className="bg-[#050505] p-4 border-t border-[#222222] flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditingColaborador(null)}
                  className="bg-[#222] hover:bg-[#333] text-white px-4 py-2 rounded-md text-xs font-bold transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingEditColaborador}
                  className="bg-[#6A0DAD] hover:bg-[#500885] disabled:bg-[#111111] disabled:text-gray-600 disabled:cursor-not-allowed text-white px-5 py-2 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-lg shadow-[#6A0DAD]/20"
                >
                  {isSavingEditColaborador ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  {isSavingEditColaborador ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMAÇÃO DE REMOÇÃO / INATIVAÇÃO DE COLABORADOR */}
      {colaboradorToDelete && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0A0A0A] border border-red-900/40 w-full max-w-md rounded-xl overflow-hidden shadow-2xl shadow-red-950/20 animate-scaleUp font-sans">
            
            {/* Header */}
            <div className="bg-gradient-to-r from-[#1A0000] to-[#0A0A0A] p-5 border-b border-[#222222] flex justify-between items-center">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-red-950/40 border border-red-800/40 rounded-lg text-red-400">
                  <Trash2 size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">Confirmar Remoção / Inativação</h3>
                  <p className="text-[11px] text-gray-400 mt-0.5">Gestão de Equipe &amp; Colaboradores</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => !isDeletingColaborador && setColaboradorToDelete(null)}
                className="text-gray-500 hover:text-white transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-200">
                Deseja realmente remover/inativar o colaborador <span className="font-bold text-purple-300">{colaboradorToDelete.nome}</span>?
              </p>
              
              <div className="text-xs text-gray-400 bg-red-950/20 border border-red-900/30 p-3 rounded-lg leading-relaxed">
                <strong className="text-red-400 font-semibold">Aviso de Segurança:</strong> Caso este colaborador possua históricos de vendas ou movimentações associadas, seu status será alterado para <span className="text-amber-300 font-bold">INATIVO</span> para preservar a integridade dos relatórios e auditorias.
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-[#050505] border-t border-[#222222] flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setColaboradorToDelete(null)}
                disabled={isDeletingColaborador}
                className="px-4 py-2 text-xs font-semibold text-gray-300 hover:text-white bg-[#111111] hover:bg-[#1A1A1A] border border-[#333333] rounded-lg transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDeleteColaborador}
                disabled={isDeletingColaborador}
                className="px-4 py-2 text-xs font-bold text-white bg-gradient-to-r from-red-700 to-red-900 hover:from-red-600 hover:to-red-800 border border-red-600/50 rounded-lg shadow-lg shadow-red-950/40 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                {isDeletingColaborador ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Removendo...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={14} />
                    <span>Sim, Remover / Inativar</span>
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL DE AJUSTE MANUAL DE ESTOQUE */}
      {isAjustarEstoqueModalOpen && ajusteProduto && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-[#0A0A0A] border border-[#6A0DAD]/30 rounded-xl p-6 w-full max-w-md space-y-6">
            <div className="flex justify-between items-start border-b border-[#222222] pb-3">
              <div>
                <h4 className="text-base font-extrabold text-white flex items-center gap-2 font-sans">
                  <Database size={18} className="text-[#6A0DAD]" />
                  Ajustar Estoque Manualmente
                </h4>
                <p className="text-xs text-gray-500 mt-1">{ajusteProduto.nome}</p>
              </div>
              <button 
                onClick={() => {
                  setIsAjustarEstoqueModalOpen(false);
                  setAjusteProduto(null);
                }} 
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEstoqueAjuste} className="space-y-4 font-sans text-xs">
              <div>
                <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5 font-sans">
                  Filial Alvo <span className="text-red-500">*</span>
                </label>
                <select
                  value={ajusteFilialId}
                  onChange={(e) => setAjusteFilialId(e.target.value)}
                  className="w-full bg-black border border-[#222222] focus:border-[#6A0DAD] rounded-md text-white px-3 py-2 text-xs outline-none cursor-pointer"
                  required
                >
                  <option value="">Selecione a filial...</option>
                  {filiais.map(f => (
                    <option key={f.id} value={f.id}>{f.nome} {f.tipo === 'ESTOQUE' ? '📦' : '🏪'}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5 font-sans">
                    Tipo de Ajuste <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={ajusteTipo}
                    onChange={(e) => setAjusteTipo(e.target.value)}
                    className="w-full bg-black border border-[#222222] focus:border-[#6A0DAD] rounded-md text-white px-3 py-2 text-xs outline-none cursor-pointer"
                    required
                  >
                    <option value="ENTRADA">Entrada (Acrescentar)</option>
                    <option value="SAIDA">Saída (Remover / Quebra)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5 font-sans">
                    Quantidade <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={ajusteQuantidade}
                    onChange={(e) => setAjusteQuantidade(e.target.value)}
                    className="w-full bg-black border border-[#222222] focus:border-[#6A0DAD] rounded-md text-white px-3 py-2 text-xs outline-none font-mono"
                    required
                  />
                </div>
              </div>

              {ajusteProduto.tipo === 'CELULAR' && tenantSettings.enable_imei && (
                <div>
                  <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5 font-mono">
                    IMEI correspondente (15 dígitos) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={ajusteImei}
                    onChange={(e) => setAjusteImei(e.target.value.replace(/\D/g, '').slice(0, 15))}
                    className="w-full bg-black border border-[#222222] focus:border-[#6A0DAD] rounded-md text-white px-3 py-2 text-xs outline-none font-mono"
                    placeholder="Digite ou bipe o IMEI..."
                    required
                    maxLength={15}
                  />
                </div>
              )}

              <div>
                <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5 font-sans">
                  Motivo / Justificativa do Ajuste <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={estoqueAjusteMotivo}
                  onChange={(e) => setEstoqueAjusteMotivo(e.target.value)}
                  className="w-full h-20 bg-black border border-[#222222] focus:border-[#6A0DAD] rounded-md text-white p-3 text-xs outline-none"
                  placeholder="Ex: Correção de inventário físico, aparelho com defeito devolvido, etc."
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#222222]">
                <button
                  type="button"
                  onClick={() => {
                    setIsAjustarEstoqueModalOpen(false);
                    setAjusteProduto(null);
                  }}
                  className="bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-2 px-4 rounded-md transition-colors text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingAjuste}
                  className="bg-[#6A0DAD] hover:bg-[#500885] disabled:bg-gray-800 disabled:text-gray-500 text-white font-bold py-2 px-5 rounded-md transition-all flex items-center gap-1.5 text-xs cursor-pointer"
                >
                  {isSavingAjuste ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                  Confirmar Ajuste
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast Notification Container */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 animate-fadeIn print:hidden">
          <div className={`flex items-center gap-3 px-4 py-3 rounded-lg border text-sm shadow-xl backdrop-blur-md transition-all duration-300 max-w-sm ${
            toast.type === 'success'
              ? 'bg-black/95 border-green-800 text-green-400 shadow-green-950/20'
              : toast.type === 'error'
              ? 'bg-black/95 border-red-800 text-red-400 shadow-red-950/20'
              : 'bg-black/95 border-[#6A0DAD] text-purple-350 shadow-purple-950/20'
          }`}>
            {toast.type === 'success' ? (
              <CheckCircle2 size={18} className="shrink-0 text-green-500" />
            ) : toast.type === 'error' ? (
              <AlertCircle size={18} className="shrink-0 text-red-500" />
            ) : (
              <Tag size={18} className="shrink-0 text-purple-500" />
            )}
            <div className="flex-1 font-semibold leading-snug">{toast.message}</div>
            <button
              type="button"
              onClick={() => setToast(null)}
              className="text-gray-500 hover:text-white transition-colors shrink-0 ml-1"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
