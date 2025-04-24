#!/usr/bin/env python3
import requests, random

API = "http://127.0.0.1:5000/action"

def query(player, roll, history):
    """Ask the Flask server for an action."""
    r = requests.post(API, json={
        "player": player,
        "roll":   roll,
        "history": history
    })
    r.raise_for_status()
    return r.json()["action"]

def play_one():
    # each player rolls a die
    r1 = random.randint(1,6)
    r2 = random.randint(1,6)
    hist = []
    # 1) P1 bids
    a1 = query("pl1", r1, hist)
    hist.append(("pl1", a1))
    # 2) P2 either calls or accepts
    a2 = query("pl2", r2, hist)
    hist.append(("pl2", a2))
    # 3) resolve payoff:
    #    - “accept” means P1’s claim stands: P1 wins if their roll ≥ bid
    #    - “call” means P2 doubts: P1 wins if their roll < bid
    lvl = int(a1.replace("bid",""))
    if a2 == "accept":
        return 1 if r1 >= lvl else -1
    else:  # call
        return 1 if r1 < lvl else -1

if __name__=="__main__":
    N = 10_000
    wins = 0
    for i in range(1, N+1):
        if play_one() == 1:
            wins += 1
        if i % 1000 == 0:
            print(f"After {i} games, win rate = {wins/i:.3f}")
    print(f"Final P1 win rate over {N} games: {wins/N:.3f}")

