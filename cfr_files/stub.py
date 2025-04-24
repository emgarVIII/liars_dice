#!/usr/bin/env python3

import os
import argparse
import json
import matplotlib.pyplot as plt

###############################################################################
# The next functions are already implemented for your convenience
#
# In all the functions in this stub file, `game` is the parsed input game json
# file, whereas `tfsdp` is either `game["decision_problem_pl1"]` or
# `game["decision_problem_pl2"]`.
#
# See the homework handout for a description of each field.
###############################################################################

def get_sequence_set(tfsdp):
    sequences = set()
    for node in tfsdp:
        if node["type"] == "decision":
            for action in node["actions"]:
                sequences.add((node["id"], action))
    return sequences

def is_valid_RSigma_vector(tfsdp, obj):
    sequence_set = get_sequence_set(tfsdp)
    return isinstance(obj, dict) and obj.keys() == sequence_set

def assert_is_valid_sf_strategy(tfsdp, obj):
    if not is_valid_RSigma_vector(tfsdp, obj):
        print("The sequence-form strategy should be a dictionary with key set equal to the set of sequences in the game")
        os.exit(1)
    for node in tfsdp:
        if node["type"] == "decision":
            parent_reach = 1.0
            if node["parent_sequence"] is not None:
                parent_reach = obj[node["parent_sequence"]]
            if abs(sum(obj[(node["id"], a)] for a in node["actions"]) - parent_reach) > 1e-3:
                print(f"At node ID {node['id']} the sum of the child sequences is not equal to the parent sequence")

def best_response_value(tfsdp, utility):
    assert is_valid_RSigma_vector(tfsdp, utility)
    utility_ = utility.copy()
    utility_[None] = 0.0
    for node in reversed(tfsdp):
        if node["type"] == "decision":
            ev = max(utility_[(node["id"], a)] for a in node["actions"])
            utility_[node["parent_sequence"]] += ev
    return utility_[None]

def compute_utility_vector_pl1(game, sf_strategy_pl2):
    assert_is_valid_sf_strategy(game["decision_problem_pl2"], sf_strategy_pl2)
    seqs = get_sequence_set(game["decision_problem_pl1"])
    utility = {s: 0.0 for s in seqs}
    for e in game["utility_pl1"]:
        utility[e["sequence_pl1"]] += e["value"] * sf_strategy_pl2[e["sequence_pl2"]]
    assert is_valid_RSigma_vector(game["decision_problem_pl1"], utility)
    return utility

def compute_utility_vector_pl2(game, sf_strategy_pl1):
    assert_is_valid_sf_strategy(game["decision_problem_pl1"], sf_strategy_pl1)
    seqs = get_sequence_set(game["decision_problem_pl2"])
    utility = {s: 0.0 for s in seqs}
    for e in game["utility_pl1"]:
        utility[e["sequence_pl2"]] -= e["value"] * sf_strategy_pl1[e["sequence_pl1"]]
    assert is_valid_RSigma_vector(game["decision_problem_pl2"], utility)
    return utility

def gap(game, sf1, sf2):
    assert_is_valid_sf_strategy(game["decision_problem_pl1"], sf1)
    assert_is_valid_sf_strategy(game["decision_problem_pl2"], sf2)
    u1 = compute_utility_vector_pl1(game, sf2)
    u2 = compute_utility_vector_pl2(game, sf1)
    return best_response_value(game["decision_problem_pl1"], u1) + best_response_value(game["decision_problem_pl2"], u2)

def compute_opponent_reach(tfsdp, opp_strat, target_id):
    node_map = {n["id"]: n for n in tfsdp}
    reach = 1.0
    node = node_map[target_id]
    while node["parent_edge"] is not None:
        pid, sig = node["parent_edge"]
        parent = node_map[pid]
        if parent["type"] == "observation":
            key = (pid, sig)
            if key in opp_strat:
                reach *= opp_strat[key]
        node = parent
    return reach

###############################################################################
# Fill in the implementations below
###############################################################################

def expected_utility_pl1(game, sf1, sf2):
    assert_is_valid_sf_strategy(game["decision_problem_pl1"], sf1)
    assert_is_valid_sf_strategy(game["decision_problem_pl2"], sf2)
    u = compute_utility_vector_pl1(game, sf2)
    return sum(sf1[s] * u[s] for s in sf1)

