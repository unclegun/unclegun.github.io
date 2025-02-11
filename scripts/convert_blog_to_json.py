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

        # Append post data
        post_data = {
            "slug": filename.replace(".md", ""),
            "title": title,
            "date": date,
            "excerpt": formatted_body
        }

        posts.append(post_data)

# Write JSON to file
with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
    json.dump(posts, f, indent=2)

print(f"✅ JSON successfully created: {OUTPUT_FILE}")
