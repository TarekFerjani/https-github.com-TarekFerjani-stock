import React, { useState, useMemo } from 'react';
import { Client } from '../types';
import { clientService } from '../services/clientService';
import AddClientModal from './AddClientModal';

interface ClientsPageProps {
  clients: Client[];
  fetchAllData: () => void;
  isLoading: boolean;
  searchTerm: string;
}

const ClientsPage: React.FC<ClientsPageProps> = ({ clients, fetchAllData, isLoading, searchTerm }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [clientToEdit, setClientToEdit] = useState<Client | null>(null);

  const handleSaveClient = async (clientData: Omit<Client, 'id'> | Client) => {
    if ('id' in clientData) {
      await clientService.updateClient(clientData);
    } else {
      await clientService.addClient(clientData);
    }
    fetchAllData();
    closeModal();
  };

  const handleDeleteClient = async (clientId: string) => {
    if(window.confirm('Êtes-vous sûr de vouloir supprimer ce client ?')){
      try {
        await clientService.deleteClient(clientId);
        fetchAllData();
      } catch (error: any) {
        alert(`Erreur: ${error.message}`);
      }
    }
  };

  const openAddModal = () => {
    setClientToEdit(null);
    setIsModalOpen(true);
  };

  const openEditModal = (client: Client) => {
    setClientToEdit(client);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setClientToEdit(null);
  };

  const filteredClients = useMemo(() => {
    return clients.filter(client =>
      client.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.prenom.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.cin.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.telephone.includes(searchTerm)
    );
  }, [clients, searchTerm]);

  const renderContent = () => {
    if (isLoading) {
      return <div className="text-center py-10">Chargement...</div>;
    }
    if (filteredClients.length === 0) {
      return <div className="text-center py-10 bg-white rounded-lg shadow-md">Aucun client trouvé.</div>;
    }
    return (
      <>
        {/* Desktop Table View */}
        <div className="hidden md:block bg-white shadow-md rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nom</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Prénom</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">CIN</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tél / Email</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Caisses Réservées</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                  {filteredClients.map(client => (
                    <tr key={client.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{client.nom}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{client.prenom}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{client.cin}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div>{client.telephone}</div>
                        <div className="text-xs text-gray-400">{client.email}</div>
                      </td>
                       <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{client.caissesReservees}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium space-x-3">
                        <button onClick={() => openEditModal(client)} className="text-indigo-600 hover:text-indigo-900">Éditer</button>
                        <button onClick={() => handleDeleteClient(client.id)} className="text-red-600 hover:text-red-900">Supprimer</button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden space-y-4">
            {filteredClients.map(client => (
                 <div key={client.id} className="bg-white p-4 rounded-lg shadow-md">
                    <div className="flex justify-between items-start">
                         <h3 className="text-md font-bold text-gray-900">{client.nom} {client.prenom}</h3>
                    </div>
                     <div className="mt-2 space-y-1 text-sm text-gray-600">
                         <p><span className="font-medium">CIN:</span> {client.cin}</p>
                         <p><span className="font-medium">Tél:</span> {client.telephone}</p>
                         <p><span className="font-medium">Caisses:</span> {client.caissesReservees}</p>
                     </div>
                     <div className="mt-4 pt-4 border-t border-gray-200 flex justify-end space-x-4 text-sm font-medium">
                        <button onClick={() => openEditModal(client)} className="text-indigo-600 hover:text-indigo-900">Éditer</button>
                        <button onClick={() => handleDeleteClient(client.id)} className="text-red-600 hover:text-red-900">Supprimer</button>
                    </div>
                </div>
            ))}
        </div>
      </>
    );
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-gray-700">Gestion des Clients</h1>
        <button 
          onClick={openAddModal} 
          className="flex items-center justify-center h-10 w-10 md:w-auto md:px-4 md:py-2 bg-primary-600 text-white rounded-full md:rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all"
          aria-label="Ajouter un Client"
        >
            <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
            <span className="hidden md:inline ml-2">Ajouter un Client</span>
        </button>
      </div>
      
      {renderContent()}
      
      <AddClientModal isOpen={isModalOpen} onClose={closeModal} onSave={handleSaveClient} clientToEdit={clientToEdit} />

    </div>
  );
};

export default ClientsPage;