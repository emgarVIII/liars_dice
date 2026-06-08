import "./styles.css";
import {
  claimLabel,
  isFeasibleClaim,
  parseClaim,
  resolveRound,
  rollDice,
  sampleAiClaim,
  sampleAiResponse
} from "./game";
import type { MetricsData, PolicyData, ResponseAction, RoundLog } from "./types";

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("Missing app root");
}

const appRoot = app;

interface GameState {
  policy: PolicyData | null;
  metrics: MetricsData | null;
  route: string;
  round: number;
  aiDiceCount: number;
  userDiceCount: number;
  aiHand: number[];
  userHand: number[];
  aiClaims: boolean;
  currentClaim: string | null;
  lastLog: RoundLog | null;
  history: RoundLog[];
  selectedQuantity: number;
  selectedFace: number;
  classicRound: number;
  classicAiDiceCount: number;
  classicUserDiceCount: number;
  classicAiHand: number[];
  classicUserHand: number[];
  classicCurrentBid: string | null;
  classicBidder: "AI" | "You" | null;
  classicUserTurn: boolean;
  classicLastLog: ClassicRoundLog | null;
  classicHistory: ClassicRoundLog[];
  classicSelectedQuantity: number;
  classicSelectedFace: number;
  loadingError: string | null;
}

interface ClassicRoundLog {
  round: number;
  bid: string;
  bidder: "AI" | "You";
  challenger: "AI" | "You";
  truth: boolean;
  totalFaceCount: number;
  loser: "AI" | "You";
  aiDice: number[];
  userDice: number[];
}

const baseUrl = import.meta.env.BASE_URL;

const state: GameState = {
  policy: null,
  metrics: null,
  route: normalizeRoute(window.location.pathname),
  round: 1,
  aiDiceCount: 5,
  userDiceCount: 5,
  aiHand: [],
  userHand: [],
  aiClaims: true,
  currentClaim: null,
  lastLog: null,
  history: [],
  selectedQuantity: 1,
  selectedFace: 1,
  classicRound: 1,
  classicAiDiceCount: 5,
  classicUserDiceCount: 5,
  classicAiHand: [],
  classicUserHand: [],
  classicCurrentBid: null,
  classicBidder: null,
  classicUserTurn: true,
  classicLastLog: null,
  classicHistory: [],
  classicSelectedQuantity: 1,
  classicSelectedFace: 1,
  loadingError: null
};

function normalizeRoute(pathname: string): string {
  const base = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  let path = pathname;
  if (base && base !== "/" && path.startsWith(base)) {
    path = path.slice(base.length) || "/";
  }
  if (path.length > 1 && path.endsWith("/")) {
    path = path.slice(0, -1);
  }
  if (!["/", "/classic", "/method", "/results", "/papers"].includes(path)) {
    return "/";
  }
  return path;
}

function dataUrl(path: string): string {
  return `${baseUrl}${path}`;
}

async function loadData(): Promise<void> {
  try {
    const [policyResponse, metricsResponse] = await Promise.all([
      fetch(dataUrl("data/policy.json")),
      fetch(dataUrl("data/metrics.json"))
    ]);
    if (!policyResponse.ok || !metricsResponse.ok) {
      throw new Error("Static data files could not be loaded");
    }
    state.policy = (await policyResponse.json()) as PolicyData;
    state.metrics = (await metricsResponse.json()) as MetricsData;
    initializeClassicMatch();
    startRound();
  } catch (error) {
    state.loadingError = error instanceof Error ? error.message : "Unknown loading error";
  }
  render();
}

function navigate(route: string): void {
  state.route = route;
  window.history.pushState({}, "", `${baseUrl.replace(/\/$/, "")}${route === "/" ? "/" : route}`);
  render();
}

window.addEventListener("popstate", () => {
  state.route = normalizeRoute(window.location.pathname);
  render();
});

function startRound(): void {
  if (!state.policy || state.aiDiceCount <= 0 || state.userDiceCount <= 0) {
    render();
    return;
  }
  state.aiHand = rollDice(state.aiDiceCount, state.policy.metadata.max_face);
  state.userHand = rollDice(state.userDiceCount, state.policy.metadata.max_face);
  state.currentClaim = state.aiClaims
    ? sampleAiClaim(state.policy, state.aiHand, state.aiDiceCount, state.userDiceCount)
    : null;
  state.lastLog = null;
  state.selectedQuantity = Math.min(state.selectedQuantity, state.aiDiceCount + state.userDiceCount);
  render();
}

function resetMatch(): void {
  state.round = 1;
  state.aiDiceCount = 5;
  state.userDiceCount = 5;
  state.aiClaims = true;
  state.history = [];
  state.lastLog = null;
  startRound();
}

function applyLog(log: RoundLog): void {
  state.lastLog = log;
  state.history = [log, ...state.history].slice(0, 5);
  if (log.loser === "AI") {
    state.aiDiceCount -= 1;
  } else {
    state.userDiceCount -= 1;
  }
  state.round += 1;
  state.aiClaims = !state.aiClaims;
  state.currentClaim = null;
  render();
}

function respondToAi(response: ResponseAction): void {
  if (!state.currentClaim) {
    return;
  }
  const log = resolveRound(state.round, "AI", state.aiHand, state.userHand, state.currentClaim, response);
  applyLog(log);
}

function submitUserClaim(): void {
  if (!state.policy) {
    return;
  }
  const claim = `claim_${state.selectedQuantity}_${state.selectedFace}`;
  if (!isFeasibleClaim(claim, state.userDiceCount, state.aiDiceCount)) {
    return;
  }
  const response = sampleAiResponse(state.policy, state.aiHand, claim, state.aiDiceCount, state.userDiceCount);
  const log = resolveRound(state.round, "You", state.aiHand, state.userHand, claim, response);
  applyLog(log);
}

function initializeClassicMatch(): void {
  state.classicRound = 1;
  state.classicAiDiceCount = 5;
  state.classicUserDiceCount = 5;
  state.classicHistory = [];
  state.classicLastLog = null;
  startClassicRound(false);
}

