import { Room } from '../types';
import { apiService } from './apiService';

export const roomService = {
  getRooms: (): Promise<Room[]> => {
    return apiService.get<Room[]>('/rooms');
  },

  addRoom: (roomData: Omit<Room, 'id'>): Promise<Room> => {
    return apiService.post<Room>('/rooms', roomData);
  },

  updateRoom: (updatedRoom: Room): Promise<Room> => {
    return apiService.put<Room>(`/rooms/${updatedRoom.id}`, updatedRoom);
  },

  deleteRoom: (roomId: string): Promise<{ success: boolean }> => {
    return apiService.delete<{ success: boolean }>(`/rooms/${roomId}`);
  },
};
