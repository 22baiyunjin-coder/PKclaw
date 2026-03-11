from __future__ import annotations

from dataclasses import asdict

from .cards import Card
from .engine import HandPlayer, HandResult

BOARD_BY_STREET = {
    "preflop": 0,
    "flop": 3,
    "turn": 4,
    "river": 5,
}


def _serialize_cards(cards: list[Card]) -> list[str]:
    return [str(card) for card in cards]


def _initial_player_state(player: HandPlayer) -> dict[str, object]:
    return {
        "name": player.name,
        "position": player.position,
        "profile_name": player.profile_name,
        "hole_cards": _serialize_cards(player.hole_cards),
        "stack": round(player.starting_stack, 2),
        "street_bet": 0.0,
        "total_committed": 0.0,
        "in_hand": True,
        "all_in": False,
        "status": "waiting",
        "last_action": "",
    }


def _snapshot(players: dict[str, dict[str, object]], board: list[str], pot: float, street: str, headline: str, acting_player: str | None = None, winners: list[str] | None = None) -> dict[str, object]:
    ordered = sorted(players.values(), key=lambda item: ["UTG", "UTG+1", "MP", "HJ", "CO", "BTN", "SB", "BB"].index(str(item["position"])))
    return {
        "street": street,
        "board": board[:],
        "pot": round(pot, 2),
        "headline": headline,
        "acting_player": acting_player,
        "winners": winners or [],
        "players": [dict(player) for player in ordered],
    }


def build_hand_replay(result: HandResult) -> dict[str, object]:
    players = {player.name: _initial_player_state(player) for player in result.players}
    events: list[dict[str, object]] = []
    board: list[str] = []
    pot = 0.0
    street = "preflop"
    current_bet = 0.0
    previous_street = "preflop"

    events.append(
        {
            "kind": "hand_start",
            "street": street,
            "label": f"Hand #{result.hand_id} starts",
            "snapshot": _snapshot(players, board, pot, street, "Cards are in the air."),
        }
    )

    for action in result.action_history:
        if action.street != previous_street:
            street = action.street
            board = _serialize_cards(result.board[: BOARD_BY_STREET[street]])
            current_bet = 0.0
            for player_state in players.values():
                player_state["street_bet"] = 0.0
                if player_state["in_hand"] and not player_state["all_in"]:
                    player_state["status"] = "waiting"
            events.append(
                {
                    "kind": "street_deal",
                    "street": street,
                    "label": f"{street.title()} cards dealt",
                    "snapshot": _snapshot(players, board, pot, street, f"{street.title()} is on the board."),
                }
            )
            previous_street = street

        player_state = players[action.player_name]
        if player_state["in_hand"]:
            player_state["status"] = "acting"

        if action.note == "blind_post":
            player_state["stack"] = round(float(player_state["stack"]) - action.amount, 2)
            player_state["street_bet"] = round(float(player_state["street_bet"]) + action.amount, 2)
            player_state["total_committed"] = round(float(player_state["total_committed"]) + action.amount, 2)
            pot = round(pot + action.amount, 2)
            current_bet = max(current_bet, float(player_state["street_bet"]))
            player_state["last_action"] = f"posted {action.amount:.1f} BB"
            player_state["all_in"] = float(player_state["stack"]) <= 0
            player_state["status"] = "waiting"
            events.append(
                {
                    "kind": "blind_post",
                    "street": action.street,
                    "label": f"{action.player_name} posts {action.amount:.1f} BB",
                    "snapshot": _snapshot(players, board, pot, action.street, f"{action.player_name} posts blind.", acting_player=action.player_name),
                }
            )
            continue

        if action.action == "fold":
            player_state["in_hand"] = False
            player_state["status"] = "folded"
            player_state["last_action"] = "fold"
        elif action.action == "check":
            player_state["status"] = "checked"
            player_state["last_action"] = "check"
        else:
            player_state["stack"] = round(float(player_state["stack"]) - action.amount, 2)
            player_state["street_bet"] = round(float(player_state["street_bet"]) + action.amount, 2)
            player_state["total_committed"] = round(float(player_state["total_committed"]) + action.amount, 2)
            player_state["all_in"] = float(player_state["stack"]) <= 0
            pot = round(pot + action.amount, 2)
            current_bet = max(current_bet, float(player_state["street_bet"]))
            if action.action == "call":
                player_state["status"] = "called"
                player_state["last_action"] = f"call {action.amount:.1f} BB"
            elif action.action == "bet":
                player_state["status"] = "bet"
                player_state["last_action"] = f"bet {action.amount:.1f} BB"
            elif action.action == "raise":
                player_state["status"] = "raised"
                player_state["last_action"] = f"raise {action.amount:.1f} BB"

        for other_name, other_state in players.items():
            if other_name != action.player_name and other_state["in_hand"] and not other_state["all_in"] and other_state["status"] == "acting":
                other_state["status"] = "waiting"

        events.append(
            {
                "kind": "action",
                "street": action.street,
                "label": f"{action.player_name} {action.action}{f' {action.amount:.1f} BB' if action.amount else ''}",
                "action": asdict(action),
                "snapshot": _snapshot(players, board, pot, action.street, f"{action.player_name} chooses {action.action}.", acting_player=action.player_name),
            }
        )

    final_board = _serialize_cards(result.board)
    if result.showdown:
        events.append(
            {
                "kind": "showdown",
                "street": "river" if len(final_board) == 5 else previous_street,
                "label": "Showdown",
                "snapshot": _snapshot(players, final_board, pot, "river" if len(final_board) == 5 else previous_street, "Cards tabled at showdown.", winners=result.winners),
            }
        )

    for player_name, stack in result.stacks.items():
        players[player_name]["stack"] = stack
        if player_name in result.winners:
            players[player_name]["status"] = "winner"
            players[player_name]["last_action"] = "wins pot"
        elif not players[player_name]["in_hand"]:
            players[player_name]["status"] = "folded"
        else:
            players[player_name]["status"] = "showed"

    events.append(
        {
            "kind": "hand_complete",
            "street": "river" if len(final_board) == 5 else previous_street,
            "label": f"Winners: {', '.join(result.winners)}",
            "snapshot": _snapshot(players, final_board, result.pot, "river" if len(final_board) == 5 else previous_street, f"Pot pushed to {', '.join(result.winners)}.", winners=result.winners),
        }
    )

    return {
        "hand_id": result.hand_id,
        "starting_stack": result.starting_stack,
        "small_blind": result.small_blind,
        "big_blind": result.big_blind,
        "players": [
            {
                "name": player.name,
                "position": player.position,
                "profile_name": player.profile_name,
                "hole_cards": _serialize_cards(player.hole_cards),
            }
            for player in result.players
        ],
        "board": final_board,
        "pot": result.pot,
        "winners": result.winners,
        "showdown": result.showdown,
        "events": events,
    }
