export function delay(ms) {
    return new Promise(r => setTimeout(r, ms));
}

export function pad(n) {
    return String(n).padStart(2, "0");
}

export function typeWriter(elId, text, speed) {
    const el = document.getElementById(elId);
    if (!el) return;
    el.textContent = "";
    let i = 0;
    const t = setInterval(() => {
        if (i < text.length) { el.textContent += text[i++]; }
        else { clearInterval(t); }
    }, speed);
}
