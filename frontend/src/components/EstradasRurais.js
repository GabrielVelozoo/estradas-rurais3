// frontend/src/pages/EstradasRurais.js
import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import { useDataCache } from "../contexts/DataCacheContext";

/* ======================= UTIL ======================= */
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

function formatCurrencyBR(value) {
  if (!value) return "R$ 0,00";
  const num = parseCurrencyToNumber(value);
  if (num === 0) return "R$ 0,00";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(num);
}

// Converte "dd/MM/yyyy HH:mm[:ss]" para Date local
function parsePtBrDateString(str) {
  if (!str) return null;
  const v = String(str).trim();
  const re =
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/;
  const m = v.match(re);
  if (m) {
    const dd = parseInt(m[1], 10);
    const MM = parseInt(m[2], 10);
    const yyyy = parseInt(m[3], 10);
    const hh = m[4] ? parseInt(m[4], 10) : 0;
    const min = m[5] ? parseInt(m[5], 10) : 0;
    const ss = m[6] ? parseInt(m[6], 10) : 0;
    return new Date(yyyy, MM - 1, dd, hh, min, ss);
  }
  return null;
}

function formatUltimaAtualizacaoBR(value) {
  const dt = parsePtBrDateString(value);
  if (!dt) return null;
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(dt);
  } catch {
    return null;
  }
}

// ajuda anti-tradução
const noTranslateProps = {
  translate: "no",
  "data-no-translate": "true",
  className: "",
};

