const API = '/api/cars';

let allCars = [];
let currentFilter = 'all';
let deleteTargetId = null;

const statusLabels = {
  watching: '👀 Смотрю',
  visited:  '🔍 Осмотрел',
  declined: '❌ Отказался',
  bought:   '✅ Купил',
};

const statusKeys = {
  watching: 'status-watching',
  visited:  'status-visited',
  declined: 'status-declined',
  bought:   'status-bought',
};

// ── API ──────────────────────────────────────────
async function fetchCars() {
  const res = await fetch(API);
  allCars = await res.json();
  render();
}

async function saveCar(data, id = null) {
  const url  = id ? `${API}/${id}` : API;
  const method = id ? 'PUT' : 'POST';
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Server error');
  await fetchCars();
}

async function deleteCar(id) {
  await fetch(`${API}/${id}`, { method: 'DELETE' });
  await fetchCars();
}

// ── RENDER ──────────────────────────────────────
function render() {
  renderStats();
  renderCards();
}

function renderStats() {
  const counts = { all: allCars.length, watching: 0, visited: 0, declined: 0, bought: 0 };
  allCars.forEach(c => { if (counts[c.status] !== undefined) counts[c.status]++; });

  document.getElementById('statsBar').innerHTML = [
    { label: 'Всего',     key: 'all',      icon: '🚗' },
    { label: 'Смотрю',    key: 'watching', icon: '👀' },
    { label: 'Осмотрел',  key: 'visited',  icon: '🔍' },
    { label: 'Отказался', key: 'declined', icon: '❌' },
    { label: 'Купил',     key: 'bought',   icon: '✅' },
  ].map(s => `
    <div class="stat-chip" data-type="${s.key}">
      <span class="stat-icon">${s.icon}</span>
      <div class="stat-info">
        <span class="stat-num">${counts[s.key]}</span>
        <span class="stat-label">${s.label}</span>
      </div>
    </div>
  `).join('');
}

