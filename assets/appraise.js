/* BetterNic appraisal model v1 — transparent heuristic estimator.
   Mirrors scripts/appraise.py (used to score auction inventory daily). Research use only. */
(function () {
  'use strict';
  var A = window.BNAppraise = {};
  var RANK = null; // word -> rank

  A.loadWords = function () {
    if (RANK) return Promise.resolve(RANK);
    return fetch('/data/words.json?v=' + (document.body.getAttribute('data-build') || ''))
      .then(function (r) { return r.json(); })
      .then(function (j) { RANK = {}; (j.words || []).forEach(function (w, i) { RANK[w] = i + 1; }); return RANK; })
      .catch(function () { RANK = {}; return RANK; });
  };

  var TLD = {
    com: 1, net: .18, org: .2, io: .3, ai: .45, co: .18, app: .12, dev: .1, me: .1, tv: .1, us: .08, ca: .12, de: .15,
    uk: .12, 'co.uk': .12, 'in': .08, au: .1, 'com.au': .1, xyz: .04, info: .05, biz: .04, online: .03, site: .02, store: .05,
    shop: .06, tech: .05, cloud: .06, gg: .1, so: .08, ly: .08, to: .08, fr: .1, nl: .1, es: .08, it: .08, ch: .12, cn: .12,
    jp: .08, eu: .08, vc: .1, fm: .08, xxx: .03, club: .03, live: .03, pro: .04, inc: .06, bot: .06, finance: .05, money: .05
  };
  var PREMIUM = ('ai,crypto,pay,bank,loan,loans,insurance,health,home,homes,car,cars,travel,shop,buy,cloud,data,solar,energy,law,legal,' +
    'dental,credit,cash,money,invest,trade,trading,bet,casino,poker,hotel,hotels,jobs,job,food,diet,fit,fitness,beauty,skin,pet,pets,' +
    'baby,kids,games,game,play,stream,video,music,learn,school,tutor,doctor,clinic,care,rx,med,vet,realty,estate,rent,mortgage,tax,' +
    'pro,hub,lab,labs,ly,app,bio,gen,eco,green,smart,robot,bot,chat,code,dev,web,net,link,meta,quantum,coin,wallet,nft,dao,vpn,' +
    'secure,cyber,space,auto,drive,fly,air,sky,sun,wave,flow,mind,brain,life,love,gold,lux,luxury,vip,deal,deals,sale,store,market').split(',');
  var VOW = /[aeiouy]/;

  A.tldWeight = function (tld) {
    if (TLD[tld] != null) return TLD[tld];
    if (/^xn--/.test(tld)) return .03;
    if (tld.indexOf('.') !== -1) return .07;
    if (tld.length === 2) return .07;
    return .04;
  };

  function segment(s) {
    // dynamic programming: cheapest split into known words (rank based), unknown chunks are expensive
    var n = s.length, best = [0], back = [0];
    for (var i = 1; i <= n; i++) {
      best[i] = Infinity;
      for (var j = Math.max(0, i - 20); j < i; j++) {
        var w = s.slice(j, i), r = RANK && RANK[w], c;
        if (r && ((w.length > 2) || (w.length === 2 && r < 400) || w === 'a')) c = Math.log(r + 2) + 1.5; else c = 12 * w.length;
        if (best[j] + c < best[i]) { best[i] = best[j] + c; back[i] = j; }
      }
    }
    var out = [], k = n;
    while (k > 0) { out.unshift(s.slice(back[k], k)); k = back[k]; }
    var known = out.every(function (w) { var r = RANK && RANK[w]; return r && (w.length > 2 || (w.length === 2 && r < 400) || w === 'a'); });
    return { words: out, known: known };
  }

  function cvPattern(s) {
    return s.replace(/[aeiou]/g, 'V').replace(/[a-z]/g, 'C').replace(/[0-9]/g, 'N');
  }
  function maxConsRun(s) {
    var m = 0, c = 0;
    for (var i = 0; i < s.length; i++) { if (/[bcdfghjklmnpqrstvwxz]/.test(s[i])) { c++; m = Math.max(m, c); } else c = 0; }
    return m;
  }
  function numericBonus(s, f) {
    var b = 0;
    if (/^(\d)\1+$/.test(s)) { b += 12; f.push(['All-same digits', 12]); }
    else if ('0123456789'.indexOf(s) !== -1 || '9876543210'.indexOf(s) !== -1) { b += 6; f.push(['Sequential digits', 6]); }
    if (s.length % 2 === 0 && s.slice(0, s.length / 2) === s.slice(s.length / 2)) { b += 5; f.push(['Repeating halves (ABAB)', 5]); }
    else if (s.length >= 3 && s === s.split('').reverse().join('')) { b += 4; f.push(['Palindrome', 4]); }
    if (/8/.test(s)) { b += 3; f.push(['Contains lucky 8', 3]); }
    if (/4/.test(s)) { b -= 4; f.push(['Contains 4 (less liquid in Chinese market)', -4]); }
    return b;
  }

  A.appraise = function (p) {
    var sld = p.sld, tld = p.tld, f = [], letters = sld.replace(/[^a-z]/g, ''), L = sld.replace(/-/g, '').length;
    var type = /^\d+$/.test(sld) ? 'numeric' : /-/.test(sld) ? 'hyphenated' : /\d/.test(sld) ? 'alphanumeric' : 'letters';
    var score, words = [], seg = { words: [sld], known: false };
    if (type === 'numeric') {
      var nb = [95, 95, 95, 80, 60, 40, 28, 18][Math.min(L, 7)] || 10;
      if (L >= 8) nb = 10;
      score = nb; f.push(['Baseline: ' + L + '-digit number', nb]);
      score += numericBonus(sld, f);
    } else {
      var base = [0, 98, 95, 85, 66, 56, 50, 44, 39, 34, 30, 26, 22, 18, 18, 18][L] || 12;
      score = base; f.push(['Length baseline: ' + L + ' characters', base]);
      if (type === 'letters') {
        seg = segment(sld); words = seg.known ? seg.words : [sld];
        var r = RANK && RANK[sld];
        if (r) {
          var ws = (r < 1000 ? 92 : r < 3000 ? 88 : r < 10000 ? 82 : r < 20000 ? 75 : 68) - Math.max(0, L - 8);
          var ns = Math.max(score + (r < 1000 ? 28 : r < 5000 ? 22 : r < 15000 ? 15 : 10), ws);
          f.push(['Dictionary word (rank ' + r.toLocaleString() + ')', ns - score]); score = ns;
        } else if (seg.known && words.length === 2) {
          var good = RANK[words[0]] < 5000 && RANK[words[1]] < 5000, cb = good ? 12 : 7;
          score += cb; f.push(['Two-word compound: ' + words.join(' + '), cb]);
        } else if (seg.known && words.length === 3) { score += 6; f.push(['Three-word phrase', 6]); }
        else if (L >= 4 && L <= 8 && maxConsRun(sld) <= 2 && VOW.test(sld)) { score += 6; f.push(['Pronounceable brandable', 6]); }
        var prem = (r ? [sld] : words).filter(function (w) { return PREMIUM.indexOf(w) !== -1; });
        if (prem.length) { score += 6; f.push(['Commercial keyword: ' + prem[0], 6]); }
        var run = maxConsRun(sld);
        if (L >= 5 && run >= 4) { score -= 10; f.push(['Hard consonant cluster', -10]); }
        if (L >= 5 && !VOW.test(sld)) { score -= 25; f.push(['No vowels', -25]); }
        else if (L === 4 && !VOW.test(sld)) { score -= 8; f.push(['No vowels', -8]); }
      }
      if (type === 'hyphenated') { var hy = (sld.match(/-/g) || []).length * 18; score -= hy; f.push(['Hyphen(s)', -hy]); }
      if (type === 'alphanumeric') { score -= 15; f.push(['Mixed letters and numbers', -15]); }
    }
    score = Math.max(1, Math.min(99, Math.round(score)));
    var tw = A.tldWeight(tld);
    f.push(['Extension .' + tld + ' (×' + tw + ' vs .com)', null]);
    var retailCom = Math.pow(10, 1.2 + score * 0.042);
    var pat = cvPattern(sld), floor = 0, patName = '';
    if (tld === 'com') {
      if (type === 'letters' && L === 2) { floor = 1000000; patName = 'LL.com'; }
      else if (type === 'letters' && L === 3) { floor = 25000; patName = 'LLL.com'; }
      else if (type === 'letters' && L === 4) { floor = /^(CVCV|VCVC|CVVC|CVCC|CCVC)$/.test(pat) ? 8000 : 2000; patName = pat === 'CVCV' ? 'CVCV.com' : 'LLLL.com'; }
      else if (type === 'numeric' && L <= 2) { floor = 1000000; patName = 'NN.com'; }
      else if (type === 'numeric' && L === 3) { floor = 60000; patName = 'NNN.com'; }
      else if (type === 'numeric' && L === 4) { floor = 15000; patName = 'NNNN.com'; }
      else if (type === 'numeric' && L === 5) { floor = 1500; patName = 'NNNNN.com'; }
    }
    var retail = Math.max(retailCom * tw, floor);
    if (floor && retail === floor) f.push(['Pattern floor ' + patName, null]);
    var wf = score < 50 ? .05 : score < 75 ? .08 : .15;
    var wholesale = retail * wf;
    var liquidity = (patName && floor >= 8000) || (RANK && RANK[sld] && RANK[sld] < 5000 && tld === 'com') ? 'High'
      : (score >= 55 && tw >= .3) ? 'Medium' : score >= 70 ? 'Medium' : 'Low';
    function rng(v) { return [round(v * .6), round(v * 1.6)]; }
    return {
      domain: p.domain, sld: sld, tld: tld, type: type, pattern: pat, words: words, score: score, tldWeight: tw,
      retail: rng(retail), wholesale: rng(wholesale), point: round(retail), liquidity: liquidity, factors: f
    };
  };

  A.brandability = function (p) {
    var s = p.sld, L = s.length, f = [], sc = 40;
    function add(lbl, v) { sc += v; f.push([lbl, v]); }
    if (L >= 4 && L <= 7) add('Ideal length (4–7)', 20); else if (L <= 3) add('Very short', 5); else if (L <= 9) add('Good length', 10);
    else if (L <= 12) add('Long', -5); else add('Too long', -20);
    if (/[\d-]/.test(s)) add('Contains numbers or hyphens', -20); else add('Letters only', 10);
    var v = (s.match(/[aeiouy]/g) || []).length / Math.max(1, L);
    if (v >= .3 && v <= .6) add('Balanced vowels', 10); else add('Vowel balance off', -5);
    var run = maxConsRun(s);
    if (run <= 2) add('Easy to pronounce', 10); else add('Consonant cluster (' + run + ')', -8 * (run - 2));
    if (/(ly|io|ify|a|o|i|ia|ix|eo)$/.test(s)) add('Brandable ending', 5);
    var seg = segment(s);
    if (RANK && RANK[s]) add('Real word', 12); else if (seg.known && seg.words.length === 2) add('Meaningful compound', 8);
    if (/q(?!u)/.test(s)) add('Q without U', -5);
    if (/(.)\1\1/.test(s)) add('Triple letters', -10);
    if (/ph|ck|x|z{2}/.test(s)) add('Spelling ambiguity (radio test)', -3);
    return { score: Math.max(1, Math.min(99, Math.round(sc))), factors: f, words: seg.words };
  };

  A.cvPattern = cvPattern;
  A.segment = function (s) { return segment(s); };
  function round(v) { if (v < 100) return Math.round(v / 5) * 5 || 5; var m = Math.pow(10, Math.floor(Math.log10(v)) - 1); return Math.round(v / m) * m; }
})();
