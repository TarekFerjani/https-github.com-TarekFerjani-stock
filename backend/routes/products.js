const express = require('express');
const { v4: uuidv4 } = require('uuid');
const pool = require('../db');
const router = express.Router();

// Helper: normalise une ligne products (PostgreSQL retourne tout en minuscules)
function mapProduct(row) {
    if (!row) return null;
    return {
        id:         row.id,
        nom:        row.nom,
        categorie:  row.categorie,
        codeBarres: row.codebarres ?? row.codeBarres ?? null,
    };
}

// GET all products
router.get('/', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM products');
        const rows = result.rows;
        res.json(rows.map(mapProduct));
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).json({ message: error.message || 'An unexpected server error occurred while fetching products.', code: error.code });
    }
});

// ADD a new product
router.post('/', async (req, res) => {
    const { nom, categorie, codeBarres } = req.body;
    const id = uuidv4();
    try {
        await pool.query('INSERT INTO products (id, nom, categorie, codebarres) VALUES ($1, $2, $3, $4)', 
            [id, nom, categorie, codeBarres]);
        res.status(201).json(mapProduct({ id, nom, categorie, codebarres: codeBarres }));
    } catch (error) {
        console.error('Error adding product:', error);
        res.status(500).json({ message: error.message || 'An unexpected server error occurred while adding a product.', code: error.code });
    }
});

// UPDATE a product
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { nom, categorie, codeBarres } = req.body;
    try {
        await pool.query('UPDATE products SET nom = $1, categorie = $2, codebarres = $3 WHERE id = $4', 
            [nom, categorie, codeBarres, id]);
        res.json(mapProduct({ id, nom, categorie, codebarres: codeBarres }));
    } catch (error) {
        console.error(`Error updating product ${id}:`, error);
        res.status(500).json({ message: error.message || 'An unexpected server error occurred while updating the product.', code: error.code });
    }
});

// DELETE a product
router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        // Check if product is used in movements
        const result = await pool.query('SELECT id FROM movements WHERE productid = $1 LIMIT 1', [id]);
        const movements = result.rows;
        if (movements.length > 0) {
            return res.status(403).json({ message: "Impossible de supprimer ce produit car il est utilisé dans des mouvements." });
        }
        await pool.query('DELETE FROM products WHERE id = $1', [id]);
        res.json({ success: true });
    } catch (error) {
        console.error(`Error deleting product ${id}:`, error);
        res.status(500).json({ message: error.message || 'An unexpected server error occurred while deleting the product.', code: error.code });
    }
});

module.exports = router;
