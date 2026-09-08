function renderLeadsTable() {
    var leads = Store.getLeads();
    var tbody = document.getElementById('leads-tbody');
    var emptyEl = document.getElementById('leads-empty');

    if (leads.length === 0) {
        tbody.innerHTML = '';
        emptyEl.style.display = 'block';
        return;
    }

    emptyEl.style.display = 'none';
    var html = '';
    leads.forEach(function(lead) {
        var catLabel = CATEGORY_MAP[lead.category] ? CATEGORY_MAP[lead.category].label : lead.category;
        var statusBadge = getStatusBadge(lead.status);

        html += '<tr data-id="' + lead.id + '">'
            + '<td><input type="checkbox" class="lead-check" value="' + lead.id + '"></td>'
            + '<td><strong>' + escapeHtml(lead.name) + '</strong></td>'
            + '<td>' + catLabel + '</td>'
            + '<td>' + escapeHtml(lead.phone || '-') + '</td>'
            + '<td>' + escapeHtml(lead.address || '-') + '</td>'
            + '<td>' + statusBadge + '</td>'
            + '<td>'
            + '  <button class="btn-secondary btn-xs" onclick="editLead(\'' + lead.id + '\')" title="تعديل"><i class="fas fa-edit"></i></button> '
            + '  <button class="btn-whatsapp btn-xs" onclick="quickSendWhatsApp(\'' + lead.id + '\')" title="إرسال واتساب"><i class="fab fa-whatsapp"></i></button> '
            + '  <button class="btn-danger btn-xs" onclick="deleteLead(\'' + lead.id + '\')" title="حذف"><i class="fas fa-trash"></i></button>'
            + '</td>'
            + '</tr>';
    });
    tbody.innerHTML = html;
}

function getStatusBadge(status) {
    var map = {
        new: '<span class="badge badge-new">جديد</span>',
        sent: '<span class="badge badge-sent">تم الإرسال</span>',
        responded: '<span class="badge badge-responded">تم الرد</span>',
        rejected: '<span class="badge badge-rejected">مرفوض</span>'
    };
    return map[status] || map.new;
}

function filterLeads() {
    var searchTerm = document.getElementById('leads-filter').value.toLowerCase();
    var statusFilter = document.getElementById('leads-status-filter').value;
    var categoryFilter = document.getElementById('leads-category-filter').value;
    var leads = Store.getLeads();

    var filtered = leads.filter(function(lead) {
        var matchSearch = !searchTerm
            || (lead.name && lead.name.toLowerCase().includes(searchTerm))
            || (lead.phone && lead.phone.includes(searchTerm))
            || (lead.address && lead.address.toLowerCase().includes(searchTerm));
        var matchStatus = statusFilter === 'all' || lead.status === statusFilter;
        var matchCategory = categoryFilter === 'all' || lead.category === categoryFilter;
        return matchSearch && matchStatus && matchCategory;
    });

    var tbody = document.getElementById('leads-tbody');
    var emptyEl = document.getElementById('leads-empty');

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:20px;color:var(--text-muted);">لا توجد نتائج مطابقة</td></tr>';
        return;
    }

    var html = '';
    filtered.forEach(function(lead) {
        var catLabel = CATEGORY_MAP[lead.category] ? CATEGORY_MAP[lead.category].label : lead.category;
        var statusBadge = getStatusBadge(lead.status);

        html += '<tr data-id="' + lead.id + '">'
            + '<td><input type="checkbox" class="lead-check" value="' + lead.id + '"></td>'
            + '<td><strong>' + escapeHtml(lead.name) + '</strong></td>'
            + '<td>' + catLabel + '</td>'
            + '<td>' + escapeHtml(lead.phone || '-') + '</td>'
            + '<td>' + escapeHtml(lead.address || '-') + '</td>'
            + '<td>' + statusBadge + '</td>'
            + '<td>'
            + '  <button class="btn-secondary btn-xs" onclick="editLead(\'' + lead.id + '\')" title="تعديل"><i class="fas fa-edit"></i></button> '
            + '  <button class="btn-whatsapp btn-xs" onclick="quickSendWhatsApp(\'' + lead.id + '\')" title="إرسال واتساب"><i class="fab fa-whatsapp"></i></button> '
            + '  <button class="btn-danger btn-xs" onclick="deleteLead(\'' + lead.id + '\')" title="حذف"><i class="fas fa-trash"></i></button>'
            + '</td>'
            + '</tr>';
    });
    tbody.innerHTML = html;
}

