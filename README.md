# saranx.github.io

Personal portfolio site — security research, offensive tooling, and systems thinking. Buildless by design, hosted on GitHub Pages. Everything renders in the browser from static files.

## Structure

```
.
├── index.html              # page shell, CDN script tags
├── css/styles.css          # layout, themes, responsive styles
├── js/
│   ├── bg.js               # Three.js 3D particle background
│   ├── main.js             # bootstraps data, rendering, theme, contact form
│   ├── data.js             # fetches JSON content
│   ├── render.js           # renders about, experience, projects, blog cards
│   ├── nav.js              # hash-based navigation
│   ├── blog.js             # markdown reader, TOC, read time, scroll progress
│   ├── theme.js            # theme persistence via localStorage
│   ├── terminal.js         # interactive command-line simulation
│   └── boot.js             # startup overlay
└── res/
    ├── bio.json            # profile, bio, experience, social links
    ├── projects.json       # project cards
    ├── blog.json           # post metadata and markdown paths
    ├── blogs/*.md          # blog post content
    ├── prof.svg            # profile avatar
    └── saranx.pdf          # resume
```

## Local Development

Serve from the repository root over HTTP. The site fetches JSON and Markdown at runtime, so opening `index.html` directly from the filesystem will not work.

```sh
python3 -m http.server 4173
```

Then open `http://localhost:4173/`.

## Content Editing

**Profile and experience**: edit `res/bio.json`. The experience array renders in order. Put the current role first.

**Projects**: edit `res/projects.json`. Cards are sorted by `priority`.

**Blog posts**: add a Markdown file under `res/blogs/`, then register it in `res/blog.json`.

## Verification

```sh
node --check js/main.js
node --check js/blog.js
node --check js/nav.js
node --check js/render.js
node --check js/theme.js
node --check js/bg.js
node --check js/terminal.js
git diff --check
```
