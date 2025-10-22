import React, { useState, useEffect, useMemo } from 'react';
import PrintHeader from './PrintHeader';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export default function PedidosLiderancas() {
  // Estados principais
  const [pedidos, setPedidos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);
  const [busca, setBusca] = useState('');
  const [filtroMunicipio, setFiltroMunicipio] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [copiedProtocolo, setCopiedProtocolo] = useState(null);
  
  // Estados para municípios
  const [municipios, setMunicipios] = useState([]);
  const [municipiosCarregando, setMunicipiosCarregando] = useState(false);
  const [buscaMunicipio, setBuscaMunicipio] = useState('');
  const [buscaMunicipioDebounced, setBuscaMunicipioDebounced] = useState('');
  const [showMunicipiosDropdown, setShowMunicipiosDropdown] = useState(false);
  const [municipioSelecionado, setMunicipioSelecionado] = useState(null);
  
  // Estados do formulário
  const [formData, setFormData] = useState({
    municipio_id: '',
    municipio_nome: '',
    pedido_titulo: '',
    protocolo: '',
    nome_lideranca: '',
    numero_lideranca: '',
    descricao: ''
  });
  const [protocoloError, setProtocoloError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Função para normalizar texto (remover acentos) para busca
  const normalizeText = (text) => {
    if (!text) return '';
    return text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  };

  // Função para formatar protocolo (máscara 00.000.000-0)
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

  // Validar formato do protocolo
  const validateProtocolo = (protocolo) => {
    if (!protocolo || protocolo.trim() === '') {
      return { valid: true, error: '' }; // Vazio é válido (opcional)
    }
    
    const numbers = protocolo.replace(/\D/g, '');
    if (numbers.length === 0) {
      return { valid: true, error: '' };
    }
    if (numbers.length < 9) {
      return { valid: false, error: `Protocolo incompleto (${numbers.length}/9 dígitos)` };
    }
    if (numbers.length > 9) {
      return { valid: false, error: `Protocolo muito longo (${numbers.length}/9 dígitos)` };
    }
    return { valid: true, error: '' };
  };

  // Gerar link do e-Protocolo
  const gerarLinkEProtocolo = (protocolo) => {
    if (!protocolo) return null;
    
    const numbers = protocolo.replace(/\D/g, '');
    if (numbers.length !== 9) return null;
    
    return `https://www.eprotocolo.pr.gov.br/spiweb/consultarProtocoloDigital.do?action=pesquisar&numeroProtocolo=${numbers}`;
  };

  // Extrair apenas dígitos do protocolo
  const toDigits = (protocolo) => {
    return (protocolo || '').replace(/\D/g, '');
  };

  // Carregar pedidos
  const fetchPedidos = async () => {
    setCarregando(true);
    setErro(null);
    try {
      console.log('[fetchPedidos] Iniciando requisição para:', `${BACKEND_URL}/api/liderancas`);
      
      const response = await fetch(`${BACKEND_URL}/api/liderancas`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      console.log('[fetchPedidos] Status da resposta:', response.status);

      // Tratamento específico para erro de autenticação
      if (response.status === 401) {
        console.warn('[fetchPedidos] Não autorizado (401). Limpando sessão e redirecionando...');
        localStorage.removeItem('user');
        setErro('Sessão expirada. Por favor, faça login novamente.');
        setTimeout(() => {
          window.location.href = '/';
        }, 2000);
        return;
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[fetchPedidos] Erro na resposta:', errorText);
        throw new Error(`Erro ao carregar pedidos (status ${response.status})`);
      }

      const data = await response.json();
      console.log('[fetchPedidos] Dados recebidos:', {
        type: Array.isArray(data) ? 'array' : typeof data,
        length: Array.isArray(data) ? data.length : 'N/A',
        sample: Array.isArray(data) && data.length > 0 ? data[0] : 'vazio'
      });

      // Validar que os dados são um array
      if (!Array.isArray(data)) {
        console.error('[fetchPedidos] Dados recebidos não são um array:', data);
        throw new Error('Formato de dados inválido recebido do servidor');
      }

      // Normalizar dados para garantir que todos os campos existam
      const normalizedData = data.map(pedido => ({
        id: pedido.id || '',
        municipio_id: pedido.municipio_id || '',
        municipio_nome: pedido.municipio_nome || '',
        pedido_titulo: pedido.pedido_titulo || '',
        protocolo: pedido.protocolo || '',
        nome_lideranca: pedido.nome_lideranca || '',
        numero_lideranca: pedido.numero_lideranca || '',
        descricao: pedido.descricao || '',
        created_at: pedido.created_at || '',
        updated_at: pedido.updated_at || ''
      }));

      console.log('[fetchPedidos] Dados normalizados e prontos para uso');
      setPedidos(normalizedData);
    } catch (error) {
      console.error('[fetchPedidos] Erro capturado:', error);
      setErro(error.message || 'Erro desconhecido ao carregar pedidos');
    } finally {
      setCarregando(false);
      console.log('[fetchPedidos] Finalizado');
    }
  };

  useEffect(() => {
    fetchPedidos();
    fetchMunicipios();
  }, []);

  // Debounce para busca de municípios
  useEffect(() => {
    const timer = setTimeout(() => {
      setBuscaMunicipioDebounced(buscaMunicipio);
    }, 200);

    return () => clearTimeout(timer);
  }, [buscaMunicipio]);

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showMunicipiosDropdown && !event.target.closest('.municipio-dropdown-container')) {
        setShowMunicipiosDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMunicipiosDropdown]);

  // Carregar municípios
  const fetchMunicipios = async () => {
    setMunicipiosCarregando(true);
    try {
      console.log('[fetchMunicipios] Iniciando requisição...');
      const response = await fetch(`${BACKEND_URL}/api/municipios`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      console.log('[fetchMunicipios] Status:', response.status);

      // Tratamento específico para erro de autenticação
      if (response.status === 401) {
        console.warn('[fetchMunicipios] Não autorizado (401)');
        return;
      }

      if (!response.ok) {
        throw new Error(`Erro ao carregar municípios: ${response.status}`);
      }

      const data = await response.json();
      console.log('[fetchMunicipios] Municípios carregados:', data.length);
      
      // Validar que os dados são um array
      if (!Array.isArray(data)) {
        console.error('[fetchMunicipios] Dados recebidos não são um array');
        return;
      }
      
      setMunicipios(data);
    } catch (error) {
      console.error('[fetchMunicipios] Erro:', error);
    } finally {
      setMunicipiosCarregando(false);
    }
  };

  // Abrir modal para criar ou editar
  const openModal = (pedido = null) => {
    if (pedido) {
      setEditingId(pedido.id);
      setFormData({
        municipio_id: pedido.municipio_id || '',
        municipio_nome: pedido.municipio_nome || '',
        pedido_titulo: pedido.pedido_titulo || '',
        protocolo: pedido.protocolo || '',
        nome_lideranca: pedido.nome_lideranca || '',
        numero_lideranca: pedido.numero_lideranca || '',
        descricao: pedido.descricao || ''
      });
      setMunicipioSelecionado(pedido.municipio_nome ? { id: pedido.municipio_id, nome: pedido.municipio_nome } : null);
      setBuscaMunicipio(pedido.municipio_nome || '');
    } else {
      setEditingId(null);
      setFormData({
        municipio_id: '',
        municipio_nome: '',
        pedido_titulo: '',
        protocolo: '',
        nome_lideranca: '',
        numero_lideranca: '',
        descricao: ''
      });
      setMunicipioSelecionado(null);
      setBuscaMunicipio('');
    }
    setProtocoloError('');
    setShowModal(true);
  };

  // Fechar modal
  const closeModal = () => {
    setShowModal(false);
    setEditingId(null);
    setFormData({
      municipio_id: '',
      municipio_nome: '',
      pedido_titulo: '',
      protocolo: '',
      nome_lideranca: '',
      numero_lideranca: '',
      descricao: ''
    });
    setProtocoloError('');
    setMunicipioSelecionado(null);
    setBuscaMunicipio('');
    setShowMunicipiosDropdown(false);
  };

  // Handle input change
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    if (name === 'protocolo') {
      const formatted = formatProtocolo(value);
      const validation = validateProtocolo(formatted);
      setFormData({ ...formData, protocolo: formatted });
      setProtocoloError(validation.error);
    } else if (name === 'numero_lideranca') {
      // Permitir apenas números e alguns caracteres de formatação
      const cleaned = value.replace(/[^\d\s\-()]/g, '');
      setFormData({ ...formData, numero_lideranca: cleaned });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  // Submeter formulário
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validações no frontend antes de enviar
    if (!formData.municipio_id || !formData.municipio_nome) {
      alert('Por favor, selecione um município');
      return;
    }
    
    if (!formData.pedido_titulo || formData.pedido_titulo.trim() === '') {
      alert('Por favor, informe o título do pedido');
      return;
    }
    
    if (!formData.nome_lideranca || formData.nome_lideranca.trim() === '') {
      alert('Por favor, informe o nome da liderança');
      return;
    }
    
    if (!formData.numero_lideranca || formData.numero_lideranca.trim() === '') {
      alert('Por favor, informe o número da liderança');
      return;
    }
    
    // Validar protocolo (se fornecido)
    if (formData.protocolo && formData.protocolo.trim() !== '') {
      const validation = validateProtocolo(formData.protocolo);
      if (!validation.valid) {
        setProtocoloError(validation.error);
        return;
      }
    }

    setSubmitting(true);
    try {
      const url = editingId 
        ? `${BACKEND_URL}/api/liderancas/${editingId}`
        : `${BACKEND_URL}/api/liderancas`;
      
      const method = editingId ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        // Extrair mensagem de erro estruturada
        const errorMessage = 
          errorData?.error || 
          errorData?.detail?.error || 
          errorData?.detail || 
          errorData?.message ||
          'Falha ao salvar o pedido.';
        
        throw new Error(errorMessage);
      }

      // Recarregar lista e fechar modal
      await fetchPedidos();
      closeModal();
      
      // Mostrar mensagem de sucesso
      alert(editingId ? '✓ Pedido atualizado com sucesso!' : '✓ Pedido criado com sucesso!');
    } catch (error) {
      console.error('Erro ao salvar pedido:', error);
      
      // Mensagem de erro clara (sem [Object Object])
      const errorMsg = error.message || 'Falha ao salvar o pedido.';
      alert(`✗ ${errorMsg}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Deletar pedido
  const handleDelete = async (id, protocolo) => {
    if (!window.confirm(`Tem certeza que deseja excluir o pedido ${protocolo}?`)) {
      return;
    }

    try {
      const response = await fetch(`${BACKEND_URL}/api/liderancas/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Erro ao deletar pedido');
      }

      await fetchPedidos();
      alert('Pedido excluído com sucesso!');
    } catch (error) {
      console.error('Erro ao deletar pedido:', error);
      alert(error.message);
    }
  };

  // Copiar protocolo para clipboard
  const copyProtocolo = async (protocolo) => {
    try {
      await navigator.clipboard.writeText(protocolo);
      setCopiedProtocolo(protocolo);
      setTimeout(() => setCopiedProtocolo(null), 2000);
    } catch (error) {
      console.error('Erro ao copiar protocolo:', error);
    }
  };

  // Filtrar pedidos pela busca com tratamento de erro robusto
  const pedidosFiltrados = useMemo(() => {
    try {
      // Garantir que pedidos é um array válido
      if (!Array.isArray(pedidos)) {
        console.warn('[pedidosFiltrados] pedidos não é um array:', pedidos);
        return [];
      }

      return pedidos.filter(pedido => {
        // Proteção contra pedidos inválidos
        if (!pedido || typeof pedido !== 'object') {
          console.warn('[pedidosFiltrados] Pedido inválido encontrado:', pedido);
          return false;
        }

        // Filtro de busca geral
        let matchBusca = true;
        if (busca) {
          try {
            const buscaNormalizada = normalizeText(busca);
            matchBusca = (
              normalizeText(pedido.protocolo || '').includes(buscaNormalizada) ||
              normalizeText(pedido.pedido_titulo || '').includes(buscaNormalizada) ||
              normalizeText(pedido.nome_lideranca || '').includes(buscaNormalizada) ||
              normalizeText(pedido.numero_lideranca || '').includes(buscaNormalizada) ||
              normalizeText(pedido.municipio_nome || '').includes(buscaNormalizada) ||
              normalizeText(pedido.descricao || '').includes(buscaNormalizada)
            );
          } catch (e) {
            console.error('[pedidosFiltrados] Erro ao filtrar busca:', e);
            return false;
          }
        }
        
        // Filtro por município
        let matchMunicipio = true;
        if (filtroMunicipio) {
          try {
            matchMunicipio = normalizeText(pedido.municipio_nome || '').includes(normalizeText(filtroMunicipio));
          } catch (e) {
            console.error('[pedidosFiltrados] Erro ao filtrar município:', e);
            return false;
          }
        }
        
        return matchBusca && matchMunicipio;
      });
    } catch (error) {
      console.error('[pedidosFiltrados] Erro crítico na filtragem:', error);
      return [];
    }
  }, [pedidos, busca, filtroMunicipio]);

  // Filtrar municípios para o autocomplete (usando versão debounced)
  const municipiosFiltrados = municipios.filter(municipio => {
    if (!buscaMunicipioDebounced) return true;
    return normalizeText(municipio.nome).includes(normalizeText(buscaMunicipioDebounced));
  });

  // Selecionar município
  const handleSelectMunicipio = (municipio) => {
    setMunicipioSelecionado(municipio);
    setBuscaMunicipio(municipio.nome);
    setFormData({
      ...formData,
      municipio_id: municipio.id,
      municipio_nome: municipio.nome
    });
    setShowMunicipiosDropdown(false);
  };

  // Loading skeleton
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
        {/* Print Header (só aparece na impressão) */}
        <PrintHeader 
          titulo="Pedidos Lideranças"
          resumoFiltros={{
            'Busca': busca || 'Todos',
            'Município': filtroMunicipio || 'Todos',
            'Total de registros': pedidosFiltrados.length
          }}
        />

        {/* Header */}
        <div className="mb-8 no-print">
          <h1 className="text-4xl font-bold text-gray-900 mb-2 flex items-center gap-3">
            📋 Pedidos Lideranças
          </h1>
          <p className="text-gray-600">
            Gerencie os pedidos das lideranças com protocolo
          </p>
        </div>

        {/* Barra de ações */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6 no-print">
          <div className="flex flex-col gap-4">
            {/* Linha 1: Busca e Botões */}
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
              {/* Campo de busca geral */}
              <div className="flex-1 max-w-md">
                <input
                  type="text"
                  placeholder="🔍 Buscar por protocolo, pedido, liderança, município..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Botões de ação */}
              <div className="flex gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium shadow-md hover:shadow-lg flex items-center gap-2"
                  title="Imprimir (Ctrl+P)"
                >
                  🖨️ Imprimir
                </button>
                
                <button
                  onClick={() => openModal()}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-md hover:shadow-lg flex items-center gap-2 whitespace-nowrap"
                >
                  <span className="text-xl">+</span>
                  Adicionar Pedido
                </button>
              </div>
            </div>

            {/* Linha 2: Filtro por município */}
            <div className="flex gap-4 items-center">
              <label className="text-sm font-medium text-gray-700 whitespace-nowrap">
                Filtrar por município:
              </label>
              <input
                type="text"
                placeholder="Digite o nome do município..."
                value={filtroMunicipio}
                onChange={(e) => setFiltroMunicipio(e.target.value)}
                className="flex-1 max-w-sm px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
              {filtroMunicipio && (
                <button
                  onClick={() => setFiltroMunicipio('')}
                  className="text-sm text-gray-600 hover:text-gray-800 underline"
                >
                  Limpar
                </button>
              )}
            </div>
          </div>

          {/* Contador */}
          <div className="mt-4 text-sm text-gray-600">
            {pedidosFiltrados.length} {pedidosFiltrados.length === 1 ? 'pedido encontrado' : 'pedidos encontrados'}
            {(busca || filtroMunicipio) && pedidosFiltrados.length < pedidos.length && ` (de ${pedidos.length} total)`}
          </div>
        </div>

        {/* Mensagem de erro */}
        {erro && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-6">
            ⚠️ {erro}
          </div>
        )}

        {/* Tabela de pedidos */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          {pedidosFiltrados.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              {busca ? '🔍 Nenhum pedido encontrado com esses critérios' : '📋 Nenhum pedido cadastrado ainda'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
                  <tr>
                    <th className="px-6 py-4 text-left font-semibold">Município</th>
                    <th className="px-6 py-4 text-left font-semibold">Protocolo</th>
                    <th className="px-6 py-4 text-left font-semibold">Pedido</th>
                    <th className="px-6 py-4 text-left font-semibold">Liderança</th>
                    <th className="px-6 py-4 text-left font-semibold">Nº da Liderança</th>
                    <th className="px-6 py-4 text-left font-semibold">Descrição</th>
                    <th className="px-6 py-4 text-center font-semibold">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {pedidosFiltrados.map((pedido, index) => (
                    <tr
                      key={pedido.id}
                      className={`border-b border-gray-100 hover:bg-blue-50 transition-colors ${
                        index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                      }`}
                    >
                      <td className="px-6 py-4">
                        <span className="text-gray-900 font-medium">
                          {pedido.municipio_nome || '-'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {(() => {
                            const digits = toDigits(pedido.protocolo);
                            const isValid = digits && digits.length === 9;
                            
                            if (!isValid) {
                              return <span className="text-gray-400">—</span>;
                            }
                            
                            return (
                              <a
                                href={gerarLinkEProtocolo(pedido.protocolo)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-mono text-sm font-semibold text-blue-600 hover:text-blue-800 underline hover:no-underline cursor-pointer transition-colors flex items-center gap-1"
                                onClick={(e) => e.stopPropagation()}
                                aria-label="Consultar protocolo no e-Protocolo"
                                title={`Consultar protocolo ${pedido.protocolo} no e-Protocolo`}
                              >
                                <span className="text-xs">🔗</span>
                                {pedido.protocolo}
                              </a>
                            );
                          })()}
                          
                          {pedido.protocolo && toDigits(pedido.protocolo).length === 9 && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                copyProtocolo(pedido.protocolo);
                              }}
                              className="text-gray-400 hover:text-blue-600 transition-colors"
                              title="Copiar protocolo"
                            >
                              {copiedProtocolo === pedido.protocolo ? (
                                <span className="text-green-600">✓</span>
                              ) : (
                                <span>📋</span>
                              )}
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-gray-900 font-medium">{pedido.pedido_titulo || '-'}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-gray-700">{pedido.nome_lideranca || '-'}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-gray-700 font-mono">{pedido.numero_lideranca || '-'}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-gray-600 text-sm">
                          {pedido.descricao ? (
                            pedido.descricao.length > 50 
                              ? `${pedido.descricao.substring(0, 50)}...` 
                              : pedido.descricao
                          ) : (
                            <span className="text-gray-400 italic">Sem descrição</span>
                          )}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => openModal(pedido)}
                            className="px-3 py-1 bg-yellow-500 text-white rounded hover:bg-yellow-600 transition-colors text-sm font-medium"
                            title="Editar"
                          >
                            ✏️ Editar
                          </button>
                          <button
                            onClick={() => handleDelete(pedido.id, pedido.protocolo)}
                            className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 transition-colors text-sm font-medium"
                            title="Excluir"
                          >
                            🗑️ Excluir
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

      {/* Modal de criar/editar */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-4 flex items-center justify-between">
              <h2 className="text-2xl font-bold">
                {editingId ? '✏️ Editar Pedido' : '➕ Novo Pedido'}
              </h2>
              <button
                onClick={closeModal}
                className="text-white hover:text-gray-200 text-2xl"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Município */}
              <div className="relative municipio-dropdown-container">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Município <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={buscaMunicipio}
                  onChange={(e) => {
                    setBuscaMunicipio(e.target.value);
                    setShowMunicipiosDropdown(true);
                    if (!e.target.value) {
                      setMunicipioSelecionado(null);
                      setFormData({ ...formData, municipio_id: '', municipio_nome: '' });
                    }
                  }}
                  onFocus={() => {
                    setShowMunicipiosDropdown(true);
                    // Se não há busca, mostrar todos imediatamente
                    if (!buscaMunicipio) {
                      setBuscaMunicipio('');
                    }
                  }}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Digite para buscar... (ex: Curitiba, Londrina)"
                  autoComplete="off"
                />
                
                {/* Dropdown de municípios */}
                {showMunicipiosDropdown && (
                  <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {municipiosCarregando ? (
                      <div className="p-4 text-center text-gray-500">Carregando...</div>
                    ) : municipiosFiltrados.length === 0 ? (
                      <div className="p-4 text-center text-gray-500">Nenhum município encontrado</div>
                    ) : (
                      municipiosFiltrados.slice(0, 100).map((municipio) => (
                        <div
                          key={municipio.id}
                          onClick={() => handleSelectMunicipio(municipio)}
                          className="px-4 py-2 hover:bg-blue-50 cursor-pointer transition-colors border-b border-gray-100 last:border-b-0"
                        >
                          <span className="text-gray-900">{municipio.nome}</span>
                        </div>
                      ))
                    )}
                  </div>
                )}
                
                <p className="text-gray-500 text-xs mt-1">
                  {municipiosFiltrados.length} {municipiosFiltrados.length === 1 ? 'município' : 'municípios'}
                </p>
              </div>

              {/* Pedido */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Pedido <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="pedido_titulo"
                  value={formData.pedido_titulo}
                  onChange={handleInputChange}
                  required
                  maxLength={200}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Ex: Cascalho para estrada X"
                />
              </div>

              {/* Protocolo */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Protocolo <span className="text-gray-500 text-xs font-normal">(opcional)</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    name="protocolo"
                    value={formData.protocolo}
                    onChange={handleInputChange}
                    className={`flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono ${
                      protocoloError ? 'border-red-500' : 'border-gray-300'
                    }`}
                    style={{ whiteSpace: 'nowrap', minWidth: '200px' }}
                    placeholder="00.000.000-0"
                  />
                  
                  {/* Link para e-Protocolo */}
                  {formData.protocolo && gerarLinkEProtocolo(formData.protocolo) && (
                    <a
                      href={gerarLinkEProtocolo(formData.protocolo)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors text-sm font-medium whitespace-nowrap"
                      title="Consultar no e-Protocolo"
                    >
                      🔗 e-Protocolo
                    </a>
                  )}
                </div>
                
                {protocoloError && (
                  <p className="text-red-500 text-sm mt-1">⚠️ {protocoloError}</p>
                )}
                <p className="text-gray-500 text-xs mt-1">
                  Formato: 00.000.000-0 (exemplo: 24.298.238-6) - Campo opcional
                </p>
              </div>

              {/* Nome da Liderança */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Nome da Liderança <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="nome_lideranca"
                  value={formData.nome_lideranca}
                  onChange={handleInputChange}
                  required
                  maxLength={200}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Ex: Vereador João"
                />
              </div>

              {/* Número da Liderança */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Número da Liderança <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="numero_lideranca"
                  value={formData.numero_lideranca}
                  onChange={handleInputChange}
                  required
                  maxLength={100}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
                  placeholder="Ex: 41999887766 ou (41) 99988-7766"
                />
                <p className="text-gray-500 text-xs mt-1">
                  Somente números (aceita qualquer quantidade de dígitos)
                </p>
              </div>

              {/* Descrição */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Descrição do Pedido (opcional)
                </label>
                <textarea
                  name="descricao"
                  value={formData.descricao}
                  onChange={handleInputChange}
                  maxLength={2000}
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  placeholder="Descreva detalhes adicionais sobre o pedido..."
                />
                <p className="text-gray-500 text-xs mt-1">
                  {formData.descricao.length}/2000 caracteres
                </p>
              </div>

              {/* Botões */}
              <div className="flex gap-3 justify-end pt-4 border-t">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                  disabled={submitting}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={submitting || !!protocoloError}
                >
                  {submitting ? 'Salvando...' : editingId ? 'Atualizar' : 'Criar Pedido'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
