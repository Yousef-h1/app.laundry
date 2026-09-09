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
        itemsText, fillTemplate, normalizeServerUrl
    };

    window.WA = WA;
})(window);