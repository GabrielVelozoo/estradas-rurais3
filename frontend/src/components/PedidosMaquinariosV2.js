import React, { useState, useEffect, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import PrintHeader from './PrintHeader';
import MunicipioSelect from './MunicipioSelect';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

// Status disponíveis
const STATUS_OPTIONS = [
  { value: 'em_andamento', label: 'Em andamento' },
  { value: 'aguardando_atendimento', label: 'Aguardando atendimento' },
  { value: 'arquivado', label: 'Arquivado' },
  { value: 'atendido', label: 'Atendido' },
];

export default function PedidosMaquinariosV2() {
  // Estados principais
  const [pedidos, setPedidos] = useState([]);
  const [catalogoEquipamentos, setCatalogoEquipamentos] = useState([]);
  const [catalogoMap, setCatalogoMap] = useState({});
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);
  
  // Estados de filtros
  const [buscaGeral, setBuscaGeral] = useState('');
  const [filtroMunicipio, setFiltroMunicipio] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');
  
  // Estados do modal
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  
  // Estados do formulário
  const [formData, setFormData] = useState({
    municipio_id: '',
    municipio_nome: '',
    lideranca_nome: '',
    itens: [],
    valor_total: 0,
    status: ''
  });

  // Normalizar texto (remover acentos)
  const normalizeText = (text) => {
    if (!text) return '';
    return text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  };

  // Carregar catálogo de equipamentos
  const fetchCatalogo = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/pedidos-maquinarios/catalogo`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.equipamentos && Array.isArray(data.equipamentos)) {
          setCatalogoEquipamentos(data.equipamentos);
          
          // Criar mapa nome -> preço para lookup rápido
          const map = {};
          data.equipamentos.forEach(eq => {
            map[eq.nome] = eq.preco;
          });
          setCatalogoMap(map);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar catálogo:', error);
    }
  };

  // AbortController para cancelar requisições
  const abortControllerRef = React.useRef(null);

  // Carregar pedidos com retry automático e AbortController
  const fetchPedidos = async (retryCount = 0) => {
    const maxRetries = 3;
    const retryDelay = Math.min(1000 * Math.pow(2, retryCount), 5000); // Backoff exponencial
    
    // Cancelar requisição anterior se existir
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Criar novo AbortController
    abortControllerRef.current = new AbortController();
    
    setCarregando(true);
    setErro(null);
    
    try {
      const response = await fetch(`${BACKEND_URL}/api/pedidos-maquinarios`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        signal: abortControllerRef.current.signal
      });

      if (response.status === 401) {
        setErro('Sessão expirada. Por favor, faça login novamente.');
        setTimeout(() => window.location.href = '/', 2000);
        return;
      }

      // Retry automático para erros 50x
      if (response.status >= 500 && response.status < 600 && retryCount < maxRetries) {
        console.warn(`Erro ${response.status}, tentando novamente (${retryCount + 1}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        return fetchPedidos(retryCount + 1);
      }

      if (!response.ok) {
        throw new Error(`Erro ao carregar pedidos (status ${response.status})`);
      }

      const data = await response.json();
      
      if (!Array.isArray(data)) {
        throw new Error('Formato de dados inválido');
      }

      setPedidos(data);
      setCarregando(false);
    } catch (error) {
      // Ignorar erros de abort (troca de aba)
      if (error.name === 'AbortError') {
        console.log('Requisição cancelada (troca de aba)');
        return;
      }
      
      // Retry automático para erros de rede
      if (retryCount < maxRetries && (error.message.includes('Failed to fetch') || error.message.includes('NetworkError'))) {
        console.warn(`Erro de rede, tentando novamente (${retryCount + 1}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        return fetchPedidos(retryCount + 1);
      }
      
      console.error('Erro ao carregar pedidos:', error);
      setErro(error.message);
      setCarregando(false);
    }
  };

  useEffect(() => {
    fetchCatalogo();
    fetchPedidos();
    
    // Cleanup: cancelar requisições ao desmontar
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Calcular cards do dashboard
  const dashboardStats = useMemo(() => {
    if (!Array.isArray(pedidos) || pedidos.length === 0) {
      return {
        municipiosDistintos: 0,
        totalPedidos: 0,
        totalEquipamentos: 0,
        valorTotal: 0
      };
    }

    const municipiosSet = new Set();
    let totalEquipamentos = 0;
    let valorTotal = 0;

    pedidos.forEach(pedido => {
      if (pedido.municipio_nome) {
        municipiosSet.add(pedido.municipio_nome);
      }
      
      if (Array.isArray(pedido.itens)) {
        pedido.itens.forEach(item => {
          totalEquipamentos += item.quantidade || 0;
        });
      }
      
      valorTotal += pedido.valor_total || 0;
    });

    return {
      municipiosDistintos: municipiosSet.size,
      totalPedidos: pedidos.length,
      totalEquipamentos,
      valorTotal
    };
  }, [pedidos]);

  // Filtrar pedidos
  const pedidosFiltrados = useMemo(() => {
    try {
      if (!Array.isArray(pedidos)) return [];

      return pedidos.filter(pedido => {
        if (!pedido || typeof pedido !== 'object') return false;

        // Busca geral
        if (buscaGeral) {
          const buscaNorm = normalizeText(buscaGeral);
          const matchMunicipio = normalizeText(pedido.municipio_nome || '').includes(buscaNorm);
          const matchLideranca = normalizeText(pedido.lideranca_nome || '').includes(buscaNorm);
          
          // Buscar em equipamentos
          let matchEquipamento = false;
          if (Array.isArray(pedido.itens)) {
            matchEquipamento = pedido.itens.some(item => 
              normalizeText(item.equipamento || '').includes(buscaNorm)
            );
          }
          
          if (!matchMunicipio && !matchLideranca && !matchEquipamento) return false;
        }

        // Filtro por município
        if (filtroMunicipio) {
          const match = normalizeText(pedido.municipio_nome || '').includes(normalizeText(filtroMunicipio));
          if (!match) return false;
        }

        // Filtro por status
        if (filtroStatus) {
          if (pedido.status !== filtroStatus) return false;
        }

        return true;
      });
    } catch (error) {
      console.error('Erro ao filtrar pedidos:', error);
      return [];
    }
  }, [pedidos, buscaGeral, filtroMunicipio, filtroStatus]);

  // Abrir modal
  const openModal = (pedido = null) => {
    if (pedido) {
      setEditingId(pedido.id);
      setFormData({
        municipio_id: pedido.municipio_id || '',
        municipio_nome: pedido.municipio_nome || '',
        lideranca_nome: pedido.lideranca_nome || '',
        itens: pedido.itens || [],
        valor_total: pedido.valor_total || 0,
        status: pedido.status || ''
      });
    } else {
      setEditingId(null);
      setFormData({
        municipio_id: '',
        municipio_nome: '',
        lideranca_nome: '',
        itens: [],
        valor_total: 0,
        status: ''
      });
    }
    setShowModal(true);
  };

  // Fechar modal
  const closeModal = () => {
    setShowModal(false);
    setEditingId(null);
  };

  // Adicionar item
  const handleAddItem = () => {
    const novoItem = {
      equipamento: '',
      preco_unitario: 0,
      quantidade: 1,
      observacao: '',
      subtotal: 0
    };
    
    setFormData({
      ...formData,
      itens: [...formData.itens, novoItem]
    });
  };

  // Remover item
  const handleRemoveItem = (index) => {
    const novosItens = formData.itens.filter((_, i) => i !== index);
    const novoTotal = novosItens.reduce((sum, item) => sum + (item.subtotal || 0), 0);
    
    setFormData({
      ...formData,
      itens: novosItens,
      valor_total: novoTotal
    });
  };

  // Atualizar item
  const handleUpdateItem = (index, field, value) => {
    const novosItens = [...formData.itens];
    novosItens[index] = { ...novosItens[index], [field]: value };

    // Se mudou o equipamento, atualizar preço unitário
    if (field === 'equipamento' && value) {
      const preco = catalogoMap[value] || 0;
      novosItens[index].preco_unitario = preco;
      novosItens[index].subtotal = preco * (novosItens[index].quantidade || 1);
    }

    // Se mudou a quantidade, recalcular subtotal
    if (field === 'quantidade') {
      const qtd = parseInt(value) || 1;
      novosItens[index].quantidade = qtd;
      novosItens[index].subtotal = (novosItens[index].preco_unitario || 0) * qtd;
    }

    // Recalcular total geral
    const novoTotal = novosItens.reduce((sum, item) => sum + (item.subtotal || 0), 0);

    setFormData({
      ...formData,
      itens: novosItens,
      valor_total: novoTotal
    });
  };

  // Submeter formulário
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validações
    if (!formData.municipio_id) {
      alert('Município é obrigatório!');
      return;
    }

    if (formData.itens.length === 0) {
      alert('Adicione pelo menos um item ao pedido!');
      return;
    }

    // Validar que todos os itens têm equipamento e quantidade
    const itemInvalido = formData.itens.find(item => !item.equipamento || !item.quantidade || item.quantidade < 1);
    if (itemInvalido) {
      alert('Todos os itens devem ter equipamento e quantidade (mínimo 1)!');
      return;
    }

    setSubmitting(true);
    try {
      const url = editingId 
        ? `${BACKEND_URL}/api/pedidos-maquinarios/${editingId}`
        : `${BACKEND_URL}/api/pedidos-maquinarios`;
      
      const method = editingId ? 'PUT' : 'POST';

      // ✅ Garantir que todos os campos são do tipo correto
      const payload = {
        municipio_id: String(formData.municipio_id),
        municipio_nome: formData.municipio_nome,
        lideranca_nome: formData.lideranca_nome || '',
        status: formData.status || null,
        itens: formData.itens.map(item => ({
          equipamento: item.equipamento,
          preco_unitario: Number(item.preco_unitario),
          quantidade: Number(item.quantidade),
          observacao: item.observacao || '',
          subtotal: Number(item.subtotal)
        })),
        valor_total: Number(formData.valor_total)
      };

      const response = await fetch(url, {
        method,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        let errorMessage = 'Erro ao salvar pedido';
        try {
          const errorData = await response.json();
          console.error('Erro do backend:', errorData);
          
          // Tentar extrair mensagem de erro de diferentes formatos
          if (typeof errorData.detail === 'string') {
            errorMessage = errorData.detail;
          } else if (errorData.detail?.error) {
            errorMessage = errorData.detail.error;
          } else if (errorData.detail && typeof errorData.detail === 'object') {
            errorMessage = JSON.stringify(errorData.detail);
          } else if (errorData.message) {
            errorMessage = errorData.message;
          }
        } catch (e) {
          errorMessage = `Erro ${response.status}: ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      await fetchPedidos();
      closeModal();
      alert(editingId ? 'Pedido atualizado com sucesso!' : 'Pedido criado com sucesso!');
    } catch (error) {
      console.error('Erro ao salvar:', error);
      alert(error.message || 'Erro desconhecido ao salvar pedido');
    } finally {
      setSubmitting(false);
    }
  };

  // Deletar pedido
  const handleDelete = async (id) => {
    if (!window.confirm('Tem certeza que deseja excluir este pedido?')) return;

    try {
      const response = await fetch(`${BACKEND_URL}/api/pedidos-maquinarios/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Erro ao excluir');
      }

      await fetchPedidos();
      alert('Pedido excluído com sucesso!');
    } catch (error) {
      console.error('Erro ao excluir:', error);
      alert(error.message);
    }
  };

  // Exportar para Excel DETALHADO (cada item vira linha)
  const handleExportExcel = () => {
    try {
      const dadosExport = [];
      
      pedidosFiltrados.forEach(pedido => {
        if (Array.isArray(pedido.itens)) {
          pedido.itens.forEach(item => {
            dadosExport.push({
              'ID Pedido': pedido.id,
              'Município': pedido.municipio_nome || '-',
              'Liderança': pedido.lideranca_nome || '-',
              'Equipamento': item.equipamento || '-',
              'Preço Unitário': item.preco_unitario || 0,
              'Quantidade': item.quantidade || 0,
              'Subtotal': item.subtotal || 0,
              'Observação': item.observacao || '-',
              'Status': pedido.status ? STATUS_OPTIONS.find(s => s.value === pedido.status)?.label : '-',
              'Criado em': new Date(pedido.created_at).toLocaleString('pt-BR')
            });
          });
        }
      });

      const ws = XLSX.utils.json_to_sheet(dadosExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Pedidos Maquinários');
      XLSX.writeFile(wb, `pedidos_maquinarios_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (error) {
      console.error('Erro ao exportar:', error);
      alert('Erro ao exportar para Excel');
    }
  };

  // Formatar status
  const formatStatus = (status) => {
    if (!status) return '-';
    const opt = STATUS_OPTIONS.find(s => s.value === status);
    return opt ? opt.label : status;
  };

  // Formatar moeda
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value || 0);
  };

  // Loading
  if (carregando) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-green-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="h-12 bg-gray-200 rounded w-1/3 mb-8 animate-pulse"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 bg-gray-200 rounded animate-pulse"></div>
            ))}
          </div>
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 bg-gray-100 rounded animate-pulse"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-green-50 p-8 print-container">
      <div className="max-w-7xl mx-auto">
        {/* Print Header */}
        <PrintHeader 
          titulo="Pedidos de Maquinários"
          resumoFiltros={{
            'Busca': buscaGeral || 'Todos',
            'Município': filtroMunicipio || 'Todos',
            'Status': filtroStatus ? formatStatus(filtroStatus) : 'Todos',
            'Total de pedidos': pedidosFiltrados.length
          }}
        />

        {/* Header */}
        <div className="mb-8 no-print">
          <h1 className="text-4xl font-bold text-gray-900 mb-2 flex items-center gap-3">
            🚜 Pedidos de Maquinários
          </h1>
          <p className="text-gray-600">Gerencie os pedidos de equipamentos por município</p>
        </div>

        {/* Dashboard Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          {/* Card 1: Municípios */}
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-lg shadow-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm font-medium mb-1">Municípios</p>
                <p className="text-3xl font-bold">{dashboardStats.municipiosDistintos}</p>
              </div>
              <div className="text-4xl opacity-20">🏘️</div>
            </div>
          </div>

          {/* Card 2: Total Pedidos */}
          <div className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-lg shadow-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-100 text-sm font-medium mb-1">Total de Pedidos</p>
                <p className="text-3xl font-bold">{dashboardStats.totalPedidos}</p>
              </div>
              <div className="text-4xl opacity-20">📋</div>
            </div>
          </div>

          {/* Card 3: Total Equipamentos */}
          <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-lg shadow-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-orange-100 text-sm font-medium mb-1">Equipamentos</p>
                <p className="text-3xl font-bold">{dashboardStats.totalEquipamentos}</p>
              </div>
              <div className="text-4xl opacity-20">🚜</div>
            </div>
          </div>

          {/* Card 4: Valor Total */}
          <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-lg shadow-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-100 text-sm font-medium mb-1">Valor Total</p>
                <p className="text-2xl font-bold">{formatCurrency(dashboardStats.valorTotal)}</p>
              </div>
              <div className="text-4xl opacity-20">💰</div>
            </div>
          </div>
        </div>

        {/* Barra de ações */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6 no-print">
          <div className="flex flex-col gap-4">
            {/* Linha 1: Busca e Botões */}
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
              <div className="flex-1 max-w-md">
                <input
                  type="text"
                  placeholder="🔍 Buscar por município, liderança, equipamento..."
                  value={buscaGeral}
                  onChange={(e) => setBuscaGeral(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium shadow-md"
                >
                  🖨️ Imprimir
                </button>
                
                <button
                  onClick={handleExportExcel}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium shadow-md"
                >
                  📊 Exportar Excel
                </button>
                
                <button
                  onClick={() => openModal()}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-md"
                >
                  + Adicionar Pedido
                </button>
              </div>
            </div>

            {/* Linha 2: Filtros */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="Filtrar por município"
                value={filtroMunicipio}
                onChange={(e) => setFiltroMunicipio(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
              />
              
              <select
                value={filtroStatus}
                onChange={(e) => setFiltroStatus(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
              >
                <option value="">Filtrar por status</option>
                {STATUS_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Contador */}
          <div className="mt-4 text-sm text-gray-600">
            {pedidosFiltrados.length} {pedidosFiltrados.length === 1 ? 'pedido encontrado' : 'pedidos encontrados'}
            {(buscaGeral || filtroMunicipio || filtroStatus) && pedidosFiltrados.length < pedidos.length && 
              ` (de ${pedidos.length} total)`}
          </div>
        </div>

        {/* Erro */}
        {erro && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-6">
            ⚠️ {erro}
          </div>
        )}

        {/* Cards de Pedidos */}
        <div className="space-y-6">
          {pedidosFiltrados.length === 0 ? (
            <div className="bg-white rounded-lg shadow-lg p-12 text-center text-gray-500">
              {buscaGeral || filtroMunicipio || filtroStatus
                ? '🔍 Nenhum pedido encontrado com esses critérios'
                : '🚜 Nenhum pedido cadastrado ainda'}
            </div>
          ) : (
            pedidosFiltrados.map((pedido) => (
              <div key={pedido.id} className="bg-white rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition-shadow">
                {/* Header do Card */}
                <div className="bg-gradient-to-r from-green-600 to-green-700 text-white p-6">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-2xl font-bold">{pedido.municipio_nome || 'Município não informado'}</h3>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          pedido.status === 'atendido' ? 'bg-green-200 text-green-900' :
                          pedido.status === 'em_andamento' ? 'bg-blue-200 text-blue-900' :
                          pedido.status === 'aguardando_atendimento' ? 'bg-yellow-200 text-yellow-900' :
                          pedido.status === 'arquivado' ? 'bg-gray-200 text-gray-900' :
                          'bg-white/20'
                        }`}>
                          {formatStatus(pedido.status)}
                        </span>
                      </div>
                      {pedido.lideranca_nome && (
                        <p className="text-green-100 text-sm">
                          👤 Liderança: <span className="font-medium">{pedido.lideranca_nome}</span>
                        </p>
                      )}
                      <p className="text-green-100 text-xs mt-1">
                        📅 Criado em: {new Date(pedido.created_at).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                    
                    <div className="text-right">
                      <p className="text-green-100 text-sm mb-1">Valor Total</p>
                      <p className="text-3xl font-bold">{formatCurrency(pedido.valor_total)}</p>
                    </div>
                  </div>
                </div>

                {/* Corpo do Card - Equipamentos */}
                <div className="p-6">
                  <h4 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                    <span>🚜</span>
                    <span>Equipamentos Solicitados ({pedido.itens?.length || 0})</span>
                  </h4>
                  
                  {pedido.itens && pedido.itens.length > 0 ? (
                    <div className="space-y-3">
                      {pedido.itens.map((item, idx) => (
                        <div key={idx} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <h5 className="font-semibold text-gray-900 mb-1">
                                {item.equipamento || 'Equipamento não especificado'}
                              </h5>
                              {item.observacao && (
                                <p className="text-sm text-gray-600 mt-1">
                                  📝 {item.observacao}
                                </p>
                              )}
                            </div>
                            <div className="text-right ml-4">
                              <div className="text-sm text-gray-600">
                                <span className="font-medium">Qtd:</span> {item.quantidade || 0}
                              </div>
                              <div className="text-sm text-gray-600">
                                <span className="font-medium">Unit:</span> {formatCurrency(item.preco_unitario || 0)}
                              </div>
                              <div className="text-lg font-bold text-green-700 mt-1">
                                {formatCurrency(item.subtotal || 0)}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-center py-4">Nenhum equipamento adicionado</p>
                  )}
                </div>

                {/* Footer do Card - Ações */}
                <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3 no-print">
                  <button
                    onClick={() => openModal(pedido)}
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium"
                  >
                    ✏️ Editar
                  </button>
                  <button
                    onClick={() => handleDelete(pedido.id)}
                    className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium"
                  >
                    🗑️ Excluir
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-2xl font-bold mb-6 text-gray-900">
                {editingId ? 'Editar Pedido' : 'Adicionar Pedido'}
              </h2>

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Município */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Município <span className="text-red-500">*</span>
                  </label>
                  <MunicipioSelect
                    value={formData.municipio_id}
                    onChange={(value, municipio) => {
                      setFormData({
                        ...formData,
                        municipio_id: value,
                        municipio_nome: municipio ? municipio.nome : ''
                      });
                    }}
                    placeholder="Digite para buscar município..."
                    required
                  />
                </div>

                {/* Liderança (opcional) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Liderança Responsável (opcional)
                  </label>
                  <input
                    type="text"
                    value={formData.lideranca_nome}
                    onChange={(e) => setFormData({ ...formData, lideranca_nome: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    placeholder="Ex: João da Silva"
                  />
                </div>

                {/* Status */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Status (opcional)
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                  >
                    <option value="">Selecione um status</option>
                    {STATUS_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                {/* Seção de Itens */}
                <div className="border-t pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">
                      Itens do Pedido <span className="text-red-500">*</span>
                    </h3>
                    <button
                      type="button"
                      onClick={handleAddItem}
                      className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm font-medium"
                    >
                      + Adicionar Item
                    </button>
                  </div>

                  {formData.itens.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg">
                      Nenhum item adicionado. Clique em "Adicionar Item" para começar.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {formData.itens.map((item, index) => (
                        <div key={index} className="border rounded-lg p-4 bg-gray-50 relative">
                          {/* Botão remover */}
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(index)}
                            className="absolute top-2 right-2 text-red-500 hover:text-red-700"
                            title="Remover item"
                          >
                            ❌
                          </button>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Equipamento */}
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Equipamento <span className="text-red-500">*</span>
                              </label>
                              <select
                                value={item.equipamento}
                                onChange={(e) => handleUpdateItem(index, 'equipamento', e.target.value)}
                                required
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-sm"
                              >
                                <option value="">Selecione um equipamento</option>
                                {catalogoEquipamentos.map(eq => (
                                  <option key={eq.nome} value={eq.nome}>
                                    {eq.nome} - {formatCurrency(eq.preco)}
                                  </option>
                                ))}
                              </select>
                            </div>

                            {/* Quantidade */}
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Quantidade <span className="text-red-500">*</span>
                              </label>
                              <input
                                type="number"
                                min="1"
                                value={item.quantidade}
                                onChange={(e) => handleUpdateItem(index, 'quantidade', e.target.value)}
                                required
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-sm"
                              />
                            </div>

                            {/* Preço Unitário (read-only) */}
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Preço Unitário (automático)
                              </label>
                              <input
                                type="text"
                                value={formatCurrency(item.preco_unitario)}
                                readOnly
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-sm text-gray-600"
                              />
                            </div>

                            {/* Subtotal (calculado) */}
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Subtotal (automático)
                              </label>
                              <input
                                type="text"
                                value={formatCurrency(item.subtotal)}
                                readOnly
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-green-50 text-sm font-semibold text-green-700"
                              />
                            </div>

                            {/* Observação */}
                            <div className="md:col-span-2">
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Observação (opcional)
                              </label>
                              <input
                                type="text"
                                value={item.observacao}
                                onChange={(e) => handleUpdateItem(index, 'observacao', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-sm"
                                placeholder="Ex: Com pneus novos"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Total do Pedido */}
                  {formData.itens.length > 0 && (
                    <div className="mt-6 pt-4 border-t">
                      <div className="flex justify-between items-center">
                        <span className="text-lg font-semibold text-gray-900">
                          Total do Pedido:
                        </span>
                        <span className="text-2xl font-bold text-green-700">
                          {formatCurrency(formData.valor_total)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Botões */}
                <div className="flex gap-3 justify-end mt-6 pt-6 border-t">
                  <button
                    type="button"
                    onClick={closeModal}
                    disabled={submitting}
                    className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                  >
                    {submitting ? 'Salvando...' : (editingId ? 'Atualizar' : 'Criar')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
