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
  chat: {
    configured: false,
    model: "",
    provider: "",
    sending: false,
    includeContext: true,
    messages: [],
  },
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
  chatMessages: document.getElementById("chat-messages"),
  chatForm: document.getElementById("chat-form"),
  chatInput: document.getElementById("chat-input"),
  chatSend: document.getElementById("chat-send"),
  chatClear: document.getElementById("chat-clear"),
  chatFeedback: document.getElementById("chat-feedback"),
  chatIncludeContext: document.getElementById("chat-include-context"),
  chatStatusPill: document.getElementById("chat-status-pill"),
  chatModelPill: document.getElementById("chat-model-pill"),
  chatContextSummary: document.getElementById("chat-context-summary"),
  chatSuggestions: Array.from(document.querySelectorAll(".chat-suggestion")),
};

function formatBB(value) {
  return `${Number(value).toFixed(Number(value) % 1 === 0 ? 0 : 1)} BB`;
}

function streetLabel(value) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : "Preflop";
}

function titleCaseToken(value) {
  if (!value) return "Waiting";
  return String(value)
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
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

function describeEvent(event, snapshot) {
  if (event.kind === "hand_start") {
    return "Deck shuffled and blinds are ready.";
  }
  if (event.kind === "blind_post" && event.action) {
    return `${event.action.player_name} posts ${formatBB(event.action.amount)}.`;
  }
  if (event.kind === "board_reveal") {
    return snapshot.board.length ? `Board now shows ${snapshot.board.join(" ")}.` : "Board is waiting to be dealt.";
  }
  if (event.kind === "showdown") {
    return "Hole cards are tabled for showdown.";
  }
  if (event.kind === "payout") {
    return snapshot.winners.length ? `${snapshot.winners.join(", ")} collect the pot.` : "Pot has been awarded.";
  }
  if (event.action) {
    const amount = event.action.amount > 0 ? ` ${formatBB(event.action.amount)}` : "";
    return `${event.action.player_name} chooses ${titleCaseToken(event.action.action)}${amount}.`;
  }
  return snapshot.acting_player ? `${snapshot.acting_player} is the focus of this step.` : "State transition only.";
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
    const statusText = folded ? "Folded" : titleCaseToken(player.last_action || player.status || "waiting");
    const secondaryText = player.street_bet > 0
      ? `Street ${formatBB(player.street_bet)}`
      : player.total_committed > 0
        ? `Committed ${formatBB(player.total_committed)}`
        : "Fresh stack";
    const cards = (player.hole_cards || []).map(cardMarkup).join("");
    node.className = classes.join(" ").trim();
    node.innerHTML = `
      <div class="seat-top">
        <span class="seat-position">${player.position}</span>
        <span class="seat-profile">${player.profile_name}</span>
      </div>
      <div class="seat-main">
        <strong class="seat-name">${player.name}</strong>
        <span class="seat-stack">${formatBB(player.stack)}</span>
      </div>
      <div class="hole-cards">
        ${cards}
      </div>
      <div class="seat-meta">
        <span>${statusText}</span>
        <span>${secondaryText}</span>
      </div>
    `;
  });
}

