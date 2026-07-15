const pool = require('../db');
const table = process.argv[2];
if (!table) { console.error('Usage: node list_columns.js <table>'); process.exit(1); }
(async ()=>{
  try {
    const res = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position`, [table]);
    console.log(res.rows.map(r=>r.column_name));
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    try { await pool.end(); } catch(e){}
  }
})();
