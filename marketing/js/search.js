const CATEGORY_MAP = {
    salon: { label: 'مشغل نسائي', queries: ['women salon', 'beauty salon', 'salon', 'مشغل نسائي', 'صالون تجميل'] },
    restaurant: { label: 'مطعم', queries: ['restaurant', 'مطعم', 'مطعم شعبي', 'مطعم بحري'] },
    gym: { label: 'نادي رياضي', queries: ['gym', 'fitness center', 'نادي رياضي', 'صالة رياضية'] },
    hotel: { label: 'فندق', queries: ['hotel', 'فندق', ' motors'] },
    spa: { label: 'سبا ومساج', queries: ['spa', 'massage', 'سبا', 'مساج'] },
    hospital: { label: 'مستشفى / عيادة', queries: ['hospital', 'clinic', 'مستشفى', 'عيادة'] },
    company: { label: 'شركة / مكتب', queries: ['company', 'office', 'شركة', 'مكتب'] },
    school: { label: 'مدرسة', queries: ['school', 'مدرسة', 'أكاديمية'] }
};

const COUNTRY_CENTERS = {
    'المنامة': { lat: 26.2285, lng: 50.5860 },
    'المحرق': { lat: 26.2579, lng: 50.6481 },
    'الريف': { lat: 26.1298, lng: 50.5551 },
    'مدينة حمد': { lat: 26.0833, lng: 50.5500 },
    'مدينة عيسي': { lat: 26.1700, lng: 50.5500 },
    'بديع': { lat: 26.2278, lng: 50.4619 },
    'الجفير': { lat: 26.2285, lng: 50.5480 },
    'السيف': { lat: 26.2362, lng: 50.5407 },
    'جزر أمواج': { lat: 26.2833, lng: 50.6667 },
    'السترة': { lat: 26.1544, lng: 50.6341 },
    'توبلي': { lat: 26.1968, lng: 50.5452 },
    'عالي': { lat: 26.2079, lng: 50.5429 },
    'العكر': { lat: 26.2167, lng: 50.5833 },
    'حلا': { lat: 26.2333, lng: 50.5500 },
    'إسفي': { lat: 26.1667, lng: 50.6000 },
    'السنابس': { lat: 26.2333, lng: 50.5333 },
    'الحد': { lat: 26.2500, lng: 50.5667 },
    'المالكية': { lat: 26.1500, lng: 50.5000 },
    'كرباباد': { lat: 26.1333, lng: 50.5167 },
    'عين عيسي': { lat: 26.1700, lng: 50.5500 },
    'البحرين': { lat: 26.0667, lng: 50.5500 }
};

const BAHRAIN_DEFAULT = { lat: 26.2285, lng: 50.5860 };

function resolveGeocode(city) {
    if (!city) return BAHRAIN_DEFAULT;
    var cityLower = city.toLowerCase().trim();
    for (var name in COUNTRY_CENTERS) {
        if (cityLower.includes(name.toLowerCase()) || name.toLowerCase().includes(cityLower)) {
            return COUNTRY_CENTERS[name];
        }
    }
    return BAHRAIN_DEFAULT;
}

async function searchLeads() {
    const category = document.getElementById('search-category').value;
    const city = document.getElementById('search-city').value.trim();
    const radius = parseInt(document.getElementById('search-radius').value) || 5;
    const apiKey = document.getElementById('search-apikey').value.trim();

    if (!category) { showToast('الرجاء اختيار التصنيف', 'warning'); return; }
    if (!city) { showToast('الرجاء إدخال المدينة', 'warning'); return; }

    const statusEl = document.getElementById('search-status');
    statusEl.style.display = 'block';
    statusEl.className = 'search-status loading';
    statusEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري البحث عبر Google Places API...';

    if (!apiKey) {
        statusEl.className = 'search-status error';
        statusEl.innerHTML = '<i class="fas fa-exclamation-triangle"></i> لم يتم إدخال مفتاح Google API. استخدم "بحث تلقائي" بدلاً من ذلك.';
        return;
    }

    try {
        const coords = resolveGeocode(city);
        const query = CATEGORY_MAP[category].queries[0];
        const url = 'https://maps.googleapis.com/maps/api/place/nearbysearch/json'
            + '?location=' + coords.lat + ',' + coords.lng
            + '&radius=' + (radius * 1000)
            + '&type=establishment'
            + '&keyword=' + encodeURIComponent(query)
            + '&language=ar'
            + '&key=' + apiKey;

        const response = await fetch(url);
        const data = await response.json();

        if (data.status === 'REQUEST_DENIED') {
            statusEl.className = 'search-status error';
            statusEl.innerHTML = '<i class="fas fa-exclamation-triangle"></i> رفضت Google الطلب: ' + (data.error_message || 'تحقق من المفتاح والتفعيل');
            return;
        }

        if (data.status === 'ZERO_RESULTS') {
            statusEl.className = 'search-status error';
            statusEl.innerHTML = '<i class="fas fa-info-circle"></i> لا توجد نتائج في هذه المنطقة. جرب توسيع نطاق البحث.';
            return;
        }

        if (data.results && data.results.length > 0) {
            var results = data.results.map(function(place) {
                return {
                    name: place.name,
                    category: category,
                    phone: place.international_phone_number || place.formatted_phone_number || 'غير متوفر',
                    address: place.vicinity || place.formatted_address || 'غير متوفر',
                    rating: place.rating || '-',
                    place_id: place.place_id || '',
                    location: place.geometry ? place.geometry.location : {},
                    selected: false
                };
            });

            displaySearchResults(results);
            statusEl.className = 'search-status success';
            statusEl.innerHTML = '<i class="fas fa-check-circle"></i> تم العثور على ' + results.length + ' نتيجة في "' + city + '"';
            Store.addActivity('search', 'بحث عن "' + CATEGORY_MAP[category].label + '" في "' + city + '" - ' + results.length + ' نتيجة');
        }
    } catch (err) {
        statusEl.className = 'search-status error';
        statusEl.innerHTML = '<i class="fas fa-exclamation-triangle"></i> خطأ في الاتصال: ' + err.message;
    }
}