function toggleSelectAllLeads(checkbox) {
    var checks = document.querySelectorAll('.lead-check');
    for (var i = 0; i < checks.length; i++) {
        checks[i].checked = checkbox.checked;
    }
}

function addManualLead() {
    var html = '<div class="form-group">'
        + '<label>اسم النشاط / المنشأة</label>'
        + '<input type="text" id="modal-lead-name" placeholder="اسم النشاط">'
        + '</div>'
        + '<div class="form-row" style="grid-template-columns:1fr 1fr;">'
        + '<div class="form-group">'
        + '<label>التصنيف</label>'
        + '<select id="modal-lead-category">'
        + '<option value="salon">مشغل نسائي</option>'
        + '<option value="restaurant">مطعم</option>'
        + '<option value="gym">نادي رياضي</option>'
        + '<option value="hotel">فندق</option>'
        + '<option value="spa">سبا ومساج</option>'
        + '<option value="hospital">مستشفى / عيادة</option>'
        + '<option value="company">شركة / مكتب</option>'
        + '<option value="school">مدرسة</option>'
        + '</select>'
        + '</div>'
        + '<div class="form-group">'
        + '<label>رقم الهاتف / واتساب</label>'
        + '<input type="text" id="modal-lead-phone" placeholder="3XXXXXXX">'
        + '</div>'
        + '</div>'
        + '<div class="form-group">'
        + '<label>العنوان</label>'
        + '<input type="text" id="modal-lead-address" placeholder="العنوان التفصيلي">'
        + '</div>';

    openModal('إضافة عميل يدوياً', html,
        '<button class="btn-secondary" onclick="closeModal()">إلغاء</button>'
        + '<button class="btn-primary" onclick="saveManualLead()">حفظ</button>'
    );
}

function saveManualLead() {
    var name = document.getElementById('modal-lead-name').value.trim();
    var category = document.getElementById('modal-lead-category').value;
    var phone = document.getElementById('modal-lead-phone').value.trim();
    var address = document.getElementById('modal-lead-address').value.trim();

    if (!name) { showToast('الرجاء إدخال اسم النشاط', 'warning'); return; }

    Store.addLead({ name: name, category: category, phone: phone, address: address });
    closeModal();
    renderLeadsTable();
    showToast('تم إضافة "' + name + '" بنجاح', 'success');
    Store.addActivity('add', 'إضافة يدوية "' + name + '"');
}

