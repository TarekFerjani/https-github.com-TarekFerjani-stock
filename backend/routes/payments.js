const express = require('express');
const { v4: uuidv4 } = require('uuid');
const pool = require('../db');
const router = express.Router();

// Helper: map reglement
function mapReglement(row) {
    if (!row) return null;
    return {
        id:            row.id,
        date:          row.date,
        clientId:      row.clientid ?? row.clientId,
        amount:        Number(row.amount ?? row.montant ?? 0),
        paymentMethod: row.paymentmethod ?? row.paymentMethod,
        reference:     row.reference ?? '',
        invoiceId:     row.invoiceid ?? row.invoiceId ?? null,
        notes:         row.notes ?? ''
    };
}

// Helper: map avance
function mapAvance(row) {
    if (!row) return null;
    return {
        id:            row.id,
        date:          row.date,
        clientId:      row.clientid ?? row.clientId,
        amount:        Number(row.amount ?? row.montant ?? 0),
        paymentMethod: row.paymentmethod ?? row.paymentMethod,
        contractId:    row.contractid ?? row.contractId ?? null,
        notes:         row.notes ?? ''
    };
}

// GET all reglements
router.get('/reglements', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM reglements ORDER BY date DESC');
        res.json(result.rows.map(mapReglement));
    } catch (error) {
        console.error('Error fetching reglements:', error);
        res.status(500).json({ message: error.message });
    }
});

// POST a new reglement
router.post('/reglements', async (req, res) => {
    const { clientId, amount, paymentMethod, reference, invoiceId, notes } = req.body;
    
    if (!clientId || !amount || !paymentMethod) {
        return res.status(400).json({ message: 'Client, montant et mode de règlement sont requis.' });
    }

    const id = uuidv4();
    const date = new Date().toISOString();

    try {
        // If an invoice is associated, check total amount and ensure payment does not exceed the remaining balance
        if (invoiceId) {
            let totalAmount = 0;
            const invoiceRes = await pool.query('SELECT montanttotal FROM invoices WHERE id = $1', [invoiceId]);
            if (invoiceRes.rows.length > 0) {
                const inv = invoiceRes.rows[0];
                totalAmount = Number(inv.montantTotal ?? inv.montanttotal ?? 0);
            } else {
                const movementRes = await pool.query('SELECT montanttotal, loyer, caution FROM movements WHERE id = $1', [invoiceId]);
                if (movementRes.rows.length > 0) {
                    const mov = movementRes.rows[0];
                    totalAmount = Number(mov.montantTotal ?? mov.montanttotal ?? mov.loyer ?? mov.caution ?? 0);
                }
            }

            // Fetch all reglements for this invoice
            const reglementsRes = await pool.query('SELECT amount FROM reglements WHERE invoiceid = $1', [invoiceId]);
            let totalPaid = 0;
            for (const r of reglementsRes.rows) {
                totalPaid += Number(r.amount ?? 0);
            }

            const remaining = Math.max(0, totalAmount - totalPaid);
            if (Number(amount) > remaining) {
                return res.status(400).json({ message: `Sécurité de paiement : Le montant du paiement (${amount}) dépasse le reste à payer de cette facture (${remaining.toFixed(2)}).` });
            }
        }

        await pool.query(
            'INSERT INTO reglements (id, date, clientid, amount, paymentmethod, reference, invoiceid, notes) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
            [id, date, clientId, amount, paymentMethod, reference || '', invoiceId || null, notes || '']
        );

        // If an invoice is associated, check total amount and mark as paid only if fully paid
        if (invoiceId) {
            let totalAmount = 0;
            const invoiceRes = await pool.query('SELECT montanttotal FROM invoices WHERE id = $1', [invoiceId]);
            if (invoiceRes.rows.length > 0) {
                const inv = invoiceRes.rows[0];
                totalAmount = Number(inv.montantTotal ?? inv.montanttotal ?? 0);
            } else {
                const movementRes = await pool.query('SELECT montanttotal, loyer, caution FROM movements WHERE id = $1', [invoiceId]);
                if (movementRes.rows.length > 0) {
                    const mov = movementRes.rows[0];
                    totalAmount = Number(mov.montantTotal ?? mov.montanttotal ?? mov.loyer ?? mov.caution ?? 0);
                }
            }

            // Fetch all reglements for this invoice
            const reglementsRes = await pool.query('SELECT amount FROM reglements WHERE invoiceid = $1', [invoiceId]);
            let totalPaid = 0;
            for (const r of reglementsRes.rows) {
                totalPaid += Number(r.amount ?? 0);
            }

            const newStatus = (totalPaid >= totalAmount) ? 'Payé' : 'En attente';

            await pool.query(
                "UPDATE movements SET paymentStatus = $1 WHERE id = $2",
                [newStatus, invoiceId]
            );
            await pool.query(
                "UPDATE invoices SET paymentStatus = $1 WHERE id = $2",
                [newStatus, invoiceId]
            );
        }

        res.status(201).json(mapReglement({ id, date, clientid: clientId, amount, paymentmethod: paymentMethod, reference, invoiceid: invoiceId, notes }));
    } catch (error) {
        console.error('Error adding reglement:', error);
        res.status(500).json({ message: error.message });
    }
});

