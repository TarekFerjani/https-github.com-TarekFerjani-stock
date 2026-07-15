import { apiService } from './apiService';
import { Contract } from '../types';

export const contractService = {
  getContracts: async () => {
    return await apiService.get<Contract[]>('/contracts');
  },
  createContract: async (contract: Partial<Contract>) => {
    return await apiService.post<Contract>('/contracts', contract);
  },
  updateContractStatus: async (id: string, status: string) => {
    return await apiService.put(`/contracts/${id}`, { status });
  },
  deleteContract: async (id: string) => {
    return await apiService.delete(`/contracts/${id}`);
  },
  sendContractEmail: async (id: string) => {
    return await apiService.post(`/contracts/send/${id}`, {});
  }
};
