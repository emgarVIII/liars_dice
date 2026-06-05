import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

from liarsdice_ai.cli import read_json, simulate, train, validate
from liarsdice_ai.simulate import SimulationConfig, run_benchmarks
from liarsdice_ai.strategy import normalize_distribution
from liarsdice_ai.train import TrainingConfig, train_policy


class TrainingAndSimulationTests(unittest.TestCase):
    def test_training_exports_normalized_sections(self) -> None:
        policy = train_policy(TrainingConfig(iterations=250, seed=7, num_dice=2, max_face=3))
        self.assertTrue(policy["claim_policy"])
        self.assertTrue(policy["response_policy"])
        for section in ("claim_policy", "response_policy"):
            for distribution in policy[section].values():
                normalized = normalize_distribution(distribution)
                self.assertLess(abs(sum(normalized.values()) - 1.0), 1e-9)

    def test_simulation_is_deterministic_for_same_seed(self) -> None:
        policy = train_policy(TrainingConfig(iterations=250, seed=7, num_dice=2, max_face=3))
        first = run_benchmarks(policy, SimulationConfig(matches=25, seed=11, starting_dice=2, max_face=3))
        second = run_benchmarks(policy, SimulationConfig(matches=25, seed=11, starting_dice=2, max_face=3))
        self.assertEqual(first, second)

    def test_cli_train_simulate_validate_roundtrip(self) -> None:
        with TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            policy_path = tmp_path / "policy.json"
            metrics_path = tmp_path / "metrics.json"

            class TrainArgs:
                out = str(policy_path)
                iters = 250
                seed = 7
                num_dice = 2
                max_face = 3

            class SimArgs:
                policy = str(policy_path)
                out = str(metrics_path)
                matches = 25
                seed = 11
                num_dice = 2
                max_face = 3

            class ValidateArgs:
                policy = str(policy_path)

            train(TrainArgs())
            simulate(SimArgs())
            validate(ValidateArgs())

            metrics = read_json(metrics_path)
            self.assertEqual(metrics["metadata"]["matches_per_scenario"], 25)
            self.assertIn("random_claim_random_response", metrics["scenarios"])


if __name__ == "__main__":
    unittest.main()
