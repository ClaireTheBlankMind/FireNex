import initSqlJs from 'sql.js';
import wasmUrl from "../assets/sql-wasm.wasm?url";

let db = null;
let initPromise = null;

export async function initDB() {
  if (db) return db;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      // sql.js 1.16+ may wrap the default export; normalize it
      const initFn =
        typeof initSqlJs === 'function'
          ? initSqlJs
          : initSqlJs.default || initSqlJs.initSqlJs;

      if (typeof initFn !== 'function') {
        throw new Error('initSqlJs is not a function — check sql.js import');
      }

      const SQL = await initFn({
        locateFile: () => wasmUrl,
      });

      const savedData = localStorage.getItem('firenex_db');

      if (savedData) {
        try {
          const u8 = new Uint8Array(JSON.parse(savedData));
          db = new SQL.Database(u8);
          console.log('SQLite DB loaded from localStorage.');
        } catch (err) {
          console.warn('Corrupted DB in localStorage, creating new DB.', err);
          localStorage.removeItem('firenex_db');
          db = new SQL.Database();
        }
      } else {
        db = new SQL.Database();
        console.log('Created new SQLite DB.');
      }

      db.run(`
        CREATE TABLE IF NOT EXISTS incidents (id TEXT PRIMARY KEY, data TEXT);
        CREATE TABLE IF NOT EXISTS sensors (id TEXT PRIMARY KEY, data TEXT);
        CREATE TABLE IF NOT EXISTS units (id TEXT PRIMARY KEY, data TEXT);
      `);

      saveDB();
      return db;
    } catch (error) {
      console.error('Failed to initialize SQLite DB:', error);
      initPromise = null;
      throw error;
    }
  })();

  return initPromise;
}

export function saveDB() {
  if (!db) return;
  try {
    const data = db.export();
    const array = Array.from(data);
    localStorage.setItem('firenex_db', JSON.stringify(array));
  } catch (err) {
    console.error('Failed to save DB to localStorage:', err);
  }
}

export function saveDataToTable(tableName, dataArray) {
  if (!db) {
    console.warn(`Cannot save to ${tableName}: DB not initialized.`);
    return;
  }

  try {
    db.run(`DELETE FROM ${tableName}`);

    if (dataArray && dataArray.length > 0) {
      const stmt = db.prepare(
        `INSERT INTO ${tableName} (id, data) VALUES (?, ?)`
      );
      dataArray.forEach((item) => {
        const id =
          item.id || item.sensor_id || item.dbId || `gen_${Math.random()}`;
        stmt.run([String(id), JSON.stringify(item)]);
      });
      stmt.free();
    }

    saveDB();
    console.log(`Saved ${dataArray?.length || 0} records to ${tableName}.`);
  } catch (err) {
    console.error(`Failed to save data to ${tableName}:`, err);
  }
}

export function getDataFromTable(tableName) {
  if (!db) {
    console.warn(`Cannot read from ${tableName}: DB not initialized.`);
    return [];
  }

  try {
    const stmt = db.prepare(`SELECT data FROM ${tableName}`);
    const results = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      try {
        results.push(JSON.parse(row.data));
      } catch (parseErr) {
        console.warn('Skipped invalid JSON row:', parseErr);
      }
    }
    stmt.free();
    return results;
  } catch (err) {
    console.error(`Failed to read from ${tableName}:`, err);
    return [];
  }
}