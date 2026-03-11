const seatOrder = ["UTG", "UTG+1", "MP", "HJ", "CO", "BTN", "SB", "BB"];
const seatClassByPosition = {
  "UTG": "seat-utg",
  "UTG+1": "seat-utg1",
  "MP": "seat-mp",
  "HJ": "seat-hj",
  "CO": "seat-co",
  "BTN": "seat-btn",
  "SB": "seat-sb",
  "BB": "seat-bb",
};

const state = {
  replay: null,
  seed: null,
  stepIndex: 0,
  timer: null,
  speed: 900,
};

const elements = {
  dealHand: document.getElementById("deal-hand"),
  togglePlay: document.getElementById("toggle-play"),
  nextStep: document.getElementById("next-step"),
  speedSelect: document.getElementById("speed-select"),
  headline: document.getElementById("headline"),
  streetLabel: document.getElementById("street-label"),
  potLabel: document.getElementById("pot-label"),
  stepLabel: document.getElementById("step-label"),
  tablePot: document.getElementById("table-pot"),
  winnerBanner: document.getElementById("winner-banner"),
  communityCards: document.getElementById("community-cards"),
  actionLabel: document.getElementById("action-label"),
  actionKind: document.getElementById("action-kind"),
  actionDetail: document.getElementById("action-detail"),
  actionLog: document.getElementById("action-log"),
  summaryGrid: document.getElementById("summary-grid"),
  seedPill: document.getElementById("seed-pill"),
};

function formatBB(value) {
  return `${Number(value).toFixed(Number(value) % 1 === 0 ? 0 : 1)} BB`;
}

function streetLabel(value) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : "Preflop";
}

function cardMarkup(card) {
  const suit = card.slice(1);
  const red = suit === "h" || suit === "d";
  return `<span class="card ${red ? "red" : "black"}"><span>${card[0]}</span><small>${suit.toUpperCase()}</small></span>`;
}

function seatElement(position) {
  return document.querySelector(`.seat[data-seat="${position}"]`);
}

function renderBoard(cards) {
  const filled = cards.map(cardMarkup).join("");
  const placeholders = Array.from({ length: Math.max(0, 5 - cards.length) }, () => '<span class="card placeholder">?</span>').join("");
  elements.communityCards.innerHTML = filled + placeholders;
}

function renderSeats(snapshot) {
  snapshot.players.forEach((player) => {
    const node = seatElement(player.position);
    if (!node) return;
    const folded = !player.in_hand;
    const winner = snapshot.winners.includes(player.name);
    const classes = ["seat", seatClassByPosition[player.position] || "", player.status || "waiting"];
    if (folded) classes.push("folded");
    if (winner) classes.push("winner");
    if (snapshot.acting_player === player.name) classes.push("acting");
    node.className = classes.join(" ").trim();
    node.innerHTML = `
      <div class="seat-top">
        <span class="seat-position">${player.position}</span>
        <span class="seat-profile">${player.profile_name}</span>
      </div>
      <strong>${player.name}</strong>
      <span class="seat-stack">${formatBB(player.stack)}</span>
      <div class="hole-cards">${player.hole_cards.map(cardMarkup).join("")}</div>
      <div class="seat-meta">
        <span>${player.last_action || "waiting"}</span>
        <span>${player.street_bet > 0 ? `Street ${formatBB(player.street_bet)}` : ""}</span>
      </div>
    `;
  });
}

function renderSummary(snapshot) {
  const activeCount = snapshot.players.filter((player) => player.in_hand).length;
  const foldedCount = snapshot.players.length - activeCount;
  const chipLeader = [...snapshot.players].sort((a, b) => b.stack - a.stack)[0];
  elements.summaryGrid.innerHTML = `
    <article class="summary-card">
      <span class="label">Active</span>
      <strong>${activeCount}</strong>
      <span class="subtle">${foldedCount} folded</span>
    </article>
    <article class="summary-card">
      <span class="label">Chip Leader</span>
      <strong>${chipLeader.name}</strong>
      <span class="subtle">${formatBB(chipLeader.stack)}</span>
    </article>
    <article class="summary-card">
      <span class="label">Winners</span>
      <strong>${snapshot.winners.length ? snapshot.winners.join(", ") : "Pending"}</strong>
      <span class="subtle">${streetLabel(snapshot.street)}</span>
    </article>
  `;
}

