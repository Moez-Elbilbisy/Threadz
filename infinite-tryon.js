(function () {
  'use strict';

  // ─── Stock Model Photos (diverse, full-body, free from Unsplash) ─────
  const MODELS = [
    "https://images.unsplash.com/photo-1598387181032-a3103a2db5b3?w=600&q=80",
    "https://images.unsplash.com/photo-1602233158242-34e9b4a2bf4f?w=600&q=80",
    "https://images.unsplash.com/photo-1583394838336-acd977736f90?w=600&q=80",
    "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600&q=80",
    "https://images.unsplash.com/photo-1552374196-1ab2a1c593e8?w=600&q=80",
    "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=600&q=80",
    "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&q=80",
    "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=600&q=80",
    "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=600&q=80",
    "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=600&q=80",
    "https://images.unsplash.com/photo-1520085601670-ee14aa5fa3e8?w=600&q=80",
    "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&q=80",
  ];

  // ─── Fallback Products (mirrors tryon.js) ────────────────────────────
  const TRYON_PRODUCTS = [
    { id: "oversized-obsidian-hoodie", name: "Oversized Obsidian Hoodie", price: 1200, category: "hoodies", image: "https://images.unsplash.com/photo-1556821840-3a63f95609a7?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80", badge: "New", sizes: ["S","M","L","XL"] },
    { id: "dune-graphic-tee", name: "Dune Graphic Tee", price: 650, category: "tees", image: "https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80", badge: "", sizes: ["S","M","L","XL"] },
    { id: "pharaoh-bomber-jacket", name: "Pharaoh Bomber Jacket", price: 2400, category: "outerwear", image: "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80", badge: "Limited", sizes: ["S","M","L","XL"] },
    { id: "anubis-crewneck", name: "Anubis Crewneck Sweater", price: 1800, category: "hoodies", image: "https://images.unsplash.com/photo-1576871337632-b9aef4c17ab9?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80", badge: "", sizes: ["S","M","L","XL"] },
    { id: "sphinx-ls-tee", name: "Sphinx Long Sleeve Tee", price: 850, category: "tees", image: "https://images.unsplash.com/photo-1618354691373-d851c5c3a990?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80", badge: "New", sizes: ["S","M","L","XL"] },
    { id: "horus-vest", name: "Horus Puffer Vest", price: 2100, category: "outerwear", image: "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80", badge: "Limited", sizes: ["S","M","L","XL"] },
  ];

  // ─── State ───────────────────────────────────────────────────────────
  const feed = document.getElementById('infinite-feed');
  const statusEl = document.getElementById('feed-status');
  const resultCache = new Map();
  const modelBlobCache = new Map();
  const cardQueue = [];
  let products = [];
  let isGenerating = false;
  let generationCount = 0;
  let activeCardIndex = 0;
  let likedItems = [];

  try {
    const stored = localStorage.getItem('threadz_liked_tryon');
    if (stored) likedItems = JSON.parse(stored);
  } catch {}

  // ─── Helpers ─────────────────────────────────────────────────────────
  function cacheKey(modelIdx, productId) {
    return `${modelIdx}:${productId}`;
  }

  function saveLikes() {
    localStorage.setItem('threadz_liked_tryon', JSON.stringify(likedItems));
  }

  function isLiked(modelIdx, productId) {
    return likedItems.includes(cacheKey(modelIdx, productId));
  }

  function toggleLike(modelIdx, productId) {
    const key = cacheKey(modelIdx, productId);
    const idx = likedItems.indexOf(key);
    if (idx > -1) {
      likedItems.splice(idx, 1);
      return false;
    } else {
      likedItems.push(key);
      return true;
    }
  }

  // ─── Card HTML builder ──────────────────────────────────────────────
  function createCardHTML(data) {
    const { modelIdx, product, cacheKey: ck } = data;
    const liked = isLiked(modelIdx, product.id);
    const div = document.createElement('div');
    div.className = 'feed-card';
    div.dataset.modelIdx = modelIdx;
    div.dataset.productId = product.id;
    div.dataset.cacheKey = ck;

    // Shimmer
    const shimmer = document.createElement('div');
    shimmer.className = 'feed-card-shimmer';
    shimmer.innerHTML = `<div class="feed-card-shimmer-inner">
      <div class="feed-card-shimmer-line"></div>
      <div class="feed-card-shimmer-line"></div>
    </div>`;
    div.appendChild(shimmer);

    // Overlay (always show)
    const overlay = document.createElement('div');
    overlay.className = 'feed-card-overlay';
    overlay.style.opacity = '0';
    overlay.innerHTML = `
      <div class="feed-card-product">${product.name}</div>
      <div class="feed-card-price">EGP ${product.price.toLocaleString()}</div>
      <div class="feed-card-actions">
        <a href="shop.html?product=${product.id}" class="feed-card-btn feed-card-btn-primary">Shop Now</a>
        <a href="tryon.html?product=${product.id}" class="feed-card-btn">Try On Yourself</a>
      </div>
      <div class="feed-card-model-label">AI-Generated Try-On</div>
    `;
    div.appendChild(overlay);

    // Side buttons
    const side = document.createElement('div');
    side.className = 'feed-card-side';
    side.innerHTML = `
      <button class="feed-card-side-btn like-btn${liked ? ' liked' : ''}" aria-label="Like">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="${liked ? '#ff3040' : 'none'}" stroke="${liked ? '#ff3040' : 'currentColor'}" stroke-width="2">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
        </svg>
      </button>
      <span class="feed-card-side-label">${liked ? 'Liked' : ''}</span>
    `;
    div.appendChild(side);

    return div;
  }

  // ─── Fetch helpers ──────────────────────────────────────────────────
  async function fetchBlobCached(url, cache) {
    if (cache.has(url)) return cache.get(url);
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`Failed to fetch ${url}`);
    const blob = await resp.blob();
    cache.set(url, blob);
    return blob;
  }

  function blobToDataURL(blob) {
    return new Promise((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.readAsDataURL(blob);
    });
  }

  // ─── Server-side API Try-On ──────────────────────────────────────────
  async function generateViaServer(modelUrl, product) {
    const [personBlob, garmentBlob] = await Promise.all([
      fetchBlobCached(modelUrl, modelBlobCache),
      fetchBlobCached(product.image, modelBlobCache),
    ]);

    const formData = new FormData();
    formData.append('person', personBlob, 'person.png');
    formData.append('garment', garmentBlob, 'garment.png');
    formData.append('garment_url', product.image);
    const garmentType = product.category === 'tees' || product.category === 'hoodies' || product.category === 'outerwear' ? 'upper_body' : 'upper_body';
    formData.append('garment_type', garmentType);

    const res = await fetch('/api/tryon', { method: 'POST', body: formData });
    if (!res.ok) {
      let errMsg = 'Server error';
      try { const d = await res.json(); errMsg = d.error || errMsg; } catch {}
      throw new Error(errMsg);
    }

    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await res.json();
      const imgRes = await fetch(data.result);
      if (!imgRes.ok) throw new Error('Failed to fetch result image');
      return await imgRes.blob();
    }

    return await res.blob();
  }

  // ─── Puter.js Client-Side Try-On (Nano Banana / Gemini) ─────────────
  async function generateViaPuter(modelUrl, product) {
    if (typeof puter === 'undefined') throw new Error('Puter.js not loaded');

    const [personBlob, garmentBlob] = await Promise.all([
      fetchBlobCached(modelUrl, modelBlobCache),
      fetchBlobCached(product.image, modelBlobCache),
    ]);

    // Composite person + garment into one image
    const compositeBlob = await compositePersonAndGarment(personBlob, garmentBlob, product.name);
    const dataUrl = await blobToDataURL(compositeBlob);

    const prompt = `You are a virtual try-on assistant. The person in this image needs to wear the garment shown in the bottom-right corner (${product.name}). Generate a photorealistic image of the person wearing this garment naturally. Follow these rules exactly: Keep the person's face, hair, skin tone, body shape, and pose unchanged. Only replace their current clothing with the garment shown in the corner. The garment must look natural with realistic draping and texture matching the person's body. The result should look like a real photo.`;

    const img = await puter.ai.txt2img(prompt, {
      model: "google/gemini-3-pro-image-preview",
      input_image: dataUrl.split(',')[1],
      input_image_mime_type: "image/jpeg",
    });

    // puter.ai.txt2img returns an Image element
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || 1024;
    canvas.height = img.naturalHeight || 1024;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    return new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.92));
  }

  async function compositePersonAndGarment(personBlob, garmentBlob, productName) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    const [personImg, garmentImg] = await Promise.all([
      new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(personBlob); }),
      new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(garmentBlob); }),
    ]);

    const w = 768, h = 1024;
    canvas.width = w;
    canvas.height = h;

    // Fill background
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);

    // Draw person (cover frame)
    const pScale = Math.max(w / personImg.width, h / personImg.height);
    const pw = personImg.width * pScale;
    const ph = personImg.height * pScale;
    ctx.drawImage(personImg, (w - pw) / 2, (h - ph) / 2, pw, ph);

    // Draw garment thumbnail bottom-right
    const insetSize = 200;
    const ix = w - insetSize - 16;
    const iy = h - insetSize - 16;
    ctx.shadowColor = 'rgba(0,0,0,0.7)';
    ctx.shadowBlur = 24;
    ctx.drawImage(garmentImg, ix, iy, insetSize, insetSize);
    ctx.shadowBlur = 0;

    // Gold border around inset
    ctx.strokeStyle = '#c9a84c';
    ctx.lineWidth = 2;
    ctx.strokeRect(ix, iy, insetSize, insetSize);

    URL.revokeObjectURL(personImg.src);
    URL.revokeObjectURL(garmentImg.src);

    return new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.92));
  }

  // ─── Try-On orchestrator (tries server → puter → canvas fallback) ────
  async function generateTryOn(modelUrl, product) {
    let lastError;

    // Try server API
    try {
      return await generateViaServer(modelUrl, product);
    } catch (err) {
      lastError = err;
    }

    // Try Puter.js client-side
    try {
      return await generateViaPuter(modelUrl, product);
    } catch (err) {
      lastError = err;
    }

    // Final fallback: canvas composite
    return await generateFallbackImage(modelUrl, product, lastError);
  }

  // ─── Generate fallback image (composite model + product) ─────────────
  async function generateFallbackImage(modelUrl, product, err = null) {
    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 800;
    const ctx = canvas.getContext('2d');

    // Background
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, 600, 800);

    try {
      const [modelImg, productImg] = await Promise.all([
        new Promise((res, rej) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => res(i); i.onerror = rej; i.src = modelUrl; }),
        new Promise((res, rej) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => res(i); i.onerror = rej; i.src = product.image; }),
      ]);

      // Draw model (full width, centered)
      const mScale = Math.max(600 / modelImg.width, 800 / modelImg.height);
      const mw = modelImg.width * mScale;
      const mh = modelImg.height * mScale;
      ctx.drawImage(modelImg, (600 - mw) / 2, (800 - mh) / 2, mw, mh);

      // Draw product overlay (bottom-right, smaller)
      const pSize = 180;
      const px = 600 - pSize - 20;
      const py = 800 - pSize - 20;
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = 20;
      ctx.drawImage(productImg, px, py, pSize, pSize);
      ctx.shadowBlur = 0;

      // Border around product
      ctx.strokeStyle = '#c9a84c';
      ctx.lineWidth = 2;
      ctx.strokeRect(px, py, pSize, pSize);

      // Label
      ctx.fillStyle = '#c9a84c';
      ctx.font = '12px Outfit, sans-serif';
      ctx.fillText('AI TRY-ON', px, py - 6);

    } catch {}

    return new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.9));
  }

  // ─── Process card queue ──────────────────────────────────────────────
  async function processQueue() {
    if (isGenerating) return;
    isGenerating = true;
    updateStatus();

    while (cardQueue.length > 0 && cardQueue[0].status === 'pending') {
      const item = cardQueue[0];
      item.status = 'generating';
      updateStatus();

      try {
        let blob = await generateTryOn(item.modelUrl, item.product);
        const url = URL.createObjectURL(blob);
        resultCache.set(item.cacheKey, url);
        item.status = 'done';
        item.resultUrl = url;

        // Update card DOM
        const cardEl = document.querySelector(`.feed-card[data-cache-key="${item.cacheKey}"]`);
        if (cardEl) {
          const existing = cardEl.querySelector('.feed-card-image');
          if (existing) existing.remove();
          const img = document.createElement('img');
          img.className = 'feed-card-image';
          img.src = url;
          img.alt = `${item.product.name} AI Try-On`;
          img.loading = 'lazy';
          cardEl.insertBefore(img, cardEl.querySelector('.feed-card-overlay'));
          const shimmer = cardEl.querySelector('.feed-card-shimmer');
          if (shimmer) shimmer.remove();
          const overlay = cardEl.querySelector('.feed-card-overlay');
          if (overlay) overlay.style.opacity = '1';
        }
        generationCount++;
        updateStatus();
      } catch (err) {
        item.status = 'failed';
        item.error = err.message;
        // Remove failed card
        const cardEl = document.querySelector(`.feed-card[data-cache-key="${item.cacheKey}"]`);
        if (cardEl) cardEl.remove();
      }

      cardQueue.shift();
    }

    isGenerating = false;
    updateStatus();
  }

  function updateStatus() {
    const pending = cardQueue.filter(i => i.status === 'pending').length;
    const generating = cardQueue.filter(i => i.status === 'generating').length;
    if (generating > 0) {
      statusEl.textContent = `Generating try-on... (${generationCount} done)`;
    } else if (pending > 0) {
      statusEl.textContent = `${pending} more in queue`;
    } else {
      statusEl.textContent = '';
    }
  }

  // ─── Create new card in feed ─────────────────────────────────────────
  function enqueueNextCard() {
    const usedKeys = new Set();
    cardQueue.forEach(i => usedKeys.add(i.cacheKey));
    document.querySelectorAll('.feed-card').forEach(el => usedKeys.add(el.dataset.cacheKey));

    // Find unused model+product combination
    let attempts = 0;
    while (attempts < 50) {
      const modelIdx = Math.floor(Math.random() * MODELS.length);
      const product = products[Math.floor(Math.random() * products.length)];
      const ck = cacheKey(modelIdx, product.id);
      if (!usedKeys.has(ck)) {
        const item = {
          modelIdx,
          modelUrl: MODELS[modelIdx],
          product,
          cacheKey: ck,
          status: 'pending',
          resultUrl: null,
        };
        cardQueue.push(item);

        // Create DOM card
        const cardEl = createCardHTML({ ...item });
        feed.appendChild(cardEl);
        return item;
      }
      attempts++;
    }

    // All combinations used — reshuffle and restart
    const modelIdx = Math.floor(Math.random() * MODELS.length);
    const product = products[Math.floor(Math.random() * products.length)];
    const ck = cacheKey(modelIdx, product.id) + ':' + Date.now();
    const item = {
      modelIdx,
      modelUrl: MODELS[modelIdx],
      product,
      cacheKey: ck,
      status: 'pending',
      resultUrl: null,
    };
    cardQueue.push(item);
    const cardEl = createCardHTML({ ...item });
    feed.appendChild(cardEl);
    return item;
  }

  // ─── Ensure enough cards are enqueued ───────────────────────────────
  function ensureCards() {
    const totalCards = document.querySelectorAll('.feed-card').length + cardQueue.length;
    const target = 8;
    const needed = target - totalCards;
    for (let i = 0; i < needed; i++) {
      enqueueNextCard();
    }
    if (!isGenerating) processQueue();
  }

  // ─── Scroll handler ──────────────────────────────────────────────────
  let scrollTimeout = null;
  feed.addEventListener('scroll', () => {
    const { scrollTop, clientHeight } = feed;
    const remainingCards = document.querySelectorAll('.feed-card').length - (scrollTop / clientHeight);
    if (remainingCards < 4) ensureCards();

    if (scrollTimeout) clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      const cards = feed.querySelectorAll('.feed-card');
      for (let i = 0; i < cards.length; i++) {
        const rect = cards[i].getBoundingClientRect();
        if (rect.top <= window.innerHeight * 0.5) activeCardIndex = i;
      }
    }, 150);
  });

  // ─── Like handler (event delegation) ─────────────────────────────────
  feed.addEventListener('click', (e) => {
    const likeBtn = e.target.closest('.like-btn');
    if (!likeBtn) return;

    const card = likeBtn.closest('.feed-card');
    if (!card) return;

    const modelIdx = parseInt(card.dataset.modelIdx);
    const productId = card.dataset.productId;
    const product = products.find(p => p.id === productId);
    if (!product) return;

    const nowLiked = toggleLike(modelIdx, productId);
    saveLikes();

    likeBtn.classList.toggle('liked', nowLiked);
    const svg = likeBtn.querySelector('svg');
    if (svg) {
      svg.setAttribute('fill', nowLiked ? '#ff3040' : 'none');
      svg.setAttribute('stroke', nowLiked ? '#ff3040' : 'currentColor');
    }
    const label = likeBtn.parentElement.querySelector('.feed-card-side-label');
    if (label) label.textContent = nowLiked ? 'Liked' : '';
  });

  // ─── Keyboard / Tap nav ──────────────────────────────────────────────
  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const cards = feed.querySelectorAll('.feed-card');
      const delta = e.key === 'ArrowDown' ? 1 : -1;
      const next = Math.max(0, Math.min(cards.length - 1, activeCardIndex + delta));
      if (cards[next]) cards[next].scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });

  // ─── Init ────────────────────────────────────────────────────────────
  async function init() {
    try {
      const res = await fetch('/api/products');
      const data = await res.json();
      if (data.success && data.products.length > 0) products = data.products;
    } catch {}

    if (products.length === 0) products = TRYON_PRODUCTS;
    ensureCards();
  }

  document.addEventListener('DOMContentLoaded', init);

  window.infiniteTryon = { ensureCards, products, MODELS, resultCache };
})();
