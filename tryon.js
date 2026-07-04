let userPhoto = null;
let userPhotoFile = null;
let selectedProduct = null;
let allProducts = [];
let tryOnMode = 'ai';
let aiResultUrl = null;

const TRYON_PRODUCTS = [
  { id: "oversized-obsidian-hoodie", name: "Oversized Obsidian Hoodie", price: 1200, category: "hoodies", image: "https://images.unsplash.com/photo-1556821840-3a63f95609a7?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80", badge: "New", sizes: ["S", "M", "L", "XL"] },
  { id: "dune-graphic-tee", name: "Dune Graphic Tee", price: 650, category: "tees", image: "https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80", badge: "", sizes: ["S", "M", "L", "XL"] },
  { id: "pharaoh-bomber-jacket", name: "Pharaoh Bomber Jacket", price: 2400, category: "outerwear", image: "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80", badge: "Limited", sizes: ["S", "M", "L", "XL"] },
  { id: "anubis-crewneck", name: "Anubis Crewneck Sweater", price: 1800, category: "hoodies", image: "https://images.unsplash.com/photo-1576871337632-b9aef4c17ab9?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80", badge: "", sizes: ["S", "M", "L", "XL"] },
  { id: "sphinx-ls-tee", name: "Sphinx Long Sleeve Tee", price: 850, category: "tees", image: "https://images.unsplash.com/photo-1618354691373-d851c5c3a990?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80", badge: "New", sizes: ["S", "M", "L", "XL"] },
  { id: "horus-vest", name: "Horus Puffer Vest", price: 2100, category: "outerwear", image: "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80", badge: "Limited", sizes: ["S", "M", "L", "XL"] },
];

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

function selectProduct(product, card) {
  document.querySelectorAll('.tryon-product-card').forEach(c => c.classList.remove('selected'));
  if (card) card.classList.add('selected');
  selectedProduct = product;
  aiBtn.disabled = !userPhoto;
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

aiBtn.addEventListener('click', async () => {
  if (!userPhotoFile || !selectedProduct) return;
  aiBtn.disabled = true;
  aiStatus.classList.remove('hidden', 'error', 'success');
  aiStatus.querySelector('.ai-status-text').textContent = 'Processing your try-on...';
  aiStatus.querySelector('.ai-status-icon').innerHTML = '<div class="track-loading-spinner"></div>';
  aiStatus.className = 'ai-status';

  const formData = new FormData();
  formData.append('person', userPhotoFile, 'person.png');
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
    aiStatus.querySelector('.ai-status-text').innerHTML = `AI Try-On failed: <strong>${err.message}</strong>`;
    aiStatus.querySelector('.ai-status-icon').innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>';
    aiStatus.classList.add('error');
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

async function init() {
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
