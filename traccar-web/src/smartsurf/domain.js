import { evaluateResearchSafety } from './safetyContext';

export const ATTR = {
  rider: 'smartsurf.riderProfile',
  safety: 'smartsurf.safetySettings',
  gear: 'smartsurf.gearProfile',
  devices: 'smartsurf.deviceMappings',
  sessions: 'smartsurf.sessions',
  incidents: 'smartsurf.incidents',
};

export const defaultRider = {
  fullName: '',
  displayName: '',
  phone: '',
  country: '',
  homeSpot: '',
  preferredLanguage: 'en',
  weightKg: '',
  heightCm: '',
  age: '',
  fitnessLevel: '',
  sportMode: 'kitesurf',
  yearsExperience: '',
  swimmingConfidence: 'medium',
  selfRescueCompetent: false,
  reliableUpwind: false,
  buddyStatus: 'solo',
  coldTolerance: '',
  skillLevel: 'intermediate',
  ridingStyle: 'freeride',
  preferredUnits: 'metric',
  windUnits: 'knots',
  privacyMode: 'private',
};

export const defaultSafety = {
  emergencyContact1Name: '',
  emergencyContact1Phone: '',
  emergencyContact1Email: '',
  emergencyContact2Name: '',
  emergencyContact2Phone: '',
  emergencyContact2Email: '',
  medicalNotes: '',
  swimmingLevel: '',
  rescueNotes: '',
  localSafetyNetworkEnabled: false,
  helperModeEnabled: false,
  stationSharingEnabled: false,
  showIncidentOnSpotMap: false,
  shareIdentityToStation: false,
  shareExactLocationDuringEmergency: true,
  alertRadiusMeters: 3000,
};

export const defaultGear = {
  kites: [
    {
      kiteId: 'kite-1',
      brand: '',
      model: '',
      sizeM2: '',
      year: '',
      type: 'freeride',
      windRangeLow: '',
      windRangeHigh: '',
      notes: '',
      active: true,
    },
  ],
  boards: [
    {
      boardId: 'board-1',
      brand: '',
      model: '',
      boardType: 'twin-tip',
      lengthCm: '',
      volumeL: '',
      foilCompatible: false,
      notes: '',
      active: true,
    },
  ],
  foils: [],
  safetyEquipment: {
    harnessType: '',
    impactVest: false,
    helmet: false,
    leash: true,
    knife: false,
    quickReleaseChecked: false,
    radioIntercom: false,
    smartSurfTracker: false,
    trackerDeviceId: '',
    wetsuitMm: '',
    leashType: 'standard',
  },
};

export const defaultDeviceMappings = [];
export const defaultSessions = [];
export const defaultIncidents = [];

export const toArray = (value) => {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') return Object.values(value);
  return [];
};

export const spotSeed = [
  {
    spotId: 'hoi-an',
    name: 'Hoi An',
    country: 'Vietnam',
    region: 'Quang Nam',
    lat: 15.8801,
    lon: 108.338,
    offshoreDirectionDegrees: 90,
    commonWindDirections: 'NE, E, SE',
    typicalHazards: 'shorebreak, current, gusty terrain wind, boat traffic',
    rescueContact: '',
    stationContact: '',
    notes: 'Default SmartSurf development spot.',
  },
  {
    spotId: 'mui-ne',
    name: 'Mui Ne',
    country: 'Vietnam',
    region: 'Binh Thuan',
    lat: 10.9333,
    lon: 108.2833,
    offshoreDirectionDegrees: 180,
    commonWindDirections: 'NE, E',
    typicalHazards: 'shorebreak, strong current, crowded launch',
    rescueContact: '',
    stationContact: '',
    notes: '',
  },
];

