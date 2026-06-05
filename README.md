# Liar's Dice CFR Lab

A publishable imperfect-information game-solving project built around a simplified one-claim Liar's Dice challenge game. The project separates the offline Python research engine from the public static website: Python generates rules metadata, trains a sampled CFR+ policy, runs benchmark simulations, and exports JSON artifacts that the browser can load directly.

## Public Story

This is not presented as a full traditional Liar's Dice solver. It is a compact research demo for:

- imperfect-information decisioning,
- self-play and regret minimization,
- action abstraction,
- equilibrium-style robustness,
- and the gap between robust play and opponent exploitation.

The canonical rules are in [rules.md](rules.md).

## Repository Layout

```text
.
├── liarsdice_ai/              # Offline Python research engine
├── tests/                     # Standard-library unit tests
├── artifacts/game.json        # Canonical game metadata export
├── site/                      # Static Vite + TypeScript website
├── site/public/data/          # Static website data exports
│   ├── policy.json            # Normalized policy artifact
│   └── metrics.json           # Benchmark metrics artifact
├── rules.md                   # Canonical simplified ruleset
├── pyproject.toml
└── requirements.txt
```

## Quick Start

The Python research path uses only the standard library.

```bash
python3 -m unittest discover -s tests -v
python3 -m liarsdice_ai.cli generate --out artifacts/game.json
python3 -m liarsdice_ai.cli train --iters 80000 --seed 370 --out site/public/data/policy.json
python3 -m liarsdice_ai.cli validate --policy site/public/data/policy.json
python3 -m liarsdice_ai.cli simulate --policy site/public/data/policy.json --matches 2000 --seed 370 --out site/public/data/metrics.json
```

## Static Site

The website is in `site/` and is designed for GitHub Pages. It loads the exported JSON artifacts directly from `site/public/data/`.

```bash
cd site
npm install
npm run dev
npm run build
npm run build:gh
```

Routes supported by the static app:

- `/` playable game demo.
- `/method` CFR and game-solving explanation.
- `/results` benchmark table and limitations.
- `/papers` curated document archive links.

## Paper Archive

The three DOCX course documents are exported as displayable PDFs and standalone LaTeX sources:

```bash
python3 scripts/build_paper_archive.py
```

Outputs:

- `docs/archive/final-report/`
- `docs/archive/applied-focus/`
- `docs/archive/research-notebook/`
- `site/public/paper-assets/`

Pandoc generates the LaTeX sources. PDFs are rendered from DOCX with the bundled LibreOffice binary because no local TeX engine is currently installed.

## Current Benchmark Snapshot

The checked-in `metrics.json` was generated with seed `370`, 2,000 matches per scenario, and five dice per player.

| Opponent profile | AI win rate |
| --- | ---: |
| Random claims, random responses | 54.05% |
| Random claims, skeptical responses | 39.55% |
| Random claims, threshold responses | 43.85% |
| Truth-biased claims, threshold responses | 43.75% |

These results are intentionally not framed as superhuman play. They show the key lesson from the original research project: equilibrium-style self-play can produce robust strategies, but simple off-distribution responder behavior can still exploit a policy that lacks richer opponent modeling.

## Website Architecture

The public site is static. It will load `policy.json` and `metrics.json` directly in the browser, so it can be hosted on GitHub Pages without a Python server. Python remains the offline engine for reproducible training and evaluation.

## Future Work

- Add the static Vite + TypeScript site.
- Convert the three course documents into a curated PDF and LaTeX archive.
- Add a traditional raise/call Liar's Dice variant after this simplified version is stable.
- Add richer opponent modeling and policy evaluation.
