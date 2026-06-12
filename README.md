# 3D Reconstruction Research Papers — site

A zero-dependency static site that lists research papers and is heavily optimized
for **search engines** (Google, Bing, Google Scholar) and **LLM crawlers**
(ClaudeBot, GPTBot, PerplexityBot, …).

**Live site:** https://mitkor2.github.io/3DReconstructionPapers
**Admin panel:** https://mitkor2.github.io/3DReconstructionPapers/admin/

## How it works

```
data/papers/*.json   →  scripts/build.js  →  dist/  →  GitHub Pages
        ▲
        └── the /admin/ panel commits these files via the GitHub API
```

- Every paper gets its own page at `/papers/<slug>/` with:
  - **Google Scholar (Highwire Press) meta tags** — `citation_title`, `citation_author`, `citation_pdf_url`, `citation_doi`, …
  - **schema.org `ScholarlyArticle` JSON-LD** structured data
  - Dublin Core, Open Graph and Twitter Card tags, canonical URL
- Site-wide machine-readable endpoints: `sitemap.xml`, `robots.txt`,
  **`llms.txt` and `llms-full.txt`** (full abstracts for LLM ingestion), and an Atom `feed.xml`.
- 100% static HTML — no JavaScript needed to read content, so every crawler sees everything.

## One-time setup

1. **Make `main` the default branch** (if it isn't already) — the deploy workflow runs on pushes to `main`.
2. **Enable GitHub Pages**: repo → *Settings* → *Pages* → under **Source**, choose **GitHub Actions**.
3. **Create your admin "password"** — a GitHub fine-grained personal access token:
   - Go to [github.com/settings/personal-access-tokens/new](https://github.com/settings/personal-access-tokens/new)
   - Repository access: *Only select repositories* → this repo
   - Permissions: **Contents → Read and write**
   - Set a long expiration. This token is what you type into `/admin/` to sign in.
4. **Edit `site.config.json`** — fill in your affiliation, ORCID iD and Google Scholar
   profile URL. These are embedded in the structured data and strongly help
   search engines connect the papers to you.
5. Push to `main` (or run the *Build and deploy* workflow manually) — the site goes live.
6. Open `/admin/`, sign in with the token, **delete the example paper** and add your real ones.

## Adding papers

Use the admin panel (recommended), or commit a JSON file to `data/papers/` directly:

```json
{
  "slug": "my-paper-2024",
  "title": "Paper title",
  "authors": ["Dimitar Rangelov", "Co Author"],
  "year": 2024,
  "published": "2024-05-17",
  "venue": "Sensors 24(3)",
  "doi": "10.3390/sXXXXXXX",
  "url": "https://www.mdpi.com/...",
  "pdf": "pdfs/my-paper-2024.pdf",
  "keywords": ["3D reconstruction", "photogrammetry"],
  "abstract": "Full abstract text…"
}
```

PDFs go in `pdfs/` (the admin panel uploads them there for you). Only upload PDFs
you have the right to share (preprints/author versions are usually fine — check the
journal's self-archiving policy on [Sherpa Romeo](https://v2.sherpa.ac.uk/romeo/)).

## Local preview

```bash
npm run serve   # builds and serves dist/ locally
```

## Maximizing reach (beyond this site)

The site does the on-page work, but indexing is also about signals pointing at it:

- **Google Search Console**: add the site and submit `sitemap.xml` — fastest way to get indexed.
  (Note: on a `*.github.io/<repo>` project site, `robots.txt` sits below the domain root so
  crawlers ignore it — that's fine, since we want everything crawled and the admin page
  carries its own `noindex` tag. Submitting the sitemap in Search Console replaces it.)
- **Custom domain (optional but recommended)**: a domain like `rangelov-research.com`
  ranks better, puts `robots.txt`/`llms.txt` at the domain root where crawlers expect them,
  and survives any future move off GitHub Pages. Set it in repo *Settings → Pages*, then
  update `siteUrl` in `site.config.json`.
- **Bing Webmaster Tools**: same; Bing also feeds ChatGPT browsing.
- **Google Scholar profile**: make sure each paper is in your profile; Scholar will pick up
  the `citation_*` tags from these pages too.
- **ORCID**: list all papers on your ORCID record and link it in `site.config.json`.
- Link to this site from your **university page, LinkedIn, ResearchGate, GitHub profile** —
  inbound links are still the #1 ranking signal, for LLMs' search tools as well.
