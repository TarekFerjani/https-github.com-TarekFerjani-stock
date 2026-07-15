const express = require('express');
const { v4: uuidv4 } = require('uuid');
const pool = require('../db');
const { sendContractEmail } = require('../utils/mailer');
const router = express.Router();

// Helper: normalise une ligne contracts (PostgreSQL retourne certaines colonnes en minuscules)
function mapContract(row) {
    if (!row) return null;
    return {
        id:               row.id,
        date:             row.date,
        clientId:         row.clientid         ?? row.clientId,
        type:             row.type,
        nbCaisse:         Number(row.nbcaisse  ?? row.nbCaisse  ?? 0),
        caution:          Number(row.caution   ?? 0),
        avance:           Number(row.avance    ?? 0),
        periode:          row.periode,
        signature:        row.signature        ?? null,
        signedAt:         row.signedat         ?? row.signedAt         ?? null,
        status:           row.status,
    };
}

// GET all contracts
router.get('/', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM contracts ORDER BY date DESC');
        res.json(result.rows.map(mapContract));
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});


// DEBUG: Get contracts schema info
router.get('/debug-schema', async (req, res) => {
    try {
        const columns = await pool.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'contracts'
        `);
        const constraints = await pool.query(`
            SELECT con.conname, pg_get_constraintdef(con.oid) as def
            FROM pg_constraint con
            JOIN pg_class rel ON rel.oid = con.conrelid
            WHERE rel.relname = 'contracts'
        `);
        res.json({ columns: columns.rows, constraints: constraints.rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// POST new contract
router.post('/', async (req, res) => {
    const {
        clientId, type, nbCaisse, caution, avance, periode, signature
    } = req.body;

    if (!clientId || !type) {
        return res.status(400).json({ message: 'Champs requis manquants : clientId et type sont obligatoires.' });
    }
    if (!nbCaisse || caution === undefined || !periode) {
        return res.status(400).json({ message: 'Champs requis manquants pour un contrat de location/prêt.' });
    }

    const id = uuidv4();
    const date = new Date();
    const signedAt = signature ? new Date() : null;
    const status = signature ? 'Actif' : 'En attente';

    try {
        const clientResult = await pool.query('SELECT nom, prenom, email FROM clients WHERE id = $1', [clientId]);
        const client = clientResult.rows[0];
        if (!client) {
            return res.status(400).json({ message: 'Client introuvable.' });
        }

        // Détecter si la colonne est stockée en camelCase ou lowercase
        const colCheck = await pool.query(
            `SELECT column_name FROM information_schema.columns WHERE table_name='contracts' AND column_name IN ('clientId','clientid') LIMIT 1`
        );
        const clientIdCol = colCheck.rows.length > 0 ? colCheck.rows[0].column_name : 'clientid';
        const nbCaisseCol = clientIdCol === 'clientId' ? '"nbCaisse"' : 'nbcaisse';
        const signedAtCol = clientIdCol === 'clientId' ? '"signedAt"' : 'signedat';
        const clientIdSql = clientIdCol === 'clientId' ? '"clientId"' : 'clientid';

        await pool.query(
            `INSERT INTO contracts (
                id, date, ${clientIdSql}, type, ${nbCaisseCol}, caution, avance, periode, signature, ${signedAtCol}, status
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
            [
                id, date, clientId, type, nbCaisse || 1, caution || 0, avance || 0, periode,
                signature || null, signedAt, status
            ]
        );

        // Récupérer les settings
        const settingsResult = await pool.query('SELECT * FROM settings LIMIT 1');
        const company = settingsResult.rows[0] || {};
        const companyName = company.companyname ?? company.companyName ?? 'Frigo App';
        const companyEmail = company.companyemail ?? company.companyEmail ?? process.env.EMAIL_USER;

        if (client && client.email) {
            try { await sendContractEmail(client.email, id, `${client.prenom} ${client.nom}`, companyName, companyEmail); }
            catch (e) { console.error('Failed to send auto-email:', e.message); }
        }

        res.status(201).json({ id, date, clientId, type, status });
    } catch (error) {
        console.error('Erreur création contrat:', error);
        res.status(500).json({ message: error.message });
    }
});

// PUT update contract status and signature
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { status, signature } = req.body;
        
        let query = 'UPDATE contracts SET status = $1';
        const params = [status];
        
        if (signature) {
            query += ', signature = $2, signedAt = $3';
            params.push(signature);
            params.push(new Date());
        }

        const paramIndex = params.length + 1;
        query += ` WHERE id = $${paramIndex}`;
        params.push(id);
        
        await pool.query(query, params);
        res.json({ id, status, signature: !!signature });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// DELETE contract
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('DELETE FROM contracts WHERE id = $1', [id]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});


router.post('/send/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        // Fetch contract and client info (clientid en minuscules dans PostgreSQL)
        const contractsResult = await pool.query(`
            SELECT c.*, cl.email, cl.nom, cl.prenom 
            FROM contracts c 
            JOIN clients cl ON c.clientid = cl.id 
            WHERE c.id = $1`, [id]);
        const contracts = contractsResult.rows;
        
        if (contracts.length === 0) return res.status(404).json({ message: 'Contrat non trouvé' });
        
        const contract = contracts[0];
        if (!contract.email) return res.status(400).json({ message: 'Le client n\'a pas d\'adresse email' });

        // Fetch company settings for branding
        const settingsResult = await pool.query('SELECT companyname, companyemail FROM settings LIMIT 1');
        const company = settingsResult.rows[0] || {};
        const companyName = company.companyname ?? 'Frigo App';
        const companyEmail = company.companyemail ?? process.env.EMAIL_USER;

        await sendContractEmail(
            contract.email,
            contract.id,
            `${contract.prenom} ${contract.nom}`,
            companyName,
            companyEmail
        );
        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.message });
    }
});

