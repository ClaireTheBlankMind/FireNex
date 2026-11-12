
let db = null;
let initPromise = null;

export async function initDB() {
  if (db) return db;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      // Wait for WASM loader to be available
      if (!window.initSqlJs) {
        throw new Error(
          "initSqlJs not loaded — check that /sql-wasm.js was loaded via script tag"
        );
      }

      // Point to the local .wasm file (bundled with your app).
      // Do NOT rely on a CDN — that's what causes ERR_INTERNET_DISCONNECTED.
      const SQL = await window.initSqlJs({
        locateFile: (file) => {
          // Resolve relative to the current page/app base URL
          const base = (typeof import.meta !== "undefined" && import.meta.env?.BASE_URL) || "/";
          return `${base.replace(/\/$/, "")}/${file}`;
        },
      });

      db = new SQL.Database();
      return db;
    } catch (error) {
      console.error("Failed to initialize SQLite DB:", error);
      initPromise = null; // allow retry
      db = null;
      throw error;
    }
  })();

  return initPromise;
}

export function getDB() {
  if (!db) throw new Error("DB not initialized — call initDB() first");
  return db;
}

export function closeDB() {
  if (db) {
    db.close();
    db = null;
  }
  initPromise = null;
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