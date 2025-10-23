import { useEffect } from "react";
import { Link } from "react-router-dom";
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Home = () => {
  const helloWorldApi = async () => {
    try {
      const response = await axios.get(`${API}/`);
      console.log(response.data.message);
    } catch (e) {
      console.error(e, `errored out requesting / api`);
    }
  };

  useEffect(() => {
    helloWorldApi();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex justify-center mb-6">
            <img 
              src="https://avatars.githubusercontent.com/in/1201222?s=120&u=2686cf91179bbafbc7a71bfbc43004cf9ae1acea&v=4" 
              alt="Emergent Logo"
              className="w-20 h-20 rounded-full shadow-lg"
            />
          </div>
          <h1 className="text-4xl md:text-6xl font-bold text-gray-800 mb-4">
            Portal de Consultas
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Sistema de informações resumidos
          </p>
        </div>

        {/* Cards de Navegação - Todos Padronizados */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {/* Card Pedidos Lideranças */}
          <Link 
            to="/pedidos-liderancas" 
            className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 text-white group h-full"
          >
            <div className="flex flex-col items-center justify-center text-center p-8 h-72">
              <div className="text-6xl mb-4 group-hover:scale-110 transition-transform duration-300">
                📋
              </div>
              <h2 className="text-2xl font-bold mb-3">
                Pedidos de Lideranças
              </h2>
              <p className="mb-4 opacity-90 text-sm">
                Gerencie pedidos das lideranças com protocolo e acompanhamento
              </p>
              <div className="mt-auto inline-flex items-center px-4 py-2 bg-white/20 rounded-lg backdrop-blur-sm text-sm font-medium group-hover:bg-white/30 transition-colors">
                Acessar →
              </div>
            </div>
          </Link>

          {/* Card Pedidos de Maquinários */}
          <Link 
            to="/pedidos-maquinarios" 
            className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 text-white group h-full"
          >
            <div className="flex flex-col items-center justify-center text-center p-8 h-72">
              <div className="text-6xl mb-4 group-hover:scale-110 transition-transform duration-300">
                🚜
              </div>
              <h2 className="text-2xl font-bold mb-3">
                Pedidos de Maquinários
              </h2>
              <p className="mb-4 opacity-90 text-sm">
                Sistema completo de gestão de pedidos de equipamentos por município
              </p>
              <div className="mt-auto inline-flex items-center px-4 py-2 bg-white/20 rounded-lg backdrop-blur-sm text-sm font-medium group-hover:bg-white/30 transition-colors">
                Acessar →
              </div>
            </div>
          </Link>

          {/* Card Estradas Rurais */}
          <Link 
            to="/estradas-rurais" 
            className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 text-white group h-full"
          >
            <div className="flex flex-col items-center justify-center text-center p-8 h-72">
              <div className="text-6xl mb-4 group-hover:scale-110 transition-transform duration-300">
                🛣️
              </div>
              <h2 className="text-2xl font-bold mb-3">
                Estradas Rurais
              </h2>
              <p className="mb-4 opacity-90 text-sm">
                Consulte informações sobre projetos e investimentos em estradas rurais municipais
              </p>
              <div className="mt-auto inline-flex items-center px-4 py-2 bg-white/20 rounded-lg backdrop-blur-sm text-sm font-medium group-hover:bg-white/30 transition-colors">
                Acessar →
              </div>
            </div>
          </Link>

          {/* Card Relatórios */}
          <div className="bg-gradient-to-br from-orange-400 to-orange-500 rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 text-white opacity-60 cursor-not-allowed h-full">
            <div className="flex flex-col items-center justify-center text-center p-8 h-72">
              <div className="text-6xl mb-4 opacity-70">
                📊
              </div>
              <h2 className="text-2xl font-bold mb-3">
                Relatórios
              </h2>
              <p className="mb-4 opacity-90 text-sm">
                Em breve: Dashboards e relatórios analíticos
              </p>
              <div className="mt-auto inline-flex items-center px-4 py-2 bg-white/20 rounded-lg backdrop-blur-sm text-sm font-medium">
                Em desenvolvimento
              </div>
            </div>
          </div>

          {/* Card Dados do Gov */}
          <div className="bg-gradient-to-br from-indigo-400 to-indigo-500 rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 text-white opacity-60 cursor-not-allowed h-full">
            <div className="flex flex-col items-center justify-center text-center p-8 h-72">
              <div className="text-6xl mb-4 opacity-70">
                🏛️
              </div>
              <h2 className="text-2xl font-bold mb-3">
                Dados do Gov
              </h2>
              <p className="mb-4 opacity-90 text-sm">
                Em breve: Sistema de acompanhamento em tempo real dos protocolos
              </p>
              <div className="mt-auto inline-flex items-center px-4 py-2 bg-white/20 rounded-lg backdrop-blur-sm text-sm font-medium">
                Em desenvolvimento
              </div>
            </div>
          </div>

          {/* Card Extra (para manter grid balanceado) */}
          <div className="bg-gradient-to-br from-pink-400 to-pink-500 rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 text-white opacity-60 cursor-not-allowed h-full">
            <div className="flex flex-col items-center justify-center text-center p-8 h-72">
              <div className="text-6xl mb-4 opacity-70">
                💡
              </div>
              <h2 className="text-2xl font-bold mb-3">
                Mais Recursos
              </h2>
              <p className="mb-4 opacity-90 text-sm">
                Novos módulos e funcionalidades em breve
              </p>
              <div className="mt-auto inline-flex items-center px-4 py-2 bg-white/20 rounded-lg backdrop-blur-sm text-sm font-medium">
                Em breve
              </div>
            </div>
          </div>
        </div>

        {/* Estatísticas */}
        <div className="mt-16 bg-white rounded-xl shadow-lg p-8 max-w-4xl mx-auto">
          <h3 className="text-2xl font-bold text-center mb-8 text-gray-800">
            📈 Resumo do Sistema
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div>
              <div className="text-3xl font-bold text-blue-600">1</div>
              <div className="text-gray-600">Sistema Ativo</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-green-600">100%</div>
              <div className="text-gray-600">Disponibilidade</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-purple-600">Real-time</div>
              <div className="text-gray-600">Atualização</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-orange-600">24/7</div>
              <div className="text-gray-600">Acesso</div>
            </div>
          </div>
        </div>

        {/* Footer removido conforme solicitado */}
      </div>
    </div>
  );
};

export default Home;