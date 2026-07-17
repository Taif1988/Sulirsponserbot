const tg = window.Telegram?.WebApp;
if (tg) { tg.ready(); tg.expand(); }

const initData = tg?.initData || '';
const API = '';

let currentType = 'sale';
let currentCategory = null;
let categories = [];

const feed = document.getElementById('feed');
const emptyState = document.getElementById('emptyState');
const categoryChips = document.getElementById('categoryChips');
const searchInput = document.getElementById('searchInput');

// ---------- تحميل التصنيفات ----------
async function loadCategories() {
  const res = await fetch(`${API}/api/categories`);
  categories = await res.json();
  renderChips();
}

function renderChips() {
  categoryChips.innerHTML = '';
  const allChip = document.createElement('button');
  allChip.className = 'chip' + (currentCategory === null ? ' active' : '');
  allChip.textContent = 'الكل';
  allChip.onclick = () => { currentCategory = null; renderChips(); loadAds(); };
  categoryChips.appendChild(allChip);

  categories.forEach((c) => {
    const chip = document.createElement('button');
    chip.className = 'chip' + (currentCategory === c.id ? ' active' : '');
    chip.textContent = c.label;
    chip.onclick = () => { currentCategory = c.id; renderChips(); loadAds(); };
    categoryChips.appendChild(chip);
  });
}

// ---------- تحميل الإعلانات ----------
async function loadAds() {
  const params = new URLSearchParams({ type: currentType });
  if (currentCategory) params.set('category', currentCategory);
  if (searchInput.value.trim()) params.set('q', searchInput.value.trim());

  const res = await fetch(`${API}/api/ads?${params}`);
  const ads = await res.json();
  renderFeed(ads);
}

function renderFeed(ads) {
  feed.querySelectorAll('.ad-card').forEach((el) => el.remove());
  emptyState.hidden = ads.length > 0;

  ads.forEach((ad) => {
    const card = document.createElement('div');
    card.className = 'ad-card';
    card.innerHTML = `
      <div class="thumb" style="${ad.image ? `background-image:url(${ad.image})` : ''}">
        ${ad.image ? '' : (ad.type === 'job' ? '💼' : '🛍️')}
      </div>
      <div class="info">
        <div class="cat-label">${categoryLabel(ad.category)}</div>
        <div class="title">${escapeHtml(ad.title)}</div>
        ${ad.price ? `<div class="price">${escapeHtml(ad.price)}</div>` : ''}
      </div>
    `;
    card.onclick = () => openDetail(ad);
    feed.appendChild(card);
  });
}

function categoryLabel(id) {
  const c = categories.find((c) => c.id === id);
  return c ? c.label : id;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ---------- تبويبات وبحث ----------
document.querySelectorAll('.tab').forEach((tab) => {
  tab.onclick = () => {
    document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');
    currentType = tab.dataset.type;
    loadAds();
  };
});

let searchTimeout;
searchInput.addEventListener('input', () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(loadAds, 300);
});

// ---------- تفاصيل الإعلان ----------
function openDetail(ad) {
  const content = document.getElementById('detailContent');
  content.innerHTML = `
    <div class="sheet-header">
      <h2>تفاصيل الإعلان</h2>
      <button class="close-btn" data-close="detailSheet">✕</button>
    </div>
    ${ad.image ? `<img class="detail-image" src="${ad.image}" />` : ''}
    <div class="detail-title">${escapeHtml(ad.title)}</div>
    ${ad.price ? `<div class="detail-price">${escapeHtml(ad.price)}</div>` : ''}
    <div class="detail-desc">${escapeHtml(ad.description)}</div>
    <div class="detail-meta">📌 ${categoryLabel(ad.category)} · بواسطة ${escapeHtml(ad.posterName)}</div>
    ${
      ad.posterUsername
        ? `<a class="contact-btn" href="https://t.me/${ad.posterUsername}" target="_blank">💬 تواصل مع المعلن</a>`
        : `<div class="contact-disabled">صاحب الإعلان ما عنده اسم مستخدم بتلكرام للتواصل المباشر</div>`
    }
  `;
  showSheet('detailSheet');
  attachCloseHandlers();
}

