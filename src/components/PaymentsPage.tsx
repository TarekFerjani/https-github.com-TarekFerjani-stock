import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Reglement, Client, Movement, Settings, MovementType } from '../types';
import { paymentService } from '../services/paymentService';
import { movementService } from '../services/movementService';

interface PaymentsPageProps {
  clients: Client[];
  settings: Settings;
  searchTerm: string;
  fetchAllData?: () => Promise<void>;
  user?: any;
}

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Reglement, Client, Movement, Settings, MovementType, Location, Avance, Contract } from '../types';
import { paymentService } from '../services/paymentService';
import { movementService } from '../services/movementService';
import { locationService } from '../services/locationService';
import { contractService } from '../services/contractService';

interface PaymentsPageProps {
  clients: Client[];
  settings: Settings;
  searchTerm: string;
  fetchAllData?: () => Promise<void>;
  user?: any;
}

const PaymentsPage: React.FC<PaymentsPageProps> = ({ clients, settings, searchTerm, fetchAllData, user }) => {
  const [activeTab, setActiveTab] = useState<'payments' | 'unpaid' | 'cautions'>('payments');
  const [reglements, setReglements] = useState<Reglement[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [avances, setAvances] = useState<Avance[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modal state
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // New Payment form state
  const [paymentType, setPaymentType] = useState<'invoice' | 'caution'>('invoice');
  const [regClientId, setRegClientId] = useState('');
  const [regAmount, setRegAmount] = useState('');
  const [regInvoiceId, setRegInvoiceId] = useState('');
  const [regReference, setRegReference] = useState('');
  const [regNotes, setRegNotes] = useState('');

  // Transfer Modal state
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferClient, setTransferClient] = useState<{ client: Client; unusedCaution: number; activeContract?: Contract } | null>(null);
  const [transferAmount, setTransferAmount] = useState('');
  const [transferNotes, setTransferNotes] = useState('');
  const [transferContractId, setTransferContractId] = useState('');

  const [formError, setFormError] = useState('');

  // Get remaining balance of an invoice
  const getInvoiceRemainingAmount = useCallback((invoice: Movement) => {
    const hasTotal = (invoice as any).montantTotal !== undefined && (invoice as any).montantTotal !== null;
    const totalAmount = hasTotal ? Number((invoice as any).montantTotal) : Number((invoice as any).loyer || (invoice as any).caution || 0);
    const paidAmount = reglements
      .filter(r => r.invoiceId === invoice.id)
      .reduce((sum, r) => sum + r.amount, 0);
    return Math.max(0, totalAmount - paidAmount);
  }, [reglements]);

  // Fetch initial data
  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [fetchedRegs, fetchedMovs, fetchedLocs, fetchedAvances, fetchedContracts] = await Promise.all([
        paymentService.getReglements(),
        movementService.getMovements(),
        locationService.getLocations(),
        paymentService.getAvances(),
        contractService.getContracts()
      ]);
      setReglements(fetchedRegs || []);
      setMovements(fetchedMovs || []);
      setLocations(fetchedLocs || []);
      setAvances(fetchedAvances || []);
      setContracts(fetchedContracts || []);
      if (fetchAllData) {
        await fetchAllData();
      }
    } catch (error) {
      console.error('Error fetching payments data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filter movements that are billable (Vente or Fin de Location) and have remaining amount > 0
  const pendingMovements = useMemo(() => {
    return movements.filter(m => {
      const isBillable = m.type === MovementType.Sale || m.type === MovementType.LocationOut || m.type === MovementType.EmptyCratesOut;
      const remaining = getInvoiceRemainingAmount(m);
      return isBillable && remaining > 0;
    });
  }, [movements, getInvoiceRemainingAmount]);

  // Handle client selection on reglement modal to filter pending invoices
  const clientPendingInvoices = useMemo(() => {
    if (!regClientId) return [];
    return pendingMovements.filter(m => m.clientId === regClientId);
  }, [regClientId, pendingMovements]);

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

  // Pre-calculate client metrics for the Cautions tab
  const clientMetrics = useMemo(() => {
    return clients.map(client => {
      const paidCaution = reglements
        .filter(r => {
          if (r.clientId !== client.id) return false;
          if (r.invoiceId) {
            const m = movements.find(mov => mov.id === r.invoiceId);
            return m && m.type === MovementType.EmptyCratesOut;
          }
          return r.notes && r.notes.includes('Dépôt de caution caisses vides');
        })
        .reduce((sum, r) => sum + r.amount, 0);

      const clientMovements = movements.filter(m => m.clientId === client.id);
      
      const totalCratesOwned = clientMovements
        .reduce((balance, m) => {
          if (m.type === MovementType.EmptyCratesOut) return balance + m.nbCaisse;
          if (m.type === MovementType.EmptyCratesReturn || m.type === MovementType.LocationOut || m.type === MovementType.Sale) return balance - m.nbCaisse;
          return balance;
        }, 0);

      const cratesInLocation = locations
        .filter(l => l.clientId === client.id && l.status === 'En cours')
        .reduce((sum, l) => sum + l.nbCaisse, 0);

      const availableEmptyCrates = Math.max(0, totalCratesOwned - cratesInLocation);

      const totalAvances = avances
        .filter(a => a.clientId === client.id)
        .reduce((sum, a) => sum + a.amount, 0);

      const rate = Number(settings.cautionPerCrate) || 15;
      const maxCoveredCrates = Math.floor(paidCaution / rate);
      const unusedCaution = Math.max(0, paidCaution - (availableEmptyCrates * rate));

      const activeContract = contracts.find(c => c.clientId === client.id && c.status === 'Actif');

      return {
        client,
        paidCaution,
        availableEmptyCrates,
        totalAvances,
        maxCoveredCrates,
        unusedCaution,
        activeContract
      };
    });
  }, [clients, reglements, movements, locations, avances, contracts, settings.cautionPerCrate]);

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (isSubmitting) return;

    if (!regClientId || !regAmount || Number(regAmount) <= 0) {
      setFormError('Veuillez sélectionner un client et entrer un montant valide supérieur à 0.');
      return;
    }

    if (paymentType === 'invoice') {
      if (!regInvoiceId) {
        setFormError('Veuillez associer ce paiement à une facture.');
        return;
      }

      const selectedInvoice = clientPendingInvoices.find(m => m.id === regInvoiceId);
      if (selectedInvoice) {
        const remaining = getInvoiceRemainingAmount(selectedInvoice);
        if (Number(regAmount) > remaining) {
          const confirmOverpay = window.confirm(
            `Sécurité de paiement : Le montant du paiement (${Number(regAmount).toFixed(2)} ${settings.currencySymbol || 'DT'}) dépasse le reste à payer de cette facture (${remaining.toFixed(2)} ${settings.currencySymbol || 'DT'}).\n\nVoulez-vous quand même enregistrer ce paiement ?`
          );
          if (!confirmOverpay) {
            return;
          }
        }
      }

      // Duplicate detection and confirmation
      const isDuplicate = reglements.some(
        r => r.invoiceId === regInvoiceId && Math.abs(r.amount - Number(regAmount)) < 0.01
      );
      if (isDuplicate) {
        const confirmMsg = `Attention : Un règlement du même montant (${Number(regAmount).toFixed(2)} ${settings.currencySymbol || 'DT'}) a déjà été enregistré pour cette facture.\n\n` +
          `Date de la facture : ${selectedInvoice ? new Date(selectedInvoice.date).toLocaleDateString('fr-TN') : ''}\n` +
          `Client : ${getClientFullName(regClientId)}\n` +
          `Montant : ${Number(regAmount).toFixed(2)} ${settings.currencySymbol || 'DT'}\n\n` +
          `Voulez-vous vraiment enregistrer ce doublon ?`;
        if (!window.confirm(confirmMsg)) {
          return;
        }
      }
    }

    setIsSubmitting(true);
    try {
      let submitNotes = regNotes;
      if (paymentType === 'caution') {
        submitNotes = regNotes ? `Dépôt de caution caisses vides - ${regNotes}` : 'Dépôt de caution caisses vides';
      }

      await paymentService.addReglement({
        clientId: regClientId,
        amount: Number(regAmount),
        paymentMethod: 'Espèces', // Locked to "Espèces"
        reference: regReference,
        invoiceId: paymentType === 'invoice' ? regInvoiceId : null,
        notes: submitNotes
      });
      
      // Reset form & reload
      setRegClientId('');
      setRegAmount('');
      setRegReference('');
      setRegInvoiceId('');
      setRegNotes('');
      setPaymentType('invoice');
      setIsPaymentModalOpen(false);
      await fetchData();
    } catch (err: any) {
      setFormError(err.message || "Impossible d'enregistrer le paiement.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteReglement = async (id: string) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer ce paiement ? Le statut de la facture associée reviendra en attente.')) {
      try {
        await paymentService.deleteReglement(id);
        await fetchData();
      } catch (err: any) {
        alert(err.message || 'Erreur lors de la suppression.');
      }
    }
  };

  const handleTransferCaution = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferClient) return;

    const amt = Number(transferAmount);
    if (!amt || amt <= 0) {
      alert('Veuillez entrer un montant valide supérieur à 0.');
      return;
    }

    if (amt > transferClient.unusedCaution) {
      alert(`Erreur : Le montant à transférer (${amt} ${settings.currencySymbol || 'DT'}) dépasse la caution non-utilisée disponible du client (${transferClient.unusedCaution} ${settings.currencySymbol || 'DT'}).`);
      return;
    }

    setIsSubmitting(true);
    try {
      await paymentService.transferCaution({
        clientId: transferClient.client.id,
        amount: amt,
        contractId: transferContractId || null,
        notes: transferNotes || `Transfert de caution vers avance de location`
      });

      alert('Le transfert de caution a été effectué avec succès !');
      setIsTransferModalOpen(false);
      setTransferClient(null);
      setTransferAmount('');
      setTransferNotes('');
      setTransferContractId('');
      await fetchData();
    } catch (err: any) {
      alert(err.message || 'Une erreur est survenue lors du transfert.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filters for Payments History
  const filteredReglements = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return reglements.filter(r => {
      const client = clients.find(c => c.id === r.clientId);
      const clientName = client ? `${client.nom} ${client.prenom}`.toLowerCase() : '';
      const notesMatch = r.notes?.toLowerCase().includes(term) || false;
      const refMatch = r.reference?.toLowerCase().includes(term) || false;
      const invoiceMatch = r.invoiceId?.toLowerCase().includes(term) || false;
      return clientName.includes(term) || notesMatch || refMatch || invoiceMatch;
    });
  }, [reglements, clients, searchTerm]);

  // Filters for Unpaid Invoices
  const filteredUnpaidInvoices = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return pendingMovements.filter(m => {
      const client = clients.find(c => c.id === m.clientId);
      const clientName = client ? `${client.nom} ${client.prenom}`.toLowerCase() : '';
      const idMatch = m.id.toLowerCase().includes(term);
      const typeMatch = m.type.toLowerCase().includes(term);
      return clientName.includes(term) || idMatch || typeMatch;
    });
  }, [pendingMovements, clients, searchTerm]);

  // KPI calculations
  const totalReglementsAmount = useMemo(() => {
    return reglements.reduce((acc, r) => acc + r.amount, 0);
  }, [reglements]);

  const totalPendingInvoicesAmount = useMemo(() => {
    return pendingMovements.reduce((acc, m) => {
      return acc + getInvoiceRemainingAmount(m);
    }, 0);
  }, [pendingMovements, getInvoiceRemainingAmount]);

  const getClientFullName = (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    return client ? `${client.nom.toUpperCase()} ${client.prenom}` : 'Client Inconnu';
  };

  const getClientPhone = (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    return client ? client.telephone : '';
  };

  const formatCurrency = (amount: number) => {
    return `${amount.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${settings.currencySymbol || 'DT'}`;
  };

  const handlePayInvoice = (invoice: Movement) => {
    setRegClientId(invoice.clientId);
    setRegInvoiceId(invoice.id);
    setIsPaymentModalOpen(true);
  };

  return (
    <div className="flex-1 p-6 overflow-y-auto bg-gray-50/50" id="payments-page-container">
      {/* KPI Dashboard Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8" id="payments-kpi-container">
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center space-x-4" id="kpi-total-received">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Total Paiements Reçus</p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">{formatCurrency(totalReglementsAmount)}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center space-x-4" id="kpi-total-unpaid">
          <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
            <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Factures en Attente de Paiement</p>
            <p className="text-2xl font-bold text-rose-600 mt-1">{formatCurrency(totalPendingInvoicesAmount)}</p>
          </div>
        </div>
      </div>

      {/* Tabs and Add buttons */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-6" id="payments-main-card">
        <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Tabs */}
          <div className="flex bg-gray-100 p-1 rounded-xl" id="payments-tab-triggers">
            <button
              onClick={() => setActiveTab('payments')}
              className={`px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all ${activeTab === 'payments' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
              id="tab-history"
            >
              Historique des Paiements
            </button>
            <button
              onClick={() => setActiveTab('unpaid')}
              className={`px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all ${activeTab === 'unpaid' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
              id="tab-unpaid-invoices"
            >
              Factures Non Payées ({pendingMovements.length})
            </button>
            <button
              onClick={() => setActiveTab('cautions')}
              className={`px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all ${activeTab === 'cautions' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
              id="tab-cautions-avances"
            >
              Cautions & Avances
            </button>
          </div>
        </div>

        {/* Content tables */}
        {isLoading ? (
          <div className="p-12 text-center text-gray-500">Chargement...</div>
        ) : activeTab === 'payments' ? (
          <div className="overflow-x-auto" id="payments-history-table-wrapper">
            {filteredReglements.length === 0 ? (
              <div className="p-12 text-center text-gray-500">Aucun paiement enregistré.</div>
            ) : (
              <table className="w-full text-left border-collapse" id="payments-history-table">
                <thead>
                  <tr className="bg-gray-50/75 border-b border-gray-100">
                    <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Client</th>
                    <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Montant</th>
                    <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Facture liée</th>
                    <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Actions</th>
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
                        {reg.invoiceId ? (
                          <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-md text-xs font-semibold">
                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span>Facture #{reg.invoiceId.substring(0, 8).toUpperCase()}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-md text-xs font-semibold">
                            ⚠️ Dépôt de caution
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-sm text-gray-600 text-right">
                        <button
                          onClick={() => handleDeleteReglement(reg.id)}
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors inline-flex items-center"
                          title="Supprimer le paiement"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ) : activeTab === 'unpaid' ? (
          <div className="overflow-x-auto" id="unpaid-invoices-table-wrapper">
            {filteredUnpaidInvoices.length === 0 ? (
              <div className="p-12 text-center text-gray-500">Aucune facture en attente de paiement.</div>
            ) : (
              <table className="w-full text-left border-collapse" id="unpaid-invoices-table">
                <thead>
                  <tr className="bg-gray-50/75 border-b border-gray-100">
                    <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Facture</th>
                    <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Client / Contact</th>
                    <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Type Facture</th>
                    <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center">Caisses</th>
                    <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Montant Total</th>
                    <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Reste à Payer</th>
                    <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredUnpaidInvoices.map((mov) => {
                    const hasTotal = (mov as any).montantTotal !== undefined && (mov as any).montantTotal !== null;
                    const total = hasTotal ? Number((mov as any).montantTotal) : Number((mov as any).loyer || (mov as any).caution || 0);
                    const remaining = getInvoiceRemainingAmount(mov);
                    const isLocationOut = mov.type === MovementType.LocationOut;
                    
                    return (
                      <tr key={mov.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="p-4 text-sm font-bold text-gray-900">
                          #{mov.id.substring(0, 8).toUpperCase()}
                        </td>
                        <td className="p-4 text-sm text-gray-600">
                          {new Date(mov.date).toLocaleDateString('fr-TN')}
                        </td>
                        <td className="p-4 text-sm">
                          <div className="font-semibold text-gray-900">{getClientFullName(mov.clientId)}</div>
                          <div className="text-xs text-gray-400">{getClientPhone(mov.clientId)}</div>
                        </td>
                        <td className="p-4 text-sm">
                          <span className={`px-2 py-1 rounded-md text-xs font-bold ${isLocationOut ? 'bg-amber-50 text-amber-700 border border-amber-100' : 'bg-purple-50 text-purple-700 border border-purple-100'}`}>
                            {mov.type}
                          </span>
                        </td>
                        <td className="p-4 text-sm text-center font-semibold text-gray-700">
                          {mov.nbCaisse} caisses
                        </td>
                        <td className="p-4 text-sm text-gray-600 font-medium">
                          {formatCurrency(total)}
                        </td>
                        <td className="p-4 text-sm font-bold text-rose-600">
                          {formatCurrency(remaining)}
                        </td>
                        <td className="p-4 text-sm text-right">
                          <button
                            onClick={() => handlePayInvoice(mov)}
                            className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold rounded-xl transition-all border border-emerald-100 shadow-sm"
                            id={`btn-pay-invoice-${mov.id}`}
                          >
                            Enregistrer Paiement
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto" id="cautions-table-wrapper">
            {clientMetrics.length === 0 ? (
              <div className="p-12 text-center text-gray-500">Aucun client enregistré.</div>
            ) : (
              <table className="w-full text-left border-collapse" id="cautions-table">
                <thead>
                  <tr className="bg-gray-50/75 border-b border-gray-100">
                    <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Client</th>
                    <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Caution Déposée</th>
                    <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center">Couverture Max</th>
                    <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center">Vides Détenues</th>
                    <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Solde Libre</th>
                    <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Avances Location</th>
                    <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {clientMetrics.map(({ client, paidCaution, availableEmptyCrates, totalAvances, maxCoveredCrates, unusedCaution, activeContract }) => (
                    <tr key={client.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="p-4 text-sm">
                        <div className="font-semibold text-gray-900">{client.nom.toUpperCase()} {client.prenom}</div>
                        <div className="text-xs text-gray-400">CIN: {client.cin} • Tél: {client.telephone}</div>
                      </td>
                      <td className="p-4 text-sm font-bold text-emerald-600">
                        {formatCurrency(paidCaution)}
                      </td>
                      <td className="p-4 text-sm text-center font-medium text-blue-600">
                        {maxCoveredCrates} caisses
                      </td>
                      <td className="p-4 text-sm text-center">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${availableEmptyCrates > maxCoveredCrates ? 'bg-red-50 text-red-700' : 'bg-orange-50 text-orange-700'}`}>
                          {availableEmptyCrates} caisses
                        </span>
                      </td>
                      <td className="p-4 text-sm font-semibold text-gray-700">
                        {formatCurrency(unusedCaution)}
                      </td>
                      <td className="p-4 text-sm font-bold text-indigo-600">
                        {formatCurrency(totalAvances)}
                      </td>
                      <td className="p-4 text-sm text-right space-x-2">
                        <button
                          onClick={() => {
                            setPaymentType('caution');
                            setRegClientId(client.id);
                            setRegInvoiceId('');
                            setRegAmount('');
                            setIsPaymentModalOpen(true);
                          }}
                          className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold rounded-xl transition-all border border-emerald-100 shadow-sm inline-flex items-center"
                        >
                          Déposer Caution
                        </button>
                        <button
                          disabled={unusedCaution <= 0}
                          onClick={() => {
                            setTransferClient({ client, unusedCaution, activeContract });
                            setTransferAmount(String(unusedCaution));
                            setTransferContractId(activeContract?.id || '');
                            setIsTransferModalOpen(true);
                          }}
                          className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-xl transition-all border border-indigo-100 shadow-sm disabled:opacity-50 disabled:pointer-events-none inline-flex items-center"
                        >
                          Transférer vers Avance
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* Payment Modal */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-150" id="payment-modal">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 max-w-lg w-full overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-base font-bold text-gray-800">Saisir un Paiement / Dépôt</h3>
              <button
                onClick={() => setIsPaymentModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                id="btn-close-payment-modal"
              >
                <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleAddPayment} className="p-6 space-y-4" id="payment-form">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-100 text-red-700 text-xs font-semibold rounded-xl">
                  {formError}
                </div>
              )}

              {/* Type Selection */}
              <div className="flex gap-4 p-1 bg-gray-100 rounded-xl mb-4">
                <button
                  type="button"
                  onClick={() => {
                    setPaymentType('invoice');
                    setRegInvoiceId('');
                  }}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${paymentType === 'invoice' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
                >
                  Paiement de Facture
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPaymentType('caution');
                    setRegInvoiceId('');
                  }}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${paymentType === 'caution' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
                >
                  Dépôt de Caution (Caisses)
                </button>
              </div>

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
                  id="payment-client-select"
                >
                  <option value="">-- Sélectionner un client --</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.nom.toUpperCase()} {c.prenom} (CIN: {c.cin})</option>
                  ))}
                </select>
              </div>

              {regClientId && paymentType === 'invoice' && (
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Facture / Transaction à payer (Obligatoire)</label>
                  <select
                    required
                    value={regInvoiceId}
                    onChange={(e) => setRegInvoiceId(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    id="payment-invoice-select"
                  >
                    <option value="">-- Sélectionner une facture en attente --</option>
                    {clientPendingInvoices.map(m => {
                      const hasTotal = (m as any).montantTotal !== undefined && (m as any).montantTotal !== null;
                      const total = hasTotal ? Number((m as any).montantTotal) : Number((m as any).loyer || (m as any).caution || 0);
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

              <div className="grid grid-cols-1 gap-4">
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
                    id="payment-amount-input"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Notes (Optionnel)</label>
                <textarea
                  value={regNotes}
                  onChange={(e) => setRegNotes(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Notes ou détails supplémentaires..."
                  rows={2}
                />
              </div>

              <div className="pt-4 border-t border-gray-100 flex justify-end gap-3">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-gray-500 hover:bg-gray-100 rounded-xl transition-colors disabled:opacity-50"
                  id="btn-cancel-payment"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 text-sm font-bold bg-primary-600 hover:bg-primary-700 text-white rounded-xl transition-colors shadow-sm disabled:opacity-50"
                  id="btn-submit-payment"
                >
                  {isSubmitting ? 'Enregistrement...' : 'Valider le paiement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transfer Caution Modal */}
      {isTransferModalOpen && transferClient && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-150" id="transfer-modal">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 max-w-lg w-full overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-base font-bold text-gray-800">Transférer la Caution en Avance de Location</h3>
              <button
                onClick={() => setIsTransferModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                id="btn-close-transfer-modal"
              >
                <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleTransferCaution} className="p-6 space-y-4" id="transfer-form">
              <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-xl text-xs space-y-1.5 text-indigo-900">
                <p>Client: <strong className="text-sm font-bold">{transferClient.client.nom.toUpperCase()} {transferClient.client.prenom}</strong></p>
                <p>Caution libre (transférable) : <strong className="text-sm font-bold">{formatCurrency(transferClient.unusedCaution)}</strong></p>
                <p className="text-indigo-700 font-medium pt-1 border-t border-indigo-100/50">Ce transfert réduira le solde de caution disponible du client et l'ajoutera comme une avance sur sa location active.</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Montant à transférer ({settings.currencySymbol || 'DT'})</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  max={transferClient.unusedCaution}
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 font-bold"
                  placeholder="0.00"
                  id="transfer-amount-input"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Associer au Contrat Actif (Optionnel)</label>
                <select
                  value={transferContractId}
                  onChange={(e) => setTransferContractId(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  id="transfer-contract-select"
                >
                  <option value="">-- Aucun contrat spécifique --</option>
                  {contracts
                    .filter(c => c.clientId === transferClient.client.id)
                    .map(c => (
                      <option key={c.id} value={c.id}>
                        Contrat du {new Date(c.startDate).toLocaleDateString('fr-TN')} ({c.status})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Notes (Optionnel)</label>
                <textarea
                  value={transferNotes}
                  onChange={(e) => setTransferNotes(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Détails du transfert..."
                  rows={2}
                />
              </div>

              <div className="pt-4 border-t border-gray-100 flex justify-end gap-3">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setIsTransferModalOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-gray-500 hover:bg-gray-100 rounded-xl transition-colors disabled:opacity-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 text-sm font-bold bg-primary-600 hover:bg-primary-700 text-white rounded-xl transition-colors shadow-sm disabled:opacity-50"
                >
                  {isSubmitting ? 'Transfert...' : 'Confirmer le transfert'}
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
