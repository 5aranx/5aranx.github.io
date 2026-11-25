#!/usr/bin/env python3
"""Build the Field notes / blog pages from posts/*.md.

    python3 tools/build_blog.py

Add a post: drop a markdown file in posts/ with front matter, then re-run this script.

    ---
    title: My post title
    description: One or two sentences shown in lists and search results.
    date: 2026-11-25
    tags: security, android          # first tag is shown as the category
    featured: false                  # true => big card on /blog (first featured wins)
    ---
    Markdown body: paragraphs, ## / ### headings, - and 1. lists, > quotes, ``` code ```,
    **bold**, *italic*, `code`, [links](https://...) and --- rules.

Writes: blog/index.html, blog/<slug>/index.html, and the "Field notes" section +
flight data in index.html. Server markup and the embedded React payload are generated
from the same data so the page hydrates without errors.
"""
import html as H, json, math, os, re, sys
from datetime import date as Date

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) + '/'
TPL = ROOT + 'tools/templates/'
AUTHOR = 'Saransh Singh'
SITE = 'Saransh Singh'
POST_TAGLINE = 'Notes on security, firmware and hardware.'
IDX_H1 = 'Notes from the bench.'
IDX_LEDE = 'Short write-ups on security research, embedded firmware and the trade-offs behind my projects.'
IDX_TAGS = 'Security · Embedded · Hardware · Linux'

esc = lambda s: H.escape(s, quote=True)                      # React-style escaping
def outer(s):                                                # escape for the "...") flight script string
    return s.replace('\\', '\\\\').replace('"', '\\"').replace('\n', '\\n').replace('&', '\\u0026').replace('<', '\\u003c').replace('>', '\\u003e')
def fmt_date(d):
    y, m, dd = map(int, d.split('-'))
    return Date(y, m, dd).strftime('%b %d, %Y')

# ------------------------------------------------------------------ posts
def load_posts():
    posts = []
    pdir = ROOT + 'posts/'
    for fn in sorted(os.listdir(pdir)):
        if not fn.endswith('.md'):
            continue
        raw = open(pdir + fn, encoding='utf-8').read()
        m = re.match(r'---\n(.*?)\n---\n(.*)$', raw, re.S)
        assert m, fn + ': missing front matter'
        fm = {}
        for line in m.group(1).split('\n'):
            if ':' in line and not line.startswith('#'):
                k, v = line.split(':', 1); fm[k.strip()] = re.sub(r'\s+#.*$', '', v).strip()
        body = m.group(2).strip()
        words = len(re.findall(r'\w+', body))
        posts.append({
            'slug': fn[:-3], 'title': fm['title'], 'description': fm['description'], 'date': fm['date'],
            'tags': [t.strip() for t in fm.get('tags', 'notes').split(',') if t.strip()],
            'readingTime': '%d min read' % max(1, math.ceil(words / 200)),
            'featured': fm.get('featured', 'false').lower() == 'true', 'body': body})
    posts.sort(key=lambda p: p['date'], reverse=True)       # newest first
    return posts

# ------------------------------------------------------------------ markdown -> tree
# node: str | (tag, attrs_dict, [children])
def inline(s):
    out = []; i = 0; buf = ''
    def flush():
        nonlocal buf
        if buf: out.append(buf); buf = ''
    while i < len(s):
        c = s[i]
        if s.startswith('**', i) and s.find('**', i + 2) > 0:
            j = s.find('**', i + 2); flush(); out.append(('strong', {}, inline(s[i + 2:j]))); i = j + 2
        elif c == '`' and s.find('`', i + 1) > 0:
            j = s.find('`', i + 1); flush(); out.append(('code', {}, [s[i + 1:j]])); i = j + 1
        elif c in '*_' and i + 1 < len(s) and s[i + 1] != ' ' and s.find(c, i + 1) > 0 and (c == '*' or i == 0 or not s[i - 1].isalnum()):
            j = s.find(c, i + 1); flush(); out.append(('em', {}, inline(s[i + 1:j]))); i = j + 1
        elif c == '[':
            m = re.match(r'\[([^\]]+)\]\(([^)\s]+)\)', s[i:])
            if m:
                flush()
                at = {'href': m.group(2)}
                if m.group(2).startswith('http'): at.update({'target': '_blank', 'rel': 'noopener noreferrer'})
                out.append(('a', at, inline(m.group(1)))); i += m.end(); continue
            buf += c; i += 1
        else:
            buf += c; i += 1
    flush()
    return out

