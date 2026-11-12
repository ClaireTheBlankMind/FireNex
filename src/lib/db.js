import initSqlJs from 'sql.js';

let db = null;

export async function initDB() {
  if (db) return db;

  // Locate the wasm file in the public folder
  const SQL = await initSqlJs({
    locateFile: file => `/assets/${file}` 
  });

  // Check if we have a saved database in localStorage
  const savedData = localStorage.getItem('firenex_db');
  
  if (savedData) {
    // Load existing database from binary string
    const u8 = new Uint8Array(JSON.parse(savedData));
    db = new SQL.Database(u8);
  } else {
    // Create a new database
    db = new SQL.Database();
    // Create tables
    db.run(`
      CREATE TABLE IF NOT EXISTS incidents (id TEXT PRIMARY KEY, data TEXT);
      CREATE TABLE IF NOT EXISTS sensors (id TEXT PRIMARY KEY, data TEXT);
      CREATE TABLE IF NOT EXISTS units (id TEXT PRIMARY KEY, data TEXT);
    `);
    saveDB();
  }

  return db;
}

// Save the database to localStorage
export function saveDB() {
  if (!db) return;
  const data = db.export();
  const array = Array.from(data);
  localStorage.setItem('firenex_db', JSON.stringify(array));
}

// Helper to save array of objects
export function saveDataToTable(tableName, dataArray) {
  if (!db) return;
  // Clear existing table to avoid duplicates
  db.run(`DELETE FROM ${tableName}`);
  
  const stmt = db.prepare(`INSERT INTO ${tableName} (id, data) VALUES (?, ?)`);
  dataArray.forEach(item => {
    stmt.run([item.id || item.sensor_id || item.dbId, JSON.stringify(item)]);
  });
  stmt.free();
  saveDB();
}

// Helper to load array of objects
export function getDataFromTable(tableName) {
  if (!db) return [];
  const stmt = db.prepare(`SELECT data FROM ${tableName}`);
  const results = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    results.push(JSON.parse(row.data));
  }
  stmt.free();
  return results;
}