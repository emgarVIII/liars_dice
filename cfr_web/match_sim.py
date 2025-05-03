#!/usr/bin/env python3
import json, random, os

POLICY_PATH = os.path.join(
    os.path.dirname(__file__),
    "../policies/liarsdice_5die_mccfr_policy.json"
)
with open(POLICY_PATH) as f:
    policy = json.load(f)

# precompute all possible claims for fallback
ALL_CLAIMS = [f"claim_{Q}_{F}"
              for Q in range(1, 2*5+1)
              for F in range(1, 6+1)]

def sample_claim(hand, p1Count, p2Count):
    key = str(tuple(sorted(hand)))
    base = policy.get(key)
    total = p1Count + p2Count
    if base is None:
        # uniform over feasible if hand‐size differs
        feasible = [c for c in ALL_CLAIMS if int(c.split('_')[1]) <= total]
        return random.choice(feasible)
    # filter out Q>total
    filt = {a:p for a,p in base.items()
            if int(a.split('_')[1]) <= total}
    if not filt:
        filt = base
    actions, weights = zip(*filt.items())
    return random.choices(actions, weights)[0]

# different responder strategies
def responder_random50(hand, claim):
    return random.choice(["accept","call"])

def responder_call90(hand, claim):
    return "call" if random.random() < 0.9 else "accept"

def responder_threshold(hand, claim, threshold=3):
    # accept small bids, call large ones
    Q = int(claim.split('_')[1])
    return "call" if Q > threshold else "accept"

def play_one_match(responder_fn):
    p1Count, p2Count = 5, 5
    isP1Turn = True
    while p1Count > 0 and p2Count > 0:
        # roll
        r1 = [random.randint(1,6) for _ in range(p1Count)]
        r2 = [random.randint(1,6) for _ in range(p2Count)]

        # claimant and responder
        if isP1Turn:
            claim = sample_claim(r1, p1Count, p2Count)
            resp  = responder_fn(r2, claim)
        else:
            claim = sample_claim(r2, p1Count, p2Count)
            resp  = responder_fn(r1, claim)

        # evaluate
        Q = int(claim.split('_')[1])
        F = int(claim.split('_')[2])
        totalF = r1.count(F) + r2.count(F)

        # punish according to 4‐case table
        if resp == "accept" and totalF < Q:
            # accepted a lie → claimant loses
            if isP1Turn:  p1Count -= 1
            else:         p2Count -= 1
        elif resp == "call" and totalF >= Q:
            # called BS on truth → responder loses
            if isP1Turn:  p2Count -= 1
            else:         p1Count -= 1

        isP1Turn = not isP1Turn

    return 1 if p1Count > 0 else 2  # 1=AI wins, 2=opponent wins

if __name__ == "__main__":
    N = 10000
    benches = {
      "random50/50":   responder_random50,
      "call_90%":      responder_call90,
      "threshold_Q>3": lambda hand,claim: responder_threshold(hand,claim,3),
      "threshold_Q>4": lambda hand,claim: responder_threshold(hand,claim,4),
    }

    for name, fn in benches.items():
        wins = sum(1 for _ in range(N) if play_one_match(fn) == 1)
        print(f"AI vs {name:<12}: {wins/N:.2%} win rate")
