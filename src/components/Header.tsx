import React from 'react';

interface HeaderProps {
  onSearch: (term: string) => void;
  onMenuClick: () => void;
}

const Header: React.FC<HeaderProps> = ({ onSearch, onMenuClick }) => {
  return (
    <header className="bg-white shadow-sm sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <button onClick={onMenuClick} className="md:hidden p-2 -ml-2 text-gray-500 hover:text-gray-700 focus:outline-none">
              <span className="sr-only">Ouvrir le menu</span>
              <svg className="h-8 w-8" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
             <h1 className="text-lg sm:text-xl font-bold text-gray-900 md:ml-0 ml-2">Frigo</h1>
          </div>
          <div className="flex items-center space-x-2 sm:space-x-4">
             <div className="relative">
                <input
                    type="text"
                    placeholder="Rechercher..."
                    onChange={(e) => onSearch(e.target.value)}
                    className="w-32 sm:w-64 pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                />
                 <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                     <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                     </svg>
                 </div>
             </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;