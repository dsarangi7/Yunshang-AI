#!/usr/bin/env python3
"""Regenerates index.html and sitemap.xml from index.template.html + translations.js.

Why: the English text in the HTML (what crawlers index), the FAQ markup and the
JSON-LD FAQPage/Product data all come from the SAME strings in translations.js,
so they can never drift apart.

Usage:  python3 tools/build.py [SITE_URL]
        (run from the folder that contains translations.js and assets/)
"""
import html, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', 'site')) if os.path.isdir(os.path.join(HERE, '..', 'site')) else os.getcwd()
SITE = (sys.argv[1] if len(sys.argv) > 1 else 'https://YOUR-DOMAIN.com').rstrip('/')

src = open(os.path.join(ROOT, 'translations.js'), encoding='utf-8').read()
start = src.index('{', src.index('YS_I18N'))
I18N = json.loads(src[start:src.rstrip().rstrip(';').rindex('}') + 1])
EN = I18N['en']


def t(path, lang='en'):
    node = I18N[lang]
    for part in path.split('.'):
        node = node[int(part)] if isinstance(node, list) else node[part]
    return node


def esc(s):
    return html.escape(s, quote=True)


MODELS = ['g2pro', 'w611pro', 'w640', 'w630', 'w610', 'm10a', 'm08t', 'cacy01', 'e12']
GLASSES = MODELS[:-1]
IMG = {m: f'{m}.png' for m in MODELS}
IMG['g2pro'] = 'g2pro-hero.png'
SIZE = {'g2pro-hero.png': (1400, 1072), 'g2pro-front.png': (1000, 388), 'g2pro-side.png': (1000, 317), 'g2pro-clear.png': (1000, 388),
        'g2pro-photo.png': (903, 904), 'w611pro.png': (1000, 494), 'w640.png': (1000, 554), 'w630.png': (1000, 444), 'w610.png': (1000, 601),
        'm10a.png': (1000, 441), 'm08t.png': (958, 1000), 'cacy01.png': (1000, 323), 'e12.png': (1000, 460)}

I = {  # inline SVG icons (stroke = currentColor)
 'camera': '<path d="M4 8h3l2-2.5h6L17 8h3v11H4z"/><circle cx="12" cy="13.5" r="3.6"/>',
 'ai': '<path d="M12 3v3M12 18v3M3 12h3M18 12h3"/><rect x="7" y="7" width="10" height="10" rx="2.5"/><path d="M10.2 14.2l1.3-4.4h1l1.3 4.4M10.6 12.9h2.8"/>',
 'translation': '<path d="M4 5h9M8.5 3v2M6 5c.8 3 3 5.4 6 6.6M11 5c-.8 3.4-3.2 6-6.5 7.4"/><path d="M12.5 20l3.8-9 3.8 9M13.8 17h5"/>',
 'audio': '<path d="M5 9.5h3l4.5-4v13l-4.5-4H5z"/><path d="M16 9a4 4 0 010 6M18.5 6.5a7.5 7.5 0 010 11"/>',
 'photo': '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/>',
 'battery': '<rect x="3" y="7.5" width="16" height="9" rx="2"/><path d="M21 10.5v3M11.5 9l-2.5 3.5h3.5L10 15.5"/>',
 'factory': '<path d="M3 20V10l5 3V10l5 3V10l5 3V5h3v15z"/><path d="M7 17h2M12 17h2"/>',
 'rate': '<path d="M3.5 12.5l8-8H20v8.5l-8 8z"/><circle cx="15.8" cy="8.2" r="1.4"/>',
 'globe': '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.4 2.4 3.5 5.2 3.5 8.5s-1.1 6.1-3.5 8.5c-2.4-2.4-3.5-5.2-3.5-8.5S9.6 5.9 12 3.5z"/>',
 'shield': '<path d="M12 3l7.5 3v5.5c0 4.5-3.2 8-7.5 9.5-4.3-1.5-7.5-5-7.5-9.5V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
 'chat': '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9.5h8M8 12.5h5"/>',
 'pen': '<path d="M4 20l1-4.5L15.5 5a2.1 2.1 0 013 3L8 18.5z"/><path d="M13.5 7l3 3"/>',
 'gear': '<circle cx="12" cy="12" r="3"/><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7"/>',
 'check': '<circle cx="12" cy="12" r="8.5"/><path d="M8 12.2l2.8 2.8 5.2-5.6"/>',
 'plane': '<path d="M21 4L3 11l6 2.5L11.5 20 14 15l5 3z"/><path d="M9 13.5L21 4"/>',
 'chev': '<path d="M6 9l6 6 6-6"/>',
}


