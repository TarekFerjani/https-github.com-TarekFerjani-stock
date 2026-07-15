import React, { useState, useEffect } from 'react';
import { Room } from '../types';

interface AddRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (room: Omit<Room, 'id'> | Room) => void;
  roomToEdit: Room | null;
}

const AddRoomModal: React.FC<AddRoomModalProps> = ({ isOpen, onClose, onSave, roomToEdit }) => {
  const [room, setRoom] = useState({ nom: '', nbCaisse: 0 });

  useEffect(() => {
    if (roomToEdit) {
      setRoom(roomToEdit);
    } else {
      setRoom({ nom: '', nbCaisse: 0 });
    }
  }, [roomToEdit, isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setRoom(prev => ({ ...prev, [name]: name === 'nbCaisse' ? parseInt(value, 10) || 0 : value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(roomToEdit ? { ...room, id: roomToEdit.id } : room);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="p-6">
          <div className="flex justify-between items-center pb-3 border-b">
            <h3 className="text-xl font-semibold text-gray-800">{roomToEdit ? 'Éditer la Chambre' : 'Ajouter une Chambre'}</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
          </div>
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div>
              <label htmlFor="nom" className="block text-sm font-medium text-gray-700">Nom</label>
              <input type="text" name="nom" id="nom" value={room.nom} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500" required />
            </div>
            <div>
              <label htmlFor="nbCaisse" className="block text-sm font-medium text-gray-700">Nb Caisse</label>
               <input type="number" name="nbCaisse" id="nbCaisse" value={room.nbCaisse} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500" required />
            </div>
            <div className="pt-4 flex justify-end space-x-2">
              <button type="button" onClick={onClose} className="py-2 px-4 bg-white border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50">Annuler</button>
              <button type="submit" className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700">{roomToEdit ? 'Mettre à Jour' : 'Ajouter'}</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AddRoomModal;
