import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { Movement, MovementType, Product, Client, Settings, Reglement, Role } from '../types';
import * as QRCode from 'qrcode';
import { invoiceService } from '../services/invoiceService';
import { paymentService } from '../services/paymentService';
import { calculateMonthlyRent } from '../utils/paymentUtils';

interface InvoicesPageProps {
  movements: Movement[];
  products: Product[];
  clients: Client[];
  settings: Settings;
  searchTerm: string;
  locations: any[];
  fetchAllData?: () => Promise<void>;
  reglements: Reglement[];
  user: any;
}

const InvoicesPage: React.FC<InvoicesPageProps> = ({ 
  movements, products, clients, settings, searchTerm, locations, fetchAllData, reglements, user
}) => {
  const [activeTab, setActiveTab] = useState<'factures' | 'payments' | 'unpaid'>('factures');

  // Modal state
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // New Payment form state
  const [regClientId, setRegClientId] = useState('');
  const [regAmount, setRegAmount] = useState('');
  const [regInvoiceId, setRegInvoiceId] = useState('');
  const [regReference, setRegReference] = useState('');
  const [regNotes, setRegNotes] = useState('');
  const [formError, setFormError] = useState('');

  const getProductName = (id?: string) => products.find(p => p.id === id)?.nom || '-';
  const getClientName = (id: string) => {
    const c = clients.find(c => c.id === id);
    return c ? `${c.nom} ${c.prenom}` : 'Inconnu';
  };
  const getClientPhone = (id: string) => {
    const c = clients.find(c => c.id === id);
    return c ? c.telephone || '' : '';
  };

  const getInvoiceRemainingAmount = useCallback((invoice: Movement) => {
    const hasTotal = (invoice as any).montantTotal !== undefined && (invoice as any).montantTotal !== null;
    const totalAmount = hasTotal ? Number((invoice as any).montantTotal) : Number((invoice as any).loyer || (invoice as any).caution || 0);
    const paidAmount = reglements
      .filter(r => r.invoiceId === invoice.id)
      .reduce((sum, r) => sum + r.amount, 0);
    return Math.max(0, totalAmount - paidAmount);
  }, [reglements]);

  // Check if an invoice is fully paid
  const isInvoicePaid = useCallback((movement: Movement) => {
    const loc = locations.find(l => l.id === movement.id && l.status === 'En cours');
    if (loc && loc.entryDate) {
      return false; // Still ongoing rent, can't be marked as paid until terminated
    }
    const hasTotal = (movement as any).montantTotal !== undefined && (movement as any).montantTotal !== null;
    let totalAmount = hasTotal ? Number((movement as any).montantTotal) : (Number((movement as any).loyer || (movement as any).caution || 0));
    const paidForThisInvoice = reglements
      .filter(r => r.invoiceId === movement.id)
      .reduce((sum, r) => sum + r.amount, 0);
    const remaining = Math.max(0, totalAmount - paidForThisInvoice);
    return (movement as any).paymentStatus === 'Payé' || remaining <= 0;
  }, [reglements, locations]);

  // Filter movements that are billable (Vente or Fin de Location) and have remaining amount > 0
  const pendingMovements = useMemo(() => {
    return movements.filter(m => {
      const isBillable = m.type === MovementType.Sale || m.type === MovementType.LocationOut || m.type === MovementType.EmptyCratesOut;
      const remaining = getInvoiceRemainingAmount(m);
      return isBillable && remaining > 0;
    });
  }, [movements, getInvoiceRemainingAmount]);

  // Filter client pending invoices on selection
  const clientPendingInvoices = useMemo(() => {
    if (!regClientId) return [];
    return pendingMovements.filter(m => m.clientId === regClientId);
  }, [regClientId, pendingMovements]);

  // Auto set amount on pending invoice selection
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

  const handleToggleStatus = async (id: string) => {
    if (user?.role !== Role.admin) {
      alert("Action non autorisée. Seuls les administrateurs peuvent modifier le statut d'une facture.");
      return;
    }
    try {
      await invoiceService.updateInvoiceStatus(id);
      if (fetchAllData) {
        await fetchAllData();
      }
    } catch (err: any) {
      alert("Erreur lors de la modification du statut de paiement : " + err.message);
    }
  };

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (isSubmitting) return;

    if (!regClientId || !regAmount || Number(regAmount) <= 0) {
      setFormError('Veuillez sélectionner un client et entrer un montant valide supérieur à 0.');
      return;
    }
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
        `Client : ${getClientName(regClientId)}\n` +
        `Montant : ${Number(regAmount).toFixed(2)} ${settings.currencySymbol || 'DT'}\n\n` +
        `Voulez-vous vraiment enregistrer ce doublon ?`;
      if (!window.confirm(confirmMsg)) {
        return;
      }
    }

    setIsSubmitting(true);
    try {
      await paymentService.addReglement({
        clientId: regClientId,
        amount: Number(regAmount),
        paymentMethod: 'Espèces',
        reference: '',
        invoiceId: regInvoiceId,
        notes: ''
      });
      
      // Reset form
      setRegClientId('');
      setRegAmount('');
      setRegReference('');
      setRegInvoiceId('');
      setRegNotes('');
      setIsPaymentModalOpen(false);
      if (fetchAllData) {
        await fetchAllData();
      }
    } catch (err: any) {
      setFormError(err.message || "Impossible d'enregistrer le paiement.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteReglement = async (id: string) => {
    if (user?.role !== Role.admin) {
      alert("Action non autorisée. Seuls les administrateurs peuvent supprimer un règlement.");
      return;
    }
    if (window.confirm('Êtes-vous sûr de vouloir supprimer ce paiement ? Le statut de la facture associée reviendra en attente.')) {
      try {
        await paymentService.deleteReglement(id);
        if (fetchAllData) {
          await fetchAllData();
        }
      } catch (err: any) {
        alert(err.message || 'Erreur lors de la suppression.');
      }
    }
  };

  const filteredInvoices = useMemo(() => {
    return movements.filter(m => {
      const client = clients.find(c => c.id === m.clientId);
      const clientName = client ? `${client.nom} ${client.prenom}`.toLowerCase() : '';
      const typeStr = m.type.toLowerCase();
      const term = searchTerm.toLowerCase();
      
      const isInvoice = m.type === MovementType.Sale || m.type === MovementType.LocationOut || m.type === MovementType.EmptyCratesOut;
      
      return isInvoice && (clientName.includes(term) || typeStr.includes(term));
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [movements, clients, searchTerm]);

  const filteredReglements = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return reglements.filter(r => {
      const client = clients.find(c => c.id === r.clientId);
      const clientName = client ? `${client.nom} ${client.prenom}`.toLowerCase() : '';
      const notesMatch = r.notes?.toLowerCase().includes(term) || false;
      const refMatch = r.reference?.toLowerCase().includes(term) || false;
      const invoiceMatch = r.invoiceId?.toLowerCase().includes(term) || false;
      return clientName.includes(term) || notesMatch || refMatch || invoiceMatch;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [reglements, clients, searchTerm]);

  const filteredUnpaidInvoices = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return pendingMovements.filter(m => {
      const client = clients.find(c => c.id === m.clientId);
      const clientName = client ? `${client.nom} ${client.prenom}`.toLowerCase() : '';
      const idMatch = m.id.toLowerCase().includes(term);
      const typeMatch = m.type.toLowerCase().includes(term);
      return clientName.includes(term) || idMatch || typeMatch;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [pendingMovements, clients, searchTerm]);

  const generatePDF = async (movement: Movement) => {
    // Strict block: Invoice MUST be fully paid before printing
    const isPaid = isInvoicePaid(movement);
    if (!isPaid) {
      alert("Impression impossible : l'impression est verrouillée tant que la facture n'est pas entièrement payée.");
      return;
    }

    try {
      const qrCodeDataUrl = await QRCode.toDataURL(movement.id);
      const client = clients.find(c => c.id === movement.clientId);
      const productName = getProductName((movement as any).productId);
      const clientName = client ? `${client.nom.toUpperCase()} ${client.prenom}` : 'Client Inconnu';
      const cin = client?.cin || 'N/A';
      const address = client?.adresse || 'N/A';
      const dateStr = new Date(movement.date).toLocaleDateString('fr-TN');
      const refId = movement.id.substring(0, 8).toUpperCase();
      
      const company = settings.companyName || 'L\'entreprise';
      const companyAddress = settings.companyAddress || '';
      const phone = settings.companyPhone || '';
      const fiscal = settings.fiscalId || '';
      const currency = settings.currencySymbol || 'DT';
      const taxRate = settings.taxRate || 19;
      
      let rawMontantTotal = ((movement as any).montantTotal !== undefined && (movement as any).montantTotal !== null) ? Number((movement as any).montantTotal) : Number((movement as any).loyer || 0);
      const loc = locations.find(l => l.id === movement.id && l.status === 'En cours');
      if (loc) {
        rawMontantTotal = calculateMonthlyRent(
          loc.entryDate,
          Number(loc.nbCaisse) || 0,
          Number(settings.rentPerCratePerDay) || 0,
          Number(settings.rentIncreaseRate) || 0,
          Number(settings.increaseStartMonth) || 0
        );
      }

      const montantTTC = rawMontantTotal;
      const montantHT = montantTTC / (1 + (taxRate / 100));
      const montantTVA = montantTTC - montantHT;
      
      const typeLabel = (movement.type === MovementType.Sale || movement.type === MovementType.LocationOut) ? 'FACTURE' : 'BON D\'OPÉRATION';
      const title = typeLabel;

      const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8"/>
<title>${title} ${refId}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@400;600;700&display=swap');
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Source Sans 3',sans-serif; color:#111; }
  .page { position:relative; width:210mm; height:297mm; padding:15mm 20mm; page-break-after:always; display:flex; flex-direction:column; overflow:hidden; }
  .watermark { position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); max-width:70%; max-height:70%; opacity:0.06; pointer-events:none; z-index:0; filter:grayscale(30%); }
  .doc-id { position:absolute; left:6mm; bottom:50%; transform:rotate(-90deg); transform-origin:left bottom; font-family:monospace; font-size:7pt; color:#a0aec0; letter-spacing:1px; white-space:nowrap; }
  .legal-margin { position:absolute; right:6mm; top:50%; transform:rotate(-90deg); transform-origin:right top; font-size:7pt; color:#94a3b8; white-space:nowrap; }
  
  .header { color:#1a4fa0; text-align:center; border-bottom:1px solid #e2e8f0; padding-bottom:8px; margin-bottom:12px; }
  .header h1 { font-size:16pt; letter-spacing:1px; margin-bottom:4px; font-weight:700; text-transform:uppercase; }
  .header .ref { font-size:8.5pt; color:#64748b; }
  
  .section { margin-bottom:10px; }
  .section-title { font-size:9.5pt; font-weight:700; color:#1a4fa0; text-transform:uppercase; letter-spacing:.5px; margin-bottom:6px; }
  .row { display:flex; gap:10px; }
  .col { flex:1; }
  .field { margin-bottom:3px; font-size:9pt; }
  .field span { font-weight:700; color:#111; font-size:9.5pt; }
  
  table.items { width:100%; border-collapse:collapse; margin-top:20px; font-size:9.5pt; }
  table.items th, table.items td { border:1px solid #e2e8f0; padding:8px 10px; text-align:left; }
  table.items th { background:#f8fafc; font-weight:700; color:#1e293b; text-transform:uppercase; font-size:8.5pt; }
  table.items td.num { text-align:right; }
  
  .totals { width:50%; margin-left:auto; margin-top:20px; font-size:9.5pt; }
  .totals table { width:100%; border-collapse:collapse; }
  .totals td { padding:6px 10px; border:1px solid #e2e8f0; }
  .totals tr.bold td { font-weight:700; background:#f8fafc; }
  .totals td:last-child { text-align:right; }
  
  .timestamp { display:flex; align-items:center; gap:15px; margin-top:20px; padding:10px 15px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; font-size:8.5pt; color:#475569; }
  .timestamp strong { color:#1e293b; }
  @media print {
    @page { margin: 0; size: A4; }
    body { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
    .page { page-break-after:always; }
  }
</style>
</head>
<body>

<div class="page">
  ${settings.companyLogo ? `<img src="${settings.companyLogo}" class="watermark"/>` : ''}
  <div class="doc-id">FACT ID: ${movement.id}</div>
  <div style="flex:1;">
    <div class="header">
      <h1>${title}</h1>
      <div class="ref">Réf. Opération : ${refId} &nbsp;|&nbsp; ${company} &nbsp;|&nbsp; Date : ${dateStr}</div>
    </div>

    <div class="section">
      <div class="section-title">Informations de facturation</div>
      <div class="row">
        <div class="col">
          <div class="field">Émetteur :</div>
          <div class="field"><span>${company}</span></div>
          <div class="field">Adresse : ${companyAddress}</div>
          <div class="field">Tél : ${phone}</div>
          ${fiscal ? `<div class="field">Matricule fiscal : ${fiscal}</div>` : ''}
        </div>
        <div class="col">
          <div class="field">Facturé à :</div>
          <div class="field"><span>${clientName}</span></div>
          <div class="field">Adresse : ${address}</div>
          <div class="field">CIN / Doc : ${cin}</div>
        </div>
      </div>
    </div>

    <table class="items">
      <thead>
        <tr>
          <th>Description</th>
          <th class="num">Quantité</th>
          <th class="num">T.V.A</th>
          <th class="num">Montant TTC</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>
            <strong>${movement.type}</strong><br/>
            <small style="color:#64748b;">${productName !== '-' ? 'Produit : ' + productName : 'Opération financière'}</small>
          </td>
          <td class="num">${(movement as any).nbCaisse || '-'}</td>
          <td class="num">${taxRate}%</td>
          <td class="num">${montantTTC > 0 ? Math.round(montantTTC).toLocaleString('fr-FR') : '-'} ${currency}</td>
        </tr>
      </tbody>
    </table>

    <div class="totals">
      <table>
        <tr>
          <td>Total Net H.T</td>
          <td>${Math.round(montantHT).toLocaleString('fr-FR')} ${currency}</td>
        </tr>
        <tr>
          <td>T.V.A (${taxRate}%)</td>
          <td>${Math.round(montantTVA).toLocaleString('fr-FR')} ${currency}</td>
        </tr>
        <tr class="bold">
          <td>TOTAL T.T.C</td>
          <td>${Math.round(montantTTC).toLocaleString('fr-FR')} ${currency}</td>
        </tr>
      </table>
    </div>
  </div>

  <div>
    <div class="timestamp">
      <img src="${qrCodeDataUrl}" style="width:60px;height:60px;" />
      <div>
        ✅ <strong>Document électronique certifié - PAYÉ</strong><br/>
        Généré le : ${new Date().toLocaleString('fr-TN')}<br/>
        Réf de traçabilité : ${refId}<br/>
        ${movement.updatedAt ? `⚠️ <strong>Modifié le :</strong> ${new Date(movement.updatedAt).toLocaleString('fr-TN')} par ${movement.updatedBy || 'Inconnu'}<br/>` : ''}
        Veuillez conserver ce document comme preuve d'opération et de paiement.
      </div>
    </div>
  </div>
  <div class="legal-margin">Document établi sous réserve d'encaissement définitif - M.F: ${fiscal}</div>
</div>

<script>window.onload = function(){ window.print(); }<\/script>
</body>
</html>`;

      const printWindow = window.open('', '', 'width=800,height=900');
      if (printWindow) {
        printWindow.document.open();
        printWindow.document.write(html);
        printWindow.document.close();
      }
    } catch (error: any) {
      console.error('PDF Generation Error:', error);
      alert('Erreur lors de la génération de la facture.');
    }
  };

  const handlePayInvoice = (invoice: Movement) => {
    setRegClientId(invoice.clientId);
    setRegInvoiceId(invoice.id);
    setIsPaymentModalOpen(true);
  };

  const formatCurrency = (amount: number) => {
    return `${amount.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${settings.currencySymbol || 'DT'}`;
  };

  return (
    <div className="space-y-6 flex-1 overflow-y-auto pb-10" id="invoices-payments-merged-container">
      {/* Upper Navigation & Action Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Factures & Règlements</h1>
          <p className="text-sm text-gray-500">Gérez l'ensemble des factures de vente/location et l'enregistrement de vos paiements.</p>
        </div>
      </div>

      {/* Tabs System */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8" aria-label="Tabs">
          <button
            onClick={() => setActiveTab('factures')}
            className={`py-4 px-1 border-b-2 font-semibold text-sm transition-all ${
              activeTab === 'factures'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Historique des Factures ({filteredInvoices.length})
          </button>
          <button
            onClick={() => setActiveTab('payments')}
            className={`py-4 px-1 border-b-2 font-semibold text-sm transition-all ${
              activeTab === 'payments'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Historique des Règlements ({filteredReglements.length})
          </button>
          <button
            onClick={() => setActiveTab('unpaid')}
            className={`py-4 px-1 border-b-2 font-semibold text-sm transition-all ${
              activeTab === 'unpaid'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Factures Non Payées ({filteredUnpaidInvoices.length})
          </button>
        </nav>
      </div>

      {/* TAB 1: INVOICES HISTORY */}
      {activeTab === 'factures' && (
        <div className="bg-white shadow overflow-hidden sm:rounded-2xl border border-gray-100">
          {filteredInvoices.length > 0 ? (
            <ul className="divide-y divide-gray-100">
              {filteredInvoices.map((movement) => {
                const paid = isInvoicePaid(movement);
                return (
                  <li key={movement.id} className="p-5 hover:bg-gray-50/50 flex items-center justify-between transition-colors">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <p className="text-sm font-semibold text-indigo-600 truncate">{movement.type}</p>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-800">
                          {new Date(movement.date).toLocaleDateString()}
                        </span>
                        <span className="text-xs text-gray-400 font-mono">#{movement.id.substring(0, 8)}</span>
                      </div>
                      <div className="mt-3 flex justify-between items-end">
                        <div className="text-sm text-gray-500">
                          <p className="font-semibold text-gray-800">{getClientName(movement.clientId)}</p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {getProductName((movement as any).productId)} 
                            { (movement as any).nbCaisse ? ` • ${(movement as any).nbCaisse} caisses` : '' }
                          </p>
                        </div>
                        { (() => {
                          const hasTotal = (movement as any).montantTotal !== undefined && (movement as any).montantTotal !== null;
                          let amount = hasTotal ? Number((movement as any).montantTotal) : Number((movement as any).loyer || 0);
                          let label = "Payé";
                          
                          const loc = locations.find(l => l.id === movement.id && l.status === 'En cours');
                          
                          const paidForThisInvoice = reglements
                            .filter(r => r.invoiceId === movement.id)
                            .reduce((sum, r) => sum + r.amount, 0);
                            
                          const remaining = Math.max(0, amount - paidForThisInvoice);

                          if (loc && loc.entryDate) {
                            const entryTime = new Date(loc.entryDate).getTime();
                            if (!isNaN(entryTime)) {
                              amount = calculateMonthlyRent(
                                loc.entryDate,
                                Number(loc.nbCaisse) || 0,
                                Number(settings.rentPerCratePerDay) || 0,
                                Number(settings.rentIncreaseRate) || 0,
                                Number(settings.increaseStartMonth) || 0
                              );
                              label = "En cours (Attente)";
                            }
                          } else {
                            const isFullyPaid = (movement as any).paymentStatus === 'Payé' || remaining <= 0;
                            if (!isFullyPaid) {
                              if (paidForThisInvoice > 0) {
                                label = `Partiel (${Math.round(paidForThisInvoice)} ${settings.currencySymbol})`;
                              } else {
                                label = "En attente";
                              }
                            }
                          }

                          return amount >= 0 ? (
                            <div className="text-right space-y-1">
                              <p className="text-sm font-bold text-gray-900" title="Montant Total Facture">
                                Total: {Math.round(amount).toLocaleString('fr-FR')} {settings.currencySymbol}
                              </p>
                              {label !== "En cours (Attente)" && paidForThisInvoice > 0 && remaining > 0 && (
                                <div className="text-xs text-gray-500 space-y-0.5">
                                  <p>Payé: <span className="font-semibold text-emerald-600">{Math.round(paidForThisInvoice)} {settings.currencySymbol}</span></p>
                                  <p>Reste: <span className="font-semibold text-rose-500">{Math.round(remaining)} {settings.currencySymbol}</span></p>
                                </div>
                              )}
                              {label === "En cours (Attente)" ? (
                                <p className="text-xs text-orange-600 font-semibold">{label}</p>
                              ) : (
                                <button
                                  disabled={user?.role !== Role.admin}
                                  onClick={() => handleToggleStatus(movement.id)}
                                  className={`text-xs px-2.5 py-1 rounded-full font-bold transition-all mt-1 border ${
                                    label === 'Payé' 
                                      ? 'bg-green-50 text-green-700 border-green-200' 
                                      : 'bg-amber-50 text-amber-700 border-amber-200'
                                  } ${user?.role === Role.admin ? 'hover:scale-105 hover:bg-opacity-80' : 'opacity-90 cursor-not-allowed'}`}
                                  title={user?.role === Role.admin ? "Changer le statut (Admin)" : "Statut de paiement (Modifiable par Admin uniquement)"}
                                >
                                  {label}
                                </button>
                              )}
                            </div>
                          ) : null;
                        })() }
                      </div>
                    </div>
                    {/* Print / lock button */}
                    <div className="ml-6 flex items-center">
                      <button 
                        onClick={() => {
                          if (!paid) {
                            alert("Impression bloquée : l'impression est interdite tant que la facture n'est pas payée.");
                            return;
                          }
                          generatePDF(movement);
                        }} 
                        className={`p-2 rounded-full transition-all border ${
                          paid 
                            ? 'text-indigo-600 hover:bg-indigo-50 border-indigo-100 hover:scale-110' 
                            : 'text-gray-300 bg-gray-50 border-gray-100 cursor-not-allowed'
                        }`}
                        title={paid ? "Imprimer la Facture (PDF)" : "Impression bloquée : la facture doit être payée pour être imprimée"}
                      >
                        {paid ? (
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.89l-2.1 2.1m0 0l-2.1-2.1m2.1 2.1V6.14M16.5 18.75h-9M16.5 5.25h-9m-9 13.5h9" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 12V10.5a3.75 3.75 0 10-7.5 0V12m7.5 0v3.75m-7.5-3.75v3.75" />
                          </svg>
                        ) : (
                          <div className="relative">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                            </svg>
                          </div>
                        )}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="p-12 text-center text-gray-500">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="mt-2 text-sm font-semibold text-gray-900">Aucune facture trouvée.</p>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: PAYMENTS HISTORY */}
      {activeTab === 'payments' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden" id="payments-history-table-wrapper">
          {filteredReglements.length === 0 ? (
            <div className="p-12 text-center text-gray-500">Aucun paiement enregistré.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse" id="payments-history-table">
                <thead>
                  <tr className="bg-gray-50/75 border-b border-gray-100">
                    <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Client</th>
                    <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Montant</th>
                    <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Facture liée</th>
                    {user?.role === Role.admin && (
                      <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredReglements.map((reg) => (
                    <tr key={reg.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="p-4 text-sm text-gray-600">
                        {new Date(reg.date).toLocaleDateString('fr-TN', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="p-4 text-sm font-semibold text-gray-900">{getClientName(reg.clientId)}</td>
                      <td className="p-4 text-sm font-extrabold text-emerald-600">{formatCurrency(reg.amount)}</td>
                      <td className="p-4 text-sm text-gray-600">
                        {reg.invoiceId ? (
                          <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-md text-xs font-bold border border-blue-100">
                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span>Facture #{reg.invoiceId.substring(0, 8).toUpperCase()}</span>
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs italic">Général</span>
                        )}
                      </td>
                      {user?.role === Role.admin && (
                        <td className="p-4 text-sm text-gray-600 text-right">
                          <button
                            onClick={() => handleDeleteReglement(reg.id)}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors inline-flex items-center border border-transparent hover:border-red-100"
                            title="Supprimer le paiement"
                          >
                            <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: UNPAID INVOICES */}
      {activeTab === 'unpaid' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden animate-in fade-in duration-100" id="unpaid-invoices-table-wrapper">
          {filteredUnpaidInvoices.length === 0 ? (
            <div className="p-12 text-center text-gray-500">Aucune facture en attente de paiement.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse" id="unpaid-invoices-table">
                <thead>
                  <tr className="bg-gray-50/75 border-b border-gray-100">
                    <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Facture</th>
                    <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Client / Contact</th>
                    <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Type Facture</th>
                    <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Caisses</th>
                    <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Montant Total</th>
                    <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Reste à Payer</th>
                    <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Action</th>
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
                          <div className="font-semibold text-gray-900">{getClientName(mov.clientId)}</div>
                          <div className="text-xs text-gray-400">{getClientPhone(mov.clientId)}</div>
                        </td>
                        <td className="p-4 text-sm">
                          <span className={`px-2 py-1 rounded-md text-xs font-extrabold ${isLocationOut ? 'bg-amber-50 text-amber-700 border border-amber-100' : 'bg-purple-50 text-purple-700 border border-purple-100'}`}>
                            {mov.type}
                          </span>
                        </td>
                        <td className="p-4 text-sm text-center font-semibold text-gray-700">
                          {mov.nbCaisse} caisses
                        </td>
                        <td className="p-4 text-sm text-gray-600 font-semibold">
                          {formatCurrency(total)}
                        </td>
                        <td className="p-4 text-sm font-extrabold text-rose-600">
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
            </div>
          )}
        </div>
      )}

      {/* PAYMENT ENTRY MODAL */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-150" id="payment-modal">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 max-w-lg w-full overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-base font-bold text-gray-800">Saisir un Paiement de Facture</h3>
              <button
                onClick={() => setIsPaymentModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                id="btn-close-payment-modal"
              >
                <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleAddPayment} className="p-6 space-y-4" id="payment-form">
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
                  id="payment-client-select"
                >
                  <option value="">-- Sélectionner un client --</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.nom.toUpperCase()} {c.prenom} (CIN: {c.cin})</option>
                  ))}
                </select>
              </div>

              {regClientId && (
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
    </div>
  );
};

export default InvoicesPage;
