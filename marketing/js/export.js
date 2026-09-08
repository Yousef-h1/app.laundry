function exportCSV() {
    var leads = Store.getLeads();
    if (leads.length === 0) {
        showToast('لا توجد بيانات للتصدير', 'warning');
        return;
    }

    var BOM = '\uFEFF';
    var headers = ['اسم النشاط', 'التصنيف', 'رقم الهاتف', 'العنوان', 'التقييم', 'الحالة', 'تاريخ الإضافة'];
    var rows = [headers.join(',')];

    leads.forEach(function(lead) {
        var catLabel = CATEGORY_MAP[lead.category] ? CATEGORY_MAP[lead.category].label : lead.category;
        var statusMap = { new: 'جديد', sent: 'تم الإرسال', responded: 'تم الرد', rejected: 'مرفوض' };
        var row = [
            '"' + (lead.name || '').replace(/"/g, '""') + '"',
            '"' + catLabel + '"',
            '"' + (lead.phone || '') + '"',
            '"' + (lead.address || '').replace(/"/g, '""') + '"',
            '"' + (lead.rating || '-') + '"',
            '"' + (statusMap[lead.status] || 'جديد') + '"',
            '"' + (lead.createdAt || '') + '"'
        ];
        rows.push(row.join(','));
    });

    var csv = BOM + rows.join('\n');
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = 'leads_' + new Date().toISOString().slice(0, 10) + '.csv';
    link.click();
    URL.revokeObjectURL(url);

    showToast('تم تصدير ' + leads.length + ' عميل بصيغة CSV', 'success');
    Store.addActivity('search', 'تصدير قائمة العملاء CSV');
}

function exportAllData() {
    var data = Store.exportAll();
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = 'laundrypro_backup_' + new Date().toISOString().slice(0, 10) + '.json';
    link.click();
    URL.revokeObjectURL(url);

    showToast('تم تصدير جميع البيانات بنجاح', 'success');
}

function importData(event) {
    var file = event.target.files[0];
    if (!file) return;

    var reader = new FileReader();
    reader.onload = function(e) {
        try {
            var data = JSON.parse(e.target.result);
            Store.importAll(data);
            showToast('تم استيراد البيانات بنجاح. جاري إعادة التحميل...', 'success');
            setTimeout(function() { location.reload(); }, 1500);
        } catch (err) {
            showToast('خطأ في ملف البيانات: ' + err.message, 'error');
        }
    };
    reader.readAsText(file);
    event.target.value = '';
}

function resetAllData() {
    if (!confirm('هل أنت متأكد من مسح جميع البيانات؟ لا يمكن التراجع عن هذا الإجراء.')) return;
    Store.clearAll();
    showToast('تم مسح جميع البيانات. جاري إعادة التحميل...', 'info');
    setTimeout(function() { location.reload(); }, 1500);
}
