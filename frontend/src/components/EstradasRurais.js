import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useDataCache } from '../contexts/DataCacheContext';

const SHEET_ID = process.env.REACT_APP_SHEET_ID;
const API_KEY = process.env.REACT_APP_SHEETS_API_KEY;

// Componente para linha da tabela com descrição expansível
const TabelaLinha = ({ r, i }) => {
  // Função para formatar data de última edição
  const formatUltimaEdicao = (dateString) => {
    if (!dateString || dateString === '') return null;
    
    try {
      let date;
      
      // Se for número (serial date do Excel), converter
      if (!isNaN(dateString) && dateString.toString().length <= 10) {
        const excelEpoch = new Date(1899, 11, 30);
        date = new Date(excelEpoch.getTime() + parseFloat(dateString) * 24 * 60 * 60 * 1000);
      } else {
        date = new Date(dateString);
      }
      
      if (isNaN(date.getTime())) return null;
      
      // Formatar no fuso America/Sao_Paulo
      const formatter = new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
      
      return formatter.format(date);
    } catch (error) {
      return null;
    }
  };
  
  // Função para determinar a cor e ícone da secretaria
  const getSecretariaStyle = (secretaria) => {
    switch(secretaria) {
      case 'SEAB':
        return {
          bg: 'bg-green-100',
          text: 'text-green-800', 
          border: 'border-green-300',
          icon: '🌱',
          label: 'SEAB'
        };
      case 'SECID':
        return {
          bg: 'bg-blue-100',
          text: 'text-blue-800',
          border: 'border-blue-300', 
          icon: '🏙️',
          label: 'SECID'
        };
      default:
        return {
          bg: 'bg-gray-100',
          text: 'text-gray-600',
          border: 'border-gray-300',
          icon: '❓',
          label: secretaria || 'N/A'
        };
    }
  };

  // Função para gerar link do eProtocolo
  const gerarLinkEProtocolo = (protocolo) => {
    if (!protocolo) return null;
    
    // Remover todos os caracteres não-numéricos
    const protocoloLimpo = protocolo.replace(/\D/g, '');
    
    // Se não tem dígitos suficientes, não criar link
    if (protocoloLimpo.length < 6) return null;
    
    // URL do eProtocolo
    const baseUrl = "https://www.eprotocolo.pr.gov.br/spiweb/consultarProtocoloDigital.do";
    const url = `${baseUrl}?action=pesquisar&numeroProtocolo=${protocoloLimpo}`;
    
    return url;
  };

  const secretariaStyle = getSecretariaStyle(r.secretaria);
  const linkEProtocolo = gerarLinkEProtocolo(r.protocolo);
  
  return (
    <tr className={`transition-colors border-b border-gray-100 ${
      r.isPrioridade 
        ? 'bg-red-50 hover:bg-red-100 border-l-4 border-l-red-500' 
        : 'hover:bg-blue-50'
    }`}>
      <td className="px-4 py-3 align-top">
        <div className="flex items-center gap-2">
          <div className="font-semibold text-gray-900 text-sm break-words">
            {r.municipio}
          </div>
          {r.isPrioridade && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-red-600 text-white animate-pulse">
              PRIORIDADE
            </span>
          )}
        </div>
      </td>
      <td className="px-3 py-3 align-top">
        <div className="font-mono text-xs whitespace-nowrap">
          {linkEProtocolo ? (
            <a
              href={linkEProtocolo}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 hover:underline transition-colors cursor-pointer flex items-center gap-1"
              title={`Abrir protocolo ${r.protocolo} no eProtocolo`}
            >
              <span className="text-xs">🔗</span>
              {r.protocolo}
            </a>
          ) : (
            <span className="text-gray-700">{r.protocolo}</span>
          )}
        </div>
      </td>
      <td className="px-3 py-3 align-top">
        <div className="flex justify-center">
          <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold border ${secretariaStyle.bg} ${secretariaStyle.text} ${secretariaStyle.border}`}>
            <span className="text-sm">{secretariaStyle.icon}</span>
            {secretariaStyle.label}
          </span>
        </div>
      </td>
      <td className="px-4 py-3 align-top">
        <div className="space-y-2">
          {r.nomeEstrada && (
            <div className={`font-medium text-sm ${
              r.isPrioridade ? 'text-red-900' : 'text-gray-900'
            }`}>
              🛣️ {r.nomeEstrada}
            </div>
          )}
          {r.estado && (
            <div className="text-gray-600 text-sm">
              {r.estado}
            </div>
          )}
          {/* ✅ Última edição */}
          {r.ultimaEdicao && formatUltimaEdicao(r.ultimaEdicao) && (
            <div className="text-xs text-blue-600 font-medium flex items-center gap-1 mt-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Última edição: {formatUltimaEdicao(r.ultimaEdicao)}
            </div>
          )}
        </div>
      </td>
      <td className="px-4 py-3 text-right align-top">
        <div className={`font-bold text-sm whitespace-nowrap ${
          r.isPrioridade ? 'text-red-600' : 'text-green-600'
        }`}>
          {r.valor}
        </div>
      </td>
    </tr>
  );
};

export default function EstradasRurais() {
  // Hook de cache
  const { fetchWithCache, clearCache } = useDataCache();
  
  // Função para normalizar texto (remover acentos)
  const normalizeText = (text) => {
    if (!text) return '';
    return text
      .normalize('NFD') // Decomposição Unicode
      .replace(/[\u0300-\u036f]/g, '') // Remove diacríticos
      .toLowerCase()
      .trim();
  };
  
  // Função para formatar data de última edição no fuso America/Sao_Paulo
  const formatUltimaEdicao = (dateString) => {
    if (!dateString || dateString === '') return null;
    
    try {
      // Tentar parsear a data do Google Sheets
      // Pode vir como "dd/MM/yyyy HH:mm:ss" ou timestamp
      let date;
      
      // Se for número (serial date do Excel), converter
      if (!isNaN(dateString) && dateString.toString().length <= 10) {
        // Serial date do Excel (dias desde 1899-12-30)
        const excelEpoch = new Date(1899, 11, 30);
        date = new Date(excelEpoch.getTime() + parseFloat(dateString) * 24 * 60 * 60 * 1000);
      } else {
        // Tentar como string de data
        date = new Date(dateString);
      }
      
      // Verificar se a data é válida
      if (isNaN(date.getTime())) return null;
      
      // Formatar no fuso America/Sao_Paulo
      const formatter = new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
      
      return formatter.format(date);
    } catch (error) {
      console.warn('Erro ao formatar data:', dateString, error);
      return null;
    }
  };

  // Funções para máscara de protocolo
  const formatProtocolo = (value) => {
    // Remove todos os caracteres não numéricos
    const numbers = value.replace(/\D/g, '');
    
    // Limita a 9 dígitos
    const limitedNumbers = numbers.slice(0, 9);
    
    // Aplica a máscara XX.XXX.XXX-X
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

  const extractNumbers = (protocolo) => {
    return protocolo.replace(/\D/g, '');
  };

  const validateProtocolo = (protocolo) => {
    const numbers = extractNumbers(protocolo);
    if (numbers.length === 0) {
      return { valid: true, error: "" }; // Campo vazio é válido
    }
    if (numbers.length < 9) {
      return { valid: false, error: `Protocolo incompleto (${numbers.length}/9 dígitos)` };
    }
    if (numbers.length > 9) {
      return { valid: false, error: `Protocolo muito longo (${numbers.length}/9 dígitos)` };
    }
    return { valid: true, error: "" };
  };

  const handleProtocoloChange = (e) => {
    const inputValue = e.target.value;
    const formatted = formatProtocolo(inputValue);
    const validation = validateProtocolo(formatted);
    
    setFiltroProtocolo(formatted);
    setProtocoloError(validation.error);
    setPage(1); // Resetar página quando filtro muda
  };

  // Estados principais
  const [dados, setDados] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);
  const [busca, setBusca] = useState("");
  const [buscaEstrada, setBuscaEstrada] = useState("");
  const [filtroProtocolo, setFiltroProtocolo] = useState("");
  const [protocoloError, setProtocoloError] = useState("");
  const [apensPrioridades, setApenasPrioridades] = useState(false);
  const [filtroSecretaria, setFiltroSecretaria] = useState(""); // "SEAB", "SECID", ou "" (todos)
  const [sortBy, setSortBy] = useState("municipio");
  const [sortDir, setSortDir] = useState("asc");
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);
  const [autoRefresh, setAutoRefresh] = useState(true); // ✅ Ativado por padrão
  const [refreshIntervalSeconds, setRefreshIntervalSeconds] = useState(30); // ✅ 30s para capturar mudanças da planilha
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState(null); // ✅ Timestamp da última atualização
  const intervalRef = useRef(null);

  const fetchData = useCallback(async (forceFresh = false) => {
    setCarregando(true);
    setErro(null);
    
    try {
      const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
      
      // Usar cache para dados do Google Sheets (slow operation)
      const data = await fetchWithCache(
        'estradas-rurais',
        async (signal) => {
          const res = await fetch(`${BACKEND_URL}/api/estradas-rurais`, { signal });
          if (!res.ok) throw new Error(`Erro na requisição: ${res.status} ${res.statusText}`);
          return await res.json();
        },
        { 
          forceFresh,
          ttl: 3 * 60 * 1000 // Cache por 3 minutos (dados mudam com menos frequência)
        }
      );
      
      if (!data.values) {
        setDados([]);
        setErro("Planilha retornou sem valores (data.values está vazio). Verifique permissões e intervalo A:F");
        return;
      }
      
      // ✅ 2) Detectar automaticamente qual é a coluna de prioridade
      const header = data.values[0].map(h => (h || '').toString().trim().toLowerCase());
      let priIndex = header.findIndex(h => h.includes('priorid') || h.includes('priorit'));
      if (priIndex === -1) priIndex = 6; // Fallback para coluna G
      
      console.log('HEADER:', header);
      console.log('priIndex:', priIndex);

      // ✅ 3) Monte as linhas corretamente
      const allRows = data.values.slice(1)
        .filter((c) => {
          // Incluir linha se tem dados significativos
          const municipio = (c[0] || "").toString().trim();
          const protocolo = (c[1] || "").toString().trim();
          const descricao = (c[4] || "").toString().trim();
          const valor = (c[5] || "").toString().trim();
          
          // Filtrar apenas linhas de controle específicas
          if (municipio.toUpperCase() === "VALOR TOTAL" || 
              municipio.toUpperCase() === "MUNICÍPIO" ||
              municipio.toUpperCase().includes("ULTIMA ATUALIZAÇÃO")) {
            return false;
          }
          
          return municipio !== "" || protocolo !== "" || descricao !== "" || valor !== "";
        })
        .map((c) => {
          const municipio = (c[0] || "").toString().trim();
          const protocolo = (c[1] || "").toString().trim();
          const secretaria = (c[2] || "").toString().trim().toUpperCase(); // SECRETARIA substituiu prefeito
          const estado = (c[3] || "").toString().trim();
          const descricao = (c[4] || "").toString().trim();
          const valor = (c[5] || "").toString().trim();
          const prioridadeCell = (c[priIndex] || "").toString().trim().toLowerCase();
          const ultimaEdicao = (c[7] || "").toString().trim(); // ✅ Coluna H - Última edição
          
          return {
            municipio: municipio || "Não informado",
            protocolo: protocolo,
            secretaria: secretaria, // SECRETARIA substituiu prefeito
            estado: estado,
            descricao: descricao,
            nomeEstrada: descricao, // Usando descrição como nome da estrada
            valor: formatCurrency(valor),
            _valorNum: parseCurrencyToNumber(valor),
            prioridadeRaw: prioridadeCell,
            prioridade: prioridadeCell.includes('priorid') || prioridadeCell.includes('priorit'),
            isPrioridade: false, // Será definido abaixo
            ultimaEdicao: ultimaEdicao // ✅ Última edição da planilha
          };
        });

      console.log('rows com prioridade:', allRows.filter(r => r.prioridadeRaw));

      // ✅ 4) Garantir que cada município tenha apenas 1 prioridade
      const municipioTemPrioridade = {};
      allRows.forEach(r => {
        const key = r.municipio.toLowerCase();
        if (!municipioTemPrioridade[key]) municipioTemPrioridade[key] = false;
        if (r.prioridade) municipioTemPrioridade[key] = true;
      });

      const usado = new Set();
      // Primeiro passo: marcar as que já têm "prioridade" explícita
      allRows.forEach(r => {
        const key = r.municipio.toLowerCase();
        r.isPrioridade = false;
        if (r.prioridade && !usado.has(key)) {
          r.isPrioridade = true;
          usado.add(key);
        }
      });

      // Segundo passo: para municípios sem prioridade explícita, marcar a primeira entrada
      allRows.forEach(r => {
        const key = r.municipio.toLowerCase();
        if (municipioTemPrioridade[key] && !usado.has(key) && r.municipio !== "Não informado") {
          r.isPrioridade = true;
          usado.add(key);
        }
      });

      const rows = allRows;
      console.log('total prioridades finais:', rows.filter(r => r.isPrioridade).length);
      setDados(rows);
      setUltimaAtualizacao(new Date()); // ✅ Registrar quando os dados foram atualizados
      setCarregando(false);
    } catch (e) {
      if (e.name === 'AbortError') {
        console.log('[Estradas Rurais] Requisição cancelada');
        return;
      }
      
      console.error(e);
      setErro(e.message || String(e));
      setCarregando(false);
    }
  }, [fetchWithCache]);

  useEffect(() => {
    fetchData();
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchData]);

  useEffect(() => {
    if (autoRefresh) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      // Force fresh data on auto-refresh
      intervalRef.current = setInterval(() => fetchData(true), Math.max(5, refreshIntervalSeconds) * 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [autoRefresh, refreshIntervalSeconds, fetchData]);

  function parseCurrencyToNumber(value) {
    if (!value && value !== 0) return 0;
    const s = value.toString().trim();
    if (s === "") return 0;
    const only = s.replace(/[^0-9.,-]/g, "");
    if (only.indexOf(".") > -1 && only.indexOf(",") > -1) {
      const cleaned = only.replace(/\./g, "").replace(/,/g, ".");
      const n = parseFloat(cleaned);
      return isNaN(n) ? 0 : n;
    }
    if (only.indexOf(",") > -1) {
      const cleaned = only.replace(/,/g, ".");
      const n = parseFloat(cleaned);
      return isNaN(n) ? 0 : n;
    }
    const n = parseFloat(only);
    return isNaN(n) ? 0 : n;
  }

  function formatCurrency(value) {
    if (!value) return "R$ 0,00";
    const num = parseCurrencyToNumber(value);
    if (num === 0) return "R$ 0,00";
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(num);
  }

  // Estados removidos dos filtros conforme solicitado

  const filtrados = useMemo(() => {
    const lowerBusca = busca.trim().toLowerCase();
    const lowerBuscaEstrada = buscaEstrada.trim().toLowerCase();
    let out = dados.filter((d) => {
      if (lowerBusca && !d.municipio.toLowerCase().includes(lowerBusca)) return false;
      if (lowerBuscaEstrada) {
        const buscaEstradaMatch = (d.nomeEstrada && d.nomeEstrada.toLowerCase().includes(lowerBuscaEstrada)) ||
                                  (d.descricao && d.descricao.toLowerCase().includes(lowerBuscaEstrada));
        if (!buscaEstradaMatch) return false;
      }
      // Filtro por prioridades
      if (apensPrioridades && !d.isPrioridade) return false;
      
      // Filtro por secretaria
      if (filtroSecretaria && d.secretaria !== filtroSecretaria) return false;
      
      // Filtro por protocolo (compara apenas números)
      if (filtroProtocolo) {
        const numBusca = extractNumbers(filtroProtocolo);
        const numProtocolo = extractNumbers(d.protocolo || '');
        if (!numProtocolo.includes(numBusca)) return false;
      }
      
      return true;
    });
    out.sort((a, b) => {
      let va = a[sortBy];
      let vb = b[sortBy];
      if (sortBy === "valor") {
        va = a._valorNum;
        vb = b._valorNum;
      } else {
        va = (va || "").toString().toLowerCase();
        vb = (vb || "").toString().toLowerCase();
      }
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return out;
  }, [dados, busca, buscaEstrada, filtroProtocolo, apensPrioridades, filtroSecretaria, sortBy, sortDir]);

  const total = filtrados.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [totalPages, page]);
  const pageData = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtrados.slice(start, start + pageSize);
  }, [filtrados, page, pageSize]);

  const exportCSV = () => {
    const headers = ["Município", "Protocolo", "Secretaria", "Estado", "Descrição", "Valor"];
    const rows = filtrados.map((r) => [r.municipio, r.protocolo, r.secretaria, r.estado, r.descricao, r.valor]);
    const csvContent = [headers, ...rows].map((e) => e.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "estradas_rurais_export.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearFilters = () => {
    setBusca("");
    setBuscaEstrada("");
    setFiltroProtocolo("");
    setProtocoloError("");
    setApenasPrioridades(false);
    setFiltroSecretaria("");
  };

  const toggleSort = (col) => {
    if (sortBy === col) {
      setSortDir((s) => (s === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(col);
      setSortDir("asc");
    }
  };

  const sumFilteredValues = useMemo(() => filtrados.reduce((acc, r) => acc + (r._valorNum || 0), 0), [filtrados]);

  // Função para imprimir os registros atuais
  const imprimirRegistros = () => {
    const dataAtual = new Date().toLocaleDateString('pt-BR');
    const horaAtual = new Date().toLocaleTimeString('pt-BR');
    
    let conteudoHTML = `
      <html>
        <head>
          <title>Relatório de Estradas Rurais</title>
          <meta charset="utf-8">
          <style>
            @page { margin: 2cm; size: A4; }
            body { font-family: Arial, sans-serif; font-size: 12px; line-height: 1.4; }
            .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 10px; }
            .header h1 { margin: 0; color: #333; font-size: 24px; }
            .info { background: #f5f5f5; padding: 10px; margin: 20px 0; border-radius: 5px; }
            .filtros { margin: 20px 0; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; font-weight: bold; }
            .prioridade { background-color: #fee; }
            .prioridade-badge { color: #d00; font-weight: bold; }
            .valor { text-align: right; font-weight: bold; }
            .footer { margin-top: 30px; text-align: center; font-size: 10px; color: #666; }
            .break-word { word-wrap: break-word; max-width: 200px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>🛣️ Relatório de Estradas Rurais</h1>
            <p>Portal Municipal de Investimentos</p>
          </div>
          
          <div class="info">
            <strong>📊 Resumo do Relatório:</strong><br>
            • Total de registros: ${filtrados.length}<br>
            • Valor total: ${formatNumber(sumFilteredValues)}<br>
            • Data/Hora: ${dataAtual} às ${horaAtual}<br>
            ${apensPrioridades ? '• <span class="prioridade-badge">Apenas PRIORIDADES</span>' : ''}
          </div>`;

    if (busca || buscaEstrada || filtroProtocolo || apensPrioridades) {
      conteudoHTML += `
        <div class="filtros">
          <strong>🔍 Filtros Aplicados:</strong><br>
          ${busca ? `• Município: "${busca}"<br>` : ''}
          ${buscaEstrada ? `• Nome da Estrada: "${buscaEstrada}"<br>` : ''}
          ${filtroProtocolo ? `• Protocolo: "${filtroProtocolo}"<br>` : ''}
          ${apensPrioridades ? '• Mostrando apenas PRIORIDADES<br>' : ''}
        </div>`;
    }

    conteudoHTML += `
          <table>
            <thead>
              <tr>
                <th>Município</th>
                <th>Protocolo</th>
                <th>Nome da Estrada</th>
                <th>Situação</th>
                <th>Valor</th>
              </tr>
            </thead>
            <tbody>`;

    filtrados.forEach((registro) => {
      conteudoHTML += `
        <tr class="${registro.isPrioridade ? 'prioridade' : ''}">
          <td>
            ${registro.municipio}
            ${registro.isPrioridade ? '<br><span class="prioridade-badge">PRIORIDADE</span>' : ''}
          </td>
          <td>${registro.protocolo || '-'}</td>
          <td class="break-word">${registro.nomeEstrada || '-'}</td>
          <td class="break-word">${registro.descricao || '-'}</td>
          <td class="valor">${registro.valor}</td>
        </tr>`;
    });

    conteudoHTML += `
            </tbody>
          </table>
          
          <div class="footer">
            <p>Relatório gerado pelo Portal Municipal - Sistema de Estradas Rurais</p>
            <p>Total de ${filtrados.length} registro(s) | Valor Total: ${formatNumber(sumFilteredValues)}</p>
          </div>
        </body>
      </html>`;

    const janelaImpressao = window.open('', '_blank');
    janelaImpressao.document.write(conteudoHTML);
    janelaImpressao.document.close();
    janelaImpressao.focus();
    janelaImpressao.print();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-gray-100 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header Principal */}
        <header className="bg-white rounded-xl shadow-lg p-6 mb-6 border-l-4 border-blue-600">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-gray-800 flex items-center gap-3">
                🛣️ Estradas Rurais
              </h1>
              <p className="text-gray-600 mt-2 text-lg flex items-center gap-2">
                Painel de Investimentos Municipais
                {ultimaAtualizacao && (
                  <span className="text-sm text-blue-600 font-medium ml-2 flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Atualizado: {ultimaAtualizacao.toLocaleTimeString('pt-BR', {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit'
                    })}
                    {autoRefresh && <span className="animate-pulse">⚡</span>}
                  </span>
                )}
              </p>
            </div>
            <div className="flex gap-3 flex-wrap">
              <button 
                onClick={() => fetchData(true)} 
                className="px-4 py-2 rounded-lg bg-blue-600 text-white shadow-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                title="Atualizar dados da planilha agora"
              >
                🔄 Atualizar Agora
              </button>
              <button 
                onClick={() => setApenasPrioridades(!apensPrioridades)}
                className={`px-4 py-2 rounded-lg shadow-lg transition-colors flex items-center gap-2 ${
                  apensPrioridades 
                    ? 'bg-red-600 text-white hover:bg-red-700' 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {apensPrioridades ? 'Mostrando Prioridades' : 'Ver Prioridades'}
              </button>
              <button 
                onClick={imprimirRegistros} 
                className="px-4 py-2 rounded-lg bg-purple-600 text-white shadow-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
              >
                🖨️ Imprimir
              </button>
              <button 
                onClick={exportCSV} 
                className="px-4 py-2 rounded-lg bg-green-600 text-white shadow-lg hover:bg-green-700 transition-colors flex items-center gap-2"
              >
                📥 Exportar CSV
              </button>
            </div>
          </div>
        </header>

        {/* Estatísticas Resumo */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl p-6 shadow-lg border-l-4 border-green-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total de Registros</p>
                <p className="text-2xl font-bold text-gray-900">{total}</p>
              </div>
              <div className="text-3xl">📊</div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl p-6 shadow-lg border-l-4 border-blue-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Municípios Únicos</p>
                <p className="text-2xl font-bold text-gray-900">{new Set(dados.map(d => d.municipio)).size}</p>
              </div>
              <div className="text-3xl">🏛️</div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-lg border-l-4 border-yellow-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Valor Total</p>
                <p className="text-xl font-bold text-green-600">{formatNumber(sumFilteredValues)}</p>
              </div>
              <div className="text-3xl">💰</div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-lg border-l-4 border-red-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Estradas Prioritárias</p>
                <p className="text-2xl font-bold text-red-600">{dados.filter(d => d.isPrioridade).length}</p>
              </div>
              <div className="text-3xl">🎯</div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-lg border-l-4 border-green-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">SEAB (Agricultura)</p>
                <p className="text-2xl font-bold text-green-600">{dados.filter(d => d.secretaria === 'SEAB').length}</p>
              </div>
              <div className="text-3xl">🌱</div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-lg border-l-4 border-blue-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">SECID (Cidades)</p>
                <p className="text-2xl font-bold text-blue-600">{dados.filter(d => d.secretaria === 'SECID').length}</p>
              </div>
              <div className="text-3xl">🏙️</div>
            </div>
          </div>
        </div>

        {/* Filtros */}
        <section className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            🔍 Filtros de Busca
          </h2>
          
          {/* Filtros por Secretaria - Destaque */}
          <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-green-50 rounded-lg border border-gray-200">
            <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
              🏢 Filtrar por Secretaria
            </h3>
            <div className="flex gap-3 flex-wrap">
              <button 
                onClick={() => setFiltroSecretaria("")}
                className={`px-4 py-2 rounded-lg shadow transition-colors flex items-center gap-2 text-sm font-bold ${
                  filtroSecretaria === ""
                    ? 'bg-gray-600 text-white' 
                    : 'bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200'
                }`}
              >
                📊 TODAS
                {filtroSecretaria === "" && <span className="text-xs">✓</span>}
              </button>
              <button 
                onClick={() => setFiltroSecretaria(filtroSecretaria === "SEAB" ? "" : "SEAB")}
                className={`px-4 py-2 rounded-lg shadow transition-colors flex items-center gap-2 text-sm font-bold ${
                  filtroSecretaria === "SEAB"
                    ? 'bg-green-600 text-white' 
                    : 'bg-green-100 text-green-800 border border-green-300 hover:bg-green-200'
                }`}
              >
                🌱 SEAB (Agricultura)
                {filtroSecretaria === "SEAB" && <span className="text-xs">✓</span>}
              </button>
              <button 
                onClick={() => setFiltroSecretaria(filtroSecretaria === "SECID" ? "" : "SECID")}
                className={`px-4 py-2 rounded-lg shadow transition-colors flex items-center gap-2 text-sm font-bold ${
                  filtroSecretaria === "SECID"
                    ? 'bg-blue-600 text-white' 
                    : 'bg-blue-100 text-blue-800 border border-blue-300 hover:bg-blue-200'
                }`}
              >
                🏙️ SECID (Cidades)
                {filtroSecretaria === "SECID" && <span className="text-xs">✓</span>}
              </button>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                🏛️ Município
              </label>
              <input 
                value={busca} 
                onChange={(e) => { setBusca(e.target.value); setPage(1); }} 
                placeholder="Digite o nome do município..." 
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors" 
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                🛣️ Nome da Estrada
              </label>
              <input 
                value={buscaEstrada} 
                onChange={(e) => { setBuscaEstrada(e.target.value); setPage(1); }} 
                placeholder="Digite o nome da estrada..." 
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors" 
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                📄 Filtro por Protocolo
              </label>
              <div className="relative">
                <input 
                  type="text"
                  value={filtroProtocolo} 
                  onChange={handleProtocoloChange}
                  placeholder="Ex: 241302056 ou 24.130.205-6" 
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 transition-colors ${
                    protocoloError 
                      ? 'border-red-300 focus:ring-red-500 focus:border-red-500' 
                      : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
                  }`}
                  maxLength={12} // XX.XXX.XXX-X = 12 caracteres
                />
                {extractNumbers(filtroProtocolo).length === 9 && (
                  <div className="absolute right-2 top-2.5">
                    <span className="text-green-500 text-sm">✓</span>
                  </div>
                )}
              </div>
              
              {protocoloError ? (
                <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                  <span>⚠️</span> {protocoloError}
                </p>
              ) : (
                <p className="text-xs text-gray-500 mt-1">
                  💡 Digite apenas números - formatação automática XX.XXX.XXX-X
                </p>
              )}
              
              {filtroProtocolo && extractNumbers(filtroProtocolo).length === 9 && (
                <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                  <span>✅</span> Protocolo válido - 9 dígitos
                </p>
              )}
            </div>
            
            <div>
              {/* Espaço reservado para futuros filtros */}
            </div>
          </div>

          <div className="mt-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex gap-3 items-center">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <input 
                  type="checkbox" 
                  checked={autoRefresh} 
                  onChange={(e) => setAutoRefresh(e.target.checked)} 
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" 
                />
                Auto-refresh
              </label>
              <input 
                type="number" 
                min={5} 
                value={refreshIntervalSeconds} 
                onChange={(e) => setRefreshIntervalSeconds(Number(e.target.value))} 
                className="p-2 w-20 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" 
              />
              <span className="text-sm text-gray-500">segundos</span>
            </div>

            <button 
              onClick={clearFilters} 
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors flex items-center gap-2"
            >
              🗑️ Limpar Filtros
            </button>
          </div>
        </section>

        {/* Tabela de Dados */}
        <section className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="px-6 py-4 bg-gray-50 border-b">
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              📋 Dados das Estradas Rurais
            </h2>
          </div>

          {carregando ? (
            <div className="p-12 text-center">
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600 text-lg">Carregando dados...</p>
            </div>
          ) : erro ? (
            <div className="p-12 text-center">
              <div className="text-6xl mb-4">⚠️</div>
              <p className="text-red-600 text-lg font-medium">Erro: {erro}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full table-auto">
                <colgroup>
                  <col style={{width: '200px'}} />  {/* Município */}
                  <col style={{width: '150px'}} />  {/* Protocolo - aumentado para evitar quebra */}
                  <col style={{width: '140px'}} />  {/* Secretaria */}
                  <col style={{minWidth: '350px'}} /> {/* Descrição */}
                  <col style={{width: '140px'}} />  {/* Valor */}
                </colgroup>
                <thead className="bg-gradient-to-r from-blue-50 to-blue-100 sticky top-0">
                  <tr>
                    <th 
                      className="px-4 py-3 text-left text-xs font-bold text-gray-700 cursor-pointer hover:bg-blue-200 transition-colors" 
                      onClick={() => toggleSort("municipio")}
                    >
                      <div className="flex items-center gap-1">
                        🏛️ Município 
                        {sortBy === "municipio" && (
                          <span className="text-blue-600">{sortDir === "asc" ? "▲" : "▼"}</span>
                        )}
                      </div>
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-bold text-gray-700">
                      📄 Protocolo
                    </th>
                    <th 
                      className="px-3 py-3 text-center text-xs font-bold text-gray-700 cursor-pointer hover:bg-blue-200 transition-colors" 
                      onClick={() => toggleSort("secretaria")}
                    >
                      <div className="flex items-center justify-center gap-1">
                        🏢 Secretaria
                        {sortBy === "secretaria" && (
                          <span className="text-blue-600">{sortDir === "asc" ? "▲" : "▼"}</span>
                        )}
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700">
                      📝 Estrada & Descrição
                    </th>
                    <th 
                      className="px-4 py-3 text-right text-xs font-bold text-gray-700 cursor-pointer hover:bg-blue-200 transition-colors" 
                      onClick={() => toggleSort("valor")}
                    >
                      <div className="flex items-center justify-end gap-1">
                        💰 Valor
                        {sortBy === "valor" && (
                          <span className="text-blue-600">{sortDir === "asc" ? "▲" : "▼"}</span>
                        )}
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {pageData.map((r, i) => (
                    <TabelaLinha 
                      key={`${r.municipio}-${r.protocolo}-${i}`} 
                      r={r} 
                      i={i} 
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Paginação */}
        <footer className="mt-6 bg-white rounded-xl shadow-lg p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-gray-700">Itens por página:</label>
              <select 
                value={pageSize} 
                onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }} 
                className="p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {[10, 25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
              <span className="text-sm text-gray-600">
                Mostrando {((page - 1) * pageSize) + 1} a {Math.min(page * pageSize, total)} de {total} registros
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button 
                onClick={() => setPage(1)} 
                disabled={page === 1} 
                className="px-3 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
              >
                &laquo; Primeiro
              </button>
              <button 
                onClick={() => setPage((p) => Math.max(1, p - 1))} 
                disabled={page === 1} 
                className="px-3 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
              >
                &lsaquo; Anterior
              </button>
              
              <span className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium">
                Página {page} de {totalPages}
              </span>
              
              <button 
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))} 
                disabled={page === totalPages} 
                className="px-3 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
              >
                Próxima &rsaquo;
              </button>
              <button 
                onClick={() => setPage(totalPages)} 
                disabled={page === totalPages} 
                className="px-3 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
              >
                Último &raquo;
              </button>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

function formatNumber(n) {
  if (typeof n !== "number") return "0";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}