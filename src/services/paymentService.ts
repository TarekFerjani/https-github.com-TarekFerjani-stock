import { Reglement, Avance } from '../types';
import { apiService } from './apiService';

export const paymentService = {
  getReglements: (): Promise<Reglement[]> => {
    return apiService.get<Reglement[]>('/payments/reglements');
  },

  addReglement: (data: Omit<Reglement, 'id' | 'date'>): Promise<Reglement> => {
    return apiService.post<Reglement>('/payments/reglements', data);
  },

  deleteReglement: (id: string): Promise<void> => {
    return apiService.delete<void>(`/payments/reglements/${id}`);
  },

  getAvances: (): Promise<Avance[]> => {
    return apiService.get<Avance[]>('/payments/avances');
  },

  addAvance: (data: Omit<Avance, 'id' | 'date'>): Promise<Avance> => {
    return apiService.post<Avance>('/payments/avances', data);
  },

  deleteAvance: (id: string): Promise<void> => {
    return apiService.delete<void>(`/payments/avances/${id}`);
  },
};
