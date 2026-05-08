export const SMARTSURF_SAFETY_CONTEXT_VERSION = '1.0';

export const hazardClasses = [
  'land_phase_power_control',
  'lofting_or_dragging',
  'offshore_drift',
  'equipment_or_board_separation',
  'rip_or_current_entrapment',
  'impact_zone_hold_down',
  'bottom_reef_or_shorebreak_impact',
  'collision',
  'cold_water_or_fatigue',
  'convective_weather_intrusion',
  'low_visibility_or_daylight_overrun',
];

export const hardStopRules = [
  'Thunder, lightning, waterspout risk, or special marine warning.',
  'Local red flag, beach closure, water closure, or official no-entry notice.',
  'Wind clearly above the rider skill, gear, or rescue configuration.',
  'Strong offshore or side-offshore exposure without station, buddy, or rescue support.',
  'Manual SOS or unresolved active incident always overrides normal recommendation logic.',
];

export const cautionRules = [
  'High gust factor, fast wind shifts, or low source confidence.',
  'Missing emergency contact, missing self-rescue competence, or solo session.',
  'Wave period, shorebreak, current, tide, or reef/structure exposure above rider level.',
  'Cold water, poor visibility, low daylight margin, or weak swimming confidence.',
  'Missing quiver, board, safety equipment, or unclear tracking device readiness.',
];

export const telemetryPatterns = [
  'dangerous_launch_window',
  'uncontrolled_offshore_drift',
  'prolonged_immobility_in_exposed_water',
  'repeated_crash_recovery_degradation',
  'board_or_equipment_separation',
  'rip_or_longshore_capture',
  'convective_weather_intrusion',
  'responder_needed_event',
];

export const aiResponseContract = [
  'Decision state: Go, Caution, or No-Go.',
  'Confidence and source/uncertainty notes.',
  'Top hazards in plain language.',
  'Recommended gear, launch, or exit action.',
  'Return or escape plan if conditions degrade.',
  'Never guarantee safety or encourage entry during hard-stop conditions.',
  'Never expose private medical or contact data in public/local safety messages.',
];

const asArray = (value) => {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') return Object.values(value);
  return [];
};

const numberOrNull = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const boolish = (value) => value === true || value === 'true' || value === 1 || value === '1';

const includesAny = (text, tokens) => {
  const normalized = String(text || '').toLowerCase();
  return tokens.some((token) => normalized.includes(token));
};

const skillRank = (skillLevel) => ({
  beginner: 1,
  independent: 2,
  intermediate: 3,
  advanced: 4,
  instructor: 5,
  rescue_station_staff: 5,
  pro: 6,
}[skillLevel] || 3);

const getAlertText = (alert) => [
  alert?.event,
  alert?.headline,
  alert?.title,
  alert?.description,
  alert?.severity,
].filter(Boolean).join(' ');

const hasWeatherHardStop = (conditions = {}) => {
  const alertText = asArray(conditions.weatherAlerts).map(getAlertText).join(' ');
  return boolish(conditions.specialMarineWarning)
    || boolish(conditions.waterspoutRisk)
    || boolish(conditions.thunderHeard)
    || includesAny(conditions.lightningRisk, ['high', 'severe', 'detected', 'true'])
    || includesAny(alertText, [
      'special marine warning',
      'lightning',
      'thunder',
      'thunderstorm',
      'waterspout',
      'gale warning',
      'storm warning',
      'squall',
    ]);
};

const hasEmergencyContact = (safety = {}) =>
  Boolean(safety.emergencyContact1Phone || safety.emergencyContact1Email);

const activeKites = (gear = {}) =>
  asArray(gear.kites).filter((kite) => kite.active !== false && numberOrNull(kite.sizeM2));

const activeBoards = (gear = {}) =>
  asArray(gear.boards).filter((board) => board.active !== false && (board.boardType || board.model));

const addUnique = (target, value) => {
  if (value && !target.includes(value)) target.push(value);
};

