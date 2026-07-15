const express = require('express');
const { v4: uuidv4 } = require('uuid');
const pool = require('../db');
const router = express.Router();

// Helper: normalise une ligne movements (PostgreSQL retourne tout en minuscules)
function mapMovement(row) {
    if (!row) return null;
    return {
        id:                 row.id,
        date:               row.date,
        clientId:           row.clientid           ?? row.clientId,
        type:               row.type,
        productId:          row.productid          ?? row.productId          ?? null,
        nbCaisse:           row.nbcaisse           != null ? Number(row.nbcaisse)           : (row.nbCaisse           != null ? Number(row.nbCaisse)           : null),
        roomId:             row.roomid             ?? row.roomId             ?? null,
        poidsBrut:          row.poidsbrut          != null ? Number(row.poidsbrut)          : (row.poidsBrut          != null ? Number(row.poidsBrut)          : null),
        prixUnitaire:       row.prixunitaire       != null ? Number(row.prixunitaire)       : (row.prixUnitaire       != null ? Number(row.prixUnitaire)       : null),
        poidsNet:           row.poidsnet           != null ? Number(row.poidsnet)           : (row.poidsNet           != null ? Number(row.poidsNet)           : null),
        montantTotal:       row.montanttotal       != null ? Number(row.montanttotal)       : (row.montantTotal       != null ? Number(row.montantTotal)       : null),
        taxe:               row.taxe               != null ? Number(row.taxe)               : null,
        nbCaisseRetournees: row.nbcaisseretournees != null ? Number(row.nbcaisseretournees) : (row.nbCaisseRetournees != null ? Number(row.nbCaisseRetournees) : null),
        loyer:              row.loyer              != null ? Number(row.loyer)              : null,
        cautionAppliquee:   row.cautionappliquee   ?? row.cautionAppliquee   ?? null,
        caution:            row.caution            != null ? Number(row.caution)            : null,
        paymentStatus:      row.paymentstatus      ?? row.paymentStatus      ?? null,
        updatedAt:          row.updatedat          ?? row.updatedAt          ?? null,
        updatedBy:          row.updatedby          ?? row.updatedBy          ?? null,
    };
}

// ============================================================
// GET all movements
// ============================================================
router.get('/', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM movements ORDER BY date DESC');
        res.json(result.rows.map(mapMovement));
    } catch (error) {
        console.error('Error fetching movements:', error);
        res.status(500).json({ message: error.message });
    }
});


// ============================================================
// Helper: Calculate the client's crate balance
// ============================================================
async function getClientCrateBalance(connection, clientId) {
    const totalOutResult = await connection.query(
        "SELECT COALESCE(SUM(nbCaisse), 0) AS totalout FROM movements WHERE clientId = $1 AND type = 'Caisses vides'",
        [clientId]
    );
    const totalReturnedResult = await connection.query(
        "SELECT COALESCE(SUM(nbCaisse), 0) AS totalreturned FROM movements WHERE clientId = $1 AND type IN ('Retour caisses vides', 'Fin de Location', 'Vente')",
        [clientId]
    );
    const inLocationResult = await connection.query(
        "SELECT COALESCE(SUM(nbCaisse), 0) AS inlocation FROM locations WHERE clientId = $1 AND status = 'En cours'",
        [clientId]
    );

    const totalOut = Number(totalOutResult.rows[0]?.totalout || 0);
    const totalReturned = Number(totalReturnedResult.rows[0]?.totalreturned || 0);
    const inLocation = Number(inLocationResult.rows[0]?.inlocation || 0);

    return {
        owned: totalOut - totalReturned,
        inLocation,
        availableEmpty: totalOut - totalReturned - inLocation
    };
}

