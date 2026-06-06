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
    ? "count-aware CFR-style policy"
    : "baseline CFR-style policy";
  return `
    <section class="project-intro" aria-label="Portfolio project summary">
      <div>
        <span class="eyebrow">AI/ML portfolio project</span>
        <h1>Imperfect-information strategy lab</h1>
        <p>Built by <strong>Mauricio Garcia Villanueva</strong>. A reproducible Python research pipeline trains a ${policySchema}, exports static JSON artifacts, and drives this TypeScript demo without a backend.</p>
        ${profileLinksMarkup()}
      </div>
      <div class="proof-strip" aria-label="Engineering proof points">
        <span>Self-play</span>
        <span>CFR+</span>
        <span>Best-response checks</span>
        <span>GitHub Pages</span>
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
          <span class="eyebrow">Research abstraction</span>
          <p><strong>Not classic Liar's Dice:</strong> no raise loop, bid ladder, or wild-face variant.</p>
          <p><strong>Game loop:</strong> one hidden-dice claim, then Believe or Challenge.</p>
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
        <span class="eyebrow">Playable comparison</span>
        <h1>Classic raise and challenge mode</h1>
        <p>This route shows the familiar bid ladder: players keep raising until someone challenges. It is a rules comparison powered by a heuristic AI, not the CFR-solved policy from the main abstraction.</p>
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
        <span class="eyebrow">Scope guard</span>
        <h2>Not the solved mode</h2>
        <p>The main research policy targets the one-claim challenge abstraction. This classic route exists so recruiters and readers can compare the abstraction against the original raise loop.</p>
        <dl class="decision-facts">
          <div><dt>Classic loop</dt><dd>Raise, raise, challenge</dd></div>
          <div><dt>AI type</dt><dd>Heuristic</dd></div>
          <div><dt>CFR claim</dt><dd>Not applied here</dd></div>
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
    : "The AI still acts from the exported CFR-style policy; this guide avoids showing hidden-hand policy probabilities during play.";

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
      <h1>Research engineering pipeline</h1>
      <p>This is not a full classic Liar's Dice solver. It is a compact imperfect-information lab: define a tractable game abstraction, train sampled CFR+ style policies offline, evaluate them against benchmark and best-response-style opponents, then export static artifacts for a browser demo.</p>
      <div class="pipeline-strip" aria-label="Project pipeline">
        <span>Rules model</span>
        <span>Information sets</span>
        <span>CFR+ self-play</span>
        <span>Policy JSON</span>
        <span>Evaluation JSON</span>
        <span>Static demo</span>
      </div>
      <div class="method-grid">
        <div><strong>Information set</strong><p>A player observes their own dice and the public claim, not the opponent's dice.</p></div>
        <div><strong>Count-aware policy</strong><p>The published policy conditions on remaining public dice counts plus the private hand, fixing a key limitation in the first baseline.</p></div>
        <div><strong>Claim policy</strong><p>The claimant chooses among legal <code>claim_Q_F</code> actions for the current public count context.</p></div>
        <div><strong>Response policy</strong><p>The responder chooses <code>believe</code> or <code>challenge</code> from their private hand, the public dice counts, and the claim.</p></div>
        <div><strong>Omitted from classic play</strong><p>No repeated raising, bid ladder, multiplayer table rotation, or wild-face rule variant is modeled here.</p></div>
        <div><strong>Why simplify</strong><p>The smaller game tree keeps hidden-information learning explainable and makes validation practical on a laptop.</p></div>
        <div><strong>Export boundary</strong><p>Training stays in Python; the website loads frozen JSON artifacts.</p></div>
        <div><strong>Evaluation boundary</strong><p>Win rates are benchmark evidence. Best-response pressure is a stronger diagnostic, but still not a formal Nash proof.</p></div>
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
          <section><strong>Nash equilibrium</strong><p>A strategy profile where no player can improve by changing strategy alone. This project does not prove the current policy is at equilibrium.</p></section>
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
      <h1>Better benchmarks, still honest limits</h1>
      <p>The published policy now conditions on public remaining dice counts and was trained for ${state.metrics.metadata.policy_iterations?.toLocaleString() ?? "200,000"} sampled CFR+ iterations. It performs much better against benchmark opponents, while exact best-response pressure still shows it is not an equilibrium proof.</p>
      <div class="result-hero">
        <section>
          <span class="eyebrow">Benchmark average</span>
          <strong>${selected ? percent(selected.average_benchmark_win_rate) : "73.0%"}</strong>
          <p>${baseline ? `Baseline was ${percent(baseline.average_benchmark_win_rate)}.` : "Average across seeded benchmark opponents."}</p>
        </section>
        <section>
          <span class="eyebrow">Policy upgrade</span>
          <strong>${delta ? `+${percent(delta.average_benchmark_win_rate)}` : "Count-aware"}</strong>
          <p>Lift comes from conditioning on public dice counts instead of reusing one fixed five-dice policy.</p>
        </section>
        <section>
          <span class="eyebrow">Robustness warning</span>
          <strong>${bestResponse ? bestResponse.best_response_pressure.toFixed(3) : "Tracked"}</strong>
          <p>Best-response pressure is worse than the baseline, so this is stronger benchmark play, not solved play.</p>
        </section>
      </div>
      <div class="explain-panel">
        <span class="eyebrow">Equilibrium status</span>
        <h2>Not proven at equilibrium</h2>
        <p>These percentages are empirical win rates against named benchmark opponents. The exact one-round best-response check is a stronger diagnostic and it still finds exploitable pressure. That is the point of the public story: engineering evaluation matters as much as headline win rate.</p>
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
          <p>The count-aware policy is much stronger against the benchmark suite, but the best-response diagnostic prevents overclaiming. This is a resume-worthy engineering result because the limitation is measured, not hidden.</p>
        </section>
        <section>
          <span class="eyebrow">AI/ML value</span>
          <h2>Evaluation over vibes</h2>
          <p>The project now shows the loop hiring teams care about: train a model, benchmark it, add adversarial diagnostics, and explain where it fails.</p>
        </section>
        <section>
          <span class="eyebrow">Quant angle</span>
          <h2>Hidden information</h2>
          <p>The same framing appears in trading and risk problems: incomplete state, adversarial incentives, noisy observations, and policies that need stress tests.</p>
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
          <span class="eyebrow">Recruiter takeaway</span>
          <h2>End-to-end artifact</h2>
          <p>The project includes rules modeling, training, evaluation, tests, static deployment, paper archive, and a playable explanation layer.</p>
        </section>
      </div>
    </section>
  `;
}

