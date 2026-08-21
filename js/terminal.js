import { slugify } from './blog.js';

const THEME_VARS = [
    '--bg', '--bg-elev', '--bg-panel', '--bg-soft',
    '--fg', '--sub', '--muted', '--dim',
    '--border', '--border-strong',
    '--accent', '--accent-2', '--accent-3',
    '--signal', '--danger', '--shadow', '--mono', '--sans',
];

let cwd = [];
let log = [];
let seeded = false;
let _bio = null;
let _projects = [];
let _posts = [];

function cwdLabel() { return cwd.length ? '~/' + cwd.join('/') : '~'; }
function promptStr() { return `<span class="term-prompt">guest@saranx:${cwdLabel()}$</span>`; }

function escHtml(s = '') {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function renderLog() {
    const el = document.getElementById('term-log');
    if (!el) return;
    el.innerHTML = log.map(({ prompt, cmd, out }) => {
        const cmdLine = cmd != null
            ? `<div class="t-cmd">${prompt} <span class="term-command">${escHtml(cmd)}</span></div>`
            : '';
        return `<div class="t-entry">${cmdLine}<div class="t-out">${out}</div></div>`;
    }).join('');
    requestAnimationFrame(() => { el.scrollTop = el.scrollHeight; });
}

function updatePromptEl() {
    const el = document.getElementById('term-prompt');
    if (el) el.innerHTML = promptStr();
}

function syncTermTheme() {
    const panel = document.getElementById('term-panel');
    if (!panel || panel.hasAttribute('hidden')) return;
    const reader = document.getElementById('blog-reader');
    const readerOpen = reader?.classList.contains('open');
    const src = readerOpen
        ? (reader.querySelector('.reader-panel') || document.documentElement)
        : document.documentElement;
    const cs = getComputedStyle(src);
    THEME_VARS.forEach(v => panel.style.setProperty(v, cs.getPropertyValue(v).trim()));
}

function cmdHelp() {
    const cmds = [
        ['help',               'show this list'],
        ['ls',                 'list contents of current directory'],
        ['cd <dir>',           'enter a directory (about, experience, projects, skills, blog, contact)'],
        ['cd <name>',          'inside projects/blog: open that item'],
        ['cd ..',              'go back up one directory'],
        ['cat <name>',         'read a brief overview of a file/directory'],
        ['pwd',                'print current directory'],
        ['whoami',             'about me, one line'],
        ['theme <dark|light>', 'switch site theme'],
        ['open <social>',      'github, linkedin, twitter, email'],
        ['clear',              'clear this log'],
        ['neofetch',           'display system info'],
        ['matrix',             'enter the matrix'],
        ['sudo',               'try to elevate privileges'],
    ];
    const maxLen = Math.max(...cmds.map(([c]) => c.length));
    return cmds.map(([c, d]) => c.padEnd(maxLen + 2) + d).join('\n');
}

function cmdLs() {
    const dir = cwd[0];
    if (!dir) return '<span class="term-dir">about/</span>  <span class="term-dir">experience/</span>  <span class="term-dir">projects/</span>  <span class="term-dir">skills/</span>  <span class="term-dir">blog/</span>  <span class="term-dir">contact/</span>';
    if (dir === 'projects') return _projects.map(p => `<span class="term-file">${p.slug}</span>`).join('  ') || '(no projects)';
    if (dir === 'blog')     return _posts.map(p => `<span class="term-file">${p.slug}</span>`).join('  ') || '(no posts)';
    if (dir === 'skills')   return '<span class="term-file">offensive-security</span>  <span class="term-file">blue-team</span>  <span class="term-file">infrastructure</span>  <span class="term-file">web-security</span>  <span class="term-file">cryptography</span>';
    return `<span class="term-file">${dir}.md</span>`;
}

function cmdCd(args) {
    const target = args.trim();
    const dir = cwd[0];

    if (!target || target === '~' || target === '/') { cwd = []; return ''; }
    if (target === '..') { cwd = []; return ''; }

    const TOP = ['about', 'experience', 'projects', 'skills', 'blog', 'contact'];
    if (TOP.includes(target)) {
        cwd = [target];
        window.location.hash = target;
        return '';
    }

    if (!dir) return `<span class="term-error">cd: no such directory: ${escHtml(target)}</span>`;

    if (dir === 'projects') {
        const p = _projects.find(p => p.slug === target);
        if (!p) return `<span class="term-error">cd: no such project: ${escHtml(target)}</span>`;
        if (p.codeUrl) {
            window.open(p.codeUrl, '_blank', 'noopener noreferrer');
            return `opening ${escHtml(target)} (github)...`;
        }
        return `<span class="term-error">no URL available for ${escHtml(target)}</span>`;
    }

    if (dir === 'blog') {
        const p = _posts.find(p => p.slug === target);
        if (!p) return `<span class="term-error">cd: no such post: ${escHtml(target)}</span>`;
        window.location.hash = `blog/${target}`;
        return `opening ${escHtml(target)}...`;
    }

    return `<span class="term-error">cd: no such directory: ${escHtml(target)}</span>`;
}

function cmdCat(args) {
    const target = args.trim().replace(/\.md$/, '');
    const dir = cwd[0];

    if (!dir) {
        if (!target) return 'usage: cat <name>  (try: about, experience, projects, skills, blog, contact)';
        if (target === 'about') {
            const n = (_bio?.experience || []).length;
            return [escHtml(_bio?.profile?.tagline), escHtml(_bio?.profile?.shortBio), `${n} roles logged — run <span class="term-command">\`cd about\`</span> for the full timeline.`].filter(Boolean).join('<br>');
        }
        if (target === 'experience') return `${(_bio?.experience || []).length} work history entries logged — run <span class="term-command">\`cd experience\`</span>.`;
        if (target === 'projects')   return `${_projects.length} projects shipped — run <span class="term-command">\`cd projects\`</span> then <span class="term-command">\`ls\`</span> to browse.`;
        if (target === 'skills')     return 'Categories: Offensive Security, Blue Team, Infrastructure, Web Security, Cryptography — run <span class="term-command">\`cd skills\`</span>.';
        if (target === 'blog')       return `${_posts.length} posts — run <span class="term-command">\`cd blog\`</span> then <span class="term-command">\`ls\`</span> to browse.`;
        if (target === 'contact')    return 'reach out any time — run <span class="term-command">\`cd contact\`</span> or <span class="term-command">\`open email\`</span>.';
        return `<span class="term-error">cat: ${escHtml(target)}: no such file</span>`;
    }

    if (dir === 'about')      return escHtml(_bio?.about?.fullBio) || '(no bio available)';
    if (dir === 'experience') return (_bio?.experience || []).map(e => `${escHtml(e.title)} @ ${escHtml(e.company)} (${escHtml(e.date)})`).join('<br>') || '(no experience data)';
    if (dir === 'skills')     return '<b>Offensive:</b> Python, C/C++, x86 Asm, pwntools, Metasploit<br><b>Blue Team:</b> Wazuh SIEM, Elasticsearch, YARA, Wireshark<br><b>Infra:</b> Linux, Docker, Active Directory, AWS';
    if (dir === 'contact')    return `reach me at <span class="term-file">${escHtml(_bio?.social?.email)}</span>`;

    if (dir === 'projects') {
        if (!target) return _projects.map(p => `<span class="term-file">${p.slug}</span>`).join('  ') || '(no projects)';
        const p = _projects.find(p => p.slug === target);
        if (!p) return `<span class="term-error">cat: ${escHtml(target)}: no such file</span>`;
        return `${escHtml(p.description || '')}<br><br><span class="term-dir">tech:</span> ${escHtml((p.technologies || []).join(', '))}`;
    }

    if (dir === 'blog') {
        if (!target) return _posts.map(p => `<span class="term-file">${p.slug}</span>`).join('  ') || '(no posts)';
        const p = _posts.find(p => p.slug === target);
        if (!p) return `<span class="term-error">cat: ${escHtml(target)}: no such file</span>`;
        const summary = p.summary || p.description || p.title || '';
        const tags = (p.tags || []).join(', ');
        return `${escHtml(summary)}<br><br><span class="term-dir">${escHtml(p.date || '')}</span> · <span class="term-file">${escHtml(tags)}</span>`;
    }

    return `<span class="term-error">cat: ${escHtml(target)}: no such file</span>`;
}

function cmdTheme(args) {
    const t = args.trim();
    if (t !== 'dark' && t !== 'light') return 'usage: theme &lt;dark|light&gt;';
    const current = document.documentElement.dataset.theme || 'dark';
    if (current !== t) document.getElementById('theme-toggle')?.click();
    return `theme set to <span class="term-file">${t}</span>`;
}

function cmdOpen(args) {
    const target = args.trim().toLowerCase();
    const s = _bio?.social || {};
    const map = { github: s.github, linkedin: s.linkedin, twitter: s.twitter, email: s.email };
    if (!(target in map)) return `<span class="term-error">open: unknown: ${escHtml(target)}  (try: github, linkedin, twitter, email)</span>`;
    const url = map[target];
    if (!url) return `<span class="term-error">open: no URL for ${escHtml(target)}</span>`;
    if (target === 'email') window.location.href = `mailto:${url}`;
    else window.open(url, '_blank', 'noopener noreferrer');
    return `opening <span class="term-file">${escHtml(target)}</span>...`;
}

function runCmd(raw) {
    const trimmed = raw.trim();
    if (!trimmed) return;
    const savedPrompt = promptStr();
    const sp = trimmed.indexOf(' ');
    const name = sp >= 0 ? trimmed.slice(0, sp) : trimmed;
    const args = sp >= 0 ? trimmed.slice(sp + 1) : '';

    let out;
    switch (name) {
        case 'help':   out = cmdHelp(); break;
        case 'ls':     out = cmdLs(); break;
        case 'cd':     out = cmdCd(args); break;
        case 'cat':    out = cmdCat(args); break;
        case 'pwd':    out = cwdLabel(); break;
        case 'whoami': out = `${escHtml(_bio?.profile?.name || 'saranx')} — ${escHtml(_bio?.profile?.tagline || '')}`; break;
        case 'theme':  out = cmdTheme(args); break;
        case 'open':   out = cmdOpen(args); break;
        case 'clear':
            log = [];
            renderLog();
            updatePromptEl();
            return;
        case 'neofetch': {
            const uptime = Math.floor((Date.now() - performance.timeOrigin) / 60000);
            out = [
                '<span class="term-dir">       saranx@portfolio</span>',
                '       ──────────────────',
                `<span class="term-file">OS:</span>      saranx.dev v3.1`,
                `<span class="term-file">Shell:</span>   portfolio-terminal 1.0`,
                `<span class="term-file">Uptime:</span>  ${uptime} min`,
                `<span class="term-file">Theme:</span>   ${document.documentElement.dataset.theme || 'dark'}`,
                `<span class="term-file">Skills:</span>  ${_projects.length} projects · ${_posts.length} posts`,
                `<span class="term-file">Stack:</span>   Python, C, Bash, JS`,
                `<span class="term-file">Focus:</span>   offensive security`,
            ].join('\\n');
            break;
        }
        case 'matrix': {
            const chars = 'ﾊﾐﾋｰｳｼﾅﾓﾆｻﾜﾂｵﾘｱﾎﾃﾏｹﾒｴｶｷﾑﾕﾗｾﾈｽﾀﾇﾍ01234567890';
            const lines = Array.from({ length: 6 }, () =>
                Array.from({ length: 48 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
            );
            out = `<span style="color:var(--signal);font-size:11px;line-height:1.3;letter-spacing:2px">${lines.join('\\n')}</span>\\n<span class="term-dir">wake up, Neo...</span>`;
            break;
        }
        case 'sudo':
            out = `<span class="term-error">[sudo] password for guest: \\nguest is not in the sudoers file. this incident will be reported.</span>`;
            break;
        case 'rm':
            if (args.includes('-rf') && (args.includes('/') || args.includes('*'))) {
                out = `<span class="term-error">rm: PANIC — deleting /dev/saranx... ████████░░ 78%\\n\\n</span><span class="term-dir">just kidding. you're in a sandbox. nice try though.</span>`;
            } else {
                out = `<span class="term-error">rm: permission denied (read-only filesystem)</span>`;
            }
            break;
        default:
            out = `<span class="term-error">command not found: ${escHtml(name)}. try \`help\`.</span>`;
    }

    log.push({ prompt: savedPrompt, cmd: trimmed, out });
    renderLog();
    updatePromptEl();
}

export function initTerminal(bio, projects, blogPosts) {
    _bio      = bio;
    _projects = (projects || []).map(p => ({ ...p, slug: slugify(p.title) }));
    _posts    = (blogPosts || []).map(p => ({ ...p, slug: p.slug || slugify(p.title) }));

    const trigger  = document.getElementById('term-trigger');
    const panel    = document.getElementById('term-panel');
    const closeBtn = document.getElementById('term-close');
    const input    = document.getElementById('term-input');
    if (!trigger || !panel || !closeBtn || !input) return;

    trigger.addEventListener('click', () => {
        if (panel.hasAttribute('hidden')) {
            panel.removeAttribute('hidden');
            syncTermTheme();
            if (!seeded) {
                log.push({ prompt: '', cmd: null, out: 'type `help` to see available commands. try `ls`, `cd projects`, `cat about`.' });
                seeded = true;
                renderLog();
            }
            input.focus();
        } else {
            panel.setAttribute('hidden', '');
        }
    });

    closeBtn.addEventListener('click', () => panel.setAttribute('hidden', ''));

    input.addEventListener('keydown', e => {
        if (e.key === 'Tab') {
            e.preventDefault();
            const val = input.value;
            const parts = val.split(' ');
            if (parts.length === 1) {
                const cmds = ['help', 'ls', 'cd', 'cat', 'pwd', 'whoami', 'theme', 'open', 'clear'];
                const matches = cmds.filter(c => c.startsWith(parts[0]));
                if (matches.length === 1) input.value = matches[0] + ' ';
            } else if (parts.length === 2) {
                const cmd = parts[0];
                const prefix = parts[1];
                let opts = [];
                if (cmd === 'cd' || cmd === 'cat') {
                    if (!cwd[0]) {
                        opts = ['about', 'experience', 'projects', 'skills', 'blog', 'contact'];
                    } else if (cwd[0] === 'projects') {
                        opts = _projects.map(p => p.slug);
                    } else if (cwd[0] === 'blog') {
                        opts = _posts.map(p => p.slug);
                    }
                } else if (cmd === 'theme') {
                    opts = ['dark', 'light'];
                } else if (cmd === 'open') {
                    opts = ['github', 'linkedin', 'twitter', 'email'];
                }
                const matches = opts.filter(o => o.startsWith(prefix));
                if (matches.length === 1) input.value = `${cmd} ${matches[0]} `;
            }
            // Ensure focus is kept
            setTimeout(() => input.focus(), 0);
            return;
        }

        if (e.key === 'Enter') {
            e.preventDefault();
            const val = input.value;
            input.value = '';
            runCmd(val);
            // Ensure focus is kept after DOM updates
            setTimeout(() => input.focus(), 0);
            return;
        }
    });

    const mo = new MutationObserver(syncTermTheme);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    const reader = document.getElementById('blog-reader');
    if (reader) mo.observe(reader, { attributes: true, attributeFilter: ['class', 'data-reader-theme'] });
}
