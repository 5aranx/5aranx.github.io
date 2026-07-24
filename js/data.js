export async function loadData() {
    const cb = `?v=${Date.now()}`;
    const [bioRes, projRes, blogRes] = await Promise.all([
        fetch(`./res/bio.json${cb}`),
        fetch(`./res/projects.json${cb}`),
        fetch(`./res/blog.json${cb}`),
    ]);
    if (!bioRes.ok)  throw new Error(`bio.json: ${bioRes.statusText}`);
    if (!projRes.ok) throw new Error(`projects.json: ${projRes.statusText}`);
    if (!blogRes.ok) throw new Error(`blog.json: ${blogRes.statusText}`);

    const [bio, projectsData, blogRaw] = await Promise.all([
        bioRes.json(), projRes.json(), blogRes.json(),
    ]);

    const blogBaseUrl = blogRes.url;
    const blogPosts = (blogRaw.posts || []).map((p) => {
        try { return { ...p, read_me: new URL(p.read_me, blogBaseUrl).href }; }
        catch { return p; }
    });

    return { bio, projects: projectsData.projects || [], blogPosts };
}
