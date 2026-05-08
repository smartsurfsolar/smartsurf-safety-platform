import { Button, Chip, Stack, Typography } from '@mui/material';
import SmartSurfLayout from './SmartSurfLayout';
import { SmartSurfCard, SmartSurfGrid, SmartSurfPage } from './SmartSurfShell';
import { spotSeed } from './domain';
import { useSmartSurfData } from './storage';

const SessionsPage = () => {
  const { sessions, saveSessions, selectedPosition, selectedDeviceId, rider, gear } = useSmartSurfData();

  const startPlannedSession = async () => {
    const session = {
      sessionId: `session-${Date.now()}`,
      userId: 'traccar-user',
      spotId: 'hoi-an',
      trackingDeviceId: selectedDeviceId || '',
      startTime: new Date().toISOString(),
      endTime: '',
      status: 'planned',
      launchLat: selectedPosition?.latitude || spotSeed[0].lat,
      launchLon: selectedPosition?.longitude || spotSeed[0].lon,
      selectedKiteId: gear.kites?.[0]?.kiteId || '',
      selectedBoardId: gear.boards?.[0]?.boardId || '',
      selectedFoilId: '',
      riderWeightAtSession: rider.weightKg || '',
      senlayEnvironmentalSnapshot: '',
      preSessionRecommendation: '',
      riskLevelAtStart: 'pending',
      maxDistanceFromLaunch: 0,
      totalDistance: 0,
      maxSpeed: 0,
      averageSpeed: 0,
      incidentCount: 0,
      notes: '',
    };
    await saveSessions([session, ...sessions]);
  };

  return (
    <SmartSurfLayout title="smartsurfSessions">
      <SmartSurfPage
        eyebrow="Sessions"
        title="SmartSurf sessions sit above Traccar trips."
        text="Traccar records positions and history. SmartSurf adds launch point, spot, selected gear, Senlay snapshot, risk state, incidents, and session meaning."
        actions={<Button variant="contained" color="secondary" size="large" onClick={startPlannedSession}>Create planned session</Button>}
      >
        <SmartSurfGrid>
          {sessions.map((session) => (
            <SmartSurfCard title={session.spotId || 'Session'} eyebrow={session.sessionId} key={session.sessionId}>
              <Stack direction="row" gap={1} sx={{ mb: 2, flexWrap: 'wrap' }}>
                <Chip label={session.status} />
                <Chip label={`Risk: ${session.riskLevelAtStart}`} />
                <Chip label={`Incidents: ${session.incidentCount}`} />
              </Stack>
              <Typography>Start: {session.startTime}</Typography>
              <Typography>Launch: {session.launchLat}, {session.launchLon}</Typography>
              <Typography>Kite: {session.selectedKiteId || 'not selected'}</Typography>
              <Typography>Board: {session.selectedBoardId || 'not selected'}</Typography>
            </SmartSurfCard>
          ))}
          {!sessions.length && (
            <SmartSurfCard title="No sessions yet" eyebrow="Foundation ready">
              <Typography>
                Create a planned session to verify the SmartSurf data model. Live Traccar history
                linking comes next.
              </Typography>
            </SmartSurfCard>
          )}
        </SmartSurfGrid>
      </SmartSurfPage>
    </SmartSurfLayout>
  );
};

export default SessionsPage;
