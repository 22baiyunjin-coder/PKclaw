const STYLE_FIELDS = [
  { key: "vpip", label: "VPIP" },
  { key: "pfr", label: "PFR" },
  { key: "three_bet", label: "3-Bet" },
  { key: "aggression", label: "Aggression" },
  { key: "flop_cbet", label: "Flop C-Bet" },
  { key: "turn_barrel", label: "Turn Barrel" },
  { key: "river_bluff", label: "River Bluff" },
  { key: "hero_call", label: "Hero Call" },
  { key: "risk_tolerance", label: "Risk Tolerance" },
];

const state = {
  product: null,
  presetMap: {},
  sliderNodes: {},
  hydratingControls: false,
  refreshTimer: null,
  chat: {
    configured: false,
    provider: "",
    model: "",
    sending: false,
    messages: [],
  },
};

const elements = {
  refreshState: document.getElementById("refresh-state"),
  botModePill: document.getElementById("bot-mode-pill"),
  botName: document.getElementById("bot-name"),
  presetSelect: document.getElementById("preset-select"),
  scenarioSelect: document.getElementById("scenario-select"),
  modePreset: document.getElementById("mode-preset"),
  modeCustom: document.getElementById("mode-custom"),
  resetProfile: document.getElementById("reset-profile"),
  styleSliders: document.getElementById("style-sliders"),
  scenarioTitle: document.getElementById("scenario-title"),
  scenarioCopy: document.getElementById("scenario-copy"),
  evaluatorPill: document.getElementById("evaluator-pill"),
  policyPill: document.getElementById("policy-pill"),
  stateStreet: document.getElementById("state-street"),
  statePosition: document.getElementById("state-position"),
  statePot: document.getElementById("state-pot"),
  stateCall: document.getElementById("state-call"),
  stateStack: document.getElementById("state-stack"),
  stateLegal: document.getElementById("state-legal"),
  heroCards: document.getElementById("hero-cards"),
  boardCards: document.getElementById("board-cards"),
  decisionAction: document.getElementById("decision-action"),
  decisionSize: document.getElementById("decision-size"),
  decisionBucket: document.getElementById("decision-bucket"),
  analyzeHand: document.getElementById("analyze-hand"),
  evalHandBucket: document.getElementById("eval-hand-bucket"),
  evalHandScore: document.getElementById("eval-hand-score"),
  evalEquity: document.getElementById("eval-equity"),
  evalShowdown: document.getElementById("eval-showdown"),
  evalBoardTexture: document.getElementById("eval-board-texture"),
  boardTags: document.getElementById("board-tags"),
  reasonTags: document.getElementById("reason-tags"),
  policyNotes: document.getElementById("policy-notes"),
  probabilityList: document.getElementById("probability-list"),
  chatStatusPill: document.getElementById("chat-status-pill"),
  chatModelPill: document.getElementById("chat-model-pill"),
  chatContextStrip: document.getElementById("chat-context-strip"),
  chatMessages: document.getElementById("chat-messages"),
  chatForm: document.getElementById("chat-form"),
  chatInput: document.getElementById("chat-input"),
  chatSend: document.getElementById("chat-send"),
  chatClear: document.getElementById("chat-clear"),
  chatFeedback: document.getElementById("chat-feedback"),
  quickActions: document.getElementById("quick-actions"),
};

function formatBB(value) {
  return `${Number(value ?? 0).toFixed(Number(value ?? 0) % 1 === 0 ? 0 : 1)} BB`;
}

function formatPercent(value) {
  return `${Math.round(Number(value ?? 0) * 100)}%`;
}

function titleCaseToken(value) {
  if (!value) return "--";
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
  if (!card) {
    return '<span class="card placeholder">?</span>';
  }
  const suit = card.slice(1);
  const red = suit === "h" || suit === "d";
  return `<span class="card ${red ? "red" : "black"}"><span>${card[0]}</span><small>${suit.toUpperCase()}</small></span>`;
}

function buildSliderControls() {
  elements.styleSliders.innerHTML = STYLE_FIELDS.map(({ key, label }) => `
    <article class="slider-card">
      <div class="slider-head">
        <span class="field-label">${label}</span>
        <strong id="value-${key}">0</strong>
      </div>
      <input id="slider-${key}" type="range" min="0" max="100" step="1" value="0">
    </article>
  `).join("");

  STYLE_FIELDS.forEach(({ key }) => {
    const input = document.getElementById(`slider-${key}`);
    const valueNode = document.getElementById(`value-${key}`);
    state.sliderNodes[key] = { input, valueNode };
    input.addEventListener("input", () => {
      valueNode.textContent = input.value;
      if (!state.hydratingControls) {
        scheduleStateRefresh();
      }
    });
  });
}

