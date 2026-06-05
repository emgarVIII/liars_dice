import unittest

from liarsdice_ai.rules import resolve_round


class RuleTests(unittest.TestCase):
    def test_true_claim_believe_makes_claimant_lose(self) -> None:
        result = resolve_round((1,), (1,), "claim_2_1", "believe")
        self.assertIs(result.truth, True)
        self.assertIs(result.responder_was_correct, True)
        self.assertEqual(result.loser, "claimant")
        self.assertEqual(result.claimant_payoff, -1)

    def test_true_claim_challenge_makes_responder_lose(self) -> None:
        result = resolve_round((1,), (1,), "claim_2_1", "challenge")
        self.assertIs(result.truth, True)
        self.assertIs(result.responder_was_correct, False)
        self.assertEqual(result.loser, "responder")
        self.assertEqual(result.claimant_payoff, 1)

    def test_false_claim_believe_makes_responder_lose(self) -> None:
        result = resolve_round((2,), (3,), "claim_2_1", "believe")
        self.assertIs(result.truth, False)
        self.assertIs(result.responder_was_correct, False)
        self.assertEqual(result.loser, "responder")
        self.assertEqual(result.claimant_payoff, 1)

    def test_false_claim_challenge_makes_claimant_lose(self) -> None:
        result = resolve_round((2,), (3,), "claim_2_1", "challenge")
        self.assertIs(result.truth, False)
        self.assertIs(result.responder_was_correct, True)
        self.assertEqual(result.loser, "claimant")
        self.assertEqual(result.claimant_payoff, -1)


if __name__ == "__main__":
    unittest.main()
