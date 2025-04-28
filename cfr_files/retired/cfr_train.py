#!/usr/bin/env python3
import json, argparse
from stub import Cfr, get_sequence_set, uniform_sf_strategy, compute_utility_vector_pl1

def extract_average_policy(game_path, out_policy_path, iterations=2000):
    # 1) load
    game = json.load(open(game_path))

    # 2) *** MUST convert all list‐sequences into tuples, exactly like stub.py ***
    for tfsdp in (game["decision_problem_pl1"], game["decision_problem_pl2"]):
        for node in tfsdp:
            if isinstance(node.get("parent_edge"), list):
                node["parent_edge"] = tuple(node["parent_edge"])
            if "parent_sequence" in node and isinstance(node.get("parent_sequence"), list):
                node["parent_sequence"] = tuple(node["parent_sequence"])
    for entry in game["utility_pl1"]:
        entry["sequence_pl1"] = tuple(entry["sequence_pl1"])
        entry["sequence_pl2"] = tuple(entry["sequence_pl2"])

    # 3) instantiate CFR & accumulators
    cfr = Cfr(game["decision_problem_pl1"])
    seqs = get_sequence_set(game["decision_problem_pl1"])
    cum_strat = {s: 0.0 for s in seqs}

    # 4) fixed opponent = uniform over P2’s infosets
    #y_uniform = uniform_sf_strategy(game["decision_problem_pl2"])
    y_random = uniform_sf_strategy(game["decision_problem_pl2"])
    y_random[("d1_pl2", "call")] = 0.5
    y_random[("d1_pl2", "accept")] = 0.5

    # 5) self‐play vs uniform for best‐response training
    for t in range(1, iterations+1):
        x = cfr.next_strategy()
        # accumulate
        for s in seqs:
            cum_strat[s] += x[s]
        # compute P1’s utility vector *against* the uniform opponent
        # compute P1’s utility vector *against* the uniform opponent
        u = compute_utility_vector_pl1(game, y_random)
        # feed back into CFR
        cfr.observe_utility(u)

    # 6) extract average policy (normalize at each infoset)
    policy = {}
    for node in game["decision_problem_pl1"]:
        if node["type"] != "decision":
            continue
        I = node["id"]
        actions = node["actions"]
        probs = [cum_strat[(I,a)] for a in actions]
        total = sum(probs)
        if total > 0:
            policy[I] = {a: probs[i] / total for i, a in enumerate(actions)}
        else:
            policy[I] = {a: 1.0/len(actions) for a in actions}

    # 7) dump to disk
    with open(out_policy_path, "w") as f:
        json.dump(policy, f, indent=2)

if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--game",       required=True)
    p.add_argument("--out-policy", required=True)
    p.add_argument("--iters",      type=int, default=2000)
    args = p.parse_args()
    extract_average_policy(args.game, args.out_policy, args.iters)
    print("Wrote policy to", args.out_policy)
