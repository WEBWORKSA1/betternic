"""Python port of assets/appraise.js (keep the two in sync). Used to score auction inventory."""
import math
import re

TLD = {
    "com": 1, "net": .18, "org": .2, "io": .3, "ai": .45, "co": .18, "app": .12, "dev": .1, "me": .1, "tv": .1, "us": .08,
    "ca": .12, "de": .15, "uk": .12, "co.uk": .12, "in": .08, "au": .1, "com.au": .1, "xyz": .04, "info": .05, "biz": .04,
    "online": .03, "site": .02, "store": .05, "shop": .06, "tech": .05, "cloud": .06, "gg": .1, "so": .08, "ly": .08,
    "to": .08, "fr": .1, "nl": .1, "es": .08, "it": .08, "ch": .12, "cn": .12, "jp": .08, "eu": .08, "vc": .1, "fm": .08,
    "xxx": .03, "club": .03, "live": .03, "pro": .04, "inc": .06, "bot": .06, "finance": .05, "money": .05,
}
PREMIUM = set((
    "ai,crypto,pay,bank,loan,loans,insurance,health,home,homes,car,cars,travel,shop,buy,cloud,data,solar,energy,law,legal,"
    "dental,credit,cash,money,invest,trade,trading,bet,casino,poker,hotel,hotels,jobs,job,food,diet,fit,fitness,beauty,skin,pet,pets,"
    "baby,kids,games,game,play,stream,video,music,learn,school,tutor,doctor,clinic,care,rx,med,vet,realty,estate,rent,mortgage,tax,"
    "pro,hub,lab,labs,ly,app,bio,gen,eco,green,smart,robot,bot,chat,code,dev,web,net,link,meta,quantum,coin,wallet,nft,dao,vpn,"
    "secure,cyber,space,auto,drive,fly,air,sky,sun,wave,flow,mind,brain,life,love,gold,lux,luxury,vip,deal,deals,sale,store,market"
).split(","))
RANK = {}


def load_words(words):
    RANK.clear()
    for i, w in enumerate(words):
        RANK[w] = i + 1


def tld_weight(tld):
    if tld in TLD:
        return TLD[tld]
    if tld.startswith("xn--"):
        return .03
    if "." in tld or len(tld) == 2:
        return .07
    return .04


def segment(s):
    n = len(s)
    best = [0.0] + [math.inf] * n
    back = [0] * (n + 1)
    for i in range(1, n + 1):
        for j in range(max(0, i - 20), i):
            w = s[j:i]
            r = RANK.get(w)
            c = math.log(r + 2) + 1.5 if (r and (len(w) > 2 or (len(w) == 2 and r < 400) or w == "a")) else 12 * len(w)
            if best[j] + c < best[i]:
                best[i] = best[j] + c
                back[i] = j
    out, k = [], n
    while k > 0:
        out.insert(0, s[back[k]:k])
        k = back[k]
    known = all(RANK.get(w) and (len(w) > 2 or (len(w) == 2 and RANK[w] < 400) or w == "a") for w in out)
    return out, known


def cv_pattern(s):
    return re.sub(r"[0-9]", "N", re.sub(r"[a-z]", "C", re.sub(r"[aeiou]", "V", s)))


def max_cons_run(s):
    m = c = 0
    for ch in s:
        if ch in "bcdfghjklmnpqrstvwxz":
            c += 1
            m = max(m, c)
        else:
            c = 0
    return m


def _round(v):
    if v < 100:
        return round(v / 5) * 5 or 5
    m = 10 ** (math.floor(math.log10(v)) - 1)
    return round(v / m) * m


def appraise(sld, tld):
    f = []
    L = len(sld.replace("-", ""))
    if sld.isdigit():
        typ = "numeric"
    elif "-" in sld:
        typ = "hyphenated"
    elif re.search(r"\d", sld):
        typ = "alphanumeric"
    else:
        typ = "letters"
    words = []
    if typ == "numeric":
        nb = 10 if L >= 8 else [95, 95, 95, 80, 60, 40, 28, 18][min(L, 7)]
        score = nb
        if re.fullmatch(r"(\d)\1+", sld):
            score += 12
        elif sld in "0123456789" or sld in "9876543210":
            score += 6
        if len(sld) % 2 == 0 and sld[: len(sld) // 2] == sld[len(sld) // 2:]:
            score += 5
        elif len(sld) >= 3 and sld == sld[::-1]:
            score += 4
        if "8" in sld:
            score += 3
        if "4" in sld:
            score -= 4
    else:
        base_tbl = [0, 98, 95, 85, 66, 56, 50, 44, 39, 34, 30, 26, 22, 18, 18, 18]
        score = base_tbl[L] if L < len(base_tbl) else 12
        if typ == "letters":
            words, known = segment(sld)
            words = words if known else [sld]
            r = RANK.get(sld)
            if r:
                ws = (92 if r < 1000 else 88 if r < 3000 else 82 if r < 10000 else 75 if r < 20000 else 68) - max(0, L - 8)
                score = max(score + (28 if r < 1000 else 22 if r < 5000 else 15 if r < 15000 else 10), ws)
            elif known and len(words) == 2:
                score += 12 if (RANK[words[0]] < 5000 and RANK[words[1]] < 5000) else 7
            elif known and len(words) == 3:
                score += 6
            elif 4 <= L <= 8 and max_cons_run(sld) <= 2 and re.search(r"[aeiouy]", sld):
                score += 6
            if any(w in PREMIUM for w in ([sld] if r else words)):
                score += 6
            if L >= 5 and max_cons_run(sld) >= 4:
                score -= 10
            if L >= 5 and not re.search(r"[aeiouy]", sld):
                score -= 25
            elif L == 4 and not re.search(r"[aeiouy]", sld):
                score -= 8
        if typ == "hyphenated":
            score -= 18 * sld.count("-")
        if typ == "alphanumeric":
            score -= 15
    score = max(1, min(99, round(score)))
    tw = tld_weight(tld)
    retail = 10 ** (1.2 + score * 0.042) * tw
    pat = cv_pattern(sld)
    floor = 0
    if tld == "com":
        if typ == "letters" and L == 2:
            floor = 1_000_000
        elif typ == "letters" and L == 3:
            floor = 25_000
        elif typ == "letters" and L == 4:
            floor = 8000 if pat in ("CVCV", "VCVC", "CVVC", "CVCC", "CCVC") else 2000
        elif typ == "numeric" and L <= 2:
            floor = 1_000_000
        elif typ == "numeric" and L == 3:
            floor = 60_000
        elif typ == "numeric" and L == 4:
            floor = 15_000
        elif typ == "numeric" and L == 5:
            floor = 1500
    retail = max(retail, floor)
    return {"score": score, "type": typ, "words": words, "retail": _round(retail), "pattern": pat}
