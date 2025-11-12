// frontend/src/pages/EstradasRurais.js
import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import { useDataCache } from "../contexts/DataCacheContext";

/* ======================= Utils ======================= */
const noTranslateProps = { translate: "no", "data-no-translate": "true" };

const norm = (s) =>
  (s || "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

function parseCurrencyToNumber(value) {
  if (!value && value !== 0) return 0;
  const s = String(value).trim();
  if (!s) return 0;
  const only = s.replace(/[^0-9.,-]/g, "");
  if (only.includes(".") && only.includes(",")) {
    const n = parseFloat(only.replace(/\./g, "").replace(/,/g, "."));
    return isNaN(n) ? 0 : n;
  }
  if (only.includes(",")) {
    const n = parseFloat(only.replace(/,/g, "."));
    return isNaN(n) ? 0 : n;
  }
  const n = parseFloat(only);
  return isNaN(n) ? 0 : n;
}

function formatCurrencyBR(value) {
  const n = parseCurrencyToNumber(value);
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(n || 0);
}

function parsePtBrDateString(str) {
  if (!str) return null;
  const m = String(str)
    .trim()
    .match(
      /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/
    );
  if (!m) return null;
  const [_, dd, MM, yyyy, hh = 0, mi = 0, ss = 0] = m.map((x) =>
    x == null ? x : parseInt(x, 10)
  );
  return new Date(yyyy, MM - 1, dd, hh, mi, ss);
}

function formatUltimaAtualizacaoBR(v) {
  const dt = parsePtBrDateString(v);
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

/* ======================= Mini UI ======================= */
function Th({ children, onClick, active, dir, align = "left" }) {
  const alignClass =
    align === "center" ? "text-center" : align === "right" ? "text-right" : "text-left";
  return (
    <th
      onClick={onClick}
      className={`px-4 py-3 text-xs font-bold text-gray-700 cursor-pointer hover:bg-blue-100 ${alignClass}`}
    >
      <div
        className={`flex gap-1 items-center ${
          align === "center" ? "justify-center" : align === "right" ? "justify-end" : ""
        }`}
      >
        {children}
        {active && (
          <span className="text-blue-600">{dir === "asc" ? "▲" : "▼"}</span>
        )}
      </div>
    </th>
  );
}
function PageBtn({ disabled, onClick, children }) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className="px-3 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
    >
      {children}
    </button>
  );
}
function CampoTexto({ label, value, onChange, placeholder }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-2">
        {label}
      </label>
      <input
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      />
    </div>
  );
}
function BotaoFiltro({ ativo, onClick, label, corAtivo, corInativo }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-lg shadow transition-colors text-sm font-bold ${
        ativo ? corAtivo : corInativo
      }`}
    >
      {label} {ativo && <span className="text-xs">✓</span>}
    </button>
  );
}
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
      ? "text-green-600"
      : cor === "blue"
      ? "text-blue-600"
      : cor === "yellow"
      ? "text-green-600"
      : "text-red-600";
  return (
    <div className={`bg-white rounded-xl p-6 shadow-lg border-l-4 ${border}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{titulo}</p>
          <p className={`text-2xl font-bold ${text}`}>{valor}</p>
        </div>
        <div className="text-3xl">{emoji}</div>
      </div>
    </div>
  );
}

