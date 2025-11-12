import React, { useEffect, useMemo, useState, useRef } from "react";
import * as XLSX from "xlsx";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

// Catálogo fixo para EMENDA DE BANCADA (valores já definidos)
const CATALOGO_BANCADA = [
  { nome: "Trator de Esteiras", preco: 1222500.0 },
  { nome: "Motoniveladora", preco: 1217352.22 },
  { nome: "Caminhão Caçamba 6x4", preco: 905300.0 },
  { nome: "Caminhão Prancha", preco: 900000.0 },
  { nome: "Escavadeira", preco: 830665.0 },
  { nome: "Pá Carregadeira", preco: 778250.0 },
  { nome: "Rolo compactador", preco: 716180.91 },
  { nome: "Retroescavadeira", preco: 484111.11 },
  { nome: "Bob Cat", preco: 430000.0 },
  { nome: "Trator 100–110CV", preco: 410000.0 },
];

const fmtBRL = (v = 0) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    Number(v || 0)
  );
const toNumberBRL = (input) => {
  if (typeof input === "number") return input;
  const digits = String(input || "").replace(/\D/g, "");
  return digits ? Number(digits) / 100 : 0;
};

const KEY = "maquinarios-municipios-v4";

// -------- utils de normalização --------
const norm = (s) =>
  (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();

/* ======================= AUTOCOMPLETE DE MUNICÍPIO ======================= */
function AutocompleteMunicipio({
  value,
  onChange,
  onBlurCanonicalize,
  options = [], // [{id, nome}]
  placeholder = "Ex.: Cascavel",
  label = "Nome do município",
  helper = "Digite para filtrar e selecione o nome oficial (IBGE).",
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value || "");
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef(null);
  const listRef = useRef(null);

  // fecha ao clicar fora
  useEffect(() => {
    const handler = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => setQuery(value || ""), [value]);

  const filtered = useMemo(() => {
    const q = norm(query);
    if (!q) return options.slice(0, 50);
    return options.filter((o) => norm(o.nome).includes(q)).slice(0, 50);
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    setHighlight(0);
  }, [open, query]);

  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector(`[data-idx="${highlight}"]`);
    el?.scrollIntoView?.({ block: "nearest" });
  }, [highlight, open]);

  const selectValue = (nome) => {
    onChange?.(nome);
    setQuery(nome);
    setOpen(false);
    onBlurCanonicalize?.(nome);
  };

  const handleKeyDown = (e) => {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter")) {
      setOpen(true);
      return;
    }
    if (!open) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[highlight]) selectValue(filtered[highlight].nome);
      else if (query) selectValue(query);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    }
  };

  const renderWithMark = (nome) => {
    const q = norm(query);
    if (!q) return nome;
    const ni = norm(nome);
    const idx = ni.indexOf(q);
    if (idx === -1) return nome;
    const start = nome.slice(0, idx);
    const mid = nome.slice(idx, idx + query.length);
    const end = nome.slice(idx + query.length);
    return (
      <>
        {start}
        <mark className="bg-yellow-200 rounded px-0.5">{mid}</mark>
        {end}
      </>
    );
  };

  return (
    <div ref={wrapRef} className="relative">
      {label && <label className="block text-sm text-gray-700 mb-1">{label}</label>}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <input
            className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
            value={query}
            placeholder={placeholder}
            onChange={(e) => {
              setQuery(e.target.value);
              onChange?.(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={handleKeyDown}
          />
          {!!value && value === query && (
            <div className="absolute right-2 top-1/2 -translate-y-1/2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
              IBGE
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="px-3 py-2 border rounded-lg text-sm hover:bg-gray-50"
          title="Mostrar lista"
        >
          ▼
        </button>
      </div>

      {helper && <p className="text-xs text-gray-500 mt-1">{helper}</p>}

      {open && (
        <div
          ref={listRef}
          className="absolute z-50 mt-2 w-full max-h-72 overflow-auto bg-white border rounded-xl shadow-xl"
        >
          {filtered.length === 0 ? (
            <div className="p-3 text-sm text-gray-500">Nenhum resultado.</div>
          ) : (
            filtered.map((o, idx) => (
              <button
                key={o.id}
                type="button"
                data-idx={idx}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selectValue(o.nome)}
                className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between ${
                  idx === highlight ? "bg-green-50" : "hover:bg-gray-50"
                }`}
                onMouseEnter={() => setHighlight(idx)}
              >
                <span className="truncate">{renderWithMark(o.nome)}</span>
                <span className="text-[10px] uppercase tracking-wider text-gray-400 ml-3">
                  Oficial IBGE
                </span>
              </button>
            ))
          )}
          <div className="border-t my-1"></div>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => selectValue(query || "")}
            className="w-full text-left px-3 py-2 text-xs text-gray-600 hover:bg-gray-50"
          >
            Usar exatamente: <span className="font-medium">“{query || "—"}”</span>
          </button>
        </div>
      )}
    </div>
  );
}

/* ======================= PÁGINA ======================= */
export default function PedidosMaquinarios() {
  const [lista, setLista] = useState([]);
  const [busca, setBusca] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [detalheId, setDetalheId] = useState(null);
  const [salvando, setSalvando] = useState(false);

  // --- municípios do PR (IBGE) para autocomplete ---
  const [municipiosPR, setMunicipiosPR] = useState([]); // [{id, nome}]
  const [mapCanonico, setMapCanonico] = useState({}); // norm(nome)->NomeCanônico

  const blankForm = {
    nome: "",
    obs: "",
    m37: {
      protocolo: "",
      valor_global: 0,
      valor_seab: 0,
      contrapartida: 0,
      itensManuais: [],
    },
    bancada: {
      protocolo: "",
      itensCatalogo: [],
    },
  };
  const [form, setForm] = useState(blankForm);

  // -------- persistência (backend -> localStorage) --------
  const load = async () => {
    try {
      if (!BACKEND_URL) throw new Error("no-backend");
      const r = await fetch(`${BACKEND_URL}/api/maquinarios/municipios`, {
        credentials: "include",
      });
      if (!r.ok) throw new Error("backend-error");
      const data = await r.json();
      setLista(Array.isArray(data) ? data : []);
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch {
      const raw = localStorage.getItem(KEY);
      setLista(raw ? JSON.parse(raw) : []);
    }
  };

  const saveAll = async (data) => {
    setLista(data);
    localStorage.setItem(KEY, JSON.stringify(data));
    try {
      if (!BACKEND_URL) throw new Error("no-backend");
      await fetch(`${BACKEND_URL}/api/maquinarios/municipios`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    } catch {
      // fallback ok
    }
  };

  // -------- carregar municípios PR (IBGE) --------
  const loadMunicipiosPR = async () => {
    try {
      const r = await fetch(
        "https://servicodados.ibge.gov.br/api/v1/localidades/estados/41/municipios"
      );
      if (!r.ok) throw new Error("ibge-error");
      const data = await r.json();
      const ordenados = (data || [])
        .map((m) => ({ id: m.id, nome: m.nome }))
        .sort((a, b) => norm(a.nome).localeCompare(norm(b.nome)));
      setMunicipiosPR(ordenados);
      const map = {};
      ordenados.forEach((m) => (map[norm(m.nome)] = m.nome));
      setMapCanonico(map);
    } catch {
      setMunicipiosPR([]);
      setMapCanonico({});
    }
  };

  useEffect(() => {
    load();
    loadMunicipiosPR();
  }, []);

  // -------- helpers --------
  const total = (arr) =>
    (arr || []).reduce((sum, i) => sum + Number(i.subtotal || 0), 0);

  const dashboard = useMemo(() => {
    const totalMunicipios = lista.length;
    const somaM37 = lista.reduce(
      (acc, m) => acc + Number(m?.m37?.valor_global || 0) + 0,
      0
    );
    const somaBancadaItens = lista.reduce(
      (acc, m) => acc + total(m?.bancada?.itensCatalogo),
      0
    );
    return { totalMunicipios, somaM37, somaBancadaItens };
  }, [lista]);

  const listaFiltrada = useMemo(() => {
    const q = norm(busca);
    return [...lista]
      .sort((a, b) => norm(a.nome).localeCompare(norm(b.nome)))
      .filter(
        (m) =>
          !q ||
          norm(m.nome).includes(q) ||
          norm(m?.obs).includes(q) ||
          norm(m?.m37?.protocolo).includes(q) ||
          norm(m?.bancada?.protocolo).includes(q)
      );
  }, [lista, busca]);

  // -------- modal --------
  const openCreate = () => {
    setEditingId(null);
    setForm(blankForm);
    setShowModal(true);
  };

  const openEdit = (m) => {
    setEditingId(m.id);
    setForm({
      nome: m.nome || "",
      obs: m.obs || "",
      m37: {
        protocolo: m?.m37?.protocolo || "",
        valor_global: Number(m?.m37?.valor_global || 0),
        valor_seab: Number(m?.m37?.valor_seab || 0),
        contrapartida: Number(m?.m37?.contrapartida || 0),
        itensManuais: m?.m37?.itensManuais || [],
      },
      bancada: {
        protocolo: m?.bancada?.protocolo || "",
        itensCatalogo: m?.bancada?.itensCatalogo || [],
      },
    });
    setShowModal(true);
  };

  // Garantir nome canônico do IBGE ao sair do input ou salvar
  const canonicalizeNome = (nomeDigitado) => {
    const n = norm(nomeDigitado);
    if (!n) return "";
    if (mapCanonico[n]) return mapCanonico[n];
    const candidato = municipiosPR.find((m) => norm(m.nome).startsWith(n));
    if (candidato) return candidato.nome;
    return nomeDigitado;
  };

  const handleSave = async (e) => {
    e?.preventDefault?.();
    setSalvando(true);
    try {
      const payload = {
        id: editingId || Date.now(),
        ...form,
        nome: canonicalizeNome(form.nome),
      };
      const novo = editingId
        ? lista.map((m) => (m.id === editingId ? payload : m))
        : [...lista, payload];
      await saveAll(novo);
      setShowModal(false);
      setEditingId(null);
      setForm(blankForm);
    } finally {
      setSalvando(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Excluir este município?")) return;
    await saveAll(lista.filter((m) => m.id !== id));
  };

  // -------- Itens: 3.7mi (manuais) --------
  const addItemM37 = () =>
    setForm((p) => ({
      ...p,
      m37: {
        ...p.m37,
        itensManuais: [
          ...(p.m37.itensManuais || []),
          {
            descricao: "",
            preco_unitario: 0,
            quantidade: 1,
            subtotal: 0,
            observacao: "",
          },
        ],
      },
    }));

  const rmItemM37 = (idx) =>
    setForm((p) => ({
      ...p,
      m37: {
        ...p.m37,
        itensManuais: (p.m37.itensManuais || []).filter((_, i) => i !== idx),
      },
    }));

  const updItemM37 = (idx, field, value) =>
    setForm((p) => {
      const itens = [...(p.m37.itensManuais || [])];
      const row = { ...itens[idx], [field]: value };

      if (field === "quantidade") {
        const qtd = Math.max(1, Number(value || 1));
        row.quantidade = qtd;
      }
      if (field === "preco_unitario") {
        row.preco_unitario = Number(value || 0);
      }
      row.subtotal =
        Number(row.preco_unitario || 0) * Number(row.quantidade || 1);

      itens[idx] = row;
      return { ...p, m37: { ...p.m37, itensManuais: itens } };
    });

  // -------- Itens: Bancada (catálogo fixo) --------
  const addItemBancada = () =>
    setForm((p) => ({
      ...p,
      bancada: {
        ...p.bancada,
        itensCatalogo: [
          ...(p.bancada.itensCatalogo || []),
          {
            equipamento: "",
            preco_unitario: 0,
            quantidade: 1,
            subtotal: 0,
            observacao: "",
          },
        ],
      },
    }));

  const rmItemBancada = (idx) =>
    setForm((p) => ({
      ...p,
      bancada: {
        ...p.bancada,
        itensCatalogo: (p.bancada.itensCatalogo || []).filter((_, i) => i !== idx),
      },
    }));

  const updItemBancada = (idx, field, value) =>
    setForm((p) => {
      const itens = [...(p.bancada.itensCatalogo || [])];
      const row = { ...itens[idx], [field]: value };

      if (field === "equipamento") {
        const preco =
          CATALOGO_BANCADA.find((c) => c.nome === value)?.preco || 0;
        row.preco_unitario = preco;
        row.subtotal = preco * Number(row.quantidade || 1);
      }
      if (field === "quantidade") {
        const qtd = Math.max(1, Number(value || 1));
        row.quantidade = qtd;
        row.subtotal = Number(row.preco_unitario || 0) * qtd;
      }

      itens[idx] = row;
      return { ...p, bancada: { ...p.bancada, itensCatalogo: itens } };
    });

  // -------- Export Excel --------
  const exportExcel = () => {
    const rows = [];
    listaFiltrada.forEach((m) => {
      // 3.7mi (manuais)
      (m?.m37?.itensManuais || []).forEach((i) =>
        rows.push({
          Programa: "Maquinários de 3.7mi",
          Município: m.nome,
          Protocolo: m?.m37?.protocolo || "-",
          "Valor Global": m?.m37?.valor_global || 0,
          "Valor SEAB": m?.m37?.valor_seab || 0,
          Contrapartida: m?.m37?.contrapartida || 0,
          Item: i.descricao || "-",
          "Preço Unitário": i.preco_unitario || 0,
          Quantidade: i.quantidade || 0,
          Subtotal: i.subtotal || 0,
          Observação: i.observacao || "-",
        })
      );

      // Emenda de Bancada (catálogo fixo)
      (m?.bancada?.itensCatalogo || []).forEach((i) =>
        rows.push({
          Programa: "Emenda de Bancada",
          Município: m.nome,
          Protocolo: m?.bancada?.protocolo || "-",
          Item: i.equipamento || "-",
          "Preço Unitário": i.preco_unitario || 0,
          Quantidade: i.quantidade || 0,
          Subtotal: i.subtotal || 0,
          Observação: i.observacao || "-",
        })
      );

      if (
        (m?.m37?.itensManuais || []).length === 0 &&
        (m?.bancada?.itensCatalogo || []).length === 0
      ) {
        rows.push({
          Programa: "-",
          Município: m.nome,
          Protocolo: "-",
          "Valor Global": m?.m37?.valor_global || 0,
          "Valor SEAB": m?.m37?.valor_seab || 0,
          Contrapartida: m?.m37?.contrapartida || 0,
          Item: "-",
          "Preço Unitário": 0,
          Quantidade: 0,
          Subtotal: 0,
          Observação: m.obs || "-",
        });
      }
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Municípios");
    XLSX.writeFile(
      wb,
      `maquinarios_municipios_${new Date().toISOString().slice(0, 10)}.xlsx`
    );
  };

  // -------- UI --------
  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-green-50 to-teal-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 flex items-center gap-3">
            🚜 Municípios — Maquinários de 3.7mi & Emenda de Bancada
          </h1>
          <p className="text-gray-600">Todos os campos são opcionais.</p>
        </div>

        {/* Barra ações (FILTRO BONITO IGUAL AO V2) */}
        <div className="bg-white rounded-xl shadow p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-3 items-start md:items-center justify-between">
            <div className="w-full md:w-1/2">
              <AutocompleteMunicipio
                value={busca}
                onChange={setBusca}
                options={municipiosPR}
                label="Filtrar por município"
                placeholder="Digite para buscar/selecionar…"
                helper="Dica: você também pode digitar protocolo ou observação no campo ao lado."
              />
            </div>

            <div className="flex-1 w-full md:w-auto">
              <label className="block text-sm text-gray-700 mb-1">
                Texto livre (protocolo/observação)
              </label>
              <div className="relative">
                <input
                  className="w-full md:w-80 px-3 py-2 border rounded-lg pr-10"
                  placeholder="Ex.: SEI-000123 / pneu / caçamba…"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                />
                {busca && (
                  <button
                    type="button"
                    onClick={() => setBusca("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    title="Limpar"
                  >
                    ✖
                  </button>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                O filtro procura por município, protocolo e observação.
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg"
              >
                🖨️ Imprimir
              </button>
              <button
                onClick={exportExcel}
                className="px-4 py-2 bg-green-600 text-white rounded-lg"
              >
                📊 Exportar Excel
              </button>
              <button
                onClick={openCreate}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg"
              >
                + Adicionar Município
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between mt-2">
            <div className="text-sm text-gray-600">
              {listaFiltrada.length} de {lista.length} município(s) listados
            </div>
            {busca && (
              <button
                type="button"
                onClick={() => setBusca("")}
                className="text-sm text-gray-700 underline"
              >
                Limpar filtro
              </button>
            )}
          </div>
        </div>

        {/* Lista */}
        {listaFiltrada.length === 0 ? (
          <div className="bg-white rounded-xl shadow p-12 text-center text-gray-500">
            Nenhum município cadastrado.
          </div>
        ) : (
          <div className="space-y-4">
            {listaFiltrada.map((m) => {
              const totBancada = total(m?.bancada?.itensCatalogo);
              const totM37 = Number(m?.m37?.valor_global || 0);
              return (
                <div key={m.id} className="bg-white rounded-xl shadow overflow-hidden">
                  <div className="bg-gradient-to-r from-green-600 to-green-700 text-white p-4 flex justify-between items-start">
                    <div>
                      <div className="text-2xl font-bold">{m.nome || "—"}</div>
                      {m.obs && (
                        <div className="text-green-100 text-sm mt-1">📝 {m.obs}</div>
                      )}
                      {(m?.m37?.protocolo || m?.bancada?.protocolo) && (
                        <div className="text-green-100 text-xs mt-1">
                          {m?.m37?.protocolo && (
                            <span className="mr-3">📄 3.7mi: {m.m37.protocolo}</span>
                          )}
                          {m?.bancada?.protocolo && (
                            <span>📄 Bancada: {m.bancada.protocolo}</span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-green-100">Valor Global (3.7mi)</div>
                      <div className="text-2xl font-bold">{fmtBRL(totM37)}</div>
                    </div>
                  </div>

                  <div className="p-4 grid md:grid-cols-3 gap-4">
                    <Info k="Valor SEAB (3.7mi)" v={fmtBRL(m?.m37?.valor_seab || 0)} />
                    <Info k="Contrapartida (3.7mi)" v={fmtBRL(m?.m37?.contrapartida || 0)} />
                    <Info k="Itens (Bancada)" v={fmtBRL(totBancada)} />

                    <div className="md:col-span-3 flex items-center justify-end gap-2">
                      <button
                        onClick={() =>
                          setDetalheId((id) => (id === m.id ? null : m.id))
                        }
                        className="px-3 py-2 bg-indigo-600 text-white rounded-lg"
                      >
                        👁️ Ver detalhes
                      </button>
                      <button
                        onClick={() => openEdit(m)}
                        className="px-3 py-2 bg-blue-600 text-white rounded-lg"
                      >
                        ✏️ Editar
                      </button>
                      <button
                        onClick={() => handleDelete(m.id)}
                        className="px-3 py-2 bg-red-600 text-white rounded-lg"
                      >
                        🗑️ Excluir
                      </button>
                    </div>
                  </div>

                  {detalheId === m.id && (
                    <div className="px-4 pb-4">
                      <div className="grid md:grid-cols-2 gap-4">
                        <DetalhesM37 bloco={m.m37} />
                        <DetalhesBancada bloco={m.bancada} />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* MODAL criar/editar */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto">
              <form onSubmit={handleSave}>
                <div className="p-6 space-y-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold">
                      {editingId ? "Editar Município" : "Adicionar Município"}
                    </h2>
                    <button
                      type="button"
                      onClick={() => setShowModal(false)}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      ✖
                    </button>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    {/* AUTOCOMPLETE NOVO */}
                    <AutocompleteMunicipio
                      value={form.nome}
                      onChange={(nome) => setForm((p) => ({ ...p, nome }))}
                      onBlurCanonicalize={(nome) =>
                        setForm((p) => ({ ...p, nome: canonicalizeNome(nome) }))
                      }
                      options={municipiosPR}
                    />
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">
                        Observação (opcional)
                      </label>
                      <input
                        className="w-full border rounded-lg px-3 py-2"
                        value={form.obs}
                        onChange={(e) =>
                          setForm((p) => ({ ...p, obs: e.target.value }))
                        }
                        placeholder="Notas internas…"
                      />
                    </div>
                  </div>

                  {/* Maquinários de 3.7mi (MANUAL) */}
                  <section className="border-t pt-4">
                    <h3 className="text-lg font-semibold mb-3">
                      Maquinários de 3.7mi
                    </h3>

                    <div className="grid md:grid-cols-4 gap-4 mb-3">
                      <div>
                        <label className="block text-sm text-gray-700 mb-1">
                          Protocolo (opcional)
                        </label>
                        <input
                          className="w-full border rounded-lg px-3 py-2"
                          value={form.m37.protocolo}
                          onChange={(e) =>
                            setForm((p) => ({
                              ...p,
                              m37: { ...p.m37, protocolo: e.target.value },
                            }))
                          }
                          placeholder="Ex.: SEI-000000/2025"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-700 mb-1">
                          Valor Global
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          className="w-full border rounded-lg px-3 py-2"
                          value={fmtBRL(form.m37.valor_global || 0)}
                          onChange={(e) =>
                            setForm((p) => ({
                              ...p,
                              m37: {
                                ...p.m37,
                                valor_global: toNumberBRL(e.target.value),
                              },
                            }))
                          }
                          placeholder="0,00"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-700 mb-1">
                          Valor SEAB
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          className="w-full border rounded-lg px-3 py-2"
                          value={fmtBRL(form.m37.valor_seab || 0)}
                          onChange={(e) =>
                            setForm((p) => ({
                              ...p,
                              m37: {
                                ...p.m37,
                                valor_seab: toNumberBRL(e.target.value),
                              },
                            }))
                          }
                          placeholder="0,00"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-700 mb-1">
                          Contrapartida
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          className="w-full border rounded-lg px-3 py-2"
                          value={fmtBRL(form.m37.contrapartida || 0)}
                          onChange={(e) =>
                            setForm((p) => ({
                              ...p,
                              m37: {
                                ...p.m37,
                                contrapartida: toNumberBRL(e.target.value),
                              },
                            }))
                          }
                          placeholder="0,00"
                        />
                      </div>
                    </div>

                    <EditorM37
                      itens={form.m37.itensManuais}
                      addItem={addItemM37}
                      rmItem={rmItemM37}
                      updItem={updItemM37}
                    />
                  </section>

                  {/* Emenda de Bancada (CATÁLOGO FIXO + protocolo) */}
                  <section className="border-t pt-4">
                    <h3 className="text-lg font-semibold mb-3">Emenda de Bancada</h3>

                    <div className="grid md:grid-cols-4 gap-4 mb-3">
                      <div>
                        <label className="block text-sm text-gray-700 mb-1">
                          Protocolo (opcional)
                        </label>
                        <input
                          className="w-full border rounded-lg px-3 py-2"
                          value={form.bancada.protocolo}
                          onChange={(e) =>
                            setForm((p) => ({
                              ...p,
                              bancada: { ...p.bancada, protocolo: e.target.value },
                            }))
                          }
                          placeholder="Ex.: SEI-111111/2025"
                        />
                      </div>
                    </div>

                    <EditorBancada
                      itens={form.bancada.itensCatalogo}
                      addItem={addItemBancada}
                      rmItem={rmItemBancada}
                      updItem={updItemBancada}
                      catalogo={CATALOGO_BANCADA}
                    />
                  </section>
                </div>

                <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 border rounded-lg"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={salvando}
                    className="px-5 py-2 bg-green-600 text-white rounded-lg disabled:opacity-50"
                  >
                    {salvando ? "Salvando…" : editingId ? "Atualizar" : "Salvar"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- SUBCOMPONENTES ---------------- */

function Card({ k, v }) {
  return (
    <div className="bg-white rounded-xl shadow p-4">
      <div className="text-sm text-gray-500">{k}</div>
      <div className="text-xl font-bold">{v}</div>
    </div>
  );
}

function Info({ k, v }) {
  return (
    <div className="bg-gray-50 border rounded-lg p-3">
      <div className="text-xs text-gray-500 mb-1">{k}</div>
      <div className="text-lg font-semibold">{v}</div>
    </div>
  );
}

function EditorM37({ itens, addItem, rmItem, updItem }) {
  const total = (itens || []).reduce((s, i) => s + Number(i.subtotal || 0), 0);

  return (
    <div className="bg-gray-50 rounded-lg p-3 border">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm text-gray-600">
          Itens (manuais) • Total:{" "}
          <span className="font-semibold">
            {new Intl.NumberFormat("pt-BR", {
              style: "currency",
              currency: "BRL",
            }).format(total)}
          </span>
        </div>
        <button
          type="button"
          onClick={addItem}
          className="px-3 py-2 bg-green-600 text-white rounded-lg"
        >
          + Adicionar Item
        </button>
      </div>

      {(!itens || itens.length === 0) ? (
        <div className="text-center text-gray-500 py-6">
          Nenhum item adicionado.
        </div>
      ) : (
        <div className="space-y-3">
          {itens.map((item, idx) => (
            <div
              key={idx}
              className="bg-white rounded-lg border p-3 grid md:grid-cols-4 gap-3 relative"
            >
              <button
                type="button"
                onClick={() => rmItem(idx)}
                className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full w-7 h-7"
                title="Remover"
              >
                ×
              </button>

              <div className="md:col-span-2">
                <label className="block text-sm text-gray-700 mb-1">
                  Descrição do item
                </label>
                <input
                  className="w-full border rounded-lg px-3 py-2"
                  value={item.descricao}
                  onChange={(e) => updItem(idx, "descricao", e.target.value)}
                  placeholder="Ex.: Trator agrícola 110cv"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-700 mb-1">
                  Quantidade
                </label>
                <input
                  type="number"
                  min={1}
                  value={item.quantidade || 1}
                  onChange={(e) => updItem(idx, "quantidade", e.target.value)}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-700 mb-1">
                  Preço unitário
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={fmtBRL(item.preco_unitario || 0)}
                  onChange={(e) =>
                    updItem(idx, "preco_unitario", toNumberBRL(e.target.value))
                  }
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>

              <div className="md:col-span-4">
                <label className="block text-sm text-gray-700 mb-1">
                  Observação (opcional)
                </label>
                <input
                  value={item.observacao || ""}
                  onChange={(e) => updItem(idx, "observacao", e.target.value)}
                  className="w-full border rounded-lg px-3 py-2"
                  placeholder="Ex.: item a diesel"
                />
              </div>

              <div className="md:col-span-4 text-right text-sm">
                Subtotal:{" "}
                <span className="font-semibold">
                  {fmtBRL(item.subtotal || 0)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EditorBancada({ itens, addItem, rmItem, updItem, catalogo }) {
  const total = (itens || []).reduce((s, i) => s + Number(i.subtotal || 0), 0);

  return (
    <div className="bg-gray-50 rounded-lg p-3 border">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm text-gray-600">
          Itens do Catálogo • Total:{" "}
          <span className="font-semibold">{fmtBRL(total)}</span>
        </div>
        <button
          type="button"
          onClick={addItem}
          className="px-3 py-2 bg-green-600 text-white rounded-lg"
        >
          + Adicionar Item
        </button>
      </div>

      {(!itens || itens.length === 0) ? (
        <div className="text-center text-gray-500 py-6">
          Nenhum item adicionado.
        </div>
      ) : (
        <div className="space-y-3">
          {itens.map((item, idx) => (
            <div
              key={idx}
              className="bg-white rounded-lg border p-3 grid md:grid-cols-4 gap-3 relative"
            >
              <button
                type="button"
                onClick={() => rmItem(idx)}
                className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full w-7 h-7"
                title="Remover"
              >
                ×
              </button>

              <div className="md:col-span-2">
                <label className="block text-sm text-gray-700 mb-1">
                  Equipamento
                </label>
                <select
                  className="w-full border rounded-lg px-3 py-2"
                  value={item.equipamento}
                  onChange={(e) => updItem(idx, "equipamento", e.target.value)}
                >
                  <option value="">Selecione…</option>
                  {catalogo.map((c) => (
                    <option key={c.nome} value={c.nome}>
                      {c.nome} — {fmtBRL(c.preco)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-700 mb-1">
                  Quantidade
                </label>
                <input
                  type="number"
                  min={1}
                  value={item.quantidade || 1}
                  onChange={(e) => updItem(idx, "quantidade", e.target.value)}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-700 mb-1">
                  Subtotal (auto)
                </label>
                <input
                  readOnly
                  value={fmtBRL(item.subtotal || 0)}
                  className="w-full border rounded-lg px-3 py-2 bg-green-50 font-semibold"
                />
              </div>

              <div className="md:col-span-4">
                <label className="block text-sm text-gray-700 mb-1">
                  Observação (opcional)
                </label>
                <input
                  value={item.observacao || ""}
                  onChange={(e) => updItem(idx, "observacao", e.target.value)}
                  className="w-full border rounded-lg px-3 py-2"
                  placeholder="Ex.: com pneus novos"
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DetalhesM37({ bloco }) {
  const totalItens = (bloco?.itensManuais || []).reduce(
    (s, i) => s + Number(i.subtotal || 0),
    0
  );
  return (
    <div className="bg-white rounded-lg border shadow p-4">
      <div className="flex items-center justify-between">
        <h4 className="text-lg font-semibold">Maquinários de 3.7mi</h4>
        <div className="text-right text-sm">
          {bloco?.protocolo && <div>📄 Protocolo: {bloco.protocolo}</div>}
          <div>Valor Global: {fmtBRL(bloco?.valor_global || 0)}</div>
          <div>Valor SEAB: {fmtBRL(bloco?.valor_seab || 0)}</div>
          <div>Contrapartida: {fmtBRL(bloco?.contrapartida || 0)}</div>
        </div>
      </div>

      {(bloco?.itensManuais || []).length === 0 ? (
        <div className="text-gray-500 text-sm mt-3">Sem itens.</div>
      ) : (
        <div className="mt-3 space-y-2">
          {bloco.itensManuais.map((i, idx) => (
            <div
              key={idx}
              className="border rounded-lg p-3 bg-gray-50 flex items-center justify-between"
            >
              <div>
                <div className="font-medium">{i.descricao || "-"}</div>
                {i.observacao && (
                  <div className="text-xs text-gray-600">📝 {i.observacao}</div>
                )}
              </div>
              <div className="text-right text-sm">
                <div>Qtd: {i.quantidade || 0}</div>
                <div>Unit: {fmtBRL(i.preco_unitario || 0)}</div>
                <div className="font-semibold">{fmtBRL(i.subtotal || 0)}</div>
              </div>
            </div>
          ))}
          <div className="text-right text-sm">
            Total dos itens: <span className="font-bold">{fmtBRL(totalItens)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function DetalhesBancada({ bloco }) {
  const totalItens = (bloco?.itensCatalogo || []).reduce(
    (s, i) => s + Number(i.subtotal || 0),
    0
  );
  return (
    <div className="bg-white rounded-lg border shadow p-4">
      <div className="flex items-center justify-between">
        <h4 className="text-lg font-semibold">Emenda de Bancada</h4>
        <div className="text-right text-sm">
          {bloco?.protocolo && <div>📄 Protocolo: {bloco.protocolo}</div>}
        </div>
      </div>

      {(bloco?.itensCatalogo || []).length === 0 ? (
        <div className="text-gray-500 text-sm mt-3">Sem itens.</div>
      ) : (
        <div className="mt-3 space-y-2">
          {bloco.itensCatalogo.map((i, idx) => (
            <div
              key={idx}
              className="border rounded-lg p-3 bg-gray-50 flex items-center justify-between"
            >
              <div>
                <div className="font-medium">{i.equipamento}</div>
                {i.observacao && (
                  <div className="text-xs text-gray-600">📝 {i.observacao}</div>
                )}
              </div>
              <div className="text-right text-sm">
                <div>Qtd: {i.quantidade || 0}</div>
                <div>Unit: {fmtBRL(i.preco_unitario || 0)}</div>
                <div className="font-semibold">{fmtBRL(i.subtotal || 0)}</div>
              </div>
            </div>
          ))}
          <div className="text-right text-sm">
            Total dos itens: <span className="font-bold">{fmtBRL(totalItens)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
