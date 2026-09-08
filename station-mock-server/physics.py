import math
from models import AmbientState, ThermalState, MicrogridState, FuelState, ControlsState

class StationPhysicsSimulator:
    def __init__(self, station_id: str = "BHARATI"):
        self.station_id = station_id
        
        # Bharati Technical Profile Defaults
        self.internal_temp_c = 20.4
        self.fuel_tank_liters = 420000.0  # Max capacity ~600k L
        self.u_area_factor = 2.45          # kW/K station envelope conductance
        self.thermal_capacitance = 140.0   # kJ/K heat retention capacity
        
        self.controls = ControlsState()
        self.ambient = AmbientState(
            temp_c=-14.2,
            wind_speed_knots=24.0,
            solar_flux_w_m2=145.0
        )

    def step(
        self,
        active_scenario: str | None,
        dt_seconds: float = 2.0,
        hold_ambient: dict | None = None,
    ):
        # 1. Environmental Weather Dynamics & Scenario Modifiers
        if hold_ambient:
            self.ambient.wind_speed_knots = float(hold_ambient["wind_speed_knots"])
            self.ambient.temp_c = float(hold_ambient["temp_c"])
            self.ambient.solar_flux_w_m2 = float(hold_ambient["solar_flux_w_m2"])
        elif active_scenario == "BLIZZARD_80KT":
            self.ambient.wind_speed_knots = min(82.0, self.ambient.wind_speed_knots + 3.5)
            self.ambient.temp_c = max(-36.5, self.ambient.temp_c - 1.2)
            self.ambient.solar_flux_w_m2 = 0.0
        elif active_scenario == "POLAR_NIGHT":
            self.ambient.solar_flux_w_m2 = 0.0
            self.ambient.temp_c = -28.0
            self.ambient.wind_speed_knots += (28.0 - self.ambient.wind_speed_knots) * 0.05
        elif active_scenario == "RESUPPLY_DELAY":
            # Weather normal, fuel artificially drawn down via manual injection hook
            self.ambient.solar_flux_w_m2 = 110.0
            self.ambient.wind_speed_knots += (22.0 - self.ambient.wind_speed_knots) * 0.05
            self.ambient.temp_c += (-14.0 - self.ambient.temp_c) * 0.05
        else:
            # Nominal relaxation back to baseline
            self.ambient.wind_speed_knots += (24.0 - self.ambient.wind_speed_knots) * 0.08
            self.ambient.temp_c += (-14.2 - self.ambient.temp_c) * 0.08
            self.ambient.solar_flux_w_m2 = 145.0

        # 2. Microgrid Electrical Loads
        essential_load = 180.0
        science_load = 120.0 if self.controls.science_instruments_online else 0.0
        comfort_load = 60.0 if not self.controls.summer_wing_isolated else 15.0
        total_electrical_load = essential_load + science_load + comfort_load

        # 3. Thermal Envelope Dynamics
        # Convective heat loss increases with wind speed
        wind_convective_factor = 1.0 + (0.05 * math.sqrt(max(0.0, self.ambient.wind_speed_knots)))
        delta_t = max(0.0, self.internal_temp_c - self.ambient.temp_c)
        heat_loss_kw = self.u_area_factor * delta_t * wind_convective_factor

        # Combined Heat and Power (CHP) outputs ~52% of electrical load as recirculated thermal energy
        chp_thermal_kw = total_electrical_load * 0.52
        aux_heater_kw = 90.0 if (self.controls.aux_generator_active or self.internal_temp_c < 15.0) else 0.0
        total_heat_input_kw = chp_thermal_kw + aux_heater_kw

        # Thermal ODE step
        net_heat_flow_kw = total_heat_input_kw - heat_loss_kw
        self.internal_temp_c += (net_heat_flow_kw / self.thermal_capacitance) * (dt_seconds / 60.0)

        # 4. Fuel Mass Balance (JET A1)
        burn_rate_lph = (total_electrical_load * 0.22) + (aux_heater_kw * 0.11)
        fuel_consumed_tick = burn_rate_lph * (dt_seconds / 3600.0)
        self.fuel_tank_liters = max(0.0, self.fuel_tank_liters - fuel_consumed_tick)

        days_of_autonomy = (self.fuel_tank_liters / (burn_rate_lph * 24.0)) if burn_rate_lph > 0 else 999.0

        # Construct sub-state models
        thermal = ThermalState(
            internal_temp_c=round(self.internal_temp_c, 2),
            chp_thermal_output_kw=round(chp_thermal_kw, 1),
            aux_heater_kw=round(aux_heater_kw, 1),
            heat_loss_kw=round(heat_loss_kw, 1)
        )
        microgrid = MicrogridState(
            total_load_kva=round(total_electrical_load, 1),
            essential_load_kva=essential_load,
            science_load_kva=science_load,
            comfort_load_kva=comfort_load,
            chp_capacity_kva=600.0
        )
        fuel = FuelState(
            tank_level_liters=round(self.fuel_tank_liters, 1),
            burn_rate_lph=round(burn_rate_lph, 2),
            days_of_autonomy=round(days_of_autonomy, 1)
        )

        return self.ambient, thermal, microgrid, fuel, self.controls