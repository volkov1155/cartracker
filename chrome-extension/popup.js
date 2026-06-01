const API_URL = 'http://localhost:3001/api/cars';

let parsedData = null;

// ── UI HELPERS ───────────────────────────────────────────────────────────────

const $ = id => document.getElementById(id);

function showState(name) {
  ['stateNotAvito', 'stateLoading', 'stateError', 'statePreview', 'stateSuccess']
    .forEach(id => $(id).classList.toggle('hidden', id !== name));
}

function showError(msg) {
  $('errorText').textContent = msg;
  showState('stateError');
}

function formatPrice(p) {
  if (!p) return '—';
  return Number(p).toLocaleString('ru-RU') + ' ₽';
}

function formatMileage(m) {
  if (!m) return null;
  return Number(m).toLocaleString('ru-RU') + ' км';
}

// ── RENDER PREVIEW ───────────────────────────────────────────────────────────

function renderPreview(data) {
  parsedData = data;

  // Name
  $('previewName').textContent = data.name || 'Нет названия';

  // Price
  $('previewPrice').textContent = formatPrice(data.price);

  // Photo
  if (data.photo) {
    const img = $('previewPhoto');
    img.src = data.photo;
    img.onload = () => {
      img.classList.remove('hidden');
      $('previewPhotoPlaceholder').classList.add('hidden');
    };
    img.onerror = () => {
      img.classList.add('hidden');
      $('previewPhotoPlaceholder').classList.remove('hidden');
    };
  }

  // Specs
  const specs = [];
  if (data.year)    specs.push(`📅 ${data.year} г.`);
  if (data.mileage) specs.push(`📏 ${formatMileage(data.mileage)}`);
  $('previewSpecs').innerHTML = specs
    .map(s => `<div class="spec-pill">${s}</div>`)
    .join('');

  // URL
  if (data.url) {
    const short = new URL(data.url).hostname + '...';
    $('previewUrl').innerHTML = `
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15,3 21,3 21,9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
      <a href="${data.url}" target="_blank">${short}</a>`;
  }

  showState('statePreview');
}

// ── PARSE PAGE ───────────────────────────────────────────────────────────────

async function parsePage(tab) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tab.id, { action: 'parse' }, response => {
      if (chrome.runtime.lastError) {
        reject(new Error('content_script_missing'));
      } else if (response?.ok) {
        resolve(response.data);
      } else {
        reject(new Error(response?.error || 'Не удалось прочитать страницу'));
      }
    });
  });
}

async function parseWithInjection(tab) {
  // Content script wasn't injected (tab was open before extension install)
  // Inject it programmatically as a fallback
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['content.js'],
  });
  // Small delay for the script to register its listener
  await new Promise(r => setTimeout(r, 100));
  return parsePage(tab);
}

// ── POST TO API ──────────────────────────────────────────────────────────────

async function addToTracker(data) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// ── INIT ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  showState('stateLoading');

  let tab;
  try {
    [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  } catch (e) {
    showError('Не удалось получить текущую вкладку');
    return;
  }

  // Check if we're on Avito
  if (!tab.url || !tab.url.includes('avito.ru')) {
    showState('stateNotAvito');
    return;
  }

  // Try parsing
  let data;
  try {
    data = await parsePage(tab);
  } catch (e) {
    if (e.message === 'content_script_missing') {
      try {
        data = await parseWithInjection(tab);
      } catch (e2) {
        showError('Не удалось запустить парсер. Обновите страницу и попробуйте снова.');
        return;
      }
    } else {
      showError(e.message);
      return;
    }
  }

  if (!data || !data.name) {
    showError('Не удалось прочитать данные. Убедитесь, что открыта страница конкретного объявления.');
    return;
  }

  renderPreview(data);
});

// ── ADD BUTTON ───────────────────────────────────────────────────────────────

document.addEventListener('click', async e => {
  if (!e.target.closest('#btnAdd')) return;

  const btn = $('btnAdd');
  btn.disabled = true;
  btn.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" style="animation:spin 0.7s linear infinite"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
    Добавляем...`;

  // Insert spinner keyframe if needed
  if (!document.getElementById('spinStyle')) {
    const s = document.createElement('style');
    s.id = 'spinStyle';
    s.textContent = '@keyframes spin { to { transform: rotate(360deg); } }';
    document.head.appendChild(s);
  }

  try {
    await addToTracker(parsedData);
    showState('stateSuccess');
  } catch (e) {
    btn.disabled = false;
    btn.innerHTML = `
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      Добавить в CarTracker`;
    showError(`Ошибка отправки: ${e.message}. Проверьте, что CarTracker запущен на порту 3001.`);
  }
});
