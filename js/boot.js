const LINES = [
    '[ok] mounting /dev/saranx',
    '[ok] starting network.service',
    '[ok] loading shell: zsh',
    '[ok] initializing saranx.dev v3.1',
    'booting into saranx...',
];

export async function boot() {
    const overlay = document.getElementById('boot-overlay');
    const linesEl = document.getElementById('boot-lines');
    const main    = document.getElementById('main-container');

    if (!overlay || !linesEl) {
        if (main) main.style.opacity = '1';
        return;
    }

    function dismiss() {
        overlay.classList.add('fading');
        if (main) main.style.opacity = '1';
        overlay.addEventListener('transitionend', () => { overlay.style.display = 'none'; }, { once: true });
    }

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        LINES.forEach((txt, i) => {
            const d = document.createElement('div');
            d.className = 'b-line' + (i === LINES.length - 1 ? ' b-last' : '');
            d.textContent = txt;
            linesEl.appendChild(d);
        });
        dismiss();
        return;
    }

    return new Promise(resolve => {
        let idx = 0;

        function nextLine() {
            if (idx >= LINES.length) {
                setTimeout(() => {
                    resolve();
                    dismiss();
                }, 550);
                return;
            }
            const d = document.createElement('div');
            d.className = 'b-line' + (idx === LINES.length - 1 ? ' b-last' : '');
            d.textContent = LINES[idx];
            linesEl.appendChild(d);
            idx++;
            setTimeout(nextLine, 260);
        }

        nextLine();
    });
}
