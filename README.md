# Liar's Dice CFR Lab

AI/ML portfolio project by Mauricio Garcia Villanueva.

- Live demo: https://emgarviii.github.io/liars_dice/
- LinkedIn: https://www.linkedin.com/in/emgar/
- GitHub: https://github.com/emgarVIII

This project turns a supervised university research prototype into a public imperfect-information game-solving artifact. It combines an offline Python research engine, sampled CFR+ self-play, benchmark and best-response-style evaluation, a static TypeScript demo, the original research-paper archive, and conservative public paper editions.

## What It Shows

- Modeling hidden information through private dice and public claims.
- Training sampled CFR+ policies that condition on remaining dice counts and private dice.
- Exporting reproducible `policy.json` and `metrics.json` artifacts.
- Evaluating policies against fixed benchmark opponents and exact one-round best-response diagnostics.
- Explaining limitations honestly instead of claiming a solved Nash equilibrium.
- Shipping the demo as a static GitHub Pages site with no backend.

The main playable mode is a simplified one-claim challenge abstraction. The `/classic` route is a playable raise/challenge comparison using a heuristic AI, not a CFR-trained agent for the classic game.

## Current Results

The published policy was trained for 200,000 sampled CFR+ iterations. Its information-set key includes public remaining dice counts plus the player's private dice, so the policy can change as the match state changes.

| Opponent profile | AI win rate |
| --- | ---: |
| Random claims, random responses | 78.25% |
| Random claims, skeptical responses | 80.40% |
| Random claims, threshold responses | 74.90% |
| Truth-biased claims, threshold responses | 58.60% |

Important caveat: exact one-round best-response pressure is still high. The project should be read as a research engineering and evaluation artifact, not as proof of equilibrium play.

## Repository Layout

```text
.
├── liarsdice_ai/              # Offline Python research engine
├── tests/                     # Unit tests for rules, classic mode, training, evaluation
├── artifacts/game.json        # Canonical game metadata export
├── site/                      # Static Vite + TypeScript website
├── site/public/data/          # Policy and metrics artifacts loaded by the browser
├── docs/archive/              # Original research-paper PDFs and LaTeX exports
├── docs/polished/             # Conservative public paper editions and review notes
├── rules.md                   # Simplified and classic comparison rules
├── PORTFOLIO.md               # Resume bullets, LinkedIn draft, interview notes
└── pyproject.toml
```

## Quick Validation

The Python research path uses only the standard library.

```bash
python3 -m unittest discover -s tests -v
python3 -m liarsdice_ai.cli validate --policy site/public/data/policy.json
```

## Reproduce Artifacts

Generate game metadata, train a policy, validate it, and run portfolio-grade evaluation:

```bash
python3 -m liarsdice_ai.cli generate --out artifacts/game.json
python3 -m liarsdice_ai.cli train --iters 200000 --seed 370 --out site/public/data/policy.json
python3 -m liarsdice_ai.cli validate --policy site/public/data/policy.json
python3 -m liarsdice_ai.cli evaluate --policy site/public/data/policy.json --matches 2000 --seed 370 --convergence-matches 400 --convergence-iters 500,5000,20000,80000 --out site/public/data/metrics.json
```

The full training and evaluation pass is intentionally offline. It is heavier than the web app because it computes policy artifacts and diagnostic metrics before deployment.

## Static Site

```bash
cd site
npm install
npm run dev
npm run build:gh
```

Routes:

- `/`: playable simplified CFR challenge demo.
- `/classic`: playable classic raise/challenge comparison with heuristic AI.
- `/method`: method, vocabulary, and pipeline.
- `/results`: benchmark results, best-response diagnostic, and limitations.
- `/papers`: curated PDF and LaTeX archive.

## Paper Archive

The three university research documents are preserved as original research artifacts. They are the source of truth for the original research structure, math, figures, implementation details, and project trajectory. Conservative public editions are generated from the original DOCX files without rewriting the papers.

```bash
python3 scripts/build_paper_archive.py
python3 scripts/build_public_paper_editions.py
```

The polished final report and applied focus editions preserve the original text and improve formatting. The notebook edition removes disruptive blank-tab pages and cleans informal placeholders. The website, tests, and exported metrics are the source of truth for the current public portfolio version.

## Engineering Framing

This project is most relevant to AI/ML and quant/FinTech roles because it demonstrates:

- hidden-state decisioning,
- adversarial evaluation,
- probabilistic policies,
- reproducible offline experiments,
- static deployment of model artifacts,
- and honest measurement of model limitations.
