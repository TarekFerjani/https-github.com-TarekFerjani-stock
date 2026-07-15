import React, { useMemo } from 'react';
import { Location, Client, Product, Room } from '../types';

interface LocationsPageProps {
  locations: Location[];
  clients: Client[];
  products: Product[];
  rooms: Room[];
  isLoading: boolean;
  searchTerm: string;
}

type EnrichedLocation = Location & {
    clientName: string;
    productName: string;
    roomName: string;
}

const LocationsPage: React.FC<LocationsPageProps> = ({ locations, clients, products, rooms, isLoading, searchTerm }) => {
  const enrichedLocations: EnrichedLocation[] = useMemo(() => {
    const clientMap = new Map(clients.map(c => [c.id, `${c.nom} ${c.prenom}`]));
    const productMap = new Map(products.map(p => [p.id, p.nom]));
    const roomMap = new Map(rooms.map(r => [r.id, r.nom]));
    
    return locations.map(loc => ({
        ...loc,
        clientName: clientMap.get(loc.clientId) || 'N/A',
        productName: productMap.get(loc.productId) || 'N/A',
        roomName: roomMap.get(loc.roomId) || 'N/A'
    }));
  }, [locations, clients, products, rooms]);

  const filteredLocations = useMemo(() => {
    return enrichedLocations.filter(loc =>
      loc.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      loc.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      loc.roomName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      loc.status.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [enrichedLocations, searchTerm]);

  const groupedLocations = useMemo(() => {
    const groups: Record<string, { 
      clientId: string; 
      clientName: string; 
      clientCin: string; 
      clientPhone: string; 
      locations: EnrichedLocation[]; 
      totalActiveCrates: number;
    }> = {};

    filteredLocations.forEach(loc => {
      const clientObj = clients.find(c => c.id === loc.clientId);
      const key = loc.clientId;
      if (!groups[key]) {
        groups[key] = {
          clientId: loc.clientId,
          clientName: loc.clientName,
          clientCin: clientObj?.cin || 'N/A',
          clientPhone: clientObj?.telephone || 'N/A',
          locations: [],
          totalActiveCrates: 0,
        };
      }
      groups[key].locations.push(loc);
      if (loc.status === 'En cours') {
        groups[key].totalActiveCrates += Number(loc.nbCaisse) || 0;
      }
    });

    return Object.values(groups).sort((a, b) => a.clientName.localeCompare(b.clientName));
  }, [filteredLocations, clients]);

  const renderContent = () => {
    if (isLoading) {
      return <div className="text-center py-10">Chargement des locations...</div>;
    }
    if (groupedLocations.length === 0) {
      return <div className="text-center py-10 bg-white rounded-lg shadow-md">Aucune location trouvée.</div>;
    }

    return (
      <div className="space-y-8">
        {groupedLocations.map(group => (
          <div key={group.clientId} className="bg-white shadow-md rounded-xl overflow-hidden border border-gray-100">
            {/* Group Header */}
            <div className="bg-gray-50 border-b border-gray-100 px-6 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                  <svg className="w-5 h-5 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  {group.clientName.toUpperCase()}
                </h2>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-gray-500 font-medium">
                  <span>CIN: {group.clientCin}</span>
                  {group.clientPhone !== 'N/A' && <span>Tél: {group.clientPhone}</span>}
                </div>
              </div>
              <div className="bg-primary-50 text-primary-800 rounded-lg px-3.5 py-1.5 text-xs font-semibold flex items-center gap-2 border border-primary-100">
                <span className="h-2 w-2 rounded-full bg-primary-500 animate-pulse"></span>
                <span>{group.totalActiveCrates} caisses en cours de location</span>
              </div>
            </div>

            {/* Group Locations List */}
            <div className="hidden md:block">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Statut</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Produit</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Chambre de Stockage</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Caisses (Restant / Initial)</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Date d'entrée</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Date de sortie</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {group.locations.map(loc => (
                    <tr key={loc.id} className="hover:bg-gray-50/40 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${loc.status === 'En cours' ? 'bg-emerald-50 text-emerald-800 border border-emerald-100' : 'bg-gray-100 text-gray-800'}`}>
                          {loc.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">{loc.productName}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{loc.roomName}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-700">
                        {loc.nbCaisse} / <span className="text-gray-400 text-xs font-normal">{loc.initialNbCaisse}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(loc.entryDate).toLocaleDateString('fr-FR')}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {loc.exitDate ? new Date(loc.exitDate).toLocaleDateString('fr-FR') : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards for Group */}
            <div className="md:hidden divide-y divide-gray-100">
              {group.locations.map(loc => (
                <div key={loc.id} className="p-4 space-y-2">
                  <div className="flex justify-between items-start">
                    <span className="text-sm font-bold text-gray-900">{loc.productName}</span>
                    <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full ${loc.status === 'En cours' ? 'bg-emerald-50 text-emerald-800' : 'bg-gray-100 text-gray-800'}`}>
                      {loc.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
                    <div>Chambre: <span className="font-semibold text-gray-700">{loc.roomName}</span></div>
                    <div>Caisses: <span className="font-semibold text-gray-700">{loc.nbCaisse} / {loc.initialNbCaisse}</span></div>
                    <div>Entrée: <span className="font-semibold text-gray-700">{new Date(loc.entryDate).toLocaleDateString('fr-FR')}</span></div>
                    <div>Sortie: <span className="font-semibold text-gray-700">{loc.exitDate ? new Date(loc.exitDate).toLocaleDateString('fr-FR') : '-'}</span></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-gray-700">État de Location par Client</h1>
      </div>
      {renderContent()}
    </div>
  );
};

export default LocationsPage;