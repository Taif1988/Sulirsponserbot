let adminToken = localStorage.getItem('adminToken') || null;
let currentStatus = 'pending';

const loginBox = document.getElementById('loginBox');
const dashboard = document.getElementById('dashboard');

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

async function tryLogin(password) {
  const res = await fetch('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password })
  });
  if (!res.ok) return false;
  const data = await res.json();
  adminToken = data.token;
  localStorage.setItem('adminToken', adminToken);
  return true;
}

document.getElementById('loginBtn').onclick = async () => {
  const password = document.getElementById('passwordInput').value;
  const ok = await tryLogin(password);
  if (ok) {
    showDashboard();
  } else {
    document.getElementById('loginError').hidden = false;
  }
};

function showDashboard() {
  loginBox.hidden = true;
  dashboard.hidden = false;
  loadAds();
}

document.querySelectorAll('.status-tab').forEach((tab) => {
  tab.onclick = () => {
    document.querySelectorAll('.status-tab').forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');
    currentStatus = tab.dataset.status;
    loadAds();
  };
});

async function loadAds() {
  const res = await fetch(`/api/admin/ads?status=${currentStatus}`, {
    headers: { 'X-Admin-Token': adminToken }
  });

  if (res.status === 401) {
    localStorage.removeItem('adminToken');
    loginBox.hidden = false;
    dashboard.hidden = true;
    return;
  }

  const ads = await res.json();
  renderList(ads);
}

function renderList(ads) {
  const list = document.getElementById('adminList');
  if (ads.length === 0) {
    list.innerHTML = '<div class="empty">ما فيه إعلانات هسه بهذا القسم</div>';
    return;
  }

  list.innerHTML = ads
    .map(
      (ad) => `
    <div class="admin-card">
      <div class="admin-thumb" style="${ad.image ? `background-image:url(${ad.image})` : ''}"></div>
      <div class="admin-info">
        <div class="admin-title">${escapeHtml(ad.title)} ${ad.price ? `— ${escapeHtml(ad.price)}` : ''}</div>
        <div class="admin-desc">${escapeHtml(ad.description)}</div>
        <div class="admin-meta">بواسطة ${escapeHtml(ad.posterName)} ${ad.posterUsername ? `(@${ad.posterUsername})` : ''} · ${ad.type === 'job' ? 'وظيفة' : 'بيع'}</div>
        ${
          currentStatus === 'pending'
            ? `<div class="admin-actions">
                <button class="btn-approve" onclick="moderateAd('${ad.id}', 'approve')">✓ قبول</button>
                <button class="btn-reject" onclick="moderateAd('${ad.id}', 'reject')">✕ رفض</button>
              </div>`
            : ''
        }
      </div>
    </div>
  `
    )
    .join('');
}

async function moderateAd(id, action) {
  await fetch(`/api/admin/ads/${id}/${action}`, {
    method: 'POST',
    headers: { 'X-Admin-Token': adminToken }
  });
  loadAds();
}

if (adminToken) {
  showDashboard();
}
