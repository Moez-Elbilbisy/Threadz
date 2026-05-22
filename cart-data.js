// ============================================
// THREADZ — Cart Data & Utility Layer
// ============================================

const GOVERNORATES = {
    "Cairo": ["Nasr City", "Heliopolis", "Maadi", "Zamalek", "Downtown Cairo", "New Cairo", "Shubra", "Ain Shams", "El Marg", "El Matariya", "El Nozha", "El Salam", "El Zeitoun", "Hadayek El Kobba", "El Sahel"],
    "Giza": ["Dokki", "Mohandessin", "Agouza", "6th of October City", "Sheikh Zayed", "Haram", "Faisal", "Imbaba", "El Omraniya", "El Warraq", "Kerdasa", "Abu Rawash"],
    "Alexandria": ["Smouha", "Stanley", "Gleem", "Sidi Gaber", "Sporting", "Montaza", "Miami", "Mandara", "Borg El Arab", "Agami", "Roushdy", "Loran", "Kafr Abdo", "Camp Caesar"],
    "Qalyubia": ["Banha", "Shubra El Kheima", "Qalyub", "Khanka", "Obour City", "El Khosous", "Toukh", "Qaha", "Kafr Shukr", "Shibin El Qanater"],
    "Sharqia": ["Zagazig", "10th of Ramadan City", "Bilbeis", "Minya El Qamh", "Abu Hammad", "Faqous", "Hihya", "Abu Kebir", "Kafr Saqr", "Mashtool El Souk"],
    "Dakahlia": ["Mansoura", "Talkha", "Mit Ghamr", "Aga", "Belqas", "Dekernes", "Sherbin", "Manzala", "Gamasa", "Sinbillawin"],
    "Beheira": ["Damanhour", "Kafr El Dawwar", "Edku", "Rashid (Rosetta)", "Kom Hamada", "Abu Homs", "Itay El Barud", "Shubra Khit", "Hosh Eissa", "El Mahmoudiya"],
    "Monufia": ["Shebin El Kom", "Menouf", "Ashmoun", "Quesna", "Berket El Sab", "Tala", "El Bagour", "El Shohada", "Sadat City"],
    "Gharbia": ["Tanta", "El Mahalla El Kubra", "Kafr El Zayat", "Zefta", "Samanoud", "Basyoun", "Qutur", "El Santa"],
    "Kafr El Sheikh": ["Kafr El Sheikh", "Desouk", "Fuwwah", "Motobas", "Baltim", "Burullus", "Sidi Salem", "Biyla", "Qilin", "El Hamoul"],
    "Damietta": ["Damietta", "New Damietta", "Ras El Bar", "Faraskour", "Kafr Saad", "El Zarqa"],
    "Port Said": ["Port Said City", "Port Fouad", "El Arab", "El Zohour", "El Manakh", "El Sharq"],
    "Suez": ["Suez City", "Ain Sokhna", "El Arbaeen", "Ataka", "El Ganayen", "Faisal"],
    "Ismailia": ["Ismailia City", "Fayed", "El Tal El Kebir", "Abu Sultan", "El Qantara Sharq", "El Qantara Gharb"],
    "North Sinai": ["El Arish", "Bir El Abd", "Rafah", "Sheikh Zuweid", "Nakhl", "El Hasana"],
    "South Sinai": ["Sharm El Sheikh", "Dahab", "Nuweiba", "Taba", "Saint Catherine", "El Tor", "Abu Redeis", "Ras Sidr"],
    "Red Sea": ["Hurghada", "El Gouna", "Safaga", "Marsa Alam", "El Quseir", "Ras Ghareb", "Shalatin", "Halayeb"],
    "Faiyum": ["Faiyum City", "Ibsheway", "Itsa", "Sinnuris", "Tamiya", "Youssef El Seddik"],
    "Beni Suef": ["Beni Suef City", "El Wasta", "Nasser", "Ehnasia", "Beba", "Somosta", "El Fashn"],
    "Minya": ["Minya City", "Mallawi", "Samalout", "Abu Qurqas", "Beni Mazar", "Maghagha", "Deir Mawas", "Matay"],
    "Assiut": ["Assiut City", "Dairout", "Manfalut", "El Qusiya", "Abu Tig", "Abnub", "El Ghanayem", "Sahel Selim", "El Badari"],
    "Sohag": ["Sohag City", "Akhmim", "Girga", "Tahta", "El Maragha", "Tema", "El Monsha", "Dar El Salam", "Juhayna"],
    "Qena": ["Qena City", "Nag Hammadi", "Luxor East", "Qus", "Abu Tesht", "Dishna", "Farshut", "El Waqf"],
    "Luxor": ["Luxor City", "East Bank", "West Bank", "Esna", "Armant", "El Tod", "El Qurna"],
    "Aswan": ["Aswan City", "Edfu", "Kom Ombo", "Daraw", "Nasr El Nuba", "Abu Simbel", "Kalabsha"],
    "Matrouh": ["Marsa Matrouh", "El Alamein", "Siwa Oasis", "El Dabaa", "El Hamam", "El Negaila", "Sidi Barrani", "El Salloum"],
    "New Valley": ["Kharga", "Dakhla", "Farafra", "Paris", "Baris", "Balat", "Mut"]
};

// ---- localStorage Cart Utilities ----

const CART_KEY = 'threadz_cart';

function getCart() {
    try {
        return JSON.parse(localStorage.getItem(CART_KEY)) || [];
    } catch { return []; }
}

function saveCart(cart) {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
    updateAllCartCounts();
}

function addToCart(item) {
    // item: { id, name, price, image }
    const cart = getCart();
    const existing = cart.find(c => c.id === item.id);
    if (existing) {
        existing.qty += 1;
    } else {
        cart.push({ ...item, qty: 1 });
    }
    saveCart(cart);
}

function removeFromCart(id) {
    let cart = getCart();
    cart = cart.filter(c => c.id !== id);
    saveCart(cart);
}

function updateQuantity(id, newQty) {
    const cart = getCart();
    const item = cart.find(c => c.id === id);
    if (item) {
        item.qty = Math.max(0, newQty);
        if (item.qty === 0) {
            removeFromCart(id);
            return;
        }
    }
    saveCart(cart);
}

function getCartCount() {
    return getCart().reduce((sum, item) => sum + item.qty, 0);
}

function getCartTotal() {
    return getCart().reduce((sum, item) => sum + item.price * item.qty, 0);
}

function clearCart() {
    localStorage.removeItem(CART_KEY);
    updateAllCartCounts();
}

function updateAllCartCounts() {
    const count = getCartCount();
    document.querySelectorAll('.cart-count').forEach(el => {
        el.innerText = count;
    });
}

// On page load, always sync badge
document.addEventListener('DOMContentLoaded', () => {
    updateAllCartCounts();
});