// DELETE a reglement (DISABLED)
router.delete('/reglements/:id', async (req, res) => {
    return res.status(403).json({ message: "La suppression d'un règlement n'est pas autorisée." });
});


// GET all avances
router.get('/avances', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM avances ORDER BY date DESC');
        res.json(result.rows.map(mapAvance));
    } catch (error) {
        console.error('Error fetching avances:', error);
        res.status(500).json({ message: error.message });
    }
});

// POST a new avance
router.post('/avances', async (req, res) => {
    const { clientId, amount, paymentMethod, contractId, notes } = req.body;

    if (!clientId || !amount || !paymentMethod) {
        return res.status(400).json({ message: 'Client, montant et mode de paiement sont requis.' });
    }

    const id = uuidv4();
    const date = new Date().toISOString();

    try {
        await pool.query(
            'INSERT INTO avances (id, date, clientid, amount, paymentmethod, contractid, notes) VALUES ($1, $2, $3, $4, $5, $6, $7)',
            [id, date, clientId, amount, paymentMethod, contractId || null, notes || '']
        );

        // Optional: If associated with a contract, update contract's advance total
        if (contractId) {
            // Get current contract
            const contractRes = await pool.query('SELECT * FROM contracts WHERE id = $1', [contractId]);
            if (contractRes.rows.length > 0) {
                const currentAvance = Number(contractRes.rows[0].avance || 0);
                const newAvance = currentAvance + Number(amount);
                await pool.query(
                    'UPDATE contracts SET avance = $1 WHERE id = $2',
                    [newAvance, contractId]
                );
            }
        }

        res.status(201).json(mapAvance({ id, date, clientid: clientId, amount, paymentmethod: paymentMethod, contractid: contractId, notes }));
    } catch (error) {
        console.error('Error adding avance:', error);
        res.status(500).json({ message: error.message });
    }
});

// DELETE an avance (DISABLED)
router.delete('/avances/:id', async (req, res) => {
    return res.status(403).json({ message: "La suppression d'une avance n'est pas autorisée." });
});

