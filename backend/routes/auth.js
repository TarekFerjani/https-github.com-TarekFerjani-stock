const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const pool = require('../db');

const router = express.Router();

// Login
router.post('/auth/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        const rows = result.rows;
        
        if (rows.length === 0) {
            return res.status(401).json({ message: 'Email ou mot de passe invalide.' });
        }
        const user = rows[0];
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Email ou mot de passe invalide.' });
        }
        // Ne pas renvoyer le mot de passe haché
        const { password: _, ...userWithoutPassword } = user;
        if (typeof userWithoutPassword.permissions === 'string') {
            try {
                userWithoutPassword.permissions = JSON.parse(userWithoutPassword.permissions);
            } catch (e) {
                userWithoutPassword.permissions = {};
            }
        }
        res.json({ user: userWithoutPassword });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: error.message || 'An unexpected server error occurred during login.', code: error.code });
    }
});

// CRUD for Users
router.get('/users', async (req, res) => {
    try {
        const result = await pool.query('SELECT id, email, role, permissions FROM users');
        const users = result.rows.map(u => {
            if (typeof u.permissions === 'string') {
                try {
                    u.permissions = JSON.parse(u.permissions);
                } catch (e) {
                    u.permissions = {};
                }
            }
            return u;
        });
        res.json(users);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ message: error.message || 'An unexpected server error occurred while fetching users.', code: error.code });
    }
});

router.post('/users', async (req, res) => {
    const { email, password, role, permissions } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const id = uuidv4();
        const permissionsJson = permissions ? JSON.stringify(permissions) : null;
        
        await pool.query(
            'INSERT INTO users (id, email, password, role, permissions) VALUES ($1, $2, $3, $4, $5)',
            [id, email, hashedPassword, role, permissionsJson]
        );
        
        const userWithoutPassword = { id, email, role };
        if (permissions) {
            userWithoutPassword.permissions = permissions;
        }
        res.status(201).json(userWithoutPassword);
    } catch (error) {
        console.error('Error adding user:', error);
        res.status(500).json({ message: error.message || 'An unexpected server error occurred while adding a user.', code: error.code });
    }
});

router.put('/users/:id', async (req, res) => {
    const { id } = req.params;
    const { email, password, role, permissions } = req.body;
    try {
        let query = 'UPDATE users SET email = $1, role = $2';
        let params = [email, role];
        let paramIndex = 3;
        
        if (password) {
            const hashedPassword = await bcrypt.hash(password, 10);
            query += `, password = $${paramIndex}`;
            params.push(hashedPassword);
            paramIndex++;
        }
        
        if (permissions !== undefined) {
            query += `, permissions = $${paramIndex}`;
            params.push(JSON.stringify(permissions));
            paramIndex++;
        }
        
        query += ` WHERE id = $${paramIndex}`;
        params.push(id);
        
        await pool.query(query, params);
        
        const responseData = { id, email, role };
        if (permissions !== undefined) {
            responseData.permissions = permissions;
        }
        res.json(responseData);
    } catch (error) {
        console.error(`Error updating user ${id}:`, error);
        res.status(500).json({ message: error.message || 'An unexpected server error occurred while updating the user.', code: error.code });
    }
});

router.delete('/users/:id', async (req, res) => {
    const { id } = req.params;
    try {
        // Sécurité : ne pas permettre de supprimer le dernier admin
        const adminsResult = await pool.query('SELECT COUNT(*) as admincount FROM users WHERE role = $1', ['admin']);
        const adminCount = parseInt(adminsResult.rows[0].admincount, 10);
        
        const userResult = await pool.query('SELECT role FROM users WHERE id = $1', [id]);
        if (userResult.rows.length === 0) {
            return res.status(404).json({ message: 'Utilisateur non trouvé.' });
        }

        if (userResult.rows[0].role === 'admin' && adminCount <= 1) {
            return res.status(403).json({ message: "Impossible de supprimer le dernier administrateur." });
        }
        
        await pool.query('DELETE FROM users WHERE id = $1', [id]);
        res.json({ success: true });
    } catch (error) {
        console.error(`Error deleting user ${id}:`, error);
        res.status(500).json({ message: error.message || 'An unexpected server error occurred while deleting the user.', code: error.code });
    }
});


module.exports = router;
