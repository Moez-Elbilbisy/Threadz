import re

with open(r'c:\Users\moezm\Downloads\threadz (1).html', 'r', encoding='utf-8') as f:
    content = f.read()

scripts = re.findall(r'<script>(.*?)</script>', content, re.DOTALL)
js = scripts[0] + '\n\n' + scripts[1]

# Modify the phase 4 UI reveal
old_phase4 = """        // Show full UI
        document.getElementById('announce').classList.add('visible');
        document.getElementById('navbar').classList.add('visible');
        document.getElementById('hero').classList.add('visible');
        document.getElementById('scroll-cue').style.opacity = '1';"""

new_phase4 = """        // Reveal Threadz Store Content
        document.body.classList.add('entering');
        
        // Gently fade out the 3D overlay layers
        document.getElementById('canvas-container').style.opacity = '0';
        document.getElementById('vignette').style.opacity = '0';
        document.getElementById('grain').style.opacity = '0';
        
        // Remove from DOM to save performance after fading out
        setTimeout(() => {
            document.getElementById('canvas-container').style.display = 'none';
        }, 1500);"""

js = js.replace(old_phase4, new_phase4)
js = js.replace("document.getElementById('welcome')", "document.getElementById('welcome-overlay')")

with open(r'd:\Threadz\Website\animation.js', 'w', encoding='utf-8') as f:
    f.write(js)
