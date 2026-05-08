CREATE TABLE IF NOT EXISTS smartsurf_rider_profiles (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  traccar_user_id INT NOT NULL,
  full_name VARCHAR(255),
  display_name VARCHAR(120),
  phone VARCHAR(64),
  country VARCHAR(120),
  home_spot VARCHAR(255),
  preferred_language VARCHAR(32),
  weight_kg DECIMAL(6,2),
  height_cm DECIMAL(6,2),
  age INT,
  fitness_level VARCHAR(64),
  skill_level VARCHAR(64),
  riding_style VARCHAR(64),
  preferred_units VARCHAR(32),
  wind_units VARCHAR(32),
  privacy_mode VARCHAR(64),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY ux_smartsurf_rider_user (traccar_user_id)
);

CREATE TABLE IF NOT EXISTS smartsurf_emergency_contacts (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  traccar_user_id INT NOT NULL,
  contact_order INT NOT NULL DEFAULT 1,
  name VARCHAR(255),
  phone VARCHAR(64),
  email VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_smartsurf_contacts_user (traccar_user_id)
);

CREATE TABLE IF NOT EXISTS smartsurf_safety_settings (
  traccar_user_id INT PRIMARY KEY,
  medical_notes TEXT,
  swimming_level VARCHAR(64),
  rescue_notes TEXT,
  local_safety_network_enabled BOOLEAN DEFAULT FALSE,
  helper_mode_enabled BOOLEAN DEFAULT FALSE,
  station_sharing_enabled BOOLEAN DEFAULT FALSE,
  show_incident_on_spot_map BOOLEAN DEFAULT FALSE,
  share_identity_to_station BOOLEAN DEFAULT FALSE,
  share_exact_location_during_emergency BOOLEAN DEFAULT TRUE,
  alert_radius_meters INT DEFAULT 3000,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS smartsurf_gear_kites (
  kite_id BIGINT PRIMARY KEY AUTO_INCREMENT,
  traccar_user_id INT NOT NULL,
  brand VARCHAR(120),
  model VARCHAR(120),
  size_m2 DECIMAL(5,2),
  year INT,
  type VARCHAR(64),
  wind_range_low DECIMAL(6,2),
  wind_range_high DECIMAL(6,2),
  notes TEXT,
  active BOOLEAN DEFAULT TRUE,
  KEY idx_smartsurf_kites_user (traccar_user_id)
);

CREATE TABLE IF NOT EXISTS smartsurf_gear_boards (
  board_id BIGINT PRIMARY KEY AUTO_INCREMENT,
  traccar_user_id INT NOT NULL,
  brand VARCHAR(120),
  model VARCHAR(120),
  board_type VARCHAR(64),
  length_cm DECIMAL(7,2),
  volume_l DECIMAL(7,2),
  foil_compatible BOOLEAN DEFAULT FALSE,
  notes TEXT,
  active BOOLEAN DEFAULT TRUE,
  KEY idx_smartsurf_boards_user (traccar_user_id)
);

CREATE TABLE IF NOT EXISTS smartsurf_gear_foils (
  foil_id BIGINT PRIMARY KEY AUTO_INCREMENT,
  traccar_user_id INT NOT NULL,
  brand VARCHAR(120),
  model VARCHAR(120),
  mast_length_cm DECIMAL(7,2),
  front_wing_area_cm2 DECIMAL(9,2),
  discipline VARCHAR(64),
  notes TEXT,
  active BOOLEAN DEFAULT TRUE,
  KEY idx_smartsurf_foils_user (traccar_user_id)
);

CREATE TABLE IF NOT EXISTS smartsurf_tracking_devices (
  device_id BIGINT PRIMARY KEY AUTO_INCREMENT,
  traccar_user_id INT NOT NULL,
  traccar_device_id INT,
  device_type VARCHAR(80),
  label VARCHAR(160),
  assigned_to VARCHAR(64),
  battery_level DECIMAL(5,2),
  last_seen TIMESTAMP NULL,
  active BOOLEAN DEFAULT TRUE,
  waterproof_tracker BOOLEAN DEFAULT FALSE,
  solar_powered BOOLEAN DEFAULT FALSE,
  hardware_version VARCHAR(64),
  firmware_version VARCHAR(64),
  KEY idx_smartsurf_tracking_user (traccar_user_id),
  KEY idx_smartsurf_tracking_traccar_device (traccar_device_id)
);

CREATE TABLE IF NOT EXISTS smartsurf_spots (
  spot_id BIGINT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  country VARCHAR(120),
  region VARCHAR(160),
  lat DECIMAL(10,7),
  lon DECIMAL(10,7),
  launch_zone_polygon JSON,
  safe_zone_polygon JSON,
  danger_zone_polygon JSON,
  offshore_direction_degrees DECIMAL(6,2),
  common_wind_directions VARCHAR(255),
  typical_hazards TEXT,
  rescue_contact VARCHAR(255),
  station_contact VARCHAR(255),
  notes TEXT
);

CREATE TABLE IF NOT EXISTS smartsurf_sessions (
  session_id BIGINT PRIMARY KEY AUTO_INCREMENT,
  traccar_user_id INT NOT NULL,
  spot_id BIGINT,
  tracking_device_id BIGINT,
  start_time TIMESTAMP NULL,
  end_time TIMESTAMP NULL,
  status VARCHAR(64) DEFAULT 'planned',
  launch_lat DECIMAL(10,7),
  launch_lon DECIMAL(10,7),
  selected_kite_id BIGINT,
  selected_board_id BIGINT,
  selected_foil_id BIGINT,
  rider_weight_at_session DECIMAL(6,2),
  senlay_environmental_snapshot JSON,
  pre_session_recommendation JSON,
  risk_level_at_start VARCHAR(64),
  max_distance_from_launch DECIMAL(10,2),
  total_distance DECIMAL(10,2),
  max_speed DECIMAL(10,2),
  average_speed DECIMAL(10,2),
  incident_count INT DEFAULT 0,
  notes TEXT,
  KEY idx_smartsurf_sessions_user_time (traccar_user_id, start_time),
  KEY idx_smartsurf_sessions_status (status)
);

CREATE TABLE IF NOT EXISTS smartsurf_incidents (
  incident_id BIGINT PRIMARY KEY AUTO_INCREMENT,
  session_id BIGINT,
  traccar_user_id INT NOT NULL,
  type VARCHAR(80),
  risk_level VARCHAR(64),
  status VARCHAR(80),
  lat DECIMAL(10,7),
  lon DECIMAL(10,7),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_update_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  reason TEXT,
  senlay_context_snapshot JSON,
  traccar_position_snapshot JSON,
  notified_contacts JSON,
  notified_helpers JSON,
  notified_station JSON,
  KEY idx_smartsurf_incidents_user_status (traccar_user_id, status),
  KEY idx_smartsurf_incidents_session (session_id)
);