function papersMarkup(): string {
  return `
    <section class="text-route">
      <span class="eyebrow">Papers</span>
      <h1>Curated research archive</h1>
      <p>The archive preserves the original university deliverables behind this project. The live site is the current validated public artifact, so it may be more conservative than claims or wording in the original course documents.</p>
      <div class="explain-panel">
        <span class="eyebrow">Archive caveat</span>
        <h2>Original papers, current demo</h2>
        <p>The PDFs are kept as course-document history. The website, README, tests, and exported metrics are the source of truth for the portfolio version: simplified CFR challenge mode, playable classic comparison, benchmark results, and measured limitations.</p>
      </div>
      <div class="paper-list">
        <div>
          <strong>Final report</strong>
          <a href="${baseUrl}paper-assets/final-report.pdf">PDF</a>
          <a href="${baseUrl}paper-assets/final-report/final-report.tex">LaTeX</a>
        </div>
        <div>
          <strong>Applied focus deliverable</strong>
          <a href="${baseUrl}paper-assets/applied-focus.pdf">PDF</a>
          <a href="${baseUrl}paper-assets/applied-focus/applied-focus.tex">LaTeX</a>
        </div>
        <div>
          <strong>Research notebook</strong>
          <a href="${baseUrl}paper-assets/research-notebook.pdf">PDF</a>
          <a href="${baseUrl}paper-assets/research-notebook/research-notebook.tex">LaTeX</a>
        </div>
      </div>
      <div class="archive-footer">
        <p class="note">Maintained by Mauricio Garcia Villanueva.</p>
        ${profileLinksMarkup()}
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
