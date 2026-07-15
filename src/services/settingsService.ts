import { Settings, DbConfig } from '../types';
import { apiService } from './apiService';

export const settingsService = {
  getSettings: (): Promise<Settings> => {
    return apiService.get<Settings>('/settings');
  },

  saveSettings: (settings: Settings): Promise<Settings> => {
    return apiService.put<Settings>('/settings', settings);
  },
  
  resetAllData: (): Promise<void> => {
    // C'est une opération dangereuse, elle appelle donc un endpoint backend spécifique.
    return apiService.post<void>('/settings/reset-data', {});
  },

  testDbConnection: (): Promise<{ ok: boolean; message: string }> => {
    return apiService.post<{ ok: boolean; message: string }>('/settings/test-db-connection', {});
  },

  getDbConfig: (): Promise<DbConfig> => {
    return apiService.get<DbConfig>('/settings/db-config');
  },

  saveDbConfig: (config: DbConfig): Promise<{ success: boolean; message: string }> => {
    return apiService.post<{ success: boolean; message: string }>('/settings/db-config', config);
  }
};