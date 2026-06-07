# Curated Paper Archive

This archive contains display-ready versions of the three research documents that supported the Liar's Dice CFR project.

These documents are preserved as original research artifacts. Conservative public editions live in `docs/polished` and are generated from the original DOCX files while preserving the original structure, math, figures, and formatting. The live website, README, tests, and exported metrics are the source of truth for the current public portfolio version and use more conservative wording around equilibrium claims.

## Public Ordering

1. `final-report`: primary project report.
2. `applied-focus`: supporting survey-style deliverable.
3. `research-notebook`: planning notes and research notebook.

## Build Command

```bash
python3 scripts/build_paper_archive.py
```

The script reads the DOCX sources from `~/Downloads` by default and writes:

- standalone LaTeX sources under `docs/archive/<slug>/`,
- PDFs under `docs/archive/<slug>/`,
- public website copies under `site/public/paper-assets/`,
- `index.json` metadata for the site and archive.

## Rendering Note

Pandoc is used for DOCX to LaTeX conversion. The current local environment does not include `xelatex`, `pdflatex`, `latexmk`, or `tectonic`, so PDFs are rendered from the DOCX files with the bundled LibreOffice binary. If a TeX engine is installed later, the LaTeX sources can be compiled directly as an additional verification step.