// debounce
function useDebounced(value, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/* ======================= LINHA DA TABELA ======================= */
const TabelaLinha = ({ r, onCopy }) => {
  const getSecretariaStyle = (secretaria) => {
    switch (secretaria) {
      case "SEAB":
        return {
          bg: "bg-green-100 dark:bg-emerald-900/30",
          text: "text-green-800 dark:text-emerald-300",
          border: "border-green-300 dark:border-emerald-700",
          icon: "🌱",
          label: "SEAB",
        };
      case "SECID":
        return {
          bg: "bg-blue-100 dark:bg-blue-900/30",
          text: "text-blue-800 dark:text-blue-300",
          border: "border-blue-300 dark:border-blue-700",
          icon: "🏙️",
          label: "SECID",
        };
      default:
        return {
          bg: "bg-gray-100 dark:bg-slate-800",
          text: "text-gray-600 dark:text-slate-300",
          border: "border-gray-300 dark:border-slate-700",
          icon: "❓",
          label: secretaria || "N/A",
        };
    }
  };
  const secretariaStyle = getSecretariaStyle(r.secretaria);

  const gerarLinkEProtocolo = (protocolo) => {
    if (!protocolo) return null;
    const protocoloLimpo = protocolo.replace(/\D/g, "");
    if (protocoloLimpo.length < 6) return null;
    return `https://www.eprotocolo.pr.gov.br/spiweb/consultarProtocoloDigital.do?action=pesquisar&numeroProtocolo=${protocoloLimpo}`;
  };

  const linkEProtocolo = gerarLinkEProtocolo(r.protocolo);
  const ultimaFmt = r.ultimaEdicao ? formatUltimaAtualizacaoBR(r.ultimaEdicao) : null;

  // chip de estado (azul para Plano de Trabalho / Plano de Trabalho Aprovado)
  const estadoTexto = `${r.estado || ""} ${r.descricao || ""}`;
  const isPlanoTrabalho = /(plano\s*de\s*trabalho)(\s*aprovado)?/i.test(estadoTexto);

  const estadoColor = isPlanoTrabalho
    ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200"
    : /teste/i.test(estadoTexto)
    ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200"
    : /nuconv|convêni|convenio/i.test(estadoTexto)
    ? "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-200"
    : (r.estado || r.descricao)
    ? "bg-gray-100 text-gray-700 dark:bg-slate-800 dark:text-slate-300"
    : "";

  // máscara para copiar protocolo
  const maskProtocolo = (value) => {
    const n = (value || "").replace(/\D/g, "").slice(0, 9);
    if (n.length <= 2) return n;
    if (n.length <= 5) return `${n.slice(0, 2)}.${n.slice(2)}`;
    if (n.length <= 8) return `${n.slice(0, 2)}.${n.slice(2, 5)}.${n.slice(5)}`;
    return `${n.slice(0, 2)}.${n.slice(2, 5)}.${n.slice(5, 8)}-${n.slice(8)}`;
  };

  return (
    <tr
      className={`transition-colors border-b border-gray-100 dark:border-slate-800 ${
        r.isPrioridade
          ? "bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/30 border-l-4 border-l-red-500"
          : "hover:bg-blue-50 dark:hover:bg-slate-800/50"
      }`}
    >
      {/* Município */}
      <td className="px-4 py-3 align-top">
        <div className="flex items-center gap-2">
          <div
            {...noTranslateProps}
            className="font-semibold text-gray-900 dark:text-slate-100 text-sm break-words"
          >
            {r.municipio}
          </div>
          {r.isPrioridade && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-red-600 text-white animate-pulse">
              PRIORIDADE
            </span>
          )}
        </div>
      </td>

      {/* Protocolo */}
      <td className="px-3 py-3 align-top">
        <div className="font-mono text-xs whitespace-nowrap flex items-center">
          {linkEProtocolo ? (
            <>
              <a
                href={linkEProtocolo}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline transition-colors cursor-pointer flex items-center gap-1"
                title={`Abrir protocolo ${r.protocolo} no eProtocolo`}
                style={{ color: "#2563eb" }}
                {...noTranslateProps}
              >
                <span className="text-xs">🔗</span>
                <span>{r.protocolo}</span>
              </a>
              <button
                onClick={() => onCopy(maskProtocolo(r.protocolo))}
                className="ml-2 text-[11px] px-2 py-0.5 rounded bg-gray-100 hover:bg-gray-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-gray-700 dark:text-slate-200"
                title="Copiar protocolo com máscara"
              >
                Copiar
              </button>
            </>
          ) : (
            <span className="text-gray-700 dark:text-slate-300" {...noTranslateProps}>
              {r.protocolo}
            </span>
          )}
        </div>
      </td>

      {/* Secretaria */}
      <td className="px-3 py-3 align-top">
        <div className="flex justify-center">
          <span
            {...noTranslateProps}
            className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold border ${getSecretariaStyle(r.secretaria).bg} ${getSecretariaStyle(r.secretaria).text} ${getSecretariaStyle(r.secretaria).border}`}
          >
            <span className="text-sm">{getSecretariaStyle(r.secretaria).icon}</span>
            {getSecretariaStyle(r.secretaria).label}
          </span>
        </div>
      </td>

      {/* Descrição + Última Atualização */}
      <td className="px-4 py-3 align-top">
        <div className="space-y-2">
          {r.nomeEstrada && (
            <strong
              className={`block font-extrabold text-sm ${
                r.isPrioridade ? "text-red-900 dark:text-red-300" : "text-gray-900 dark:text-slate-100"
              }`}
              {...noTranslateProps}
            >
              🛣️ {r.nomeEstrada}
            </strong>
          )}
          {(r.estado || ultimaFmt) && (
            <div className="text-gray-600 dark:text-slate-300 text-sm flex items-center flex-wrap gap-2">
              {(r.estado || r.descricao) && (
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${estadoColor}`}>
                  {r.estado || "—"}
                </span>
              )}
              {ultimaFmt && (
                <span className="text-red-500 dark:text-red-300 text-xs font-medium whitespace-nowrap">
                  🕐 Ultima Atualização: {ultimaFmt}
                </span>
              )}
            </div>
          )}
        </div>
      </td>

      {/* Valor */}
      <td className="px-4 py-3 text-right align-top">
        <div
          className={`font-bold text-sm whitespace-nowrap ${
            r.isPrioridade ? "text-red-600" : "text-green-600 dark:text-emerald-300"
          }`}
        >
          {r.valor}
        </div>
      </td>
    </tr>
  );
};

