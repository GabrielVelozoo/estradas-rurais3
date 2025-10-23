// hooks/useMunicipios.js
// Hook para carregar e cachear municípios

import { useEffect, useState, useMemo } from "react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const CACHE_KEY = "municipios_pr_cache_v1";
const CACHE_EXPIRY_KEY = "municipios_pr_cache_expiry_v1";
const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 dias

export function useMunicipios() {
  const [municipios, setMunicipios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Tentar cache local primeiro
  useEffect(() => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      const expiry = localStorage.getItem(CACHE_EXPIRY_KEY);
      
      if (cached && expiry) {
        const expiryTime = parseInt(expiry, 10);
        const now = Date.now();
        
        // Se cache ainda válido, usar
        if (now < expiryTime) {
          const data = JSON.parse(cached);
          setMunicipios(data);
          setLoading(false);
          return;
        }
      }
    } catch (e) {
      console.warn('Erro ao ler cache de municípios:', e);
    }
  }, []);

  // Buscar do backend se cache não disponível ou expirado
  useEffect(() => {
    let abort = false;
    
    async function fetchMunicipios() {
      // Se já carregou do cache, não precisa buscar
      if (municipios.length > 0 && !loading) {
        return;
      }

      try {
        const res = await fetch(`${BACKEND_URL}/api/municipios`, {
          credentials: "include",
          headers: { 'Content-Type': 'application/json' }
        });
        
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        
        const data = await res.json();
        
        if (!abort && Array.isArray(data)) {
          setMunicipios(data);
          setLoading(false);
          
          // Salvar no cache com timestamp de expiração
          try {
            localStorage.setItem(CACHE_KEY, JSON.stringify(data));
            localStorage.setItem(CACHE_EXPIRY_KEY, (Date.now() + CACHE_DURATION).toString());
          } catch (e) {
            console.warn('Erro ao salvar cache de municípios:', e);
          }
        }
      } catch (e) {
        if (!abort) {
          console.error('Erro ao carregar municípios:', e);
          setError(e.message);
          setLoading(false);
        }
      }
    }

    // Só buscar se ainda está loading e não tem dados
    if (loading && municipios.length === 0) {
      fetchMunicipios();
    }

    return () => {
      abort = true;
    };
  }, [loading, municipios.length]);

  // Transformar em opções para react-select
  const options = useMemo(
    () => municipios.map(m => ({
      value: String(m.id || m.codigo || m.nome), // ✅ FORÇA STRING
      label: m.nome,
      municipio: m // Manter objeto completo para acesso
    })),
    [municipios]
  );

  return { 
    options, 
    municipios, 
    loading, 
    error 
  };
}
