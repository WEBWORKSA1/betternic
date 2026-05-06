// BetterNic API layer — all Supabase interactions
// Includes graceful fallback to mock data if Supabase isn't configured yet

const MOCK_LISTINGS = [
  { id: 1, domain: 'finova.com', price: 28500, tagline: 'A premium 6-letter brandable for fintech and finance', category: 'finance', custody: 'parked', lto_enabled: true, status: 'active', registered_year: 2014 },
  { id: 2, domain: 'cryptoledger.io', price: 12000, tagline: 'Premium .io for crypto and blockchain projects', category: 'crypto', custody: 'self', lto_enabled: false, status: 'active', registered_year: 2018 },
  { id: 3, domain: 'aiagentcorp.com', price: 8900, tagline: 'Built for the AI agent era', category: 'ai', custody: 'parked', lto_enabled: true, status: 'active', registered_year: 2021 },
  { id: 4, domain: 'brewstack.com', price: 4200, tagline: 'Modern brandable for coffee, beer, or SaaS', category: 'brandable', custody: 'self', lto_enabled: false, status: 'active', registered_year: 2019 },
  { id: 5, domain: 'payora.com', price: 31500, tagline: '6-letter payment brandable', category: 'finance', custody: 'parked', lto_enabled: true, status: 'active', registered_year: 2015 },
  { id: 6, domain: 'lendoor.com', price: 18000, tagline: 'Lending and finance gateway brand', category: 'finance', custody: 'parked', lto_enabled: true, status: 'active', registered_year: 2017 },
  { id: 7, domain: 'neuralforge.ai', price: 15000, tagline: 'AI development platform name', category: 'ai', custody: 'parked', lto_enabled: true, status: 'active', registered_year: 2023 },
  { id: 8, domain: 'tokenmint.io', price: 22000, tagline: 'Web3 token issuance brand', category: 'crypto', custody: 'parked', lto_enabled: true, status: 'active', registered_year: 2020 },
];

const MOCK_COMPARABLES = {
  finance: [
    { domain: 'finvex.com', price: 42000, sold_date: 'Jan 2026', length: 6 },
    { domain: 'payora.com', price: 31500, sold_date: 'Dec 2025', length: 6 },
    { domain: 'moneta.io', price: 24000, sold_date: 'Nov 2025', length: 6 },
  ],
  ai: [
    { domain: 'neurix.ai', price: 38000, sold_date: 'Feb 2026', length: 6 },
    { domain: 'aitower.com', price: 19500, sold_date: 'Dec 2025', length: 7 },
    { domain: 'cogni.ai', price: 28000, sold_date: 'Jan 2026', length: 5 },
  ],
  crypto: [
    { domain: 'chainvex.com', price: 45000, sold_date: 'Jan 2026', length: 8 },
    { domain: 'minto.io', price: 17000, sold_date: 'Nov 2025', length: 5 },
    { domain: 'blockstack.com', price: 62000, sold_date: 'Oct 2025', length: 10 },
  ],
  default: [
    { domain: 'verda.com', price: 22000, sold_date: 'Jan 2026', length: 5 },
    { domain: 'lumio.com', price: 18500, sold_date: 'Dec 2025', length: 5 },
    { domain: 'novara.com', price: 31000, sold_date: 'Nov 2025', length: 6 },
  ],
};

