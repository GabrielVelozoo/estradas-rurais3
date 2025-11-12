// frontend/src/components/InformacoesGerais.js
import React, { useState, useEffect, useMemo } from 'react';
import { toast } from 'react-toastify';
import { useAuth } from '../contexts/AuthContext';
import MunicipioSelect from './MunicipioSelect';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import {
  BarChart, Bar, PieChart, Pie, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell
} from 'recharts';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';

// cores institucionais
const COLORS = {
  primary: '#0B3D91',
  accent: '#06B6D4',
  success: '#059669',
  warning: '#D97706',
  danger: '#DC2626',
  chart: ['#0B3D91', '#06B6D4', '#059669', '#D97706', '#DC2626', '#6366F1', '#EC4899', '#F59E0B']
};

// helpers de campos (tolerantes a variações do backend)
const getTitulo = (p) => p.Título ?? p.Titulo ?? p.titulo ?? '';
const getOrgao = (p) => p['Órgão'] ?? p.Orgao ?? p.orgao ?? 'Não informado';
const getSituacao = (p) => p['Situação'] ?? p.Situacao ?? p.situacao ?? 'Não informado';
const getTipo = (p) => p.Tipo ?? p.tipo ?? 'Não informado';
const getDataStr = (p) => p['Data de cadastro'] ?? p.data_cadastro ?? p.data_cadastro_br ?? '';
const getDataISO = (p) => p.data_cadastro_iso ?? p.dataISO ?? '';
const getProtocolo = (p) => p.Protocolo ?? p.protocolo ?? '';
const getVS = (p) => p.valor_solicitado_num ?? p.valorSolicitado ?? 0;
const getVL = (p) => p.valor_liberado_num ?? p.valorLiberado ?? 0;
const getVC = (p) => p.valor_contrapartida_num ?? p.valorContrapartida ?? 0;

