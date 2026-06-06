from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from itertools import product
from statistics import mean
from typing import Any, Mapping

from .rules import DEFAULT_MAX_FACE, DEFAULT_NUM_DICE, claim_info_key, hand_key, parse_claim, response_info_key
from .simulate import SimulationConfig, feasible_claim_distribution, run_benchmarks
from .strategy import normalize_distribution
from .train import TrainingConfig, train_policy


@dataclass(frozen=True)
class EvaluationConfig:
    matches: int = 2_000
    seed: int = 370
    num_dice: int = DEFAULT_NUM_DICE
    max_face: int = DEFAULT_MAX_FACE
    convergence_matches: int = 400
    convergence_checkpoints: tuple[int, ...] = (500, 2_000, 10_000, 80_000)


@lru_cache(maxsize=None)
def hand_probabilities(dice_count: int, max_face: int) -> tuple[tuple[tuple[int, ...], float], ...]:
    counts: dict[tuple[int, ...], int] = {}
    for roll in product(range(1, max_face + 1), repeat=dice_count):
        hand = tuple(sorted(roll))
        counts[hand] = counts.get(hand, 0) + 1
    total = max_face ** dice_count
    return tuple(sorted((hand, count / total) for hand, count in counts.items()))


def claim_distribution(
    policy: Mapping[str, Any],
    hand: tuple[int, ...],
    claimant_dice: int,
    responder_dice: int,
    max_face: int,
) -> dict[str, float]:
    claim_policy = policy.get("claim_policy", {})
    base = claim_policy.get(claim_info_key(claimant_dice, responder_dice, hand))
    if not base:
        base = claim_policy.get(hand_key(hand), {})
    return feasible_claim_distribution(base, claimant_dice, responder_dice)


def response_distribution(
    policy: Mapping[str, Any],
    hand: tuple[int, ...],
    claim: str,
    responder_dice: int,
    claimant_dice: int,
) -> dict[str, float]:
    response_policy = policy.get("response_policy", {})
    base = response_policy.get(response_info_key(responder_dice, claimant_dice, hand, claim))
    if not base:
        base = response_policy.get(f"{hand_key(hand)}|{claim}", {"believe": 0.5, "challenge": 0.5})
    return normalize_distribution(base)


def one_round_best_response(policy: Mapping[str, Any], num_dice: int = DEFAULT_NUM_DICE, max_face: int = DEFAULT_MAX_FACE) -> dict[str, Any]:
    hands = hand_probabilities(num_dice, max_face)
    hand_data = [
        (
            hand,
            probability,
            tuple(hand.count(face) for face in range(max_face + 1)),
        )
        for hand, probability in hands
    ]
    claim_actions = policy.get("metadata", {}).get("claim_actions", [])
    if not claim_actions:
        claim_actions = [f"claim_{quantity}_{face}" for quantity in range(1, 2 * num_dice + 1) for face in range(1, max_face + 1)]
    claim_action_set = set(claim_actions)
    parsed_claims = [(claim, parse_claim(claim).quantity, parse_claim(claim).face) for claim in claim_actions]

    claim_dists = {}
    for hand, _ in hands:
        distribution = {
            claim: probability
            for claim, probability in claim_distribution(policy, hand, num_dice, num_dice, max_face).items()
            if claim in claim_action_set
        }
        if not distribution:
            distribution = {claim: 1.0 for claim in claim_actions}
        claim_dists[hand] = normalize_distribution(distribution)

    observed_claim_weights = {
        claim: sum(probability * claim_dists[hand].get(claim, 0.0) for hand, probability in hands)
        for claim in claim_actions
    }
    claimant_value_vs_best_response = 0.0
    responder_accuracy = 0.0
    for claim, quantity, face in parsed_claims:
        observed_claim_weight = observed_claim_weights[claim]
        if observed_claim_weight <= 0:
            continue
        for _, responder_probability, responder_counts in hand_data:
            truth_weight = 0.0
            for claimant_hand, claimant_probability, claimant_counts in hand_data:
                claim_probability = claim_dists[claimant_hand].get(claim, 0.0)
                if claim_probability <= 0:
                    continue
                if claimant_counts[face] + responder_counts[face] >= quantity:
                    truth_weight += claimant_probability * claim_probability
            truth_probability = truth_weight / observed_claim_weight
            best_responder_claimant_payoff = min(1.0 - 2.0 * truth_probability, 2.0 * truth_probability - 1.0)
            best_responder_accuracy = max(truth_probability, 1.0 - truth_probability)
            claimant_value_vs_best_response += responder_probability * observed_claim_weight * best_responder_claimant_payoff
            responder_accuracy += responder_probability * observed_claim_weight * best_responder_accuracy

    best_claimant_value_vs_ai_response = 0.0
    best_claim_examples: dict[str, int] = {}
    response_dists = {
        (responder_hand, claim): response_distribution(policy, responder_hand, claim, num_dice, num_dice)
        for responder_hand, _ in hands
        for claim in claim_actions
    }
    for claimant_hand, claimant_probability, claimant_counts in hand_data:
        claim_values: dict[str, float] = {}
        for claim, quantity, face in parsed_claims:
            claim_value = 0.0
            for responder_hand, responder_probability, responder_counts in hand_data:
                distribution = response_dists[(responder_hand, claim)]
                truth = claimant_counts[face] + responder_counts[face] >= quantity
                believe_payoff = -1.0 if truth else 1.0
                challenge_payoff = 1.0 if truth else -1.0
                claim_value += responder_probability * (
                    distribution.get("believe", 0.0) * believe_payoff
                    + distribution.get("challenge", 0.0) * challenge_payoff
                )
            claim_values[claim] = claim_value
        best_claim = max(claim_values, key=claim_values.get)
        best_claim_examples[best_claim] = best_claim_examples.get(best_claim, 0) + 1
        best_claimant_value_vs_ai_response += claimant_probability * claim_values[best_claim]

    most_common_best_claims = sorted(best_claim_examples.items(), key=lambda item: (-item[1], item[0]))[:5]
    ai_responder_value_vs_best_claimant = -best_claimant_value_vs_ai_response
    best_response_pressure = max(0.0, -claimant_value_vs_best_response) + max(0.0, best_claimant_value_vs_ai_response)

    return {
        "scope": f"exact one-round public-count {num_dice}v{num_dice} abstraction",
        "ai_claimant_value_vs_bayes_best_responder": round(claimant_value_vs_best_response, 6),
        "best_responder_accuracy_vs_ai_claims": round(responder_accuracy, 6),
        "ai_responder_value_vs_best_claimant": round(ai_responder_value_vs_best_claimant, 6),
        "best_claimant_value_vs_ai_response": round(best_claimant_value_vs_ai_response, 6),
        "best_response_pressure": round(best_response_pressure, 6),
        "common_best_response_claims": [
            {"claim": claim, "private_hands": count}
            for claim, count in most_common_best_claims
        ],
        "interpretation": "Lower best-response pressure is better. This is stronger evidence than raw win rate, but it is still an abstraction-specific diagnostic, not a proof of Nash equilibrium.",
    }


