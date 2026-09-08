const VAT_RATE = 0.10;

function getVATPeriodLabel() {
    var period = document.getElementById('vat-period').value;
    if (period === 'other') {
        return document.getElementById('vat-period-custom').value.trim() || 'فترة غير محددة';
    }
    var periodMap = {
        '2026-Q1': 'الربع الأول 2026',
        '2026-Q2': 'الربع الثاني 2026',
        '2026-Q3': 'الربع الثالث 2026',
        '2026-Q4': 'الربع الرابع 2026',
        '2025-Q1': 'الربع الأول 2025',
        '2025-Q2': 'الربع الثاني 2025',
        '2025-Q3': 'الربع الثالث 2025',
        '2025-Q4': 'الربع الرابع 2025'
    };
    return periodMap[period] || period;
}

function parseNum(id) {
    var el = document.getElementById(id);
    var val = el ? parseFloat(el.value) : 0;
    return isNaN(val) || val < 0 ? 0 : val;
}

function formatBHD(n) {
    return n.toFixed(3) + ' د.ب';
}

function calcVAT() {
    var sales = parseNum('vat-sales');
    var zero = parseNum('vat-zero');
    var exempt = parseNum('vat-exempt');
    var input = parseNum('vat-input');

    var outputVAT = sales * VAT_RATE;
    var net = outputVAT - input;

    var outputEl = document.getElementById('vat-output');
    var netEl = document.getElementById('vat-net');

    outputEl.textContent = formatBHD(outputVAT);
    netEl.textContent = formatBHD(Math.abs(net)) + (net < 0 ? ' (مسترد)' : '');

    netEl.className = 'vat-net';
    if (net > 0) {
        netEl.classList.add('payable');
    } else if (net < 0) {
        netEl.classList.add('refund');
    }

    window._currentVAT = {
        sales: sales,
        zero: zero,
        exempt: exempt,
        input: input,
        output: outputVAT,
        net: net
    };
}

function saveVATRecord() {
    if (!window._currentVAT) calcVAT();
    var vat = window._currentVAT;
    var periodLabel = getVATPeriodLabel();

    if (!confirm('تأكيد حفظ إقرار ضريبة القيمة المضافة للفترة: ' + periodLabel + '؟')) return;

    Store.addVATRecord({
        period: periodLabel,
        sales: vat.sales,
        zero: vat.zero,
        exempt: vat.exempt,
        input: vat.input,
        output: vat.output,
        net: vat.net
    });

    renderVATRecords();
    showToast('تم حفظ إقرار ضريبة القيمة المضافة للفترة ' + periodLabel, 'success');
    Store.addActivity('add', 'حفظ إقرار ضريبي للفترة ' + periodLabel);
}

function renderVATRecords() {
    var records = Store.getVATRecords();
    var tbody = document.getElementById('vat-records-tbody');
    if (!tbody) return;

    if (records.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:20px;color:var(--text-muted);">لا توجد إقرارات ضريبية محفوظة</td></tr>';
        return;
    }

    var html = '';
    records.forEach(function(r) {
        var netColor = r.net > 0 ? 'var(--danger)' : (r.net < 0 ? 'var(--success)' : 'var(--text)');
        var netText = formatBHD(Math.abs(r.net)) + (r.net < 0 ? ' (مسترد)' : '');
        var dateStr = new Date(r.createdAt).toLocaleDateString('ar-BH');

        html += '<tr>'
            + '<td>' + escapeHtml(r.period) + '</td>'
            + '<td>' + formatBHD(r.sales) + '</td>'
            + '<td>' + formatBHD(r.output) + '</td>'
            + '<td>' + formatBHD(r.input) + '</td>'
            + '<td style="color:' + netColor + ';font-weight:bold;">' + netText + '</td>'
            + '<td>' + dateStr + '</td>'
            + '<td>'
            + '  <button class="btn-danger btn-xs" onclick="deleteVATRecord(\'' + r.id + '\')" title="حذف"><i class="fas fa-trash"></i></button>'
            + '</td>'
            + '</tr>';
    });
    tbody.innerHTML = html;
}

function deleteVATRecord(id) {
    if (!confirm('هل أنت متأكد من حذف هذا الإقرار الضريبي؟')) return;
    Store.deleteVATRecord(id);
    renderVATRecords();
    showToast('تم حذف الإقرار الضريبي', 'info');
}