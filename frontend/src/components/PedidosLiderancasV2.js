import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import PrintHeader from './PrintHeader';
import MunicipioSelect from './MunicipioSelect';
import ProtocolLink from './ProtocolLink';
import { useDataCache } from '../contexts/DataCacheContext';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

// Status disponíveis
const STATUS_OPTIONS = [
  { value: 'em_andamento', label: 'Em andamento' },
  { value: 'aguardando_atendimento', label: 'Aguardando atendimento' },
  { value: 'arquivado', label: 'Arquivado' },
  { value: 'atendido', label: 'Atendido' },
];

export default function PedidosLiderancasV2() {
  // Hook de cache
  const { fetchWithCache } = useDataCache();
  
  // Estados principais
  const [pedidos, setPedidos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);
  
  // Estados de filtros
  const [buscaGeral, setBuscaGeral] = useState('');
  const [filtroMunicipio, setFiltroMunicipio] = useState('');
  const [filtroLideranca, setFiltroLideranca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');
  
  // Estados de paginação
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [itensPorPagina, setItensPorPagina] = useState(25);
  
  // Estados do modal de edição/criação
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  
  // Estados do modal de detalhes
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedPedido, setSelectedPedido] = useState(null);
  
  // Estados do formulário
  const [formData, setFormData] = useState({
    municipio_id: '',
    municipio_nome: '',
    lideranca_nome: '',
    titulo: '',
    protocolo: '',
    lideranca_telefone: '',
    descricao: '',
    status: ''
  });
  
  // Debounce para busca
  const [buscaGeralDebounced, setBuscaGeralDebounced] = useState('');
  const debounceTimer = useRef(null);

  // Função para normalizar texto (remover acentos)
  const normalizeText = (text) => {
    if (!text) return '';
    return text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  };
  
  // Efeito de debounce para busca (300ms)
  useEffect(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    
    debounceTimer.current = setTimeout(() => {
      setBuscaGeralDebounced(buscaGeral);
      setPaginaAtual(1); // Reset para primeira página ao buscar
    }, 300);
    
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [buscaGeral]);

  // Máscara para protocolo: 00.000.000-0
  const formatProtocolo = (value) => {
    const numbers = value.replace(/\D/g, '');
    const limitedNumbers = numbers.slice(0, 9);
    
    if (limitedNumbers.length <= 2) {
      return limitedNumbers;
    } else if (limitedNumbers.length <= 5) {
      return `${limitedNumbers.slice(0, 2)}.${limitedNumbers.slice(2)}`;
    } else if (limitedNumbers.length <= 8) {
      return `${limitedNumbers.slice(0, 2)}.${limitedNumbers.slice(2, 5)}.${limitedNumbers.slice(5)}`;
    } else {
      return `${limitedNumbers.slice(0, 2)}.${limitedNumbers.slice(2, 5)}.${limitedNumbers.slice(5, 8)}-${limitedNumbers.slice(8)}`;
    }
  };

  // Máscara para telefone: (00) 00000-0000
  const formatTelefone = (value) => {
    const numbers = value.replace(/\D/g, '');
    const limitedNumbers = numbers.slice(0, 11);
    
    if (limitedNumbers.length <= 2) {
      return limitedNumbers;
    } else if (limitedNumbers.length <= 7) {
      return `(${limitedNumbers.slice(0, 2)}) ${limitedNumbers.slice(2)}`;
    } else {
      return `(${limitedNumbers.slice(0, 2)}) ${limitedNumbers.slice(2, 7)}-${limitedNumbers.slice(7)}`;
    }
  };

  // Carregar pedidos com cache
  const fetchPedidos = useCallback(async (forceFresh = false) => {
    setCarregando(true);
    setErro(null);
    
    try {
      const data = await fetchWithCache(
        'liderancas', 
        async (signal) => {
          const response = await fetch(`${BACKEND_URL}/api/liderancas`, {
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            signal
          });

          if (response.status === 401) {
            throw new Error('AUTH_ERROR');
          }

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }

          const json = await response.json();
          
          if (!Array.isArray(json)) {
            throw new Error('Invalid data format');
          }

          return json;
        },
        { forceFresh }
      );

      setPedidos(data);
      setCarregando(false);
    } catch (error) {
      if (error.message === 'AUTH_ERROR') {
        setErro('Sessão expirada. Por favor, faça login novamente.');
        setTimeout(() => window.location.href = '/', 2000);
        return;
      }

      if (error.name === 'AbortError') {
        console.log('[Lideranças] Requisição cancelada');
        return;
      }
      
      console.error('[Lideranças] Erro ao carregar:', error);
      setErro('Erro ao carregar pedidos. Tente novamente.');
      setCarregando(false);
    }
  }, [fetchWithCache]);

  // Carregar municípios
  const fetchMunicipios = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/municipios`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data)) {
          setMunicipios(data);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar municípios:', error);
    }
  };

  useEffect(() => {
    fetchPedidos();
  }, [fetchPedidos]);

  // Filtrar pedidos (acento-insensível) com debounce
  const pedidosFiltrados = useMemo(() => {
    try {
      if (!Array.isArray(pedidos)) return [];

      return pedidos.filter(pedido => {
        if (!pedido || typeof pedido !== 'object') return false;

        // Busca geral (usando versão debounced)
        if (buscaGeralDebounced) {
          const buscaNorm = normalizeText(buscaGeralDebounced);
          const match = (
            normalizeText(pedido.protocolo || '').includes(buscaNorm) ||
            normalizeText(pedido.titulo || '').includes(buscaNorm) ||
            normalizeText(pedido.lideranca_nome || '').includes(buscaNorm) ||
            normalizeText(pedido.municipio_nome || '').includes(buscaNorm) ||
            normalizeText(pedido.descricao || '').includes(buscaNorm)
          );
          if (!match) return false;
        }

        // Filtro por município
        if (filtroMunicipio) {
          const match = normalizeText(pedido.municipio_nome || '').includes(normalizeText(filtroMunicipio));
          if (!match) return false;
        }

        // Filtro por liderança
        if (filtroLideranca) {
          const match = normalizeText(pedido.lideranca_nome || '').includes(normalizeText(filtroLideranca));
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
  }, [pedidos, buscaGeralDebounced, filtroMunicipio, filtroLideranca, filtroStatus]);
  
  // Ordenar pedidos (mais recente primeiro)
  const pedidosOrdenados = useMemo(() => {
    return [...pedidosFiltrados].sort((a, b) => {
      const dateA = new Date(a.created_at || 0);
      const dateB = new Date(b.created_at || 0);
      return dateB - dateA; // Mais recente primeiro
    });
  }, [pedidosFiltrados]);
  
  // Paginação
  const totalPaginas = Math.ceil(pedidosOrdenados.length / itensPorPagina);
  const indexInicio = (paginaAtual - 1) * itensPorPagina;
  const indexFim = indexInicio + itensPorPagina;
  const pedidosPaginados = pedidosOrdenados.slice(indexInicio, indexFim);
  
  // Funções para navegação de página
  const irParaPagina = (pagina) => {
    setPaginaAtual(Math.max(1, Math.min(pagina, totalPaginas)));
  };
  
  // Abrir modal de detalhes
  const openDetailsModal = (pedido) => {
    setSelectedPedido(pedido);
    setShowDetailsModal(true);
  };
  
  // Fechar modal de detalhes
  const closeDetailsModal = () => {
    setShowDetailsModal(false);
    setSelectedPedido(null);
  };
  
  // Editar a partir do modal de detalhes
  const editFromDetails = (pedido) => {
    closeDetailsModal(); // Fecha modal de detalhes
    openModal(pedido); // Abre modal de edição
  };

  // Abrir modal de edição/criação
  const openModal = (pedido = null) => {
    if (pedido) {
      setEditingId(pedido.id);
      setFormData({
        municipio_id: pedido.municipio_id || '',
        municipio_nome: pedido.municipio_nome || '',
        lideranca_nome: pedido.lideranca_nome || '',
        titulo: pedido.titulo || '',
        protocolo: pedido.protocolo || '',
        lideranca_telefone: pedido.lideranca_telefone || '',
        descricao: pedido.descricao || '',
        status: pedido.status || ''
      });
    } else {
      setEditingId(null);
      setFormData({
        municipio_id: '',
        municipio_nome: '',
        lideranca_nome: '',
        titulo: '',
        protocolo: '',
        lideranca_telefone: '',
        descricao: '',
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

  // Submeter formulário
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validações
    if (!formData.municipio_id || !formData.lideranca_nome) {
      alert('Município e Liderança são obrigatórios!');
      return;
    }

    setSubmitting(true);
    try {
      const url = editingId 
        ? `${BACKEND_URL}/api/liderancas/${editingId}`
        : `${BACKEND_URL}/api/liderancas`;
      
      const method = editingId ? 'PUT' : 'POST';

      // ✅ Garantir que municipio_id é string
      const payload = {
        ...formData,
        municipio_id: String(formData.municipio_id),
        municipio_nome: formData.municipio_nome,
        lideranca_nome: formData.lideranca_nome,
        titulo: formData.titulo || '',
        protocolo: formData.protocolo || '',
        lideranca_telefone: formData.lideranca_telefone || '',
        descricao: formData.descricao || '',
        status: formData.status || null
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
      const response = await fetch(`${BACKEND_URL}/api/liderancas/${id}`, {
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

  // Exportar para Excel (respeitando filtros)
  const handleExportExcel = () => {
    try {
      const dadosExport = pedidosFiltrados.map(p => ({
        'Protocolo': p.protocolo || '-',
        'Título': p.titulo || '-',
        'Município': p.municipio_nome || '-',
        'Liderança': p.lideranca_nome || '-',
        'Telefone': p.lideranca_telefone || '-',
        'Status': p.status ? STATUS_OPTIONS.find(s => s.value === p.status)?.label : '-',
        'Descrição': p.descricao || '-',
        'Criado em': new Date(p.created_at).toLocaleString('pt-BR')
      }));

      const ws = XLSX.utils.json_to_sheet(dadosExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Pedidos Lideranças');
      XLSX.writeFile(wb, `pedidos_liderancas_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (error) {
      console.error('Erro ao exportar:', error);
      alert('Erro ao exportar para Excel');
    }
  };

  // Formatar status para exibição
  const formatStatus = (status) => {
    if (!status) return '-';
    const opt = STATUS_OPTIONS.find(s => s.value === status);
    return opt ? opt.label : status;
  };

  // Loading
  if (carregando) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="h-12 bg-gray-200 rounded w-1/3 mb-8 animate-pulse"></div>
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-20 bg-gray-100 rounded animate-pulse"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 p-8 print-container">
      <div className="max-w-7xl mx-auto">
        {/* Print Header */}
        <PrintHeader 
          titulo="Pedidos de Lideranças"
          resumoFiltros={{
            'Busca': buscaGeral || 'Todos',
            'Município': filtroMunicipio || 'Todos',
            'Liderança': filtroLideranca || 'Todos',
            'Status': filtroStatus ? formatStatus(filtroStatus) : 'Todos',
            'Total de registros': pedidosFiltrados.length
          }}
        />

        {/* Header */}
        <div className="mb-8 no-print">
          <h1 className="text-4xl font-bold text-gray-900 mb-2 flex items-center gap-3">
            📋 Pedidos de Lideranças
          </h1>
          <p className="text-gray-600">Gerencie os pedidos das lideranças</p>
        </div>

        {/* Barra de ações */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6 no-print">
          <div className="flex flex-col gap-4">
            {/* Linha 1: Busca e Botões */}
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
              <div className="flex-1 max-w-md">
                <input
                  type="text"
                  placeholder="🔍 Buscar por protocolo, título, liderança, município..."
                  value={buscaGeral}
                  onChange={(e) => setBuscaGeral(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <input
                type="text"
                placeholder="Filtrar por município"
                value={filtroMunicipio}
                onChange={(e) => setFiltroMunicipio(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              
              <input
                type="text"
                placeholder="Filtrar por liderança"
                value={filtroLideranca}
                onChange={(e) => setFiltroLideranca(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              
              <select
                value={filtroStatus}
                onChange={(e) => setFiltroStatus(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
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
            {(buscaGeral || filtroMunicipio || filtroLideranca || filtroStatus) && pedidosFiltrados.length < pedidos.length && 
              ` (de ${pedidos.length} total)`}
          </div>
        </div>

        {/* Erro */}
        {erro && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-6">
            ⚠️ {erro}
          </div>
        )}

        {/* Tabela */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          {pedidosFiltrados.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              {buscaGeral || filtroMunicipio || filtroLideranca || filtroStatus
                ? '🔍 Nenhum pedido encontrado com esses critérios'
                : '📋 Nenhum pedido cadastrado ainda'}
            </div>
          ) : (
            <>
              {/* Tabela com header sticky */}
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="w-full">
                  <thead className="bg-gradient-to-r from-blue-600 to-blue-700 text-white sticky top-0 z-10">
                    <tr>
                      <th className="px-6 py-4 text-left font-semibold text-sm">Protocolo</th>
                      <th className="px-6 py-4 text-left font-semibold text-sm">Título</th>
                      <th className="px-6 py-4 text-left font-semibold text-sm">Município</th>
                      <th className="px-6 py-4 text-left font-semibold text-sm">Liderança</th>
                      <th className="px-6 py-4 text-left font-semibold text-sm">Telefone</th>
                      <th className="px-6 py-4 text-left font-semibold text-sm">Status</th>
                      <th className="px-6 py-4 text-center font-semibold text-sm no-print">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pedidosPaginados.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="px-6 py-12 text-center text-gray-500">
                          Nenhum pedido encontrado
                        </td>
                      </tr>
                    ) : (
                      pedidosPaginados.map((pedido, index) => (
                        <tr
                          key={pedido.id}
                          onClick={() => openDetailsModal(pedido)}
                          className={`border-b border-gray-100 hover:bg-blue-50 transition-all duration-150 cursor-pointer ${
                            index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                          }`}
                        >
                          <td className="px-6 py-4 font-mono text-sm">
                            <ProtocolLink protocolo={pedido.protocolo} />
                          </td>
                          <td className="px-6 py-4 font-medium text-gray-900">
                            {pedido.titulo || '-'}
                          </td>
                          <td className="px-6 py-4 text-gray-700">
                            {pedido.municipio_nome}
                          </td>
                          <td className="px-6 py-4 text-gray-700">
                            {pedido.lideranca_nome}
                          </td>
                          <td className="px-6 py-4 text-gray-600 text-sm">
                            {pedido.lideranca_telefone || '-'}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                              pedido.status === 'atendido' ? 'bg-green-100 text-green-800 border border-green-200' :
                              pedido.status === 'em_andamento' ? 'bg-blue-100 text-blue-800 border border-blue-200' :
                              pedido.status === 'aguardando_atendimento' ? 'bg-yellow-100 text-yellow-800 border border-yellow-200' :
                              pedido.status === 'arquivado' ? 'bg-gray-100 text-gray-800 border border-gray-200' :
                              'bg-gray-100 text-gray-600 border border-gray-200'
                            }`}>
                              {formatStatus(pedido.status)}
                            </span>
                          </td>
                          <td className="px-6 py-4 no-print" onClick={(e) => e.stopPropagation()}>
                            <div className="flex gap-2 justify-center">
                              <button
                                onClick={() => openDetailsModal(pedido)}
                                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm font-medium transition-colors shadow-sm hover:shadow-md"
                                title="Ver detalhes"
                              >
                                👁️ Ver
                              </button>
                              <button
                                onClick={() => openModal(pedido)}
                                className="px-3 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 text-sm font-medium transition-colors shadow-sm hover:shadow-md"
                                title="Editar pedido"
                              >
                                ✏️
                              </button>
                              <button
                                onClick={() => handleDelete(pedido.id)}
                                className="px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 text-sm font-medium transition-colors shadow-sm hover:shadow-md"
                                title="Excluir pedido"
                              >
                                🗑️
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              
              {/* Paginação */}
              {pedidosOrdenados.length > 0 && (
                <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 px-4">
                  {/* Info de registros */}
                  <div className="text-sm text-gray-600">
                    Mostrando <span className="font-semibold">{indexInicio + 1}</span> até{' '}
                    <span className="font-semibold">{Math.min(indexFim, pedidosOrdenados.length)}</span> de{' '}
                    <span className="font-semibold">{pedidosOrdenados.length}</span> pedidos
                  </div>
                  
                  {/* Controles de paginação */}
                  <div className="flex items-center gap-4">
                    {/* Seletor de itens por página */}
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">Itens por página:</span>
                      <select
                        value={itensPorPagina}
                        onChange={(e) => {
                          setItensPorPagina(Number(e.target.value));
                          setPaginaAtual(1);
                        }}
                        className="border border-gray-300 rounded-lg px-3 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                      </select>
                    </div>
                    
                    {/* Botões de navegação */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => irParaPagina(1)}
                        disabled={paginaAtual === 1}
                        className="px-3 py-1 rounded-lg border border-gray-300 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 transition-colors"
                        title="Primeira página"
                      >
                        ««
                      </button>
                      <button
                        onClick={() => irParaPagina(paginaAtual - 1)}
                        disabled={paginaAtual === 1}
                        className="px-3 py-1 rounded-lg border border-gray-300 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 transition-colors"
                        title="Página anterior"
                      >
                        ‹
                      </button>
                      
                      <span className="px-4 py-1 text-sm font-medium text-gray-700">
                        Página {paginaAtual} de {totalPaginas}
                      </span>
                      
                      <button
                        onClick={() => irParaPagina(paginaAtual + 1)}
                        disabled={paginaAtual === totalPaginas}
                        className="px-3 py-1 rounded-lg border border-gray-300 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 transition-colors"
                        title="Próxima página"
                      >
                        ›
                      </button>
                      <button
                        onClick={() => irParaPagina(totalPaginas)}
                        disabled={paginaAtual === totalPaginas}
                        className="px-3 py-1 rounded-lg border border-gray-300 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 transition-colors"
                        title="Última página"
                      >
                        »»
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-2xl font-bold mb-6 text-gray-900">
                {editingId ? 'Editar Pedido' : 'Adicionar Pedido'}
              </h2>

              <form onSubmit={handleSubmit} className="space-y-4">
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

                {/* Nome da Liderança */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nome da Liderança <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.lideranca_nome}
                    onChange={(e) => setFormData({ ...formData, lideranca_nome: e.target.value })}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Ex: João da Silva"
                  />
                </div>

                {/* Título */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Título (opcional)
                  </label>
                  <input
                    type="text"
                    value={formData.titulo}
                    onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Ex: Reparo de estrada"
                  />
                </div>

                {/* Protocolo */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Protocolo (opcional)
                  </label>
                  <input
                    type="text"
                    value={formData.protocolo}
                    onChange={(e) => setFormData({ ...formData, protocolo: formatProtocolo(e.target.value) })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="00.000.000-0"
                    maxLength={12}
                  />
                </div>

                {/* Telefone */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Telefone da Liderança (opcional)
                  </label>
                  <input
                    type="text"
                    value={formData.lideranca_telefone}
                    onChange={(e) => setFormData({ ...formData, lideranca_telefone: formatTelefone(e.target.value) })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="(00) 00000-0000"
                    maxLength={15}
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
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Selecione um status</option>
                    {STATUS_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                {/* Descrição */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Descrição (opcional)
                  </label>
                  <textarea
                    value={formData.descricao}
                    onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                    rows={4}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Detalhes adicionais sobre o pedido..."
                  />
                </div>

                {/* Botões */}
                <div className="flex gap-3 justify-end mt-6">
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
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {submitting ? 'Salvando...' : (editingId ? 'Atualizar' : 'Criar')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      
      {/* Modal de Detalhes */}
      {showDetailsModal && selectedPedido && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
          onClick={closeDetailsModal}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header do Modal */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-8 py-6 rounded-t-2xl">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h2 className="text-2xl font-bold mb-2">
                    Detalhes do Pedido
                  </h2>
                  <p className="text-blue-100 text-sm">
                    Informações completas do pedido de liderança
                  </p>
                </div>
                <button
                  onClick={closeDetailsModal}
                  className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition-all"
                  title="Fechar"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            {/* Conteúdo do Modal */}
            <div className="p-8">
              {/* Grid de informações */}
              <div className="space-y-6">
                {/* Protocolo com destaque */}
                {selectedPedido.protocolo && (
                  <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-blue-900 mb-1">Protocolo</p>
                        <p className="text-xl font-mono font-bold text-blue-700">
                          {selectedPedido.protocolo}
                        </p>
                      </div>
                      <ProtocolLink protocolo={selectedPedido.protocolo} />
                    </div>
                  </div>
                )}
                
                {/* Título */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm font-medium text-gray-600 mb-2">📋 Título</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {selectedPedido.titulo || 'Não informado'}
                  </p>
                </div>
                
                {/* Status */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm font-medium text-gray-600 mb-2">🏷️ Status</p>
                  <span className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold ${
                    selectedPedido.status === 'atendido' ? 'bg-green-100 text-green-800 border-2 border-green-300' :
                    selectedPedido.status === 'em_andamento' ? 'bg-blue-100 text-blue-800 border-2 border-blue-300' :
                    selectedPedido.status === 'aguardando_atendimento' ? 'bg-yellow-100 text-yellow-800 border-2 border-yellow-300' :
                    selectedPedido.status === 'arquivado' ? 'bg-gray-100 text-gray-800 border-2 border-gray-300' :
                    'bg-gray-100 text-gray-600 border-2 border-gray-300'
                  }`}>
                    {formatStatus(selectedPedido.status)}
                  </span>
                </div>
                
                {/* Grid 2 colunas */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Município */}
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm font-medium text-gray-600 mb-2">🏙️ Município</p>
                    <p className="text-base font-semibold text-gray-900">
                      {selectedPedido.municipio_nome}
                    </p>
                  </div>
                  
                  {/* Liderança */}
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm font-medium text-gray-600 mb-2">👤 Liderança</p>
                    <p className="text-base font-semibold text-gray-900">
                      {selectedPedido.lideranca_nome}
                    </p>
                  </div>
                  
                  {/* Telefone */}
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm font-medium text-gray-600 mb-2">📞 Telefone</p>
                    <p className="text-base font-mono text-gray-900">
                      {selectedPedido.lideranca_telefone || 'Não informado'}
                    </p>
                  </div>
                  
                  {/* Data de criação */}
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm font-medium text-gray-600 mb-2">📅 Criado em</p>
                    <p className="text-base font-semibold text-gray-900">
                      {new Date(selectedPedido.created_at).toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: 'long',
                        year: 'numeric'
                      })}
                    </p>
                  </div>
                </div>
                
                {/* Descrição completa */}
                {selectedPedido.descricao && (
                  <div className="bg-amber-50 border-l-4 border-amber-500 p-6 rounded-lg">
                    <p className="text-sm font-medium text-amber-900 mb-3 flex items-center gap-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Descrição Completa
                    </p>
                    <p className="text-gray-800 leading-relaxed whitespace-pre-wrap">
                      {selectedPedido.descricao}
                    </p>
                  </div>
                )}
              </div>
            </div>
            
            {/* Footer com botões */}
            <div className="bg-gray-50 px-8 py-6 rounded-b-2xl flex flex-col sm:flex-row gap-3 justify-end border-t border-gray-200">
              <button
                onClick={closeDetailsModal}
                className="px-6 py-2.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
              >
                Fechar
              </button>
              <button
                onClick={() => editFromDetails(selectedPedido)}
                className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Editar Pedido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
