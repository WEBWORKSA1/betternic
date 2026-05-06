// BetterNic config
// Replace these values with your real Supabase project credentials
// Get them at: https://supabase.com/dashboard/project/_/settings/api

const BETTERNIC_CONFIG = {
  SUPABASE_URL: 'https://YOUR-PROJECT.supabase.co',
  SUPABASE_ANON_KEY: 'YOUR-ANON-PUBLIC-KEY',

  COMMISSION: {
    TIER_1: { max: 50000, rate: 0.05 },
    TIER_2: { max: 100000, rate: 0.04 },
    TIER_3: { max: Infinity, rate: 0.03 },
  },

  LTO_MARKUPS: {
    12: 0,
    24: 0.10,
    36: 0.20,
    48: 0.25,
    60: 0.30,
  },

  STRIPE_FEE: { percent: 0.029, fixed: 0.30 },
  ESCROW_FEE: { percent: 0.0325, fixed: 0 },

  BRAND: 'BetterNic',
  TAGLINE: 'A better way to buy, sell, and lease domains.',
  SUPPORT_EMAIL: 'support@betternic.com',
};

let supabaseClient = null;
if (typeof supabase !== 'undefined' && BETTERNIC_CONFIG.SUPABASE_URL.indexOf('YOUR-PROJECT') === -1) {
  supabaseClient = supabase.createClient(
    BETTERNIC_CONFIG.SUPABASE_URL,
    BETTERNIC_CONFIG.SUPABASE_ANON_KEY
  );
}

function calculateCommission(price) {
  const tiers = BETTERNIC_CONFIG.COMMISSION;
  if (price < tiers.TIER_1.max) return price * tiers.TIER_1.rate;
  if (price < tiers.TIER_2.max) return price * tiers.TIER_2.rate;
  return price * tiers.TIER_3.rate;
}

function commissionRateForPrice(price) {
  if (price < 50000) return '5%';
  if (price < 100000) return '4%';
  return '3%';
}

function calculateLTO(price, months) {
  const markup = BETTERNIC_CONFIG.LTO_MARKUPS[months] || 0;
  const total = price * (1 + markup);
  return Math.round(total / months);
}

function formatPrice(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount);
}
