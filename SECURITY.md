# Security policy

This is a static portfolio hosted on GitHub Pages. It has no server, database,
accounts, uploads or API.

If you find a vulnerability or an exposed secret, please email
saranshsingh2006@gmail.com with the details. Please do not open a public issue.

Protections in place: a Content-Security-Policy with per-script hashes, a referrer
policy and frame-busting on every page (see `tools/harden.py`), HTTPS enforced,
no source maps, and GitHub secret scanning with push protection.