def slugify(t):
    return re.sub(r'-+', '-', re.sub(r'[^a-z0-9 -]', '', t.lower()).strip().replace(' ', '-'))

def blocks(md):
    lines = md.split('\n'); i = 0; out = []
    while i < len(lines):
        ln = lines[i]
        if not ln.strip(): i += 1; continue
        if ln.startswith('```'):
            j = i + 1
            while j < len(lines) and not lines[j].startswith('```'): j += 1
            out.append(('pre', {}, [('code', {}, ['\n'.join(lines[i + 1:j]) + '\n'])])); i = j + 1; continue
        m = re.match(r'(#{2,3}) (.*)', ln)
        if m:
            out.append(('h%d' % len(m.group(1)), {'id': slugify(m.group(2))}, inline(m.group(2)))); i += 1; continue
        if re.match(r'-{3,}$', ln.strip()): out.append(('hr', {}, [])); i += 1; continue
        if ln.startswith('>'):
            j = i; q = []
            while j < len(lines) and lines[j].startswith('>'): q.append(lines[j][1:].strip()); j += 1
            out.append(('blockquote', {}, ['\n', ('p', {}, inline(' '.join(q))), '\n'])); i = j; continue
        m = re.match(r'(-|\*|\d+\.) ', ln)
        if m:
            ordered = m.group(1)[0].isdigit(); items = []; j = i
            while j < len(lines) and re.match(r'(-|\*|\d+\.) ', lines[j]):
                items.append(inline(re.sub(r'^(-|\*|\d+\.) ', '', lines[j]))); j += 1
            ch = ['\n']
            for it in items: ch += [('li', {}, it), '\n']
            out.append(('ol' if ordered else 'ul', {}, ch)); i = j; continue
        j = i; para = []
        while j < len(lines) and lines[j].strip() and not re.match(r'(#{2,3} |```|>|-{3,}$|(-|\*|\d+\.) )', lines[j]):
            para.append(lines[j].strip()); j += 1
        out.append(('p', {}, inline(' '.join(para)))); i = j
    res = []
    for k, b in enumerate(out):
        if k: res.append('\n')
        res.append(b)
    return res

VOID = {'hr', 'br'}
def to_html(n):
    if isinstance(n, str): return esc(n)
    tag, at, ch = n
    a = ''.join(' %s="%s"' % (k, esc(v)) for k, v in at.items())
    if tag in VOID: return '<%s%s/>' % (tag, a)
    return '<%s%s>%s</%s>' % (tag, a, children_html(ch), tag)
def children_html(ch):
    # adjacent text nodes would be separated by <!-- --> by React; inline() never yields adjacent strings
    return ''.join(to_html(c) for c in ch)
def to_flight(n):
    if isinstance(n, str): return ('$' + n) if n.startswith('$') else n
    tag, at, ch = n
    props = dict(at)
    if ch:
        fl = [to_flight(c) for c in ch]
        props['children'] = fl[0] if len(fl) == 1 else fl
    return ['$', tag, None, props]

# ------------------------------------------------------------------ page builders
def head_meta(title, desc, article=None):
    t = esc(title); d = esc(desc)
    m = '<title>%s</title><meta name="description" content="%s"/>' % (t, d)
    m += '<meta name="keywords" content="Saransh Singh,Security,Embedded Systems,ESP32,Cybersecurity"/>'
    m += '<meta property="og:title" content="%s"/><meta property="og:description" content="%s"/>' % (t, d)
    m += '<meta property="og:type" content="%s"/>' % ('article' if article else 'website')
    if article:
        m += '<meta property="article:published_time" content="%s"/><meta property="article:author" content="%s"/>' % (article['date'], esc(AUTHOR))
    m += '<meta name="twitter:card" content="summary"/><meta name="twitter:title" content="%s"/><meta name="twitter:description" content="%s"/>' % (t, d)
    return m