def icon(name, size=24, cls='ico'):
    return (f'<svg class="{cls}" viewBox="0 0 24 24" width="{size}" height="{size}" fill="none" stroke="currentColor" '
            f'stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{I[name]}</svg>')


def features():
    out = []
    for k in ['camera', 'ai', 'translation', 'audio', 'photo', 'battery']:
        out.append(f'''      <article class="feature glass reveal">
        {icon(k, 28)}
        <h3 data-i18n="flag.f.{k}.t"></h3>
        <p data-i18n="flag.f.{k}.d"></p>
      </article>''')
    return '\n'.join(out)


# label -> file (the file named g2pro-side.png is the straight-on view, g2pro-front.png the angled one)
GAL = {'front': 'g2pro-side.png', 'side': 'g2pro-front.png', 'clear': 'g2pro-clear.png', 'photo': 'g2pro-photo.png'}


def gallery():
    out = []
    for k in ['front', 'side', 'clear', 'photo']:
        out.append(f'''        <figure class="gal-item glass reveal">
          <img class="ys-img{' on-white' if k == 'photo' else ''}" src="assets/{GAL[k]}" width="{SIZE[GAL[k]][0]}" height="{SIZE[GAL[k]][1]}" loading="lazy" decoding="async" alt="@@flag.alt.{k}@@" data-i18n-attr="alt:flag.alt.{k}">
          <figcaption data-i18n="flag.gal.{k}"></figcaption>
        </figure>''')
    return '\n'.join(out)


def real():
    return '\n'.join(f'''        <figure class="real-item reveal">
          <img src="assets/g2pro-real-{i + 1}.jpg" width="900" height="1200" loading="lazy" decoding="async" alt="@@flag.real.alt.{i}@@" data-i18n-attr="alt:flag.real.alt.{i}">
        </figure>''' for i in range(3))


def why():
    ics = ['factory', 'rate', 'globe', 'shield']
    return '\n'.join(f'''      <article class="trust glass reveal">
        <span class="trust-ico">{icon(ics[i], 26)}</span>
        <h3 data-i18n="why.cards.{i}.t"></h3>
        <p data-i18n="why.cards.{i}.d"></p>
      </article>''' for i in range(4))


def steps():
    ics = ['chat', 'pen', 'gear', 'check', 'plane']
    return '\n'.join(f'''          <li class="step">
            <svg class="node" viewBox="0 0 64 64" width="64" height="64" aria-hidden="true"><circle cx="32" cy="32" r="30" fill="#0b1018" stroke="url(#pl)" stroke-width="1.5"/><circle cx="32" cy="32" r="22" fill="none" stroke="rgba(123,216,255,.18)"/><g transform="translate(20 20)" fill="none" stroke="#7BD8FF" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">{I[ics[i]]}</g></svg>
            <span class="step-n">0{i + 1}</span>
            <strong data-i18n="about.steps.{i}.t"></strong>
            <span data-i18n="about.steps.{i}.d"></span>
          </li>''' for i in range(5))


def products():
    out = []
    for m in MODELS:
        chips = ''.join(f'<li data-i18n="products.{m}.chips.{j}"></li>' for j in range(3))
        out.append(f'''      <article class="product-card glass reveal" id="product-{m}" data-model="{m}">
        <div class="product-media"><img class="ys-img" src="assets/{IMG[m]}" width="{SIZE[IMG[m]][0]}" height="{SIZE[IMG[m]][1]}" loading="lazy" decoding="async" alt="@@products.{m}.alt@@" data-i18n-attr="alt:products.{m}.alt"></div>
        <p class="cat" data-i18n="products.{m}.cat"></p>
        <h3 data-i18n="products.{m}.name"></h3>
        <p class="line" data-i18n="products.{m}.line"></p>
        <ul class="chips">{chips}</ul>
        <button type="button" class="btn btn-ghost btn-sm" data-open="{m}" aria-haspopup="dialog"><span data-i18n="coll.view"></span><span class="sr-only"> — {esc(t(f"products.{m}.name"))}</span></button>
      </article>''')
    return '\n'.join(out)


