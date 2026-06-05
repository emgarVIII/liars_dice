from __future__ import annotations

from dataclasses import dataclass
from random import Random
from typing import Any

from .rules import DEFAULT_MAX_FACE, DEFAULT_NUM_DICE, RESPONSES, all_claim_keys, hand_key, resolve_round, roll_hand
from .strategy import RegretMatcherPlus


@dataclass(frozen=True)
class TrainingConfig:
    iterations: int = 80_000
    seed: int = 370
    num_dice: int = DEFAULT_NUM_DICE
    max_face: int = DEFAULT_MAX_FACE


def train_policy(config: TrainingConfig) -> dict[str, Any]:
    rng = Random(config.seed)
    claim_actions = tuple(all_claim_keys(num_dice=config.num_dice, max_face=config.max_face))
    response_actions = tuple(RESPONSES)
    claim_matchers: dict[str, RegretMatcherPlus] = {}
    response_matchers: dict[str, RegretMatcherPlus] = {}

    for _ in range(config.iterations):
        claimant_hand = roll_hand(rng, config.num_dice, config.max_face)
        responder_hand = roll_hand(rng, config.num_dice, config.max_face)
        claimant_key = hand_key(claimant_hand)
        responder_key = hand_key(responder_hand)

        claim_matcher = claim_matchers.setdefault(claimant_key, RegretMatcherPlus(claim_actions))
        claim_strategy = claim_matcher.strategy()
        claim_matcher.add_average(claim_strategy)

        claim_values: dict[str, float] = {}
        for claim in claim_actions:
            response_key = f"{responder_key}|{claim}"
            response_matcher = response_matchers.setdefault(response_key, RegretMatcherPlus(response_actions))
            response_strategy = response_matcher.strategy()
            response_matcher.add_average(response_strategy, weight=claim_strategy[claim])

            response_values_for_claimant = {
                response: resolve_round(claimant_hand, responder_hand, claim, response).claimant_payoff
                for response in response_actions
            }
            claim_values[claim] = sum(
                response_strategy[response] * response_values_for_claimant[response]
                for response in response_actions
            )

            response_values_for_responder = {
                response: -response_values_for_claimant[response]
                for response in response_actions
            }
            response_matcher.observe(response_values_for_responder, weight=claim_strategy[claim])

        claim_matcher.observe(claim_values)

    return {
        "metadata": {
            "game": "simplified_one_claim_liars_dice",
            "algorithm": "sampled_cfr_plus",
            "iterations": config.iterations,
            "seed": config.seed,
            "num_dice": config.num_dice,
            "max_face": config.max_face,
            "responses": list(response_actions),
            "claim_actions": list(claim_actions),
        },
        "claim_policy": {
            key: matcher.average_strategy()
            for key, matcher in sorted(claim_matchers.items())
        },
        "response_policy": {
            key: matcher.average_strategy()
            for key, matcher in sorted(response_matchers.items())
        },
    }