def meta_row(prefix, title, desc, article=None):
    items = [['$', 'title', '0', {'children': title}], ['$', 'meta', '1', {'name': 'description', 'content': desc}],
             ['$', 'meta', '2', {'name': 'keywords', 'content': 'Saransh Singh,Security,Embedded Systems,ESP32,Cybersecurity'}],
             ['$', 'meta', '3', {'property': 'og:title', 'content': title}], ['$', 'meta', '4', {'property': 'og:description', 'content': desc}],
             ['$', 'meta', '5', {'property': 'og:type', 'content': 'article' if article else 'website'}]]
    k = 6
    if article:
        items += [['$', 'meta', str(k), {'property': 'article:published_time', 'content': article['date']}],
                  ['$', 'meta', str(k + 1), {'property': 'article:author', 'content': AUTHOR}]]; k += 2
    items += [['$', 'meta', str(k), {'name': 'twitter:card', 'content': 'summary'}],
              ['$', 'meta', str(k + 1), {'name': 'twitter:title', 'content': title}],
              ['$', 'meta', str(k + 2), {'name': 'twitter:description', 'content': desc}]]; k += 3
    items += [['$', 'link', str(k), {'rel': 'icon', 'href': '/favicon.ico', 'type': 'image/x-icon', 'sizes': '64x64'}],
              ['$', 'link', str(k + 1), {'rel': 'icon', 'href': '/icon.png?9e65046cef7fa820', 'type': 'image/png', 'sizes': '460x460'}],
              ['$', 'link', str(k + 2), {'rel': 'apple-touch-icon', 'href': '/apple-icon.png?9e65046cef7fa820', 'type': 'image/png', 'sizes': '460x460'}],
              ['$', '$L27' if prefix == 'f' else '$L1b', str(k + 3), {}]]
    row = prefix + ':' + json.dumps({'metadata': items, 'error': None, 'digest': '$undefined'}, separators=(',', ':'), ensure_ascii=False) + '\n'
    return '<script>self.__next_f.push([1,"%s"])</script>' % outer(row)

def post_main(p, prev, nxt, body_nodes):
    chips = ''.join('<span class="rounded-full border border-line px-2.5 py-1 font-mono text-[0.5625rem] uppercase tracking-[0.12em] text-fg-dim">%s</span>' % esc(t) for t in p['tags'][:4])
    dd = lambda label, val: '<div><dt class="font-mono text-[0.5625rem] uppercase tracking-[0.2em] text-fg-faint">%s</dt><dd class="mt-1.5 text-sm text-fg-dim">%s</dd></div>' % (label, esc(val))
    nav = lambda q, label: ('<a class="group rounded-xl border border-line p-5 transition-colors duration-300 hover:border-accent/40" href="../%s"><span class="font-mono text-[0.625rem] uppercase tracking-[0.16em] text-fg-faint">%s</span><span class="mt-3 block font-display text-lg font-semibold leading-tight text-fg transition-colors group-hover:text-accent-bright">%s</span></a>' % (q['slug'], label, esc(q['title']))) if q else '<span aria-hidden="true"></span>'
    return ('<main id="main" class="pb-section pt-32 md:pt-40"><article class="px-gutter"><div aria-hidden="true" class="fixed inset-x-0 top-0 z-[85] h-[2px] origin-left scale-x-0 bg-accent"></div>'
        '<header class="grid gap-8 border-b border-line pb-10 md:grid-cols-12 md:gap-8 md:pb-14"><div data-article-reveal="true" class="md:col-span-3"><p class="section-label">essay</p><p class="mt-3 max-w-48 font-mono text-xs leading-relaxed text-fg/40">%s</p></div>'
        '<div class="md:col-span-9"><p data-article-reveal="true" class="font-mono text-[0.625rem] uppercase tracking-[0.16em] text-fg-dim">%s<!-- --> <span class="mx-2 text-fg-faint">/</span> <!-- -->%s<!-- --> <span class="mx-2 text-fg-faint">/</span> <span class="text-accent">%s</span></p>'
        '<h1 data-article-reveal="true" class="mt-6 max-w-5xl font-display text-display-lg font-bold leading-[0.98] tracking-[-0.025em] text-fg">%s</h1>'
        '<p data-article-reveal="true" class="mt-6 max-w-3xl text-lg leading-relaxed text-fg-dim md:text-xl">%s</p></div></header>'
        '<div class="mt-14 grid gap-12 md:mt-20 md:grid-cols-12 md:gap-8"><aside class="md:col-span-3" aria-label="Article information"><div class="border-t border-line pt-5 md:sticky md:top-28"><dl class="space-y-5">%s%s%s</dl>'
        '<div class="mt-7 flex flex-wrap gap-2 border-t border-line pt-5">%s</div></div></aside>'
        '<div class="prose prose-invert prose-blog mt-0 max-w-none md:col-span-7 md:col-start-5">%s</div></div>'
        '<footer class="mt-20 grid md:grid-cols-12 md:gap-8"><div class="border-t border-line pt-8 md:col-span-8 md:col-start-5"><div class="flex items-center justify-between gap-5"><p class="font-mono text-[0.625rem] uppercase tracking-[0.18em] text-fg-faint">Continue reading</p>'
        '<a class="font-mono text-[0.625rem] uppercase tracking-[0.16em] text-fg-dim transition-colors hover:text-fg" href="..">All essays ↗</a></div>'
        '<nav aria-label="Adjacent posts" class="mt-6 grid gap-4 sm:grid-cols-2">%s%s</nav></div></footer></article></main>') % (
        esc(POST_TAGLINE), fmt_date(p['date']), esc(p['readingTime']), esc(p['tags'][0]), esc(p['title']), esc(p['description']),
        dd('Written by', AUTHOR), dd('Published', fmt_date(p['date'])), dd('Reading time', p['readingTime']), chips,
        children_html(body_nodes), nav(prev, '← Older'), nav(nxt, 'Newer →'))

