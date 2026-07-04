let userPhoto = null;
let selectedProduct = null;
let allProducts = [];
let overlayX = 0, overlayY = 0, overlayScale = 0.5, overlayRotation = 0;
let isDragging = false, dragStartX = 0, dragStartY = 0;
let dragOverlayStartX = 0, dragOverlayStartY = 0;
let tryOnMode = 'basic';
let aiResultUrl = null;

const TRYON_PRODUCTS = [
  { id: "oversized-obsidian-hoodie", name: "Oversized Obsidian Hoodie", price: 1200, category: "hoodies", image: "https://images.unsplash.com/photo-1556821840-3a63f95609a7?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80", badge: "New", sizes: ["S", "M", "L", "XL"] },
  { id: "dune-graphic-tee", name: "Dune Graphic Tee", price: 650, category: "tees", image: "https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80", badge: "", sizes: ["S", "M", "L", "XL"] },
  { id: "pharaoh-bomber-jacket", name: "Pharaoh Bomber Jacket", price: 2400, category: "outerwear", image: "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80", badge: "Limited", sizes: ["S", "M", "L", "XL"] },
  { id: "anubis-crewneck", name: "Anubis Crewneck Sweater", price: 1800, category: "hoodies", image: "https://images.unsplash.com/photo-1576871337632-b9aef4c17ab9?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80", badge: "", sizes: ["S", "M", "L", "XL"] },
  { id: "sphinx-ls-tee", name: "Sphinx Long Sleeve Tee", price: 850, category: "tees", image: "https://images.unsplash.com/photo-1618354691373-d851c5c3a990?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80", badge: "New", sizes: ["S", "M", "L", "XL"] },
  { id: "horus-vest", name: "Horus Puffer Vest", price: 2100, category: "outerwear", image: "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80", badge: "Limited", sizes: ["S", "M", "L", "XL"] },
];

const canvas = document.getElementById('tryon-canvas');
const ctx = canvas.getContext('2d');
const dropZone = document.getElementById('drop-zone');
const photoInput = document.getElementById('photo-input');
const productGrid = document.getElementById('tryon-products');
const controls = document.getElementById('overlay-controls');
const scaleSlider = document.getElementById('scale-slider');
const scaleValue = document.getElementById('scale-value');
const rotateSlider = document.getElementById('rotate-slider');
const rotateValue = document.getElementById('rotate-value');
const snapBtn = document.getElementById('snap-btn');
const modeBtns = document.querySelectorAll('.mode-btn');
const aiBtn = document.getElementById('ai-tryon-btn');
const aiStatus = document.getElementById('ai-status');
const resultContainer = document.getElementById('result-container');
const resultImage = document.getElementById('result-image');
const downloadResultBtn = document.getElementById('download-result');
const retryBtn = document.getElementById('retry-btn');
const clearBtn = document.getElementById('clear-btn');

function initCanvas() {
  const rect = canvas.parentElement.getBoundingClientRect();
  canvas.width = rect.width;
  canvas.height = rect.height;
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (userPhoto) {
    const img = userPhoto;
    const scale = Math.max(canvas.width / img.width, canvas.height / img.height);
    const x = (canvas.width - img.width * scale) / 2;
    const y = (canvas.height - img.height * scale) / 2;
    ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
    canvas.dataset.bgX = x;
    canvas.dataset.bgY = y;
    canvas.dataset.bgScale = scale;
  }
  if (selectedProduct && userPhoto && tryOnMode === 'basic') {
    drawOverlay();
  }
}

function drawOverlay() {
  const img = selectedProduct.imageObj;
  if (!img) return;
  const cx = overlayX;
  const cy = overlayY;
  const w = img.width * overlayScale;
  const h = img.height * overlayScale;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(overlayRotation * Math.PI / 180);
  ctx.globalAlpha = 0.92;
  ctx.drawImage(img, -w / 2, -h / 2, w, h);
  ctx.restore();
}

