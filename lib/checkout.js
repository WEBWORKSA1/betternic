// Checkout logic

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

  // Calculate processing fee (default Stripe)
  updateFee('stripe', listing.price);

  // Payment method handlers
  document.querySelectorAll('.payment-option').forEach(opt => {
    opt.addEventListener('click', () => {
      document.querySelectorAll('.payment-option').forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
      opt.querySelector('input').checked = true;
      updateFee(opt.dataset.method, listing.price);
    });
  });

  // LTO options
  if (listing.lto_enabled) {
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
    // Attach handlers to new options
    document.querySelectorAll('.payment-option').forEach(opt => {
      opt.addEventListener('click', () => {
        document.querySelectorAll('.payment-option').forEach(o => o.classList.remove('selected'));
        opt.classList.add('selected');
        opt.querySelector('input').checked = true;
        updateFee(opt.dataset.method, listing.price);
      });
    });
  }

  window.__currentListing = listing;
}

function updateFee(method, price) {
  let fee = 0;
  if (method === 'stripe') fee = price * BETTERNIC_CONFIG.STRIPE_FEE.percent + BETTERNIC_CONFIG.STRIPE_FEE.fixed;
  else if (method === 'escrow') fee = price * BETTERNIC_CONFIG.ESCROW_FEE.percent;
  else if (method === 'wire') fee = 25;
  else if (method && method.startsWith('lto-')) {
    const m = parseInt(method.split('-')[1]);
    fee = calculateLTO(price, m); // first payment
    document.getElementById('s-fee').textContent = 'First payment';
    document.getElementById('s-total').textContent = formatPrice(fee);
    return;
  }
  document.getElementById('s-fee').textContent = formatPrice(Math.round(fee));
  document.getElementById('s-total').textContent = formatPrice(Math.round(price + fee));
}

async function completePurchase() {
  const listing = window.__currentListing;
  const email = document.getElementById('buyer-email').value.trim();
  const name = document.getElementById('buyer-name').value.trim();
  const method = document.querySelector('input[name="payment"]:checked').value;

  if (!email || !name) {
    alert('Please enter your email and name');
    return;
  }

  try {
    await API.createOrder({
      listing_id: listing.id,
      buyer_email: email,
      buyer_name: name,
      payment_method: method,
      amount: listing.price,
    });
    alert(`Order placed! In production, this would redirect to ${method === 'escrow' ? 'Escrow.com' : method === 'stripe' ? 'Stripe Checkout' : 'wire instructions'}. You'll receive a confirmation email shortly.`);
    window.location.href = '/';
  } catch (err) {
    alert('Error: ' + err.message);
  }
}

document.addEventListener('DOMContentLoaded', initCheckout);