def scenario_average_win_rate(scenarios: Mapping[str, Mapping[str, Any]]) -> float:
    return mean(float(result["ai_win_rate"]) for result in scenarios.values())


def policy_summary(policy: Mapping[str, Any], config: EvaluationConfig, name: str) -> dict[str, Any]:
    benchmarks = run_benchmarks(
        policy,
        SimulationConfig(
            matches=config.matches,
            seed=config.seed,
            starting_dice=config.num_dice,
            max_face=config.max_face,
        ),
    )
    exact = one_round_best_response(policy, config.num_dice, config.max_face)
    return {
        "name": name,
        "metadata": policy.get("metadata", {}),
        "average_benchmark_win_rate": round(scenario_average_win_rate(benchmarks["scenarios"]), 6),
        "scenarios": benchmarks["scenarios"],
        "one_round_best_response": exact,
    }


def convergence_report(config: EvaluationConfig) -> dict[str, Any]:
    checkpoints: list[dict[str, Any]] = []
    for iterations in config.convergence_checkpoints:
        policy = train_policy(
            TrainingConfig(
                iterations=iterations,
                seed=config.seed,
                num_dice=config.num_dice,
                max_face=config.max_face,
            )
        )
        benchmarks = run_benchmarks(
            policy,
            SimulationConfig(
                matches=config.convergence_matches,
                seed=config.seed,
                starting_dice=config.num_dice,
                max_face=config.max_face,
            ),
        )
        checkpoints.append(
            {
                "iterations": iterations,
                "average_benchmark_win_rate": round(scenario_average_win_rate(benchmarks["scenarios"]), 6),
                "scenario_win_rates": {
                    name: round(float(result["ai_win_rate"]), 6)
                    for name, result in benchmarks["scenarios"].items()
                },
            }
        )
    return {
        "matches_per_checkpoint": config.convergence_matches,
        "checkpoints": checkpoints,
        "interpretation": "Training checkpoints are deterministic snapshots for comparison, not a formal convergence proof.",
    }


def full_evaluation(
    policy: Mapping[str, Any],
    config: EvaluationConfig,
    baseline_policy: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    selected = policy_summary(policy, config, "selected")
    comparison: dict[str, Any] = {
        "selected": {
            "average_benchmark_win_rate": selected["average_benchmark_win_rate"],
            "best_response_pressure": selected["one_round_best_response"]["best_response_pressure"],
            "policy_iterations": selected["metadata"].get("iterations"),
            "key_schema": selected["metadata"].get("key_schema", "legacy_private_hand_only"),
        }
    }
    if baseline_policy is not None:
        baseline = policy_summary(baseline_policy, config, "baseline")
        comparison["baseline"] = {
            "average_benchmark_win_rate": baseline["average_benchmark_win_rate"],
            "best_response_pressure": baseline["one_round_best_response"]["best_response_pressure"],
            "policy_iterations": baseline["metadata"].get("iterations"),
            "key_schema": baseline["metadata"].get("key_schema", "legacy_private_hand_only"),
        }
        comparison["delta"] = {
            "average_benchmark_win_rate": round(
                comparison["selected"]["average_benchmark_win_rate"] - comparison["baseline"]["average_benchmark_win_rate"],
                6,
            ),
            "best_response_pressure": round(
                comparison["selected"]["best_response_pressure"] - comparison["baseline"]["best_response_pressure"],
                6,
            ),
        }

    return {
        "metadata": {
            "seed": config.seed,
            "matches_per_scenario": config.matches,
            "starting_dice": config.num_dice,
            "max_face": config.max_face,
            "evaluation": "portfolio_evaluation_v1",
            "policy_version": selected["metadata"].get("key_schema", "legacy_private_hand_only"),
            "policy_iterations": selected["metadata"].get("iterations"),
        },
        "scenarios": selected["scenarios"],
        "evaluation": {
            "one_round_best_response": selected["one_round_best_response"],
        },
        "convergence": convergence_report(config),
        "comparison": comparison,
    }