function renderSummary(snapshot) {
  const activeCount = snapshot.players.filter((player) => player.in_hand).length;
  const foldedCount = snapshot.players.length - activeCount;
  const chipLeader = [...snapshot.players].sort((a, b) => b.stack - a.stack)[0];
  const focusName = snapshot.acting_player || (snapshot.winners.length ? snapshot.winners.join(", ") : "Table state");
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
      <span class="label">Focus</span>
      <strong>${focusName}</strong>
      <span class="subtle">${titleCaseToken(snapshot.acting_player ? "acting_now" : "state_frame")}</span>
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
        <span>${streetLabel(event.street)} / ${titleCaseToken(event.kind)}</span>
      </div>
    </li>
  `).join("");
}

function currentHandContext() {
  if (!state.replay) return null;
  const event = state.replay.events[state.stepIndex];
  const snapshot = event.snapshot;
  return {
    seed: state.seed,
    headline: snapshot.headline,
    street: snapshot.street,
    pot_bb: Number(snapshot.pot),
    event_label: event.label,
    event_kind: event.kind,
    acting_player: snapshot.acting_player,
    board: snapshot.board,
    winners: snapshot.winners,
    players: snapshot.players.map((player) => ({
      name: player.name,
      position: player.position,
      profile_name: player.profile_name,
      stack_bb: Number(player.stack),
      in_hand: Boolean(player.in_hand),
      last_action: player.last_action || player.status || "waiting",
      total_committed_bb: Number(player.total_committed || 0),
      street_bet_bb: Number(player.street_bet || 0),
      hole_cards: player.hole_cards || [],
    })),
    recent_actions: state.replay.events
      .slice(Math.max(0, state.stepIndex - 5), state.stepIndex + 1)
      .map((item) => item.label),
  };
}

function contextSummaryText() {
  const context = currentHandContext();
  if (!context) return "No hand context loaded yet.";
  const board = context.board.length ? context.board.join(" ") : "No board yet";
  const acting = context.acting_player || "Table state";
  return `Seed ${context.seed} · ${streetLabel(context.street)} · Pot ${formatBB(context.pot_bb)} · ${acting} · ${board}`;
}

function resetChat() {
  state.chat.messages = [
    {
      role: "assistant",
      content: "I’m ready to discuss this hand. Ask about ranges, line selection, sizing, or how a different style profile would approach the spot.",
    },
  ];
  renderChat();
}

function renderChatStatus() {
  const configured = state.chat.configured;
  elements.chatStatusPill.textContent = configured ? "Chat connected" : "Chat not configured";
  elements.chatStatusPill.classList.toggle("status-live", configured);
  elements.chatStatusPill.classList.toggle("status-muted", !configured);
  elements.chatModelPill.textContent = state.chat.model ? `Model ${state.chat.model}` : "Model --";
}

function renderChat() {
  elements.chatMessages.innerHTML = state.chat.messages.map((message) => `
    <article class="chat-message ${message.role}">
      <div class="chat-avatar">${message.role === "assistant" ? "AI" : "You"}</div>
      <div class="chat-bubble">
        <span class="chat-role">${message.role === "assistant" ? "PKclaw Copilot" : "You"}</span>
        <div class="chat-content">${escapeHtml(message.content).replaceAll("\n", "<br>")}</div>
      </div>
    </article>
  `).join("");
  elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
  elements.chatContextSummary.textContent = contextSummaryText();
  renderChatStatus();
  if (state.chat.sending) {
    elements.chatFeedback.textContent = "Thinking through the hand...";
  } else if (state.chat.configured) {
    elements.chatFeedback.textContent = "Chat is ready. Current hand context can be attached automatically.";
  } else {
    elements.chatFeedback.textContent = "Configure the chat backend env vars, or use mock mode for local wiring checks.";
  }
}

async function loadChatStatus() {
  try {
    const response = await fetch(`/api/chat/status?t=${Date.now()}`, { cache: "no-store" });
    const payload = await response.json();
    state.chat.configured = Boolean(payload.configured);
    state.chat.model = payload.model || "";
    state.chat.provider = payload.provider || "";
    renderChat();
  } catch (error) {
    state.chat.configured = false;
    state.chat.model = "";
    state.chat.provider = "";
    elements.chatFeedback.textContent = `Chat status unavailable: ${error}`;
    renderChat();
  }
}

async function sendChatMessage(promptText) {
  const content = (promptText ?? elements.chatInput.value).trim();
  if (!content || state.chat.sending) return;

  state.chat.messages.push({ role: "user", content });
  state.chat.sending = true;
  renderChat();
  elements.chatInput.value = "";

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: state.chat.messages,
        hand_context: state.chat.includeContext ? currentHandContext() : null,
      }),
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "Chat request failed.");
    }
    state.chat.configured = Boolean(payload.status?.configured);
    state.chat.model = payload.reply?.model || payload.status?.model || "";
    state.chat.provider = payload.status?.provider || state.chat.provider;
    state.chat.messages.push({
      role: "assistant",
      content: payload.reply?.content || "The chat backend returned an empty response.",
    });
  } catch (error) {
    state.chat.messages.push({
      role: "assistant",
      content: `Chat request failed: ${error}`,
    });
  } finally {
    state.chat.sending = false;
    renderChat();
  }
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
  elements.actionKind.textContent = titleCaseToken(event.kind);
  elements.actionDetail.textContent = describeEvent(event, snapshot);
  elements.winnerBanner.textContent = snapshot.winners.length ? `Winner: ${snapshot.winners.join(", ")}` : "";
  renderBoard(snapshot.board);
  renderSeats(snapshot);
  renderSummary(snapshot);
  renderLog();
  elements.chatContextSummary.textContent = contextSummaryText();
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
elements.chatIncludeContext.addEventListener("change", (event) => {
  state.chat.includeContext = Boolean(event.target.checked);
  renderChat();
});
elements.chatClear.addEventListener("click", () => {
  resetChat();
});
elements.chatForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await sendChatMessage();
});
elements.chatInput.addEventListener("keydown", async (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    await sendChatMessage();
  }
});
elements.chatSuggestions.forEach((button) => {
  button.addEventListener("click", async () => {
    await sendChatMessage(button.dataset.prompt || "");
  });
});

resetChat();

Promise.all([loadReplay(), loadChatStatus()]).catch((error) => {
  elements.headline.textContent = "Failed to load hand replay";
  elements.actionDetail.textContent = String(error);
});