function startClassicRound(renderNow = true): void {
  if (!state.policy || state.classicAiDiceCount <= 0 || state.classicUserDiceCount <= 0) {
    if (renderNow) {
      render();
    }
    return;
  }
  state.classicAiHand = rollDice(state.classicAiDiceCount, state.policy.metadata.max_face);
  state.classicUserHand = rollDice(state.classicUserDiceCount, state.policy.metadata.max_face);
  state.classicCurrentBid = null;
  state.classicBidder = null;
  state.classicUserTurn = true;
  state.classicLastLog = null;
  state.classicSelectedQuantity = Math.min(state.classicSelectedQuantity, state.classicAiDiceCount + state.classicUserDiceCount);
  if (renderNow) {
    render();
  }
}

function resetClassicMatch(): void {
  initializeClassicMatch();
  render();
}

function classicTotalDice(): number {
  return state.classicAiDiceCount + state.classicUserDiceCount;
}

function isLegalClassicRaise(previousBid: string | null, bid: string): boolean {
  if (!state.policy || !isFeasibleClaim(bid, state.classicUserDiceCount, state.classicAiDiceCount)) {
    return false;
  }
  const next = parseClaim(bid);
  if (!previousBid) {
    return true;
  }
  const previous = parseClaim(previousBid);
  return next.quantity > previous.quantity || (next.quantity === previous.quantity && next.face > previous.face);
}

function legalClassicRaises(previousBid: string | null): string[] {
  if (!state.policy) {
    return [];
  }
  return state.policy.metadata.claim_actions.filter((claim) => isLegalClassicRaise(previousBid, claim));
}

function submitClassicRaise(): void {
  const bid = `claim_${state.classicSelectedQuantity}_${state.classicSelectedFace}`;
  if (!isLegalClassicRaise(state.classicCurrentBid, bid)) {
    return;
  }
  state.classicCurrentBid = bid;
  state.classicBidder = "You";
  state.classicUserTurn = false;
  aiClassicTurn();
}

function aiClassicTurn(): void {
  if (!state.policy || state.classicLastLog || state.classicAiDiceCount <= 0 || state.classicUserDiceCount <= 0) {
    render();
    return;
  }
  if (state.classicCurrentBid) {
    const bid = parseClaim(state.classicCurrentBid);
    const knownCount = state.classicAiHand.filter((die) => die === bid.face).length;
    const neededFromUser = bid.quantity - knownCount;
    const highPressureBid = bid.quantity >= Math.max(2, classicTotalDice() - 1) && knownCount <= 1;
    if (neededFromUser > state.classicUserDiceCount || highPressureBid) {
      resolveClassicChallenge("AI");
      return;
    }
  }

  const raise = chooseAiClassicRaise();
  if (!raise) {
    resolveClassicChallenge("AI");
    return;
  }
  state.classicCurrentBid = raise;
  state.classicBidder = "AI";
  state.classicUserTurn = true;
  render();
}

