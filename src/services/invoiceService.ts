import { Invoice } from '../types';
import { apiService } from './apiService';

export const invoiceService = {
  getInvoices: (): Promise<Invoice[]> => {
    return apiService.get<Invoice[]>('/invoices');
  },

  getInvoiceById: (id: string): Promise<Invoice | undefined> => {
    return apiService.get<Invoice>(`/invoices/${id}`);
  },

  addInvoice: (invoiceData: Invoice): Promise<Invoice> => {
    // Le backend peut gérer une logique "upsert" si nécessaire
    return apiService.post<Invoice>('/invoices', invoiceData);
  },
  
  deleteInvoice: (invoiceId: string): Promise<{ success: boolean }> => {
    return apiService.delete<{ success: boolean }>(`/invoices/${invoiceId}`);
  },

  updateInvoiceStatus: (invoiceId: string): Promise<Invoice | null> => {
    // Une action spécifique, idéale pour un endpoint PATCH ou POST dédié
    return apiService.post<Invoice>(`/invoices/${invoiceId}/toggle-payment`, {});
  },
};
