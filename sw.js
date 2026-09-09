const CACHE = 'laundry-pro-v19';
const ASSETS = [
    './',
    'index.html',
    'manifest.json',
    'css/style.css',
    'css/fb-banner.css',
    'js/db.js',
    'js/supabase-config.js',
    'js/supabase.js',
    'js/i18n.js',
    'js/whatsapp.js',
    'js/app.js',
    'marketing/index.html',
    'marketing/css/style.css',
    'marketing/css/all.min.css',
    'marketing/webfonts/fa-solid-900.woff2',
    'marketing/webfonts/fa-brands-400.woff2',
    'marketing/webfonts/fa-regular-400.woff2',
    'marketing/js/store.js',
    'marketing/js/auth.js',
    'marketing/js/search.js',
    'marketing/js/pricing.js',
    'marketing/js/proposal.js',
    'marketing/js/leads.js',
    'marketing/js/export.js',
    'marketing/js/app.js',
    'icons/icon-192.png',
    'icons/icon-512.png',
    'icons/icon-mask.png'
];

self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE)
            .then((c) => c.addAll(ASSETS))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (e) => {
    const req = e.request;
    if (req.method !== 'GET' || req.url.indexOf('http') !== 0) return;
    if (req.url.indexOf(self.location.origin) !== 0) return;
    e.respondWith(
        caches.match(req).then((hit) => {
            if (hit) return hit;
            return fetch(req).then((res) => {
                if (res && res.ok && req.url.indexOf(self.location.origin) === 0) {
                    const clone = res.clone();
                    caches.open(CACHE).then((c) => c.put(req, clone));
                }
                return res;
            }).catch(() => caches.match('index.html'));
        })
    );
});