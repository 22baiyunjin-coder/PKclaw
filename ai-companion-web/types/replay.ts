export type TableStreet = "preflop" | "flop" | "turn" | "river";

export type TableSeatKey =
  | "top"
  | "upperRight"
  | "midRight"
  | "lowerRight"
  | "bottom"
  | "lowerLeft"
  | "midLeft"
  | "upperLeft";

export interface ReplayPlayer {
  seatKey: TableSeatKey;
  position: string;
  name: string;
  personaId: string;
  stack: number;
  streetBet: number;
  totalCommitted: number;
  inHand: boolean;
  allIn: boolean;
  lastAction: string;
  status: string;
  holeCards: [string, string];
}

export interface ReplaySnapshot {
  street: TableStreet;
  board: string[];
  pot: number;
  headline: string;
  actingPlayer?: string | null;
  winners: string[];
  players: ReplayPlayer[];
}

export interface ReplayAction {
  playerName: string;
  action: string;
  amount?: number;
  note?: string;
}

export interface ReplayEvent {
  kind:
    | "hand_start"
    | "blind_post"
    | "action"
    | "street_deal"
    | "showdown"
    | "hand_complete";
  street: TableStreet;
  label: string;
  snapshot: ReplaySnapshot;
  action?: ReplayAction;
}

export interface ReplayHand {
  handId: string;
  tableName: string;
  smallBlind: number;
  bigBlind: number;
  stageGoal: string;
  seedLabel: string;
  events: ReplayEvent[];
}
