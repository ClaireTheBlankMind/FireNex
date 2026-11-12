
const DB_NAME = "firenex_offline";
const DB_VERSION = 1;

const TABLES = ["sensors", "incidents", "units", "sync_queue"];

let dbPromise = null;

export function initDB() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("IndexedDB is not supported by this browser."));
      dbPromise = null;
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const database = event.target.result;

      TABLES.forEach((table) => {
        if (!database.objectStoreNames.contains(table)) {
          database.createObjectStore(table, {
            keyPath: "id",
          });
        }
      });
    };

    request.onsuccess = () => {
      const database = request.result;

      database.onversionchange = () => {
        database.close();
        dbPromise = null;
      };

      resolve(database);
    };

    request.onerror = () => {
      dbPromise = null;
      reject(request.error);
    };

    request.onblocked = () => {
      console.warn("FireNex database upgrade is blocked by another tab.");
    };
  });

  return dbPromise;
}

export async function getDB() {
  return initDB();
}

export async function closeDB() {
  if (!dbPromise) return;

  try {
    const database = await dbPromise;
    database.close();
  } finally {
    dbPromise = null;
  }
}

function validateTable(tableName) {
  if (!TABLES.includes(tableName)) {
    throw new Error(`Invalid FireNex storage table: ${tableName}`);
  }
}

export async function saveDataToTable(tableName, dataArray) {
  validateTable(tableName);

  const database = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(tableName, "readwrite");
    const store = transaction.objectStore(tableName);

    store.clear();

    (dataArray || []).forEach((item) => {
      const id = item.id ?? item.sensor_id ?? item.dbId;

      if (id == null) {
        console.warn("Skipped record without an ID:", item);
        return;
      }

      store.put({
        ...item,
        id: String(id),
      });
    });

    transaction.oncomplete = () => {
      resolve(true);
    };

    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

export async function getDataFromTable(tableName) {
  validateTable(tableName);

  const database = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(tableName, "readonly");
    const request = transaction.objectStore(tableName).getAll();

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

// Add an offline operation without deleting existing pending operations.
export async function addToSyncQueue(operation) {
  const database = await initDB();

  const id = operation.id || crypto.randomUUID();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction("sync_queue", "readwrite");

    transaction.objectStore("sync_queue").put({
      ...operation,
      id,
      created_at: new Date().toISOString(),
      status: "pending",
    });

    transaction.oncomplete = () => resolve(id);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

export async function getSyncQueue() {
  return getDataFromTable("sync_queue");
}

export async function removeFromSyncQueue(id) {
  const database = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction("sync_queue", "readwrite");

    transaction.objectStore("sync_queue").delete(String(id));

    transaction.oncomplete = () => resolve(true);
    transaction.onerror = () => reject(transaction.error);
  });
}
