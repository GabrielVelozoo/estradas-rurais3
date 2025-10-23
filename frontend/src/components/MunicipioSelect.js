// components/MunicipioSelect.js
// Select com type-ahead para municípios (filtro sem acento)

import React, { useMemo, useState } from "react";
import Select from "react-select";
import { useMunicipios } from "../hooks/useMunicipios";
import { normalize } from "../utils/normalize";

export default function MunicipioSelect({ 
  value, 
  onChange, 
  placeholder = "Digite o município...",
  required = false,
  disabled = false
}) {
  const { options, loading } = useMunicipios();
  const [inputValue, setInputValue] = useState("");

  // Filtrar opções sem acento
  const filteredOptions = useMemo(() => {
    if (!inputValue) return options;
    
    const normalizedInput = normalize(inputValue);
    return options.filter(opt => 
      normalize(opt.label).includes(normalizedInput)
    );
  }, [inputValue, options]);

  // Encontrar opção selecionada
  const selectedOption = useMemo(() => {
    return options.find(o => o.value === value) || null;
  }, [value, options]);

  // Estilos customizados
  const customStyles = {
    control: (base, state) => ({
      ...base,
      minHeight: '42px',
      borderColor: state.isFocused ? '#10b981' : '#d1d5db',
      boxShadow: state.isFocused ? '0 0 0 2px rgba(16, 185, 129, 0.2)' : 'none',
      '&:hover': {
        borderColor: '#10b981'
      }
    }),
    menu: (base) => ({
      ...base,
      zIndex: 50
    }),
    option: (base, state) => ({
      ...base,
      backgroundColor: state.isSelected 
        ? '#10b981' 
        : state.isFocused 
        ? '#d1fae5' 
        : 'white',
      color: state.isSelected ? 'white' : '#1f2937',
      cursor: 'pointer',
      '&:active': {
        backgroundColor: '#059669'
      }
    }),
    placeholder: (base) => ({
      ...base,
      color: '#9ca3af'
    }),
    loadingMessage: (base) => ({
      ...base,
      color: '#6b7280'
    }),
    noOptionsMessage: (base) => ({
      ...base,
      color: '#6b7280'
    })
  };

  return (
    <Select
      isLoading={loading}
      isDisabled={disabled}
      options={filteredOptions}
      value={selectedOption}
      onInputChange={setInputValue}
      onChange={(opt) => {
        if (onChange) {
          onChange(opt?.value || '', opt?.municipio || null);
        }
      }}
      placeholder={placeholder}
      noOptionsMessage={() => 
        inputValue 
          ? `Nenhum município encontrado para "${inputValue}"` 
          : "Digite para buscar..."
      }
      loadingMessage={() => "Carregando municípios..."}
      styles={customStyles}
      required={required}
      isClearable
      menuPlacement="auto"
      menuPosition="fixed"
    />
  );
}