export const evaluateResearchSafety = ({ rider = {}, safety = {}, gear = {}, conditions = {} }) => {
  const sportMode = rider.sportMode || (rider.ridingStyle === 'surf' ? 'surf' : 'kitesurf');
  const skill = skillRank(rider.skillLevel);
  const windKmh = numberOrNull(conditions.windKmh) || 0;
  const gustKmh = numberOrNull(conditions.gustKmh) || windKmh;
  const gustFactor = windKmh ? gustKmh / windKmh : 1;
  const waveM = numberOrNull(conditions.waveM ?? conditions.swellM);
  const wavePeriodS = numberOrNull(conditions.wavePeriodS ?? conditions.swellPeriodS);
  const currentSpeed = numberOrNull(conditions.currentSpeed);
  const waterTemperatureC = numberOrNull(conditions.waterTemperatureC);
  const minutesToSunset = numberOrNull(conditions.minutesToSunset);
  const visibilityM = numberOrNull(conditions.visibilityM ?? conditions.fogVisibilityM);
  const sourceCount = numberOrNull(conditions.activeSources);
  const safetyEquipment = gear.safetyEquipment || {};
  const wetsuitMm = numberOrNull(safetyEquipment.wetsuitMm);
  const hardStops = [];
  const cautions = [];
  const missingCriticalData = [];
  const topHazards = [];
  const uncertaintyNotes = [];

  if (!rider.sportMode) addUnique(missingCriticalData, 'Sport mode is not saved; SmartSurf assumes kitesurfing.');
  if (!rider.weightKg) addUnique(missingCriticalData, 'Rider weight is missing, so kite recommendation confidence is lower.');
  if (!rider.yearsExperience) addUnique(missingCriticalData, 'Years of experience are missing.');
  if (!safety.swimmingLevel && !rider.swimmingConfidence) addUnique(missingCriticalData, 'Swimming confidence is not saved.');
  if (!hasEmergencyContact(safety)) addUnique(missingCriticalData, 'Emergency contact is missing.');

  if (['kitesurf', 'kitefoil', 'wingfoil'].includes(sportMode) && !activeKites(gear).length) {
    addUnique(missingCriticalData, 'Kite quiver is not saved.');
  }
  if (!activeBoards(gear).length) addUnique(missingCriticalData, 'Board profile is not saved.');

  if (hasWeatherHardStop(conditions)) {
    addUnique(hardStops, 'Thunder, lightning, waterspout, storm, or special marine warning is present.');
    addUnique(topHazards, 'convective_weather_intrusion');
  }
  if (boolish(conditions.beachRedFlag) || boolish(conditions.beachWaterClosed) || boolish(conditions.localNoEntryNotice)) {
    addUnique(hardStops, 'Local flag or official notice says no water entry.');
    addUnique(topHazards, 'official_override');
  }

  if (windKmh > 55) {
    addUnique(hardStops, 'Wind is above the normal SmartSurf recreational safety envelope.');
    addUnique(topHazards, 'land_phase_power_control');
  } else if (windKmh > 45) {
    addUnique(cautions, 'Strong wind requires expert judgement and conservative gear.');
    addUnique(topHazards, 'land_phase_power_control');
  }

  if (['beginner', 'independent'].includes(rider.skillLevel) && windKmh > 36) {
    addUnique(hardStops, 'Wind is too strong for a beginner or newly independent rider profile.');
    addUnique(topHazards, 'lofting_or_dragging');
  }

  if (['kitesurf', 'kitefoil', 'wingfoil'].includes(sportMode) && windKmh < 14) {
    addUnique(cautions, 'Wind is light enough that relaunch and return may become difficult.');
    addUnique(topHazards, 'equipment_or_board_separation');
  }

  if (gustFactor >= 2.1) {
    addUnique(hardStops, 'Gust factor is extreme for a safe launch window.');
    addUnique(topHazards, 'lofting_or_dragging');
  } else if (gustFactor >= 1.75) {
    addUnique(cautions, 'Gust factor is high; launch and landing become less forgiving.');
    addUnique(topHazards, 'lofting_or_dragging');
  }

  if (boolish(conditions.orangeWindsock) || boolish(conditions.offshoreWindWarning) || boolish(conditions.offshoreWindRisk)) {
    if (safety.stationSharingEnabled || rider.buddyStatus === 'school' || rider.buddyStatus === 'lifeguarded') {
      addUnique(cautions, 'Offshore or strong-wind warning exists; stay inside station/rescue coverage.');
    } else {
      addUnique(hardStops, 'Offshore or strong-wind warning exists without confirmed local support.');
    }
    addUnique(topHazards, 'offshore_drift');
  }

  if (waveM !== null && waveM > 2.2 && skill < 4) {
    addUnique(hardStops, 'Wave height is above the saved rider level.');
    addUnique(topHazards, 'impact_zone_hold_down');
  } else if (waveM !== null && waveM > 1.3) {
    addUnique(cautions, 'Wave height can increase launch, return, and board-recovery risk.');
    addUnique(topHazards, 'shorebreak_or_impact_zone');
  }

  if (waveM !== null && wavePeriodS !== null && waveM > 0.9 && wavePeriodS >= 10) {
    addUnique(cautions, 'Longer-period swell can carry more energy than wave height alone suggests.');
    addUnique(topHazards, 'impact_zone_hold_down');
  }

  if (currentSpeed !== null && currentSpeed >= 0.7) {
    addUnique(cautions, 'Current signal is strong enough to change drift and return planning.');
    addUnique(topHazards, 'rip_or_current_entrapment');
  }

  if (waterTemperatureC !== null && waterTemperatureC < 18 && (!wetsuitMm || wetsuitMm < 3)) {
    addUnique(cautions, 'Cold water or insufficient thermal protection reduces the self-rescue window.');
    addUnique(topHazards, 'cold_water_or_fatigue');
  }

  if (minutesToSunset !== null && minutesToSunset < 30) {
    addUnique(hardStops, 'Daylight margin is too low for a new session.');
    addUnique(topHazards, 'low_visibility_or_daylight_overrun');
  } else if (minutesToSunset !== null && minutesToSunset < 60 && rider.buddyStatus === 'solo') {
    addUnique(cautions, 'Low daylight margin is more serious for a solo session.');
    addUnique(topHazards, 'low_visibility_or_daylight_overrun');
  }

  if (visibilityM !== null && visibilityM < 1000) {
    addUnique(cautions, 'Poor visibility makes self-rescue and local response harder.');
    addUnique(topHazards, 'low_visibility_or_daylight_overrun');
  }

  if (['kitesurf', 'kitefoil', 'wingfoil'].includes(sportMode) && !boolish(rider.selfRescueCompetent) && skill <= 3) {
    addUnique(cautions, 'Self-rescue competence is not confirmed for this rider profile.');
    addUnique(topHazards, 'equipment_or_board_separation');
  }

  if (['solo', '', undefined].includes(rider.buddyStatus) && !hasEmergencyContact(safety)) {
    addUnique(cautions, 'Solo session without a trusted contact leaves no private escalation path.');
    addUnique(topHazards, 'responder_needed_event');
  }

  if (['low', 'weak'].includes(rider.swimmingConfidence || safety.swimmingLevel)) {
    addUnique(cautions, 'Swimming confidence is low for open-water recovery.');
    addUnique(topHazards, 'rip_or_current_entrapment');
  }

  if (['kitesurf', 'kitefoil', 'wingfoil'].includes(sportMode)) {
    if (!boolish(safetyEquipment.quickReleaseChecked)) {
      addUnique(cautions, 'Quick-release check is not saved for this gear setup.');
      addUnique(topHazards, 'land_phase_power_control');
    }
    if (!boolish(safetyEquipment.knife) && (gustFactor > 1.6 || boolish(conditions.offshoreWindRisk))) {
      addUnique(cautions, 'Hook knife is not saved for a higher-risk kite setup.');
    }
  }

  if (sourceCount !== null && sourceCount < 4) {
    addUnique(uncertaintyNotes, 'Low source density: confirm with local observation before launch.');
  }
  if (!conditions.sourceFreshness) {
    addUnique(uncertaintyNotes, 'Source freshness is missing.');
  }
  if (!conditions.nearestWindSensor && conditions.fallback === false) {
    addUnique(uncertaintyNotes, 'No nearby hardware wind sensor is attached to this decision.');
  }

  return {
    version: SMARTSURF_SAFETY_CONTEXT_VERSION,
    sportMode,
    decisionStateHint: hardStops.length ? 'No-Go' : cautions.length ? 'Caution' : 'Go',
    hardStops,
    cautions,
    missingCriticalData,
    topHazards: topHazards.length ? topHazards : ['normal_session_awareness'],
    uncertaintyNotes,
    escalationPlan: [
      'Rider check first.',
      'Trusted contacts if there is no response and risk remains elevated.',
      'Station/helper network only when the rider has opted in.',
      'Local incident marker stays anonymized unless the rider has allowed more visibility.',
    ],
    responseContract: aiResponseContract,
  };
};

