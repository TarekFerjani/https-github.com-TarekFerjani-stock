import React, { useState, useMemo, useEffect } from 'react';
import { Contract, Client, Settings } from '../types';
import AddContractModal from './AddContractModal';
import { contractService } from '../services/contractService';


interface ContractsPageProps {
  clients: Client[];
  settings: Settings;
  searchTerm: string;
}

const ContractsPage: React.FC<ContractsPageProps> = ({ clients, settings, searchTerm }) => {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const fetchContracts = async () => {
    setIsLoading(true);
    try {
      const data = await contractService.getContracts();
      setContracts(data);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchContracts();
  }, []);

  const filteredContracts = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return contracts.filter(c => {
      const client = clients.find(cl => cl.id === c.clientId);
      const clientName = client ? `${client.nom} ${client.prenom}`.toLowerCase() : '';
      return clientName.includes(term);
    });
  }, [contracts, clients, searchTerm]);

  const handleSave = async (data: Partial<Contract>) => {
    try {
      await contractService.createContract(data);
      fetchContracts();
      setIsModalOpen(false);
    } catch (e: any) {
      console.error('Erreur création contrat:', e);
      alert(`Erreur lors de la sauvegarde du contrat:\n${e?.message || e}`);
    }
  };

  const deleteContract = async (id: string) => {
    if (window.confirm('Supprimer ce contrat ?')) {
      await contractService.deleteContract(id);
      fetchContracts();
    }
  };

  const sendEmail = async (id: string) => {
    try {
      await contractService.sendContractEmail(id);
      alert('Email envoyé au client !');
    } catch (e: any) {
      alert(`Erreur: ${e.message}`);
    }
  };

  const generatePDF = (contract: Contract) => {
    const client = clients.find(c => c.id === contract.clientId);
    const clientName = client ? `${client.nom} ${client.prenom}` : 'Inconnu';
    const cin = client?.cin || '-';
    const dateStr = new Date(contract.date).toLocaleDateString('fr-TN');
    const dateArStr = new Date(contract.date).toLocaleDateString('ar-TN');
    const currency = settings.currencySymbol || 'DT';
    const company = settings.companyName || 'Frigo Inc.';
    const address = settings.companyAddress || '';
    const phone = settings.companyPhone || '';
    const fiscal = settings.fiscalId || '';
    const typeAr = contract.type === 'Location' ? 'إيجار' : 'إعارة صناديق';
    let periodeAr = contract.periode || '';
    if (periodeAr.startsWith('Du ') && periodeAr.includes(' au ')) {
      periodeAr = periodeAr.replace('Du ', 'من ').replace(' au ', ' إلى ');
    }
    const refId = contract.id.substring(0, 8).toUpperCase();
    const isSigned = !!contract.signature;
    const signedAtStr = contract.signedAt ? new Date(contract.signedAt).toLocaleString('fr-TN') : '';
    const signedAtArStr = contract.signedAt ? new Date(contract.signedAt).toLocaleString('ar-TN') : '';
    const statusBadgeFr = isSigned ? 'Signé électroniquement' : 'En attente de signature';
    const statusBadgeAr = isSigned ? 'موقّع إلكترونياً' : 'في انتظار التوقيع';
    const statusColor = isSigned ? 'badge-green' : 'badge-orange';
    const verifyUrl = `${window.location.origin}/sign/${contract.id}`;

    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8"/>
<title>Contrat ${refId}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Source+Sans+3:wght@400;600;700&display=swap');
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Source Sans 3',serif; color:#111; }
  .page { position:relative; width:210mm; height:297mm; padding:15mm 20mm; page-break-after:always; display:flex; flex-direction:column; overflow:hidden; }
  .doc-id { position:absolute; left:6mm; bottom:50%; transform:rotate(-90deg); transform-origin:left bottom; font-family:monospace; font-size:7pt; color:#a0aec0; letter-spacing:1px; white-space:nowrap; }
  .header { color:#1a4fa0; text-align:center; border-bottom:1px solid #e2e8f0; padding-bottom:8px; margin-bottom:12px; }
  .header h1 { font-size:16pt; letter-spacing:1px; margin-bottom:4px; text-transform:uppercase; font-weight:700; }
  .header .ref { font-size:8.5pt; color:#64748b; }
  .section { margin-bottom:10px; }
  .section-title { font-size:9.5pt; font-weight:700; color:#1a4fa0; text-transform:uppercase; letter-spacing:.5px; margin-bottom:6px; }
  .row { display:flex; gap:10px; }
  .col { flex:1; }
  .field { margin-bottom:3px; font-size:9pt; }
  .field span { font-weight:700; color:#111; font-size:9.5pt; }
  .clause { font-size:9pt; line-height:1.4; margin-bottom:4px; }
  .clause strong { font-weight:700; }
  .sign-area { display:flex; justify-content:space-between; margin-top:30px; }
  .sign-box { text-align:center; width:40%; }
  .sign-line { border-top:1px solid #333; margin-top:40px; padding-top:4px; font-size:9pt; }
  .badges { display:flex; gap:8px; margin-bottom:18px; }
  .badge { padding:4px 12px; border-radius:20px; font-size:9pt; font-weight:600; }
  .badge-blue { background:#dbeafe; color:#1e40af; }
  .badge-green { background:#dcfce7; color:#166534; }
  .badge-orange { background:#fff7ed; color:#9a3412; }
  .timestamp { margin-top:8px; padding:8px 12px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:4px; font-size:8.5pt; color:#475569; }
  .timestamp strong { color:#1e293b; }
  .legal-margin { position:absolute; right:6mm; top:50%; transform:rotate(-90deg); transform-origin:right top; font-size:7pt; color:#94a3b8; white-space:nowrap; }
  table.fin { width:100%; border-collapse:collapse; font-size:10pt; }
  table.fin td, table.fin th { border:1px solid #ccc; padding:6px 10px; }
  table.fin th { background:#f0f4ff; font-weight:700; }
  .watermark { position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); max-width:70%; max-height:70%; opacity:0.06; pointer-events:none; z-index:0; filter:grayscale(30%); }
  /* Arabic page */
  .page-ar { font-family:'Amiri',serif; direction:rtl; }
  .page-ar .section-title { text-align:right; }
  .page-ar .clause { text-align:right; }
  .page-ar .field { text-align:right; }
  @media print {
    @page { margin: 0; size: A4; }
    body { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
    .page { page-break-after:always; }
  }
</style>
</head>
<body>

<!-- ============ PAGE 1 : FRANÇAIS ============ -->
<div class="page">
  ${settings.companyLogo ? `<img src="${settings.companyLogo}" class="watermark" />` : ''}
  <div class="doc-id">DOC SIGN ID: ${contract.id}</div>
  <div style="flex: 1;">
    <div class="header">
      <h1>CONTRAT DE ${contract.type.toUpperCase()}</h1>
      <div class="ref">Réf : ${refId} &nbsp;|&nbsp; ${company} &nbsp;|&nbsp; Daté du ${dateStr}</div>
    </div>

  <div class="section">
    <div class="section-title">Les parties contractantes</div>
    <div class="row">
      <div class="col">
        <div class="field">Prestataire (Le Loueur) :</div>
        <div class="field"><span>${company}</span></div>
        <div class="field">Adresse : ${address}</div>
        <div class="field">Tél : ${phone}</div>
        ${fiscal ? `<div class="field">Matricule fiscal : ${fiscal}</div>` : ''}
      </div>
      <div class="col">
        <div class="field">Locataire (Le Client) :</div>
        <div class="field"><span>${clientName}</span></div>
        <div class="field">CIN : ${cin}</div>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Art. 1 – Objet du contrat</div>
    <p class="clause">Le présent contrat a pour objet la <strong>${contract.type.toLowerCase()}</strong> de <strong>${contract.nbCaisse} caisse(s) frigorifique(s)</strong> pour une durée convenue de <strong>${contract.periode}</strong>, conformément aux dispositions du Code des Obligations et des Contrats tunisien (COC), notamment les articles 729 et suivants relatifs au louage de choses.</p>
  </div>

  <div class="section">
    <div class="section-title">Art. 2 – Durée</div>
    <p class="clause">Le contrat prend effet à compter de la date de signature et pour une durée de <strong>${contract.periode}</strong>. À l'expiration de ce délai, le contrat prend fin de plein droit, sauf accord écrit des deux parties pour son renouvellement.</p>
  </div>

  <div class="section">
    <div class="section-title">Art. 3 – Conditions financières</div>
    <table class="fin">
      <tr><th>Désignation</th><th>Montant</th></tr>
      <tr><td>Caution (garantie remboursable)</td><td><strong>${Math.round(contract.caution || 0).toLocaleString('fr-FR')} ${currency}</strong></td></tr>
      <tr><td>Avance sur loyer</td><td><strong>${Math.round(contract.avance || 0).toLocaleString('fr-FR')} ${currency}</strong></td></tr>
    </table>
    <p class="clause" style="margin-top:8px;">La caution sera restituée au locataire dans un délai de 15 jours suivant la restitution des caisses en bon état, conformément à l'article 830 du COC.</p>
  </div>

  <div class="section">
    <div class="section-title">Art. 4 – Obligations du locataire</div>
    <p class="clause">Le locataire s'engage à : (1) utiliser les caisses conformément à leur destination, (2) les restituer en bon état à la fin du contrat, (3) signaler immédiatement tout sinistre ou dommage au prestataire. Toute dégradation sera à la charge du locataire (Art. 806 COC).</p>
  </div>

  <div class="section">
    <div class="section-title">Art. 5 – Résiliation</div>
    <p class="clause">En cas de manquement grave de l'une ou l'autre partie, le contrat peut être résilié avec un préavis de 15 jours par lettre recommandée. En cas de résiliation fautive du locataire, la caution reste acquise au prestataire à titre de dommages et intérêts.</p>
  </div>

  <div class="section">
    <div class="section-title">Art. 6 – Loi applicable et juridiction</div>
    <p class="clause">Le présent contrat est soumis au droit tunisien. Tout litige sera soumis à la juridiction compétente du Tribunal de Première Instance de Tunis, sauf accord amiable préalable des parties.</p>
  </div>

  </div> <!-- End content wrapper -->

  <div>
    <div class="sign-area">
      <div class="sign-box">
        ${settings.companySignature ? `<img src="${settings.companySignature}" style="max-height:50px;"/>` : '<div style="height:50px;"></div>'}
        <div class="sign-line">Le Prestataire<br/><small>${company}</small></div>
      </div>
      <div class="sign-box">
        ${isSigned ? `<img src="${contract.signature}" style="max-height:50px;"/>` : '<div style="height:50px;"></div>'}
        <div class="sign-line">Le Locataire<br/><small>${clientName}</small></div>
      </div>
    </div>

    ${isSigned ? `
    <div class="timestamp" style="display:flex; align-items:center; gap:15px;">
      <img src="https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent(verifyUrl)}" style="width:70px;height:70px;" />
      <div>
        ✅ <strong>Signature électronique validée</strong><br/>
        Horodatage : ${signedAtStr}<br/>
        Signataire : ${clientName} (CIN: ${cin})<br/>
        Référence : ${refId}
      </div>
    </div>
    ` : `
    <div class="timestamp" style="display:flex; align-items:center; gap:15px;">
      <img src="https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent(verifyUrl)}" style="width:70px;height:70px;" />
      <div>
        ⏳ <strong>En attente de signature électronique</strong><br/>
        Scannez ce QR Code avec votre mobile pour valider la signature.<br/>
        Le Locataire : ${clientName} (CIN: ${cin})
      </div>
    </div>
    `}
  </div>
  <div class="legal-margin">Document établi conformément au Code des Obligations et des Contrats tunisien (COC) – Loi n° 2017-08 et textes connexes.</div>
</div>

<!-- ============ PAGE 2 : ARABE ============ -->
<div class="page page-ar">
  ${settings.companyLogo ? `<img src="${settings.companyLogo}" class="watermark" />` : ''}
  <div class="doc-id">DOC SIGN ID: ${contract.id}</div>
  <div style="flex: 1;">
    <div class="header">
      <h1>عقد ${typeAr}</h1>
      <div class="ref">المرجع : ${refId} &nbsp;|&nbsp; ${company} &nbsp;|&nbsp; بتاريخ ${dateArStr}</div>
    </div>

  <div class="section">
    <div class="section-title">الأطراف المتعاقدة</div>
    <div class="row" style="flex-direction:row-reverse;">
      <div class="col">
        <div class="field">المزوّد (المؤجّر) :</div>
        <div class="field"><span>${company}</span></div>
        <div class="field">العنوان : ${address}</div>
        <div class="field">الهاتف : ${phone}</div>
        ${fiscal ? `<div class="field">المعرّف الجبائي : ${fiscal}</div>` : ''}
      </div>
      <div class="col">
        <div class="field">المستأجر (الحريف) :</div>
        <div class="field"><span>${clientName}</span></div>
        <div class="field">رقم بطاقة الهوية : ${cin}</div>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">الفصل 1 – موضوع العقد</div>
    <p class="clause">يتعلق هذا العقد بـ<strong>${typeAr}</strong> لـ<strong>${contract.nbCaisse} صندوق (صناديق) تبريد</strong> لمدة <strong>${periodeAr}</strong>، وذلك وفقاً لأحكام مجلة الالتزامات والعقود التونسية (م.إ.ع)، ولا سيما الفصول 729 وما يليها المتعلقة بكراء الأشياء.</p>
  </div>

  <div class="section">
    <div class="section-title">الفصل 2 – المدة</div>
    <p class="clause">يسري العقد من تاريخ التوقيع ولمدة <strong>${periodeAr}</strong>. عند انتهاء هذه المدة، يُعدّ العقد منتهياً بقوة القانون، ما لم يتفق الطرفان كتابةً على تجديده.</p>
  </div>

  <div class="section">
    <div class="section-title">الفصل 3 – الشروط المالية</div>
    <table class="fin" style="direction:rtl;">
      <tr><th>البيان</th><th>المبلغ</th></tr>
      <tr><td>الكفالة (ضمان قابل للاسترداد)</td><td><strong>${Math.round(contract.caution || 0).toLocaleString('fr-FR')} ${currency}</strong></td></tr>
      <tr><td>دفعة مسبقة على الكراء</td><td><strong>${Math.round(contract.avance || 0).toLocaleString('fr-FR')} ${currency}</strong></td></tr>
    </table>
    <p class="clause" style="margin-top:8px;">تُردّ الكفالة للمستأجر في أجل 15 يوماً من تاريخ إرجاع الصناديق في حالة جيدة، وفق الفصل 830 من م.إ.ع.</p>
  </div>

  <div class="section">
    <div class="section-title">الفصل 4 – التزامات المستأجر</div>
    <p class="clause">يلتزم المستأجر بـ: (1) استعمال الصناديق وفق غرضها المحدد، (2) إرجاعها في حالة جيدة عند انتهاء العقد، (3) الإعلام الفوري للمزوّد عن أي عطب أو تلف. يتحمّل المستأجر كل تلف ناجم عن إهماله (الفصل 806 م.إ.ع).</p>
  </div>

  <div class="section">
    <div class="section-title">الفصل 5 – الفسخ</div>
    <p class="clause">في حالة إخلال أحد الطرفين بالتزاماته، يمكن فسخ العقد بعد إشعار مسبق بـ15 يوماً برسالة مضمونة الوصول. في حال كان الفسخ بخطأ المستأجر، تبقى الكفالة من حق المزوّد كتعويض.</p>
  </div>

  <div class="section">
    <div class="section-title">الفصل 6 – القانون المطبق والمحكمة المختصة</div>
    <p class="clause">يخضع هذا العقد للتشريع التونسي. وعند الخلاف، تُحال النزاعات إلى المحكمة الابتدائية المختصة بتونس، ما لم يحصل تسوية ودية بين الطرفين.</p>
  </div>

  </div> <!-- End content wrapper -->

  <div>
    <div class="sign-area" style="flex-direction:row-reverse;">
      <div class="sign-box">
        ${settings.companySignature ? `<img src="${settings.companySignature}" style="max-height:50px;"/>` : '<div style="height:50px;"></div>'}
        <div class="sign-line">المزوّد<br/><small>${company}</small></div>
      </div>
      <div class="sign-box">
        ${isSigned ? `<img src="${contract.signature}" style="max-height:50px;"/>` : '<div style="height:50px;"></div>'}
        <div class="sign-line">المستأجر<br/><small>${clientName}</small></div>
      </div>
    </div>

    ${isSigned ? `
    <div class="timestamp" style="display:flex; align-items:center; justify-content:flex-end; gap:15px; text-align:right; flex-direction:row-reverse;">
      <img src="https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent(verifyUrl)}" style="width:70px;height:70px;" />
      <div>
        ✅ <strong>توقيع إلكتروني معتمد</strong><br/>
        التاريخ والساعة : ${signedAtArStr}<br/>
        الموقّع : ${clientName} (هوية: ${cin})<br/>
        المرجع : ${refId}
      </div>
    </div>
    ` : `
    <div class="timestamp" style="display:flex; align-items:center; justify-content:flex-end; gap:15px; text-align:right; flex-direction:row-reverse;">
      <img src="https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent(verifyUrl)}" style="width:70px;height:70px;" />
      <div>
        ⏳ <strong>في انتظار التوقيع الإلكتروني</strong><br/>
        امسح هذا الرمز بواسطة هاتفك الجوال لإتمام التوقيع.<br/>
        المستأجر : ${clientName} (هوية: ${cin})
      </div>
    </div>
    `}
  </div>
  <div class="legal-margin">وثيقة محررة وفق أحكام مجلة الالتزامات والعقود التونسية – القانون عدد 2017-08 والنصوص ذات الصلة.</div>
</div>

<script>window.onload = function(){ window.print(); }<\/script>
</body></html>`;

    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Gestion des Contrats</h1>
        <button
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors"
        >
          Nouveau Contrat
        </button>
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-md border border-gray-200">
        {isLoading ? (
          <p className="p-10 text-center">Chargement...</p>
        ) : filteredContracts.length > 0 ? (
          <ul className="divide-y divide-gray-200">
            {filteredContracts.map(c => {
               const client = clients.find(cl => cl.id === c.clientId);
               
               let displayTypeClass = 'bg-blue-100 text-blue-800';
               if (c.type === 'Prêt de caisses') {
                 displayTypeClass = 'bg-orange-100 text-orange-800';
               }

               return (
                <li key={c.id} className="p-4 hover:bg-gray-50 flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${displayTypeClass}`}>
                        {c.type}
                      </span>
                      <p className="text-sm font-semibold text-gray-700">
                        {client ? `${client.nom} ${client.prenom}` : 'Inconnu'}
                      </p>
                      <span className="text-xs text-gray-400 font-mono">#{c.id.substring(0, 8)}</span>
                    </div>
                    <div className="mt-2 text-sm text-gray-500 grid grid-cols-2 gap-x-4">
                      <p>Caisses: <span className="text-gray-900 font-medium">{c.nbCaisse}</span></p>
                      <p>Caution: <span className="text-gray-900 font-medium">{Math.round(c.caution || 0).toLocaleString('fr-FR')} {settings.currencySymbol}</span></p>
                      <p>Période: <span className="text-gray-900 font-medium">{c.periode}</span></p>
                      <p>Statut: <span className={`font-bold ${c.status === 'Actif' ? 'text-green-600' : 'text-red-600'}`}>{c.status}</span></p>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <button onClick={() => sendEmail(c.id)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-full" title="Envoyer par mail">
                       <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
                       </svg>
                    </button>
                    <button onClick={() => generatePDF(c)} className="p-2 text-primary-600 hover:bg-primary-50 rounded-full" title="Imprimer Contrat">
                       <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.89l-2.1 2.1m0 0l-2.1-2.1m2.1 2.1V6.14M16.5 18.75h-9M16.5 5.25h-9m-9 13.5h9m-9 0V21m0 0h12" />
                       </svg>
                    </button>
                    <button onClick={() => deleteContract(c.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-full" title="Supprimer">
                       <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.34 9m-4.72 0-.34-9m11.36 0-.332-1.59a2.25 2.25 0 0 0-2.212-1.785H7.304a2.25 2.25 0 0 0-2.212 1.785L4.66 9m14.68 0H4.66m5.34-4.5h4m-4 0a1.125 1.125 0 0 1 1.125-1.125h1.75a1.125 1.125 0 0 1 1.125 1.125m-4 0h4" />
                       </svg>
                    </button>
                  </div>
                </li>
               );
            })}
          </ul>
        ) : (
          <div className="p-10 text-center text-gray-500">Aucun contrat trouvé.</div>
        )}
      </div>

      <AddContractModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSave={handleSave} 
        clients={clients} 
      />
    </div>
  );
};

export default ContractsPage;
