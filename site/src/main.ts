import "./styles.css";
import {
  claimLabel,
  handKey,
  isFeasibleClaim,
  normalizeDistribution,
  parseClaim,
  resolveRound,
  rollDice,
  sampleAiClaim,
  sampleAiResponse,
  topActions
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
  loadingError: string | null;
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
  if (!["/", "/method", "/results", "/papers"].includes(path)) {
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
  const response = sampleAiResponse(state.policy, state.aiHand, claim);
  const log = resolveRound(state.round, "You", state.aiHand, state.userHand, claim, response);
  applyLog(log);
}

function routeLinks(): string {
  const links = [
    ["/", "Play"],
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

function topClaimPolicy(): string {
  if (!state.policy || state.aiHand.length === 0) {
    return "<p>Policy loading...</p>";
  }
  const distribution = state.policy.claim_policy[handKey(state.aiHand)] ?? {};
  const feasible = Object.fromEntries(
    Object.entries(distribution).filter(([claim]) => isFeasibleClaim(claim, state.aiDiceCount, state.userDiceCount))
  );
  return topActions(feasible).map(([claim, probability]) => {
    return `<li><span>${claimLabel(claim)}</span><strong>${Math.round(probability * 100)}%</strong></li>`;
  }).join("");
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

  return `
    <section class="game-shell" aria-label="Playable Liar's Dice demo">
      <div class="game-board">
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
                ? `<div class="decision-row"><button data-response="believe">Believe</button><button data-response="challenge">Challenge</button></div>`
                : `<div class="claim-controls">
                    <label>Quantity <select data-input="quantity">${quantityOptions}</select></label>
                    <label>Face <select data-input="face">${faceOptions}</select></label>
                    <button data-action="submit-claim">Submit claim</button>
                  </div>`
        }
      </div>
      <aside class="strategy-panel">
        <div class="quick-read">
          <span class="eyebrow">Mode</span>
          <h2>CFR Challenge Abstraction</h2>
          <p>This is the simplified game model used for the research demo, not the full table game.</p>
          <ol>
            <li>Each player sees only their own dice.</li>
            <li>The claimant announces a quantity and face for the total table.</li>
            <li>The responder chooses Believe or Challenge.</li>
            <li>A correct responder makes the claimant lose a die. A wrong responder loses a die.</li>
          </ol>
          <p>Classic raise-and-call Liar's Dice is useful for comparison, but it is outside the validated solver shown here.</p>
        </div>
        <span class="eyebrow">Sampled CFR+ policy</span>
        <h2>Strategy view</h2>
        <p>For the AI's current hidden hand, these are the highest-probability feasible claims in the exported policy.</p>
        <ol class="policy-list">${topClaimPolicy()}</ol>
        <div class="log-list">
          <h3>Recent rounds</h3>
          ${
            state.history.length
              ? state.history.map((log) => `<p>${roundSummary(log)}</p>`).join("")
              : "<p>No completed rounds yet.</p>"
          }
        </div>
      </aside>
    </section>
  `;
}

function roundSummary(log: RoundLog): string {
  return `${log.claimant} claimed ${claimLabel(log.claim)}. ${log.response === "believe" ? "Believed" : "Challenged"}; claim was ${log.truth ? "true" : "false"}. ${log.loser} lost a die.`;
}

function methodMarkup(): string {
  return `
    <section class="text-route">
      <span class="eyebrow">Method</span>
      <h1>Self-play on a deliberate abstraction</h1>
      <p>This is not a full classic Liar's Dice solver. The project uses a compact one-claim challenge game so the hidden-information mechanics are visible: a private hand, a quantity-face claim, and a responder prediction. The Python engine trains sampled CFR+ style regret matchers for the claimant and responder information sets, then exports normalized policies for the browser.</p>
      <div class="method-grid">
        <div><strong>Information set</strong><p>A player observes their own dice and the public claim, not the opponent's dice.</p></div>
        <div><strong>Claim policy</strong><p>The claimant chooses among <code>claim_Q_F</code> actions for a private hand.</p></div>
        <div><strong>Response policy</strong><p>The responder chooses <code>believe</code> or <code>challenge</code> from their private hand and the claim.</p></div>
        <div><strong>Omitted from classic play</strong><p>No repeated raising, bid ladder, multiplayer table rotation, or wild-face rule variant is modeled here.</p></div>
        <div><strong>Why simplify</strong><p>The smaller game tree keeps CFR behavior explainable and makes policy validation practical for a static demo.</p></div>
        <div><strong>Export boundary</strong><p>Training stays in Python; the website loads frozen JSON artifacts.</p></div>
      </div>
    </section>
  `;
}

function resultsMarkup(): string {
  if (!state.metrics) {
    return `<section class="loading-band">Loading metrics...</section>`;
  }
  const rows = Object.entries(state.metrics.scenarios).map(([name, result]) => {
    const pct = Math.round(result.ai_win_rate * 1000) / 10;
    return `<tr><td>${name.replace(/_/g, " ")}</td><td>${result.matches}</td><td>${pct}%</td></tr>`;
  }).join("");
  return `
    <section class="text-route">
      <span class="eyebrow">Results</span>
      <h1>Abstraction metrics, not classic-game claims</h1>
      <p>The current policy is a first cleaned baseline for the one-claim challenge abstraction. It performs close to even against broad random behavior and loses to simple threshold response rules, which is exactly the limitation the report discusses.</p>
      <table class="metrics-table">
        <thead><tr><th>Opponent profile</th><th>Matches</th><th>AI win rate</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <p class="note">Generated with seed ${state.metrics.metadata.seed}, ${state.metrics.metadata.matches_per_scenario} matches per scenario.</p>
    </section>
  `;
}

function papersMarkup(): string {
  return `
    <section class="text-route">
      <span class="eyebrow">Papers</span>
      <h1>Curated research archive</h1>
      <p>The document archive will present the final report as the primary paper, the applied-focus deliverable as supporting context, and the planning document as a research notebook.</p>
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
      <p class="note">The first pass preserves the original text and focuses on displayable exports. Text revisions are intentionally deferred.</p>
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
  document.querySelector<HTMLSelectElement>("[data-input='quantity']")?.addEventListener("change", (event) => {
    state.selectedQuantity = Number((event.target as HTMLSelectElement).value);
    render();
  });
  document.querySelector<HTMLSelectElement>("[data-input='face']")?.addEventListener("change", (event) => {
    state.selectedFace = Number((event.target as HTMLSelectElement).value);
    render();
  });
}

render();
void loadData();
