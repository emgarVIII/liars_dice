export type ResponseAction = "believe" | "challenge";

export interface PolicyData {
  metadata: {
    game: string;
    algorithm: string;
    iterations: number;
    seed: number;
    num_dice: number;
    max_face: number;
    key_schema?: string;
    compaction?: {
      min_probability: number;
      method: string;
    };
    responses: ResponseAction[];
    claim_actions: string[];
  };
  claim_policy: Record<string, Record<string, number>>;
  response_policy: Record<string, Record<ResponseAction, number>>;
}

export interface MetricsData {
  metadata: {
    seed: number;
    matches_per_scenario: number;
    starting_dice: number;
    max_face: number;
    evaluation?: string;
    policy_version?: string;
    policy_iterations?: number;
  };
  scenarios: Record<
    string,
    {
      label?: string;
      opponent?: string;
      meaning?: string;
      matches: number;
      ai_wins: number;
      ai_win_rate: number;
    }
  >;
  evaluation?: {
    one_round_best_response: {
      scope: string;
      ai_claimant_value_vs_bayes_best_responder: number;
      best_responder_accuracy_vs_ai_claims: number;
      ai_responder_value_vs_best_claimant: number;
      best_claimant_value_vs_ai_response: number;
      best_response_pressure: number;
      interpretation: string;
      common_best_response_claims: Array<{
        claim: string;
        private_hands: number;
      }>;
    };
  };
  convergence?: {
    matches_per_checkpoint: number;
    checkpoints: Array<{
      iterations: number;
      average_benchmark_win_rate: number;
      scenario_win_rates: Record<string, number>;
    }>;
    interpretation: string;
  };
  comparison?: {
    selected: PolicyComparison;
    baseline?: PolicyComparison;
    delta?: {
      average_benchmark_win_rate: number;
      best_response_pressure: number;
    };
  };
}

export interface PolicyComparison {
  average_benchmark_win_rate: number;
  best_response_pressure: number;
  key_schema: string;
  policy_iterations: number;
}

export interface Claim {
  quantity: number;
  face: number;
  key: string;
}

export interface RoundLog {
  round: number;
  claimant: "AI" | "You";
  claim: string;
  response: ResponseAction;
  truth: boolean;
  loser: "AI" | "You";
  aiDice: number[];
  userDice: number[];
}