const InformacoesGerais = () => {
  const { isAdmin } = useAuth();
  // compat: isAdmin pode ser boolean OU função
  const isAdminBool = typeof isAdmin === 'function' ? !!isAdmin() : !!isAdmin;

  // seleção de município
  const [selectedMunicipio, setSelectedMunicipio] = useState(null);

  // dados manuais
  const [municipioInfo, setMunicipioInfo] = useState(null);
  const [liderancas, setLiderancas] = useState([]);

  // pedidos do backend (já filtrados por município)
  const [pedidos, setPedidos] = useState([]);

  // informações do cache do backend
  const [cacheInfo, setCacheInfo] = useState(null);

  // estados
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // modais
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showLiderancaModal, setShowLiderancaModal] = useState(false);
  const [editingLideranca, setEditingLideranca] = useState(null);

  // forms
  const [infoForm, setInfoForm] = useState({
    prefeito_nome: '',
    prefeito_partido: '',
    prefeito_tel: '',
    vice_nome: '',
    vice_partido: '',
    vice_tel: '',
    votos_2014: '',
    votos_2018: '',
    votos_2022: ''
  });

  const [liderancaForm, setLiderancaForm] = useState({
    nome: '',
    cargo: '',
    telefone: ''
  });

  // filtros e paginação
  const [searchTerm, setSearchTerm] = useState('');
  const [orgaoFilter, setOrgaoFilter] = useState('');
  const [situacaoFilter, setSituacaoFilter] = useState('');
  const [tipoFilter, setTipoFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  // carrega dados quando selecionar município
  useEffect(() => {
    if (selectedMunicipio) {
      fetchMunicipioData();
    } else {
      setMunicipioInfo(null);
      setLiderancas([]);
      setPedidos([]);
      setCacheInfo(null);
    }
    // (removido comentário problemático do ESLint)
  }, [selectedMunicipio]); // OK: queremos recarregar sempre que trocar o município

  const fetchMunicipioData = async () => {
    if (!selectedMunicipio) return;
    setLoading(true);
    try {
      // info manual
      const infoRes = await fetch(
        `${BACKEND_URL}/api/municipio-info/${selectedMunicipio.id}`,
        { credentials: 'include' }
      );
      if (infoRes.ok) {
        const infoData = await infoRes.json();
        setMunicipioInfo(infoData);
        if (infoData) {
          setInfoForm({
            prefeito_nome: infoData.prefeito_nome || '',
            prefeito_partido: infoData.prefeito_partido || '',
            prefeito_tel: infoData.prefeito_tel || '',
            vice_nome: infoData.vice_nome || '',
            vice_partido: infoData.vice_partido || '',
            vice_tel: infoData.vice_tel || '',
            votos_2014: infoData.votos_2014 ?? '',
            votos_2018: infoData.votos_2018 ?? '',
            votos_2022: infoData.votos_2022 ?? ''
          });
        } else {
          // zera o form quando ainda não há registro
          setInfoForm({
            prefeito_nome: '',
            prefeito_partido: '',
            prefeito_tel: '',
            vice_nome: '',
            vice_partido: '',
            vice_tel: '',
            votos_2014: '',
            votos_2018: '',
            votos_2022: ''
          });
        }
      }

      // lideranças
      const liderancasRes = await fetch(
        `${BACKEND_URL}/api/municipio-liderancas/${selectedMunicipio.id}`,
        { credentials: 'include' }
      );
      if (liderancasRes.ok) {
        setLiderancas(await liderancasRes.json());
      }

      // pedidos (CSV via backend)
      const pedidosRes = await fetch(
        `${BACKEND_URL}/api/pedidos?municipio=${encodeURIComponent(selectedMunicipio.nome)}`,
        { credentials: 'include' }
      );
      if (pedidosRes.ok) {
        const pedidosData = await pedidosRes.json();
        setPedidos(Array.isArray(pedidosData) ? pedidosData : []);
      }

      // cache info
      const cacheRes = await fetch(`${BACKEND_URL}/api/pedidos/cache-info`, {
        credentials: 'include'
      });
      if (cacheRes.ok) {
        setCacheInfo(await cacheRes.json());
      }
    } catch (e) {
      console.error(e);
      toast.error('Erro ao carregar dados do município');
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshCSV = async () => {
    setRefreshing(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/pedidos/refresh`, {
        method: 'POST',
        credentials: 'include'
      });
      if (res.ok) {
        toast.success('Dados atualizados com sucesso!');
        await fetchMunicipioData();
      } else {
        toast.error('Erro ao atualizar dados');
      }
    } catch (e) {
      console.error(e);
      toast.error('Erro ao atualizar dados');
    } finally {
      setRefreshing(false);
    }
  };

  // SALVAR INFO (sempre via upsert)
  const handleSaveInfo = async () => {
    if (!selectedMunicipio) return;

    const payload = {
      ...infoForm,
      municipio_id: selectedMunicipio.id,
      votos_2014: infoForm.votos_2014 !== '' ? parseInt(infoForm.votos_2014, 10) : null,
      votos_2018: infoForm.votos_2018 !== '' ? parseInt(infoForm.votos_2018, 10) : null,
      votos_2022: infoForm.votos_2022 !== '' ? parseInt(infoForm.votos_2022, 10) : null
    };

    try {
      const res = await fetch(`${BACKEND_URL}/api/municipio-info/upsert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        let msg = 'Erro ao salvar informações';
        try { const j = await res.json(); msg = j.detail || msg; } catch {}
        toast.error(msg);
        return;
      }

      toast.success('Informações salvas com sucesso!');
      setShowInfoModal(false);
      fetchMunicipioData();
    } catch (e) {
      console.error(e);
      toast.error('Erro ao salvar informações');
    }
  };

  const handleSaveLideranca = async () => {
    if (!selectedMunicipio) return;
    const method = editingLideranca ? 'PUT' : 'POST';
    const url = editingLideranca
      ? `${BACKEND_URL}/api/municipio-liderancas/${editingLideranca.id}`
      : `${BACKEND_URL}/api/municipio-liderancas`;

    const payload = { ...liderancaForm, municipio_id: selectedMunicipio.id };

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        toast.success('Liderança salva com sucesso!');
        setShowLiderancaModal(false);
        setEditingLideranca(null);
        setLiderancaForm({ nome: '', cargo: '', telefone: '' });
        fetchMunicipioData();
      } else {
        let msg = 'Erro ao salvar liderança';
        try { const j = await res.json(); msg = j.detail || msg; } catch {}
        toast.error(msg);
      }
    } catch (e) {
      console.error(e);
      toast.error('Erro ao salvar liderança');
    }
  };

  const handleDeleteLideranca = async (id) => {
    if (!window.confirm('Tem certeza que deseja excluir esta liderança?')) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/municipio-liderancas/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (res.ok) {
        toast.success('Liderança excluída com sucesso!');
        fetchMunicipioData();
      } else {
        toast.error('Erro ao excluir liderança');
      }
    } catch (e) {
      console.error(e);
      toast.error('Erro ao excluir liderança');
    }
  };

  // KPIs (usando getters tolerantes)
  const kpis = useMemo(() => ({
    total: pedidos.length,
    valorSolicitado: pedidos.reduce((s, p) => s + (getVS(p) || 0), 0),
    valorLiberado: pedidos.reduce((s, p) => s + (getVL(p) || 0), 0),
    valorContrapartida: pedidos.reduce((s, p) => s + (getVC(p) || 0), 0)
  }), [pedidos]);

  // dados para gráficos
  const chartDataOrgao = useMemo(() => {
    const g = {};
    pedidos.forEach(p => { g[getOrgao(p)] = (g[getOrgao(p)] || 0) + 1; });
    return Object.entries(g).map(([name, value]) => ({ name, value }))
      .sort((a,b) => b.value - a.value).slice(0, 10);
  }, [pedidos]);

  const chartDataSituacao = useMemo(() => {
    const g = {};
    pedidos.forEach(p => { g[getSituacao(p)] = (g[getSituacao(p)] || 0) + 1; });
    return Object.entries(g).map(([name, value]) => ({ name, value }));
  }, [pedidos]);

  const chartDataTipo = useMemo(() => {
    const g = {};
    pedidos.forEach(p => { g[getTipo(p)] = (g[getTipo(p)] || 0) + 1; });
    return Object.entries(g).map(([name, value]) => ({ name, value }))
      .sort((a,b) => b.value - a.value);
  }, [pedidos]);

  const chartDataEvolucao = useMemo(() => {
    const g = {};
    pedidos.forEach(p => {
      const iso = getDataISO(p);
      if (iso) {
        const ym = iso.substring(0,7);
        g[ym] = (g[ym] || 0) + 1;
      }
    });
    return Object.entries(g).map(([date, count]) => ({ date, count }))
      .sort((a,b) => a.date.localeCompare(b.date));
  }, [pedidos]);

  const chartDataVotos = useMemo(() => {
    if (!municipioInfo) return [];
    return [
      { ano: '2014', votos: municipioInfo.votos_2014 || 0 },
      { ano: '2018', votos: municipioInfo.votos_2018 || 0 },
      { ano: '2022', votos: municipioioInfo?.votos_2022 || 0 } // segurança caso campo não exista
    ];
  }, [municipioInfo]);

  // filtros e paginação
  const filteredPedidos = useMemo(() => {
    const term = (searchTerm || '').toLowerCase();
    return pedidos.filter(p => {
      const matchSearch = !term || Object.values(p).some(v => String(v ?? '').toLowerCase().includes(term));
      const matchOrgao = !orgaoFilter || getOrgao(p) === orgaoFilter;
      const matchSituacao = !situacaoFilter || getSituacao(p) === situacaoFilter;
      const matchTipo = !tipoFilter || getTipo(p) === tipoFilter;
      return matchSearch && matchOrgao && matchSituacao && matchTipo;
    });
  }, [pedidos, searchTerm, orgaoFilter, situacaoFilter, tipoFilter]);

  const paginatedPedidos = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredPedidos.slice(start, start + itemsPerPage);
  }, [filteredPedidos, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredPedidos.length / itemsPerPage) || 1;

  // exportações
  const handleExportCSV = () => {
    const rows = filteredPedidos.map(p => ({
      Protocolo: getProtocolo(p),
      Título: getTitulo(p),
      Órgão: getOrgao(p),
      Situação: getSituacao(p),
      'Data de cadastro': getDataStr(p),
      'Valor Solicitado': getVS(p),
      'Valor Liberado': getVL(p),
      'Valor Contrapartida': getVC(p),
      Tipo: getTipo(p)
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Pedidos');
    XLSX.writeFile(wb, `pedidos_${selectedMunicipio?.nome || 'municipio'}.xlsx`);
    toast.success('Planilha exportada com sucesso!');
  };

  const handleExportPDF = async () => {
    const element = document.getElementById('panel-content');
    if (!element) return;
    toast.info('Gerando PDF... Aguarde.');
    try {
      const canvas = await html2canvas(element, { scale: 2, useCORS: true, logging: false });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`painel_${selectedMunicipio?.nome || 'municipio'}.pdf`);
      toast.success('PDF gerado com sucesso!');
    } catch (e) {
      console.error(e);
      toast.error('Erro ao gerar PDF');
    }
  };

  // valores únicos para filtros
  const uniqueOrgaos = useMemo(
    () => [...new Set(pedidos.map(getOrgao).filter(Boolean))],
    [pedidos]
  );
  const uniqueSituacoes = useMemo(
    () => [...new Set(pedidos.map(getSituacao).filter(Boolean))],
    [pedidos]
  );
  const uniqueTipos = useMemo(
    () => [...new Set(pedidos.map(getTipo).filter(Boolean))],
    [pedidos]
  );

  const formatCurrency = (v) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Informações Gerais</h1>

          <div className="bg-white rounded-lg shadow-md p-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Selecione o Município
            </label>
            <MunicipioSelect
              value={selectedMunicipio}
              onChange={setSelectedMunicipio}
              placeholder="Digite o nome do município..."
            />

            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-gray-600">
              <span>Pedidos carregados (município): <b>{pedidos.length}</b></span>
              {cacheInfo?.total_rows != null && (
                <span>• Linhas totais do CSV: <b>{cacheInfo.total_rows}</b></span>
              )}
              {isAdminBool && (
                <button
                  onClick={handleRefreshCSV}
                  disabled={refreshing}
                  className="ml-auto px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {refreshing ? '🔄 Atualizando...' : '🔄 Recarregar CSV Agora'}
                </button>
              )}
              {cacheInfo?.cache_age_seconds != null && (
                <span className="text-gray-500">
                  Cache: {Math.floor(cacheInfo.cache_age_seconds / 60)} min
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        {selectedMunicipio ? (
          <div id="panel-content" className="space-y-8">
            {loading ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                <p className="mt-4 text-gray-600">Carregando dados...</p>
              </div>
            ) : (
              <>
                {/* Manual Data */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white rounded-lg shadow-md p-6">
                    <div className="flex justify-between items-start mb-4">
                      <h3 className="text-lg font-semibold text-gray-900">Prefeito</h3>
                      {isAdminBool && (
                        <button onClick={() => setShowInfoModal(true)} className="text-blue-600 hover:text-blue-700 text-sm">
                          ✏️ Editar
                        </button>
                      )}
                    </div>
                    {municipioInfo ? (
                      <div className="space-y-2 text-gray-700">
                        <p><strong>Nome:</strong> {municipioInfo.prefeito_nome || 'Não informado'}</p>
                        <p><strong>Partido:</strong> {municipioInfo.prefeito_partido || 'Não informado'}</p>
                        {municipioInfo.prefeito_tel && (
                          <p><strong>Telefone:</strong> <a href={`tel:${municipioInfo.prefeito_tel}`} className="text-blue-600 hover:underline">{municipioInfo.prefeito_tel}</a></p>
                        )}
                      </div>
                    ) : <p className="text-gray-500">Nenhuma informação cadastrada</p>}
                  </div>

                  <div className="bg-white rounded-lg shadow-md p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Vice-Prefeito</h3>
                    {municipioInfo ? (
                      <div className="space-y-2 text-gray-700">
                        <p><strong>Nome:</strong> {municipioInfo.vice_nome || 'Não informado'}</p>
                        <p><strong>Partido:</strong> {municipioInfo.vice_partido || 'Não informado'}</p>
                        {municipioInfo.vice_tel && (
                          <p><strong>Telefone:</strong> <a href={`tel:${municipioInfo.vice_tel}`} className="text-blue-600 hover:underline">{municipioInfo.vice_tel}</a></p>
                        )}
                      </div>
                    ) : <p className="text-gray-500">Nenhuma informação cadastrada</p>}
                  </div>
                </div>

                {/* KPIs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="bg-white rounded-lg shadow-md p-6">
                    <h4 className="text-sm font-medium text-gray-600 mb-2">Total de Pedidos</h4>
                    <p className="text-3xl font-bold text-blue-600">{kpis.total}</p>
                  </div>
                  <div className="bg-white rounded-lg shadow-md p-6">
                    <h4 className="text-sm font-medium text-gray-600 mb-2">Valor Solicitado</h4>
                    <p className="text-2xl font-bold text-gray-900">{formatCurrency(kpis.valorSolicitado)}</p>
                  </div>
                  <div className="bg-white rounded-lg shadow-md p-6">
                    <h4 className="text-sm font-medium text-gray-600 mb-2">Valor Liberado</h4>
                    <p className="text-2xl font-bold text-green-600">{formatCurrency(kpis.valorLiberado)}</p>
                  </div>
                  <div className="bg-white rounded-lg shadow-md p-6">
                    <h4 className="text-sm font-medium text-gray-600 mb-2">Valor Contrapartida</h4>
                    <p className="text-2xl font-bold text-orange-600">{formatCurrency(kpis.valorContrapartida)}</p>
                  </div>
                </div>

                {/* Charts */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-white rounded-lg shadow-md p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Pedidos por Órgão</h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={chartDataOrgao}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                        <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} fontSize={12} />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="value" fill={COLORS.primary} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="bg-white rounded-lg shadow-md p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Pedidos por Situação</h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie data={chartDataSituacao} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                          {chartDataSituacao.map((_, i) => (
                            <Cell key={i} fill={COLORS.chart[i % COLORS.chart.length]} />
                          ))}
                        </Pie>
                        <Tooltip /><Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="bg-white rounded-lg shadow-md p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Pedidos por Tipo</h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={chartDataTipo}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                        <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} fontSize={12} />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="value" fill={COLORS.accent} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="bg-white rounded-lg shadow-md p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Evolução por Data</h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={chartDataEvolucao}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                        <XAxis dataKey="date" fontSize={12} />
                        <YAxis /><Tooltip /><Legend />
                        <Line type="monotone" dataKey="count" stroke={COLORS.success} strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Votos */}
                {municipioInfo && (municipioInfo.votos_2014 || municipioInfo.votos_2018 || municipioInfo.votos_2022) && (
                  <div className="bg-white rounded-lg shadow-md p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Evolução de Votos</h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={[
                        { ano: '2014', votos: municipioInfo.votos_2014 || 0 },
                        { ano: '2018', votos: municipioInfo.votos_2018 || 0 },
                        { ano: '2022', votos: municipioInfo.votos_2022 || 0 },
                      ]}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                        <XAxis dataKey="ano" /><YAxis /><Tooltip /><Legend />
                        <Bar dataKey="votos" fill={COLORS.warning} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Lideranças */}
                <div className="bg-white rounded-lg shadow-md p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">Lideranças Locais</h3>
                    {isAdminBool && (
                      <button
                        onClick={() => { setEditingLideranca(null); setLiderancaForm({ nome:'', cargo:'', telefone:'' }); setShowLiderancaModal(true); }}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                      >
                        ➕ Adicionar Liderança
                      </button>
                    )}
                  </div>

                  {liderancas.length ? (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nome</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cargo</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Telefone</th>
                            {isAdminBool && <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ações</th>}
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {liderancas.map(l => (
                            <tr key={l.id}>
                              <td className="px-6 py-4 text-sm text-gray-900">{l.nome}</td>
                              <td className="px-6 py-4 text-sm text-gray-900">{l.cargo}</td>
                              <td className="px-6 py-4 text-sm text-gray-900">
                                {l.telefone ? <a href={`tel:${l.telefone}`} className="text-blue-600 hover:underline">{l.telefone}</a> : 'Não informado'}
                              </td>
                              {isAdminBool && (
                                <td className="px-6 py-4 text-sm space-x-2">
                                  <button
                                    onClick={() => { setEditingLideranca(l); setLiderancaForm({ nome:l.nome, cargo:l.cargo, telefone:l.telefone||'' }); setShowLiderancaModal(true); }}
                                    className="text-blue-600 hover:text-blue-700"
                                  >✏️ Editar</button>
                                  <button onClick={() => handleDeleteLideranca(l.id)} className="text-red-600 hover:text-red-700">🗑️ Excluir</button>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : <p className="text-gray-500">Nenhuma liderança cadastrada</p>}
                </div>

                {/* Pedidos */}
                <div className="bg-white rounded-lg shadow-md p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">Pedidos do Município</h3>
                    <div className="flex gap-2">
                      <button onClick={handleExportCSV} className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700">📤 Exportar CSV</button>
                      <button onClick={handleExportPDF} className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700">🧾 Exportar PDF</button>
                    </div>
                  </div>

                  {/* filtros */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                    <input type="text" placeholder="Buscar..." value={searchTerm} onChange={(e)=>setSearchTerm(e.target.value)} className="px-4 py-2 border border-gray-300 rounded-md" />
                    <select value={orgaoFilter} onChange={(e)=>setOrgaoFilter(e.target.value)} className="px-4 py-2 border border-gray-300 rounded-md">
                      <option value="">Todos os Órgãos</option>
                      {uniqueOrgaos.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                    <select value={situacaoFilter} onChange={(e)=>setSituacaoFilter(e.target.value)} className="px-4 py-2 border border-gray-300 rounded-md">
                      <option value="">Todas as Situações</option>
                      {uniqueSituacoes.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <select value={tipoFilter} onChange={(e)=>setTipoFilter(e.target.value)} className="px-4 py-2 border border-gray-300 rounded-md">
                      <option value="">Todos os Tipos</option>
                      {uniqueTipos.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Protocolo</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Título</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Órgão</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Situação</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Val. Solicitado</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Val. Liberado</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Val. Contrapartida</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {paginatedPedidos.map((p, idx) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm text-gray-900">{getProtocolo(p)}</td>
                            <td className="px-4 py-3 text-sm text-gray-900">{getTitulo(p)}</td>
                            <td className="px-4 py-3 text-sm text-gray-900">{getOrgao(p)}</td>
                            <td className="px-4 py-3 text-sm">
                              <span className={`px-2 py-1 rounded-full text-xs ${
                                getSituacao(p).toLowerCase().includes('aprov') ? 'bg-green-100 text-green-800' :
                                getSituacao(p).toLowerCase().includes('pend') ? 'bg-yellow-100 text-yellow-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {getSituacao(p)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900">{getDataStr(p)}</td>
                            <td className="px-4 py-3 text-sm text-gray-900">{formatCurrency(getVS(p))}</td>
                            <td className="px-4 py-3 text-sm text-gray-900">{formatCurrency(getVL(p))}</td>
                            <td className="px-4 py-3 text-sm text-gray-900">{formatCurrency(getVC(p))}</td>
                            <td className="px-4 py-3 text-sm text-gray-900">{getTipo(p)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-gray-100 font-semibold">
                        <tr>
                          <td colSpan="5" className="px-4 py-3 text-sm text-right">Totais:</td>
                          <td className="px-4 py-3 text-sm">{formatCurrency(filteredPedidos.reduce((s,p)=>s+(getVS(p)||0),0))}</td>
                          <td className="px-4 py-3 text-sm">{formatCurrency(filteredPedidos.reduce((s,p)=>s+(getVL(p)||0),0))}</td>
                          <td className="px-4 py-3 text-sm">{formatCurrency(filteredPedidos.reduce((s,p)=>s+(getVC(p)||0),0))}</td>
                          <td />
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {/* paginação */}
                  <div className="mt-4 flex justify-between items-center">
                    <div className="flex gap-2 items-center">
                      <span className="text-sm text-gray-600">Itens por página:</span>
                      <select
                        value={itemsPerPage}
                        onChange={(e)=>{ setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                        className="px-2 py-1 border border-gray-300 rounded-md"
                      >
                        <option value="25">25</option>
                        <option value="50">50</option>
                        <option value="100">100</option>
                      </select>
                      <span className="text-sm text-gray-600 ml-4">
                        Mostrando {((currentPage-1)*itemsPerPage)+1} a {Math.min(currentPage*itemsPerPage, filteredPedidos.length)} de {filteredPedidos.length}
                      </span>
                    </div>

                    <div className="flex gap-2">
                      <button onClick={()=>setCurrentPage(p=>Math.max(1,p-1))} disabled={currentPage===1} className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50">Anterior</button>
                      <span className="px-4 py-2 text-sm text-gray-600">Página {currentPage} de {totalPages}</span>
                      <button onClick={()=>setCurrentPage(p=>Math.min(totalPages,p+1))} disabled={currentPage===totalPages} className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50">Próxima</button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500">
            <p className="text-lg">Selecione um município para visualizar as informações</p>
          </div>
        )}
      </div>

      {/* Modal: Editar Informações do Município */}
      {showInfoModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <h2 className="text-2xl font-bold mb-4">Editar Informações do Município</h2>

            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Prefeito</h3>
                <input type="text" placeholder="Nome" value={infoForm.prefeito_nome} onChange={(e)=>setInfoForm({...infoForm, prefeito_nome:e.target.value})} className="w-full px-4 py-2 border border-gray-300 rounded-md mb-2" />
                <input type="text" placeholder="Partido" value={infoForm.prefeito_partido} onChange={(e)=>setInfoForm({...infoForm, prefeito_partido:e.target.value})} className="w-full px-4 py-2 border border-gray-300 rounded-md mb-2" />
                <input type="text" placeholder="Telefone" value={infoForm.prefeito_tel} onChange={(e)=>setInfoForm({...infoForm, prefeito_tel:e.target.value})} className="w-full px-4 py-2 border border-gray-300 rounded-md" />
              </div>

              <div>
                <h3 className="font-semibold mb-2">Vice-Prefeito</h3>
                <input type="text" placeholder="Nome" value={infoForm.vice_nome} onChange={(e)=>setInfoForm({...infoForm, vice_nome:e.target.value})} className="w-full px-4 py-2 border border-gray-300 rounded-md mb-2" />
                <input type="text" placeholder="Partido" value={infoForm.vice_partido} onChange={(e)=>setInfoForm({...infoForm, vice_partido:e.target.value})} className="w-full px-4 py-2 border border-gray-300 rounded-md mb-2" />
                <input type="text" placeholder="Telefone" value={infoForm.vice_tel} onChange={(e)=>setInfoForm({...infoForm, vice_tel:e.target.value})} className="w-full px-4 py-2 border border-gray-300 rounded-md" />
              </div>

              <div>
                <h3 className="font-semibold mb-2">Votos</h3>
                <div className="grid grid-cols-3 gap-2">
                  <input type="number" placeholder="2014" value={infoForm.votos_2014} onChange={(e)=>setInfoForm({...infoForm, votos_2014:e.target.value})} className="px-4 py-2 border border-gray-300 rounded-md" />
                  <input type="number" placeholder="2018" value={infoForm.votos_2018} onChange={(e)=>setInfoForm({...infoForm, votos_2018:e.target.value})} className="px-4 py-2 border border-gray-300 rounded-md" />
                  <input type="number" placeholder="2022" value={infoForm.votos_2022} onChange={(e)=>setInfoForm({...infoForm, votos_2022:e.target.value})} className="px-4 py-2 border border-gray-300 rounded-md" />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button onClick={()=>setShowInfoModal(false)} className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50">Cancelar</button>
              <button onClick={handleSaveInfo} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">Salvar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Liderança */}
      {showLiderancaModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h2 className="text-2xl font-bold mb-4">{editingLideranca ? 'Editar Liderança' : 'Adicionar Liderança'}</h2>

            <div className="space-y-4">
              <input type="text" placeholder="Nome" value={liderancaForm.nome} onChange={(e)=>setLiderancaForm({...liderancaForm, nome:e.target.value})} className="w-full px-4 py-2 border border-gray-300 rounded-md" />
              <input type="text" placeholder="Cargo" value={liderancaForm.cargo} onChange={(e)=>setLiderancaForm({...liderancaForm, cargo:e.target.value})} className="w-full px-4 py-2 border border-gray-300 rounded-md" />
              <input type="text" placeholder="Telefone" value={liderancaForm.telefone} onChange={(e)=>setLiderancaForm({...liderancaForm, telefone:e.target.value})} className="w-full px-4 py-2 border border-gray-300 rounded-md" />
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => { setShowLiderancaModal(false); setEditingLideranca(null); setLiderancaForm({ nome:'', cargo:'', telefone:'' }); }}
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
              >Cancelar</button>
              <button onClick={handleSaveLideranca} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InformacoesGerais;