export const options = {
  skillLevel: [
    ['beginner', 'Beginner'],
    ['independent', 'Independent rider'],
    ['intermediate', 'Intermediate'],
    ['advanced', 'Advanced'],
    ['instructor', 'Instructor'],
    ['rescue_station_staff', 'Rescue / station staff'],
    ['pro', 'Pro'],
  ],
  ridingStyle: [
    ['freeride', 'Freeride'],
    ['freestyle', 'Freestyle'],
    ['wave', 'Wave'],
    ['foil', 'Foil'],
    ['wingfoil', 'Wingfoil'],
    ['surf', 'Surf'],
    ['sup', 'SUP'],
    ['school_student', 'School / student'],
    ['other', 'Other'],
  ],
  sportMode: [
    ['kitesurf', 'Kitesurf'],
    ['kitefoil', 'Kitefoil'],
    ['wingfoil', 'Wingfoil'],
    ['surf', 'Surf'],
    ['sup', 'SUP'],
  ],
  swimmingConfidence: [
    ['low', 'Low'],
    ['medium', 'Medium'],
    ['high', 'High'],
    ['rescue_trained', 'Rescue trained'],
  ],
  buddyStatus: [
    ['solo', 'Solo'],
    ['buddy', 'With buddy'],
    ['school', 'School / station support'],
    ['lifeguarded', 'Lifeguarded event'],
  ],
  leashType: [
    ['standard', 'Standard'],
    ['short', 'Short'],
    ['reel', 'Reel'],
    ['none', 'None'],
  ],
  kiteType: [
    ['freeride', 'Freeride'],
    ['wave', 'Wave'],
    ['foil', 'Foil'],
    ['freestyle', 'Freestyle'],
    ['school', 'School'],
    ['lightwind', 'Lightwind'],
    ['storm', 'Storm'],
  ],
  boardType: [
    ['twin-tip', 'Twin-tip'],
    ['surfboard', 'Surfboard'],
    ['foilboard', 'Foilboard'],
    ['wing-board', 'Wing board'],
    ['sup', 'SUP'],
    ['custom-board', 'Custom board'],
  ],
  deviceType: [
    ['phone_tracker', 'Phone tracker'],
    ['smartsurf_gps_tracker', 'SmartSurf GPS tracker'],
    ['board_tracker', 'Board tracker'],
    ['helmet_tracker', 'Helmet tracker'],
    ['radio_intercom_tracker', 'Radio/intercom tracker'],
    ['school_fleet_tracker', 'School fleet tracker'],
    ['test_demo_device', 'Test/demo device'],
  ],
  assignedTo: [
    ['rider', 'Rider'],
    ['board', 'Board'],
    ['kite', 'Kite'],
    ['school_fleet', 'School fleet'],
  ],
};

export const parseJsonAttribute = (attributes, key, fallback) => {
  const value = attributes?.[key];
  if (!value) return fallback;
  if (typeof value === 'object') {
    if (Array.isArray(fallback)) return Array.isArray(value) ? value : toArray(value);
    return { ...fallback, ...value };
  }
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(fallback)) return Array.isArray(parsed) ? parsed : toArray(parsed);
    return { ...fallback, ...parsed };
  } catch {
    return fallback;
  }
};

export const serializeAttribute = (value) => JSON.stringify(value);

export const calculateCompletion = ({ rider = {}, safety = {}, gear = {}, deviceMappings = [] }) => {
  const kites = toArray(gear.kites);
  const boards = toArray(gear.boards);
  const mappedDevices = toArray(deviceMappings);
  const riderChecks = [
    rider.displayName || rider.fullName,
    rider.weightKg,
    rider.age,
    rider.sportMode,
    rider.yearsExperience,
    rider.swimmingConfidence,
    rider.selfRescueCompetent,
    rider.skillLevel,
    rider.ridingStyle,
    rider.homeSpot,
  ];
  const safetyChecks = [
    safety.emergencyContact1Name,
    safety.emergencyContact1Phone || safety.emergencyContact1Email,
    safety.swimmingLevel,
  ];
  const gearChecks = [
    kites.some((kite) => kite.sizeM2),
    boards.some((board) => board.boardType),
    gear.safetyEquipment?.leash,
    gear.safetyEquipment?.quickReleaseChecked,
  ];
  const deviceChecks = [mappedDevices.some((device) => device.traccarDeviceId || device.label)];
  return {
    rider: percent(riderChecks),
    safety: percent(safetyChecks),
    gear: percent(gearChecks),
    device: percent(deviceChecks),
  };
};

