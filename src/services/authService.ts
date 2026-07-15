import { User } from '../types';
import { apiService } from './apiService';

const SESSION_KEY = 'inventory_session';

export const authService = {
  getUsers: (): Promise<User[]> => {
    return apiService.get<User[]>('/users');
  },

  addUser: (userData: Omit<User, 'id'>): Promise<User> => {
    return apiService.post<User>('/users', userData);
  },

  updateUser: (updatedUser: User): Promise<User> => {
    return apiService.put<User>(`/users/${updatedUser.id}`, updatedUser);
  },

  deleteUser: (userId: string): Promise<{ success: boolean }> => {
    return apiService.delete<{ success: boolean }>(`/users/${userId}`);
  },

  login: async (email: string, passwordInput: string): Promise<{ user: User } | { error: string }> => {
    try {
      const response = await apiService.post<{ user: User }>('/auth/login', { email, password: passwordInput });
      if (response.user) {
        localStorage.setItem(SESSION_KEY, JSON.stringify(response.user));
        return { user: response.user };
      }
      return { error: 'La connexion a échoué de manière inattendue.' };
    } catch (error: any) {
      return { error: error.message || 'Email ou mot de passe invalide.' };
    }
  },

  logout: async (): Promise<void> => {
    // Dans une application réelle, nous pourrions vouloir invalider le token sur le serveur
    // await apiService.post('/auth/logout', {});
    localStorage.removeItem(SESSION_KEY);
    return Promise.resolve();
  },

  getCurrentUser: (): User | null => {
    try {
      const session = localStorage.getItem(SESSION_KEY);
      return session ? JSON.parse(session) : null;
    } catch (e) {
      console.error("Failed to parse session from localStorage", e);
      return null;
    }
  }
};