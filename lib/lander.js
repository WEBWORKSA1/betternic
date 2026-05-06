// Domain lander logic

async function initLander() {
  // Get domain from URL param
  const params = new URLSearchParams(window.location.search);
  const domain = params.get('d') || 'finova.com';

  const listing = await API.getByDomain(domain);
  if (!listing) {
    document.getElementById('domain-name').textContent = 'Domain not found';
    return;
  }

  // Populate domain info
  document.getElementById('page-title').textContent = `${listing.domain} is for sale · BetterNic`;
  document.getElementById('page-desc').setAttribute('content', `${listing.domain} is available for purchase. ${listing.tagline}`);
  document.getElementById('domain-name').textContent = listing.domain;
  document.getElementById('domain-tag').textContent = listing.tagline;
  document.getElementById('price-display').textContent = formatPrice(listing.price);

  // LTO display
  if (listing.lto_enabled) {
    const monthlyMin = calculateLTO(listing.price, 60);
    document.getElementById('lto-display').textContent = `or lease from ${formatPrice(monthlyMin)}/month for 60 months`;
  } else {
    document.getElementById('lto-display').style.display = 'none';
  }

  // Feature stats
  const parts = listing.domain.split('.');
  document.getElementById('f-letters').textContent = parts[0].length;
  document.getElementById('f-tld').textContent = '.' + parts.slice(1).join('.');
  document.getElementById('f-year').textContent = listing.registered_year || '—';

  // Comparable sales
  const comps = await API.getComparables(listing.category);
  const compGrid = document.getElementById('comparable-grid');
  if (compGrid) {
    compGrid.innerHTML = comps.map(c => `
      <div class="comp-card">
        <div class="comp-name">${c.domain}</div>
        <div class="comp-price">${formatPrice(c.price)}</div>
        <div class="comp-meta">Sold ${c.sold_date} · ${c.length} letters</div>
      </div>
    `).join('');
  }

  // Store listing for checkout
  window.__currentListing = listing;
}

function startCheckout(method) {
  const listing = window.__currentListing;
  if (!listing) return;
  window.location.href = `/checkout.html?d=${encodeURIComponent(listing.domain)}&method=${method}`;
}

function openOfferModal() {
  document.getElementById('offer-modal').style.display = 'flex';
}

function closeOfferModal(e) {
  if (e && e.target.classList && !e.target.classList.contains('modal-overlay') && !e.currentTarget.classList.contains('modal-close')) {
    if (e.target !== e.currentTarget) return;
  }
  document.getElementById('offer-modal').style.display = 'none';
}

async function submitOffer(e) {
  e.preventDefault();
  const listing = window.__currentListing;
  const amount = parseInt(document.getElementById('offer-amount').value);
  const email = document.getElementById('offer-email').value;
  const message = document.getElementById('offer-message').value;

  try {
    await API.createOffer({
      listing_id: listing.id,
      buyer_email: email,
      amount: amount,
      message: message,
    });
    alert('Offer submitted! The seller will respond within 24 hours.');
    closeOfferModal();
  } catch (err) {
    alert('Error submitting offer: ' + err.message);
  }
}

document.addEventListener('DOMContentLoaded', initLander);