function renderLog() {
  if (!state.replay) return;
  elements.actionLog.innerHTML = state.replay.events.map((event, index) => `
    <li class="${index === state.stepIndex ? "active" : index < state.stepIndex ? "done" : ""}">
      <span class="log-index">${index + 1}</span>
      <div>
        <strong>${event.label}</strong>
        <span>${streetLabel(event.street)} / ${event.kind}</span>
      </div>
    </li>
  `).join("");
}

function renderStep() {
  if (!state.replay) return;
  const event = state.replay.events[state.stepIndex];
  const snapshot = event.snapshot;
  elements.headline.textContent = snapshot.headline;
  elements.streetLabel.textContent = streetLabel(snapshot.street);
  elements.potLabel.textContent = formatBB(snapshot.pot);
  elements.tablePot.textContent = formatBB(snapshot.pot);
  elements.stepLabel.textContent = `${state.stepIndex + 1} / ${state.replay.events.length}`;
  elements.actionLabel.textContent = event.label;
  elements.actionKind.textContent = event.kind;
  elements.actionDetail.textContent = snapshot.acting_player ? `${snapshot.acting_player} is the focus of this step.` : "State transition only.";
  elements.winnerBanner.textContent = snapshot.winners.length ? `Winner: ${snapshot.winners.join(", ")}` : "";
  renderBoard(snapshot.board);
  renderSeats(snapshot);
  renderSummary(snapshot);
  renderLog();
  elements.togglePlay.textContent = state.stepIndex >= state.replay.events.length - 1 ? "Replay" : state.timer ? "Pause" : "Play";
}

function stopPlayback() {
  if (state.timer) {
    window.clearTimeout(state.timer);
    state.timer = null;
  }
}

function queueNextStep() {
  stopPlayback();
  if (!state.replay || state.stepIndex >= state.replay.events.length - 1) {
    renderStep();
    return;
  }
  state.timer = window.setTimeout(() => {
    state.stepIndex += 1;
    renderStep();
    if (state.stepIndex < state.replay.events.length - 1) {
      queueNextStep();
    } else {
      stopPlayback();
      renderStep();
    }
  }, state.speed);
}

function playFromCurrentStep() {
  if (!state.replay) return;
  if (state.stepIndex >= state.replay.events.length - 1) {
    state.stepIndex = 0;
    renderStep();
  }
  queueNextStep();
  renderStep();
}

async function loadReplay() {
  stopPlayback();
  elements.headline.textContent = "Dealing a new hand...";
  const response = await fetch(`/api/replay?t=${Date.now()}`, { cache: "no-store" });
  const payload = await response.json();
  state.seed = payload.seed;
  state.replay = payload.replay;
  state.stepIndex = 0;
  elements.seedPill.textContent = `Seed ${payload.seed}`;
  renderStep();
}

elements.dealHand.addEventListener("click", loadReplay);
elements.nextStep.addEventListener("click", () => {
  stopPlayback();
  if (!state.replay) return;
  state.stepIndex = Math.min(state.stepIndex + 1, state.replay.events.length - 1);
  renderStep();
});
elements.togglePlay.addEventListener("click", () => {
  if (!state.replay) return;
  if (state.timer) {
    stopPlayback();
    renderStep();
    return;
  }
  playFromCurrentStep();
});
elements.speedSelect.addEventListener("change", (event) => {
  state.speed = Number(event.target.value);
  if (state.timer) {
    playFromCurrentStep();
  }
});

loadReplay().catch((error) => {
  elements.headline.textContent = "Failed to load hand replay";
  elements.actionDetail.textContent = String(error);
});
