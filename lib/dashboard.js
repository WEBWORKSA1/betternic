// Dashboard logic

async function initDashboard() {
  // Auth gate
  const user = await API.getUser();
  if (!user) {
    window.location.href = '/login.html';
    return;
  }
  document.getElementById('user-email').textContent = user.email;

  // Sidebar nav
  document.querySelectorAll('.side-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const view = item.dataset.view;
      document.querySelectorAll('.side-item').forEach(s => s.classList.remove('active'));
      document.querySelectorAll('.dash-view').forEach(v => v.classList.remove('active'));
      item.classList.add('active');
      document.getElementById('view-' + view).classList.add('active');
      if (view === 'inquiries') loadInquiries();
    });
  });

  // Load portfolio
  await loadPortfolio();
}

async function loadPortfolio() {
  const listings = await API.getMyListings();
  const tbody = document.getElementById('portfolio-tbody');

  if (!listings.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty-state">No listings yet. <a href="/listing-new.html" style="color:var(--color-text);font-weight:500;">Add your first domain →</a></td></tr>`;
  } else {
    tbody.innerHTML = listings.map(l => `
      <tr>
        <td><strong>${l.domain}</strong></td>
        <td>${formatPrice(l.price)}</td>
        <td>${l.custody === 'parked' ? 'Parked' : 'Self-hosted'}</td>
        <td><span class="badge ${l.lto_enabled ? 'badge-lto' : 'badge-bin'}">${l.status === 'active' ? 'Listed' : l.status}</span></td>
        <td class="row-actions">
          <a href="/lander.html?d=${l.domain}">View</a>
          <a href="#">Edit</a>
        </td>
      </tr>
    `).join('');
  }

  document.getElementById('m-listings').textContent = listings.length;
}

async function loadInquiries() {
  const inquiries = await API.getMyInquiries();
  const list = document.getElementById('inquiries-list');
  document.getElementById('inq-count').textContent = inquiries.length;
  document.getElementById('m-inquiries').textContent = inquiries.length;

  if (!inquiries.length) {
    list.innerHTML = `<div class="empty-state">No inquiries yet. They'll appear here when buyers make offers.</div>`;
    return;
  }

  list.innerHTML = inquiries.map(i => `
    <div class="inquiry-card">
      <div class="inquiry-head">
        <div class="inquiry-domain">${i.listings.domain}</div>
        <div class="inquiry-amount">${formatPrice(i.amount)}</div>
      </div>
      <div class="inquiry-meta">
        <span>${i.buyer_email}</span>
        <span>${new Date(i.created_at).toLocaleDateString()}</span>
      </div>
      ${i.message ? `<div class="inquiry-message">${i.message}</div>` : ''}
      <div class="inquiry-actions">
        <button class="btn btn-primary btn-small">Accept</button>
        <button class="btn btn-secondary btn-small">Counter</button>
        <button class="btn btn-secondary btn-small">Decline</button>
      </div>
    </div>
  `).join('');
}

async function signOut() {
  await API.signOut();
  window.location.href = '/';
}

function saveSettings() {
  alert('Settings saved (mock)');
}

document.addEventListener('DOMContentLoaded', initDashboard);
