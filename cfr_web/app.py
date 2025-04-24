# app.py
from flask import Flask, request, jsonify
import json, random, os

app = Flask(__name__)

# load _only_ your P1 policy:
POLICY_PATH = os.path.join(
    os.path.dirname(__file__),
    "../policies/liarsdice_br_policy.json"
)
with open(POLICY_PATH) as f:
    policy_pl1 = json.load(f)


@app.route("/action", methods=["POST"])
def action():
    data = request.get_json()
    player  = data["player"]  # "pl1" or "pl2"
    roll    = data["roll"]
    history = data["history"]

    # build the infoset key (for this tiny game it's always "d1_pl1" or "d1_pl2")
    if player == "pl1":
        infoset = "d1_pl1"
        dist    = policy_pl1[infoset]
        actions, weights = zip(*dist.items())
        choice = random.choices(actions, weights)[0]
    else:
        # pl2 is random
        # in your extended version pl2 may have bids + call/accept;
        # if you only have call/accept:
        #choice = random.choice(["call","accept"])
        choice = random.choices(["call", "accept"], weights=[0.8, 0.2])[0]

    return jsonify({"action": choice})


if __name__ == "__main__":
    app.run(debug=True)