// ============================================================
// Helper: FIFO withdrawal from locations (strict by product and room)
// ============================================================
async function fifoWithdraw(connection, clientId, productId, roomId, amount) {
    const locsResult = await connection.query(
        'SELECT * FROM locations WHERE clientId = $1 AND productId = $2 AND roomId = $3 AND status = $4 ORDER BY entryDate ASC',
        [clientId, productId, roomId, 'En cours']
    );
    const locs = locsResult.rows;

    let remaining = amount;
    for (const loc of locs) {
        if (remaining <= 0) break;
        const locNb = Number(loc.nbcaisse ?? loc.nbCaisse ?? 0);
        const withdraw = Math.min(remaining, locNb);
        const newNb = locNb - withdraw;
        const newStatus = newNb === 0 ? 'Terminé' : 'En cours';
        const exitDate = newNb === 0 ? new Date() : null;

        await connection.query(
            'UPDATE locations SET nbcaisse = $1, status = $2, exitdate = $3 WHERE id = $4',
            [newNb, newStatus, exitDate, loc.id]
        );
        remaining -= withdraw;
    }

    if (remaining > 0) {
        throw new Error(`Stock insuffisant dans cette chambre pour ce produit. Il manque ${remaining} caisses.`);
    }
}

// ============================================================
// Helper: FIFO restore to locations (e.g. when cancelling/reducing a withdrawal)
// ============================================================
async function fifoRestore(connection, clientId, productId, roomId, amount) {
    const locsResult = await connection.query(
        'SELECT * FROM locations WHERE clientId = $1 AND productId = $2 AND roomId = $3 ORDER BY entryDate DESC',
        [clientId, productId, roomId]
    );
    const locs = locsResult.rows;

    let remaining = amount;
    for (const loc of locs) {
        if (remaining <= 0) break;
        const locNb = Number(loc.nbcaisse ?? loc.nbCaisse ?? 0);
        const locInitial = Number(loc.initialnbcaisse ?? loc.initialNbCaisse ?? 0);
        const gap = locInitial - locNb;
        if (gap <= 0) continue;

        const restore = Math.min(remaining, gap);
        const newNb = locNb + restore;
        const newStatus = 'En cours';

        await connection.query(
            'UPDATE locations SET nbcaisse = $1, status = $2, exitdate = NULL WHERE id = $3',
            [newNb, newStatus, loc.id]
        );
        remaining -= restore;
    }

    if (remaining > 0) {
        console.warn(`fifoRestore: Could not find original records to restore ${remaining} caisses completely.`);
    }
}

function buildUpdateQuery(table, data, id) {
    const fields = Object.keys(data);
    if (fields.length === 0) return null;

    const setClause = fields.map((field, index) => `${field} = $${index + 1}`).join(', ');
    const values = Object.values(data);
    return {
        text: `UPDATE ${table} SET ${setClause} WHERE id = $${fields.length + 1}`,
        values: [...values, id]
    };
}

