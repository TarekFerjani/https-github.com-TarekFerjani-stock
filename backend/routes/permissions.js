const express = require('express');
const pool = require('../db');
const router = express.Router();

// GET permissions for 'user' role
router.get('/', async (req, res) => {
    try {
        const result = await pool.query("SELECT pages FROM permissions WHERE role = 'user'");
        const rows = result.rows;
        if (rows.length > 0) {
            res.json(rows[0].pages);
        } else {
            res.json({}); // Retourne un objet vide si aucune permission n'est définie
        }
    } catch (error) {
        console.error('Error fetching permissions:', error);
        res.status(500).json({ message: error.message || 'An unexpected server error occurred while fetching permissions.', code: error.code });
    }
});

// UPDATE permissions for 'user' role
router.put('/', async (req, res) => {
    const permissions = req.body;
    try {
        const result = await pool.query(
            "INSERT INTO permissions (role, pages) VALUES ('user', $1) ON CONFLICT (role) DO UPDATE SET pages = EXCLUDED.pages",
            [JSON.stringify(permissions)]
        );
        res.json(permissions);
    } catch (error) {
        console.error('Error updating permissions:', error);
        res.status(500).json({ message: error.message || 'An unexpected server error occurred while updating permissions.', code: error.code });
    }
});

module.exports = router;
