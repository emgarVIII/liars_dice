import unittest

from liarsdice_ai.classic import is_legal_raise, legal_raises, resolve_challenge
from liarsdice_ai.rules import Claim


class ClassicRuleTests(unittest.TestCase):
    def test_opening_bid_must_fit_total_dice(self) -> None:
        self.assertTrue(is_legal_raise(None, "claim_1_6", total_dice=4))
        self.assertFalse(is_legal_raise(None, "claim_5_6", total_dice=4))

    def test_raise_requires_higher_quantity_or_face(self) -> None:
        previous = Claim(quantity=2, face=3)
        self.assertTrue(is_legal_raise(previous, "claim_2_4", total_dice=6))
        self.assertTrue(is_legal_raise(previous, "claim_3_1", total_dice=6))
        self.assertFalse(is_legal_raise(previous, "claim_2_2", total_dice=6))

    def test_legal_raises_exclude_lower_bids(self) -> None:
        raises = [bid.key() for bid in legal_raises("claim_2_3", total_dice=4)]
        self.assertIn("claim_2_4", raises)
        self.assertIn("claim_3_1", raises)
        self.assertNotIn("claim_2_2", raises)

    def test_true_bid_makes_challenger_lose(self) -> None:
        result = resolve_challenge((2, 2), (2, 5), "claim_3_2")
        self.assertTrue(result.truth)
        self.assertEqual(result.total_face_count, 3)
        self.assertEqual(result.loser, "challenger")

    def test_false_bid_makes_bidder_lose(self) -> None:
        result = resolve_challenge((4, 4), (1, 2), "claim_3_4")
        self.assertFalse(result.truth)
        self.assertEqual(result.total_face_count, 2)
        self.assertEqual(result.loser, "bidder")


if __name__ == "__main__":
    unittest.main()
