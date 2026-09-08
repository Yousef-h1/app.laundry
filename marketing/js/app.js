function initApp() {
    renderLeadsTable();
    renderPricing();
    loadCompanyInfo();
    renderProposalClients();
    updateDashboard();
}

function switchSection(sectionId) {
    document.querySelectorAll('.section').forEach(function(s) { s.classList.remove('active'); });
    document.querySelectorAll('.nav-item').forEach(function(n) { n.classList.remove('active'); });

    var section = document.getElementById('section-' + sectionId);
    if (section) section.classList.add('active');

    var navItem = document.querySelector('.nav-item[data-section="' + sectionId + '"]');
    if (navItem) navItem.classList.add('active');

    if (sectionId === 'leads') renderLeadsTable();
    if (sectionId === 'pricing') renderPricing();
    if (sectionId === 'proposal') renderProposalClients();
    if (sectionId === 'dashboard') updateDashboard();

    var sidebar = document.getElementById('sidebar');
    sidebar.classList.remove('open');
}

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
}

function updateDashboard() {
    var leads = Store.getLeads();
    var sent = leads.filter(function(l) { return l.status === 'sent' || l.status === 'responded'; });
    var pending = leads.filter(function(l) { return l.status === 'new'; });
    var cities = new Set(leads.map(function(l) {
        return l.address ? l.address.split(' - ')[0] : '';
    }).filter(Boolean));

    document.getElementById('stat-total-leads').textContent = leads.length;
    document.getElementById('stat-sent').textContent = sent.length;
    document.getElementById('stat-pending').textContent = pending.length;
    document.getElementById('stat-cities').textContent = cities.size;

    var activityEl = document.getElementById('recent-activity');
    var activities = Store.getActivities();

    if (activities.length === 0) {
        activityEl.innerHTML = '<p class="empty-state">لا توجد نشاطات بعد</p>';
        return;
    }

    var iconMap = {
        add: '<div class="activity-icon add"><i class="fas fa-plus"></i></div>',
        send: '<div class="activity-icon send"><i class="fas fa-paper-plane"></i></div>',
        delete: '<div class="activity-icon delete"><i class="fas fa-trash"></i></div>',
        search: '<div class="activity-icon search"><i class="fas fa-search"></i></div>'
    };

    var html = '';
    activities.slice(0, 20).forEach(function(act) {
        var icon = iconMap[act.type] || iconMap.add;
        var timeStr = formatTime(act.time);
        html += '<div class="activity-item">' + icon + '<span>' + escapeHtml(act.text) + '</span><small style="margin-right:auto;color:var(--text-muted);">' + timeStr + '</small></div>';
    });
    activityEl.innerHTML = html;
}

function formatTime(isoStr) {
    if (!isoStr) return '';
    var d = new Date(isoStr);
    var now = new Date();
    var diff = Math.floor((now - d) / 1000);

    if (diff < 60) return 'الآن';
    if (diff < 3600) return Math.floor(diff / 60) + ' دقيقة';
    if (diff < 86400) return Math.floor(diff / 3600) + ' ساعة';
    if (diff < 604800) return Math.floor(diff / 86400) + ' يوم';
    return d.toLocaleDateString('ar-SA');
}

function openModal(title, body, footer) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = body;
    document.getElementById('modal-footer').innerHTML = footer || '';
    document.getElementById('modal-overlay').style.display = 'flex';
}

function closeModal() {
    document.getElementById('modal-overlay').style.display = 'none';
}

function showToast(message, type) {
    type = type || 'info';
    var container = document.getElementById('toast-container');
    var icons = {
        success: 'fas fa-check-circle',
        error: 'fas fa-exclamation-circle',
        warning: 'fas fa-exclamation-triangle',
        info: 'fas fa-info-circle'
    };

    var toast = document.createElement('div');
    toast.className = 'toast ' + type;
    toast.innerHTML = '<i class="' + (icons[type] || icons.info) + '"></i> ' + message;
    container.appendChild(toast);

    setTimeout(function() {
        toast.style.animation = 'toastOut 0.3s ease forwards';
        setTimeout(function() {
            if (toast.parentNode) toast.parentNode.removeChild(toast);
        }, 300);
    }, 3000);
}

document.addEventListener('DOMContentLoaded', function() {
    initApp();

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') closeModal();
    });
});
