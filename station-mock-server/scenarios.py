from typing import Any, Optional


class ScenarioController:
    """
    Controls active synthetic scenarios and historical replay state.
    """

    def __init__(self):
        self.active_scenario: Optional[str] = None
        self.ticks_remaining: int = 0

        self.hold: bool = False
        self.replay_clock: Optional[str] = None
        self.snapshot: Optional[dict[str, Any]] = None

    # -----------------------------------------------------------------------
    # Scenario control
    # -----------------------------------------------------------------------

    def trigger(
        self,
        scenario_type: str,
        duration_ticks: int,
    ) -> None:
        self.hold = False
        self.replay_clock = None
        self.snapshot = None

        self.active_scenario = scenario_type
        self.ticks_remaining = max(
            1,
            duration_ticks,
        )

    def tick(self) -> None:
        if self.hold:
            return

        if self.ticks_remaining > 0:
            self.ticks_remaining -= 1

            if self.ticks_remaining == 0:
                self.active_scenario = None

    def clear(self) -> None:
        self.active_scenario = None
        self.ticks_remaining = 0

        self.hold = False
        self.replay_clock = None
        self.snapshot = None

    # -----------------------------------------------------------------------
    # Replay
    # -----------------------------------------------------------------------

    def trigger_replay(
        self,
        snapshot: dict[str, Any],
    ) -> None:
        self.active_scenario = snapshot.get(
            "scenario_id"
        )

        self.ticks_remaining = 0
        self.hold = True

        self.replay_clock = snapshot.get(
            "clock"
        )

        self.snapshot = snapshot

    def clear_replay(self) -> None:
        self.hold = False
        self.replay_clock = None
        self.snapshot = None

        if self.active_scenario is not None:
            self.active_scenario = None

        self.ticks_remaining = 0

    # -----------------------------------------------------------------------
    # Compatibility properties
    # -----------------------------------------------------------------------

    @property
    def replay_active(self) -> bool:
        return self.hold

    @property
    def replay_id(self) -> Optional[str]:
        if not self.snapshot:
            return None

        return self.snapshot.get(
            "scenario_id"
        )

    @property
    def replay_progress(self) -> Optional[float]:
        if not self.hold:
            return None

        return 1.0