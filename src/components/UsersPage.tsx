import React, { useState, useEffect, useCallback } from 'react';
import { User, Page, Role, PagePermissions } from '../types';
import { authService } from '../services/authService';

import AddUserModal from './AddUserModal';

const UsersPage: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [userToEdit, setUserToEdit] = useState<User | null>(null);

  const availablePages: Page[] = ['dashboard', 'clients', 'products', 'rooms', 'locations', 'stock', 'factures', 'contrats', 'reglements', 'reports'];
  const pageLabels: Record<Page, string> = {
    dashboard: "Tableau de bord",
    clients: "Clients",
    products: "Produits",
    rooms: "Chambres",
    locations: "Locations",
    ventes: "Ventes",
    movements: "Mouvements",
    factures: "Factures",
    reports: "Rapports",
    settings: "Paramètres",
    users: "Utilisateurs",
    stock: "Stock",
    contrats: "Contrats",
    reglements: "Paiements",
  };

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const fetchedUsers = await authService.getUsers();
      setUsers(fetchedUsers);
    } catch (err: any) {
      console.error("Error fetching users:", err);
      setError("Impossible de charger les utilisateurs. " + (err.message || err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleOpenModal = (user: User | null = null) => {
    setUserToEdit(user);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setUserToEdit(null);
    setIsModalOpen(false);
  };
  
  const handleSaveUser = async () => {
    handleCloseModal();
    fetchData();
  }

  const handleDeleteUser = async (userId: string) => {
    if (window.confirm("Êtes-vous sûr de vouloir supprimer cet utilisateur ?")) {
      await authService.deleteUser(userId);
      fetchData();
    }
  };


  
  if (isLoading) {
      return <div>Chargement...</div>
  }

  if (error) {
      return <div className="p-4 bg-red-100 text-red-700 rounded-md">Erreur : {error}</div>
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
            <h1 className="text-2xl font-semibold text-gray-700">Gestion des Utilisateurs</h1>
            <p className="text-sm text-gray-500">Ajoutez, modifiez et supprimez des utilisateurs.</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center justify-center h-10 w-10 md:w-auto md:px-4 md:py-2 bg-primary-600 text-white rounded-full md:rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all"
          aria-label="Ajouter un Utilisateur"
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
          <span className="hidden md:inline ml-2">Ajouter un Utilisateur</span>
        </button>
      </div>

      {/* Users List */}
      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rôle</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.map(user => (
                <tr key={user.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{user.email}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${user.role === Role.admin ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                          {user.role}
                      </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium space-x-3">
                    <button onClick={() => handleOpenModal(user)} className="text-indigo-600 hover:text-indigo-900">Éditer</button>
                    <button onClick={() => handleDeleteUser(user.id)} className="text-red-600 hover:text-red-900">Supprimer</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      


      {isModalOpen && (
        <AddUserModal
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          onSave={handleSaveUser}
          userToEdit={userToEdit}
          users={users}
        />
      )}
    </div>
  );
};

export default UsersPage;
