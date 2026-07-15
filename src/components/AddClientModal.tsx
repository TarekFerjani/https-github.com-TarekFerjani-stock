import React, { useState, useEffect } from 'react';
import { Client } from '../types';

interface AddClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (client: Omit<Client, 'id'> | Client) => void;
  clientToEdit: Client | null;
}

const AddClientModal: React.FC<AddClientModalProps> = ({ isOpen, onClose, onSave, clientToEdit }) => {
  const [client, setClient] = useState({ nom: '', prenom: '', cin: '', telephone: '', email: '', caissesReservees: 0 });

  useEffect(() => {
    if (clientToEdit) {
      setClient({
        nom: clientToEdit.nom || '',
        prenom: clientToEdit.prenom || '',
        cin: clientToEdit.cin || '',
        telephone: clientToEdit.telephone || '',
        email: clientToEdit.email || '',
        caissesReservees: clientToEdit.caissesReservees || 0
      });
    } else {
      setClient({ nom: '', prenom: '', cin: '', telephone: '', email: '', caissesReservees: 0 });
    }
  }, [clientToEdit, isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setClient(prev => ({ ...prev, [name]: name === 'caissesReservees' ? parseInt(value, 10) || 0 : value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(clientToEdit ? { ...client, id: clientToEdit.id } : client);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="p-6">
          <div className="flex justify-between items-center pb-3 border-b">
            <h3 className="text-xl font-semibold text-gray-800">{clientToEdit ? 'Éditer le Client' : 'Ajouter un Client'}</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
          </div>
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="nom" className="block text-sm font-medium text-gray-700">Nom</label>
                <input type="text" name="nom" id="nom" value={client.nom} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500" required />
              </div>
              <div>
                <label htmlFor="prenom" className="block text-sm font-medium text-gray-700">Prénom</label>
                <input type="text" name="prenom" id="prenom" value={client.prenom} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500" required />
              </div>
            </div>
            <div>
              <label htmlFor="cin" className="block text-sm font-medium text-gray-700">CIN</label>
              <input type="text" name="cin" id="cin" value={client.cin} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500" required />
            </div>
            <div>
              <label htmlFor="telephone" className="block text-sm font-medium text-gray-700">Téléphone</label>
              <input type="tel" name="telephone" id="telephone" value={client.telephone} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500" />
            </div>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email</label>
              <input type="email" name="email" id="email" value={client.email} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500" />
            </div>
             <div>
              <label htmlFor="caissesReservees" className="block text-sm font-medium text-gray-700">Caisses Réservées</label>
              <input type="number" name="caissesReservees" id="caissesReservees" value={client.caissesReservees} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500" />
            </div>
            <div className="pt-4 flex justify-end space-x-2">
              <button type="button" onClick={onClose} className="py-2 px-4 bg-white border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50">Annuler</button>
              <button type="submit" className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700">{clientToEdit ? 'Mettre à Jour' : 'Ajouter'}</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AddClientModal;