def uniform_sf_strategy(tfsdp):
    strat = {}
    for node in tfsdp:
        if node["type"] == "decision":
            parent_p = 1.0 if node["parent_sequence"] is None else strat[node["parent_sequence"]]
            n = len(node["actions"])
            for a in node["actions"]:
                strat[(node["id"], a)] = parent_p / n
    return strat

class RegretMatching:
    def __init__(self, actions):
        self.actions = list(actions)
        self.regrets = {a:0.0 for a in actions}
        self.last_strat = None
    def next_strategy(self):
        pos = {a:max(self.regrets[a],0.0) for a in self.actions}
        total = sum(pos.values())
        if total>0:
            strat = {a:pos[a]/total for a in self.actions}
        else:
            strat = {a:1.0/len(self.actions) for a in self.actions}
        self.last_strat = strat
        return strat
    def observe_utility(self, u):
        if self.last_strat is None:
            self.last_strat = {a:1.0/len(self.actions) for a in self.actions}
        ev = sum(self.last_strat[a]*u[a] for a in self.actions)
        for a in self.actions:
            self.regrets[a] += u[a] - ev

class RegretMatchingPlus(RegretMatching):
    def __init__(self, actions):
        super().__init__(actions)
    def observe_utility(self, u):
        if self.last_strat is None:
            self.last_strat = {a:1.0/len(self.actions) for a in self.actions}
        ev = sum(self.last_strat[a]*u[a] for a in self.actions)
        for a in self.actions:
            self.regrets[a] = max(0.0, self.regrets[a] + u[a] - ev)

class Cfr:
    def __init__(self, tfsdp, rm_class=RegretMatching):
        self.tfsdp = tfsdp
        self.local = {n["id"]: rm_class(n["actions"]) for n in tfsdp if n["type"]=="decision"}
    def next_strategy(self):
        strat = {}
        for n in self.tfsdp:
            if n["type"]!="decision": continue
            parent_p = 1.0 if n["parent_sequence"] is None else strat[n["parent_sequence"]]
            local = self.local[n["id"]].next_strategy()
            for a in n["actions"]:
                strat[(n["id"],a)] = parent_p*local[a]
        return strat
    def observe_utility(self, util):
        for n in self.tfsdp:
            if n["type"]!="decision": continue
            u_loc = {a:util[(n["id"],a)] for a in n["actions"]}
            self.local[n["id"]].observe_utility(u_loc)

def solve_problem_3_1(game):
    uniform2 = uniform_sf_strategy(game["decision_problem_pl2"])
    u = compute_utility_vector_pl1(game, uniform2)
    print("Exact best-response value:", best_response_value(game["decision_problem_pl1"], u))

def solve_problem_3_2(game):
    c1 = Cfr(game["decision_problem_pl1"], rm_class=RegretMatching)
    c2 = Cfr(game["decision_problem_pl2"], rm_class=RegretMatching)
    seq1 = get_sequence_set(game["decision_problem_pl1"])
    seq2 = get_sequence_set(game["decision_problem_pl2"])
    cum1 = {s:0.0 for s in seq1}
    cum2 = {s:0.0 for s in seq2}
    iters = 1000
    for t in range(1, iters+1):
        x = c1.next_strategy()
        y = c2.next_strategy()
        for s in seq1: cum1[s]+=x[s]
        for s in seq2: cum2[s]+=y[s]
        avg1 = {s:cum1[s]/t for s in seq1}
        avg2 = {s:cum2[s]/t for s in seq2}
        u1 = compute_utility_vector_pl1(game, y)
        u2 = compute_utility_vector_pl2(game, x)
        # P1 CFR update
        for n in game["decision_problem_pl1"]:
            if n["type"]!="decision": continue
            I=n["id"]
            local_u={a:u1[(I,a)] for a in n["actions"]}
            reach=compute_opponent_reach(game["decision_problem_pl1"], y, I)
            c1.local[I].observe_utility({a:reach*local_u[a] for a in local_u})
        # P2 CFR update
        for n in game["decision_problem_pl2"]:
            if n["type"]!="decision": continue
            J=n["id"]
            local_u={a:u2[(J,a)] for a in n["actions"]}
            reach=compute_opponent_reach(game["decision_problem_pl2"], x, J)
            c2.local[J].observe_utility({a:reach*local_u[a] for a in local_u})
    print("Final saddle point gap:", gap(game, avg1, avg2))
    print("Final expected utility for Player 1:", expected_utility_pl1(game, avg1, avg2))

