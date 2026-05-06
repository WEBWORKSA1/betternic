// BetterNic — Payment & Escrow Options
// Single source of truth. Add/remove/edit options here, all UI updates automatically.

const PAYMENT_OPTIONS = [
  {
    id: 'betternic',
    name: 'BetterNic-managed',
    short: 'BetterNic',
    desc: 'We handle payment via Stripe + Escrow.com. Fastest. Recommended for first-time sellers.',
    fee: 'Processing 2.9-3.25%',
    commission: 'auto-deducted',
    setup: 'No setup required',
    requires_seller_account: false,
    workflow: 'managed',
    badge: 'Recommended',
    sort: 1,
  },
  {
    id: 'escrow_com',
    name: 'Escrow.com',
    short: 'Escrow.com',
    desc: 'Industry-standard escrow service. You initiate the transaction with the buyer directly.',
    fee: '3.25%',
    commission: 'split via disbursement',
    setup: 'Seller needs Escrow.com account',
    requires_seller_account: true,
    workflow: 'self_managed',
    badge: 'Trusted',
    sort: 2,
  },
  {
    id: 'sedo_escrow',
    name: 'Sedo External Escrow',
    short: 'Sedo Escrow',
    desc: 'External transfer service. Email-initiated. Good if you already have a Sedo account.',
    fee: '~3% (variable based on past Sedo activity)',
    commission: 'manual after close',
    setup: 'Seller emails transferservice@sedo.com',
    requires_seller_account: true,
    workflow: 'self_managed',
    sort: 3,
  },
  {
    id: 'afternic_escrow',
    name: 'Afternic Escrow',
    short: 'Afternic',
    desc: 'For sellers with active Afternic accounts. Seller arranges directly with Afternic.',
    fee: 'Per Afternic policy',
    commission: 'manual after close',
    setup: 'Seller arranges with Afternic',
    requires_seller_account: true,
    workflow: 'self_managed',
    sort: 4,
  },
  {
    id: 'atom_escrow',
    name: 'Atom.com Escrow',
    short: 'Atom.com',
    desc: 'For sellers using Atom.com platform. Seller arranges directly with Atom.com.',
    fee: 'Per Atom policy',
    commission: 'manual after close',
    setup: 'Seller arranges with Atom.com',
    requires_seller_account: true,
    workflow: 'self_managed',
    sort: 5,
  },
  {
    id: 'efty_escrow',
    name: 'Efty Escrow',
    short: 'Efty',
    desc: 'For sellers using Efty platform. Seller arranges via their Efty setup.',
    fee: 'Per Efty policy',
    commission: 'manual after close',
    setup: 'Seller arranges with Efty',
    requires_seller_account: true,
    workflow: 'self_managed',
    sort: 6,
  },
  {
    id: 'stripe_seller',
    name: 'Direct via Stripe',
    short: 'Stripe',
    desc: 'Buyer pays directly to seller\'s Stripe account.',
    fee: 'Stripe 2.9% + $0.30',
    commission: 'manual after close',
    setup: 'Seller needs Stripe account + payment link',
    requires_seller_account: true,
    workflow: 'self_managed',
    sort: 7,
  },
  {
    id: 'paypal',
    name: 'PayPal',
    short: 'PayPal',
    desc: 'Direct PayPal transfer. Best for transactions under $5K. PayPal can reverse high-value transactions.',
    fee: 'PayPal 3.49% + $0.49',
    commission: 'manual after close',
    setup: 'Seller needs PayPal account',
    requires_seller_account: true,
    workflow: 'self_managed',
    badge: 'Small deals',
    sort: 8,
  },
  {
    id: 'wire_betternic',
    name: 'Wire to BetterNic',
    short: 'Wire',
    desc: 'Buyer wires funds to BetterNic account. We forward to seller after domain transfer confirmed.',
    fee: 'Wire fees apply (~$25)',
    commission: 'auto-deducted',
    setup: 'No setup required',
    requires_seller_account: false,
    workflow: 'managed',
    sort: 9,
  },
  {
    id: 'custom',
    name: 'Custom arrangement',
    short: 'Custom',
    desc: 'Specify your own payment instructions. Buyer will see your custom note at checkout.',
    fee: 'Variable',
    commission: 'manual after close',
    setup: 'Provide instructions when listing',
    requires_seller_account: false,
    workflow: 'self_managed',
    sort: 10,
  },
];

// Sorted by sort order
PAYMENT_OPTIONS.sort((a, b) => a.sort - b.sort);

// Helper: get option by ID
function getPaymentOption(id) {
  return PAYMENT_OPTIONS.find(o => o.id === id);
}

// Helper: filter to only seller-selected options for a listing
function getAcceptedPaymentOptions(listing) {
  if (!listing || !listing.payment_methods || !listing.payment_methods.length) {
    return [PAYMENT_OPTIONS[0]]; // Default to BetterNic-managed
  }
  return listing.payment_methods
    .map(id => getPaymentOption(id))
    .filter(Boolean);
}

// Helper: format payment method names for display on lander
function renderAcceptedMethodsLabel(listing) {
  const accepted = getAcceptedPaymentOptions(listing);
  if (accepted.length === 1) {
    return accepted[0].short;
  }
  if (accepted.length <= 3) {
    return accepted.map(o => o.short).join(' · ');
  }
  return `${accepted.slice(0, 2).map(o => o.short).join(' · ')} +${accepted.length - 2} more`;
}