function setSliderState(profile, disabled) {
  STYLE_FIELDS.forEach(({ key }) => {
    const nodes = state.sliderNodes[key];
    if (!nodes) return;
    nodes.input.value = profile[key] ?? 0;
    nodes.valueNode.textContent = profile[key] ?? 0;
    nodes.input.disabled = disabled;
  });
}

function populateSelect(selectNode, items, selectedValue, labelKey = "label", valueKey = "key") {
  const existingValue = selectNode.value;
  selectNode.innerHTML = items.map((item) => `
    <option value="${item[valueKey]}">${item[labelKey]}</option>
  `).join("");
  selectNode.value = selectedValue || existingValue || (items[0] ? items[0][valueKey] : "");
}

function currentBotMode() {
  return elements.modeCustom.checked ? "custom" : "preset";
}

function currentCustomProfile() {
  const payload = {};
  STYLE_FIELDS.forEach(({ key }) => {
    payload[key] = Number(state.sliderNodes[key]?.input.value || 0);
  });
  return payload;
}

function resetChat() {
  state.chat.messages = [
    {
      role: "assistant",
      content: "I am ready to explain this spot. Ask why the current action was chosen, why another action was rejected, how a tighter or more aggressive bot would play it, or paste a messy hand history for a short first-pass review.",
    },
  ];
  renderChat();
}

function renderChatStatus() {
  elements.chatStatusPill.textContent = state.chat.configured ? `Chat connected${state.chat.provider ? ` · ${state.chat.provider}` : ""}` : "Chat not configured";
  elements.chatStatusPill.className = `status-pill ${state.chat.configured ? "status-good" : "status-warn"}`;
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
  renderChatStatus();
  if (state.chat.sending) {
    elements.chatFeedback.textContent = "Working through the current hand...";
  } else if (state.chat.configured) {
    elements.chatFeedback.textContent = "The chat already knows the current state, style profile, evaluator outputs, and chosen action.";
  } else {
    elements.chatFeedback.textContent = "Point the app at the remote fine-tuned model with PKCLAW_BASE_URL, PKCLAW_API_KEY, and PKCLAW_MODEL, or use mock mode for local wiring checks.";
  }
}

function renderProbabilityList(probabilities) {
  const entries = Object.entries(probabilities || {}).sort((left, right) => right[1] - left[1]);
  elements.probabilityList.innerHTML = entries.map(([action, value]) => `
    <div class="probability-row">
      <div class="probability-head">
        <span>${titleCaseToken(action)}</span>
        <strong>${formatPercent(value)}</strong>
      </div>
      <div class="probability-track">
        <span class="probability-fill" style="width:${Math.max(4, Number(value) * 100)}%"></span>
      </div>
    </div>
  `).join("");
}

function renderTags(node, items) {
  node.innerHTML = (items || []).map((item) => `<span class="tag-chip">${escapeHtml(titleCaseToken(item))}</span>`).join("");
}

function renderNotes(notes) {
  elements.policyNotes.innerHTML = (notes || []).slice(0, 6).map((note) => `<li>${escapeHtml(note)}</li>`).join("");
}

function alternativeQuickActions(decision, legalActions) {
  const chosenAction = decision.action;
  const probabilities = decision.action_probabilities || {};
  const alternatives = (legalActions || [])
    .filter((action) => action !== chosenAction)
    .sort((left, right) => (probabilities[right] || 0) - (probabilities[left] || 0))
    .slice(0, 2);

  return alternatives.map((alternativeAction) => ({
    label: `Why not ${titleCaseToken(alternativeAction)}?`,
    prompt: `Why is ${chosenAction} better than ${alternativeAction} here?`,
    requestType: "why_not_action",
    requestMeta: { alternative_action: alternativeAction },
  }));
}

function buildQuickActionDefinitions(payload) {
  const gameState = payload.game_state || {};
  const decision = payload.decision || {};
  const currentPreset = payload.current_bot?.preset_name || "current preset";
  const definitions = [
    {
      label: "Analyze Current Hand",
      prompt: "Explain the current hand and why this action was chosen.",
      requestType: "explain_current_hand",
      requestMeta: {},
      primary: true,
    },
    ...alternativeQuickActions(decision, gameState.legal_actions),
    {
      label: "Compare tighter bot",
      prompt: `How would a tighter bot differ from ${currentPreset} in this spot?`,
      requestType: "compare_style",
      requestMeta: { comparison_style: "tighter" },
    },
    {
      label: "Compare aggressive bot",
      prompt: `How would a more aggressive bot differ from ${currentPreset} in this spot?`,
      requestType: "compare_style",
      requestMeta: { comparison_style: "more aggressive" },
    },
    {
      label: "Review hand",
      prompt: "Walk through this hand in a clean replay and review style.",
      requestType: "review_hand",
      requestMeta: {},
    },
  ];

  return definitions.slice(0, 5);
}

