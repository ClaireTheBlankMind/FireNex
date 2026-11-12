
let db = null;
let initPromise = null;

export async function initDB() {
  if (db) return db;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      // Wait for WASM to be available
      if (!window.initSqlJs) {
        throw new Error("initSqlJs not loaded — check that /sql-wasm.js was loaded via script tag");
      }

      const SQL = await window.initSqlJs({
        locateFile: (file) => `/${file}`,
      });
      // ... rest unchanged
    } catch (error) {
      console.error("Failed to initialize SQLite DB:", error);
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