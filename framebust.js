// Frame-busting (CSP frame-ancestors cannot be set from a meta tag on GitHub Pages).
if (window.top !== window.self) {
  try { window.top.location = window.self.location; } catch { document.documentElement.remove(); }
}
