from __future__ import annotations

from dataclasses import dataclass
from random import Random
from typing import Iterable, Literal

Response = Literal["believe", "challenge"]
PlayerSide = Literal["claimant", "responder"]

DEFAULT_NUM_DICE = 5
DEFAULT_MAX_FACE = 6
RESPONSES: tuple[Response, Response] = ("believe", "challenge")


@dataclass(frozen=True, order=True)
class Claim:
    quantity: int
    face: int

    def key(self) -> str:
        return f"claim_{self.quantity}_{self.face}"


@dataclass(frozen=True)
class RoundResult:
    claim: Claim
    truth: bool
    response: Response
    responder_was_correct: bool
    loser: PlayerSide
    claimant_payoff: int


def normalize_hand(hand: Iterable[int]) -> tuple[int, ...]:
    return tuple(sorted(int(face) for face in hand))


def hand_key(hand: Iterable[int]) -> str:
    return ",".join(str(face) for face in normalize_hand(hand))


def parse_hand_key(key: str) -> tuple[int, ...]:
    if not key:
        return ()
    return normalize_hand(int(part) for part in key.split(","))


def parse_claim(value: str | Claim) -> Claim:
    if isinstance(value, Claim):
        return value
    parts = value.split("_")
    if len(parts) != 3 or parts[0] != "claim":
        raise ValueError(f"Invalid claim key: {value!r}")
    return Claim(quantity=int(parts[1]), face=int(parts[2]))


def all_claims(num_dice: int = DEFAULT_NUM_DICE, max_face: int = DEFAULT_MAX_FACE) -> list[Claim]:
    total_dice = 2 * num_dice
    return [Claim(quantity=q, face=f) for q in range(1, total_dice + 1) for f in range(1, max_face + 1)]


def all_claim_keys(num_dice: int = DEFAULT_NUM_DICE, max_face: int = DEFAULT_MAX_FACE) -> list[str]:
    return [claim.key() for claim in all_claims(num_dice=num_dice, max_face=max_face)]


def roll_hand(rng: Random, dice_count: int, max_face: int = DEFAULT_MAX_FACE) -> tuple[int, ...]:
    return normalize_hand(rng.randint(1, max_face) for _ in range(dice_count))


def is_claim_feasible(claim: Claim | str, claimant_dice: int, responder_dice: int) -> bool:
    parsed = parse_claim(claim)
    return 1 <= parsed.quantity <= claimant_dice + responder_dice


def count_face(claimant_hand: Iterable[int], responder_hand: Iterable[int], face: int) -> int:
    return sum(1 for die in claimant_hand if die == face) + sum(1 for die in responder_hand if die == face)


def is_claim_true(claimant_hand: Iterable[int], responder_hand: Iterable[int], claim: Claim | str) -> bool:
    parsed = parse_claim(claim)
    return count_face(claimant_hand, responder_hand, parsed.face) >= parsed.quantity


def responder_prediction_is_correct(truth: bool, response: Response) -> bool:
    if response not in RESPONSES:
        raise ValueError(f"Invalid response: {response!r}")
    return (response == "believe" and truth) or (response == "challenge" and not truth)


def resolve_round(
    claimant_hand: Iterable[int],
    responder_hand: Iterable[int],
    claim: Claim | str,
    response: Response,
) -> RoundResult:
    parsed = parse_claim(claim)
    truth = is_claim_true(claimant_hand, responder_hand, parsed)
    correct = responder_prediction_is_correct(truth, response)
    loser: PlayerSide = "claimant" if correct else "responder"
    claimant_payoff = -1 if loser == "claimant" else 1
    return RoundResult(
        claim=parsed,
        truth=truth,
        response=response,
        responder_was_correct=correct,
        loser=loser,
        claimant_payoff=claimant_payoff,
    )


def valid_hand(hand: Iterable[int], dice_count: int, max_face: int = DEFAULT_MAX_FACE) -> bool:
    normalized = normalize_hand(hand)
    return len(normalized) == dice_count and all(1 <= face <= max_face for face in normalized)