def build_post(p, prev, nxt):
    t = open(TPL + 'post.tpl.html', encoding='utf-8').read()
    body_nodes = blocks(p['body'])
    title = '%s - %s' % (p['title'], SITE)
    post_obj = {'slug': p['slug'], 'title': p['title'], 'description': p['description'], 'date': p['date'], 'tags': p['tags'],
                'readingTime': p['readingTime'], 'author': AUTHOR}
    pn = lambda q: {'slug': q['slug'], 'title': q['title']} if q else None
    row_b = ('b:' + json.dumps([['$', 'main', None, {'id': 'main', 'className': 'pb-section pt-32 md:pt-40', 'children': ['$', '$L16', None, {
        'post': post_obj, 'prev': pn(prev), 'next': pn(nxt), 'children': '$L17'}]}],
        ['$', 'footer', None, {'className': 'px-gutter', 'children': ['$', '$L18', None, {}]}]], separators=(',', ':'), ensure_ascii=False) + '\n')
    row_body = '17:' + json.dumps([to_flight(n) for n in body_nodes], separators=(',', ':'), ensure_ascii=False) + '\n'
    script = lambda row: '<script>self.__next_f.push([1,"%s"])</script>' % outer(row)
    t = t.replace('{{HEAD}}', head_meta(title, p['description'], p))
    t = t.replace('{{MAIN}}', post_main(p, prev, nxt, body_nodes))
    t = t.replace('{{ROW_B}}', script(row_b)).replace('{{ROW_BODY}}', script(row_body))
    t = t.replace('{{ROW_META}}', meta_row('f', title, p['description'], p))
    os.makedirs(ROOT + 'blog/' + p['slug'], exist_ok=True)
    open(ROOT + 'blog/%s/index.html' % p['slug'], 'w', encoding='utf-8').write(t)

ROW_A = 'group grid grid-cols-[2rem_1fr_auto] gap-x-4 gap-y-3 border-b border-line py-7 transition-[padding,background-color] duration-300 hover:bg-accent-dim md:grid-cols-[3rem_9rem_1fr_auto] md:gap-x-6 md:py-9 md:hover:px-4'
ARROW = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="%s"><path d="M7 17 17 7M8 7h9v9"></path></svg>'

