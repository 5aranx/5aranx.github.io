# Security policy

This is a static portfolio hosted on GitHub Pages. It has no server, database,
accounts, uploads or API.

If you find a vulnerability or an exposed secret, please email
saranshsingh2006@gmail.com with the details. Please do not open a public issue.
See also `/.well-known/security.txt`.

Protections in place: a Content-Security-Policy (same-origin scripts only, no inline
scripts, no third-party requests), a referrer policy and frame-busting on the intro and
editor pages, a stricter CSP on blog pages, HTTPS enforced, and GitHub secret scanning
with push protection. `frame-ancestors` cannot be set from a meta tag on GitHub Pages, so
framing is blocked by `framebust.js`.
