import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Reglement, Avance, Client, Contract, Movement, Settings, MovementType } from '../types';
import { paymentService } from '../services/paymentService';
import { contractService } from '../services/contractService';
import { clientService } from '../services/clientService';
import { movementService } from '../services/movementService';

interface PaymentsPageProps {
  clients: Client[];
  settings: Settings;
  searchTerm: string;
  fetchAllData?: () => Promise<void>;
  user?: any;
}

const PaymentsPage: React.FC<PaymentsPageProps> = ({ clients, settings, searchTerm, fetchAllData, user }) => {
  const [activeTab, setActiveTab] = useState<'reglements' | 'avances'>('reglements');
  const [reglements, setReglements] = useState<Reglement[]>([]);
  const [avances, setAvances] = useState<Avance[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modals state
  const [isReglementModalOpen, setIsReglementModalOpen] = useState(false);
  const [isAvanceModalOpen, setIsAvanceModalOpen] = useState(false);

  // New Reglement form state
  const [regClientId, setRegClientId] = useState('');
  const [regAmount, setRegAmount] = useState('');
  const [regMethod, setRegMethod] = useState('Espèces');
  const [regReference, setRegReference] = useState('');
  const [regInvoiceId, setRegInvoiceId] = useState('');
  const [regNotes, setRegNotes] = useState('');

  // New Avance form state
  const [avClientId, setAvClientId] = useState('');
  const [avAmount, setAvAmount] = useState('');
  const [avMethod, setAvMethod] = useState('Espèces');
  const [avContractId, setAvContractId] = useState('');
  const [avNotes, setAvNotes] = useState('');

  const [formError, setFormError] = useState('');

  const getInvoiceRemainingAmount = useCallback((invoice: Movement) => {
    const totalAmount = Number((invoice as any).montantTotal || (invoice as any).loyer || (invoice as any).caution || 0);
    const paidAmount = reglements
      .filter(r => r.invoiceId === invoice.id)
      .reduce((sum, r) => sum + r.amount, 0);
    return Math.max(0, totalAmount - paidAmount);
  }, [reglements]);

  // Fetch initial data
  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [fetchedRegs, fetchedAvs, fetchedContracts, fetchedMovs] = await Promise.all([
        paymentService.getReglements(),
        paymentService.getAvances(),
        contractService.getContracts(),
        movementService.getMovements()
      ]);
      setReglements(fetchedRegs || []);
      setAvances(fetchedAvs || []);
      setContracts(fetchedContracts || []);
      setMovements(fetchedMovs || []);
      if (fetchAllData) {
        await fetchAllData();
      }
    } catch (error) {
      console.error('Error fetching payments/advances data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filter clients who have pending invoices
  const pendingMovements = useMemo(() => {
    return movements.filter(m => {
      const isBillable = m.type === MovementType.Sale || m.type === MovementType.LocationOut;
      const remaining = getInvoiceRemainingAmount(m);
      return isBillable && remaining > 0;
    });
  }, [movements, getInvoiceRemainingAmount]);

  // Handle client selection on reglement modal to filter pending invoices
  const clientPendingInvoices = useMemo(() => {
    if (!regClientId) return [];
    return pendingMovements.filter(m => m.clientId === regClientId);
  }, [regClientId, pendingMovements]);

  // Handle client selection on avance modal to filter active contracts
  const clientContracts = useMemo(() => {
    if (!avClientId) return [];
    return contracts.filter(c => c.clientId === avClientId && c.status !== 'Terminé' && c.status !== 'Annulé');
  }, [avClientId, contracts]);

  // Automatically adjust amount when a pending invoice is selected
  useEffect(() => {
    if (regInvoiceId) {
      const selectedInvoice = clientPendingInvoices.find(m => m.id === regInvoiceId);
      if (selectedInvoice) {
        const remaining = getInvoiceRemainingAmount(selectedInvoice);
        setRegAmount(String(remaining));
      }
    } else {
      setRegAmount('');
    }
  }, [regInvoiceId, clientPendingInvoices, getInvoiceRemainingAmount]);

  // Automatically adjust amount when a contract is selected
  useEffect(() => {
    if (avContractId) {
      const selectedContract = clientContracts.find(c => c.id === avContractId);
      if (selectedContract) {
        // Default to the caution required, or contract caution minus already paid if we want, or just contract caution
        const amt = selectedContract.caution || 0;
        setAvAmount(String(amt));
      }
    } else {
      setAvAmount('');
    }
  }, [avContractId, clientContracts]);

  // Submissions
  const handleAddReglement = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!regClientId || !regAmount || Number(regAmount) <= 0) {
      setFormError('Veuillez sélectionner un client et entrer un montant valide supérieur à 0.');
      return;
    }
    if (!regInvoiceId) {
      setFormError('Veuillez associer ce règlement à une facture (sélectionnez une facture).');
      return;
    }

    try {
      await paymentService.addReglement({
        clientId: regClientId,
        amount: Number(regAmount),
        paymentMethod: regMethod,
        reference: regReference,
        invoiceId: regInvoiceId,
        notes: regNotes
      });
      
      // Reset form & reload
      setRegClientId('');
      setRegAmount('');
      setRegMethod('Espèces');
      setRegReference('');
      setRegInvoiceId('');
      setRegNotes('');
      setIsReglementModalOpen(false);
      await fetchData();
    } catch (err: any) {
      setFormError(err.message || "Impossible d'enregistrer le règlement.");
    }
  };

  const handleAddAvance = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!avClientId || !avAmount || Number(avAmount) <= 0) {
      setFormError('Veuillez sélectionner un client et entrer un montant valide supérieur à 0.');
      return;
    }

    try {
      await paymentService.addAvance({
        clientId: avClientId,
        amount: Number(avAmount),
        paymentMethod: avMethod,
        contractId: avContractId || null,
        notes: avNotes
      });

      // Reset form & reload
      setAvClientId('');
      setAvAmount('');
      setAvMethod('Espèces');
      setAvContractId('');
      setAvNotes('');
      setIsAvanceModalOpen(false);
      await fetchData();
    } catch (err: any) {
      setFormError(err.message || "Impossible d'enregistrer l'avance.");
    }
  };

  const handleDeleteReglement = async (id: string) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer ce règlement ? Son statut associé (le cas échéant) reviendra en attente.')) {
      try {
        await paymentService.deleteReglement(id);
        await fetchData();
      } catch (err: any) {
        alert(err.message || 'Erreur lors de la suppression.');
      }
    }
  };

  const handleDeleteAvance = async (id: string) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer cette avance ?')) {
      try {
        await paymentService.deleteAvance(id);
        await fetchData();
      } catch (err: any) {
        alert(err.message || 'Erreur lors de la suppression.');
      }
    }
  };

  // Filters
  const filteredReglements = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return reglements.filter(r => {
      const client = clients.find(c => c.id === r.clientId);
      const clientName = client ? `${client.nom} ${client.prenom}`.toLowerCase() : '';
      const notesMatch = r.notes?.toLowerCase().includes(term) || false;
      const refMatch = r.reference?.toLowerCase().includes(term) || false;
      const methodMatch = r.paymentMethod.toLowerCase().includes(term);
      return clientName.includes(term) || notesMatch || refMatch || methodMatch;
    });
  }, [reglements, clients, searchTerm]);

  const filteredAvances = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return avances.filter(a => {
      const client = clients.find(c => c.id === a.clientId);
      const clientName = client ? `${client.nom} ${client.prenom}`.toLowerCase() : '';
      const notesMatch = a.notes?.toLowerCase().includes(term) || false;
      const methodMatch = a.paymentMethod.toLowerCase().includes(term);
      return clientName.includes(term) || notesMatch || methodMatch;
    });
  }, [avances, clients, searchTerm]);

  // KPI calculations
  const totalReglementsAmount = useMemo(() => {
    return reglements.reduce((acc, r) => acc + r.amount, 0);
  }, [reglements]);

  const totalAvancesAmount = useMemo(() => {
    return avances.reduce((acc, a) => acc + a.amount, 0);
  }, [avances]);

  const totalPendingInvoicesAmount = useMemo(() => {
    return pendingMovements.reduce((acc, m) => {
      return acc + getInvoiceRemainingAmount(m);
    }, 0);
  }, [pendingMovements, getInvoiceRemainingAmount]);

  const getClientFullName = (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    return client ? `${client.nom.toUpperCase()} ${client.prenom}` : 'Client Inconnu';
  };

  const formatCurrency = (amount: number) => {
    return `${amount.toFixed(2)} ${settings.currencySymbol || 'DT'}`;
  };

  return (
    <div className="flex-1 p-6 overflow-y-auto bg-gray-50/50">
      {/* KPI Dashboard Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Total Règlements</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(totalReglementsAmount)}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Total Avances Reçues</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(totalAvancesAmount)}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Factures en Attente</p>
            <p className="text-2xl font-bold text-amber-600 mt-1">{formatCurrency(totalPendingInvoicesAmount)}</p>
          </div>
        </div>
      </div>

      {/* Tabs and Add buttons */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-6">
        <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Custom elegant tabs */}
          <div className="flex bg-gray-100 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('reglements')}
              className={`px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all ${activeTab === 'reglements' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
            >
              Règlements de Factures
            </button>
            <button
              onClick={() => setActiveTab('avances')}
              className={`px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all ${activeTab === 'avances' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
            >
              Avances de Contrats
            </button>
          </div>

          <div>
            {activeTab === 'reglements' ? (
              <button
                onClick={() => setIsReglementModalOpen(true)}
                className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-sm"
              >
                <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Saisir un Règlement
              </button>
            ) : (
              <button
                onClick={() => setIsAvanceModalOpen(true)}
                className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-sm"
              >
                <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Enregistrer une Avance
              </button>
            )}
          </div>
        </div>

        {/* Content tables */}
        {isLoading ? (
          <div className="p-12 text-center text-gray-500">Chargement...</div>
        ) : activeTab === 'reglements' ? (
          <div className="overflow-x-auto">
            {filteredReglements.length === 0 ? (
              <div className="p-12 text-center text-gray-500">Aucun règlement enregistré.</div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/75 border-b border-gray-100">
                    <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Client</th>
                    <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Montant</th>
                    <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Mode</th>
                    <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Référence</th>
                    <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Facture liée</th>
                    <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredReglements.map((reg) => (
                    <tr key={reg.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="p-4 text-sm text-gray-600">
                        {new Date(reg.date).toLocaleDateString('fr-TN', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="p-4 text-sm font-medium text-gray-900">{getClientFullName(reg.clientId)}</td>
                      <td className="p-4 text-sm font-bold text-emerald-600">{formatCurrency(reg.amount)}</td>
                      <td className="p-4 text-sm text-gray-600">
                        <span className="px-2 py-1 bg-gray-100 rounded-md text-xs font-semibold text-gray-700">{reg.paymentMethod}</span>
                      </td>
                      <td className="p-4 text-sm text-gray-500 italic">{reg.reference || 'Aucune'}</td>
                      <td className="p-4 text-sm text-gray-600">
                        {reg.invoiceId ? (
                          <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-md text-xs font-semibold">
                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span>Facture #{reg.invoiceId.substring(0, 8).toUpperCase()}</span>
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs italic">Général</span>
                        )}
                      </td>
                      <td className="p-4 text-sm text-gray-500 max-w-xs truncate">{reg.notes || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            {filteredAvances.length === 0 ? (
              <div className="p-12 text-center text-gray-500">Aucune avance enregistrée.</div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/75 border-b border-gray-100">
                    <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Client</th>
                    <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Montant de l'avance</th>
                    <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Mode de Paiement</th>
                    <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Contrat associé</th>
                    <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredAvances.map((av) => {
                    const matchedContract = contracts.find(c => c.id === av.contractId);
                    return (
                      <tr key={av.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="p-4 text-sm text-gray-600">
                          {new Date(av.date).toLocaleDateString('fr-TN', { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="p-4 text-sm font-medium text-gray-900">{getClientFullName(av.clientId)}</td>
                        <td className="p-4 text-sm font-bold text-blue-600">{formatCurrency(av.amount)}</td>
                        <td className="p-4 text-sm text-gray-600">
                          <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded-md text-xs font-semibold">{av.paymentMethod}</span>
                        </td>
                        <td className="p-4 text-sm text-gray-600">
                          {av.contractId ? (
                            <div className="flex flex-col">
                              <span className="text-xs font-bold text-gray-800">#{av.contractId.substring(0, 8).toUpperCase()}</span>
                              {matchedContract && (
                                <span className="text-[10px] text-gray-400 uppercase tracking-wider">{matchedContract.type} - {matchedContract.nbCaisse} Caisses</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-400 text-xs italic">Aucun contrat lié</span>
                          )}
                        </td>
                        <td className="p-4 text-sm text-gray-500 max-w-xs truncate">{av.notes || '-'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* Reglement Modal */}
      {isReglementModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-base font-bold text-gray-800">Saisir un Règlement de Facture</h3>
              <button
                onClick={() => setIsReglementModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleAddReglement} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-100 text-red-700 text-xs font-semibold rounded-xl">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Client</label>
                <select
                  required
                  value={regClientId}
                  onChange={(e) => {
                    setRegClientId(e.target.value);
                    setRegInvoiceId('');
                  }}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">-- Sélectionner un client --</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.nom.toUpperCase()} {c.prenom} (CIN: {c.cin})</option>
                  ))}
                </select>
              </div>

              {regClientId && (
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Facture / Transaction à régler (Obligatoire)</label>
                  <select
                    required
                    value={regInvoiceId}
                    onChange={(e) => setRegInvoiceId(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">-- Sélectionner une facture en attente --</option>
                    {clientPendingInvoices.map(m => {
                      const total = (m as any).montantTotal || (m as any).loyer || (m as any).caution || 0;
                      const remaining = getInvoiceRemainingAmount(m);
                      const paid = total - remaining;
                      return (
                        <option key={m.id} value={m.id}>
                          {m.type} du {new Date(m.date).toLocaleDateString('fr-TN')} - Reste: {formatCurrency(remaining)} (Total: {formatCurrency(total)}{paid > 0 ? `, Déjà payé: ${formatCurrency(paid)}` : ''})
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Montant ({settings.currencySymbol || 'DT'})</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={regAmount}
                    onChange={(e) => setRegAmount(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 font-bold"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Mode de règlement</label>
                  <select
                    value={regMethod}
                    onChange={(e) => setRegMethod(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="Espèces">Espèces</option>
                    <option value="Chèque">Chèque</option>
                    <option value="Virement">Virement</option>
                    <option value="Traite">Traite</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Référence / Numéro (Chèque, Transaction...)</label>
                <input
                  type="text"
                  value={regReference}
                  onChange={(e) => setRegReference(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Ex: Chèque n°124456"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Observations / Notes</label>
                <textarea
                  value={regNotes}
                  onChange={(e) => setRegNotes(e.target.value)}
                  rows={2}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Notes complémentaires..."
                />
              </div>

              <div className="pt-4 border-t border-gray-100 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsReglementModalOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-gray-500 hover:bg-gray-100 rounded-xl transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm font-bold bg-primary-600 hover:bg-primary-700 text-white rounded-xl transition-colors shadow-sm"
                >
                  Valider le règlement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Avance Modal */}
      {isAvanceModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-base font-bold text-gray-800">Saisir une Avance de Contrat</h3>
              <button
                onClick={() => setIsAvanceModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleAddAvance} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-100 text-red-700 text-xs font-semibold rounded-xl">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Client</label>
                <select
                  required
                  value={avClientId}
                  onChange={(e) => {
                    setAvClientId(e.target.value);
                    setAvContractId('');
                  }}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">-- Sélectionner un client --</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.nom.toUpperCase()} {c.prenom} (CIN: {c.cin})</option>
                  ))}
                </select>
              </div>

              {avClientId && (
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Contrat à associer (optionnel)</label>
                  <select
                    value={avContractId}
                    onChange={(e) => setAvContractId(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">Avance libre</option>
                    {clientContracts.map(c => (
                      <option key={c.id} value={c.id}>
                        Contrat {c.type} - #{c.id.substring(0, 8).toUpperCase()} ({c.nbCaisse} caisses, Caution req: {formatCurrency(c.caution)})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Montant de l'avance ({settings.currencySymbol || 'DT'})</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={avAmount}
                    onChange={(e) => setAvAmount(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 font-bold"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Mode de paiement</label>
                  <select
                    value={avMethod}
                    onChange={(e) => setAvMethod(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="Espèces">Espèces</option>
                    <option value="Chèque">Chèque</option>
                    <option value="Virement">Virement</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Observations / Notes</label>
                <textarea
                  value={avNotes}
                  onChange={(e) => setAvNotes(e.target.value)}
                  rows={3}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Informations supplémentaires sur cet acompte..."
                />
              </div>

              <div className="pt-4 border-t border-gray-100 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAvanceModalOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-gray-500 hover:bg-gray-100 rounded-xl transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm font-bold bg-primary-600 hover:bg-primary-700 text-white rounded-xl transition-colors shadow-sm"
                >
                  Enregistrer l'avance
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PaymentsPage;
