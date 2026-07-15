import React, { useState, useEffect } from 'react';
import { User, Role, Page, PagePermissions } from '../types';
import { authService } from '../services/authService';

interface AddUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  userToEdit: User | null;
  users: User[];
}

const defaultPermissions: PagePermissions = {
  dashboard: true,
  clients: true,
  products: true,
  rooms: true,
  locations: true,
  stock: true,
  factures: false,
  contrats: false,
  reglements: false,
  reports: false,
};

const availablePages: Page[] = ['dashboard', 'clients', 'products', 'rooms', 'locations', 'stock', 'factures', 'contrats', 'reglements', 'reports'];
const pageLabels: Record<Page, string> = {
  dashboard: "Tableau de bord",
  clients: "Clients",
  products: "Produits",
  rooms: "Chambres",
  locations: "Locations",
  factures: "Factures",
  reports: "Rapports",
  settings: "Paramètres",
  users: "Utilisateurs",
  stock: "Stock",
  contrats: "Contrats",
  reglements: "Règlements & Avances",
};

const AddUserModal: React.FC<AddUserModalProps> = ({ isOpen, onClose, onSave, userToEdit, users }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>(Role.user);
  const [permissions, setPermissions] = useState<PagePermissions>(defaultPermissions);
  
  const isEditing = !!userToEdit;

  useEffect(() => {
    if (userToEdit) {
      setEmail(userToEdit.email);
      setRole(userToEdit.role);
      setPassword('');
      setPermissions(userToEdit.permissions || defaultPermissions);
    } else {
      setEmail('');
      setPassword('');
      setRole(Role.user);
      setPermissions(defaultPermissions);
    }
  }, [userToEdit, isOpen]);

  const handlePermissionChange = (page: Page, isEnabled: boolean) => {
    setPermissions({ ...permissions, [page]: isEnabled });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isEditing && userToEdit && userToEdit.role === Role.admin && role === Role.user) {
        const adminCount = users.filter(u => u.role === Role.admin).length;
        if (adminCount <= 1) {
            alert("Opération non autorisée. Vous ne pouvez pas changer le rôle du dernier administrateur.");
            return;
        }
    }

    if (isEditing && userToEdit) {
      await authService.updateUser({ ...userToEdit, email, role, permissions, password: password || undefined });
    } else {
      await authService.addUser({ email, password, role, permissions });
    }
    onSave();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="p-6 border-b shrink-0 flex justify-between items-center">
            <h3 className="text-xl font-semibold text-gray-800">{isEditing ? "Éditer l'Utilisateur" : 'Ajouter un Utilisateur'}</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        </div>
        <div className="p-6 overflow-y-auto">
          <form onSubmit={handleSubmit} id="user-form" className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email</label>
              <input type="email" name="email" id="email" value={email} onChange={e => setEmail(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3" required />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Mot de passe {isEditing && <span className="text-xs text-gray-400">(laisser vide pour ne pas changer)</span>}
              </label>
              <input type="password" name="password" id="password" value={password} onChange={e => setPassword(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3" required={!isEditing} />
            </div>
            <div>
              <label htmlFor="role" className="block text-sm font-medium text-gray-700">Rôle</label>
              <select id="role" name="role" value={role} onChange={e => setRole(e.target.value as Role)} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3">
                <option value={Role.user}>Utilisateur</option>
                <option value={Role.admin}>Administrateur</option>
              </select>
            </div>

            {role === Role.user && (
              <div className="mt-6 pt-4 border-t">
                <h4 className="text-md font-medium text-gray-800 mb-3">Permissions d'accès (Écrans)</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {availablePages.map(page => (
                    <div key={page} className="flex items-center">
                      <input
                        type="checkbox"
                        id={`modal-perm-${page}`}
                        checked={!!permissions[page]}
                        onChange={(e) => handlePermissionChange(page, e.target.checked)}
                        className="h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                      />
                      <label htmlFor={`modal-perm-${page}`} className="ml-3 block text-sm font-medium text-gray-700">
                        {pageLabels[page]}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </form>
        </div>
        <div className="p-6 border-t bg-gray-50 flex justify-end space-x-2 shrink-0">
            <button type="button" onClick={onClose} className="py-2 px-4 bg-white border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50">Annuler</button>
            <button type="submit" form="user-form" className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700">{isEditing ? 'Mettre à Jour' : 'Ajouter'}</button>
        </div>
      </div>
    </div>
  );
};

export default AddUserModal;