function loadProductImage(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function renderProducts(products) {
  productGrid.innerHTML = '';
  products.forEach((p, i) => {
    const card = document.createElement('div');
    card.className = 'tryon-product-card';
    card.dataset.productId = p.id;
    card.style.transitionDelay = `${i * 0.05}s`;
    card.innerHTML = `
      <div class="tryon-product-img-wrapper">
        <img src="${p.image}" alt="${p.name}" loading="lazy">
      </div>
      <div class="tryon-product-info">
        <div class="tryon-product-name">${p.name}</div>
        <div class="tryon-product-price">EGP ${p.price.toLocaleString()}</div>
      </div>
    `;
    card.addEventListener('click', () => selectProduct(p, card));
    productGrid.appendChild(card);
  });
}

async function selectProduct(product, card) {
  document.querySelectorAll('.tryon-product-card').forEach(c => c.classList.remove('selected'));
  if (card) card.classList.add('selected');
  selectedProduct = product;
  const img = await loadProductImage(product.image);
  selectedProduct.imageObj = img;
  controls.classList.remove('hidden');
  if (userPhoto) {
    overlayX = canvas.width / 2;
    overlayY = canvas.height / 2;
    overlayScale = 0.5;
    overlayRotation = 0;
    scaleSlider.value = 50;
    scaleValue.textContent = '0.5x';
    rotateSlider.value = 0;
    rotateValue.textContent = '0°';
  }
  render();
  aiBtn.disabled = false;
}

function handlePhoto(file) {
  if (!file || !file.type.startsWith('image/')) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      userPhoto = img;
      dropZone.classList.add('has-photo');
      dropZone.querySelector('.drop-zone-content').innerHTML = `
        <img src="${e.target.result}" alt="Uploaded" class="drop-zone-preview">
        <button class="change-photo-btn" id="change-photo-btn">Change Photo</button>
      `;
      document.getElementById('change-photo-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        photoInput.click();
      });
      initCanvas();
      if (selectedProduct) {
        overlayX = canvas.width / 2;
        overlayY = canvas.height / 2;
      }
      render();
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function setupDrag() {
  let isDraggingOverlay = false;
  let startMX = 0, startMY = 0;
  let startOX = 0, startOY = 0;

  function onStart(e) {
    if (!selectedProduct || !userPhoto || tryOnMode === 'ai') return;
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX || e.touches?.[0]?.clientX) - rect.left;
    const my = (e.clientY || e.touches?.[0]?.clientY) - rect.top;
    const dx = mx - overlayX;
    const dy = my - overlayY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const img = selectedProduct.imageObj;
    const maxDim = Math.max(img?.width || 200, img?.height || 200) * overlayScale / 2;
    if (dist < maxDim + 20) {
      isDraggingOverlay = true;
      startMX = mx; startMY = my;
      startOX = overlayX; startOY = overlayY;
      canvas.style.cursor = 'grabbing';
    }
  }

  function onMove(e) {
    if (!isDraggingOverlay) return;
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX || e.touches?.[0]?.clientX) - rect.left;
    const my = (e.clientY || e.touches?.[0]?.clientY) - rect.top;
    overlayX = startOX + (mx - startMX);
    overlayY = startOY + (my - startMY);
    render();
    e.preventDefault();
  }

  function onEnd() {
    isDraggingOverlay = false;
    canvas.style.cursor = 'crosshair';
  }

  canvas.addEventListener('mousedown', onStart);
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onEnd);
  canvas.addEventListener('touchstart', onStart, { passive: true });
  window.addEventListener('touchmove', onMove, { passive: false });
  window.addEventListener('touchend', onEnd);
}

dropZone.addEventListener('click', () => photoInput.click());
photoInput.addEventListener('change', (e) => {
  if (e.target.files?.[0]) handlePhoto(e.target.files[0]);
});

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('dragover');
});
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  if (e.dataTransfer.files?.[0]) handlePhoto(e.dataTransfer.files[0]);
});

scaleSlider.addEventListener('input', () => {
  overlayScale = scaleSlider.value / 100;
  scaleValue.textContent = `${overlayScale.toFixed(1)}x`;
  render();
});

rotateSlider.addEventListener('input', () => {
  overlayRotation = parseFloat(rotateSlider.value);
  rotateValue.textContent = `${overlayRotation}°`;
  render();
});

