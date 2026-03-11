const presets = {
  nit: { name: "Nit", summary: "Disciplined range, low bluff volume, high fold discipline.", values: { vpip: 18, pfr: 14, threeBet: 6, aggression: 32, flopCbet: 44, turnBarrel: 28, riverBluff: 18, heroCall: 24, riskTolerance: 22 } },
  balanced: { name: "Balanced Reg", summary: "Stable baseline profile with measured pressure and reasonable defense.", values: { vpip: 24, pfr: 19, threeBet: 9, aggression: 56, flopCbet: 62, turnBarrel: 49, riverBluff: 38, heroCall: 46, riskTolerance: 48 } },
  lag: { name: "LAG", summary: "Wide entries, active 3-bets, steady postflop pressure.", values: { vpip: 31, pfr: 25, threeBet: 13, aggression: 73, flopCbet: 74, turnBarrel: 63, riverBluff: 56, heroCall: 42, riskTolerance: 66 } },
  station: { name: "Calling Station", summary: "Loose preflop defense, passive raises, sticky bluff catching.", values: { vpip: 35, pfr: 11, threeBet: 4, aggression: 21, flopCbet: 30, turnBarrel: 18, riverBluff: 10, heroCall: 76, riskTolerance: 41 } },
  maniac: { name: "Maniac", summary: "Constant pressure, volatile frequencies, high-risk lines.", values: { vpip: 42, pfr: 34, threeBet: 19, aggression: 91, flopCbet: 85, turnBarrel: 79, riverBluff: 74, heroCall: 35, riskTolerance: 88 } },
};

const summaryTargets = {
  "Nit": { vpip_pct: 18, pfr_pct: 14, three_bet_pct: 6, flop_cbet_pct: 44, turn_barrel_pct: 28 },
  "Balanced Reg": { vpip_pct: 24, pfr_pct: 19, three_bet_pct: 9, flop_cbet_pct: 62, turn_barrel_pct: 49 },
  "LAG": { vpip_pct: 31, pfr_pct: 25, three_bet_pct: 13, flop_cbet_pct: 74, turn_barrel_pct: 63 },
  "Calling Station": { vpip_pct: 35, pfr_pct: 11, three_bet_pct: 4, flop_cbet_pct: 30, turn_barrel_pct: 18 },
  "Maniac": { vpip_pct: 42, pfr_pct: 34, three_bet_pct: 19, flop_cbet_pct: 85, turn_barrel_pct: 79 },
  "TAG": { vpip_pct: 22, pfr_pct: 18, three_bet_pct: 8, flop_cbet_pct: 60, turn_barrel_pct: 46 },
  "Trapper": { vpip_pct: 23, pfr_pct: 15, three_bet_pct: 7, flop_cbet_pct: 48, turn_barrel_pct: 39 },
  "Pressure Reg": { vpip_pct: 27, pfr_pct: 22, three_bet_pct: 12, flop_cbet_pct: 76, turn_barrel_pct: 67 },
};