// POST /api/payments/transfer-caution
router.post('/transfer-caution', async (req, res) => {
    const { clientId, amount, contractId, invoiceId, notes } = req.body;
    
    if (!clientId || !amount || Number(amount) <= 0) {
        return res.status(400).json({ message: 'Client and valid amount are required.' });
    }
    
    try {
        await pool.query('BEGIN');
        
        // 1. Calculate the actual paid caution for empty crates for this client
        let checkInvoiceSql = `
            SELECT r.id, r.amount, r.invoiceid FROM reglements r 
            LEFT JOIN movements m ON r.invoiceid = m.id 
            WHERE r.clientid = $1 AND (m.type = 'Caisses vides' OR r.notes LIKE '%Dépôt de caution caisses vides%')
        `;
        let params = [clientId];
        const reglementsRes = await pool.query(checkInvoiceSql, params);
        
        let totalPaidCaution = 0;
        for (const r of reglementsRes.rows) {
            totalPaidCaution += Number(r.amount);
        }
        
        if (Number(amount) > totalPaidCaution) {
            await pool.query('ROLLBACK');
            return res.status(400).json({ message: `Le client n'a pas assez de caution payée disponible (${totalPaidCaution} DT) à transférer.` });
        }
        
        const transferRegId = uuidv4();
        const date = new Date().toISOString();
        const transferNotes = notes || `Transfert de caution vers avance de location`;
        
        // Find an invoiceId to associate this negative payment to, if not explicitly provided
        let targetInvoiceId = invoiceId;
        if (!targetInvoiceId && reglementsRes.rows.length > 0) {
            // Find first reglement that has a valid invoiceId
            const firstWithInvoice = reglementsRes.rows.find(r => r.invoiceid);
            if (firstWithInvoice) {
                targetInvoiceId = firstWithInvoice.invoiceid;
            }
        }
        
        // Add a negative règlement to adjust the paid caution
        await pool.query(
            'INSERT INTO reglements (id, date, clientid, amount, paymentmethod, reference, invoiceid, notes) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
            [transferRegId, date, clientId, -Number(amount), 'Espèces', 'TRANSFERT', targetInvoiceId || null, transferNotes]
        );
        
        // If an invoice was targeted, re-calculate and update its payment status
        if (targetInvoiceId) {
            let totalAmount = 0;
            const invoiceRes = await pool.query('SELECT montanttotal FROM invoices WHERE id = $1', [targetInvoiceId]);
            if (invoiceRes.rows.length > 0) {
                totalAmount = Number(invoiceRes.rows[0].montantTotal ?? invoiceRes.rows[0].montanttotal ?? 0);
            }
            
            const regsRes = await pool.query('SELECT amount FROM reglements WHERE invoiceid = $1', [targetInvoiceId]);
            let totalPaid = 0;
            for (const r of regsRes.rows) {
                totalPaid += Number(r.amount);
            }
            
            const status = (totalPaid >= totalAmount) ? 'Payé' : 'En attente';
            await pool.query('UPDATE invoices SET paymentstatus = $1 WHERE id = $2', [status, targetInvoiceId]);
            await pool.query('UPDATE movements SET paymentstatus = $1 WHERE id = $2', [status, targetInvoiceId]);
        }
        
        // 4. Create a new record in the avances table
        const avanceId = uuidv4();
        await pool.query(
            'INSERT INTO avances (id, date, clientid, amount, paymentmethod, contractid, notes) VALUES ($1, $2, $3, $4, $5, $6, $7)',
            [avanceId, date, clientId, Number(amount), 'Espèces', contractId || null, `Transfert de caution (Réf: ${targetInvoiceId ? targetInvoiceId.substring(0,8).toUpperCase() : ''})`]
        );
        
        // 5. If associated with a contract, update contract's advance total
        if (contractId) {
            const contractRes = await pool.query('SELECT * FROM contracts WHERE id = $1', [contractId]);
            if (contractRes.rows.length > 0) {
                const currentAvance = Number(contractRes.rows[0].avance || 0);
                const newAvance = currentAvance + Number(amount);
                await pool.query(
                    'UPDATE contracts SET avance = $1 WHERE id = $2',
                    [newAvance, contractId]
                );
            }
        }
        
        await pool.query('COMMIT');
        res.json({ success: true, message: 'Transfert de caution effectué avec succès.' });
    } catch (error) {
        await pool.query('ROLLBACK');
        console.error('Error transferring caution:', error);
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