def index_main(posts):
    feat = next((p for p in posts if p['featured']), posts[0])
    rest = [p for p in posts if p['slug'] != feat['slug']]
    m = ('<main id="main" class="px-gutter pb-section pt-36 md:pt-44"><header class="grid items-end gap-10 border-b border-line pb-10 md:grid-cols-12 md:gap-8 md:pb-14"><div class="md:col-span-8"><p class="section-label">field notes</p>'
         '<h1 class="mt-4 font-display text-display-xl font-bold uppercase leading-[0.9] text-fg">%s</h1></div><div class="md:col-span-4 md:pb-1"><p class="max-w-md text-base leading-relaxed text-fg-dim md:text-lg">%s</p>'
         '<p class="mt-6 font-mono text-[0.625rem] uppercase tracking-[0.18em] text-fg-faint">%s</p></div></header><div class="mt-12 md:mt-16">') % (esc(IDX_H1), esc(IDX_LEDE), esc(IDX_TAGS))
    m += ('<div data-row="true"><a class="group grid overflow-hidden rounded-2xl border border-line bg-bg-raise/40 transition-colors duration-500 hover:border-fg-faint md:grid-cols-12" href="%s">'
          '<div class="flex min-h-[21rem] flex-col justify-between p-6 sm:p-8 md:col-span-7 md:min-h-[28rem] md:p-10 lg:p-12"><div><div class="flex flex-wrap items-center gap-3 font-mono text-[0.625rem] uppercase tracking-[0.18em]">'
          '<span class="text-accent">Featured essay</span><span class="h-px w-8 bg-line"></span><span class="text-fg-faint">%s</span></div>'
          '<h2 class="mt-7 max-w-3xl font-display text-display-lg font-semibold leading-[0.98] tracking-[-0.025em] text-fg">%s</h2>'
          '<p class="mt-5 max-w-xl text-sm leading-relaxed text-fg-dim md:text-base">%s</p></div>'
          '<div class="mt-10 flex items-end justify-between gap-6 border-t border-line pt-5"><p class="font-mono text-[0.625rem] uppercase tracking-[0.16em] text-fg-faint">%s<!-- --> <span class="mx-2">/</span> <!-- -->%s</p>'
          '<span class="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-line text-fg-dim transition-[color,border-color,transform] duration-300 group-hover:-translate-y-1 group-hover:border-accent/50 group-hover:text-accent">%s</span></div></div></a></div>') % (
          feat['slug'], esc(feat['tags'][0]), esc(feat['title']), esc(feat['description']), fmt_date(feat['date']), esc(feat['readingTime']), ARROW % 'h-4 w-4')
    if rest:
        m += ('<section class="mt-20 md:mt-28" aria-labelledby="all-notes-heading"><div class="flex items-end justify-between gap-6 border-b border-line pb-5"><div><h2 id="all-notes-heading" class="font-display text-2xl font-semibold tracking-[-0.02em] text-fg md:text-3xl">More field notes</h2></div>'
              '<p class="font-mono text-[0.625rem] uppercase tracking-[0.18em] text-fg-faint">%02d<!-- --> entries</p></div><div>') % len(rest)
        for k, p in enumerate(rest):
            m += ('<div data-row="true"><a class="%s" href="%s"><span class="pt-1 font-mono text-[0.625rem] tabular-nums text-fg-faint">%02d</span>'
                  '<p class="hidden pt-1 font-mono text-[0.625rem] uppercase tracking-[0.14em] text-fg-dim md:block">%s</p><div>'
                  '<h3 class="max-w-3xl font-display text-xl font-semibold leading-tight tracking-[-0.015em] text-fg transition-colors duration-300 group-hover:text-accent-bright md:text-3xl">%s</h3>'
                  '<p class="mt-2 max-w-2xl text-sm leading-relaxed text-fg-dim">%s</p>'
                  '<p class="mt-3 font-mono text-[0.625rem] uppercase tracking-[0.14em] text-fg-faint md:hidden">%s<!-- --> / <!-- -->%s</p>'
                  '<p class="mt-3 hidden font-mono text-[0.625rem] uppercase tracking-[0.14em] text-fg-faint sm:block">%s</p></div>'
                  '<div class="flex flex-col items-end justify-between gap-4"><span class="hidden font-mono text-[0.625rem] uppercase tracking-[0.14em] text-fg-dim md:block">%s</span>%s</div></a></div>') % (
                  ROW_A, p['slug'], k + 1, fmt_date(p['date']), esc(p['title']), esc(p['description']), fmt_date(p['date']), esc(p['readingTime']),
                  esc(' · '.join(p['tags'][:4])), esc(p['readingTime']),
                  ARROW % 'h-5 w-5 text-fg-dim transition-all duration-300 ease-out-expo group-hover:-translate-y-1 group-hover:translate-x-1 group-hover:text-accent')
        m += '</div></section>'
    m += ('<div aria-hidden="true" class="pointer-events-none fixed left-0 top-0 z-30 hidden h-[200px] w-[300px] overflow-hidden rounded-xl border border-line bg-bg-raise opacity-0 shadow-2xl shadow-black/60 md:block" style="transform:scale(0.94)"></div></div></main>')
    return m

