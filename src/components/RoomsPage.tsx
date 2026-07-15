import React, { useState, useMemo } from 'react';
import { Room, Location } from '../types';
import { roomService } from '../services/roomService';
import AddRoomModal from './AddRoomModal';

interface RoomsPageProps {
  rooms: Room[];
  locations: Location[];
  fetchAllData: () => void;
  isLoading: boolean;
  searchTerm: string;
}

const RoomsPage: React.FC<RoomsPageProps> = ({ rooms, locations, fetchAllData, isLoading, searchTerm }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [roomToEdit, setRoomToEdit] = useState<Room | null>(null);

  const roomOccupancy = useMemo(() => {
    const occupancyMap = new Map<string, number>();
    locations.forEach(loc => {
        if (loc.status === 'En cours') {
            occupancyMap.set(loc.roomId, (occupancyMap.get(loc.roomId) || 0) + loc.nbCaisse);
        }
    });
    return occupancyMap;
  }, [locations]);

  const handleSaveRoom = async (roomData: Omit<Room, 'id'> | Room) => {
    if ('id' in roomData) {
      await roomService.updateRoom(roomData);
    } else {
      await roomService.addRoom(roomData);
    }
    fetchAllData();
    closeModal();
  };

  const handleDeleteRoom = async (roomId: string) => {
    if(window.confirm('Êtes-vous sûr de vouloir supprimer cette chambre ?')){
      try {
        await roomService.deleteRoom(roomId);
        fetchAllData();
      } catch (error: any) {
        alert(`Erreur: ${error.message}`);
      }
    }
  };

  const openAddModal = () => {
    setRoomToEdit(null);
    setIsModalOpen(true);
  };

  const openEditModal = (room: Room) => {
    setRoomToEdit(room);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setRoomToEdit(null);
  };
  
  const filteredRooms = useMemo(() => {
    return rooms.filter(room =>
      room.nom.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [rooms, searchTerm]);

  const renderContent = () => {
    if (isLoading) {
       return <div className="text-center py-10">Chargement...</div>;
    }
    if (filteredRooms.length === 0) {
       return <div className="text-center py-10 bg-white rounded-lg shadow-md">Aucune chambre trouvée.</div>;
    }
    return (
      <>
        <div className="hidden md:block bg-white shadow-md rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nom</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Capacité</th>
                   <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Occupation</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                  {filteredRooms.map(room => {
                    const occupancy = roomOccupancy.get(room.id) || 0;
                    const occupancyRate = room.nbCaisse > 0 ? (occupancy / room.nbCaisse) * 100 : 0;
                    return (
                        <tr key={room.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{room.nom}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{room.nbCaisse} caisses</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <div className="flex items-center">
                                <div className="w-24 bg-gray-200 rounded-full h-2.5 mr-2">
                                    <div className="bg-primary-600 h-2.5 rounded-full" style={{ width: `${occupancyRate}%` }}></div>
                                </div>
                                <span>{occupancy} / {room.nbCaisse} ({occupancyRate.toFixed(0)}%)</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium space-x-3">
                            <button onClick={() => openEditModal(room)} className="text-indigo-600 hover:text-indigo-900">Éditer</button>
                            <button onClick={() => handleDeleteRoom(room.id)} className="text-red-600 hover:text-red-900">Supprimer</button>
                          </td>
                        </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>
        </div>
        <div className="md:hidden space-y-4">
            {filteredRooms.map(room => {
                const occupancy = roomOccupancy.get(room.id) || 0;
                return (
                    <div key={room.id} className="bg-white p-4 rounded-lg shadow-md">
                        <div className="flex justify-between items-center">
                          <h3 className="text-md font-bold text-gray-900">{room.nom}</h3>
                          <p className="text-sm text-gray-600"><span className="font-medium">Capacité:</span> {room.nbCaisse}</p>
                        </div>
                         <p className="text-sm text-gray-600 mt-2"><span className="font-medium">Occupation:</span> {occupancy} / {room.nbCaisse}</p>
                        <div className="mt-4 pt-4 border-t border-gray-200 flex justify-end space-x-4 text-sm font-medium">
                            <button onClick={() => openEditModal(room)} className="text-indigo-600 hover:text-indigo-900">Éditer</button>
                            <button onClick={() => handleDeleteRoom(room.id)} className="text-red-600 hover:text-red-900">Supprimer</button>
                        </div>
                    </div>
                )
            })}
        </div>
      </>
    );
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-gray-700">Gestion des Chambres</h1>
        <button 
          onClick={openAddModal} 
          className="flex items-center justify-center h-10 w-10 md:w-auto md:px-4 md:py-2 bg-primary-600 text-white rounded-full md:rounded-md hover:bg-primary-700"
          aria-label="Ajouter une Chambre"
        >
          <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          <span className="hidden md:inline ml-2">Ajouter une Chambre</span>
        </button>
      </div>
      {renderContent()}
      <AddRoomModal isOpen={isModalOpen} onClose={closeModal} onSave={handleSaveRoom} roomToEdit={roomToEdit} />
    </div>
  );
};

export default RoomsPage;