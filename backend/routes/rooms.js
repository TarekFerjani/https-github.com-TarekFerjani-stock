const express = require('express');
const { v4: uuidv4 } = require('uuid');
const pool = require('../db');
const router = express.Router();

// Helper: normalise une ligne rooms (PostgreSQL retourne tout en minuscules)
function mapRoom(row) {
    if (!row) return null;
    return {
        id:       row.id,
        nom:      row.nom,
        nbCaisse: Number(row.nbcaisse ?? row.nbCaisse ?? 0),
    };
}

// GET all rooms
router.get('/', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM rooms');
        const rows = result.rows;
        res.json(rows.map(mapRoom));
    } catch (error) {
        console.error('Error fetching rooms:', error);
        res.status(500).json({ message: error.message || 'An unexpected server error occurred while fetching rooms.', code: error.code });
    }
});

// ADD a new room
router.post('/', async (req, res) => {
    const { nom, nbCaisse } = req.body;
    const id = uuidv4();
    try {
        await pool.query('INSERT INTO rooms (id, nom, nbcaisse) VALUES ($1, $2, $3)', 
            [id, nom, nbCaisse]);
        res.status(201).json(mapRoom({ id, nom, nbcaisse: nbCaisse }));
    } catch (error) {
        console.error('Error adding room:', error);
        res.status(500).json({ message: error.message || 'An unexpected server error occurred while adding a room.', code: error.code });
    }
});

// UPDATE a room
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { nom, nbCaisse } = req.body;
    try {
        await pool.query('UPDATE rooms SET nom = $1, nbcaisse = $2 WHERE id = $3', 
            [nom, nbCaisse, id]);
        res.json(mapRoom({ id, nom, nbcaisse: nbCaisse }));
    } catch (error) {
        console.error(`Error updating room ${id}:`, error);
        res.status(500).json({ message: error.message || 'An unexpected server error occurred while updating the room.', code: error.code });
    }
});

// DELETE a room
router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        // Check if room is used in locations
        const result = await pool.query('SELECT id FROM locations WHERE roomid = $1 LIMIT 1', [id]);
        const locations = result.rows;
        if (locations.length > 0) {
            return res.status(403).json({ message: "Impossible de supprimer cette chambre car elle est utilisée dans des locations." });
        }
        await pool.query('DELETE FROM rooms WHERE id = $1', [id]);
        res.json({ success: true });
    } catch (error) {
        console.error(`Error deleting room ${id}:`, error);
        res.status(500).json({ message: error.message || 'An unexpected server error occurred while deleting the room.', code: error.code });
    }
});

module.exports = router;
