// Checkout logic — dynamic based on seller's accepted payment methods

async function initCheckout() {
  const params = new URLSearchParams(window.location.search);
  const domain = params.get('d');
  const method = params.get('method') || 'bin';

  if (!domain) {
    document.body.innerHTML = '<div style="padding:4rem;text-align:center;">No domain selected. <a href="/">Return to marketplace</a></div>';
    return;
  }

  const listing = await API.getByDomain(domain);
  if (!listing) {
    document.body.innerHTML = '<div style="padding:4rem;text-align:center;">Domain not found.</div>';
    return;
  }

  // Header
  document.getElementById('co-domain').textContent = listing.domain;
  document.getElementById('s-domain').textContent = listing.domain;
  document.getElementById('s-price').textContent = formatPrice(listing.price);

  // Render payment options based on seller's choices
  renderCheckoutPaymentOptions(listing);

  // Show custom instructions if seller has them
  if (listing.payment_methods && listing.payment_methods.includes('custom') && listing.custom_payment_instructions) {
    document.getElementById('custom-instructions-display').style.display = 'block';
    document.getElementById('ci-content').textContent = listing.custom_payment_instructions;
  }

  // LTO options (only if enabled by seller)
  if (listing.lto_enabled) {
    renderLTOOptions(listing);
  }

  window.__currentListing = listing;
}

function renderCheckoutPaymentOptions(listing) {
  const container = document.getElementById('payment-options-list');
  if (!container) return;

  const accepted = getAcceptedPaymentOptions(listing);

  // Update header note based on number of accepted methods
  const note = document.getElementById('seller-method-note');
  if (accepted.length === 1) {
    note.textContent = `The seller has set ${accepted[0].name} as their accepted payment method.`;
  } else {
    note.textContent = `The seller of this domain accepts ${accepted.length} payment methods. Choose one to continue.`;
  }

  container.innerHTML = accepted.map((opt, idx) => `
    <label class="payment-option ${idx === 0 ? 'selected' : ''}" data-method="${opt.id}">
      <input type="radio" name="payment" value="${opt.id}" ${idx === 0 ? 'checked' : ''} hidden>
      <div class="po-content">
        <div class="po-title">${opt.name}${opt.badge ? ` <span class="po-badge">${opt.badge}</span>` : ''}</div>
        <div class="po-desc">${opt.desc}</div>
        <div class="po-meta-row">
          <span class="po-meta-item"><strong>Fee:</strong> ${opt.fee}</span>
        </div>
      </div>
      <div class="po-check"></div>
    </label>
  `).join('');

  // Attach click handlers
  container.querySelectorAll('.payment-option').forEach(opt => {
    opt.addEventListener('click', () => {
      container.querySelectorAll('.payment-option').forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
      opt.querySelector('input').checked = true;
      updateFee(opt.dataset.method, listing.price);
    });
  });

  // Initial fee update for first option
  updateFee(accepted[0].id, listing.price);
}

function renderLTOOptions(listing) {
  const section = document.getElementById('lto-section-title');
  section.style.display = 'block';
  const ltoDiv = document.getElementById('lto-options');
  const months = [12, 24, 36, 48, 60];

  ltoDiv.innerHTML = months.map(m => {
    const monthly = calculateLTO(listing.price, m);
    const markup = (BETTERNIC_CONFIG.LTO_MARKUPS[m] * 100).toFixed(0);
    return `
      <label class="payment-option" data-method="lto-${m}">
        <input type="radio" name="payment" value="lto-${m}" hidden>
        <div class="po-content">
          <div class="po-title">Lease to own · ${m} months</div>
          <div class="po-desc">${formatPrice(monthly)}/mo · ${markup}% markup applied</div>
        </div>
        <div class="po-check"></div>
      </label>
    `;
  }).join('');

  // Wire up LTO option clicks (extends existing handler)
  ltoDiv.querySelectorAll('.payment-option').forEach(opt => {
    opt.addEventListener('click', () => {
      document.querySelectorAll('.payment-option').forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
      opt.querySelector('input').checked = true;
      updateFee(opt.dataset.method, listing.price);
    });
  });
}

function updateFee(methodId, price) {
  let fee = 0;
  let feeLabel = 'Processing';

  // LTO is special
  if (methodId && methodId.startsWith('lto-')) {
    const m = parseInt(methodId.split('-')[1]);
    fee = calculateLTO(price, m); // first payment shown
    document.getElementById('s-fee-label').textContent = 'First payment';
    document.getElementById('s-fee').textContent = formatPrice(fee);
    document.getElementById('s-total').textContent = formatPrice(fee);
    return;
  }

  // Compute fee based on chosen method
  if (methodId === 'betternic') {
    fee = price * BETTERNIC_CONFIG.STRIPE_FEE.percent + BETTERNIC_CONFIG.STRIPE_FEE.fixed;
    feeLabel = 'Processing';
  } else if (methodId === 'escrow_com') {
    fee = price * BETTERNIC_CONFIG.ESCROW_FEE.percent;
    feeLabel = 'Escrow.com fee';
  } else if (methodId === 'wire_betternic') {
    fee = 25;
    feeLabel = 'Wire fee';
  } else if (methodId === 'paypal') {
    fee = price * 0.0349 + 0.49;
    feeLabel = 'PayPal fee';
  } else if (methodId === 'stripe_seller') {
    fee = price * 0.029 + 0.30;
    feeLabel = 'Stripe fee';
  } else {
    fee = 0;
    feeLabel = 'Processing varies';
  }

  document.getElementById('s-fee-label').textContent = feeLabel;
  document.getElementById('s-fee').textContent = methodId === 'custom' || methodId === 'sedo_escrow' || methodId === 'afternic_escrow' || methodId === 'atom_escrow' || methodId === 'efty_escrow' ? 'Per service' : formatPrice(Math.round(fee));
  document.getElementById('s-total').textContent = formatPrice(Math.round(price + fee));
}

async function completePurchase() {
  const listing = window.__currentListing;
  const email = document.getElementById('buyer-email').value.trim();
  const name = document.getElementById('buyer-name').value.trim();
  const methodEl = document.querySelector('input[name="payment"]:checked');

  if (!methodEl) {
    alert('Please select a payment method');
    return;
  }
  const method = methodEl.value;

  if (!email || !name) {
    alert('Please enter your email and name');
    return;
  }

  const opt = getPaymentOption(method);
  let confirmMessage;

  if (opt && opt.workflow === 'managed') {
    confirmMessage = `Order placed! In production, this would redirect to ${opt.name === 'BetterNic-managed' ? 'Stripe Checkout' : 'wire instructions'}. You'll receive a confirmation email.`;
  } else if (opt) {
    confirmMessage = `Order initiated! The seller will be notified and will contact you within 24 hours to complete the transaction via ${opt.name}.`;
  } else {
    confirmMessage = `Order placed! Processing via ${method}.`;
  }

  try {
    await API.createOrder({
      listing_id: listing.id,
      buyer_email: email,
      buyer_name: name,
      payment_method: method,
      amount: listing.price,
    });
    alert(confirmMessage);
    window.location.href = '/';
  } catch (err) {
    alert('Error: ' + err.message);
  }
}

document.addEventListener('DOMContentLoaded', initCheckout);
