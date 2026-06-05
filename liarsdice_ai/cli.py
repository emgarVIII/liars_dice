from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

from .rules import DEFAULT_MAX_FACE, DEFAULT_NUM_DICE, all_claim_keys
from .simulate import SimulationConfig, run_benchmarks
from .strategy import normalize_distribution
from .train import TrainingConfig, train_policy


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def generate_game(args: argparse.Namespace) -> None:
    payload = {
        "game": "simplified_one_claim_liars_dice",
        "rules_version": "2026-06-05",
        "num_dice": args.num_dice,
        "max_face": args.max_face,
        "responses": ["believe", "challenge"],
        "claim_actions": all_claim_keys(num_dice=args.num_dice, max_face=args.max_face),
        "description": "A claimant makes one quantity-face claim. The responder predicts true or false. Correct responder predictions make the claimant lose one die.",
    }
    write_json(Path(args.out), payload)


def train(args: argparse.Namespace) -> None:
    policy = train_policy(
        TrainingConfig(
            iterations=args.iters,
            seed=args.seed,
            num_dice=args.num_dice,
            max_face=args.max_face,
        )
    )
    write_json(Path(args.out), policy)


def simulate(args: argparse.Namespace) -> None:
    policy = read_json(Path(args.policy))
    metrics = run_benchmarks(
        policy,
        SimulationConfig(
            matches=args.matches,
            seed=args.seed,
            starting_dice=args.num_dice,
            max_face=args.max_face,
        ),
    )
    write_json(Path(args.out), metrics)


def validate(args: argparse.Namespace) -> None:
    policy = read_json(Path(args.policy))
    failures: list[str] = []
    for section in ("claim_policy", "response_policy"):
        values = policy.get(section, {})
        if not values:
            failures.append(f"{section} is empty")
            continue
        for info_set, distribution in values.items():
            try:
                normalized = normalize_distribution(distribution)
            except ValueError as exc:
                failures.append(f"{section}:{info_set}: {exc}")
                continue
            total = sum(normalized.values())
            if abs(total - 1.0) > 1e-9:
                failures.append(f"{section}:{info_set}: normalized total is {total}")
    if failures:
        raise SystemExit("\n".join(failures))
    print("Policy validation passed")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Simplified Liar's Dice research CLI")
    sub = parser.add_subparsers(required=True)

    generate_cmd = sub.add_parser("generate", help="Write the canonical game metadata JSON")
    generate_cmd.add_argument("--out", default="artifacts/game.json")
    generate_cmd.add_argument("--num-dice", type=int, default=DEFAULT_NUM_DICE)
    generate_cmd.add_argument("--max-face", type=int, default=DEFAULT_MAX_FACE)
    generate_cmd.set_defaults(func=generate_game)

    train_cmd = sub.add_parser("train", help="Train and export a sampled CFR+ policy")
    train_cmd.add_argument("--out", default="site/public/data/policy.json")
    train_cmd.add_argument("--iters", type=int, default=80_000)
    train_cmd.add_argument("--seed", type=int, default=370)
    train_cmd.add_argument("--num-dice", type=int, default=DEFAULT_NUM_DICE)
    train_cmd.add_argument("--max-face", type=int, default=DEFAULT_MAX_FACE)
    train_cmd.set_defaults(func=train)

    simulate_cmd = sub.add_parser("simulate", help="Run deterministic benchmark simulations")
    simulate_cmd.add_argument("--policy", default="site/public/data/policy.json")
    simulate_cmd.add_argument("--out", default="site/public/data/metrics.json")
    simulate_cmd.add_argument("--matches", type=int, default=2_000)
    simulate_cmd.add_argument("--seed", type=int, default=370)
    simulate_cmd.add_argument("--num-dice", type=int, default=DEFAULT_NUM_DICE)
    simulate_cmd.add_argument("--max-face", type=int, default=DEFAULT_MAX_FACE)
    simulate_cmd.set_defaults(func=simulate)

    validate_cmd = sub.add_parser("validate", help="Validate exported policy distributions")
    validate_cmd.add_argument("--policy", default="site/public/data/policy.json")
    validate_cmd.set_defaults(func=validate)
    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
