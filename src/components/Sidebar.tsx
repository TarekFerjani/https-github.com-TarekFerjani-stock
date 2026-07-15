import React from 'react';
import { Page, Role, User } from '../types';

interface SidebarProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  isOpen: boolean;
  onClose: () => void;
  user: User;
  onLogout: () => void;
  allowedPages: Page[];
}

const Sidebar: React.FC<SidebarProps> = ({ currentPage, onNavigate, isOpen, onClose, user, onLogout, allowedPages }) => {

  const allNavItems = [
    { id: 'dashboard', label: 'Tableau de bord', icon: <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" /> },
    { id: 'clients', label: 'Clients', icon: <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-4.663M12 3.375c-3.418 0-6.162 2.744-6.162 6.162s2.744 6.162 6.162 6.162 6.162-2.744 6.162-6.162S15.418 3.375 12 3.375z" /> },
    { id: 'products', label: 'Produits', icon: <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" /> },
    { id: 'rooms', label: 'Chambres', icon: <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75v.75h-.75v-.75zM6.75 9.75h.75v.75h-.75v-.75zM6.75 12.75h.75v.75h-.75v-.75zM6.75 15.75h.75v.75h-.75v-.75zM10.5 6.75h.75v.75h-.75v-.75zM10.5 9.75h.75v.75h-.75v-.75zM10.5 12.75h.75v.75h-.75v-.75zM10.5 15.75h.75v.75h-.75v-.75zM14.25 6.75h.75v.75h-.75v-.75zM14.25 9.75h.75v.75h-.75v-.75zM14.25 12.75h.75v.75h-.75v-.75zM14.25 15.75h.75v.75h-.75v-.75z" /> },
    { id: 'locations', label: 'Locations', icon: <path strokeLinecap="round" strokeLinejoin="round" d="M12 2.25c-4.14 0-7.5 3.36-7.5 7.5 0 5.625 7.5 12.75 7.5 12.75s7.5-7.125 7.5-12.75c0-4.14-3.36-7.5-7.5-7.5zm0 10.5a3 3 0 110-6 3 3 0 010 6z" /> },
    { id: 'stock', label: 'Stock', icon: <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" /> },
    { id: 'factures', label: 'Factures', icon: <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /> },
    { id: 'contrats', label: 'Contrats', icon: <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" /> },
    { id: 'reglements', label: 'Règlements & Avances', icon: <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75V7.5m0 11.25a2.25 2.25 0 002.25 2.25h15a2.25 2.25 0 002.25-2.25V7.5m-19.5 11.25V9a2.25 2.25 0 012.25-2.25h15A2.25 2.25 0 0122.5 9v9.75m-20.25 0h20.25M12 11.25h.008v.008H12v-.008zm0 3h.008v.008H12v-.008zm0 3h.008v.008H12v-.008z" /> },
    { id: 'reports', label: 'Rapports', icon: <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1.5-1.5m1.5 1.5v-2.25m0 0l1.5-1.5m-1.5 1.5l-1.5 1.5m0 0l1.5 1.5M12 19.5v-2.25m0 0l1.5-1.5m-1.5 1.5l-1.5 1.5m0 0l1.5 1.5" /> },
    { id: 'settings', label: 'Paramètres', icon: <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-1.003 1.11-1.226.554-.225 1.156-.225 1.71 0 .554.223 1.02.684 1.11 1.226M10.5 16.5a2.25 2.25 0 114.5 0 2.25 2.25 0 01-4.5 0zM12 12.75a.75.75 0 100-1.5.75.75 0 000 1.5z" /> },
    { id: 'users', label: 'Utilisateurs', icon: <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.57-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.286z" /> },

  ];

  const navItems = allNavItems.filter(item => allowedPages.includes(item.id as Page));

  const SidebarContent = (
    <div className="flex flex-col flex-1 h-0 bg-white">
      <div className="flex items-center h-16 flex-shrink-0 px-4">
        <svg className="h-8 w-auto text-primary-600" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
          <path fillRule="evenodd" clipRule="evenodd" d="M12.158 3.323a1.5 1.5 0 00-1.816 0L3.64 7.647a1.5 1.5 0 00-.814 1.32v6.066c0 .54.288 1.033.743 1.303l7.03 4.102a1.5 1.5 0 001.556 0l7.03-4.102c.455-.27.743-.763.743-1.302V8.967a1.5 1.5 0 00-.814-1.32L12.158 3.323zM12 12.255l4.28-2.5-1.144-.67L12 10.92l-3.136-1.835-1.144.67L12 12.255zM8.5 13.5v-2.25L12 13.09l3.5-1.84v2.25L12 15.332 8.5 13.5z" />
        </svg>
        <span className="ml-3 text-xl font-bold text-gray-800">Frigo</span>
      </div>
      <div className="flex-1 flex flex-col overflow-y-auto">
        <nav className="flex-1 px-2 py-4 space-y-1">
          {navItems.map((item) => (
            <a
              key={item.id}
              href="#"
              onClick={(e) => { e.preventDefault(); onNavigate(item.id as Page); }}
              className={`flex items-center px-4 py-2 text-sm font-medium rounded-md transition-colors ${currentPage === item.id
                ? 'bg-primary-100 text-primary-700'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
            >
              <svg className="h-6 w-6 mr-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                {item.icon}
              </svg>
              {item.label}
            </a>
          ))}
        </nav>
      </div>
      <div className="flex-shrink-0 flex border-t p-4">
        <div className="flex-shrink-0 w-full group block">
          <div className="flex items-center">
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-700 group-hover:text-gray-900 truncate">{user.email}</p>
              <button onClick={onLogout} className="text-xs font-medium text-gray-500 group-hover:text-gray-700 hover:underline">
                Déconnexion
              </button>
            </div>
            <button onClick={onLogout} className="ml-auto p-2 rounded-full hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500" aria-label="Déconnexion">
              <svg className="h-6 w-6 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const TabletRailContent = (
    <div className="flex flex-col flex-1 h-0 bg-white">
      <div className="flex items-center justify-center h-16 flex-shrink-0 border-b border-gray-100">
        <svg className="h-8 w-8 text-primary-600" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
          <path fillRule="evenodd" clipRule="evenodd" d="M12.158 3.323a1.5 1.5 0 00-1.816 0L3.64 7.647a1.5 1.5 0 00-.814 1.32v6.066c0 .54.288 1.033.743 1.303l7.03 4.102a1.5 1.5 0 001.556 0l7.03-4.102c.455-.27.743-.763.743-1.302V8.967a1.5 1.5 0 00-.814-1.32L12.158 3.323zM12 12.255l4.28-2.5-1.144-.67L12 10.92l-3.136-1.835-1.144.67L12 12.255zM8.5 13.5v-2.25L12 13.09l3.5-1.84v2.25L12 15.332 8.5 13.5z" />
        </svg>
      </div>
      <div className="flex-1 flex flex-col overflow-y-auto">
        <nav className="flex-1 px-1 py-4 space-y-3 flex flex-col items-center">
          {navItems.map((item) => (
            <a
              key={item.id}
              href="#"
              onClick={(e) => { e.preventDefault(); onNavigate(item.id as Page); }}
              className={`flex flex-col items-center justify-center w-16 h-16 rounded-xl transition-all ${currentPage === item.id
                ? 'bg-primary-50 text-primary-700 shadow-sm border border-primary-100'
                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                }`}
              title={item.label}
            >
              <svg className="h-6 w-6 mb-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                {item.icon}
              </svg>
              <span className="text-[10px] font-semibold text-center leading-tight truncate w-full px-1">{item.label}</span>
            </a>
          ))}
        </nav>
      </div>
      <div className="flex-shrink-0 flex border-t p-2 justify-center">
        <button
          onClick={onLogout}
          className="p-3 rounded-xl text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors"
          title="Déconnexion"
        >
          <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile sidebar */}
      <div
        className={`md:hidden fixed inset-0 z-50 transition-all duration-300 ease-in-out ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        role="dialog"
        aria-modal="true"
      >
        <div className={`fixed inset-0 z-40 flex transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
          <div className="fixed inset-0 bg-black bg-opacity-60" onClick={onClose} aria-hidden="true"></div>

          <div className={`relative flex flex-col w-64 max-w-[80vw] h-full bg-white transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
            <div className="absolute top-0 right-0 -mr-12 pt-2">
              <button
                type="button"
                className="ml-1 flex items-center justify-center h-10 w-10 rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
                onClick={onClose}
              >
                <span className="sr-only">Fermer le menu</span>
                <svg className="h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {SidebarContent}
          </div>
        </div>
      </div>

      {/* Tablet Mini-Rail Sidebar (768px to 1024px) */}
      <div className="hidden md:flex lg:hidden flex-shrink-0">
        <div className="flex flex-col w-20 border-r border-gray-200">
          {TabletRailContent}
        </div>
      </div>

      {/* Desktop Full Sidebar (>= 1024px) */}
      <div className="hidden lg:flex lg:flex-shrink-0">
        <div className="flex flex-col w-64 border-r border-gray-200">
          {SidebarContent}
        </div>
      </div>
    </>
  );
};

export default Sidebar;
