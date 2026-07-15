const express = require('express');
const pool = require('../db');
const router = express.Router();

// Helper: normalise une ligne invoices (PostgreSQL retourne tout en minuscules)
function mapInvoice(row) {
    if (!row) return null;
    return {
        id:            row.id,
        date:          row.date,
        clientId:      row.clientid      ?? row.clientId,
        type:          row.type,
        montantTotal:  row.montanttotal  != null ? Number(row.montanttotal)  : (row.montantTotal  != null ? Number(row.montantTotal)  : null),
        loyer:         row.loyer         != null ? Number(row.loyer)         : null,
        caution:       row.caution       != null ? Number(row.caution)       : null,
        paymentStatus: row.paymentstatus ?? row.paymentStatus ?? null,
    };
}

// ============================================================
// GET all invoices
// ============================================================
router.get('/', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM invoices ORDER BY date DESC');
        res.json(result.rows.map(mapInvoice));
    } catch (error) {
        console.error('Error fetching invoices:', error);
        res.status(500).json({ message: error.message });
    }
});

// ============================================================
// GET one invoice by ID
// ============================================================
router.get('/:id', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM invoices WHERE id = $1', [req.params.id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Facture non trouvée.' });
        }
        res.json(mapInvoice(result.rows[0]));
    } catch (error) {
        console.error(`Error fetching invoice ${req.params.id}:`, error);
        res.status(500).json({ message: error.message });
    }
});

// ============================================================
// DELETE an invoice
// ============================================================
router.delete('/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM invoices WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (error) {
        console.error(`Error deleting invoice ${req.params.id}:`, error);
        res.status(500).json({ message: error.message });
    }
});

// ============================================================
// Toggle payment status (Payé <-> En attente)
// ============================================================
router.post('/:id/toggle-payment', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('SELECT paymentstatus FROM invoices WHERE id = $1', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Facture non trouvée.' });
        }

        // Lire la valeur avec le nom de colonne PostgreSQL (minuscules)
        const currentStatus = result.rows[0].paymentstatus ?? result.rows[0].paymentStatus;
        const newStatus = currentStatus === 'Payé' ? 'En attente' : 'Payé';
        await pool.query('UPDATE invoices SET paymentstatus = $1 WHERE id = $2', [newStatus, id]);

        // Mettre à jour aussi le mouvement correspondant
        await pool.query('UPDATE movements SET paymentstatus = $1 WHERE id = $2', [newStatus, id]);

        const updatedResult = await pool.query('SELECT * FROM invoices WHERE id = $1', [id]);
        res.json(mapInvoice(updatedResult.rows[0]));
    } catch (error) {
        console.error(`Error toggling payment status for invoice ${id}:`, error);
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
