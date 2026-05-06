// Home page logic

async function initHome() {
  const featured = await API.getFeatured(4);
  const grid = document.getElementById('featured-grid');
  if (grid) grid.innerHTML = featured.map(renderDomainCard).join('');

  // Update listing count
  const all = await API.getAll();
  const m = document.getElementById('m-listings');
  if (m && all.length) m.textContent = all.length.toLocaleString() + '+';
}

function handleSearch(e) {
  e.preventDefault();
  const q = document.getElementById('search-input').value.trim();
  window.location.href = '/browse.html' + (q ? `?q=${encodeURIComponent(q)}` : '');
}

document.addEventListener('DOMContentLoaded', initHome);
