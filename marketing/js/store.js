const Store = {
    _prefix: 'laundrypro_',
    _mem: {},
    _memOnly: false,

    _notifyReady() {
        let blocked = !!this._memOnly;
        try {
            const probe = this._prefix + '_probe';
            localStorage.setItem(probe, '1');
            localStorage.removeItem(probe);
        } catch (e) { blocked = true; }
        try {
            if (window.parent && window.parent !== window) {
                window.parent.postMessage({ source: 'mkt-sys', ready: true, memoryOnly: blocked }, '*');
            }
        } catch (e) { /* ignore */ }
    },

    get(key, defaultVal = null) {
        const k = this._prefix + key;
        try {
            const raw = localStorage.getItem(k);
            if (raw != null) return JSON.parse(raw);
        } catch (e) { /* storage blocked */ }
        if (this._mem[k] !== undefined) return JSON.parse(this._mem[k]);
        return defaultVal;
    },

    set(key, value) {
        const k = this._prefix + key;
        const v = JSON.stringify(value);
        try {
            localStorage.setItem(k, v);
        } catch (e) {
            this._mem[k] = v;
            this._memOnly = true;
        }
        try { window.parent && window.parent !== window && window.parent.postMessage({ source: 'mkt-sys', ready: true, memoryOnly: !!this._memOnly }, '*'); } catch (e2) { /* ignore */ }
    },

    remove(key) {
        const k = this._prefix + key;
        try { localStorage.removeItem(k); } catch (e) { /* ignore */ }
        delete this._mem[k];
    },

    getDefaultPassword() {
        return 'laundry2024';
    },

    getPassword() {
        return this.get('password', this.getDefaultPassword());
    },

    setPassword(pw) {
        this.set('password', pw);
    },

    isAuthenticated() {
        return this.get('authenticated', false);
    },

    setAuthenticated(val) {
        this.set('authenticated', val);
    },

    _pingParent() { this._notifyReady(); },

    getLeads() {
        return this.get('leads', []);
    },

    saveLeads(leads) {
        this.set('leads', leads);
    },

    addLead(lead) {
        const leads = this.getLeads();
        const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
        lead.id = id;
        lead.status = lead.status || 'new';
        lead.createdAt = new Date().toISOString();
        leads.push(lead);
        this.saveLeads(leads);
        return lead;
    },

    updateLead(id, updates) {
        const leads = this.getLeads();
        const idx = leads.findIndex(l => l.id === id);
        if (idx !== -1) {
            leads[idx] = { ...leads[idx], ...updates };
            this.saveLeads(leads);
            return leads[idx];
        }
        return null;
    },

    deleteLead(id) {
        const leads = this.getLeads().filter(l => l.id !== id);
        this.saveLeads(leads);
    },

    clearLeads() {
        this.saveLeads([]);
    },

    getServices() {
        var stored = this.get('services');
        if (stored && stored.length > 0) {
            var migrationMap = {
                'استلام وتوصيل مجاني داخل المنطقة': 'تقديم خدمة الاستلام والتوصيل حسب الاتفاق',
                'تنظيف احترافي للزي الرسمي بأحدث المعدات': 'خدمة غسيل احترافية للزي الرسمي بالمستوى المطلوب',
                'كي احترافي واقتصادي لجميع أنواع الأقمشة': 'كي احترافي لجميع أنواع الأقمشة'
            };
            var changed = false;
            stored.forEach(function(s) {
                if (s.name === 'خدمة الكي وال Pressing') { s.name = 'خدمة الكي'; changed = true; }
                if (migrationMap[s.description]) { s.description = migrationMap[s.description]; changed = true; }
            });
            if (changed) this.saveServices(stored);
            return stored;
        }
        return this.get('services', Store.getDefaultServices());
    },

    saveServices(services) {
        this.set('services', services);
    },

    getDefaultServices() {
        return [
            {
                id: 's1',
                name: 'غسيل المفارش والبطانيات',
                description: 'غسيل وتعقيم شامل للمفروشات والبطانيات',
                price: 0,
                unit: 'كجم',
                enabled: true,
                icon: 'bed'
            },
            {
                id: 's2',
                name: 'غسيل الزي الرسمي للموظفين',
                description: 'خدمة غسيل احترافية للزي الرسمي بالمستوى المطلوب',
                price: 0,
                unit: 'قطعة',
                enabled: true,
                icon: 'user-tie'
            },
            {
                id: 's3',
                name: 'خدمة الكي',
                description: 'كي احترافي لجميع أنواع الأقمشة',
                price: 0,
                unit: 'قطعة',
                enabled: true,
                icon: 'iron'
            },
            {
                id: 's4',
                name: 'باقة التعاقد الشهري',
                description: 'باقة شهرية شاملة مع خصم خاص للعقود',
                price: 0,
                unit: 'شهرياً',
                enabled: true,
                icon: 'calendar-check'
            },
            {
                id: 's5',
                name: 'غسيل الستائر',
                description: 'غسيل وكي الستائر بأنواعها',
                price: 0,
                unit: 'متر',
                enabled: true,
                icon: 'scroll'
            },
            {
                id: 's6',
                name: 'خدمة الاستلام والتوصيل',
                description: 'تقديم خدمة الاستلام والتوصيل حسب الاتفاق',
                price: 0,
                unit: 'رحلة',
                enabled: true,
                icon: 'truck'
            }
        ];
    },

    getCompanyInfo() {
        var stored = this.get('companyInfo');
        if (stored && stored.name) return stored;
        var company = this.get('companyInfo', {});
        return {
            name: 'مغسلة الخدمة المميزة',
            phone: company.phone || '',
            address: company.address || '',
            hours: company.hours || '',
            description: company.description || 'نقدم خدمات غسيل وكي احترافية عالية الجودة مع الالتزام بالمواعيد والأسعار المنافسة. خبرة تمتد لأكثر من 10 سنوات في خدمة الشركات والمؤسسات.'
        };
    },

    saveCompanyInfo(info) {
        this.set('companyInfo', info);
    },

    getVATRecords() {
        return this.get('vatRecords', []);
    },

    saveVATRecords(records) {
        this.set('vatRecords', records);
    },

    addVATRecord(record) {
        var records = this.getVATRecords();
        record.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
        record.createdAt = new Date().toISOString();
        records.unshift(record);
        this.saveVATRecords(records);
        return record;
    },

    deleteVATRecord(id) {
        var records = this.getVATRecords().filter(function(r) { return r.id !== id; });
        this.saveVATRecords(records);
    },

    getActivities() {
        return this.get('activities', []);
    },

    addActivity(type, text) {
        const activities = this.getActivities();
        activities.unshift({
            type,
            text,
            time: new Date().toISOString()
        });
        if (activities.length > 50) activities.length = 50;
        this.set('activities', activities);
    },

    exportAll() {
        const data = {};
        try {
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key.startsWith(this._prefix)) data[key] = localStorage.getItem(key);
            }
        } catch (e) { /* storage blocked */ }
        Object.keys(this._mem).forEach(k => { if (k.startsWith(this._prefix)) data[k] = this._mem[k]; });
        return data;
    },

    importAll(data) {
        Object.entries(data || {}).forEach(([key, val]) => {
            try { localStorage.setItem(key, val); }
            catch (e) { this._mem[key] = val; this._memOnly = true; }
        });
        this._notifyReady();
    },

    clearAll() {
        try {
            const keys = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key.startsWith(this._prefix)) keys.push(key);
            }
            keys.forEach(k => localStorage.removeItem(k));
        } catch (e) { /* storage blocked */ }
        this._mem = {};
    }
};

Store._pingParent();
