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

    async function sendImage(cfg, number, dataUrl, caption) {
        const c = resolveCfg(cfg);
        const clean = cleanNumber(number, c.countryCode);
        if (!clean) throw new Error('Invalid number');
        const b64 = String(dataUrl || '').replace(/^data:image\/png;base64,/, '');
        if (!b64) throw new Error('Empty image');
        const url = `${baseUrl(cfg)}/message/sendMedia/${encodeURIComponent(c.instance)}`;
        const res = await fetch(url, {
            method: 'POST',
            headers: headers(cfg),
            body: JSON.stringify({ number: clean, mediatype: 'image', mimetype: 'image/png', caption: caption || '', media: b64, delay: 1 }),
            signal: AbortSignal.timeout(45000)
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
        const W = 384, X = 12, R = W - 12, C = W / 2;
        const F = '"Segoe UI", Tahoma, Arial, sans-serif';
        const items = (inv.items && inv.items.length) ? inv.items : [{ name: '-', mode: '', qty: '', price: 0, urgent: 1 }];
        const fmt = n => Number(n || 0).toFixed(3);
        const urg = u => (Number(u) > 1 ? (ar ? 'مستعجل' : 'Urgent') : (ar ? 'عادي' : 'Normal'));
        let ctx;

        const line = (x1, y1, x2, y2) => { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); };

        let h = 26;
        if (cfg && cfg.shopName) h += 30;
        if (cfg && cfg.shopAddr) h += 18;
        if (cfg && (cfg.crNo || cfg.shopPhone)) h += 18;
        h += 18;
        h += 20;
        if (inv.custName || inv.phone) h += 20;
        h += 10;
        h += 20;
        h += items.length * 20;
        h += 12;
        h += 16;
        if (inv.discount > 0) h += 20;
        h += 22;
        if (inv.status === 'paid') h += 36;
        if (cfg && cfg.evoPayNote) h += 20;
        h += 24;

        const canvas = document.createElement('canvas');
        canvas.width = W; canvas.height = Math.round(h);
        ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, W, h);
        ctx.textBaseline = 'alphabetic';
        ctx.strokeStyle = '#111';
        ctx.lineWidth = 1.5;

        let y = 26;
        ctx.fillStyle = '#000';
        if (cfg && cfg.shopName) {
            ctx.font = '800 17px ' + F;
            ctx.textAlign = 'center';
            ctx.fillText(String(cfg.shopName), C, y);
            y += 30;
        }
        ctx.font = '11px ' + F;
        ctx.textAlign = 'center';
        if (cfg && cfg.shopAddr) { ctx.fillText(String(cfg.shopAddr), C, y); y += 18; }
        if (cfg && (cfg.crNo || cfg.shopPhone)) {
            const reg = [];
            if (cfg.crNo) reg.push((ar ? 'س.ت' : 'CR') + ': ' + String(cfg.crNo));
            if (cfg.shopPhone) reg.push((ar ? 'هاتف' : 'Tel') + ': ' + String(cfg.shopPhone));
            ctx.fillText(reg.join('   '), C, y);
            y += 18;
        }
        line(X, y, R, y); y += 18;

        ctx.textAlign = 'left';
        ctx.font = '700 13px ' + F;
        ctx.fillText((ar ? 'فاتورة #' : 'Invoice #') + String(inv.invNo), X, y);
        ctx.textAlign = 'right';
        ctx.font = '11px ' + F;
        ctx.fillText(fmtDate(inv.createdAt), R, y);
        y += 20;

        if (inv.custName || inv.phone) {
            ctx.fillStyle = '#000';
            ctx.font = '11px ' + F;
            if (inv.custName) { ctx.textAlign = 'right'; ctx.fillText((ar ? 'العميل: ' : 'Cust: ') + String(inv.custName), R, y); }
            if (inv.phone) { ctx.textAlign = 'left'; ctx.fillText(String(inv.phone), X, y); }
            y += 20;
        }
        line(X, y, R, y); y += 10;

        const colName = 196, colUrg = 226, colQty = 282;
        ctx.fillStyle = '#e2e8f0';
        ctx.fillRect(X, y - 16, R - X, 20);
        ctx.fillStyle = '#000';
        ctx.font = '700 11px ' + F;
        ctx.textAlign = 'right';  ctx.fillText(ar ? 'الصنف' : 'Item', colName, y);
        ctx.textAlign = 'center'; ctx.fillText(ar ? 'النوع' : 'Type', colUrg, y);
        ctx.fillText(ar ? 'عدد' : 'Qty', colQty, y);
        ctx.textAlign = 'right';  ctx.fillText(ar ? 'السعر' : 'Price', R, y);
        y += 20;

        items.forEach(item => {
            let nm = String(item.name || '-');
            ctx.fillStyle = '#000';
            ctx.font = '10px ' + F;
            while (ctx.measureText(nm).width > 150 && nm.length > 1) nm = nm.slice(0, nm.length - 1);
            ctx.textAlign = 'right';
            ctx.fillText(nm, colName, y);
            ctx.textAlign = 'center';
            ctx.fillText(urg(item.urgent), colUrg, y);
            ctx.fillText(String(item.qty || ''), colQty, y);
            ctx.font = '700 11px ' + F;
            ctx.textAlign = 'right';
            ctx.fillText(fmt(item.price) + ' ' + cur, R, y);
            ctx.strokeStyle = '#ddd';
            ctx.lineWidth = 1;
            line(X, y + 8, R, y + 8);
            ctx.strokeStyle = '#111';
            ctx.lineWidth = 1.5;
            y += 20;
        });

        ctx.strokeStyle = '#111';
        line(X, y, R, y); y += 12;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(X, y - 24, R - X, 22, 3); else ctx.rect(X, y - 24, R - X, 22);
        ctx.fill();
        ctx.strokeStyle = '#111';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.fillStyle = '#000';
        ctx.font = '800 13px ' + F;
        ctx.textAlign = 'right';
        ctx.fillText((ar ? 'الإجمالي النهائي: ' : 'Total: ') + fmt(inv.netTotal) + ' ' + cur, R - 6, y - 7);
        y += 16;
        if (inv.discount > 0) {
            ctx.fillStyle = '#000';
            ctx.font = '11px ' + F;
            ctx.textAlign = 'right';
            ctx.fillText((ar ? 'الخصم: ' : 'Discount: ') + '-' + fmt(inv.discount) + ' ' + cur, R - 4, y);
            y += 20;
        }

        const stAr = { pending: 'قيد المعالجة', ready: 'جاهزة', paid: 'مدفوعة', cancelled: 'ملغية' };
        if (inv.status) {
            ctx.fillStyle = '#000';
            ctx.font = '700 12px ' + F;
            ctx.textAlign = 'right';
            ctx.fillText((ar ? 'الحالة: ' : 'Status: ') + (stAr[inv.status] || inv.status), R, y);
            y += 22;
        }
        if (inv.status === 'paid') {
            ctx.font = '10px ' + F;
            ctx.fillText((ar ? 'كاش: ' : 'Cash: ') + fmt(inv.cash) + '   ' + (ar ? 'بنفت: ' : 'Benefit: ') + fmt(inv.benefit), R, y);
            y += 18;
            if (inv.paidAt) {
                ctx.textAlign = 'right';
                ctx.fillText((ar ? 'تاريخ الدفع: ' : 'Paid at: ') + fmtDate(inv.paidAt), R, y);
                y += 18;
            }
        }
        if (cfg && cfg.evoPayNote) {
            ctx.fillStyle = '#000';
            ctx.font = '10px ' + F;
            ctx.textAlign = 'center';
            ctx.fillText(String(cfg.evoPayNote), C, y);
            y += 20;
        }

        ctx.fillStyle = '#000';
        ctx.font = '11px ' + F;
        ctx.textAlign = 'center';
        ctx.fillText(ar ? 'نشكركم لثقتكم بنا' : 'Thank you for your business', C, y);
        y += 24;

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
            id: (inv.id !== undefined && inv.id !== null && inv.id !== '') ? inv.id : inv.invNo,
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

    async function nextInvoiceNo(cfg) {
        const val = (cfg && typeof cfg.evoPushUrl === 'string') ? cfg.evoPushUrl.trim() : '';
        if (val === '') return null;
        try {
            const res = await fetch(val + (val.indexOf('?') > -1 ? '&' : '?') + 'action=nextno', {
                method: 'GET', signal: AbortSignal.timeout(12000)
            });
            const j = await res.json();
            if (j && j.status === 'success' && j.no) return Number(j.no);
        } catch (e) { /* offline — fallback to local counter */ }
        return null;
    }

    async function pushInvoice(cfg, inv) {
        const val = (cfg && typeof cfg.evoPushUrl === 'string') ? cfg.evoPushUrl.trim() : '';
        if (val === '') return { ok: false, skipped: true, err: 'evoPushUrl empty — set it in Settings' };
        const url = val || 'https://script.google.com/macros/s/AKfycbxfJ_kVM7L6nsesW6EJhsnMzkEB3Z3bTPdatH0N5JUREGr1YUdcHQRonADJe8pINF1J/exec';
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(invoicePushData(inv, cfg)),
            signal: AbortSignal.timeout(20000)
        });
        const txt = await res.text();
        if (!res.ok) return { ok: false, skipped: false, err: 'HTTP ' + res.status };
        let json = null;
        try { json = JSON.parse(txt); } catch (e) { /* not json */ }
        if (json && json.status === 'error') return { ok: false, skipped: false, err: json.message || 'sheet error' };
        return { ok: true, skipped: false, err: '' };
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
        const mediaOk = await sendImageIfPossible(cfg, inv, text);
        if (!mediaOk) await sendText(cfg, inv.phone, text);
        let pushOk = true, pushErr = '';
        try {
            const r = await pushInvoice(cfg, inv);
            pushOk = !!r.ok;
            pushErr = r.err || (r.skipped ? 'push not sent' : '');
        } catch (e) {
            pushOk = false;
            pushErr = (e && e.message) ? e.message : String(e);
        }
        return { pushOk, pushErr };
    }

    async function sendImageIfPossible(cfg, inv, caption) {
        try {
            const dataUrl = drawInvoicePng(inv, cfg);
            if (!dataUrl) return false;
            await sendImage(cfg, inv.phone, dataUrl, caption);
            return true;
        } catch (e) {
            return false;
        }
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
        itemsText, invoiceLink, pushInvoice, nextInvoiceNo, drawInvoicePng, sendImage, fillTemplate, normalizeServerUrl
    };

    window.WA = WA;
})(window);