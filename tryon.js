(function () {
  'use strict';

  // ─── State ─────────────────────────────────────────────────────────────────
  let userPhoto = null;
  let userPhotoFile = null;
  let selectedProduct = null;
  let allProducts = [];
  let aiResultUrl = null;

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
  function blobToDataURL(blob) {
    return new Promise((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.readAsDataURL(blob);
    });
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

  // ─── Composite user photo + garment for Puter input ────────────────────────
  async function compositeForPuter(personBlob, garmentBlob) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    const [personImg, garmentImg] = await Promise.all([
      new Promise((res, rej) => { const i = new Image(); i.onload = () => { URL.revokeObjectURL(i.src); res(i); }; i.onerror = rej; i.src = URL.createObjectURL(personBlob); }),
      new Promise((res, rej) => { const i = new Image(); i.onload = () => { URL.revokeObjectURL(i.src); res(i); }; i.onerror = rej; i.src = URL.createObjectURL(garmentBlob); }),
    ]);

    const w = 768, h = 1024;
    canvas.width = w;
    canvas.height = h;

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);

    const pScale = Math.max(w / personImg.width, h / personImg.height);
    ctx.drawImage(personImg, (w - personImg.width * pScale) / 2, (h - personImg.height * pScale) / 2, personImg.width * pScale, personImg.height * pScale);

    const insetSize = 200;
    const ix = w - insetSize - 16, iy = h - insetSize - 16;
    ctx.shadowColor = 'rgba(0,0,0,0.7)';
    ctx.shadowBlur = 24;
    ctx.drawImage(garmentImg, ix, iy, insetSize, insetSize);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#c9a84c';
    ctx.lineWidth = 2;
    ctx.strokeRect(ix, iy, insetSize, insetSize);

    return new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.92));
  }

  // ─── Puter.js Try-On ───────────────────────────────────────────────────────
  async function generateWithPuter(personBlob, product) {
    if (typeof puter === 'undefined') throw new Error('Puter.js not loaded. Please refresh and try again.');

    const garmentResp = await fetch(product.image);
    if (!garmentResp.ok) throw new Error('Failed to load product image');
    const garmentBlob = await garmentResp.blob();

    const compositeBlob = await compositeForPuter(personBlob, garmentBlob);
    const dataUrl = await blobToDataURL(compositeBlob);

    const prompt = `You are a virtual try-on assistant. The person in this image needs to wear the garment shown in the bottom-right corner (${product.name}). Generate a photorealistic image of the person wearing this garment naturally. Follow these rules exactly: Keep the person's face, hair, skin tone, body shape, and pose unchanged. Only replace their current clothing with the garment shown in the corner. The garment must look natural with realistic draping and texture matching the person's body. The result should look like a real photo.`;

    const img = await puter.ai.txt2img(prompt, {
      model: "google/gemini-3-pro-image-preview",
      input_image: dataUrl.split(',')[1],
      input_image_mime_type: "image/jpeg",
    });

    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || 1024;
    canvas.height = img.naturalHeight || 1024;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    return new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.92));
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

  // ─── Generate ──────────────────────────────────────────────────────────────
  aiBtn.addEventListener('click', async () => {
    if (!userPhotoFile || !selectedProduct) return;
    aiBtn.disabled = true;
    aiStatus.classList.remove('hidden', 'error', 'success');
    aiStatus.querySelector('.ai-status-text').textContent = 'Nano Banana AI is generating your try-on...';
    aiStatus.querySelector('.ai-status-icon').innerHTML = '<div class="track-loading-spinner"></div>';
    aiStatus.className = 'ai-status';

    try {
      const blob = await generateWithPuter(userPhotoFile, selectedProduct);
      showResult(URL.createObjectURL(blob));
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
    } catch {}
    renderProducts(allProducts.length > 0 ? allProducts : TRYON_PRODUCTS);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
