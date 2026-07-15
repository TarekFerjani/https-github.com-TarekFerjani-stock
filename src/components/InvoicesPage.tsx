import React, { useMemo, useState, useEffect } from 'react';
import { Movement, MovementType, Product, Client, Settings, Reglement } from '../types';
import { jsPDF } from 'jspdf';
import * as QRCode from 'qrcode';
import { invoiceService } from '../services/invoiceService';
import { paymentService } from '../services/paymentService';

interface InvoicesPageProps {
  movements: Movement[];
  products: Product[];
  clients: Client[];
  settings: Settings;
  searchTerm: string;
  locations: any[]; // On utilise any pour éviter les erreurs de type strict si nécessaire mais Location est importé
  fetchAllData?: () => Promise<void>;
}

const InvoicesPage: React.FC<InvoicesPageProps> = ({ 
  movements, products, clients, settings, searchTerm, locations, fetchAllData
}) => {
  const [reglements, setReglements] = useState<Reglement[]>([]);

  const fetchReglements = async () => {
    try {
      const fetchedRegs = await paymentService.getReglements();
      setReglements(fetchedRegs || []);
    } catch (err) {
      console.error("Error fetching reglements on invoices page:", err);
    }
  };

  useEffect(() => {
    fetchReglements();
  }, [movements]);

  const handleToggleStatus = async (id: string) => {
    try {
      await invoiceService.updateInvoiceStatus(id);
      if (fetchAllData) {
        await fetchAllData();
      }
    } catch (err: any) {
      alert("Erreur lors de la modification du statut de paiement : " + err.message);
    }
  };

  const getProductName = (id?: string) => products.find(p => p.id === id)?.nom || '-';
  const getClientName = (id: string) => {
    const c = clients.find(c => c.id === id);
    return c ? `${c.nom} ${c.prenom}` : 'Inconnu';
  };

  const filteredInvoices = useMemo(() => {
    return movements.filter(m => {
      const client = clients.find(c => c.id === m.clientId);
      const clientName = client ? `${client.nom} ${client.prenom}`.toLowerCase() : '';
      const typeStr = m.type.toLowerCase();
      const term = searchTerm.toLowerCase();
      
      const isInvoice = m.type === MovementType.Sale || m.type === MovementType.LocationOut;
      
      return isInvoice && (clientName.includes(term) || typeStr.includes(term));
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [movements, clients, searchTerm, locations]);

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
      
      let rawMontantTotal = parseFloat((movement as any).montantTotal || (movement as any).loyer || 0);
      const loc = locations.find(l => l.id === movement.id && l.status === 'En cours');
      if (loc) {
        const days = Math.max(1, Math.ceil((new Date().getTime() - new Date(loc.entryDate).getTime()) / (1000 * 60 * 60 * 24)));
        rawMontantTotal = days * loc.nbCaisse * settings.rentPerCratePerDay;
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
        ✅ <strong>Document électronique certifié</strong><br/>
        Généré le : ${new Date().toLocaleString('fr-TN')}<br/>
        Réf de traçabilité : ${refId}<br/>
        ${movement.updatedAt ? `⚠️ <strong>Modifié le :</strong> ${new Date(movement.updatedAt).toLocaleString('fr-TN')} par ${movement.updatedBy || 'Inconnu'}<br/>` : ''}
        Veuillez conserver ce document comme preuve d'opération.
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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Historique des Factures</h1>
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        {filteredInvoices.length > 0 ? (
          <ul className="divide-y divide-gray-200">
            {filteredInvoices.map((movement) => (
              <li key={movement.id} className="p-4 hover:bg-gray-50 flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3">
                    <p className="text-sm font-medium text-indigo-600 truncate">{movement.type}</p>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                      {new Date(movement.date).toLocaleDateString()}
                    </span>
                    <span className="text-xs text-gray-400 font-mono">#{movement.id.substring(0, 8)}</span>
                  </div>
                  <div className="mt-2 flex justify-between">
                    <div className="text-sm text-gray-500">
                      <p className="font-semibold text-gray-700">{getClientName(movement.clientId)}</p>
                      <p>
                        {getProductName((movement as any).productId)} 
                        { (movement as any).nbCaisse ? ` • ${(movement as any).nbCaisse} caisses` : '' }
                      </p>
                    </div>
                    { (() => {
                      let amount = Number((movement as any).montantTotal || (movement as any).loyer || 0) || 0;
                      let label = "Payé";
                      
                      const loc = locations.find(l => l.id === movement.id && l.status === 'En cours');
                      
                      const paidForThisInvoice = reglements
                        .filter(r => r.invoiceId === movement.id)
                        .reduce((sum, r) => sum + r.amount, 0);
                        
                      const remaining = Math.max(0, amount - paidForThisInvoice);

                      if (loc && loc.entryDate) {
                        const entryTime = new Date(loc.entryDate).getTime();
                        if (!isNaN(entryTime)) {
                          const days = Math.max(1, Math.ceil((new Date().getTime() - entryTime) / (1000 * 60 * 60 * 24)));
                          amount = (days || 0) * (Number(loc.nbCaisse) || 0) * (Number(settings.rentPerCratePerDay) || 0);
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

                      return amount > 0 ? (
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
                            <p className="text-xs text-orange-600 font-medium">{label}</p>
                          ) : (
                            <button
                              onClick={() => handleToggleStatus(movement.id)}
                              className={`text-xs ${label === 'Payé' ? 'bg-green-100 hover:bg-green-200 text-green-800' : 'bg-amber-100 hover:bg-amber-200 text-amber-800'} px-2.5 py-1 rounded-full font-semibold transition-colors mt-1`}
                              title="Cliquer pour forcer le statut de paiement"
                            >
                              {label}
                            </button>
                          )}
                        </div>
                      ) : null;
                    })() }
                  </div>
                </div>
                <div className="ml-6 flex items-center">
                  <button 
                    onClick={() => generatePDF(movement)} 
                    className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors group"
                    title="Ré-imprimer la facture"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 group-hover:scale-110 transition-transform">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.89l-2.1 2.1m0 0l-2.1-2.1m2.1 2.1V6.14M16.5 18.75h-9M16.5 5.25h-9m-9 13.5h9" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 12V10.5a3.75 3.75 0 10-7.5 0V12m7.5 0v3.75m-7.5-3.75v3.75" />
                    </svg>
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="p-10 text-center text-gray-500">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="mt-2 text-sm font-medium text-gray-900">Aucune facture trouvée.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default InvoicesPage;
