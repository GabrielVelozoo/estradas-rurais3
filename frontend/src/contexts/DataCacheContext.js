// contexts/DataCacheContext.js
// Cache global para dados compartilhados entre componentes

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

const DataCacheContext = createContext();

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

export function DataCacheProvider({ children }) {
  const [cache, setCache] = useState({});
  const abortControllersRef = useRef({});

  // Função para buscar com cache
  const fetchWithCache = useCallback(async (key, fetcher, options = {}) => {
    const { forceFresh = false, ttl = CACHE_DURATION } = options;
    
    // Cancelar requisição anterior para essa key
    if (abortControllersRef.current[key]) {
      abortControllersRef.current[key].abort();
    }

    // Criar novo AbortController
    const controller = new AbortController();
    abortControllersRef.current[key] = controller;

    // Verificar cache
    const now = Date.now();
    const cached = cache[key];

    if (!forceFresh && cached && cached.timestamp + ttl > now) {
      console.log(`[Cache HIT] ${key}`);
      return cached.data;
    }

    console.log(`[Cache MISS] ${key} - Fetching fresh data...`);

    try {
      const data = await fetcher(controller.signal);
      
      // Salvar no cache
      setCache(prev => ({
        ...prev,
        [key]: {
          data,
          timestamp: now
        }
      }));

      return data;
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log(`[Cache] Request aborted for ${key}`);
        throw error;
      }

      // Se falhar, retornar cache antigo se existir
      if (cached) {
        console.warn(`[Cache] Using stale data for ${key} due to error:`, error);
        return cached.data;
      }

      throw error;
    } finally {
      // Limpar AbortController
      delete abortControllersRef.current[key];
    }
  }, [cache]);

  // Limpar cache específico
  const clearCache = useCallback((key) => {
    if (key) {
      setCache(prev => {
        const newCache = { ...prev };
        delete newCache[key];
        return newCache;
      });
    } else {
      setCache({});
    }
  }, []);

  // Invalidar cache (força refresh na próxima busca)
  const invalidateCache = useCallback((key) => {
    clearCache(key);
  }, [clearCache]);

  // Pré-carregar dados
  const prefetch = useCallback(async (key, fetcher, options) => {
    try {
      await fetchWithCache(key, fetcher, options);
    } catch (error) {
      console.warn(`[Cache] Prefetch failed for ${key}:`, error);
    }
  }, [fetchWithCache]);

  const value = {
    fetchWithCache,
    clearCache,
    invalidateCache,
    prefetch,
    cache
  };

  return (
    <DataCacheContext.Provider value={value}>
      {children}
    </DataCacheContext.Provider>
  );
}

export function useDataCache() {
  const context = useContext(DataCacheContext);
  if (!context) {
    throw new Error('useDataCache must be used within DataCacheProvider');
  }
  return context;
}
