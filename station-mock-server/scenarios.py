from typing import Optional

class ScenarioController:
    def __init__(self):
        self.active_scenario: Optional[str] = None
        self.ticks_remaining: int = 0

    def trigger(self, scenario_type: str, duration_ticks: int):
        self.active_scenario = scenario_type
        self.ticks_remaining = max(1, duration_ticks)

    def tick(self):
        if self.ticks_remaining > 0:
            self.ticks_remaining -= 1
            if self.ticks_remaining == 0:
                self.active_scenario = None

    def clear(self):
        self.active_scenario = None
        self.ticks_remaining = 0