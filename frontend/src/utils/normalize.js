// utils/normalize.js
// Remove acentos e normaliza texto para comparação

export function normalize(str = "") {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}
