import os
import json
import re

# Get the repo root dynamically (assumes script is inside scripts/)
REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

# Define relative paths
BLOG_DIR = os.path.join(REPO_ROOT, "blog-posts")
OUTPUT_FILE = os.path.join(REPO_ROOT, "posts.json")

# Try loading existing posts.json
if os.path.exists(OUTPUT_FILE):
    with open(OUTPUT_FILE, "r", encoding="utf-8") as f:
        try:
            existing_posts = json.load(f)
        except json.JSONDecodeError:
            existing_posts = []
else:
    existing_posts = []

# Convert existing posts into a dictionary (for easy lookup)
existing_posts_dict = {post["slug"]: post for post in existing_posts}

# List to store updated post data
updated_posts = []

# Loop through each Markdown file in the directory
for filename in os.listdir(BLOG_DIR):
    if filename.endswith(".md"):
        filepath = os.path.join(BLOG_DIR, filename)

        with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
            lines = f.readlines()

        # Extract metadata
        title = lines[0].replace("#title ", "").strip() if lines and lines[0].startswith("#title ") else None
        date = lines[1].replace("#date ", "").strip() if len(lines) > 1 and lines[1].startswith("#date ") else None

        # Skip files without a valid title and date
        if not title or not date:
            print(f"Skipping {filename} (Missing title or date)")
            continue

        # Remove metadata lines
        content_lines = lines[2:]

        # Extract unordered list items (- item)
        list_items = []
        formatted_text = []
        
        for line in content_lines:
            stripped_line = line.strip()
            if stripped_line.startswith("- "):
                list_items.append(re.sub(r"^- ", "", stripped_line))
            else:
                # If there's a list collected, flush it into formatted_text
                if list_items:
                    formatted_text.append("<ul>" + "".join(f"<li>{item}</li>" for item in list_items) + "</ul>")
                    list_items = []  # Reset list
                formatted_text.append(f"<p>{stripped_line}</p>")  # Treat normal lines as paragraphs

        # Flush any remaining list at the end of the document
        if list_items:
            formatted_text.append("<ul>" + "".join(f"<li>{item}</li>" for item in list_items) + "</ul>")

        # Join the formatted text
        formatted_body = "".join(formatted_text)

        # Create post data
        post_data = {
            "slug": filename.replace(".md", ""),
            "title": title,
            "date": date.strip(),  # Ensure no whitespace issues
            "excerpt": formatted_body
        }

        # Only update if the post has changed
        if filename.replace(".md", "") in existing_posts_dict:
            old_post = existing_posts_dict[filename.replace(".md", "")]
            if old_post != post_data:
                print(f"Updating {filename} (Content changed)")
                updated_posts.append(post_data)
            else:
                updated_posts.append(old_post)  # Keep the existing post unchanged
        else:
            print(f"Adding new post: {filename}")
            updated_posts.append(post_data)

# Write JSON only if changes were detected
if updated_posts != existing_posts:
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(updated_posts, f, indent=2)
    print(f"JSON successfully updated: {OUTPUT_FILE}")
else:
    print("No changes detected, JSON file remains the same.")
