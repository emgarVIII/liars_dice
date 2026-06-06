# Liar's Dice CFR Lab Rules

This repository contains two related games:

1. A simplified one-claim challenge abstraction used by the CFR-style research pipeline.
2. A playable classic raise/challenge comparison mode used for education and scope clarity.

Only the simplified one-claim challenge abstraction is tied to the exported CFR-style policy.

## Simplified CFR Challenge Game

### Setup

- Two players each roll private dice.
- The default match starts with five six-sided dice per player.
- A player sees only their own dice.
- A claim has the form `claim_Q_F`, meaning: "Across both players' dice, at least `Q` dice show face `F`."

Example: `claim_3_5` means "there are at least three fives total."

### Round Flow

1. The claimant makes one quantity-face claim.
2. The responder chooses one response:
   - `believe`: predict that the claim is true.
   - `challenge`: predict that the claim is false.
3. All dice are revealed.
4. If the responder predicted correctly, the claimant loses one die.
5. If the responder predicted incorrectly, the responder loses one die.

This creates a compact binary hidden-information decision problem. The claimant wants to make claims that are hard to classify, while the responder wants to infer whether the claim is true using only their private dice and the public claim.

### Policy Scope

The current public policy is count-aware:

- Claim information set: claimant dice count, responder dice count, claimant private hand.
- Response information set: responder dice count, claimant dice count, responder private hand, public claim.

The policy is trained offline with sampled CFR+ style regret matching and exported to `site/public/data/policy.json`.

## Classic Raise/Challenge Comparison

The `/classic` route demonstrates the familiar raise loop:

1. A player opens with any legal quantity-face bid.
2. The next player must either raise or challenge.
3. A raise is legal if it has a higher quantity, or the same quantity with a higher face.
4. A challenge reveals all dice.
5. If the current bid is true, the challenger loses one die.
6. If the current bid is false, the bidder loses one die.

The classic mode uses a heuristic AI. It is included so viewers can compare the research abstraction against normal Liar's Dice. It is not presented as a solved CFR classic Liar's Dice agent.

## Why The Simplification Exists

Traditional Liar's Dice includes repeated raising, turn order effects, and richer strategic pressure. The simplified challenge game intentionally removes those elements so the project can focus on:

- imperfect information,
- public and private state representation,
- self-play strategy learning,
- benchmark and best-response-style evaluation,
- and the difference between stronger benchmark play and robust equilibrium-style play.

## Future Extension

A stronger future version could add:

- a CFR solver for the classic raise/challenge game,
- explicit exploitability minimization during training,
- larger best-response evaluation,
- opponent modeling for non-equilibrium human behavior,
- and live subgame-style search for selected game states.
