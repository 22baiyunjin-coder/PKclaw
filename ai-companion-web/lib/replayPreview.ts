import type { ReplayEvent, ReplayHand, ReplayPlayer, ReplaySnapshot, TableStreet } from "@/types/replay";

const STREETS: TableStreet[] = ["preflop", "flop", "turn", "river"];

interface ReplayBuildState {
  players: ReplayPlayer[];
  board: string[];
  pot: number;
  street: TableStreet;
  events: ReplayEvent[];
}

function clonePlayers(players: ReplayPlayer[]): ReplayPlayer[] {
  return players.map((player) => ({ ...player, holeCards: [...player.holeCards] as [string, string] }));
}

function formatStreet(street: TableStreet): string {
  return street.charAt(0).toUpperCase() + street.slice(1);
}

function createSnapshot(
  state: ReplayBuildState,
  headline: string,
  actingPlayer?: string | null,
  winners: string[] = [],
): ReplaySnapshot {
  return {
    street: state.street,
    board: [...state.board],
    pot: state.pot,
    headline,
    actingPlayer: actingPlayer ?? null,
    winners,
    players: clonePlayers(state.players),
  };
}

function pushEvent(
  state: ReplayBuildState,
  kind: ReplayEvent["kind"],
  label: string,
  headline: string,
  actingPlayer?: string | null,
  action?: ReplayEvent["action"],
  winners: string[] = [],
): void {
  state.events.push({
    kind,
    street: state.street,
    label,
    action,
    snapshot: createSnapshot(state, headline, actingPlayer, winners),
  });
}

function findPlayer(state: ReplayBuildState, name: string): ReplayPlayer {
  const player = state.players.find((item) => item.name === name);

  if (!player) {
    throw new Error(`Unknown replay player: ${name}`);
  }

  return player;
}

function applyBlind(state: ReplayBuildState, name: string, amount: number): void {
  const player = findPlayer(state, name);

  player.stack -= amount;
  player.streetBet += amount;
  player.totalCommitted += amount;
  player.lastAction = `posts ${amount}`;
  player.status = "posted";
  state.pot += amount;
}

function resetStreetBets(state: ReplayBuildState): void {
  state.players.forEach((player) => {
    player.streetBet = 0;

    if (player.inHand && !player.allIn) {
      player.status = "waiting";
    }
  });
}

function streetDeal(state: ReplayBuildState, street: TableStreet, board: string[], headline: string): void {
  state.street = street;
  state.board = board;
  resetStreetBets(state);
  pushEvent(
    state,
    "street_deal",
    `${formatStreet(street)} dealt`,
    headline,
  );
}

function applyAction(
  state: ReplayBuildState,
  name: string,
  action: "fold" | "check" | "call" | "bet" | "raise",
  amount = 0,
): void {
  const player = findPlayer(state, name);

  state.players.forEach((item) => {
    if (item.inHand && item.name !== name && item.status === "acting") {
      item.status = "waiting";
    }
  });

  player.status = "acting";

  if (action === "fold") {
    player.inHand = false;
    player.lastAction = "fold";
    player.status = "folded";
  } else if (action === "check") {
    player.lastAction = "check";
    player.status = "checked";
  } else {
    player.stack -= amount;
    player.streetBet += amount;
    player.totalCommitted += amount;
    player.lastAction = `${action} ${amount}`;
    player.status = action === "raise" ? "raised" : action === "bet" ? "bet" : "called";
    state.pot += amount;
  }

  pushEvent(
    state,
    "action",
    `${name} ${action}${amount > 0 ? ` ${amount}` : ""}`,
    `${name} chooses ${action}.`,
    name,
    {
      playerName: name,
      action,
      amount,
    },
  );
}

function buildBasePlayers(): ReplayPlayer[] {
  return [
    {
      seatKey: "top",
      position: "UTG",
      name: "Range Auditor",
      personaId: "range_auditor",
      stack: 3200,
      streetBet: 0,
      totalCommitted: 0,
      inHand: true,
      allIn: false,
      lastAction: "waiting",
      status: "waiting",
      holeCards: ["??", "??"],
    },
    {
      seatKey: "upperRight",
      position: "HJ",
      name: "Field Hunter",
      personaId: "field_hunter",
      stack: 4100,
      streetBet: 0,
      totalCommitted: 0,
      inHand: true,
      allIn: false,
      lastAction: "waiting",
      status: "waiting",
      holeCards: ["??", "??"],
    },
    {
      seatKey: "midRight",
      position: "CO",
      name: "Solver Mirror",
      personaId: "solver_mirror",
      stack: 2780,
      streetBet: 0,
      totalCommitted: 0,
      inHand: true,
      allIn: false,
      lastAction: "waiting",
      status: "waiting",
      holeCards: ["??", "??"],
    },
    {
      seatKey: "lowerRight",
      position: "BTN",
      name: "Pressure Queen",
      personaId: "pressure_queen",
      stack: 3560,
      streetBet: 0,
      totalCommitted: 0,
      inHand: true,
      allIn: false,
      lastAction: "waiting",
      status: "waiting",
      holeCards: ["??", "??"],
    },
    {
      seatKey: "bottom",
      position: "BB",
      name: "Hero",
      personaId: "pkmind_core",
      stack: 1890,
      streetBet: 0,
      totalCommitted: 0,
      inHand: true,
      allIn: false,
      lastAction: "waiting",
      status: "hero",
      holeCards: ["Ah", "Qs"],
    },
    {
      seatKey: "lowerLeft",
      position: "SB",
      name: "Old School Liu",
      personaId: "old_school_liu",
      stack: 2275,
      streetBet: 0,
      totalCommitted: 0,
      inHand: true,
      allIn: false,
      lastAction: "waiting",
      status: "waiting",
      holeCards: ["??", "??"],
    },
    {
      seatKey: "midLeft",
      position: "MP",
      name: "River Mayor",
      personaId: "river_mayor",
      stack: 2450,
      streetBet: 0,
      totalCommitted: 0,
      inHand: true,
      allIn: false,
      lastAction: "waiting",
      status: "waiting",
      holeCards: ["??", "??"],
    },
    {
      seatKey: "upperLeft",
      position: "UTG+1",
      name: "Ice Wall Leo",
      personaId: "ice_wall_leo",
      stack: 3010,
      streetBet: 0,
      totalCommitted: 0,
      inHand: true,
      allIn: false,
      lastAction: "waiting",
      status: "waiting",
      holeCards: ["??", "??"],
    },
  ];
}

