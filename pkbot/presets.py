from __future__ import annotations

from .style_profile import StyleProfile

PRESET_PROFILES: dict[str, StyleProfile] = {
    "nit": StyleProfile("Nit", vpip=16, pfr=13, three_bet=5, aggression=28, flop_cbet=42, turn_barrel=26, river_bluff=15, hero_call=22, risk_tolerance=20),
    "tag": StyleProfile("TAG", vpip=22, pfr=18, three_bet=8, aggression=52, flop_cbet=60, turn_barrel=46, river_bluff=32, hero_call=38, risk_tolerance=42),
    "balanced_reg": StyleProfile("Balanced Reg", vpip=24, pfr=19, three_bet=9, aggression=56, flop_cbet=62, turn_barrel=49, river_bluff=38, hero_call=46, risk_tolerance=48),
    "lag": StyleProfile("LAG", vpip=31, pfr=25, three_bet=13, aggression=72, flop_cbet=73, turn_barrel=62, river_bluff=55, hero_call=42, risk_tolerance=65),
    "calling_station": StyleProfile("Calling Station", vpip=34, pfr=10, three_bet=4, aggression=20, flop_cbet=28, turn_barrel=16, river_bluff=10, hero_call=78, risk_tolerance=40),
    "maniac": StyleProfile("Maniac", vpip=42, pfr=34, three_bet=18, aggression=90, flop_cbet=85, turn_barrel=80, river_bluff=72, hero_call=34, risk_tolerance=88),
    "trapper": StyleProfile("Trapper", vpip=23, pfr=15, three_bet=7, aggression=40, flop_cbet=48, turn_barrel=39, river_bluff=24, hero_call=60, risk_tolerance=35),
    "pressure_reg": StyleProfile("Pressure Reg", vpip=27, pfr=22, three_bet=12, aggression=68, flop_cbet=76, turn_barrel=67, river_bluff=50, hero_call=40, risk_tolerance=60),
}


def preset_cycle_for_table() -> list[StyleProfile]:
    order = [
        "nit",
        "tag",
        "balanced_reg",
        "lag",
        "calling_station",
        "maniac",
        "trapper",
        "pressure_reg",
    ]
    return [PRESET_PROFILES[key].clone() for key in order]
