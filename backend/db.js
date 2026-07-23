const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(process.cwd(), 'backend', 'data.json');

// Default initial data
const defaultUsers = [
  {
    id: 'admin-uuid-placeholder',
    email: 'admin@example.com',
    password: '$2a$10$RvGBSWUp.Bz7JwRKND7Xx.BBUTJ6PMCaWYcZ5ywVyVZ7D9w8k37.u', // hashed "password"
    role: 'admin',
    permissions: null
  },
  {
    id: 'user-uuid-placeholder',
    email: 'user@example.com',
    password: '$2a$10$NCZCli/fMvHhJcCCXdZ8k.BnOqZGK8EoyvWjIOth/7RMmMFaw81A.', // hashed "password"
    role: 'user',
    permissions: JSON.stringify({
      dashboard: true,
      clients: true,
      products: true,
      rooms: true,
      locations: false,
      ventes: true,
      movements: true,
      factures: false,
      reports: false
    })
  }
];

const defaultSettings = [
  {
    id: 1,
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
    totalavailablecrates: 1000,
    rentincreaserate: 0,
    increasestartmonth: 0
  }
];

let dbData = {
  users: [...defaultUsers],
  clients: [],
  products: [],
  rooms: [],
  settings: [...defaultSettings],
  contracts: [],
  movements: [],
  locations: [],
  invoices: []
};

