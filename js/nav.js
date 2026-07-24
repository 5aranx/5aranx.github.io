let sectionIds = [];

export function setupNavigation() {
    sectionIds = Array.from(document.querySelectorAll(".content-section")).map((section) => section.id);

    document.querySelectorAll(".nav-link").forEach((link) => {
        link.addEventListener("click", (event) => {
            event.preventDefault();
            const section = link.dataset.section;
            if (section) window.location.hash = section;
        });
    });

    window.addEventListener("hashchange", () => {
        const section = getSectionFromHash();
        if (sectionIds.includes(section)) activateSection(section);
    });

    activateSection(getSectionFromHash());
}

export function activateSection(sectionId = "about") {
    if (!sectionIds.includes(sectionId)) sectionId = "about";

    document.querySelectorAll(".nav-link").forEach((link) => {
        link.classList.toggle("active", link.dataset.section === sectionId);
    });

    document.querySelectorAll(".content-section").forEach((section) => {
        section.classList.toggle("active", section.id === sectionId);
    });

    const target = document.getElementById(sectionId);
    if (target) {
        target.style.animation = "none";
        target.offsetHeight;
        target.style.animation = "";
        if (window.innerWidth <= 760 && window.location.hash.replace(/^#/, "").split("/")[0] === sectionId) {
            target.scrollIntoView({ behavior: "smooth", block: "start" });
        }
    }
}

export function getSectionFromHash() {
    const raw = window.location.hash.replace(/^#/, "");
    return raw.split("/")[0] || "about";
}