def build_index(posts):
    t = open(TPL + 'index.tpl.html', encoding='utf-8').read()
    listing = [{'slug': p['slug'], 'title': p['title'], 'description': p['description'], 'date': p['date'], 'tags': p['tags'],
                'readingTime': p['readingTime'], 'featured': p['featured']} for p in posts]
    t = t.replace('{{HEAD}}', head_meta('Blog - ' + SITE, IDX_LEDE))
    t = t.replace('{{MAIN}}', index_main(posts))
    t = t.replace('{{ROW_META}}', meta_row('15', 'Blog - ' + SITE, IDX_LEDE).replace('$L1b', '$L1b'))
    t = t.replace('{{POSTS_JSON}}', outer(json.dumps(listing, separators=(',', ':'), ensure_ascii=False)))
    t = t.replace('{{H1}}', outer(json.dumps(IDX_H1)[1:-1])).replace('{{LEDE}}', outer(json.dumps(IDX_LEDE)[1:-1])).replace('{{TAGLINE}}', outer(json.dumps(IDX_TAGS)[1:-1]))
    open(ROOT + 'blog/index.html', 'w', encoding='utf-8').write(t)

# ------------------------------------------------------------------ home page
HOME_ROW = ('<div data-row="true"><a class="group grid grid-cols-[1fr_auto] items-baseline gap-x-6 gap-y-2 border-b border-line py-7 transition-colors duration-300 hover:bg-accent-dim md:grid-cols-[10rem_1fr_8rem_auto] md:items-center md:py-8" href="blog/%s">'
            '<span class="font-mono text-label uppercase text-fg-dim max-md:order-2">%s</span>'
            '<h3 class="font-display text-display-md font-semibold text-fg max-md:order-1 max-md:col-span-2">%s</h3>'
            '<span class="hidden font-mono text-label uppercase text-fg-dim md:block">%s</span>%s</a></div>')
def home_section(posts):
    rows = ''.join(HOME_ROW % (p['slug'], fmt_date(p['date']), esc(p['title']), esc(p['readingTime']),
                               ARROW % 'h-6 w-6 text-fg-dim transition-all duration-300 ease-out-expo group-hover:-translate-y-1 group-hover:translate-x-1 group-hover:text-accent max-md:order-3') for p in posts[:3])
    return ('<section id="writing" class="px-gutter py-section" aria-label="Writing"><div class="mb-16 md:mb-24"><p class="section-label">writing</p><h2 class="mt-4 font-display font-bold uppercase text-fg text-display-xl">Field notes</h2></div>'
            '<div class="border-t border-line">%s</div><div class="mt-10 flex justify-end"><a class="group font-mono text-label uppercase text-fg-dim transition-colors hover:text-fg" href="blog"><span class="relative inline-flex overflow-hidden">'
            '<span class="block transition-transform duration-500 ease-out-expo group-hover:-translate-y-full">ALL POSTS →</span><span class="absolute left-0 top-full block transition-transform duration-500 ease-out-expo group-hover:-translate-y-full" aria-hidden="true">ALL POSTS →</span></span></a></div></section>') % rows

def build_home(posts):
    p = ROOT + 'index.html'
    h = open(p, encoding='utf-8').read()
    sec = home_section(posts)
    if '<section id="writing"' in h:
        i = h.index('<section id="writing"'); j = h.index('</section>', i) + len('</section>')
        h = h[:i] + sec + h[j:]
    else:
        i = h.index('<footer id="contact"'); h = h[:i] + sec + h[i:]
    items = [{'slug': q['slug'], 'title': q['title'], 'date': q['date'], 'readingTime': q['readingTime']} for q in posts[:3]]
    new = '\\"posts\\":' + outer(json.dumps(items, separators=(',', ':'), ensure_ascii=False))
    h, n = re.subn(r'\\"posts\\":\[.*?\]\}', lambda m: new + '}', h, count=1, flags=re.S)
    assert n == 1, 'posts prop not found in home payload'
    open(p, 'w', encoding='utf-8').write(h)

if __name__ == '__main__':
    posts = load_posts()
    assert posts, 'no posts in posts/'
    for k, p in enumerate(posts):
        build_post(p, posts[k + 1] if k + 1 < len(posts) else None, posts[k - 1] if k else None)   # prev=older, next=newer
    build_index(posts); build_home(posts)
    print('built %d posts: %s' % (len(posts), ', '.join(p['slug'] for p in posts)))