snapBtn.addEventListener('click', () => {
  const link = document.createElement('a');
  link.download = 'threadz-tryon.png';
  canvas.toBlob((blob) => {
    link.href = URL.createObjectURL(blob);
    link.click();
    URL.revokeObjectURL(link.href);
  });
});

clearBtn.addEventListener('click', () => {
  userPhoto = null;
  selectedProduct = null;
  aiResultUrl = null;
  resultContainer.classList.add('hidden');
  controls.classList.add('hidden');
  aiBtn.disabled = true;
  dropZone.classList.remove('has-photo');
  dropZone.querySelector('.drop-zone-content').innerHTML = `
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color:var(--gold);opacity:0.5;">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
      <circle cx="8.5" cy="8.5" r="1.5"></circle>
      <polyline points="21 15 16 10 5 21"></polyline>
    </svg>
    <p>Upload your photo to try on clothes</p>
    <span class="drop-zone-hint">or drag & drop</span>
  `;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  document.querySelectorAll('.tryon-product-card').forEach(c => c.classList.remove('selected'));
});

modeBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    modeBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    tryOnMode = btn.dataset.mode;
    const controlsPanel = document.querySelector('.tryon-controls-panel');
    const aiPanel = document.querySelector('.tryon-ai-panel');
    if (tryOnMode === 'basic') {
      controlsPanel.classList.remove('hidden');
      aiPanel.classList.add('hidden');
      if (selectedProduct) render();
    } else {
      controlsPanel.classList.add('hidden');
      aiPanel.classList.remove('hidden');
    }
  });
});

aiBtn.addEventListener('click', async () => {
  if (!userPhoto || !selectedProduct) return;
  aiBtn.disabled = true;
  aiStatus.classList.remove('hidden', 'error', 'success');
  aiStatus.querySelector('.ai-status-text').textContent = 'Processing your try-on...';
  aiStatus.querySelector('.ai-status-icon').innerHTML = '<div class="track-loading-spinner"></div>';
  aiStatus.className = 'ai-status';

  const formData = new FormData();
  const personBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  formData.append('person', personBlob, 'person.png');
  const garmentResp = await fetch(selectedProduct.image);
  const garmentBlob = await garmentResp.blob();
  formData.append('garment', garmentBlob, 'garment.png');

  try {
    const res = await fetch('/api/tryon', { method: 'POST', body: formData });
    const data = await res.json();
    if (data.success && data.result) {
      aiResultUrl = data.result;
      resultImage.src = aiResultUrl;
      resultContainer.classList.remove('hidden');
      aiStatus.querySelector('.ai-status-text').textContent = 'AI Try-On complete!';
      aiStatus.querySelector('.ai-status-icon').innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2a7d4f" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>';
      aiStatus.classList.add('success');
    } else {
      throw new Error(data.error || 'Try-on failed');
    }
  } catch (err) {
    aiStatus.querySelector('.ai-status-text').textContent = 'AI processing unavailable. Using Basic mode instead.';
    aiStatus.querySelector('.ai-status-icon').innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>';
    aiStatus.classList.add('error');
    tryOnMode = 'basic';
    modeBtns.forEach(b => b.classList.remove('active'));
    document.querySelector('.mode-btn[data-mode="basic"]').classList.add('active');
    document.querySelector('.tryon-controls-panel').classList.remove('hidden');
    document.querySelector('.tryon-ai-panel').classList.add('hidden');
    render();
  } finally {
    aiBtn.disabled = false;
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
  aiResultUrl = null;
  aiStatus.className = 'ai-status hidden';
});

window.addEventListener('resize', () => {
  initCanvas();
  render();
});

async function init() {
  initCanvas();
  setupDrag();
  try {
    const res = await fetch('/api/products');
    const data = await res.json();
    if (data.success && data.products.length > 0) {
      allProducts = data.products;
    }
  } catch {}
  renderProducts(allProducts.length > 0 ? allProducts : TRYON_PRODUCTS);
}

document.addEventListener('DOMContentLoaded', init);
