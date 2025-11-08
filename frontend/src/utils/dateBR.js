// frontend/src/utils/dateBR.js

// Converte número serial (Excel/Sheets) -> Date
function fromExcelSerial(n) {
  const excelEpoch = new Date(1899, 11, 30); // 1899-12-30
  return new Date(excelEpoch.getTime() + Number(n) * 24 * 60 * 60 * 1000);
}

/**
 * Normaliza a string vinda do Sheets para "DD/MM/YYYY HH:mm"
 * - Mantém se já vier em DD/MM/YYYY HH:mm[:ss]
 * - Se vier em MM/DD/YYYY HH:mm -> inverte
 * - Se vier ISO (2025-10-29T16:52:22Z) -> formata pt-BR
 * - Se vier como número (serial) -> converte e formata pt-BR
 * - Não usa new Date em strings DD/MM para evitar inversão
 */
export function formatUltimaEdicaoBR(raw) {
  const v = String(raw ?? "").trim();
  if (!v) return "";

  // 1) Número serial?
  if (!isNaN(v) && v.length <= 10) {
    const d = fromExcelSerial(v);
    return new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit", hour12: false,
    }).format(d);
  }

  // 2) DD/MM/YYYY [HH:mm[:ss]]  -> mantém
  const mBR = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}:\d{2})(?::\d{2})?)?$/);
  if (mBR) {
    const dd = mBR[1].padStart(2, "0");
    const mm = mBR[2].padStart(2, "0");
    const yyyy = mBR[3];
    const hm = mBR[4] ? ` ${mBR[4]}` : ""; // HH:mm (sem segundos)
    return `${dd}/${mm}/${yyyy}${hm}`;
  }

  // 3) MM/DD/YYYY [HH:mm[:ss]] -> inverte p/ DD/MM
  const mUS = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}:\d{2})(?::\d{2})?)?$/);
  if (mUS) {
    const mm = mUS[1].padStart(2, "0");
    const dd = mUS[2].padStart(2, "0");
    const yyyy = mUS[3];
    const hm = mUS[4] ? ` ${mUS[4]}` : "";
    return `${dd}/${mm}/${yyyy}${hm}`;
  }

  // 4) ISO/Outros parseáveis -> formata pt-BR
  const d = new Date(v);
  if (!isNaN(d.getTime())) {
    return new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit", hour12: false,
    }).format(d);
  }

  // 5) Fallback: devolve como veio
  return v;
}