const scenarios = [
  { id: "btn-steal", name: "Late Position Steal", hand: "Ah Kh", position: "BTN", street: "Preflop", board: "--", pot: 2.5, toCall: 0, effectiveStack: 100, history: "Folded to BTN", tags: ["in_position", "unopened_pot", "broadway_strength", "fold_equity"], trace: ["Unopened pot in late position widens the acceptable entry range.", "AK offsuit sits above the open threshold for every preset in this demo.", "Aggression, PFR, and risk tolerance determine how emphatically the bot attacks."] },
  { id: "bb-vs-co-open", name: "Blind Defense vs CO Open", hand: "Qs Js", position: "BB", street: "Preflop", board: "--", pot: 5.5, toCall: 2, effectiveStack: 100, history: "CO opens 2.5 BB, folds to BB", tags: ["blind_defense", "suited_broadway", "facing_open", "price_realization"], trace: ["The big blind closes action and gets a favorable direct price.", "QJs is strong enough to continue across most profiles, but style affects call versus 3-bet.", "Aggressive presets convert more of this hand class into pressure."] },
  { id: "flop-cbet", name: "Flop C-Bet Spot", hand: "Ac Qc", position: "CO", street: "Flop", board: "Qh 7d 2s", pot: 6.5, toCall: 0, effectiveStack: 95, history: "Hero opened CO, BB called", tags: ["top_pair", "range_advantage", "dry_board", "initiative"], trace: ["Hero retained initiative and hits a dry board with strong top pair.", "Flop c-bet tendency has direct influence on whether the bot chooses a value bet or pot control.", "Tighter profiles still bet here often because the spot is structurally favorable."] },
  { id: "turn-barrel", name: "Turn Barrel Pressure", hand: "Kd Qd", position: "BTN", street: "Turn", board: "Jh 8d 3c Td", pot: 18, toCall: 0, effectiveStack: 82, history: "Hero c-bet flop, BB called", tags: ["combo_draw", "turn_pressure", "in_position", "equity_plus_fold_equity"], trace: ["Hero picked up significant turn equity with both pair and draw connectivity.", "Turn barrel parameter has visible impact on whether pressure continues.", "Maniac and LAG profiles polarize harder while nit profiles slow down more often."] },
  { id: "river-catch", name: "River Bluff Catch", hand: "Ad Jc", position: "BB", street: "River", board: "Ks 9h 4c 4d 2s", pot: 31, toCall: 11, effectiveStack: 68, history: "BTN opened, triple barreled 35% pot river", tags: ["hero_call_spot", "ace_high", "river_decision", "blocker_effect"], trace: ["The small river sizing creates a realistic bluff-catch decision.", "Hero call and risk tolerance drive whether the bot reaches for a bluff catch or releases.", "Passive loose profiles call more, while disciplined profiles fold this class more often."] },
];

const sliders = [["vpip", "VPIP"], ["pfr", "PFR"], ["threeBet", "3-Bet"], ["aggression", "Aggression"], ["flopCbet", "Flop C-Bet"], ["turnBarrel", "Turn Barrel"], ["riverBluff", "River Bluff"], ["heroCall", "Hero Call"], ["riskTolerance", "Risk Tolerance"]];
const state = { presetId: "balanced", profile: { ...presets.balanced.values }, scenarioId: scenarios[0].id };
const elements = {
  presetGrid: document.getElementById("preset-grid"), sliderList: document.getElementById("slider-list"), scenarioSelect: document.getElementById("scenario-select"), resetStyle: document.getElementById("reset-style"), runDecision: document.getElementById("run-decision"), heroHand: document.getElementById("hero-hand"), heroPosition: document.getElementById("hero-position"), street: document.getElementById("street"), board: document.getElementById("board"), potSize: document.getElementById("pot-size"), toCall: document.getElementById("to-call"), history: document.getElementById("history"), stackSize: document.getElementById("stack-size"), tablePot: document.getElementById("table-pot"), decisionBadge: document.getElementById("decision-badge"), decisionSize: document.getElementById("decision-size"), decisionSummary: document.getElementById("decision-summary"), barFold: document.getElementById("bar-fold"), barCall: document.getElementById("bar-call"), barRaise: document.getElementById("bar-raise"), probFold: document.getElementById("prob-fold"), probCall: document.getElementById("prob-call"), probRaise: document.getElementById("prob-raise"), reasonTags: document.getElementById("reason-tags"), decisionTrace: document.getElementById("decision-trace"), summaryBody: document.getElementById("summary-body"), summaryStatus: document.getElementById("summary-status")
};

function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function currentScenario() { return scenarios.find((scenario) => scenario.id === state.scenarioId); }
function formatBB(value) { return `${value.toFixed(value % 1 === 0 ? 0 : 1)} BB`; }

function renderPresets() {
  elements.presetGrid.innerHTML = "";
  Object.entries(presets).forEach(([id, preset]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `preset-card${state.presetId === id ? " active" : ""}`;
    button.innerHTML = `<strong>${preset.name}</strong><span>${preset.summary}</span>`;
    button.addEventListener("click", () => { state.presetId = id; state.profile = { ...preset.values }; renderPresets(); renderSliders(); runDecision(); });
    elements.presetGrid.appendChild(button);
  });
}

function renderSliders() {
  elements.sliderList.innerHTML = "";
  sliders.forEach(([key, label]) => {
    const row = document.createElement("div");
    row.className = "slider-row";
    row.innerHTML = `<div class="slider-head"><span>${label}</span><span id="value-${key}">${state.profile[key]}</span></div><input id="slider-${key}" type="range" min="0" max="100" value="${state.profile[key]}">`;
    row.querySelector("input").addEventListener("input", (event) => { state.profile[key] = Number(event.target.value); row.querySelector(`#value-${key}`).textContent = state.profile[key]; state.presetId = ""; renderPresets(); runDecision(); });
    elements.sliderList.appendChild(row);
  });
}

