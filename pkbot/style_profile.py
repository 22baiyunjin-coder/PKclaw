from __future__ import annotations

from dataclasses import dataclass


@dataclass(slots=True)
class StyleProfile:
    name: str
    vpip: int = 24
    pfr: int = 19
    three_bet: int = 9
    aggression: int = 55
    flop_cbet: int = 62
    turn_barrel: int = 49
    river_bluff: int = 38
    hero_call: int = 46
    risk_tolerance: int = 48

    def __post_init__(self) -> None:
        self.validate()

    def validate(self) -> None:
        for field_name in (
            "vpip",
            "pfr",
            "three_bet",
            "aggression",
            "flop_cbet",
            "turn_barrel",
            "river_bluff",
            "hero_call",
            "risk_tolerance",
        ):
            value = getattr(self, field_name)
            if not 0 <= value <= 100:
                raise ValueError(f"{field_name} must be between 0 and 100")

    def normalized(self, field_name: str) -> float:
        return getattr(self, field_name) / 100.0

    def clone(self, name: str | None = None, **overrides: int) -> "StyleProfile":
        values = {
            "name": name or self.name,
            "vpip": self.vpip,
            "pfr": self.pfr,
            "three_bet": self.three_bet,
            "aggression": self.aggression,
            "flop_cbet": self.flop_cbet,
            "turn_barrel": self.turn_barrel,
            "river_bluff": self.river_bluff,
            "hero_call": self.hero_call,
            "risk_tolerance": self.risk_tolerance,
        }
        values.update(overrides)
        return StyleProfile(**values)

    def describe(self) -> str:
        return (
            f"VPIP {self.vpip}, PFR {self.pfr}, 3B {self.three_bet}, AGG {self.aggression}, "
            f"F-CBet {self.flop_cbet}, T-Barrel {self.turn_barrel}, R-Bluff {self.river_bluff}, "
            f"HeroCall {self.hero_call}, Risk {self.risk_tolerance}"
        )
