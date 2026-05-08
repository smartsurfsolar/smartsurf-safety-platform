import { Button, Chip, Stack, Typography } from '@mui/material';
import { Link } from 'react-router-dom';
import SmartSurfLayout from './SmartSurfLayout';
import {
  PrimaryLinkButton,
  ProfileCompletion,
  SmartSurfCard,
  SmartSurfGrid,
  SmartSurfPage,
} from './SmartSurfShell';
import { createAssessment } from './domain';
import { useSmartSurfData } from './storage';

const SmartSurfDashboardPage = () => {
  const data = useSmartSurfData();
  const { rider, safety, gear, selectedPosition, devices, deviceMappings, incidents } = data;
  const activeDevice = selectedPosition ? devices[selectedPosition.deviceId] : null;
  const assessment = createAssessment({
    rider,
    safety,
    gear,
    conditions: {
      windKmh: 24,
      gustKmh: 36,
      waveM: 0.6,
      wavePeriodS: 5.8,
      activeSources: 8,
      sourceFreshness: true,
    },
  });

  return (
    <SmartSurfLayout title="smartsurfDashboard">
      <SmartSurfPage
        eyebrow="SmartSurf"
        title="Watersports safety intelligence."
        text="One SmartSurf account now holds the rider profile, gear, tracking devices, sessions, Senlay conditions, safety settings, and future local spot network."
        actions={(
          <>
            <PrimaryLinkButton to="/smartsurf/conditions">Can I ride now?</PrimaryLinkButton>
            <Button component={Link} to="/map" variant="outlined" color="inherit" size="large">Fusion Map</Button>
            <Button component={Link} to="/smartsurf/safety" variant="outlined" color="inherit" size="large">SOS Setup</Button>
          </>
        )}
      >
        <SmartSurfGrid>
          <SmartSurfCard title="Current risk" eyebrow="Pre-session" tone={assessment.status}>
            <Typography variant="h4" sx={{ fontWeight: 800 }}>{assessment.status}</Typography>
            <Typography sx={{ mt: 1 }}>{assessment.recommendedAction}</Typography>
            <Stack direction="row" gap={1} sx={{ mt: 2, flexWrap: 'wrap' }}>
              <Chip label={`Risk ${assessment.riskScore}/100`} />
              <Chip label={`Kite ${assessment.recommendedKite}`} />
              <Chip label={assessment.overallRiskLevel} />
            </Stack>
            <Typography sx={{ mt: 2, color: '#b9cee1' }}>
              {(assessment.topHazards || []).slice(0, 2).map((hazard) => hazard.replaceAll('_', ' ')).join(' / ')}
            </Typography>
          </SmartSurfCard>
          <SmartSurfCard title="Senlay Fusion" eyebrow="Environmental intelligence">
            <Typography sx={{ fontWeight: 800 }}>
              Senlay adds wind, gusts, waves, current direction, terrain modifiers, source density,
              freshness, and confidence on top of tracking.
            </Typography>
            <Typography sx={{ mt: 1 }}>
              Open the map and toggle the Senlay Fusion layers to see physical-world context around
              the rider or spot.
            </Typography>
          </SmartSurfCard>
          <SmartSurfCard title="Active tracker" eyebrow="Traccar device">
            <Typography variant="h5" sx={{ fontWeight: 800 }}>
              {activeDevice?.name || 'No live device selected'}
            </Typography>
            <Typography sx={{ mt: 1 }}>
              {selectedPosition
                ? `${selectedPosition.latitude?.toFixed(5)}, ${selectedPosition.longitude?.toFixed(5)}`
                : 'Add a phone tracker or SmartSurf hardware tracker, then link it to rider, board, helmet, or school fleet.'}
            </Typography>
          </SmartSurfCard>
          <SmartSurfCard title="Device meaning" eyebrow="SmartSurf mapping">
            <Typography variant="h5" sx={{ fontWeight: 800 }}>
              {deviceMappings.length || 0} mapped
            </Typography>
            <Typography sx={{ mt: 1 }}>
              Traccar stores raw devices. SmartSurf adds meaning: rider, board, kite, helmet,
              school fleet, or future SmartSurf tracker.
            </Typography>
          </SmartSurfCard>
          <ProfileCompletion />
          <SmartSurfCard title="SOS readiness" eyebrow="Safety">
            <Typography>
              {safety.emergencyContact1Phone || safety.emergencyContact1Email
                ? `Primary contact: ${safety.emergencyContact1Name || 'Saved contact'}`
                : 'Emergency contact is missing.'}
            </Typography>
            <Typography sx={{ mt: 1 }}>
              Local Safety Network: {safety.localSafetyNetworkEnabled ? 'enabled' : 'off'}.
            </Typography>
          </SmartSurfCard>
          <SmartSurfCard title="Incident foundation" eyebrow="Local safety">
            <Typography variant="h5" sx={{ fontWeight: 800 }}>{incidents.length || 0} active records</Typography>
            <Typography sx={{ mt: 1 }}>
              Incident states are prepared for manual SOS, possible drift, prolonged stop, and
              local helper escalation.
            </Typography>
          </SmartSurfCard>
        </SmartSurfGrid>
      </SmartSurfPage>
    </SmartSurfLayout>
  );
};

export default SmartSurfDashboardPage;
