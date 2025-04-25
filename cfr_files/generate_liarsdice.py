#!/usr/bin/env python3
import json
from itertools import product

def generate_liarsdice_json(num_dice=5, max_face=6):
    """
    Builds a game description for 'num_dice' per player, 1-bid Liar’s Dice.
    Outputs a dict suitable for dumping to JSON.
    """
    def make_obs_nodes(prefix):
        nodes = []
        prev = None
        for i in range(1, num_dice+1):
            node_id = f"obs_roll{i}_{prefix}"
            nodes.append({
                "id": node_id,
                "type": "observation",
                "signals": [str(f) for f in range(1, max_face+1)],
                "parent_edge": None if prev is None else [prev, "<signal>"]
            })
            prev = node_id
        return nodes, prev

    # Player 1
    dp1, last1 = make_obs_nodes("pl1")
    dp1.append({
        "id": "d1_pl1",
        "type": "decision",
        "actions": [f"bid{i}" for i in range(1, max_face+1)],
        "parent_edge": [last1, "<signal>"],
        "parent_sequence": None
    })

    # Player 2
    dp2, last2 = make_obs_nodes("pl2")
    dp2.append({
        "id": "obs_bid_pl2",
        "type": "observation",
        "signals": [f"bid{i}" for i in range(1, max_face+1)],
        "parent_edge": [last2, "<signal>"]
    })
    dp2.append({
        "id": "d1_pl2",
        "type": "decision",
        "actions": ["call", "accept"],
        "parent_edge": ["obs_bid_pl2", "<signal>"],
        "parent_sequence": None
    })

    utility_pl1 = []

    return {
        "decision_problem_pl1": dp1,
        "decision_problem_pl2": dp2,
        "utility_pl1": utility_pl1
    }

if __name__ == "__main__":
    game = generate_liarsdice_json(num_dice=5, max_face=6)
    with open("games/liarsdice_5die_1bid.json", "w") as f:
        json.dump(game, f, indent=2)
    print("Wrote games/liarsdice_5die_1bid.json")
