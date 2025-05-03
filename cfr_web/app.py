#!/usr/bin/env python3
from flask import Flask, request, jsonify, render_template
import json, random, os

app = Flask(__name__)

# Load your MCCFR+ policy file (must contain both P1 and P2 infosets)
POLICY_PATH = os.path.join(
    os.path.dirname(__file__),
    "../policies/liarsdice_5die_mccfr_policy.json"
)
with open(POLICY_PATH) as f:
    policy = json.load(f)

def normalize(dist):
    total = sum(dist.values())
    if total <= 0:
        # uniform fallback
        n = len(dist)
        return {k: 1/n for k in dist}
    return {k: v/total for k, v in dist.items()}

@app.route("/")
def home():
    return render_template("index.html")

@app.route("/action", methods=["POST"])
def action():
    data   = request.get_json()
    player = data.get("player")

    if player == "pl1":
        # AI is making a claim: filter bids by total dice
        hand    = data.get("hand", [])
        p1c     = int(data.get("p1Count", len(hand)))
        p2c     = int(data.get("p2Count", 0))
        total_dice = p1c + p2c

        key     = str(tuple(sorted(hand)))
        base    = policy.get(key, {})
        filtered = {}
        # Only keep claims with Q <= total_dice
        for action, prob in base.items():
            parts = action.split("_")
            if len(parts) == 3:
                Q = int(parts[1])
                if Q <= total_dice:
                    filtered[action] = prob

        dist = normalize(filtered) if filtered else normalize(base)
        actions, weights = zip(*dist.items())
        choice = random.choices(actions, weights)[0]

    else:
        # AI is responding to your claim
        hand   = data.get("hand", [])
        claim  = data.get("claim", "")
        key2   = str((tuple(sorted(hand)), claim))
        base2  = policy.get(key2, {})
        if not base2:
            base2 = {"accept":0.5, "call":0.5}
        dist = normalize(base2)
        actions, weights = zip(*dist.items())
        choice = random.choices(actions, weights)[0]

    return jsonify({"action": choice})

if __name__ == "__main__":
    app.run(debug=True)
