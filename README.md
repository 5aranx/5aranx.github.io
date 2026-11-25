# Saransh Singh — portfolio

Content-swapped copy of a Next.js static export (layout, animation and styling are
unchanged from the template it was cloned from — see note below).

    python3 serve.py 8765      # then open http://127.0.0.1:8765/

Where the content lives:
- `_next/static/chunks/292-*.js`  — all data: profile, experience, projects, certs, skills
- `_next/static/chunks/app/page-*.js` — a few hard-coded headings on the home page
- `index.html`, `work/index.html`, `404.html` — server-rendered markup; must stay in sync
  with the data above or React logs a hydration error (check the console after edits)
- `images/projects/*.webp` are generated placeholder posters — replace with screenshots
  (keep the same filenames, or change the `image` field in the data chunk)

Note: the UI/code is Shiven Saini's (shiven.dev). Get their permission and credit them
before publishing this publicly.

## Field notes (blog)
Posts are markdown files in `posts/` (front matter: title, description, date, tags, featured).
After adding or editing one, run `python3 tools/build_blog.py` — it regenerates `blog/`,
the home-page "Field notes" section and the matching React payload. The three starter
posts are drafts; edit or replace them.

## Security
Static site on GitHub Pages: no server, database, accounts or uploads. Every page ships a
Content-Security-Policy (per-script hashes), referrer policy and frame-busting, added by
`python3 tools/harden.py` (also run by `tools/build_blog.py`). Re-run it after hand-editing
any HTML. See `SECURITY.md`. Content is © Saransh Singh, all rights reserved (see `LICENSE`).
