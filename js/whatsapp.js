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
            .replace(/\/message\/sendMedia.*$/i, '')
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

    async function parseResErr(res) {
        let reason = 'HTTP ' + res.status;
        try {
            const j = await res.json();
            const m = j && j.response && j.response.message;
            if (m) reason = typeof m === 'string' ? m : JSON.stringify(m);
            else if (j && j.message) reason = String(j.message);
        } catch (e) { /* keep HTTP status */ }
        return reason;
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
        if (!res.ok) throw new Error(await parseResErr(res));
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

    function pn(n) {
        return Number(n || 0).toFixed(3);
    }

    /* ----------- invoice image (printable) ----------- */
    function drawInvoicePng(inv, cfg) {
        const ar = I18N.getLang() !== 'en';
        const cur = (cfg && cfg.currency) || 'BHD';
        const W = 700, X = 36, R = W - X, rowH = 42;
        const F = '"Segoe UI", Tahoma, Arial, sans-serif';
        const items = (inv.items && inv.items.length) ? inv.items : [{ name: '-', mode: '', qty: '', price: 0 }];

        let h = 50;
        if (cfg && cfg.shopName) h += 36;
        if (cfg && cfg.shopAddr) h += 26;
        if (cfg && (cfg.crNo || cfg.shopPhone)) h += 24;
        h += 12;
        h += 44;
        if (inv.custName || inv.phone) h += 34;
        h += 12;
        h += 26;
        h += items.length * rowH;
        h += 12;
        h += 22;
        if (inv.discount > 0) h += 30;
        h += 60;
        h += 24;
        h += 16;

        const canvas = document.createElement('canvas');
        canvas.width = W; canvas.height = Math.round(h);
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, W, h);
        ctx.textBaseline = 'alphabetic';

        let y = 50;
        if (cfg && cfg.shopName) {
            ctx.fillStyle = '#0b1220';
            ctx.font = '700 26px ' + F;
            ctx.textAlign = 'center';
            ctx.fillText(String(cfg.shopName), W / 2, y);
            y += 36;
        }
        if (cfg && cfg.shopAddr) {
            ctx.fillStyle = '#475569';
            ctx.font = '13px ' + F;
            ctx.textAlign = 'center';
            ctx.fillText(String(cfg.shopAddr), W / 2, y);
            y += 26;
        }
        if (cfg && (cfg.crNo || cfg.shopPhone)) {
            const reg = [];
            if (cfg.crNo) reg.push((ar ? 'س.ت' : 'CR No') + ': ' + String(cfg.crNo));
            if (cfg.shopPhone) reg.push((ar ? 'هاتف' : 'Tel') + ': ' + String(cfg.shopPhone));
            ctx.fillStyle = '#475569';
            ctx.font = '13px ' + F;
            ctx.textAlign = 'center';
            ctx.fillText(reg.join('  ·  '), W / 2, y);
            y += 24;
        }

        ctx.strokeStyle = '#111';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(X, y); ctx.lineTo(R, y); ctx.stroke();
        y += 14;

        ctx.fillStyle = '#111';
        ctx.font = '700 15px ' + F;
        ctx.textAlign = 'left';
        ctx.fillText((ar ? 'رقم الفاتورة' : 'Invoice No') + ': #' + String(inv.invNo), X, y + 16);
        ctx.font = '15px ' + F;
        ctx.textAlign = 'right';
        ctx.fillText(fmtDate(inv.createdAt), R, y + 16);
        y += 30;
        if (inv.custName || inv.phone) {
            ctx.fillStyle = '#111';
            ctx.font = '15px ' + F;
            if (inv.custName) {
                ctx.textAlign = 'left';
                ctx.fillText((ar ? 'العميل: ' : 'Customer: ') + String(inv.custName), X, y + 16);
            }
            if (inv.phone) {
                ctx.textAlign = 'right';
                ctx.fillText(String(inv.phone), R, y + 16);
            }
            y += 34;
        }
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(X, y); ctx.lineTo(R, y); ctx.stroke();
        y += 20;

        const colLeft = X, colMode = 350, colQty = 470, colRight = R;
        ctx.fillStyle = '#e2e8f0';
        ctx.fillRect(X, y - 18, R - X, 26);
        ctx.fillStyle = '#0b1220';
        ctx.font = '700 14px ' + F;
        ctx.textAlign = 'left';  ctx.fillText(ar ? 'الصنف' : 'Item', colLeft, y);
        ctx.textAlign = 'center'; ctx.fillText(ar ? 'الخدمة' : 'Mode', colMode, y);
        ctx.fillText(ar ? 'الكمية' : 'Qty', colQty, y);
        ctx.textAlign = 'right'; ctx.fillText(ar ? 'المبلغ' : 'Amount', colRight, y);
        y += 26;

        items.forEach(item => {
            const mode = (item && item.mode) ? String(item.mode) : '';
            const qty = (item && item.qty) ? String(item.qty) : '';
            ctx.fillStyle = '#111';
            ctx.font = '15px ' + F;
            ctx.textAlign = 'left';   ctx.fillText(String(item.name || '-'), colLeft, y - 6);
            ctx.textAlign = 'center'; ctx.fillText(mode, colMode, y - 6);
            ctx.fillText(qty, colQty, y - 6);
            ctx.font = '700 15px ' + F;
            ctx.textAlign = 'right';  ctx.fillText(pn(item.price) + ' ' + cur, colRight, y - 6);
            ctx.strokeStyle = '#e2e8f0';
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(X, y + rowH - 14); ctx.lineTo(R, y + rowH - 14); ctx.stroke();
            y += rowH;
        });

        ctx.strokeStyle = '#111';
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(X, y); ctx.lineTo(R, y); ctx.stroke();
        y += 20;
        if (inv.discount > 0) {
            ctx.fillStyle = '#ef4444';
            ctx.font = '15px ' + F;
            ctx.textAlign = 'right';
            ctx.fillText((ar ? 'الخصم: ' : 'Discount: ') + '-' + pn(inv.discount) + ' ' + cur, R, y);
            y += 30;
        }
        ctx.fillStyle = '#0b1220';
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(W - 300, y - 30, 264, 40, 7);
        else ctx.rect(W - 300, y - 30, 264, 40);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = '800 17px ' + F;
        ctx.textAlign = 'right';
        ctx.fillText((ar ? 'الإجمالي: ' : 'Total: ') + pn(inv.netTotal) + ' ' + cur, W - 48, y + 2);
        y += 46;
        ctx.fillStyle = '#475569';
        ctx.font = '13px ' + F;
        ctx.textAlign = 'center';
        ctx.fillText(ar ? 'شكراً لتعاملكم معنا' : 'Thank you for your business', W / 2, y);
        y += 16;

        return canvas.toDataURL('image/png');
    }

    async function buildInvoiceImage(inv, cfg) {
        return drawInvoicePng(inv, cfg);
    }

    function invoiceLink(cfg, inv) {
        if (cfg && typeof cfg.evoInvLink === 'string' && cfg.evoInvLink.trim() === '') return '';
        const tpl = (cfg && typeof cfg.evoInvLink === 'string' && cfg.evoInvLink.trim() !== '')
            ? cfg.evoInvLink
            : 'https://script.google.com/macros/s/AKfycbxfJ_kVM7L6nsesW6EJhsnMzkEB3Z3bTPdatH0N5JUREGr1YUdcHQRonADJe8pINF1J/exec?id={inv}';
        return fillTemplate(tpl, { inv: inv.invNo, id: inv.invNo });
    }

    /* ----------- push invoice to Google Apps Script ----------- */
    function invoicePushData(inv, cfg) {
        return {
            id: inv.invNo,
            invNo: inv.invNo,
            customerName: inv.custName || '',
            name: inv.custName || '',
            custName: inv.custName || '',
            phone: inv.phone || '',
            date: inv.createdAt || '',
            items: (inv.items || []).map(i => ({
                name: i.name, mode: i.mode || '', qty: i.qty || 1, price: Number(i.price || 0),
                urgent: (i.urgent && Number(i.urgent) > 1) ? 2 : 1
            })),
            total: Number(inv.netTotal || 0),
            discount: Number(inv.discount || 0),
            netTotal: Number(inv.netTotal || 0),
            currency: (cfg && cfg.currency) || 'BHD',
            status: inv.status || '',
            cash: inv.cash !== undefined ? Number(inv.cash || 0) : 0,
            benefit: inv.benefit !== undefined ? Number(inv.benefit || 0) : 0,
            paidAt: inv.paidAt || '',
            shopName: (cfg && cfg.shopName) || '',
            shopPhone: (cfg && cfg.shopPhone) || '',
            shopAddr: (cfg && cfg.shopAddr) || '',
            crNo: (cfg && cfg.crNo) || ''
        };
    }

    async function pushInvoice(cfg, inv) {
        const val = (cfg && typeof cfg.evoPushUrl === 'string') ? cfg.evoPushUrl.trim() : '';
        if (val === '') return { ok: true, skipped: true, err: '' };
        const url = val || 'https://script.google.com/macros/s/AKfycbxfJ_kVM7L6nsesW6EJhsnMzkEB3Z3bTPdatH0N5JUREGr1YUdcHQRonADJe8pINF1J/exec';
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(invoicePushData(inv, cfg)),
            signal: AbortSignal.timeout(20000)
        });
        await res.text();
        return { ok: res.ok, skipped: false, err: res.ok ? '' : 'HTTP ' + res.status };
    }

    async function sendInvoiceMessage(cfg, inv, shopName, itemsText) {
        const tpl = cfg.msgInvoice ||
            (I18N.getLang() === 'ar'
                ? '*{shop}* 🧺\nعزيزي العميل: *{name}*\nتم استلام طلبك بنجاح ✅\n\n*تفاصيل الخدمات (جدول):*\n──────────────────\n{items}\n──────────────────\n\n*بيانات الفاتورة:*\n🔢 رقم الفاتورة: #{inv}\n📅 التاريخ: {date}\n💰 *الإجمالي النهائي: {total} {currency}*\n\n💡 {paynote}\n\n🔗 يمكنك عرض فاتورتك الرقمية من هنا:\n{paylink}\n\nشكراً لثقتكم بنا! {shop} ✨'
                : '*{shop}* 🧺\nDear Customer: *{name}*\nYour order has been received successfully ✅\n\n*Services:*\n──────────────────\n{items}\n──────────────────\n\n*Invoice:*\n🧾 Invoice No: #{inv}\n📅 Date: {date}\n💰 *Total: {total} {currency}*\n\n💡 {paynote}\n\n🔗 You can view your digital invoice here:\n{paylink}\n\nThank you for your trust! {shop} ✨');
        const link = invoiceLink(cfg, inv);
        let text = fillTemplate(tpl, {
            name: inv.custName, shop: shopName, inv: inv.invNo,
            total: pn(inv.netTotal),
            items: itemsText || '', currency: cfg.currency || 'BHD',
            date: fmtDate(inv.createdAt),
            paynote: cfg.evoPayNote || (I18N.getLang() === 'ar'
                ? 'يمكن الدفع وقت الاستلام عبر تطبيق بنفت (BenefitPay) : 35310880'
                : 'You can pay on pickup via BenefitPay: 35310880'),
            paylink: link
        });
        if (!link) text = text.replace(/\n🔗[^\n]*\n(?=\n)/g, '\n');
        await sendText(cfg, inv.phone, text);
        let pushOk = true, pushErr = '';
        try {
            const r = await pushInvoice(cfg, inv);
            pushOk = !!r.skipped || !!r.ok;
            pushErr = r.err || '';
        } catch (e) {
            pushOk = false;
            pushErr = (e && e.message) ? e.message : String(e);
        }
        return { pushOk, pushErr };
    }

    async function sendReminderMessage(cfg, inv, shopName) {
        const tpl = cfg.msgReminder ||
            (I18N.getLang() === 'ar'
                ? 'مرحباً {name} 👋\nتذكير بفاتورتك رقم #{inv} بمبلغ {total} {currency} من {shop}.\nنقدر في حال تم تسويتها في أقرب وقت 🌟\nشكراً لتعاملكم معنا'
                : 'Hello {name} 👋\nReminder: your invoice # {inv} of {total} {currency} at {shop}.\nPlease settle it at your earliest convenience 🌟\nThank you');
        const text = fillTemplate(tpl, {
            name: inv.custName, shop: shopName,
            inv: inv.invNo, total: pn(inv.netTotal), currency: cfg.currency || 'BHD'
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
            amount: pn(sub.amount),
            period: sub.periodLabel || '', currency: cfg.currency || 'BHD'
        });
        return sendText(cfg, sub.phone, text);
    }

    function itemsText(inv, lang, currency) {
        if (!inv.items || !inv.items.length) return '';
        const cur = currency || 'BHD';
        const priceWord = lang === 'ar' ? 'السعر' : 'Price';
        const xN = lang === 'ar' ? '×' : 'x';
        return inv.items.map(i => {
            const isUrg = i.urgent && Number(i.urgent) > 1;
            const urgLabel = lang === 'ar'
                ? (isUrg ? 'مستعجل' : 'عادي')
                : (isUrg ? 'Urgent' : 'Normal');
            return `👕 ${i.name} (${xN}${i.qty}) - ${priceWord}: ${pn(i.price)} ${cur} [${i.mode} - ${urgLabel}] ✅`;
        }).join('\n');
    }

    const WA = {
        cleanNumber, testConnection, sendText,
        sendReadyMessage, sendInvoiceMessage,
        sendReminderMessage, sendSubReminderMessage,
        itemsText, invoiceLink, pushInvoice, drawInvoicePng, fillTemplate, normalizeServerUrl
    };

    window.WA = WA;
})(window);