const API = {
  isLive() {
    return supabaseClient !== null;
  },

  // ----- Listings -----
  async getFeatured(limit = 4) {
    if (!this.isLive()) return MOCK_LISTINGS.slice(0, limit);
    const { data, error } = await supabaseClient
      .from('listings')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) { console.error(error); return MOCK_LISTINGS.slice(0, limit); }
    return data;
  },

  async getAll(filters = {}) {
    if (!this.isLive()) return MOCK_LISTINGS;
    let q = supabaseClient.from('listings').select('*').eq('status', 'active');
    if (filters.search) q = q.ilike('domain', `%${filters.search}%`);
    if (filters.category && filters.category.length) q = q.in('category', filters.category);
    if (filters.minPrice) q = q.gte('price', filters.minPrice);
    if (filters.maxPrice) q = q.lte('price', filters.maxPrice);
    const { data, error } = await q;
    if (error) { console.error(error); return MOCK_LISTINGS; }
    return data;
  },

  async getByDomain(domain) {
    if (!this.isLive()) return MOCK_LISTINGS.find(l => l.domain === domain) || MOCK_LISTINGS[0];
    const { data, error } = await supabaseClient
      .from('listings')
      .select('*')
      .eq('domain', domain)
      .single();
    if (error) { console.error(error); return null; }
    return data;
  },

  async getMyListings() {
    if (!this.isLive()) return MOCK_LISTINGS;
    const user = (await supabaseClient.auth.getUser()).data.user;
    if (!user) return [];
    const { data, error } = await supabaseClient
      .from('listings')
      .select('*')
      .eq('seller_id', user.id)
      .order('created_at', { ascending: false });
    if (error) { console.error(error); return []; }
    return data;
  },

  async createListing(payload) {
    if (!this.isLive()) {
      console.log('MOCK createListing:', payload);
      return { success: true, id: Date.now() };
    }
    const user = (await supabaseClient.auth.getUser()).data.user;
    if (!user) throw new Error('Not authenticated');
    const { data, error } = await supabaseClient
      .from('listings')
      .insert([{ ...payload, seller_id: user.id, status: 'active' }])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async getComparables(category) {
    return MOCK_COMPARABLES[category] || MOCK_COMPARABLES.default;
  },

  // ----- Inquiries / offers -----
  async createOffer(payload) {
    if (!this.isLive()) {
      console.log('MOCK createOffer:', payload);
      return { success: true };
    }
    const { data, error } = await supabaseClient
      .from('offers')
      .insert([{ ...payload, status: 'pending' }])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async getMyInquiries() {
    if (!this.isLive()) return [];
    const user = (await supabaseClient.auth.getUser()).data.user;
    if (!user) return [];
    const { data, error } = await supabaseClient
      .from('offers')
      .select('*, listings!inner(domain, seller_id)')
      .eq('listings.seller_id', user.id)
      .order('created_at', { ascending: false });
    if (error) { console.error(error); return []; }
    return data;
  },

  // ----- Auth -----
  async signUp(email, password) {
    if (!this.isLive()) throw new Error('Connect Supabase to enable accounts');
    return supabaseClient.auth.signUp({ email, password });
  },

  async signIn(email, password) {
    if (!this.isLive()) throw new Error('Connect Supabase to enable accounts');
    return supabaseClient.auth.signInWithPassword({ email, password });
  },

  async signOut() {
    if (!this.isLive()) return;
    return supabaseClient.auth.signOut();
  },

  async getUser() {
    if (!this.isLive()) return { email: 'demo@betternic.com', id: 'demo' };
    const { data } = await supabaseClient.auth.getUser();
    return data.user;
  },

  // ----- Transactions / orders -----
  async createOrder(payload) {
    if (!this.isLive()) {
      console.log('MOCK createOrder:', payload);
      return { success: true, id: Date.now() };
    }
    const { data, error } = await supabaseClient
      .from('orders')
      .insert([{ ...payload, status: 'pending_payment' }])
      .select()
      .single();
    if (error) throw error;
    return data;
  },
};

// Render helper for domain cards
function renderDomainCard(listing) {
  const badge = listing.lto_enabled
    ? `<span class="badge badge-lto">Lease</span>`
    : `<span class="badge badge-bin">Buy now</span>`;
  return `
    <a href="/lander.html?d=${encodeURIComponent(listing.domain)}" class="domain-card">
      <div class="domain-name">${listing.domain}</div>
      <div class="domain-tag">${listing.tagline || ''}</div>
      <div class="domain-meta">
        <span class="price">${formatPrice(listing.price)}</span>
        ${badge}
      </div>
    </a>`;
}