COLS = ['camera', 'video', 'battery', 'water', 'translation', 'charging', 'standout']


def cmp_head():
    return '\n'.join(f'            <th scope="col" data-i18n="cmp.h.{c}"></th>' for c in ['model'] + COLS)


def cmp_rows():
    out = []
    for m in GLASSES:
        tds = ''.join(f'<td data-i18n="cmp.rows.{m}.{c}"></td>' for c in COLS)
        out.append(f'          <tr><th scope="row"><a href="#product-{m}" data-open="{m}" data-i18n="products.{m}.name"></a></th>{tds}</tr>')
    return '\n'.join(out)


def faq():
    return '\n'.join(f'''      <details class="faq-item reveal" id="faq-{i + 1}">
        <summary><span data-i18n="faq.items.{i}.q"></span>{icon('chev', 20, 'chev')}</summary>
        <div class="faq-a"><p data-i18n="faq.items.{i}.a"></p></div>
      </details>''' for i in range(len(EN['faq']['items'])))


def checks():
    return '\n'.join(f'''            <label class="check"><input type="checkbox" name="products" value="{esc(t(f"products.{m}.name"))}" data-model="{m}"><span class="box" aria-hidden="true"></span><span data-i18n="products.{m}.name"></span></label>'''
                     for m in MODELS)


PROP_NAMES = {'camera': 'Camera', 'video': 'Video', 'battery': 'Battery', 'water': 'Water resistance',
              'translation': 'Translation', 'charging': 'Charging', 'standout': 'Stand-out feature'}


def jsonld():
    org = {
        '@type': 'Organization', '@id': f'{SITE}/#org', 'name': 'YUNSHANG AI', 'alternateName': 'Yunshang AI',
        'url': f'{SITE}/', 'logo': f'{SITE}/assets/logo.svg', 'description': EN['about']['statement'],
        'email': 'Szyskj22@163.com',
        'address': {'@type': 'PostalAddress', 'addressLocality': 'Shenzhen', 'addressRegion': 'Guangdong', 'addressCountry': 'CN'},
        'areaServed': 'Worldwide',
        'contactPoint': [{'@type': 'ContactPoint', 'contactType': 'sales', 'email': 'Szyskj22@163.com',
                          'telephone': '${WHATSAPP_NUMBER}', 'areaServed': 'Worldwide',
                          'availableLanguage': ['English', 'Chinese', 'Spanish', 'Hindi']}],
        'knowsAbout': ['AI smart glasses', 'Bluetooth audio glasses', 'OEM manufacturing', 'ODM manufacturing'],
    }
    site = {'@type': 'WebSite', '@id': f'{SITE}/#website', 'url': f'{SITE}/', 'name': 'YUNSHANG AI',
            'description': EN['meta']['desc'], 'inLanguage': ['en', 'zh', 'es', 'hi'], 'publisher': {'@id': f'{SITE}/#org'}}
    graph = [org, site]
    for m in MODELS:
        p = EN['products'][m]
        props = []
        if m in EN['cmp']['rows']:
            for c in COLS:
                v = EN['cmp']['rows'][m][c]
                if v != '—':
                    props.append({'@type': 'PropertyValue', 'name': PROP_NAMES[c], 'value': v})
        props += [{'@type': 'PropertyValue', 'name': 'Specification', 'value': s} for s in p['specs']]
        graph.append({
            '@type': 'Product', '@id': f'{SITE}/#product-{m}', 'url': f'{SITE}/#product-{m}',
            'name': p['name'], 'model': p['name'], 'category': p['cat'],
            'description': f"{p['name']} — {p['cat']}. {p['line']}",
            'image': f'{SITE}/assets/{IMG[m]}',
            'brand': {'@type': 'Brand', 'name': 'YUNSHANG AI'},
            'manufacturer': {'@id': f'{SITE}/#org'},
            'additionalProperty': props,
        })
    graph.append({'@type': 'FAQPage', '@id': f'{SITE}/#faq', 'mainEntity': [
        {'@type': 'Question', 'name': it['q'], 'acceptedAnswer': {'@type': 'Answer', 'text': it['a']}}
        for it in EN['faq']['items']]})
    for m in MODELS:
        graph.append({'@type': 'BreadcrumbList', '@id': f'{SITE}/#breadcrumb-{m}', 'itemListElement': [
            {'@type': 'ListItem', 'position': 1, 'name': EN['coll']['home'], 'item': f'{SITE}/'},
            {'@type': 'ListItem', 'position': 2, 'name': EN['nav']['collection'], 'item': f'{SITE}/#collection'},
            {'@type': 'ListItem', 'position': 3, 'name': EN['products'][m]['name'], 'item': f'{SITE}/#product-{m}'}]})
    return json.dumps({'@context': 'https://schema.org', '@graph': graph}, ensure_ascii=False, indent=1).replace('</', '<\\/')


