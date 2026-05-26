(function () {
  const CACHE_KEY = 'threadz_site_settings';
  const CACHE_DURATION = 5 * 60 * 1000;

  const IMAGE_KEYS = {
    'logo': 'logo',
    'favicon': 'favicon',
    'hero': 'hero',
    'banner-crafted': 'banner_crafted',
    'about-genesis': 'about_genesis',
    'about-cotton': 'about_cotton',
    'collection-obsidian': 'collection_obsidian',
    'collection-anubis': 'collection_anubis',
    'journal-featured': 'journal_featured',
    'journal-craft': 'journal_craft',
    'journal-drops': 'journal_drops',
  };

  function getCached() {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const { timestamp, settings } = JSON.parse(raw);
      if (Date.now() - timestamp > CACHE_DURATION) return null;
      return settings;
    } catch { return null; }
  }

  function setCache(settings) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ timestamp: Date.now(), settings }));
    } catch {}
  }

  function applySettings(settings) {
    document.querySelectorAll('[data-site-image]').forEach(el => {
      const key = el.dataset.siteImage;
      const settingKey = IMAGE_KEYS[key];
      if (!settingKey) return;
      const url = settings[settingKey];
      if (!url) return;
      if (el.tagName === 'IMG') {
        el.src = url;
      } else if (el.tagName === 'LINK' && el.rel === 'icon') {
        el.href = url;
      }
    });
  }

  const cached = getCached();
  if (cached) {
    applySettings(cached);
  }

  fetch('/api/settings')
    .then(r => r.json())
    .then(data => {
      if (data.success && data.settings) {
        setCache(data.settings);
        applySettings(data.settings);
      }
    })
    .catch(() => {});
})();
