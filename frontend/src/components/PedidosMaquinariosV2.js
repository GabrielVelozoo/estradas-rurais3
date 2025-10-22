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

export default function PedidosMaquinariosV2() {
  // Estados principais
  const [pedidos, setPedidos] = useState([]);
  const [municipios, setMunicipios] = useState([]);
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

  // Carregar pedidos
  const fetchPedidos = async () => {
    setCarregando(true);
    setErro(null);
    try {
      const response = await fetch(`${BACKEND_URL}/api/pedidos-maquinarios`, {
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
    fetchCatalogo();
    fetchPedidos();
    fetchMunicipios();
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

  // Continua com JSX...