/* ======================= Autocomplete Município ======================= */
function AutoCompleteInput({
  label,
  value,
  onChange,
  placeholder,
  options,
  onSelect,
}) {
  const [open, setOpen] = useState(false);
  const filtered = useMemo(() => {
    const v = norm(value);
    if (!v) return options.slice(0, 8);
    return options.filter((o) => norm(o).includes(v)).slice(0, 8);
  }, [value, options]);

  return (
    <div className="relative">
      <label className="block text-sm font-semibold text-gray-700 mb-2">
        {label}
      </label>
      <input
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        placeholder={placeholder}
        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-auto">
          {filtered.map((opt) => (
            <button
              key={opt}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onSelect(opt);
                setOpen(false);
              }}
              className="w-full text-left px-3 py-2 hover:bg-blue-50"
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ======================= Protocolo (input) ======================= */
function ProtocoloInput({ value, onChange, error }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-2">
        📄 Filtro por Protocolo
      </label>

      <div
        className={`flex items-center gap-2 rounded-lg border p-3 bg-white ${
          error
            ? "border-red-300 ring-1 ring-red-400"
            : "border-gray-300 focus-within:ring-2 focus-within:ring-blue-500"
        }`}
      >
        <span className="opacity-70" aria-hidden>
          🔍
        </span>
        <input
          type="text"
          inputMode="numeric"
          placeholder="Digite apenas números (formata sozinho)"
          value={value}
          onChange={onChange}
          className="w-full outline-none bg-transparent font-mono"
          {...noTranslateProps}
        />
        {value && (
          <button
            type="button"
            title="Limpar"
            onClick={() => onChange({ target: { value: "" } })}
            className="text-xs px-2 py-1 rounded border border-gray-200 hover:bg-gray-50"
          >
            Limpar
          </button>
        )}
      </div>

      {error && (
        <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
          <span>⚠️</span> {error}
        </p>
      )}
    </div>
  );
}

/* ======================= Pills ======================= */
const PriorityPill = () => (
  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-300 text-white">
    PRIORIDADE
  </span>
);
const ApprovedPill = ({ small = false }) => (
  <span
    className={`inline-flex items-center ${
      small ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-[11px]"
    } rounded-full font-bold bg-blue-100 text-blue-800 border border-blue-300`}
  >
    ✅ APROVADO
  </span>
);

/* ======================= Linha da tabela ======================= */
const TabelaLinha = ({ r }) => {
  const getSecretariaStyle = (secretaria) => {
    switch (secretaria) {
      case "SEAB":
        return {
          bg: "bg-green-100",
          text: "text-green-800",
          border: "border-green-300",
          icon: "🌱",
          label: "SEAB",
        };
      case "SECID":
        return {
          bg: "bg-blue-100",
          text: "text-blue-800",
          border: "border-blue-300",
          icon: "🏙️",
          label: "SECID",
        };
      default:
        return {
          bg: "bg-gray-100",
          text: "text-gray-600",
          border: "border-gray-300",
          icon: "❓",
          label: secretaria || "N/A",
        };
    }
  };

  const secretariaStyle = getSecretariaStyle(r.secretaria);
  const gerarLinkEProtocolo = (protocolo) => {
    if (!protocolo) return null;
    const n = protocolo.replace(/\D/g, "");
    if (n.length < 6) return null;
    return `https://www.eprotocolo.pr.gov.br/spiweb/consultarProtocoloDigital.do?action=pesquisar&numeroProtocolo=${n}`;
  };
  const linkEProtocolo = gerarLinkEProtocolo(r.protocolo);
  const ultimaFmt = r.ultimaEdicao ? formatUltimaAtualizacaoBR(r.ultimaEdicao) : null;

  // Linha azul se aprovado (prevalece). Barra esquerda azul quando aprovado+prioridade.
  const rowBase =
    r.isAprovado
      ? "bg-blue-50 hover:bg-blue-100"
      : r.isPrioridade
      ? "bg-rose-50 hover:bg-rose-100"
      : "hover:bg-blue-50";

  const leftBar = r.isPrioridade
    ? r.isAprovado
      ? "border-l-4 border-l-blue-500"
      : "border-l-4 border-l-rose-500"
    : "border-l-0";

  return (
    <tr className={`transition-colors border-b border-gray-100 ${rowBase} ${leftBar}`}>
      {/* Município + selos */}
      <td className="px-4 py-3 align-top">
        <div className="flex items-center gap-2 flex-wrap">
          <div
            {...noTranslateProps}
            className="font-semibold text-gray-900 text-sm break-words"
          >
            {r.municipio}
          </div>
          {r.isPrioridade && <PriorityPill />}
          {r.isAprovado && <ApprovedPill />}
        </div>
      </td>

      {/* Protocolo (azul clicável, sem sublinhado) */}
      <td className="px-3 py-3 align-top">
        <div className="font-mono text-xs whitespace-nowrap">
          {linkEProtocolo ? (
            <a
              href={linkEProtocolo}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-700 no-underline font-semibold transition-colors cursor-pointer flex items-center gap-1"
              title={`Abrir protocolo ${r.protocolo} no eProtocolo`}
              {...noTranslateProps}
            >
              <span className="text-xs" aria-hidden>
                🔗
              </span>
              {r.protocolo}
            </a>
          ) : (
            <span className="text-gray-700" {...noTranslateProps}>
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
            className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold border ${secretariaStyle.bg} ${secretariaStyle.text} ${secretariaStyle.border}`}
          >
            <span className="text-sm">{secretariaStyle.icon}</span>
            {secretariaStyle.label}
          </span>
        </div>
      </td>

      {/* Descrição + atualização + selo APROVADO pequeno */}
      <td className="px-4 py-3 align-top">
        <div className="space-y-2">
          {r.nomeEstrada && (
            <div
              className={`font-bold text-sm ${
                r.isAprovado ? "text-blue-700" : r.isPrioridade ? "text-red-900" : "text-gray-900"
              }`}
              {...noTranslateProps}
            >
              🛣️ {r.nomeEstrada}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {r.isAprovado && <ApprovedPill small />}
            {r.estado && (
              <span className="text-gray-600 text-sm">{r.estado}</span>
            )}
            {ultimaFmt && (
              <span className="text-red-500 text-xs font-medium ml-1 whitespace-nowrap">
                🕐 Última Atualização: {ultimaFmt}
              </span>
            )}
          </div>
        </div>
      </td>

      {/* Valor */}
      <td className="px-4 py-3 text-right align-top">
        <div
          className={`font-bold text-sm whitespace-nowrap ${
            r.isPrioridade ? "text-red-600" : "text-green-600"
          }`}
        >
          {r.valor}
        </div>
      </td>
    </tr>
  );
};

/* ======================= Página ======================= */
export default function EstradasRurais() {
  const { fetchWithCache } = useDataCache();

  // estado filtros
  const [dados, setDados] = useState([]);
  const [erro, setErro] = useState(null);
  const [carregando, setCarregando] = useState(true);

  const [buscaMunicipio, setBuscaMunicipio] = useState("");
  const [buscaEstrada, setBuscaEstrada] = useState("");
  const [buscaDescricao, setBuscaDescricao] = useState(""); // Situação
  const [filtroSecretaria, setFiltroSecretaria] = useState("");

  // protocolo
  const [filtroProtocolo, setFiltroProtocolo] = useState("");
  const [protocoloError, setProtocoloError] = useState("");

  const [apenasPrioridades, setApenasPrioridades] = useState(false);
  const [apenasAprovados, setApenasAprovados] = useState(false);
  const [sortBy, setSortBy] = useState("municipio");
  const [sortDir, setSortDir] = useState("asc");
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshIntervalSeconds, setRefreshIntervalSeconds] = useState(30);
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState(null);
  const intervalRef = useRef(null);

  // máscara/validação do protocolo
  const extractNumbers = (s) => (s || "").replace(/\D/g, "");
  const formatProtocoloMask = (v) => {
    const n = extractNumbers(v).slice(0, 9);
    if (n.length <= 2) return n;
    if (n.length <= 5) return `${n.slice(0, 2)}.${n.slice(2)}`;
    if (n.length <= 8) return `${n.slice(0, 2)}.${n.slice(2, 5)}.${n.slice(5)}`;
    return `${n.slice(0, 2)}.${n.slice(2, 5)}.${n.slice(5, 8)}-${n.slice(8)}`;
  };
  const validateProtocolo = (s) => {
    const n = extractNumbers(s);
    if (!n.length) return { valid: true, error: "" };
    if (n.length < 9) return { valid: false, error: `Protocolo incompleto (${n.length}/9 dígitos)` };
    if (n.length > 9) return { valid: false, error: `Protocolo muito longo (${n.length}/9 dígitos)` };
    return { valid: true, error: "" };
  };
  const handleProtocoloChange = (e) => {
    const masked = formatProtocoloMask(e.target.value);
    const { error } = validateProtocolo(masked);
    setFiltroProtocolo(masked);
    setProtocoloError(error);
    setPage(1);
  };

  // fetch
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
            "Planilha sem valores (data.values vazio). Verifique permissões e intervalo A:I"
          );
          setCarregando(false);
          return;
        }

        const rows = data.values
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
            const estado = (c[3] || "").toString().trim(); // Situação
            const descricao = (c[4] || "").toString().trim();
            const valor = (c[5] || "").toString().trim();
            const prioridadeRaw = (c[6] || "").toString().trim().toLowerCase();
            const ultimaEdicao = (c[7] || "").toString().trim();
            const aprovadoRawI = norm(c[8] || ""); // Coluna I (se vier)

            // Fallback: se Coluna I não vier, marcamos aprovado se "aprovado" constar em Situação/Descrição
            const aprovadoFallback =
              norm(estado).includes("aprovado") || norm(descricao).includes("aprovado");

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
              isAprovado: aprovadoRawI.includes("aprovado") || aprovadoFallback,
            };
          });

        // Fallback: garante 1 prioridade por município se não tiver nenhuma explícita
        const used = new Set();
        const hasExplicit = {};
        rows.forEach((r) => {
          const k = r.municipio.toLowerCase();
          if (!hasExplicit[k]) hasExplicit[k] = false;
          if (r.isPrioridade) hasExplicit[k] = true;
        });
        rows.forEach((r) => {
          const k = r.municipio.toLowerCase();
          if (hasExplicit[k]) return; // mantém as prioridades explícitas
          if (!used.has(k) && r.municipio !== "Não informado") {
            r.isPrioridade = true;
            used.add(k);
          }
        });

        setDados(rows);
        setUltimaAtualizacao(new Date());
      } catch (e) {
        if (e.name !== "AbortError") setErro(e.message || String(e));
      } finally {
        setCarregando(false);
      }
    },
    [fetchWithCache]
  );

  useEffect(() => {
    fetchData();
    return () => intervalRef.current && clearInterval(intervalRef.current);
  }, [fetchData]);

  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current && clearInterval(intervalRef.current);
      intervalRef.current = setInterval(
        () => fetchData(true),
        Math.max(5, refreshIntervalSeconds) * 1000
      );
    } else {
      intervalRef.current && clearInterval(intervalRef.current);
    }
    return () => intervalRef.current && clearInterval(intervalRef.current);
  }, [autoRefresh, refreshIntervalSeconds, fetchData]);

  // listas derivadas
  const opcoesMunicipio = useMemo(
    () =>
      Array.from(new Set(dados.map((d) => d.municipio).filter(Boolean))).sort(
        (a, b) => (norm(a) < norm(b) ? -1 : 1)
      ),
    [dados]
  );

  const filtrados = useMemo(() => {
    const lbMun = norm(buscaMunicipio);
    const leEstrada = norm(buscaEstrada);
    const ldDesc = norm(buscaDescricao);
    const numFiltro = (filtroProtocolo || "").replace(/\D/g, "");

    const out = dados.filter((d) => {
      if (lbMun && !norm(d.municipio).includes(lbMun)) return false;

      if (leEstrada) {
        const ne = norm(d.nomeEstrada || "");
        const nd = norm(d.descricao || "");
        if (!(ne.includes(leEstrada) || nd.includes(leEstrada))) return false;
      }

      if (ldDesc && !norm(d.estado || "").includes(ldDesc)) return false;

      if (apenasPrioridades && !d.isPrioridade) return false;
      if (filtroSecretaria && d.secretaria !== filtroSecretaria) return false;

      if (numFiltro) {
        const np = (d.protocolo || "").replace(/\D/g, "");
        if (!np.includes(numFiltro)) return false;
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
        va = String(va || "").toLowerCase();
        vb = String(vb || "").toLowerCase();
      }
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    return out;
  }, [
    dados,
    buscaMunicipio,
    buscaEstrada,
    buscaDescricao,
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

  // ações
  const exportCSV = () => {
    const headers = [
      "Município",
      "Protocolo",
      "Secretaria",
      "Situação",
      "Descrição",
      "Valor",
      "Ultima Atualização",
      "Aprovado",
    ];
    const rows = filtrados.map((r) => [
      r.municipio,
      r.protocolo,
      r.secretaria,
      r.estado,
      r.descricao,
      r.valor,
      r.ultimaEdicao || "",
      r.isAprovado ? "APROVADO" : "",
    ]);
    const csv = [headers, ...rows]
      .map((line) =>
        line.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "estradas_rurais_export.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const imprimir = () => {
    const dataAtual = new Date().toLocaleDateString("pt-BR");
    const horaAtual = new Date().toLocaleTimeString("pt-BR");
    const conteudo = `
      <html>
      <head><meta charset="utf-8" /><title>Relatório de Estradas</title>
      <style>
        @page{margin:2cm;size:A4}
        body{font-family:Arial,sans-serif;font-size:12px;line-height:1.4}
        table{width:100%;border-collapse:collapse;margin-top:10px}
        th,td{border:1px solid #ddd;padding:6px;text-align:left}
        th{background:#f2f2f2}.valor{text-align:right;font-weight:bold}
        .pill{display:inline-block;padding:2px 8px;border-radius:999px;font-weight:700;font-size:11px;border:1px solid #93c5fd;color:#1d4ed8;background:#dbeafe;margin-left:6px}
        .priority{display:inline-block;padding:2px 8px;border-radius:999px;font-weight:700;font-size:11px;background:#fda4af;color:#fff;margin-left:6px}
      </style></head>
      <body>
        <h2 style="text-align:center">🛣️ Relatório de Estradas Rurais</h2>
        <div style="text-align:center">Data/Hora: ${dataAtual} ${horaAtual}</div>
        <div style="text-align:center">Total: ${filtrados.length} | Valor total: ${sumFilteredValues.toLocaleString(
          "pt-BR",
          { style: "currency", currency: "BRL" }
        )}</div>
        <table>
          <thead><tr>
            <th>Município</th><th>Protocolo</th><th>Secretaria</th>
            <th>Descrição/Situação</th><th>Última Atualização</th><th>Valor</th>
          </tr></thead>
          <tbody>
            ${filtrados
              .map(
                (r) => `<tr>
                <td>${r.municipio}
                  ${r.isPrioridade ? '<span class="priority">PRIORIDADE</span>' : ''}
                  ${r.isAprovado ? '<span class="pill">APROVADO</span>' : ''}
                </td>
                <td>${r.protocolo || "-"}</td>
                <td>${r.secretaria || "-"}</td>
                <td>
                  ${r.descricao || r.nomeEstrada || "-"}
                  ${r.isAprovado ? '<span class="pill">APROVADO</span>' : ""}
                </td>
                <td>${r.ultimaEdicao || "-"}</td>
                <td class="valor">${r.valor}</td>
              </tr>`
              )
              .join("")}
          </tbody>
        </table>
      </body></html>`;
    const w = window.open("", "_blank");
    w.document.write(conteudo);
    w.document.close();
    w.print();
  };

  const clearFilters = () => {
    setBuscaMunicipio("");
    setBuscaEstrada("");
    setBuscaDescricao("");
    setFiltroSecretaria("");
    setFiltroProtocolo("");
    setProtocoloError("");
    setApenasPrioridades(false);
  };

  const toggleSort = (col) => {
    if (sortBy === col) setSortDir((s) => (s === "asc" ? "desc" : "asc"));
    else {
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

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-blue-50 to-gray-100 p-4 md:p-6"
      {...noTranslateProps}
    >
      <div className="max-w-7xl mx-auto">
        {/* Header */}
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
                className="px-4 py-2 rounded-lg bg-blue-600 text-white shadow-lg hover:bg-blue-700 transition-colors"
                title="Atualizar dados agora"
              >
                🔄 Atualizar Agora
              </button>
              <button
                onClick={() => setApenasPrioridades(!apenasPrioridades)}
                className={`px-4 py-2 rounded-lg shadow-lg transition-colors ${
                  apenasPrioridades
                    ? "bg-red-600 text-white hover:bg-red-700"
                    : "bg-gray-200 text-gray-700 hover:bg-gray-300"
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
            </div>
          </div>
        </header>

        {/* Resumo */}
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
          <ResumoCard titulo="SEAB (Agricultura)" valor={totalSeab} emoji="🌱" cor="green" />
          <ResumoCard titulo="SECID (Cidades)" valor={totalSecid} emoji="🏙️" cor="blue" />
        </div>

        {/* Filtros */}
        <section className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            🔍 Filtros de Busca
          </h2>

          {/* Secretaria */}
          <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-green-50 rounded-lg border border-gray-200">
            <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
              🏢 Filtrar por Secretaria
            </h3>
            <div className="flex gap-3 flex-wrap">
              <BotaoFiltro
                ativo={filtroSecretaria === ""}
                onClick={() => setFiltroSecretaria("")}
                label="📊 TODAS"
                corAtivo="bg-gray-600 text-white"
                corInativo="bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200"
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

          {/* Linha 1 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <AutoCompleteInput
              label="🏛️ Município"
              value={buscaMunicipio}
              onChange={(v) => {
                setBuscaMunicipio(v);
                setPage(1);
              }}
              onSelect={(v) => {
                setBuscaMunicipio(v);
                setPage(1);
              }}
              placeholder="Digite o nome do município…"
              options={opcoesMunicipio}
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

          {/* Linha 2 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <CampoTexto
              label="📝 Descrição (Situação)"
              value={buscaDescricao}
              onChange={(e) => {
                setBuscaDescricao(e.target.value);
                setPage(1);
              }}
              placeholder="Ex.: Em análise, Plano de trabalho, Aprovado…"
            />

            {/* Protocolo */}
            <ProtocoloInput
              value={filtroProtocolo}
              onChange={handleProtocoloChange}
              error={protocoloError}
            />
          </div>

          {/* Controles */}
          <div className="mt-4 flex flex-col md:flex-row gap-3 items-start md:items-end justify-end">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              Auto-refresh
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={5}
                value={refreshIntervalSeconds}
                onChange={(e) => setRefreshIntervalSeconds(Number(e.target.value))}
                className="p-2 w-24 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-500">segundos</span>
            </div>
            <button
              onClick={clearFilters}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
            >
              🗑️ Limpar Filtros
            </button>
          </div>
        </section>

        {/* Tabela */}
        <section className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="px-6 py-4 bg-gray-50 border-b">
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              📋 Dados das Estradas Rurais
            </h2>
          </div>

          {carregando ? (
            <div className="p-12 text-center">
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600 text-lg">Carregando dados…</p>
            </div>
          ) : erro ? (
            <div className="p-12 text-center">
              <div className="text-6xl mb-4">⚠️</div>
              <p className="text-red-600 text-lg font-medium">Erro: {erro}</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full table-auto">
                  <colgroup>
                    <col style={{ width: "200px" }} />
                    <col style={{ width: "150px" }} />
                    <col style={{ width: "140px" }} />
                    <col style={{ minWidth: "350px" }} />
                    <col style={{ width: "140px" }} />
                  </colgroup>
                  <thead className="bg-gradient-to-r from-blue-50 to-blue-100 sticky top-0">
                    <tr>
                      <Th
                        onClick={() => toggleSort("municipio")}
                        active={sortBy === "municipio"}
                        dir={sortDir}
                      >
                        🏛️ Município
                      </Th>
                      <th className="px-3 py-3 text-left text-xs font-bold text-gray-700">
                        📄 Protocolo
                      </th>
                      <Th
                        onClick={() => toggleSort("secretaria")}
                        active={sortBy === "secretaria"}
                        dir={sortDir}
                        align="center"
                      >
                        🏢 Secretaria
                      </Th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-700">
                        📝 Estrada & Descrição
                      </th>
                      <Th
                        onClick={() => toggleSort("valor")}
                        active={sortBy === "valor"}
                        dir={sortDir}
                        align="right"
                      >
                        💰 Valor
                      </Th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageData.map((r, i) => (
                      <TabelaLinha key={`${r.municipio}-${r.protocolo}-${i}`} r={r} />
                    ))}
                    {pageData.length === 0 && (
                      <tr>
                        <td className="px-4 py-6 text-center text-gray-600" colSpan={5}>
                          Nenhum registro encontrado com os filtros atuais.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Paginação */}
              <div className="flex items-center justify-between px-6 py-4 border-t bg-gray-50">
                <div className="text-sm text-gray-600">
                  Página {page} de {totalPages} • {total} registros
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-700">Linhas por página:</label>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setPage(1);
                    }}
                    className="p-2 border border-gray-300 rounded-lg"
                  >
                    {[10, 25, 50, 100].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                  <div className="flex items-center gap-2 ml-4">
                    <PageBtn disabled={page <= 1} onClick={() => setPage(1)}>
                      «
                    </PageBtn>
                    <PageBtn disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                      ‹
                    </PageBtn>
                    <PageBtn
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    >
                      ›
                    </PageBtn>
                    <PageBtn disabled={page >= totalPages} onClick={() => setPage(totalPages)}>
                      »
                    </PageBtn>
                  </div>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
