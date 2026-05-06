// New listing form logic — with payment methods multi-select

function initListingForm() {
  // Render payment options checkboxes
  renderPaymentOptions();

  // Existing toggle handlers (custody, lto)
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

function renderPaymentOptions() {
  const container = document.getElementById('payment-options-container');
  if (!container) return;

  container.innerHTML = PAYMENT_OPTIONS.map(opt => `
    <label class="payment-method-card" data-method="${opt.id}">
      <input type="checkbox" name="payment_methods" value="${opt.id}" ${opt.id === 'betternic' ? 'checked' : ''}>
      <div class="pmc-content">
        <div class="pmc-head">
          <span class="pmc-name">${opt.name}</span>
          ${opt.badge ? `<span class="pmc-badge">${opt.badge}</span>` : ''}
        </div>
        <div class="pmc-desc">${opt.desc}</div>
        <div class="pmc-meta">
          <span><strong>Fee:</strong> ${opt.fee}</span>
          <span><strong>Setup:</strong> ${opt.setup}</span>
        </div>
      </div>
    </label>
  `).join('');

  // Wire up checkbox change handlers
  container.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', () => {
      const card = cb.closest('.payment-method-card');
      if (cb.checked) {
        card.classList.add('selected');
      } else {
        card.classList.remove('selected');
      }

      // Show/hide custom instructions field
      if (cb.value === 'custom') {
        document.getElementById('custom-instructions-row').style.display = cb.checked ? 'block' : 'none';
      }
    });

    // Set initial selected state
    if (cb.checked) {
      cb.closest('.payment-method-card').classList.add('selected');
    }
  });
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

  // Get selected payment methods
  const paymentMethods = Array.from(
    document.querySelectorAll('input[name="payment_methods"]:checked')
  ).map(cb => cb.value);

  const customInstructions = document.getElementById('custom-instructions').value.trim();

  // Validation
  if (!/^[a-z0-9-]+\.[a-z]{2,}$/i.test(domain)) {
    alert('Please enter a valid domain (e.g. example.com)');
    return;
  }
  if (custody === 'self' && ltoEnabled) {
    alert('Lease-to-own requires parking the domain with BetterNic');
    return;
  }
  if (paymentMethods.length === 0) {
    alert('Please select at least one payment method');
    return;
  }
  if (paymentMethods.includes('custom') && !customInstructions) {
    alert('You selected "Custom arrangement" — please provide custom payment instructions');
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
      payment_methods: paymentMethods,
      custom_payment_instructions: customInstructions || null,
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
