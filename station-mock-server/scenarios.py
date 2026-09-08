from typing import Any, Optional


class ScenarioController:
    def __init__(self):
        self.active_scenario: Optional[str] = None
        self.ticks_remaining: int = 0
        self.hold: bool = False
        self.replay_clock: Optional[str] = None
        self.snapshot: Optional[dict[str, Any]] = None

    def trigger(self, scenario_type: str, duration_ticks: int):
        self.hold = False
        self.replay_clock = None
        self.snapshot = None
        self.active_scenario = scenario_type
        self.ticks_remaining = max(1, duration_ticks)

    def trigger_replay(self, snapshot: dict[str, Any]):
        self.active_scenario = snapshot.get("scenario_id")
        self.ticks_remaining = 0
        self.hold = True
        self.replay_clock = snapshot.get("clock")
        self.snapshot = snapshot

    def tick(self):
        if self.hold:
            return
        if self.ticks_remaining > 0:
            self.ticks_remaining -= 1
            if self.ticks_remaining == 0:
                self.active_scenario = None

    def clear(self):
        self.active_scenario = None
        self.ticks_remaining = 0
        self.hold = False
        self.replay_clock = None
        self.snapshot = None