// GET contract for public signing (no auth required)
router.get('/public/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const rowsResult = await pool.query(`
            SELECT 
                c.*,
                s.companyname AS "companyName",
                s.currencysymbol AS "currencySymbol",
                s.companyaddress AS "companyAddress",
                s.companyphone AS "companyPhone",
                s.fiscalid AS "fiscalId",
                s.companylogo AS "companyLogo",
                s.companysignature AS "companySignature",
                s.companyemail AS "settingsEmail",
                cl.email as "clientEmail", cl.nom as "clientNom", cl.prenom as "clientPrenom", cl.cin as "clientCin"
            FROM contracts c
            LEFT JOIN settings s ON s.id = 1
            JOIN clients cl ON c.clientid = cl.id
            WHERE c.id = $1`, [id]);
        const rows = rowsResult.rows;
        if (rows.length === 0) return res.status(404).json({ message: 'Non trouvé' });
        res.json(rows[0]);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// PUT signature for public signing (no auth required)
router.put('/public/:id/sign', async (req, res) => {
    try {
        const { id } = req.params;
        const { signature } = req.body;

        if (!signature) {
            return res.status(400).json({ message: 'Signature requise' });
        }

        const signedAt = new Date();
        const query = 'UPDATE contracts SET signature = $1, "signedAt" = $2, status = $3 WHERE id = $4';
        const params = [signature, signedAt, 'Actif', id];

        const updateResult = await pool.query(query, params);
        if (updateResult.rowCount === 0) {
            return res.status(404).json({ message: 'Contrat non trouvé' });
        }

        // Send confirmation email with PDF attachment
        try {
            const rowsResult = await pool.query(`
                SELECT cc.*, 
                       cl.email as "clientEmail", cl.nom, cl.prenom, cl.cin,
                       s.companyname as "companyName", 
                       s.companyemail as "companyEmail", 
                       s.companyaddress as "companyAddress",
                       s.companyphone as "companyPhone", 
                       s.fiscalid as "fiscalId", 
                       s.currencysymbol as "currencySymbol", 
                       s.companylogo as "companyLogo", 
                       s.companysignature as "companySignature"
                FROM contracts cc
                JOIN clients cl ON cc.clientid = cl.id
                LEFT JOIN settings s ON s.id = 1
                WHERE cc.id = $1`, [id]);

            if (rowsResult.rows.length > 0) {
                const c = rowsResult.rows[0];
                const { sendSignedContractEmail } = require('../utils/mailer');
                const fs = require('fs');
                const company = c.companyName || "L'entreprise";
                const refId = id.substring(0, 8).toUpperCase();

                let pdfBuffer;
                try {
                    const { generateContractPdf } = require('../utils/pdfGenerator');
                    pdfBuffer = await generateContractPdf(c, signature);
                    fs.appendFileSync('email_debug.log', `[${new Date().toISOString()}] PDF generated (${c.type}), size: ${pdfBuffer.length}\n`);
                } catch (pdfErr) {
                    fs.appendFileSync('email_debug.log', `[${new Date().toISOString()}] PDF ERROR: ${pdfErr.message}\n`);
                    throw pdfErr;
                }

                const makeHtmlBody = (name) => `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"/>
<style>body{font-family:Arial,sans-serif;background:#f8fafc;margin:0;padding:30px}
.card{max-width:560px;margin:auto;background:#fff;border-radius:12px;padding:32px 36px;box-shadow:0 2px 8px rgba(0,0,0,.08)}
h2{color:#1e40af;margin:0 0 16px;font-size:18px}
p{color:#334155;font-size:14px;line-height:1.6;margin:0 0 12px}
.ft{margin-top:24px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8}
</style></head><body><div class="card">
<h2>✅ Votre Contrat Signé — ${company}</h2>
<p>Bonjour <strong>${name}</strong>,</p>
<p>Votre contrat a bien été signé électroniquement. Vous trouverez votre exemplaire en pièce jointe PDF.</p>
<p>Cordialement,<br/><strong>${company}</strong></p>
<div class="ft">${c.companyAddress || ''} &nbsp;•&nbsp; Tél: ${c.companyPhone || ''}</div>
</div></body></html>`;

                if (c.clientEmail) {
                    const name = `${c.prenom || ''} ${c.nom || ''}`.trim();
                    try {
                        await sendSignedContractEmail(c.clientEmail, id, name, company, c.companyEmail, makeHtmlBody(name), pdfBuffer, refId);
                        fs.appendFileSync('email_debug.log', `[${new Date().toISOString()}] ✅ Email sent to ${c.clientEmail}\n`);
                    } catch (e) { fs.appendFileSync('email_debug.log', `[${new Date().toISOString()}] ❌ Email: ${e.message}\n`); }
                } else {
                    fs.appendFileSync('email_debug.log', `[${new Date().toISOString()}] ⚠️ No email for contract ${id}\n`);
                }
            }
        } catch (emailErr) {
            const fs = require('fs');
            fs.appendFileSync('email_debug.log', `[${new Date().toISOString()}] FATAL: ${emailErr.message}\n`);
            console.error('[EMAIL] Error:', emailErr.message);
        }

        res.json({ success: true, signedAt, status: 'Actif' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
