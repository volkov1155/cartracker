(() => {
  if (window.__carTrackerLoaded) return;
  window.__carTrackerLoaded = true;

  // ── HELPERS ──────────────────────────────────────────────────────────────

  function firstOf(fns) {
    for (const fn of fns) {
      try {
        const v = fn();
        if (v != null && String(v).trim() !== '') return String(v).trim();
      } catch (_) {}
    }
    return '';
  }

  function digitsOnly(str) {
    return str ? str.replace(/[^\d]/g, '') : '';
  }

  // ── TITLE ─────────────────────────────────────────────────────────────────

  function parseName() {
    return firstOf([
      () => document.querySelector('h1[itemprop="name"]')?.textContent,
      () => document.querySelector('[data-marker="item-view/title-info"] h1')?.textContent,
      () => document.querySelector('h1[class*="title"]')?.textContent,
      () => document.querySelector('h1')?.textContent,
      () => document.querySelector('meta[property="og:title"]')?.getAttribute('content'),
      () => document.title,
    ]);
  }

  // ── PRICE ─────────────────────────────────────────────────────────────────

  function parsePrice() {
    const raw = firstOf([
      () => document.querySelector('meta[property="og:price:amount"]')?.getAttribute('content'),
      () => document.querySelector('[itemprop="price"]')?.getAttribute('content'),
      () => document.querySelector('[itemprop="price"]')?.textContent,
      () => document.querySelector('[data-marker="item-view/item-price"] [class*="price"]')?.textContent,
      () => document.querySelector('[class*="price-value-string"]')?.textContent,
      () => document.querySelector('[class*="js-item-price"]')?.textContent,
      () => {
        for (const el of document.querySelectorAll('span')) {
          if (el.children.length === 0) {
            const t = el.textContent.replace(/\s/g, '');
            if ((t.includes('₽') || t.includes('руб')) && /\d{5,}/.test(t)) return t;
          }
        }
        return null;
      },
    ]);
    const d = digitsOnly(raw);
    return d ? parseInt(d, 10) : null;
  }

  // ── PHOTO ─────────────────────────────────────────────────────────────────

  function parsePhoto() {
    return firstOf([
      () => document.querySelector('meta[property="og:image"]')?.getAttribute('content'),
      () => document.querySelector('[data-marker="gallery/item"] img')?.getAttribute('src'),
      () => document.querySelector('[data-marker="gallery"] img')?.getAttribute('src'),
      () => {
        for (const img of document.querySelectorAll('img')) {
          const src = img.getAttribute('src') || '';
          if (src.match(/avito-cdn|avito\.st|img\.avito/i) && img.naturalWidth > 200) return src;
        }
        return null;
      },
      () => {
        for (const img of document.querySelectorAll('img')) {
          const src = img.getAttribute('src') || '';
          if (src.match(/avito-cdn|avito\.st|img\.avito/i)) return src;
        }
        return null;
      },
    ]);
  }

  // ── PARAMS (year / mileage) ───────────────────────────────────────────────

  function parseParams() {
    const result = { year: null, mileage: null };

    function tryExtract(text) {
      const lower = text.toLowerCase();

      if (!result.year && (lower.includes('год') || lower.includes('year'))) {
        const m = text.match(/\b(19\d{2}|20[012]\d)\b/);
        if (m) result.year = parseInt(m[0], 10);
      }

      if (!result.mileage && (lower.includes('пробег') || lower.includes('mileage') || lower.includes('км'))) {
        const clean = text.replace(/\s+/g, '');
        const m = clean.match(/(\d{3,7})\s*км/i) || clean.match(/пробег[^\d]*(\d{3,7})/i);
        if (m) result.mileage = parseInt(m[1], 10);
      }
    }

    // Strategy 1: data-marker="item-params/item"
    const markerItems = document.querySelectorAll('[data-marker="item-params/item"]');
    markerItems.forEach(el => tryExtract(el.textContent));
    if (result.year && result.mileage) return result;

    // Strategy 2: ul[class*=params] > li
    for (const ul of document.querySelectorAll('ul[class*="params"], ul[class*="Params"]')) {
      ul.querySelectorAll('li').forEach(li => tryExtract(li.textContent));
    }
    if (result.year && result.mileage) return result;

    // Strategy 3: any li that looks like a param row (few children)
    for (const li of document.querySelectorAll('li')) {
      if (li.querySelectorAll('li').length === 0) tryExtract(li.textContent);
    }
    if (result.year && result.mileage) return result;

    // Strategy 4: dt/dd pairs
    const dts = document.querySelectorAll('dt');
    dts.forEach(dt => {
      const dd = dt.nextElementSibling;
      if (dd && dd.tagName === 'DD') {
        tryExtract(dt.textContent + ' ' + dd.textContent);
      }
    });

    // Strategy 5: year from title fallback
    if (!result.year) {
      const name = parseName();
      const m = name.match(/\b(19\d{2}|20[012]\d)\b/);
      if (m) result.year = parseInt(m[0], 10);
    }

    return result;
  }

  // ── MAIN PARSE ────────────────────────────────────────────────────────────

  function parseAvito() {
    const params = parseParams();
    return {
      name:    parseName(),
      url:     window.location.href,
      price:   parsePrice(),
      photo:   parsePhoto(),
      year:    params.year,
      mileage: params.mileage,
      notes:   '',
      rating:  0,
      status:  'watching',
    };
  }

  // ── MESSAGE LISTENER ──────────────────────────────────────────────────────

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.action === 'parse') {
      try {
        sendResponse({ ok: true, data: parseAvito() });
      } catch (e) {
        sendResponse({ ok: false, error: e.message });
      }
    }
    return true;
  });
})();
