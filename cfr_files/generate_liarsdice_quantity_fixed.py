#!/usr/bin/env python3
import json
import os
from itertools import product

def generate_quantity_face_game(num_dice=5, max_face=6):
    """
    One-turn Quantity/Face Liar’s Dice, conditioned on P1's observed hand.
    P1 observes its dice and chooses one claim (Q,F), then P2 responds.
    """
    # Build P1’s observation nodes
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

    # P1 decision problem
    dp1 = make_obs_nodes("pl1")
    last_obs1 = dp1[-1]["id"]
    actions1 = [f"claim_{Q}_{F}"
                for Q in range(1, 2*num_dice+1)
                for F in range(1, max_face+1)]
    dp1.append({
        "id": "d1_pl1",
        "type": "decision",
        "actions": actions1,
        "parent_edge": [last_obs1, "<signal>"],
        "parent_sequence": None
    })

    # P2 decision problem
    dp2 = make_obs_nodes("pl2")
    last_obs2 = dp2[-1]["id"]
    dp2.append({
        "id": "obs_claim_pl2",
        "type": "observation",
        "signals": actions1,
        "parent_edge": [last_obs2, "<signal>"]
    })
    dp2.append({
        "id": "d1_pl2",
        "type": "decision",
        "actions": ["accept", "call"],
        "parent_edge": ["obs_claim_pl2", "<signal>"],
        "parent_sequence": None
    })

    # Build utilities: loop over every pair of 5-dice hands
    utility_pl1 = []
    p_hand = (1/max_face)**num_dice
    for r1s in product(range(1, max_face+1), repeat=num_dice):
        obs_seq1 = [(f"obs_roll{i+1}_pl1", str(r1s[i])) for i in range(num_dice)]
        for r2s in product(range(1, max_face+1), repeat=num_dice):
            p_chance = p_hand * p_hand
            # count face occurrences directly
            for Q in range(1, 2*num_dice+1):
                for F in range(1, max_face+1):
                    total_F = r1s.count(F) + r2s.count(F)
                    # payoff +1 if total_F>=Q, else -1
                    payoff = 1 if total_F >= Q else -1
                    action = f"claim_{Q}_{F}"
                    # P1’s sequence
                    seq1 = obs_seq1 + [("d1_pl1", action)]
                    # P2’s sequence for Accept
                    seq2_accept = [(f"obs_roll{i+1}_pl2", str(r2s[i])) for i in range(num_dice)]
                    seq2_accept += [("obs_claim_pl2", action), ("d1_pl2", "accept")]
                    utility_pl1.append({
                        "sequence_pl1": seq1,
                        "sequence_pl2": seq2_accept,
                        "value": payoff * p_chance
                    })
                    # P2’s sequence for Call flips the payoff
                    seq2_call = seq2_accept[:-1] + [("d1_pl2", "call")]
                    utility_pl1.append({
                        "sequence_pl1": seq1,
                        "sequence_pl2": seq2_call,
                        "value": -payoff * p_chance
                    })

    return {
        "decision_problem_pl1": dp1,
        "decision_problem_pl2": dp2,
        "utility_pl1": utility_pl1
    }

if __name__ == "__main__":
    os.makedirs("games", exist_ok=True)
    game = generate_quantity_face_game()
    with open("games/liarsdice_5die_quantity.json", "w") as f:
        json.dump(game, f, indent=2)
    print("Wrote games/liarsdice_5die_quantity.json")
