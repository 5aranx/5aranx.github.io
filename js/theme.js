const SITE_THEME_KEY = "saranx-theme";
const READER_THEME_KEY = "saranx-reader-theme";

export function initTheme() {
    const saved = localStorage.getItem(SITE_THEME_KEY) || "dark";
    setTheme(saved);

    document.getElementById("theme-toggle")?.addEventListener("click", () => {
        setTheme(document.documentElement.dataset.theme === "light" ? "dark" : "light");
    });
}

export function initReaderTheme() {
    const saved = localStorage.getItem(READER_THEME_KEY) || "dark";
    setReaderTheme(saved);

    document.getElementById("reader-theme-toggle")?.addEventListener("click", () => {
        const reader = document.getElementById("blog-reader");
        setReaderTheme(reader?.dataset.readerTheme === "light" ? "dark" : "light");
    });
}

function setTheme(theme) {
    const next = theme === "light" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    localStorage.setItem(SITE_THEME_KEY, next);

    const label = document.getElementById("theme-label");
    if (label) label.textContent = next;
}

function setReaderTheme(theme) {
    const next = theme === "light" ? "light" : "dark";
    const reader = document.getElementById("blog-reader");
    if (reader) reader.dataset.readerTheme = next;
    localStorage.setItem(READER_THEME_KEY, next);

    const toggle = document.getElementById("reader-theme-toggle");
    if (toggle) toggle.textContent = `reader: ${next}`;
}
