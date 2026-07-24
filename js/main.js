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
    initBlog(blogPosts);
    initTerminal(bio, projects, blogPosts);
    initContactForm(email);

    setTimeout(() => typeWriter("tagline-text", bio.profile?.tagline || "", 34), 80);

    setTimeout(() => typeWriter("prompt-1", "whoami", 40), 600);
    setTimeout(() => typeWriter("prompt-2", "./focus", 40), 1000);
    setTimeout(() => typeWriter("prompt-3", "cat lab-notes.txt", 40), 1400);
    setTimeout(() => typeWriter("prompt-4", "ls pages/", 40), 1800);
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
