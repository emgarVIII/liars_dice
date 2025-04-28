#!/usr/bin/env python3
import json
import os
from itertools import product

def pr_max(k, num_dice, max_face):
    """
    Probability that the maximum of `num_dice` independent uniform 1..max_face rolls equals k.
    P(max = k) = P(all ≤ k) − P(all ≤ k−1).
    """
    if k == 1:
        return (1/max_face)**num_dice
    return (k/max_face)**num_dice - ((k-1)/max_face)**num_dice


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
                "signals": [str(face) for face in range(1, max_face+1)],
                "parent_edge": None if prev is None else [prev, "<signal>"]
            })
            prev = node_id
        return nodes

    # Player 1 decision problem: observe each of your 5 rolls, then bid
    dp1 = make_obs_nodes("pl1")
    last_obs1 = f"obs_roll{num_dice}_pl1"
    for k in range(1, max_face+1):
        dp1.append({
            "id": f"d1_pl1_{k}",
            "type": "decision",
            "actions": [f"bid{face}" for face in range(1, max_face+1)],
            "parent_edge": [last_obs1, "<signal>"],
            "parent_sequence": None
        })

    # Player 2 decision problem: observe each of your 5 rolls, observe P1's bid, then call/accept
    dp2 = make_obs_nodes("pl2")
    last_obs2 = f"obs_roll{num_dice}_pl2"
    dp2.append({
        "id": "obs_bid_pl2",
        "type": "observation",
        "signals": [f"bid{face}" for face in range(1, max_face+1)],
        "parent_edge": [last_obs2, "<signal>"]
    })
    dp2.append({
        "id": "d1_pl2",
        "type": "decision",
        "actions": ["call", "accept"],
        "parent_edge": ["obs_bid_pl2", "<signal>"],
        "parent_sequence": None
    })

    # Utility entries for Player 1: sum over all chance outcomes
    utility_pl1 = []
    # Precompute marginal probabilities for each maximum roll
    prob_max = {r: pr_max(r, num_dice, max_face) for r in range(1, max_face+1)}
    for r1, r2 in product(range(1, max_face+1), repeat=2):
        p_chance = prob_max[r1] * prob_max[r2]
        for bid in range(1, max_face+1):
            # P1's sequence depends on the observed max r1
            seq1 = [f"d1_pl1_{r1}", f"bid{bid}"]
            for response in ["accept", "call"]:
                seq2 = ["d1_pl2", response]
                # payoff for P1:
                if response == "accept":
                    payoff = 1 if r1 >= bid else -1
                else:
                    payoff = 1 if r1 < bid else -1
                utility_pl1.append({
                    "sequence_pl1": seq1,
                    "sequence_pl2": seq2,
                    "value": payoff * p_chance
                })
    return {
        "decision_problem_pl1": dp1,
        "decision_problem_pl2": dp2,
        "utility_pl1": utility_pl1
    }

if __name__ == "__main__":
    # Ensure output directory exists
    os.makedirs("games", exist_ok=True)
    game = generate_liarsdice_json(num_dice=5, max_face=6)
    with open("games/liarsdice_5die_1bid.json", "w") as f:
        json.dump(game, f, indent=2)
    print("Wrote games/liarsdice_5die_1bid.json")
