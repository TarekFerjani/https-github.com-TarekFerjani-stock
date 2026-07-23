import React, { useState } from 'react';
import { Page } from '../types';

interface BottomNavBarProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  allowedPages: Page[];
}

const BottomNavBar: React.FC<BottomNavBarProps> = ({ currentPage, onNavigate, allowedPages }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Complete list of all navigation items with icons and translations
  const allNavItems = [
    {
      id: 'dashboard',
      label: 'Tableau',
      icon: (
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
        />
      ),
    },
    {
      id: 'stock',
      label: 'Stock',
      icon: (
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"
        />
      ),
    },
    {
      id: 'locations',
      label: 'Locations',
      icon: (
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 2.25c-4.14 0-7.5 3.36-7.5 7.5 0 5.625 7.5 12.75 7.5 12.75s7.5-7.125 7.5-12.75c0-4.14-3.36-7.5-7.5-7.5zm0 10.5a3 3 0 110-6 3 3 0 010 6z"
        />
      ),
    },
    {
      id: 'clients',
      label: 'Clients',
      icon: (
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
        />
      ),
    },
    {
      id: 'products',
      label: 'Produits',
      icon: (
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
        />
      ),
    },
    {
      id: 'rooms',
      label: 'Chambres',
      icon: (
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
        />
      ),
    },
    {
      id: 'factures',
      label: 'Factures',
      icon: (
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      ),
    },
    {
      id: 'contrats',
      label: 'Contrats',
      icon: (
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125"
        />
      ),
    },
    {
      id: 'reports',
      label: 'Rapports',
      icon: (
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
        />
      ),
    },
    {
      id: 'settings',
      label: 'Réglages',
      icon: (
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
        />
      ),
    },
    {
      id: 'users',
      label: 'Utilisateurs',
      icon: (
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.57-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.286z"
        />
      ),
    }
  ];

  // Preferred primary tabs for immediate quick access
  const preferredPrimaries = ['dashboard', 'stock', 'locations', 'factures'];

  // Filter allowed pages that we want to place in primary list
  const primaryCandidates = allNavItems.filter(
    (item) => allowedPages.includes(item.id as Page) && preferredPrimaries.includes(item.id)
  );

  // If the user does not have access to some preferred primaries, fill with other allowed pages
  const otherAllowedCandidates = allNavItems.filter(
    (item) => allowedPages.includes(item.id as Page) && !preferredPrimaries.includes(item.id)
  );

  // We want exactly 4 primary tabs if possible
  const primaryTabs = [...primaryCandidates];
  while (primaryTabs.length < Math.min(4, allowedPages.length)) {
    const nextCandidate = otherAllowedCandidates.shift();
    if (nextCandidate) {
      primaryTabs.push(nextCandidate);
    } else {
      break;
    }
  }

  // The remaining pages go into the "Plus" slide-up drawer
  const secondaryTabs = allNavItems.filter(
    (item) =>
      allowedPages.includes(item.id as Page) &&
      !primaryTabs.some((p) => p.id === item.id)
  );

  const hasSecondaryTabs = secondaryTabs.length > 0;
  const isCurrentInSecondary = secondaryTabs.some((s) => s.id === currentPage);

  const handleNavigate = (pageId: Page) => {
    onNavigate(pageId);
    setIsMenuOpen(false);
  };

  return (
    <>
      {/* Bottom Sheet Drawer for "Plus" (More) pages */}
      <div
        className={`md:hidden fixed inset-0 z-50 transition-all duration-300 ease-in-out ${
          isMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Semi-transparent backdrop with backdrop blur */}
        <div
          className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300"
          onClick={() => setIsMenuOpen(false)}
        />

        {/* Sliding Bottom Sheet */}
        <div
          className={`absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl border-t border-gray-100 px-6 pt-5 pb-8 transition-transform duration-300 ease-out transform ${
            isMenuOpen ? 'translate-y-0' : 'translate-y-full'
          }`}
        >
          {/* Grab handle indicator */}
          <div className="flex justify-center mb-5">
            <div className="w-12 h-1 bg-gray-200 rounded-full" />
          </div>

          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-gray-900">Toutes les rubriques</h3>
            <button
              onClick={() => setIsMenuOpen(false)}
              className="p-1 rounded-full bg-gray-100 text-gray-500 hover:text-gray-700 active:scale-95 transition-all"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Grid Layout of secondary sections */}
          <div className="grid grid-cols-4 gap-y-6 gap-x-3 max-h-[60vh] overflow-y-auto pb-4">
            {secondaryTabs.map((item) => {
              const isActive = currentPage === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavigate(item.id as Page)}
                  className="flex flex-col items-center justify-start text-center group cursor-pointer focus:outline-none"
                >
                  <div
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-200 mb-2 active:scale-90 ${
                      isActive
                        ? 'bg-primary-600 text-white shadow-md shadow-primary-200'
                        : 'bg-gray-50 text-gray-600 group-hover:bg-gray-100 group-hover:text-gray-900'
                    }`}
                  >
                    <svg
                      className="h-6 w-6"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      {item.icon}
                    </svg>
                  </div>
                  <span
                    className={`text-[11px] font-medium leading-tight truncate w-full px-1 ${
                      isActive ? 'text-primary-600 font-semibold' : 'text-gray-600'
                    }`}
                  >
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-gray-100 shadow-[0_-4px_24px_rgba(0,0,0,0.04)] z-40 pb-safe">
        <div className="flex justify-around items-center h-16 px-2">
          {/* Primary Tabs */}
          {primaryTabs.map((item) => {
            const isActive = currentPage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavigate(item.id as Page)}
                className={`flex flex-col items-center justify-center w-full h-full transition-all duration-150 relative active:scale-95 ${
                  isActive ? 'text-primary-600' : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                <svg
                  className="h-6 w-6 transition-transform duration-200"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  {item.icon}
                </svg>
                <span className="text-[10px] font-bold mt-1 tracking-tight">{item.label}</span>
                {isActive && (
                  <span className="absolute bottom-1 w-1.5 h-1.5 bg-primary-600 rounded-full" />
                )}
              </button>
            );
          })}

          {/* Plus / More Tab */}
          {hasSecondaryTabs && (
            <button
              onClick={() => setIsMenuOpen(true)}
              className={`flex flex-col items-center justify-center w-full h-full transition-all duration-150 relative active:scale-95 ${
                isCurrentInSecondary || isMenuOpen ? 'text-primary-600' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <div
                className={`flex items-center justify-center rounded-full transition-transform duration-300 ${
                  isMenuOpen ? 'rotate-45' : ''
                }`}
              >
                <svg
                  className="h-6 w-6"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <span className="text-[10px] font-bold mt-1 tracking-tight">Plus</span>
              {isCurrentInSecondary && !isMenuOpen && (
                <span className="absolute bottom-1 w-1.5 h-1.5 bg-primary-600 rounded-full" />
              )}
            </button>
          )}
        </div>
      </nav>
    </>
  );
};

export default BottomNavBar;
