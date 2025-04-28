#!/usr/bin/env python3
import json
import argparse
from stub import (
    Cfr,
    get_sequence_set,
    compute_utility_vector_pl1,
    compute_utility_vector_pl2,
    RegretMatchingPlus
)


def extract_nash_policy(game_path, out_policy_path, iterations=50000):
    # 1) load and normalize JSON sequences
    game = json.load(open(game_path))
    for tfsdp in (game["decision_problem_pl1"], game["decision_problem_pl2"]):
        for node in tfsdp:
            if isinstance(node.get("parent_edge"), list):
                node["parent_edge"] = tuple(node["parent_edge"])
            if "parent_sequence" in node and isinstance(node.get("parent_sequence"), list):
                node["parent_sequence"] = tuple(node["parent_sequence"])
    for entry in game["utility_pl1"]:
        entry["sequence_pl1"] = tuple(entry["sequence_pl1"])
        entry["sequence_pl2"] = tuple(entry["sequence_pl2"])

    # 2) instantiate CFR+ for both players
    cfr1 = Cfr(game["decision_problem_pl1"], rm_class=RegretMatchingPlus)
    cfr2 = Cfr(game["decision_problem_pl2"], rm_class=RegretMatchingPlus)
    seqs1 = get_sequence_set(game["decision_problem_pl1"])
    seqs2 = get_sequence_set(game["decision_problem_pl2"])

    # 3) accumulators for weighted-average strategies
    cum1 = {s: 0.0 for s in seqs1}
    cum2 = {s: 0.0 for s in seqs2}

    # 4) CFR+ self-play loop
    for t in range(1, iterations + 1):
        strat1 = cfr1.next_strategy()
        strat2 = cfr2.next_strategy()

        # accumulate with weight t for averaging
        for s in seqs1:
            cum1[s] += t * strat1[s]
        for s in seqs2:
            cum2[s] += t * strat2[s]

        # compute utility vectors against each other
        u1 = compute_utility_vector_pl1(game, strat2)
        u2 = compute_utility_vector_pl2(game, strat1)

        # update regrets
        cfr1.observe_utility(u1)
        cfr2.observe_utility(u2)

        # optional logging
        if t % (iterations // 10) == 0:
            print(f"CFR+ self-play iteration {t}/{iterations}")

    # 5) extract average P1 policy
    policy = {}
    for node in game["decision_problem_pl1"]:
        if node["type"] != "decision":
            continue
        I = node["id"]
        actions = node["actions"]
        weights = [cum1[(I, a)] for a in actions]
        total = sum(weights)
        if total > 0:
            policy[I] = {a: weights[i] / total for i, a in enumerate(actions)}
        else:
            policy[I] = {a: 1.0 / len(actions) for a in actions}

    # 6) write out
    with open(out_policy_path, "w") as f:
        json.dump(policy, f, indent=2)


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--game", required=True, help="path to JSON game file")
    p.add_argument(
        "--out-policy", required=True,
        help="where to write the P1 average policy JSON"
    )
    p.add_argument(
        "--iters", type=int, default=50000,
        help="number of CFR+ self-play iterations"
    )
    args = p.parse_args()
    extract_nash_policy(args.game, args.out_policy, args.iters)
    print(f"Wrote Nash-policy for P1 to {args.out_policy}")
