import { Location } from '../types';
import { apiService } from './apiService';

export const locationService = {
  getLocations: (): Promise<Location[]> => {
    return apiService.get<Location[]>('/locations');
  },

  addLocation: (locationData: Location): Promise<Location> => {
    return apiService.post<Location>('/locations', locationData);
  },
  
  deleteLocation: (locationId: string): Promise<{ success: boolean }> => {
    return apiService.delete<{ success: boolean }>(`/locations/${locationId}`);
  },

  // La logique FIFO est maintenant gérée par le backend.
  processWithdrawal: (clientId: string, nbCaisseToWithdraw: number): Promise<{ affectedLocations: Location[] }> => {
    return apiService.post<{ affectedLocations: Location[] }>('/locations/process-withdrawal', { clientId, nbCaisseToWithdraw });
  },
  
  // La logique d'annulation est également gérée par le backend.
  revertWithdrawal: (clientId: string, nbCaisseToRevert: number): Promise<{ success: boolean }> => {
     return apiService.post<{ success: boolean }>('/locations/revert-withdrawal', { clientId, nbCaisseToRevert });
  }
};