tpl = open(os.path.join(HERE, 'index.template.html'), encoding='utf-8').read()
blocks = {'FEATURES': features(), 'GALLERY': gallery(), 'REAL': real(), 'WHY': why(), 'STEPS': steps(), 'PRODUCTS': products(),
          'CMPHEAD': cmp_head(), 'CMPROWS': cmp_rows(), 'FAQ': faq(), 'CHECKS': checks()}
for k, v in blocks.items():
    tpl = tpl.replace(f'@@{k}@@', v)
tpl = tpl.replace('@@JSONLD@@', jsonld()).replace('@@SITE@@', SITE)
tpl = re.sub(r'@@([a-zA-Z0-9_.]+)@@', lambda mo: esc(t(mo.group(1))), tpl)

missing = []


def fill(mo):
    key = mo.group(3)
    try:
        return f'<{mo.group(1)}{mo.group(2)} data-i18n="{key}"{mo.group(4)}>{esc(t(key))}</{mo.group(1)}>'
    except (KeyError, IndexError):
        missing.append(key)
        return mo.group(0)


tpl = re.sub(r'<(\w+)([^>]*?)\sdata-i18n="([^"]+)"([^>]*)></\1>', fill, tpl)
# every data-i18n-attr key must exist
for spec in re.findall(r'data-i18n-attr="([^"]+)"', tpl):
    for pair in spec.split(';'):
        try:
            t(pair.split(':', 1)[1])
        except (KeyError, IndexError):
            missing.append(pair)
if missing:
    sys.exit('Missing i18n keys: ' + ', '.join(sorted(set(missing))))
open(os.path.join(ROOT, 'index.html'), 'w', encoding='utf-8').write(tpl)

# ---- sitemap.xml ----
anchors = ['', '#flagship', '#why', '#about', '#collection', '#compare', '#faq', '#quote'] + [f'#product-{m}' for m in MODELS]
langs = ['en', 'zh', 'es', 'hi']
urls = []
for a in anchors:
    alts = ''.join(f'\n    <xhtml:link rel="alternate" hreflang="{l}" href="{SITE}/?lang={l}{a}"/>' for l in langs)
    alts += f'\n    <xhtml:link rel="alternate" hreflang="x-default" href="{SITE}/{a}"/>'
    pr = '1.0' if a == '' else ('0.8' if a.startswith('#product') else '0.6')
    urls.append(f'  <url>\n    <loc>{SITE}/{a}</loc>{alts}\n    <changefreq>monthly</changefreq>\n    <priority>{pr}</priority>\n  </url>')
for l in langs[1:]:
    alts = ''.join(f'\n    <xhtml:link rel="alternate" hreflang="{x}" href="{SITE}/?lang={x}"/>' for x in langs)
    urls.append(f'  <url>\n    <loc>{SITE}/?lang={l}</loc>{alts}\n    <changefreq>monthly</changefreq>\n    <priority>0.9</priority>\n  </url>')
sm = ('<?xml version="1.0" encoding="UTF-8"?>\n'
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n'
      + '\n'.join(urls) + '\n</urlset>\n')
open(os.path.join(ROOT, 'sitemap.xml'), 'w', encoding='utf-8').write(sm)
open(os.path.join(ROOT, 'robots.txt'), 'w', encoding='utf-8').write(f'User-agent: *\nAllow: /\n\nSitemap: {SITE}/sitemap.xml\n')
print('built index.html, sitemap.xml, robots.txt for', SITE)