function chooseAiClassicRaise(): string | null {
  const legal = legalClassicRaises(state.classicCurrentBid);
  if (!legal.length) {
    return null;
  }
  const scored = legal.map((claim) => {
    const parsed = parseClaim(claim);
    const knownCount = state.classicAiHand.filter((die) => die === parsed.face).length;
    const hiddenNeed = Math.max(0, parsed.quantity - knownCount);
    const pressureCost = parsed.quantity / Math.max(1, classicTotalDice());
    return {
      claim,
      score: knownCount * 2.5 - hiddenNeed * 1.35 - pressureCost + Math.random() * 0.12
    };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.claim ?? null;
}

function resolveClassicChallenge(challenger: "AI" | "You"): void {
  if (!state.classicCurrentBid || !state.classicBidder) {
    return;
  }
  const bid = parseClaim(state.classicCurrentBid);
  const totalFaceCount = [...state.classicAiHand, ...state.classicUserHand].filter((die) => die === bid.face).length;
  const truth = totalFaceCount >= bid.quantity;
  const loser = truth ? challenger : state.classicBidder;
  const log: ClassicRoundLog = {
    round: state.classicRound,
    bid: state.classicCurrentBid,
    bidder: state.classicBidder,
    challenger,
    truth,
    totalFaceCount,
    loser,
    aiDice: [...state.classicAiHand],
    userDice: [...state.classicUserHand]
  };
  state.classicLastLog = log;
  state.classicHistory = [log, ...state.classicHistory].slice(0, 5);
  if (loser === "AI") {
    state.classicAiDiceCount -= 1;
  } else {
    state.classicUserDiceCount -= 1;
  }
  state.classicRound += 1;
  render();
}

function routeLinks(): string {
  const links = [
    ["/", "Play"],
    ["/classic", "Classic"],
    ["/method", "Method"],
    ["/results", "Results"],
    ["/papers", "Papers"]
  ] as const;
  return links
    .map(([href, label]) => `<button class="nav-link ${state.route === href ? "active" : ""}" data-route="${href}">${label}</button>`)
    .join("");
}

function dieMarkup(value: number): string {
  return `<span class="die" aria-label="die showing ${value}" data-value="${value}">${Array.from({ length: 9 }, (_, index) => {
    const pip = index + 1;
    const visible = pipVisible(value, pip) ? "on" : "";
    return `<span class="pip ${visible}"></span>`;
  }).join("")}</span>`;
}

function pipVisible(value: number, pip: number): boolean {
  const map: Record<number, number[]> = {
    1: [5],
    2: [1, 9],
    3: [1, 5, 9],
    4: [1, 3, 7, 9],
    5: [1, 3, 5, 7, 9],
    6: [1, 3, 4, 6, 7, 9]
  };
  return map[value]?.includes(pip) ?? false;
}

function diceRow(hand: number[], hidden = false): string {
  if (hidden) {
    return Array.from({ length: hand.length }, () => `<span class="die hidden-die">?</span>`).join("");
  }
  return hand.map(dieMarkup).join("");
}

function claimKnowledge(claimKey: string): {
  claim: ReturnType<typeof parseClaim>;
  yourKnownCount: number;
  neededFromAi: number;
  impossible: boolean;
  alreadyTrue: boolean;
} {
  const claim = parseClaim(claimKey);
  const yourKnownCount = state.userHand.filter((die) => die === claim.face).length;
  const neededFromAi = Math.max(0, claim.quantity - yourKnownCount);
  return {
    claim,
    yourKnownCount,
    neededFromAi,
    impossible: neededFromAi > state.aiDiceCount,
    alreadyTrue: neededFromAi === 0
  };
}

function profileLinksMarkup(): string {
  return `
    <div class="profile-links" aria-label="Project links">
      <a href="https://www.linkedin.com/in/emgar/">LinkedIn</a>
      <a href="https://github.com/emgarVIII">GitHub</a>
      <a href="https://github.com/emgarVIII/liars_dice">Repository</a>
    </div>
  `;
}

function projectIntroMarkup(): string {
  const policySchema = state.policy?.metadata.key_schema === "public_dice_counts_and_private_hand_v2"
    ? "sampled CFR+ policy that conditions on remaining dice counts and private dice"
    : "baseline sampled CFR+ policy";
  return `
    <section class="project-intro" aria-label="Project summary">
      <div>
        <span class="eyebrow">AI/ML research project</span>
        <h1>Liar's Dice CFR Lab</h1>
        <p><strong>Imperfect-information, multi-agent decision making in a playable demo.</strong> I modeled a simplified Liar's Dice challenge game, trained a ${policySchema} offline in Python, exported policy and metrics JSON, and built this static TypeScript site so my research can be inspected closely.</p>
        ${profileLinksMarkup()}
        <div class="intro-actions">
          <button data-route="/method">Read method</button>
          <button class="secondary-button" data-route="/results">View results</button>
        </div>
      </div>
      <div class="proof-strip" aria-label="Engineering proof points">
        <span>Hidden information</span>
        <span>Multi-agent self-play</span>
        <span>Policy export</span>
        <span>CFR+</span>
        <span>Best-response checks</span>
        <span>GitHub Pages</span>
      </div>
    </section>
  `;
}

function researchPillarsMarkup(): string {
  return `
    <section class="research-pillars" aria-label="Project at a glance">
      <div>
        <span class="eyebrow">What this is</span>
        <strong>One-claim imperfect-information game</strong>
        <p>Each player sees only their own dice. A public claim is made about the total table, then the other player chooses whether to believe or challenge.</p>
      </div>
      <div>
        <span class="eyebrow">What I built</span>
        <strong>Train, export, evaluate, deploy</strong>
        <p>The Python pipeline trains sampled CFR+ policies and benchmarks them. The browser loads frozen JSON artifacts for a reproducible static demo.</p>
      </div>
      <div>
        <span class="eyebrow">Why it matters</span>
        <strong>Decisioning under uncertainty</strong>
        <p>The same pattern shows up in AI, risk, and quant-style systems: hidden state, adversarial incentives, probabilistic policies, and stress testing.</p>
      </div>
    </section>
  `;
}

function learningApplicabilityMarkup(): string {
  return `
    <section class="learning-panel" aria-label="What I learned and why it applies">
      <div>
        <span class="eyebrow">What I learned</span>
        <h2>Model the uncertainty, then test the policy</h2>
        <p>The project made the core lesson concrete: hidden information changes what good decisions look like. A policy can look strong against simple opponents and still fail when a targeted adversary pushes on its weak spots.</p>
      </div>
      <div class="learning-grid">
        <section>
          <strong>Abstraction is an engineering choice</strong>
          <p>I simplified classic Liar's Dice into a one-claim challenge game so the solver could be trained, inspected, and evaluated without pretending the full game was solved.</p>
        </section>
        <section>
          <strong>Policies need evidence</strong>
          <p>Win rates are useful, but they are not enough. Benchmarks, best-response checks, and clear limitations make the result more trustworthy.</p>
        </section>
        <section>
          <strong>The pattern generalizes</strong>
          <p>The same structure appears in AI systems, markets, risk models, and adversarial decision tools: partial observations, incentives, uncertainty, and stress testing.</p>
        </section>
      </div>
    </section>
  `;
}

function abstractionComparisonMarkup(): string {
  return `
    <section class="abstraction-panel" aria-label="Simplified game versus classic Liar's Dice">
      <div>
        <span class="eyebrow">Research abstraction</span>
        <h2>Simplified CFR challenge game</h2>
        <p>This is the trained-and-evaluated mode used for the project. One player makes a total-table claim, then the responder chooses Believe or Challenge.</p>
      </div>
      <div class="comparison-grid">
        <section>
          <strong>Main demo</strong>
          <p>One claim, one response, hidden dice, sampled CFR+ policy, benchmark results, and best-response diagnostics.</p>
        </section>
        <section>
          <strong>Classic comparison</strong>
          <p>Raise ladder and challenge loop, included so visitors recognize what changed. It is playable, heuristic, and not claimed as CFR-trained.</p>
        </section>
      </div>
    </section>
  `;
}

function gameMarkup(): string {
  if (state.loadingError) {
    return `<section class="error-band">Data load failed: ${state.loadingError}</section>`;
  }
  if (!state.policy) {
    return `<section class="loading-band">Loading policy and metrics...</section>`;
  }
  const matchOver = state.aiDiceCount <= 0 || state.userDiceCount <= 0;
  const winner = state.aiDiceCount > 0 ? "AI" : "You";
  const totalDice = state.aiDiceCount + state.userDiceCount;
  const quantityOptions = Array.from({ length: totalDice }, (_, index) => index + 1)
    .map((quantity) => `<option value="${quantity}" ${state.selectedQuantity === quantity ? "selected" : ""}>${quantity}</option>`)
    .join("");
  const faceOptions = Array.from({ length: state.policy.metadata.max_face }, (_, index) => index + 1)
    .map((face) => `<option value="${face}" ${state.selectedFace === face ? "selected" : ""}>${face}</option>`)
    .join("");
  const currentClaim = state.currentClaim ? claimLabel(state.currentClaim) : "Waiting for your claim";
  const activeAiClaim = state.aiClaims && state.currentClaim && !state.lastLog ? claimKnowledge(state.currentClaim) : null;
  const claimBadge = activeAiClaim?.impossible
    ? `<span class="claim-badge warning-note">Known false from your dice</span>`
    : activeAiClaim?.alreadyTrue
      ? `<span class="claim-badge success-note">Known true from your dice</span>`
      : "";
  const responseHint = activeAiClaim?.impossible
    ? `<span class="decision-hint warning-note">Challenge is guaranteed here.</span>`
    : activeAiClaim?.alreadyTrue
      ? `<span class="decision-hint success-note">Believe is guaranteed here.</span>`
      : "";

  return `
    <section class="game-shell" aria-label="Playable Liar's Dice demo">
      <div class="game-board">
        ${projectIntroMarkup()}
        <div class="round-strip">
          <span>Round ${state.round}</span>
          <span>AI dice ${state.aiDiceCount}</span>
          <span>Your dice ${state.userDiceCount}</span>
        </div>
        <div class="rules-strip" aria-label="How to play">
          <span class="eyebrow">How to play this mode</span>
          <p><strong>Read the claim:</strong> it is about both players' dice combined.</p>
          <p><strong>Use your dice:</strong> believe if the claim is true, challenge if it is false.</p>
          <p><strong>Scope:</strong> no raise loop, bid ladder, multiplayer table rotation, or wild-face rule.</p>
        </div>
        <div class="table-surface">
          <div class="player-row opponent">
            <span>AI private dice</span>
            <div class="dice-row">${state.lastLog ? diceRow(state.aiHand) : diceRow(state.aiHand, true)}</div>
          </div>
          <div class="claim-zone">
            <small>${state.aiClaims ? "AI claim" : "Your claim"}</small>
            <strong>${currentClaim}</strong>
            ${claimBadge}
            <p>${state.aiClaims ? "Believe if the claim is true. Challenge if it is false." : "Choose a quantity and face for the total dice on the table."}</p>
          </div>
          <div class="player-row">
            <span>Your private dice</span>
            <div class="dice-row">${diceRow(state.userHand)}</div>
          </div>
        </div>
        ${
          matchOver
            ? `<div class="decision-row"><strong>Match over: ${winner} wins.</strong><button data-action="reset">Reset match</button></div>`
            : state.lastLog
              ? `<div class="decision-row"><span>${roundSummary(state.lastLog)}</span><button data-action="next-round">Next round</button></div>`
              : state.aiClaims
                ? `<div class="decision-row">${responseHint}<button class="${activeAiClaim?.alreadyTrue ? "recommended-action" : ""}" data-response="believe">Believe</button><button class="${activeAiClaim?.impossible ? "recommended-action" : ""}" data-response="challenge">Challenge</button></div>`
                : `<div class="claim-controls">
                    <label>Quantity <select data-input="quantity">${quantityOptions}</select></label>
                    <label>Face <select data-input="face">${faceOptions}</select></label>
                    <button data-action="submit-claim">Submit claim</button>
                  </div>`
        }
        ${researchPillarsMarkup()}
        ${learningApplicabilityMarkup()}
        ${abstractionComparisonMarkup()}
      </div>
      <aside class="strategy-panel">
        ${decisionGuideMarkup()}
        <div class="log-list">
          <h3>Recent rounds</h3>
          ${
            state.history.length
              ? state.history.map((log) => `<p>${roundSummary(log)}</p>`).join("")
              : "<p>No completed rounds yet.</p>"
          }
        </div>
        <div class="mode-note">
          <span class="eyebrow">Mode</span>
          <h3>CFR Challenge Abstraction</h3>
          <p>This is the simplified game model used for the research demo, not the full table game.</p>
          <p>Classic raise-and-call Liar's Dice is useful for comparison, but it is outside the validated solver shown here.</p>
        </div>
      </aside>
    </section>
  `;
}

function classicRoundSummary(log: ClassicRoundLog): string {
  return `${log.bidder} bid ${claimLabel(log.bid)}. ${log.challenger} challenged; table had ${log.totalFaceCount}. Bid was ${log.truth ? "true" : "false"}. ${log.loser} lost a die.`;
}

function classicMarkup(): string {
  if (state.loadingError) {
    return `<section class="error-band">Data load failed: ${state.loadingError}</section>`;
  }
  if (!state.policy) {
    return `<section class="loading-band">Loading classic comparison...</section>`;
  }
  const matchOver = state.classicAiDiceCount <= 0 || state.classicUserDiceCount <= 0;
  const winner = state.classicAiDiceCount > 0 ? "AI" : "You";
  const totalDice = classicTotalDice();
  const currentBidLabel = state.classicCurrentBid ? claimLabel(state.classicCurrentBid) : "No bid yet";
  const quantityOptions = Array.from({ length: totalDice }, (_, index) => index + 1)
    .map((quantity) => `<option value="${quantity}" ${state.classicSelectedQuantity === quantity ? "selected" : ""}>${quantity}</option>`)
    .join("");
  const faceOptions = Array.from({ length: state.policy.metadata.max_face }, (_, index) => index + 1)
    .map((face) => `<option value="${face}" ${state.classicSelectedFace === face ? "selected" : ""}>${face}</option>`)
    .join("");
  const selectedBid = `claim_${state.classicSelectedQuantity}_${state.classicSelectedFace}`;
  const selectedRaiseLegal = isLegalClassicRaise(state.classicCurrentBid, selectedBid);
  const canChallenge = state.classicUserTurn && state.classicCurrentBid && state.classicBidder === "AI";

  return `
    <section class="classic-shell" aria-label="Classic Liar's Dice comparison">
      <div class="classic-main">
        <span class="eyebrow">Playable comparison, not the research solver</span>
        <h1>Classic raise and challenge mode</h1>
        <p>This route shows the familiar bid ladder: players keep raising until someone challenges. It exists to make the abstraction easier to understand. The AI here is rule-based and educational, so the sampled CFR+ training and benchmark claims from the main demo do not apply to this mode.</p>
        <div class="scope-banner">
          <strong>Classic rules comparison.</strong>
          <span>Legal bids must fit the total dice, raises must increase the bid, and a challenge reveals both hands.</span>
        </div>
        <div class="classic-board">
          <div class="round-strip">
            <span>Round ${state.classicRound}</span>
            <span>AI dice ${state.classicAiDiceCount}</span>
            <span>Your dice ${state.classicUserDiceCount}</span>
          </div>
          <div class="table-surface">
            <div class="player-row opponent">
              <span>AI private dice</span>
              <div class="dice-row">${state.classicLastLog ? diceRow(state.classicAiHand) : diceRow(state.classicAiHand, true)}</div>
            </div>
            <div class="claim-zone">
              <small>${state.classicBidder ? `${state.classicBidder} bid` : "Opening bid"}</small>
              <strong>${currentBidLabel}</strong>
              <p>${state.classicUserTurn ? "Raise the bid or challenge the AI's last bid." : "The heuristic AI is deciding whether to raise or challenge."}</p>
            </div>
            <div class="player-row">
              <span>Your private dice</span>
              <div class="dice-row">${diceRow(state.classicUserHand)}</div>
            </div>
          </div>
          ${
            matchOver
              ? `<div class="decision-row"><strong>Classic match over: ${winner} wins.</strong><button data-action="classic-reset">Reset classic match</button></div>`
              : state.classicLastLog
                ? `<div class="decision-row"><span>${classicRoundSummary(state.classicLastLog)}</span><button data-action="classic-next-round">Next round</button></div>`
                : `<div class="claim-controls">
                    <label>Quantity <select data-input="classic-quantity">${quantityOptions}</select></label>
                    <label>Face <select data-input="classic-face">${faceOptions}</select></label>
                    <button ${selectedRaiseLegal ? "" : "disabled"} data-action="classic-raise">${state.classicCurrentBid ? "Raise" : "Open bid"}</button>
                    <button ${canChallenge ? "" : "disabled"} data-action="classic-challenge">Challenge</button>
                  </div>`
          }
        </div>
      </div>
      <aside class="strategy-panel">
        <span class="eyebrow">Classic comparison</span>
        <h2>How this mode differs</h2>
        <p>The main research policy targets the one-claim challenge abstraction. This classic route keeps the familiar raise loop visible so it is easier to see what the research model simplified.</p>
        <dl class="decision-facts">
          <div><dt>Classic loop</dt><dd>Raise, raise, challenge</dd></div>
          <div><dt>AI type</dt><dd>Heuristic</dd></div>
          <div><dt>Training claim</dt><dd>Main mode only</dd></div>
        </dl>
        <div class="log-list">
          <h3>Classic history</h3>
          ${
            state.classicHistory.length
              ? state.classicHistory.map((log) => `<p>${classicRoundSummary(log)}</p>`).join("")
              : "<p>No completed classic rounds yet.</p>"
          }
        </div>
      </aside>
    </section>
  `;
}

function decisionGuideMarkup(): string {
  if (!state.policy) {
    return "";
  }
  if (state.aiDiceCount <= 0 || state.userDiceCount <= 0) {
    return `
      <span class="eyebrow">Decision guide</span>
      <h2>Match complete</h2>
      <p>Reset the match to roll a new hidden-information sequence.</p>
    `;
  }
  if (state.lastLog) {
    const claim = parseClaim(state.lastLog.claim);
    const totalFaceCount = [...state.lastLog.aiDice, ...state.lastLog.userDice].filter((die) => die === claim.face).length;
    return `
      <span class="eyebrow">Decision guide</span>
      <h2>Round revealed</h2>
      <p>The claim needed ${claim.quantity} dice showing face ${claim.face}; the table had ${totalFaceCount}. The claim was ${state.lastLog.truth ? "true" : "false"}.</p>
    `;
  }
  const claimKey = state.aiClaims && state.currentClaim
    ? state.currentClaim
    : `claim_${state.selectedQuantity}_${state.selectedFace}`;
  const { claim, yourKnownCount, neededFromAi, impossible, alreadyTrue } = claimKnowledge(claimKey);
  const stateLabel = state.aiClaims ? "AI claim" : "Your selected claim";
  const verdict = alreadyTrue
    ? state.aiClaims
      ? "Your dice alone make this claim true. Believe is guaranteed here."
      : "Your dice alone make this claim true."
    : impossible
      ? state.aiClaims
        ? "Known false from your view: the AI cannot have enough hidden dice. Challenge is guaranteed here."
        : "This would be a known-false claim from your view."
      : `The AI needs at least ${neededFromAi} of its ${state.aiDiceCount} hidden dice to show face ${claim.face}.`;
  const policyNote = state.aiClaims && impossible
    ? "This can happen because the AI does not see your dice before claiming, and the checked-in claimant policy is a baseline rather than solved play."
    : "The AI still acts from the exported sampled CFR+ policy; this guide avoids showing hidden-hand policy probabilities during play.";

  return `
    <span class="eyebrow">Decision guide</span>
    <h2>${state.aiClaims ? "What do you know?" : "Before you claim"}</h2>
    <p>${stateLabel}: <strong>${claimLabel(claimKey)}</strong>.</p>
    <dl class="decision-facts">
      <div><dt>Your visible count</dt><dd>${yourKnownCount}</dd></div>
      <div><dt>Needed from hidden AI dice</dt><dd>${neededFromAi}</dd></div>
      <div><dt>AI hidden dice</dt><dd>${state.aiDiceCount}</dd></div>
    </dl>
    <p class="${impossible ? "warning-note" : alreadyTrue ? "success-note" : ""}">${verdict}</p>
    <p>${policyNote}</p>
  `;
}

function roundSummary(log: RoundLog): string {
  return `${log.claimant} claimed ${claimLabel(log.claim)}. ${log.response === "believe" ? "Believed" : "Challenged"}; claim was ${log.truth ? "true" : "false"}. ${log.loser} lost a die.`;
}

function percent(value: number): string {
  return `${Math.round(value * 1000) / 10}%`;
}

function methodMarkup(): string {
  return `
    <section class="text-route">
      <span class="eyebrow">Method</span>
      <h1>From supervised research to public AI/ML case study</h1>
      <p>This began as open-ended supervised research under Dr. Tian at UT Austin. The engineering work was to turn an imperfect-information Liar's Dice research idea into a tractable game model, train sampled CFR+ policies offline, evaluate the results, and publish the demo as static artifacts anyone can inspect.</p>
      <div class="pipeline-strip" aria-label="Project pipeline">
        <span>Define rules</span>
        <span>Encode information sets</span>
        <span>Train sampled CFR+</span>
        <span>Policy JSON</span>
        <span>Benchmark metrics</span>
        <span>Static TypeScript demo</span>
      </div>
      <div class="case-study-flow">
        <section>
          <span>01</span>
          <div><strong>Problem</strong><p>Classic Liar's Dice is an imperfect-information bluffing game with hidden dice and strategic claims. The full raise loop is interesting, but it creates a much larger game tree.</p></div>
        </section>
        <section>
          <span>02</span>
          <div><strong>Abstraction</strong><p>I narrowed the game to one total-table claim and one response. That preserved hidden information and bluff/call decisions while keeping the game tree practical for local sampled CFR+ training.</p></div>
        </section>
        <section>
          <span>03</span>
          <div><strong>Training</strong><p>The Python code samples dice counts and private hands, evaluates feasible claims, updates regret-matching policies, clips negative regret like CFR+, and exports average claim and response strategies.</p></div>
        </section>
        <section>
          <span>04</span>
          <div><strong>Evaluation</strong><p>I benchmarked the policy against random, skeptical, threshold, and truth-biased opponents, then added best-response-style diagnostics to avoid overstating equilibrium claims.</p></div>
        </section>
      </div>
      <div class="method-grid">
        <div><strong>Information set</strong><p>A player observes their own dice, public dice counts, and public claims, but not the opponent's hidden dice.</p></div>
        <div><strong>Remaining-dice-aware policy</strong><p>The published policy uses the public dice counts and the player's private dice. That fixes an early baseline that reused similar decisions even after the match state changed.</p></div>
        <div><strong>Claim policy</strong><p>The claimant chooses among legal <code>claim_Q_F</code> actions for the current public count context.</p></div>
        <div><strong>Response policy</strong><p>The responder chooses <code>believe</code> or <code>challenge</code> from private dice, public counts, and the claim.</p></div>
        <div><strong>Why simplify?</strong><p>The trained policy omits the raise ladder, multiplayer rotation, and wild-face variants to keep the first solver small enough to train, inspect, evaluate, and explain honestly.</p></div>
        <div><strong>Static deployment boundary</strong><p>Python trains and evaluates offline. The browser only loads frozen policy and metrics JSON.</p></div>
      </div>
      <div class="section-block">
        <span class="eyebrow">Policy artifact</span>
        <h2>What is the policy?</h2>
        <p>A policy is the AI's strategy table. For each information set, it stores a probability distribution over legal actions. In this project there are two exported policy tables: one for making claims and one for responding to claims.</p>
        <div class="code-sample" aria-label="Policy JSON example">
          <pre><code>{
  "claim_policy": {
    "5:5:2,2,4,5,6": {
      "claim_2_6": 0.35,
      "claim_2_2": 0.23,
      "claim_2_4": 0.11
    }
  },
  "response_policy": {
    "5:5:1,3,4,4,6|claim_3_4": {
      "believe": 0.41,
      "challenge": 0.59
    }
  }
}</code></pre>
        </div>
        <p>The key <code>5:5:2,2,4,5,6</code> means claimant dice count, responder dice count, and the player's private hand. The values are not labels or scores. They are action probabilities sampled by the browser.</p>
      </div>
      <div class="section-block">
        <span class="eyebrow">Common questions</span>
        <h2>How to read the AI</h2>
        <div class="detail-grid">
          <section><strong>Is it supposed to beat me consistently?</strong><p>Not every round. Liar's Dice has randomness and hidden information, so even good play loses hands. The goal is stronger long-run decision quality against named benchmark opponents, not a guarantee that the AI beats every human in a short session.</p></section>
          <section><strong>What does remaining-dice-aware mean?</strong><p>The policy changes when the public dice counts change. A claim that makes sense with ten dice on the table can be reckless when only four dice remain.</p></section>
          <section><strong>How was it trained?</strong><p>Offline Python self-play repeatedly samples game states, compares each legal action against alternatives in the same information set, updates regrets, and averages the strategies into the exported policy JSON.</p></section>
          <section><strong>Does it need deeper training?</strong><p>More iterations can make the sampled policy smoother, but more training alone is not the main next step. The bigger improvement is training directly against best-response pressure and extending the solver to the classic raise/challenge game.</p></section>
        </div>
      </div>
      <div class="section-block">
        <span class="eyebrow">Terms learned and used</span>
        <h2>Project vocabulary</h2>
        <div class="detail-grid">
          <section><strong>Imperfect information</strong><p>A player must act without seeing the full game state. Here, each player sees their own dice but not the opponent's dice.</p></section>
          <section><strong>Information set</strong><p>The decision context available to a player: their private dice, the public claim, and the legal actions from that point.</p></section>
          <section><strong>Policy or strategy</strong><p>A probability distribution over legal actions. The exported JSON stores claim and response probabilities for each modeled information set.</p></section>
          <section><strong>Self-play</strong><p>Training by repeatedly simulating agents against versions of themselves so strategies adapt from generated experience.</p></section>
          <section><strong>CFR / CFR+</strong><p>Counterfactual Regret Minimization updates action probabilities by tracking regret for not choosing alternative actions. CFR+ clips negative regret to stabilize learning.</p></section>
          <section><strong>Monte Carlo sampling</strong><p>Estimating a large process by sampling many possible states instead of exhaustively enumerating every path.</p></section>
          <section><strong>MCCFR</strong><p>Monte Carlo Counterfactual Regret Minimization. It uses sampled traversals to approximate CFR updates when full game-tree traversal is too expensive.</p></section>
          <section><strong>Nash equilibrium</strong><p>A strategy profile where no player can improve by changing strategy alone. Achieving it would mean showing the policy has no profitable unilateral deviation within the modeled game.</p></section>
          <section><strong>Exploitability</strong><p>How much a best-response opponent can gain against a policy. Lower exploitability is stronger evidence than one win-rate table.</p></section>
          <section><strong>Best response</strong><p>An opponent strategy chosen specifically to maximize payoff against the current policy.</p></section>
          <section><strong>Abstraction</strong><p>A simplified version of a larger game. This project abstracts Liar's Dice into a one-claim challenge game to make learning and validation tractable.</p></section>
        </div>
      </div>
    </section>
  `;
}

function resultsMarkup(): string {
  if (!state.metrics) {
    return `<section class="loading-band">Loading metrics...</section>`;
  }
  const rows = Object.entries(state.metrics.scenarios).map(([name, result]) => {
    return `<tr><td>${result.label ?? name.replace(/_/g, " ")}</td><td>${result.matches}</td><td>${percent(result.ai_win_rate)}</td></tr>`;
  }).join("");
  const opponentCards = Object.entries(state.metrics.scenarios).map(([name, result]) => {
    return `
      <section>
        <strong>${result.label ?? name.replace(/_/g, " ")}</strong>
        <p>${result.opponent ?? "Benchmark opponent."}</p>
        <p><span class="metric">${percent(result.ai_win_rate)} AI win rate.</span> ${result.meaning ?? "Used for policy comparison."}</p>
      </section>
    `;
  }).join("");
  const selected = state.metrics.comparison?.selected;
  const baseline = state.metrics.comparison?.baseline;
  const delta = state.metrics.comparison?.delta;
  const bestResponse = state.metrics.evaluation?.one_round_best_response;
  const convergenceRows = state.metrics.convergence?.checkpoints.map((checkpoint) => `
    <tr>
      <td>${checkpoint.iterations.toLocaleString()}</td>
      <td>${percent(checkpoint.average_benchmark_win_rate)}</td>
    </tr>
  `).join("") ?? "";
  return `
    <section class="text-route">
      <span class="eyebrow">Results</span>
      <h1>What the AI learned, and what it still fails at</h1>
      <p>The published policy uses public remaining dice counts and private dice, then trains for ${state.metrics.metadata.policy_iterations?.toLocaleString() ?? "200,000"} sampled CFR+ iterations. The headline result is stronger benchmark play, but the important engineering result is more honest: best-response diagnostics still find exploitable pressure.</p>
      <div class="result-hero">
        <section>
          <span class="eyebrow">Benchmark average</span>
          <strong>${selected ? percent(selected.average_benchmark_win_rate) : "73.0%"}</strong>
          <p>Average AI win rate across four fixed benchmark opponents. ${baseline ? `The earlier private-hand-only baseline averaged ${percent(baseline.average_benchmark_win_rate)}.` : "This is a benchmark score, not proof of optimal play."}</p>
        </section>
        <section>
          <span class="eyebrow">Policy upgrade</span>
          <strong>${delta ? `+${percent(delta.average_benchmark_win_rate)}` : "Dice-count aware"}</strong>
          <p>Improvement compared with the earlier policy key that mostly reused one starting-state strategy instead of adapting to remaining dice counts.</p>
        </section>
        <section>
          <span class="eyebrow">Robustness warning</span>
          <strong>${bestResponse ? bestResponse.best_response_pressure.toFixed(3) : "Tracked"}</strong>
          <p>A targeted opponent can still pressure the policy. That keeps the public claim honest: stronger benchmark play, not solved play.</p>
        </section>
      </div>
      <div class="plain-metric-grid" aria-label="Plain English metric explanations">
        <section><strong>What 73% means</strong><p>Across four fixed opponent profiles, the AI won about seven out of ten seeded matches. Those opponents are useful tests, but they are not guaranteed optimal adversaries.</p></section>
        <section><strong>Should it beat you?</strong><p>It should make better long-run decisions than simple baseline opponents, but it is not meant to win every human session. Short matches are noisy, and a targeted player can still exploit weaknesses.</p></section>
        <section><strong>What the baseline was</strong><p>The old baseline indexed policy decisions mostly by private hand. The selected policy also includes public dice counts, so it can behave differently at 5v5, 4v3, or 2v1 dice.</p></section>
        <section><strong>What it is against</strong><p>The benchmark suite includes random claims, skeptical responses, threshold responses, and truth-biased claims. Each profile stresses a different weakness.</p></section>
        <section><strong>What it does not prove</strong><p>It does not prove Nash equilibrium, full classic Liar's Dice competence, or low exploitability against every possible opponent.</p></section>
      </div>
      <div class="explain-panel">
        <span class="eyebrow">Equilibrium status</span>
        <h2>Not proven at equilibrium</h2>
        <p>To claim Nash equilibrium, I would need evidence that no player can improve by switching to a better unilateral strategy within the modeled game. These percentages are empirical win rates against named benchmark opponents. The one-round best-response check is a stronger diagnostic and still finds exploitable pressure.</p>
      </div>
      <table class="metrics-table">
        <thead><tr><th>Opponent profile</th><th>Matches</th><th>AI win rate</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <p class="note">Generated with seed ${state.metrics.metadata.seed}, ${state.metrics.metadata.matches_per_scenario} matches per scenario.</p>
      ${
        bestResponse
          ? `<div class="section-block">
              <span class="eyebrow">Best-response diagnostic</span>
              <h2>What a stronger opponent finds</h2>
              <div class="detail-grid">
                <section><strong>AI claimant value</strong><p><span class="metric">${bestResponse.ai_claimant_value_vs_bayes_best_responder.toFixed(3)}</span> versus a Bayes best responder. Negative means the claimant policy is exploitable when the responder classifies claims optimally.</p></section>
                <section><strong>Responder accuracy</strong><p><span class="metric">${percent(bestResponse.best_responder_accuracy_vs_ai_claims)}</span> against AI claims in the exact one-round diagnostic.</p></section>
                <section><strong>AI responder value</strong><p><span class="metric">${bestResponse.ai_responder_value_vs_best_claimant.toFixed(3)}</span> versus a best claimant. This side is closer to robust than the claimant side.</p></section>
              </div>
            </div>`
          : ""
      }
      <div class="section-block">
        <span class="eyebrow">Opponents</span>
        <h2>What the win rates are against</h2>
        <div class="detail-grid">${opponentCards}</div>
      </div>
      ${
        convergenceRows
          ? `<div class="section-block">
              <span class="eyebrow">Training checkpoints</span>
              <h2>Convergence-style evidence</h2>
              <table class="metrics-table">
                <thead><tr><th>Iterations</th><th>Average benchmark win rate</th></tr></thead>
                <tbody>${convergenceRows}</tbody>
              </table>
              <p class="note">${state.metrics.convergence?.interpretation ?? ""}</p>
            </div>`
          : ""
      }
      <div class="status-grid">
        <section>
          <span class="eyebrow">Policy status</span>
          <h2>Stronger, not solved</h2>
          <p>The remaining-dice-aware policy is much stronger against the benchmark suite, but the best-response diagnostic prevents overclaiming. This is a resume-worthy engineering result because the limitation is measured, not hidden.</p>
        </section>
        <section>
          <span class="eyebrow">AI/ML value</span>
          <h2>Evaluation over vibes</h2>
          <p>The project separates a playable demo from measured evidence: train a model, benchmark it, add adversarial diagnostics, and explain where it fails.</p>
        </section>
        <section>
          <span class="eyebrow">Hidden-state decisioning</span>
          <h2>Uncertainty matters</h2>
          <p>The core pattern is incomplete state, adversarial incentives, noisy observations, and policies that need stress tests before their performance claims are trusted.</p>
        </section>
        <section>
          <span class="eyebrow">Next improvement</span>
          <h2>Reduce exploitability</h2>
          <p>The next technical step is training directly against stronger best-response pressure, not just improving performance against fixed benchmark opponents.</p>
        </section>
        <section>
          <span class="eyebrow">Deployment</span>
          <h2>Static and reproducible</h2>
          <p>Python produces the policy and metrics offline. The browser loads frozen JSON artifacts, so GitHub Pages can host the full public demo.</p>
        </section>
        <section>
          <span class="eyebrow">Project artifact</span>
          <h2>End-to-end system</h2>
          <p>The project includes rules modeling, training, evaluation, tests, static deployment, a paper archive, and a playable explanation layer.</p>
        </section>
      </div>
    </section>
  `;
}

function papersMarkup(): string {
  return `
    <section class="text-route">
      <span class="eyebrow">Papers</span>
      <h1>Research papers and public editions</h1>
      <p>The archive keeps the original research documents intact and adds polished public editions rebuilt from the original source documents.</p>
      <div class="explain-panel">
        <span class="eyebrow">How to read these</span>
        <h2>Originals preserved, public editions cleaned</h2>
        <p>The original research artifacts preserve the project history. The polished editions keep the original information intact, improve document formatting, and make only light cleanup edits. For the current public version, the website, README, tests, and metrics are the source of truth.</p>
      </div>
      <div class="paper-list">
        ${paperCardMarkup(
          "Final report",
          "Primary research report and best source for the original structure, math, and implementation detail.",
          "paper-assets/final-report.pdf",
          "paper-assets/final-report/final-report.tex",
          "paper-assets/polished/final-report.pdf",
          "paper-assets/polished/final-report/final-report.tex"
        )}
        ${paperCardMarkup(
          "Applied focus deliverable",
          "Supporting background on imperfect-information games, multi-agent learning, and game-solving systems.",
          "paper-assets/applied-focus.pdf",
          "paper-assets/applied-focus/applied-focus.tex",
          "paper-assets/polished/applied-focus.pdf",
          "paper-assets/polished/applied-focus/applied-focus.tex"
        )}
        ${paperCardMarkup(
          "Research notes",
          "Informal scratch notes and planning logs. Included for completeness, not needed to understand the project.",
          "paper-assets/research-notebook.pdf",
          "paper-assets/research-notebook/research-notebook.tex",
          "paper-assets/polished/research-notebook.pdf",
          "paper-assets/polished/research-notebook/research-notebook.tex"
        )}
      </div>
      <div class="archive-footer">
        <p class="note">Maintained by Mauricio Garcia Villanueva.</p>
        ${profileLinksMarkup()}
      </div>
    </section>
  `;
}

function paperCardMarkup(
  title: string,
  description: string,
  originalPdf: string,
  originalLatex: string,
  polishedPdf: string,
  polishedLatex: string
): string {
  return `
    <section class="paper-card">
      <div>
        <strong>${title}</strong>
        <p>${description}</p>
      </div>
      <div class="paper-download-group">
        <span>Original research artifact</span>
        <a href="${baseUrl}${originalPdf}">PDF</a>
        <a href="${baseUrl}${originalLatex}">LaTeX</a>
      </div>
      <div class="paper-download-group featured-download">
        <span>Polished Public Edition</span>
        <a href="${baseUrl}${polishedPdf}">PDF</a>
        <a href="${baseUrl}${polishedLatex}">LaTeX</a>
      </div>
    </section>
  `;
}

function render(): void {
  appRoot.innerHTML = `
    <header class="site-header">
      <button class="brand" data-route="/">Liar's Dice CFR Lab</button>
      <nav>${routeLinks()}</nav>
    </header>
    <main>
      ${
        state.route === "/"
          ? gameMarkup()
          : state.route === "/classic"
            ? classicMarkup()
            : state.route === "/method"
            ? methodMarkup()
            : state.route === "/results"
              ? resultsMarkup()
              : papersMarkup()
      }
    </main>
  `;
  bindEvents();
}

function bindEvents(): void {
  document.querySelectorAll<HTMLButtonElement>("[data-route]").forEach((button) => {
    button.addEventListener("click", () => navigate(button.dataset.route ?? "/"));
  });
  document.querySelectorAll<HTMLButtonElement>("[data-response]").forEach((button) => {
    button.addEventListener("click", () => respondToAi((button.dataset.response ?? "believe") as ResponseAction));
  });
  document.querySelector<HTMLButtonElement>("[data-action='next-round']")?.addEventListener("click", startRound);
  document.querySelector<HTMLButtonElement>("[data-action='reset']")?.addEventListener("click", resetMatch);
  document.querySelector<HTMLButtonElement>("[data-action='submit-claim']")?.addEventListener("click", submitUserClaim);
  document.querySelector<HTMLButtonElement>("[data-action='classic-next-round']")?.addEventListener("click", () => startClassicRound());
  document.querySelector<HTMLButtonElement>("[data-action='classic-reset']")?.addEventListener("click", resetClassicMatch);
  document.querySelector<HTMLButtonElement>("[data-action='classic-raise']")?.addEventListener("click", submitClassicRaise);
  document.querySelector<HTMLButtonElement>("[data-action='classic-challenge']")?.addEventListener("click", () => resolveClassicChallenge("You"));
  document.querySelector<HTMLSelectElement>("[data-input='quantity']")?.addEventListener("change", (event) => {
    state.selectedQuantity = Number((event.target as HTMLSelectElement).value);
    render();
  });
  document.querySelector<HTMLSelectElement>("[data-input='face']")?.addEventListener("change", (event) => {
    state.selectedFace = Number((event.target as HTMLSelectElement).value);
    render();
  });
  document.querySelector<HTMLSelectElement>("[data-input='classic-quantity']")?.addEventListener("change", (event) => {
    state.classicSelectedQuantity = Number((event.target as HTMLSelectElement).value);
    render();
  });
  document.querySelector<HTMLSelectElement>("[data-input='classic-face']")?.addEventListener("change", (event) => {
    state.classicSelectedFace = Number((event.target as HTMLSelectElement).value);
    render();
  });
}

render();
void loadData();