// ============================================================
// POST - Add a new movement (with full business logic)
// ============================================================
router.post('/', async (req, res) => {
    const connection = await pool.connect();
    try {
        await connection.query('BEGIN');

        const body = req.body;
        const type = body.type;
        const clientId = body.clientId;
        const movementId = uuidv4();

        const clientResult = await connection.query('SELECT * FROM clients WHERE id = $1', [clientId]);
        const client = clientResult.rows[0];
        if (!client) {
            throw new Error('Client non trouvé.');
        }

        const settingsResult = await connection.query('SELECT * FROM settings LIMIT 1');
        const settings = settingsResult.rows[0];

        const balance = await getClientCrateBalance(connection, clientId);

        if (type === 'Location') {
            const productId = body.productId;
            const roomId = body.roomId;
            const nbCaisse = parseInt(body.nbCaisse) || 0;

            if (!productId) throw new Error('Produit non spécifié.');
            if (!roomId) throw new Error('Chambre non spécifiée.');
            if (nbCaisse <= 0) throw new Error('Le nombre de caisses doit être supérieur à 0.');

            const roomResult = await connection.query('SELECT * FROM rooms WHERE id = $1', [roomId]);
            const room = roomResult.rows[0];
            if (!room) throw new Error('Chambre non trouvée.');

            const occupancyResult = await connection.query(
                "SELECT COALESCE(SUM(nbCaisse), 0) AS occupancy FROM locations WHERE roomId = $1 AND status = 'En cours'",
                [roomId]
            );
            const occupancy = Number(occupancyResult.rows[0]?.occupancy || 0);
            const roomCapacity = Number(room.nbcaisse ?? room.nbCaisse ?? 0);
            const available = roomCapacity - occupancy;
            if (nbCaisse > available) {
                throw new Error(`Capacité de la chambre dépassée. Disponible: ${available} caisses.`);
            }

            if (nbCaisse > balance.availableEmpty) {
                throw new Error(`Le client ne dispose que de ${balance.availableEmpty} caisses vides disponibles.`);
            }

            await connection.query(
                'INSERT INTO locations (id, clientId, productId, roomId, nbCaisse, initialNbCaisse, entryDate, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
                [movementId, clientId, productId, roomId, nbCaisse, nbCaisse, new Date(), 'En cours']
            );

            await connection.query(
                'INSERT INTO movements (id, date, clientId, type, productId, nbCaisse, roomId) VALUES ($1, $2, $3, $4, $5, $6, $7)',
                [movementId, new Date(), clientId, type, productId, nbCaisse, roomId]
            );
        } else if (type === 'Retour caisses vides') {
            const nbCaisse = parseInt(body.nbCaisse) || 0;
            if (nbCaisse <= 0) throw new Error('Le nombre de caisses doit être supérieur à 0.');
            if (nbCaisse > balance.availableEmpty) {
                throw new Error(`Le client ne peut pas retourner plus de ${balance.availableEmpty} caisses vides.`);
            }

            await connection.query(
                'INSERT INTO movements (id, date, clientId, type, nbCaisse) VALUES ($1, $2, $3, $4, $5)',
                [movementId, new Date(), clientId, type, nbCaisse]
            );
        } else if (type === 'Vente') {
            const productId = body.productId;
            const roomId = body.roomId;
            const nbCaisse = parseInt(body.nbCaisse || body.nbCaisseRetournees) || 0;
            const poidsBrut = parseFloat(body.poidsBrut) || 0;
            const prixUnitaire = parseFloat(body.prixUnitaire) || 0;
            const poidsNet = parseFloat(body.poidsNet) || 0;
            const montantTotal = parseFloat(body.montantTotal) || 0;
            const taxe = parseFloat(body.taxe) || 0;

            if (!productId) throw new Error('Produit non spécifié.');
            if (!roomId) throw new Error('Chambre non spécifiée.');
            if (nbCaisse <= 0) throw new Error('Le nombre de caisses doit être supérieur à 0.');

            await fifoWithdraw(connection, clientId, productId, roomId, nbCaisse);

            await connection.query(
                'INSERT INTO movements (id, date, clientId, type, productId, roomId, nbCaisse, poidsBrut, prixUnitaire, poidsNet, montantTotal, taxe) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',
                [movementId, new Date(), clientId, type, productId, roomId, nbCaisse, poidsBrut, prixUnitaire, poidsNet, montantTotal, taxe]
            );

            await connection.query(
                'INSERT INTO invoices (id, date, clientId, type, montantTotal, paymentStatus) VALUES ($1,$2,$3,$4,$5,$6)',
                [movementId, new Date(), clientId, type, montantTotal, body.paymentStatus || 'En attente']
            );
        } else if (type === 'Fin de Location') {
            const productId = body.productId;
            const roomId = body.roomId;
            const nbCaisse = parseInt(body.nbCaisse || body.nbCaisseRetournees) || 0;
            const loyer = parseFloat(body.loyer) || 0;
            const montantTotal = parseFloat(body.montantTotal) || 0;
            const caution = parseFloat(body.caution) || 0;
            const cautionAppliquee = body.cautionAppliquee === true || body.cautionAppliquee === 'true';

            if (!productId) throw new Error('Produit non spécifié.');
            if (!roomId) throw new Error('Chambre non spécifiée.');
            if (nbCaisse <= 0) throw new Error('Le nombre de caisses doit être supérieur à 0.');

            await fifoWithdraw(connection, clientId, productId, roomId, nbCaisse);

            await connection.query(
                'INSERT INTO movements (id, date, clientId, type, productId, roomId, nbCaisse, loyer, montantTotal, caution, cautionAppliquee, paymentStatus) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',
                [movementId, new Date(), clientId, type, productId, roomId, nbCaisse, loyer, montantTotal, cautionAppliquee ? caution : null, cautionAppliquee, body.paymentStatus || 'En attente']
            );

            await connection.query(
                'INSERT INTO invoices (id, date, clientId, type, montantTotal, loyer, caution, paymentStatus) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
                [movementId, new Date(), clientId, type, montantTotal, loyer, cautionAppliquee ? caution : null, body.paymentStatus || 'En attente']
            );
        } else if (type === 'Caisses vides') {
            const nbCaisse = parseInt(body.nbCaisse) || 0;
            if (nbCaisse <= 0) throw new Error('Le nombre de caisses doit être supérieur à 0.');

            const clientQuota = Number(client.caissesreservees ?? client.caissesReservees ?? 0);
            const maxAllowed = clientQuota - balance.owned;
            if (nbCaisse > maxAllowed) {
                throw new Error(`Quota de caisses dépassé. Le client peut encore emprunter ${maxAllowed} caisses (Quota: ${clientQuota}, Possédées: ${balance.owned}).`);
            }

            const globalOutResult = await connection.query(
                "SELECT COALESCE(SUM(nbCaisse), 0) AS globalout FROM movements WHERE type = 'Caisses vides'"
            );
            const globalReturnedResult = await connection.query(
                "SELECT COALESCE(SUM(nbCaisse), 0) AS globalreturned FROM movements WHERE type = 'Retour caisses vides'"
            );
            const globalOut = Number(globalOutResult.rows[0]?.globalout || 0);
            const globalReturned = Number(globalReturnedResult.rows[0]?.globalreturned || 0);
            const globalInUse = globalOut - globalReturned;
            const totalAvailable = settings ? Number(settings.totalavailablecrates ?? settings.totalAvailableCrates ?? 0) : 0;

            if (nbCaisse > (totalAvailable - globalInUse)) {
                throw new Error(`Stock global de caisses insuffisant. Disponible: ${totalAvailable - globalInUse}.`);
            }

            const cautionPerCrate = settings ? (parseFloat(settings.cautionpercrate ?? settings.cautionPerCrate) || 0) : 0;
            const caution = nbCaisse * cautionPerCrate;

            await connection.query(
                'INSERT INTO movements (id, date, clientId, type, nbCaisse, caution) VALUES ($1,$2,$3,$4,$5,$6)',
                [movementId, new Date(), clientId, type, nbCaisse, caution]
            );
        } else {
            throw new Error(`Type de mouvement inconnu: ${type}`);
        }

        await connection.query('COMMIT');

        const createdMovementResult = await connection.query('SELECT * FROM movements WHERE id = $1', [movementId]);
        res.status(201).json(mapMovement(createdMovementResult.rows[0]));
    } catch (error) {
        if (connection) await connection.query('ROLLBACK');
        console.error('CRITICAL ERROR in POST /api/movements:', error);
        res.status(400).json({ message: error.message || 'Une erreur serveur est survenue lors de l\'ajout du mouvement.' });
    } finally {
        if (connection) connection.release();
    }
});

