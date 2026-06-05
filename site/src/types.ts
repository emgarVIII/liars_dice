export type ResponseAction = "believe" | "challenge";

export interface PolicyData {
  metadata: {
    game: string;
    algorithm: string;
    iterations: number;
    seed: number;
    num_dice: number;
    max_face: number;
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
  };
  scenarios: Record<
    string,
    {
      matches: number;
      ai_wins: number;
      ai_win_rate: number;
    }
  >;
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
