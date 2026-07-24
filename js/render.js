import { pad } from "./utils.js";
import { slugify } from "./blog.js";

export function renderAboutAndExperience(aboutText, experience) {
    const aboutEl = document.getElementById("about-content");
    aboutEl.textContent = "";
    (aboutText || "").split("\n").forEach((para) => {
        if (!para.trim()) return;
        const p = document.createElement("p");
        p.textContent = para;
        aboutEl.appendChild(p);
    });

    document.getElementById("experience-container").innerHTML = (experience || [])
        .map((exp, i) => `
            <article class="item-card timeline-item" style="animation-delay:${i * 0.06}s">
                <div class="card-top">
                    <span class="card-idx">[${pad(i + 1)}]</span>
                    <span class="card-date">${escapeHtml(exp.date || "")}</span>
                </div>
                <h3 class="item-title">${escapeHtml(exp.title || "")}</h3>
                <p class="item-subtitle">${escapeHtml(exp.company || "")}</p>
                <ul class="item-description">
                    ${(exp.description || []).map((d) => `<li>${escapeHtml(d)}</li>`).join("")}
                </ul>
            </article>`)
        .join("");
}

export function renderProjects(projects) {
    document.getElementById("projects-container").innerHTML = (projects || [])
        .sort((a, b) => (a.priority || 99) - (b.priority || 99))
        .map((proj, i) => {
            const title = proj.codeUrl
                ? `<a href="${escapeAttr(proj.codeUrl)}" target="_blank" rel="noopener noreferrer" class="item-title-link">${escapeHtml(proj.title || "")}</a>`
                : `<h3 class="item-title">${escapeHtml(proj.title || "")}</h3>`;
            return `
                <article class="item-card project-card" style="animation-delay:${i * 0.06}s">
                    <div class="card-top">
                        <span class="card-idx">[${pad(i + 1)}]</span>
                        <span class="card-date">project</span>
                    </div>
                    ${title}
                    <p class="item-summary">${escapeHtml(proj.description || "")}</p>
                    <div class="tech-tags">
                        ${(proj.technologies || []).map((t) => `<span class="tech-tag">${escapeHtml(t)}</span>`).join("")}
                    </div>
                </article>`;
        })
        .join("");
}

export function renderBlog(posts) {
    const sortedPosts = [...(posts || [])].sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
    const count = document.getElementById("blog-count");
    if (count) count.textContent = `${sortedPosts.length} posts`;

    document.getElementById("blog-container").innerHTML = sortedPosts
        .map((post, i) => {
            const slug = post.slug || slugify(post.title);
            return `
                <article class="item-card blog-card" style="animation-delay:${i * 0.06}s">
                    <div class="card-top">
                        <span class="card-idx">[${pad(i + 1)}]</span>
                        <span class="card-date">${escapeHtml(post.date || "")}</span>
                    </div>
                    <a class="item-title-link" href="#blog/${slug}" data-post-slug="${slug}">${escapeHtml(post.title || "")}</a>
                    <p class="item-summary">${escapeHtml(post.content || "")}</p>
                    <div class="tech-tags">
                        ${(post.tags || []).map((t) => `<span class="tech-tag blog-tag">${escapeHtml(t)}</span>`).join("")}
                    </div>
                </article>`;
        })
        .join("");
}

function escapeHtml(value = "") {
    return String(value).replace(/[&<>"']/g, (char) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
    }[char]));
}

function escapeAttr(value = "") {
    return escapeHtml(value).replace(/`/g, "&#96;");
}
