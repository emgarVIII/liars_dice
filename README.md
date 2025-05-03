# Liar’s Dice AI

An end-to-end pipeline for building, training, and deploying a one-turn Liar’s Dice AI using Counterfactual Regret Minimization (CFR/CFR⁺) and a Flask-based interactive front-end.

## Repository Structure
```
.
├── games/
│   └── liarsdice_5die_1bid.json       # Generated one-turn game description
├── policies/
│   └── liarsdice_5die_policy.json     # Trained one-turn equilibrium policy
├── cfr_files/
│   ├── generate_liarsdice.py          # Generates the game JSON
│   ├── cfr_train.py                   # Runs CFR (or CFR⁺) self-play to produce policy
│   ├── stub.py                        # Core CFR/CFR⁺ engine and helpers
│   └── match_sim.py                   # Simulates full multi-round matches for benchmarking
├── cfr_web/
│   ├── static/                        # Static assets
│   │   └── dice_man.jpg               # Example image used in UI
│   ├── templates/
│   │   └── index.html                 # Interactive browser UI
│   ├── app.py                         # Flask server exposing `/action` API
│   └── game_loop.py                   # Quick single-turn win-rate simulator
└── README.md                          # This file
```

## Component Overview

### 1. Game Generation (`generate_liarsdice.py`)
- **Purpose:** Build a JSON description of the one-turn Liar’s Dice game (5 dice per player, single bid).
- **Output:** `games/liarsdice_5die_1bid.json`, containing:
  - `decision_problem_pl1` & `decision_problem_pl2`: information-set nodes and actions
  - `utility_pl1`: terminal payoffs weighted by chance

### 2. CFR Engine (`stub.py`)
- **Key Features:**
  - `Cfr` class: regret tables, next_strategy(), observe_utility()
  - `RegretMatchingPlus`: CFR⁺ variant
  - Utility computation functions for P1/P2
  - Sequence set extractor

### 3. Training (`cfr_train.py`)
- **Purpose:** Run CFR or CFR⁺ self-play to approximate a one-turn Nash policy for Player 1.
- **Workflow:**
  1. Load and normalize game JSON
  2. Instantiate CFR engines
  3. Iterate: sample strategies, compute utility vectors vs. opponent, update regrets
  4. Average cumulative strategies → `policies/liarsdice_5die_policy.json`

### 4. Policy JSON (`policies/*.json`)
- **Content:** For each infoset ID, a dictionary mapping actions to probabilities.
- **Usage:** Loaded by the Flask app to sample AI actions.

### 5. Flask UI (`cfr_web/app.py` + `templates/index.html`)
- **`app.py`**: Serves `/action` POST endpoint:
  - **Player 1**: load policy, sample bid/claim based on `hand` and remaining dice counts
  - **Player 2**: by default random accept/call (can be extended)
- **`index.html`**: Interactive front-end that:
  1. Rolls dice each round
  2. Alternates claim turns between AI and user
  3. Lets non-claimant Accept or Call BS
  4. Resolves outcome using a 4-case rule
  5. Tracks dice counts until someone reaches zero

### 6. Simulation (`match_sim.py`)
- **Purpose:** Benchmark the one-turn policy over full multi-round matches.
- **Features:**
  - Fallback for unseen hand sizes (uniform claims)
  - Multiple responder strategies: random50/50, call 90%, threshold-based
  - Reports AI win rates over N matches.

## Getting Started

1. **Install dependencies**:
   ```bash
   pip install Flask gunicorn
   ```
2. **Generate game JSON**:
   ```bash
   python cfr_files/generate_liarsdice.py
   ```
3. **Train policy** (e.g., CFR⁺):
   ```bash
   python cfr_files/cfr_train.py --game games/liarsdice_5die_1bid.json \
     --out-policy policies/liarsdice_5die_policy.json --iters 50000
   ```
4. **Run Flask UI**:
   ```bash
   cd cfr_web
   python app.py
   ```
   Visit `http://127.0.0.1:5000/` in your browser.

5. **Benchmark match play**:
   ```bash
   python cfr_files/match_sim.py
   ```

---

Feel free to point your professor at this README for a quick overview of how each piece works together!

