function renderProposalClients() {
    var leads = Store.getLeads();
    var container = document.getElementById('proposal-clients-list');

    if (leads.length === 0) {
        container.innerHTML = '<p class="empty-state">لا يوجد عملاء في القائمة</p>';
        return;
    }

    var html = '';
    leads.forEach(function(lead) {
        var catLabel = CATEGORY_MAP[lead.category] ? CATEGORY_MAP[lead.category].label : lead.category;
        html += '<div class="proposal-client-item">'
            + '<input type="checkbox" class="proposal-check" value="' + lead.id + '" data-name="' + escapeHtml(lead.name) + '">'
            + '<span>' + escapeHtml(lead.name) + ' <small style="color:var(--text-muted);">(' + catLabel + ')</small></span>'
            + '</div>';
    });
    container.innerHTML = html;
}

function getEnabledServices() {
    return Store.getServices().filter(function(s) { return s.enabled; });
}

function buildProposalText(lead, template) {
    var company = Store.getCompanyInfo();
    var services = getEnabledServices();
    var catLabel = CATEGORY_MAP[lead.category] ? CATEGORY_MAP[lead.category].label : lead.category;

    var companyName = company.name || 'مغسلة [اسم المغسلة]';
    var companyPhone = company.phone || '[رقم التواصل]';
    var companyDesc = company.description || 'نقدم خدمات غسيل وكي احترافية عالية الجودة';
    var companyHours = company.hours || '8 صباحاً - 10 مساءً';
    var companyAddress = company.address || '';

    var text = '';
    var divider = '━━━━━━━━━━━━━━━━━━━━';

    if (template === 'standard') {
        text = divider + '\n';
        text += companyName + '\n';
        text += divider + '\n\n';
        text += 'مرحباً إدارة ' + lead.name + '،\n\n';
        text += 'نتشرف بالتواصل معكم مع ' + companyName + '، شركة متخصصة في خدمات الغسيل والكي الاحترافي للقطاع التجاري والمؤسسي في مملكة البحرين.\n\n';
        text += 'ونظراً لنشاطكم كـ' + catLabel + '، نعرض عليكم باقات تعاقدي شهرية مميزة تشمل:\n\n';

        services.forEach(function(s) {
            var priceStr = s.price > 0 ? ' - ' + s.price + ' د.ب/' + s.unit : ' - حسب الاتفاق';
            text += '  ✅ ' + s.name + priceStr + '\n';
            text += '     └ ' + s.description + '\n';
        });

        text += '\n' + divider + '\n';
        text += '✨ مميزاتنا:\n';
        text += '  • جودة عالية ونتائج مضمونة\n';
        text += '  • التزام تام بالمواعيد والجداول الزمنية\n';
        text += '  • أسعار تنافسية خاصة بالعقود الشهرية\n';
        text += '  • فريق عمل مدرب ومحترف\n';
        text += '  • ضمان على جميع الخدمات\n';
        text += '  • إمكانية تخصيص الخدمات وفق احتياجاتكم\n\n';
        text += divider + '\n';
        text += 'للتواصل والاستفسار:\n';
        text += '📞 ' + companyPhone + '\n';
        if (companyHours) text += '🕐 ' + companyHours + '\n';
        text += divider + '\n';
        text += 'نتطلع لشراكة ناجحة ومثمرة معكم\n';
        text += 'مع خالص التحية،\n';
        text += companyName;

    } else if (template === 'premium') {
        text = '╔══════════════════════════════════╗\n';
        text += '║   عرض تعاقد شهري شامل و مميز   ║\n';
        text += '╚══════════════════════════════════╝\n\n';
        text += 'السادة / إدارة ' + lead.name + '\n';
        text += 'تحية طيبة ثم،\n\n';
        text += 'الموضوع: عرض تعاقد شهري شامل - ' + companyName + '\n\n';
        text += 'يسرنا في ' + companyName + ' أن نقدم لكم هذا العرض المميز المُصمم خصيصاً لاحتياجاتكم كـ' + catLabel + '.\n\n';
        text += '━━━━━━ الخدمات المتاحة ━━━━━━\n\n';

        services.forEach(function(s, i) {
            var priceStr = s.price > 0 ? s.price + ' د.ب/' + s.unit : 'سعر حسب الاتفاق';
            text += (i + 1) + '. ' + s.name + '\n';
            text += '   السعر: ' + priceStr + '\n';
            text += '   التفاصيل: ' + s.description + '\n\n';
        });

        text += '━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';
        text += '🏆 لماذا تختارون ' + companyName + '؟\n\n';
        text += '  1. خبرة تمتد لأكثر من 10 سنوات في خدمة المؤسسات\n';
        text += '  2. الالتزام بالمواعيد والجداول الزمنية\n';
        text += '  3. فريق عمل مدرب على أعلى مستوى\n';
        text += '  4. نظام متابعة دوري لضمان رضاكم التام\n';
        text += '  5. خدمات قابلة للتخصيص حسب احتياجاتكم\n';
        text += '  6. خصم خاص للعقود طويلة الأمد\n\n';
        text += '━━━━━━━━━━━━━━━━━━━━━━━━━\n';
        text += '📞 ' + companyPhone + '\n';
        text += '📍 ' + (companyAddress || 'مملكة البحرين') + '\n';
        text += '⏰ ' + companyHours + '\n';
        text += '━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';
        text += 'نتطلع لجوابكم، ونتطلع لخدمة ' + lead.name + ' بأعلى جودة.\n\n';
        text += 'وتفضلوا بقبول فائق الاحترام والتقدير،\n';
        text += companyName + '\n' + companyPhone;

    } else if (template === 'discount') {
        text = '🔥🔥 عرض خاص لفترة محدودة 🔥🔥\n\n';
        text += 'مرحباً ' + lead.name + '!\n\n';
        text += companyName + ' يخصص لكم عرض خصم حصري:\n\n';
        text += '📋 الخدمات المتاحة بخصم خاص:\n\n';

        services.forEach(function(s) {
            var priceStr = s.price > 0 ? s.price + ' د.ب/' + s.unit : 'عرض خاص';
            text += '  ★ ' + s.name + ': ' + priceStr + '\n';
        });

        text += '\n🎁 مزايا إضافية:\n';
        text += '  • خصم 15% على أول 3 أشهر\n';
        text += '  • جولة تجريبية مجانية قبل التعاقد\n';
        text += '  • مرونة في مدة التعاقد\n\n';
        text += '⏰ العرض ساري لمدة 7 أيام فقط!\n\n';
        text += '📞 اتصل الآن: ' + companyPhone + '\n';
        text += 'واحصل على عرضك الخاص\n\n';
        text += companyName;
    }

    return text;
}

