import re

# 1. Update index.html
with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Revert Text
html = html.replace('Bespoke Streetwear', 'Redefining Heritage')
html = html.replace('Clean lines, detailed craftsmanship, and timeless tailoring for the modern wardrobe.', 'Premium streetwear blending ancient Egyptian aesthetics with modern minimalism.')
html = html.replace('The Core Collection', 'The Obsidian Collection')
html = html.replace('Clean, minimal, and tailored with uncompromising quality.', 'Dark, mysterious, and crafted with uncompromising quality.')
html = html.replace('Essential Alabaster Hoodie', 'Oversized Obsidian Hoodie')
html = html.replace('Signature Logo Tee', 'Dune Graphic Tee')
html = html.replace('Tailored Harrington Jacket', 'Pharaoh Bomber Jacket')
html = html.replace('Tailored to Perfection.', 'Crafted in Cairo.')
html = html.replace('Every stitch tells a story of uncompromising quality.', 'Every thread tells a story of our ancestors.')

# Revert Images
html = html.replace('https://images.unsplash.com/photo-1445205170230-053b83016050?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80', 'https://images.unsplash.com/photo-1503342394128-c104d54dba01?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80')
html = html.replace('https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80', 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80')
html = html.replace('https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80', 'https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80')
html = html.replace('https://images.unsplash.com/photo-1551028719-00167b16eac5?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80', 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80')
html = html.replace('https://images.unsplash.com/photo-1490481651871-ab68de25d43d?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80', 'https://images.unsplash.com/photo-1613531393649-652a20dcce66?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80')

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(html)


# 2. Update styles.css
with open('styles.css', 'r', encoding='utf-8') as f:
    css = f.read()

css = css.replace('--bg-dark: #faf9f6;', '--bg-dark: #0a0a0b;')
css = css.replace('--bg-card: #ffffff;', '--bg-card: #121214;')
css = css.replace('--bg-card-hover: #f3f4f6;', '--bg-card-hover: #1a1a1c;')
css = css.replace('--text-primary: #1a1a1a;', '--text-primary: #ffffff;')
css = css.replace('--text-secondary: #4b5563;', '--text-secondary: #9ca3af;')
css = css.replace('--gold: #000000;', '--gold: #d4af37;')
css = css.replace('--gold-hover: #333333;', '--gold-hover: #e8c85c;')
css = css.replace('--sand: #6b7280;', '--sand: #e6d5b8;')

css = css.replace('rgba(250, 249, 246, 0.95)', 'rgba(10, 10, 11, 0.85)')
css = css.replace('rgba(0, 0, 0, 0.05)', 'rgba(255, 255, 255, 0.05)')
css = css.replace('rgba(0, 0, 0, 0.2)', 'rgba(255, 255, 255, 0.2)')
css = css.replace('rgba(0, 0, 0, 0.95)', 'rgba(255, 255, 255, 0.95)')
css = css.replace('rgba(250, 249, 246, 0.2)', 'rgba(10, 10, 11, 0.4)')
css = css.replace('rgba(250, 249, 246, 0.7)', 'rgba(10, 10, 11, 0.8)')
css = css.replace('rgba(250, 249, 246, 0.6)', 'rgba(10, 10, 11, 0.6)')
css = css.replace('rgba(250, 249, 246, 0.5)', 'rgba(10, 10, 11, 0.6)')

# Door fixes
css = css.replace('border-right: 1px solid rgba(255, 255, 255, 0.05); /* subtle dark border */', 'border-right: 1px solid rgba(212, 175, 55, 0.15);')
css = css.replace('border-left: 1px solid rgba(255, 255, 255, 0.05);', 'border-left: 1px solid rgba(212, 175, 55, 0.15);')
css = css.replace('rgba(255, 255, 255, 0.02)', 'rgba(212, 175, 55, 0.03)')

# Reverse button and badge backgrounds (which were flipped)
css = re.sub(r'\.product-badge\s*\{[^}]*\}', 
    '.product-badge { position: absolute; top: 1rem; left: 1rem; background-color: var(--bg-dark); color: var(--text-primary); font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; padding: 0.3rem 0.8rem; border-radius: 2px; z-index: 2; border: 1px solid rgba(255,255,255,0.1); }', css)

css = re.sub(r'\.quick-add\s*\{[^}]*\}',
    '.quick-add { position: absolute; bottom: -50px; left: 5%; width: 90%; background-color: rgba(255, 255, 255, 0.95); color: var(--bg-dark); border: none; padding: 1rem; font-family: var(--font-body); font-weight: 600; text-transform: uppercase; font-size: 0.875rem; cursor: pointer; transition: all var(--transition-medium); opacity: 0; z-index: 2; }', css)

# Fix brand-logo mix-blend-mode for dark theme
css = css.replace('mix-blend-mode: multiply;', 'filter: invert(1); mix-blend-mode: screen;')

with open('styles.css', 'w', encoding='utf-8') as f:
    f.write(css)