/* ======================= PÁGINA ======================= */
export default function EstradasRurais() {
  const { fetchWithCache } = useDataCache();

  // filtros/estado
  const [dados, setDados] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);
  const [busca, setBusca] = useState("");
  const [buscaEstrada, setBuscaEstrada] = useState("");
  const [filtroSecretaria, setFiltroSecretaria] = useState("");
  const [filtroProtocolo, setFiltroProtocolo] = useState("");
  const [protocoloError, setProtocoloError] = useState("");
  const [apenasPrioridades, setApenasPrioridades] = useState(false);
  const [sortBy, setSortBy] = useState("municipio");
  const [sortDir, setSortDir] = useState("asc");
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshIntervalSeconds, setRefreshIntervalSeconds] = useState(30);
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState(null);
  const intervalRef = useRef(null);

  // DARK MODE (persistência + prefers)
  const THEME_KEY = "ui_theme";
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    if (dark) root.classList.add("dark");
    else root.classList.remove("dark");
    try {
      localStorage.setItem(THEME_KEY, dark ? "dark" : "light");
    } catch {}
  }, [dark]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(THEME_KEY);
      if (saved === "dark" || saved === "light") {
        setDark(saved === "dark");
        return;
      }
    } catch {}
    const prefers =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;
    setDark(!!prefers);
  }, []);

  // toast
  const [toast, setToast] = useState("");
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 1800);
    return () => clearTimeout(t);
  }, [toast]);

  // máscara/validação do protocolo (para o input)
  const formatProtocoloMask = (value) => {
    const numbers = (value || "").replace(/\D/g, "");
    const n = numbers.slice(0, 9);
    if (n.length <= 2) return n;
    if (n.length <= 5) return `${n.slice(0, 2)}.${n.slice(2)}`;
    if (n.length <= 8)
      return `${n.slice(0, 2)}.${n.slice(2, 5)}.${n.slice(5)}`;
    return `${n.slice(0, 2)}.${n.slice(2, 5)}.${n.slice(5, 8)}-${n.slice(8)}`;
  };
  const extractNumbers = (s) => (s || "").replace(/\D/g, "");
  const validateProtocolo = (prot) => {
    const numbers = extractNumbers(prot);
    if (numbers.length === 0) return { valid: true, error: "" };
    if (numbers.length < 9)
      return {
        valid: false,
        error: `Protocolo incompleto (${numbers.length}/9 dígitos)`,
      };
    if (numbers.length > 9)
      return {
        valid: false,
        error: `Protocolo muito longo (${numbers.length}/9 dígitos)`,
      };
    return { valid: true, error: "" };
  };
  const handleProtocoloChange = (e) => {
    const formatted = formatProtocoloMask(e.target.value);
    const { error } = validateProtocolo(formatted);
    setFiltroProtocolo(formatted);
    setProtocoloError(error);
    setPage(1);
  };

  const fetchData = useCallback(
    async (forceFresh = false) => {
      setCarregando(true);
      setErro(null);
      try {
        const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
        const data = await fetchWithCache(
          "estradas-rurais",
          async (signal) => {
            const res = await fetch(`${BACKEND_URL}/api/estradas-rurais`, {
              signal,
            });
            if (!res.ok)
              throw new Error(`Erro na requisição: ${res.status} ${res.statusText}`);
            return await res.json();
          },
          { forceFresh, ttl: 3 * 60 * 1000 }
        );

        if (!data.values) {
          setDados([]);
          setErro(
            "Planilha sem valores (data.values vazio). Verifique permissões e intervalo A:H"
          );
          setCarregando(false);
          return;
        }

        const allRows = data.values
          .slice(2)
          .filter((c) => {
            const municipio = (c[0] || "").toString().trim();
            const descricao = (c[4] || "").toString().trim();
            const valor = (c[5] || "").toString().trim();
            if (
              municipio.toUpperCase() === "VALOR TOTAL" ||
              municipio.toUpperCase() === "MUNICÍPIO" ||
              municipio.toUpperCase().includes("ULTIMA ATUALIZAÇÃO")
            )
              return false;
            return municipio !== "" || descricao !== "" || valor !== "";
          })
          .map((c) => {
            const municipio = (c[0] || "").toString().trim();
            const protocolo = (c[1] || "").toString().trim();
            const secretaria = (c[2] || "").toString().trim().toUpperCase();
            const estado = (c[3] || "").toString().trim();
            const descricao = (c[4] || "").toString().trim();
            const valor = (c[5] || "").toString().trim();
            const prioridadeRaw = (c[6] || "").toString().trim().toLowerCase();
            const ultimaEdicao = (c[7] || "").toString().trim();

            return {
              municipio: municipio || "Não informado",
              protocolo,
              secretaria,
              estado,
              descricao,
              nomeEstrada: descricao,
              valor: formatCurrencyBR(valor),
              _valorNum: parseCurrencyToNumber(valor),
              prioridadeRaw,
              isPrioridade:
                prioridadeRaw.includes("priorid") ||
                prioridadeRaw.includes("priorit") ||
                prioridadeRaw.includes("sim"),
              ultimaEdicao,
            };
          });

        // 1 prioridade por município quando necessário
        const used = new Set();
        const hasExplicit = {};
        allRows.forEach((r) => {
          const k = r.municipio.toLowerCase();
          if (!hasExplicit[k]) hasExplicit[k] = false;
          if (r.isPrioridade) hasExplicit[k] = true;
        });
        allRows.forEach((r) => {
          const k = r.municipio.toLowerCase();
          if (r.isPrioridade && !used.has(k)) used.add(k);
          else r.isPrioridade = false;
        });
        allRows.forEach((r) => {
          const k = r.municipio.toLowerCase();
          if (!hasExplicit[k] && !used.has(k) && r.municipio !== "Não informado") {
            r.isPrioridade = true;
            used.add(k);
          }
        });

        setDados(allRows);
        setUltimaAtualizacao(new Date());
      } catch (e) {
        if (e.name === "AbortError") {
          console.log("[Estradas Rurais] Requisição cancelada");
          return;
        }
        console.error(e);
        setErro(e.message || String(e));
      } finally {
        setCarregando(false);
      }
    },
    [fetchWithCache]
  );

  useEffect(() => {
    fetchData();
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchData]);

  useEffect(() => {
    if (autoRefresh) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(
        () => fetchData(true),
        Math.max(5, refreshIntervalSeconds) * 1000
      );
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [autoRefresh, refreshIntervalSeconds, fetchData]);

  // debounce nos filtros
  const buscaDeb = useDebounced(busca, 250);
  const buscaEstradaDeb = useDebounced(buscaEstrada, 250);

  const filtrados = useMemo(() => {
    const lb = (buscaDeb || "").toLowerCase();
    const le = (buscaEstradaDeb || "").toLowerCase();
    const numFiltro = (filtroProtocolo || "").replace(/\D/g, "");

    let out = dados.filter((d) => {
      if (lb && !d.municipio.toLowerCase().includes(lb)) return false;
      if (
        le &&
        !(
          (d.nomeEstrada && d.nomeEstrada.toLowerCase().includes(le)) ||
          (d.descricao && d.descricao.toLowerCase().includes(le))
        )
      )
        return false;
      if (apenasPrioridades && !d.isPrioridade) return false;
      if (filtroSecretaria && d.secretaria !== filtroSecretaria) return false;

      if (numFiltro) {
        const numProt = (d.protocolo || "").replace(/\D/g, "");
        if (!numProt.includes(numFiltro)) return false;
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
  }, [
    dados,
    buscaDeb,
    buscaEstradaDeb,
    filtroProtocolo,
    apenasPrioridades,
    filtroSecretaria,
    sortBy,
    sortDir,
  ]);

  const total = filtrados.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [totalPages, page]);

  const pageData = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtrados.slice(start, start + pageSize);
  }, [filtrados, page, pageSize]);

  const sumFilteredValues = useMemo(
    () => filtrados.reduce((acc, r) => acc + (r._valorNum || 0), 0),
    [filtrados]
  );

  const exportCSV = () => {
    const headers = [
      "Município",
      "Protocolo",
      "Secretaria",
      "Situação",
      "Descrição",
      "Valor",
      "Ultima Atualização",
    ];
    const rows = filtrados.map((r) => [
      r.municipio,
      r.protocolo,
      r.secretaria,
      r.estado,
      r.descricao,
      r.valor,
      r.ultimaEdicao || "",
    ]);
    const csvContent = [headers, ...rows]
      .map((e) => e.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "estradas_rurais_export.csv";
    a.click();
    URL.revokeObjectURL(url);
    setToast("CSV exportado!");
  };

  const imprimir = () => {
    const dataAtual = new Date().toLocaleDateString("pt-BR");
    const horaAtual = new Date().toLocaleTimeString("pt-BR");

    const conteudo = `
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Relatório de Estradas</title>
          <style>
            @page { margin: 2cm; size: A4; }
            body { font-family: Arial, sans-serif; font-size: 12px; line-height: 1.4; }
            .header { text-align: center; margin-bottom: 20px; }
            .header h1 { margin: 0; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { border: 1px solid #ddd; padding: 6px; text-align: left; }
            th { background: #f2f2f2; }
            .valor { text-align: right; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>🛣️ Relatório de Estradas Rurais</h1>
            <div>Data/Hora: ${dataAtual} ${horaAtual}</div>
            <div>Total: ${filtrados.length} | Valor total: ${sumFilteredValues.toLocaleString(
              "pt-BR",
              { style: "currency", currency: "BRL" }
            )}</div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Município</th>
                <th>Protocolo</th>
                <th>Secretaria</th>
                <th>Descrição/Situação</th>
                <th>Ultima Atualização</th>
                <th>Valor</th>
              </tr>
            </thead>
            <tbody>
              ${filtrados
                .map(
                  (r) => `
                <tr>
                  <td>${r.municipio}</td>
                  <td>${r.protocolo || "-"}</td>
                  <td>${r.secretaria || "-"}</td>
                  <td>${r.descricao || r.nomeEstrada || "-"}</td>
                  <td>${r.ultimaEdicao || "-"}</td>
                  <td class="valor">${r.valor}</td>
                </tr>`
                )
                .join("")}
            </tbody>
          </table>
        </body>
      </html>
    `;
    const w = window.open("", "_blank");
    w.document.write(conteudo);
    w.document.close();
    w.focus();
    w.print();
  };

  const clearFilters = () => {
    setBusca("");
    setBuscaEstrada("");
    setFiltroSecretaria("");
    setFiltroProtocolo("");
    setProtocoloError("");
    setApenasPrioridades(false);
  };

  const toggleSort = (col) => {
    if (sortBy === col) {
      setSortDir((s) => (s === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(col);
      setSortDir("asc");
    }
  };

  const totalSeab = useMemo(
    () => dados.filter((d) => d.secretaria === "SEAB").length,
    [dados]
  );
  const totalSecid = useMemo(
    () => dados.filter((d) => d.secretaria === "SECID").length,
    [dados]
  );

  // header sticky shadow
  const tableWrapRef = useRef(null);
  useEffect(() => {
    const el = tableWrapRef.current;
    if (!el) return;
    const onScroll = () => {
      const th = el.querySelector("thead");
      if (!th) return;
      if (el.scrollTop > 0) th.classList.add("shadow");
      else th.classList.remove("shadow");
    };
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-blue-50 to-gray-100 dark:from-slate-900 dark:to-slate-900 p-4 md:p-6"
      {...noTranslateProps}
    >
      {/* toast */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-50 px-3 py-2 rounded-lg bg-black/80 text-white text-sm">
          {toast}
        </div>
      )}

      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <header className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6 mb-6 border-l-4 border-blue-600 dark:border-blue-500">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-gray-800 dark:text-slate-100 flex items-center gap-3">
                🛣️ Estradas Rurais
              </h1>
              <p className="text-gray-600 dark:text-slate-300 mt-2 text-lg flex items-center gap-2">
                Painel de Investimentos Municipais
                {ultimaAtualizacao && (
                  <span className="text-sm text-blue-600 dark:text-blue-300 font-medium ml-2 flex items-center gap-1">
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    Atualizado:{" "}
                    {ultimaAtualizacao.toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
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
                title="Atualizar dados agora"
              >
                🔄 Atualizar Agora
              </button>

              <button
                onClick={() => setApenasPrioridades(!apenasPrioridades)}
                className={`px-4 py-2 rounded-lg shadow-lg transition-colors flex items-center gap-2 ${
                  apenasPrioridades
                    ? "bg-red-600 text-white hover:bg-red-700"
                    : "bg-gray-200 dark:bg-slate-700 dark:text-slate-100 text-gray-700 hover:bg-gray-300"
                }`}
              >
                {apenasPrioridades ? "Mostrando Prioridades" : "Ver Prioridades"}
              </button>

              <button
                onClick={imprimir}
                className="px-4 py-2 rounded-lg bg-purple-600 text-white shadow-lg hover:bg-purple-700 transition-colors"
              >
                🖨️ Imprimir
              </button>

              <button
                onClick={exportCSV}
                className="px-4 py-2 rounded-lg bg-green-600 text-white shadow-lg hover:bg-green-700 transition-colors"
              >
                📥 Exportar CSV
              </button>

              {/* toggle dark mode */}
              <button
                onClick={() => setDark((v) => !v)}
                className="px-3 py-2 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-100"
                title="Alternar modo escuro"
                aria-pressed={dark}
              >
                {dark ? "🌙 Dark ON" : "☀️ Dark OFF"}
              </button>
            </div>
          </div>
        </header>

        {/* Cards resumo */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <ResumoCard titulo="Total de Registros" valor={total} emoji="📊" cor="green" />
          <ResumoCard
            titulo="Municípios Únicos"
            valor={new Set(dados.map((d) => d.municipio)).size}
            emoji="🏛️"
            cor="blue"
          />
          <ResumoCard
            titulo="Valor Total"
            valor={sumFilteredValues.toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL",
            })}
            emoji="💰"
            cor="yellow"
          />
          <ResumoCard
            titulo="Estradas Prioritárias"
            valor={dados.filter((d) => d.isPrioridade).length}
            emoji="🎯"
            cor="red"
          />
        </div>

        {/* Contagem por secretaria */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <ResumoCard
            titulo="SEAB (Agricultura)"
            valor={dados.filter((d) => d.secretaria === "SEAB").length}
            emoji="🌱"
            cor="green"
          />
          <ResumoCard
            titulo="SECID (Cidades)"
            valor={dados.filter((d) => d.secretaria === "SECID").length}
            emoji="🏙️"
            cor="blue"
          />
        </div>

        {/* Filtros */}
        <section className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-800 dark:text-slate-100 mb-4 flex items-center gap-2">
            🔍 Filtros de Busca
          </h2>

          {/* Secretaria */}
          <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-green-50 dark:from-slate-700/40 dark:to-slate-700/20 rounded-lg border border-gray-200 dark:border-slate-700">
            <h3 className="text-sm font-bold text-gray-700 dark:text-slate-200 mb-3 flex items-center gap-2">
              🏢 Filtrar por Secretaria
            </h3>
            <div className="flex gap-3 flex-wrap">
              <BotaoFiltro
                ativo={filtroSecretaria === ""}
                onClick={() => setFiltroSecretaria("")}
                label="📊 TODAS"
                corAtivo="bg-gray-600 text-white"
                corInativo="bg-gray-100 dark:bg-slate-700 dark:text-slate-100 text-gray-700 border border-gray-300 dark:border-slate-600 hover:bg-gray-200"
              />
              <BotaoFiltro
                ativo={filtroSecretaria === "SEAB"}
                onClick={() =>
                  setFiltroSecretaria(filtroSecretaria === "SEAB" ? "" : "SEAB")
                }
                label="🌱 SEAB (Agricultura)"
                corAtivo="bg-green-600 text-white"
                corInativo="bg-green-100 text-green-800 border border-green-300 hover:bg-green-200"
              />
              <BotaoFiltro
                ativo={filtroSecretaria === "SECID"}
                onClick={() =>
                  setFiltroSecretaria(filtroSecretaria === "SECID" ? "" : "SECID")
                }
                label="🏙️ SECID (Cidades)"
                corAtivo="bg-blue-600 text-white"
                corInativo="bg-blue-100 text-blue-800 border border-blue-300 hover:bg-blue-200"
              />
            </div>
          </div>

          {/* Campos texto */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <CampoTexto
              label="🏛️ Município"
              value={busca}
              onChange={(e) => {
                setBusca(e.target.value);
                setPage(1);
              }}
              placeholder="Digite o nome do município…"
            />
            <CampoTexto
              label="🛣️ Nome da Estrada"
              value={buscaEstrada}
              onChange={(e) => {
                setBuscaEstrada(e.target.value);
                setPage(1);
              }}
              placeholder="Digite o nome da estrada…"
            />
          </div>

          {/* Protocolo + controles */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* campo de protocolo robusto */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-slate-200 mb-2">
                📄 Filtro por Protocolo
              </label>
              <div className="relative">
                {/* ícone visual, não intercepta clique */}
                <span className="absolute left-3 top-1/2 -translate-y-1/2 opacity-70 text-gray-500 pointer-events-none select-none z-0">
                  📄
                </span>
                <input
                  type="text"
                  value={filtroProtocolo}
                  onChange={handleProtocoloChange}
                  placeholder="Ex: 241302056 ou 24.130.205-6"
                  aria-label="Filtro por Protocolo"
                  className={`w-full h-12 pl-10 pr-10 rounded-lg shadow-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-400
                    ${
                      protocoloError
                        ? "ring-1 ring-red-300 focus:ring-2 focus:ring-red-500"
                        : "ring-1 ring-gray-300 dark:ring-slate-700 focus:ring-2 focus:ring-blue-500"
                    }`}
                  maxLength={12}
                  {...noTranslateProps}
                />
                {extractNumbers(filtroProtocolo).length === 9 && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 z-10">
                    <span className="text-green-600 text-sm">✓</span>
                  </div>
                )}
              </div>
              {protocoloError ? (
                <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                  <span>⚠️</span> {protocoloError}
                </p>
              ) : (
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                  💡 Digite apenas números — formatação automática XX.XXX.XXX-X
                </p>
              )}
              {filtroProtocolo && extractNumbers(filtroProtocolo).length === 9 && (
                <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                  <span>✅</span> Protocolo válido — 9 dígitos
                </p>
              )}
            </div>

            {/* controles à direita */}
            <div className="flex flex-col md:flex-row gap-3 items-start md:items-end justify-end">
              <div className="h-10 px-3 ring-1 ring-gray-300 dark:ring-slate-700 rounded-lg flex items-center gap-2 bg-white dark:bg-slate-900">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-5 h-5"
                />
                <span className="text-sm font-medium text-gray-700 dark:text-slate-200">Auto-refresh</span>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={5}
                  value={refreshIntervalSeconds}
                  onChange={(e) =>
                    setRefreshIntervalSeconds(Number(e.target.value))
                  }
                  className="px-3 h-10 w-24 ring-1 ring-gray-300 dark:ring-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-500 dark:text-slate-300">segundos</span>
              </div>

              <button
                onClick={clearFilters}
                className="px-4 h-10 bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-slate-100 rounded-lg hover:bg-gray-300 dark:hover:bg-slate-600 transition-colors"
              >
                🗑️ Limpar Filtros
              </button>
            </div>
          </div>
        </section>

        {/* Tabela */}
        <section className="bg-white dark:bg-slate-800 rounded-xl shadow-lg overflow-hidden">
          <div className="px-6 py-4 bg-gray-50 dark:bg-slate-700 border-b border-gray-200 dark:border-slate-700">
            <h2 className="text-xl font-bold text-gray-800 dark:text-slate-100 flex items-center gap-2">
              📋 Dados das Estradas Rurais
            </h2>
          </div>

          {carregando ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="h-10 rounded bg-gradient-to-r from-slate-100 via-slate-50 to-slate-100 dark:from-slate-700 dark:via-slate-600 dark:to-slate-700 animate-pulse"
                />
              ))}
            </div>
          ) : erro ? (
            <div className="p-12 text-center">
              <div className="text-6xl mb-4">⚠️</div>
              <p className="text-red-600 dark:text-red-300 text-lg font-medium">Erro: {erro}</p>
            </div>
          ) : (
            <div
              ref={tableWrapRef}
              className="overflow-auto max-h-[70vh]"
            >
              <table className="w-full table-auto">
                <colgroup>
                  <col style={{ width: "200px" }} />
                  <col style={{ width: "150px" }} />
                  <col style={{ width: "140px" }} />
                  <col style={{ minWidth: "350px" }} />
                  <col style={{ width: "140px" }} />
                </colgroup>
                <thead className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-slate-700 dark:to-slate-700 sticky top-0 transition-shadow">
                  <tr>
                    <Th onClick={() => toggleSort("municipio")} ativo={sortBy === "municipio"} dir={sortDir}>
                      🏛️ Município
                    </Th>
                    <th className="px-3 py-3 text-left text-xs font-bold text-gray-700 dark:text-slate-200">
                      📄 Protocolo
                    </th>
                    <Th center onClick={() => toggleSort("secretaria")} ativo={sortBy === "secretaria"} dir={sortDir}>
                      🏢 Secretaria
                    </Th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-slate-200">
                      📝 Estrada & Descrição
                    </th>
                    <Th right onClick={() => toggleSort("valor")} ativo={sortBy === "valor"} dir={sortDir}>
                      💰 Valor
                    </Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                  {pageData.map((r, i) => (
                    <TabelaLinha
                      key={`${r.municipio}-${r.protocolo}-${i}`}
                      r={r}
                      onCopy={(txt) => {
                        navigator.clipboard.writeText(txt);
                        setToast("Protocolo copiado!");
                      }}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Paginação */}
        <footer className="mt-6 bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-gray-700 dark:text-slate-200">
                Itens por página:
              </label>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className="p-2 ring-1 ring-gray-300 dark:ring-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                {[10, 25, 50, 100].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
              <span className="text-sm text-gray-600 dark:text-slate-300">
                Mostrando {(page - 1) * pageSize + 1} a{" "}
                {Math.min(page * pageSize, total)} de {total} registros
              </span>
            </div>

            <div className="flex items-center gap-2">
              <PageBtn disabled={page === 1} onClick={() => setPage(1)}>
                « Primeiro
              </PageBtn>
              <PageBtn
                disabled={page === 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                ‹ Anterior
              </PageBtn>

              <span className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium">
                Página {page} de {totalPages}
              </span>

              <PageBtn
                disabled={page === totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Próxima ›
              </PageBtn>
              <PageBtn
                disabled={page === totalPages}
                onClick={() => setPage(totalPages)}
              >
                Último »
              </PageBtn>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

/* ======================= COMPONENTES AUX ======================= */
function ResumoCard({ titulo, valor, emoji, cor }) {
  const border =
    cor === "green"
      ? "border-green-500"
      : cor === "blue"
      ? "border-blue-500"
      : cor === "yellow"
      ? "border-yellow-500"
      : "border-red-500";
  const text =
    cor === "green"
      ? "text-green-600 dark:text-emerald-300"
      : cor === "blue"
      ? "text-blue-600 dark:text-blue-300"
      : cor === "yellow"
      ? "text-green-600 dark:text-emerald-300"
      : "text-red-600 dark:text-red-300";
  return (
    <div className={`bg-gradient-to-br from-white to-slate-50 dark:from-slate-800 dark:to-slate-800 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow border-l-4 ${border}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600 dark:text-slate-300">{titulo}</p>
          <p className={`text-2xl font-bold ${text}`}>{valor}</p>
        </div>
        <div className="text-3xl">{emoji}</div>
      </div>
    </div>
  );
}

function BotaoFiltro({ ativo, onClick, label, corAtivo, corInativo }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-lg shadow transition-colors flex items-center gap-2 text-sm font-bold ${
        ativo ? corAtivo : corInativo
      }`}
    >
      {label} {ativo && <span className="text-xs">✓</span>}
    </button>
  );
}

function CampoTexto({ label, value, onChange, placeholder, type = "text" }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 dark:text-slate-200 mb-2">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full p-3 ring-1 ring-gray-300 dark:ring-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 transition-colors"
      />
    </div>
  );
}

function Th({ children, onClick, ativo, dir, center, right }) {
  return (
    <th
      className={`px-4 py-3 text-xs font-bold text-gray-700 dark:text-slate-200 cursor-pointer hover:bg-blue-200 dark:hover:bg-slate-700 transition-colors ${
        center ? "text-center" : right ? "text-right" : "text-left"
      }`}
      onClick={onClick}
    >
      <div
        className={`flex items-center gap-1 ${
          center ? "justify-center" : right ? "justify-end" : ""
        }`}
      >
        {children}{" "}
        {ativo && (
          <span className="text-blue-600 dark:text-blue-300">{dir === "asc" ? "▲" : "▼"}</span>
        )}
      </div>
    </th>
  );
}

function PageBtn({ children, disabled, onClick }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="px-3 py-2 ring-1 ring-gray-300 dark:ring-slate-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
    >
      {children}
    </button>
  );
}
