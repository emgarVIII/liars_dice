from __future__ import annotations

from dataclasses import dataclass
from random import Random
from typing import Any, Callable, Mapping

from .rules import DEFAULT_MAX_FACE, DEFAULT_NUM_DICE, Claim, Response, all_claim_keys, hand_key, is_claim_feasible, parse_claim, resolve_round, roll_hand
from .strategy import normalize_distribution, weighted_choice

Responder = Callable[[tuple[int, ...], str, Random], Response]
Claimant = Callable[[tuple[int, ...], int, int, Random], str]


@dataclass(frozen=True)
class SimulationConfig:
    matches: int = 2_000
    seed: int = 370
    starting_dice: int = DEFAULT_NUM_DICE
    max_face: int = DEFAULT_MAX_FACE


def feasible_claim_distribution(distribution: Mapping[str, float], claimant_dice: int, responder_dice: int) -> dict[str, float]:
    filtered = {
        claim: probability
        for claim, probability in distribution.items()
        if is_claim_feasible(claim, claimant_dice, responder_dice)
    }
    if filtered:
        return normalize_distribution(filtered)
    fallback = {
        claim: 1.0
        for claim in all_claim_keys(num_dice=max(claimant_dice, responder_dice), max_face=DEFAULT_MAX_FACE)
        if is_claim_feasible(claim, claimant_dice, responder_dice)
    }
    return normalize_distribution(fallback)


def sample_ai_claim(policy: Mapping[str, Any], hand: tuple[int, ...], claimant_dice: int, responder_dice: int, rng: Random) -> str:
    key = hand_key(hand)
    base = policy.get("claim_policy", {}).get(key)
    if not base:
        base = {
            claim: 1.0
            for claim in all_claim_keys(num_dice=max(claimant_dice, responder_dice), max_face=DEFAULT_MAX_FACE)
            if is_claim_feasible(claim, claimant_dice, responder_dice)
        }
    return weighted_choice(feasible_claim_distribution(base, claimant_dice, responder_dice), rng)


def sample_ai_response(policy: Mapping[str, Any], hand: tuple[int, ...], claim: str, rng: Random) -> Response:
    key = f"{hand_key(hand)}|{claim}"
    base = policy.get("response_policy", {}).get(key, {"believe": 0.5, "challenge": 0.5})
    return weighted_choice(base, rng)  # type: ignore[return-value]


def random_claim(hand: tuple[int, ...], claimant_dice: int, responder_dice: int, rng: Random) -> str:
    feasible = [
        claim
        for claim in all_claim_keys(num_dice=max(claimant_dice, responder_dice), max_face=DEFAULT_MAX_FACE)
        if is_claim_feasible(claim, claimant_dice, responder_dice)
    ]
    return rng.choice(feasible)


def truth_biased_claim(hand: tuple[int, ...], claimant_dice: int, responder_dice: int, rng: Random) -> str:
    face = rng.choice(hand) if hand else rng.randint(1, DEFAULT_MAX_FACE)
    private_count = hand.count(face)
    quantity = max(1, min(claimant_dice + responder_dice, private_count + rng.choice([0, 1])))
    return Claim(quantity=quantity, face=face).key()


def responder_random(hand: tuple[int, ...], claim: str, rng: Random) -> Response:
    return rng.choice(["believe", "challenge"])  # type: ignore[return-value]


def responder_skeptical(hand: tuple[int, ...], claim: str, rng: Random) -> Response:
    return "challenge" if rng.random() < 0.8 else "believe"


def responder_threshold(hand: tuple[int, ...], claim: str, rng: Random) -> Response:
    parsed = parse_claim(claim)
    return "challenge" if parsed.quantity > max(2, len(hand) // 2 + 1) else "believe"


def play_match(
    policy: Mapping[str, Any],
    opponent_claim: Claimant,
    opponent_response: Responder,
    rng: Random,
    starting_dice: int = DEFAULT_NUM_DICE,
    max_face: int = DEFAULT_MAX_FACE,
) -> int:
    ai_dice = starting_dice
    opponent_dice = starting_dice
    ai_claims = True

    while ai_dice > 0 and opponent_dice > 0:
        ai_hand = roll_hand(rng, ai_dice, max_face)
        opponent_hand = roll_hand(rng, opponent_dice, max_face)
        if ai_claims:
            claim = sample_ai_claim(policy, ai_hand, ai_dice, opponent_dice, rng)
            response = opponent_response(opponent_hand, claim, rng)
            result = resolve_round(ai_hand, opponent_hand, claim, response)
            if result.loser == "claimant":
                ai_dice -= 1
            else:
                opponent_dice -= 1
        else:
            claim = opponent_claim(opponent_hand, opponent_dice, ai_dice, rng)
            response = sample_ai_response(policy, ai_hand, claim, rng)
            result = resolve_round(opponent_hand, ai_hand, claim, response)
            if result.loser == "claimant":
                opponent_dice -= 1
            else:
                ai_dice -= 1
        ai_claims = not ai_claims

    return 1 if ai_dice > 0 else 0


def run_benchmarks(policy: Mapping[str, Any], config: SimulationConfig) -> dict[str, Any]:
    rng = Random(config.seed)
    scenarios: dict[str, tuple[Claimant, Responder]] = {
        "random_claim_random_response": (random_claim, responder_random),
        "random_claim_skeptical_response": (random_claim, responder_skeptical),
        "random_claim_threshold_response": (random_claim, responder_threshold),
        "truth_biased_claim_threshold_response": (truth_biased_claim, responder_threshold),
    }

    results: dict[str, Any] = {}
    for name, (claimant, responder) in scenarios.items():
        wins = 0
        for _ in range(config.matches):
            wins += play_match(
                policy,
                opponent_claim=claimant,
                opponent_response=responder,
                rng=rng,
                starting_dice=config.starting_dice,
                max_face=config.max_face,
            )
        results[name] = {
            "matches": config.matches,
            "ai_wins": wins,
            "ai_win_rate": wins / config.matches,
        }

    return {
        "metadata": {
            "seed": config.seed,
            "matches_per_scenario": config.matches,
            "starting_dice": config.starting_dice,
            "max_face": config.max_face,
        },
        "scenarios": results,
    }
