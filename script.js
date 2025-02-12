document.addEventListener("DOMContentLoaded", async function () {
    // Load Blog Posts
    fetch("posts.json")
        .then(response => response.json())
        .then(posts => {
            const blogContainer = document.getElementById("blog-posts");
            if (!blogContainer) return;
            blogContainer.innerHTML = ""; // Clear existing content

            // Sort posts by date (newest first)
            posts.sort((a, b) => new Date(b.date) - new Date(a.date));

            posts.forEach((post, index) => {
                const postElement = document.createElement("article");
                const isFirstPost = index === 0;
                postElement.innerHTML = `
                    <h3><a href="posts/${post.slug}.html">${post.title}</a></h3>
                    <p>${post.date}</p>
                    <div class="post-content" style="display: ${isFirstPost ? "block" : "none"};">
                        <p>${post.excerpt}</p>
                    </div>
                    ${isFirstPost ? "" : `<button class="toggle-post">Read More</button>`}
                `;

                if (!isFirstPost) {
                    postElement.querySelector(".toggle-post").addEventListener("click", function () {
                        const content = postElement.querySelector(".post-content");
                        const isCollapsed = content.style.display === "none";
                        content.style.display = isCollapsed ? "block" : "none";
                        this.textContent = isCollapsed ? "Collapse" : "Read More";
                    });
                }

                blogContainer.appendChild(postElement);
            });
        })
        .catch(error => console.error("Error loading blog posts:", error));

    // Load GitHub Projects
    const username = "unclegun"; // Your GitHub username
    const projectsList = document.getElementById("projects-list");

    if (!projectsList) return; // Exit if the projects section doesn't exist

    projectsList.innerHTML = "<p>Loading projects...</p>";

    try {
        const response = await fetch(`https://api.github.com/users/${username}/repos`);
        if (!response.ok) {
            throw new Error(`GitHub API Error: ${response.status}`);
        }

        const repos = await response.json();
        projectsList.innerHTML = ""; // Clear loading text

        if (repos.length === 0) {
            projectsList.innerHTML = "<p>No public repositories found.</p>";
            return;
        }

        // Create a list of repositories
        const ul = document.createElement("ul");
        repos.forEach(repo => {
            const li = document.createElement("li");
            const a = document.createElement("a");

            a.href = repo.html_url;
            a.target = "_blank";
            a.textContent = repo.name;

            li.appendChild(a);
            ul.appendChild(li);
        });

        projectsList.appendChild(ul);

    } catch (error) {
        console.error("Error fetching GitHub repositories:", error);
        projectsList.innerHTML = "<p>Failed to load projects.</p>";
    }
});
