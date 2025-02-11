<%*
const pages = app.plugins.plugins.dataview.api.pages('"blog-posts"')
  .map(p => ({
    slug: p.file.name,
    title: p.title,
    date: p.date,
    content: p.file.content,
    list: p.file.content.match(/^-\s.+/gm)?.map(item => item.replace(/^- /, "")) || []
  }));

const filePath = "posts.json";
const jsonData = JSON.stringify(pages, null, 2);

app.vault.adapter.write(filePath, jsonData)
  .then(() => console.log("✅ posts.json has been generated!"))
  .catch(err => console.error("❌ Error saving posts.json:", err));
%>
