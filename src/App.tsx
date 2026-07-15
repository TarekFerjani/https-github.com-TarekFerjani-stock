
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Product, Client, Room, Movement, Page, User, PagePermissions, Settings, Role, Invoice, Location } from './types';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import Sidebar from './components/Sidebar';
import ProductsPage from './components/ProductsPage';
import ClientsPage from './components/ClientsPage';
import RoomsPage from './components/RoomsPage';
import StockPage from './components/StockPage';
import InvoicesPage from './components/InvoicesPage';
import ContractsPage from './components/ContractsPage';
import UsersPage from './components/UsersPage';
import SettingsPage from './components/SettingsPage';
import ReportsPage from './components/ReportsPage';
import LocationsPage from './components/LocationsPage';
import PaymentsPage from './components/PaymentsPage';
import { inventoryService } from './services/inventoryService';
import { clientService } from './services/clientService';
import { roomService } from './services/roomService';
import { movementService } from './services/movementService';
import { locationService } from './services/locationService';
import { invoiceService } from './services/invoiceService';
import LoginPage from './components/LoginPage';
import { authService } from './services/authService';
import { permissionsService } from './services/permissionsService';
import { settingsService } from './services/settingsService';
import BottomNavBar from './components/BottomNavBar';
import ClientSignPage from './components/ClientSignPage';


