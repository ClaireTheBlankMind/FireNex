// src/lib/offlineCache.js
import { supabase } from './supabase';

// Replace these with your actual SQLite logic
// Assuming you have an initialized db instance
export async function getCachedData(tableName) {
  // Example: return db.exec(`SELECT * FROM ${tableName}`);
  console.log(`Loading ${tableName} from local SQLite cache...`);
  return []; 
}

export async function saveDataToCache(tableName, data) {
  // Example: db.run(`INSERT OR REPLACE INTO ${tableName} ...`, data);
  console.log(`Saved ${data.length} records to ${tableName} cache.`);
}

// A wrapper function for your Supabase fetches
export async function fetchWithCache(tableName, supabaseQuery) {
  if (navigator.onLine) {
    try {
      const { data, error } = await supabaseQuery;
      if (error) throw error;
      
      // Save the fresh data to SQLite for offline use
      if (data && data.length > 0) {
        await saveDataToCache(tableName, data);
      }
      return data;
    } catch (err) {
      console.error(`Supabase fetch failed for ${tableName}, falling back to cache.`, err);
      return await getCachedData(tableName);
    }
  } else {
    // If offline, go straight to cache
    return await getCachedData(tableName);
  }
}