// Helper to save db to file
function saveDb() {
  try {
    fs.writeFileSync(dbPath, JSON.stringify(dbData, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save mock database:', err);
  }
}

// Helper to load db from file
function loadDb() {
  try {
    if (fs.existsSync(dbPath)) {
      const content = fs.readFileSync(dbPath, 'utf-8');
      dbData = JSON.parse(content);
      // Ensure all tables exist
      const tables = ['users', 'clients', 'products', 'rooms', 'settings', 'contracts', 'movements', 'locations', 'invoices'];
      tables.forEach(t => {
        if (!dbData[t]) dbData[t] = [];
      });
      // Ensure default users and settings exist if table empty
      if (dbData.users.length === 0) dbData.users = [...defaultUsers];
      if (dbData.settings.length === 0) dbData.settings = [...defaultSettings];
    } else {
      saveDb();
    }
  } catch (err) {
    console.error('Failed to load mock database, starting fresh:', err);
    saveDb();
  }
}

// Main query emulator function
async function query(sql, params) {
  loadDb(); // load fresh state
  const cleanSql = sql.replace(/\s+/g, ' ').trim();
  const lowerSql = cleanSql.toLowerCase();

  // 1. Transaction controls
  if (lowerSql === 'begin' || lowerSql === 'commit' || lowerSql === 'rollback') {
    return { rows: [], rowCount: 0 };
  }

  // 2. Schema check / column check metadata queries
  if (lowerSql.includes('information_schema.columns') || lowerSql.includes('pg_constraint') || lowerSql.includes('pg_class')) {
    if (lowerSql.includes("table_name='contracts'") || lowerSql.includes("table_name = 'contracts'")) {
      return {
        rows: [
          { column_name: 'id' }, { column_name: 'date' }, { column_name: 'clientid' }, { column_name: 'type' },
          { column_name: 'nbcaisse' }, { column_name: 'caution' }, { column_name: 'avance' }, { column_name: 'periode' },
          { column_name: 'signature' }, { column_name: 'signedat' }, { column_name: 'status' },
          { column_name: 'husbandName' }, { column_name: 'husbandCin' }, { column_name: 'husbandDob' }, { column_name: 'husbandEmail' },
          { column_name: 'wifeName' }, { column_name: 'wifeCin' }, { column_name: 'wifeDob' }, { column_name: 'wifeEmail' },
          { column_name: 'witness1Name' }, { column_name: 'witness1Cin' }, { column_name: 'witness2Name' }, { column_name: 'witness2Cin' },
          { column_name: 'dowry' }, { column_name: 'regimeOption' }, { column_name: 'husbandSignature' }, { column_name: 'wifeSignature' },
          { column_name: 'husbandSignedAt' }, { column_name: 'wifeSignedAt' }
        ]
      };
    }
    if (lowerSql.includes("table_name='movements'")) {
      return {
        rows: [
          { column_name: 'id' }, { column_name: 'date' }, { column_name: 'clientid' }, { column_name: 'type' },
          { column_name: 'productid' }, { column_name: 'nbcaisse' }, { column_name: 'roomid' }, { column_name: 'poidsbrut' },
          { column_name: 'prixunitaire' }, { column_name: 'poidsnet' }, { column_name: 'montanttotal' }, { column_name: 'taxe' },
          { column_name: 'nbcaisseretournees' }, { column_name: 'loyer' }, { column_name: 'cautionappliquee' }, { column_name: 'caution' },
          { column_name: 'paymentstatus' }, { column_name: 'updatedat' }, { column_name: 'updatedby' }
        ]
      };
    }
    if (lowerSql.includes("table_name='users'")) {
      return {
        rows: [
          { column_name: 'id' }, { column_name: 'email' }, { column_name: 'password' }, { column_name: 'role' }, { column_name: 'permissions' }
        ]
      };
    }
    return { rows: [] };
  }

  // 3. Alter queries
  if (lowerSql.startsWith('alter table')) {
    return { rows: [], rowCount: 0 };
  }

  // 4. Truncate queries (reset-data)
  if (lowerSql.includes('truncate table') || lowerSql.includes('truncate') || lowerSql.startsWith('delete from')) {
    const tableMatch = cleanSql.match(/(?:truncate(?:\s+table)?|delete\s+from)\s+([a-zA-Z0-9_]+)/i);
    if (tableMatch) {
      const tableName = tableMatch[1].toLowerCase();
      if (dbData[tableName]) {
        dbData[tableName] = [];
        saveDb();
      }
    }
    return { rows: [], rowCount: 0 };
  }

  // 5. Select queries with specific aggregation
  if (lowerSql.includes('sum(nbcaisse)') || lowerSql.includes('sum(nbcaisse)')) {
    let sumVal = 0;
    if (lowerSql.includes('from movements')) {
      const clientId = params ? params[0] : null;
      let filtered = dbData.movements;
      if (lowerSql.includes('clientid = $1') && clientId) {
        filtered = filtered.filter(row => (row.clientid || row.clientId || '').toLowerCase() === clientId.toLowerCase());
      }
      if (lowerSql.includes("type = 'caisses vides'")) {
        filtered = filtered.filter(row => row.type === 'Caisses vides');
      } else if (lowerSql.includes("type = 'retour caisses vides'")) {
        filtered = filtered.filter(row => row.type === 'Retour caisses vides');
      } else if (lowerSql.includes("type in")) {
        const match = lowerSql.match(/type\s+in\s*\(([^)]+)\)/i);
        if (match) {
          const typesList = match[1].split(',').map(t => t.trim().replace(/['"]/g, '').toLowerCase());
          filtered = filtered.filter(row => row.type && typesList.includes(row.type.toLowerCase()));
        }
      }
      sumVal = filtered.reduce((acc, row) => acc + (Number(row.nbcaisse || row.nbCaisse) || 0), 0);
    } else if (lowerSql.includes('from locations')) {
      const clientId = params ? params[0] : null;
      let filtered = dbData.locations;
      if (lowerSql.includes('clientid = $1') && clientId) {
        filtered = filtered.filter(row => (row.clientid || row.clientId || '').toLowerCase() === clientId.toLowerCase());
      }
      if (lowerSql.includes('roomid = $1') && params) {
        const roomId = params[0];
        filtered = dbData.locations.filter(row => (row.roomid || row.roomId || '').toLowerCase() === roomId.toLowerCase());
      }
      if (lowerSql.includes("status = 'en cours'")) {
        filtered = filtered.filter(row => row.status === 'En cours');
      }
      sumVal = filtered.reduce((acc, row) => acc + (Number(row.nbcaisse || row.nbCaisse) || 0), 0);
    }
    
    const keyMatch = cleanSql.match(/as\s+(\w+)/i);
    const keyName = keyMatch ? keyMatch[1].toLowerCase() : 'sum';
    return { rows: [{ [keyName]: sumVal }] };
  }

  // COUNT queries
  if (lowerSql.includes('select count(*)')) {
    if (lowerSql.includes('from users')) {
      const role = params ? params[0] : null;
      const count = dbData.users.filter(u => u.role === role).length;
      return { rows: [{ admincount: count }] };
    }
  }

  // 6. General SELECT queries
  if (lowerSql.startsWith('select')) {
    const fromMatch = cleanSql.match(/from\s+([a-zA-Z0-9_]+)/i);
    if (!fromMatch) return { rows: [] };
    const tableName = fromMatch[1].toLowerCase();
    let rows = dbData[tableName] || [];

    // Filter by WHERE
    if (lowerSql.includes('where')) {
      const wherePart = cleanSql.substring(cleanSql.toLowerCase().indexOf('where') + 5).trim();
      const fieldMatch = wherePart.match(/([a-zA-Z0-9_.]+)\s*=\s*\$(\d+)/);
      if (fieldMatch) {
        let fieldName = fieldMatch[1].split('.').pop().replace(/["'`]/g, '').toLowerCase();
        const paramIdx = parseInt(fieldMatch[2]) - 1;
        const paramVal = params ? params[paramIdx] : undefined;
        
        rows = rows.filter(row => {
          const key = Object.keys(row).find(k => k.toLowerCase() === fieldName);
          return key && String(row[key]).toLowerCase() === String(paramVal).toLowerCase();
        });
      }
    }

    // ORDER BY
    if (lowerSql.includes('order by')) {
      const orderPart = lowerSql.substring(lowerSql.indexOf('order by') + 8).trim();
      if (orderPart.includes('date desc')) {
        rows = [...rows].sort((a, b) => new Date(b.date || b.entryDate || 0) - new Date(a.date || a.entryDate || 0));
      }
    }

    // LIMIT
    if (lowerSql.includes('limit')) {
      const limitMatch = lowerSql.match(/limit\s+(\d+)/);
      if (limitMatch) {
        rows = rows.slice(0, parseInt(limitMatch[1]));
      }
    }

    return { rows: JSON.parse(JSON.stringify(rows)), rowCount: rows.length };
  }

  // 7. INSERT queries
  if (lowerSql.startsWith('insert')) {
    const tableMatch = cleanSql.match(/insert\s+into\s+([a-zA-Z0-9_]+)/i);
    if (tableMatch) {
      const tableName = tableMatch[1].toLowerCase();
      const columnsPart = cleanSql.substring(cleanSql.indexOf('(') + 1, cleanSql.indexOf(')'));
      const columns = columnsPart.split(',').map(c => c.trim().replace(/["'`]/g, ''));
      
      const newRecord = {};
      columns.forEach((col, idx) => {
        newRecord[col] = params ? params[idx] : undefined;
      });

      if (!dbData[tableName]) dbData[tableName] = [];
      dbData[tableName].push(newRecord);
      saveDb();
      return { rows: [newRecord], rowCount: 1 };
    }
  }

  // 8. UPDATE queries
  if (lowerSql.startsWith('update')) {
    const tableMatch = cleanSql.match(/update\s+([a-zA-Z0-9_]+)/i);
    if (tableMatch) {
      const tableName = tableMatch[1].toLowerCase();
      const whereIdx = lowerSql.indexOf('where');
      const setPart = cleanSql.substring(cleanSql.toLowerCase().indexOf('set') + 3, whereIdx !== -1 ? whereIdx : cleanSql.length).trim();
      
      const assignments = setPart.split(',').map(a => a.trim());
      const updates = {};
      assignments.forEach(assign => {
        const parts = assign.split('=');
        if (parts.length === 2) {
          const col = parts[0].trim().replace(/["'`]/g, '');
          const paramMatch = parts[1].trim().match(/\$(\d+)/);
          if (paramMatch && params) {
            const idx = parseInt(paramMatch[1]) - 1;
            updates[col] = params[idx];
          } else {
            let val = parts[1].trim();
            if (val.toLowerCase() === 'null') val = null;
            updates[col] = val;
          }
        }
      });

      let updatedCount = 0;
      if (whereIdx !== -1) {
        const wherePart = cleanSql.substring(whereIdx + 5).trim();
        const fieldMatch = wherePart.match(/([a-zA-Z0-9_.]+)\s*=\s*\$(\d+)/);
        if (fieldMatch && params) {
          let fieldName = fieldMatch[1].split('.').pop().replace(/["'`]/g, '').toLowerCase();
          const paramIdx = parseInt(fieldMatch[2]) - 1;
          const paramVal = params[paramIdx];

          dbData[tableName] = (dbData[tableName] || []).map(row => {
            const key = Object.keys(row).find(k => k.toLowerCase() === fieldName);
            if (key && String(row[key]).toLowerCase() === String(paramVal).toLowerCase()) {
              updatedCount++;
              const updatedRow = { ...row };
              Object.keys(updates).forEach(uCol => {
                const existingKey = Object.keys(row).find(k => k.toLowerCase() === uCol.toLowerCase());
                if (existingKey) {
                  updatedRow[existingKey] = updates[uCol];
                } else {
                  updatedRow[uCol] = updates[uCol];
                }
              });
              return updatedRow;
            }
            return row;
          });
        }
      } else {
        dbData[tableName] = (dbData[tableName] || []).map(row => {
          updatedCount++;
          const updatedRow = { ...row };
          Object.keys(updates).forEach(uCol => {
            const existingKey = Object.keys(row).find(k => k.toLowerCase() === uCol.toLowerCase());
            if (existingKey) {
              updatedRow[existingKey] = updates[uCol];
            } else {
              updatedRow[uCol] = updates[uCol];
            }
          });
          return updatedRow;
        });
      }

      saveDb();
      return { rows: [], rowCount: updatedCount };
    }
  }

  // 9. DELETE queries
  if (lowerSql.startsWith('delete')) {
    const tableMatch = cleanSql.match(/delete\s+from\s+([a-zA-Z0-9_]+)/i);
    if (tableMatch) {
      const tableName = tableMatch[1].toLowerCase();
      let deletedCount = 0;
      if (lowerSql.includes('where')) {
        const wherePart = cleanSql.substring(cleanSql.toLowerCase().indexOf('where') + 5).trim();
        const fieldMatch = wherePart.match(/([a-zA-Z0-9_.]+)\s*=\s*\$(\d+)/);
        if (fieldMatch && params) {
          let fieldName = fieldMatch[1].split('.').pop().replace(/["'`]/g, '').toLowerCase();
          const paramIdx = parseInt(fieldMatch[2]) - 1;
          const paramVal = params[paramIdx];

          const originalLength = dbData[tableName].length;
          dbData[tableName] = (dbData[tableName] || []).filter(row => {
            const key = Object.keys(row).find(k => k.toLowerCase() === fieldName);
            return !(key && String(row[key]).toLowerCase() === String(paramVal).toLowerCase());
          });
          deletedCount = originalLength - dbData[tableName].length;
        }
      } else {
        deletedCount = (dbData[tableName] || []).length;
        dbData[tableName] = [];
      }
      saveDb();
      return { rows: [], rowCount: deletedCount };
    }
  }

  return { rows: [], rowCount: 0 };
}

// Resilient database helpers
const isConnectionError = (err) => {
  if (!err) return false;
  const msg = (err.message || '').toLowerCase();
  const code = (err.code || '');
  return (
    code === 'ECONNREFUSED' ||
    code === 'ETIMEDOUT' ||
    code === 'ENOTFOUND' ||
    code === 'EHOSTUNREACH' ||
    code === 'EAI_AGAIN' ||
    msg.includes('connect') ||
    msg.includes('refused') ||
    msg.includes('timeout') ||
    msg.includes('authentication') ||
    msg.includes('password authentication failed')
  );
};

let useLocalFallback = false;

// Pre-load local database in all cases as warm standby
loadDb();

// Global active pool instance
let activePool;

if (process.env.DB_HOST) {
  console.log(`[Database] Connecting to PostgreSQL at ${process.env.DB_HOST}:${process.env.DB_PORT || 5432}...`);
  const realPool = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined
  });

  activePool = {
    query: async (sql, params) => {
      if (useLocalFallback) {
        return query(sql, params);
      }
      try {
        return await realPool.query(sql, params);
      } catch (err) {
        if (isConnectionError(err)) {
          console.warn(`[Database Fallback] PostgreSQL connection failed (${err.message}). Falling back to local data.json storage.`);
          useLocalFallback = true;
          return query(sql, params);
        }
        throw err;
      }
    },
    connect: async () => {
      if (useLocalFallback) {
        return {
          query: async (sql, params) => query(sql, params),
          release: () => {}
        };
      }
      try {
        const client = await realPool.connect();
        const originalClientQuery = client.query;
        client.query = async (sql, params) => {
          try {
            return await originalClientQuery.call(client, sql, params);
          } catch (err) {
            if (isConnectionError(err)) {
              console.warn(`[Database Fallback] Client PG error detected: ${err.message}. Switching to local fallback.`);
              useLocalFallback = true;
              return query(sql, params);
            }
            throw err;
          }
        };
        return client;
      } catch (err) {
        if (isConnectionError(err)) {
          console.warn(`[Database Fallback] PG connect failed: ${err.message}. Switching to local fallback.`);
          useLocalFallback = true;
          return {
            query: async (sql, params) => query(sql, params),
            release: () => {}
          };
        }
        throw err;
      }
    },
    on: (event, handler) => {
      realPool.on(event, handler);
    },
    end: async () => {
      if (realPool && typeof realPool.end === 'function') {
        try {
          await realPool.end();
        } catch (e) {}
      }
    }
  };

  // Self-initializing async function to build schema in PostgreSQL or fallback
  (async () => {
    try {
      console.log('[Database] Checking tables...');
      
      await activePool.query(`
        CREATE TABLE IF NOT EXISTS users (
          id VARCHAR(36) NOT NULL PRIMARY KEY,
          email VARCHAR(255) NOT NULL UNIQUE,
          password VARCHAR(255) NOT NULL,
          role VARCHAR(50) NOT NULL DEFAULT 'user',
          permissions TEXT
        );
      `);
      
      await activePool.query(`
        CREATE TABLE IF NOT EXISTS clients (
          id VARCHAR(36) NOT NULL PRIMARY KEY,
          nom VARCHAR(255) NOT NULL,
          prenom VARCHAR(255) NOT NULL,
          cin VARCHAR(255) NOT NULL UNIQUE,
          telephone VARCHAR(255),
          email VARCHAR(255),
          caissesreservees INTEGER DEFAULT 0
        );
      `);
      
      await activePool.query(`
        CREATE TABLE IF NOT EXISTS products (
          id VARCHAR(36) NOT NULL PRIMARY KEY,
          nom VARCHAR(255) NOT NULL,
          categorie VARCHAR(255) NOT NULL,
          codebarres VARCHAR(255)
        );
      `);
      
      await activePool.query(`
        CREATE TABLE IF NOT EXISTS rooms (
          id VARCHAR(36) NOT NULL PRIMARY KEY,
          nom VARCHAR(255) NOT NULL UNIQUE,
          nbcaisse INTEGER NOT NULL
        );
      `);
      
      await activePool.query(`
        CREATE TABLE IF NOT EXISTS settings (
          id SERIAL PRIMARY KEY,
          companyname VARCHAR(255),
          companyaddress TEXT,
          companywebsite VARCHAR(255),
          companyphone VARCHAR(255),
          companyemail VARCHAR(255),
          companylogo TEXT,
          companysignature TEXT,
          fiscalid VARCHAR(255),
          currencysymbol VARCHAR(10),
          cautionpercrate NUMERIC(10, 2),
          emptycrateweight NUMERIC(10, 2),
          taxrate NUMERIC(5, 2),
          rentpercrateperday NUMERIC(10, 2),
          totalavailablecrates INTEGER,
          rentincreaserate NUMERIC(10, 2) DEFAULT 0,
          increasestartmonth INTEGER DEFAULT 0
        );
      `);

      // Ensure columns exist on existing databases
      try {
        await activePool.query('ALTER TABLE settings ADD COLUMN IF NOT EXISTS rentincreaserate NUMERIC(10, 2) DEFAULT 0;');
        await activePool.query('ALTER TABLE settings ADD COLUMN IF NOT EXISTS increasestartmonth INTEGER DEFAULT 0;');
      } catch (colErr) {
        console.log('[Database] Soft migration warning (could be MySQL or already exists):', colErr.message);
      }
      
      await activePool.query(`
        CREATE TABLE IF NOT EXISTS contracts (
          id VARCHAR(36) NOT NULL PRIMARY KEY,
          date TIMESTAMP NOT NULL,
          clientid VARCHAR(36) NOT NULL,
          type VARCHAR(50) NOT NULL,
          nbcaisse INTEGER NOT NULL,
          caution NUMERIC(10, 2) NOT NULL,
          avance NUMERIC(10, 2) DEFAULT 0,
          periode VARCHAR(255),
          signature TEXT,
          signedat TIMESTAMP NULL,
          status VARCHAR(50) DEFAULT 'En attente'
        );
      `);
      
      await activePool.query(`
        CREATE TABLE IF NOT EXISTS movements (
          id VARCHAR(36) NOT NULL PRIMARY KEY,
          date TIMESTAMP NOT NULL,
          clientid VARCHAR(36) NOT NULL,
          type TEXT NOT NULL,
          productid VARCHAR(36) DEFAULT NULL,
          nbcaisse INTEGER DEFAULT NULL,
          roomid VARCHAR(36) DEFAULT NULL,
          poidsbrut NUMERIC(10, 2) DEFAULT NULL,
          prixunitaire NUMERIC(10, 2) DEFAULT NULL,
          poidsnet NUMERIC(10, 2) DEFAULT NULL,
          montanttotal NUMERIC(10, 2) DEFAULT NULL,
          taxe NUMERIC(10, 2) DEFAULT NULL,
          nbcaisseretournees INTEGER DEFAULT NULL,
          loyer NUMERIC(10, 2) DEFAULT NULL,
          cautionappliquee BOOLEAN DEFAULT NULL,
          caution NUMERIC(10, 2) DEFAULT NULL,
          paymentstatus VARCHAR(50) DEFAULT NULL,
          updatedat TIMESTAMP DEFAULT NULL,
          updatedby VARCHAR(255) DEFAULT NULL
        );
      `);
      
      await activePool.query(`
        CREATE TABLE IF NOT EXISTS locations (
          id VARCHAR(36) NOT NULL PRIMARY KEY,
          clientid VARCHAR(36) NOT NULL,
          productid VARCHAR(36) NOT NULL,
          roomid VARCHAR(36) NOT NULL,
          nbcaisse INTEGER NOT NULL,
          initialnbcaisse INTEGER NOT NULL,
          entrydate TIMESTAMP NOT NULL,
          exitdate TIMESTAMP,
          status VARCHAR(50) NOT NULL DEFAULT 'En cours'
        );
      `);
      
      await activePool.query(`
        CREATE TABLE IF NOT EXISTS invoices (
          id VARCHAR(36) NOT NULL PRIMARY KEY,
          date TIMESTAMP NOT NULL,
          clientid VARCHAR(36) NOT NULL,
          type TEXT NOT NULL,
          montanttotal NUMERIC(10, 2) DEFAULT NULL,
          loyer NUMERIC(10, 2) DEFAULT NULL,
          caution NUMERIC(10, 2) DEFAULT NULL,
          paymentstatus VARCHAR(50) DEFAULT NULL
        );
      `);
      
      await activePool.query(`
        CREATE TABLE IF NOT EXISTS avances (
          id VARCHAR(36) NOT NULL PRIMARY KEY,
          date TIMESTAMP NOT NULL,
          clientid VARCHAR(36) NOT NULL,
          amount NUMERIC(10, 2) NOT NULL,
          paymentmethod VARCHAR(50) DEFAULT 'Espèces',
          contractid VARCHAR(36) DEFAULT NULL,
          notes TEXT
        );
      `);
      
      await activePool.query(`
        CREATE TABLE IF NOT EXISTS reglements (
          id VARCHAR(36) NOT NULL PRIMARY KEY,
          date TIMESTAMP NOT NULL,
          clientid VARCHAR(36) NOT NULL,
          amount NUMERIC(10, 2) NOT NULL,
          paymentmethod VARCHAR(50) DEFAULT 'Espèces',
          reference VARCHAR(255) DEFAULT '',
          invoiceid VARCHAR(36) DEFAULT NULL,
          notes TEXT
        );
      `);

      await activePool.query(`
        CREATE TABLE IF NOT EXISTS movement_audits (
          id VARCHAR(36) NOT NULL PRIMARY KEY,
          movement_id VARCHAR(36) NOT NULL,
          action_type VARCHAR(50) NOT NULL,
          changed_by VARCHAR(255) NOT NULL,
          changed_at TIMESTAMP NOT NULL,
          old_values TEXT,
          new_values TEXT
        );
      `);

      // Seed default values
      const adminCheck = await activePool.query("SELECT id FROM users WHERE email = 'admin@example.com'");
      if (adminCheck.rows.length === 0) {
        console.log('[Database] Seeding default admin user...');
        await activePool.query(
          "INSERT INTO users (id, email, password, role, permissions) VALUES ($1, $2, $3, $4, $5)",
          ['admin-uuid-placeholder', 'admin@example.com', '$2a$10$RvGBSWUp.Bz7JwRKND7Xx.BBUTJ6PMCaWYcZ5ywVyVZ7D9w8k37.u', 'admin', null]
        );
      }

      const userCheck = await activePool.query("SELECT id FROM users WHERE email = 'user@example.com'");
      if (userCheck.rows.length === 0) {
        console.log('[Database] Seeding default employee user...');
        const defaultUserPerms = JSON.stringify({
          dashboard: true,
          clients: true,
          products: true,
          rooms: true,
          locations: false,
          ventes: true,
          movements: true,
          factures: false,
          reports: false
        });
        await activePool.query(
          "INSERT INTO users (id, email, password, role, permissions) VALUES ($1, $2, $3, $4, $5)",
          ['user-uuid-placeholder', 'user@example.com', '$2a$10$NCZCli/fMvHhJcCCXdZ8k.BnOqZGK8EoyvWjIOth/7RMmMFaw81A.', 'user', defaultUserPerms]
        );
      }

      const settingsCheck = await activePool.query("SELECT id FROM settings LIMIT 1");
      if (settingsCheck.rows.length === 0) {
        console.log('[Database] Seeding default settings...');
        await activePool.query(
          `INSERT INTO settings (id, companyname, companyaddress, companywebsite, companyphone, companyemail, companylogo, companysignature, fiscalid, currencysymbol, cautionpercrate, emptycrateweight, taxrate, rentpercrateperday, totalavailablecrates, rentincreaserate, increasestartmonth) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
          [
            1,
            'Frigo Inc.',
            '123 Rue de la Glace, 75001 Paris, France',
            'www.frigo-inc.com',
            '0123456789',
            'admin@example.com',
            '',
            '',
            'FR123456789',
            'DT',
            15.00,
            1.2,
            19.0,
            0.50,
            1000,
            0,
            0
          ]
        );
      }

      console.log('✅ [Database] Setup check and initialization complete!');
    } catch (err) {
      console.error('❌ [Database] Failed setup check:', err.message);
    }
  })();
} else {
  console.log('[Database] No DB_HOST specified. Falling back to local emulated JSON database (backend/data.json).');
  useLocalFallback = true;
  
  activePool = {
    connect: async () => ({
      query: async (sql, params) => query(sql, params),
      release: () => {}
    }),
    query: async (sql, params) => query(sql, params),
    on: () => {},
    end: () => {}
  };
}

module.exports = activePool;