function searchLeadsManual() {
    var category = document.getElementById('search-category').value;
    var city = document.getElementById('search-city').value.trim();

    if (!category) { showToast('الرجاء اختيار التصنيف', 'warning'); return; }
    if (!city) { showToast('الرجاء إدخال المدينة', 'warning'); return; }

    var statusEl = document.getElementById('search-status');
    statusEl.style.display = 'block';
    statusEl.className = 'search-status loading';
    statusEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري إنشاء قائمة العملاء الافتراضية...';

    var catInfo = CATEGORY_MAP[category];
    var sampleNames = generateSampleNames(category, city);

    var results = sampleNames.map(function(name) {
        return {
            name: name,
            category: category,
            phone: generateSamplePhone(),
            address: city + ' - منطقة ' + (Math.floor(Math.random() * 10) + 1),
            rating: (Math.random() * 2 + 3).toFixed(1),
            place_id: '',
            location: {},
            selected: false
        };
    });

    setTimeout(function() {
        displaySearchResults(results);
        statusEl.className = 'search-status success';
        statusEl.innerHTML = '<i class="fas fa-check-circle"></i> تم إنشاء ' + results.length + ' عميل افتراضي. قم بتعديل البيانات يدوياً بعد الإضافة.';
        Store.addActivity('search', 'بحث تلقائي عن "' + catInfo.label + '" في "' + city + '" - ' + results.length + ' نتيجة');
    }, 800);
}

function generateSampleNames(category, city) {
    var nameSets = {
        salon: [
            'مشغل الأناقة', 'صالون الجمال', 'مشغل نور', 'صالون سحر', 'مشغل إليزابيث',
            'صالون روز', 'مشغل الأمل', 'صالون ميراكول', 'مشغل بيوتي', 'صالون نادين'
        ],
        restaurant: [
            'مطعم الشام', 'مطعم الديوان', 'مطعم بيت العرب', 'مطعم النخيل', 'مطعم الشرق',
            'مطعم اللذة', 'مطعم الطازج', 'مطعم المندي', 'مطعم بسمة', 'مطعم دار الضيافة'
        ],
        gym: [
            'صالة فيتنس برو', 'ناديStrength Club', 'صالة جالاكسي', 'نادي FitZone', 'صالة باور جيم',
            'نادي أولمبيك', 'صالة ماكس فيتنس', 'نادي أكتيف', 'صالة بودي شيب', 'نادي تشامبيون'
        ],
        hotel: [
            'فندق القصر', 'فندق الملك', 'فندق الفيروز', 'فندق الأنتركونتيننتال', 'فندق السفير',
            'فندق أورينتال', 'فندق روز جاردن', 'فندق غولدن', 'فندق رويال', 'فندق بيرل'
        ],
        spa: [
            'سبا سيرين', 'مساج ريلكس', 'سبا أوasis', 'مساج هارموني', 'سبا زين',
            'مساج ريلاكس', 'سبا باراديس', 'مساج ترانكويل', 'سبا بلس', 'مساج كالم'
        ],
        hospital: [
            'مستشفى الشفاء', 'عيادة النور', 'مستشفى الحياة', 'عيادة الرعاية', 'مستشفى الرخاء',
            'عيادة هيلث', 'مستشفى مايو', 'عيادة كير', 'مستشفى السلام', 'عيادة ويلنس'
        ],
        company: [
            'شركة الاتصالات', 'مكتب الإدارة', 'شركة التقنية', 'مكتب الأمل', 'شركة البناء',
            'مكتب النخبة', 'شركة المستقبل', 'مكتب الأعمال', 'شركة سكاي', 'مكتب إنوفيشن'
        ],
        school: [
            'مدرسة النور', 'أكاديمية الإبداع', 'مدرسة الراشد', 'أكاديمية نولج', 'مدرسة فيوتشر',
            'أكاديمية إكسلنس', 'مدرسة النخبة', 'أكاديمية ستار', 'مدرسة المجد', 'أكاديمية بايونير'
        ]
    };

    var names = nameSets[category] || nameSets.salon;
    return names.map(function(n) { return n + ' - ' + city; });
}