export const buildSafetyPromptContext = ({ rider = {}, safety = {}, gear = {}, fusion = null }) => {
  const evaluation = evaluateResearchSafety({
    rider,
    safety,
    gear,
    conditions: fusion || {},
  });
  const kites = activeKites(gear).map((kite) => `${kite.sizeM2}m`).join(', ') || 'not saved';
  const boards = activeBoards(gear).map((board) => board.boardType || board.model || 'board').join(', ') || 'not saved';
  const emergencyReady = hasEmergencyContact(safety) ? 'configured' : 'missing';
  const weatherLine = fusion
    ? `Live context: wind ${Math.round(fusion.windKmh || 0)} km/h, gusts ${Math.round(fusion.gustKmh || 0)} km/h, waves ${Number(fusion.waveM || 0).toFixed(1)} m, swell ${Number(fusion.swellM || 0).toFixed(1)} m, water ${fusion.waterTemperatureC ?? 'unknown'} C, confidence ${Math.round((fusion.confidence || 0.5) * 100)}%.`
    : 'Live context: not loaded.';

  return [
    `SmartSurf Safety Context v${SMARTSURF_SAFETY_CONTEXT_VERSION}`,
    'SmartSurf is a watersports safety assistant using rider profile, gear, spot context, live environment, tracking, and Senlay physical-world data.',
    `Rider: ${rider.displayName || rider.fullName || 'unnamed'}, sport ${evaluation.sportMode}, skill ${rider.skillLevel || 'unknown'}, style ${rider.ridingStyle || 'unknown'}, experience ${rider.yearsExperience || 'unknown'} years, weight ${rider.weightKg || 'unknown'} kg, swimming ${rider.swimmingConfidence || safety.swimmingLevel || 'unknown'}, self-rescue ${rider.selfRescueCompetent ? 'yes' : 'not confirmed'}, buddy status ${rider.buddyStatus || 'solo'}.`,
    `Safety: emergency contact ${emergencyReady}, local safety network ${safety.localSafetyNetworkEnabled ? 'enabled' : 'off'}, station sharing ${safety.stationSharingEnabled ? 'enabled' : 'off'}.`,
    `Gear: kites ${kites}; boards ${boards}; helmet ${gear.safetyEquipment?.helmet ? 'yes' : 'no'}; impact vest ${gear.safetyEquipment?.impactVest ? 'yes' : 'no'}; knife ${gear.safetyEquipment?.knife ? 'yes' : 'no'}; wetsuit ${gear.safetyEquipment?.wetsuitMm || 'unknown'} mm.`,
    weatherLine,
    `Decision hint: ${evaluation.decisionStateHint}.`,
    evaluation.hardStops.length ? `Hard stops: ${evaluation.hardStops.join(' | ')}` : 'Hard stops: none detected from current data.',
    evaluation.cautions.length ? `Cautions: ${evaluation.cautions.join(' | ')}` : 'Cautions: none detected from current data.',
    evaluation.missingCriticalData.length ? `Missing critical data: ${evaluation.missingCriticalData.join(' | ')}` : 'Missing critical data: none.',
    `Top hazards: ${evaluation.topHazards.join(', ')}.`,
    `AI response contract: ${aiResponseContract.join(' ')}`,
    `Hard-stop rules: ${hardStopRules.join(' ')}`,
  ].join('\n');
};
