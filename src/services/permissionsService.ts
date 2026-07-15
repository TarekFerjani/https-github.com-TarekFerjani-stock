import { PagePermissions } from '../types';
import { apiService } from './apiService';

export const permissionsService = {
  getPermissions: (): Promise<PagePermissions> => {
    // Les permissions sont spécifiques au rôle de l'utilisateur connecté ('user'), donc pas besoin d'ID.
    // Le backend devrait le déterminer en fonction de la session/token.
    return apiService.get<PagePermissions>('/permissions');
  },

  savePermissions: (permissions: PagePermissions): Promise<PagePermissions> => {
    // La sauvegarde des permissions est une action d'administrateur.
    return apiService.put<PagePermissions>('/permissions', permissions);
  },
};
