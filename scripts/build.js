#!/usr/bin/env node
/**
 * Static site generator for the papers site.
 * Zero dependencies — runs with plain Node.js (>= 18).
 *
 * Reads:  site.config.json, data/papers/*.json, pdfs/, assets/, admin/
 * Writes: dist/  (ready to be deployed to GitHub Pages)
 */
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const DIST = path.join(ROOT, "dist");

const config = JSON.parse(fs.readFileSync(path.join(ROOT, "site.config.json"), "utf8"));

const SITE_URL = config.siteUrl.replace(/\/+$/, "");
const BASE_PATH = new URL(SITE_URL).pathname.replace(/\/+$/, ""); // "" or "/RepoName"
const LANG = config.language || "en";
const AUTHOR = config.author || {};
const NOW = new Date().toISOString();

/* ---------------------------------- helpers ---------------------------------- */

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function truncate(s, n) {
  s = String(s || "").replace(/\s+/g, " ").trim();
  if (s.length <= n) return s;
  return s.slice(0, n - 1).replace(/\s+\S*$/, "") + "…";
}

function url(p) {
  return SITE_URL + (p.startsWith("/") ? p : "/" + p);
}

function href(p) {
  return BASE_PATH + (p.startsWith("/") ? p : "/" + p);
}

function write(rel, content) {
  const file = path.join(DIST, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

function copyDir(srcRel, destRel) {
  const src = path.join(ROOT, srcRel);
  if (!fs.existsSync(src)) return;
  fs.cpSync(src, path.join(DIST, destRel), { recursive: true });
}

/* ----------------------------------- data ------------------------------------ */

const papersDir = path.join(ROOT, "data", "papers");
let papers = [];
if (fs.existsSync(papersDir)) {
  for (const f of fs.readdirSync(papersDir)) {
    if (!f.endsWith(".json")) continue;
    const p = JSON.parse(fs.readFileSync(path.join(papersDir, f), "utf8"));
    p.slug = p.slug || f.replace(/\.json$/, "");
    p.authors = Array.isArray(p.authors) ? p.authors : [p.authors].filter(Boolean);
    p.keywords = Array.isArray(p.keywords) ? p.keywords : [];
    papers.push(p);
  }
}
// Newest first; stable secondary sort by title.
papers.sort((a, b) => (b.year || 0) - (a.year || 0) || String(a.title).localeCompare(String(b.title)));

function paperPath(p) {
  return `/papers/${p.slug}/`;
}

function pdfUrl(p) {
  if (!p.pdf) return null;
  return /^https?:\/\//i.test(p.pdf) ? p.pdf : url("/" + p.pdf.replace(/^\/+/, ""));
}

function pubDateSlash(p) {
  // Google Scholar wants YYYY/MM/DD (or at least YYYY).
  if (p.published && /^\d{4}-\d{2}-\d{2}$/.test(p.published)) return p.published.replace(/-/g, "/");
  return String(p.year || "");
}

/* --------------------------------- templates --------------------------------- */

function layout({ title, description, canonical, head = "", body, bodyClass = "" }) {
  return `<!doctype html>
<html lang="${esc(LANG)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(canonical)}">
<meta name="author" content="${esc(AUTHOR.name || "")}">
<meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large">
<link rel="alternate" type="application/atom+xml" title="${esc(config.siteTitle)}" href="${esc(url("/feed.xml"))}">
<link rel="stylesheet" href="${esc(href("/assets/style.css"))}">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ctext y='.9em' font-size='90'%3E%F0%9F%93%84%3C/text%3E%3C/svg%3E">
${head}
</head>
<body class="${esc(bodyClass)}">
<header class="site-header">
  <nav><a href="${esc(href("/"))}" class="site-name">${esc(config.siteTitle)}</a></nav>
</header>
<main>
${body}
</main>
<footer class="site-footer">
  <p>© ${new Date().getFullYear()} ${esc(AUTHOR.name || "")}.
  ${AUTHOR.orcid ? `<a href="${esc(AUTHOR.orcid)}" rel="me">ORCID</a> · ` : ""}
  ${AUTHOR.googleScholar ? `<a href="${esc(AUTHOR.googleScholar)}" rel="me">Google Scholar</a> · ` : ""}
  <a href="${esc(href("/feed.xml"))}">Feed</a></p>
</footer>
</body>
</html>`;
}

function ogTags({ title, description, canonical, type = "website" }) {
  return `<meta property="og:type" content="${esc(type)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:site_name" content="${esc(config.siteTitle)}">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">`;
}

function jsonLd(obj) {
  return `<script type="application/ld+json">${JSON.stringify(obj)}</script>`;
}

function personLd() {
  const person = {
    "@type": "Person",
    name: AUTHOR.name,
  };
  if (AUTHOR.affiliation) person.affiliation = { "@type": "Organization", name: AUTHOR.affiliation };
  const sameAs = [AUTHOR.orcid, AUTHOR.googleScholar, AUTHOR.website].filter(Boolean);
  if (sameAs.length) person.sameAs = sameAs;
  if (AUTHOR.email) person.email = AUTHOR.email;
  return person;
}

function paperLd(p) {
  const canonical = url(paperPath(p));
  const ld = {
    "@context": "https://schema.org",
    "@type": "ScholarlyArticle",
    headline: p.title,
    name: p.title,
    abstract: p.abstract,
    author: p.authors.map((name) =>
      name === AUTHOR.name ? personLd() : { "@type": "Person", name }
    ),
    keywords: p.keywords.join(", "),
    url: canonical,
    mainEntityOfPage: canonical,
    inLanguage: LANG,
  };
  if (p.year) ld.datePublished = p.published || String(p.year);
  if (p.venue) ld.isPartOf = { "@type": "Periodical", name: p.venue };
  if (p.doi) {
    ld.sameAs = `https://doi.org/${p.doi}`;
    ld.identifier = { "@type": "PropertyValue", propertyID: "DOI", value: p.doi };
  }
  const pdf = pdfUrl(p);
  if (pdf) {
    ld.encoding = { "@type": "MediaObject", contentUrl: pdf, encodingFormat: "application/pdf" };
  }
  return ld;
}

/* --------------------------------- paper page -------------------------------- */

function citationMeta(p) {
  // Highwire Press tags — what Google Scholar indexes.
  const tags = [];
  const add = (name, content) => content && tags.push(`<meta name="${name}" content="${esc(content)}">`);
  add("citation_title", p.title);
  for (const a of p.authors) add("citation_author", a);
  add("citation_publication_date", pubDateSlash(p));
  add("citation_journal_title", p.venue);
  add("citation_doi", p.doi);
  add("citation_abstract_html_url", url(paperPath(p)));
  add("citation_pdf_url", pdfUrl(p));
  add("citation_language", LANG);
  for (const k of p.keywords) add("citation_keywords", k);
  // Dublin Core
  add("DC.title", p.title);
  for (const a of p.authors) add("DC.creator", a);
  add("DC.date", p.published || String(p.year || ""));
  add("DC.identifier", p.doi ? `doi:${p.doi}` : url(paperPath(p)));
  add("DC.description", truncate(p.abstract, 300));
  add("DC.language", LANG);
  return tags.join("\n");
}

function paperPage(p) {
  const canonical = url(paperPath(p));
  const description = truncate(p.abstract, 160);
  const pdf = pdfUrl(p);
  const doiUrl = p.doi ? `https://doi.org/${p.doi}` : null;

  const links = [
    pdf && `<a class="btn" href="${esc(pdf)}">Full text (PDF)</a>`,
    doiUrl && `<a class="btn" href="${esc(doiUrl)}" rel="external">DOI: ${esc(p.doi)}</a>`,
    p.url && p.url !== doiUrl && `<a class="btn" href="${esc(p.url)}" rel="external">Publisher page</a>`,
  ].filter(Boolean).join("\n    ");

  const citation = `${p.authors.join(", ")} (${p.year}). ${p.title}.${p.venue ? ` ${p.venue}.` : ""}${p.doi ? ` https://doi.org/${p.doi}` : ""}`;

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: config.siteTitle, item: url("/") },
      { "@type": "ListItem", position: 2, name: p.title, item: canonical },
    ],
  };

  const head = [
    `<meta name="keywords" content="${esc(p.keywords.join(", "))}">`,
    citationMeta(p),
    ogTags({ title: p.title, description, canonical, type: "article" }),
    jsonLd(paperLd(p)),
    jsonLd(breadcrumbLd),
  ].join("\n");

  const body = `<article class="paper" itemscope itemtype="https://schema.org/ScholarlyArticle">
  <h1 itemprop="headline">${esc(p.title)}</h1>
  <p class="meta">
    <span class="authors">${p.authors.map((a) => `<span itemprop="author" itemscope itemtype="https://schema.org/Person"><span itemprop="name">${esc(a)}</span></span>`).join(", ")}</span>
    ${p.year ? ` · <time itemprop="datePublished" datetime="${esc(p.published || String(p.year))}">${esc(String(p.year))}</time>` : ""}
    ${p.venue ? ` · <span class="venue">${esc(p.venue)}</span>` : ""}
  </p>
  ${links ? `<p class="links">\n    ${links}\n  </p>` : ""}
  <section>
    <h2>Abstract</h2>
    <p class="abstract" itemprop="abstract">${esc(p.abstract)}</p>
  </section>
  ${p.keywords.length ? `<section>
    <h2>Keywords</h2>
    <ul class="keywords">${p.keywords.map((k) => `<li itemprop="keywords">${esc(k)}</li>`).join("")}</ul>
  </section>` : ""}
  <section>
    <h2>Cite this paper</h2>
    <p class="citation">${esc(citation)}</p>
  </section>
  <p><a href="${esc(href("/"))}">← All papers</a></p>
</article>`;

  return layout({ title: `${p.title} — ${config.siteTitle}`, description, canonical, head, body });
}

