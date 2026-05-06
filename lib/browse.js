// Browse page logic
let allListings = [];
let activeFilters = { search: '', price: [], tld: [], type: [], cat: [] };

async function initBrowse() {
  // Get initial search query from URL
  const params = new URLSearchParams(window.location.search);
  const q = params.get('q');
  if (q) {
    document.getElementById('browse-search').value = q;
    activeFilters.search = q;
  }

  allListings = await API.getAll();
  applyFilters();

  // Filter handlers
  document.querySelectorAll('input[type="checkbox"][data-filter]').forEach(cb => {
    cb.addEventListener('change', () => {
      const filter = cb.dataset.filter;
      const value = cb.value;
      if (cb.checked) {
        if (!activeFilters[filter].includes(value)) activeFilters[filter].push(value);
      } else {
        activeFilters[filter] = activeFilters[filter].filter(v => v !== value);
      }
      applyFilters();
    });
  });

  // Sort handler
  document.getElementById('sort-select').addEventListener('change', applyFilters);
}

function handleSearch(e) {
  e.preventDefault();
  activeFilters.search = document.getElementById('browse-search').value.trim();
  applyFilters();
}

function applyFilters() {
  let results = [...allListings];

  // Search
  if (activeFilters.search) {
    const q = activeFilters.search.toLowerCase();
    results = results.filter(l =>
      l.domain.toLowerCase().includes(q) ||
      (l.tagline || '').toLowerCase().includes(q) ||
      (l.category || '').toLowerCase().includes(q)
    );
  }

  // Price filter
  if (activeFilters.price.length) {
    results = results.filter(l => activeFilters.price.some(range => {
      const [min, max] = range.split('-');
      const minN = parseInt(min);
      if (max === '+') return l.price >= minN;
      return l.price >= minN && l.price < parseInt(max);
    }));
  }

  // TLD filter
  if (activeFilters.tld.length) {
    results = results.filter(l => activeFilters.tld.some(tld => l.domain.endsWith(tld)));
  }

  // Sale type filter
  if (activeFilters.type.length) {
    results = results.filter(l => {
      if (activeFilters.type.includes('lto') && l.lto_enabled) return true;
      if (activeFilters.type.includes('bin') && !l.lto_enabled) return true;
      if (activeFilters.type.includes('offer')) return true;
      return false;
    });
  }

  // Category filter
  if (activeFilters.cat.length) {
    results = results.filter(l => activeFilters.cat.includes(l.category));
  }

  // Sort
  const sort = document.getElementById('sort-select').value;
  if (sort === 'price-low') results.sort((a, b) => a.price - b.price);
  else if (sort === 'price-high') results.sort((a, b) => b.price - a.price);
  else if (sort === 'length') results.sort((a, b) => a.domain.length - b.domain.length);
  // 'newest' = default order

  document.getElementById('results-count').textContent = `${results.length} domains`;
  document.getElementById('results-grid').innerHTML = results.length
    ? results.map(renderDomainCard).join('')
    : '<div class="empty-state">No domains match your filters.</div>';
}

document.addEventListener('DOMContentLoaded', initBrowse);