// ============================================================
// PUT - Update a movement
// ============================================================
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { updatedBy, ...movementData } = req.body;
    const updatedAt = new Date();

    const connection = await pool.connect();
    try {
        await connection.query('BEGIN');

        const oldMovementResult = await connection.query('SELECT * FROM movements WHERE id = $1', [id]);
        const oldMovement = oldMovementResult.rows[0];
        if (!oldMovement) throw new Error('Mouvement introuvable');

        const oldType = oldMovement.type;
        const newType = movementData.type || oldType;
        const oldNb = parseInt(oldMovement.nbcaisse ?? oldMovement.nbCaisse ?? oldMovement.nbcaisseretournees ?? oldMovement.nbCaisseRetournees) || 0;
        const newNb = parseInt(movementData.nbCaisse || movementData.nbCaisseRetournees) || oldNb;
        const oldRoom = oldMovement.roomid ?? oldMovement.roomId;
        const newRoom = movementData.roomId || oldRoom;
        const oldProduct = oldMovement.productid ?? oldMovement.productId;
        const newProduct = movementData.productId || oldProduct;
        const oldClientId = oldMovement.clientid ?? oldMovement.clientId;

        const isOldWithdrawal = oldType === 'Vente' || oldType === 'Fin de Location';

        if (oldType === 'Location') {
            const locResult = await connection.query('SELECT * FROM locations WHERE id = $1', [id]);
            const loc = locResult.rows[0];
            if (loc) {
                const diff = newNb - oldNb;
                const locNb = Number(loc.nbcaisse ?? loc.nbCaisse ?? 0);
                const newCurrentNb = locNb + diff;
                if (newCurrentNb < 0) throw new Error("Impossible de réduire l'entrée : déjà trop de caisses sorties.");

                await connection.query(
                    'UPDATE locations SET nbCaisse = $1, initialNbCaisse = $2, roomId = $3, productId = $4 WHERE id = $5',
                    [newCurrentNb, newNb, newRoom, newProduct, id]
                );
            }
        } else if (isOldWithdrawal) {
            if (oldRoom !== newRoom || oldProduct !== newProduct) {
                await fifoRestore(connection, oldClientId, oldProduct, oldRoom, oldNb);
                await fifoWithdraw(connection, oldClientId, newProduct, newRoom, newNb);
            } else {
                const diff = newNb - oldNb;
                if (diff > 0) await fifoWithdraw(connection, oldClientId, oldProduct, oldRoom, diff);
                else if (diff < 0) await fifoRestore(connection, oldClientId, oldProduct, oldRoom, Math.abs(diff));
            }

            const oldMontant = oldMovement.montanttotal ?? oldMovement.montantTotal;
            const oldPayStatus = oldMovement.paymentstatus ?? oldMovement.paymentStatus;
            const oldLoyer = oldMovement.loyer;
            const oldCaution = oldMovement.caution;
            if (newType === 'Vente') {
                await connection.query('UPDATE invoices SET montanttotal = $1, paymentstatus = $2 WHERE id = $3',
                    [movementData.montantTotal || oldMontant, movementData.paymentStatus || oldPayStatus || 'En attente', id]
                );
            } else if (newType === 'Fin de Location') {
                await connection.query('UPDATE invoices SET montanttotal = $1, loyer = $2, caution = $3, paymentstatus = $4 WHERE id = $5',
                    [movementData.montantTotal || oldMontant, movementData.loyer || oldLoyer, movementData.cautionAppliquee ? (movementData.caution || oldCaution) : null, movementData.paymentStatus || oldPayStatus || 'En attente', id]
                );
            }
        }

        const updateData = { ...movementData, updatedAt, updatedBy };
        if (updateData.date) {
            updateData.date = new Date(updateData.date);
        }

        const updateQuery = buildUpdateQuery('movements', updateData, id);
        if (updateQuery) {
            await connection.query(updateQuery.text, updateQuery.values);
        }

        await connection.query('COMMIT');
        res.json({ id, ...updateData });
    } catch (error) {
        if (connection) await connection.query('ROLLBACK');
        console.error(`CRITICAL ERROR in PUT /api/movements/${id}:`, error);
        res.status(500).json({ message: error.message || 'Une erreur serveur est survenue lors de la mise à jour.' });
    } finally {
        if (connection) connection.release();
    }
});

// ============================================================
// DELETE - Delete a movement and associated records (DISABLED)
// ============================================================
router.delete('/:id', async (req, res) => {
    return res.status(403).json({ message: "La suppression d'une opération de stock enregistrée n'est pas autorisée." });
});

module.exports = router;
