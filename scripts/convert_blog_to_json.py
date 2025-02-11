import os
import json
import re

# Get the repo root dynamically (assumes script is inside scripts/)
REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

# Define relative paths
BLOG_DIR = os.path.join(REPO_ROOT, "blog-posts")
OUTPUT_FILE = os.path.join(REPO_ROOT, "posts.json")

# List to store post data
posts = []

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
            print(f"❌ Skipping {filename} (Missing title or date)")
            continue

        # Remove metadata lines
        content_lines = lines[2:]

        # Extract excerpt (first 5 non-empty lines)
        excerpt_lines = [line.strip() for line in content_lines if line.strip()]
        excerpt = " ".join(excerpt_lines[:5]) if excerpt_lines else ""

        # Extract unordered list items (- item)
        list_items = [re.sub(r"^- ", "", line.strip()) for line in content_lines if line.strip().startswith("- ")]

        # Append post data, including lists if available
        post_data = {
            "slug": filename.replace(".md", ""),
            "title": title,
            "date": date,
            "excerpt": excerpt
        }

        # Only include 'list' if there are actual list items
        if list_items:
            post_data["list"] = list_items

        posts.append(post_data)

# Write JSON to file
with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
    json.dump(posts, f, indent=2)

print(f"✅ JSON successfully created: {OUTPUT_FILE}")