function renderScenarios() {
  elements.scenarioSelect.innerHTML = scenarios.map((scenario) => `<option value="${scenario.id}">${scenario.name}</option>`).join("");
  elements.scenarioSelect.value = state.scenarioId;
}

function renderStatePanel() {
  const scenario = currentScenario();
  elements.heroHand.textContent = scenario.hand;
  elements.heroPosition.textContent = scenario.position;
  elements.street.textContent = scenario.street;
  elements.board.textContent = `Board: ${scenario.board}`;
  elements.potSize.textContent = formatBB(scenario.pot);
  elements.toCall.textContent = `To call: ${formatBB(scenario.toCall)}`;
  elements.history.textContent = scenario.history;
  elements.stackSize.textContent = `Effective: ${formatBB(scenario.effectiveStack)}`;
  elements.tablePot.textContent = formatBB(scenario.pot);
}

function scoreDecision(profile, scenario) {
  const p = profile;
  let fold = 8, call = 24, raise = 28, size = scenario.street === "Preflop" ? 2.5 : scenario.pot * 0.6;
  if (scenario.id === "btn-steal") { raise += p.pfr * 0.9 + p.vpip * 0.35 + p.aggression * 0.25; call += p.vpip * 0.08; fold += (100 - p.vpip) * 0.2; size = 2.2 + p.riskTolerance * 0.01; }
  if (scenario.id === "bb-vs-co-open") { call += p.vpip * 0.62 + p.heroCall * 0.28; raise += p.threeBet * 1.2 + p.aggression * 0.35; fold += (100 - p.vpip) * 0.24; size = 8 + p.threeBet * 0.05; }
  if (scenario.id === "flop-cbet") { raise += p.flopCbet * 0.95 + p.aggression * 0.35 + p.riskTolerance * 0.14; call += 8; fold = Math.max(0, fold - 4); size = scenario.pot * (0.28 + p.flopCbet / 250); }
  if (scenario.id === "turn-barrel") { raise += p.turnBarrel * 0.92 + p.aggression * 0.42 + p.riverBluff * 0.18; call += p.heroCall * 0.15; fold += (100 - p.turnBarrel) * 0.14; size = scenario.pot * (0.54 + p.turnBarrel / 220); }
  if (scenario.id === "river-catch") { call += p.heroCall * 0.88 + p.riskTolerance * 0.26; raise += p.riverBluff * 0.24 + p.aggression * 0.08; fold += (100 - p.heroCall) * 0.46 + (100 - p.riskTolerance) * 0.16; size = 0; }
  const total = fold + call + raise;
  const foldPct = clamp(Math.round((fold / total) * 100), 0, 100);
  const callPct = clamp(Math.round((call / total) * 100), 0, 100);
  const raisePct = clamp(100 - foldPct - callPct, 0, 100);
  const probabilities = { fold: foldPct, call: callPct, raise: raisePct };
  let action = "raise";
  if (probabilities.fold >= probabilities.call && probabilities.fold >= probabilities.raise) action = "fold";
  else if (probabilities.call >= probabilities.raise) action = scenario.toCall === 0 ? "check" : "call";
  return { action, size, probabilities };
}

function summaryFor(action, scenario, presetName) {
  const prefix = presetName ? `${presetName} profile` : "Custom profile";
  if (action === "fold") return `${prefix} prefers a lower-variance release in this spot.`;
  if (action === "call" || action === "check") return `${prefix} takes the controlled line and preserves showdown flexibility.`;
  return `${prefix} applies pressure in ${scenario.name.toLowerCase()}.`;
}

