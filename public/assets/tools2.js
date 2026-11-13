/* BetterNic tools — part 2: acquire, sell, portfolio, legal */
(function () {
  'use strict';
  var BN = window.BN, A = window.BNAppraise, T = window.BNT, H = T._h, esc = BN.esc;
  function num(id, root) { var v = parseFloat((H.$('#' + id, root) || {}).value); return isNaN(v) ? 0 : v; }
  function fld(id, label, val, type, extra) {
    return '<div class="field"><label for="' + id + '">' + label + '</label><input id="' + id + '" type="' + (type || 'number') + '" value="' + esc(val == null ? '' : val) + '" ' + (extra || '') + '></div>';
  }
  function copyBox(title, text) {
    return '<div class="card" style="margin-top:12px"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><h3 style="margin:0">' + esc(title) + '</h3><button class="btn btn-ghost btn-sm" type="button" data-copytext>Copy</button></div><pre class="code" style="white-space:pre-wrap;margin-top:10px">' + esc(text) + '</pre></div>';
  }
  document.addEventListener('click', function (ev) {
    var b = ev.target.closest && ev.target.closest('[data-copytext]');
    if (b) BN.copy(b.closest('.card').querySelector('pre').textContent);
  });
  var MARKUP = { 12: 0, 24: .1, 36: .2, 48: .25, 60: .3 };
  function commission(v) { return v * (v < 50000 ? .05 : v < 100000 ? .04 : .03); }

  /* =============== ACQUIRE =============== */
  T['domain-auctions'] = function (root) {
    root.innerHTML = '<p class="muted"><span class="spinner"></span> Loading today\'s auctions…</p>';
    BN.data('auctions').then(function (j) {
      var items = j.items || [];
      if (!items.length) { root.innerHTML = '<div class="empty">Today\'s auction feed is refreshing. Check back shortly.</div>'; return; }
      var tlds = {}; items.forEach(function (x) { tlds[x.tl] = (tlds[x.tl] || 0) + 1; });
      var tldOpts = Object.keys(tlds).sort(function (a, b) { return tlds[b] - tlds[a]; }).slice(0, 30).map(function (t) { return '<option value="' + esc(t) + '">.' + esc(t) + ' (' + tlds[t] + ')</option>'; }).join('');
      root.innerHTML = '<div class="filters">' +
        '<select id="av"><option value="score">Top BetterNic score</option><option value="bids">Most bids</option><option value="end">Ending soonest</option><option value="traffic">Most traffic</option><option value="price">Lowest price</option></select>' +
        '<select id="at"><option value="">All extensions</option>' + tldOpts + '</select>' +
        '<input id="aq" type="search" placeholder="Keyword">' +
        '<input id="al" type="number" min="1" placeholder="Max length">' +
        '<input id="ap" type="number" min="1" placeholder="Max price $">' +
        '<label class="check"><input type="checkbox" id="ah" checked> No hyphens/numbers</label></div>' +
        '<p class="small"><span class="live-dot" style="display:inline-block"></span> <b id="ac"></b> auctions · snapshot ' + BN.date(j.updated) + ' from ' + esc(j.source || 'public auction inventory') + ' · ' + BN.num(j.scanned) + ' listings scanned</p>' +
        '<div class="table-wrap"><table><thead><tr><th>Domain</th><th class="num">Score</th><th class="num">Price</th><th class="num">Bids</th><th class="num">Traffic</th><th class="num">Age</th><th>Ends</th><th></th></tr></thead><tbody></tbody></table></div>' +
        '<div class="tool-actions"><button class="btn btn-ghost" type="button" id="amore">Show more</button><button class="btn btn-ghost" type="button" id="acsv">Export CSV</button></div>';
      var shown = 50, filtered = [];
      function run() {
        var v = H.$('#av', root).value, t = H.$('#at', root).value, q = H.$('#aq', root).value.trim().toLowerCase(),
          ml = num('al', root), mp = num('ap', root), hide = H.$('#ah', root).checked;
        filtered = items.filter(function (x) {
          return (!t || x.tl === t) && (!q || x.d.indexOf(q) !== -1) && (!ml || x.n <= ml) && (!mp || (x.p || 0) <= mp) && (!hide || !/[-0-9]/.test(x.d.split('.')[0]));
        });
        var key = { score: function (x) { return -x.s; }, bids: function (x) { return -(x.b || 0); }, end: function (x) { return new Date(x.e || 8e15).getTime(); }, traffic: function (x) { return -(x.t || 0); }, price: function (x) { return x.p || 0; } }[v];
        filtered.sort(function (a, b) { return key(a) - key(b); });
        H.$('#ac', root).textContent = BN.num(filtered.length);
        H.$('tbody', root).innerHTML = filtered.slice(0, shown).map(function (x) {
          return '<tr><td class="dn"><a href="/tools/domain-report.html?d=' + encodeURIComponent(x.d) + '">' + esc(x.d) + '</a></td><td class="num">' + x.s + '</td><td class="num">' + (x.p != null ? BN.money(x.p) : '—') + '</td><td class="num">' + (x.b != null ? x.b : '—') + '</td><td class="num">' + (x.t != null ? BN.num(x.t) : '—') + '</td><td class="num">' + (x.a != null ? x.a + 'y' : '—') + '</td><td data-until="' + esc(x.e || '') + '">' + (x.e ? BN.until(x.e) : '—') + '</td><td>' + (x.l ? '<a class="btn btn-ghost btn-sm" href="' + esc(x.l) + '" target="_blank" rel="noopener nofollow">Bid ↗</a>' : '') + '</td></tr>';
        }).join('') || '<tr><td colspan="8" class="muted">No auctions match these filters.</td></tr>';
        H.$('#amore', root).hidden = filtered.length <= shown;
      }
      ['av', 'at', 'ah'].forEach(function (id) { H.$('#' + id, root).addEventListener('change', function () { shown = 50; run(); }); });
      ['aq', 'al', 'ap'].forEach(function (id) { H.$('#' + id, root).addEventListener('input', function () { shown = 50; run(); }); });
      H.$('#amore', root).addEventListener('click', function () { shown += 100; run(); });
      H.$('#acsv', root).addEventListener('click', function () {
        BN.download('betternic-auctions-' + (j.updated || '').slice(0, 10) + '.csv', BN.csv([['domain', 'score', 'price_usd', 'bids', 'traffic', 'age_years', 'ends', 'link']].concat(filtered.map(function (x) { return [x.d, x.s, x.p, x.b, x.t, x.a, x.e, x.l]; }))), 'text/csv');
      });
      var q0 = BN.param('q'); if (q0) H.$('#aq', root).value = q0;
      run();
    }).catch(function () { root.innerHTML = '<div class="empty">Today\'s auction feed is refreshing. Check back shortly.</div>'; });
  };

  T['drop-date-calculator'] = function (root) {
    root.innerHTML = H.input({ button: 'Calculate', placeholder: 'example.com (optional)', extra: fld('dx', 'Or expiry date', '', 'date', 'style="max-width:180px"') + fld('dd', 'Days to deletion', 35, 'number', 'min="0" max="45"') }).replace('<div class="field"><label for="dd">', '<div class="field" style="max-width:150px"><label for="dd">');
    H.bind(root, function (raw, out) {
      var p = BN.parseDomain(raw), manual = H.$('#dx', root).value;
      function draw(exp) {
        var e = new Date(exp); if (isNaN(e)) { out.innerHTML = '<div class="notice warn">Enter a domain or an expiry date.</div>'; return; }
        var del = num('dd', root) || 35, add = function (d) { var x = new Date(e); x.setUTCDate(x.getUTCDate() + d); return x; };
        var stages = [['Expiry date', add(0), 'Registration lapses; site and email may stop working.'],
          ['Typical registrar expired-auction window', add(Math.max(0, del - 10)), 'Many registrars auction expired names roughly 25–35 days after expiry.'],
          ['Deletion requested — redemption begins', add(del), 'Previous owner can still restore for 30 days, usually for a fee.'],
          ['Pending delete begins', add(del + 30), 'No one can renew or restore now. Backorders matter.'],
          ['Expected drop / release', add(del + 35), 'The name is released and drop-catching services try to register it.']];
        var now = Date.now();
        out.innerHTML = '<div class="table-wrap"><table><thead><tr><th>Stage</th><th>Date (UTC)</th><th>What happens</th></tr></thead><tbody>' + stages.map(function (s) {
          var past = s[1].getTime() < now;
          return '<tr' + (past ? ' style="opacity:.55"' : '') + '><td><b>' + s[0] + '</b></td><td>' + s[1].toISOString().slice(0, 10) + '</td><td class="small">' + s[2] + '</td></tr>';
        }).join('') + '</tbody></table></div><p class="small">Estimates for typical gTLDs (.com, .net, .org). The owner can renew at any time before redemption ends, and registrars may sell the name earlier. Country-code extensions have their own rules.</p>' +
          (p ? '<div class="tool-actions"><a class="btn btn-ghost btn-sm" href="/tools/domain-auctions.html?q=' + encodeURIComponent(p.sld) + '">Search today\'s auctions</a><a class="btn btn-ghost btn-sm" href="/leads.html?intent=buy&d=' + encodeURIComponent(p.domain) + '">Ask us to acquire it</a></div>' : '');
      }
      if (manual) return draw(manual);
      if (!p) { out.innerHTML = '<div class="notice warn">Enter a domain or an expiry date.</div>'; return; }
      H.loading(out);
      H.rdap(p).then(function (r) {
        if (r.state === 'registered' && r.info.expiration) { H.$('#dx', root).value = r.info.expiration.slice(0, 10); draw(r.info.expiration); }
        else out.innerHTML = H.rdapHtml(p, r);
      });
    }, { raw: true });
  };

  var PRE = ['get', 'try', 'go', 'my', 'the', 'hey', 'use', 'join', 'meet', 'hello', 'on', 'up', 'pro', 'top', 'neo', 'one', 'true', 'smart', 'bright', 'clear'];
  var SUF = ['ly', 'ify', 'hub', 'lab', 'labs', 'hq', 'base', 'stack', 'flow', 'kit', 'works', 'zone', 'spot', 'nest', 'craft', 'wise', 'able', 'io', 'nova', 'scape', 'verse', 'bit', 'loop', 'pilot', 'forge', 'mint', 'path', 'well', 'sync', 'point'];
  var BRANDW = ['bloom', 'spark', 'peak', 'pulse', 'wave', 'nova', 'north', 'bright', 'swift', 'bold', 'clear', 'true', 'prime', 'river', 'stone', 'cedar', 'maple', 'orbit', 'atlas', 'echo', 'lumen', 'solar', 'tidal', 'ember', 'vivid', 'zen', 'fox', 'owl', 'bee', 'leaf', 'oak', 'pine', 'coral', 'lime', 'mint', 'sage', 'rise', 'shift', 'craft', 'field', 'harbor', 'summit', 'compass', 'anchor', 'beacon', 'bridge', 'canvas', 'signal', 'vector', 'quill'];
  var BAD = /(fuck|shit|cunt|nigg|porn|sex|rape|nazi|kill|dick|cock|slut|whore|fag)/;
  T['domain-name-generator'] = function (root) {
    root.innerHTML = H.input({ label: 'Keywords (1–3 words)', placeholder: 'coffee roast', button: 'Generate', extra: '<div class="field" style="max-width:130px"><label for="gt">Extension</label><select id="gt"><option>com</option><option>io</option><option>ai</option><option>co</option><option>app</option><option>net</option><option>org</option><option>xyz</option></select></div><div class="field" style="max-width:120px"><label for="gm">Max length</label><input id="gm" type="number" value="14" min="4" max="30"></div>' });
    H.bind(root, function (raw, out) {
      var kws = raw.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/).filter(Boolean).slice(0, 3);
      if (!kws.length) { out.innerHTML = '<div class="notice warn">Enter at least one keyword.</div>'; return; }
      var tld = H.$('#gt', root).value, max = num('gm', root) || 14, set = {};
      function add(n, style) { n = n.replace(/[^a-z0-9]/g, ''); if (n.length >= 3 && n.length <= max && !BAD.test(n) && !set[n]) set[n] = style; }
      kws.forEach(function (k) {
        PRE.forEach(function (p) { add(p + k, 'Prefix'); });
        SUF.forEach(function (s) { add(k + s, 'Suffix'); add(k.replace(/[aeiou]$/, '') + s, 'Suffix'); });
        BRANDW.forEach(function (w) { add(k + w, 'Compound'); add(w + k, 'Compound'); });
        var stem = k.replace(/[aeiouy]+$/, ''); ['a', 'o', 'io', 'ia', 'ex', 'eo', 'ix', 'ora', 'ova', 'era'].forEach(function (end) { add(stem + end, 'Invented'); });
        if (k.length > 4) { add(k.slice(0, 4) + 'ly', 'Invented'); add(k.slice(0, 3) + 'ora', 'Invented'); add(k.slice(0, 5) + 'o', 'Invented'); }
      });
      if (kws.length > 1) { add(kws.join(''), 'Exact'); add(kws.slice().reverse().join(''), 'Exact'); add(kws[0] + kws[1].slice(Math.max(0, kws[1].length - 3)), 'Blend'); add(kws[0].slice(0, Math.ceil(kws[0].length / 2)) + kws[1].slice(Math.floor(kws[1].length / 2)), 'Blend'); }
      H.words().then(function () {
        var list = Object.keys(set).map(function (n) { var p = BN.parseDomain(n + '.' + tld); return { n: n, d: p.domain, style: set[n], b: A.brandability(p).score }; })
          .sort(function (a, b) { return b.b - a.b; }).slice(0, 150);
        out.innerHTML = '<p class="small">' + list.length + ' ideas, sorted by brandability. <button class="linkish" type="button" id="gall">Check top 30</button></p><div class="table-wrap"><table><thead><tr><th>Name</th><th>Style</th><th class="num">Brandability</th><th>Availability</th></tr></thead><tbody>' +
          list.map(function (x) { return '<tr data-d="' + x.d + '"><td class="dn">' + x.d + '</td><td class="small">' + x.style + '</td><td class="num">' + x.b + '</td><td><button class="btn btn-ghost btn-sm" type="button" data-chk="' + x.d + '">Check</button></td></tr>'; }).join('') + '</tbody></table></div>';
        function chk(d) {
          var cell = H.$('tr[data-d="' + d + '"] td:last-child', out); cell.innerHTML = '<span class="spinner"></span>';
          return H.availability(d).then(function (s) { cell.innerHTML = H.badge(s) + (s !== 'registered' ? ' <a class="small" href="/tools/whois-lookup.html?d=' + d + '">verify</a>' : ''); });
        }
        H.$$('[data-chk]', out).forEach(function (b) { b.onclick = function () { chk(b.getAttribute('data-chk')); }; });
        H.$('#gall', out).onclick = function () { H.pool(list.slice(0, 30).map(function (x) { return x.d; }), 4, chk); };
      });
    }, { raw: true });
  };

  T['domain-hack-finder'] = function (root) {
    root.innerHTML = H.input({ label: 'Word or brand', placeholder: 'delicious', button: 'Find hacks' });
    H.bind(root, function (raw, out) {
      var w = raw.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (w.length < 3) { out.innerHTML = '<div class="notice warn">Enter a word of three or more letters.</div>'; return; }
      H.loading(out);
      BN.data('tlds').then(function (j) {
        var hits = [];
        (j.tlds || []).forEach(function (t) {
          if (/^xn--/.test(t.t)) return;
          if (w.length > t.t.length + 1 && w.slice(-t.t.length) === t.t) hits.push({ d: w.slice(0, -t.t.length) + '.' + t.t, g: t.g });
          for (var i = 2; i < w.length - t.t.length; i++) {
            if (w.slice(i, i + t.t.length) === t.t && i + t.t.length < w.length && w.length - (i + t.t.length) <= 6) {
              hits.push({ d: w.slice(0, i) + '.' + t.t + '/' + w.slice(i + t.t.length), g: t.g, path: true });
            }
          }
        });
        if (!hits.length) { out.innerHTML = '<div class="notice">No exact hacks for "' + esc(w) + '". Try a plural, a verb form or a related word.</div>'; return; }
        hits.sort(function (a, b) { return (a.path ? 1 : 0) - (b.path ? 1 : 0) || a.d.length - b.d.length; });
        out.innerHTML = '<div class="chips">' + hits.slice(0, 120).map(function (h) {
          var dom = h.d.split('/')[0];
          return '<a class="chip" href="/tools/whois-lookup.html?d=' + encodeURIComponent(dom) + '" title="' + esc(h.g) + (h.path ? ' — uses a URL path' : '') + '">' + esc(h.d) + '</a>';
        }).join('') + '</div><p class="small">Click a hack to check its registration. Entries with "/" spell the word using a URL path.</p>';
      });
    }, { raw: true });
  };

  T['acquisition-email-generator'] = function (root) {
    root.innerHTML = '<div class="grid-2">' + fld('ad', 'Domain you want', BN.param('d'), 'text', 'placeholder="example.com"') + fld('an', 'Your first name', '', 'text') + '</div>' +
      '<div class="grid-2"><div class="field"><label for="aa">Approach</label><select id="aa"><option value="friendly">Friendly inquiry (no number)</option><option value="offer">Firm offer</option><option value="lease">Lease-to-own proposal</option></select></div>' +
      fld('ao', 'Offer amount (USD, for firm offer/lease)', '', 'number') + '</div>' +
      '<div class="grid-2"><div class="field"><label for="au">Use</label><select id="au"><option value="project">A personal project</option><option value="business">My small business</option><option value="startup">A new startup</option></select></div><div class="field"><label for="ae">Escrow</label><select id="ae"><option>Escrow.com</option><option>BetterNic-managed escrow</option><option>Your preferred escrow</option></select></div></div>' +
      '<button class="btn btn-primary" type="button" id="ago">Write email</button><div class="tool-out"></div>';
    H.$('#ago', root).addEventListener('click', function () {
      var p = BN.parseDomain(H.$('#ad', root).value), name = H.$('#an', root).value.trim() || '[Your name]', ap = H.$('#aa', root).value, amt = num('ao', root), use = H.$('#au', root).value, esw = H.$('#ae', root).value;
      if (!p) { H.$('.tool-out', root).innerHTML = '<div class="notice warn">Enter the domain you want.</div>'; return; }
      var useTxt = { project: 'a personal project', business: 'my small business', startup: 'a new venture I\'m starting' }[use], s, b;
      if (ap === 'friendly') { s = 'Question about ' + p.domain; b = 'Hi,\n\nI came across ' + p.domain + ' and I\'m interested in acquiring it for ' + useTxt + '.\n\nWould you consider selling it? If so, could you share a price you\'d be comfortable with? I\'m happy to use ' + esw + ' so the transaction is safe for both of us.\n\nThanks for your time,\n' + name; }
      else if (ap === 'offer') { s = 'Offer for ' + p.domain + ': ' + BN.money(amt || 0); b = 'Hi,\n\nI\'d like to make a firm offer of ' + BN.money(amt || 0) + ' for ' + p.domain + '. I can pay through ' + esw + ' and cover the escrow fee, and I\'m ready to move this week.\n\nIf the number doesn\'t work for you, let me know what would — I\'m a genuine buyer.\n\nBest regards,\n' + name; }
      else { var m = 24, total = (amt || 0) * (1 + MARKUP[m]); s = 'Lease-to-own proposal for ' + p.domain; b = 'Hi,\n\nI\'m interested in ' + p.domain + ' for ' + useTxt + '. Would you consider a lease-to-own arrangement?\n\nI could pay ' + BN.money(total / m) + ' per month for ' + m + ' months (' + BN.money(total) + ' total), with ownership transferring after the final payment. The domain would stay under your control until then, and we can use ' + esw + ' or a lease agreement to protect both sides.\n\nOpen to adjusting the term or a down payment.\n\nThanks,\n' + name; }
      var f1 = 'Subject: Re: ' + s + '\n\nHi,\n\nJust following up on my note about ' + p.domain + '. Still interested if you\'re open to it.\n\n' + name;
      H.$('.tool-out', root).innerHTML = copyBox('Subject', s) + copyBox('Email', b) + copyBox('Follow-up (send 7 days later)', f1) +
        '<div class="notice">Find the owner\'s contact route with the <a href="/tools/whois-lookup.html?d=' + encodeURIComponent(p.domain) + '">WHOIS lookup</a>, or let a BetterNic broker approach them anonymously: <a href="/leads.html?intent=buy&d=' + encodeURIComponent(p.domain) + '">request an acquisition</a>.</div>';
    });
  };

  T['offer-strategy-planner'] = function (root) {
    root.innerHTML = '<div class="grid-3">' + fld('ov', 'Estimated value (USD)', '', 'number') + fld('oa', 'Seller\'s asking price (optional)', '', 'number') + fld('ob', 'Your maximum budget', '', 'number') + '</div>' +
      '<div class="field" style="max-width:260px"><label for="os">Style</label><select id="os"><option value="patient">Patient (start low, small steps)</option><option value="firm">Firm (credible first offer)</option></select></div>' +
      '<button class="btn btn-primary" type="button" id="ogo">Plan</button><div class="tool-out"></div>';
    H.$('#ogo', root).addEventListener('click', function () {
      var v = num('ov', root), a = num('oa', root), b = num('ob', root), st = H.$('#os', root).value, out = H.$('.tool-out', root);
      if (!b) { out.innerHTML = '<div class="notice warn">Enter your maximum budget.</div>'; return; }
      var open = Math.min(b * (st === 'patient' ? .45 : .6), v ? v * (st === 'patient' ? .5 : .7) : b), steps = [open], gap = b - open;
      [.4, .3, .2].forEach(function (f) { var nx = steps[steps.length - 1] + gap * f; steps.push(Math.min(nx, b)); gap = b - steps[steps.length - 1]; });
      steps.push(b);
      out.innerHTML = '<div class="table-wrap"><table><thead><tr><th>Round</th><th class="num">Your offer</th><th>Note</th></tr></thead><tbody>' + steps.map(function (x, i) {
        return '<tr><td>' + (i === 0 ? 'Opening' : i === steps.length - 1 ? 'Walk-away' : 'Counter ' + i) + '</td><td class="num">' + BN.money(Math.round(x / 10) * 10) + '</td><td class="small">' + (i === 0 ? 'Give one reason for the number (comparable sales, budget).' : i === steps.length - 1 ? 'Final offer — say so, then propose lease-to-own if it fails.' : 'Concede less each round to signal you are near your limit.') + '</td></tr>';
      }).join('') + '</tbody></table></div>' + (a && a > b ? '<div class="notice warn">The asking price is ' + Math.round((a / b - 1) * 100) + '% above your budget. Consider a lease-to-own offer or a different name.</div>' : '');
    });
  };

  /* =============== SELL =============== */
  T['for-sale-lander-builder'] = function (root) {
    root.innerHTML = '<div class="grid-2"><div>' + fld('ld', 'Domain', BN.param('d') || 'example.com', 'text') + fld('lp', 'Price (USD, blank = make offer)', '', 'number') +
      fld('lt', 'Short description', 'A premium, memorable name for your next brand.', 'text') + fld('lc', 'Contact or listing URL', 'https://betternic.com/sell.html', 'url') +
      '<div class="field"><label for="lth">Theme</label><select id="lth"><option value="ink">Ink (dark)</option><option value="paper">Paper (light)</option><option value="emerald">Emerald</option></select></div>' +
      '<label class="check"><input type="checkbox" id="llt" checked> Mention lease-to-own payments</label>' +
      '<div class="tool-actions"><button class="btn btn-primary" type="button" id="ldl">Download HTML</button><a class="btn btn-ghost" id="lls" href="/sell.html">List on BetterNic instead</a></div></div>' +
      '<div><iframe id="lpv" title="Lander preview" style="width:100%;height:440px;border:1px solid var(--line);border-radius:12px;background:#fff"></iframe></div></div>';
    function page() {
      var d = esc(H.$('#ld', root).value.trim() || 'example.com'), pr = num('lp', root), desc = esc(H.$('#lt', root).value), url = esc(H.$('#lc', root).value || '#'), th = H.$('#lth', root).value;
      var c = { ink: ['#0b0b0c', '#f3f2ee', '#34d399'], paper: ['#faf9f6', '#0b0b0c', '#0e9f6e'], emerald: ['#064e3b', '#ecfdf5', '#fbbf24'] }[th];
      var lto = H.$('#llt', root).checked && pr >= 1000 ? '<p class="s">Or lease to own from ' + BN.money(pr * 1.3 / 60) + '/month</p>' : '';
      return '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + d + ' is for sale</title><meta name="description" content="' + d + ' is available. ' + desc + '"><meta property="og:title" content="' + d + ' is for sale">' +
        '<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:' + c[0] + ';color:' + c[1] + ';font:16px/1.6 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;text-align:center;padding:24px}main{max-width:640px}.e{letter-spacing:.12em;text-transform:uppercase;font-size:12px;opacity:.7}h1{font:700 clamp(34px,8vw,64px)/1.05 ui-monospace,Menlo,monospace;margin:.2em 0;word-break:break-all}.p{font-size:28px;font-weight:700;margin:.6em 0 .2em}.s{opacity:.75;margin:.2em 0}a.b{display:inline-block;margin-top:22px;background:' + c[2] + ';color:' + c[0] + ';padding:14px 26px;border-radius:12px;font-weight:700;text-decoration:none}footer{margin-top:28px;font-size:12px;opacity:.6}</style></head>' +
        '<body><main><p class="e">This domain is for sale</p><h1>' + d + '</h1><p class="s">' + desc + '</p><p class="p">' + (pr ? BN.money(pr) : 'Make an offer') + '</p>' + lto +
        '<a class="b" href="' + url + '" rel="nofollow">' + (pr ? 'Buy or make an offer' : 'Make an offer') + '</a><footer>Secure escrow available · Transfer within 1–5 days</footer></main></body></html>';
    }
    function prev() { H.$('#lpv', root).srcdoc = page(); H.$('#lls', root).href = '/sell.html?d=' + encodeURIComponent(H.$('#ld', root).value.trim()); }
    H.$$('input,select', root).forEach(function (x) { x.addEventListener('input', prev); x.addEventListener('change', prev); });
    H.$('#ldl', root).addEventListener('click', function () { BN.download('index.html', page(), 'text/html'); });
    prev();
  };

  T['social-card-generator'] = function (root) {
    root.innerHTML = '<div class="grid-2"><div>' + fld('sd', 'Domain', BN.param('d') || 'example.com', 'text') + fld('sp', 'Price (optional)', '', 'number') + fld('st', 'Tagline (optional)', 'Premium domain for sale', 'text') +
      '<div class="grid-2"><div class="field"><label for="ss">Style</label><select id="ss"><option value="ink">Ink</option><option value="paper">Paper</option><option value="emerald">Emerald</option><option value="sunset">Sunset</option></select></div>' +
      '<div class="field"><label for="sz">Size</label><select id="sz"><option value="1200x630">1200×630 (posts, links)</option><option value="1080x1080">1080×1080 (square)</option></select></div></div>' +
      '<button class="btn btn-primary" type="button" id="sdl">Download PNG</button></div><div><canvas class="preview" id="sc" width="1200" height="630"></canvas></div></div>';
    var cv = H.$('#sc', root), ctx = cv.getContext('2d');
    function draw() {
      var sz = H.$('#sz', root).value.split('x'), W = +sz[0], Hh = +sz[1]; cv.width = W; cv.height = Hh;
      var s = H.$('#ss', root).value, pal = { ink: ['#0b0b0c', '#1c1c20', '#f3f2ee', '#34d399'], paper: ['#faf9f6', '#ece9e1', '#0b0b0c', '#0e9f6e'], emerald: ['#064e3b', '#065f46', '#ecfdf5', '#fbbf24'], sunset: ['#3b0764', '#be185d', '#fff7ed', '#fde68a'] }[s];
      var g = ctx.createLinearGradient(0, 0, W, Hh); g.addColorStop(0, pal[0]); g.addColorStop(1, pal[1]); ctx.fillStyle = g; ctx.fillRect(0, 0, W, Hh);
      var d = (H.$('#sd', root).value.trim() || 'example.com').toLowerCase(), tag = H.$('#st', root).value, pr = num('sp', root);
      ctx.fillStyle = pal[3]; ctx.font = '600 ' + Math.round(W * .022) + 'px Inter, system-ui, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText((tag || 'Domain for sale').toUpperCase(), W / 2, Hh * .3);
      var fs = Math.round(W * .1); ctx.font = '700 ' + fs + 'px "JetBrains Mono", ui-monospace, monospace';
      while (ctx.measureText(d).width > W * .88 && fs > 20) { fs -= 4; ctx.font = '700 ' + fs + 'px "JetBrains Mono", ui-monospace, monospace'; }
      ctx.fillStyle = pal[2]; ctx.fillText(d, W / 2, Hh * .52);
      if (pr) { ctx.font = '700 ' + Math.round(W * .045) + 'px Inter, system-ui, sans-serif'; ctx.fillStyle = pal[3]; ctx.fillText(BN.money(pr), W / 2, Hh * .68); }
      ctx.font = '500 ' + Math.round(W * .02) + 'px Inter, system-ui, sans-serif'; ctx.fillStyle = pal[2]; ctx.globalAlpha = .65; ctx.fillText('Listed on BetterNic · betternic.com', W / 2, Hh * .88); ctx.globalAlpha = 1;
    }
    H.$$('input,select', root).forEach(function (x) { x.addEventListener('input', draw); x.addEventListener('change', draw); });
    H.$('#sdl', root).addEventListener('click', function () { cv.toBlob(function (b) { BN.download((H.$('#sd', root).value.trim() || 'domain') + '-card.png', b); }); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(draw); draw();
  };

  T['sales-outreach-generator'] = function (root) {
    root.innerHTML = '<div class="grid-2">' + fld('od', 'Your domain', BN.param('d'), 'text', 'placeholder="example.com"') + fld('op', 'Price (optional)', '', 'number') + '</div>' +
      '<div class="grid-2">' + fld('oc', 'Buyer company or industry', '', 'text', 'placeholder="Acme Roofing / roofing companies"') + '<div class="field"><label for="oa">Angle</label><select id="oa"><option value="upgrade">Brand upgrade to a shorter/.com name</option><option value="keyword">Exact keyword match</option><option value="protect">Protect your brand from competitors</option><option value="expand">New product or market expansion</option></select></div></div>' +
      fld('on', 'Your name', '', 'text') + '<button class="btn btn-primary" type="button" id="ogo2">Write pitch</button><div class="tool-out"></div>';
    H.$('#ogo2', root).addEventListener('click', function () {
      var p = BN.parseDomain(H.$('#od', root).value), co = H.$('#oc', root).value.trim() || 'your company', pr = num('op', root), ang = H.$('#oa', root).value, nm = H.$('#on', root).value.trim() || '[Your name]';
      if (!p) { H.$('.tool-out', root).innerHTML = '<div class="notice warn">Enter your domain.</div>'; return; }
      var hook = { upgrade: p.domain + ' is a shorter, easier-to-remember web address that could make ' + co + ' easier to find and recommend.', keyword: p.domain + ' matches exactly what customers type when they look for ' + co + '\'s services.', protect: p.domain + ' is closely related to ' + co + '\'s market, and I wanted to offer it to you before anyone else.', expand: 'If ' + co + ' is planning a new product or region, ' + p.domain + ' could be a ready-made home for it.' }[ang];
      var priceLine = pr ? 'It\'s available for ' + BN.money(pr) + ', with secure escrow and lease-to-own options.' : 'I\'m open to a reasonable offer, with secure escrow and lease-to-own options.';
      var body = 'Hi,\n\n' + hook + '\n\n' + priceLine + '\n\nWould it be worth a quick look? If it isn\'t relevant, just reply "no" and I won\'t follow up.\n\n' + nm;
      H.$('.tool-out', root).innerHTML = copyBox('Subject', p.domain + ' for ' + co) + copyBox('First email', body) +
        copyBox('Follow-up 1 (after 5 days)', 'Hi,\n\nQuick follow-up on ' + p.domain + '. Happy to answer any questions or share how the transfer works.\n\n' + nm) +
        copyBox('Follow-up 2 (after 10 days)', 'Hi,\n\nLast note from me on ' + p.domain + ' — I\'ll be offering it to others in your space next week. Let me know if you\'d like first refusal.\n\n' + nm) +
        '<div class="notice warn">Follow anti-spam law where your recipients live (for example CASL in Canada, CAN-SPAM in the US, GDPR/PECR in the UK and EU). Identify yourself and stop when asked.</div>';
    });
  };

  T['lease-to-own-calculator'] = function (root) {
    root.innerHTML = '<div class="grid-3">' + fld('lp2', 'Domain price (USD)', BN.param('price') || 10000) + fld('ld2', 'Down payment (USD)', 0) + '<div class="field"><label>&nbsp;</label><button class="btn btn-primary" type="button" id="lgo">Calculate</button></div></div><div class="tool-out"></div>';
    function run() {
      var pr = num('lp2', root), dn = Math.min(num('ld2', root), pr), fin = pr - dn;
      H.$('.tool-out', root).innerHTML = '<div class="table-wrap"><table><thead><tr><th>Term</th><th class="num">Markup</th><th class="num">Monthly</th><th class="num">Total paid</th><th class="num">Extra vs buy now</th></tr></thead><tbody>' +
        Object.keys(MARKUP).map(function (m) { var tot = fin * (1 + MARKUP[m]); return '<tr><td>' + m + ' months</td><td class="num">' + Math.round(MARKUP[m] * 100) + '%</td><td class="num"><b>' + BN.money(tot / m) + '</b></td><td class="num">' + BN.money(tot + dn) + '</td><td class="num">' + BN.money(tot - fin) + '</td></tr>'; }).join('') + '</tbody></table></div>' +
        '<p class="small">BetterNic lease markups: 12 mo 0% · 24 mo 10% · 36 mo 20% · 48 mo 25% · 60 mo 30%, applied to the financed amount after any down payment.</p>';
    }
    H.$('#lgo', root).addEventListener('click', run); H.$$('input', root).forEach(function (x) { x.addEventListener('input', run); }); run();
  };

  T['marketplace-fee-calculator'] = function (root) {
    root.innerHTML = '<div class="grid-4">' + fld('fp', 'Sale price (USD)', 25000) + fld('fr', 'Other marketplace commission %', 15) + fld('fe', 'Escrow fee % (seller share)', 1.5) + fld('fx', 'Payment/wire fees (USD)', 25) + '</div><div class="tool-out"></div>';
    function run() {
      var p = num('fp', root), r = num('fr', root) / 100, e = num('fe', root) / 100, x = num('fx', root);
      var bnRate = p < 50000 ? .05 : p < 100000 ? .04 : .03, bn = p - p * bnRate - p * e - x, ot = p - p * r - p * e - x;
      H.$('.tool-out', root).innerHTML = '<div class="grid-2"><div class="card"><p class="eyebrow">BetterNic (' + bnRate * 100 + '%)</p><div class="dn" style="font-size:34px">' + BN.money(bn) + '</div><p class="small">Commission ' + BN.money(p * bnRate) + ' · escrow ' + BN.money(p * e) + ' · fees ' + BN.money(x) + '</p></div>' +
        '<div class="card"><p class="eyebrow">Other (' + (r * 100).toFixed(1).replace('.0', '') + '%)</p><div class="dn" style="font-size:34px">' + BN.money(ot) + '</div><p class="small">Commission ' + BN.money(p * r) + ' · escrow ' + BN.money(p * e) + ' · fees ' + BN.money(x) + '</p></div></div>' +
        '<div class="notice ' + (bn >= ot ? 'ok' : '') + '">Difference: <b>' + BN.money(bn - ot) + '</b> ' + (bn >= ot ? 'more in your pocket with BetterNic.' : 'in favour of the other rate.') + '</div><div class="tool-actions"><a class="btn btn-accent" href="/sell.html">List your domain free</a></div>';
    }
    H.$$('input', root).forEach(function (x) { x.addEventListener('input', run); }); run();
  };

  var CHECK = {
    seller: ['Agree price, payment method and who pays escrow fees in writing', 'Buyer funds escrow (or BetterNic confirms payment received)', 'Migrate any email and websites still using the domain', 'Back up all DNS records', 'Remove privacy/proxy service if the registrar requires it for transfer', 'Unlock the domain (remove clientTransferProhibited)', 'Get the authorization (EPP) code — or start a same-registrar push', 'Send the auth code only through escrow or to the verified buyer', 'Approve the transfer email from your registrar to speed it up', 'Confirm the domain shows in the buyer\'s account', 'Escrow releases funds — confirm receipt', 'Keep records of the sale for tax purposes'],
    buyer: ['Run a domain report: history, trademarks, email use', 'Agree price, payment method and escrow fees in writing', 'Open an account at the receiving registrar', 'Pay into escrow — never send funds directly to an unknown seller', 'Receive the auth code or accept the push', 'Initiate the transfer at your registrar and approve any confirmation email', 'Confirm the domain is in your account and contacts are yours', 'Set nameservers and DNS (lower TTLs first if migrating a live site)', 'Set up email security (SPF, DMARC) if you will send mail', 'Release escrow after confirming ownership', 'Turn on auto-renew and registrar lock', 'Note the 60-day transfer lock if you plan to move registrars again']
  };
  T['transfer-checklist'] = function (root) {
    root.innerHTML = '<div class="filters"><select id="cr"><option value="seller">I\'m the seller</option><option value="buyer">I\'m the buyer</option></select><button class="btn btn-ghost btn-sm" type="button" id="cp">Print</button><button class="btn btn-ghost btn-sm" type="button" id="cx">Reset</button><span class="small" id="cpct"></span></div><div class="tool-out"></div>';
    function key() { return 'bn_check_' + H.$('#cr', root).value; }
    function load() { try { return JSON.parse(localStorage.getItem(key()) || '{}'); } catch (e) { return {}; } }
    function run() {
      var st = load(), items = CHECK[H.$('#cr', root).value], done = 0;
      H.$('.tool-out', root).innerHTML = items.map(function (t, i) { if (st[i]) done++; return '<label class="check" style="padding:10px 12px;border:1px solid var(--line);border-radius:10px;background:var(--surface)"><input type="checkbox" data-i="' + i + '"' + (st[i] ? ' checked' : '') + '> <span><b>' + (i + 1) + '.</b> ' + esc(t) + '</span></label>'; }).join('');
      H.$('#cpct', root).textContent = done + ' of ' + items.length + ' done';
      H.$$('input[data-i]', root).forEach(function (c) { c.onchange = function () { var s = load(); s[c.getAttribute('data-i')] = c.checked; try { localStorage.setItem(key(), JSON.stringify(s)); } catch (e) { } run(); }; });
    }
    H.$('#cr', root).onchange = run; H.$('#cp', root).onclick = function () { window.print(); };
    H.$('#cx', root).onclick = function () { try { localStorage.removeItem(key()); } catch (e) { } run(); };
    run();
  };

  /* =============== PORTFOLIO =============== */
  T['portfolio-tracker'] = function (root) {
    root.innerHTML = '<form id="pf" class="grid-4" style="align-items:end">' + fld('pd', 'Domain', '', 'text', 'required placeholder="example.com"') + fld('pr', 'Registrar', '', 'text') + fld('pe', 'Expires', '', 'date') + fld('prn', 'Renewal (USD/yr)', '', 'number', 'step="0.01"') +
      fld('pc', 'Purchase cost', '', 'number', 'step="0.01"') + fld('pp', 'Asking price', '', 'number') + '<div class="field"><label for="ps2">Status</label><select id="ps2"><option>Holding</option><option>For sale</option><option>Developing</option><option>Sold</option><option>Drop</option></select></div><div class="field"><button class="btn btn-primary" type="submit" style="width:100%">Add / update</button></div></form>' +
      '<div class="stats" id="pstats" style="grid-template-columns:repeat(4,1fr);margin:18px 0"></div>' +
      '<div class="tool-actions"><label class="btn btn-ghost btn-sm" style="cursor:pointer">Import CSV<input type="file" id="pimp" accept=".csv,text/csv" hidden></label><button class="btn btn-ghost btn-sm" type="button" id="pexp">Export CSV</button><button class="btn btn-ghost btn-sm" type="button" id="pclr">Clear all</button></div>' +
      '<div id="pren"></div><div class="table-wrap" style="margin-top:12px"><table data-sortable><thead><tr><th data-sort>Domain</th><th data-sort>Registrar</th><th data-sort>Expires</th><th data-sort="num" class="num">Renewal</th><th data-sort="num" class="num">Cost</th><th data-sort="num" class="num">Asking</th><th data-sort="num" class="num">Est. value</th><th data-sort>Status</th><th></th></tr></thead><tbody></tbody></table></div>' +
      '<p class="small">Saved only in this browser. Export a CSV backup regularly.</p>';
    BN.sortable(H.$('table', root));
    function render() {
      H.words().then(function () {
        var list = H.portfolio(), tv = 0, tr = 0, tc = 0, soon = [], now = Date.now();
        H.$('tbody', root).innerHTML = list.map(function (x, i) {
          var p = BN.parseDomain(x.domain), v = p ? A.appraise(p).point : 0; x._v = v; tv += v; tr += +x.renewal || 0; tc += +x.cost || 0;
          if (x.expires) { var days = (new Date(x.expires) - now) / 864e5; if (days < 90) soon.push([x.domain, x.expires, Math.round(days)]); }
          return '<tr><td class="dn">' + esc(x.domain) + '</td><td>' + esc(x.registrar || '') + '</td><td>' + esc(x.expires || '') + '</td><td class="num" data-v="' + (x.renewal || 0) + '">' + (x.renewal ? BN.money(+x.renewal) : '') + '</td><td class="num" data-v="' + (x.cost || 0) + '">' + (x.cost ? BN.money(+x.cost) : '') + '</td><td class="num" data-v="' + (x.price || 0) + '">' + (x.price ? BN.money(+x.price) : '') + '</td><td class="num" data-v="' + v + '">' + BN.money(v) + '</td><td>' + esc(x.status || '') + '</td><td><button class="linkish" data-e="' + i + '">Edit</button> · <button class="linkish" data-x="' + i + '">Delete</button></td></tr>';
        }).join('') || '<tr><td colspan="9" class="muted">No domains yet — add your first one above or import a CSV.</td></tr>';
        H.$('#pstats', root).innerHTML = '<div class="stat"><b>' + list.length + '</b><span>Domains</span></div><div class="stat"><b>' + BN.money(tr) + '</b><span>Renewals / yr</span></div><div class="stat"><b>' + BN.money(tc) + '</b><span>Invested</span></div><div class="stat"><b>' + BN.money(tv) + '</b><span>Est. retail value</span></div>';
        soon.sort(function (a, b) { return a[2] - b[2]; });
        H.$('#pren', root).innerHTML = soon.length ? '<div class="notice warn"><b>Renewals in the next 90 days:</b> ' + soon.map(function (s) { return esc(s[0]) + ' (' + (s[2] < 0 ? 'expired' : s[2] + 'd') + ')'; }).join(', ') + '</div>' : '';
        H.$$('[data-x]', root).forEach(function (b) { b.onclick = function () { var l = H.portfolio(); l.splice(+b.getAttribute('data-x'), 1); H.portfolio(l); render(); }; });
        H.$$('[data-e]', root).forEach(function (b) { b.onclick = function () { var x = H.portfolio()[+b.getAttribute('data-e')]; H.$('#pd', root).value = x.domain; H.$('#pr', root).value = x.registrar || ''; H.$('#pe', root).value = x.expires || ''; H.$('#prn', root).value = x.renewal || ''; H.$('#pc', root).value = x.cost || ''; H.$('#pp', root).value = x.price || ''; H.$('#ps2', root).value = x.status || 'Holding'; H.$('#pd', root).focus(); }; });
      });
    }
    H.$('#pf', root).addEventListener('submit', function (ev) {
      ev.preventDefault();
      var p = BN.parseDomain(H.$('#pd', root).value); if (!p) { BN.toast('Enter a valid domain'); return; }
      var list = H.portfolio(), rec = { domain: p.domain, registrar: H.$('#pr', root).value.trim(), expires: H.$('#pe', root).value, renewal: H.$('#prn', root).value, cost: H.$('#pc', root).value, price: H.$('#pp', root).value, status: H.$('#ps2', root).value };
      var i = list.findIndex(function (x) { return x.domain === p.domain; }); if (i >= 0) list[i] = Object.assign(list[i], rec); else list.push(rec);
      H.portfolio(list); H.$('#pf', root).reset(); render();
    });
    H.$('#pexp', root).onclick = function () { BN.download('betternic-portfolio.csv', BN.csv([['domain', 'registrar', 'expires', 'renewal', 'cost', 'price', 'status']].concat(H.portfolio().map(function (x) { return [x.domain, x.registrar, x.expires, x.renewal, x.cost, x.price, x.status]; }))), 'text/csv'); };
    H.$('#pclr', root).onclick = function () { if (confirm('Delete every domain from this browser\'s portfolio? Export a CSV first if you need a backup.')) { H.portfolio([]); render(); } };
    H.$('#pimp', root).onchange = function (ev) {
      var f = ev.target.files[0]; if (!f) return;
      f.text().then(function (txt) {
        var lines = txt.split(/\r?\n/).filter(Boolean), head = lines[0].toLowerCase().split(',').map(function (h) { return h.trim().replace(/"/g, ''); });
        var idx = function (n) { return head.indexOf(n); }, list = H.portfolio(), added = 0;
        var hasHead = idx('domain') !== -1;
        (hasHead ? lines.slice(1) : lines).forEach(function (l) {
          var c = l.split(',').map(function (x) { return x.trim().replace(/^"|"$/g, ''); }), p = BN.parseDomain(hasHead ? c[idx('domain')] : c[0]); if (!p) return;
          var g = function (n) { var k = idx(n); return hasHead && k !== -1 ? c[k] : ''; };
          if (!list.some(function (x) { return x.domain === p.domain; })) { list.push({ domain: p.domain, registrar: g('registrar'), expires: g('expires'), renewal: g('renewal'), cost: g('cost'), price: g('price'), status: g('status') || 'Holding', notes: g('notes') }); added++; }
        });
        H.portfolio(list); render(); BN.toast(added + ' domains imported');
      });
    };
    render();
  };

  T['renewal-cost-calculator'] = function (root) {
    var rows = [['com', 100, 11.25], ['net', 10, 14], ['io', 5, 45]];
    root.innerHTML = '<div id="rr"></div><div class="tool-actions"><button class="btn btn-ghost btn-sm" type="button" id="radd">Add extension</button></div>' +
      '<div class="grid-4">' + fld('ri', 'Yearly price increase %', 5) + fld('ry', 'Years to project', 5) + fld('rs', 'Average sale price (USD)', 2500) + fld('rc', 'Commission %', 5) + '</div><div class="tool-out"></div>';
    function draw() {
      H.$('#rr', root).innerHTML = '<div class="table-wrap"><table><thead><tr><th>Extension</th><th class="num">Domains</th><th class="num">Renewal (USD)</th><th class="num">Annual</th><th></th></tr></thead><tbody>' + rows.map(function (r, i) {
        return '<tr><td><input data-r="' + i + '" data-c="0" value="' + esc(r[0]) + '" style="max-width:110px"></td><td class="num"><input data-r="' + i + '" data-c="1" type="number" value="' + r[1] + '" style="max-width:110px"></td><td class="num"><input data-r="' + i + '" data-c="2" type="number" step="0.01" value="' + r[2] + '" style="max-width:110px"></td><td class="num">' + BN.money(r[1] * r[2]) + '</td><td><button class="linkish" data-del="' + i + '">Remove</button></td></tr>';
      }).join('') + '</tbody></table></div>';
      H.$$('#rr input', root).forEach(function (x) { x.onchange = function () { var r = +x.getAttribute('data-r'), c = +x.getAttribute('data-c'); rows[r][c] = c ? +x.value : x.value; draw(); }; });
      H.$$('[data-del]', root).forEach(function (b) { b.onclick = function () { rows.splice(+b.getAttribute('data-del'), 1); draw(); }; });
      calc();
    }
    function calc() {
      var annual = rows.reduce(function (s, r) { return s + r[1] * r[2]; }, 0), count = rows.reduce(function (s, r) { return s + (+r[1]); }, 0);
      var inc = num('ri', root) / 100, yrs = num('ry', root) || 1, avg = num('rs', root), com = num('rc', root) / 100, total = 0;
      for (var y = 0; y < yrs; y++) total += annual * Math.pow(1 + inc, y);
      var be = avg ? annual / (avg * (1 - com)) : 0;
      H.$('.tool-out', root).innerHTML = '<div class="result-grid">' + H.kv('Domains', BN.num(count)) + H.kv('Annual renewals', BN.money(annual)) + H.kv(yrs + '-year cost', BN.money(total)) + H.kv('Sales needed / yr to break even', be ? be.toFixed(1) : '—') + H.kv('Break-even sell-through', count && be ? (be / count * 100).toFixed(2) + '%' : '—') + '</div>' +
        (count && be / count > .02 ? '<div class="notice warn">You need more than 2% sell-through to break even — consider dropping your weakest names or raising prices.</div>' : '');
    }
    H.$('#radd', root).onclick = function () { rows.push(['', 1, 15]); draw(); };
    H.$$('.grid-4 input', root).forEach(function (x) { x.addEventListener('input', calc); });
    draw();
  };

  T['flip-roi-calculator'] = function (root) {
    root.innerHTML = '<div class="grid-3">' + fld('fb', 'Purchase price', 500) + fld('fr2', 'Renewal per year', 11) + fld('fy', 'Years held', 3) + fld('fs', 'Sale price', 4500) + fld('fc', 'Commission %', 5) + fld('fo', 'Other costs (escrow, fees, time)', 50) + '</div><div class="tool-out"></div>';
    function run() {
      var b = num('fb', root), r = num('fr2', root), y = Math.max(num('fy', root), .1), s = num('fs', root), c = num('fc', root) / 100, o = num('fo', root);
      var cost = b + r * y + o, net = s - s * c, profit = net - cost, roi = cost ? profit / cost : 0, ann = cost > 0 && net > 0 ? Math.pow(net / cost, 1 / y) - 1 : 0;
      H.$('.tool-out', root).innerHTML = '<div class="result-grid">' + H.kv('Total cost', BN.money(cost)) + H.kv('Net proceeds', BN.money(net)) + H.kv('Profit', BN.money(profit)) + H.kv('ROI', (roi * 100).toFixed(0) + '%') + H.kv('Annualised return', (ann * 100).toFixed(1) + '%') + '</div>';
    }
    H.$$('input', root).forEach(function (x) { x.addEventListener('input', run); }); run();
  };

  T['domain-list-cleaner'] = function (root) {
    root.innerHTML = '<div class="field"><label for="ct">Paste anything containing domains</label><textarea id="ct" rows="8" placeholder="https://www.Example.com/page, another-example.net; mail.example.org"></textarea></div>' +
      '<div class="filters"><input id="cx2" placeholder="Only these extensions (e.g. com,io)"><input id="cm" type="number" placeholder="Max length (name only)"><label class="check"><input type="checkbox" id="chy"> No hyphens</label><label class="check"><input type="checkbox" id="cdg"> No digits</label>' +
      '<select id="cs"><option value="az">A → Z</option><option value="len">Shortest first</option><option value="tld">By extension</option></select></div>' +
      '<div class="tool-actions"><button class="btn btn-primary" type="button" id="cgo2">Clean list</button><button class="btn btn-ghost" type="button" id="ccp">Copy</button><button class="btn btn-ghost" type="button" id="cdl">Download .txt</button></div><div class="tool-out"></div>';
    var res = [];
    function run() {
      var txt = H.$('#ct', root).value, m = txt.match(/(?:[a-z0-9¡-￿](?:[a-z0-9¡-￿-]{0,61}[a-z0-9¡-￿])?\.)+[a-z¡-￿]{2,63}/gi) || [];
      var ex = H.$('#cx2', root).value.toLowerCase().split(/[\s,]+/).map(function (x) { return x.replace(/^\./, ''); }).filter(Boolean), ml = num('cm', root), set = {};
      m.forEach(function (x) { var p = BN.parseDomain(x); if (!p) return; if (ex.length && ex.indexOf(p.tld) === -1) return; if (ml && p.sld.length > ml) return; if (H.$('#chy', root).checked && /-/.test(p.sld)) return; if (H.$('#cdg', root).checked && /\d/.test(p.sld)) return; set[p.domain] = p; });
      res = Object.keys(set); var s = H.$('#cs', root).value;
      res.sort(s === 'len' ? function (a, b) { return set[a].sld.length - set[b].sld.length || a.localeCompare(b); } : s === 'tld' ? function (a, b) { return set[a].tld.localeCompare(set[b].tld) || a.localeCompare(b); } : function (a, b) { return a.localeCompare(b); });
      H.$('.tool-out', root).innerHTML = '<p class="small">' + m.length + ' found · <b>' + res.length + '</b> unique after filters</p><pre class="code">' + esc(res.join('\n')) + '</pre>';
    }
    H.$('#cgo2', root).onclick = run; H.$('#ccp', root).onclick = function () { run(); BN.copy(res.join('\n')); };
    H.$('#cdl', root).onclick = function () { run(); BN.download('clean-domains.txt', res.join('\n')); };
  };

  T['parking-revenue-estimator'] = function (root) {
    root.innerHTML = '<div class="grid-3">' + fld('kv', 'Monthly visitors', 600) + fld('kc', 'Click-through rate %', 8) + fld('kp', 'Revenue per click (USD)', 0.35) + fld('ks', 'Your revenue share %', 70) + fld('kr', 'Renewal (USD/yr)', 11) + fld('kx', 'Asking price if sold (USD)', 3000) + '</div><div class="tool-out"></div>';
    function run() {
      var v = num('kv', root), c = num('kc', root) / 100, p = num('kp', root), s = num('ks', root) / 100, r = num('kr', root), x = num('kx', root);
      var mo = v * c * p * s, yr = mo * 12, rpm = v ? mo / v * 1000 : 0;
      H.$('.tool-out', root).innerHTML = '<div class="result-grid">' + H.kv('Monthly income', BN.money(mo)) + H.kv('Yearly income', BN.money(yr)) + H.kv('RPM (per 1,000 visits)', BN.money(rpm)) + H.kv('Net after renewal', BN.money(yr - r)) + H.kv('Years to equal sale price', yr - r > 0 ? ((x * .95) / (yr - r)).toFixed(1) : '∞') + '</div>' +
        '<div class="notice">' + (yr < r ? 'Parking would not cover the renewal. A for-sale lander is likely the better use of this domain.' : 'Parking covers renewal. Compare with selling — one sale can equal many years of clicks.') + '</div>';
    }
    H.$$('input', root).forEach(function (x) { x.addEventListener('input', run); }); run();
  };

  T['domain-financing-calculator'] = function (root) {
    root.innerHTML = H.input({ button: 'Use estimate', placeholder: 'example.com (optional)', extra: fld('xv', 'Or collateral value (USD)', 50000, 'number', 'style="max-width:200px"') }) +
      '<div class="grid-4">' + '<div class="field"><label for="xl">Loan-to-value</label><select id="xl"><option value="0.25">25%</option><option value="0.3" selected>30%</option><option value="0.4">40%</option><option value="0.5">50%</option></select></div>' + fld('xr', 'Annual interest %', 15) + fld('xt', 'Term (months)', 12) + '<div class="field"><label>&nbsp;</label><button class="btn btn-primary" type="button" id="xgo">Calculate</button></div></div><div id="xout"></div>';
    function calc(val, basis) {
      var ltv = +H.$('#xl', root).value, r = num('xr', root) / 1200, n = Math.max(1, num('xt', root)), L = val * ltv;
      var pmt = r ? L * r / (1 - Math.pow(1 + r, -n)) : L / n, io = L * r;
      H.$('#xout', root).innerHTML = '<div class="result-grid">' + H.kv('Collateral value', BN.money(val)) + H.kv('Indicative loan', BN.money(L)) + H.kv('Amortising payment', BN.money(pmt) + '/mo') + H.kv('Interest-only (bridge)', BN.money(io) + '/mo') + H.kv('Total interest (amortising)', BN.money(pmt * n - L)) + '</div>' +
        '<p class="small">' + esc(basis) + ' Illustration only — not an offer of credit. Lenders set their own valuations, terms and eligibility.</p>' +
        '<div class="cta-band card" style="margin-top:14px"><div><h3>Unlock liquidity from your domains</h3><p class="muted">BetterNic is building a peer-funded marketplace where domain investors fund each other\'s bridge loans. Join the waitlist as a borrower or a funder.</p></div><div><a class="btn btn-accent btn-lg" href="/financing.html">Join the waitlist</a></div></div>';
    }
    H.bind(root, function (raw, out) {
      var p = BN.parseDomain(raw);
      if (!p) { calc(num('xv', root), 'Based on the value you entered.'); return; }
      H.words().then(function () { var ap = A.appraise(p), w = Math.round((ap.wholesale[0] + ap.wholesale[1]) / 2); H.$('#xv', root).value = w; calc(w, 'Based on the BetterNic wholesale estimate for ' + p.domain + ' (lenders value collateral at wholesale).'); });
    }, { raw: true, noAuto: false });
    H.$('#xgo', root).onclick = function () { calc(num('xv', root), 'Based on the value you entered.'); };
    calc(num('xv', root), 'Based on the value you entered.');
  };

  /* =============== LEGAL =============== */
  T['trademark-search'] = function (root) {
    root.innerHTML = H.input({ label: 'Domain or brand term', placeholder: 'example.com', button: 'Check' });
    H.bind(root, function (raw, out) {
      var p = BN.parseDomain(raw.indexOf('.') === -1 ? raw + '.com' : raw);
      if (!p) { out.innerHTML = '<div class="notice warn">Enter a domain or term.</div>'; return; }
      H.loading(out);
      Promise.all([BN.data('brands'), H.words()]).then(function (a) {
        var brands = a[0].brands || [], s = p.sld.replace(/-/g, ''), seg = A.segment(s).words, hits = [];
        function lev(x, y) { var d = []; for (var i = 0; i <= x.length; i++) { d[i] = [i]; } for (var j = 1; j <= y.length; j++) d[0][j] = j; for (i = 1; i <= x.length; i++) for (j = 1; j <= y.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1)); return d[x.length][y.length]; }
        brands.forEach(function (b) {
          var k = b.toLowerCase().replace(/[^a-z0-9]/g, '');
          if (s === k) hits.push([b, 'Exact match', 'bad']);
          else if (k.length >= 4 && s.indexOf(k) !== -1) hits.push([b, 'Contains the mark', 'bad']);
          else if (seg.indexOf(k) !== -1) hits.push([b, 'Contains the mark as a word', 'bad']);
          else if (k.length >= 5 && Math.abs(k.length - s.length) <= 1 && lev(k, s) === 1) hits.push([b, 'One character away (possible typo)', 'warn']);
        });
        var t = encodeURIComponent(p.sld);
        var offices = [['US marks (Justia, pre-filled)', 'https://trademarks.justia.com/search?q=' + t], ['USPTO trademark search', 'https://tmsearch.uspto.gov/'], ['WIPO Global Brand Database', 'https://branddb.wipo.int/'], ['EUIPO eSearch', 'https://euipo.europa.eu/eSearch/'], ['Canada (CIPO)', 'https://ised-isde.canada.ca/cipo/trademark-search/srch'], ['UK IPO', 'https://trademarks.ipo.gov.uk/ipo-tmtext'], ['IP Australia', 'https://search.ipaustralia.gov.au/trademarks/search/quick'], ['Google (exact phrase)', 'https://www.google.com/search?q=%22' + t + '%22+trademark']];
        out.innerHTML = (hits.length ? '<div class="notice bad"><b>Famous-brand screen: ' + hits.length + ' potential conflict' + (hits.length > 1 ? 's' : '') + '.</b></div><ul class="factor-list">' + hits.map(function (h) { return '<li><span>' + esc(h[0]) + '</span><span class="' + (h[2] === 'bad' ? 'neg' : '') + '">' + esc(h[1]) + '</span></li>'; }).join('') + '</ul>'
          : '<div class="notice ok">No match against our famous-brand list. That does not clear the name — check the official databases below.</div>') +
          '<h3 style="margin-top:16px">Search the official databases for "' + esc(p.sld) + '"</h3><div class="tool-grid">' + offices.map(function (o) { return '<a class="card" target="_blank" rel="noopener" href="' + o[1] + '"><b>' + esc(o[0]) + '</b><p class="small">Opens in a new tab ↗</p></a>'; }).join('') + '</div>' +
          '<div class="tool-actions"><button class="btn btn-ghost btn-sm" type="button" id="tmc">Copy search term</button><a class="btn btn-ghost btn-sm" href="/tools/udrp-risk-checker.html">Run the UDRP risk self-assessment</a></div><p class="small">Not legal advice. Trademark rights depend on goods/services, territory and use.</p>';
        H.$('#tmc', out).onclick = function () { BN.copy(p.sld); };
      });
    }, { raw: true });
  };

  var KEYS = { q: 'wa', w: 'qes', e: 'wrd', r: 'eft', t: 'ryg', y: 'tuh', u: 'yij', i: 'uok', o: 'ipl', p: 'ol', a: 'qsz', s: 'adwx', d: 'sefx', f: 'drgc', g: 'fthv', h: 'gyjb', j: 'hukn', k: 'jilm', l: 'kop', z: 'asx', x: 'zsdc', c: 'xdfv', v: 'cfgb', b: 'vghn', n: 'bhjm', m: 'njk' };
  var GLYPH = { o: '0', l: '1', i: '1', e: '3', a: '4', s: '5', b: '8', g: '9', m: 'rn', w: 'vv' };
  T['typo-domain-generator'] = function (root) {
    root.innerHTML = H.input({ label: 'Your brand domain', button: 'Generate' });
    H.bind(root, function (p, out) {
      var s = p.sld, t = p.tld, set = {};
      function add(x, kind, tl) { x = x.toLowerCase(); if (x && x !== s && /^[a-z0-9-]+$/.test(x) && !/^-|-$/.test(x)) set[x + '.' + (tl || t)] = kind; }
      for (var i = 0; i < s.length; i++) {
        add(s.slice(0, i) + s.slice(i + 1), 'Missing letter');
        add(s.slice(0, i) + s[i] + s.slice(i), 'Doubled letter');
        if (i < s.length - 1) add(s.slice(0, i) + s[i + 1] + s[i] + s.slice(i + 2), 'Swapped letters');
        (KEYS[s[i]] || '').split('').forEach(function (k) { add(s.slice(0, i) + k + s.slice(i + 1), 'Adjacent key'); });
        if (GLYPH[s[i]]) add(s.slice(0, i) + GLYPH[s[i]] + s.slice(i + 1), 'Look-alike character');
        if (i > 0) add(s.slice(0, i) + '-' + s.slice(i), 'Hyphenated');
      }
      add('www' + s, 'Missing dot after www');
      ['net', 'org', 'co', 'io', 'cm', 'om', 'con'].forEach(function (x) { if (x !== t) add(s, 'Other / mistyped extension', x); });
      var list = Object.keys(set);
      out.innerHTML = '<p class="small">' + list.length + ' variants. <button class="linkish" type="button" id="tyc">Check which are registered</button> · <button class="linkish" type="button" id="tyd">Download CSV</button></p><div class="table-wrap"><table><thead><tr><th>Variant</th><th>Type</th><th>Registered?</th></tr></thead><tbody>' +
        list.map(function (d) { return '<tr data-d="' + d + '"><td class="dn">' + d + '</td><td class="small">' + set[d] + '</td><td>—</td></tr>'; }).join('') + '</tbody></table></div>';
      var results = {};
      H.$('#tyc', out).onclick = function () {
        H.pool(list, 4, function (d) { return H.dns(d, 'NS').then(function (r) { return r.status === 0 && r.answers.length ? 'registered' : r.status === 3 ? 'likely' : 'unknown'; }).catch(function () { return 'unknown'; }); },
          function (d, st) { results[d] = st; var c = H.$('tr[data-d="' + d + '"] td:last-child', out); if (c) c.innerHTML = st === 'registered' ? '<a href="/tools/domain-report.html?d=' + d + '"><span class="pill pill-warn">Registered</span></a>' : H.badge(st); });
      };
      H.$('#tyd', out).onclick = function () { BN.download(s + '-typo-variants.csv', BN.csv([['domain', 'type', 'status']].concat(list.map(function (d) { return [d, set[d], results[d] || '']; }))), 'text/csv'); };
    });
  };

  var UDRP = [
    ['i', 'Does the domain contain a trademark (exactly or with small changes) owned by someone else?', [['No mark involved', 0], ['It contains a generic word that someone also uses as a mark', 1], ['Yes, a distinctive or famous mark', 3]]],
    ['i', 'Is the domain a typo or look-alike of that mark?', [['No', 0], ['Arguably', 1], ['Yes', 3]]],
    ['ii', 'Are you commonly known by this name (your company, product or personal name)?', [['Yes', 0], ['Partly', 1], ['No', 2]]],
    ['ii', 'Before any dispute, did you use or prepare to use it for a genuine offering of goods or services?', [['Yes, with evidence', 0], ['Some plans, little evidence', 1], ['No', 2]]],
    ['ii', 'Is it a dictionary word or common phrase you hold for its generic meaning?', [['Yes', 0], ['Partly', 1], ['No', 2]]],
    ['iii', 'When you registered it, did you know about the trademark owner?', [['No, and the mark wasn\'t well known', 0], ['Possibly', 1], ['Yes', 3]]],
    ['iii', 'Was the trademark registered or well known before you registered the domain?', [['No — my registration came first', 0], ['Unsure', 1], ['Yes', 2]]],
    ['iii', 'Have you offered to sell it to the trademark owner or a competitor for far more than your costs?', [['No', 0], ['I listed it publicly for sale', 1], ['Yes, approached them directly', 3]]],
    ['iii', 'Does the site show ads or links related to the trademark owner\'s products?', [['No / generic content', 0], ['Parked with automatic ads', 2], ['Yes, competing products', 3]]],
    ['iii', 'Did you use false contact details or a pattern of registering others\' marks?', [['No', 0], ['Privacy service only', 0], ['Yes', 3]]]
  ];
  T['udrp-risk-checker'] = function (root) {
    root.innerHTML = '<form id="uf">' + UDRP.map(function (q, i) {
      return '<fieldset class="card" style="margin-bottom:10px;border:1px solid var(--line)"><legend class="small" style="padding:0 6px">Element (' + q[0] + ')</legend><p><b>' + (i + 1) + '. ' + esc(q[1]) + '</b></p>' + q[2].map(function (o, j) { return '<label class="check"><input type="radio" name="u' + i + '" value="' + o[1] + '"' + (j === 0 ? ' checked' : '') + '> ' + esc(o[0]) + '</label>'; }).join('') + '</fieldset>';
    }).join('') + '<button class="btn btn-primary" type="submit">Assess risk</button></form><div class="tool-out"></div>';
    H.$('#uf', root).addEventListener('submit', function (ev) {
      ev.preventDefault();
      var sc = { i: [0, 0], ii: [0, 0], iii: [0, 0] };
      UDRP.forEach(function (q, i) { var v = +H.$('input[name=u' + i + ']:checked', root).value, mx = Math.max.apply(null, q[2].map(function (o) { return o[1]; })); sc[q[0]][0] += v; sc[q[0]][1] += mx; });
      function lvl(x) { var r = x[0] / x[1]; return r < .25 ? ['Low', 'ok'] : r < .6 ? ['Medium', 'warn'] : ['High', 'bad']; }
      var L = { i: lvl(sc.i), ii: lvl(sc.ii), iii: lvl(sc.iii) }, all = [L.i, L.ii, L.iii].every(function (x) { return x[0] !== 'Low'; });
      H.$('.tool-out', root).innerHTML = '<div class="result-grid">' + H.kv('(i) Confusing similarity', '<span class="pill pill-' + (L.i[1] === 'ok' ? 'accent' : L.i[1]) + '">' + L.i[0] + '</span>') + H.kv('(ii) No legitimate interest', '<span class="pill pill-' + (L.ii[1] === 'ok' ? 'accent' : L.ii[1]) + '">' + L.ii[0] + '</span>') + H.kv('(iii) Bad faith', '<span class="pill pill-' + (L.iii[1] === 'ok' ? 'accent' : L.iii[1]) + '">' + L.iii[0] + '</span>') + '</div>' +
        '<div class="notice ' + (all ? 'bad' : 'ok') + '">' + (all ? 'A complainant would need to prove all three elements, and your answers suggest risk on each. Get advice from a domain-dispute lawyer before buying, using or responding.' : 'At least one element looks weak for a complainant. A UDRP must prove all three — keep evidence of your registration intent and use.') + '</div><p class="small">Educational self-assessment based on UDRP Paragraph 4. Not legal advice and not a prediction of any panel decision.</p>' +
        '<div class="tool-actions"><a class="btn btn-ghost btn-sm" href="/leads.html?intent=dispute">Get help with a dispute</a><a class="btn btn-ghost btn-sm" target="_blank" rel="noopener" href="https://www.wipo.int/amc/en/domains/">WIPO domain dispute resources ↗</a></div>';
    });
  };
})();
