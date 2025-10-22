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

  // Continua na próxima parte...
