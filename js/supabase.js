/* ============================================================
 * supabase.js — optional multi-device sync via Supabase REST.
 * Enabled ONLY when SUPABASE.url and SUPABASE.anonKey are set
 * in js/supabase-config.js. Otherwise the app stays 100% local.
 * Model:   server side = source of truth
 *          IndexedDB  = cache + offline buffer
 *          mutations  = write-through (queue when offline)
 * ============================================================ */
(function (window) {
    'use strict';

    const cfg = window.SUPABASE || {};
    const ALL_STORES = ['customers', 'invoices', 'transactions', 'subscriptions', 'subPayments', 'services', 'settings', 'vatRecords'];
    const QKEY = 'laundry_pro_sync_queue';

    const SUPA = {
        enabled: !!(cfg.url && cfg.anonKey),
        lastPull: 0
    };

    if (!SUPA.enabled) {
        window.SUPA = SUPA;
        return;
    }

    const base = cfg.url.replace(/\/+$/, '') + '/rest/v1/';
    const hdrs = {
        'apikey': cfg.anonKey,
        'Authorization': 'Bearer ' + cfg.anonKey,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
    };
    const orig = {
        add: DB.add, put: DB.put, del: DB.del,
        setSetting: DB.setSetting, setMany: DB.setMany,
        importAll: DB.importAll, wipeAll: DB.wipeAll
    };

    function pkField(store) { return store === 'settings' ? 'key' : 'id'; }

    function api(path, opts) {
        opts = opts || {};
        opts.headers = Object.assign({}, hdrs, opts.headers || {});
        return fetch(base + path, opts).then(function (r) {
            if (!r.ok) throw new Error('HTTP ' + r.status);
            const ct = r.headers.get('content-type') || '';
            return ct.indexOf('json') >= 0 ? r.json().catch(function () { return null; }) : null;
        });
    }

    function getRows(store) {
        return api(store + '?select=id,data,updated_at&order=updated_at.asc');
    }

    function rowToServer(store, rec) {
        const body = { data: rec, updated_at: new Date().toISOString() };
        body[pkField(store)] = rec[pkField(store)];
        return body;
    }

    function upsertRows(store, rows) {
        if (!rows.length) return Promise.resolve([]);
        return api(store + '?on_conflict=' + pkField(store), {
            method: 'POST',
            headers: { 'Prefer': 'resolution=merge-duplicates,return=representation' },
            body: JSON.stringify(rows.map(function (r) { return rowToServer(store, r); }))
        });
    }

    function delRow(store, key) {
        return api(store + '?' + pkField(store) + '=eq.' + encodeURIComponent(key), { method: 'DELETE' });
    }

    function wipeTable(store) {
        return api(store + '?' + pkField(store) + '=neq.0', { method: 'DELETE' });
    }

    function _exec(op) {
        if (op.op === 'u') return upsertRows(op.table, [op.rec]);
        if (op.op === 'd') return delRow(op.table, op.key);
        if (op.op === 'w') return wipeTable(op.table);
        return Promise.resolve();
    }

    /* ---------------- offline queue ---------------- */
    let _q = loadQ();
    function loadQ() {
        try { const v = JSON.parse(localStorage.getItem(QKEY) || '[]'); return Array.isArray(v) ? v : []; }
        catch (e) { return []; }
    }
    function saveQ() {
        try { localStorage.setItem(QKEY, JSON.stringify(_q)); } catch (e) { /* no storage */ }
    }
    function enqueue(op) { _q.push(op); saveQ(); }

    let _flushing = false;
    function flush() {
        if (!SUPA.enabled || _flushing) return Promise.resolve();
        _flushing = true;
        const step = function () {
            if (!_q.length) { _flushing = false; return Promise.resolve(); }
            const op = _q[0];
            return _exec(op).then(function () {
                _q.shift(); saveQ();
                return step();
            }).catch(function () {
                _flushing = false;
                return Promise.resolve();
            });
        };
        return step();
    }

    function pushLocal(op) {
        if (!SUPA.enabled) return;
        if (_q.length) { enqueue(op); flush(); }
        else {
            _exec(op).catch(function () { enqueue(op); });
        }
    }

    /* ---------------- pull (server -> local) ---------------- */
    function applyRow(store, r) {
        const rec = Object.assign({}, r.data || {});
        if (r[pkField(store)] !== undefined && rec[pkField(store)] === undefined) {
            rec[pkField(store)] = r[pkField(store)];
        }
        return rec;
    }

    async function pullAll() {
        for (let i = 0; i < ALL_STORES.length; i++) {
            const store = ALL_STORES[i];
            let rows = null;
            try { rows = await getRows(store); } catch (e) { continue; }
            if (!rows || !rows.length) continue;
            await DB.clearStore(store);
            for (let j = 0; j < rows.length; j++) {
                if (rows[j].data) await orig.put(store, applyRow(store, rows[j]));
            }
        }
        SUPA.lastPull = Date.now();
        return true;
    }

    /* ---------------- bootstrap (first run / app start) ---------------- */
    async function bootstrap() {
        await DB.openDB();
        const serverHas = {};
        for (let i = 0; i < ALL_STORES.length; i++) {
            const store = ALL_STORES[i];
            let rows = null;
            try { rows = await getRows(store); } catch (e) { return; }
            serverHas[store] = !!(rows && rows.length);
            if (rows && rows.length) {
                await DB.clearStore(store);
                for (let j = 0; j < rows.length; j++) {
                    if (rows[j].data) await orig.put(store, applyRow(store, rows[j]));
                }
            }
        }
        for (let i = 0; i < ALL_STORES.length; i++) {
            const store = ALL_STORES[i];
            if (serverHas[store] && store !== 'settings') continue;
            let local = [];
            try { local = await DB.getAll(store); } catch (e) { local = []; }
            if (!local.length) continue;
            upsertRows(store, local).catch(function () {
                local.forEach(function (r) { enqueue({ op: 'u', table: store, rec: r }); });
            });
        }
        flush();
    }

    /* ---------------- live write-through hooks ---------------- */
    function wrap() {
        const wAdd = DB.add;
        DB.add = function (store, rec) {
            return wAdd.apply(DB, arguments).then(function (id) {
                if (ALL_STORES.indexOf(store) >= 0) {
                    const row = Object.assign({}, rec);
                    if (row.id === undefined || row.id === null) row.id = id;
                    pushLocal({ op: 'u', table: store, rec: row });
                }
                return id;
            });
        };

        const wPut = DB.put;
        DB.put = function (store, rec) {
            return wPut.apply(DB, arguments).then(function (key) {
                if (ALL_STORES.indexOf(store) >= 0) {
                    pushLocal({ op: 'u', table: store, rec: Object.assign({}, rec) });
                }
                return key;
            });
        };

        const wDel = DB.del;
        DB.del = function (store, key) {
            return wDel.apply(DB, arguments).then(function (v) {
                if (ALL_STORES.indexOf(store) >= 0) {
                    pushLocal({ op: 'd', table: store, key: key });
                }
                return v;
            });
        };

        const wSet = DB.setSetting;
        DB.setSetting = function (k, v) {
            return wSet.apply(DB, arguments).then(function (r) {
                pushLocal({ op: 'u', table: 'settings', rec: { key: k, value: v } });
                return r;
            });
        };

        const wMany = DB.setMany;
        DB.setMany = function (pairs) {
            return wMany.apply(DB, arguments).then(function (r) {
                pairs.forEach(function (p) { pushLocal({ op: 'u', table: 'settings', rec: { key: p.key, value: p.value } }); });
                return r;
            });
        };

        const wImport = DB.importAll;
        DB.importAll = function (json) {
            return wImport.apply(DB, arguments).then(function (v) {
                const data = JSON.parse(json);
                ALL_STORES.forEach(function (s) { (data[s] || []).forEach(function (r) { pushLocal({ op: 'u', table: s, rec: r }); }); });
                return v;
            });
        };

        const wWipe = DB.wipeAll;
        DB.wipeAll = function () {
            return wWipe.apply(DB, arguments).then(function (v) {
                ALL_STORES.forEach(function (s) { pushLocal({ op: 'w', table: s }); });
                return v;
            });
        };
    }

    wrap();

    /* ---------------- periodic refresh + online flush ---------------- */
    setInterval(function () {
        if (!SUPA.enabled) return;
        pullAll().then(function () {
            flush();
            if (window.App && App.reloadData) App.reloadData();
        }).catch(function () { /* keep local */ });
    }, 30000);

    window.addEventListener('online', function () { flush(); });

    SUPA.bootstrap = bootstrap;
    SUPA.pullAll = pullAll;
    SUPA.flush = flush;
    SUPA.pushLocal = pushLocal;
    window.SUPA = SUPA;
})(window);