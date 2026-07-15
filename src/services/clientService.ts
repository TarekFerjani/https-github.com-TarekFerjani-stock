import { Client } from '../types';
import { apiService } from './apiService';

export const clientService = {
  getClients: (): Promise<Client[]> => {
    return apiService.get<Client[]>('/clients');
  },

  addClient: (clientData: Omit<Client, 'id'>): Promise<Client> => {
    return apiService.post<Client>('/clients', clientData);
  },

  updateClient: (updatedClient: Client): Promise<Client> => {
    return apiService.put<Client>(`/clients/${updatedClient.id}`, updatedClient);
  },

  deleteClient: (clientId: string): Promise<{ success: boolean }> => {
    return apiService.delete<{ success: boolean }>(`/clients/${clientId}`);
  },
};