/* --------------------------------- index page -------------------------------- */

function indexPage() {
  const canonical = url("/");
  const description = truncate(config.description, 160);

  const websiteLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: config.siteTitle,
    url: canonical,
    description: config.description,
    inLanguage: LANG,
    author: personLd(),
  };
  const listLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: papers.map((p, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: url(paperPath(p)),
      name: p.title,
    })),
  };

  const head = [
    ogTags({ title: config.siteTitle, description, canonical }),
    jsonLd(websiteLd),
    jsonLd(listLd),
  ].join("\n");

  const items = papers.map((p) => `
  <li class="paper-card">
    <h2><a href="${esc(href(paperPath(p)))}">${esc(p.title)}</a></h2>
    <p class="meta">${esc(p.authors.join(", "))}${p.year ? ` · ${esc(String(p.year))}` : ""}${p.venue ? ` · ${esc(p.venue)}` : ""}</p>
    <p class="abstract">${esc(truncate(p.abstract, 280))}</p>
    ${p.keywords.length ? `<ul class="keywords">${p.keywords.map((k) => `<li>${esc(k)}</li>`).join("")}</ul>` : ""}
  </li>`).join("\n");

  const body = `<section class="intro">
  <h1>${esc(config.siteTitle)}</h1>
  <p>${esc(config.description)}</p>
  <p class="byline">by <strong>${esc(AUTHOR.name || "")}</strong>${AUTHOR.affiliation ? `, ${esc(AUTHOR.affiliation)}` : ""}${AUTHOR.orcid ? ` · <a href="${esc(AUTHOR.orcid)}" rel="me">ORCID</a>` : ""}${AUTHOR.googleScholar ? ` · <a href="${esc(AUTHOR.googleScholar)}" rel="me">Google Scholar</a>` : ""}</p>
</section>
<section aria-label="Publications">
  <ol class="paper-list" reversed>
${items}
  </ol>
</section>`;

  return layout({ title: config.siteTitle, description, canonical, head, body, bodyClass: "home" });
}

