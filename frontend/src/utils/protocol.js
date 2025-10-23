// frontend/src/utils/protocol.js

/** Mantém só dígitos */
export function digitsOnly(value = "") {
  return String(value).replace(/\D/g, "");
}

/** Máscara 00.000.000-0  (também exportada como formatProtocol p/ compatibilidade) */
export function maskProtocol(input = "") {
  const d = digitsOnly(input).slice(0, 9);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}-${d.slice(8)}`;
}

/** Alias por compatibilidade com imports existentes */
export const formatProtocol = maskProtocol;

/** Validação simples: protocolo válido tem exatamente 9 dígitos */
export function isValidProtocol(input = "") {
  return digitsOnly(input).length === 9;
}

/** Constrói a URL OFICIAL do eProtocolo PR */
export function buildProtocolUrl(input = "") {
  const digits = digitsOnly(input);
  if (digits.length !== 9) return null;

  return (
    "https://www.eprotocolo.pr.gov.br/spiweb/consultarProtocoloDigital.do" +
    "?action=pesquisar&numeroProtocolo=" +
    digits
  );
}

/** Alias para compatibilidade com imports antigos */
export const getProtocolUrl = buildProtocolUrl;

/** Helper opcional para abrir em nova aba com checagem */
export function openProtocolInNewTab(input = "") {
  const url = buildProtocolUrl(input);
  if (url) window.open(url, "_blank", "noopener,noreferrer");
}

/** Útil quando precisar garantir só os dígitos */
export function toProtocolDigits(input = "") {
  return digitsOnly(input).slice(0, 9);
}
