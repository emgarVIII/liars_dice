# Simplified Liar's Dice Challenge Rules

This repository uses a one-claim challenge version of Liar's Dice for the first public release. The goal is to make imperfect information, self-play, and exploitability easy to inspect without the larger game tree of traditional raise-based Liar's Dice.

## Game Setup

- Two players each roll private dice.
- In the default configuration, each player starts with five six-sided dice.
- A player sees only their own dice.
- A claim has the form `claim_Q_F`, meaning: "Across both players' hidden dice, at least `Q` dice show face `F`."

Example: `claim_3_5` means "there are at least three fives total."

## One-Claim Challenge Round

1. The claimant makes one quantity-face claim.
2. The responder chooses one response:
   - `believe`: predict that the claim is true.
   - `challenge`: predict that the claim is false.
3. All dice are revealed.
4. If the responder predicted correctly, the claimant loses one die.
5. If the responder predicted incorrectly, the responder loses one die.

This creates a binary hidden-information decisioning problem: the claimant wants to make claims that are hard to classify, while the responder wants to infer whether the claim is true from their own private dice and the claim itself.

## Why This Simplification

Traditional Liar's Dice includes repeated raising, turn order effects, and richer strategic pressure. This first version intentionally removes those elements so the project can focus on:

- imperfect information,
- action abstraction,
- self-play strategy learning,
- equilibrium-style robustness,
- and the difference between robust play and opponent exploitation.

## Future Extension

A later version can add traditional raise/call dynamics:

- legal raises over the previous claim,
- multiple claim turns,
- challenge only after a sequence of bids,
- and larger subgame resolving or search over live game states.
