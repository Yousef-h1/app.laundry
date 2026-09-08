/* ============================================================
 * DB.js — Offline IndexedDB layer
 * Stores: customers, invoices, transactions, subscriptions,
 *         subPayments, services, settings
 * ============================================================ */
(function (window) {
    'use strict';
const DB_NAME = 'laundry-pro-db';

    const DB_VERSION = 3;

    const DEFAULT_SERVICES = [
        { id: 1,  nameAr: 'عباية بالبخار',      nameEn: 'Abaya Steam',     cat: 'general', wash: 1.000, iron: 0.500, manual: false },
        { id: 2,  nameAr: 'شيلة / حجاب',        nameEn: 'Hijab',           cat: 'general', wash: 0.200, iron: 0.200, manual: false },
        { id: 3,  nameAr: 'غترة',               nameEn: 'Ghutra',          cat: 'general', wash: 0.400, iron: 0.200, manual: false },
        { id: 4,  nameAr: 'بشت',                nameEn: 'Bisht',           cat: 'general', wash: 1.000, iron: 0.500, manual: false },
        { id: 5,  nameAr: 'جاكيت بالبخار',      nameEn: 'Jacket Steam',    cat: 'general', wash: 0.800, iron: 0.000, manual: false },
        { id: 6,  nameAr: 'فوطة استحمام',       nameEn: 'Towel',           cat: 'general', wash: 0.600, iron: 0.000, manual: false },
        { id: 7,  nameAr: 'ثوب',                nameEn: 'Thobe',           cat: 'mens',    wash: 0.500, iron: 0.150, manual: false },
        { id: 8,  nameAr: 'ثوب بالبخار',        nameEn: 'Thobe Steam',     cat: 'mens',    wash: 0.600, iron: 0.200, manual: false },
        { id: 9,  nameAr: 'بنطلون طويل',        nameEn: 'Trouser',         cat: 'mens',    wash: 0.600, iron: 0.300, manual: false },
        { id: 10, nameAr: 'بنطلون قصير',        nameEn: 'Shorts',          cat: 'mens',    wash: 0.400, iron: 0.200, manual: false },
        { id: 11, nameAr: 'بدلة عسكرية',        nameEn: 'Uniform',         cat: 'mens',    wash: 1.000, iron: 0.400, manual: false },
        { id: 12, nameAr: 'فانيلة',             nameEn: 'T-Shirt',         cat: 'mens',    wash: 0.400, iron: 0.200, manual: false },
        { id: 13, nameAr: 'فانيلة داخلية',      nameEn: 'Undershirt',      cat: 'mens',    wash: 0.200, iron: 0.000, manual: false },
        { id: 14, nameAr: 'كلسون',              nameEn: 'Underwear',       cat: 'mens',    wash: 0.200, iron: 0.000, manual: false },
        { id: 15, nameAr: 'جوارب',              nameEn: 'Socks',           cat: 'mens',    wash: 0.100, iron: 0.000, manual: false },
        { id: 16, nameAr: 'قميص بيت نسائي',     nameEn: 'House Dress',     cat: 'ladies',  wash: 0.600, iron: 0.400, manual: false },
        { id: 17, nameAr: 'تنورة',              nameEn: 'Skirt',           cat: 'ladies',  wash: 0.600, iron: 0.300, manual: false },
        { id: 18, nameAr: 'غطاء سرير فردي',     nameEn: 'Single Bed Cover',cat: 'bedding', wash: 0.500, iron: 0.000, manual: false },
        { id: 19, nameAr: 'غطاء سرير مزدوج',    nameEn: 'Double Bed Cover',cat: 'bedding', wash: 0.800, iron: 0.000, manual: false },
        { id: 20, nameAr: 'بطانية كبيرة',       nameEn: 'Large Blanket',   cat: 'bedding', wash: 2.000, iron: 0.000, manual: false },
        { id: 21, nameAr: 'بطانية صغيرة',       nameEn: 'Small Blanket',   cat: 'bedding', wash: 1.500, iron: 0.000, manual: false },
        { id: 22, nameAr: 'غطاء مخدة',          nameEn: 'Pillow Case',     cat: 'bedding', wash: 0.200, iron: 0.000, manual: false },
        { id: 23, nameAr: 'ستارة 2م',           nameEn: 'Curtain 2m',      cat: 'bedding', wash: 1.000, iron: 0.000, manual: false },
        { id: 24, nameAr: 'سجاد 2م',            nameEn: 'Carpet 2m',       cat: 'bedding', wash: 1.000, iron: 0.000, manual: false },
        { id: 25, nameAr: 'فستان',              nameEn: 'Dress',           cat: 'manual',  wash: 0,     iron: 0,     manual: true  },
        { id: 26, nameAr: 'بدلة رسمية',         nameEn: 'Suit',            cat: 'manual',  wash: 0,     iron: 0,     manual: true  },
        { id: 27, nameAr: 'شنطة',               nameEn: 'Bag',             cat: 'manual',  wash: 0,     iron: 0,     manual: true  },
        { id: 28, nameAr: 'حذاء',               nameEn: 'Shoes',           cat: 'manual',  wash: 2.000, iron: 0.000, manual: false },
        { id: 29, nameAr: 'قبعة',               nameEn: 'Cap',             cat: 'manual',  wash: 0.200, iron: 0.000, manual: false },
        { id: 30, nameAr: 'خدمة أخرى',          nameEn: 'Other Service',   cat: 'manual',  wash: 0,     iron: 0,     manual: true  }
    ];

    const DEFAULT_SETTINGS = {
        shopName:       { value: 'Premium Service Laundry' },
        shopPhone:      { value: '35310880' },
        shopAddr:       { value: 'مملكة البحرين - البديع' },
        crNo:           { value: '177368-2' },
        currency:       { value: 'BHD' },
        countryCode:    { value: '973' },
        appPassword:    { value: '0005' },
        language:       { value: 'ar' },
        nextInvNo:      { value: 1001 },
        // ---- VAT ----
        taxEnabled:     { value: 'true' },
        taxRate:        { value: '10' },
        taxNo:          { value: '' },
        // ---- Evolution WhatsApp API ----
        evoServerUrl:   { value: 'http://localhost:8080' },
        evoInstance:    { value: 'default' },
        evoApiKey:      { value: '' },
        evoConnected:   { value: 'false' },
        // ---- messages (templates) ----
        msgReady:       { value: 'عميلنا العزيز 🤍\nتم الانتهاء من تجهيز ملابسك بعناية،\nوهي الآن جاهزة للاستلام من مغسلة الخدمة المميزة ✨\nنتمنى أن تنال رضاك .' },
        msgInvoice:     { value: '' },
        msgReminder:    { value: '' },
        msgSubReminder: { value: '' }
    };

    /* ------------------ helpers ------------------ */
    function promisify(request) {
        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    function txDone(tx) {
        return new Promise((resolve, reject) => {
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => reject(tx.error);
            tx.onabort = () => reject(tx.error);
        });
    }

    /* ------------------ fallback (localStorage) ------------------
     * Used when IndexedDB is unavailable/blocked so the app still
     * opens (login + basic operations). Data is best-effort local. */
    let _useFallback = false;
    let _fbOnce = false;

    function _lsList(store) {
        try { return JSON.parse(localStorage.getItem('laundry_pro2_' + store) || '[]') || []; }
        catch (e) { return []; }
    }
    function _lsSave(store, arr) {
        try { localStorage.setItem('laundry_pro2_' + store, JSON.stringify(arr)); } catch (e) { /* no storage */ }
    }
    function _fbKey(store) { return store === 'settings' ? 'key' : 'id'; }

    /* ------------------ global unique ids ------------------
     * Records synced across devices need ids that never collide.
     * id = deviceToken * 1e9 + per-store sequence   (safe integer) */
    const AUTO_ID_STORES = ['customers', 'invoices', 'transactions', 'subscriptions', 'subPayments'];
    let _metaCache = null;

    function _metaLoad() {
        if (_metaCache) return;
        try { _metaCache = JSON.parse(localStorage.getItem('laundry_pro_sync_meta') || 'null'); }
        catch (e) { _metaCache = null; }
        if (!_metaCache || typeof _metaCache !== 'object' || !_metaCache.tok) {
            _metaCache = { tok: Math.floor(Math.random() * 90000) + 10000, seq: {} };
        }
    }
    function _metaSave() {
        try { localStorage.setItem('laundry_pro_sync_meta', JSON.stringify(_metaCache)); } catch (e) { /* no storage */ }
    }
    function genGlobalId(store) {
        _metaLoad();
        _metaCache.seq[store] = (_metaCache.seq[store] || 0) + 1;
        _metaSave();
        return _metaCache.tok * 1000000000 + _metaCache.seq[store];
    }

    function _fbGetAll(store) { return Promise.resolve(_lsList(store)); }
    function _fbGet(store, key) {
        const arr = _lsList(store), k = _fbKey(store);
        return Promise.resolve(arr.find(r => String(r[k]) === String(key)));
    }
    function _fbPut(store, rec) {
        const arr = _lsList(store), k = _fbKey(store);
        const i = arr.findIndex(r => String(r[k]) === String(rec[k]));
        if (i >= 0) arr[i] = rec; else arr.push(rec);
        _lsSave(store, arr);
        return Promise.resolve(rec[k]);
    }
    function _fbAdd(store, rec) {
        const arr = _lsList(store), k = _fbKey(store);
        let id = rec[k];
        if (id === undefined || id === null) {
            let mx = 0;
            arr.forEach(r => { const n = Number(r[k]); if (!isNaN(n) && n > mx) mx = n; });
            id = mx + 1; rec[k] = id;
        } else if (arr.some(r => String(r[k]) === String(id))) {
            return Promise.reject(new Error('duplicate key'));
        }
        arr.push(rec); _lsSave(store, arr);
        return Promise.resolve(id);
    }
    function _fbDel(store, key) {
        const k = _fbKey(store);
        _lsSave(store, _lsList(store).filter(r => String(r[k]) !== String(key)));
        return Promise.resolve(true);
    }
    function _fbClear(store) { _lsSave(store, []); return Promise.resolve(true); }
    function _fbCount(store) { return Promise.resolve(_lsList(store).length); }

    function _seedFallback() {
        try {
            if (localStorage.getItem('laundry_pro2_settings') === null) {
                const arr = Object.keys(DEFAULT_SETTINGS).map(k => ({ key: k, value: DEFAULT_SETTINGS[k].value }));
                _lsSave('settings', arr);
            }
            if (_lsList('services').length === 0) _lsSave('services', DEFAULT_SERVICES);
        } catch (e) { /* ignore */ }
    }

    function _enterFallback() {
        if (_fbOnce) return true;
        _fbOnce = true;
        try {
            const probe = '__lp_probe__';
            localStorage.setItem(probe, '1');
            localStorage.removeItem(probe);
            _seedFallback();
            _useFallback = true;
            return true;
        } catch (e) { return false; }
    }

    function isFallback() { return _useFallback; }

    /* ------------------ core ------------------ */
    let _db = null;

    function openDB() {
        return new Promise((resolve, reject) => {
            if (_useFallback) return resolve({ fb: true });
            if (_db) return resolve(_db);
            let req;
            try {
                req = indexedDB.open(DB_NAME, DB_VERSION);
            } catch (e) {
                if (_enterFallback()) resolve({ fb: true }); else reject(e);
                return;
            }
            req.onupgradeneeded = (e) => {
                const db = e.target.result;
                // v2 -> v3: drop the unique phone index on customers (duplicates allowed)
                if (db.objectStoreNames.contains('customers') &&
                    e.target.transaction && e.target.transaction.objectStore('customers')) {
                    try {
                        const s = e.target.transaction.objectStore('customers');
                        if (s.indexNames.contains('phone')) {
                            s.deleteIndex('phone');
                            s.createIndex('phone', 'phone', { unique: false });
                        }
                    } catch (eu) { /* if it already failed once, ignore */ }
                }
                if (!db.objectStoreNames.contains('customers')) {
                    const s = db.createObjectStore('customers', { keyPath: 'id', autoIncrement: true });
                    s.createIndex('phone', 'phone', { unique: false });
                    s.createIndex('name', 'name', { unique: false });
                }
                if (!db.objectStoreNames.contains('invoices')) {
                    const s = db.createObjectStore('invoices', { keyPath: 'id', autoIncrement: true });
                    s.createIndex('status', 'status', { unique: false });
                    s.createIndex('createdAt', 'createdAt', { unique: false });
                    s.createIndex('phone', 'phone', { unique: false });
                }
                if (!db.objectStoreNames.contains('transactions')) {
                    const s = db.createObjectStore('transactions', { keyPath: 'id', autoIncrement: true });
                    s.createIndex('date', 'date', { unique: false });
                    s.createIndex('type', 'type', { unique: false });
                }
                if (!db.objectStoreNames.contains('subscriptions')) {
                    const s = db.createObjectStore('subscriptions', { keyPath: 'id', autoIncrement: true });
                    s.createIndex('status', 'status', { unique: false });
                    s.createIndex('nextDue', 'nextDue', { unique: false });
                    s.createIndex('custId', 'custId', { unique: false });
                }
                if (!db.objectStoreNames.contains('subPayments')) {
                    const s = db.createObjectStore('subPayments', { keyPath: 'id', autoIncrement: true });
                    s.createIndex('subId', 'subId', { unique: false });
                    s.createIndex('date', 'date', { unique: false });
                }
                if (!db.objectStoreNames.contains('services')) {
                    const s = db.createObjectStore('services', { keyPath: 'id' });
                    s.createIndex('cat', 'cat', { unique: false });
                }
                if (!db.objectStoreNames.contains('settings')) {
                    db.createObjectStore('settings', { keyPath: 'key' });
                }
                if (!db.objectStoreNames.contains('vatRecords')) {
                    db.createObjectStore('vatRecords', { keyPath: 'id' });
                }
            };
            req.onsuccess = async (e) => {
                try {
                    _db = e.target.result;
                    await seedIfEmpty(_db);
                    resolve(_db);
                } catch (e2) {
                    if (_enterFallback()) resolve({ fb: true }); else reject(e2);
                }
            };
            req.onerror = (e) => {
                if (_enterFallback()) resolve({ fb: true }); else reject(req.error);
            };
            req.onblocked = () => {
                setTimeout(() => {
                    if (_enterFallback()) resolve({ fb: true });
                }, 900);
            };
        });
    }

    async function seedIfEmpty(db) {
        const settingCount = await count('settings');
        if (settingCount === 0) {
            const tx = db.transaction(['settings'], 'readwrite');
            const store = tx.objectStore('settings');
            Object.keys(DEFAULT_SETTINGS).forEach(k => store.put({ key: k, value: DEFAULT_SETTINGS[k].value }));
            await txDone(tx);
        } else {
            // migrate: add any newly introduced settings keys (keeps user values)
            const existing = await getAll('settings');
            const have = {};
            existing.forEach(r => { have[r.key] = r.value; });
            const tx = db.transaction(['settings'], 'readwrite');
            const store = tx.objectStore('settings');
            Object.keys(DEFAULT_SETTINGS).forEach(k => {
                if (have[k] === undefined) {
                    store.put({ key: k, value: DEFAULT_SETTINGS[k].value });
                } else if ((k === 'shopPhone' || k === 'shopAddr') && !have[k]) {
                    store.put({ key: k, value: DEFAULT_SETTINGS[k].value });
                }
            });
            await txDone(tx);
        }
        const svcCount = await count('services');
        if (svcCount === 0) {
            const tx = db.transaction(['services'], 'readwrite');
            const store = tx.objectStore('services');
            DEFAULT_SERVICES.forEach(s => store.put(s));
            await txDone(tx);
        }
    }

    function count(storeName) {
        return openDB().then(db => {
            if (_useFallback) return _fbCount(storeName);
            return promisify(db.transaction(storeName).objectStore(storeName).count());
        });
    }

    /* ------------------ generic CRUD ------------------ */
    function getAll(storeName) {
        return openDB().then(db => {
            if (_useFallback) return _fbGetAll(storeName);
            return promisify(db.transaction(storeName).objectStore(storeName).getAll());
        });
    }

    function get(storeName, key) {
        return openDB().then(db => {
            if (_useFallback) return _fbGet(storeName, key);
            return promisify(db.transaction(storeName).objectStore(storeName).get(key));
        });
    }

    function put(storeName, record) {
        return openDB().then(db => {
            if (_useFallback) return _fbPut(storeName, record);
            return new Promise((resolve, reject) => {
                const tx = db.transaction(storeName, 'readwrite');
                const req = tx.objectStore(storeName).put(record);
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => reject(req.error);
            });
        });
    }

    function add(storeName, record) {
        if (AUTO_ID_STORES.indexOf(storeName) >= 0 && (record.id === undefined || record.id === null)) {
            record.id = genGlobalId(storeName);
        }
        return openDB().then(db => {
            if (_useFallback) return _fbAdd(storeName, record);
            return new Promise((resolve, reject) => {
                const tx = db.transaction(storeName, 'readwrite');
                const req = tx.objectStore(storeName).add(record);
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => reject(req.error);
            });
        });
    }

    function del(storeName, key) {
        return openDB().then(db => {
            if (_useFallback) return _fbDel(storeName, key);
            return new Promise((resolve, reject) => {
                const tx = db.transaction(storeName, 'readwrite');
                const req = tx.objectStore(storeName).delete(key);
                req.onsuccess = () => resolve(true);
                req.onerror = () => reject(req.error);
            });
        });
    }

    function clearStore(storeName) {
        return openDB().then(db => {
            if (_useFallback) return _fbClear(storeName);
            return new Promise((resolve, reject) => {
                const tx = db.transaction(storeName, 'readwrite');
                const req = tx.objectStore(storeName).clear();
                req.onsuccess = () => resolve(true);
                req.onerror = () => reject(req.error);
            });
        });
    }

    /* ------------------ settings ------------------ */
    async function getSettings() {
        const rows = await getAll('settings');
        const settings = {};
        rows.forEach(r => { settings[r.key] = r.value; });
        return settings;
    }

    async function setSetting(key, value) {
        return put('settings', { key, value });
    }

    async function setMany(pairs) {
        const db = await openDB();
        if (_useFallback) {
            pairs.forEach(p => _fbPut('settings', { key: p.key, value: p.value }));
            return true;
        }
        return new Promise((resolve, reject) => {
            const tx = db.transaction('settings', 'readwrite');
            const store = tx.objectStore('settings');
            pairs.forEach(p => store.put({ key: p.key, value: p.value }));
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => reject(tx.error);
        });
    }

    /* ------------------ invoice counter ------------------ */
    async function nextInvoiceNumber() {
        let next;
        try {
            const all = await getAll('invoices');
            let mx = 0;
            all.forEach(i => { const n = parseInt(i.invNo, 10); if (!isNaN(n) && n > mx) mx = n; });
            const cur = parseInt((await getSettings()).nextInvNo, 10);
            next = Math.max(mx + 1, isNaN(cur) ? 1001 : cur);
        } catch (e) {
            next = 1001;
        }
        await setSetting('nextInvNo', (next + 1).toString());
        return next;
    }

    /* ------------------ weighted queries ------------------ */
    async function getInvoicesByStatus(status) {
        const all = await getAll('invoices');
        return all.filter(i => i.status === status).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }

    async function getSubscriptionsByStatus(status) {
        const all = await getAll('subscriptions');
        return all.filter(s => s.status === status).sort((a, b) => (a.nextDue || '').localeCompare(b.nextDue || ''));
    }

    async function getUnpaidInvoices() {
        const all = await getAll('invoices');
        return all.filter(i => i.status === 'pending').sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }

    /* ---------------- export & import ---------------- */
    async function exportAll() {
        const names = ['customers', 'invoices', 'transactions', 'subscriptions', 'subPayments', 'services', 'settings'];
        const data = {};
        for (const n of names) data[n] = await getAll(n);
        return JSON.stringify(data, null, 2);
    }

    async function importAll(json) {
        const data = JSON.parse(json);
        const names = ['customers', 'invoices', 'transactions', 'subscriptions', 'subPayments', 'services', 'settings'];
        const db = await openDB();
        if (_useFallback) {
            names.forEach(n => _fbClear(n));
            for (const n of names) {
                (data[n] || []).forEach(r => _fbPut(n, Object.assign({}, r)));
            }
            return true;
        }
        const tx = db.transaction(names, 'readwrite');
        names.forEach(n => tx.objectStore(n).clear());
        for (const n of names) {
            const store = tx.objectStore(n);
            (data[n] || []).forEach(r => store.put(r));
        }
        await txDone(tx);
        return true;
    }

    async function wipeAll() {
        const names = ['customers', 'invoices', 'transactions', 'subscriptions', 'subPayments'];
        const db = await openDB();
        if (_useFallback) {
            names.forEach(n => _fbClear(n));
            return true;
        }
        const tx = db.transaction(names, 'readwrite');
        names.forEach(n => tx.objectStore(n).clear());
        await txDone(tx);
        return true;
    }

    /* ------------------ date helpers ------------------ */
    function fmtDate(d) {
        const dt = d instanceof Date ? d : new Date(d);
        const pad = n => String(n).padStart(2, '0');
        return `${pad(dt.getDate())}/${pad(dt.getMonth() + 1)}/${dt.getFullYear()}`;
    }

    function fmtDateTime(d) {
        const dt = d instanceof Date ? d : new Date(d);
        const pad = n => String(n).padStart(2, '0');
        return `${pad(dt.getDate())}/${pad(dt.getMonth() + 1)}/${dt.getFullYear()} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
    }

    function todayStr() {
        return fmtDate(new Date());
    }

    function isoNow() {
        return new Date().toISOString();
    }

    function addMonths(dateStr, n) {
        const d = new Date(dateStr);
        d.setMonth(d.getMonth() + n);
        return fmtDate(d);
    }

    function monthKeyOf(dateStr) {
        return dateStr.split('/').slice(1).join('/'); // MM/YYYY
    }

    function monthLabel(dateStr, lang) {
        // accepts DD/MM/YYYY or MM/YYYY
        const parts = String(dateStr || '').split('/');
        let m, y;
        if (parts.length === 3) { m = parts[1]; y = parts[2]; }
        else if (parts.length === 2) { m = parts[0]; y = parts[1]; }
        else return dateStr;
        const names = lang === 'ar'
            ? ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']
            : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${names[parseInt(m, 10) - 1]} ${y}`;
    }

    function periodLabel(dateStr) { // "09/2026"
        return dateStr.split('/').slice(1).join('/');
    }

    const DB = {
        openDB, getSettings, setSetting, setMany, isFallback,
        getAll, get, put, add, del, clearStore, count,
        nextInvoiceNumber,
        getInvoicesByStatus, getSubscriptionsByStatus, getUnpaidInvoices,
        exportAll, importAll, wipeAll,
        fmtDate, fmtDateTime, todayStr, isoNow, addMonths,
        monthKeyOf, monthLabel, periodLabel, DEFAULT_SERVICES, DEFAULT_SETTINGS
    };

    window.DB = DB;
})(window);