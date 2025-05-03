#!/usr/bin/env python3
import random, json, argparse
from stub import RegretMatchingPlus

NUM_DICE, MAX_FACE = 5, 6

def all_claims():
    return [f"claim_{Q}_{F}"
            for Q in range(1, 2*NUM_DICE+1)
            for F in range(1, MAX_FACE+1)]

def mccfr_plus(iters):
    actions1 = all_claims()
    actions2 = ["accept","call"]

    # Regret tables & accumulators
    rm1, sum1 = {}, {}
    rm2, sum2 = {}, {}

    for t in range(1, iters+1):
        # Sample chance
        r1 = tuple(sorted(random.randint(1,MAX_FACE) for _ in range(NUM_DICE)))
        r2 = tuple(sorted(random.randint(1,MAX_FACE) for _ in range(NUM_DICE)))

        # P1 infoset
        if r1 not in rm1:
            rm1[r1]  = RegretMatchingPlus(actions1)
            sum1[r1] = {a:0.0 for a in actions1}
        strat1 = rm1[r1].next_strategy()
        for a,p in strat1.items(): sum1[r1][a] += p

        # Sample P1 action
        claim = random.choices(actions1, weights=[strat1[a] for a in actions1])[0]
        Q,F   = map(int, claim.split("_")[1:])

        # P2 infoset
        key2 = (r2, claim)
        if key2 not in rm2:
            rm2[key2]  = RegretMatchingPlus(actions2)
            sum2[key2] = {a:0.0 for a in actions2}
        strat2 = rm2[key2].next_strategy()
        for a,p in strat2.items(): sum2[key2][a] += p

        # Sample P2 response
        response = random.choices(actions2, weights=[strat2[a] for a in actions2])[0]

        # Payoff
        totalF = r1.count(F) + r2.count(F)
        payoff1 = 1 if totalF >= Q else -1

        # Update regrets
        util1 = {a: (1 if totalF >= int(a.split("_")[1]) else -1)
                 for a in actions1}
        rm1[r1].observe_utility(util1)

        util2 = {
          "accept": -(payoff1),
          "call":    payoff1
        }
        rm2[key2].observe_utility(util2)

        if t % (iters//10) == 0:
            print(f"MCCFR+ iter {t}/{iters}")

    # Extract average policy
    policy = {}
    for r1, dist in sum1.items():
        policy[str(r1)] = {a: dist[a]/iters for a in dist}
    for key2, dist in sum2.items():
        policy[str(key2)] = {a: dist[a]/iters for a in dist}

    return policy

if __name__=="__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--iters", type=int, default=500_000)
    p.add_argument("--out-policy", required=True)
    args = p.parse_args()

    pol = mccfr_plus(args.iters)
    with open(args.out_policy, "w") as f:
        json.dump(pol, f, indent=2)
    print("Wrote MCCFR+ policy to", args.out_policy)
