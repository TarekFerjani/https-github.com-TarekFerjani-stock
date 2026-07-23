
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Product, Client, Room, Movement, Page, User, PagePermissions, Settings, Role, Invoice, Location, Reglement, Contract } from './types';
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
import { paymentService } from './services/paymentService';
import { contractService } from './services/contractService';
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
  const [reglements, setReglements] = useState<Reglement[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);

  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [isLoading, setIsLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Tablet simulation settings removed

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
        fetchedInvoices,
        fetchedReglements,
        fetchedContracts
      ] = await Promise.all([
        inventoryService.getProducts(),
        clientService.getClients(),
        roomService.getRooms(),
        movementService.getMovements(),
        locationService.getLocations(),
        settingsService.getSettings(),
        invoiceService.getInvoices(),
        paymentService.getReglements(),
        contractService.getContracts()
      ]);
      setProducts(fetchedProducts);
      setClients(fetchedClients);
      setRooms(fetchedRooms);
      setMovements(fetchedMovements);
      setLocations(fetchedLocations);
      setSettings(fetchedSettings);
      setInvoices(fetchedInvoices);
      setReglements(fetchedReglements || []);
      setContracts(fetchedContracts || []);
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
    setReglements([]);
    setContracts([]);
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
      movements,
      reglements
    };

    if (!allowedPages.includes(currentPage)) {
      return <Dashboard {...dashboardProps} />;
    }

    const commonPageProps = { fetchAllData, isLoading, searchTerm, settings };
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard {...dashboardProps} />;
      case 'reports':
        return <ReportsPage movements={movements} settings={settings} rooms={rooms} locations={locations} invoices={invoices} clients={clients} reglements={reglements} contracts={contracts} />;
      case 'products':
        return <ProductsPage {...commonPageProps} products={products} />;
      case 'clients':
        return <ClientsPage {...commonPageProps} clients={clients} />;
      case 'rooms':
        return <RoomsPage {...commonPageProps} rooms={rooms} locations={locations} />;
      case 'locations':
        return <LocationsPage locations={locations} clients={clients} products={products} rooms={rooms} isLoading={isLoading} searchTerm={searchTerm} />;
      case 'stock':
        return <StockPage {...commonPageProps} products={products} clients={clients} rooms={rooms} movements={movements} locations={locations} reglements={reglements} />;
      case 'factures':
      case 'reglements':
        return <InvoicesPage movements={movements} products={products} clients={clients} settings={settings} searchTerm={searchTerm} locations={locations} fetchAllData={fetchAllData} reglements={reglements} user={user} />;
      case 'contrats':
        return <ContractsPage clients={clients} settings={settings} searchTerm={searchTerm} />;
      case 'users':
        return user.role === Role.admin ? <UsersPage /> : <div>Accès non autorisé</div>;
      case 'settings': {
        const hasEntries = movements.length > 0 || locations.length > 0 || clients.length > 0 || products.length > 0 || rooms.length > 0 || contracts.length > 0;
        return user.role === Role.admin ? <SettingsPage settings={settings} onSave={fetchAllData} onResetData={handleResetData} hasEntries={hasEntries} /> : <div>Accès non autorisé</div>;
      }

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

  return (
    <div id="tablet-app-container" className="h-screen w-screen flex bg-gray-100 overflow-hidden text-gray-800">
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
};

export default App;