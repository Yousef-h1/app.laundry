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
        if (n.startsWith('+')) n = n.slice(1);
        const cc = String(countryCode || '').replace(/\D/g, '');
        if (cc && !n.startsWith(cc)) n = cc + n;
        return n;
    }

    function baseUrl(cfg) {
        return (cfg.serverUrl || '').replace(/\/+$/, '');
    }

    function headers(cfg) {
        const h = { 'Content-Type': 'application/json' };
        if (cfg.apiKey) h['apikey'] = cfg.apiKey;
        return h;
    }

    async function testConnection(cfg) {
        const url = `${baseUrl(cfg)}/instance/connectionState/${encodeURIComponent(cfg.instance || '')}`;
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
        const clean = cleanNumber(number, cfg.countryCode);
        if (!clean) throw new Error('Invalid number');
        const url = `${baseUrl(cfg)}/message/sendText/${encodeURIComponent(cfg.instance || '')}`;
        const res = await fetch(url, {
            method: 'POST',
            headers: headers(cfg),
            body: JSON.stringify({ number: clean, text, delay: 1 }),
            signal: AbortSignal.timeout(30000)
        });
        if (!res.ok) throw new Error('HTTP ' + res.status);
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

    async function sendInvoiceMessage(cfg, inv, shopName, itemsText) {
        const tpl = cfg.msgInvoice ||
            (I18N.getLang() === 'ar'
                ? 'مرحباً {name} 👋\nتفاصيل فاتورتك من {shop}:\nرقم: #{inv}\n{items}\nالإجمالي: {total} {currency}\nشكراً لتعاملكم معنا 🤝'
                : 'Hello {name} 👋\nYour invoice from {shop}:\n# {inv}\n{items}\nTotal: {total} {currency}\nThank you 🤝');
        const text = fillTemplate(tpl, {
            name: inv.custName, shop: shopName, inv: inv.invNo,
            total: Number(inv.netTotal).toFixed(3),
            items: itemsText || '', currency: cfg.currency || 'BHD'
        });
        return sendText(cfg, inv.phone, text);
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

    function itemsText(inv, lang) {
        if (!inv.items || !inv.items.length) return '';
        return inv.items.map(i => {
            const nm = lang === 'ar' ? i.name : i.name;
            return `${nm} ×${i.qty} — ${i.mode}`;
        }).join('\n');
    }

    const WA = {
        cleanNumber, testConnection, sendText,
        sendReadyMessage, sendInvoiceMessage,
        sendReminderMessage, sendSubReminderMessage,
        itemsText, fillTemplate
    };

    window.WA = WA;
})(window);