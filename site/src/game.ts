import type { Claim, PolicyData, ResponseAction, RoundLog } from "./types";

export function rollDice(count: number, maxFace = 6): number[] {
  return Array.from({ length: count }, () => Math.floor(Math.random() * maxFace) + 1).sort((a, b) => a - b);
}

export function handKey(hand: number[]): string {
  return [...hand].sort((a, b) => a - b).join(",");
}

export function parseClaim(key: string): Claim {
  const parts = key.split("_");
  if (parts.length !== 3 || parts[0] !== "claim") {
    throw new Error(`Invalid claim key: ${key}`);
  }
  return {
    quantity: Number(parts[1]),
    face: Number(parts[2]),
    key
  };
}

export function claimLabel(key: string): string {
  const claim = parseClaim(key);
  return `${claim.quantity} of face ${claim.face}`;
}

export function isFeasibleClaim(key: string, claimantDice: number, responderDice: number): boolean {
  return parseClaim(key).quantity <= claimantDice + responderDice;
}

export function normalizeDistribution(distribution: Record<string, number>): Record<string, number> {
  const entries = Object.entries(distribution).map(([key, value]) => [key, Math.max(0, Number(value))] as const);
  const total = entries.reduce((sum, [, value]) => sum + value, 0);
  if (total <= 0) {
    const uniform = 1 / Math.max(1, entries.length);
    return Object.fromEntries(entries.map(([key]) => [key, uniform]));
  }
  return Object.fromEntries(entries.map(([key, value]) => [key, value / total]));
}

export function weightedChoice(distribution: Record<string, number>): string {
  const normalized = normalizeDistribution(distribution);
  const threshold = Math.random();
  let cumulative = 0;
  let fallback = Object.keys(normalized)[0];
  for (const [key, probability] of Object.entries(normalized)) {
    cumulative += probability;
    fallback = key;
    if (threshold <= cumulative) {
      return key;
    }
  }
  return fallback;
}

export function topActions(distribution: Record<string, number>, limit = 5): Array<[string, number]> {
  return Object.entries(normalizeDistribution(distribution))
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
}

export function sampleAiClaim(policy: PolicyData, hand: number[], claimantDice: number, responderDice: number): string {
  const base = policy.claim_policy[handKey(hand)] ?? {};
  const feasible = Object.fromEntries(
    Object.entries(base).filter(([claim]) => isFeasibleClaim(claim, claimantDice, responderDice))
  );
  if (Object.keys(feasible).length > 0) {
    return weightedChoice(feasible);
  }
  const fallback = Object.fromEntries(
    policy.metadata.claim_actions
      .filter((claim) => isFeasibleClaim(claim, claimantDice, responderDice))
      .map((claim) => [claim, 1])
  );
  return weightedChoice(fallback);
}

export function sampleAiResponse(policy: PolicyData, hand: number[], claim: string): ResponseAction {
  const key = `${handKey(hand)}|${claim}`;
  const base = policy.response_policy[key] ?? { believe: 0.5, challenge: 0.5 };
  return weightedChoice(base) as ResponseAction;
}

export function resolveRound(
  round: number,
  claimant: "AI" | "You",
  aiDice: number[],
  userDice: number[],
  claimKey: string,
  response: ResponseAction
): RoundLog {
  const claim = parseClaim(claimKey);
  const totalFaceCount = [...aiDice, ...userDice].filter((die) => die === claim.face).length;
  const truth = totalFaceCount >= claim.quantity;
  const responderCorrect = (response === "believe" && truth) || (response === "challenge" && !truth);
  const loser = responderCorrect ? claimant : claimant === "AI" ? "You" : "AI";
  return {
    round,
    claimant,
    claim: claimKey,
    response,
    truth,
    loser,
    aiDice: [...aiDice],
    userDice: [...userDice]
  };
}