function generateProposals() {
    var checkboxes = document.querySelectorAll('.proposal-check:checked');
    if (checkboxes.length === 0) {
        showToast('الرجاء تحديد عميل واحد على الأقل', 'warning');
        return;
    }

    var template = document.getElementById('proposal-template').value;
    var leads = Store.getLeads();
    var preview = document.getElementById('proposal-preview');
    var actions = document.getElementById('proposal-actions');

    var html = '';
    var proposalData = [];

    checkboxes.forEach(function(cb) {
        var leadId = cb.value;
        var lead = leads.find(function(l) { return l.id === leadId; });
        if (!lead) return;

        var text = buildProposalText(lead, template);
        proposalData.push({ lead: lead, text: text });

        html += '<div class="proposal-message">'
            + '<div class="msg-header">👤 ' + escapeHtml(lead.name) + ' | ' + (CATEGORY_MAP[lead.category] ? CATEGORY_MAP[lead.category].label : lead.category) + '</div>'
            + '<pre style="white-space:pre-wrap;font-family:inherit;margin:0;font-size:14px;line-height:1.8;">' + escapeHtml(text) + '</pre>'
            + '<div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap;">'
            + '  <button class="btn-whatsapp btn-sm" onclick="sendWhatsApp(\'' + leadId + '\', \'' + template + '\')">'
            + '    <i class="fab fa-whatsapp"></i> إرسال عبر واتساب'
            + '  </button>'
            + '  <button class="btn-secondary btn-xs" onclick="copySingleProposal(this, \'' + leadId + '\')">'
            + '    <i class="fas fa-copy"></i> نسخ'
            + '  </button>'
            + '</div>'
            + '</div>';
    });

    preview.innerHTML = html;
    actions.style.display = 'flex';
    window._currentProposals = proposalData;
}

function previewProposal() {
    if (window._currentProposals && window._currentProposals.length > 0) {
        generateProposals();
    }
}

function sendWhatsApp(leadId, template) {
    var leads = Store.getLeads();
    var lead = leads.find(function(l) { return l.id === leadId; });
    if (!lead) return;

    var phone = lead.phone.replace(/[^0-9]/g, '');
    if (phone.startsWith('973')) {
        phone = phone;
    } else if (phone.startsWith('0')) {
        phone = '973' + phone.substring(1);
    } else if (phone.length === 8) {
        phone = '973' + phone;
    }

    var text = buildProposalText(lead, template);
    var encodedText = encodeURIComponent(text);
    var url = 'https://wa.me/' + phone + '?text=' + encodedText;

    window.open(url, '_blank');
    Store.updateLead(leadId, { status: 'sent' });
    Store.addActivity('send', 'إرسال عرض "' + lead.name + '" عبر واتساب');
    showToast('تم فتح واتساب لإرسال العرض لـ ' + lead.name, 'success');
}

function sendAllProposals() {
    if (!window._currentProposals || window._currentProposals.length === 0) {
        showToast('لا توجد عروض مُنشأة', 'warning');
        return;
    }

    window._currentProposals.forEach(function(p) {
        setTimeout(function() {
            sendWhatsApp(p.lead.id, document.getElementById('proposal-template').value);
        }, 500);
    });
}

function copySingleProposal(btn, leadId) {
    var proposal = window._currentProposals.find(function(p) { return p.lead.id === leadId; });
    if (!proposal) return;

    navigator.clipboard.writeText(proposal.text).then(function() {
        showToast('تم نسخ الرسالة', 'success');
    }).catch(function() {
        showToast('فشل النسخ', 'error');
    });
}

function copyAllProposals() {
    if (!window._currentProposals || window._currentProposals.length === 0) return;

    var allText = window._currentProposals.map(function(p) {
        return '=== ' + p.lead.name + ' ===\n' + p.text;
    }).join('\n\n\n');

    navigator.clipboard.writeText(allText).then(function() {
        showToast('تم نسخ جميع الرسائل', 'success');
    }).catch(function() {
        showToast('فشل النسخ', 'error');
    });
}
