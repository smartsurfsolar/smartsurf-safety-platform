import { Button, Chip, Stack, Typography } from '@mui/material';
import SmartSurfLayout from './SmartSurfLayout';
import { SmartSurfCard, SmartSurfGrid, SmartSurfPage } from './SmartSurfShell';
import { spotSeed } from './domain';
import { useSmartSurfData } from './storage';

const IncidentsPage = () => {
  const { incidents, saveIncidents, sessions, selectedPosition } = useSmartSurfData();

  const createManualSos = async () => {
    const incident = {
      incidentId: `incident-${Date.now()}`,
      sessionId: sessions[0]?.sessionId || '',
      userId: 'traccar-user',
      type: 'manual_sos',
      riskLevel: 'high',
      status: 'waiting_for_rider_response',
      lat: selectedPosition?.latitude || spotSeed[0].lat,
      lon: selectedPosition?.longitude || spotSeed[0].lon,
      createdAt: new Date().toISOString(),
      lastUpdateAt: new Date().toISOString(),
      reason: 'Manual test SOS created from SmartSurf incident foundation.',
      senlayContextSnapshot: '',
      traccarPositionSnapshot: selectedPosition || null,
      notifiedContacts: [],
      notifiedHelpers: [],
      notifiedStation: [],
    };
    await saveIncidents([incident, ...incidents]);
  };

  return (
    <SmartSurfLayout title="smartsurfIncidents">
      <SmartSurfPage
        eyebrow="Incidents"
        title="SOS and risk event lifecycle."
        text="SmartSurf incidents are designed for manual SOS, auto-SOS, possible drift, prolonged stop, board lost, rider separated, low battery offshore, and future local safety escalation."
        actions={<Button variant="contained" color="error" size="large" onClick={createManualSos}>Create test SOS</Button>}
      >
        <SmartSurfGrid>
          {incidents.map((incident) => (
            <SmartSurfCard title={incident.type} eyebrow={incident.incidentId} key={incident.incidentId}>
              <Stack direction="row" gap={1} sx={{ mb: 2, flexWrap: 'wrap' }}>
                <Chip label={incident.status} />
                <Chip color="warning" label={incident.riskLevel} />
              </Stack>
              <Typography>{incident.reason}</Typography>
              <Typography sx={{ mt: 1 }}>Location: {incident.lat}, {incident.lon}</Typography>
              <Typography>Last update: {incident.lastUpdateAt}</Typography>
            </SmartSurfCard>
          ))}
          {!incidents.length && (
            <SmartSurfCard title="No incidents" eyebrow="Safety model">
              <Typography>
                The model is ready for detected, waiting_for_rider_response, active_alert,
                acknowledged, resolved, and false_alarm states.
              </Typography>
            </SmartSurfCard>
          )}
        </SmartSurfGrid>
      </SmartSurfPage>
    </SmartSurfLayout>
  );
};

export default IncidentsPage;