def solve_problem_3_3(game):
    c1 = Cfr(game["decision_problem_pl1"], rm_class=RegretMatchingPlus)
    c2 = Cfr(game["decision_problem_pl2"], rm_class=RegretMatchingPlus)
    seq1 = get_sequence_set(game["decision_problem_pl1"])
    seq2 = get_sequence_set(game["decision_problem_pl2"])
    wc1 = {s:0.0 for s in seq1}
    wc2 = {s:0.0 for s in seq2}
    iters=5000
    x_cur = c1.next_strategy()
    for t in range(1, iters+1):
        y_cur = c2.next_strategy()
        for s in seq1: wc1[s]+=t*x_cur[s]
        for s in seq2: wc2[s]+=t*y_cur[s]
        total = t*(t+1)/2
        avg1 = {s:wc1[s]/total for s in seq1}
        avg2 = {s:wc2[s]/total for s in seq2}
        u1 = compute_utility_vector_pl1(game, y_cur)
        # CFR+ P1 update
        for n in game["decision_problem_pl1"]:
            if n["type"]!="decision": continue
            I=n["id"]
            local_u={a:u1[(I,a)] for a in n["actions"]}
            reach=compute_opponent_reach(game["decision_problem_pl1"], y_cur, I)
            c1.local[I].observe_utility({a:reach*local_u[a] for a in local_u})
        # CFR+ P2 update (uses next x)
        x_next = c1.next_strategy()
        u2 = compute_utility_vector_pl2(game, x_next)
        for n in game["decision_problem_pl2"]:
            if n["type"]!="decision": continue
            J=n["id"]
            local_u={a:u2[(J,a)] for a in n["actions"]}
            reach=compute_opponent_reach(game["decision_problem_pl2"], x_next, J)
            c2.local[J].observe_utility({a:reach*local_u[a] for a in local_u})
        x_cur = x_next

    # **finally** print the results
    print("Final saddle point gap (CFR+):", gap(game, avg1, avg2))
    print("Final expected utility for Player 1 (CFR+):", expected_utility_pl1(game, avg1, avg2))

if __name__ == "__main__":

    p = argparse.ArgumentParser(description="Problem 3 (CFR)")
    p.add_argument("--game",    required=True, help="Path to game file")
    p.add_argument("--problem", choices=["3.1","3.2","3.3"], required=True)
    args = p.parse_args()

    print(f"Reading game path {args.game}...")

    game = json.load(open(args.game))
    for tfsdp in (game["decision_problem_pl1"], game["decision_problem_pl2"]):
        for node in tfsdp:
            if isinstance(node.get("parent_edge"), list):
                node["parent_edge"] = tuple(node["parent_edge"])
            if "parent_sequence" in node and isinstance(node.get("parent_sequence"), list):
                node["parent_sequence"] = tuple(node["parent_sequence"])

        # tuplify every sequence_pl1 / sequence_pl2 in the utility list
    for entry in game["utility_pl1"]:
        entry["sequence_pl1"] = tuple(entry["sequence_pl1"])
        entry["sequence_pl2"] = tuple(entry["sequence_pl2"])

    # convert list→tuple for sequences/edges
    for tfsdp in (game["decision_problem_pl1"], game["decision_problem_pl2"]):
        for n in tfsdp:
            if isinstance(n.get("parent_edge"), list):
                n["parent_edge"] = tuple(n["parent_edge"])
            if "parent_sequence" in n and isinstance(n.get("parent_sequence"), list):
                n["parent_sequence"] = tuple(n["parent_sequence"])
    for e in game["utility_pl1"]:
        e["sequence_pl1"] = tuple(e["sequence_pl1"])
        e["sequence_pl2"] = tuple(e["sequence_pl2"])

    print(f"... done. Running code for Problem {args.problem}")
    if args.problem == "3.1":
        solve_problem_3_1(game)
    elif args.problem == "3.2":
        solve_problem_3_2(game)
    else:
        solve_problem_3_3(game)
