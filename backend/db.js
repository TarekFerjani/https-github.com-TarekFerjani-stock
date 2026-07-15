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
    totalavailablecrates: 1000
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

// Initial load
loadDb();

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

const pool = {
  connect: async () => ({
    query: async (sql, params) => query(sql, params),
    release: () => {}
  }),
  query: async (sql, params) => query(sql, params),
  on: () => {},
  end: () => {}
};

module.exports = pool;