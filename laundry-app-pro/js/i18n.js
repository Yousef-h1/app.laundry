// ============================================================
// i18n - نظام الترجمة العربية / الإنجليزية
// ============================================================
const LANG_KEY = "lapp_lang";

const I18N = {
  ar: {
    langName: "العربية",
    appName: "مغسلة الخدمة المميزة",
    appNameShort: "المميزة",
    tagline: "غسيل وكوي الملابس مع خدمة الاستلام والتسليم المنزلي",
    area: "البديع وما حولها - مملكة البحرين",

    // Nav
    nav_services: "الخدمات",
    nav_cart: "السلة",
    nav_info: "عن الخدمة",
    nav_orders_track: "تتبع طلبي",

    // Header info strip
    free_delivery: "مجاني فوق 8.000 د.ب",
    delivery_speed: "عادي / مستعجل",
    home_service: "استلام وتوصيل",
    lbl_free_delivery: "توصيل مجاني",
    lbl_speed: "سرعة التنفيذ",
    lbl_home: "خدمة منزلية",

    // Sections
    choose_services: "اختر الخدمات",
    delivery_data: "بيانات التوصيل",
    area_note: "نغطي منطقة البديع وما حولها في مملكة البحرين فقط.",
    about_service: "عن الخدمة",

    // Checkout form
    full_name: "الاسم الكامل",
    phone_wa: "رقم الهاتف / واتساب",
    address: "العنوان (المنطقة في البديع وما حولها)",
    notes_optional: "ملاحظات إضافية (اختياري)",
    placeholder_name: "أدخل اسمك الكامل",
    placeholder_phone: "مثال: 39000000",
    placeholder_address: "المنطقة، الشارع، المبنى",
    placeholder_notes: "أي ملاحظات خاصة بطلبك",
    confirm_order: "تأكيد الطلب",
    back_to_cart: "العودة إلى السلة",
    checkout: "متابعة الطلب",

    // Cart
    cart_title: "سلة المشتريات",
    cart_empty: "سلتك فارغة حالياً",
    cart_empty_hint: "أضف بعض الخدمات للبدء",
    products_total: "مجموع المنتجات",
    delivery_charges: "رسوم التوصيل",
    grand_total: "الإجمالي النهائي",
    free_delivery_msg: "توصيل مجاني",
    below_min: "طلبك أقل من {x} د.ب، ستُضاف رسوم التوصيل",
    delivery_fee: "رسوم التسليم",
    pickup_fee: "رسوم الاستلام",
    delete: "حذف",

    // Add modal
    wash_iron: "غسيل وكوي",
    iron_only: "كوي فقط",
    normal: "عادي",
    urgent: "مستعجل X2",
    service_mode: "وضع الخدمة",
    speed: "سرعة التنفيذ",
    quantity: "الكمية",
    manual_price: "سعر يدوي / مخصص (بالدينار)",
    manual_note: "سعر يدوي / مخصص - أدخل السعر المطلوب",
    total_item: "السعر الإجمالي للعنصر",
    add_to_cart: "إضافة إلى السلة",
    added_to_cart: "تمت إضافة {x} إلى السلة",
    no_iron_service: "هذا الصنف لا يشمل خدمة الكوي فقط",
    invalid_manual: "يرجى إدخال سعر مخصص صحيح للخدمة اليدوية",
    wash: "غسيل",
    iron: "كوي",
    qty: "كمية",
    bn: "د.ب",

    // Success / track
    order_received: "تم استلام طلبك بنجاح!",
    thanks: "شكراً لثقتكم بخدمتنا",
    order_number: "رقم الطلب",
    pending_confirm: "قيد انتظار تأكيد المغسلة",
    not_confirmed_yet: "لا يُعتبر طلبك مؤكداً نهائياً إلا بعد موافقة إدارة المغسلة. سنتواصل معك قريباً لتأكيد الطلب.",
    new_order: "طلب جديد",
    track_order: "تتبع طلبك",
    track_phone: "أدخل رقم الهاتف أو رقم الطلب",
    track_btn: "بحث",
    no_orders_found: "لا توجد طلبات مطابقة",
    current_status: "الحالة الحالية",
    order_details: "تفاصيل الطلب",

    // Status labels
    st_pending: "قيد انتظار تأكيد المغسلة",
    st_approved: "تم قبول الطلب",
    st_in_progress: "قيد المعالجة",
    st_ready: "جاهز للتسليم",
    st_delivered: "تم التسليم",
    st_completed: "مكتمل",
    st_rejected: "مرفوض",
    st_cancelled: "ملغي",

    // Info modal
    about_text: "مغسلة الخدمة المميزة تقدم خدمات غسيل وكوي الملابس عالية الجودة مع خدمة الاستلام والتسليم المنزلي في منطقة البديع وما حولها بمملكة البحرين.",
    delivery_terms: "شروط التوصيل:",
    term1: "✓ توصيل مجاني للطلبات من 8.000 د.ب فأكثر",
    term2: "✓ للطلبات الأقل من 8.000 د.ب: رسوم تسليم 2.000 د.ب + رسوم استلام 1.000 د.ب",
    subject_confirm: "يخضع كل طلب لتأكيد إدارة المغسلة قبل اعتماده نهائياً.",
    ok: "حسناً",

    // Footer
    admin_login: "دخول إدارة المغسلة",
    copyright: "© 2026",

    // Misc
    close: "إغلاق",
    cancel: "إلغاء",
    save: "حفظ",
    loading: "جارٍ التحميل...",
    today: "اليوم",
    toggle_lang: "English",

    // Track statuses hint
    track_hint: "يمكنك متابعة طلبك هنا بعد موافقة الإدارة."
  },

  en: {
    langName: "English",
    appName: "Prestige Laundry Services",
    appNameShort: "Prestige",
    tagline: "Washing & ironing with free pickup and delivery",
    area: "Al Budaiya & surroundings - Kingdom of Bahrain",

    nav_services: "Services",
    nav_cart: "Cart",
    nav_info: "About",
    nav_orders_track: "Track Order",

    free_delivery: "FREE over BD 8.000",
    delivery_speed: "Normal / Express",
    home_service: "Pickup & Delivery",
    lbl_free_delivery: "Free delivery",
    lbl_speed: "Turnaround",
    lbl_home: "Home service",

    choose_services: "Choose Services",
    delivery_data: "Delivery Details",
    area_note: "We cover Al Budaiya and nearby areas in Bahrain only.",
    about_service: "About Us",

    full_name: "Full Name",
    phone_wa: "Phone / WhatsApp",
    address: "Address (area in Al Budaiya & nearby)",
    notes_optional: "Additional Notes (optional)",
    placeholder_name: "Enter your full name",
    placeholder_phone: "e.g. 39000000",
    placeholder_address: "Area, street, building",
    placeholder_notes: "Any special notes for your order",
    confirm_order: "Confirm Order",
    back_to_cart: "Back to Cart",
    checkout: "Checkout",

    cart_title: "Shopping Cart",
    cart_empty: "Your cart is empty",
    cart_empty_hint: "Add some services to get started",
    products_total: "Items Total",
    delivery_charges: "Delivery Charges",
    grand_total: "Grand Total",
    free_delivery_msg: "Free delivery",
    below_min: "Your order is below {x} BD, delivery charges will apply",
    delivery_fee: "Delivery fee",
    pickup_fee: "Pickup fee",
    delete: "Remove",

    wash_iron: "Wash & Iron",
    iron_only: "Iron Only",
    normal: "Normal",
    urgent: "Express x2",
    service_mode: "Service Mode",
    speed: "Speed",
    quantity: "Quantity",
    manual_price: "Custom / manual price (BHD)",
    manual_note: "Custom price - enter the required amount",
    total_item: "Item Total",
    add_to_cart: "Add to Cart",
    added_to_cart: "{x} added to cart",
    no_iron_service: "This item has no iron-only service",
    invalid_manual: "Please enter a valid custom price",
    wash: "Wash",
    iron: "Iron",
    qty: "Qty",
    bn: "BD",

    order_received: "Order received successfully!",
    thanks: "Thank you for trusting our service",
    order_number: "Order Number",
    pending_confirm: "Awaiting confirmation",
    not_confirmed_yet: "Your order is not final until approved by the laundry management. We will contact you soon to confirm.",
    new_order: "New Order",
    track_order: "Track Your Order",
    track_phone: "Enter phone number or order ID",
    track_btn: "Search",
    no_orders_found: "No matching orders found",
    current_status: "Current Status",
    order_details: "Order Details",

    st_pending: "Awaiting confirmation",
    st_approved: "Order approved",
    st_in_progress: "Processing",
    st_ready: "Ready for delivery",
    st_delivered: "Delivered",
    st_completed: "Completed",
    st_rejected: "Rejected",
    st_cancelled: "Cancelled",

    about_text: "Prestige Laundry Services provides high-quality washing and ironing with home pickup and delivery in Al Budaiya and nearby areas, Kingdom of Bahrain.",
    delivery_terms: "Delivery terms:",
    term1: "✓ Free delivery for orders over BD 8.000",
    term2: "✓ Below BD 8.000: BD 2.000 delivery + BD 1.000 pickup",
    subject_confirm: "Every order is subject to the laundry management confirmation before being finalized.",
    ok: "OK",

    admin_login: "Laundry Admin Login",
    copyright: "© 2026",

    close: "Close",
    cancel: "Cancel",
    save: "Save",
    loading: "Loading...",
    today: "Today",
    toggle_lang: "العربية"
  }
};

