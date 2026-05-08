import { Box, Chip, Stack, Typography } from '@mui/material';
import SmartSurfLayout from './SmartSurfLayout';
import { SmartSurfCard, SmartSurfGrid, SmartSurfPage } from './SmartSurfShell';
import { useSmartSurfData } from './storage';

const LocalSafetyMapPage = () => {
  const { incidents, safety } = useSmartSurfData();
  const visibleIncidents = incidents.filter((incident) => !['resolved', 'false_alarm'].includes(incident.status));

  return (
    <SmartSurfLayout title="smartsurfLocalSafetyMap">
      <SmartSurfPage
        eyebrow="Local Safety Network"
        title="A future spot-level safety layer."
        text="The local map is opt-in by design. It should show only emergency-relevant markers, not normal live rider tracking or private contact details."
      >
        <SmartSurfGrid>
          <SmartSurfCard title="Network permissions" eyebrow="Privacy first">
            <Typography>Local Safety Network: {safety.localSafetyNetworkEnabled ? 'enabled' : 'off'}</Typography>
            <Typography>Helper mode: {safety.helperModeEnabled ? 'enabled' : 'off'}</Typography>
            <Typography>Show incident marker: {safety.showIncidentOnSpotMap ? 'yes' : 'no'}</Typography>
            <Typography>Exact emergency location: {safety.shareExactLocationDuringEmergency ? 'yes' : 'no'}</Typography>
          </SmartSurfCard>
          <SmartSurfCard title="Local incident markers" eyebrow="Anonymized feed">
            {visibleIncidents.length ? visibleIncidents.map((incident) => (
              <Box key={incident.incidentId} sx={{ mb: 2 }}>
                <Stack direction="row" gap={1} sx={{ mb: 1, flexWrap: 'wrap' }}>
                  <Chip label={incident.type} />
                  <Chip color="warning" label={incident.riskLevel} />
                  <Chip label={incident.status} />
                </Stack>
                <Typography>Last known location is available only according to rider permissions.</Typography>
              </Box>
            )) : (
              <Typography>No active local incident markers.</Typography>
            )}
          </SmartSurfCard>
        </SmartSurfGrid>
      </SmartSurfPage>
    </SmartSurfLayout>
  );
};

export default LocalSafetyMapPage;