function editLead(id) {
    var leads = Store.getLeads();
    var lead = leads.find(function(l) { return l.id === id; });
    if (!lead) return;

    var html = '<div class="form-group">'
        + '<label>اسم النشاط</label>'
        + '<input type="text" id="modal-edit-name" value="' + escapeHtml(lead.name) + '">'
        + '</div>'
        + '<div class="form-row" style="grid-template-columns:1fr 1fr;">'
        + '<div class="form-group">'
        + '<label>التصنيف</label>'
        + '<select id="modal-edit-category">'
        + '<option value="salon"' + (lead.category === 'salon' ? ' selected' : '') + '>مشغل نسائي</option>'
        + '<option value="restaurant"' + (lead.category === 'restaurant' ? ' selected' : '') + '>مطعم</option>'
        + '<option value="gym"' + (lead.category === 'gym' ? ' selected' : '') + '>نادي رياضي</option>'
        + '<option value="hotel"' + (lead.category === 'hotel' ? ' selected' : '') + '>فندق</option>'
        + '<option value="spa"' + (lead.category === 'spa' ? ' selected' : '') + '>سبا ومساج</option>'
        + '<option value="hospital"' + (lead.category === 'hospital' ? ' selected' : '') + '>مستشفى / عيادة</option>'
        + '<option value="company"' + (lead.category === 'company' ? ' selected' : '') + '>شركة / مكتب</option>'
        + '<option value="school"' + (lead.category === 'school' ? ' selected' : '') + '>مدرسة</option>'
        + '</select>'
        + '</div>'
        + '<div class="form-group">'
        + '<label>رقم الهاتف</label>'
        + '<input type="text" id="modal-edit-phone" value="' + escapeHtml(lead.phone || '') + '">'
        + '</div>'
        + '</div>'
        + '<div class="form-group">'
        + '<label>العنوان</label>'
        + '<input type="text" id="modal-edit-address" value="' + escapeHtml(lead.address || '') + '">'
        + '</div>'
        + '<div class="form-group">'
        + '<label>الحالة</label>'
        + '<select id="modal-edit-status">'
        + '<option value="new"' + (lead.status === 'new' ? ' selected' : '') + '>جديد</option>'
        + '<option value="sent"' + (lead.status === 'sent' ? ' selected' : '') + '>تم الإرسال</option>'
        + '<option value="responded"' + (lead.status === 'responded' ? ' selected' : '') + '>تم الرد</option>'
        + '<option value="rejected"' + (lead.status === 'rejected' ? ' selected' : '') + '>مرفوض</option>'
        + '</select>'
        + '</div>';

    openModal('تعديل العميل', html,
        '<button class="btn-secondary" onclick="closeModal()">إلغاء</button>'
        + '<button class="btn-primary" onclick="updateManualLead(\'' + id + '\')">حفظ التعديلات</button>'
    );
}

function updateManualLead(id) {
    Store.updateLead(id, {
        name: document.getElementById('modal-edit-name').value.trim(),
        category: document.getElementById('modal-edit-category').value,
        phone: document.getElementById('modal-edit-phone').value.trim(),
        address: document.getElementById('modal-edit-address').value.trim(),
        status: document.getElementById('modal-edit-status').value
    });
    closeModal();
    renderLeadsTable();
    showToast('تم تحديث بيانات العميل', 'success');
}

function deleteLead(id) {
    if (!confirm('هل أنت متأكد من حذف هذا العميل؟')) return;
    var lead = Store.getLeads().find(function(l) { return l.id === id; });
    Store.deleteLead(id);
    renderLeadsTable();
    showToast('تم حذف العميل', 'info');
    if (lead) Store.addActivity('delete', 'حذف "' + lead.name + '" من العملاء');
}

function clearAllLeads() {
    if (!confirm('هل أنت متأكد من حذف جميع العملاء؟ هذا الإجراء لا يمكن التراجع عنه.')) return;
    Store.clearLeads();
    renderLeadsTable();
    showToast('تم مسح جميع العملاء', 'info');
    Store.addActivity('delete', 'مسح جميع العملاء');
}

function quickSendWhatsApp(id) {
    var leads = Store.getLeads();
    var lead = leads.find(function(l) { return l.id === id; });
    if (!lead) return;

    var phone = lead.phone.replace(/[^0-9]/g, '');
    if (phone.startsWith('973')) {
        phone = phone;
    } else if (phone.startsWith('0')) {
        phone = '973' + phone.substring(1);
    } else if (phone.length === 8) {
        phone = '973' + phone;
    }

    var template = document.getElementById('proposal-template')
        ? document.getElementById('proposal-template').value
        : 'standard';

    var text = buildProposalText(lead, template);
    var url = 'https://wa.me/' + phone + '?text=' + encodeURIComponent(text);
    window.open(url, '_blank');
    Store.updateLead(id, { status: 'sent' });
    Store.addActivity('send', 'إرسال واتساب لـ "' + lead.name + '"');
    renderLeadsTable();
}
