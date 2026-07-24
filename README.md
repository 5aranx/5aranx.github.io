# saranx.github.io

**Terminal-themed portfolio** — security research, offensive tooling, and systems thinking. No build step, no frameworks, no bloat. Pure HTML/CSS/JS served over GitHub Pages.

## Tech

| Layer | What |
|-------|------|
| Shell | Static HTML — one `index.html`, zero frameworks |
| Style | CSS custom properties, dark/light themes, terminal-first typography |
| JS | Vanilla ES modules — data fetching, markdown rendering, hash routing, Three.js particle background |
| Content | JSON for structured data, Markdown for blog posts — all fetched at runtime |
| Hosting | GitHub Pages (auto-deploys from `main`) |

## Structure

```
.
├── index.html              # shell + CDN script tags
├── css/styles.css          # layout, themes, responsive, typography
├── js/
│   ├── bg.js               # Three.js 3D particle background
│   ├── main.js             # bootstraps data, rendering, theme, contact
│   ├── data.js             # fetches JSON content
│   ├── render.js           # renders about, experience, projects, blog cards
│   ├── nav.js              # hash-based SPA navigation
│   ├── blog.js             # markdown reader, TOC, read time, scroll progress
│   ├── theme.js            # localStorage theme persistence
│   ├── terminal.js         # interactive terminal simulation
│   └── boot.js             # startup overlay sequence
└── res/
    ├── bio.json            # profile, bio, experience, socials
    ├── projects.json       # project cards (sorted by priority)
    ├── blog.json           # post metadata → markdown paths
    ├── blogs/*.md          # blog posts in markdown
    ├── prof.svg            # profile picture
    └── saranx.pdf          # resume
```

## Local Development

The site fetches JSON and Markdown at runtime, so `file://` won't work. Serve over HTTP:

```sh
python3 -m http.server 4173
# → http://localhost:4173
```

## Content Editing

| File | What to edit |
|------|-------------|
| `res/bio.json` | Name, tagline, bio, experience list (first = current) |
| `res/projects.json` | Project cards — order controlled by `priority` field |
| `res/blog.json` | Blog index — register new posts here |
| `res/blogs/*.md` | Blog post content in plain markdown |

## Verify

```sh
node --check js/main.js
node --check js/blog.js
node --check js/nav.js
node --check js/render.js
node --check js/theme.js
node --check js/bg.js
node --check js/terminal.js
```
