import React, { useEffect, useState, useMemo } from 'react';
import { movementService } from '../services/movementService';
import { Product, Client, Room } from '../types';
import { 
  History, 
  User, 
  Calendar, 
  ChevronDown, 
  ChevronUp, 
  Search, 
  ArrowRight, 
  Loader2,
  PlusCircle,
  Edit
} from 'lucide-react';

interface AuditLogsViewProps {
  products: Product[];
  clients: Client[];
  rooms: Room[];
}

interface AuditLog {
  id: string;
  movementId: string;
  actionType: 'CREATE' | 'UPDATE';
  changedBy: string;
  changedAt: string;
  oldValues: any;
  newValues: any;
  movementType?: string;
  clientNom?: string;
  clientPrenom?: string;
}

interface ChangedField {
  label: string;
  oldValue: string;
  newValue: string;
}

export const AuditLogsView: React.FC<AuditLogsViewProps> = ({ products, clients, rooms }) => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [actionFilter, setActionFilter] = useState<string>('all');

  const fetchLogs = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await movementService.getAuditLogs();
      setLogs(data);
    } catch (err: any) {
      console.error("Failed to fetch audit logs:", err);
      setError(err?.message || "Erreur de chargement des journaux d'audit.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const getProductName = (id?: string) => products.find(p => p.id === id)?.nom || '-';
  const getClientName = (id?: string) => {
    if (!id) return '-';
    const c = clients.find(cl => cl.id === id);
    return c ? `${c.nom.toUpperCase()} ${c.prenom}` : 'Inconnu';
  };
  const getRoomName = (id?: string) => rooms.find(r => r.id === id)?.nom || '-';

  const toggleRow = (id: string) => {
    setExpandedRows(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const getChangedFields = (oldVal: any, newVal: any): ChangedField[] => {
    if (!oldVal || !newVal) return [];
    
    const fieldsToCompare = [
      { key: 'type', label: 'Type de mouvement' },
      { key: 'clientId', label: 'Client', resolve: (id: string) => getClientName(id) },
      { key: 'productId', label: 'Produit', resolve: (id: string) => getProductName(id) },
      { key: 'nbCaisse', label: 'Nombre de caisses' },
      { key: 'roomId', label: 'Chambre', resolve: (id: string) => getRoomName(id) },
      { key: 'poidsBrut', label: 'Poids Brut', suffix: ' kg' },
      { key: 'poidsNet', label: 'Poids Net', suffix: ' kg' },
      { key: 'prixUnitaire', label: 'Prix Unitaire', suffix: ' DT' },
      { key: 'montantTotal', label: 'Montant Total', suffix: ' DT' },
      { key: 'loyer', label: 'Loyer', suffix: ' DT' },
      { key: 'caution', label: 'Caution', suffix: ' DT' },
      { key: 'paymentStatus', label: 'Statut de paiement' }
    ];

    const changes: ChangedField[] = [];
    fieldsToCompare.forEach(({ key, label, resolve, suffix = '' }) => {
      const rawOld = oldVal[key];
      const rawNew = newVal[key];
      
      const oldStr = rawOld != null ? String(rawOld) : '';
      const newStr = rawNew != null ? String(rawNew) : '';
      
      if (oldStr !== newStr) {
        const displayOld = resolve ? resolve(oldStr) : (rawOld != null ? `${rawOld}${suffix}` : '-');
        const displayNew = resolve ? resolve(newStr) : (rawNew != null ? `${rawNew}${suffix}` : '-');
        changes.push({
          label,
          oldValue: displayOld,
          newValue: displayNew
        });
      }
    });
    return changes;
  };

  const getCreatedFields = (newVal: any): ChangedField[] => {
    if (!newVal) return [];
    const fieldsToDisplay = [
      { key: 'type', label: 'Type de mouvement' },
      { key: 'clientId', label: 'Client', resolve: (id: string) => getClientName(id) },
      { key: 'productId', label: 'Produit', resolve: (id: string) => getProductName(id) },
      { key: 'nbCaisse', label: 'Nombre de caisses' },
      { key: 'roomId', label: 'Chambre', resolve: (id: string) => getRoomName(id) },
      { key: 'poidsBrut', label: 'Poids Brut', suffix: ' kg' },
      { key: 'poidsNet', label: 'Poids Net', suffix: ' kg' },
      { key: 'prixUnitaire', label: 'Prix Unitaire', suffix: ' DT' },
      { key: 'montantTotal', label: 'Montant Total', suffix: ' DT' },
      { key: 'loyer', label: 'Loyer', suffix: ' DT' },
      { key: 'caution', label: 'Caution', suffix: ' DT' },
      { key: 'paymentStatus', label: 'Statut de paiement' }
    ];

    const items: ChangedField[] = [];
    fieldsToDisplay.forEach(({ key, label, resolve, suffix = '' }) => {
      const val = newVal[key];
      if (val != null) {
        const displayVal = resolve ? resolve(val) : `${val}${suffix}`;
        items.push({
          label,
          oldValue: '-',
          newValue: displayVal
        });
      }
    });
    return items;
  };

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const matchSearch = 
        log.changedBy.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (log.clientNom && log.clientNom.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (log.clientPrenom && log.clientPrenom.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (log.movementType && log.movementType.toLowerCase().includes(searchQuery.toLowerCase())) ||
        log.movementId.toLowerCase().includes(searchQuery.toLowerCase());

      const matchAction = 
        actionFilter === 'all' || 
        log.actionType === actionFilter;

      return matchSearch && matchAction;
    });
  }, [logs, searchQuery, actionFilter]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-gray-500">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600 mb-2" />
        <p>Chargement des données du journal d'audit...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 text-red-800 rounded-lg border border-red-200">
        <p className="font-semibold mb-2">Erreur lors de la récupération de l'historique :</p>
        <p className="text-sm">{error}</p>
        <button 
          onClick={fetchLogs}
          className="mt-4 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded hover:bg-red-700 transition"
        >
          Réessayer
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-3 bg-white p-4 rounded-lg shadow-sm border border-gray-100">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher par utilisateur, client, type..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-4 py-2 w-full border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="border border-gray-200 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="all">Toutes les actions</option>
            <option value="CREATE">Créations uniquement</option>
            <option value="UPDATE">Modifications uniquement</option>
          </select>
          <button 
            onClick={fetchLogs} 
            className="px-3 py-2 text-sm border border-gray-200 rounded-md bg-gray-50 hover:bg-gray-100 transition font-medium text-gray-700"
          >
            Actualiser
          </button>
        </div>
      </div>

      {/* Main Audit Logs Timeline/Table */}
      <div className="bg-white shadow rounded-lg overflow-hidden border border-gray-100">
        {filteredLogs.length > 0 ? (
          <div className="divide-y divide-gray-200">
            {filteredLogs.map((log) => {
              const isExpanded = !!expandedRows[log.id];
              const changes = log.actionType === 'UPDATE' 
                ? getChangedFields(log.oldValues, log.newValues)
                : getCreatedFields(log.newValues);

              return (
                <div key={log.id} className="transition hover:bg-gray-50">
                  {/* Row Header */}
                  <div 
                    onClick={() => toggleRow(log.id)}
                    className="p-4 flex items-center justify-between cursor-pointer select-none"
                  >
                    <div className="flex items-start space-x-3">
                      <div className="mt-0.5">
                        {log.actionType === 'CREATE' ? (
                          <div className="p-1.5 bg-green-100 text-green-700 rounded-full">
                            <PlusCircle className="w-5 h-5" />
                          </div>
                        ) : (
                          <div className="p-1.5 bg-amber-100 text-amber-700 rounded-full">
                            <Edit className="w-5 h-5" />
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-gray-900 text-sm sm:text-base">
                            {log.actionType === 'CREATE' ? 'Création d\'un mouvement' : 'Modification d\'un mouvement'}
                          </span>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            log.actionType === 'CREATE' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {log.movementType || (log.newValues && log.newValues.type) || 'Mouvement'}
                          </span>
                        </div>
                        
                        <div className="mt-1 flex flex-col sm:flex-row sm:gap-4 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <User className="w-3.5 h-3.5 text-gray-400" />
                            Par : <strong className="text-gray-700">{log.changedBy}</strong>
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-gray-400" />
                            Le : {new Date(log.changedAt).toLocaleString('fr-FR')}
                          </span>
                        </div>

                        {log.clientNom && (
                          <p className="text-xs text-gray-500 mt-0.5">
                            Client ciblé : <strong className="text-gray-700">{log.clientNom.toUpperCase()} {log.clientPrenom}</strong>
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="hidden md:block text-right">
                        <p className="text-[10px] font-mono text-gray-400">ID Mouvement</p>
                        <p className="text-xs font-mono text-gray-600 font-semibold">{log.movementId.substring(0, 8).toUpperCase()}</p>
                      </div>
                      <div>
                        {isExpanded ? (
                          <ChevronUp className="w-5 h-5 text-gray-400" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-gray-400" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Expandable Details Container */}
                  {isExpanded && (
                    <div className="px-6 pb-5 pt-1 bg-gray-50 border-t border-gray-100 animate-fadeIn">
                      <div className="max-w-3xl">
                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                          Détails des modifications apportées
                        </h4>
                        
                        {changes.length > 0 ? (
                          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-xs">
                            <table className="min-w-full divide-y divide-gray-200 text-sm">
                              <thead className="bg-gray-50 text-xs font-medium text-gray-500 uppercase">
                                <tr>
                                  <th className="px-4 py-2 text-left">Champ</th>
                                  {log.actionType === 'UPDATE' && <th className="px-4 py-2 text-left">Ancienne Valeur</th>}
                                  <th className="px-4 py-2 text-left">Nouvelle Valeur</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-200">
                                {changes.map((change, idx) => (
                                  <tr key={idx} className="hover:bg-gray-50/50">
                                    <td className="px-4 py-2 font-medium text-gray-700">{change.label}</td>
                                    {log.actionType === 'UPDATE' && (
                                      <td className="px-4 py-2 text-red-600 bg-red-50/30 line-through max-w-[200px] truncate" title={change.oldValue}>
                                        {change.oldValue}
                                      </td>
                                    )}
                                    <td className={`px-4 py-2 font-semibold max-w-[200px] truncate ${
                                      log.actionType === 'CREATE' ? 'text-green-600 bg-green-50/20' : 'text-green-600 bg-green-50/20'
                                    }`} title={change.newValue}>
                                      {change.newValue}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <p className="text-xs text-gray-500 italic">Aucun changement structurel enregistré ou valeurs identiques.</p>
                        )}
                        
                        <div className="mt-3 text-[10px] text-gray-400 font-mono">
                          ID complet du mouvement : {log.movementId}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-8 text-center text-gray-500 flex flex-col items-center justify-center">
            <History className="w-10 h-10 text-gray-300 mb-2" />
            <p className="font-semibold text-gray-700">Aucun journal d'audit trouvé</p>
            <p className="text-xs text-gray-500 mt-1">Essayez de modifier ou d'ajouter de nouvelles opérations de stock.</p>
          </div>
        )}
      </div>
    </div>
  );
};
