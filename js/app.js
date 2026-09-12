/* ============================================================
 * app.js — Laundry Pro main application (SPA)
 * ============================================================ */
(function (window) {
    'use strict';

    const App = window.App = {
        state: {
            authed: false,
            lang: 'ar',
            view: 'dashboard',
            settings: null,
            pos: { items: [], discount: 0, customer: null },
            customers: [],
            invoices: [],
            services: [],
            lastCustSearch: ''
        }
    };

    /* ================= helpers ================= */
    const t = (k) => I18N.t(k, App.state.lang);
    const fmt = (n) => Number(n || 0).toFixed(3);
    const cur = (n) => `${fmt(n)} ${(App.state.settings.currency || 'BHD')}`;

    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));
    }

    function toast(msg, type) {
        const box = document.getElementById('toast');
        box.textContent = msg;
        box.className = `show ${type || 'success'}`;
        clearTimeout(box._timer);
        box._timer = setTimeout(() => box.className = '', 3200);
    }

    function modalOpen(html) {
        document.getElementById('modalRoot').innerHTML = `
            <div class="modal-backdrop" onclick="if(event.target===this)App.modalClose()">
                <div class="modal-card">${html}</div>
            </div>`;
    }

    function modalClose() {
        document.getElementById('modalRoot').innerHTML = '';
    }

    function confirmAsk(title, msg, onYes, okLabel) {
        modalOpen(`
            <div class="modal-title">${esc(title)}</div>
            <p class="modal-text">${esc(msg)}</p>
            <div class="modal-actions">
                <button class="btn btn-danger" onclick="App.confirmYes()">${esc(okLabel || t('common_delete'))}</button>
                <button class="btn btn-ghost" onclick="App.modalClose()">${esc(t('common_cancel'))}</button>
            </div>`);
        App._confirmAction = onYes;
    }

    function confirmYes() {
        const fn = App._confirmAction;
        App._confirmAction = null;
        modalClose();
        if (fn) fn();
    }

    function loadCaches() {
        return Promise.all([
            DB.getSettings(),
            DB.getAll('customers').then(c => { App.state.customers = c; }),
            DB.getAll('invoices').then(i => { App.state.invoices = i; }),
            DB.getAll('services').then(s => { App.state.services = s; }),
            DB.getAll('subscriptions'),
            DB.getAll('subPayments'),
            DB.getAll('transactions'),
            DB.getAll('vatRecords')
        ]).then(r => {
            App.state.settings = r[0];
            App.state.subscriptions = r[4];
            App.state.subPayments = r[5];
            App.state.transactions = r[6];
            App.state.vatRecords = r[7];
        });
    }

    function statusBadge(st) {
        const labels = {
            pending: t('status_pending'), ready: t('status_ready'),
            paid: t('status_paid'), cancelled: t('status_cancelled')
        };
        const cls = {
            pending: 'bg-amber', ready: 'bg-blue', paid: 'bg-green', cancelled: 'bg-red'
        };
        return `<span class="badge ${cls[st] || 'bg-gray'}">${labels[st] || st}</span>`;
    }

    function isSameDay(iso, ref) {
        if (!iso) return false;
        const d = new Date(iso);
        return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth() && d.getDate() === ref.getDate();
    }

    function inMonth(iso, ref) {
        if (!iso) return false;
        const d = new Date(iso);
        return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth();
    }

    function periodOfMonth(d) {
        const pad = n => String(n).padStart(2, '0');
        return `${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
    }

    function periodOfIso(iso) {
        return iso ? periodOfMonth(new Date(iso)) : '';
    }

    function periodToMonthInput(period /* MM/YYYY */) {
        const [m, y] = String(period || '').split('/');
        return m && y ? `${y}-${m}` : '';
    }

    /* ================= auth / init ================= */
    function reloadData() {
        return loadCaches().then(() => { renderNav(); hostView(); });
    }

    async function init() {
        try {
            await loadCaches();
        } catch (e) {
            const msg = String(e && e.message || e);
            const d = document.getElementById('diagConsole');
            if (d) d.textContent += '[diag] قاعدة البيانات غير متاحة: ' + msg + '\n';
            const ls = document.querySelector('#loginScreen .login-card');
            if (ls) {
                const p = document.createElement('p');
                p.style.cssText = 'color:#c00;font-weight:600;margin-top:12px;';
                p.textContent = 'Database unavailable: ' + msg;
                ls.appendChild(p);
            }
            return;
        }
        App.state.lang = App.state.settings.language === 'en' ? 'en' : 'ar';
        App.state.dbFallback = DB.isFallback();
        applyLang();
        if (App.state.dbFallback) showFallbackBanner();
        startAutoSync();
        showView(App.state.view);
        document.getElementById('loginScreen').style.display = 'flex';
        // sync runs in the background; a sync failure must NEVER block login
        if (window.SUPA && window.SUPA.enabled) {
            window.SUPA.bootstrap().then(function () {
                if (App.reloadData) App.reloadData();
            }).catch(function () { /* keep local data */ });
        }
    }

    function showFallbackBanner() {
        const el = document.getElementById('fbBanner');
        if (el) { el.style.display = 'block'; el.textContent = t('fb_banner'); }
    }

    function applyLang() {
        I18N.setLang(App.state.lang);
        const doc = document.documentElement;
        doc.lang = App.state.lang;
        doc.dir = App.state.lang === 'ar' ? 'rtl' : 'ltr';
        document.getElementById('langBtn').textContent = t('switchLang');
        document.getElementById('loginTitle').textContent = t('welcome_login');
        document.getElementById('loginBtn').textContent = t('login_btn');
        document.getElementById('loginPin').placeholder = t('login_pin');
        const diag = document.getElementById('loginDiag');
        if (diag) renderLoginDiag();
        document.getElementById('brandName').textContent = t('appName');
        document.getElementById('brandTag').textContent = t('appTagline');
        const lr = document.getElementById('loginReset');
        if (lr) lr.textContent = t('reset_pw_btn');
        document.getElementById('topDate').textContent = new Date().toLocaleDateString(
            App.state.lang === 'ar' ? 'ar-BH' : 'en-GB',
            { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        renderNav();
        if (App.state.authed) hostView();
    }

    function doLogin() {
        const pin = (document.getElementById('loginPin').value || '').trim();
        const stored = String(App.state.settings.appPassword || '0005').trim();
        if (pin === stored) {
            App.state.authed = true;
            document.getElementById('loginScreen').style.display = 'none';
            document.getElementById('appShell').style.display = 'flex';
            hostView();
        } else {
            toast(t('wrong_pin'), 'error');
            renderLoginDiag();
        }
    }

    function logout() {
        App.state.authed = false;
        document.getElementById('loginPin').value = '';
        document.getElementById('appShell').style.display = 'none';
        document.getElementById('loginScreen').style.display = 'flex';
    }

    function renderLoginDiag() {
        const el = document.getElementById('loginDiag');
        if (!el) return;
        const stored = String(App.state.settings.appPassword || '0005');
        const typed = (document.getElementById('loginPin').value || '').trim();
        const match = typed === stored;
        const text = (App.state.lang === 'ar')
            ? `المخزنة: ${stored} | أدخلتَ ${typed.length} رقم${match ? ' | مطابقة ✓' : ''}`
            : `Stored: ${stored} | typed ${typed.length} digits${match ? ' | match' : ''}`;
        el.textContent = text;
    }

    function resetPassword() {
        DB.setSetting('appPassword', '0005').then(async () => {
            App.state.settings = await DB.getSettings();
            const p = document.getElementById('loginPin');
            if (p) p.value = '0005';
            toast(t('reset_pw_done'), 'success');
            renderLoginDiag();
        });
    }

    function toggleLang() {
        App.state.lang = App.state.lang === 'ar' ? 'en' : 'ar';
        I18N.setLang(App.state.lang);
        DB.setSetting('language', App.state.lang).then(() => applyLang());
    }

    /* ================= nav ================= */
    const NAV = [
        ['dashboard', 'dashboard', 'M3 12l9-9 9 9M5 10v10a1 1 0 001 1h4v-6h4v6h4a1 1 0 001-1V10'],
        ['marketing', 'marketing', 'M3 11l18-5v12L3 14v-3zM11.6 16.8a3 3 0 1 1-5.8-1.6'],
        ['pos', 'pos', 'M12 4v16m8-8H4'],
        ['invoices', 'invoices', 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.6a2 2 0 011.4.6l3 3a2 2 0 01.6 1.4V19a2 2 0 01-2 2z'],
        ['customers', 'customers', 'M17 20h5v-2a3 3 0 00-5.4-1.8M17 11a4 4 0 100-8M2 20v-2a3 3 0 015-2.1M9 11a4 4 0 100-8'],
        ['subscriptions', 'subscriptions', 'M12 8v4l3 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z'],
        ['accounting', 'accounting', 'M9 7h6m0 10v-3m-3 3h.01M9 17h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z'],
        ['reports', 'reports', 'M18 20V10m-6 10V4M6 20v-6'],
        ['settings', 'settings', 'M10.3 4.3a1 1 0 011.4 0l1 1a1 1 0 001.4 0l1.2-.5a1 1 0 011.3.6l.5 1.2a1 1 0 00.7.7l1.2.5a1 1 0 01.6 1.3l-.5 1.2a1 1 0 000 1.4l1 1a1 1 0 010 1.4l-1 1a1 1 0 00-.7.7l.5 1.2a1 1 0 01-.6 1.3l-1.2.5a1 1 0 00-.7.7l-.5 1.2a1 1 0 01-1.3.6l-1.2-.5a1 1 0 00-1.4 0l-1 1a1 1 0 01-1.4 0l-1-1a1 1 0 00-1.4 0l-1.2.5a1 1 0 01-1.3-.6l-.5-1.2a1 1 0 00-.7-.7l-1.2-.5a1 1 0 01-.6-1.3l.5-1.2a1 1 0 000-1.4l-1-1a1 1 0 010-1.4l1-1a1 1 0 00.7-.7l-.5-1.2a1 1 0 01.6-1.3l1.2-.5a1 1 0 00.7-.7l.5-1.2a1 1 0 011.3-.6zM15 12a3 3 0 11-6 0 3 3 0 016 0z']
    ];

    function renderNav() {
        const sidebar = document.getElementById('sideNav');
        const bottom = document.getElementById('bottomNav');
        const items = NAV.map(([key, , path]) => `
            <a href="#" class="nav-item ${App.state.view === key ? 'active' : ''}" data-nav="${key}" onClick="event.preventDefault();App.showView('${key}')">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${path}"/></svg>
                <span>${esc(t('nav_' + key))}</span>
            </a>`).join('');
        sidebar.innerHTML = items;
        bottom.innerHTML = items;
    }

    function showView(name) {
        App.state.view = name;
        if (!App.state.authed) return;
        const shell = document.getElementById('appShell');
        if (shell) shell.classList.toggle('mkt-full', name === 'marketing');
        loadCaches().then(() => {
            renderNav();
            hostView();
        });
    }

    function hostView() {
        const map = {
            dashboard: viewDashboard,
            marketing: viewMarketing,
            pos: viewPos,
            invoices: viewInvoices,
            customers: viewCustomers,
            subscriptions: viewSubscriptions,
            accounting: viewAccounting,
            reports: viewReports,
            settings: viewSettings
        };
        const title = {
            dashboard: t('dashboard_title'), marketing: t('marketing_title'), pos: t('pos_title'), invoices: t('invoices_title'),
            customers: t('customers_title'), subscriptions: t('subs_title'),
            accounting: t('acc_title'), reports: t('reports_title'), settings: t('settings_title')
        };
        document.getElementById('viewTitle').textContent = title[App.state.view];
        const viewEl = document.getElementById('view');
        (map[App.state.view] || viewDashboard)(viewEl);
    }

    /* ================= MARKETING ================= */
    function mktNum(n) {
        return String(n == null ? '' : n).replace(/\D/g, '');
    }

    function mktFill(tpl, name, shopPhone) {
        return String(tpl || '').replace(/\{(\w+)\}/g, (m, k) => {
            if (k === 'name') return name || '';
            if (k === 'phone') return shopPhone || '';
            return m;
        });
    }

    function mktCleanPhone(phone, cc) {
        let n = mktNum(phone);
        const c = String(cc || '973').replace(/\D/g, '');
        if (n.startsWith('00')) n = n.slice(2);
        if (c && n.startsWith(c)) return n;
        return c + n;
    }

    function mktCampaignCustomers() {
        const list = App.state.customers || [];
        return list.filter(c => mktNum(c.phone)).map(c => ({
            id: c.id, name: c.name || 'عميل', phone: c.phone,
            clean: mktCleanPhone(c.phone, App.state.settings.countryCode || '973')
        }));
    }

    function mktFrameSrc() {
        const scripts = document.querySelectorAll('script[src]');
        for (let i = 0; i < scripts.length; i++) {
            const abs = (scripts[i].src || '').split('?')[0];
            const cut = abs.indexOf('/js/app.js');
            if (cut > 0) return abs.slice(0, cut) + '/marketing/index.html';
        }
        const base = location.href.split('?')[0].replace(/[^/]*$/, '');
        return base + 'marketing/index.html';
    }

    function mktReloadSys() {
        const f = document.getElementById('marketingFrame');
        if (f) f.src = f.src;
    }

    function viewMarketing(el) {
        const now = new Date();
        const customers = App.state.customers || [];
        const waCount = customers.filter(c => mktNum(c.phone)).length;
        const activeSubs = (App.state.subscriptions || []).filter(s => s.status === 'active').length;
        let monthRev = 0;
        (App.state.invoices || []).forEach(i => { if (i.status === 'paid' && inMonth(i.paidAt, now)) monthRev += Number(i.netTotal || 0); });
        (App.state.subPayments || []).forEach(p => { if (inMonth(p.createdAt, now)) monthRev += Number(p.amount || 0); });

        const stats = [
            [t('mkt_stats_customers'), customers.length, 'blue'],
            [t('mkt_stats_whatsapp'), waCount, 'green'],
            [t('mkt_stats_subs'), activeSubs, 'teal'],
            [t('mkt_stats_revenue'), cur(monthRev), 'indigo']
        ];

        el.innerHTML = `
            <div class="stat-grid">
                ${stats.map(s => `<div class="stat-card ${s[2]}">
                    <div class="stat-label">${esc(s[0])}</div>
                    <div class="stat-value">${esc(s[1])}</div>
                </div>`).join('')}
            </div>

            <div class="panel" style="margin-top:20px">
                <div class="mkt-sys-head">
                    <h3 class="panel-title">${esc(t('marketing_title'))}</h3>
                    <div class="mkt-status-row row2" style="margin:0">
                        <span id="mktStatus" class="mkt-status"></span>
                        <button class="btn btn-ghost btn-sm" onclick="App.mktReloadSys()">${esc(t('marketing_refresh'))}</button>
                    </div>
                </div>
                <p class="hint">${esc(t('marketing_hint'))}</p>
                <div class="mkt-frame-wrap">
                    <iframe id="marketingFrame" class="mkt-frame" src="${mktFrameSrc()}" title="Marketing"></iframe>
                </div>
            </div>

            <div class="panel" style="margin-top:20px">
                <h3 class="panel-title">${esc(t('mkt_campaign'))}</h3>
                <p class="hint">${esc(t('mkt_hint'))}</p>
                <div class="field"><label>${esc(t('mkt_msg_label'))}</label>
                    <textarea id="mktMsg" rows="5">${esc(t('mkt_msg_placeholder'))}</textarea>
                </div>
                <div class="field"><label>${esc(t('mkt_preview'))}</label>
                    <div id="mktPreview" class="hint"></div>
                </div>
                <div class="row2">
                    <button class="btn btn-primary" onclick="App.mktSelectAll()">${esc(t('mkt_select_all'))}</button>
                    <button class="btn btn-ghost" onclick="App.mktClear()">${esc(t('mkt_clear'))}</button>
                </div>
            </div>

            <div class="panel" style="margin-top:20px">
                <h3 class="panel-title">${esc(t('mkt_customers_title'))}</h3>
                <div id="mktList">${mktRenderCustomers()}</div>
                <div class="field" style="margin-top:12px"><label>${esc(t('mkt_copy_all'))}</label>
                    <button class="btn btn-whatsapp" style="margin-top:6px" onclick="App.mktCopySelected()">${esc(t('mkt_copy_all'))}</button>
                </div>
            </div>`;

        const msgEl = document.getElementById('mktMsg');
        msgEl.addEventListener('input', () => mktPreviewUpdate());
        mktPreviewUpdate();

        const st = document.getElementById('mktStatus');
        if (st) st.textContent = t('mkt_waiting');
        if (!window._mktSysListener) {
            window._mktSysListener = true;
            window.addEventListener('message', (ev) => {
                const d = ev.data;
                if (!d || d.source !== 'mkt-sys') return;
                const stx = document.getElementById('mktStatus');
                if (!stx) return;
                stx.textContent = d.memoryOnly ? t('mkt_ramonly') : t('mkt_online');
                stx.className = 'mkt-status mkt-' + (d.memoryOnly ? 'warn' : 'ok');
            });
        }
    }

    function mktRenderCustomers() {
        const list = mktCampaignCustomers();
        if (!list.length) return `<p class="hint">${esc(t('mkt_no_customers'))}</p>`;
        return `<div class="table-wrap">
            <table class="table">
                <thead><tr><th></th><th>${esc(t('customers_title'))}</th><th>${esc(t('set_shop_phone'))}</th><th></th></tr></thead>
                <tbody>
                    ${list.map((c, i) => `
                        <tr>
                            <td><input type="checkbox" id="mktCk_${c.id}" checked></td>
                            <td>${esc(c.name)}</td>
                            <td class="dim">${esc(c.phone)}</td>
                            <td><a class="btn btn-whatsapp btn-sm" href="#"
                                onclick="App.mktLinkClick(event, '${c.id}')">${esc(t('mkt_open_wa'))}</a></td>
                        </tr>`).join('')}
                </tbody>
            </table>
        </div>`;
    }

    function mktPreviewUpdate() {
        const msg = (document.getElementById('mktMsg') || {}).value || '';
        const preview = document.getElementById('mktPreview');
        if (preview) {
            const name = (App.state.customers && App.state.customers[0])
                ? App.state.customers[0].name : 'عميل';
            preview.textContent = mktFill(msg, name, App.state.settings.shopPhone || '');
        }
    }

    function mktLinkClick(e, id) {
        const msgEl = document.getElementById('mktMsg');
        const msg = msgEl ? msgEl.value : '';
        const cus = (App.state.customers || []).find(c => String(c.id) === String(id));
        const name = cus ? cus.name : '';
        const cc = App.state.settings.countryCode || '973';
        const phone = cus ? mktCleanPhone(cus.phone, cc) : '';
        const text = mktFill(msg, name, App.state.settings.shopPhone || '');
        window.open('https://wa.me/' + phone + '?text=' + encodeURIComponent(text), '_blank');
        e.preventDefault();
        return false;
    }

    function mktSelectAll() {
        (App.state.customers || []).forEach(c => {
            const el = document.getElementById('mktCk_' + c.id);
            if (el) el.checked = true;
        });
        toast(t('mkt_selected'), 'success');
    }

    function mktClear() {
        (App.state.customers || []).forEach(c => {
            const el = document.getElementById('mktCk_' + c.id);
            if (el) el.checked = false;
        });
    }

    function mktCopySelected() {
        const msg = (document.getElementById('mktMsg') || {}).value || '';
        const shopPhone = App.state.settings.shopPhone || '';
        const lines = (App.state.customers || []).filter(c => {
            const el = document.getElementById('mktCk_' + c.id);
            return el && el.checked;
        }).map(c => '— ' + (c.name || '') + '\n' + mktFill(msg, c.name, shopPhone)).join('\n\n');
        if (!lines) { toast(t('mkt_no_customers'), 'warn'); return; }
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(lines).then(() => toast(t('mkt_copied'), 'success'));
        } else {
            toast(t('mkt_copied'), 'success');
        }
    }

    /* ================= DASHBOARD ================= */
    function viewDashboard(el) {
        const now = new Date();
        const inv = App.state.invoices;
        const subs = App.state.subscriptions;
        const subPays = App.state.subPayments;
        const cusPhones = new Set(App.state.customers.map(c => c.phone));

        let todayOrders = 0, pending = 0, todayRev = 0, monthRev = 0, monthSubRev = 0;
        inv.forEach(i => {
            if (isSameDay(i.createdAt, now)) todayOrders++;
            if (i.status === 'pending' || i.status === 'ready') pending++;
            if (i.status === 'paid' && isSameDay(i.paidAt, now)) todayRev += Number(i.netTotal || 0);
            if (i.status === 'paid' && inMonth(i.paidAt, now)) monthRev += Number(i.netTotal || 0);
        });
        subPays.forEach(p => { if (inMonth(p.createdAt, now)) monthSubRev += Number(p.amount || 0); });
        const manualSales = App.state.transactions ? App.state.transactions.filter(x => x.type === 'sale' && inMonth(x.date, now)) : [];
        manualSales.forEach(x => monthRev += Number(x.total || 0));
        const monthExpenses = App.state.transactions ? App.state.transactions.filter(x => x.type === 'expense' && inMonth(x.date, now)) : [];
        const expTotal = monthExpenses.reduce((s, x) => s + Number(x.total || 0), 0);

        const activeSubs = subs.filter(s => s.status === 'active').length;
        const recent = [...inv].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 8);

        const stats = [
            [t('stat_total_customers'), cusPhones.size, 'blue'],
            [t('stat_today_orders'), todayOrders, 'green'],
            [t('stat_pending'), pending, 'amber'],
            [t('stat_today_revenue'), cur(todayRev), 'blue'],
            [t('stat_month_revenue'), cur(monthRev), 'indigo'],
            [t('stat_sub_revenue'), cur(monthSubRev), 'violet'],
            [t('stat_subscriptions'), activeSubs, 'teal'],
            [t('stat_net_profit'), cur(monthRev + monthSubRev - expTotal), 'green']
        ];

        el.innerHTML = `
            <div class="stat-grid">
                ${stats.map(s => `<div class="stat-card ${s[2]}">
                    <div class="stat-label">${esc(s[0])}</div>
                    <div class="stat-value">${esc(s[1])}</div>
                </div>`).join('')}
            </div>

            <div class="panel" style="margin-top:20px">
                <div class="panel-head">
                    <h3>${esc(t('recent_invoices'))}</h3>
                    <a href="#" class="link" onClick="event.preventDefault();App.showView('invoices')">${esc(t('view_all'))}</a>
                </div>
                <div class="table-wrap">
                    <table class="table">
                        <thead><tr>
                            <th>${esc(t('invoice_no'))}</th><th>${esc(t('name'))}</th>
                            <th>${esc(t('total'))}</th><th>${esc(t('date'))}</th><th></th>
                        </tr></thead>
                        <tbody>
                            ${recent.length ? recent.map(i => `
                                <tr>
                                    <td class="strong">#${esc(String(i.invNo))}</td>
                                    <td>${esc(i.custName || '')}</td>
                                    <td class="strong">${cur(i.netTotal)}</td>
                                    <td class="dim">${esc(DB.fmtDate(i.createdAt))}</td>
                                    <td>${statusBadge(i.status)}</td>
                                </tr>`).join('') : `
                                <tr><td colspan="5" class="empty">${esc(t('no_invoices'))}</td></tr>`}
                        </tbody>
                    </table>
                </div>
            </div>

            <div class="notice">${esc(t('dashboard_notice'))}</div>`;
    }

    /* ================= POS ================= */
    function viewPos(el) {
        const S = App.state.pos;

        el.innerHTML = `
            <div class="pos-grid">
                <div class="panel">
                    <h3 class="panel-title">${esc(t('customer_name'))}</h3>
                    <div class="field" style="position:relative">
                        <input id="posPhone" value="${esc(S.customer ? S.customer.phone : '')}" placeholder="${esc(t('search_customer'))}"
                               onkeyup="App.posPhoneKey(event)" oninput="App.posSug()" onchange="App.posPhoneDone()">
                        <input id="posName" value="${esc(S.customer ? S.customer.name : '')}" placeholder="${esc(t('customer_name'))}" oninput="App.posSug()">
                        <div id="posSug" style="display:none;position:absolute;top:100%;left:0;right:0;z-index:50;background:#fff;border:1px solid #ddd;border-radius:8px;max-height:170px;overflow:auto"></div>
                    </div>
                    <div class="row2" style="margin-top:10px">
                        <input id="posEditNo" type="number" placeholder="${esc(t('invoice_no'))}">
                        <button class="btn btn-ghost" onclick="App.posLoadEdit()">${esc(t('pos_edit_load'))}</button>
                    </div>
                    <div id="posEditBadge" class="hint" style="display:none"></div>
                    <div class="field">
                        <label>${esc(t('service'))}</label>
                        <select id="posService">${serviceOptions()}</select>
                    </div>
                    <div id="posCustomWrap" style="display:none" class="field">
                        <label>${esc(t('custom_price'))}</label>
                        <input id="posCustom" type="number" step="0.001" min="0" placeholder="0.000">
                    </div>
                    <div class="field">
                        <label>${esc(t('service_mode'))}</label>
                        <div class="seg">
                            <label><input type="radio" name="posMode" value="wash_iron" checked><span>${esc(t('mode_wash_iron'))}</span></label>
                            <label><input type="radio" name="posMode" value="iron"><span>${esc(t('mode_iron_only'))}</span></label>
                            <label><input type="radio" name="posMode" value="wash"><span>${esc(t('mode_wash_only'))}</span></label>
                        </div>
                    </div>
                    <div class="row2">
                        <div class="field">
                            <label>${esc(t('quantity'))}</label>
                            <input id="posQty" type="number" min="1" value="1">
                        </div>
                        <div class="field">
                            <label>${esc(t('urgency'))}</label>
                            <select id="posUrg"><option value="1">${esc(t('normal'))}</option><option value="2">${esc(t('urgent'))}</option></select>
                        </div>
                    </div>
                    <div class="row2">
                        <button class="btn btn-primary" onclick="App.posAdd()">+ ${esc(t('add_item'))}</button>
                        <button class="btn btn-danger-soft" onclick="App.posClear()">${esc(t('clear_items'))}</button>
                    </div>

                    <div class="field" style="margin-top:14px">
                        <label>${esc(t('discount'))} (${esc(App.state.settings.currency || 'BHD')})</label>
                        <input id="posDiscount" type="number" step="0.001" min="0" value="${fmt(S.discount)}" oninput="App.posRecalc()">
                    </div>

                    ${taxPercent() > 0 ? `
                    <div class="vat-row"><span>${esc(t('subtotal'))}</span><span id="posSub">${cur(posBaseTotal())}</span></div>
                    <div class="vat-row"><span>${esc(t('tax_vat'))} (${taxPercent()}%)</span><span id="posVat">${cur(vatOf(posBaseTotal()))}</span></div>` : ''}
                    <div class="pos-total-box">
                        <span>${esc(t('net_total'))}</span>
                        <span id="posTotal" class="big">${cur(posBillTotal())}</span>
                    </div>

                    <div class="row2" style="margin-top:12px">
                        <button class="btn btn-primary" onclick="App.posSave(false)">${esc(t('save_invoice'))}</button>
                        <button class="btn btn-dark" onclick="App.posSave(true)">${esc(t('save_and_print'))}</button>
                    </div>
                    <button class="btn btn-whatsapp" onclick="App.posSaveAndSend()">${esc(t('save_and_send'))}</button>
                    <p class="hint">${esc(t('ready_msg_auto'))}</p>
                </div>

                <div class="panel">
                    <h3 class="panel-title">${esc(t('invoice'))} <span class="dim">#</span></h3>
                    <div class="pos-bill-head">
                        <div>${esc(App.state.settings.shopName || t('appName'))}</div>
                        <div class="dim">${esc(DB.todayStr())}</div>
                    </div>
                    <div id="posBillBody" class="pos-bill"></div>
                </div>
            </div>`;

        document.getElementById('posService').onchange = () => posServiceChange();
        posServiceChange();
        posRenderBill();
    }

    function serviceOptions() {
        const cats = ['general', 'mens', 'ladies', 'bedding', 'manual'];
        const catTitles = {
            general: t('category_general'), mens: t('category_mens'),
            ladies: t('category_ladies'), bedding: t('category_bedding'), manual: t('category_manual')
        };
        return cats.map(c => {
            const list = App.state.services.filter(s => s.cat === c);
            return `<optgroup label="${esc(catTitles[c])}">${list.map(s => {
                const lbl = App.state.lang === 'ar' ? s.nameAr : s.nameEn;
                return `<option value="${s.id}" data-manual="${s.manual ? 1 : 0}" data-wash="${s.wash}" data-iron="${s.iron}">${esc(lbl)}</option>`;
            }).join('')}</optgroup>`;
        }).join('');
    }

    function posServiceChange() {
        const sel = document.getElementById('posService');
        const opt = sel.options[sel.selectedIndex];
        const manual = opt && opt.dataset.manual === '1';
        document.getElementById('posCustomWrap').style.display = manual ? 'block' : 'none';
    }

    function taxPercent() {
        const s = App.state.settings;
        return (s.taxEnabled === '1' || s.taxEnabled === true) ? (parseFloat(s.taxRate) || 0) : 0;
    }

    function posBaseTotal() {
        const S = App.state.pos;
        let sum = S.items.reduce((s, it) => s + Number(it.price || 0), 0);
        sum -= Number(S.discount || 0);
        return Math.max(0, sum);
    }

    function vatOf(base) {
        return +(Math.round((base * taxPercent() / 100) * 1000) / 1000);
    }

    function posBillTotal() {
        const base = posBaseTotal();
        return +(Math.round((base + vatOf(base)) * 1000) / 1000);
    }

    function posRecalc() {
        const S = App.state.pos;
        S.discount = parseFloat(document.getElementById('posDiscount').value) || 0;
        const subEl = document.getElementById('posSub');
        const vatEl = document.getElementById('posVat');
        const el = document.getElementById('posTotal');
        const base = posBaseTotal();
        if (subEl) subEl.textContent = cur(base);
        if (vatEl) vatEl.textContent = cur(vatOf(base));
        if (el) el.textContent = cur(posBillTotal());
    }

    function posRenderBill() {
        const body = document.getElementById('posBillBody');
        if (!body) return;
        const S = App.state.pos;
        body.innerHTML = S.items.length ? S.items.map((it, idx) => `
            <div class="bill-row">
                <div class="bill-line1">
                    <span>${esc(it.name)} ×${it.qty}</span>
                    <span class="strong">${cur(it.price)}</span>
                </div>
                <div class="bill-line2">
                    <span>${esc(it.mode)} • ${esc(it.urgent ? t('urgent') : t('normal'))}</span>
                    <button class="link-danger" onclick="App.posRemove(${idx})">✕</button>
                </div>
            </div>`).join('') : `<div class="empty">${esc(t('bill_empty'))}</div>`;
    }

    function posAdd() {
        const S = App.state.pos;
        const sel = document.getElementById('posService');
        const opt = sel.options[sel.selectedIndex];
        const modeEl = document.querySelector('input[name="posMode"]:checked');
        const mode = modeEl ? modeEl.value : 'wash_iron';
        const qty = parseInt(document.getElementById('posQty').value) || 1;
        const urgSel = document.getElementById('posUrg');
        const urg = parseInt(urgSel.value) || 1;

        const manual = opt.dataset.manual === '1';
        let price;
        if (manual) {
            price = parseFloat(document.getElementById('posCustom').value) || 0;
        } else {
            const wash = parseFloat(opt.dataset.wash) || 0;
            const iron = parseFloat(opt.dataset.iron) || 0;
            price = (mode === 'iron') ? iron : wash;
        }
        if (price <= 0) { toast(t('phone_required'), 'error'); return; }

        const name = App.state.lang === 'ar'
            ? (opt.textContent || '').trim()
            : (opt.textContent || '').trim();

        S.items.push({
            servId: opt.value, name,
            qty, mode: modeLabel(mode), urgent: urg,
            price: (price * qty * urg)
        });
        S.discount = parseFloat(document.getElementById('posDiscount').value) || 0;
        posRenderBill();
        posRecalc();
        document.getElementById('posCustom').value = '';
    }

    function modeLabel(m) {
        if (m === 'iron') return t('mode_iron_only');
        if (m === 'wash') return t('mode_wash_only');
        return t('mode_wash_iron');
    }

    function itemUrg(it) {
        return it && it.urgent && Number(it.urgent) > 1 ? t('urgent') : t('normal');
    }

    function waFailMsg(e) {
        const msg = String(e && e.message || e || '').trim();
        if (/exists/.test(msg)) return t('wa_failed') + ' — ' + t('wa_num_not_reg');
        if (/Invalid number/.test(msg)) return t('wa_failed') + ' — ' + t('wa_num_invalid');
        if (/timeout|timed out|abort/i.test(msg)) return t('wa_failed') + ' — ' + t('wa_timeout');
        const short = msg.length > 70 ? msg.slice(0, 70) + '…' : msg;
        return short ? t('wa_failed') + ' (' + short + ')' : t('wa_failed');
    }

    function posRemove(idx) {
        App.state.pos.items.splice(idx, 1);
        posRenderBill();
        posRecalc();
    }

    function posClear() {
        App.state.pos.items = [];
        App.state.pos.discount = 0;
        App.state.pos.editInvId = null;
        const eb = document.getElementById('posEditBadge');
        if (eb) eb.style.display = 'none';
        const d = document.getElementById('posDiscount');
        if (d) d.value = '0.000';
        posRenderBill();
        posRecalc();
    }

    function posPhoneKey(ev) {
        if (ev.key === 'Enter') posPhoneDone();
    }

    function posPhoneDone() {
        const phone = document.getElementById('posPhone').value.trim();
        const cust = App.state.customers.find(c => c.phone === phone);
        if (cust) {
            App.state.pos.customer = cust;
            document.getElementById('posName').value = cust.name;
        } else {
            App.state.pos.customer = { phone, name: document.getElementById('posName').value };
        }
        const box = document.getElementById('posSug');
        if (box) { box.style.display = 'none'; box.innerHTML = ''; }
    }

    function posSug() {
        const wrap = document.getElementById('posSug');
        if (!wrap) return;
        const phone = (document.getElementById('posPhone').value || '').trim();
        const name = (document.getElementById('posName').value || '').trim();
        if (!phone && !name) { wrap.style.display = 'none'; wrap.innerHTML = ''; return; }
        const byName = !!name;
        const opts = (App.state.customers || []).filter(c => {
            const n = String(c.name || '').toLowerCase();
            const p = String(c.phone || '').replace(/\D/g, '');
            return byName ? n.indexOf(name.toLowerCase()) > -1
                          : p.indexOf(phone.replace(/\D/g, '')) > -1;
        }).slice(0, 8);
        if (!opts.length) { wrap.style.display = 'none'; wrap.innerHTML = ''; return; }
        wrap.innerHTML = opts.map(c =>
            `<div style="padding:8px 10px;cursor:pointer;border-bottom:1px solid #eee" onmousedown="event.preventDefault();App.posPickCustomer(${c.id})">${esc(c.name)} — ${esc(c.phone)}</div>`).join('');
        wrap.style.display = 'block';
    }

    function posPickCustomer(id) {
        const c = App.state.customers.find(x => x.id === id);
        if (!c) return;
        App.state.pos.customer = c;
        document.getElementById('posPhone').value = c.phone || '';
        document.getElementById('posName').value = c.name || '';
        const box = document.getElementById('posSug');
        if (box) { box.style.display = 'none'; box.innerHTML = ''; }
    }

    function posLoadEdit() {
        const no = parseInt(document.getElementById('posEditNo').value, 10) || 0;
        if (!no) { toast(t('pos_edit_no'), 'error'); return; }
        const inv = App.state.invoices.find(x => (x.invNo || 0) === no);
        if (!inv) { toast(t('no_inv_found'), 'error'); return; }
        const S = App.state.pos;
        S.editInvId = inv.id;
        S.items = (inv.items || []).map(it => ({ servId: '', name: it.name, qty: it.qty, mode: it.mode || '', urgent: it.urgent || 1, price: it.price || 0 }));
        S.discount = Number(inv.discount || 0);
        S.customer = inv.custId ? (App.state.customers.find(c => c.id === inv.custId) || null) : null;
        document.getElementById('posPhone').value = inv.phone || '';
        document.getElementById('posName').value = inv.custName || '';
        document.getElementById('posDiscount').value = fmt(S.discount);
        const selEl = document.getElementById('posService');
        if (selEl) selEl.selectedIndex = 0;
        posRenderBill(); posRecalc();
        const badge = document.getElementById('posEditBadge');
        if (badge) { badge.style.display = 'block'; badge.textContent = t('editing_inv') + ' #' + inv.invNo; }
        toast(t('pos_loaded'), 'success');
    }

    async function posSave(printIt) {
        const S = App.state.pos;
        const phone = (document.getElementById('posPhone').value || '').trim();
        const name = (document.getElementById('posName').value || '').trim();
        if (!S.items.length) { toast(t('bill_empty'), 'error'); return; }
        if (phone && !name) { toast(t('name_required'), 'error'); return; }
        const editId = App.state.pos.editInvId || null;
        const items = S.items.map(it => ({ name: it.name, qty: it.qty, mode: it.mode, urgent: it.urgent, price: it.price }));

        // ensure customer exists (duplicate name/phone never blocks invoice creation)
        let cust = null;
        if (phone) {
            cust = App.state.customers.find(c => String(c.phone || '').trim() === phone);
            if (cust) {
                if (cust.name !== name) { cust.name = name; await DB.put('customers', cust); }
            } else {
                try {
                    const id = await DB.add('customers', {
                        name, phone, email: '', notes: '', createdAt: DB.isoNow()
                    });
                    cust = { id, name, phone };
                } catch (e) {
                    const existing = App.state.customers.find(c => String(c.phone || '').trim() === phone);
                    cust = existing || null;
                }
            }
        }

        const invNo = await DB.nextInvoiceNumber();
        const inv = {
            invNo,
            custId: cust ? cust.id : null,
            custName: name || (cust ? cust.name : ''),
            phone: phone || '',
            items,
            total: S.items.reduce((s, it) => s + Number(it.price || 0), 0),
            discount: Number(S.discount || 0),
            tax: vatOf(posBaseTotal()),
            netTotal: posBillTotal(),
            status: 'pending',
            cash: 0, benefit: 0,
            createdAt: DB.isoNow(), readyAt: '', paidAt: '', cancelledAt: ''
        };
        let savedInv = inv;
        if (editId) {
            const old = App.state.invoices.find(x => x.id === editId) || {};
            const upd = Object.assign({}, old, {
                custId: cust ? cust.id : null, custName: name || (cust ? cust.name : ''),
                phone: phone || '', items, total: inv.total, discount: inv.discount,
                tax: inv.tax, netTotal: inv.netTotal
            });
            await DB.put('invoices', upd);
            App.state.invoices = await DB.getAll('invoices');
            App.state.pos.editInvId = null;
            const eb2 = document.getElementById('posEditBadge');
            if (eb2) eb2.style.display = 'none';
            savedInv = upd;
            toast(t('inv_saved'), 'success');
        } else {
            inv.id = (DB.genGlobalId ? DB.genGlobalId('invoices') : Date.now() + Math.floor(Math.random() * 100000));
            await DB.add('invoices', inv);
            toast(t('inv_saved'), 'success');
        }
        pushInvToSheet(savedInv);
        S.items = [];
        S.discount = 0;
        S.customer = null;
        document.getElementById('posPhone').value = '';
        document.getElementById('posName').value = '';
        document.getElementById('posDiscount').value = '0.000';
        posRenderBill(); posRecalc();

        if (printIt) {
            printInvoice(inv);
        }
        showView('invoices');
        return inv;
    }

    async function posSaveAndSend() {
        const phone = document.getElementById('posPhone').value.trim();
        const name = document.getElementById('posName').value.trim();
        const inv = await posSave(false);
        if (!inv) return;
        if (!phone) { toast(t('wa_num_invalid'), 'error'); return; }
        const cfg = App.state.settings;
        const itemsTxt = WA.itemsText(inv, App.state.lang, cfg.currency || 'BHD');
        try {
            const res = await WA.sendInvoiceMessage(cfg, inv, cfg.shopName || t('appName'), itemsTxt);
            if (res && res.pushOk) toast(t('toast_wa_sent'), 'success');
            else toast(t('toast_wa_sent') + ' — ' + t('wa_push_fail') + (res && res.pushErr ? ' (' + res.pushErr + ')' : ''), 'warn');
        } catch (e) {
            toast(waFailMsg(e), 'error');
        }
    }

    /* ================= INVOICES ================= */
    function viewInvoices(el) {
        const now = new Date();
        const filter = App.state.invFilter || 'all';
        const q = (App.state.invQuery || '').toLowerCase();

        let list = [...App.state.invoices];
        if (filter === 'today') list = list.filter(i => isSameDay(i.createdAt, now));
        else if (filter !== 'all') list = list.filter(i => i.status === filter);

        if (q) list = list.filter(i =>
            String(i.invNo).includes(q) ||
            (i.phone || '').includes(q) ||
            String(i.custName || '').toLowerCase().includes(q));

        list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

        const filters = [
            ['all', t('filter_all')], ['today', t('filter_today')],
            ['pending', t('filter_pending')], ['ready', t('filter_ready')],
            ['paid', t('filter_paid')], ['cancelled', t('filter_cancelled')]
        ];

        el.innerHTML = `
            <div class="panel">
                <div class="filters">
                    ${filters.map(f => `
                        <button class="chip ${filter === f[0] ? 'active' : ''}" onclick="App.setInvFilter('${f[0]}')">${esc(f[1])}</button>`).join('')}
                </div>
                <div class="field" style="margin-top:12px">
                    <input id="invSearch" placeholder="${esc(t('search_inv'))}" value="${esc(q)}"
                           oninput="App.invQuery()">
                </div>
            </div>

            <div class="table-wrap panel inv-cards" style="margin-top:14px">
                <table class="table">
                    <thead><tr>
                        <th>${esc(t('invoice_no'))}</th><th>${esc(t('name'))}</th>
                        <th>${esc(t('total'))}</th><th>${esc(t('date'))}</th>
                        <th>${esc(t('payments'))}</th><th>${esc(t('actions'))}</th>
                    </tr></thead>
                    <tbody>
                        ${list.length ? list.map(i => invoiceRow(i)).join('') :
                        `<tr><td colspan="6" class="empty">${esc(t('no_results'))}</td></tr>`}
                    </tbody>
                </table>
            </div>`;
    }

    function invoiceRow(i) {
        const actions = [];
        if (i.status === 'pending') {
            actions.push(`<button class="btn btn-blue btn-sm" onclick="App.markReady(${i.id})">${esc(t('mark_ready'))}</button>`);
            actions.push(`<button class="btn btn-green btn-sm" onclick="App.openPaymentModal(${i.id})">${esc(t('mark_paid'))}</button>`);
            actions.push(`<button class="btn btn-ghost btn-sm" onclick="App.cancelInvoice(${i.id})">${esc(t('cancel_invoice'))}</button>`);
        } else if (i.status === 'ready') {
            actions.push(`<button class="btn btn-green btn-sm" onclick="App.openPaymentModal(${i.id})">${esc(t('mark_paid'))}</button>`);
            actions.push(`<button class="btn btn-ghost btn-sm" onclick="App.sendInvoiceWA(${i.id})">${esc(t('wa_send'))}</button>`);
            actions.push(`<button class="btn btn-danger btn-sm" onclick="App.deleteInvoice(${i.id})">${esc(t('delete'))}</button>`);
        } else if (i.status === 'paid') {
            actions.push(`<button class="btn btn-ghost btn-sm" onclick="App.sendInvoiceWA(${i.id})">${esc(t('send_wa_invoice'))}</button>`);
            actions.push(`<button class="btn btn-danger btn-sm" onclick="App.deleteInvoice(${i.id})">${esc(t('delete'))}</button>`);
        } else {
            actions.push(`<button class="btn btn-danger btn-sm" onclick="App.deleteInvoice(${i.id})">${esc(t('delete'))}</button>`);
        }
        actions.push(`<button class="btn btn-ghost btn-sm" onclick="App.openInvoiceDetail(${i.id})">${esc(t('details'))}</button>`);
        actions.push(`<button class="btn btn-ghost btn-sm" onclick="App.printInvoiceById(${i.id})">${esc(t('print'))}</button>`);

        const payTxt = i.status === 'paid'
            ? `${esc(t('cash'))}: ${fmt(i.cash)}<br><i>${esc(t('benefit'))}: ${fmt(i.benefit)}</i>`
            : '—';

        return `<tr class="inv-card-row">
            <td class="strong" data-label="${esc(t('invoice_no'))}">#${esc(String(i.invNo))}</td>
            <td data-label="${esc(t('name'))}">${esc(i.custName || '')}<br><span class="dim">${esc(i.phone || '')}</span></td>
            <td class="strong" data-label="${esc(t('total'))}">${cur(i.netTotal)}</td>
            <td data-label="${esc(t('date'))}">${esc(DB.fmtDate(i.createdAt))}<br>${statusBadge(i.status)}</td>
            <td data-label="${esc(t('payments'))}">${payTxt}</td>
            <td data-label="${esc(t('actions'))}"><div class="btn-row">${actions.join('')}</div></td>
        </tr>`;
    }

    function setInvFilter(f) {
        App.state.invFilter = f;
        renderVert();
    }

    function invQuery() {
        App.state.invQuery = document.getElementById('invSearch').value;
        viewInvoices(document.getElementById('view'));
        refocus('invSearch');
    }

    // re-render current vertical (use cached data, no reload of DB)
    function renderVert() {
        const viewEl = document.getElementById('view');
        if (App.state.view === 'invoices') viewInvoices(viewEl);
        else if (App.state.view === 'customers') viewCustomers(viewEl);
        else if (App.state.view === 'subscriptions') viewSubscriptions(viewEl);
        else if (App.state.view === 'accounting') viewAccounting(viewEl);
        else if (App.state.view === 'reports') viewReports(viewEl);
    }

    async function markReady(id) {
        const inv = App.state.invoices.find(i => i.id === id);
        if (!inv) return;
        inv.status = 'ready';
        inv.readyAt = DB.isoNow();
        await DB.put('invoices', inv);
        pushInvToSheet(inv);

        const cfg = App.state.settings;
        if (inv.phone) {
            try {
                await WA.sendReadyMessage(cfg, inv, cfg.shopName || t('appName'), WA.itemsText(inv, App.state.lang, cfg.currency || 'BHD'));
                toast(t('toast_ready_wa'), 'success');
            } catch (e) {
                toast(waFailMsg(e), 'error');
            }
        } else {
            toast(t('status_ready'), 'success');
        }
        renderVert();
    }

    function pushInvToSheet(inv) {
        const cfg = App.state.settings;
        if (!cfg || !cfg.evoPushUrl) return;
        WA.pushInvoice(cfg, inv).then(r => {
            if (!r.ok) toast(t('wa_push_fail') + (r.err ? ' — ' + r.err : ''), 'warn');
            else scheduleQuickSync();
        }).catch(e => toast(t('wa_push_fail') + ' — ' + String(e && e.message || e), 'warn'));
    }

    let _quickSyncT = null;
    function scheduleQuickSync() {
        clearTimeout(_quickSyncT);
        _quickSyncT = setTimeout(() => syncNow(), 900);
    }

    function findInvIn(list, inv) {
        if (inv && inv.id) {
            const f = list.find(x => x && String(x.id) === String(inv.id));
            if (f) return f;
        }
        return list.find(x => x && (x.invNo || 0) === (inv && inv.invNo || 0) && (!inv.id || !x.id));
    }

    async function mergeSheetInvoices(lines) {
        const existing = App.state.invoices || [];
        let added = 0, updated = 0;
        for (const line of lines) {
            if (!Array.isArray(line) || line.length < 11 || !String(line[1]).trim()) continue;
            const inv = arrToInv(line);
            if (!inv.invNo && !inv.id) continue;
            const found = findInvIn(existing, inv);
            if (found) {
                const keepCreated = found.createdAt;
                const fid = found.id;
                Object.assign(found, inv);
                if (fid && !found.id) found.id = fid;
                if (keepCreated) found.createdAt = keepCreated;
                updated++;
            } else {
                if (!inv.id) inv.id = Date.now() + Math.floor(Math.random() * 100000);
                existing.push(inv);
                added++;
            }
        }
        if (added || updated) {
            for (const x of existing) await DB.put('invoices', x);
            App.state.invoices = await DB.getAll('invoices');
            await upsertCustomersFromInvoices(existing);
            await loadCaches();
            renderVert();
        }
        return { added, updated };
    }

    async function syncNow() {
        const s = App.state.settings || {};
        if (s.autoSync === '0' || (typeof document !== 'undefined' && document.hidden)) return;
        const url = String(s.gsheetUrl || s.evoPushUrl || '').trim();
        if (!url) return;
        try {
            const u = url.replace(/\/edit(?:\?|#|$).*$/, '/exec');
            const res = await fetchWithTimeout(u + (u.indexOf('?') > -1 ? '&' : '?') + 'action=export', { method: 'GET' }, 20000);
            if (!res.ok) return;
            const data = await res.json();
            if (data && data.status === 'success' && Array.isArray(data.invoices)) {
                await mergeSheetInvoices(data.invoices);
            }
        } catch (e) { /* silent sync failure */ }
    }

    function startAutoSync() {
        if (App._syncTimer) return;
        App._syncTimer = setInterval(() => syncNow(), 15000);
        if (typeof document !== 'undefined') {
            document.addEventListener('visibilitychange', () => { if (!document.hidden) syncNow(); });
        }
        syncNow();
    }

    async function cancelInvoice(id) {
        confirmAsk(t('cancel_invoice'), t('save_confirm'), async () => {
            const inv = App.state.invoices.find(i => i.id === id);
            if (!inv) return;
            inv.status = 'cancelled';
            inv.cancelledAt = DB.isoNow();
            await DB.put('invoices', inv);
            toast(t('toast_cancelled'), 'warn');
            pushInvToSheet(inv);
            renderVert();
        }, t('common_yes'));
    }

    async function deleteInvoice(id) {
        confirmAsk(t('delete_invoice'), t('save_confirm'), async () => {
            await DB.del('invoices', id);
            toast(t('toast_deleted'), 'warn');
            renderVert();
        });
    }

    function openPaymentModal(id) {
        const inv = App.state.invoices.find(i => i.id === id);
        if (!inv) return;
        modalOpen(`
            <div class="modal-title">${esc(t('confirm_payment'))}</div>
            <div class="modal-field">
                <label>${esc(t('invoice_no'))}</label>
                <div class="strong">#${esc(String(inv.invNo))} — ${esc(inv.custName || '')}</div>
            </div>
            <div class="modal-field">
                <label>${esc(t('total_amount'))}</label>
                <div class="strong big">${cur(inv.netTotal)}</div>
            </div>
            <div class="modal-field">
                <label>${esc(t('cash'))} (${esc(App.state.settings.currency || 'BHD')})</label>
                <input id="payCash" type="number" step="0.001" min="0" value="0.000">
            </div>
            <div class="modal-field">
                <label>${esc(t('benefit'))} (${esc(App.state.settings.currency || 'BHD')})</label>
                <input id="payBenefit" type="number" step="0.001" min="0" value="${fmt(inv.netTotal)}">
            </div>
            <div class="modal-field">
                <label>${esc(t('discount'))} (${esc(App.state.settings.currency || 'BHD')})</label>
                <input id="payDisc" type="number" step="0.001" min="0" value="${fmt(inv.discount || 0)}">
            </div>
            <div class="modal-actions">
                <button class="btn btn-primary" onclick="App.confirmPayment(${id})">${esc(t('common_confirm'))}</button>
                <button class="btn btn-ghost" onclick="App.modalClose()">${esc(t('common_cancel'))}</button>
            </div>`);
    }

    async function confirmPayment(id) {
        const inv = App.state.invoices.find(i => i.id === id);
        if (!inv) return;
        const cash = parseFloat(document.getElementById('payCash').value) || 0;
        const benefit = parseFloat(document.getElementById('payBenefit').value) || 0;
        const disc = parseFloat(document.getElementById('payDisc').value) || 0;
        if (cash + benefit <= 0) { toast(t('phone_required'), 'warn'); return; }
        inv.cash = cash;
        inv.benefit = benefit;
        inv.discount = disc;
        inv.netTotal = cash + benefit;
        inv.status = 'paid';
        inv.paidAt = DB.isoNow();
        await DB.put('invoices', inv);
        modalClose();
        toast(t('toast_paid'), 'success');
        pushInvToSheet(inv);
        renderVert();
    }

    function sendInvoiceWA(id) {
        const inv = App.state.invoices.find(i => i.id === id);
        if (!inv) return;
        if (!inv.phone) { toast(t('wa_num_invalid'), 'error'); return; }
        const cfg = App.state.settings;
        WA.sendInvoiceMessage(cfg, inv, cfg.shopName || t('appName'), WA.itemsText(inv, App.state.lang, cfg.currency || 'BHD'))
            .then(res => {
                if (res && res.pushOk) toast(t('toast_wa_sent'), 'success');
                else toast(t('toast_wa_sent') + ' — ' + t('wa_push_fail') + (res && res.pushErr ? ' (' + res.pushErr + ')' : ''), 'warn');
            })
            .catch(e => toast(waFailMsg(e), 'error'));
    }

    function openInvoiceDetail(id) {
        const inv = App.state.invoices.find(i => i.id === id);
        if (!inv) return;
        modalOpen(`
            <div class="modal-title">${esc(t('invoice_detail'))} #${esc(String(inv.invNo))}</div>
            <div class="detail-grid">
                <div><span class="dim">${esc(t('name'))}</span><div class="strong">${esc(inv.custName || '')}</div></div>
                <div><span class="dim">${esc(t('phone'))}</span><div class="strong">${esc(inv.phone || '')}</div></div>
                <div><span class="dim">${esc(t('date'))}</span><div>${esc(DB.fmtDateTime(inv.createdAt))}</div></div>
                <div><span class="dim">${esc(t('invoice_no'))}</span><div>${statusBadge(inv.status)}</div></div>
            </div>
            <div class="modal-field">
                <label>${esc(t('items'))}</label>
                <div class="detail-items">
                    ${inv.items.map(x => `<div class="bill-row"><span>${esc(x.name)} ×${x.qty} <i class="dim">(${esc(x.mode)} • ${esc(itemUrg(x))})</i></span><span>${cur(x.price)}</span></div>`).join('') || '<div class="empty">—</div>'}
                </div>
            </div>
            <div class="detail-grid">
                ${inv.discount > 0 ? `<div><span class="dim">${esc(t('discount'))}</span><div>${cur(inv.discount)}</div></div>` : ''}
                ${inv.tax > 0 ? `
                <div><span class="dim">${esc(t('subtotal'))}</span><div>${cur((inv.netTotal || 0) - (inv.tax || 0))}</div></div>
                <div><span class="dim">${esc(t('tax_vat'))} (${taxPercent()}%)</span><div>${cur(inv.tax)}</div></div>` : ''}
                <div><span class="dim">${esc(t('net_total'))}</span><div class="strong big royal">${cur(inv.netTotal)}</div></div>
            </div>
            ${inv.status === 'paid' ? `
            <div class="detail-grid">
                <div><span class="dim">${esc(t('cash'))}</span><div>${cur(inv.cash)}</div></div>
                <div><span class="dim">${esc(t('benefit'))}</span><div>${cur(inv.benefit)}</div></div>
                <div><span class="dim">${esc(t('date'))}</span><div>${esc(DB.fmtDateTime(inv.paidAt))}</div></div>
            </div>` : ''}
            <div class="modal-actions">
                <button class="btn btn-ghost" onclick="App.printInvoiceById(${id})">${esc(t('print_invoice'))}</button>
                <button class="btn btn-ghost" onclick="App.modalClose()">${esc(t('common_close'))}</button>
            </div>`);
    }

    /* ================= CUSTOMERS ================= */
    function viewCustomers(el) {
        const q = (App.state.custQuery || '').toLowerCase();
        let list = [...App.state.customers];
        if (q) list = list.filter(c => String(c.name || '').toLowerCase().includes(q) || String(c.phone || '').includes(q));

        const unpaidMap = {};
        const paidMap = {};
        const countMap = {};
        App.state.invoices.forEach(i => {
            const k = i.phone || '';
            if (!k) return;
            countMap[k] = (countMap[k] || 0) + 1;
            if (i.status === 'pending' || i.status === 'ready') unpaidMap[k] = (unpaidMap[k] || 0) + Number(i.netTotal || 0);
            if (i.status === 'paid') paidMap[k] = (paidMap[k] || 0) + Number(i.netTotal || 0);
        });

        el.innerHTML = `
            <div class="panel">
                <div class="panel-head">
                    <input id="custSearch" placeholder="${esc(t('search_cust'))}" value="${esc(q)}"
                           oninput="App.custQuery()">
                    <button class="btn btn-primary" onclick="App.openCustomerModal()">+ ${esc(t('add_customer'))}</button>
                </div>
            </div>
            <div class="card-grid">
                ${list.length ? list.map(c => `
                    <div class="card">
                        <div class="card-head">
                            <div>
                                <div class="strong">${esc(c.name || '')}</div>
                                <div class="dim">${esc(c.phone || '')}</div>
                            </div>
                            <div class="btn-row">
                                <button class="btn btn-ghost btn-sm" onclick="App.openCustomerModal(${c.id})">${esc(t('edit'))}</button>
                                <button class="btn btn-danger btn-sm" onclick="App.deleteCustomer(${c.id})">${esc(t('delete'))}</button>
                            </div>
                        </div>
                        <div class="card-stats">
                            <div><span class="dim">${esc(t('total_unpaid'))}</span><span class="badge bg-red">${cur(unpaidMap[c.phone] || 0)}</span></div>
                            <div><span class="dim">${esc(t('total_paid'))}</span><span class="badge bg-green">${cur(paidMap[c.phone] || 0)}</span></div>
                            <div><span class="dim">${esc(t('invoices_count'))}</span><span class="badge bg-blue">${countMap[c.phone] || 0}</span></div>
                        </div>
                        <div class="card-actions">
                            <button class="btn btn-ghost btn-sm" onclick="App.custHistory('${esc(c.phone)}')">${esc(t('details'))}</button>
                            <button class="btn btn-ghost btn-sm" onclick="App.posWith('${esc(c.phone)}')">${esc(t('go_pos'))}</button>
                        </div>
                    </div>`).join('') : `<div class="empty" style="grid-column:1/-1">${esc(t('no_customers'))}</div>`}
            </div>`;
    }

    function custQuery() {
        App.state.custQuery = document.getElementById('custSearch').value;
        viewCustomers(document.getElementById('view'));
        refocus('custSearch');
    }

    function refocus(id) {
        const el = document.getElementById(id);
        if (el) {
            const v = el.value;
            el.focus();
            el.value = '';
            el.value = v;
        }
    }

    function posWith(phone) {
        const cust = App.state.customers.find(c => c.phone === phone);
        App.state.pos = { items: [], discount: 0, customer: cust || { phone, name: '' } };
        App.state.view = 'pos';
        renderNav();
        hostView();
    }

    function custHistory(phone) {
        const invs = App.state.invoices.filter(i => i.phone === phone).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        const cust = App.state.customers.find(c => c.phone === phone);
        modalOpen(`
            <div class="modal-title">${esc(cust ? cust.name : phone)} — ${esc(t('details'))}</div>
            <div class="detail-items">
                ${invs.map(i => `
                    <div class="bill-row">
                        <span>#${esc(String(i.invNo))} <i class="dim">${esc(DB.fmtDate(i.createdAt))}</i></span>
                        <span>${statusBadge(i.status)} ${cur(i.netTotal)}</span>
                    </div>`).join('') || `<div class="empty">${esc(t('no_results'))}</div>`}
            </div>
            <div class="modal-actions"><button class="btn btn-ghost" onclick="App.modalClose()">${esc(t('common_close'))}</button></div>`);
    }

    function openCustomerModal(id) {
        const c = id ? App.state.customers.find(x => x.id === id) : null;
        modalOpen(`
            <div class="modal-title">${c ? esc(t('edit_customer')) : esc(t('add_customer'))}</div>
            <div class="modal-field"><label>${esc(t('name'))}</label><input id="cName" value="${esc(c ? c.name : '')}"></div>
            <div class="modal-field"><label>${esc(t('phone'))}</label><input id="cPhone" value="${esc(c ? c.phone : '')}"></div>
            <div class="modal-field"><label>${esc(t('email'))}</label><input id="cEmail" value="${esc(c ? c.email : '')}"></div>
            <div class="modal-field"><label>${esc(t('notes'))}</label><input id="cNotes" value="${esc(c ? c.notes : '')}"></div>
            <div class="modal-actions">
                <button class="btn btn-primary" onclick="App.saveCustomer(${c ? c.id : 'null'})">${esc(t('common_save'))}</button>
                <button class="btn btn-ghost" onclick="App.modalClose()">${esc(t('common_cancel'))}</button>
            </div>`);
    }

    async function saveCustomer(id) {
        const name = document.getElementById('cName').value.trim();
        const phone = document.getElementById('cPhone').value.trim();
        const email = document.getElementById('cEmail').value.trim();
        const notes = document.getElementById('cNotes').value.trim();
        if (!name) { toast(t('name_required'), 'error'); return; }

        const dup = App.state.customers.find(c => c.id !== id && c.phone === phone && phone);
        if (dup && phone) {
            modalOpen(`
                <div class="modal-title">${esc(t('duplicates'))}</div>
                <p class="modal-text">${esc(dup.name)} — ${esc(dup.phone)}</p>
                <div class="modal-actions">
                    <button class="btn btn-primary" onclick="App.modalClose()">${esc(t('common_ok'))}</button>
                </div>`);
            return;
        }

        if (id) {
            const c = App.state.customers.find(x => x.id === id);
            c.name = name; c.phone = phone; c.email = email; c.notes = notes;
            await DB.put('customers', c);
        } else {
            await DB.add('customers', { name, phone, email, notes, createdAt: DB.isoNow() });
        }
        modalClose();
        toast(t('customer_saved'), 'success');
        App.state.customers = await DB.getAll('customers');
        renderVert();
    }

    async function deleteCustomer(id) {
        const c = App.state.customers.find(x => x.id === id);
        if (!c) return;
        confirmAsk(t('delete'), t('confirm_delete_customer'), async () => {
            const invs = App.state.invoices.filter(i => i.custId === id || i.phone === c.phone);
            for (const i of invs) await DB.del('invoices', i.id);
            const subs = App.state.subscriptions.filter(s => s.custId === id || s.phone === c.phone);
            for (const s of subs) {
                await DB.del('subscriptions', s.id);
                const pays = App.state.subPayments.filter(p => p.subId === s.id);
                for (const p of pays) await DB.del('subPayments', p.id);
            }
            await DB.del('customers', id);
            toast(t('customer_deleted'), 'warn');
            loadCaches().then(renderVert);
        });
    }

    /* ================= SUBSCRIPTIONS ================= */
    function subStatus(sub) {
        if (sub.status === 'paused') return 'paused';
        if (sub.status === 'cancelled') return 'cancelled';
        // compare nextDue period to current period
        const cur = periodOfMonth(new Date());
        if (sub.nextDue < cur && !sub.nextDue.includes('9999')) return 'overdue';
        return 'active';
    }

    function viewSubscriptions(el) {
        const now = new Date();
        const curPeriod = periodOfMonth(now);
        const subs = App.state.subscriptions;
        const pays = App.state.subPayments;

        let overdue = 0, active = 0, dueNow = 0, monthRev = 0;
        subs.forEach(s => {
            const st = subStatus(s);
            if (st === 'active') active++;
            if (st === 'overdue') overdue++;
            if (s.nextDue === curPeriod) dueNow++;
        });
        pays.forEach(p => { if (inMonth(p.createdAt, now)) monthRev += Number(p.amount || 0); });

        const stats = [
            [t('active_subs'), active, 'green'],
            [t('sub_overdue'), overdue, 'red'],
            [t('sub_next_bill'), dueNow, 'amber'],
            [t('total_subs_rev'), cur(monthRev), 'blue']
        ];

        const list = [...subs].sort((a, b) => a.nextDue.localeCompare(b.nextDue));

        el.innerHTML = `
            <div class="stat-grid">
                ${stats.map(s => `<div class="stat-card ${s[2]}"><div class="stat-label">${esc(s[0])}</div><div class="stat-value">${esc(s[1])}</div></div>`).join('')}
            </div>
            <div class="panel-head" style="margin-top:22px">
                <h3>${esc(t('subs_title'))}</h3>
                <button class="btn btn-primary" onclick="App.openSubModal()">+ ${esc(t('add_sub'))}</button>
            </div>

            <div class="card-grid">
                ${list.length ? list.map(s => subCard(s, pays)).join('') :
                `<div class="panel" style="grid-column:1/-1"><div class="empty">${esc(t('no_subs'))}</div></div>`}
            </div>

            <div class="panel-head" style="margin-top:26px">
                <h3>${esc(t('sub_payments_history'))}</h3>
            </div>
            <div class="table-wrap panel">
                <table class="table">
                    <thead><tr><th>${esc(t('name'))}</th><th>${esc(t('period'))}</th><th>${esc(t('amount'))}</th><th>${esc(t('method'))}</th><th>${esc(t('date'))}</th></tr></thead>
                    <tbody>
                        ${[...pays].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 20).map(p => {
                            const s = subs.find(x => x.id === p.subId);
                            return `<tr>
                                <td class="strong">${esc(s ? s.custName : '')}</td>
                                <td>${esc(p.period)}</td>
                                <td class="strong">${cur(p.amount)}</td>
                                <td>${esc(p.method === 'benefit' ? t('benefit') : t('cash'))}</td>
                                <td class="dim">${esc(DB.fmtDate(p.createdAt))}</td>
                            </tr>`;
                        }).join('') || `<tr><td colspan="5" class="empty">${esc(t('no_results'))}</td></tr>`}
                    </tbody>
                </table>
            </div>`;
    }

    function subCard(s, pays) {
        const st = subStatus(s);
        const paysCount = pays.filter(p => p.subId === s.id).length;
        const lastPay = pays.filter(p => p.subId === s.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
        const statusBadges = {
            active: '<span class="badge bg-green">' + esc(t('sub_active')) + '</span>',
            overdue: '<span class="badge bg-red">' + esc(t('sub_overdue')) + '</span>',
            paused: '<span class="badge bg-amber">' + esc(t('sub_paused')) + '</span>',
            cancelled: '<span class="badge bg-gray">' + esc(t('sub_cancelled')) + '</span>'
        };
        return `
            <div class="card">
                <div class="card-head">
                    <div>
                        <div class="strong">${esc(s.custName || '')}</div>
                        <div class="dim">${esc(s.phone || '')}</div>
                    </div>
                    ${statusBadges[st] || ''}
                </div>
                <div class="card-stats">
                    <div><span class="dim">${esc(t('plan_amount'))}</span><span class="strong">${cur(s.amount)}</span></div>
                    <div><span class="dim">${esc(t('next_due'))}</span><span class="strong">${esc(DB.monthLabel(s.nextDue, App.state.lang))}</span></div>
                    <div><span class="dim">${esc(t('sub_months_paid'))}</span><span class="badge bg-blue">${paysCount}</span></div>
                </div>
                <div class="progress"><div class="progress-bar" style="width:${Math.min(100, (paysCount % 12) * 8.3)}%"></div></div>
                <div class="card-actions">
                    <button class="btn btn-green btn-sm" onclick="App.openSubPayModal(${s.id})">${esc(t('pay_sub'))}</button>
                    <button class="btn btn-ghost btn-sm" onclick="App.sendSubReminder(${s.id})">${esc(t('send_reminder'))}</button>
                    <button class="btn btn-ghost btn-sm" onclick="App.openSubModal(${s.id})">${esc(t('edit'))}</button>
                    ${s.status !== 'cancelled' ? `<button class="btn btn-danger btn-sm" onclick="App.cancelSub(${s.id})">${esc(t('cancel'))}</button>` : ''}
                </div>
                ${lastPay ? `<div class="dim" style="font-size:.8em;margin-top:8px">${esc(t('sub_paid_until'))}: ${esc(lastPay.period)} • ${esc(DB.fmtDate(lastPay.createdAt))}</div>` : ''}
            </div>`;
    }

    function customerOptions(selectedId) {
        return App.state.customers.map(c =>
            `<option value="${c.id}" ${c.id === selectedId ? 'selected' : ''}>${esc(c.name)} — ${esc(c.phone)}</option>`)
            .join('');
    }

    function openSubModal(id) {
        const s = id ? App.state.subscriptions.find(x => x.id === id) : null;
        modalOpen(`
            <div class="modal-title">${s ? esc(t('edit_sub')) : esc(t('add_sub'))}</div>
            <div class="modal-field">
                <label>${esc(t('customer'))}</label>
                <select id="subCust">${customerOptions(s ? s.custId : null)}</select>
            </div>
            <div class="modal-field">
                <label>${esc(t('customer_phone'))}</label>
                <input id="subPhone" value="${esc(s ? s.phone : '')}" placeholder="33xxxxxx">
            </div>
            <div class="modal-field">
                <label>${esc(t('plan_amount'))} (${esc(App.state.settings.currency || 'BHD')})</label>
                <input id="subAmount" type="number" step="0.001" min="0" value="${s ? s.amount : '5.000'}">
            </div>
            <div class="modal-field">
                <label>${esc(t('next_due'))}</label>
                <input id="subNextDue" type="month" value="${periodToMonthInput(s ? s.nextDue : periodOfMonth(new Date()))}">
            </div>
            <div class="modal-field">
                <label>${esc(t('sub_notes'))}</label>
                <input id="subNotes" value="${esc(s ? s.notes : '')}">
            </div>
            <div class="modal-actions">
                <button class="btn btn-primary" onclick="App.saveSub(${s ? s.id : 'null'})">${esc(t('common_save'))}</button>
                <button class="btn btn-ghost" onclick="App.modalClose()">${esc(t('common_cancel'))}</button>
            </div>`);
    }

    async function saveSub(id) {
        const custSel = document.getElementById('subCust');
        const cust = App.state.customers.find(c => String(c.id) === String(custSel.value));
        const phone = document.getElementById('subPhone').value.trim() || (cust ? cust.phone : '');
        const amount = parseFloat(document.getElementById('subAmount').value) || 0;
        const nextDueStr = document.getElementById('subNextDue').value; // format YYYY-MM
        if (!cust && !phone) { toast(t('phone_required'), 'error'); return; }
        if (amount <= 0) { toast(t('phone_required'), 'warn'); return; }
        if (!nextDueStr) { toast(t('phone_required'), 'warn'); return; }

        const parts = nextDueStr.split('-');
        const nextDue = `${parts[1]}/${parts[0]}`; // MM/YYYY

        if (id) {
            const s = App.state.subscriptions.find(x => x.id === id);
            s.custId = cust ? cust.id : s.custId;
            s.custName = cust ? cust.name : document.getElementById('subPhone').value.trim();
            s.phone = phone;
            s.amount = amount;
            s.nextDue = nextDue;
            s.notes = document.getElementById('subNotes').value.trim();
            await DB.put('subscriptions', s);
        } else {
            await DB.add('subscriptions', {
                custId: cust ? cust.id : null,
                custName: cust ? cust.name : document.getElementById('subPhone').value.trim(),
                phone,
                amount,
                nextDue,
                status: 'active',
                notes: document.getElementById('subNotes').value.trim(),
                createdAt: DB.isoNow()
            });
        }
        modalClose();
        toast(t('toast_saved'), 'success');
        loadCaches().then(renderVert);
    }

    function openSubPayModal(id) {
        const s = App.state.subscriptions.find(x => x.id === id);
        if (!s) return;
        modalOpen(`
            <div class="modal-title">${esc(t('record_payment'))}</div>
            <div class="modal-field"><label>${esc(t('customer'))}</label><div class="strong">${esc(s.custName || '')}</div></div>
            <div class="modal-field"><label>${esc(t('period'))}</label><div class="strong">${esc(DB.monthLabel(s.nextDue, App.state.lang))}</div></div>
            <div class="modal-field"><label>${esc(t('plan_amount'))} (${esc(App.state.settings.currency || 'BHD')})</label><input id="spAmount" type="number" step="0.001" min="0" value="${fmt(s.amount)}"></div>
            <div class="modal-field"><label>${esc(t('method'))}</label>
                <select id="spMethod"><option value="cash">${esc(t('cash'))}</option><option value="benefit">${esc(t('benefit'))}</option></select>
            </div>
            <div class="modal-actions">
                <button class="btn btn-primary" onclick="App.saveSubPay(${id})">${esc(t('common_confirm'))}</button>
                <button class="btn btn-ghost" onclick="App.modalClose()">${esc(t('common_cancel'))}</button>
            </div>`);
    }

    async function saveSubPay(id) {
        const s = App.state.subscriptions.find(x => x.id === id);
        if (!s) return;
        const amount = parseFloat(document.getElementById('spAmount').value) || 0;
        const method = document.getElementById('spMethod').value;
        if (amount <= 0) { toast(t('phone_required'), 'warn'); return; }

        const period = s.nextDue;
        await DB.add('subPayments', {
            subId: s.id, custId: s.custId, period,
            amount, method, note: '',
            createdAt: DB.isoNow()
        });
        // advance next due
        const [m, y] = period.split('/');
        const d = new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1);
        d.setMonth(d.getMonth() + 1);
        const pad = n => String(n).padStart(2, '0');
        s.nextDue = `${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
        s.status = 'active';
        await DB.put('subscriptions', s);
        modalClose();
        toast(t('sub_payment_done') + ' ✓', 'success');
        loadCaches().then(renderVert);
    }

    async function cancelSub(id) {
        confirmAsk(t('sub_status'), t('confirm_cancel_sub'), async () => {
            const s = App.state.subscriptions.find(x => x.id === id);
            if (!s) return;
            s.status = 'cancelled';
            await DB.put('subscriptions', s);
            toast(t('toast_cancelled'), 'warn');
            loadCaches().then(renderVert);
        }, t('common_yes'));
    }

    function sendSubReminder(id) {
        const s = App.state.subscriptions.find(x => x.id === id);
        if (!s || !s.phone) return;
        const cfg = App.state.settings;
        if (!cfg.evoServerUrl || !cfg.evoInstance) {
            const cc = WA.cleanNumber(s.phone, cfg.countryCode);
            const msg = encodeURIComponent(`مرحباً ${s.custName}, تذكير باشتراكك الشهري ${DB.monthLabel(s.nextDue, App.state.lang)} بمبلغ ${fmt(s.amount)} ${cfg.currency || 'BHD'}`);
            window.open(`https://wa.me/${cc}?text=${msg}`, '_blank');
            return;
        }
        const label = s.periodLabel = DB.monthLabel(s.nextDue, App.state.lang);
        WA.sendSubReminderMessage(cfg, s, cfg.shopName || t('appName'))
            .then(() => toast(t('toast_wa_sent'), 'success'))
            .catch(e => toast(waFailMsg(e), 'error'));
    }

    /* ================= TAX REPORTS ================= */
    const VAT_QUARTERS = [[1, t('vat_q1')], [2, t('vat_q2')], [3, t('vat_q3')], [4, t('vat_q4')]];

    function vatQuarterOptions() {
        const years = [new Date().getFullYear(), new Date().getFullYear() - 1];
        const opts = [];
        years.forEach(y => VAT_QUARTERS.forEach(([q, label]) => {
            const key = y + '-Q' + q;
            opts.push(`<option value="${key}">${esc(label)} ${y}</option>`);
        }));
        opts.push(`<option value="other">${esc(t('vat_period_other'))}</option>`);
        return opts.join('');
    }

    function vatRatePercent() {
        return parseFloat(App.state.settings.taxRate) || 10;
    }

    function vatNum(id) {
        const el = document.getElementById(id);
        const val = el ? parseFloat(el.value) : 0;
        return isNaN(val) || val < 0 ? 0 : val;
    }

    function vatFmtBHD(n) {
        return n.toFixed(3) + ' ' + (App.state.settings.currency || 'BHD') + '';
    }

    function vatCalc() {
        const rate = vatRatePercent();
        const sales = vatNum('vatSales');
        const input = vatNum('vatInput');
        const output = sales * rate / 100;
        const net = output - input;
        const outEl = document.getElementById('vatOutput');
        const netEl = document.getElementById('vatNet');
        if (outEl) outEl.textContent = vatFmtBHD(output);
        if (netEl) {
            netEl.textContent = vatFmtBHD(Math.abs(net)) + (net < 0 ? ' ' + t('vat_refund_tag') : '');
            netEl.className = 'vat-net ' + (net > 0 ? 'payable' : (net < 0 ? 'refund' : ''));
        }
    }

    function vatCurrent() {
        const rate = vatRatePercent();
        const sales = vatNum('vatSales');
        const zero = vatNum('vatZero');
        const exempt = vatNum('vatExempt');
        const input = vatNum('vatInput');
        const output = sales * rate / 100;
        return { sales, zero, exempt, input, output, net: output - input, rate };
    }

    function vatPeriodLabel() {
        const p = (document.getElementById('vatPeriod') || {}).value || '';
        if (p === 'other') {
            return (document.getElementById('vatPeriodCustom') || {}).value
                ? document.getElementById('vatPeriodCustom').value.trim() : t('vat_period_undefined');
        }
        return p;
    }

    async function vatSave() {
        const v = vatCurrent();
        const label = vatPeriodLabel();
        if (!confirm(t('vat_confirm_save') + '\n' + label)) return;
        await DB.add('vatRecords', {
            id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
            period: label,
            sales: v.sales, zero: v.zero, exempt: v.exempt, input: v.input,
            output: v.output, net: v.net, rate: v.rate,
            createdAt: DB.isoNow()
        });
        await loadCaches();
        renderVatRecordsCard();
        toast(t('vat_saved') + ' ' + label, 'success');
    }

    async function vatDel(id) {
        if (!confirm(t('vat_confirm_del'))) return;
        await DB.del('vatRecords', id);
        await loadCaches();
        renderVatRecordsCard();
        toast(t('vat_deleted'), 'info');
    }

    function renderVatRecordsCard() {
        const el = document.getElementById('vatRecBody');
        if (el) el.innerHTML = vatRecordsTable();
    }

    function vatRecordsTable() {
        const recs = App.state.vatRecords || [];
        if (!recs.length) return `<div class="empty">${esc(t('vat_no_records'))}</div>`;
        return `<div class="table-wrap">
            <table class="table">
                <thead><tr>
                    <th>${esc(t('vat_col_period'))}</th>
                    <th>${esc(t('vat_col_sales'))}</th>
                    <th>${esc(t('vat_col_output'))}</th>
                    <th>${esc(t('vat_col_input'))}</th>
                    <th>${esc(t('vat_col_net'))}</th>
                    <th>${esc(t('vat_col_date'))}</th>
                    <th></th>
                </tr></thead>
                <tbody>
                    ${recs.map(r => `
                        <tr>
                            <td>${esc(r.period)}</td>
                            <td>${vatFmtBHD(Number(r.sales) || 0)}</td>
                            <td>${vatFmtBHD(Number(r.output) || 0)}</td>
                            <td>${vatFmtBHD(Number(r.input) || 0)}</td>
                            <td class="${Number(r.net) > 0 ? 'txt-pay' : (Number(r.net) < 0 ? 'txt-refund' : '')}">${vatFmtBHD(Math.abs(Number(r.net) || 0))}${Number(r.net) < 0 ? ' ' + esc(t('vat_refund_tag')) : ''}</td>
                            <td class="dim">${esc(new Date(r.createdAt).toLocaleDateString(App.state.lang === 'ar' ? 'ar-BH' : 'en-GB'))}</td>
                            <td><button class="btn btn-danger btn-sm" onclick="App.vatDel('${r.id}')">${esc(t('delete'))}</button></td>
                        </tr>`).join('')}
                </tbody>
            </table>
        </div>`;
    }

    function viewReports(el) {
        const items = [
            [t('vat_i_rate'), t('vat_i_rate_v')],
            [t('vat_i_period'), t('vat_i_period_v')],
            [t('vat_i_due'), t('vat_i_due_v')],
            [t('vat_i_man'), t('vat_i_man_v')],
            [t('vat_i_opt'), t('vat_i_opt_v')],
            [t('vat_i_in'), t('vat_i_in_v')]
        ];
        el.innerHTML = `
            <div class="vat-card">
                <h3>${esc(t('vat_info_h'))}</h3>
                <ul class="vat-list">
                    ${items.map(([l, v]) => `
                        <li><span class="badge">${esc(l)}</span>${esc(v)}</li>`).join('')}
                </ul>
            </div>

            <div class="vat-card" style="margin-top:16px">
                <h3>${esc(t('vat_calc_h'))}</h3>
                <div class="row2">
                    <div class="field"><label>${esc(t('vat_period'))}</label>
                        <select id="vatPeriod" onchange="App.vatPeriodToggle()">
                            ${vatQuarterOptions()}
                        </select>
                    </div>
                    <div class="field" id="vatPeriodCustomWrap" style="display:none"><label>${esc(t('vat_period_custom'))}</label>
                        <input id="vatPeriodCustom" placeholder="2026-Q2">
                    </div>
                </div>
                <div class="row2">
                    <div class="field"><label>${esc(t('vat_sales'))}</label>
                        <input id="vatSales" type="number" min="0" step="0.001" value="0" oninput="App.vatCalc()">
                    </div>
                    <div class="field"><label>${esc(t('vat_zero'))}</label>
                        <input id="vatZero" type="number" min="0" step="0.001" value="0">
                    </div>
                </div>
                <div class="row2">
                    <div class="field"><label>${esc(t('vat_exempt'))}</label>
                        <input id="vatExempt" type="number" min="0" step="0.001" value="0">
                    </div>
                    <div class="field"><label>${esc(t('vat_input'))}</label>
                        <input id="vatInput" type="number" min="0" step="0.001" value="0" oninput="App.vatCalc()">
                    </div>
                </div>
                <div class="vat-results">
                    <div class="vat-result-box"><label>${esc(t('vat_output'))}</label><span id="vatOutput">0.000</span></div>
                    <div class="vat-result-box"><label>${esc(t('vat_net'))}</label><span id="vatNet" class="vat-net">0.000</span></div>
                </div>
                <div class="row2">
                    <button class="btn btn-primary" onclick="App.vatSave()">${esc(t('vat_save'))}</button>
                    <button class="btn btn-ghost" onclick="App.vatCalc()">${esc(t('vat_recalc'))}</button>
                </div>
            </div>

            <div class="vat-card" style="margin-top:16px">
                <h3>${esc(t('vat_records_h'))}</h3>
                <div id="vatRecBody">${vatRecordsTable()}</div>
            </div>

            <div class="panel" style="margin-top:16px">
                <p class="hint">${esc(t('vat_reports_note'))}</p>
            </div>`;
        const pcw = document.getElementById('vatPeriodCustomWrap');
        if (pcw && (document.getElementById('vatPeriod').value === 'other')) pcw.style.display = 'block';
    }

    function vatPeriodToggle() {
        const wrap = document.getElementById('vatPeriodCustomWrap');
        if (wrap) wrap.style.display = (document.getElementById('vatPeriod').value === 'other') ? 'block' : 'none';
    }

    /* ================= ACCOUNTING ================= */
    function viewAccounting(el) {
        App.state.txFilter = App.state.txFilter || 'month';
        el.innerHTML = `
            <div class="acc-grid">
                <div class="panel">
                    <h3 class="panel-title">${esc(t('entry'))}</h3>
                    <div class="field"><label>${esc(t('transaction_type'))}</label>
                        <div class="seg">
                            <label><input type="radio" name="txType" value="sale" checked><span>${esc(t('sales'))} (+)</span></label>
                            <label><input type="radio" name="txType" value="expense"><span>${esc(t('expenses'))} (−)</span></label>
                        </div>
                    </div>
                    <div class="field"><label>${esc(t('description'))}</label><input id="txDesc" placeholder="${esc(t('description'))}"></div>
                    <div class="row2">
                        <div class="field"><label>${esc(t('cash'))}</label><input id="txCash" type="number" step="0.001" min="0" value="0.000"></div>
                        <div class="field"><label>${esc(t('benefit'))}</label><input id="txBenefit" type="number" step="0.001" min="0" value="0.000"></div>
                    </div>
                    <button class="btn btn-primary" style="width:100%" onclick="App.saveTx()">${esc(t('common_save'))}</button>
                </div>

                <div class="panel">
                    <h3 class="panel-title">${esc(t('reports'))}</h3>
                    <div class="field"><label>${esc(t('period_selector'))}</label>
                        <select id="txPeriod" onchange="App.txPeriodChange()">
                            <option value="today" ${App.state.txFilter === 'today' ? 'selected' : ''}>${esc(t('p_today'))}</option>
                            <option value="month" ${App.state.txFilter === 'month' ? 'selected' : ''}>${esc(t('p_month'))}</option>
                            <option value="custom" ${App.state.txFilter === 'custom' ? 'selected' : ''}>${esc(t('p_custom'))}</option>
                        </select>
                    </div>
                    <div id="txDates" style="display:${App.state.txFilter === 'custom' ? 'grid' : 'none'}" class="row2">
                        <div class="field"><label>${esc(t('from'))}</label><input id="txFrom" type="date"></div>
                        <div class="field"><label>${esc(t('to'))}</label><input id="txTo" type="date"></div>
                    </div>
                    <div id="txSummary" class="acc-summary">${calcTxSummary()}</div>
                </div>
            </div>

            <div class="panel-head" style="margin-top:22px"><h3>${esc(t('transactions_list'))}</h3></div>
            <div class="table-wrap panel">
                <table class="table">
                    <thead><tr><th>${esc(t('date'))}</th><th>${esc(t('description'))}</th><th>${esc(t('cash'))}</th><th>${esc(t('benefit'))}</th><th>${esc(t('total'))}</th><th></th></tr></thead>
                    <tbody id="txList"></tbody>
                </table>
            </div>`;
        txRenderList();
    }

    function txPeriodChange() {
        App.state.txFilter = document.getElementById('txPeriod').value;
        document.getElementById('txDates').style.display = App.state.txFilter === 'custom' ? 'grid' : 'none';
        document.getElementById('txSummary').innerHTML = calcTxSummary();
        txRenderList();
    }

    function txFiltered() {
        const now = new Date();
        const manual = App.state.transactions || [];
        const paidInvs = App.state.invoices.filter(i => i.status === 'paid');
        const subs = App.state.subPayments || [];

        function within(iso) {
            if (!iso) return false;
            const f = App.state.txFilter;
            if (f === 'today') return isSameDay(iso, now);
            if (f === 'month') return inMonth(iso, now);
            const from = document.getElementById('txFrom') ? new Date(document.getElementById('txFrom').value + 'T00:00:00') : null;
            const to = document.getElementById('txTo') ? new Date(document.getElementById('txTo').value + 'T23:59:59') : null;
            const d = new Date(iso);
            if (from && d < from) return false;
            if (to && d > to) return false;
            return true;
        }

        const items = [];
        paidInvs.forEach(i => { if (within(i.paidAt)) items.push({ kind: 'sale', src: 'inv', label: '#' + i.invNo, desc: i.custName, cash: i.cash, benefit: i.benefit, total: i.netTotal, vat: i.tax || 0, date: i.paidAt }); });
        manual.forEach(tx => { if (within(tx.date)) items.push({ kind: tx.type, src: 'manual', label: tx.type, desc: tx.description, cash: tx.cash, benefit: tx.benefit, total: tx.total, date: tx.date, id: tx.id }); });
        subs.forEach(p => { if (within(p.createdAt)) items.push({ kind: 'sale', src: 'sub', label: 'SUB', desc: 'Subscription ' + p.period, cash: p.method === 'cash' ? p.amount : 0, benefit: p.method === 'benefit' ? p.amount : 0, total: p.amount, date: p.createdAt, id: 's' + p.id }); });
        return items;
    }

    function calcTxSummary() {
        const items = txFiltered();
        let sales = 0, expenses = 0, cash = 0, benefit = 0, vat = 0;
        items.forEach(i => {
            cash += Number(i.cash || 0);
            benefit += Number(i.benefit || 0);
            vat += Number(i.vat || 0);
            if (i.kind === 'sale') sales += Number(i.total || 0);
            else expenses += Number(i.total || 0);
        });
        return `
            <div class="acc-stat"><span>${esc(t('total_sales'))}</span><span class="green">+${cur(sales)}</span></div>
            <div class="acc-stat"><span>${esc(t('acc_vat'))}</span><span class="amber">${cur(vat)}</span></div>
            <div class="acc-stat"><span>${esc(t('total_expenses'))}</span><span class="red">−${cur(expenses)}</span></div>
            <div class="acc-stat strong-line"><span>${esc(t('profit'))}</span><span>${cur(sales - expenses)}</span></div>
            <div class="acc-stat"><span>${esc(t('cash_total'))}</span><span>${cur(cash)}</span></div>
            <div class="acc-stat"><span>${esc(t('benefit_total'))}</span><span>${cur(benefit)}</span></div>`;
    }

    function txRenderList() {
        const box = document.getElementById('txList');
        if (!box) return;
        const items = txFiltered().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 100);
        box.innerHTML = items.length ? items.map(i => `
            <tr>
                <td class="dim">${esc(DB.fmtDate(i.date))}</td>
                <td>${esc(i.desc || '')} <span class="badge ${i.kind === 'sale' ? 'bg-green' : 'bg-red'}">${esc(i.kind === 'sale' ? t('tx_type_sale') : t('tx_type_expense'))}</span></td>
                <td>${cur(i.cash)}</td>
                <td>${cur(i.benefit)}</td>
                <td class="strong">${cur(i.total)}</td>
                <td>${i.id && String(i.id)[0] !== 's' && i.src === 'manual' ? `<button class="btn btn-danger btn-sm" onclick="App.deleteTx(${i.id})">${esc(t('delete'))}</button>` : ''}</td>
            </tr>`).join('') : `<tr><td colspan="6" class="empty">${esc(t('no_transactions'))}</td></tr>`;
    }

    async function saveTx() {
        const type = document.querySelector('input[name="txType"]:checked').value;
        const desc = document.getElementById('txDesc').value.trim();
        const cash = parseFloat(document.getElementById('txCash').value) || 0;
        const benefit = parseFloat(document.getElementById('txBenefit').value) || 0;
        if (!desc) { toast(t('phone_required'), 'warn'); return; }
        if (cash + benefit <= 0) { toast(t('phone_required'), 'warn'); return; }
        await DB.add('transactions', {
            type, description: desc, cash, benefit, total: cash + benefit, date: DB.isoNow()
        });
        toast(t('tx_saved'), 'success');
        await loadCaches();
        renderVert();
    }

    async function deleteTx(id) {
        confirmAsk(t('delete_tx'), t('save_confirm'), async () => {
            await DB.del('transactions', id);
            toast(t('toast_deleted'), 'warn');
            await loadCaches();
            renderVert();
        });
    }

    /* ================= SETTINGS ================= */
    function viewSettings(el) {
        const s = App.state.settings;
        el.innerHTML = `
            <div class="set-grid">
                <div class="panel">
                    <h3 class="panel-title">${esc(t('set_general'))}</h3>
                    <div class="field"><label>${esc(t('set_shop_name'))}</label><input id="sShopName" value="${esc(s.shopName || '')}"></div>
                    <div class="row2">
                        <div class="field"><label>${esc(t('set_shop_phone'))}</label><input id="sShopPhone" value="${esc(s.shopPhone || '')}"></div>
                        <div class="field"><label>${esc(t('set_cr_no'))}</label><input id="sCrNo" value="${esc(s.crNo || '')}"></div>
                    </div>
                    <div class="field"><label>${esc(t('set_shop_addr'))}</label><input id="sShopAddr" value="${esc(s.shopAddr || '')}"></div>
                    <div class="row2">
                        <div class="field"><label>${esc(t('set_currency'))}</label><input id="sCurrency" value="${esc(s.currency || 'BHD')}"></div>
                        <div class="field"><label>${esc(t('set_country_code'))}</label><input id="sCountry" value="${esc(s.countryCode || '973')}"></div>
                    </div>
                    <div class="field"><label>${esc(t('set_password'))}</label><input id="sPassword" value="${esc(s.appPassword || '0005')}"></div>
                    <div class="field"><label>${esc(t('set_language'))}</label>
                        <select id="sLang">
                            <option value="ar" ${App.state.lang === 'ar' ? 'selected' : ''}>العربية</option>
                            <option value="en" ${App.state.lang === 'en' ? 'selected' : ''}>English</option>
                        </select>
                    </div>
                    <h3 class="panel-title" style="margin-top:16px">${esc(t('set_tax'))}</h3>
                    <div class="field">
                        <label class="check"><input type="checkbox" id="sTaxOn" ${s.taxEnabled === '1' || s.taxEnabled === true ? 'checked' : ''}>
                        <span>${esc(t('set_tax_enable'))}</span></label>
                    </div>
                    <div class="field"><label>${esc(t('set_tax_rate'))}</label><input id="sTaxRate" type="number" step="0.1" min="0" max="100" value="${esc(s.taxRate || '5')}"></div>
                    <div class="field"><label>${esc(t('set_tax_no'))}</label><input id="sTaxNo" value="${esc(s.taxNo || '')}" placeholder="3XXXXXXXX3"></div>
                    <button class="btn btn-primary" style="width:100%" onclick="App.saveSettings()">${esc(t('save_settings'))}</button>
                </div>

                <div class="panel">
                    <h3 class="panel-title">${esc(t('set_whatsapp'))}</h3>
                    <p class="hint">${esc(t('evo_hint'))}</p>
                    <div class="field"><label>${esc(t('evo_server'))}</label><input id="sEvoServer" value="${esc(s.evoServerUrl || '')}" placeholder="http://192.168.1.10:8080"></div>
                    <div class="row2">
                        <div class="field"><label>${esc(t('evo_instance'))}</label><input id="sEvoInstance" value="${esc(s.evoInstance || 'default')}"></div>
                        <div class="field"><label>${esc(t('evo_api_key'))}</label><input id="sEvoKey" value="${esc(s.evoApiKey || '')}"></div>
                    </div>
                    <div class="field">
                        <label class="check"><input type="checkbox" id="sEvoAuto" ${s.evoAutoSend === '1' || s.evoAutoSend === true ? 'checked' : ''}>
                        <span>${esc(t('evo_auto_send'))}</span></label>
                    </div>
                    <div class="row2">
                        <button class="btn btn-dark" onclick="App.evoTest()">${esc(t('evo_test'))}</button>
                        <div class="field" style="margin:0">
                            <label>${esc(t('evo_test_number'))}</label>
                            <input id="sTestNum" placeholder="33xxxxxx">
                        </div>
                    </div>
                    <div class="row2">
                        <button class="btn btn-whatsapp" style="margin-top:10px" onclick="App.evoSendTest()">${esc(t('evo_send_test'))}</button>
                    </div>
                    <div id="evoResult" class="hint" style="margin-top:10px"></div>
                </div>
            </div>

            <div class="set-grid">
                <div class="panel">
                    <h3 class="panel-title">${esc(t('evo_template_ready'))}</h3>
                    <textarea id="sMsgReady" rows="4">${esc(s.msgReady || '')}</textarea>
                    <h3 class="panel-title" style="margin-top:14px">${esc(t('evo_template_invoice'))}</h3>
                    <textarea id="sMsgInvoice" rows="4">${esc(s.msgInvoice || '')}</textarea>
                    <h3 class="panel-title" style="margin-top:14px">${esc(t('evo_pay_note'))}</h3>
                    <textarea id="sEvoPayNote" rows="2">${esc(s.evoPayNote || '')}</textarea>
                    <h3 class="panel-title" style="margin-top:14px">${esc(t('evo_inv_link'))}</h3>
                    <input id="sEvoInvLink" value="${esc(s.evoInvLink || '')}" placeholder="https://script.google.com/macros/s/..../exec?id={inv}">
                    <h3 class="panel-title" style="margin-top:14px">${esc(t('evo_push_url'))}</h3>
                    <input id="sEvoPushUrl" value="${esc(s.evoPushUrl || '')}" placeholder="https://script.google.com/macros/s/..../exec">
                </div>
                <div class="panel">
                    <h3 class="panel-title">${esc(t('evo_template_reminder'))}</h3>
                    <textarea id="sMsgReminder" rows="4">${esc(s.msgReminder || '')}</textarea>
                    <h3 class="panel-title" style="margin-top:14px">${esc(t('evo_template_sub'))}</h3>
                    <textarea id="sMsgSub" rows="4">${esc(s.msgSubReminder || '')}</textarea>
                </div>
            </div>
            <p class="hint">${esc(t('evo_template_hint'))}</p>

            <div class="set-grid">
                <div class="panel">
                    <h3 class="panel-title">${esc(t('reset_stack_list'))}</h3>
                    <div class="row2">
                        <button class="btn btn-dark" onclick="App.exportData()">${esc(t('export_data'))}</button>
                        <button class="btn btn-ghost" onclick="document.getElementById('importFile').click()">${esc(t('import_data'))}</button>
                        <input type="file" id="importFile" accept=".json" style="display:none" onchange="App.importData(event)">
                    </div>
                    <button class="btn btn-danger" style="width:100%;margin-top:10px" onclick="App.wipeData()">${esc(t('wipe_data'))}</button>
                </div>
                <div class="panel">
                    <h3 class="panel-title">${esc(t('about'))}</h3>
                    <p class="hint">${esc(t('about_text'))}</p>
                </div>
            </div>

            <div class="set-grid">
                <div class="panel">
                    <h3 class="panel-title">${esc(t('export_csv'))} / ${esc(t('import_csv'))}</h3>
                    <div class="row2">
                        <button class="btn btn-dark" onclick="App.exportInvoicesCSV()">${esc(t('export_csv'))}</button>
                        <button class="btn btn-ghost" onclick="document.getElementById('importCsvFile').click()">${esc(t('import_csv'))}</button>
                        <input type="file" id="importCsvFile" accept=".csv,.txt" style="display:none" onchange="App.importInvoicesCSV(event)">
                    </div>
                    <p class="hint">${esc(t('csv_hint'))}</p>
                </div>
                <div class="panel">
                    <h3 class="panel-title">${esc(t('gsheet_url'))}</h3>
                    <input id="sGsheetUrl" value="${esc(s.gsheetUrl || '')}" placeholder="https://script.google.com/macros/s/..../exec">
                    <label class="chk" style="margin:8px 0;display:block">
                        <input type="checkbox" id="sAutoSync" ${s.autoSync !== '0' ? 'checked' : ''}> ${esc(t('auto_sync'))}
                    </label>
                    <div class="row2">
                        <button class="btn btn-primary" onclick="App.sheetSync(true)">${esc(t('sync_to'))}</button>
                        <button class="btn btn-ghost" onclick="App.sheetSync(false)">${esc(t('sync_from'))}</button>
                    </div>
                    <p class="hint">${esc(t('sync_hint'))}</p>
                </div>
            </div>`;
    }

    function currentEvoCfg() {
        return {
            serverUrl: window.WA.normalizeServerUrl(document.getElementById('sEvoServer').value.trim()),
            instance: document.getElementById('sEvoInstance').value.trim(),
            apiKey: document.getElementById('sEvoKey').value.trim(),
            countryCode: document.getElementById('sCountry').value.trim()
        };
    }

    async function evoTest() {
        const resEl = document.getElementById('evoResult');
        resEl.textContent = t('processing');
        resEl.className = 'hint';
        try {
            const r = await WA.testConnection(currentEvoCfg());
            resEl.textContent = t('evo_test_ok') + ' (' + (r.state || 'open') + ')';
            resEl.className = 'hint green';
            DB.setSetting('evoConnected', 'true');
        } catch (e) {
            resEl.textContent = t('evo_test_fail') + ' — ' + String(e.message || e);
            resEl.className = 'hint red';
            DB.setSetting('evoConnected', 'false');
        }
    }

    async function evoSendTest() {
        const resEl = document.getElementById('evoResult');
        const num = document.getElementById('sTestNum').value.trim();
        if (!num) { resEl.textContent = t('phone_required'); resEl.className = 'hint red'; return; }
        resEl.textContent = t('processing');
        resEl.className = 'hint';
        try {
            await WA.sendText(currentEvoCfg(), num, '🧺 ' + (App.state.settings.shopName || t('appName')) + ' — WhatsApp API connected!');
            resEl.textContent = t('toast_wa_sent');
            resEl.className = 'hint green';
        } catch (e) {
            resEl.textContent = t('wa_failed') + ' — ' + String(e.message || e);
            resEl.className = 'hint red';
        }
    }

    async function saveSettings() {
        const pairs = [
            { key: 'shopName', value: document.getElementById('sShopName').value.trim() },
            { key: 'shopPhone', value: document.getElementById('sShopPhone').value.trim() },
            { key: 'shopAddr', value: document.getElementById('sShopAddr').value.trim() },
            { key: 'crNo', value: document.getElementById('sCrNo').value.trim() },
            { key: 'currency', value: document.getElementById('sCurrency').value.trim() || 'BHD' },
            { key: 'countryCode', value: document.getElementById('sCountry').value.trim() || '973' },
            { key: 'appPassword', value: document.getElementById('sPassword').value.trim() },
            { key: 'taxEnabled', value: document.getElementById('sTaxOn').checked ? '1' : '0' },
            { key: 'taxRate', value: String(parseFloat(document.getElementById('sTaxRate').value) || 0) },
            { key: 'taxNo', value: document.getElementById('sTaxNo').value.trim() },
            { key: 'evoServerUrl', value: window.WA.normalizeServerUrl(document.getElementById('sEvoServer').value.trim()) },
            { key: 'evoInstance', value: document.getElementById('sEvoInstance').value.trim() },
            { key: 'evoApiKey', value: document.getElementById('sEvoKey').value.trim() },
            { key: 'evoAutoSend', value: document.getElementById('sEvoAuto').checked ? '1' : '0' },
            { key: 'msgReady', value: document.getElementById('sMsgReady').value },
            { key: 'msgInvoice', value: document.getElementById('sMsgInvoice').value },
            { key: 'msgReminder', value: document.getElementById('sMsgReminder').value },
            { key: 'msgSubReminder', value: document.getElementById('sMsgSub').value },
            { key: 'evoPayNote', value: document.getElementById('sEvoPayNote').value },
            { key: 'evoInvLink', value: document.getElementById('sEvoInvLink').value.trim() },
            { key: 'evoPushUrl', value: document.getElementById('sEvoPushUrl').value.trim() },
            { key: 'gsheetUrl', value: document.getElementById('sGsheetUrl').value.trim() },
            { key: 'autoSync', value: document.getElementById('sAutoSync').checked ? '1' : '0' }
        ];
        const newLang = document.getElementById('sLang').value;
        if (newLang !== App.state.lang) pairs.push({ key: 'language', value: newLang });
        await DB.setMany(pairs);
        App.state.settings = await DB.getSettings();
        App.state.lang = App.state.settings.language;
        applyLang();
        toast(t('settings_saved'), 'success');
        loadCaches().then(() => renderVert());
    }

    async function exportData() {
        const json = await DB.exportAll();
        const blob = new Blob([json], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'laundry-backup-' + DB.todayStr().replace(/\//g, '-') + '.json';
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 3000);
        toast(t('backup_ok'), 'success');
    }

    async function importData(ev) {
        const file = ev.target.files[0];
        if (!file) return;
        try {
            const text = await file.text();
            await DB.importAll(text);
            toast(t('import_ok'), 'success');
            await loadCaches();
            renderVert();
        } catch (e) {
            toast(t('import_bad'), 'error');
            console.error(e);
        }
        ev.target.value = '';
    }

    /* ============ EXCEL (CSV) & GOOGLE SHEET SYNC ============ */
    const SHEET_HEADERS = ['التاريخ', 'رقم الفاتورة', 'الاسم', 'الهاتف', 'الخدمات', 'الاجمالي', 'الحاله', 'كاش', 'بنفت', 'تاريخ الدفع', 'الدفع الشهري', 'ID'];
    const STATUS_TO_AR = { pending: 'قيد المعالجة', ready: 'جاهزة', paid: 'تم الدفع', cancelled: 'ملغي' };
    const AR_TO_STATUS = { 'قيد المعالجة': 'pending', 'قيد التجهيز': 'pending', 'جاهزة': 'ready', 'جاهز': 'ready', 'تم الدفع': 'paid', 'مدفوع': 'paid', 'ملغي': 'cancelled' };

    function csvCell(v) {
        if (v === null || v === undefined) return '';
        if (typeof v === 'object') v = JSON.stringify(v);
        v = String(v);
        return /[",\r\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
    }
    function csvRow(arr) { return arr.map(csvCell).join(','); }

    function sheetDate(d) {
        if (!d) return '';
        const dt = new Date(d);
        if (isNaN(dt)) return String(d);
        const p = n => ('0' + n).slice(-2);
        return dt.getFullYear() + '/' + p(dt.getMonth() + 1) + '/' + p(dt.getDate());
    }
    function ddmmDate(d) {
        if (!d) return '';
        const dt = d instanceof Date ? d : new Date(d);
        if (isNaN(dt)) return String(d);
        const p = n => ('0' + n).slice(-2);
        return p(dt.getDate()) + '/' + p(dt.getMonth() + 1) + '/' + dt.getFullYear();
    }
    function svcText(inv) {
        if (!inv.items || !inv.items.length) return '';
        return inv.items.map(it => {
            const n = it.name || '';
            const mode = it.mode ? ' (' + it.mode + ')' : '';
            return n + mode + ' (x' + (it.qty || 1) + ')';
        }).join(', ');
    }
    function money3(n) {
        return (Math.round((parseFloat(n) || 0) * 1000) / 1000).toFixed(3);
    }
    function coinText(n) {
        let s = String(Math.round((parseFloat(n) || 0) * 1000) / 1000);
        if (s.indexOf('.') > -1) s = s.replace(/0+$/, '').replace(/\.$/, '');
        return (s === '-0' ? '0' : s) + ' BH';
    }
    function parseDateFlex(s) {
        const m = String(s || '').trim().split(/[\/\-.]/).map(Number);
        if (m.length !== 3 || m.some(isNaN)) return '';
        let y, mo, d;
        if (m[0] > 31) { y = m[0]; mo = m[1]; d = m[2]; }
        else { d = m[0]; mo = m[1]; y = m[2]; }
        const dt = new Date(y, (mo || 1) - 1, d || 1);
        return isNaN(dt) ? '' : dt.toISOString();
    }
    function svcToItems(s) {
        if (!s) return [];
        return String(s).split(',').map(tok => {
            tok = tok.trim();
            if (!tok) return null;
            let m = tok.match(/^\s*(.*?)\s*\(([^)]*)\)\s*\(x([\d.]+)\)\s*$/);
            let name, mode, qty;
            if (m) { name = m[1]; mode = m[2]; qty = parseFloat(m[3]) || 1; }
            else if ((m = tok.match(/^\s*(.*?)\s*\(([^)]*)\)\s*x([\d.]+)\s*$/))) { name = m[1]; mode = m[2]; qty = parseFloat(m[3]) || 1; }
            else { name = tok; mode = ''; qty = 1; }
            return { name, mode, qty, price: 0, urgent: 0 };
        }).filter(Boolean);
    }
    function invToRow(inv) {
        return [
            sheetDate(inv.createdAt), inv.invNo, inv.custName || inv.name || '', inv.phone || '',
            svcText(inv), money3(inv.netTotal) + ' BHD', STATUS_TO_AR[inv.status] || '',
            coinText(inv.cash !== undefined ? inv.cash : 0), coinText(inv.benefit !== undefined ? inv.benefit : 0),
            ddmmDate(inv.paidAt), '', (inv.id !== undefined && inv.id !== null && inv.id !== '') ? inv.id : ''
        ];
    }
    function arrToInv(line) {
        const get = i => (line[i] === undefined ? '' : String(line[i]).trim());
        const tot = parseFloat(String(line[5] || '0').replace(/[^\d.]/g, '')) || 0;
        const out = {
            invNo: parseInt(get(1), 10) || 0,
            custName: get(2), name: get(2), phone: get(3),
            items: svcToItems(get(4)),
            total: tot, netTotal: tot, discount: 0, tax: 0,
            currency: 'BHD',
            status: AR_TO_STATUS[get(6)] || 'pending',
            cash: parseFloat(String(line[7] || '0').replace(/[^\d.]/g, '')) || 0,
            benefit: parseFloat(String(line[8] || '0').replace(/[^\d.]/g, '')) || 0,
            paidAt: parseDateFlex(get(9))
        };
        const d0 = get(0);
        const dm = d0.match(/^(\d{4})\/(\d{2})\/(\d{2})$/);
        out.createdAt = dm ? new Date(Number(dm[1]), Number(dm[2]) - 1, Number(dm[3])).toISOString() : new Date().toISOString();
        out.readyAt = ''; out.cancelledAt = '';
        const idRaw = get(11).replace(/[^0-9]/g, '');
        if (idRaw) out.id = Number(idRaw);
        return out;
    }
    function parseCSV(text) {
        const rows = []; let row = []; let cur = ''; let inQ = false;
        text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        for (let i = 0; i < text.length; i++) {
            const ch = text[i];
            if (inQ) {
                if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else inQ = false; }
                else cur += ch;
            } else if (ch === '"') { inQ = true; }
            else if (ch === ',') { row.push(cur); cur = ''; }
            else if (ch === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
            else cur += ch;
        }
        if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
        return rows.filter(r => r.some(c => String(c).trim() !== ''));
    }
    async function exportInvoicesCSV() {
        const invs = App.state.invoices || [];
        if (!invs.length) { toast(t('no_invoices'), 'warn'); return; }
        const lines = [csvRow(SHEET_HEADERS)];
        invs.slice().sort((a, b) => (a.invNo || 0) - (b.invNo || 0)).forEach(i => lines.push(csvRow(invToRow(i))));
        const blob = new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'invoices-' + DB.todayStr().replace(/\//g, '-') + '.csv';
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 3000);
        toast(t('csv_export_ok'), 'success');
    }
    async function importInvoicesCSV(ev) {
        const file = ev.target.files[0];
        if (!file) return;
        try {
            const rows = parseCSV(await file.text());
            if (!rows.length || rows[0].length < 11 || rows[0].indexOf('رقم الفاتورة') < 0) {
                toast(t('csv_bad'), 'error'); return;
            }
            const existing = App.state.invoices || [];
            let added = 0, updated = 0;
            for (let r = 1; r < rows.length; r++) {
                const line = rows[r];
                if (!line.some(c => String(c).trim() !== '')) continue;
                const inv = arrToInv(line);
                if (!inv.invNo) continue;
                const found = findInvIn(existing, inv);
                if (found) {
                    const keepCreated = found.createdAt;
                    const fid = found.id;
                    Object.assign(found, inv);
                    if (fid && !found.id) found.id = fid;
                    if (keepCreated) found.createdAt = keepCreated;
                    updated++;
                } else {
                    if (!inv.id) inv.id = Date.now() + Math.floor(Math.random() * 100000);
                    existing.push(inv);
                    added++;
                }
            }
            for (const x of existing) await DB.put('invoices', x);
            App.state.invoices = await DB.getAll('invoices');
            const custAdded = await upsertCustomersFromInvoices(existing);
            await loadCaches();
            renderVert();
            toast(t('csv_import_ok') + ' (+' + added + ' / ~' + updated + ') · عملاء +' + custAdded, 'success');
        } catch (e) {
            console.error(e);
            toast(t('csv_bad'), 'error');
        }
        ev.target.value = '';
    }
    async function upsertCustomersFromInvoices(invList) {
        const byKey = {};
        for (const inv of invList) {
            const name = String(inv.custName || inv.name || '').trim();
            const phone = String(inv.phone || '').trim();
            if (!phone && !name) continue;
            const key = phone || name;
            if (!byKey[key]) byKey[key] = { name, phone };
        }
        const cur = App.state.customers || [];
        const seen = new Set();
        cur.forEach(c => seen.add(c.phone || c.name));
        let added = 0;
        for (const k in byKey) {
            if (seen.has(k)) continue;
            cur.push({ id: Date.now() + Math.floor(Math.random() * 1000), name: byKey[k].name, phone: byKey[k].phone, email: '', notes: '', createdAt: DB.isoNow() });
            seen.add(k);
            added++;
        }
        if (added) {
            for (const c of cur) await DB.put('customers', c);
            App.state.customers = await DB.getAll('customers');
        }
        return added;
    }
    async function fetchWithTimeout(url, opts, ms) {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), ms || 25000);
        try { return await fetch(url, Object.assign({ signal: ctrl.signal }, opts)); }
        finally { clearTimeout(t); }
    }
    async function sheetSync(push) {
        const inp = document.getElementById('sGsheetUrl');
        let url = (inp ? inp.value : App.state.settings.gsheetUrl || '').trim();
        if (!url) { toast(t('sync_fail'), 'error'); return; }
        if (/\/edit(?:\?|#|$)/.test(url)) url = url.replace(/\/edit.*$/, '/exec');
        try {
            let res;
            if (push) {
                res = await fetchWithTimeout(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                    body: JSON.stringify({ action: 'push', invoices: (App.state.invoices || []).map(invToRow) })
                }, 30000);
            } else {
                res = await fetchWithTimeout(url + (url.indexOf('?') > -1 ? '&' : '?') + 'action=export', { method: 'GET' }, 30000);
            }
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const data = await res.json();
            if (!data || data.status !== 'success') throw new Error('bad payload');
            if (!push && Array.isArray(data.invoices)) {
                await mergeSheetInvoices(data.invoices);
            }
            toast(t('sync_ok'), 'success');
        } catch (e) {
            console.error(e);
            toast(t('sync_fail'), 'error');
        }
    }

    async function wipeData() {
        confirmAsk(t('wipe_data'), t('confirm_wipe'), async () => {
            await DB.wipeAll();
            toast(t('toast_deleted'), 'warn');
            await loadCaches();
            renderVert();
        }, t('common_yes'));
    }

    /* ================= MERGE OLD APP ================= */
    const ATTACHED_PATH = 'C:/Users/User/OneDrive/المستندات/Default Project/laundry1-app';

    function launchAttached() {
        try {
            window.open('file:///' + encodeURI(ATTACHED_PATH) + '/index.html', '_blank');
        } catch (e) {
            toast(e.message || String(e), 'error');
        }
    }

    function viewAttached(el) {
        const preview = App._mergePreview || '';
        el.innerHTML = `
            <div class="set-grid">
                <div class="panel">
                    <h3 class="panel-title">${esc(t('attached_title'))}</h3>
                    <p class="hint">${esc(t('attached_hint'))}</p>
                    <p class="hint path-hint"><b>${esc(ATTACHED_PATH)}</b></p>
                    <div class="row2" style="margin-top:14px">
                        <button class="btn btn-primary" onclick="App.launchAttached()">${esc(t('attached_open'))}</button>
                        <button class="btn btn-ghost" onclick="App.mergeScan()">${esc(t('attached_merge'))}</button>
                        <button class="btn btn-ghost" onclick="document.getElementById('mergeFile').click()">${esc(t('attached_import'))}</button>
                        <input type="file" id="mergeFile" accept=".json,application/json" style="display:none" onchange="App.mergeFile(event)">
                    </div>
                    <p class="hint">${esc(t('attached_worked'))}</p>
                    <div id="mergePreview" class="merge-preview">${preview}</div>
                </div>
            </div>`;
    }

    function viewMerge(el) {
        const preview = App._mergePreview || '';
        el.innerHTML = `
            <div class="set-grid">
                <div class="panel">
                    <h3 class="panel-title">${esc(t('merge_title'))}</h3>
                    <p class="hint">${esc(t('merge_hint'))}</p>
                    <div class="row2" style="margin-top:14px">
                        <button class="btn btn-primary" onclick="App.mergeScan()">${esc(t('merge_scan'))}</button>
                        <button class="btn btn-ghost" onclick="document.getElementById('mergeFile').click()">${esc(t('merge_import'))}</button>
                        <input type="file" id="mergeFile" accept=".json,application/json" style="display:none" onchange="App.mergeFile(event)">
                    </div>
                    <p class="hint">${esc(t('merge_scan_tip'))}</p>
                    <p class="hint">${esc(t('skip_hint'))}</p>
                    <div id="mergePreview" class="merge-preview">${preview}</div>
                </div>
            </div>`;
    }

    function mergeParseValue(v) {
        if (typeof v !== 'string') return v;
        try { return JSON.parse(v); } catch (e) { return v; }
    }

    function mergeNormalize(raw) {
        let leads = [], services = [], company = null;
        const lines = { leads: 0, services: 0, company: 0 };

        function push(array, key, item) {
            item.mergeLine = key;
            array.push(item);
        }

        if (Array.isArray(raw)) {
            raw.forEach(x => push(leads, 'leads', x));
        } else if (raw && typeof raw === 'object') {
            Object.keys(raw).forEach((key) => {
                const val = mergeParseValue(raw[key]);
                if (/lead|customer|عميل/.test(key) && Array.isArray(val)) {
                    val.forEach(x => push(leads, key, x));
                } else if (/service|خدمة/.test(key) && Array.isArray(val)) {
                    val.forEach(x => push(services, key, x));
                } else if (/company|info|معلومات/.test(key) && val && typeof val === 'object') {
                    company = val;
                }
            });
        }

        const goodLeads = leads.filter(l => l && (l.name || l.phone));
        lines.leads = goodLeads.length;
        lines.services = services.length;
        lines.company = company ? 1 : 0;
        return { leads: goodLeads, services, company, lines };
    }

    function mergeRenderPreview() {
        const d = App._mergeData;
        const p = document.getElementById('mergePreview');
        if (!p) return;
        if (!d || !d.lines.leads && !d.lines.services && !d.lines.company) {
            p.innerHTML = `<div class="empty">${esc(t('merge_none'))}</div>`;
            return;
        }
        p.innerHTML = `
            <div class="acc-summary" style="margin-top:14px">
                <div class="acc-stat"><span>${esc(t('merge_leads'))}</span><span class="strong-line"><b>${d.lines.leads}</b></span></div>
                <div class="acc-stat"><span>${esc(t('merge_services'))}</span><span class="strong-line"><b>${d.lines.services}</b></span></div>
                <div class="acc-stat"><span>${esc(t('merge_company'))}</span><span class="strong-line"><b>${d.lines.company ? '✓' : '—'}</b></span></div>
            </div>
            <button class="btn btn-dark" style="width:100%;margin-top:12px" onclick="App.mergeRun()">${esc(t('merge_run'))}</button>`;
    }

    function mergeDataFromLocalStorage() {
        const out = {};
        try {
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.indexOf('laundrypro_') === 0) out[key] = localStorage.getItem(key);
            }
        } catch (e) { /* cross-origin read blocked */ }
        return out;
    }

    function mergeScan() {
        const raw = mergeDataFromLocalStorage();
        App._mergeData = mergeNormalize(raw);
        mergeRenderPreview();
    }

    function mergeFile(ev) {
        const file = ev.target.files[0];
        if (!file) return;
        file.text().then((text) => {
            try {
                const raw = JSON.parse(text);
                App._mergeData = mergeNormalize(raw);
                mergeRenderPreview();
            } catch (e) {
                toast(t('import_bad'), 'error');
            }
        }).catch(() => toast(t('import_bad'), 'error'));
        ev.target.value = '';
    }

    function mergeCategory(name) {
        const n = String(name || '');
        if (/بطان|مفرش|لحاف|ستائر|سجاد|مخدة|شرشف/.test(n)) return 'bedding';
        if (/زي|بدلة|موظف|شركة/.test(n)) return 'mens';
        if (/عبا|ثوب|فستان|نسائ|حجاب/.test(n)) return 'ladies';
        if (/باقة|تعاقد|اشتراك|شهر/.test(n)) return 'manual';
        return 'general';
    }

    async function mergeRun() {
        const d = App._mergeData;
        if (!d) { toast(t('merge_none'), 'warn'); return; }

        let addedCust = 0, addedSvc = 0, shoptouched = [];
        const phones = new Set(App.state.customers.map(c => String(c.phone || '')));
        const svcNames = new Set(App.state.services.map(s => s.nameAr));

        for (const lead of d.leads) {
            const phone = String(lead.phone || '').trim();
            if (phone && phones.has(phone)) continue;
            const note = [lead.category ? lead.category : '', lead.address || ''].filter(Boolean).join(' — ');
            const cust = {
                name: String(lead.name || ''),
                phone,
                email: lead.email || '',
                notes: note || (lead.notes || ''),
                createdAt: lead.createdAt || DB.isoNow()
            };
            const id = await DB.add('customers', cust);
            phones.add(phone);
            addedCust++;
            App.state.customers.push(Object.assign({ id }, cust));
        }

        let maxId = App.state.services.reduce((m, s) => Math.max(m, Number(s.id) || 0), 0);
        for (const svc of d.services) {
            const nameAr = String(svc.name || svc.nameAr || '').trim();
            if (!nameAr || svcNames.has(nameAr)) continue;
            maxId++;
            const rec = {
                id: maxId,
                nameAr,
                nameEn: nameAr,
                cat: mergeCategory(nameAr),
                wash: Number(svc.price || svc.wash || 0),
                iron: Number(svc.iron || 0),
                manual: false
            };
            await DB.add('services', rec);
            svcNames.add(nameAr);
            addedSvc++;
            App.state.services.push(rec);
        }

        if (d.company && typeof d.company === 'object') {
            const cur = App.state.settings;
            const pairs = [];
            if (!(cur.shopName || '').trim()) pairs.push({ key: 'shopName', value: String(d.company.name || '') });
            if (!(cur.shopPhone || '').trim()) pairs.push({ key: 'shopPhone', value: String(d.company.phone || '') });
            if (!(cur.shopAddr || '').trim()) pairs.push({ key: 'shopAddr', value: String(d.company.address || '') });
            if (pairs.length) {
                await DB.setMany(pairs);
                shoptouched = pairs.map(p => p.key);
            }
        }

        App._mergeData = null;
        App._mergePreview = '';
        renderVert();
        toast(t('merge_done') + ` (${addedCust} / ${addedSvc})`, 'success');
    }

    /* ================= PRINT ================= */
    function printInvoice(inv) {
        const lang = App.state.lang;
        const s = App.state.settings;
        const rows = inv.items.map(i => `
            <tr>
                <td>${esc(i.name)}</td>
                <td>${esc(i.mode)} • ${esc(itemUrg(i))}</td>
                <td>${i.qty}</td>
                <td>${cur(i.price)}</td>
            </tr>`).join('');
        const html = `
            <div class="inv">
                <div class="header">
                    <div class="shop">${esc(s.shopName || t('appName'))}</div>
                    <div class="sub">${esc(s.shopAddr || '')}</div>
                    <div class="sub">${esc(t('cr_no'))}: ${esc(s.crNo || '')}</div>
                    ${inv.tax > 0 && s.taxNo ? `<div class="sub">${esc(t('tax_no'))}: ${esc(s.taxNo)}</div>` : ''}
                    <div class="sub">${esc(t('phone'))}: ${esc(s.shopPhone || '')}</div>
                </div>
                <div class="meta">
                    <span>${lang === 'ar' ? 'الفاتورة رقم' : 'Invoice No'} : <b>#${esc(String(inv.invNo))}</b></span>
                    <span>${esc(DB.fmtDateTime(inv.createdAt))}</span>
                </div>
                <div class="meta">
                    <span>${lang === 'ar' ? 'العميل' : 'Customer'} : <b>${esc(inv.custName || '')}</b></span>
                    <span>${esc(inv.phone || '')}</span>
                </div>
                <table border="0" cellspacing="0" cellpadding="6">
                    <thead><tr>
                        <th align="${lang === 'ar' ? 'right' : 'left'}" width="45%">${lang === 'ar' ? 'الصنف' : 'Item'}</th>
                        <th align="center">${lang === 'ar' ? 'الخدمة' : 'Mode'}</th>
                        <th align="center">${lang === 'ar' ? 'الكمية' : 'Qty'}</th>
                        <th align="right">${lang === 'ar' ? 'المبلغ' : 'Amount'}</th>
                    </tr></thead>
                    <tbody>${rows}</tbody>
                </table>
                <div class="totals">
                    ${inv.discount > 0 ? `<div>${lang === 'ar' ? 'الخصم' : 'Discount'}: ${cur(inv.discount)}</div>` : ''}
                    ${inv.tax > 0 ? `<div>${lang === 'ar' ? 'المجموع الفرعي' : 'Subtotal'}: ${cur((inv.netTotal || 0) - (inv.tax || 0))}</div>` : ''}
                    ${inv.tax > 0 ? `<div class="tax">${lang === 'ar' ? 'ضريبة القيمة المضافة' : 'VAT'} (${taxPercent()}%): ${cur(inv.tax)}</div>` : ''}
                    <div class="grand">${lang === 'ar' ? 'الإجمالي' : 'Total'}: ${cur(inv.netTotal)}</div>
                </div>
                <div class="footer">${lang === 'ar' ? 'شكراً لتعاملكم معنا' : 'Thank you for your business'} 💙</div>
            </div>`;
        const full = `<!DOCTYPE html><html lang="${lang}"><head><meta charset="utf-8"><title>Invoice #${esc(String(inv.invNo))}</title><style>${printCss()}</style></head><body>${html}</body></html>`;
        const w = window.open('', '_blank', 'width=420,height=640');
        if (w) {
            w.document.open();
            w.document.write(full);
            w.document.close();
            setTimeout(() => { try { w.focus(); w.print(); } catch (e) { /* ignore */ } }, 400);
        } else {
            const f = document.getElementById('printFrame');
            f.onload = () => { try { f.contentWindow.focus(); f.contentWindow.print(); } catch (e) { /* ignore */ } };
            f.srcdoc = full;
        }
    }

    function printCss() {
        return `
            body{font-family:'Segoe UI',Tahoma,Arial,sans-serif;margin:0;padding:16px;color:#111}
            .inv{max-width:300px;margin:0 auto}
            .header{text-align:center;border-bottom:2px solid #000;padding-bottom:8px}
            .shop{font-size:16px;font-weight:800}
            .sub{font-size:11px;color:#333}
            .meta{display:flex;justify-content:space-between;font-size:12px;padding:5px 0;border-bottom:1px dashed #bbb}
            table{width:100%;margin-top:8px;font-size:12px;border-top:2px solid #333}
            thead th{background:#eee;font-size:11px}
            tbody td{border-bottom:1px solid #ddd}
            .totals{margin-top:12px;text-align:right;font-size:13px}
            .totals > div{margin-bottom:6px}
            .tax{font-size:12px;color:#475569}
            .grand{background:#000000;color:#fff;font-weight:800;padding:9px;border-radius:6px;font-size:15px;box-shadow:0 3px 8px rgba(0,0,0,.3)}
            .footer{text-align:center;margin-top:14px;font-size:12px;color:#555}`;
    }

    function printInvoiceById(id) {
        const inv = App.state.invoices.find(i => i.id === id);
        if (inv) printInvoice(inv);
    }

    /* ================= expose ================= */
    Object.assign(App, {
        init, doLogin, logout, resetPassword, renderLoginDiag, toggleLang, showView, modalClose, confirmYes, reloadData,
        setInvFilter, invQuery, markReady, cancelInvoice, deleteInvoice,
        openPaymentModal, confirmPayment, sendInvoiceWA, openInvoiceDetail,
        openCustomerModal, saveCustomer, deleteCustomer, custQuery, custHistory, posWith,
        openSubModal, saveSub, openSubPayModal, saveSubPay, cancelSub, sendSubReminder,
        saveTx, deleteTx, txPeriodChange,
        vatCalc, vatSave, vatDel, vatPeriodToggle,
        saveSettings, evoTest, evoSendTest, exportData, importData, wipeData,
        exportInvoicesCSV, importInvoicesCSV, sheetSync,
        mergeScan, mergeFile, mergeRun, launchAttached,
        mktReloadSys,
        mktLinkClick, mktSelectAll, mktClear, mktCopySelected,
        printInvoiceById,
        posPhoneKey, posPhoneDone, posSug, posPickCustomer, posLoadEdit, posAdd, posRemove, posClear, posRecalc, posSave, posSaveAndSend
    });

    window.addEventListener('DOMContentLoaded', init);
})(window);