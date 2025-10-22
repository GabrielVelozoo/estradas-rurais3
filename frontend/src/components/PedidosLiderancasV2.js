import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import PrintHeader from './PrintHeader';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

// Status disponíveis
const STATUS_OPTIONS = [
  { value: 'em_andamento', label: 'Em andamento' },
  { value: 'aguardando_atendimento', label: 'Aguardando atendimento' },
  { value: 'arquivado', label: 'Arquivado' },
  { value: 'atendido', label: 'Atendido' },
];

export default function PedidosLiderancasV2() {
  // Estados principais
  const [pedidos, setPedidos] = useState([]);
  const [municipios, setMunicipios] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);
  
  // Estados de filtros
  const [buscaGeral, setBuscaGeral] = useState('');
  const [filtroMunicipio, setFiltroMunicipio] = useState('');
  const [filtroLideranca, setFiltroLideranca] = useState('');
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
    titulo: '',
    protocolo: '',
    lideranca_telefone: '',
    descricao: '',
    status: ''
  });

  // Função para normalizar texto (remover acentos)
  const normalizeText = (text) => {
    if (!text) return '';
    return text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  };

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

  // Carregar pedidos
  const fetchPedidos = async () => {
    setCarregando(true);
    setErro(null);
    try {
      const response = await fetch(`${BACKEND_URL}/api/liderancas`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.status === 401) {
        setErro('Sessão expirada. Por favor, faça login novamente.');
        setTimeout(() => window.location.href = '/', 2000);
        return;
      }

      if (!response.ok) {
        throw new Error(`Erro ao carregar pedidos (status ${response.status})`);
      }

      const data = await response.json();
      
      if (!Array.isArray(data)) {
        throw new Error('Formato de dados inválido');
      }

      setPedidos(data);
    } catch (error) {
      console.error('Erro ao carregar pedidos:', error);
      setErro(error.message);
    } finally {
      setCarregando(false);
    }
  };

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
    fetchMunicipios();
  }, []);

  // Filtrar pedidos (acento-insensível)
  const pedidosFiltrados = useMemo(() => {
    try {
      if (!Array.isArray(pedidos)) return [];

      return pedidos.filter(pedido => {
        if (!pedido || typeof pedido !== 'object') return false;

        // Busca geral
        if (buscaGeral) {
          const buscaNorm = normalizeText(buscaGeral);
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
  }, [pedidos, buscaGeral, filtroMunicipio, filtroLideranca, filtroStatus]);

  // Abrir modal
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

      const response = await fetch(url, {
        method,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail?.error || errorData.detail || 'Erro ao salvar');
      }

      await fetchPedidos();
      closeModal();
      alert(editingId ? 'Pedido atualizado com sucesso!' : 'Pedido criado com sucesso!');
    } catch (error) {
      console.error('Erro ao salvar:', error);
      alert(error.message);
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

  // Continua com o JSX...
