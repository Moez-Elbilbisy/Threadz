// ─── State ─────────────────────────────────────────────────────────────────
let userPhoto = null;
let userPhotoFile = null;
let selectedProduct = null;
let allProducts = [];
let aiResultUrl = null;

const WARDROBE_BG = "https://images.unsplash.com/photo-1722153152286-d7c1ba92010f?w=800&q=80";
let wardrobeBgImg = null;
(async () => {
  try {
    const img = new Image();
    img.crossOrigin = "anonymous";
    await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; img.src = WARDROBE_BG; });
    wardrobeBgImg = img;
  } catch { /* ignore */ }
})();

const TRYON_PRODUCTS = [
  { id: "oversized-obsidian-hoodie", name: "Oversized Obsidian Hoodie", price: 1200, category: "hoodies", image: "https://images.unsplash.com/photo-1556821840-3a63f95609a7?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80", badge: "New", sizes: ["S", "M", "L", "XL"] },
  { id: "dune-graphic-tee", name: "Dune Graphic Tee", price: 650, category: "tees", image: "https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80", badge: "", sizes: ["S", "M", "L", "XL"] },
  { id: "pharaoh-bomber-jacket", name: "Pharaoh Bomber Jacket", price: 2400, category: "outerwear", image: "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80", badge: "Limited", sizes: ["S", "M", "L", "XL"] },
  { id: "anubis-crewneck", name: "Anubis Crewneck Sweater", price: 1800, category: "hoodies", image: "https://images.unsplash.com/photo-1576871337632-b9aef4c17ab9?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80", badge: "", sizes: ["S", "M", "L", "XL"] },
  { id: "sphinx-ls-tee", name: "Sphinx Long Sleeve Tee", price: 850, category: "tees", image: "https://images.unsplash.com/photo-1618354691373-d851c5c3a990?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80", badge: "New", sizes: ["S", "M", "L", "XL"] },
  { id: "horus-vest", name: "Horus Puffer Vest", price: 2100, category: "outerwear", image: "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80", badge: "Limited", sizes: ["S", "M", "L", "XL"] },
];

// ─── DOM refs ──────────────────────────────────────────────────────────────
const dropZone = document.getElementById('drop-zone');
const photoInput = document.getElementById('photo-input');
const photoPreview = document.getElementById('photo-preview');
const productGrid = document.getElementById('tryon-products');
const aiBtn = document.getElementById('ai-tryon-btn');
const aiStatus = document.getElementById('ai-status');
const resultContainer = document.getElementById('result-container');
const resultImage = document.getElementById('result-image');
const downloadResultBtn = document.getElementById('download-result');
const retryBtn = document.getElementById('retry-btn');

// ─── Helpers ──────────────────────────────────────────────────────────────
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function sampleBgColor(img) {
  const c = document.createElement("canvas");
  c.width = img.width; c.height = img.height;
  const ctx = c.getContext("2d");
  ctx.drawImage(img, 0, 0);
  const d = ctx.getImageData(0, 0, img.width, img.height).data;
  const { width: w, height: h } = img;
  const sd = Math.min(10, Math.floor(Math.min(w, h) / 4));
  let r = 0, g = 0, b = 0, n = 0;
  const add = (i) => { r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; };
  for (let y = 0; y < sd; y++) for (let x = 0; x < w; x++) add((y * w + x) * 4);
  for (let y = h - sd; y < h; y++) for (let x = 0; x < w; x++) add((y * w + x) * 4);
  for (let x = 0; x < sd; x++) for (let y = sd; y < h - sd; y++) add((y * w + x) * 4);
  for (let x = w - sd; x < w; x++) for (let y = sd; y < h - sd; y++) add((y * w + x) * 4);
  const avgR = r / n, avgG = g / n, avgB = b / n;
  let v = 0;
  for (let i = 0; i < n; i++) {
    const idx = i * 4;
    const dr = d[idx] - avgR, dg = d[idx + 1] - avgG, db = d[idx + 2] - avgB;
    v += dr * dr + dg * dg + db * db;
  }
  return { r: avgR, g: avgG, b: avgB, threshold: Math.sqrt(v / n) * 3 + 30 };
}

