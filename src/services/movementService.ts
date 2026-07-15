import { Movement } from '../types';
import { apiService } from './apiService';

export const movementService = {
  getMovements: (): Promise<Movement[]> => {
    return apiService.get<Movement[]>('/movements');
  },

  addMovement: (movementData: Omit<Movement, 'id' | 'date'>): Promise<Movement> => {
    // Le backend gérera la création du mouvement, de la location et de la facture associées dans une seule transaction.
    return apiService.post<Movement>('/movements', movementData);
  },

  updateMovement: (updatedMovement: Movement): Promise<Movement> => {
    // Le backend gère la logique complexe de mise à jour des enregistrements liés.
    return apiService.put<Movement>(`/movements/${updatedMovement.id}`, updatedMovement);
  },

  deleteMovement: (movementId: string): Promise<{ success: boolean }> => {
    // Le backend gère la logique complexe d'annulation des enregistrements associés (locations, factures).
    return apiService.delete<{ success: boolean }>(`/movements/${movementId}`);
  },
};
