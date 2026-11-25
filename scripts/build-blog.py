#!/usr/bin/env python3
"""Build blog/ from blog-src/*.md (front matter: title, description, date, tags). Run: python3 scripts/build-blog.py"""
import html, pathlib, re, markdown
ROOT = pathlib.Path(__file__).resolve().parent.parent
CSS = """:root{color-scheme:dark}body{margin:0;background:#0d1117;color:#c9d1d9;font:16px/1.7 ui-monospace,SFMono-Regular,Menlo,monospace}
main{max-width:46rem;margin:0 auto;padding:2rem 1rem 4rem}a{color:#58a6ff}h1,h2,h3{color:#e6edf3;line-height:1.3}
.meta{color:#8b949e;font-size:.85rem}pre{background:#161b22;padding:1rem;overflow:auto;border-radius:6px}code{background:#161b22;padding:.1em .3em;border-radius:4px}
pre code{padding:0}li.post{margin:1.2rem 0;list-style:none}ul{padding:0}nav a{margin-right:1rem}"""
def page(title, desc, body):
    return f"""<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:; base-uri 'none'; form-action 'none'">
<meta name="referrer" content="no-referrer"><title>{html.escape(title)}</title><meta name="description" content="{html.escape(desc)}"><style>{CSS}</style></head>
<body><main><nav><a href="/">home</a><a href="/site/">editor</a><a href="/blog/">blog</a></nav>{body}</main></body></html>"""
posts = []
for f in sorted((ROOT/"blog-src").glob("*.md")):
    raw = f.read_text()
    m = re.match(r"---\n(.*?)\n---\n(.*)", raw, re.S)
    fm = dict(l.split(": ", 1) for l in m.group(1).splitlines() if ": " in l)
    slug = f.stem
    out = ROOT/"blog"/slug; out.mkdir(parents=True, exist_ok=True)
    body = markdown.markdown(m.group(2), extensions=["fenced_code", "tables"])
    (out/"index.html").write_text(page(fm["title"], fm.get("description", ""), f'<h1>{html.escape(fm["title"])}</h1><p class="meta">{fm.get("date","")} · {html.escape(fm.get("tags",""))}</p>{body}'))
    posts.append((fm.get("date", ""), slug, fm))
posts.sort(reverse=True)
items = "".join(f'<li class="post"><a href="/blog/{s}/">{html.escape(fm["title"])}</a><div class="meta">{d}</div><div>{html.escape(fm.get("description",""))}</div></li>' for d, s, fm in posts)
(ROOT/"blog"/"index.html").write_text(page("Field notes", "Notes from Saransh Singh", f"<h1>Field notes</h1><ul>{items}</ul>"))
print(f"built {len(posts)} posts")
