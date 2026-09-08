// ============================================================
// db.js - قاعدة بيانات محلية (IndexedDB) تعمل بدون إنترنت
// ============================================================
const DB_NAME = "laundry_pro_db";
const DB_VERSION = 1;

const STORES = {
  settings: "settings",           // key = setting name
  orders: "orders",               // invoices or customer orders {id, ...}
  customers: "customers",         // customers {id, name, phone, ...}
  plans: "plans",                 // subscription plans
  subscriptions: "subscriptions", // active subscriptions
  expenses: "expenses"            // accountant expenses
};

let db = null;

function openDB() {
  return new Promise((resolve, reject) => {
    if (db) return resolve(db);
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const d = e.target.result;
      if (!d.objectStoreNames.contains(STORES.settings)) d.createObjectStore(STORES.settings);
      if (!d.objectStoreNames.contains(STORES.orders)) d.createObjectStore(STORES.orders, { keyPath: "id" });
      if (!d.objectStoreNames.contains(STORES.customers)) d.createObjectStore(STORES.customers, { keyPath: "id" });
      if (!d.objectStoreNames.contains(STORES.plans)) d.createObjectStore(STORES.plans, { keyPath: "id" });
      if (!d.objectStoreNames.contains(STORES.subscriptions)) d.createObjectStore(STORES.subscriptions, { keyPath: "id" });
      if (!d.objectStoreNames.contains(STORES.expenses)) d.createObjectStore(STORES.expenses, { keyPath: "id" });
    };
    req.onsuccess = (e) => { db = e.target.result; resolve(db); };
    req.onerror = (e) => { console.error("IndexedDB error", e); reject(e); };
  });
}

function txStore(storeName, mode) {
  return db.transaction(storeName, mode).objectStore(storeName);
}

// ---------- عام ----------
async function dbPut(storeName, value) {
  await openDB();
  return new Promise((resolve, reject) => {
    const r = txStore(storeName, "readwrite").put(value);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

async function dbGet(storeName, key) {
  await openDB();
  return new Promise((resolve, reject) => {
    const r = txStore(storeName, "readonly").get(key);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

async function dbGetAll(storeName) {
  await openDB();
  return new Promise((resolve, reject) => {
    const r = txStore(storeName, "readonly").getAll();
    r.onsuccess = () => resolve(r.result || []);
    r.onerror = () => reject(r.error);
  });
}

async function dbDel(storeName, key) {
  await openDB();
  return new Promise((resolve, reject) => {
    const r = txStore(storeName, "readwrite").delete(key);
    r.onsuccess = () => resolve();
    r.onerror = () => reject(r.error);
  });
}

// ---------- إعدادات ----------
async function setSetting(key, value) {
  await dbPut(STORES.settings, { key: key, value: value });
}

async function getSetting(key, fallback) {
  const rec = await dbGet(STORES.settings, key);
  return rec ? rec.value : fallback;
}

async function getSettings(keys) {
  const out = {};
  for (const k of keys) out[k.key] = await getSetting(k.key, k.fallback);
  return out;
}

// ---------- بيانات أولية ----------
async function initDB(defaults) {
  await openDB();
  // إعدادات افتراضية
  const existing = await getSetting("seeded", false);
  if (!existing) {
    for (const key of Object.keys(defaults.settings)) {
      const cur = await getSetting(key, null);
      if (cur === null) await setSetting(key, defaults.settings[key]);
    }
    // الخطط الافتراضية
    const plans = await dbGetAll(STORES.plans);
    if (plans.length === 0) {
      for (const p of defaults.plans) await dbPut(STORES.plans, p);
    }
    await setSetting("seeded", true);
  }
}

// ---------- تصدير / استيراد ----------
async function exportAllData() {
  const data = {};
  for (const s of Object.values(STORES)) {
    data[s] = await dbGetAll(s);
  }
  return JSON.stringify(data, null, 2);
}

async function importAllData(json) {
  const data = JSON.parse(json);
  // مسح
  for (const s of Object.values(STORES)) {
    const all = await dbGetAll(s);
    for (const rec of all) await dbDel(s, rec.key !== undefined ? rec.key : rec.id);
  }
  // إدخال
  for (const s of Object.values(STORES)) {
    const list = data[s] || [];
    for (const rec of list) {
      if (s === STORES.settings) await setSetting(rec.key, rec.value);
      else await dbPut(s, rec);
    }
  }
}

async function resetAllData() {
  for (const s of Object.values(STORES)) {
    const all = await dbGetAll(s);
    for (const rec of all) {
      const k = rec.key !== undefined ? rec.key : rec.id;
      await dbDel(s, k);
    }
  }
}