const express = require('express');
const pool = require('../db');
const fs = require('fs');
const path = require('path');
const router = express.Router();

function readEnvFile() {
    const envPath = path.join(process.cwd(), '.env');
    const examplePath = path.join(process.cwd(), '.env.example');
    let content = '';
    if (fs.existsSync(envPath)) {
        content = fs.readFileSync(envPath, 'utf-8');
    } else if (fs.existsSync(examplePath)) {
        content = fs.readFileSync(examplePath, 'utf-8');
    }
    
    const config = {
        DB_HOST: process.env.DB_HOST || '',
        DB_PORT: process.env.DB_PORT || '5432',
        DB_USER: process.env.DB_USER || '',
        DB_PASSWORD: process.env.DB_PASSWORD || '',
        DB_DATABASE: process.env.DB_DATABASE || ''
    };
    
    // Parse content to get correct values if present in the file
    const lines = content.split('\n');
    lines.forEach(line => {
        const parts = line.split('=');
        if (parts.length >= 2) {
            const key = parts[0].trim();
            const val = parts.slice(1).join('=').trim().replace(/^["']|["']$/g, '');
            if (key in config) {
                config[key] = val;
            }
        }
    });
    
    return config;
}

function writeEnvFile(config) {
    const envPath = path.join(process.cwd(), '.env');
    let content = '';
    if (fs.existsSync(envPath)) {
        content = fs.readFileSync(envPath, 'utf-8');
    } else {
        const examplePath = path.join(process.cwd(), '.env.example');
        if (fs.existsSync(examplePath)) {
            content = fs.readFileSync(examplePath, 'utf-8');
        }
    }
    
    const lines = content.split('\n');
    const updatedKeys = new Set();
    const newLines = lines.map(line => {
        const parts = line.split('=');
        if (parts.length >= 2) {
            const key = parts[0].trim();
            if (key in config) {
                updatedKeys.add(key);
                return `${key}=${config[key]}`;
            }
        }
        return line;
    });
    
    // Add keys that weren't in the original content
    Object.keys(config).forEach(key => {
        if (!updatedKeys.has(key)) {
            newLines.push(`${key}=${config[key]}`);
        }
    });
    
    fs.writeFileSync(envPath, newLines.join('\n'), 'utf-8');
    
    // Update active environment variables
    Object.keys(config).forEach(key => {
        process.env[key] = config[key];
    });
}

// Helper: convertit les clés PostgreSQL (minuscules) en camelCase pour le frontend
function toCamelCase(row) {
    if (!row) return null;
    return {
        companyName:          row.companyname          ?? row.companyName          ?? '',
        companyAddress:       row.companyaddress       ?? row.companyAddress       ?? '',
        companyWebsite:       row.companywebsite       ?? row.companyWebsite       ?? '',
        companyPhone:         row.companyphone         ?? row.companyPhone         ?? '',
        companyEmail:         row.companyemail         ?? row.companyEmail         ?? '',
        companyLogo:          row.companylogo          ?? row.companyLogo          ?? '',
        companySignature:     row.companysignature     ?? row.companySignature     ?? '',
        fiscalId:             row.fiscalid             ?? row.fiscalId             ?? '',
        currencySymbol:       row.currencysymbol       ?? row.currencySymbol       ?? 'DT',
        cautionPerCrate:      Number(row.cautionpercrate      ?? row.cautionPerCrate      ?? 0),
        emptyCrateWeight:     Number(row.emptycrateweight     ?? row.emptyCrateWeight     ?? 0),
        taxRate:              Number(row.taxrate              ?? row.taxRate              ?? 0),
        rentPerCratePerDay:   Number(row.rentpercrateperday   ?? row.rentPerCratePerDay   ?? 0),
        totalAvailableCrates: Number(row.totalavailablecrates ?? row.totalAvailableCrates ?? 0),
    };
}

// Helper: convertit les clés camelCase du frontend en colonnes PostgreSQL
function toDbColumns(settings) {
    return {
        companyname:          settings.companyName,
        companyaddress:       settings.companyAddress,
        companywebsite:       settings.companyWebsite,
        companyphone:         settings.companyPhone,
        companyemail:         settings.companyEmail,
        companylogo:          settings.companyLogo,
        companysignature:     settings.companySignature,
        fiscalid:             settings.fiscalId,
        currencysymbol:       settings.currencySymbol,
        cautionpercrate:      settings.cautionPerCrate,
        emptycrateweight:     settings.emptyCrateWeight,
        taxrate:              settings.taxRate,
        rentpercrateperday:   settings.rentPerCratePerDay,
        totalavailablecrates: settings.totalAvailableCrates,
    };
}

const defaultSettings = {
    companyname: 'Frigo Inc.',
    companyaddress: '123 Rue de la Glace, 75001 Paris, France',
    companywebsite: 'www.frigo-inc.com',
    companyphone: '0123456789',
    companyemail: 'admin@example.com',
    companylogo: '',
    companysignature: '',
    fiscalid: 'FR123456789',
    currencysymbol: 'DT',
    cautionpercrate: 15.00,
    emptycrateweight: 1.2,
    taxrate: 19.0,
    rentpercrateperday: 0.50,
    totalavailablecrates: 1000
};

// GET settings
router.get('/', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM settings LIMIT 1');
        let settings = result.rows[0];

        if (!settings) {
            // Insert default settings if the table is empty
            await pool.query(
                `INSERT INTO settings (companyName, companyAddress, companyWebsite, companyPhone, companyEmail, companyLogo, companySignature, fiscalId, currencySymbol, cautionPerCrate, emptyCrateWeight, taxRate, rentPerCratePerDay, totalAvailableCrates) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
                [
                    defaultSettings.companyname,
                    defaultSettings.companyaddress,
                    defaultSettings.companywebsite,
                    defaultSettings.companyphone,
                    defaultSettings.companyemail,
                    defaultSettings.companylogo,
                    defaultSettings.companysignature,
                    defaultSettings.fiscalid,
                    defaultSettings.currencysymbol,
                    defaultSettings.cautionpercrate,
                    defaultSettings.emptycrateweight,
                    defaultSettings.taxrate,
                    defaultSettings.rentpercrateperday,
                    defaultSettings.totalavailablecrates
                ]
            );
            settings = {
                companyname: defaultSettings.companyname,
                companyaddress: defaultSettings.companyaddress,
                companywebsite: defaultSettings.companywebsite,
                companyphone: defaultSettings.companyphone,
                companyemail: defaultSettings.companyemail,
                companylogo: defaultSettings.companylogo,
                companysignature: defaultSettings.companysignature,
                fiscalid: defaultSettings.fiscalid,
                currencysymbol: defaultSettings.currencysymbol,
                cautionpercrate: defaultSettings.cautionpercrate,
                emptycrateweight: defaultSettings.emptycrateweight,
                taxrate: defaultSettings.taxrate,
                rentpercrateperday: defaultSettings.rentpercrateperday,
                totalavailablecrates: defaultSettings.totalavailablecrates
            };
        }

        res.json(toCamelCase(settings));
    } catch (error) {
        console.error('Error fetching settings:', error);
        res.status(500).json({ message: error.message || 'An unexpected server error occurred while fetching settings.', code: error.code });
    }
});

// UPDATE settings
router.put('/', async (req, res) => {
    const camelSettings = req.body;
    try {
        // Convertir les clés camelCase du frontend en colonnes PostgreSQL (minuscules)
        const dbSettings = toDbColumns(camelSettings);
        const columns = Object.keys(dbSettings).filter(k => dbSettings[k] !== undefined);
        const values = columns.map(k => dbSettings[k]);
        const setClause = columns.map((col, index) => `"${col}" = $${index + 1}`).join(', ');
        const query = `UPDATE settings SET ${setClause} WHERE id = $${columns.length + 1}`;
        const params = [...values, 1];
        
        await pool.query(query, params);
        // Retourner les paramètres en camelCase au frontend
        res.json(camelSettings);
    } catch (error) {
        console.error('Error updating settings:', error);
        res.status(500).json({ message: error.message || 'An unexpected server error occurred while updating settings.', code: error.code });
    }
});

// RESET ALL DATA
router.post('/reset-data', async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        // Ordre important pour respecter les contraintes de clés étrangères
        await client.query('TRUNCATE TABLE invoices');
        await client.query('TRUNCATE TABLE locations');
        await client.query('TRUNCATE TABLE movements');
        // Il faut supprimer les enregistrements avant de tronquer les tables parentes
        await client.query('DELETE FROM users');
        await client.query('DELETE FROM clients');
        await client.query('DELETE FROM products');
        await client.query('DELETE FROM rooms');
        await client.query('TRUNCATE TABLE settings RESTART IDENTITY');
        await client.query('TRUNCATE TABLE permissions');

        // Réinsérer les données par défaut
        await client.query(
            "INSERT INTO users (id, email, password, role) VALUES ('admin-uuid', 'admin@example.com', '$2a$10$f5.wJ55xAY2g2e4R.E.s9uUvWwDBWnL029s5uiVv1RIq8rWn.75gC', 'admin')"
        );
        await client.query(
            "INSERT INTO users (id, email, password, role) VALUES ('user-uuid', 'user@example.com', '$2a$10$f5.wJ55xAY2g2e4R.E.s9uUvWwDBWnL029s5uiVv1RIq8rWn.75gC', 'user')"
        );
        await client.query(
            "INSERT INTO permissions (role, pages) VALUES ('user', jsonb_build_object('dashboard', true, 'clients', true, 'products', true, 'rooms', true, 'factures', false, 'reports', false))"
        );
        await client.query(
            "INSERT INTO settings (companyName, companyAddress, companyWebsite, companyPhone, companyEmail, companyLogo, companySignature, fiscalId, currencySymbol, cautionPerCrate, emptyCrateWeight, taxRate, rentPerCratePerDay, totalAvailableCrates) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)",
            ['Frigo Inc.', '123 Rue de la Glace, 75001 Paris, France', 'www.frigo-inc.com', '0123456789', 'admin@example.com', '', '', 'FR123456789', 'DT', 15.00, 1.2, 19.0, 0.50, 1000]
        );
        
        await client.query('COMMIT');
        res.status(204).send();
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error resetting data:', error);
        res.status(500).json({ message: error.message || 'An unexpected server error occurred while resetting data.', code: error.code });
    } finally {
        client.release();
    }
});

// GET DB Connection Config
router.get('/db-config', (req, res) => {
    try {
        const config = readEnvFile();
        res.json(config);
    } catch (error) {
        console.error('Error reading DB config:', error);
        res.status(500).json({ message: error.message || 'Error reading database configuration.' });
    }
});

// POST DB Connection Config
router.post('/db-config', (req, res) => {
    try {
        const { DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_DATABASE } = req.body;
        const config = {
            DB_HOST: DB_HOST || '',
            DB_PORT: DB_PORT || '5432',
            DB_USER: DB_USER || '',
            DB_PASSWORD: DB_PASSWORD || '',
            DB_DATABASE: DB_DATABASE || ''
        };
        writeEnvFile(config);
        res.json({ success: true, message: 'Configuration de la base de données enregistrée avec succès.' });
    } catch (error) {
        console.error('Error writing DB config:', error);
        res.status(500).json({ message: error.message || 'Error saving database configuration.' });
    }
});

// Test DB Connection
router.post('/test-db-connection', async (req, res) => {
    let client;
    try {
        client = await pool.connect();
        // Si nous arrivons ici, la connexion est réussie
        res.json({ ok: true, message: 'Connexion à la base de données réussie !' });
    } catch (error) {
        console.error("Database connection test failed:", error);
        res.status(500).json({ ok: false, message: error.message, code: error.code });
    } finally {
        if (client) client.release();
    }
});

module.exports = router;
