document.addEventListener("DOMContentLoaded", function () {
    fetch("posts.json")
        .then(response => response.json())
        .then(posts => {
            const blogContainer = document.getElementById("blog-posts");
            posts.forEach(post => {
                const postElement = document.createElement("article");
                postElement.innerHTML = `
                    <h3><a href="posts/${post.slug}.html">${post.title}</a></h3>
                    <p>${post.date}</p>
                    <p>${post.excerpt}</p>
                `;
                blogContainer.appendChild(postElement);
            });
        });
});