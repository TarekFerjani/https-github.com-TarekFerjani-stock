import React, { useState, useMemo } from 'react';
import { Movement, MovementType, Product, Client, Room, Location, Settings, Reglement } from '../types';
import AddMovementModal from './AddMovementModal';
import { AuditLogsView } from './AuditLogsView';
import { movementService } from '../services/movementService';
import { authService } from '../services/authService';
import { jsPDF } from 'jspdf';
import * as QRCode from 'qrcode';
import { isMovementPaid } from '../utils/paymentUtils';

interface StockPageProps {
  movements: Movement[];
  products: Product[];
  clients: Client[];
  rooms: Room[];
  locations: Location[];
  settings: Settings;
  fetchAllData: () => Promise<void>;
  isLoading: boolean;
  searchTerm: string;
  reglements: Reglement[];
}

const StockPage: React.FC<StockPageProps> = ({ 
  movements, products, clients, rooms, locations, settings, fetchAllData, isLoading, searchTerm, reglements 
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [movementToEdit, setMovementToEdit] = useState<Movement | null>(null);
  const [activeTab, setActiveTab] = useState<'movements' | 'audit'>('movements');

  const filteredMovements = useMemo(() => {
    return movements.filter(m => {
      const client = clients.find(c => c.id === m.clientId);
      const clientName = client ? `${client.nom} ${client.prenom}`.toLowerCase() : '';
      const typeStr = m.type.toLowerCase();
      const term = searchTerm.toLowerCase();
      
      return clientName.includes(term) || typeStr.includes(term);
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [movements, clients, searchTerm]);

  const handleDelete = async (id: string) => {
    const currentUser = authService.getCurrentUser();
    if (currentUser?.role !== 'admin') {
      alert("Suppression interdite : cette action est réservée aux administrateurs.");
      return;
    }
    const movement = movements.find(m => m.id === id);
    if (movement) {
      const hasPayments = reglements.some(r => r.invoiceId === movement.id);
      if (hasPayments || isMovementPaid(movement, reglements, locations)) {
        alert("Suppression interdite : cette opération a déjà des règlements enregistrés ou est payée.");
        return;
      }
    }
    if (window.confirm('Voulez-vous vraiment supprimer cette opération ? Cette action peut affecter les stocks et factures.')) {
      try {
        await movementService.deleteMovement(id);
        fetchAllData();
      } catch (error) {
        alert('Erreur lors de la suppression.');
      }
    }
  };

  const getProductName = (id?: string) => products.find(p => p.id === id)?.nom || '-';
  const getClientName = (id: string) => {
    const c = clients.find(c => c.id === id);
    return c ? `${c.nom} ${c.prenom}` : 'Inconnu';
  };

  const generatePDF = async (movement: Movement) => {
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
      const hasTotalValue = (movement as any).montantTotal !== undefined && (movement as any).montantTotal !== null;
      const montantTTC = hasTotalValue ? Number((movement as any).montantTotal) : Number((movement as any).loyer || 0);
      const montantHT = montantTTC / (1 + (taxRate / 100));
      const montantTVA = montantTTC - montantHT;
      
      const typeLabel = (movement.type === MovementType.Sale || movement.type === MovementType.LocationOut) ? 'FACTURE' : 'BON D\'OPÉRATION';
      const title = typeLabel;

      const hasTotals = movement.type === MovementType.Sale || movement.type === MovementType.LocationOut;

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
  <div class="doc-id">OP ID: ${movement.id}</div>
  <div style="flex:1;">
    <div class="header">
      <h1>${title}</h1>
      <div class="ref">Réf. Opération : ${refId} &nbsp;|&nbsp; ${company} &nbsp;|&nbsp; Date : ${dateStr}</div>
    </div>

    <div class="section">
      <div class="section-title">Informations</div>
      <div class="row">
        <div class="col">
          <div class="field">Émetteur :</div>
          <div class="field"><span>${company}</span></div>
          <div class="field">Adresse : ${companyAddress}</div>
          <div class="field">Tél : ${phone}</div>
          ${fiscal ? `<div class="field">Matricule fiscal : ${fiscal}</div>` : ''}
        </div>
        <div class="col">
          <div class="field">Opération pour :</div>
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
          ${hasTotals ? `<th class="num">T.V.A</th><th class="num">Montant TTC</th>` : ''}
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>
            <strong>${movement.type}</strong><br/>
            <small style="color:#64748b;">${productName !== '-' ? 'Produit : ' + productName : 'Opération financière'}</small>
          </td>
          <td class="num">${(movement as any).nbCaisse || '-'}</td>
          ${hasTotals ? `
            <td class="num">${taxRate}%</td>
            <td class="num">${Math.round(montantTTC).toLocaleString('fr-FR')} ${currency}</td>
          ` : ''}
        </tr>
      </tbody>
    </table>

    ${hasTotals ? `
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
    </div>` : ''}
  </div>

  <div>
    <div class="timestamp">
      <img src="${qrCodeDataUrl}" style="width:60px;height:60px;" />
      <div>
        ✅ <strong>Document électronique certifié</strong><br/>
        Généré le : ${new Date().toLocaleString('fr-TN')}<br/>
        Réf de traçabilité : ${refId}<br/>
        ${movement.updatedAt ? `⚠️ <strong>Modifié le :</strong> ${new Date(movement.updatedAt).toLocaleString('fr-TN')} par ${movement.updatedBy || 'Inconnu'}<br/>` : ''}
        Veuillez conserver ce document comme preuve d'opération.
      </div>
    </div>
  </div>
  <div class="legal-margin">Document établi sous réserve d'encaissement - M.F: ${fiscal}</div>
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
      console.error('PDF Generation Error Detail:', error);
      alert(`Erreur lors de la génération du PDF : ${error?.message || 'Inconnue'}`);
    }
  };

  const renderMovementDetails = (m: Movement) => {
    switch (m.type) {
      case MovementType.Sale:
        return `Vente: ${m.nbCaisse} caisses de ${getProductName(m.productId)}`;
      case MovementType.LocationIn:
        return `Entrée (Loc): ${m.nbCaisse} caisses de ${getProductName(m.productId)}`;
      case MovementType.LocationOut:
        return `Sortie (Loc): ${m.nbCaisse} caisses retournées`;
      case MovementType.EmptyCratesOut:
        return `Emprunt: ${m.nbCaisse} caisses vides`;
      case MovementType.EmptyCratesReturn:
        return `Retour: ${m.nbCaisse} caisses vides`;
      default:
        return '-';
    }
  };

  if (isLoading) {
    return <div className="text-center py-10">Chargement...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Opérations de Stock</h1>
        <button
          onClick={() => { setMovementToEdit(null); setIsModalOpen(true); }}
          className="flex items-center justify-center px-4 py-2 bg-primary-600 border border-transparent rounded-md shadow-sm text-sm font-medium text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors self-start sm:self-auto"
        >
          <svg className="-ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
          Nouvelle Opération
        </button>
      </div>

      {/* Navigation par Onglets */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          <button
            onClick={() => setActiveTab('movements')}
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-all focus:outline-none ${
              activeTab === 'movements'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Liste des Opérations
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-all focus:outline-none ${
              activeTab === 'audit'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Journal d'Audit & Historique
          </button>
        </nav>
      </div>

      {activeTab === 'movements' ? (
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          {filteredMovements.length > 0 ? (
            <ul className="divide-y divide-gray-200">
            {filteredMovements.map((movement) => {
              const isPaid = isMovementPaid(movement, reglements, locations);
              const isBillable = movement.type === MovementType.Sale || movement.type === MovementType.LocationOut;
              return (
                <li key={movement.id} className="p-4 hover:bg-gray-50 flex items-center justify-between">
                  <div>
                    <div className="flex items-center space-x-3">
                      <p className="text-sm font-medium text-primary-600 truncate">{movement.type}</p>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        {new Date(movement.date).toLocaleDateString()}
                      </span>
                      {isPaid && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-800 border border-green-200 uppercase">
                          Payé
                        </span>
                      )}
                    </div>
                    <div className="mt-2 text-sm text-gray-500">
                      <p>Client: {getClientName(movement.clientId)}</p>
                      <p>{renderMovementDetails(movement)}</p>
                    </div>
                  </div>
                  <div className="flex space-x-3 items-center">
                    {(!isBillable || isPaid) ? (
                      <button onClick={() => generatePDF(movement)} className="p-2 text-green-600 hover:bg-green-50 rounded-full transition-colors" title="Imprimer">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.89l-2.1 2.1m0 0l-2.1-2.1m2.1 2.1V6.14M16.5 18.75h-9M16.5 5.25h-9m-9 13.5h9" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 12V10.5a3.75 3.75 0 10-7.5 0V12m7.5 0v3.75m-7.5-3.75v3.75" />
                        </svg>
                      </button>
                    ) : (
                      <button 
                        onClick={() => alert("Impression bloquée : l'impression est interdite tant que la facture n'est pas payée.")} 
                        className="p-2 text-gray-300 bg-gray-50 border border-gray-100 rounded-full cursor-not-allowed" 
                        title="Impression bloquée : la facture doit être payée pour être imprimée"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-gray-400">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636" />
                        </svg>
                      </button>
                    )}
                    {(() => {
                      const currentUser = authService.getCurrentUser();
                      const isUserAdmin = currentUser?.role === 'admin';
                      const hasPayments = reglements.some(r => r.invoiceId === movement.id);

                      if (!isUserAdmin) {
                        return (
                          <button 
                            onClick={() => alert("Accès refusé : la modification des opérations de stock est réservée aux administrateurs.")} 
                            className="p-2 text-gray-400 bg-gray-50 border border-gray-100 rounded-full cursor-not-allowed" 
                            title="Modification impossible : réservé aux administrateurs"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5.5 h-5.5 text-gray-400">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                            </svg>
                          </button>
                        );
                      }

                      if (hasPayments || isPaid) {
                        return (
                          <button 
                            onClick={() => alert("Cette opération a des règlements associés (ou est payée) et ne peut plus être modifiée dans le stock.")} 
                            className="p-2 text-gray-400 bg-gray-50 border border-gray-100 rounded-full cursor-not-allowed" 
                            title="Modification impossible : règlements déjà enregistrés"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5.5 h-5.5 text-gray-400">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                            </svg>
                          </button>
                        );
                      }

                      return (
                        <button onClick={() => { setMovementToEdit(movement); setIsModalOpen(true); }} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors" title="Modifier">
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
                          </svg>
                        </button>
                      );
                    })()}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="p-6 text-center text-gray-500">Aucune opération trouvée.</div>
        )}
      </div>
      ) : (
        <AuditLogsView products={products} clients={clients} rooms={rooms} />
      )}

      <AddMovementModal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setMovementToEdit(null); }}
        onSave={() => { setIsModalOpen(false); fetchAllData(); }}
        products={products}
        clients={clients}
        rooms={rooms}
        movements={movements}
        locations={locations}
        movementToEdit={movementToEdit}
        settings={settings}
        reglements={reglements}
      />
    </div>
  );
};

export default StockPage;
