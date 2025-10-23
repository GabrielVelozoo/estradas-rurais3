// components/ProtocolLink.js
// Componente para exibir protocolo como link clicável

import React from 'react';
import { isValidProtocol, getProtocolUrl } from '../utils/protocol';

export default function ProtocolLink({ protocolo, className = '' }) {
  // Se não houver protocolo, mostrar "-"
  if (!protocolo || protocolo.trim() === '') {
    return <span className={`text-gray-400 ${className}`}>-</span>;
  }

  // Verificar se o protocolo é válido (9 dígitos)
  const isValid = isValidProtocol(protocolo);

  // Se não for válido, mostrar como texto simples
  if (!isValid) {
    return (
      <span className={`text-gray-600 ${className}`} title="Protocolo incompleto ou inválido">
        {protocolo}
      </span>
    );
  }

  // Se válido, mostrar como link
  const url = getProtocolUrl(protocolo);

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`text-blue-600 underline hover:no-underline hover:text-blue-800 transition-colors ${className}`}
      title="Clique para consultar o protocolo (abre em nova aba)"
    >
      {protocolo}
    </a>
  );
}
