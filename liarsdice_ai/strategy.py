from __future__ import annotations

from dataclasses import dataclass, field
from random import Random
from typing import Mapping


def normalize_distribution(distribution: Mapping[str, float]) -> dict[str, float]:
    if not distribution:
        raise ValueError("Cannot normalize an empty distribution")
    total = sum(max(0.0, float(value)) for value in distribution.values())
    if total <= 0:
        uniform = 1.0 / len(distribution)
        return {action: uniform for action in distribution}
    return {action: max(0.0, float(value)) / total for action, value in distribution.items()}


def weighted_choice(distribution: Mapping[str, float], rng: Random) -> str:
    normalized = normalize_distribution(distribution)
    threshold = rng.random()
    cumulative = 0.0
    last_action = next(iter(normalized))
    for action, probability in normalized.items():
        cumulative += probability
        last_action = action
        if threshold <= cumulative:
            return action
    return last_action


@dataclass
class RegretMatcherPlus:
    actions: tuple[str, ...]
    regrets: dict[str, float] = field(init=False)
    cumulative_strategy: dict[str, float] = field(init=False)
    cumulative_weight: float = 0.0

    def __post_init__(self) -> None:
        if not self.actions:
            raise ValueError("RegretMatcherPlus requires at least one action")
        self.regrets = {action: 0.0 for action in self.actions}
        self.cumulative_strategy = {action: 0.0 for action in self.actions}

    def strategy(self) -> dict[str, float]:
        positive = {action: max(0.0, regret) for action, regret in self.regrets.items()}
        return normalize_distribution(positive)

    def observe(self, action_values: Mapping[str, float], weight: float = 1.0) -> None:
        current = self.strategy()
        expected_value = sum(current[action] * action_values[action] for action in self.actions)
        scale = max(0.0, float(weight))
        for action in self.actions:
            regret_delta = scale * (action_values[action] - expected_value)
            self.regrets[action] = max(0.0, self.regrets[action] + regret_delta)

    def add_average(self, strategy: Mapping[str, float], weight: float = 1.0) -> None:
        scale = max(0.0, float(weight))
        if scale <= 0:
            return
        self.cumulative_weight += scale
        for action in self.actions:
            self.cumulative_strategy[action] += scale * strategy[action]

    def average_strategy(self) -> dict[str, float]:
        if self.cumulative_weight <= 0:
            return normalize_distribution({action: 1.0 for action in self.actions})
        return normalize_distribution(self.cumulative_strategy)
