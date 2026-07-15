const express = require('express');
const pool = require('../db');
const router = express.Router();

// Helper: normalise une ligne locations (PostgreSQL retourne tout en minuscules)
function mapLocation(row) {
    if (!row) return null;
    return {
        id:               row.id,
        clientId:         row.clientid         ?? row.clientId,
        productId:        row.productid        ?? row.productId,
        roomId:           row.roomid           ?? row.roomId,
        nbCaisse:         Number(row.nbcaisse         ?? row.nbCaisse         ?? 0),
        initialNbCaisse:  Number(row.initialnbcaisse  ?? row.initialNbCaisse  ?? 0),
        entryDate:        row.entrydate        ?? row.entryDate,
        exitDate:         row.exitdate         ?? row.exitDate         ?? null,
        status:           row.status,
    };
}

// GET all locations
router.get('/', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM locations ORDER BY entrydate DESC');
        res.json(result.rows.map(mapLocation));
    } catch (error) {
        console.error('Error fetching locations:', error);
        res.status(500).json({ message: error.message || 'An unexpected server error occurred while fetching locations.', code: error.code });
    }
});


// Process a withdrawal (FIFO logic)
router.post('/process-withdrawal', async (req, res) => {
    const { clientId, nbCaisseToWithdraw } = req.body;
    const connection = await pool.connect();
    try {
        await connection.query('BEGIN');

        const locationsResult = await connection.query(
            "SELECT * FROM locations WHERE clientId = $1 AND status = 'En cours' ORDER BY entryDate ASC",
            [clientId]
        );
        const locations = locationsResult.rows;

        let remainingToWithdraw = nbCaisseToWithdraw;
        const affectedLocations = [];

        for (const loc of locations) {
            if (remainingToWithdraw <= 0) break;

            const withdrawAmount = Math.min(remainingToWithdraw, loc.nbCaisse);
            const newNbCaisse = loc.nbCaisse - withdrawAmount;
            const newStatus = newNbCaisse === 0 ? 'Terminé' : 'En cours';
            const exitDate = newStatus === 'Terminé' ? new Date() : null;

            await connection.query(
                'UPDATE locations SET nbcaisse = $1, status = $2, exitdate = $3 WHERE id = $4',
                [newNbCaisse, newStatus, exitDate, loc.id]
            );

            affectedLocations.push({ ...loc, nbCaisse: newNbCaisse, status: newStatus });
            remainingToWithdraw -= withdrawAmount;
        }

        if (remainingToWithdraw > 0) {
            throw new Error("Quantité à retirer supérieure au stock en location.");
        }

        await connection.query('COMMIT');
        res.json({ affectedLocations });

    } catch (error) {
        await connection.query('ROLLBACK');
        console.error('Error processing withdrawal:', error);
        res.status(500).json({ message: error.message || 'An unexpected server error occurred while processing the withdrawal.', code: error.code });
    } finally {
        connection.release();
    }
});


module.exports = router;
