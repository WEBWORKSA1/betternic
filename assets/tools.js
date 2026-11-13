/* BetterNic tools — part 1: shared helpers + research & valuation tools */
(function () {
  'use strict';
  var BN = window.BN, A = window.BNAppraise;
  var T = window.BNT = window.BNT || {};
  var esc = BN.esc;
  var H = T._h = {};

  H.$ = function (sel, root) { return (root || document).querySelector(sel); };
  H.$$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  H.input = function (opts) {
    opts = opts || {};
    return '<form class="tool-row" data-run>' +
      '<div class="field"><label for="ti">' + esc(opts.label || 'Domain name') + '</label>' +
      '<input id="ti" name="q" type="text" inputmode="url" autocomplete="off" spellcheck="false" placeholder="' + esc(opts.placeholder || 'example.com') + '" value="' + esc(opts.value || '') + '"></div>' +
      (opts.extra || '') +
      '<button class="btn btn-primary" type="submit">' + esc(opts.button || 'Run') + '</button></form><div class="tool-out" aria-live="polite"></div>';
  };
  H.bind = function (root, fn, opts) {
    var f = H.$('form[data-run]', root), out = H.$('.tool-out', root), inp = H.$('#ti', root);
    f.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var raw = inp.value.trim();
      if (opts && opts.raw) { fn(raw, out); return; }
      var p = BN.parseDomain(raw);
      if (!p) { out.innerHTML = '<div class="notice warn">Enter a valid domain, for example <code>example.com</code>.</div>'; return; }
      inp.value = p.domain;
      try { history.replaceState(null, '', location.pathname + '?d=' + encodeURIComponent(p.domain)); } catch (e) { }
      fn(p, out);
    });
    var d = BN.param('d') || BN.param('q');
    if (d) { inp.value = d; if (!(opts && opts.noAuto)) f.requestSubmit ? f.requestSubmit() : f.dispatchEvent(new Event('submit')); }
    return { form: f, out: out, input: inp };
  };
  H.loading = function (out, msg) { out.innerHTML = '<p class="muted"><span class="spinner"></span> ' + esc(msg || 'Checking…') + '</p>'; };
  H.kv = function (k, v) { return '<div class="kv"><span>' + esc(k) + '</span><b>' + v + '</b></div>'; };
  H.cta = function (p) {
    var d = encodeURIComponent(p.domain);
    return '<div class="tool-actions">' +
      '<a class="btn btn-accent btn-sm" href="/sell.html?d=' + d + '">List this domain — 5% commission</a>' +
      '<a class="btn btn-ghost btn-sm" href="/leads.html?intent=buy&d=' + d + '">Get a broker to buy it</a>' +
      '<a class="btn btn-ghost btn-sm" href="/tools/domain-report.html?d=' + d + '">Full domain report</a>' +
      '<button class="btn btn-ghost btn-sm" type="button" data-save="' + esc(p.domain) + '">Save to portfolio</button></div>';
  };
  document.addEventListener('click', function (ev) {
    var b = ev.target.closest && ev.target.closest('[data-save]');
    if (!b) return;
    var d = b.getAttribute('data-save'), list = H.portfolio();
    if (!list.some(function (x) { return x.domain === d; })) { list.push({ domain: d, added: new Date().toISOString().slice(0, 10) }); H.portfolio(list); }
    BN.toast('Saved to your portfolio tracker');
  });
  H.portfolio = function (list) {
    try {
      if (list) { localStorage.setItem('bn_portfolio', JSON.stringify(list)); return list; }
      return JSON.parse(localStorage.getItem('bn_portfolio') || '[]');
    } catch (e) { return list || []; }
  };
  H.money = BN.money;
  H.round = function (v) { return Math.round(v); };
  /* ---------- network helpers ---------- */
  var rdapMap = null;
  H.rdapBase = function (tld) {
    var last = tld.split('.').pop();
    if (!rdapMap) rdapMap = BN.data('rdap').then(function (j) { return j.services || {}; }).catch(function () { return {}; });
    return rdapMap.then(function (m) { return m[last] || null; });
  };
  H.rdap = function (p) {
    return H.rdapBase(p.tld).then(function (base) {
      var urls = [];
      if (base) urls.push(base.replace(/\/?$/, '/') + 'domain/' + p.domain);
      urls.push('https://rdap.org/domain/' + p.domain);
      function tryAt(i) {
        if (i >= urls.length) return { state: base ? 'error' : 'norap' };
        return fetch(urls[i], { headers: { Accept: 'application/rdap+json, application/json' } }).then(function (r) {
          if (r.status === 404) return { state: 'available' };
          if (!r.ok) throw new Error(r.status);
          return r.json().then(function (j) { return { state: 'registered', raw: j, info: H.parseRdap(j) }; });
        }).catch(function () { return tryAt(i + 1); });
      }
      return tryAt(0);
    });
  };
  H.parseRdap = function (j) {
    var ev = {};
    (j.events || []).forEach(function (e) { ev[e.eventAction] = e.eventDate; });
    var registrar = '', iana = '';
    (function walk(ents) {
      (ents || []).forEach(function (en) {
        if ((en.roles || []).indexOf('registrar') !== -1) {
          var v = en.vcardArray && en.vcardArray[1];
          (v || []).forEach(function (x) { if (x[0] === 'fn') registrar = x[3]; });
          (en.publicIds || []).forEach(function (pid) { if (/iana/i.test(pid.type)) iana = pid.identifier; });
          if (!registrar) registrar = en.handle || '';
        }
        walk(en.entities);
      });
    })(j.entities);
    return {
      registration: ev.registration, expiration: ev.expiration,
      updated: ev['last changed'] || ev['last update of RDAP database'],
      registrar: registrar, ianaId: iana,
      ns: (j.nameservers || []).map(function (n) { return String(n.ldhName || '').toLowerCase(); }).filter(Boolean),
      status: j.status || [], dnssec: j.secureDNS ? !!j.secureDNS.delegationSigned : null
    };
  };
  var TYPES = { A: 1, NS: 2, CNAME: 5, SOA: 6, MX: 15, TXT: 16, AAAA: 28, CAA: 257 };
  H.dns = function (name, type) {
    var t = TYPES[type] || type;
    return fetch('https://dns.google/resolve?name=' + encodeURIComponent(name) + '&type=' + t)
      .then(function (r) { if (!r.ok) throw 0; return r.json(); })
      .catch(function () {
        return fetch('https://cloudflare-dns.com/dns-query?name=' + encodeURIComponent(name) + '&type=' + type, { headers: { accept: 'application/dns-json' } })
          .then(function (r) { return r.json(); });
      })
      .then(function (j) {
        return { status: j.Status, answers: (j.Answer || []).filter(function (a) { return a.type === t; }).map(function (a) { return { name: a.name, ttl: a.TTL, data: String(a.data).replace(/^"|"$/g, '').replace(/"\s*"/g, '') }; }) };
      });
  };
  H.wayback = function (domain) {
    var cdx = fetch('https://web.archive.org/cdx/search/cdx?url=' + encodeURIComponent(domain) + '&output=json&fl=timestamp,statuscode&collapse=timestamp:4&limit=100')
      .then(function (r) { return r.json(); }).then(function (rows) { return rows.slice(1).map(function (x) { return x[0]; }); });
    var last = fetch('https://archive.org/wayback/available?url=' + encodeURIComponent(domain) + '&timestamp=' + new Date().toISOString().slice(0, 10).replace(/-/g, ''))
      .then(function (r) { return r.json(); }).then(function (j) { var c = j.archived_snapshots && j.archived_snapshots.closest; return c ? c.timestamp : null; })
      .catch(function () { return null; });
    return Promise.all([cdx, last]).then(function (a) {
      var ts = a[0], years = {};
      ts.forEach(function (t) { years[t.slice(0, 4)] = t; });
      return { first: ts[0] || null, last: a[1] || ts[ts.length - 1] || null, years: years, count: Object.keys(years).length };
    });
  };
  H.ts = function (t) { return t ? t.slice(0, 4) + '-' + t.slice(4, 6) + '-' + t.slice(6, 8) : '—'; };
  H.age = function (iso) {
    var d = new Date(iso); if (isNaN(d)) return null;
    var now = new Date(), y = now.getFullYear() - d.getFullYear(), m = now.getMonth() - d.getMonth(), dd = now.getDate() - d.getDate();
    if (dd < 0) { m--; dd += 30; } if (m < 0) { y--; m += 12; }
    return { y: y, m: m, d: dd, text: y + ' yr ' + m + ' mo' };
  };
  H.STATUS = {
    'client transfer prohibited': 'Registrar lock — blocks transfers until the owner unlocks it.',
    'server transfer prohibited': 'Registry lock on transfers (often a new registration or dispute).',
    'client delete prohibited': 'Registrar blocks deletion.', 'server delete prohibited': 'Registry blocks deletion.',
    'client update prohibited': 'Registrar blocks changes to contacts/nameservers.', 'server update prohibited': 'Registry blocks changes.',
    'client hold': 'Domain will not resolve — suspended by the registrar.', 'server hold': 'Domain will not resolve — suspended by the registry.',
    'redemption period': 'Deleted; previous owner can still restore it for ~30 days.',
    'pending delete': 'Will be released to the public within about 5 days.',
    'auto renew period': 'Recently auto-renewed; registrar may still delete it.',
    'pending transfer': 'A transfer to another registrar is in progress.', active: 'Normal, active registration.',
    ok: 'Normal, active registration.', 'add period': 'Newly registered (first 5 days).', inactive: 'No nameservers delegated.'
  };
  H.statusText = function (s) { var k = String(s).toLowerCase().replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase(); return H.STATUS[k] || ''; };
  H.PARK = [['sedoparking', 'Sedo parking'], ['afternic', 'Afternic'], ['dan.com', 'Dan / Afternic'], ['bodis', 'Bodis'], ['parkingcrew', 'ParkingCrew'],
    ['above.com', 'Above'], ['uniregistry', 'Uniregistry/GoDaddy'], ['parklogic', 'ParkLogic'], ['efty', 'Efty'], ['atom.com', 'Atom'],
    ['squadhelp', 'Atom'], ['domaincontrol.com', 'GoDaddy DNS'], ['registrar-servers.com', 'Namecheap DNS'], ['cloudflare.com', 'Cloudflare'],
    ['awsdns', 'Amazon Route 53'], ['googledomains', 'Google'], ['azure-dns', 'Azure'], ['dynadot', 'Dynadot'], ['spaceship', 'Spaceship'],
    ['nsone.net', 'NS1 (Netlify)'], ['vercel-dns', 'Vercel'], ['wixdns', 'Wix'], ['squarespacedns', 'Squarespace'], ['shopify', 'Shopify']];
  H.nsProvider = function (ns) {
    var s = ns.join(' ').toLowerCase(), hit = H.PARK.filter(function (p) { return s.indexOf(p[0]) !== -1; })[0];
    return hit ? hit[1] : '';
  };
  H.MAILPROV = [['google.com', 'Google Workspace'], ['googlemail', 'Google Workspace'], ['outlook.com', 'Microsoft 365'], ['zoho', 'Zoho Mail'],
    ['protonmail', 'Proton Mail'], ['mx.cloudflare.net', 'Cloudflare Email Routing'], ['secureserver.net', 'GoDaddy email'],
    ['privateemail.com', 'Namecheap email'], ['messagingengine', 'Fastmail'], ['mailgun', 'Mailgun'], ['amazonaws', 'Amazon SES'],
    ['icloud.com', 'iCloud Mail'], ['yandex', 'Yandex Mail'], ['improvmx', 'ImprovMX'], ['forwardemail', 'Forward Email'], ['mimecast', 'Mimecast']];
  H.mailProvider = function (mx) {
    var s = mx.join(' ').toLowerCase(), hit = H.MAILPROV.filter(function (p) { return s.indexOf(p[0]) !== -1; })[0];
    return hit ? hit[1] : (mx.length ? 'Custom / other' : '');
  };
  H.pool = function (items, n, worker, onEach) {
    var i = 0, active = 0, done = 0;
    return new Promise(function (res) {
      if (!items.length) return res();
      function next() {
        while (active < n && i < items.length) {
          (function (item, idx) {
            active++;
            Promise.resolve(worker(item, idx)).catch(function () { }).then(function (r) {
              active--; done++; if (onEach) onEach(item, r, idx);
              if (done === items.length) res(); else next();
            });
          })(items[i], i++);
        }
      }
      next();
    });
  };
  H.availability = function (domain) {
    var p = BN.parseDomain(domain);
    return H.dns(p.domain, 'NS').then(function (r) {
      if (r.status === 3) return H.rdap(p).then(function (x) { return x.state === 'available' ? 'available' : x.state === 'registered' ? 'registered' : 'likely'; });
      if (r.status === 0) return 'registered';
      return 'unknown';
    }).catch(function () { return 'unknown'; });
  };
  H.badge = function (state) {
    return { available: '<span class="pill pill-accent">Available</span>', likely: '<span class="pill pill-accent">Likely available</span>',
      registered: '<span class="pill">Registered</span>', unknown: '<span class="pill pill-warn">Unknown</span>' }[state] || '';
  };
  H.words = function () { return A.loadWords(); };

  /* =============== RESEARCH =============== */
  T['whois-lookup'] = function (root) {
    root.innerHTML = H.input({ button: 'Look up' });
    H.bind(root, function (p, out) {
      H.loading(out, 'Querying the registry RDAP service…');
      H.rdap(p).then(function (r) { out.innerHTML = H.rdapHtml(p, r, true); });
    });
  };
  H.rdapHtml = function (p, r, full) {
    if (r.state === 'available') return '<div class="notice ok"><b>' + esc(p.domain) + '</b> has no registration record at the registry — it is probably available to register.</div>' +
      '<div class="tool-actions"><a class="btn btn-ghost btn-sm" href="/tools/domain-availability-checker.html?d=' + encodeURIComponent(p.sld) + '">Check other extensions</a></div>';
    if (r.state === 'norap') return '<div class="notice warn">The .' + esc(p.tld) + ' registry does not publish RDAP data. Use the registry\'s own WHOIS service or <a href="https://lookup.icann.org/en/lookup?name=' + encodeURIComponent(p.domain) + '" target="_blank" rel="noopener">ICANN Lookup</a>.</div>';
    if (r.state !== 'registered') return '<div class="notice bad">We could not reach the registry right now. Try again in a minute, or use <a href="https://lookup.icann.org/en/lookup?name=' + encodeURIComponent(p.domain) + '" target="_blank" rel="noopener">ICANN Lookup</a>.</div>';
    var i = r.info, age = H.age(i.registration);
    var html = '<div class="result-grid">' +
      H.kv('Registrar', esc(i.registrar || '—')) + H.kv('Registered', BN.date(i.registration)) +
      H.kv('Expires', BN.date(i.expiration)) + H.kv('Age', age ? age.text : '—') +
      H.kv('Last updated', BN.date(i.updated)) + H.kv('DNSSEC', i.dnssec == null ? '—' : i.dnssec ? 'Signed' : 'Unsigned') + '</div>';
    if (full) {
      html += '<h3>Status codes</h3><table><tbody>' + (i.status.length ? i.status.map(function (s) {
        return '<tr><td><code>' + esc(s) + '</code></td><td>' + esc(H.statusText(s)) + '</td></tr>';
      }).join('') : '<tr><td>—</td></tr>') + '</tbody></table>';
      var prov = H.nsProvider(i.ns);
      html += '<h3 style="margin-top:18px">Nameservers' + (prov ? ' <span class="pill pill-blue">' + esc(prov) + '</span>' : '') + '</h3><div class="chips">' +
        (i.ns.length ? i.ns.map(function (n) { return '<span class="chip">' + esc(n) + '</span>'; }).join('') : '<span class="muted">None listed</span>') + '</div>' +
        '<details style="margin-top:16px"><summary class="small">Raw RDAP response</summary><pre class="code">' + esc(JSON.stringify(r.raw, null, 2)).slice(0, 20000) + '</pre></details>';
    }
    return html + H.cta(p);
  };

  T['domain-age-checker'] = function (root) {
    root.innerHTML = H.input({ button: 'Check age' });
    H.bind(root, function (p, out) {
      H.loading(out);
      Promise.all([H.rdap(p), H.wayback(p.domain).catch(function () { return null; })]).then(function (a) {
        var r = a[0], w = a[1];
        if (r.state !== 'registered') { out.innerHTML = H.rdapHtml(p, r); return; }
        var age = H.age(r.info.registration);
        out.innerHTML = '<div class="result-grid">' +
          H.kv('Domain age', age ? age.y + ' years, ' + age.m + ' months, ' + age.d + ' days' : 'Not published') +
          H.kv('Registered on', BN.date(r.info.registration)) +
          H.kv('First website capture', w && w.first ? BN.date(H.ts(w.first)) : 'None found') +
          H.kv('Years with captures', w ? w.count : '—') + '</div>' +
          (w && w.first && r.info.registration && H.ts(w.first) < r.info.registration.slice(0, 10)
            ? '<div class="notice">The website was archived before the current registration date — the domain has probably been dropped and re-registered at least once.</div>' : '') +
          H.cta(p);
      });
    });
  };

  T['dns-lookup'] = function (root) {
    root.innerHTML = H.input({ label: 'Domain or hostname', button: 'Look up', extra: '<div class="field" style="max-width:180px"><label for="tt">Record type</label><select id="tt"><option>All common</option><option>A</option><option>AAAA</option><option>MX</option><option>NS</option><option>TXT</option><option>CNAME</option><option>SOA</option><option>CAA</option></select></div>' });
    H.bind(root, function (raw, out) {
      var name = raw.toLowerCase().replace(/^[a-z]+:\/\//, '').split(/[\/?#]/)[0];
      if (!/\./.test(name)) { out.innerHTML = '<div class="notice warn">Enter a domain or hostname.</div>'; return; }
      var sel = H.$('#tt', root).value, types = sel === 'All common' ? ['A', 'AAAA', 'NS', 'MX', 'TXT', 'CNAME', 'SOA'] : [sel];
      H.loading(out);
      Promise.all(types.map(function (t) { return H.dns(name, t).then(function (r) { return [t, r]; }).catch(function () { return [t, null]; }); })).then(function (res) {
        if (res.every(function (x) { return x[1] && x[1].status === 3; })) { out.innerHTML = '<div class="notice warn"><b>NXDOMAIN</b> — ' + esc(name) + ' does not exist in DNS. It may be unregistered.</div>'; return; }
        var rows = '';
        res.forEach(function (x) {
          var t = x[0], r = x[1];
          if (!r) { rows += '<tr><td>' + t + '</td><td colspan="2" class="muted">Lookup failed</td></tr>'; return; }
          if (!r.answers.length) { rows += '<tr><td>' + t + '</td><td colspan="2" class="muted">No records</td></tr>'; return; }
          r.answers.forEach(function (a) { rows += '<tr><td>' + t + '</td><td><code>' + esc(a.data) + '</code></td><td class="num">' + a.ttl + 's</td></tr>'; });
        });
        var ns = (res.filter(function (x) { return x[0] === 'NS'; })[0] || [0, { answers: [] }])[1];
        var prov = ns ? H.nsProvider(ns.answers.map(function (a) { return a.data; })) : '';
        out.innerHTML = (prov ? '<div class="notice">Nameservers point to <b>' + esc(prov) + '</b>.</div>' : '') +
          '<div class="table-wrap"><table><thead><tr><th>Type</th><th>Value</th><th class="num">TTL</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
      });
    }, { raw: true });
  };

  var POPULAR = ['com', 'net', 'org', 'io', 'ai', 'co', 'app', 'dev', 'xyz', 'ca', 'us', 'uk', 'in', 'me', 'tv', 'so', 'gg', 'shop', 'store', 'online'];
  T['domain-availability-checker'] = function (root) {
    var boxes = POPULAR.map(function (t, i) { return '<label class="check" style="display:inline-flex;margin:4px 12px 4px 0"><input type="checkbox" value="' + t + '"' + (i < 12 ? ' checked' : '') + '> .' + t + '</label>'; }).join('');
    root.innerHTML = H.input({ label: 'Name (with or without extension)', placeholder: 'brandname', button: 'Check' }).replace('<div class="tool-out"', '<div class="tlds" style="margin-top:12px">' + boxes + '</div><div class="tool-out"');
    var extra = BN.param('tld'); if (extra) { var cb = H.$('.tlds input[value="' + extra + '"]', root); if (cb) cb.checked = true; else H.$('.tlds', root).insertAdjacentHTML('afterbegin', '<label class="check" style="display:inline-flex;margin:4px 12px 4px 0"><input type="checkbox" value="' + esc(extra) + '" checked> .' + esc(extra) + '</label>'); }
    H.bind(root, function (raw, out) {
      var name = raw.toLowerCase().replace(/^[a-z]+:\/\//, '').replace(/^www\./, '').split(/[\/?#\s]/)[0];
      var sld = name.indexOf('.') !== -1 ? name.split('.')[0] : name;
      sld = sld.replace(/[^a-z0-9-]/g, '');
      if (!sld) { out.innerHTML = '<div class="notice warn">Enter a name.</div>'; return; }
      var tlds = H.$$('.tlds input:checked', root).map(function (c) { return c.value; });
      out.innerHTML = '<div class="table-wrap"><table><thead><tr><th>Domain</th><th>Status</th><th></th></tr></thead><tbody>' +
        tlds.map(function (t) { return '<tr data-d="' + sld + '.' + t + '"><td class="dn">' + sld + '.' + t + '</td><td><span class="spinner"></span></td><td></td></tr>'; }).join('') + '</tbody></table></div>';
      H.pool(tlds.map(function (t) { return sld + '.' + t; }), 4, H.availability, function (d, state) {
        var tr = H.$('tr[data-d="' + d + '"]', out);
        tr.cells[1].innerHTML = H.badge(state);
        tr.cells[2].innerHTML = state === 'registered' ? '<a href="/tools/domain-report.html?d=' + d + '">Report</a>' : '<a href="/tools/whois-lookup.html?d=' + d + '">Verify</a>';
      });
    }, { raw: true });
  };

  T['bulk-domain-checker'] = function (root) {
    root.innerHTML = '<div class="field"><label for="bl">Domains (one per line, up to 200)</label><textarea id="bl" rows="8" placeholder="example.com&#10;anotherexample.net"></textarea></div>' +
      '<div class="tool-actions"><button class="btn btn-primary" type="button" id="bgo">Check all</button><label class="check"><input type="checkbox" id="bav"> Show only available</label><button class="btn btn-ghost btn-sm" type="button" id="bcsv" disabled>Export CSV</button></div><div class="tool-out"></div>';
    var rows = [];
    H.$('#bgo', root).addEventListener('click', function () {
      var list = H.$('#bl', root).value.split(/[\s,;]+/).map(function (x) { var p = BN.parseDomain(x); return p && p.domain; }).filter(Boolean);
      list = list.filter(function (d, i) { return list.indexOf(d) === i; }).slice(0, 200);
      var out = H.$('.tool-out', root); rows = [];
      if (!list.length) { out.innerHTML = '<div class="notice warn">Paste at least one valid domain.</div>'; return; }
      H.words().then(function () {
        out.innerHTML = '<p class="small" id="bprog">0 / ' + list.length + '</p><div class="table-wrap"><table data-sortable><thead><tr><th data-sort>Domain</th><th data-sort>Status</th><th>Nameservers</th><th data-sort>Email</th><th data-sort="num" class="num">Score</th><th data-sort="num" class="num">Est. value</th></tr></thead><tbody></tbody></table></div>';
        var tb = H.$('tbody', out), n = 0;
        BN.sortable(H.$('table', out));
        H.pool(list, 4, function (d) {
          var p = BN.parseDomain(d);
          return Promise.all([H.dns(d, 'NS').catch(function () { return null; }), H.dns(d, 'MX').catch(function () { return null; })]).then(function (a) {
            var ns = a[0], mx = a[1], st = !ns ? 'unknown' : ns.status === 3 ? 'likely' : 'registered';
            var ap = A.appraise(p);
            return { d: d, st: st, ns: ns ? ns.answers.map(function (x) { return x.data; }) : [], mx: mx ? mx.answers.length > 0 : false, score: ap.score, val: ap.point };
          });
        }, function (d, r) {
          if (!r) return; rows.push(r); n++;
          H.$('#bprog', out).textContent = n + ' / ' + list.length;
          tb.insertAdjacentHTML('beforeend', '<tr data-st="' + r.st + '"><td class="dn"><a href="/tools/domain-report.html?d=' + r.d + '">' + r.d + '</a></td><td data-v="' + r.st + '">' + H.badge(r.st) + '</td><td class="small">' + esc(H.nsProvider(r.ns) || r.ns.slice(0, 2).join(', ')) + '</td><td>' + (r.mx ? 'Yes' : '—') + '</td><td class="num">' + r.score + '</td><td class="num" data-v="' + r.val + '">' + BN.money(r.val) + '</td></tr>');
          filter();
        }).then(function () { H.$('#bcsv', root).disabled = false; });
      });
    });
    function filter() { var only = H.$('#bav', root).checked; H.$$('tbody tr', root).forEach(function (tr) { tr.hidden = only && tr.getAttribute('data-st') === 'registered'; }); }
    H.$('#bav', root).addEventListener('change', filter);
    H.$('#bcsv', root).addEventListener('click', function () {
      BN.download('bulk-domain-check.csv', BN.csv([['domain', 'status', 'nameservers', 'email', 'score', 'estimated_value_usd']].concat(rows.map(function (r) { return [r.d, r.st, r.ns.join(' '), r.mx ? 'yes' : 'no', r.score, r.val]; }))), 'text/csv');
    });
  };

  T['wayback-history'] = function (root) {
    root.innerHTML = H.input({ button: 'Show history' });
    H.bind(root, function (p, out) {
      H.loading(out, 'Reading the Internet Archive…');
      H.wayback(p.domain).then(function (w) {
        if (!w.count) { out.innerHTML = '<div class="notice">No Wayback Machine captures found for ' + esc(p.domain) + '.</div>'; return; }
        var now = new Date().getFullYear(), start = +w.first.slice(0, 4), bars = '';
        for (var y = start; y <= now; y++) {
          var t = w.years[y];
          bars += '<a title="' + y + '" href="' + (t ? 'https://web.archive.org/web/' + t + '/' + p.domain : '#') + '" target="_blank" rel="noopener" style="flex:1;min-width:14px;text-align:center;font-size:11px;color:var(--muted)"><span style="display:block;height:46px;border-radius:4px;background:' + (t ? 'var(--accent)' : 'var(--surface-2)') + '"></span>' + String(y).slice(2) + '</a>';
        }
        out.innerHTML = '<div class="result-grid">' + H.kv('First capture', BN.date(H.ts(w.first))) + H.kv('Latest capture', BN.date(H.ts(w.last))) + H.kv('Years with captures', w.count) + H.kv('Span', (now - start + 1) + ' years') + '</div>' +
          '<div style="display:flex;gap:3px;align-items:end;margin:12px 0 6px">' + bars + '</div><p class="small">Green years have at least one capture — click to open that year\'s first snapshot.</p>' +
          '<div class="tool-actions"><a class="btn btn-ghost btn-sm" target="_blank" rel="noopener" href="https://web.archive.org/web/*/' + p.domain + '">Open full calendar on the Wayback Machine</a></div>' + H.cta(p);
      }).catch(function () {
        out.innerHTML = '<div class="notice warn">The Internet Archive did not respond. <a target="_blank" rel="noopener" href="https://web.archive.org/web/*/' + p.domain + '">Open the Wayback Machine directly</a>.</div>';
      });
    });
  };

  T['email-mx-checker'] = function (root) {
    root.innerHTML = H.input({ button: 'Check email' });
    H.bind(root, function (p, out) {
      H.loading(out);
      Promise.all([H.dns(p.domain, 'MX'), H.dns(p.domain, 'TXT'), H.dns('_dmarc.' + p.domain, 'TXT')]).then(function (a) {
        var mx = a[0].answers.map(function (x) { return x.data; }), txt = a[1].answers.map(function (x) { return x.data; });
        var spf = txt.filter(function (t) { return /^v=spf1/i.test(t); })[0], dmarc = a[2].answers.map(function (x) { return x.data; }).filter(function (t) { return /^v=DMARC1/i.test(t); })[0];
        var pol = dmarc && (dmarc.match(/p=(\w+)/i) || [])[1];
        var nullMx = mx.length === 1 && /^0 \.$/.test(mx[0]);
        var verdict = nullMx ? ['ok', 'This domain publishes a "null MX" — it explicitly does not accept email.']
          : mx.length ? ['warn', 'This domain receives email. Plan a migration before any transfer, and as a buyer expect stray mail for a while.']
            : ['ok', 'No MX records — the domain is not set up to receive email.'];
        out.innerHTML = '<div class="notice ' + verdict[0] + '">' + verdict[1] + '</div><div class="result-grid">' +
          H.kv('Mail provider', esc(H.mailProvider(mx) || '—')) + H.kv('MX records', mx.length) +
          H.kv('SPF', spf ? 'Present' : 'Missing') + H.kv('DMARC policy', pol ? esc(pol) : 'None') + '</div>' +
          (mx.length ? '<h3>MX</h3><div class="chips">' + mx.map(function (m) { return '<span class="chip">' + esc(m) + '</span>'; }).join('') + '</div>' : '') +
          (spf ? '<h3 style="margin-top:14px">SPF</h3><pre class="code">' + esc(spf) + '</pre>' : '') +
          (dmarc ? '<h3 style="margin-top:14px">DMARC</h3><pre class="code">' + esc(dmarc) + '</pre>' : '');
      }).catch(function () { out.innerHTML = '<div class="notice bad">DNS lookup failed. Try again shortly.</div>'; });
    });
  };

  T['reputation-check'] = function (root) {
    root.innerHTML = H.input({ button: 'Check reputation' });
    H.bind(root, function (p, out) {
      H.loading(out);
      var d = encodeURIComponent(p.domain);
      Promise.all([H.dns(p.domain, 'A').catch(function () { return null; }), H.dns(p.domain, 'MX').catch(function () { return null; }), H.wayback(p.domain).catch(function () { return null; })]).then(function (a) {
        var links = [
          ['Google Safe Browsing status', 'https://transparencyreport.google.com/safe-browsing/search?url=' + d],
          ['VirusTotal', 'https://www.virustotal.com/gui/domain/' + d],
          ['Spamhaus domain reputation', 'https://check.spamhaus.org/results/?query=' + d],
          ['URLVoid', 'https://www.urlvoid.com/scan/' + d + '/'],
          ['MXToolbox blacklist check', 'https://mxtoolbox.com/SuperTool.aspx?action=blacklist%3a' + d],
          ['Ahrefs backlink checker', 'https://ahrefs.com/backlink-checker?input=' + d],
          ['Wayback Machine calendar', 'https://web.archive.org/web/*/' + d]
        ];
        out.innerHTML = '<div class="result-grid">' + H.kv('Resolves (A record)', a[0] && a[0].answers.length ? 'Yes' : 'No') +
          H.kv('Receives email', a[1] && a[1].answers.length ? 'Yes' : 'No') + H.kv('Years archived', a[2] ? a[2].count : '—') +
          H.kv('First archived', a[2] && a[2].first ? H.ts(a[2].first).slice(0, 4) : '—') + '</div>' +
          '<h3>Check with reputation services</h3><p class="small">Each link opens the service with the domain pre-filled. Results are theirs, not BetterNic\'s.</p><div class="tool-grid">' +
          links.map(function (l) { return '<a class="card" target="_blank" rel="noopener" href="' + l[1] + '"><b>' + esc(l[0]) + '</b><p class="small">' + esc(p.domain) + ' ↗</p></a>'; }).join('') + '</div>' + H.cta(p);
      });
    });
  };

  T['tld-explorer'] = function (root) {
    root.innerHTML = '<div class="filters"><input type="search" id="tq" placeholder="Filter extensions, e.g. app"><select id="tg"><option value="">All groups</option><option value="generic">Generic (legacy)</option><option value="cc">Country-code</option><option value="new">New gTLD / brand</option><option value="idn">IDN</option></select><span class="small" id="tc"></span></div><div class="tool-out"><p class="muted"><span class="spinner"></span> Loading the IANA root zone list…</p></div>';
    BN.data('tlds').then(function (j) {
      var list = j.tlds || [];
      function run() {
        var q = H.$('#tq', root).value.trim().toLowerCase().replace(/^\./, ''), g = H.$('#tg', root).value;
        var f = list.filter(function (t) { return (!q || t.t.indexOf(q) !== -1 || (t.u || '').indexOf(q) !== -1) && (!g || t.g === g); });
        H.$('#tc', root).textContent = f.length + ' of ' + list.length + ' TLDs · updated ' + BN.date(j.updated);
        H.$('.tool-out', root).innerHTML = '<div class="chips">' + f.slice(0, 1500).map(function (t) {
          return '<a class="chip" href="/tools/domain-availability-checker.html?tld=' + encodeURIComponent(t.t) + '" title="' + esc(t.g) + '">.' + esc(t.u || t.t) + '</a>';
        }).join('') + '</div>';
      }
      H.$('#tq', root).addEventListener('input', run); H.$('#tg', root).addEventListener('change', run); run();
    }).catch(function () { H.$('.tool-out', root).innerHTML = '<div class="notice warn">The TLD list is refreshing — try again shortly.</div>'; });
  };

  /* RFC 3492 punycode decoder */
  H.punyDecode = function (input) {
    var base = 36, tmin = 1, tmax = 26, skew = 38, damp = 700, n = 128, i = 0, bias = 72, out = [];
    var b = input.lastIndexOf('-'); if (b < 0) b = 0;
    for (var j = 0; j < b; j++) out.push(input.charCodeAt(j));
    function adapt(delta, num, first) { delta = first ? Math.floor(delta / damp) : delta >> 1; delta += Math.floor(delta / num); var k = 0; while (delta > ((base - tmin) * tmax) >> 1) { delta = Math.floor(delta / (base - tmin)); k += base; } return k + Math.floor((base - tmin + 1) * delta / (delta + skew)); }
    for (var idx = b > 0 ? b + 1 : 0; idx < input.length;) {
      var oldi = i, w = 1;
      for (var k = base; ; k += base) {
        var c = input.charCodeAt(idx++), digit = c - 48 < 10 ? c - 22 : c - 65 < 26 ? c - 65 : c - 97 < 26 ? c - 97 : base;
        i += digit * w; var t = k <= bias ? tmin : k >= bias + tmax ? tmax : k - bias;
        if (digit < t) break; w *= base - t;
      }
      bias = adapt(i - oldi, out.length + 1, oldi === 0); n += Math.floor(i / (out.length + 1)); i %= out.length + 1; out.splice(i++, 0, n);
    }
    return String.fromCodePoint.apply(null, out);
  };
  T['idn-punycode-converter'] = function (root) {
    root.innerHTML = H.input({ label: 'Unicode or punycode domain', placeholder: 'bücher.de or xn--bcher-kva.de', button: 'Convert' });
    H.bind(root, function (raw, out) {
      var s = raw.trim().toLowerCase().replace(/^[a-z]+:\/\//, '').split(/[\/?#]/)[0];
      if (!s) return;
      var ascii, uni;
      try {
        if (/xn--/.test(s)) { ascii = s; uni = s.split('.').map(function (l) { return /^xn--/.test(l) ? H.punyDecode(l.slice(4)) : l; }).join('.'); }
        else { ascii = new URL('http://' + s).hostname; uni = s; }
      } catch (e) { out.innerHTML = '<div class="notice bad">That doesn\'t look like a valid domain.</div>'; return; }
      var scripts = {};
      Array.from(uni.replace(/[.\-0-9]/g, '')).forEach(function (ch) {
        var c = ch.codePointAt(0), sc = c < 0x250 ? 'Latin' : c >= 0x370 && c < 0x400 ? 'Greek' : c >= 0x400 && c < 0x530 ? 'Cyrillic' : c >= 0x590 && c < 0x600 ? 'Hebrew' : c >= 0x600 && c < 0x700 ? 'Arabic' : c >= 0x900 && c < 0x980 ? 'Devanagari' : c >= 0x4e00 && c < 0xa000 ? 'Han' : c >= 0x3040 && c < 0x3100 ? 'Kana' : c >= 0xac00 && c < 0xd7b0 ? 'Hangul' : 'Other';
        scripts[sc] = (scripts[sc] || 0) + 1;
      });
      var names = Object.keys(scripts), mixed = names.length > 1;
      out.innerHTML = '<div class="result-grid">' + H.kv('Unicode', '<span class="dn">' + esc(uni) + '</span>') + H.kv('Punycode (ASCII)', '<span class="dn">' + esc(ascii) + '</span>') + H.kv('Scripts', esc(names.join(', ') || 'ASCII only')) + '</div>' +
        (mixed ? '<div class="notice warn">Mixed scripts detected. Mixed-script names can imitate other domains (homograph attacks) and browsers may display them as punycode.</div>' : '') +
        '<div class="tool-actions"><button class="btn btn-ghost btn-sm" type="button" data-copy="' + esc(ascii) + '">Copy punycode</button><button class="btn btn-ghost btn-sm" type="button" data-copy="' + esc(uni) + '">Copy Unicode</button></div>';
      H.$$('[data-copy]', out).forEach(function (b) { b.onclick = function () { BN.copy(b.getAttribute('data-copy')); }; });
    }, { raw: true });
  };

  /* =============== VALUATION =============== */
  H.appraisalHtml = function (p, ap) {
    var fl = ap.factors.map(function (f) {
      var v = f[1] == null ? '' : (f[1] > 0 ? '<span class="pos">+' + f[1] + '</span>' : '<span class="neg">' + f[1] + '</span>');
      return '<li><span>' + esc(f[0]) + '</span>' + v + '</li>';
    }).join('');
    return '<div class="grid-2"><div><p class="eyebrow">Estimated retail value</p><div class="dn" style="font-size:38px">' + BN.money(ap.retail[0]) + ' – ' + BN.money(ap.retail[1]) + '</div>' +
      '<p class="muted">Wholesale (investor) range: <b>' + BN.money(ap.wholesale[0]) + ' – ' + BN.money(ap.wholesale[1]) + '</b></p>' +
      '<div class="result-grid">' + H.kv('Name score', ap.score + '/99') + H.kv('Liquidity', ap.liquidity) + H.kv('Type', ap.type) + H.kv('Pattern', '<code>' + esc(ap.pattern) + '</code>') + '</div>' +
      '<div class="meter"><i style="width:' + ap.score + '%"></i></div>' +
      (ap.words.length > 1 ? '<p class="small">Read as: <b>' + esc(ap.words.join(' + ')) + '</b></p>' : '') + '</div>' +
      '<div><h3>How we got there</h3><ul class="factor-list">' + fl + '</ul></div></div>' +
      '<p class="small">Automated estimate for research only — it does not see traffic, sales history, buyer demand or trademarks. Not a certified valuation.</p>';
  };
  T['domain-appraisal'] = function (root) {
    root.innerHTML = H.input({ button: 'Appraise' });
    H.bind(root, function (p, out) {
      H.loading(out, 'Scoring…');
      H.words().then(function () {
        var ap = A.appraise(p);
        out.innerHTML = H.appraisalHtml(p, ap) + H.cta(p) +
          '<div class="tool-actions"><a class="btn btn-ghost btn-sm" href="/tools/domain-price-calculator.html?d=' + encodeURIComponent(p.domain) + '">Turn this into an asking price →</a><a class="btn btn-ghost btn-sm" href="/leads.html?intent=appraisal&d=' + encodeURIComponent(p.domain) + '">Request a human appraisal</a></div>';
      });
    });
  };
  T['brandability-score'] = function (root) {
    root.innerHTML = H.input({ label: 'Domain or name', button: 'Score' });
    H.bind(root, function (raw, out) {
      var p = BN.parseDomain(raw.indexOf('.') === -1 ? raw + '.com' : raw);
      if (!p) { out.innerHTML = '<div class="notice warn">Enter a name using letters, numbers or hyphens.</div>'; return; }
      H.words().then(function () {
        var b = A.brandability(p);
        out.innerHTML = '<div class="grid-2"><div><p class="eyebrow">Brandability</p><div class="dn" style="font-size:52px">' + b.score + '<span class="muted" style="font-size:20px">/99</span></div><div class="meter"><i style="width:' + b.score + '%"></i></div>' +
          '<p>' + (b.score >= 75 ? 'Strong brandable — short, clear and easy to say.' : b.score >= 55 ? 'Decent — usable, with some friction.' : 'Weak — consider a shorter or clearer alternative.') + '</p></div>' +
          '<div><ul class="factor-list">' + b.factors.map(function (f) { return '<li><span>' + esc(f[0]) + '</span><span class="' + (f[1] >= 0 ? 'pos' : 'neg') + '">' + (f[1] > 0 ? '+' : '') + f[1] + '</span></li>'; }).join('') + '</ul></div></div>' +
          '<div class="tool-actions"><a class="btn btn-ghost btn-sm" href="/tools/domain-name-generator.html?q=' + encodeURIComponent(p.sld) + '">Generate alternatives</a><a class="btn btn-ghost btn-sm" href="/tools/domain-appraisal.html?d=' + encodeURIComponent(p.domain) + '">Appraise ' + esc(p.domain) + '</a></div>';
      });
    }, { raw: true });
  };
  T['pattern-classifier'] = function (root) {
    root.innerHTML = H.input({ button: 'Classify' });
    H.bind(root, function (p, out) {
      var s = p.sld, LN = s.replace(/[a-z]/g, 'L').replace(/[0-9]/g, 'N').replace(/-/g, '-'), cv = A.cvPattern(s);
      var combos = 1; LN.split('').forEach(function (c) { combos *= c === 'L' ? 26 : c === 'N' ? 10 : 1; });
      var chip = /^[a-z]+$/.test(s) && !/[aeiouv]/.test(s);
      var notes = [];
      if (/^L{1,3}$/.test(LN)) notes.push('Every ' + LN + '.com is registered. These trade as liquid commodities with a market floor.');
      if (/^N{1,4}$/.test(LN)) notes.push('Short numeric names are popular with Chinese buyers; avoid 4s and favour 8s and repeating digits.');
      if (LN === 'LLLL') notes.push('Four-letter .com names are all registered; CVCV and pronounceable patterns sell to end users, "chips" to investors.');
      if (LN === 'NNNNN') notes.push('Five-number .com names number 100,000 — far less scarce than NNNN.');
      if (chip) notes.push('Chip: no vowels and no V — favoured by Chinese investors.');
      if (cv === 'CVCV') notes.push('CVCV: pronounceable four-letter brandable (e.g. "tavo").');
      out.innerHTML = '<div class="result-grid">' + H.kv('Character pattern', '<code>' + esc(LN) + '</code>') + H.kv('Consonant/vowel', '<code>' + esc(cv) + '</code>') +
        H.kv('Possible combinations', BN.num(combos)) + H.kv('Chip', chip ? 'Yes' : 'No') + '</div>' +
        (notes.length ? '<ul class="check-list">' + notes.map(function (n) { return '<li>' + esc(n) + '</li>'; }).join('') + '</ul>' : '') + H.cta(p);
    });
  };
  T['domain-comparison'] = function (root) {
    root.innerHTML = '<div class="field"><label for="cl">Domains to compare (2–5, one per line)</label><textarea id="cl" rows="5" placeholder="first.com&#10;second.io&#10;third.ai"></textarea></div>' +
      '<div class="field"><label for="cw">Weighting: value <span id="cwv">60</span>% · brandability <span id="cwb">40</span>%</label><input id="cw" type="range" min="0" max="100" value="60"></div>' +
      '<button class="btn btn-primary" type="button" id="cgo">Compare</button><div class="tool-out"></div>';
    var q = BN.param('d'); if (q) H.$('#cl', root).value = q.split(',').join('\n');
    function run() {
      var list = H.$('#cl', root).value.split(/\s+/).map(BN.parseDomain).filter(Boolean).slice(0, 5);
      var out = H.$('.tool-out', root);
      if (list.length < 2) { out.innerHTML = '<div class="notice warn">Enter at least two domains.</div>'; return; }
      H.words().then(function () {
        var w = +H.$('#cw', root).value / 100;
        var rows = list.map(function (p) { var ap = A.appraise(p), b = A.brandability(p); return { p: p, ap: ap, b: b }; });
        var maxV = Math.max.apply(null, rows.map(function (r) { return r.ap.point; }));
        rows.forEach(function (r) { r.total = Math.round(w * (r.ap.point / maxV) * 100 + (1 - w) * r.b.score); });
        var best = rows.reduce(function (a, b) { return b.total > a.total ? b : a; });
        function row(label, f, hi) {
          var vals = rows.map(f), top = hi === 'max' ? Math.max.apply(null, vals.map(Number)) : hi === 'min' ? Math.min.apply(null, vals.map(Number)) : null;
          return '<tr><th>' + label + '</th>' + rows.map(function (r, i) { var v = vals[i], fmt = typeof v === 'number' && label.indexOf('value') !== -1 ? BN.money(v) : esc(v); return '<td' + (top !== null && +v === top ? ' style="font-weight:700;color:var(--accent)"' : '') + '>' + fmt + '</td>'; }).join('') + '</tr>';
        }
        out.innerHTML = '<div class="table-wrap"><table><thead><tr><th></th>' + rows.map(function (r) { return '<th class="dn">' + esc(r.p.domain) + '</th>'; }).join('') + '</tr></thead><tbody>' +
          row('Overall score', function (r) { return r.total; }, 'max') + row('Est. value', function (r) { return r.ap.point; }, 'max') + row('Name score', function (r) { return r.ap.score; }, 'max') +
          row('Brandability', function (r) { return r.b.score; }, 'max') + row('Length', function (r) { return r.p.sld.length; }, 'min') + row('Extension', function (r) { return '.' + r.p.tld; }) +
          row('Liquidity', function (r) { return r.ap.liquidity; }) + '</tbody></table></div><div class="notice ok">Best overall: <b class="dn">' + esc(best.p.domain) + '</b></div>';
      });
    }
    H.$('#cgo', root).addEventListener('click', run);
    H.$('#cw', root).addEventListener('input', function () { H.$('#cwv', root).textContent = this.value; H.$('#cwb', root).textContent = 100 - this.value; });
    if (q) run();
  };
  T['domain-price-calculator'] = function (root) {
    root.innerHTML = H.input({ button: 'Calculate', placeholder: 'example.com', extra: '<div class="field" style="max-width:170px"><label for="pv">Or your value (USD)</label><input id="pv" type="number" min="1" placeholder="optional"></div><div class="field" style="max-width:190px"><label for="ps">Strategy</label><select id="ps"><option value="quick">Quick sale</option><option value="balanced" selected>Balanced</option><option value="max">Maximum price</option></select></div>' });
    H.bind(root, function (p, out) {
      H.words().then(function () {
        var ap = A.appraise(p), own = +H.$('#pv', root).value, s = H.$('#ps', root).value;
        var bin = own || (s === 'quick' ? ap.wholesale[1] * 1.5 : s === 'max' ? ap.retail[1] : ap.retail[0] * 1.2);
        bin = Math.max(bin, 99);
        var minPct = s === 'quick' ? .55 : s === 'max' ? .7 : .62;
        var nice = function (v) { if (v < 1000) return Math.round(v / 10) * 10 - 1; if (v < 10000) return Math.round(v / 100) * 100 - 12 + (v > 4000 ? 0 : 0); return Math.round(v / 1000) * 1000 - 12; };
        var markups = { 12: 0, 24: .1, 36: .2, 48: .25, 60: .3 };
        var lto = Object.keys(markups).map(function (m) { return '<tr><td>' + m + ' months</td><td class="num">' + BN.money(bin * (1 + markups[m]) / m) + '/mo</td><td class="num">' + BN.money(bin * (1 + markups[m])) + '</td></tr>'; }).join('');
        out.innerHTML = '<div class="result-grid">' + H.kv('Buy-now price', BN.money(nice(bin))) + H.kv('Minimum offer', BN.money(nice(bin * minPct))) +
          H.kv('Negotiation floor', BN.money(nice(bin * (minPct - .1)))) + H.kv('BetterNic commission', BN.money(bin * (bin < 50000 ? .05 : bin < 100000 ? .04 : .03))) + '</div>' +
          '<h3>Lease-to-own options</h3><div class="table-wrap"><table><thead><tr><th>Term</th><th class="num">Payment</th><th class="num">Total</th></tr></thead><tbody>' + lto + '</tbody></table></div>' +
          '<p class="small">Based on ' + (own ? 'your value' : 'the BetterNic estimate (' + BN.money(ap.retail[0]) + '–' + BN.money(ap.retail[1]) + ' retail)') + '.</p>' + H.cta(p);
      });
    });
  };

  T['domain-report'] = function (root) {
    root.innerHTML = H.input({ button: 'Run report' });
    H.bind(root, function (p, out) {
      var d = encodeURIComponent(p.domain);
      out.innerHTML = '<div class="dn dn-xl" style="margin-bottom:10px">' + esc(p.domain) + '</div>' +
        '<div class="grid-2"><div class="card" id="r-reg"><h3>Registration</h3><p class="muted"><span class="spinner"></span></p></div>' +
        '<div class="card" id="r-val"><h3>Value</h3><p class="muted"><span class="spinner"></span></p></div>' +
        '<div class="card" id="r-dns"><h3>DNS &amp; email</h3><p class="muted"><span class="spinner"></span></p></div>' +
        '<div class="card" id="r-hist"><h3>Website history</h3><p class="muted"><span class="spinner"></span></p></div>' +
        '<div class="card" id="r-brand"><h3>Brandability</h3><p class="muted"><span class="spinner"></span></p></div>' +
        '<div class="card" id="r-tm"><h3>Trademark checks</h3><p class="small">Open each office with the term pre-filled where supported:</p><div class="chips">' +
        '<a class="chip" target="_blank" rel="noopener" href="https://trademarks.justia.com/search?q=' + encodeURIComponent(p.sld) + '">US marks (Justia)</a>' +
        '<a class="chip" target="_blank" rel="noopener" href="https://tmsearch.uspto.gov/">USPTO</a><a class="chip" target="_blank" rel="noopener" href="https://branddb.wipo.int/">WIPO</a>' +
        '<a class="chip" target="_blank" rel="noopener" href="https://euipo.europa.eu/eSearch/">EUIPO</a><a class="chip" href="/tools/trademark-search.html?d=' + d + '">Famous-brand screen</a></div></div></div>' + H.cta(p);
      H.rdap(p).then(function (r) {
        var box = H.$('#r-reg', out);
        if (r.state !== 'registered') { box.innerHTML = '<h3>Registration</h3>' + H.rdapHtml(p, r).replace(/<div class="tool-actions">[\s\S]*$/, ''); return; }
        var i = r.info, age = H.age(i.registration), prov = H.nsProvider(i.ns);
        box.innerHTML = '<h3>Registration</h3><div class="result-grid" style="grid-template-columns:1fr 1fr">' + H.kv('Registrar', esc(i.registrar || '—')) + H.kv('Age', age ? age.text : '—') + H.kv('Expires', BN.date(i.expiration)) + H.kv('Hosting/parking', esc(prov || '—')) + '</div>' +
          '<p class="small">' + i.status.map(function (s) { return '<code>' + esc(s) + '</code>'; }).join(' ') + '</p><a class="small" href="/tools/whois-lookup.html?d=' + d + '">Full WHOIS →</a>';
      });
      H.words().then(function () {
        var ap = A.appraise(p), b = A.brandability(p);
        H.$('#r-val', out).innerHTML = '<h3>Value</h3><div class="dn" style="font-size:26px">' + BN.money(ap.retail[0]) + ' – ' + BN.money(ap.retail[1]) + '</div><p class="small">Estimated retail · wholesale ' + BN.money(ap.wholesale[0]) + '–' + BN.money(ap.wholesale[1]) + ' · liquidity ' + ap.liquidity + '</p><div class="meter"><i style="width:' + ap.score + '%"></i></div><a class="small" href="/tools/domain-appraisal.html?d=' + d + '">See the breakdown →</a>';
        H.$('#r-brand', out).innerHTML = '<h3>Brandability</h3><div class="dn" style="font-size:26px">' + b.score + '/99</div><div class="meter"><i style="width:' + b.score + '%"></i></div><p class="small">' + esc(b.factors.slice(0, 3).map(function (f) { return f[0]; }).join(' · ')) + '</p>';
      });
      Promise.all([H.dns(p.domain, 'A'), H.dns(p.domain, 'MX')]).then(function (a) {
        var ips = a[0].answers.map(function (x) { return x.data; }), mx = a[1].answers.map(function (x) { return x.data; });
        H.$('#r-dns', out).innerHTML = '<h3>DNS &amp; email</h3><div class="result-grid" style="grid-template-columns:1fr 1fr">' + H.kv('Resolves', ips.length ? 'Yes' : a[0].status === 3 ? 'NXDOMAIN' : 'No') + H.kv('Email', esc(H.mailProvider(mx) || 'Not configured')) + '</div><a class="small" href="/tools/dns-lookup.html?d=' + d + '">All records →</a>';
      }).catch(function () { H.$('#r-dns', out).innerHTML = '<h3>DNS &amp; email</h3><p class="muted">DNS lookup failed.</p>'; });
      H.wayback(p.domain).then(function (w) {
        H.$('#r-hist', out).innerHTML = '<h3>Website history</h3>' + (w.count ? '<div class="result-grid" style="grid-template-columns:1fr 1fr">' + H.kv('First capture', H.ts(w.first).slice(0, 4)) + H.kv('Years archived', w.count) + '</div>' : '<p class="muted">No archived website found.</p>') + '<a class="small" href="/tools/wayback-history.html?d=' + d + '">Timeline →</a>';
      }).catch(function () { H.$('#r-hist', out).innerHTML = '<h3>Website history</h3><p class="muted">Archive unavailable right now.</p>'; });
    });
  };

  /* ---------- boot ---------- */
  function boot() {
    var root = document.getElementById('tool'); if (!root) return;
    var slug = root.getAttribute('data-tool');
    if (T[slug]) T[slug](root);
  }
  T._boot = boot;
  if (document.readyState === 'complete') boot();
  else document.addEventListener('DOMContentLoaded', boot);
})();
