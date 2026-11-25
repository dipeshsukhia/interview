# Interview Guide

A static interview preparation site with technology-based question collections covering backend development, databases, GenAI, AI agents, document processing, cloud infrastructure, security, and engineering practice. Each question has its own page, and Markdown code examples include a copy button.

The question and answer content lives in `knowledge-base/`, one Markdown file per technology. The original workbook is kept locally and ignored by Git; the site does not need it to build.

## Local development

```bash
npm ci
npm run dev
```

Open `http://localhost:3000/interview/`.

## Production build

```bash
npm run build
```

Next.js exports the static site to `docs/`, configured for `https://dipeshsukhia.github.io/interview/`. The GitHub Actions workflow builds and publishes `docs/` to GitHub Pages whenever a commit is pushed to `main`.