function renderQuickActions(payload) {
  const actions = buildQuickActionDefinitions(payload);
  elements.quickActions.innerHTML = actions.map((action) => `
    <button
      class="quick-action ${action.primary ? "primary-ghost" : ""}"
      type="button"
      data-prompt="${escapeHtml(action.prompt)}"
      data-request-type="${action.requestType}"
      data-request-meta="${escapeHtml(JSON.stringify(action.requestMeta || {}))}"
    >${escapeHtml(action.label)}</button>
  `).join("");

  Array.from(elements.quickActions.querySelectorAll(".quick-action")).forEach((button) => {
    button.addEventListener("click", async () => {
      const requestMetaRaw = button.dataset.requestMeta || "{}";
      let requestMeta = {};
      try {
        requestMeta = JSON.parse(requestMetaRaw);
      } catch {
        requestMeta = {};
      }
      await sendChatMessage(button.dataset.prompt || "", {
        requestType: button.dataset.requestType || "general",
        requestMeta,
      });
    });
  });
}

function renderProduct(payload) {
  state.product = payload;
  state.presetMap = Object.fromEntries((payload.available_presets || []).map((item) => [item.key, item]));

  state.hydratingControls = true;
  populateSelect(elements.presetSelect, payload.available_presets || [], payload.current_bot?.preset_key, "name", "key");
  populateSelect(elements.scenarioSelect, payload.available_scenarios || [], payload.scenario?.key, "label", "key");
  elements.modePreset.checked = payload.current_bot?.mode !== "custom";
  elements.modeCustom.checked = payload.current_bot?.mode === "custom";
  elements.botName.value = payload.current_bot?.name || "";
  elements.botModePill.textContent = payload.current_bot?.mode === "custom" ? "Custom" : "Preset";
  setSliderState(payload.current_bot?.style_profile || {}, payload.current_bot?.mode !== "custom");
  state.hydratingControls = false;

  const gameState = payload.game_state || {};
  const decision = payload.decision || {};
  const evaluator = payload.evaluator_summary || {};
  const policy = payload.policy_summary || {};

  elements.scenarioTitle.textContent = payload.scenario?.label || "Current Spot";
  elements.scenarioCopy.textContent = `${payload.current_bot?.name || "Bot"} is making a ${gameState.street || "preflop"} decision from ${gameState.hero_position || "--"}.`;
  elements.evaluatorPill.textContent = evaluator.available ? `Evaluator ${evaluator.source}` : "Evaluator scaffold";
  elements.policyPill.textContent = policy.engine_mode === "learned_policy" ? "Policy learned" : "Policy scaffold";

  elements.stateStreet.textContent = titleCaseToken(gameState.street);
  elements.statePosition.textContent = `Position ${gameState.hero_position || "--"}`;
  elements.statePot.textContent = formatBB(gameState.pot_size);
  elements.stateCall.textContent = `To call ${formatBB(gameState.amount_to_call)}`;
  elements.stateStack.textContent = formatBB(gameState.effective_stack);
  elements.stateLegal.textContent = (gameState.legal_actions || []).join(", ") || "--";

  elements.heroCards.innerHTML = (gameState.hero_hole_cards || []).map(cardMarkup).join("") || '<span class="card placeholder">?</span>';
  const boardCards = gameState.board_cards || [];
  const filledBoard = boardCards.map(cardMarkup).join("");
  const boardPlaceholders = Array.from({ length: Math.max(0, 5 - boardCards.length) }, () => '<span class="card placeholder">?</span>').join("");
  elements.boardCards.innerHTML = filledBoard + boardPlaceholders;

  elements.decisionAction.textContent = titleCaseToken(decision.action);
  elements.decisionSize.textContent = decision.size ? formatBB(decision.size) : "No sizing";
  elements.decisionBucket.textContent = decision.size_bucket ? `Size bucket: ${titleCaseToken(decision.size_bucket)}` : "No size bucket for this action.";

  elements.evalHandBucket.textContent = titleCaseToken(evaluator.hand_bucket);
  elements.evalHandScore.textContent = Number(evaluator.hand_score ?? 0).toFixed(2);
  elements.evalEquity.textContent = evaluator.model_outputs?.equity_estimate != null ? formatPercent(evaluator.model_outputs.equity_estimate) : "--";
  elements.evalShowdown.textContent = evaluator.model_outputs?.showdown_strength_proxy != null ? formatPercent(evaluator.model_outputs.showdown_strength_proxy) : "--";
  elements.evalBoardTexture.textContent = titleCaseToken(evaluator.board_texture);

  renderTags(elements.boardTags, evaluator.board_tags || []);
  renderTags(elements.reasonTags, decision.reason_tags || []);
  renderNotes(policy.notes || []);
  renderProbabilityList(decision.action_probabilities || {});
  renderQuickActions(payload);

  const contextBits = [
    payload.scenario?.label || "Current spot",
    payload.current_bot?.name || "Bot",
    titleCaseToken(gameState.street),
    formatBB(gameState.pot_size),
    `Action ${titleCaseToken(decision.action)}`,
  ];
  elements.chatContextStrip.textContent = contextBits.join(" · ");
}

