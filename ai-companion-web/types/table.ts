export type SeatPosition =
  | "top"
  | "upperRight"
  | "midRight"
  | "lowerRight"
  | "bottom"
  | "lowerLeft"
  | "midLeft"
  | "upperLeft";

export type SeatState = "waiting" | "acted" | "focused" | "hero";

export interface TableSeat {
  id: string;
  name: string;
  stackLabel: string;
  betLabel?: string;
  tag?: string;
  holeCards?: [string, string];
  position: SeatPosition;
  state: SeatState;
}

export interface TableBoardState {
  tableName: string;
  blindsLabel: string;
  potLabel: string;
  actionLabel: string;
  stageLabel: string;
  communityCards: [string, string, string, string, string];
  seats: TableSeat[];
  reconstructionHint: string;
}
