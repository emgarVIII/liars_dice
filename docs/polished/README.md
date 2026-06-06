# Polished Public Paper Editions

This directory contains cleaned public editions of the original university course documents in `docs/archive`.

The goal is not to erase the original work. The archive keeps the course submissions intact, while these public editions improve structure, formatting, readability, and claim discipline for portfolio use.

## Build Command

```bash
python3 scripts/build_polished_papers.py
```

The script reads Markdown sources under `docs/polished/<slug>/source.md` and writes:

- `docs/polished/<slug>/<slug>.docx`
- `docs/polished/<slug>/<slug>.pdf`
- `docs/polished/<slug>/<slug>.tex`
- public website copies under `site/public/paper-assets/polished/`

The PDFs are rendered from DOCX with LibreOffice. The LaTeX sources are generated with Pandoc.
