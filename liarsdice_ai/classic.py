from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable, Literal

from .rules import DEFAULT_MAX_FACE, Claim, count_face, parse_claim

ClassicLoser = Literal["bidder", "challenger"]


@dataclass(frozen=True)
class ClassicChallengeResult:
    bid: Claim
    truth: bool
    loser: ClassicLoser
    total_face_count: int


def is_legal_opening_bid(bid: Claim | str, total_dice: int, max_face: int = DEFAULT_MAX_FACE) -> bool:
    parsed = parse_claim(bid)
    return 1 <= parsed.quantity <= total_dice and 1 <= parsed.face <= max_face


def is_legal_raise(previous: Claim | str | None, bid: Claim | str, total_dice: int, max_face: int = DEFAULT_MAX_FACE) -> bool:
    parsed = parse_claim(bid)
    if not is_legal_opening_bid(parsed, total_dice, max_face):
        return False
    if previous is None:
        return True
    prior = parse_claim(previous)
    return parsed.quantity > prior.quantity or (parsed.quantity == prior.quantity and parsed.face > prior.face)


def legal_raises(previous: Claim | str | None, total_dice: int, max_face: int = DEFAULT_MAX_FACE) -> list[Claim]:
    return [
        Claim(quantity=quantity, face=face)
        for quantity in range(1, total_dice + 1)
        for face in range(1, max_face + 1)
        if is_legal_raise(previous, Claim(quantity=quantity, face=face), total_dice, max_face)
    ]


def resolve_challenge(
    bidder_hand: Iterable[int],
    challenger_hand: Iterable[int],
    bid: Claim | str,
) -> ClassicChallengeResult:
    parsed = parse_claim(bid)
    total = count_face(bidder_hand, challenger_hand, parsed.face)
    truth = total >= parsed.quantity
    return ClassicChallengeResult(
        bid=parsed,
        truth=truth,
        loser="challenger" if truth else "bidder",
        total_face_count=total,
    )
