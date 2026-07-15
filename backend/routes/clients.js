const express = require('express');
const { v4: uuidv4 } = require('uuid');
const pool = require('../db');
const router = express.Router();

// Helper: normalise une ligne clients (PostgreSQL retourne tout en minuscules)
function mapClient(row) {
    if (!row) return null;
    return {
        id:               row.id,
        nom:              row.nom,
        prenom:           row.prenom,
        cin:              row.cin,
        telephone:        row.telephone,
        email:            row.email,
        caissesReservees: Number(row.caissesreservees ?? row.caissesReservees ?? 0),
    };
}

// GET all clients
router.get('/', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM clients');
        res.json(result.rows.map(mapClient));
    } catch (error) {
        console.error('Error fetching clients:', error);
        res.status(500).json({ message: error.message || 'An unexpected server error occurred while fetching clients.', code: error.code });
    }
});

// ADD a new client
router.post('/', async (req, res) => {
    const { nom, prenom, cin, telephone, email, caissesReservees } = req.body;
    const id = uuidv4();
    try {
        await pool.query(
            'INSERT INTO clients (id, nom, prenom, cin, telephone, email, caissesreservees) VALUES ($1, $2, $3, $4, $5, $6, $7)',
            [id, nom, prenom, cin, telephone, email, caissesReservees || 0]
        );
        res.status(201).json(mapClient({ id, nom, prenom, cin, telephone, email, caissesreservees: caissesReservees || 0 }));
    } catch (error) {
        console.error('Error adding client:', error);
        res.status(500).json({ message: error.message || 'An unexpected server error occurred while adding a client.', code: error.code });
    }
});

// UPDATE a client
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { nom, prenom, cin, telephone, email, caissesReservees } = req.body;
    try {
        await pool.query(
            'UPDATE clients SET nom = $1, prenom = $2, cin = $3, telephone = $4, email = $5, caissesreservees = $6 WHERE id = $7',
            [nom, prenom, cin, telephone, email, caissesReservees, id]
        );
        res.json(mapClient({ id, nom, prenom, cin, telephone, email, caissesreservees: caissesReservees }));
    } catch (error) {
        console.error(`Error updating client ${id}:`, error);
        res.status(500).json({ message: error.message || 'An unexpected server error occurred while updating the client.', code: error.code });
    }
});

// DELETE a client
router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        // Check if client is used in movements
        const movementResult = await pool.query('SELECT id FROM movements WHERE clientid = $1 LIMIT 1', [id]);
        if (movementResult.rows.length > 0) {
            return res.status(403).json({ message: "Impossible de supprimer ce client car il est associé à des mouvements." });
        }
        await pool.query('DELETE FROM clients WHERE id = $1', [id]);
        res.json({ success: true });
    } catch (error) {
        console.error(`Error deleting client ${id}:`, error);
        res.status(500).json({ message: error.message || 'An unexpected server error occurred while deleting the client.', code: error.code });
    }
});

module.exports = router;