export const createAssessment = ({ rider = {}, safety = {}, gear = {}, conditions = {} }) => {
  const kites = toArray(gear.kites);
  const windKmh = Number(conditions?.windKmh || 0);
  const gustKmh = Number(conditions?.gustKmh || 0);
  const gustFactor = windKmh ? gustKmh / windKmh : 1;
  const researchSafety = evaluateResearchSafety({ rider, safety, gear, conditions });
  const reasons = [];
  let score = 22;
  if (!safety.emergencyContact1Phone && !safety.emergencyContact1Email) {
    score += 18;
    reasons.push('Emergency contact is missing.');
  }
  if (!kites.some((kite) => kite.sizeM2)) {
    score += 16;
    reasons.push('No kite quiver is saved yet.');
  }
  if (windKmh < 14) {
    score += 18;
    reasons.push('Wind is light for most kite sessions.');
  }
  if (windKmh > 45) {
    score += 32;
    reasons.push('Wind is strong enough to require expert judgement.');
  }
  if (gustFactor > 1.7) {
    score += 24;
    reasons.push('Gust factor is high.');
  }
  if (['beginner', 'independent'].includes(rider.skillLevel) && score > 45) {
    score += 10;
    reasons.push('Rider level makes this setup less forgiving.');
  }
  if (researchSafety.hardStops.length) score += 44;
  score += Math.min(30, researchSafety.cautions.length * 7);
  score += Math.min(16, researchSafety.missingCriticalData.length * 4);
  const riskScore = Math.min(100, Math.round(score));
  const overallRiskLevel = riskScore > 78 ? 'critical' : riskScore > 58 ? 'high' : riskScore > 34 ? 'medium' : 'low';
  const status = researchSafety.hardStops.length ? 'No-Go' : riskScore > 70 ? 'No-Go' : riskScore > 38 ? 'Caution' : 'Go';
  const safetyReasons = [
    ...researchSafety.hardStops.map((reason) => `Hard stop: ${reason}`),
    ...researchSafety.cautions.slice(0, 6),
    ...researchSafety.missingCriticalData.slice(0, 4),
  ];
  const allReasons = [...new Set([...safetyReasons, ...reasons])];
  return {
    status,
    overallRiskLevel,
    riskScore,
    confidence: Math.max(
      conditions?.sourceFreshness ? 0.68 : 0.46,
      Number(conditions?.confidence || 0),
    ),
    recommendedKite: chooseKite(gear, windKmh, rider.weightKg),
    reasons: allReasons.length ? allReasons : ['Profile, gear, and current conditions are inside the expected range.'],
    hardStops: researchSafety.hardStops,
    cautions: researchSafety.cautions,
    missingCriticalData: researchSafety.missingCriticalData,
    topHazards: researchSafety.topHazards,
    uncertaintyNotes: researchSafety.uncertaintyNotes,
    escalationPlan: researchSafety.escalationPlan,
    responseContract: researchSafety.responseContract,
    recommendedAction:
      status === 'Go'
        ? 'Ride near your normal launch, keep checking gusts, and keep safety contact active.'
        : status === 'Caution'
          ? 'Reduce kite size, stay near station support, and avoid offshore drift exposure.'
          : 'Wait for safer conditions or ride only with supervised station support.',
  };
};

const percent = (items) =>
  Math.round((items.filter(Boolean).length / Math.max(1, items.length)) * 100);

const chooseKite = (gear, windKmh, weightKg) => {
  const kites = toArray(gear.kites)
    .map((kite) => ({ ...kite, size: Number(kite.sizeM2) }))
    .filter((kite) => kite.active !== false && kite.size);
  if (!kites.length) return 'Add kite quiver';
  const windKt = windKmh / 1.852;
  let target = windKt < 13 ? 13 : windKt < 17 ? 11 : windKt < 22 ? 9 : windKt < 28 ? 7 : 5;
  if (Number(weightKg) > 88) target += 1;
  if (Number(weightKg) < 65) target -= 1;
  return `${kites.reduce((best, kite) => (Math.abs(kite.size - target) < Math.abs(best.size - target) ? kite : best), kites[0]).size}m`;
};
