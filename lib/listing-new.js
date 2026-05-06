// New listing form logic

function initListingForm() {
  // Toggle handlers
  document.querySelectorAll('.toggle-card').forEach(card => {
    card.addEventListener('click', () => {
      const group = card.dataset.toggle;
      document.querySelectorAll(`.toggle-card[data-toggle="${group}"]`).forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      const radio = card.querySelector('input[type="radio"]');
      if (radio) radio.checked = true;

      // If custody = self, disable LTO
      if (group === 'custody' && card.dataset.value === 'self') {
        const ltoCards = document.querySelectorAll('.toggle-card[data-toggle="lto"]');
        ltoCards.forEach(c => {
          if (c.dataset.value === 'disabled') {
            c.classList.add('selected');
            c.querySelector('input').checked = true;
          } else {
            c.classList.remove('selected');
          }
        });
      }
    });
  });

  // Live commission hint
  const priceInput = document.getElementById('price-input');
  if (priceInput) {
    priceInput.addEventListener('input', () => {
      const price = parseInt(priceInput.value) || 0;
      const rate = commissionRateForPrice(price);
      let tier = '';
      if (price >= 100000) tier = 'over $100K';
      else if (price >= 50000) tier = 'over $50K';
      else tier = 'under $50K';
      document.getElementById('commission-hint').textContent = `Commission: ${rate} (${tier})`;
    });
  }
}

async function submitListing(e) {
  e.preventDefault();

  const domain = document.getElementById('domain-input').value.trim().toLowerCase();
  const price = parseInt(document.getElementById('price-input').value);
  const minOffer = parseInt(document.getElementById('min-offer').value) || null;
  const tagline = document.getElementById('tagline-input').value.trim();
  const category = document.getElementById('category-input').value;
  const custody = document.querySelector('input[name="custody"]:checked').value;
  const ltoEnabled = document.querySelector('input[name="lto"]:checked').value === 'enabled';

  // Basic validation
  if (!/^[a-z0-9-]+\.[a-z]{2,}$/i.test(domain)) {
    alert('Please enter a valid domain (e.g. example.com)');
    return;
  }
  if (custody === 'self' && ltoEnabled) {
    alert('Lease-to-own requires parking the domain with BetterNic');
    return;
  }

  try {
    await API.createListing({
      domain,
      price,
      min_offer: minOffer,
      tagline,
      category,
      custody,
      lto_enabled: ltoEnabled,
    });
    alert('Listing published!');
    window.location.href = '/dashboard.html';
  } catch (err) {
    alert('Error: ' + err.message);
  }
}

function saveDraft() {
  alert('Draft saved (mock - implement with Supabase)');
}

document.addEventListener('DOMContentLoaded', initListingForm);