function renderCards() {
  const grid = document.getElementById('carsGrid');
  const filtered = currentFilter === 'all' ? allCars : allCars.filter(c => c.status === currentFilter);

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🚘</div>
        <strong>Нет автомобилей</strong>
        <p>${currentFilter === 'all' ? 'Добавьте первый автомобиль!' : 'Нет машин с таким статусом.'}</p>
      </div>`;
    return;
  }

  grid.innerHTML = filtered.map((car, i) => cardHTML(car, i)).join('');
}

function stars(rating) {
  return Array.from({ length: 5 }, (_, i) =>
    `<span class="star-display ${i < rating ? 'filled' : ''}">★</span>`
  ).join('');
}

function formatPrice(p) {
  if (!p) return '—';
  return Number(p).toLocaleString('ru-RU') + ' ₽';
}

function formatMileage(m) {
  if (!m) return '—';
  return Number(m).toLocaleString('ru-RU') + ' км';
}

function cardHTML(car, index) {
  const photoContent = car.photo
    ? `<img class="car-photo" src="${escHtml(car.photo)}" alt="${escHtml(car.name)}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" /><div class="car-photo-placeholder" style="display:none">🚗</div>`
    : `<div class="car-photo-placeholder">🚗</div>`;

  const linkBtn = car.url
    ? `<a class="btn-link" href="${escHtml(car.url)}" target="_blank" rel="noopener">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15,3 21,3 21,9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
        Объявление
      </a>`
    : '';

  return `
  <div class="car-card" data-id="${car.id}" data-status="${car.status}" style="--i:${index}">
    <div class="car-photo-wrap">
      ${photoContent}
      <div class="photo-overlay"></div>
      <span class="status-badge ${statusKeys[car.status] || ''}">${statusLabels[car.status] || car.status}</span>
    </div>
    <div class="car-body">
      <div class="car-name">${escHtml(car.name)}</div>
      <div class="car-price">${formatPrice(car.price)}</div>
      <div class="car-specs">
        ${car.year    ? `<div class="spec"><span class="spec-icon">📅</span>${car.year} г.</div>` : ''}
        ${car.mileage ? `<div class="spec"><span class="spec-icon">📏</span>${formatMileage(car.mileage)}</div>` : ''}
      </div>
      <div class="car-stars">${stars(car.rating || 0)}</div>
      ${car.notes ? `<div class="car-notes">${escHtml(car.notes)}</div>` : ''}
    </div>
    <div class="car-footer">
      ${linkBtn}
      <button class="btn-icon" onclick="openEdit(${car.id})">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="m18.5 2.5 3 3L12 15l-4 1 1-4Z"/></svg>
        Изменить
      </button>
      <button class="btn-icon danger" onclick="confirmDelete(${car.id})">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3,6 5,6 21,6"/><path d="m19 6-.867 12.142A2 2 0 0 1 16.138 20H7.862a2 2 0 0 1-1.995-1.858L5 6"/><path d="M10 11v6M14 11v6"/><path d="m8 6 1-3h6l1 3"/></svg>
      </button>
    </div>
  </div>`;
}

function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── MODAL ────────────────────────────────────────
const overlay   = document.getElementById('modalOverlay');
const modalTitle = document.getElementById('modalTitle');
const carForm   = document.getElementById('carForm');

function openModal(title) {
  modalTitle.textContent = title;
  overlay.classList.add('open');
}

function closeModal() {
  overlay.classList.remove('open');
  carForm.reset();
  document.getElementById('carId').value = '';
  setRating(0);
}

function openAdd() {
  closeModal();
  openModal('Добавить автомобиль');
}

function openEdit(id) {
  const car = allCars.find(c => c.id === id);
  if (!car) return;
  document.getElementById('carId').value  = car.id;
  document.getElementById('fName').value  = car.name || '';
  document.getElementById('fUrl').value   = car.url  || '';
  document.getElementById('fPrice').value = car.price || '';
  document.getElementById('fMileage').value = car.mileage || '';
  document.getElementById('fYear').value  = car.year  || '';
  document.getElementById('fPhoto').value = car.photo || '';
  document.getElementById('fNotes').value = car.notes || '';
  document.getElementById('fStatus').value = car.status || 'watching';
  setRating(car.rating || 0);
  openModal('Редактировать автомобиль');
}

// Star rating input
let currentRating = 0;

function setRating(val) {
  currentRating = val;
  document.getElementById('fRating').value = val;
  document.querySelectorAll('.star-btn').forEach((s, i) => {
    s.classList.toggle('active', i < val);
  });
}

document.querySelectorAll('.star-btn').forEach(btn => {
  btn.addEventListener('click', () => setRating(Number(btn.dataset.value)));
  btn.addEventListener('mouseover', () => {
    const v = Number(btn.dataset.value);
    document.querySelectorAll('.star-btn').forEach((s, i) => {
      s.classList.toggle('active', i < v);
    });
  });
});

document.getElementById('starInput').addEventListener('mouseleave', () => {
  setRating(currentRating);
});

// Form submit
carForm.addEventListener('submit', async e => {
  e.preventDefault();
  const id = document.getElementById('carId').value;
  const data = {
    name:    document.getElementById('fName').value.trim(),
    url:     document.getElementById('fUrl').value.trim(),
    price:   Number(document.getElementById('fPrice').value) || null,
    mileage: Number(document.getElementById('fMileage').value) || null,
    year:    Number(document.getElementById('fYear').value) || null,
    photo:   document.getElementById('fPhoto').value.trim(),
    notes:   document.getElementById('fNotes').value.trim(),
    rating:  Number(document.getElementById('fRating').value),
    status:  document.getElementById('fStatus').value,
  };
  try {
    await saveCar(data, id || null);
    closeModal();
  } catch (err) {
    alert('Ошибка сохранения: ' + err.message);
  }
});

// ── DELETE CONFIRM ────────────────────────────────
const deleteOverlay = document.getElementById('deleteOverlay');

function confirmDelete(id) {
  deleteTargetId = id;
  deleteOverlay.classList.add('open');
}

document.getElementById('deleteConfirmBtn').addEventListener('click', async () => {
  if (deleteTargetId) {
    await deleteCar(deleteTargetId);
    deleteTargetId = null;
  }
  deleteOverlay.classList.remove('open');
});

document.getElementById('deleteCancelBtn').addEventListener('click', () => {
  deleteTargetId = null;
  deleteOverlay.classList.remove('open');
});

// ── EVENT LISTENERS ───────────────────────────────
document.getElementById('btnAdd').addEventListener('click', openAdd);
document.getElementById('modalClose').addEventListener('click', closeModal);
document.getElementById('btnCancel').addEventListener('click', closeModal);

overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
deleteOverlay.addEventListener('click', e => {
  if (e.target === deleteOverlay) {
    deleteTargetId = null;
    deleteOverlay.classList.remove('open');
  }
});

document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.dataset.status;
    renderCards();
  });
});

// ── INIT ─────────────────────────────────────────
fetchCars();