function generateSamplePhone() {
    var prefixes = ['3', '17', '36', '38', '39', '16'];
    var p = prefixes[Math.floor(Math.random() * prefixes.length)];
    while (p.length < 8) {
        p += Math.floor(Math.random() * 10).toString();
    }
    return p;
}

var currentSearchResults = [];

function displaySearchResults(results) {
    currentSearchResults = results;
    var tbody = document.getElementById('results-tbody');
    var container = document.getElementById('search-results');
    var countEl = document.getElementById('results-count');

    container.style.display = 'block';
    countEl.textContent = '(' + results.length + ' نتيجة)';

    var html = '';
    for (var i = 0; i < results.length; i++) {
        var r = results[i];
        var catLabel = CATEGORY_MAP[r.category] ? CATEGORY_MAP[r.category].label : r.category;
        html += '<tr>'
            + '<td><input type="checkbox" data-idx="' + i + '" class="result-check" '
            + (r.selected ? 'checked ' : '')
            + 'onchange="currentSearchResults[' + i + '].selected = this.checked"></td>'
            + '<td><strong>' + escapeHtml(r.name) + '</strong></td>'
            + '<td>' + catLabel + '</td>'
            + '<td>' + escapeHtml(r.phone) + '</td>'
            + '<td>' + escapeHtml(r.address) + '</td>'
            + '<td>' + (r.rating ? '<span style="color: var(--warning);">★ ' + r.rating + '</span>' : '-') + '</td>'
            + '<td><button class="btn-success btn-xs" onclick="addSingleToLeads(' + i + ')"><i class="fas fa-plus"></i></button></td>'
            + '</tr>';
    }
    tbody.innerHTML = html;
}

function toggleSelectAll(checkbox) {
    var checks = document.querySelectorAll('.result-check');
    for (var j = 0; j < checks.length; j++) {
        checks[j].checked = checkbox.checked;
        var idx = parseInt(checks[j].getAttribute('data-idx'));
        currentSearchResults[idx].selected = checkbox.checked;
    }
}

function addSingleToLeads(idx) {
    var r = currentSearchResults[idx];
    var existingLeads = Store.getLeads();
    var isDuplicate = existingLeads.some(function(l) { return l.name === r.name && l.phone === r.phone; });
    if (isDuplicate) {
        showToast('هذا العميل موجود بالفعل في القائمة', 'warning');
        return;
    }
    Store.addLead({
        name: r.name,
        category: r.category,
        phone: r.phone,
        address: r.address,
        rating: r.rating
    });
    showToast('تم إضافة "' + r.name + '" بنجاح', 'success');
    Store.addActivity('add', 'إضافة "' + r.name + '" للعملاء المحتملين');
}

function addAllToLeads() {
    var selected = currentSearchResults.filter(function(r) { return r.selected; });
    var toAdd = selected.length > 0 ? selected : currentSearchResults;
    var existingLeads = Store.getLeads();
    var added = 0;
    var skipped = 0;

    toAdd.forEach(function(r) {
        var isDuplicate = existingLeads.some(function(l) { return l.name === r.name && l.phone === r.phone; });
        if (isDuplicate) { skipped++; return; }
        Store.addLead({
            name: r.name,
            category: r.category,
            phone: r.phone,
            address: r.address,
            rating: r.rating
        });
        added++;
    });

    if (added > 0) {
        var msg = 'تم إضافة ' + added + ' عميل';
        if (skipped > 0) msg += ' (' + skipped + ' مكرر تم تخطيه)';
        showToast(msg, 'success');
        Store.addActivity('add', 'إضافة ' + added + ' عميل من نتائج البحث');
    } else {
        showToast('جميع النتائج موجودة بالفعل في القائمة', 'warning');
    }
}

function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
}
