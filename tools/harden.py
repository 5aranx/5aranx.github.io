#!/usr/bin/env python3
"""Inject security meta tags into every HTML page.

    python3 tools/harden.py

GitHub Pages cannot send custom response headers, so protection is delivered with
<meta> tags instead:
  * Content-Security-Policy: only same-origin resources; inline scripts must match a
    sha256 hash computed here (no 'unsafe-inline' for scripts), objects/embeds blocked,
    <base> and form targets locked to this origin.
  * Referrer policy: send only the origin to other sites.
  * Frame-busting script: leaves any page that is loaded inside someone else's frame
    (meta CSP cannot express frame-ancestors).
Idempotent: previously injected tags are stripped first. build_blog.py runs it after
regenerating pages, so run it again whenever you add or edit pages by hand.
"""
import base64, hashlib, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) + '/'
MARK = 'data-harden="1"'
FRAME = "if(top!==self){try{top.location=self.location}catch(e){document.documentElement.style.display='none'}}"
POLICY = ("default-src 'self'; script-src 'self' {hashes}; style-src 'self' 'unsafe-inline'; "
          "img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; media-src 'self'; "
          "object-src 'none'; base-uri 'self'; form-action 'self'; worker-src 'self' blob:")

def sha(text):
    return "'sha256-%s'" % base64.b64encode(hashlib.sha256(text.encode('utf-8')).digest()).decode()

def strip(t):
    t = re.sub(r'<meta http-equiv="Content-Security-Policy"[^>]*%s[^>]*/>' % re.escape(MARK), '', t)
    t = re.sub(r'<meta name="referrer"[^>]*%s[^>]*/>' % re.escape(MARK), '', t)
    t = re.sub(r'<script %s>.*?</script>' % re.escape(MARK), '', t, flags=re.S)
    return t

def harden(t, is_404=False):
    t = strip(t)
    frame = '<script %s>%s</script>' % (MARK, FRAME)
    t = t.replace('<meta charSet="utf-8"/>', '<meta charSet="utf-8"/>@@HARDEN@@', 1)
    assert '@@HARDEN@@' in t, 'no <meta charSet> anchor'
    t2 = t.replace('@@HARDEN@@', frame)
    inline = re.findall(r'<script(?![^>]*\bsrc=)(?![^>]*type="application/ld\+json")[^>]*>(.*?)</script>', t2, flags=re.S)
    hashes = ' '.join(sorted({sha(s) for s in inline}))
    csp = '<meta http-equiv="Content-Security-Policy" content="%s" %s/>' % (POLICY.format(hashes=hashes), MARK)
    ref = '<meta name="referrer" content="strict-origin-when-cross-origin" %s/>' % MARK
    return t.replace('@@HARDEN@@', csp + ref + frame, 1)

def run():
    n = 0
    for root, dirs, files in os.walk(ROOT):
        if '.git' in root.split(os.sep) or 'tools' in os.path.relpath(root, ROOT).split(os.sep): continue
        for f in files:
            if not f.endswith('.html'): continue
            p = os.path.join(root, f)
            t = open(p, encoding='utf-8').read()
            if '<meta charSet="utf-8"/>' not in t: continue
            open(p, 'w', encoding='utf-8').write(harden(t)); n += 1
    print('hardened %d pages' % n)

if __name__ == '__main__':
    run()