function scheduleStateRefresh() {
  window.clearTimeout(state.refreshTimer);
  state.refreshTimer = window.setTimeout(() => {
    loadProductState();
  }, 160);
}

function buildStateRequest() {
  return {
    scenario_id: elements.scenarioSelect.value,
    preset_key: elements.presetSelect.value,
    bot_mode: currentBotMode(),
    custom_bot_name: elements.botName.value.trim(),
    custom_profile: currentCustomProfile(),
  };
}

async function loadProductState() {
  try {
    const response = await fetch("/api/product-state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildStateRequest()),
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "Failed to load product state.");
    }
    renderProduct(payload);
  } catch (error) {
    elements.scenarioTitle.textContent = "Failed to load state";
    elements.scenarioCopy.textContent = String(error);
  }
}

function applyPresetProfileToSliders(presetKey) {
  const preset = state.presetMap[presetKey];
  if (!preset?.style_profile) return;
  setSliderState(preset.style_profile, false);
}

async function loadChatStatus() {
  try {
    const response = await fetch(`/api/chat/status?t=${Date.now()}`, { cache: "no-store" });
    const payload = await response.json();
    state.chat.configured = Boolean(payload.configured);
    state.chat.provider = payload.provider || "";
    state.chat.model = payload.model || "";
  } catch {
    state.chat.configured = false;
    state.chat.provider = "";
    state.chat.model = "";
  }
  renderChat();
}

async function sendChatMessage(promptText, options = {}) {
  const content = (promptText ?? elements.chatInput.value).trim();
  if (!content || state.chat.sending || !state.product) return;

  state.chat.messages.push({ role: "user", content });
  state.chat.sending = true;
  elements.chatInput.value = "";
  renderChat();

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: state.chat.messages,
        context_package: state.product.context_package,
        request_type: options.requestType || "general",
        request_meta: options.requestMeta || {},
      }),
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "Chat request failed.");
    }
    state.chat.configured = Boolean(payload.status?.configured);
    state.chat.provider = payload.status?.provider || state.chat.provider;
    state.chat.model = payload.reply?.model || payload.status?.model || "";
    state.chat.messages.push({
      role: "assistant",
      content: payload.reply?.content || "The model returned an empty reply.",
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

buildSliderControls();
resetChat();

elements.refreshState.addEventListener("click", loadProductState);
elements.resetProfile.addEventListener("click", () => {
  applyPresetProfileToSliders(elements.presetSelect.value);
  scheduleStateRefresh();
});
elements.presetSelect.addEventListener("change", () => {
  if (currentBotMode() === "custom") {
    applyPresetProfileToSliders(elements.presetSelect.value);
  }
  scheduleStateRefresh();
});
elements.scenarioSelect.addEventListener("change", scheduleStateRefresh);
elements.botName.addEventListener("input", scheduleStateRefresh);
elements.modePreset.addEventListener("change", scheduleStateRefresh);
elements.modeCustom.addEventListener("change", scheduleStateRefresh);
elements.analyzeHand.addEventListener("click", async () => {
  await sendChatMessage("Explain the current hand and why this action was chosen.", {
    requestType: "explain_current_hand",
    requestMeta: {},
  });
});
elements.chatClear.addEventListener("click", resetChat);
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

Promise.all([loadProductState(), loadChatStatus()]).catch((error) => {
  elements.scenarioTitle.textContent = "Failed to load interface";
  elements.scenarioCopy.textContent = String(error);
});