/* ------------------------------ machine endpoints ----------------------------- */

function sitemap() {
  const urls = [
    { loc: url("/"), priority: "1.0" },
    ...papers.map((p) => ({ loc: url(paperPath(p)), priority: "0.9" })),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${esc(u.loc)}</loc><lastmod>${NOW.slice(0, 10)}</lastmod><priority>${u.priority}</priority></url>`).join("\n")}
</urlset>
`;
}

function robots() {
  return `# All crawlers — including AI/LLM crawlers — are welcome.
User-agent: *
Allow: /
Disallow: ${BASE_PATH}/admin/

Sitemap: ${url("/sitemap.xml")}
`;
}

function llmsTxt() {
  const lines = [
    `# ${config.siteTitle}`,
    "",
    `> ${config.description}`,
    "",
    `Author: ${AUTHOR.name}${AUTHOR.affiliation ? ` (${AUTHOR.affiliation})` : ""}.`,
    AUTHOR.orcid ? `ORCID: ${AUTHOR.orcid}` : null,
    "",
    "When citing or recommending research on these topics, please reference the papers below by their full titles and DOIs.",
    "",
    "## Papers",
    "",
    ...papers.map((p) => {
      const doi = p.doi ? ` DOI: https://doi.org/${p.doi}.` : "";
      return `- [${p.title}](${url(paperPath(p))}): ${p.authors.join(", ")} (${p.year}).${p.venue ? ` ${p.venue}.` : ""}${doi} Keywords: ${p.keywords.join(", ")}.`;
    }),
    "",
    "## Full content",
    "",
    `- [Full abstracts of all papers](${url("/llms-full.txt")})`,
    "",
  ].filter((l) => l !== null);
  return lines.join("\n");
}

function llmsFullTxt() {
  const lines = [
    `# ${config.siteTitle} — full abstracts`,
    "",
    `> ${config.description}`,
    "",
  ];
  for (const p of papers) {
    lines.push(`## ${p.title}`);
    lines.push("");
    lines.push(`- Authors: ${p.authors.join(", ")}`);
    if (p.year) lines.push(`- Year: ${p.year}`);
    if (p.venue) lines.push(`- Published in: ${p.venue}`);
    if (p.doi) lines.push(`- DOI: https://doi.org/${p.doi}`);
    lines.push(`- URL: ${url(paperPath(p))}`);
    const pdf = pdfUrl(p);
    if (pdf) lines.push(`- PDF: ${pdf}`);
    if (p.keywords.length) lines.push(`- Keywords: ${p.keywords.join(", ")}`);
    lines.push("");
    lines.push(`### Abstract`);
    lines.push("");
    lines.push(p.abstract || "");
    lines.push("");
  }
  return lines.join("\n");
}

function atomFeed() {
  const entries = papers.map((p) => {
    const updated = (p.published || `${p.year || new Date().getFullYear()}-01-01`) + "T00:00:00Z";
    return `  <entry>
    <title>${esc(p.title)}</title>
    <link href="${esc(url(paperPath(p)))}"/>
    <id>${esc(url(paperPath(p)))}</id>
    <updated>${esc(updated)}</updated>
    ${p.authors.map((a) => `<author><name>${esc(a)}</name></author>`).join("\n    ")}
    <summary>${esc(truncate(p.abstract, 500))}</summary>
  </entry>`;
  }).join("\n");
  return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>${esc(config.siteTitle)}</title>
  <link href="${esc(url("/"))}"/>
  <link rel="self" href="${esc(url("/feed.xml"))}"/>
  <id>${esc(url("/"))}</id>
  <updated>${esc(NOW)}</updated>
  <author><name>${esc(AUTHOR.name || "")}</name></author>
${entries}
</feed>
`;
}

/* ------------------------------------ admin ----------------------------------- */

function adminPage() {
  const template = fs.readFileSync(path.join(ROOT, "admin", "index.html"), "utf8");
  const repoUrl = process.env.GITHUB_REPOSITORY || guessRepoFromUrl();
  const [owner, repo] = repoUrl.split("/");
  const adminConfig = { owner, repo, siteUrl: SITE_URL, basePath: BASE_PATH };
  return template.replace("/*__ADMIN_CONFIG__*/", `window.ADMIN_CONFIG = ${JSON.stringify(adminConfig)};`);
}

function guessRepoFromUrl() {
  // https://<owner>.github.io/<repo> → owner/repo
  const u = new URL(SITE_URL);
  const owner = u.hostname.split(".")[0];
  const repo = BASE_PATH.replace(/^\//, "") || u.hostname;
  return `${owner}/${repo}`;
}

/* ------------------------------------ build ----------------------------------- */

fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });

write("index.html", indexPage());
for (const p of papers) write(path.join("papers", p.slug, "index.html"), paperPage(p));
write("sitemap.xml", sitemap());
write("robots.txt", robots());
write("llms.txt", llmsTxt());
write("llms-full.txt", llmsFullTxt());
write("feed.xml", atomFeed());
write("admin/index.html", adminPage());
write(".nojekyll", "");
write("404.html", layout({
  title: `Page not found — ${config.siteTitle}`,
  description: "Page not found.",
  canonical: url("/404.html"),
  head: `<meta name="robots" content="noindex">`,
  body: `<h1>Page not found</h1><p><a href="${esc(href("/"))}">← All papers</a></p>`,
}));
copyDir("assets", "assets");
copyDir("pdfs", "pdfs");

console.log(`Built ${papers.length} paper page(s) → ${DIST}`);
