import { boot } from "./boot.js?v=2";
import { loadData } from "./data.js?v=2";
import { setupNavigation } from "./nav.js?v=2";
import { populateSocials } from "./socials.js?v=2";
import { renderAboutAndExperience, renderProjects, renderBlog } from "./render.js?v=2";
import { initBlog } from "./blog.js?v=2";
import { initReaderTheme, initTheme } from "./theme.js?v=2";
import { typeWriter } from "./utils.js?v=2";
import { initTerminal } from "./terminal.js?v=2";

document.addEventListener("DOMContentLoaded", async () => {
    // Skeleton loading
    const skeletonHTML = '<div class="skeleton-line"></div>'.repeat(3);
    ['about-content', 'experience-container', 'projects-container', 'blog-container', 'skills-container'].forEach(id => {
        const el = document.getElementById(id);
        if (el && !el.children.length) el.innerHTML = skeletonHTML;
    });

    initTheme();
    initReaderTheme();
    setupNavigation();

    let data;
    try {
        [, data] = await Promise.all([boot(), loadData()]);
    } catch (err) {
        console.error("Error loading data:", err);
        const main = document.getElementById("main-container");
        if (main) {
            main.style.opacity = "1";
            main.innerHTML = `<div class="fatal-error"><p>// error</p><pre>${err.message}</pre></div>`;
        }
        return;
    }

    const { bio, projects, blogPosts } = data;
    const email = bio.social?.email || "saranshsingh2006@gmail.com";

    document.title = `${bio.profile?.name || "Portfolio"} | Research · Offensive · Defense`;
    document.getElementById("name").textContent = bio.profile?.name || "";
    document.getElementById("bio").textContent = bio.profile?.shortBio || "";
    document.getElementById("direct-email").textContent = email;
    document.getElementById("direct-email").href = `mailto:${email}`;

    populateSocials(bio.social);
    renderAboutAndExperience(bio.about?.fullBio || "", bio.experience || []);
    renderProjects(projects);
    renderBlog(blogPosts);

    // Skills rendering
    const SKILLS_DATA = [
        { category: 'Offensive Security', items: ['Python', 'C/C++', 'x86 Assembly', 'pwntools', 'Metasploit', 'Burp Suite', 'Cobalt Strike', 'Nmap'] },
        { category: 'Defensive / Blue Team', items: ['Wazuh SIEM', 'Elasticsearch', 'YARA', 'Sigma Rules', 'Wireshark', 'Splunk', 'tcpdump'] },
        { category: 'Infrastructure', items: ['Linux', 'Docker', 'Git', 'AWS', 'Nginx', 'Active Directory', 'Windows Server'] },
        { category: 'Web Security', items: ['XSS', 'SQLi', 'SSRF', 'CSRF', 'OAuth', 'JWT', 'IDOR', 'XXE'] },
        { category: 'Languages & Frameworks', items: ['Python', 'C', 'Bash', 'JavaScript', 'SQL', 'Go', 'Assembly'] },
        { category: 'Cryptography', items: ['AES-GCM', 'RSA', 'Padding Oracle', 'Hash Extension', 'TLS/SSL', 'SageMath'] },
    ];
    const skillsEl = document.getElementById('skills-container');
    if (skillsEl) {
        skillsEl.innerHTML = SKILLS_DATA.map((cat, i) => `
            <div class="skill-category" style="animation-delay:${i * 0.06}s">
                <h3 class="skill-category-title">${cat.category}</h3>
                <div class="skill-items">
                    ${cat.items.map(item => `<span class="skill-item"><span class="skill-dot"></span>${item}</span>`).join('')}
                </div>
            </div>
        `).join('');
    }

    initBlog(blogPosts);
    initTerminal(bio, projects, blogPosts);
    initContactForm(email);

    setTimeout(() => typeWriter("tagline-text", bio.profile?.tagline || "", 34), 80);

    setTimeout(() => typeWriter("prompt-1", "whoami", 40), 600);
    setTimeout(() => typeWriter("prompt-2", "./focus", 40), 1000);
    setTimeout(() => typeWriter("prompt-3", "cat lab-notes.txt", 40), 1400);
    setTimeout(() => typeWriter("prompt-4", "ls pages/", 40), 1800);

    // Scroll-reveal animations
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('revealed'); observer.unobserve(e.target); } });
    }, { threshold: 0.1 });
    document.querySelectorAll('.item-card, .skill-category').forEach(card => {
        card.classList.add('reveal');
        observer.observe(card);
    });

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
        // Don't interfere with typing in inputs/terminal
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        const sections = ['about', 'experience', 'projects', 'skills', 'blog', 'contact'];
        const current = sections.indexOf(window.location.hash.replace('#','').split('/')[0] || 'about');
        if (e.key === 'j' || e.key === 'ArrowDown') {
            e.preventDefault();
            const next = Math.min(current + 1, sections.length - 1);
            window.location.hash = sections[next];
        } else if (e.key === 'k' || e.key === 'ArrowUp') {
            e.preventDefault();
            const prev = Math.max(current - 1, 0);
            window.location.hash = sections[prev];
        } else if (e.key === 't') {
            document.getElementById('term-trigger')?.click();
        } else if (e.key === '/') {
            e.preventDefault();
            const panel = document.getElementById('term-panel');
            if (panel?.hasAttribute('hidden')) document.getElementById('term-trigger')?.click();
            setTimeout(() => document.getElementById('term-input')?.focus(), 100);
        }
    });

    // Mobile menu
    const menuToggle = document.getElementById('mobile-menu-toggle');
    const menuOverlay = document.getElementById('mobile-menu-overlay');
    if (menuToggle) {
        const toggleMenu = () => {
            const open = document.body.classList.toggle('menu-open');
            menuToggle.classList.toggle('open', open);
            menuToggle.setAttribute('aria-expanded', String(open));
        };
        menuToggle.addEventListener('click', toggleMenu);
        menuOverlay?.addEventListener('click', toggleMenu);
        // Close menu when a nav link is clicked
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', () => {
                if (document.body.classList.contains('menu-open')) toggleMenu();
            });
        });
    }

    // Back to top
    const backToTop = document.getElementById('back-to-top');
    if (backToTop) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 300) {
                backToTop.removeAttribute('hidden');
                requestAnimationFrame(() => backToTop.classList.add('visible'));
            } else {
                backToTop.classList.remove('visible');
                setTimeout(() => { if (window.scrollY <= 300) backToTop.setAttribute('hidden', ''); }, 300);
            }
        }, { passive: true });
        backToTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
    }

    // Resume viewer
    const resumeOpen = document.getElementById('resume-open');
    const resumeViewer = document.getElementById('resume-viewer');
    const resumeIframe = document.getElementById('resume-iframe');
    if (resumeOpen && resumeViewer) {
        resumeOpen.addEventListener('click', () => {
            if (resumeIframe) resumeIframe.src = 'res/saranx.pdf';
            resumeViewer.classList.add('open');
            resumeViewer.setAttribute('aria-hidden', 'false');
        });
        const closeResume = () => {
            resumeViewer.classList.remove('open');
            resumeViewer.setAttribute('aria-hidden', 'true');
            if (resumeIframe) resumeIframe.src = '';
        };
        resumeViewer.querySelectorAll('[data-resume-close]').forEach(el => el.addEventListener('click', closeResume));
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && resumeViewer.classList.contains('open')) closeResume();
        });
    }
});

function initContactForm(email) {
    const form = document.getElementById("contact-form");
    if (!form) return;

    form.addEventListener("submit", (event) => {
        event.preventDefault();

        const name = document.getElementById("contact-name").value.trim();
        const from = document.getElementById("contact-email").value.trim();
        const subject = document.getElementById("contact-subject").value.trim() || "Portfolio contact";
        const message = document.getElementById("contact-message").value.trim();
        const body = [
            message,
            "",
            "---",
            name ? `Name: ${name}` : "",
            from ? `Email: ${from}` : "",
            "Sent from saranx.github.io",
        ].filter(Boolean).join("\n");

        window.location.href = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    });
}
