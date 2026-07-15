
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import QRCode from 'qrcode';
import { Movement, Client, MovementType, Settings, Product, Room, MovementSale, Location, MovementEmptyCratesOut, MovementLocationOut } from '../types';

const getDocumentTitle = (type: MovementType): string => {
    switch (type) {
        case MovementType.Sale: return "Facture de Vente";
        case MovementType.LocationIn: return "Bon d'Entrée de Location";
        case MovementType.LocationOut: return "Facture de Fin de Location";
        case MovementType.EmptyCratesOut: return "Bon de Sortie de Caisses Vides";
        case MovementType.EmptyCratesReturn: return "Bon de Retour de Caisses Vides";
        default: return "Document de Mouvement";
    }
};

const getFileName = (title: string, id: string): string => {
    const sanitizedTitle = title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    return `${sanitizedTitle}_${id}.pdf`;
};

export const pdfService = {
    generateMovementPdf: async (
        movement: Movement,
        client: Client,
        product: Product | undefined,
        room: Room | undefined,
        settings: Settings,
        locations: Location[]
    ): Promise<{ dataUri: string, fileName: string }> => {
        const doc = new jsPDF();
        const margin = 15;
        let y = 20;

        try {
            if (settings.companyLogo && settings.companyLogo.length > 50) { // Basic length check
                doc.addImage(settings.companyLogo, 'PNG', margin, 15, 40, 15);
            } else {
                doc.setFontSize(22); doc.setFont("helvetica", "bold"); doc.text(settings.companyName, margin, y);
            }
        } catch (e) {
            console.warn("Erreur lors de l'ajout du logo, utilisation du nom de l'entreprise à la place", e);
            doc.setFontSize(22); doc.setFont("helvetica", "bold"); doc.text(settings.companyName, margin, y);
        }
        y += 20;

        doc.setFontSize(10);
        doc.text(settings.companyAddress || '', doc.internal.pageSize.width - margin, 20, { align: 'right' });
        doc.text(`Tél: ${settings.companyPhone || 'N/A'}`, doc.internal.pageSize.width - margin, 25, { align: 'right' });
        doc.text(`Matricule Fiscal: ${settings.fiscalId || 'N/A'}`, doc.internal.pageSize.width - margin, 30, { align: 'right' });

        const title = getDocumentTitle(movement.type);
        doc.setFontSize(16); doc.setFont("helvetica", "bold"); doc.text(title, margin, y); y += 15;
        doc.setFontSize(10);
        doc.text(`Date: ${new Date(movement.date).toLocaleDateString('fr-FR')}`, margin, y);
        doc.text(`ID Mouvement: ${movement.id}`, doc.internal.pageSize.width - margin, y, { align: 'right' }); y += 10;

        doc.line(margin, y, doc.internal.pageSize.width - margin, y); y += 10;
        doc.setFont("helvetica", "bold"); doc.text("Client:", margin, y); y += 6;
        doc.setFont("helvetica", "normal");
        doc.text(`${client.nom} ${client.prenom} (CIN: ${client.cin})`, margin, y); y += 15;

        // Table
        try {
            if (movement.type === MovementType.Sale) {
                const sale = movement as MovementSale;
                const headers = [["Produit", "Poids Net", "Prix Unit.", "Total HT", `TVA (${settings.taxRate}%)`, "Total TTC"]];
                const data = [[
                    product?.nom || 'Produit Supprimé',
                    `${sale.poidsNet.toFixed(2)} kg`,
                    `${sale.prixUnitaire.toFixed(2)} ${settings.currencySymbol}`,
                    `${sale.montantTotal.toFixed(2)} ${settings.currencySymbol}`,
                    `${sale.taxe?.toFixed(2)} ${settings.currencySymbol}`,
                    `${((sale.montantTotal || 0) + (sale.taxe || 0)).toFixed(2)} ${settings.currencySymbol}`
                ]];
                autoTable(doc, { startY: y, head: headers, body: data, theme: 'grid' });
            } else if (movement.type === MovementType.LocationOut) {
                const locOut = movement as MovementLocationOut;
                const headers = [["Description", "Quantité", "Loyer", "Caution Appliquée"]];
                const data = [[
                    `Retour de ${locOut.nbCaisse} caisses en location`,
                    locOut.nbCaisse,
                    `${locOut.loyer?.toFixed(2) || '0.00'} ${settings.currencySymbol}`,
                    locOut.cautionAppliquee ? 'Oui' : 'Non'
                ]];
                autoTable(doc, { startY: y, head: headers, body: data, theme: 'grid' });
            } else if (movement.type === MovementType.EmptyCratesOut) {
                const crateOut = movement as MovementEmptyCratesOut;
                const headers = [["Description", "Quantité", "Caution"]];
                const data = [[
                    "Sortie de caisses vides",
                    crateOut.nbCaisse,
                    `${crateOut.caution?.toFixed(2)} ${settings.currencySymbol}`
                ]];
                autoTable(doc, { startY: y, head: headers, body: data, theme: 'grid' });
            } else {
                let description = 'N/A', quantity = 'N/A';
                if (movement.type === MovementType.LocationIn) {
                    description = `Location de ${product?.nom || 'Produit Supprimé'} vers ${room?.nom || 'Chambre Supprimée'}`;
                    quantity = movement.nbCaisse.toString();
                } else if (movement.type === MovementType.EmptyCratesReturn) {
                    description = "Retour de caisses vides";
                    quantity = movement.nbCaisse.toString();
                }
                autoTable(doc, { startY: y, head: [["Description", "Quantité"]], body: [[description, quantity]], theme: 'grid' });
            }
        } catch (e) {
            console.error("Erreur lors de la génération du tableau autotable", e);
            doc.text("Erreur lors de la génération du tableau", margin, y + 10);
        }

        const finalY = (doc as any).lastAutoTable?.finalY || y;
        const qrCodeY = finalY + 15 > doc.internal.pageSize.height - 45 ? doc.internal.pageSize.height - 45 : finalY + 15;

        // QR Code
        try {
            const qrCodeDataUrl = await QRCode.toDataURL(`Mouvement ID: ${movement.id}`);
            doc.addImage(qrCodeDataUrl, 'JPEG', margin, qrCodeY, 30, 30);
        } catch (e) {
            console.warn("Impossible de générer le QR Code", e);
        }

        const dataUri = doc.output('datauristring');
        const fileName = getFileName(title, movement.id);

        return { dataUri, fileName };
    },

    generateContractPdf: async (
        contract: any, // ContractData from ClientSignPage or Contract from types
        settings: Settings
    ): Promise<{ dataUri: string, fileName: string }> => {
        const doc = new jsPDF();
        const margin = 20;
        let y = 20;

        // Branding
        try {
            if (settings.companyLogo && settings.companyLogo.length > 50) {
                doc.addImage(settings.companyLogo, 'PNG', margin, 15, 35, 12);
            } else {
                doc.setFontSize(20); doc.setFont("helvetica", "bold"); doc.text(settings.companyName, margin, y);
            }
        } catch (e) {
            doc.setFontSize(20); doc.setFont("helvetica", "bold"); doc.text(settings.companyName, margin, y);
        }
        
        doc.setFontSize(9); doc.setFont("helvetica", "normal");
        const headerInfo = [
            settings.companyAddress,
            `Tél: ${settings.companyPhone}`,
            `Matricul Fiscal: ${settings.fiscalId}`
        ].filter(Boolean);
        
        headerInfo.forEach((text, i) => {
            doc.text(text!, doc.internal.pageSize.width - margin, 15 + (i * 5), { align: 'right' });
        });

        y += 20;
        const refId = contract.id.substring(0, 8).toUpperCase();
        
        // Title
        doc.setFontSize(16); doc.setFont("helvetica", "bold");
        doc.text(`CONTRAT DE ${contract.type.toUpperCase()}`, doc.internal.pageSize.width / 2, y, { align: 'center' });
        y += 10;
        doc.setFontSize(10); doc.setFont("helvetica", "normal");
        doc.text(`Référence: #${refId}  |  Date: ${new Date(contract.date).toLocaleDateString('fr-TN')}`, doc.internal.pageSize.width / 2, y, { align: 'center' });
        y += 15;

        // Parties
        doc.setFont("helvetica", "bold"); doc.text("1. LES PARTIES", margin, y); y += 6;
        doc.setFont("helvetica", "normal");
        doc.text(`Loueur: ${settings.companyName}`, margin, y);
        doc.text(`Locataire: ${contract.clientName || contract.prenom + ' ' + contract.nom || 'Client'} (ID: ${contract.clientId.substring(0,8)})`, doc.internal.pageSize.width / 2, y);
        y += 12;

        // Details Table
        const currency = settings.currencySymbol || 'DT';
        autoTable(doc, {
            startY: y,
            head: [['Désignation', 'Détails']],
            body: [
                ['Type de contrat', contract.type],
                ['Nombre de caisses', contract.nbCaisse.toString()],
                ['Période', contract.periode],
                ['Caution', `${contract.caution} ${currency}`],
                ['Avance', `${contract.avance} ${currency}`]
            ],
            theme: 'striped',
            headStyles: { fillColor: [200, 200, 200], textColor: 50 }
        });
        
        y = (doc as any).lastAutoTable.finalY + 15;

        // Terms
        doc.setFont("helvetica", "bold"); doc.text("2. CONDITIONS GÉNÉRALES", margin, y); y += 7;
        doc.setFontSize(8); doc.setFont("helvetica", "normal");
        const terms = [
            "• Le présent contrat est régi par le Code des Obligations et des Contrats tunisien (COC).",
            "• Le locataire s'engage à restituer le matériel en bon état à la fin de la période convenue.",
            "• La caution est restituée après vérification de l'état des caisses.",
            "• Tout litige sera porté devant les tribunaux compétents de Tunis."
        ];
        terms.forEach(term => {
            doc.text(term, margin, y); y += 5;
        });

        y += 10;

        // Signatures
        const signWidth = 60;
        doc.setFontSize(10); doc.setFont("helvetica", "bold");
        doc.text("Le Loueur", margin + (signWidth/2), y, { align: 'center' });
        doc.text("Le Locataire", doc.internal.pageSize.width - margin - (signWidth/2), y, { align: 'center' });
        y += 5;

        if (settings.companySignature) {
            try { doc.addImage(settings.companySignature, 'PNG', margin + 5, y, 50, 20); } catch(e){}
        }
        
        if (contract.signature) {
            try { doc.addImage(contract.signature, 'PNG', doc.internal.pageSize.width - margin - 55, y, 50, 20); } catch(e){}
        }

        y += 25;
        doc.setFontSize(7); doc.setFont("helvetica", "italic");
        doc.text(`Document certifié électroniquement le ${new Date().toLocaleString('fr-TN')}. Réf Traçabilité: ${contract.id}`, doc.internal.pageSize.width / 2, y, { align: 'center' });

        const contractDataUri = doc.output('datauristring');
        return { dataUri: contractDataUri, fileName: `Contrat_${refId}.pdf` };
    }
};
