// Utilidades para manejar localStorage de forma segura

export const storage = {
  // Guardar item
  setItem: (key: string, value: any): void => {
    if (typeof window === 'undefined') return;

    try {
      const serializedValue = JSON.stringify(value);
      localStorage.setItem(key, serializedValue);
    } catch (error) {
      console.error(`Error saving to localStorage:`, error);
    }
  },

  // Obtener item
  getItem: <T = any>(key: string): T | null => {
    if (typeof window === 'undefined') return null;

    try {
      const item = localStorage.getItem(key);
      if (!item) return null;

      // Si el item es "undefined" (string), lo eliminamos y retornamos null
      if (item === 'undefined' || item === 'null') {
        localStorage.removeItem(key);
        return null;
      }

      return JSON.parse(item);
    } catch (error) {
      console.error(`Error reading from localStorage:`, error);
      // Si hay error al parsear, eliminamos el item corrupto
      localStorage.removeItem(key);
      return null;
    }
  },

  // Eliminar item
  removeItem: (key: string): void => {
    if (typeof window === 'undefined') return;

    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error(`Error removing from localStorage:`, error);
    }
  },

  // Limpiar todos los items
  clear: (): void => {
    if (typeof window === 'undefined') return;

    try {
      localStorage.clear();
    } catch (error) {
      console.error(`Error clearing localStorage:`, error);
    }
  },
};

// Claves de almacenamiento
export const STORAGE_KEYS = {
  TOKEN: 'token',
  USER: 'user',
  TENANT: 'tenant',
} as const;