// Chroma key: replace original photo's background color with wardrobe scene
async function compositeOnWardrobe(personDataUrl, resultBlob) {
  if (!wardrobeBgImg) return resultBlob;
  const [personImg, resultImg] = await Promise.all([
    loadImage(personDataUrl),
    loadImage(URL.createObjectURL(resultBlob)),
  ]);
  const bgColor = sampleBgColor(personImg);
  const canvas = document.createElement("canvas");
  canvas.width = resultImg.width; canvas.height = resultImg.height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(wardrobeBgImg, 0, 0, canvas.width, canvas.height);
  const rc = document.createElement("canvas");
  rc.width = resultImg.width; rc.height = resultImg.height;
  const rctx = rc.getContext("2d");
  rctx.drawImage(resultImg, 0, 0);
  const rd = rctx.getImageData(0, 0, resultImg.width, resultImg.height);
  const px = rd.data;
  const th = bgColor.threshold, thLo = th * 0.5;
  for (let i = 0; i < px.length; i += 4) {
    const dr = px[i] - bgColor.r, dg = px[i + 1] - bgColor.g, db = px[i + 2] - bgColor.b;
    const dist = Math.sqrt(dr * dr + dg * dg + db * db);
    if (dist < thLo) px[i + 3] = 0;
    else if (dist < th) px[i + 3] = Math.round(((dist - thLo) / (th - thLo)) * 255);
  }
  rctx.putImageData(rd, 0, 0);
  ctx.drawImage(rc, 0, 0);
  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}

// Composite: wardrobe bg + AI person (garment via mask, rest from AI, gray bg → wardrobe)
async function compositePreserveBg(personDataUrl, resultUri, maskUri) {
  const [resultImg, maskImg, bgImg] = await Promise.all([
    loadImage(resultUri),
    maskUri ? loadImage(maskUri) : null,
    wardrobeBgImg || loadImage(WARDROBE_BG),
  ]);

  const w = resultImg.width, h = resultImg.height;
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d");

  // Wardrobe background
  ctx.drawImage(bgImg, 0, 0, w, h);

  // AI result pixel data
  const rc = document.createElement("canvas");
  rc.width = w; rc.height = h;
  const rctx = rc.getContext("2d");
  rctx.drawImage(resultImg, 0, 0, w, h);
  const rData = rctx.getImageData(0, 0, w, h);

  // Wardrobe pixel data
  const wData = ctx.getImageData(0, 0, w, h);

  // Mask data
  let mData = null;
  if (maskImg) {
    const mc = document.createElement("canvas");
    mc.width = w; mc.height = h;
    const mctx = mc.getContext("2d");
    mctx.drawImage(maskImg, 0, 0, w, h);
    mData = mctx.getImageData(0, 0, w, h);
  }

  const GRAY_THRESHOLD = 50; // max distance from (128,128,128) for background detection

  for (let i = 0; i < rData.data.length; i += 4) {
    const r = rData.data[i], g = rData.data[i + 1], b = rData.data[i + 2];

    // Check mask first
    const isMasked = mData && mData.data[i + 3] > 30;

    if (isMasked) {
      // Clothing area → AI result (wrinkles, realistic draping)
      wData.data[i] = r;
      wData.data[i + 1] = g;
      wData.data[i + 2] = b;
      wData.data[i + 3] = 255;
    } else {
      // Check if this is AI's gray background
      const dr = r - 128, dg = g - 128, db = b - 128;
      const dist = Math.sqrt(dr * dr + dg * dg + db * db);
      if (dist > GRAY_THRESHOLD) {
        // Not background → part of person (face, skin, hair preserved by AI)
        wData.data[i] = r;
        wData.data[i + 1] = g;
        wData.data[i + 2] = b;
        wData.data[i + 3] = 255;
      }
      // else: background → leave wardrobe pixel as-is
    }
  }

  ctx.putImageData(wData, 0, 0);
  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}

function showResult(imgUrl) {
  if (aiResultUrl && aiResultUrl.startsWith('blob:')) URL.revokeObjectURL(aiResultUrl);
  aiResultUrl = imgUrl;
  resultImage.src = aiResultUrl;
  resultContainer.classList.remove('hidden');
  aiStatus.querySelector('.ai-status-text').textContent = 'AI Try-On complete!';
  aiStatus.querySelector('.ai-status-icon').innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2a7d4f" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>';
  aiStatus.classList.add('success');
  aiBtn.disabled = false;
}

function showError(msg) {
  aiStatus.querySelector('.ai-status-text').innerHTML = `AI Try-On failed: <strong>${msg}</strong>`;
  aiStatus.querySelector('.ai-status-icon').innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>';
  aiStatus.classList.add('error');
  aiBtn.disabled = false;
}

