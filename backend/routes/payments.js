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
        await pool.query(
            'INSERT INTO reglements (id, date, clientid, amount, paymentmethod, reference, invoiceid, notes) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
            [id, date, clientId, amount, paymentMethod, reference || '', invoiceId || null, notes || '']
        );

        // If an invoice is associated, check total amount and mark as paid only if fully paid
        if (invoiceId) {
            let totalAmount = 0;
            const invoiceRes = await pool.query('SELECT montanttotal FROM invoices WHERE id = $1', [invoiceId]);
            if (invoiceRes.rows.length > 0) {
                totalAmount = Number(invoiceRes.rows[0].montanttotal ?? 0);
            } else {
                const movementRes = await pool.query('SELECT montanttotal, loyer, caution FROM movements WHERE id = $1', [invoiceId]);
                if (movementRes.rows.length > 0) {
                    const mov = movementRes.rows[0];
                    totalAmount = Number(mov.montanttotal ?? mov.loyer ?? mov.caution ?? 0);
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

// DELETE a reglement
router.delete('/reglements/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const regResult = await pool.query('SELECT * FROM reglements WHERE id = $1', [id]);
        const reg = regResult.rows[0];
        
        await pool.query('DELETE FROM reglements WHERE id = $1', [id]);

        if (reg && (reg.invoiceid || reg.invoiceId)) {
            const invId = reg.invoiceid || reg.invoiceId;

            // Recalculate status of the invoice/movement
            let totalAmount = 0;
            const invoiceRes = await pool.query('SELECT montanttotal FROM invoices WHERE id = $1', [invId]);
            if (invoiceRes.rows.length > 0) {
                totalAmount = Number(invoiceRes.rows[0].montanttotal ?? 0);
            } else {
                const movementRes = await pool.query('SELECT montanttotal, loyer, caution FROM movements WHERE id = $1', [invId]);
                if (movementRes.rows.length > 0) {
                    const mov = movementRes.rows[0];
                    totalAmount = Number(mov.montanttotal ?? mov.loyer ?? mov.caution ?? 0);
                }
            }

            const reglementsRes = await pool.query('SELECT amount FROM reglements WHERE invoiceid = $1', [invId]);
            let totalPaid = 0;
            for (const r of reglementsRes.rows) {
                totalPaid += Number(r.amount ?? 0);
            }

            const newStatus = (totalPaid >= totalAmount) ? 'Payé' : 'En attente';

            await pool.query("UPDATE movements SET paymentStatus = $1 WHERE id = $2", [newStatus, invId]);
            await pool.query("UPDATE invoices SET paymentStatus = $1 WHERE id = $2", [newStatus, invId]);
        }

        res.json({ message: 'Règlement supprimé avec succès.' });
    } catch (error) {
        console.error('Error deleting reglement:', error);
        res.status(500).json({ message: error.message });
    }
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

// DELETE an avance
router.delete('/avances/:id', async (req, res) => {
    const { id } = req.params;
    try {
        // Retrieve the advance to adjust the contract if needed
        const avanceRes = await pool.query('SELECT * FROM avances WHERE id = $1', [id]);
        const avance = avanceRes.rows[0];

        if (avance) {
            const contractId = avance.contractid || avance.contractId;
            const amount = Number(avance.amount ?? avance.montant ?? 0);
            
            if (contractId) {
                const contractRes = await pool.query('SELECT * FROM contracts WHERE id = $1', [contractId]);
                if (contractRes.rows.length > 0) {
                    const currentAvance = Number(contractRes.rows[0].avance || 0);
                    const newAvance = Math.max(0, currentAvance - amount);
                    await pool.query(
                        'UPDATE contracts SET avance = $1 WHERE id = $2',
                        [newAvance, contractId]
                    );
                }
            }
        }

        await pool.query('DELETE FROM avances WHERE id = $1', [id]);
        res.json({ message: 'Avance supprimée avec succès.' });
    } catch (error) {
        console.error('Error deleting avance:', error);
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