let CURRENT_LANG = "ar";

function getLang() {
  try {
    return localStorage.getItem(LANG_KEY) || "ar";
  } catch (e) { return "ar"; }
}

function setLang(l) {
  CURRENT_LANG = (l === "en") ? "en" : "ar";
  try { localStorage.setItem(LANG_KEY, CURRENT_LANG); } catch (e) {}
  document.documentElement.lang = CURRENT_LANG;
  document.documentElement.dir = CURRENT_LANG === "ar" ? "rtl" : "ltr";
}

function t(key) {
  const dict = I18N[CURRENT_LANG] || I18N.ar;
  return dict[key] !== undefined ? dict[key] : (I18N.ar[key] !== undefined ? I18N.ar[key] : key);
}

// ترجمة نص مع وضع قيم (مثال: {x})
function tf(key, vars) {
  let s = t(key);
  Object.keys(vars || {}).forEach((k) => {
    s = s.replace(new RegExp("\\{" + k + "\\}", "g"), vars[k]);
  });
  return s;
}

function applyLang(scope) {
  scope = scope || document;
  // تحديث عناصر بـ data-i18n
  scope.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = t(el.getAttribute("data-i18n"));
  });
  scope.querySelectorAll("[data-i18n-ph]").forEach((el) => {
    el.setAttribute("placeholder", t(el.getAttribute("data-i18n-ph")));
  });
  // تحديث نص زر اللغة
  const btn = scope.getElementById("lang-toggle");
  if (btn) btn.textContent = t("toggle_lang");
}

// تهيئة اللغة عند تحميل الصفحة
setLang(getLang());