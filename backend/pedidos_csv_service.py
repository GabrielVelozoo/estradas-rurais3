# backend/pedidos_csv_service.py
import aiohttp
import csv
import io
import unicodedata
import re
from datetime import datetime, timedelta
from typing import List, Dict, Optional
import logging
import os

logger = logging.getLogger(__name__)

class PedidosCSVService:
    """
    Service to fetch, parse, normalize and cache Google Sheets CSV data.
    """
    
    def __init__(self, csv_url: str, cache_ttl_minutes: int = 15):
        self.csv_url = csv_url
        self.cache_ttl = timedelta(minutes=cache_ttl_minutes)
        self._cache: Optional[List[Dict]] = None
        self._cache_timestamp: Optional[datetime] = None
    
    def _strip_accents(self, text: str) -> str:
        """Remove accents for case/accent-insensitive comparison."""
        if not isinstance(text, str):
            return ""
        normalized = unicodedata.normalize("NFD", text)
        return "".join(c for c in normalized if unicodedata.category(c) != "Mn")
    
    def _parse_money(self, value: str) -> float:
        """
        Convert Brazilian money format to float.
        Example: "R$ 1.234.567,89" -> 1234567.89
        """
        if not value or not isinstance(value, str):
            return 0.0
        
        # Remove "R$", spaces, and thousand separators (.)
        cleaned = value.replace("R$", "").replace(" ", "").replace(".", "")
        # Replace comma with dot for decimal
        cleaned = cleaned.replace(",", ".")
        
        try:
            return float(cleaned)
        except ValueError:
            logger.warning(f"Failed to parse money value: {value}")
            return 0.0
    
    def _parse_date(self, date_str: str) -> Optional[str]:
        """
        Convert dd/mm/yyyy to ISO format yyyy-mm-dd.
        Returns None if parsing fails.
        """
        if not date_str or not isinstance(date_str, str):
            return None
        
        try:
            # Try dd/mm/yyyy format
            dt = datetime.strptime(date_str.strip(), "%d/%m/%Y")
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            logger.warning(f"Failed to parse date: {date_str}")
            return None
    
    def _normalize_row(self, row: Dict) -> Dict:
        """
        Normalize a single row from CSV:
        - Parse monetary values
        - Parse dates
        - Add normalized municipality name for filtering
        """
        normalized = row.copy()
        
        # Parse monetary values
        normalized["valor_solicitado_num"] = self._parse_money(row.get("Valor solicitado", ""))
        normalized["valor_liberado_num"] = self._parse_money(row.get("Valor liberado", ""))
        normalized["valor_contrapartida_num"] = self._parse_money(row.get("Valor de contrapartida", ""))
        
        # Parse date
        normalized["data_cadastro_iso"] = self._parse_date(row.get("Data de cadastro", ""))
        
        # Add normalized municipality for filtering
        municipio = row.get("Município", "")
        normalized["municipio_normalized"] = self._strip_accents(municipio).lower().strip()
        
        return normalized
    
    async def _fetch_csv(self) -> List[Dict]:
        """Fetch CSV from Google Sheets and parse into list of dicts."""
        logger.info(f"Fetching CSV from: {self.csv_url}")
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(self.csv_url, timeout=aiohttp.ClientTimeout(total=30)) as response:
                    if response.status != 200:
                        raise Exception(f"CSV fetch failed with status {response.status}")
                    
                    content = await response.text()
                    
                    # Parse CSV
                    csv_reader = csv.DictReader(io.StringIO(content))
                    rows = []
                    
                    for row in csv_reader:
                        # Normalize and add to list
                        normalized_row = self._normalize_row(row)
                        rows.append(normalized_row)
                    
                    logger.info(f"Successfully parsed {len(rows)} rows from CSV")
                    return rows
                    
        except Exception as e:
            logger.error(f"Error fetching/parsing CSV: {e}")
            raise
    
    def _is_cache_valid(self) -> bool:
        """Check if cache is valid based on TTL."""
        if self._cache is None or self._cache_timestamp is None:
            return False
        
        age = datetime.now() - self._cache_timestamp
        return age < self.cache_ttl
    
    async def get_all_pedidos(self, force_refresh: bool = False) -> List[Dict]:
        """
        Get all pedidos from cache or fetch fresh data.
        
        Args:
            force_refresh: If True, bypass cache and fetch fresh data
        """
        if force_refresh or not self._is_cache_valid():
            logger.info("Cache miss or force refresh - fetching fresh data")
            self._cache = await self._fetch_csv()
            self._cache_timestamp = datetime.now()
        else:
            logger.info("Cache hit - returning cached data")
        
        return self._cache or []
    
    async def get_pedidos_by_municipio(self, municipio: str, force_refresh: bool = False) -> List[Dict]:
        """
        Get pedidos filtered by municipality name (case/accent-insensitive).
        
        Args:
            municipio: Municipality name to filter by
            force_refresh: If True, bypass cache
        """
        all_pedidos = await self.get_all_pedidos(force_refresh=force_refresh)
        
        # Normalize search term
        municipio_normalized = self._strip_accents(municipio).lower().strip()
        
        # Filter by normalized municipality
        filtered = [
            pedido for pedido in all_pedidos
            if pedido.get("municipio_normalized") == municipio_normalized
        ]
        
        logger.info(f"Filtered {len(filtered)} pedidos for municipality: {municipio}")
        return filtered
    
    def get_cache_info(self) -> Dict:
        """Get cache status information."""
        if self._cache is None:
            return {
                "cached": False,
                "cache_age_seconds": None,
                "total_rows": 0
            }
        
        age = (datetime.now() - self._cache_timestamp).total_seconds() if self._cache_timestamp else None
        
        return {
            "cached": True,
            "cache_age_seconds": age,
            "total_rows": len(self._cache),
            "cache_timestamp": self._cache_timestamp.isoformat() if self._cache_timestamp else None
        }


# Global service instance
_service_instance: Optional[PedidosCSVService] = None

def get_pedidos_service() -> PedidosCSVService:
    """Get or create the global PedidosCSVService instance."""
    global _service_instance
    
    if _service_instance is None:
        csv_url = os.getenv(
            "CSV_PEDIDOS_URL",
            "https://docs.google.com/spreadsheets/d/e/2PACX-1vT9kKtt0e6Pe_HYJ0qrKXbUG1EfogfG53T3V5_LPpoEq1Aklfwrf_DbgAlwFLsEqcnrDmlsxwb7t0Mc/pub?gid=0&single=true&output=csv"
        )
        _service_instance = PedidosCSVService(csv_url=csv_url, cache_ttl_minutes=15)
    
    return _service_instance
