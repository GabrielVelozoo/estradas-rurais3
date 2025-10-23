// utils/protocol.js
// Utilitários para manipulação de protocolos

/**
 * Remove pontos, traços e espaços de um protocolo
 * @param {string} protocolo - Protocolo formatado (ex: "24.118.797-7")
 * @returns {string} - Protocolo limpo (ex: "241187977")
 */
export function cleanProtocol(protocolo) {
  if (!protocolo) return '';
  return protocolo.replace(/[.\-\s]/g, '');
}

/**
 * Valida se o protocolo tem exatamente 9 dígitos
 * @param {string} protocolo - Protocolo (formatado ou não)
 * @returns {boolean} - true se válido (9 dígitos)
 */
export function isValidProtocol(protocolo) {
  if (!protocolo) return false;
  const cleaned = cleanProtocol(protocolo);
  return /^\d{9}$/.test(cleaned);
}

/**
 * Monta a URL completa para consulta do protocolo
 * @param {string} protocolo - Protocolo (formatado ou não)
 * @param {string} baseUrl - URL base (opcional, usa env se não informado)
 * @returns {string|null} - URL completa ou null se protocolo inválido
 */
export function getProtocolUrl(protocolo, baseUrl = null) {
  if (!isValidProtocol(protocolo)) {
    return null;
  }

  const cleaned = cleanProtocol(protocolo);
  const base = baseUrl || process.env.REACT_APP_PROTOCOL_BASE_URL || 'https://rural-infra-hub.emergent.host';
  
  return `${base}/protocolo?numero=${cleaned}`;
}

/**
 * Formata o protocolo no padrão 00.000.000-0
 * @param {string} protocolo - Protocolo (limpo ou formatado)
 * @returns {string} - Protocolo formatado
 */
export function formatProtocol(protocolo) {
  if (!protocolo) return '';
  
  const cleaned = cleanProtocol(protocolo);
  
  if (cleaned.length !== 9) {
    return protocolo; // Retorna como está se não tiver 9 dígitos
  }
  
  // Formato: 00.000.000-0
  return `${cleaned.slice(0, 2)}.${cleaned.slice(2, 5)}.${cleaned.slice(5, 8)}-${cleaned.slice(8)}`;
}
