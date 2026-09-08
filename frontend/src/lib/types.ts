export type StationId = 'BHARATI' | 'MAITRI'
export type Severity = 'NOMINAL' | 'ADVISORY' | 'CRITICAL'
export type LinkHealth = 'ONLINE' | 'DEGRADED'
export type ScenarioKey = 'BLIZZARD_80KT' | 'RESUPPLY_DELAY' | 'POLAR_NIGHT'
export type Subsystem = 'GENERATOR' | 'FUEL_FARM' | 'RADOME' | 'HABITAT' | null

export interface StationTelemetry {
  station_id: StationId
  timestamp: string
  source: 'synthetic'
  confidence: 'modeled'
  ambient: {
    temp_c: number
    wind_speed_knots: number
    solar_flux_w_m2: number
  }
  thermal: {
    internal_temp_c: number
    chp_thermal_output_kw: number
    aux_heater_kw: number
    heat_loss_kw: number
  }
  microgrid: {
    total_load_kva: number
    essential_load_kva: number
    science_load_kva: number
    comfort_load_kva: number
    chp_capacity_kva: number
  }
  fuel: {
    tank_level_liters: number
    burn_rate_lph: number
    days_of_autonomy: number
  }
  controls: {
    science_instruments_online: boolean
    summer_wing_isolated: boolean
    hatch_lockdown: boolean
    aux_generator_active: boolean
  }
  link_status: {
    type: 'C-band/LEO'
    latency_ms: number
    health: LinkHealth
  }
  risk: {
    anomaly_score: number
    is_anomaly: boolean
    severity: Severity
    prescribed_actions: string[]
  }
}

export interface TelemetryHistoryPoint {
  t: number
  internal_temp_c: number
  ambient_temp_c: number
  total_load_kva: number
  fuel_level: number
}
