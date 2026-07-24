import { activateSection } from "./nav.js";

let allBlogPosts = [];
let activeSlug = "";

const markdownConverter = new showdown.Converter({
    ghCompatibleHeaderId: true,
    simpleLineBreaks: true,
    tables: true,
    strikethrough: true,
    tasklists: true,
});

export function initBlog(posts) {
    allBlogPosts = (posts || []).map((post) => ({ ...post, slug: post.slug || slugify(post.title) }));

    document.getElementById("blog-container")?.addEventListener("click", (event) => {
        const link = event.target.closest("[data-post-slug]");
        if (!link) return;
        event.preventDefault();
        window.location.hash = `blog/${link.dataset.postSlug}`;
    });

    document.querySelectorAll("[data-reader-close]").forEach((control) => {
        control.addEventListener("click", closeBlogPost);
    });

    document.getElementById("blog-reader")?.querySelector(".reader-panel")?.addEventListener("scroll", updateReaderProgress);
    window.addEventListener("hashchange", handleBlogRoute);
    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && activeSlug) closeBlogPost();
    });

    handleBlogRoute();
}

export function slugify(text = "") {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
}

async function handleBlogRoute() {
    const [, slug] = window.location.hash.replace(/^#/, "").split("/");
    if (!slug) {
        if (activeSlug) hideReader();
        return;
    }

    activateSection("blog");
    const index = allBlogPosts.findIndex((post) => post.slug === slug);
    if (index >= 0) await showBlogPost(index);
}

async function showBlogPost(index) {
    const post = allBlogPosts[index];
    if (!post) return;

    activeSlug = post.slug;
    markActivePost(post.slug);

    const reader = document.getElementById("blog-reader");
    const postTitle = document.getElementById("post-title");
    const postMeta = document.getElementById("post-meta");
    const postBody = document.getElementById("post-body");
    const toc = document.getElementById("post-toc");

    reader.classList.add("open");
    reader.setAttribute("aria-hidden", "false");
    document.body.classList.add("reader-open");
    postTitle.textContent = post.title || "";
    postMeta.textContent = `${formatDate(post.date)} · loading`;
    postBody.innerHTML = `<p class="reader-loading">loading post...</p>`;
    toc.innerHTML = "";

    try {
        const res = await fetch(post.read_me);
        if (!res.ok) throw new Error(`${post.read_me} (${res.status})`);

        const md = await res.text();
        postMeta.textContent = [formatDate(post.date), estimateReadTime(md), (post.tags || []).join(" / ")]
            .filter(Boolean)
            .join(" · ");

        postBody.innerHTML = renderMarkdownWithMath(md);
        prepareHeadings(postBody);
        buildToc(postBody, toc);
        enhanceCodeBlocks(postBody);
        highlightCode(postBody);
        await typesetMath(postBody);

        document.getElementById("blog-reader").querySelector(".reader-panel").scrollTop = 0;
        updateReaderProgress();
    } catch (err) {
        console.error("Blog load error:", err);
        postMeta.textContent = formatDate(post.date);
        postBody.innerHTML = `<p class="reader-error">// error: ${escapeHtml(err.message)}</p>`;
    }
}

function closeBlogPost(event) {
    event?.preventDefault();
    window.location.hash = "blog";
    hideReader();
}

function hideReader() {
    activeSlug = "";
    markActivePost("");
    document.getElementById("blog-reader")?.classList.remove("open");
    document.getElementById("blog-reader")?.setAttribute("aria-hidden", "true");
    document.body.classList.remove("reader-open");
    document.querySelector("#reader-progress span").style.width = "0%";
}

function renderMarkdownWithMath(md) {
    const mathBlocks = [];
    let i = 0;
    const stashMath = (tex) => {
        const key = `MATH_BLOCK_${i++}`;
        mathBlocks.push({ key, tex });
        return `<!--${key}-->`;
    };

    let safeMd = md.replace(/\$\$([\s\S]+?)\$\$/g, (_, tex) => stashMath(`$$${tex}$$`));
    safeMd = safeMd.replace(/(?<!\$)\$([^\n$]+?)\$(?!\$)/g, (_, tex) => stashMath(`$${tex}$`));

    let html = markdownConverter.makeHtml(safeMd);
    mathBlocks.forEach(({ key, tex }) => {
        html = html.replace(new RegExp(`<!--${key}-->`, "g"), tex);
    });
    return html;
}

function prepareHeadings(root) {
    const seen = new Map();
    root.querySelectorAll("h2, h3").forEach((heading) => {
        const base = heading.id || slugify(heading.textContent);
        const count = seen.get(base) || 0;
        seen.set(base, count + 1);
        heading.id = count ? `${base}-${count + 1}` : base;
    });
}

function buildToc(root, toc) {
    const headings = Array.from(root.querySelectorAll("h2, h3"));
    if (!headings.length) {
        toc.innerHTML = `<p class="toc-empty">no headings</p>`;
        return;
    }

    toc.innerHTML = `
        <p class="toc-title">contents</p>
        ${headings.map((heading) => `
            <a class="toc-link toc-${heading.tagName.toLowerCase()}" href="#${heading.id}">
                ${heading.textContent}
            </a>
        `).join("")}
    `;

    toc.querySelectorAll("a").forEach((link) => {
        link.addEventListener("click", (event) => {
            event.preventDefault();
            root.querySelector(link.getAttribute("href"))?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
    });
}

function enhanceCodeBlocks(root) {
    root.querySelectorAll("pre").forEach((pre) => {
        const code = pre.querySelector("code");
        if (!code || pre.parentElement?.classList.contains("code-frame")) return;

        const frame = document.createElement("div");
        frame.className = "code-frame";
        const bar = document.createElement("div");
        bar.className = "code-bar";
        const lang = [...code.classList].find((className) => className.startsWith("language-"))?.replace("language-", "") || "text";
        bar.innerHTML = `<span>${lang}</span><button type="button">copy</button>`;

        pre.parentNode.insertBefore(frame, pre);
        frame.appendChild(bar);
        frame.appendChild(pre);

        bar.querySelector("button").addEventListener("click", async () => {
            await navigator.clipboard?.writeText(code.textContent || "");
            bar.querySelector("button").textContent = "copied";
            setTimeout(() => { bar.querySelector("button").textContent = "copy"; }, 1200);
        });
    });
}

function highlightCode(root) {
    if (!window.Prism) return;
    root.querySelectorAll("code[class*='language-']").forEach((block) => Prism.highlightElement(block));
}

async function typesetMath(root) {
    if (window.MathJax?.typesetPromise) {
        await MathJax.typesetPromise([root]);
    }
}

function updateReaderProgress() {
    const panel = document.getElementById("blog-reader")?.querySelector(".reader-panel");
    const bar = document.querySelector("#reader-progress span");
    if (!panel || !bar || !activeSlug) return;

    const max = panel.scrollHeight - panel.clientHeight;
    const progress = max <= 0 ? 100 : Math.min(100, Math.max(0, (panel.scrollTop / max) * 100));
    bar.style.width = `${progress}%`;
}

function markActivePost(slug) {
    document.querySelectorAll("[data-post-slug]").forEach((link) => {
        link.closest(".item-card")?.classList.toggle("active", link.dataset.postSlug === slug);
    });
}

function estimateReadTime(md) {
    const words = md
        .replace(/```[\s\S]*?```/g, "")
        .replace(/\$\$[\s\S]*?\$\$/g, "")
        .trim()
        .split(/\s+/)
        .filter(Boolean).length;
    return `${Math.max(1, Math.ceil(words / 220))} min read`;
}

function formatDate(date) {
    if (!date) return "";
    const parsed = new Date(`${date}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return date;
    return parsed.toLocaleDateString("en", { year: "numeric", month: "short", day: "numeric" });
}

function escapeHtml(value = "") {
    return value.replace(/[&<>"']/g, (char) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
    }[char]));
}