function buildSampleHand(seed: number): ReplayHand {
  const state: ReplayBuildState = {
    players: buildBasePlayers(),
    board: [],
    pot: 0,
    street: STREETS[0],
    events: [],
  };

  pushEvent(
    state,
    "hand_start",
    "Hand begins",
    "Cards are in the air. The table is waiting for the first voluntary action.",
  );

  applyBlind(state, "Old School Liu", 5);
  pushEvent(state, "blind_post", "Old School Liu posts 5", "Small blind is posted.", "Old School Liu", {
    playerName: "Old School Liu",
    action: "post",
    amount: 5,
    note: "blind_post",
  });

  applyBlind(state, "Hero", 10);
  pushEvent(state, "blind_post", "Hero posts 10", "Big blind is posted.", "Hero", {
    playerName: "Hero",
    action: "post",
    amount: 10,
    note: "blind_post",
  });

  applyAction(state, "Range Auditor", "fold");
  applyAction(state, "Ice Wall Leo", "fold");
  applyAction(state, "Field Hunter", "raise", 25);
  applyAction(state, "Solver Mirror", "call", 25);
  applyAction(state, "Pressure Queen", "fold");
  applyAction(state, "Old School Liu", "fold");
  applyAction(state, "Hero", "call", 15);

  streetDeal(
    state,
    "flop",
    ["Kc", "9d", "2c"],
    "Flop lands Kc 9d 2c. The pot is now big enough to punish weak continuations.",
  );

  applyAction(state, "Hero", "check");
  applyAction(state, "Field Hunter", "bet", 35);
  applyAction(state, "Solver Mirror", "call", 35);
  applyAction(state, "Hero", "fold");

  streetDeal(
    state,
    "turn",
    ["Kc", "9d", "2c", "Jc"],
    "Turn brings the third club and the pressure shifts to range advantage plus nut coverage.",
  );

  applyAction(state, "Field Hunter", "check");
  applyAction(state, "Solver Mirror", "bet", 95);
  applyAction(state, "Field Hunter", "fold");

  const winner = findPlayer(state, "Solver Mirror");
  winner.status = "winner";
  winner.lastAction = "wins pot";

  state.players.forEach((player) => {
    if (player.name !== "Solver Mirror" && !player.inHand) {
      player.status = "folded";
    }
  });

  pushEvent(
    state,
    "hand_complete",
    "Solver Mirror wins",
    "The pressure line gets through. Solver Mirror takes the pot without showdown.",
    null,
    undefined,
    ["Solver Mirror"],
  );

  return {
    handId: `PKM-${seed}`,
    tableName: "PKmind Replay Arena",
    smallBlind: 5,
    bigBlind: 10,
    stageGoal: "Text / voice -> structured hand reconstruction -> 8-bot replay",
    seedLabel: `Seed ${seed}`,
    events: state.events,
  };
}

export function buildReplayPreview(seed = Math.floor(Math.random() * 9000) + 1000): ReplayHand {
  return buildSampleHand(seed);
}

export function buildReplayContext(hand: ReplayHand, stepIndex: number): Record<string, unknown> | null {
  const event = hand.events[stepIndex];

  if (!event) {
    return null;
  }

  return {
    handId: hand.handId,
    tableName: hand.tableName,
    stageGoal: hand.stageGoal,
    event: {
      kind: event.kind,
      label: event.label,
      street: event.street,
    },
    snapshot: {
      headline: event.snapshot.headline,
      pot: event.snapshot.pot,
      board: event.snapshot.board,
      actingPlayer: event.snapshot.actingPlayer,
      winners: event.snapshot.winners,
      players: event.snapshot.players.map((player) => ({
        name: player.name,
        position: player.position,
        stack: player.stack,
        lastAction: player.lastAction,
        status: player.status,
        inHand: player.inHand,
      })),
    },
  };
}
