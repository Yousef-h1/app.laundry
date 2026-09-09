/* ============================================================
 * whatsapp.js — Evolution API client
 * Config: { serverUrl, instance, apiKey, countryCode }
 * ============================================================ */
(function (window) {
    'use strict';

    function cleanNumber(num, countryCode) {
        if (!num) return '';
        let n = String(num).replace(/\D/g, '');
        if (n.startsWith('00')) n = n.slice(2);
        const cc = String(countryCode || '').replace(/\D/g, '');
        if (cc && !n.startsWith(cc)) {
            n = n.replace(/^0+/, '');
            n = cc + n;
        }
        return n;
    }

    function evoDefaults() {
        return {
            serverUrl: 'https://evo.awj-bh.cloud',
            instance: '35310880',
            apiKey: '9B9B0781DD10-4E76-BB20-6CCB89E5C90F'
        };
    }

    function resolveCfg(cfg) {
        const d = evoDefaults();
        cfg = cfg || {};
        return {
            serverUrl: normalizeServerUrl(cfg.serverUrl) || d.serverUrl,
            instance: String(cfg.instance || '').trim() || d.instance,
            apiKey: String(cfg.apiKey || '').trim() || d.apiKey,
            countryCode: String(cfg.countryCode || '').trim() || ''
        };
    }

    function normalizeServerUrl(raw) {
        return String(raw || '')
            .replace(/\/message\/sendText.*$/i, '')
            .replace(/\/instance\/connectionState.*$/i, '')
            .replace(/\/+$/, '');
    }

    function baseUrl(cfg) {
        return resolveCfg(cfg).serverUrl;
    }

    function headers(cfg) {
        const h = { 'Content-Type': 'application/json' };
        const c = resolveCfg(cfg);
        if (c.apiKey) h['apikey'] = c.apiKey;
        return h;
    }

    async function testConnection(cfg) {
        const url = `${baseUrl(cfg)}/instance/connectionState/${encodeURIComponent(resolveCfg(cfg).instance)}`;
        const res = await fetch(url, {
            method: 'GET',
            headers: headers(cfg),
            signal: AbortSignal.timeout(15000)
        });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();
        const state = (data && (data.instance && data.instance.state)) || (data && data.state) || 'open';
        return { ok: state !== 'close' && state !== 'closed', state };
    }

    async function sendText(cfg, number, text) {
        const c = resolveCfg(cfg);
        const clean = cleanNumber(number, c.countryCode);
        if (!clean) throw new Error('Invalid number');
        const url = `${baseUrl(cfg)}/message/sendText/${encodeURIComponent(c.instance)}`;
        const res = await fetch(url, {
            method: 'POST',
            headers: headers(cfg),
            body: JSON.stringify({ number: clean, text, delay: 1 }),
            signal: AbortSignal.timeout(30000)
        });
        if (!res.ok) {
            let reason = 'HTTP ' + res.status;
            try {
                const j = await res.json();
                const m = j && j.response && j.response.message;
                if (m) reason = typeof m === 'string' ? m : JSON.stringify(m);
                else if (j && j.message) reason = String(j.message);
            } catch (e) { /* keep HTTP status */ }
            throw new Error(reason);
        }
        return res.json();
    }

    /* ----------- template builders ----------- */
    function fillTemplate(tpl, vars) {
        if (!tpl) return '';
        return String(tpl).replace(/\{(\w+)\}/g, (m, k) => {
            return (vars && vars[k] !== undefined && vars[k] !== null) ? vars[k] : m;
        });
    }

    async function sendReadyMessage(cfg, inv, shopName, itemsText) {
        const tpl = cfg.msgReady ||
            (I18N.getLang() === 'ar'
                ? 'عميلنا العزيز 🤍\nتم الانتهاء من تجهيز ملابسك بعناية،\nوهي الآن جاهزة للاستلام من مغسلة الخدمة المميزة ✨\nنتمنى أن تنال رضاك .'
                : 'Hello {name} 👋\nYour order is ready at {shop} ✓\nInvoice # {inv}\n{items}\nTotal: {total} {currency}\nThank you for choosing us 💙');
        const text = fillTemplate(tpl, {
            name: inv.custName, shop: shopName || I18N.t('appName'),
            inv: inv.invNo, total: Number(inv.netTotal).toFixed(3),
            items: itemsText || '', currency: cfg.currency || 'BHD', status: inv.statusLabel || ''
        });
        return sendText(cfg, inv.phone, text);
    }

    function fmtDate(iso) {
        if (!iso) return '';
        const d = new Date(iso);
        if (isNaN(d.getTime())) return '';
        const p = n => String(n).padStart(2, '0');
        return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
    }

    function invoiceCopy(inv, lang, cfg) {
        if (!inv) return '';
        const ar = lang !== 'en';
        const pn = n => Number(n || 0).toFixed(3);
        const dt = inv.createdAt ? (new Date(inv.createdAt)) : null;
        const dateTxt = dt && !isNaN(dt.getTime())
            ? `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()} ${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`
            : '';
        const L = {
            shop: ar ? 'الفاتورة الضريبية' : 'INVOICE',
            cr: ar ? 'س.ت' : 'CR No',
            tax: ar ? 'ض.ق.م' : 'VAT',
            phone: ar ? 'هاتف' : 'Phone',
            addr: ar ? 'العنوان' : 'Address',
            invNo: ar ? 'رقم الفاتورة' : 'Invoice No',
            date: ar ? 'التاريخ' : 'Date',
            cust: ar ? 'العميل' : 'Customer',
            item: ar ? 'الصنف' : 'Item',
            mode: ar ? 'الخدمة' : 'Mode',
            qty: ar ? 'الكمية' : 'Qty',
            amount: ar ? 'المبلغ' : 'Amount',
            disc: ar ? 'الخصم' : 'Discount',
            sub: ar ? 'المجموع الفرعي' : 'Subtotal',
            vat: ar ? 'ضريبة القيمة المضافة' : 'VAT',
            total: ar ? 'الإجمالي' : 'Total',
            thanks: ar ? 'شكراً لتعاملكم معنا 💙' : 'Thank you for your business 💙'
        };
        const cur = (cfg && cfg.currency) || 'BHD';
        const sep = '──────────────────';
        const lines = [];
        lines.push(`*${L.shop}* · #${inv.invNo}`);
        if (cfg && cfg.shopName) lines.push(`${cfg.shopName}`);
        if (cfg && cfg.shopAddr) lines.push(`${L.addr}: ${cfg.shopAddr}`);
        if (cfg && cfg.crNo) lines.push(`${L.cr}: ${cfg.crNo}`);
        if (cfg && cfg.taxEnabled !== '0' && cfg.taxEnabled !== false && cfg.taxNo) lines.push(`${L.tax}: ${cfg.taxNo}`);
        if (cfg && cfg.shopPhone) lines.push(`${L.phone}: ${cfg.shopPhone}`);
        lines.push(sep);
        lines.push(`🧾 ${L.invNo}: #${inv.invNo}`);
        lines.push(`📅 ${L.date}: ${dateTxt}`);
        if (inv.custName) lines.push(`👤 ${L.cust}: ${inv.custName}`);
        if (inv.phone) lines.push(`📱 ${L.phone}: ${inv.phone}`);
        lines.push(sep);
        if (inv.items && inv.items.length) {
            lines.push(...inv.items.map(i => {
                const isUrg = i.urgent && Number(i.urgent) > 1;
                const urgLabel = ar ? (isUrg ? 'مستعجل' : 'عادي') : (isUrg ? 'Urgent' : 'Normal');
                const row = `${i.name} (${ar ? '×' : 'x'}${i.qty})`;
                return `${row} — ${i.mode} [${urgLabel}] = ${pn(i.price)} ${cur}`;
            }));
        }
        lines.push(sep);
        if (inv.discount > 0) lines.push(`${L.disc}: ${pn(inv.discount)} ${cur}`);
        if (inv.tax > 0) {
            lines.push(`${L.sub}: ${pn((inv.netTotal || 0) - (inv.tax || 0))} ${cur}`);
            lines.push(`${L.vat}: ${pn(inv.tax)} ${cur}`);
        }
        lines.push(`💰 ${L.total}: *${pn(inv.netTotal)} ${cur}*`);
        lines.push(sep);
        lines.push(L.thanks);
        return lines.join('\n');
    }

    async function sendInvoiceMessage(cfg, inv, shopName, itemsText) {
        const tpl = cfg.msgInvoice ||
            (I18N.getLang() === 'ar'
                ? '*{shop}* 🧺\nعزيزي العميل: *{name}*\nتم استلام طلبك بنجاح ✅\n\n*تفاصيل الخدمات (جدول):*\n──────────────────\n{items}\n──────────────────\n\n*بيانات الفاتورة:*\n🔢 رقم الفاتورة: #{inv}\n📅 التاريخ: {date}\n💰 *الإجمالي النهائي: {total} {currency}*\n\n💡 {paynote}\n\nشكراً لثقتكم بنا! {shop} ✨'
                : '*{shop}* 🧺\nDear Customer: *{name}*\nYour order has been received successfully ✅\n\n*Services:*\n──────────────────\n{items}\n──────────────────\n\n*Invoice:*\n🧾 Invoice No: #{inv}\n📅 Date: {date}\n💰 *Total: {total} {currency}*\n\n💡 {paynote}\n\nThank you for your trust! {shop} ✨');
        const text = fillTemplate(tpl, {
            name: inv.custName, shop: shopName, inv: inv.invNo,
            total: Number(inv.netTotal).toFixed(3),
            items: itemsText || '', currency: cfg.currency || 'BHD',
            date: fmtDate(inv.createdAt),
            paynote: cfg.evoPayNote || (I18N.getLang() === 'ar'
                ? 'يمكن الدفع وقت الاستلام عبر تطبيق بنفت (BenefitPay) : 35310880'
                : 'You can pay on pickup via BenefitPay: 35310880')
        });
        const copyHeading = I18N.getLang() === 'ar' ? 'نسخة من الفاتورة 📄' : 'Invoice copy 📄';
        const full = `${text}\n\n${copyHeading}\n${invoiceCopy(inv, I18N.getLang(), cfg)}`;
        return sendText(cfg, inv.phone, full);
    }

    async function sendReminderMessage(cfg, inv, shopName) {
        const tpl = cfg.msgReminder ||
            (I18N.getLang() === 'ar'
                ? 'مرحباً {name} 👋\nتذكير بفاتورتك رقم #{inv} بمبلغ {total} {currency} من {shop}.\nنقدر في حال تم تسويتها في أقرب وقت 🌟\nشكراً لتعاملكم معنا'
                : 'Hello {name} 👋\nReminder: your invoice # {inv} of {total} {currency} at {shop}.\nPlease settle it at your earliest convenience 🌟\nThank you');
        const text = fillTemplate(tpl, {
            name: inv.custName, shop: shopName,
            inv: inv.invNo, total: Number(inv.netTotal).toFixed(3), currency: cfg.currency || 'BHD'
        });
        return sendText(cfg, inv.phone, text);
    }

    async function sendSubReminderMessage(cfg, sub, shopName) {
        const tpl = cfg.msgSubReminder ||
            (I18N.getLang() === 'ar'
                ? 'مرحباً {name} 👋\nتجديد اشتراكك الشهري لشهر {period} بمبلغ {amount} {currency} لدى {shop}.\nشكراً لتعاملكم معنا 🤝'
                : 'Hello {name} 👋\nYour monthly subscription renewal for {period} is {amount} {currency} at {shop}.\nThank you 🤝');
        const text = fillTemplate(tpl, {
            name: sub.custName, shop: shopName,
            amount: Number(sub.amount).toFixed(3),
            period: sub.periodLabel || '', currency: cfg.currency || 'BHD'
        });
        return sendText(cfg, sub.phone, text);
    }

    function itemsText(inv, lang, currency) {
        if (!inv.items || !inv.items.length) return '';
        const cur = currency || 'BHD';
        const pn = n => Number(n || 0).toFixed(3);
        return inv.items.map(i => {
            const isUrg = i.urgent && Number(i.urgent) > 1;
            const urgLabel = lang === 'ar'
                ? (isUrg ? 'مستعجل' : 'عادي')
                : (isUrg ? 'Urgent' : 'Normal');
            const priceWord = lang === 'ar' ? 'السعر' : 'Price';
            const xN = lang === 'ar' ? '×' : 'x';
            return `👕 ${i.name} (${xN}${i.qty}) - ${priceWord}: ${pn(i.price)} ${cur} [${i.mode} - ${urgLabel}] ✅`;
        }).join('\n');
    }

    const WA = {
        cleanNumber, testConnection, sendText,
        sendReadyMessage, sendInvoiceMessage,
        sendReminderMessage, sendSubReminderMessage,
        itemsText, invoiceCopy, fillTemplate, normalizeServerUrl
    };

    window.WA = WA;
})(window);