// ─── Init ─────────────────────────────────────────────────────────────────
function renderProducts(products) {
  productGrid.innerHTML = '';
  products.forEach((p, i) => {
    const card = document.createElement('div');
    card.className = 'tryon-product-card';
    card.dataset.productId = p.id;
    card.style.transitionDelay = `${i * 0.05}s`;
    card.innerHTML = `
      <div class="tryon-product-img-wrapper"><img src="${p.image}" alt="${p.name}" loading="lazy"></div>
      <div class="tryon-product-info">
        <div class="tryon-product-name">${p.name}</div>
        <div class="tryon-product-price">EGP ${p.price.toLocaleString()}</div>
      </div>`;
    card.addEventListener('click', () => {
      document.querySelectorAll('.tryon-product-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      selectedProduct = p;
      aiBtn.disabled = !userPhoto;
    });
    productGrid.appendChild(card);
  });
}

function handlePhoto(file) {
  if (!file || !file.type.startsWith('image/')) return;
  userPhotoFile = file;
  const reader = new FileReader();
  reader.onload = (e) => {
    userPhoto = e.target.result;
    dropZone.classList.add('has-photo');
    photoPreview.src = e.target.result;
    photoPreview.classList.remove('hidden');
    dropZone.querySelector('.drop-zone-content').classList.add('hidden');
    if (selectedProduct) aiBtn.disabled = false;
  };
  reader.readAsDataURL(file);
}

dropZone.addEventListener('click', () => photoInput.click());
photoInput.addEventListener('change', (e) => { if (e.target.files?.[0]) handlePhoto(e.target.files[0]); });
dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
dropZone.addEventListener('drop', (e) => {
  e.preventDefault(); dropZone.classList.remove('dragover');
  if (e.dataTransfer.files?.[0]) handlePhoto(e.dataTransfer.files[0]);
});

// ─── Try-On ───────────────────────────────────────────────────────────────
aiBtn.addEventListener('click', async () => {
  if (!userPhotoFile || !selectedProduct) return;
  aiBtn.disabled = true;
  aiStatus.classList.remove('hidden', 'error', 'success');
  aiStatus.querySelector('.ai-status-text').textContent = 'Processing AI Try-On...';
  aiStatus.querySelector('.ai-status-icon').innerHTML = '<div class="track-loading-spinner"></div>';
  aiStatus.className = 'ai-status';

  const formData = new FormData();
  formData.append('person', userPhotoFile, 'person.png');
  // Send the garment as a file AND as a URL so the backend has both options
  formData.append('garment_url', selectedProduct.image);
  const garmentResp = await fetch(selectedProduct.image);
  const garmentBlob = await garmentResp.blob();
  formData.append('garment', garmentBlob, 'garment.png');
  formData.append('garment_type', selectedProduct.category === 'tees' || selectedProduct.category === 'hoodies' || selectedProduct.category === 'outerwear' ? 'upper_body' : 'upper_body');

  try {
    const res = await fetch('/api/tryon', { method: 'POST', body: formData });
    if (res.ok) {
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await res.json();
        aiStatus.querySelector('.ai-status-text').textContent = 'Compositing result...';
        const finalBlob = await compositePreserveBg(userPhoto, data.result, data.mask);
        showResult(URL.createObjectURL(finalBlob));
      } else {
        const blob = await res.blob();
        showResult(URL.createObjectURL(blob));
      }
    } else {
      const data = await res.json().catch(() => ({ error: 'Unknown server error' }));
      throw new Error(data.error || 'Server error');
    }
  } catch (err) {
    showError(err.message);
  }
});

downloadResultBtn.addEventListener('click', () => {
  if (aiResultUrl) {
    const link = document.createElement('a');
    link.href = aiResultUrl;
    link.download = 'threadz-ai-tryon.png';
    link.click();
  }
});

retryBtn.addEventListener('click', () => {
  resultContainer.classList.add('hidden');
  if (aiResultUrl && aiResultUrl.startsWith('blob:')) URL.revokeObjectURL(aiResultUrl);
  aiResultUrl = null;
  aiStatus.className = 'ai-status hidden';
});

async function init() {
  try {
    const res = await fetch('/api/products');
    const data = await res.json();
    if (data.success && data.products.length > 0) allProducts = data.products;
  } catch { /* fallback to static list */ }
  renderProducts(allProducts.length > 0 ? allProducts : TRYON_PRODUCTS);
}

document.addEventListener('DOMContentLoaded', init);