// ---------- نشر إعلان ----------
const typeSegmented = document.getElementById('typeSegmented');
const categorySelect = document.getElementById('categorySelect');
const priceLabel = document.getElementById('priceLabel');
let postType = 'sale';
let selectedImageBase64 = null;

typeSegmented.querySelectorAll('.seg').forEach((seg) => {
  seg.onclick = () => {
    typeSegmented.querySelectorAll('.seg').forEach((s) => s.classList.remove('active'));
    seg.classList.add('active');
    postType = seg.dataset.value;
    priceLabel.textContent = postType === 'job' ? 'الراتب (اختياري)' : 'السعر (اختياري)';
  };
});

function fillCategorySelect() {
  categorySelect.innerHTML = categories
    .map((c) => `<option value="${c.id}">${c.label}</option>`)
    .join('');
}

document.getElementById('imageInput').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const maxW = 800;
      const scale = Math.min(1, maxW / img.width);
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      selectedImageBase64 = canvas.toDataURL('image/jpeg', 0.7);
      const preview = document.getElementById('imagePreview');
      preview.src = selectedImageBase64;
      preview.hidden = false;
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
});

document.getElementById('submitAdBtn').onclick = async () => {
  const title = document.getElementById('titleInput').value.trim();
  const description = document.getElementById('descInput').value.trim();
  const price = document.getElementById('priceInput').value.trim();
  const category = categorySelect.value;

  if (!title || !description) {
    alert('الرجاء تعبئة العنوان والوصف');
    return;
  }

  const res = await fetch(`${API}/api/ads`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      initData,
      type: postType,
      title,
      description,
      price,
      category,
      image: selectedImageBase64
    })
  });

  const data = await res.json();
  if (data.success) {
    alert('تم إرسال إعلانك للمراجعة ✓');
    closeSheet('postSheet');
    document.getElementById('titleInput').value = '';
    document.getElementById('descInput').value = '';
    document.getElementById('priceInput').value = '';
    document.getElementById('imagePreview').hidden = true;
    selectedImageBase64 = null;
  } else {
    alert(data.error || 'صار خطأ، حاول مرة ثانية');
  }
};

// ---------- إعلاناتي ----------
document.getElementById('myAdsBtn').onclick = async () => {
  const res = await fetch(`${API}/api/my-ads?initData=${encodeURIComponent(initData)}`);
  const ads = await res.json();
  const list = document.getElementById('myAdsList');

  if (ads.length === 0) {
    list.innerHTML = '<p style="text-align:center;color:rgba(35,41,31,0.5);padding:30px 0;">ما نشرت أي إعلان بعد</p>';
  } else {
    list.innerHTML = ads
      .map(
        (ad) => `
      <div class="my-ad-row">
        <div class="my-ad-thumb" style="${ad.image ? `background-image:url(${ad.image})` : ''}"></div>
        <div class="my-ad-info">
          <div class="my-ad-title">${escapeHtml(ad.title)}</div>
          <span class="status-badge status-${ad.status}">${statusLabel(ad.status)}</span>
        </div>
        <button class="delete-ad-btn" onclick="deleteAd('${ad.id}')">حذف</button>
      </div>
    `
      )
      .join('');
  }

  showSheet('myAdsSheet');
};

function statusLabel(status) {
  return { pending: 'قيد المراجعة', approved: 'منشور', rejected: 'مرفوض' }[status] || status;
}

async function deleteAd(id) {
  if (!confirm('متأكد تبي تحذف هذا الإعلان؟')) return;
  await fetch(`${API}/api/ads/${id}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ initData })
  });
  document.getElementById('myAdsBtn').click();
}

// ---------- التحكم بالنوافذ (sheets) ----------
function showSheet(id) {
  document.querySelectorAll('.sheet').forEach((s) => (s.hidden = true));
  document.getElementById(id).hidden = false;
}
function closeSheet(id) {
  document.getElementById(id).hidden = true;
}
function attachCloseHandlers() {
  document.querySelectorAll('[data-close]').forEach((btn) => {
    btn.onclick = () => closeSheet(btn.dataset.close);
  });
}

document.getElementById('fab').onclick = () => {
  fillCategorySelect();
  showSheet('postSheet');
};

attachCloseHandlers();

// ---------- تشغيل أولي ----------
(async function init() {
  await loadCategories();
  await loadAds();
})();