const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  const [settings, setSettings] = useState<Settings | null>(null);

  const [products, setProducts] = useState<Product[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);

  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [isLoading, setIsLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Tablet simulation settings for high-fidelity interactive prototyping
  const [isTabletMode, setIsTabletMode] = useState(true);
  const [tabletOrientation, setTabletOrientation] = useState<'landscape' | 'portrait'>('landscape');

  const fetchAllData = useCallback(async () => {
    setIsLoading(true);
    setDataError(null);
    try {
      const [
        fetchedProducts,
        fetchedClients,
        fetchedRooms,
        fetchedMovements,
        fetchedLocations,
        fetchedSettings,
        fetchedInvoices
      ] = await Promise.all([
        inventoryService.getProducts(),
        clientService.getClients(),
        roomService.getRooms(),
        movementService.getMovements(),
        locationService.getLocations(),
        settingsService.getSettings(),
        invoiceService.getInvoices()
      ]);
      setProducts(fetchedProducts);
      setClients(fetchedClients);
      setRooms(fetchedRooms);
      setMovements(fetchedMovements);
      setLocations(fetchedLocations);
      setSettings(fetchedSettings);
      setInvoices(fetchedInvoices);
    } catch (error: any) {
      console.error("Failed to fetch data", error);
      setDataError(error?.message || 'Impossible de charger les données.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const checkUserSession = async () => {
      const currentUser = authService.getCurrentUser();
      if (currentUser) {
        setUser(currentUser);
        await fetchAllData();
      }
      setIsAuthLoading(false);
    };
    checkUserSession();
  }, [fetchAllData]);

  // Auto-refresh mechanism removed as requested
  useEffect(() => {
    // Only load once when user session is active
    if (user) {
      fetchAllData();
    }
  }, [user, fetchAllData]);

  const handleLogout = async () => {
    await authService.logout();
    setUser(null);
    setProducts([]);
    setClients([]);
    setRooms([]);
    setMovements([]);
    setInvoices([]);
    setLocations([]);
    setSettings(null);
    setCurrentPage('dashboard');
  };

  const handleLoginSuccess = (loggedInUser: User) => {
    setUser(loggedInUser);
    fetchAllData();
  };

  const handleResetData = async () => {
    if (window.confirm("Êtes-vous sûr de vouloir réinitialiser toutes les données ? Cette action est irréversible.")) {
      await settingsService.resetAllData();
      await fetchAllData();
      alert("Toutes les données ont été réinitialisées.");
    }
  };

  const allowedPages = useMemo(() => {
    if (!user) return [];
    if (user.role === Role.admin) {
      return ['dashboard', 'clients', 'products', 'rooms', 'locations', 'stock', 'factures', 'contrats', 'reglements', 'reports', 'settings', 'users'] as Page[];
    }
    const userPermissions = user.permissions || {};
    const userPages = (Object.keys(userPermissions) as Page[]).filter(page => userPermissions[page]);
    if (!userPages.includes('dashboard')) {
      userPages.unshift('dashboard');
    }
    return userPages;
  }, [user]);


  const renderPage = () => {
    if (!user) return null;

    if (!settings) {
      return (
        <div className="min-h-[60vh] flex items-center justify-center text-gray-600">
          <div className="max-w-xl text-center p-6 bg-white rounded-2xl shadow-sm">
            <h2 className="text-xl font-semibold mb-3">Chargement des paramètres...</h2>
            <p>Les paramètres de l’application ne sont pas encore disponibles. Si cette page reste vide, vérifiez que le backend est bien démarré et que l’API renvoie des données.</p>
          </div>
        </div>
      );
    }

    const dashboardProps = {
      rooms,
      locations,
      clients,
      invoices,
      settings,
      movements
    };

    if (!allowedPages.includes(currentPage)) {
      return <Dashboard {...dashboardProps} />;
    }

    const commonPageProps = { fetchAllData, isLoading, searchTerm, settings };
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard {...dashboardProps} />;
      case 'reports':
        return <ReportsPage movements={movements} settings={settings} rooms={rooms} locations={locations} invoices={invoices} clients={clients} />;
      case 'products':
        return <ProductsPage {...commonPageProps} products={products} />;
      case 'clients':
        return <ClientsPage {...commonPageProps} clients={clients} />;
      case 'rooms':
        return <RoomsPage {...commonPageProps} rooms={rooms} locations={locations} />;
      case 'locations':
        return <LocationsPage locations={locations} clients={clients} products={products} rooms={rooms} isLoading={isLoading} searchTerm={searchTerm} />;
      case 'stock':
        return <StockPage {...commonPageProps} products={products} clients={clients} rooms={rooms} movements={movements} locations={locations} />;
      case 'factures':
        return <InvoicesPage movements={movements} products={products} clients={clients} settings={settings} searchTerm={searchTerm} locations={locations} fetchAllData={fetchAllData} />;
      case 'contrats':
        return <ContractsPage clients={clients} settings={settings} searchTerm={searchTerm} />;
      case 'reglements':
        return <PaymentsPage clients={clients} settings={settings} searchTerm={searchTerm} fetchAllData={fetchAllData} user={user} />;
      case 'users':
        return user.role === Role.admin ? <UsersPage /> : <div>Accès non autorisé</div>;
      case 'settings':
        return user.role === Role.admin ? <SettingsPage settings={settings} onSave={fetchAllData} onResetData={handleResetData} /> : <div>Accès non autorisé</div>;

      default:
        return <Dashboard {...dashboardProps} />;
    }
  };

  const path = window.location.pathname;
  if (path.startsWith('/sign/')) {
    const contractId = path.split('/')[2];
    if (contractId) {
      return <ClientSignPage contractId={contractId} />;
    }
  }

  if (isAuthLoading || (user && isLoading && !settings)) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50"><p>Chargement...</p></div>;
  }

  if (!user) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  if (dataError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-xl bg-white rounded-2xl shadow-md p-8 text-center">
          <h2 className="text-2xl font-semibold mb-4">Erreur de chargement</h2>
          <p className="text-gray-700 mb-4">{dataError}</p>
          <button
            className="px-5 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
            onClick={fetchAllData}
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  const appContent = (
    <div id="tablet-app-container" className="h-full flex bg-gray-100 overflow-hidden text-gray-800">
      <Sidebar
        currentPage={currentPage}
        onNavigate={(page) => {
          setCurrentPage(page);
          setIsSidebarOpen(false);
          if (page === 'dashboard' || page === 'reports') {
            fetchAllData();
          }
        }}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        user={user}
        onLogout={handleLogout}
        allowedPages={allowedPages}
      />
      <div className="flex-1 flex flex-col w-0 h-full overflow-hidden">
        <Header
          onSearch={setSearchTerm}
          onMenuClick={() => setIsSidebarOpen(true)}
        />
        <main className="flex-1 overflow-y-auto focus:outline-none p-4 sm:p-6 lg:p-8 pb-20 md:pb-6 lg:pb-8">
          {renderPage()}
        </main>
        <BottomNavBar
          currentPage={currentPage}
          onNavigate={(page) => {
            setCurrentPage(page);
            if (page === 'dashboard' || page === 'reports') {
              fetchAllData();
            }
          }}
          allowedPages={allowedPages}
        />
      </div>
    </div>
  );

  if (isTabletMode) {
    return (
      <div id="simulator-viewport" className="min-h-screen bg-slate-900 flex flex-col items-center justify-start py-4 px-2 sm:py-6 sm:px-4 overflow-y-auto" style={{ background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)' }}>
        {/* Simulator Dashboard Controls Bar */}
        <div id="simulator-bar" className="w-full max-w-5xl mb-6 bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-white shadow-xl">
          <div className="flex items-center space-x-3">
            <span className="p-2 bg-primary-600 rounded-lg text-white font-bold text-xs shadow-md tracking-wider">MODE TABLETTE ACTIVÉ</span>
            <div>
              <h2 className="text-sm font-semibold">Simulateur d'App de Gestion Froid</h2>
              <p className="text-[10px] text-slate-300">Layout réactif optimisé pour tablettes (Rails de Navigation, Bento-grids)</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              id="btn-rotate"
              onClick={() => setTabletOrientation(o => o === 'landscape' ? 'portrait' : 'landscape')}
              className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-semibold flex items-center space-x-2 transition-all border border-white/10 shadow"
            >
              <svg className="h-4 w-4 text-primary-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H17" />
              </svg>
              <span>Orientation : {tabletOrientation === 'landscape' ? 'Paysage' : 'Portrait'}</span>
            </button>
            <button
              id="btn-fullscreen"
              onClick={() => setIsTabletMode(false)}
              className="px-3.5 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-xs font-semibold flex items-center transition-all shadow-md"
            >
              Mode Plein Écran
            </button>
          </div>
        </div>

        {/* Tablet Bezel Chassis */}
        <div id="tablet-chassis-container" className="relative transition-all duration-500 ease-in-out">
          {/* Bezel frame */}
          <div 
            id="tablet-bezel"
            className="bg-zinc-800 border-[14px] border-slate-950 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8)] transition-all duration-500 ease-in-out relative flex flex-col"
            style={{
              borderRadius: '36px',
              width: tabletOrientation === 'landscape' ? '1024px' : '768px',
              height: tabletOrientation === 'landscape' ? '768px' : '1024px',
              maxWidth: '96vw',
              maxHeight: '85vh',
            }}
          >
            {/* Front facing camera lens dot */}
            <div 
              id="tablet-lens"
              className="absolute bg-slate-950 rounded-full z-50 shadow-inner"
              style={
                tabletOrientation === 'landscape' 
                  ? { top: '50%', left: '-8px', transform: 'translateY(-50%)', width: '6px', height: '6px' }
                  : { top: '-8px', left: '50%', transform: 'translateX(-50%)', width: '6px', height: '6px' }
              }
            />

            {/* Inner viewport screen */}
            <div id="tablet-screen" className="w-full h-full overflow-hidden bg-white rounded-[22px] relative flex flex-col">
              {appContent}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-screen w-screen overflow-hidden flex flex-col">
      {appContent}
      
      {/* Floating button to reactivate tablet simulator if closed */}
      <button
        id="btn-restore-simulator"
        onClick={() => setIsTabletMode(true)}
        className="fixed bottom-6 right-6 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2.5 rounded-full shadow-2xl z-50 flex items-center space-x-2 transition-all transform hover:scale-105 border border-primary-500 font-semibold text-xs"
      >
        <svg className="h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
        <span>Activer Simulateur Tablette</span>
      </button>
    </div>
  );
};

export default App;