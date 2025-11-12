import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const location = useLocation();
  const { user, logout, isAdmin } = useAuth();

  // compat: isAdmin pode ser função ou boolean
  const isAdminBool = typeof isAdmin === 'function' ? !!isAdmin() : !!isAdmin;

  const isActive = (path) => location.pathname === path;

  const baseNavItems = [
    { path: '/', label: 'Início', icon: '🏠' },
    { path: '/estradas-rurais', label: 'Estradas Rurais', icon: '🛣️' },
    { path: '/pedidos-liderancas', label: 'Pedidos de Lideranças', icon: '📋' },
    { path: '/pedidos-maquinarios', label: 'Pedidos de Maquinários', icon: '🚜' },
    { path: '/informacoes-gerais', label: 'Informações Gerais', icon: '📊' }
  ];

  const navItems = isAdminBool
    ? [...baseNavItems, { path: '/admin', label: 'Admin', icon: '⚙️' }]
    : baseNavItems;

  const handleLogout = async () => {
    await logout();
    setIsUserMenuOpen(false);
  };

  return (
    <nav className="bg-white shadow-lg border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Top bar */}
        <div className="flex justify-between h-16">
          {/* Logo + title */}
          <div className="flex items-center">
            <Link to="/" className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm0 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V8zm0 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1v-2z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <span className="text-xl font-bold text-gray-800 leading-none">
                Informações Gabinete
              </span>
            </Link>
          </div>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center space-x-2">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-1 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 whitespace-nowrap ${
                  isActive(item.path)
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-700 hover:text-blue-700 hover:bg-gray-100'
                }`}
                title={item.label}
              >
                <span className="text-base leading-none">{item.icon}</span>
                {/* evita quebra mesmo em nomes longos */}
                <span className="leading-none whitespace-nowrap tracking-tight">{item.label}</span>
              </Link>
            ))}

            {/* User menu */}
            {user && (
              <div className="relative ml-2">
                <button
                  onClick={() => setIsUserMenuOpen((v) => !v)}
                  className="bg-white flex text-sm rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  id="user-menu-button"
                  aria-expanded={isUserMenuOpen}
                  aria-haspopup="true"
                  title="Conta"
                >
                  <div className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center">
                    <span className="text-sm font-medium text-white leading-none">
                      {(user.username || 'U').charAt(0).toUpperCase()}
                    </span>
                  </div>
                </button>

                {isUserMenuOpen && (
                  <div className="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg py-1 bg-white ring-1 ring-black ring-opacity-5 focus:outline-none z-50">
                    <div className="px-4 py-2 text-sm text-gray-700 border-b">
                      <div className="font-medium truncate">{user.username || 'Usuário'}</div>
                      {user.email && <div className="text-gray-500 truncate">{user.email}</div>}
                    </div>
                    <button
                      onClick={handleLogout}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      Sair
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Mobile button */}
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setIsMenuOpen((v) => !v)}
              className="text-gray-700 hover:text-gray-900 focus:outline-none p-2"
              aria-label="Abrir menu"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d={isMenuOpen ? 'M6 18L18 6M6 6l12 12' : 'M4 6h16M4 12h16M4 18h16'}
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile nav */}
        {isMenuOpen && (
          <div className="md:hidden border-t">
            <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsMenuOpen(false)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-md text-base font-medium transition-colors duration-200 ${
                    isActive(item.path)
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-700 hover:text-blue-700 hover:bg-gray-100'
                  }`}
                  title={item.label}
                >
                  <span className="text-lg leading-none">{item.icon}</span>
                  <span className="leading-none">{item.label}</span>
                </Link>
              ))}

              {/* Mobile user info */}
              {user && (
                <div className="border-t pt-4">
                  <div className="px-3 py-2 text-sm text-gray-700">
                    <div className="font-medium truncate">{user.username || 'Usuário'}</div>
                    {user.email && <div className="text-gray-500 truncate">{user.email}</div>}
                  </div>
                  <button
                    onClick={handleLogout}
                    className="flex items-center w-full px-3 py-2 text-base font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-md"
                  >
                    <span className="mr-2">🚪</span>
                    <span>Sair</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
