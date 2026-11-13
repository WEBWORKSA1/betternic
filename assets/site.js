/* BetterNic — shared site behaviour (no dependencies) */
(function () {
  'use strict';
  var BN = window.BN = window.BN || {};
  var build = document.body.getAttribute('data-build') || '';

  BN.esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  BN.money = function (n, cur) {
    if (n == null || isNaN(n)) return '—';
    try { return new Intl.NumberFormat('en-US', { style: 'currency', currency: cur || 'USD', maximumFractionDigits: (n < 10 && n % 1 !== 0) ? 2 : 0 }).format(n); }
    catch (e) { return '$' + Math.round(n).toLocaleString(); }
  };
  BN.num = function (n) { return n == null || isNaN(n) ? '—' : Number(n).toLocaleString('en-US'); };
  BN.date = function (iso) {
    if (!iso) return '—';
    var d = new Date(iso); if (isNaN(d)) return String(iso);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };
  BN.until = function (iso) {
    var d = new Date(iso); if (isNaN(d)) return '—';
    var ms = d - Date.now(); if (ms <= 0) return 'ended';
    var h = Math.floor(ms / 36e5), m = Math.floor((ms % 36e5) / 6e4);
    if (h >= 48) return Math.floor(h / 24) + 'd';
    return h ? h + 'h ' + m + 'm' : m + 'm';
  };
  BN.ago = function (iso) {
    var d = new Date(iso); if (isNaN(d)) return '';
    var s = (Date.now() - d) / 1000;
    if (s < 3600) return Math.max(1, Math.round(s / 60)) + 'm ago';
    if (s < 86400) return Math.round(s / 3600) + 'h ago';
    return Math.round(s / 86400) + 'd ago';
  };
  BN.toast = function (msg) {
    var t = document.createElement('div'); t.className = 'toast'; t.textContent = msg;
    document.body.appendChild(t); setTimeout(function () { t.remove(); }, 2600);
  };
  BN.copy = function (text) {
    (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(
      function () { BN.toast('Copied'); },
      function () {
        var ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select();
        try { document.execCommand('copy'); BN.toast('Copied'); } catch (e) { } ta.remove();
      });
  };
  BN.download = function (name, text, type) {
    var blob = text instanceof Blob ? text : new Blob([text], { type: type || 'text/plain' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  };
  BN.csv = function (rows) {
    return rows.map(function (r) {
      return r.map(function (c) { c = c == null ? '' : String(c); return /[",\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c; }).join(',');
    }).join('\n');
  };
  var dataCache = {};
  BN.data = function (name) {
    if (!dataCache[name]) {
      dataCache[name] = fetch('/data/' + name + '.json?v=' + build, { cache: 'force-cache' })
        .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); });
    }
    return dataCache[name];
  };
  BN.param = function (k) { return new URLSearchParams(location.search).get(k) || ''; };

  /* Domain parsing. Handles URLs, www, IDNs (to punycode) and multi-label suffixes. */
  var MULTI = ['co.uk', 'org.uk', 'me.uk', 'ltd.uk', 'plc.uk', 'co.in', 'net.in', 'org.in', 'firm.in', 'gen.in', 'ind.in',
    'com.au', 'net.au', 'org.au', 'co.nz', 'org.nz', 'net.nz', 'com.br', 'com.mx', 'co.za', 'co.jp', 'ne.jp', 'or.jp',
    'com.cn', 'net.cn', 'org.cn', 'com.sg', 'com.hk', 'co.kr', 'com.tw', 'com.tr', 'com.ar', 'com.co', 'co.il', 'com.my',
    'com.ph', 'com.pk', 'com.ng', 'co.id', 'com.vn', 'qc.ca', 'on.ca', 'bc.ca', 'gc.ca'];
  BN.parseDomain = function (input) {
    var s = String(input || '').trim().toLowerCase();
    if (!s) return null;
    s = s.replace(/^[a-z]+:\/\//, '').replace(/^www\./, '').split(/[\/?#\s:]/)[0].replace(/\.$/, '');
    if (s.indexOf('.') === -1) return null;
    var ascii = s;
    try { ascii = new URL('http://' + s).hostname; } catch (e) { return null; }
    if (!/^[a-z0-9.-]+$/.test(ascii) || /\.\./.test(ascii) || ascii.length > 253) return null;
    var labels = ascii.split('.');
    if (labels.some(function (l) { return !l || l.length > 63 || /^-|-$/.test(l); })) return null;
    var two = labels.slice(-2).join('.');
    var tld = MULTI.indexOf(two) !== -1 && labels.length >= 3 ? two : labels[labels.length - 1];
    var rest = ascii.slice(0, ascii.length - tld.length - 1).split('.');
    var sld = rest[rest.length - 1];
    var registrable = sld + '.' + tld;
    var unicode = s;
    return { input: input, domain: registrable, sld: sld, tld: tld, host: ascii, unicode: unicode, idn: /xn--/.test(registrable) };
  };

  /* ---------- header ---------- */
  var menuBtn = document.querySelector('.menu-btn'), nav = document.getElementById('nav');
  if (menuBtn && nav) menuBtn.addEventListener('click', function () {
    var o = nav.classList.toggle('open'); menuBtn.setAttribute('aria-expanded', o);
  });
  var more = document.querySelector('.more'), moreBtn = document.querySelector('.more-btn');
  if (more && moreBtn) {
    moreBtn.addEventListener('click', function (e) { e.stopPropagation(); var o = more.classList.toggle('open'); moreBtn.setAttribute('aria-expanded', o); });
    document.addEventListener('click', function () { more.classList.remove('open'); moreBtn.setAttribute('aria-expanded', 'false'); });
  }

  /* ---------- consent ---------- */
  var consent = document.getElementById('consent');
  function setConsent(v) {
    try { localStorage.setItem('bn_consent', v); } catch (e) { }
    var g = v === 'all' ? 'granted' : 'denied';
    if (window.gtag) gtag('consent', 'update', { ad_storage: g, ad_user_data: g, ad_personalization: g, analytics_storage: g });
    if (consent) consent.hidden = true;
  }
  try { if (consent && !localStorage.getItem('bn_consent')) consent.hidden = false; } catch (e) { }
  document.querySelectorAll('[data-consent]').forEach(function (b) {
    b.addEventListener('click', function () { setConsent(b.getAttribute('data-consent')); });
  });
  document.querySelectorAll('[data-consent-open]').forEach(function (b) {
    b.addEventListener('click', function () { if (consent) consent.hidden = false; });
  });

  /* ---------- forms (Netlify) ---------- */
  function prefill(f) {
    var page = f.querySelector('input[name=page]'); if (page) page.value = location.pathname + location.search;
    ['d', 'domain', 'intent', 'role', 'price', 'package'].forEach(function (k) {
      var v = BN.param(k); if (!v) return;
      var name = k === 'd' ? 'domain' : k;
      var el = f.querySelector('[name="' + name + '"]');
      if (el && !el.value) {
        if (el.type === 'radio') { var r = f.querySelector('[name="' + name + '"][value="' + v + '"]'); if (r) r.checked = true; }
        else el.value = v;
      }
    });
  }
  document.querySelectorAll('form.nf').forEach(function (f) {
    prefill(f);
    f.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var status = f.querySelector('.form-status'), btn = f.querySelector('button[type=submit]');
      if (!f.checkValidity()) { f.reportValidity(); return; }
      var fd = new FormData(f), body = new URLSearchParams();
      var multi = {};
      fd.forEach(function (v, k) { if (multi[k] !== undefined) multi[k] += ', ' + v; else multi[k] = v; });
      Object.keys(multi).forEach(function (k) { body.append(k, multi[k]); });
      btn.disabled = true; status.className = 'form-status'; status.textContent = 'Sending…';
      fetch('/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString() })
        .then(function (r) {
          if (!r.ok) throw new Error(r.status);
          status.className = 'form-status ok'; status.textContent = f.getAttribute('data-success');
          f.reset(); prefill(f);
          f.querySelectorAll('.step').forEach(function (s, i) { s.classList.toggle('on', i === 0); });
          try { localStorage.setItem('bn_lead', '1'); } catch (e) { }
        })
        .catch(function () {
          status.className = 'form-status err';
          status.innerHTML = 'We couldn’t send that just now. Please try again, or use the contact link at the very top of the page.';
        })
        .finally(function () { btn.disabled = false; });
    });
  });
  /* multi-step forms */
  document.querySelectorAll('[data-steps]').forEach(function (f) {
    var steps = f.querySelectorAll('.step'), bars = f.querySelectorAll('.steps-nav span');
    function go(i) {
      steps.forEach(function (s, j) { s.classList.toggle('on', j === i); });
      bars.forEach(function (b, j) { b.classList.toggle('on', j <= i); });
      f.setAttribute('data-step', i);
    }
    f.querySelectorAll('[data-next]').forEach(function (b) {
      b.addEventListener('click', function () {
        var i = +f.getAttribute('data-step') || 0, cur = steps[i];
        var bad = Array.prototype.find.call(cur.querySelectorAll('input,select,textarea'), function (x) { return !x.checkValidity(); });
        if (bad) { bad.reportValidity(); return; }
        go(Math.min(i + 1, steps.length - 1));
      });
    });
    f.querySelectorAll('[data-prev]').forEach(function (b) {
      b.addEventListener('click', function () { go(Math.max((+f.getAttribute('data-step') || 0) - 1, 0)); });
    });
    go(0);
  });

  /* ---------- hero / quick search ---------- */
  document.querySelectorAll('form[data-domain-search]').forEach(function (f) {
    f.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var inp = f.querySelector('input'), p = BN.parseDomain(inp.value);
      var target = f.getAttribute('data-domain-search') || '/tools/domain-report.html';
      if (!p) {
        var kw = inp.value.trim();
        if (kw) location.href = '/tools/domain-name-generator.html?q=' + encodeURIComponent(kw);
        return;
      }
      location.href = target + '?d=' + encodeURIComponent(p.domain);
    });
  });

  /* ---------- YouTube facade ---------- */
  document.addEventListener('click', function (ev) {
    var b = ev.target.closest && ev.target.closest('.yt[data-id]');
    if (!b || b.querySelector('iframe')) return;
    var id = b.getAttribute('data-id');
    if (!/^[\w-]{11}$/.test(id)) return;
    var f = document.createElement('iframe');
    f.src = 'https://www.youtube-nocookie.com/embed/' + id + '?autoplay=1&rel=0';
    f.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
    f.allowFullscreen = true; f.title = b.getAttribute('aria-label') || 'YouTube video';
    b.appendChild(f);
  });

  /* ---------- relative times & countdowns ---------- */
  function tick() {
    document.querySelectorAll('[data-until]').forEach(function (el) { el.textContent = BN.until(el.getAttribute('data-until')); });
    document.querySelectorAll('[data-ago]').forEach(function (el) { el.textContent = BN.ago(el.getAttribute('data-ago')); });
  }
  tick(); setInterval(tick, 60000);

  /* ---------- sortable tables ---------- */
  BN.sortable = function (table) {
    table.querySelectorAll('th[data-sort]').forEach(function (th, idx) {
      th.addEventListener('click', function () {
        var tb = table.tBodies[0], rows = Array.prototype.slice.call(tb.rows);
        var col = Array.prototype.indexOf.call(th.parentNode.children, th);
        var dir = th.getAttribute('data-dir') === 'asc' ? 'desc' : 'asc';
        table.querySelectorAll('th').forEach(function (x) { x.removeAttribute('data-dir'); });
        th.setAttribute('data-dir', dir);
        var num = th.getAttribute('data-sort') === 'num';
        rows.sort(function (a, b) {
          var x = a.cells[col].getAttribute('data-v') || a.cells[col].textContent, y = b.cells[col].getAttribute('data-v') || b.cells[col].textContent;
          if (num) { x = parseFloat(x) || 0; y = parseFloat(y) || 0; return dir === 'asc' ? x - y : y - x; }
          return dir === 'asc' ? x.localeCompare(y) : y.localeCompare(x);
        });
        rows.forEach(function (r) { tb.appendChild(r); });
      });
    });
  };
  document.querySelectorAll('table[data-sortable]').forEach(BN.sortable);

  /* ---------- client-side list filter (news, compare, tools) ---------- */
  document.querySelectorAll('[data-filter-input]').forEach(function (inp) {
    var target = document.querySelector(inp.getAttribute('data-filter-input'));
    var sel = document.querySelector(inp.getAttribute('data-filter-select') || '_none_');
    function run() {
      var q = inp.value.trim().toLowerCase(), cat = sel ? sel.value : '';
      var shown = 0;
      target.querySelectorAll('[data-text]').forEach(function (el) {
        var ok = (!q || el.getAttribute('data-text').indexOf(q) !== -1) && (!cat || (el.getAttribute('data-cat') || '').split(' ').indexOf(cat) !== -1);
        el.hidden = !ok; if (ok) shown++;
      });
      var c = document.querySelector(inp.getAttribute('data-filter-count') || '_none_'); if (c) c.textContent = shown;
    }
    inp.addEventListener('input', run); if (sel) sel.addEventListener('change', run);
    var q0 = BN.param('q'); if (q0) { inp.value = q0; } run();
  });

  /* ---------- marketplace listing page (/domain.html?d=) ---------- */
  var lp = document.querySelector('[data-listing-page]');
  if (lp) {
    var p = BN.parseDomain(BN.param('d'));
    BN.data('listings').then(function (j) {
      var items = (j && j.items) || [];
      var item = p && items.filter(function (x) { return x.domain === p.domain; })[0];
      if (item && item.slug) { location.replace('/d/' + item.slug + '.html'); return; }
      var name = p ? p.domain : '';
      document.querySelectorAll('[data-domain-name]').forEach(function (el) { el.textContent = name || 'this domain'; });
      document.querySelectorAll('input[name=domain]').forEach(function (el) { if (!el.value) el.value = name; });
      var rep = document.querySelector('[data-report-link]'); if (rep && name) rep.href = '/tools/domain-report.html?d=' + encodeURIComponent(name);
    }).catch(function () { });
  }
})();
