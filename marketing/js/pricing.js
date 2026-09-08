function renderPricing() {
    var services = Store.getServices();
    var grid = document.getElementById('pricing-grid');

    var html = '';
    services.forEach(function(s, i) {
        html += '<div class="pricing-card" id="pricing-card-' + s.id + '">'
            + '<div class="pricing-card-header">'
            + '  <h4><i class="fas fa-' + (s.icon || 'cog') + '" style="margin-left:8px;color:var(--primary);"></i>' + escapeHtml(s.name) + '</h4>'
            + '  <button class="btn-danger btn-xs" onclick="removeService(' + i + ')" title="حذف"><i class="fas fa-trash"></i></button>'
            + '</div>'
            + '<div class="form-group">'
            + '  <label>اسم الخدمة</label>'
            + '  <input type="text" value="' + escapeHtml(s.name) + '" onchange="updateService(' + i + ', \'name\', this.value)">'
            + '</div>'
            + '<div class="form-group">'
            + '  <label>الوصف</label>'
            + '  <input type="text" value="' + escapeHtml(s.description) + '" onchange="updateService(' + i + ', \'description\', this.value)">'
            + '</div>'
            + '<div class="form-row" style="grid-template-columns:1fr 1fr;">'
            + '  <div class="form-group">'
            + '    <label>السعر (د.ب)</label>'
            + '    <input type="number" value="' + s.price + '" min="0" step="0.001" onchange="updateService(' + i + ', \'price\', parseFloat(this.value)||0)">'
            + '  </div>'
            + '  <div class="form-group">'
            + '    <label>الوحدة</label>'
            + '    <select onchange="updateService(' + i + ', \'unit\', this.value)">'
            + '      <option value="كجم"' + (s.unit === 'كجم' ? ' selected' : '') + '>كجم</option>'
            + '      <option value="قطعة"' + (s.unit === 'قطعة' ? ' selected' : '') + '>قطعة</option>'
            + '      <option value="شهرياً"' + (s.unit === 'شهرياً' ? ' selected' : '') + '>شهرياً</option>'
            + '      <option value="متر"' + (s.unit === 'متر' ? ' selected' : '') + '>متر</option>'
            + '      <option value="رحلة"' + (s.unit === 'رحلة' ? ' selected' : '') + '>رحلة</option>'
            + '    </select>'
            + '  </div>'
            + '</div>'
            + '<div class="service-toggle">'
            + '  <input type="checkbox" id="toggle-' + s.id + '" ' + (s.enabled ? 'checked' : '') + ' onchange="updateService(' + i + ', \'enabled\', this.checked)">'
            + '  <label for="toggle-' + s.id + '">' + (s.enabled ? 'مفعلة' : 'معطلة') + '</label>'
            + '</div>'
            + '</div>';
    });

    grid.innerHTML = html;
}

function updateService(idx, field, value) {
    var services = Store.getServices();
    if (services[idx]) {
        services[idx][field] = value;
        Store.saveServices(services);
    }
}

function addService() {
    var services = Store.getServices();
    var newId = 's' + Date.now();
    services.push({
        id: newId,
        name: 'خدمة جديدة',
        description: 'وصف الخدمة',
        price: 0,
        unit: 'قطعة',
        enabled: true,
        icon: 'plus-circle'
    });
    Store.saveServices(services);
    renderPricing();
    showToast('تمت إضافة خدمة جديدة', 'success');
}

function removeService(idx) {
    if (!confirm('هل أنت متأكد من حذف هذه الخدمة؟')) return;
    var services = Store.getServices();
    services.splice(idx, 1);
    Store.saveServices(services);
    renderPricing();
    showToast('تم حذف الخدمة', 'info');
}

function savePricing() {
    showToast('تم حفظ الأسعار والخدمات بنجاح', 'success');
    Store.addActivity('add', 'تحديث الأسعار والخدمات');
}

function resetPricing() {
    if (!confirm('هل أنت متأكد من إعادة تعيين جميع الأسعار والخدمات؟')) return;
    Store.saveServices(Store.getDefaultServices());
    renderPricing();
    showToast('تمت إعادة التعيين', 'info');
}

function saveCompanyInfo() {
    var info = {
        name: document.getElementById('company-name').value,
        phone: document.getElementById('company-phone').value,
        address: document.getElementById('company-address').value,
        hours: document.getElementById('company-hours').value,
        description: document.getElementById('company-desc').value
    };
    Store.saveCompanyInfo(info);
    showToast('تم حفظ معلومات المغسلة بنجاح', 'success');
    Store.addActivity('add', 'تحديث معلومات المغسلة');
}

function loadCompanyInfo() {
    var info = Store.getCompanyInfo();
    document.getElementById('company-name').value = info.name || '';
    document.getElementById('company-phone').value = info.phone || '';
    document.getElementById('company-address').value = info.address || '';
    document.getElementById('company-hours').value = info.hours || '';
    document.getElementById('company-desc').value = info.description || '';
}
