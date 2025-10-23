import "./App.css";
import React, { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { DataCacheProvider } from "./contexts/DataCacheContext";

// Componentes essenciais carregados imediatamente
import Home from "./components/Home";
import Navbar from "./components/Navbar";
import Login from "./components/Login";
import ProtectedRoute from "./components/ProtectedRoute";

// Lazy loading para componentes pesados
const EstradasRurais = lazy(() => import("./components/EstradasRurais"));
const PedidosLiderancasV2 = lazy(() => import("./components/PedidosLiderancasV2"));
const PedidosMaquinariosV2 = lazy(() => import("./components/PedidosMaquinariosV2"));
const AdminPanel = lazy(() => import("./components/AdminPanel"));
const Municipios = lazy(() => import("./components/Municipios"));
const PedidosMaquinarios = lazy(() => import("./components/PedidosMaquinarios"));
const PedidosLiderancas = lazy(() => import("./components/PedidosLiderancas"));

// Componente de loading
const LoadingFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="text-center">
      <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600 mb-4"></div>
      <p className="text-gray-600 font-medium">Carregando...</p>
    </div>
  </div>
);

/* Componentes de redirecionamento removidos - restaurando navegação normal */

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <AuthProvider>
          <Navbar />
          <Routes>
            {/* Página inicial - Home com cartões */}
            <Route 
              path="/" 
              element={
                <ProtectedRoute>
                  <Home />
                </ProtectedRoute>
              } 
            />
            
            {/* Dashboard de Estradas Rurais */}
            <Route 
              path="/estradas-rurais" 
              element={
                <ProtectedRoute>
                  <EstradasRurais />
                </ProtectedRoute>
              } 
            />

            {/* Página de Pedidos de Maquinários V2 (Nova versão) */}
            <Route 
              path="/pedidos-maquinarios" 
              element={
                <ProtectedRoute>
                  <PedidosMaquinariosV2 />
                </ProtectedRoute>
              } 
            />
            
            {/* Página antiga de Pedidos de Maquinários (manter por enquanto) */}
            <Route 
              path="/pedidos-maquinarios-old" 
              element={
                <ProtectedRoute>
                  <PedidosMaquinarios />
                </ProtectedRoute>
              } 
            />

            {/* Página de Pedidos Lideranças V2 (Nova versão) */}
            <Route 
              path="/pedidos-liderancas" 
              element={
                <ProtectedRoute>
                  <PedidosLiderancasV2 />
                </ProtectedRoute>
              } 
            />
            
            {/* Página antiga de Pedidos Lideranças (manter por enquanto) */}
            <Route 
              path="/pedidos-liderancas-old" 
              element={
                <ProtectedRoute>
                  <PedidosLiderancas />
                </ProtectedRoute>
              } 
            />

            {/* Página de Municípios */}
            <Route 
              path="/municipios" 
              element={
                <ProtectedRoute>
                  <Municipios />
                </ProtectedRoute>
              } 
            />
            
            {/* Página de Login */}
            <Route 
              path="/login" 
              element={<Login />} 
            />

            {/* Painel Admin */}
            <Route 
              path="/admin" 
              element={
                <ProtectedRoute adminOnly={true}>
                  <AdminPanel />
                </ProtectedRoute>
              } 
            />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;