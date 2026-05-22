// Sticky Navigation
const navbar = document.getElementById('navbar');

window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
        navbar.classList.add('scrolled');
    } else {
        navbar.classList.remove('scrolled');
    }
});

// Scroll Reveal Animations
const revealElements = document.querySelectorAll('.fade-in-up');

const revealOptions = {
    threshold: 0.15,
    rootMargin: "0px 0px -50px 0px"
};

const revealObserver = new IntersectionObserver(function(entries, observer) {
    entries.forEach(entry => {
        if (!entry.isIntersecting) {
            return;
        } else {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
        }
    });
}, revealOptions);

revealElements.forEach(el => {
    revealObserver.observe(el);
});

// Trigger initial visible elements on load
window.addEventListener('load', () => {
    // The entrance animation is now handled by animation.js
    // It will add the 'entering' class to body which will reveal the store content
    
    // Once store content is visible, ensure hero content animates in
    setTimeout(() => {
        const heroContent = document.querySelector('.hero-content');
        if(heroContent) heroContent.classList.add('visible');
    }, 4500); // Trigger after the 3D animation finishes and fade-in starts
});

// Cart Interaction — localStorage-backed via cart-data.js
const addButtons = document.querySelectorAll('.quick-add');
const cartCountElement = document.querySelector('.cart-count');
const cartBtn = document.querySelector('.cart-btn');

addButtons.forEach(button => {
    button.addEventListener('click', function(e) {
        e.preventDefault();
        
        // Visual feedback on button
        const originalText = this.innerText;
        this.innerText = 'Added!';
        this.style.backgroundColor = 'var(--gold)';
        this.style.color = 'var(--bg-dark)';
        
        // Gather product info from the card
        const card = this.closest('.product-card');
        const name = card ? card.querySelector('.product-info h3')?.textContent || 'Product' : 'Product';
        const priceText = card ? card.querySelector('.price')?.textContent || '0' : '0';
        const price = parseInt(priceText.replace(/[^0-9]/g, ''), 10) || 0;
        const imgEl = card ? card.querySelector('.product-img') : null;
        const image = imgEl ? imgEl.src : '';
        // Create a simple ID from the name
        const id = name.toLowerCase().replace(/\s+/g, '-');
        
        // Add to localStorage cart (uses cart-data.js if loaded)
        if (typeof addToCart === 'function') {
            addToCart({ id, name, price, image });
        }
        
        if (cartBtn && cartCountElement) {
            // Create flying dot
            const dot = document.createElement('div');
            dot.classList.add('flying-dot');
            document.body.appendChild(dot);
            
            const btnRect = this.getBoundingClientRect();
            const cartRect = cartBtn.getBoundingClientRect();
            
            // Start position
            dot.style.left = (btnRect.left + btnRect.width / 2 - 10) + 'px';
            dot.style.top = (btnRect.top + btnRect.height / 2 - 10) + 'px';
            
            // Force reflow
            void dot.offsetWidth;
            
            // End position
            dot.style.left = (cartRect.left + cartRect.width / 2 - 10) + 'px';
            dot.style.top = (cartRect.top + cartRect.height / 2 - 10) + 'px';
            dot.style.transform = 'scale(0.2)';
            dot.style.opacity = '0.5';
            
            setTimeout(() => {
                dot.remove();
                
                // Update cart counter from localStorage
                const count = typeof getCartCount === 'function' ? getCartCount() : 0;
                cartCountElement.innerText = count;
                
                // Animate cart icon
                cartBtn.classList.remove('cart-animating');
                cartCountElement.classList.remove('cart-count-animating');
                void cartBtn.offsetWidth;
                cartBtn.classList.add('cart-animating');
                cartCountElement.classList.add('cart-count-animating');
                
            }, 600);
        } else if (cartCountElement) {
            const count = typeof getCartCount === 'function' ? getCartCount() : 0;
            cartCountElement.innerText = count;
        }
        
        // Reset button
        setTimeout(() => {
            this.innerText = originalText;
            this.style.backgroundColor = '';
            this.style.color = '';
        }, 2000);
    });
});

// Cart icon fly-out on click (navigate to cart.html)
if (cartBtn) {
    cartBtn.addEventListener('click', function(e) {
        if (!e.isTrusted) return;
        const href = this.getAttribute('href');
        // Don't animate if already on the cart page
        if (window.location.pathname.endsWith(href)) return;
        e.preventDefault();
        this.classList.add('cart-btn-flyout');
        setTimeout(() => {
            window.location.href = href;
        }, 500);
    });
}

// Mobile menu toggle
const mobileBtn = document.querySelector('.mobile-menu-btn');
const mobileMenuClose = document.getElementById('mobile-menu-close');
const mobileMenuOverlay = document.getElementById('mobile-menu-overlay');
const mobileMenuPanel = document.getElementById('mobile-menu-panel');

function toggleMobileMenu() {
    mobileMenuOverlay.classList.toggle('active');
    mobileMenuPanel.classList.toggle('active');
    document.body.classList.toggle('menu-open');
    if (document.body.classList.contains('menu-open')) {
        document.body.style.overflow = 'hidden';
    } else {
        document.body.style.overflow = '';
    }
}

if (mobileBtn && mobileMenuOverlay && mobileMenuPanel) {
    mobileBtn.addEventListener('click', toggleMobileMenu);
    mobileMenuClose.addEventListener('click', toggleMobileMenu);
    mobileMenuOverlay.addEventListener('click', toggleMobileMenu);
}

// Internal navigation detection — set flag when clicking links to homepage
document.addEventListener('click', (e) => {
    const link = e.target.closest('a');
    if (!link) return;
    try {
        const url = new URL(link.getAttribute('href') || '', window.location.href);
        const normalize = (p) => p.replace(/\/index\.html$/, '').replace(/\/$/, '') || '/';
        const current = normalize(window.location.pathname);
        const target = normalize(url.pathname);
        if (target === '/' && current !== '/') {
            sessionStorage.setItem('threadz_internal_nav', '1');
        }
    } catch (_) {}
});

// ── Custom Cursor ──────────────────────────────────────────
(function() {
    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) return;

    const cursor = document.createElement('div');
    cursor.className = 'threadz-cursor';
    cursor.innerHTML = `<svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="16" cy="16" r="9" stroke="rgba(245,217,140,0.5)" stroke-width="1.2"/>
        <circle cx="16" cy="16" r="2" fill="rgba(245,217,140,0.7)"/>
        <circle cx="16" cy="16" r="9" stroke="rgba(255,255,255,0.15)" stroke-width="2.5"/>
    </svg>`;
    document.body.appendChild(cursor);

    let visible = false;
    document.addEventListener('mousemove', (e) => {
        cursor.style.left = e.clientX + 'px';
        cursor.style.top = e.clientY + 'px';
        if (!visible) { visible = true; cursor.classList.add('visible'); }
    });
    document.addEventListener('mouseleave', () => {
        visible = false; cursor.classList.remove('visible');
    });
    document.body.classList.add('custom-cursor');
})();

// ── Prevent Right-Click ────────────────────────────────────
document.addEventListener('contextmenu', (e) => e.preventDefault());
