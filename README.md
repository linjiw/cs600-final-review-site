# CS600 Final Review — Interactive Study Site

A free, beginner-friendly interactive study site for the second half of a
graduate Theory of Computation course (lectures 9–11): self-reducibility,
logspace and NL, PSPACE & Savitch, NL = coNL, Boolean circuits and P/poly,
randomized complexity (RP / coRP / BPP / ZPP), and Karger's randomized
min-cut.

**Live site:** <https://linjiw.github.io/cs600-final-review-site/>

## What's inside

- 17 study sections plus a scored 8-question self-test (Section 16.5).
  Every study section has the same shape: friendly intro → everyday analogy
  → core idea → exam-ready template → worked example → graduated practice
  tiers → common pitfalls → quick quiz → reveal-style practice.
- Each section is tagged with one of three learning-path labels —
  **Start here**, **Exam-critical**, or **Come back later** — so you can
  plan your time. A legend appears in Section 00.
- Interactive widgets: PATH walkthrough, majority-circuit toy, RP→BPP
  amplification slider, Karger min-cut boost simulator, template picker.
- Six "master templates" (A–F) that map common exam-prompt phrasings to
  reusable proof skeletons.
- Flashcards, quizzes, and reveals all persist across reloads via
  `localStorage` (no analytics, no backend). Keys are content-hashed, so
  reordering or inserting items does not corrupt saved state. A "Reset all
  progress" button clears everything.

## Files

```
index.html    main page (loads styles.css, script.js, and KaTeX from CDN)
styles.css    visual styles
script.js     all interactivity — TOC, flashcards, quizzes, simulators,
              progress persistence, KaTeX auto-render
.github/workflows/pages.yml   GitHub Pages auto-deploy
```

This repo is fully self-contained: just `index.html`, `styles.css`,
`script.js`. Open `index.html` directly, or deploy the folder to any
static host.

## Deploying via GitHub Pages

The included workflow (`.github/workflows/pages.yml`) auto-deploys on
every push to `main`. To enable it once:

1. Push the repo to GitHub (public — Pages on Free requires a public repo).
2. Repository **Settings → Pages → Source: GitHub Actions**.
3. Push any commit (or use **Actions → Deploy site → Run workflow**).

All internal links are relative, so the site works correctly under the
`https://<user>.github.io/<repo>/` subpath.

## Math rendering

Math is rendered with [KaTeX 0.16.9](https://katex.org) loaded from
`cdn.jsdelivr.net`. If you need fully offline operation, download
`katex.min.css`, `katex.min.js`, and `auto-render.min.js` into a
local `katex/` folder and rewrite the three CDN tags in `index.html`.
A small banner appears at the top of the page if KaTeX fails to load.

## Scope and prerequisites

The site assumes graduate-level prerequisites (Turing machines, P/NP,
NP-completeness, reductions, decidability) and explicitly does **not**
re-teach lectures 1–8. See Section 0.5 inside the page for the full
prerequisite list and a quick self-check.

## License

The site code (HTML/CSS/JS) is released under the MIT License (see
`LICENSE`). The pedagogical content is the author's original wording
and may be re-used and adapted with attribution.
