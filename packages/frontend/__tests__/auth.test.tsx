// Pruebas básicas para verificar que los componentes de autenticación funcionen

import { render, screen } from '@testing-library/react';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';

// Mock del router
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

// Mock de storage
jest.mock('@/lib/storage', () => ({
  storage: {
    getItem: jest.fn(() => null),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  },
}));

// Mock de API
jest.mock('@/lib/api', () => ({
  api: {
    post: jest.fn(),
  },
}));

describe('Auth Components', () => {
  describe('AuthProvider', () => {
    it('debería renderizar children sin errores', () => {
      render(
        <AuthProvider>
          <div>Test Children</div>
        </AuthProvider>
      );
      expect(screen.getByText('Test Children')).toBeInTheDocument();
    });

    it('debería proporcionar contexto de autenticación', () => {
      const TestComponent = () => {
        const auth = useAuth();
        return <div>{auth.isLoading ? 'Loading...' : 'Loaded'}</div>;
      };

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      // Al inicio, isLoading puede ser true o false dependiendo de si hay token en storage
      // El test verifica que el componente se renderiza sin errores
      expect(screen.getByText(/Loading|Loaded/)).toBeInTheDocument();
    });
  });

  // Agrega más pruebas según sea necesario
});
