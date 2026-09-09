import math

from models import (
    AmbientState,
    ThermalState,
    MicrogridState,
    FuelState,
    ControlsState,
)


# ---------------------------------------------------------------------------
# Modeled nominal station fuel reserve
#
# This is a simulation baseline, not an asserted NCPOR engineering figure.
# ---------------------------------------------------------------------------

NOMINAL_FUEL_LITERS = 90000.0


class StationPhysicsSimulator:
    """
    Deterministic Antarctic station physics simulator.

    The simulator models:
      - atmospheric conditions
      - thermal envelope
      - CHP degradation
      - electrical loads
      - fuel consumption
      - station controls
      - scenario-driven degradation

    All values are synthetic / modeled for the POLARIS digital twin.
    """

    def __init__(self, station_id: str = "BHARATI"):
        self.station_id = station_id

        # Bharati technical profile defaults
        self.internal_temp_c = 20.4
        self.fuel_tank_liters = NOMINAL_FUEL_LITERS
        self.u_area_factor = 2.45
        self.thermal_capacitance = 140.0

        self.controls = ControlsState()

        # Degradation state
        self.chp_health = 1.0
        self.communication_stress = 0.0

        self.ambient = AmbientState(
            temp_c=-14.2,
            wind_speed_knots=24.0,
            solar_flux_w_m2=145.0,
            pressure_hpa=985.0,
        )
        self.live_ambient: dict | None = None
        self.weather_source = "synthetic"
        self._tick_count = 0

    def set_live_ambient(
        self,
        ambient: dict | None,
        source: str = "OPEN_METEO_FORECAST",
    ) -> None:
        self.live_ambient = ambient
        if ambient:
            self.weather_source = source
            self.ambient.temp_c = float(ambient["temp_c"])
            self.ambient.wind_speed_knots = float(ambient["wind_speed_knots"])
            self.ambient.solar_flux_w_m2 = float(ambient["solar_flux_w_m2"])

    # -----------------------------------------------------------------------
    # Station profile reset
    # -----------------------------------------------------------------------

    def reset_nominal(self, station_id: str | None = None) -> None:
        """
        Restore the simulator to a clean nominal station state.

        This is deliberately explicit so one scenario cannot contaminate
        the next station or scenario.
        """

        if station_id is not None:
            self.station_id = station_id

        self.chp_health = 1.0
        self.communication_stress = 0.0
        self.fuel_tank_liters = NOMINAL_FUEL_LITERS

        if self.station_id == "MAITRI":
            self.u_area_factor = 3.6
            self.internal_temp_c = 18.0

            self.ambient.temp_c = -18.0
            self.ambient.wind_speed_knots = 22.0
            self.ambient.solar_flux_w_m2 = 110.0
            self.ambient.pressure_hpa = 985.0

        else:
            self.u_area_factor = 2.45
            self.internal_temp_c = 20.4

            self.ambient.temp_c = -14.2
            self.ambient.wind_speed_knots = 24.0
            self.ambient.solar_flux_w_m2 = 145.0
            self.ambient.pressure_hpa = 985.0

    # -----------------------------------------------------------------------
    # Physics step
    # -----------------------------------------------------------------------

    def step(
        self,
        active_scenario: str | None,
        dt_seconds: float = 2.0,
        hold_ambient: dict | None = None,
    ):
        """
        Advance the physical simulator by one tick.

        Returns:
            ambient,
            thermal,
            microgrid,
            fuel,
            controls
        """

        self._tick_count += 1
        phase = self._tick_count * dt_seconds

        # ===================================================================
        # 1. Environmental weather dynamics
        # ===================================================================

        if hold_ambient:
            self.ambient.wind_speed_knots = float(
                hold_ambient["wind_speed_knots"]
            )
            self.ambient.temp_c = float(
                hold_ambient["temp_c"]
            )
            self.ambient.solar_flux_w_m2 = float(
                hold_ambient["solar_flux_w_m2"]
            )
            self.ambient.pressure_hpa = float(
                hold_ambient.get(
                    "pressure_hpa",
                    self.ambient.pressure_hpa,
                )
            )

        elif active_scenario == "BLIZZARD_80KT":

            # Pressure falls before the wind peak.
            # This gives the proactive engine a forecast lead time.

            self.ambient.pressure_hpa = max(
                956.4,
                self.ambient.pressure_hpa - 1.25,
            )

            self.ambient.wind_speed_knots = min(
                82.0,
                self.ambient.wind_speed_knots + 3.5,
            )

            self.ambient.temp_c = max(
                -36.5,
                self.ambient.temp_c - 1.2,
            )

            self.ambient.solar_flux_w_m2 = max(
                0.0,
                self.ambient.solar_flux_w_m2 - 30.0,
            )

        elif active_scenario == "POLAR_NIGHT":

            self.ambient.solar_flux_w_m2 = 0.0

            self.ambient.temp_c += (
                -28.0 - self.ambient.temp_c
            ) * 0.08

            self.ambient.wind_speed_knots += (
                28.0 - self.ambient.wind_speed_knots
            ) * 0.05

            self.ambient.pressure_hpa += (
                982.0 - self.ambient.pressure_hpa
            ) * 0.03

        elif active_scenario == "RESUPPLY_DELAY":

            # Weather remains operationally normal.
            # Resource availability is the primary degradation.

            self.ambient.solar_flux_w_m2 = 110.0

            self.ambient.wind_speed_knots += (
                22.0 - self.ambient.wind_speed_knots
            ) * 0.05

            self.ambient.temp_c += (
                -14.0 - self.ambient.temp_c
            ) * 0.05

            self.ambient.pressure_hpa += (
                985.0 - self.ambient.pressure_hpa
            ) * 0.05

        elif active_scenario == "MICROGRID_FAILURE":

            # CHP health degrades progressively.

            self.chp_health = max(
                0.35,
                self.chp_health - 0.035,
            )

            self.ambient.pressure_hpa += (
                985.0 - self.ambient.pressure_hpa
            ) * 0.05

        elif active_scenario == "COMMUNICATION_DEGRADATION":

            # Communications degradation is interpreted by the twin layer.
            # The edge simulator tracks stress independently.

            self.communication_stress = min(
                1.0,
                self.communication_stress + 0.12,
            )

            self.ambient.pressure_hpa += (
                985.0 - self.ambient.pressure_hpa
            ) * 0.05

        else:

            # Return environmental conditions toward the selected
            # station's nominal profile.

            if self.live_ambient:
                target = self.live_ambient
                target_temp = float(target["temp_c"])
                target_wind = float(target["wind_speed_knots"])
                target_solar = float(target["solar_flux_w_m2"])
                self.weather_source = "OPEN_METEO_FORECAST"
            elif self.station_id == "MAITRI":
                target_temp = -18.0
                target_wind = 22.0
                target_solar = 110.0
            else:
                target_temp = -14.2
                target_wind = 24.0
                target_solar = 145.0

            self.ambient.wind_speed_knots += (
                target_wind - self.ambient.wind_speed_knots
            ) * 0.08

            self.ambient.temp_c += (
                target_temp - self.ambient.temp_c
            ) * 0.08

            self.ambient.solar_flux_w_m2 += (
                target_solar - self.ambient.solar_flux_w_m2
            ) * 0.08

            self.ambient.pressure_hpa += (
                985.0 - self.ambient.pressure_hpa
            ) * 0.08

            # Recover physical degradation after scenario completion.

            self.chp_health += (
                1.0 - self.chp_health
            ) * 0.08

            self.communication_stress += (
                0.0 - self.communication_stress
            ) * 0.08

            self.ambient.wind_speed_knots += 1.6 * math.sin(phase / 7.4)
            self.ambient.temp_c += 0.22 * math.sin(phase / 9.1)
            self.ambient.solar_flux_w_m2 = max(
                0.0,
                self.ambient.solar_flux_w_m2 + 6.0 * math.sin(phase / 13.0),
            )

        # ===================================================================
        # 2. Electrical loads
        # ===================================================================

        essential_load = 180.0 + 10.0 * math.sin(phase / 11.0)

        science_load = (
            118.0 + 12.0 * math.sin(phase / 7.5) + 4.0 * math.sin(phase / 3.1)
            if self.controls.science_instruments_online
            else 0.0
        )

        comfort_load = (
            58.0 + 16.0 * math.sin(phase / 9.0) + 6.0 * math.sin(phase / 3.4)
            if not self.controls.summer_wing_isolated
            else 15.0 + 3.0 * math.sin(phase / 8.0)
        )

        total_electrical_load = (
            essential_load
            + science_load
            + comfort_load
        )

        # ===================================================================
        # 3. Thermal envelope
        # ===================================================================

        wind_convective_factor = (
            1.0
            + (
                0.05
                * math.sqrt(
                    max(
                        0.0,
                        self.ambient.wind_speed_knots,
                    )
                )
            )
        )

        delta_t = max(
            0.0,
            self.internal_temp_c - self.ambient.temp_c,
        )

        heat_loss_kw = (
            self.u_area_factor
            * delta_t
            * wind_convective_factor
        )

        # CHP thermal output degrades with CHP health.

        chp_thermal_kw = (
            total_electrical_load
            * 0.52
            * self.chp_health
        )

        setpoint = 18.5 if self.station_id == "MAITRI" else 20.4
        overshoot = max(0.0, self.internal_temp_c - setpoint)
        chp_thermal_kw = max(
            28.0,
            chp_thermal_kw * math.exp(-overshoot / 6.0),
        )

        aux_heater_kw = (
            90.0
            if (
                self.controls.aux_generator_active
                or self.internal_temp_c < 15.0
            )
            else 0.0
        )

        total_heat_input_kw = (
            chp_thermal_kw
            + aux_heater_kw
        )

        net_heat_flow_kw = (
            total_heat_input_kw
            - heat_loss_kw
        )

        self.internal_temp_c += (
            net_heat_flow_kw
            / self.thermal_capacitance
        ) * (
            dt_seconds / 60.0
        )

        # ===================================================================
        # 4. Fuel mass balance
        # ===================================================================

        burn_rate_lph = (
            (total_electrical_load * 0.22)
            + (aux_heater_kw * 0.11)
        )

        if active_scenario == "RESUPPLY_DELAY":
            burn_rate_lph *= 1.35

        fuel_consumed_tick = (
            burn_rate_lph
            * (dt_seconds / 3600.0)
        )

        self.fuel_tank_liters = max(
            0.0,
            self.fuel_tank_liters
            - fuel_consumed_tick,
        )

        days_of_autonomy = (
            self.fuel_tank_liters
            / (burn_rate_lph * 24.0)
            if burn_rate_lph > 0
            else 999.0
        )

        # ===================================================================
        # 5. Construct telemetry states
        # ===================================================================

        thermal = ThermalState(
            internal_temp_c=round(
                self.internal_temp_c,
                2,
            ),
            chp_thermal_output_kw=round(
                chp_thermal_kw,
                1,
            ),
            aux_heater_kw=round(
                aux_heater_kw,
                1,
            ),
            heat_loss_kw=round(
                heat_loss_kw,
                1,
            ),
        )

        microgrid = MicrogridState(
            total_load_kva=round(
                total_electrical_load,
                1,
            ),
            essential_load_kva=round(essential_load, 1),
            science_load_kva=round(science_load, 1),
            comfort_load_kva=round(comfort_load, 1),
            chp_capacity_kva=round(
                600.0 * self.chp_health,
                1,
            ),
        )

        fuel = FuelState(
            tank_level_liters=round(
                self.fuel_tank_liters,
                1,
            ),
            burn_rate_lph=round(
                burn_rate_lph,
                2,
            ),
            days_of_autonomy=round(
                days_of_autonomy,
                1,
            ),
        )

        return (
            self.ambient,
            thermal,
            microgrid,
            fuel,
            self.controls,
        )