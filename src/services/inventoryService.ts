import { Product } from '../types';
import { apiService } from './apiService';

export const inventoryService = {
  getProducts: (): Promise<Product[]> => {
    return apiService.get<Product[]>('/products');
  },

  addProduct: (productData: Omit<Product, 'id'>): Promise<Product> => {
    return apiService.post<Product>('/products', productData);
  },

  updateProduct: (updatedProduct: Product): Promise<Product> => {
    return apiService.put<Product>(`/products/${updatedProduct.id}`, updatedProduct);
  },

  deleteProduct: (productId: string): Promise<{ success: boolean }> => {
    return apiService.delete<{ success: boolean }>(`/products/${productId}`);
  },
};
