import "./App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./components/Home";
import EstradasRurais from "./components/EstradasRurais";
import PedidosMaquinarios from "./components/PedidosMaquinarios";
import PedidosLiderancas from "./components/PedidosLiderancas";
import PedidosLiderancasV2 from "./components/PedidosLiderancasV2";
import Municipios from "./components/Municipios";
import Navbar from "./components/Navbar";
import AdminPanel from "./components/AdminPanel";
import Login from "./components/Login";
import ProtectedRoute from "./components/ProtectedRoute";
import { AuthProvider, useAuth } from "./contexts/AuthContext";

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

            {/* Página de Pedidos de Maquinários */}
            <Route 
              path="/pedidos-maquinarios" 
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