function renderDecision(result) {
  const scenario = currentScenario();
  const activePreset = Object.values(presets).find((preset) => JSON.stringify(preset.values) === JSON.stringify(state.profile));
  const badgeLabel = result.action === "check" ? "Check" : result.action[0].toUpperCase() + result.action.slice(1);
  const badgeClass = result.action === "fold" ? "fold" : result.action === "call" || result.action === "check" ? "call" : "raise";
  elements.decisionBadge.className = `action-pill ${badgeClass}`;
  elements.decisionBadge.textContent = badgeLabel;
  elements.decisionSize.textContent = result.action === "raise" ? formatBB(result.size) : result.action === "call" ? formatBB(scenario.toCall) : "No size";
  elements.decisionSummary.textContent = summaryFor(result.action, scenario, activePreset?.name);
  elements.barFold.style.width = `${result.probabilities.fold}%`;
  elements.barCall.style.width = `${result.probabilities.call}%`;
  elements.barRaise.style.width = `${result.probabilities.raise}%`;
  elements.probFold.textContent = `${result.probabilities.fold}%`;
  elements.probCall.textContent = `${result.probabilities.call}%`;
  elements.probRaise.textContent = `${result.probabilities.raise}%`;
  const dynamicTags = [...scenario.tags];
  if (state.profile.aggression >= 70) dynamicTags.push("high_aggression_profile");
  if (state.profile.heroCall >= 65) dynamicTags.push("high_hero_call");
  if (state.profile.riskTolerance <= 30) dynamicTags.push("low_variance_profile");
  elements.reasonTags.innerHTML = dynamicTags.slice(0, 6).map((tag) => `<span class="tag">${tag}</span>`).join("");
  const dynamicTrace = [...scenario.trace];
  dynamicTrace.push(`Current style snapshot: VPIP ${state.profile.vpip}, PFR ${state.profile.pfr}, aggression ${state.profile.aggression}.`);
  dynamicTrace.push(`Final recommendation resolves to ${badgeLabel}${result.action === "raise" ? ` for ${formatBB(result.size)}` : ""}.`);
  elements.decisionTrace.innerHTML = dynamicTrace.map((line) => `<li>${line}</li>`).join("");
}

function deltaClass(actual, target) {
  const delta = actual - target;
  if (Math.abs(delta) <= 4) return "neutral";
  return delta > 0 ? "high" : "low";
}

function metricCell(actual, target) {
  const klass = deltaClass(actual, target);
  const delta = Math.round((actual - target) * 10) / 10;
  const signed = delta > 0 ? `+${delta}` : `${delta}`;
  return `<div class="summary-cell"><span class="summary-main ${klass}">${actual}%</span><span class="summary-meta">target ${target}% / ${signed}</span></div>`;
}

function renderSummaryTable(rows) {
  if (!rows.length) {
    elements.summaryBody.innerHTML = '<tr><td colspan="7">No summary data available.</td></tr>';
    return;
  }
  elements.summaryBody.innerHTML = rows.map((row) => {
    const target = summaryTargets[row.profile_name] || {};
    return `<tr>
      <td>${row.profile_name}</td>
      <td>${metricCell(row.vpip_pct, target.vpip_pct ?? 0)}</td>
      <td>${metricCell(row.pfr_pct, target.pfr_pct ?? 0)}</td>
      <td>${metricCell(row.three_bet_pct, target.three_bet_pct ?? 0)}</td>
      <td>${metricCell(row.flop_cbet_pct, target.flop_cbet_pct ?? 0)}</td>
      <td>${metricCell(row.turn_barrel_pct, target.turn_barrel_pct ?? 0)}</td>
      <td>${row.wins}</td>
    </tr>`;
  }).join("");
}

async function loadSummary() {
  try {
    const response = await fetch('/outputs/profile_summary.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const rows = await response.json();
    renderSummaryTable(rows);
    elements.summaryStatus.textContent = `Loaded ${rows.length} profiles from latest simulation export.`;
  } catch (error) {
    elements.summaryStatus.textContent = 'Summary loads when the UI is served via main.py ui after running simulate.';
    renderSummaryTable([]);
  }
}

function runDecision() { renderStatePanel(); renderDecision(scoreDecision(state.profile, currentScenario())); }

elements.scenarioSelect.addEventListener("change", (event) => { state.scenarioId = event.target.value; runDecision(); });
elements.resetStyle.addEventListener("click", () => { const fallbackPreset = state.presetId && presets[state.presetId] ? state.presetId : "balanced"; state.presetId = fallbackPreset; state.profile = { ...presets[fallbackPreset].values }; renderPresets(); renderSliders(); runDecision(); });
elements.runDecision.addEventListener("click", runDecision);

renderPresets();
renderSliders();
renderScenarios();
runDecision();
loadSummary();
