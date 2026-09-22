import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Chip, Stack, Typography } from '@mui/material';
import SmartSurfLayout from './SmartSurfLayout';
import { SmartSurfCard, SmartSurfGrid, SmartSurfPage } from './SmartSurfShell';
import { createAssessment } from './domain';
import { fallbackSenlayFusion, getFusionCenter, loadSenlayFusion } from './senlayFusion';
import { forecastModelLabels, loadSmartSurfForecast } from './forecastModels';
import { useSmartSurfData } from './storage';

const ConditionsPage = () => {
  const data = useSmartSurfData();
  const { rider, safety, gear, selectedPosition, selectedDeviceId } = data;
  const [loading, setLoading] = useState(false);
  const [context, setContext] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [error, setError] = useState('');

  const center = useMemo(() => getFusionCenter(selectedPosition), [selectedPosition]);

  const loadContext = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const nextContext = await loadSenlayFusion(center);
      setContext(nextContext);
      setForecast(await loadSmartSurfForecast({ center, fusion: nextContext, selectedDeviceId }));
    } catch (event) {
      setError(event.message);
      const fallback = fallbackSenlayFusion();
      setContext(fallback);
      setForecast(await loadSmartSurfForecast({ center, fusion: fallback, selectedDeviceId }));
    } finally {
      setLoading(false);
    }
  }, [center, selectedDeviceId]);

  useEffect(() => {
    loadContext();
  }, [loadContext]);

  const assessment = createAssessment({ rider, safety, gear, conditions: context || {} });
  const modelLabels = forecastModelLabels(forecast);

  return (
    <SmartSurfLayout title="smartsurfConditions">
      <SmartSurfPage
        eyebrow="Senlay Conditions"
        title="Can I ride now?"
        text="Senlay turns the rider's live location into physical-world context: wind, gusts, waves, current direction, terrain modifiers, source density, confidence, and a practical riding recommendation."
        actions={
          <Button
            variant="contained"
            color="secondary"
            size="large"
            onClick={loadContext}
            disabled={loading}
          >
            {loading ? 'Refreshing...' : 'Refresh conditions'}
          </Button>
        }
      >
        {error && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Senlay is temporarily unavailable, so this panel is showing fallback data. {error}
          </Alert>
        )}
        <SmartSurfGrid>
          <SmartSurfCard title="Assessment" eyebrow="Pre-session output" tone={assessment.status}>
            <Typography variant="h3" sx={{ fontWeight: 800 }}>
              {assessment.status}
            </Typography>
            <Typography sx={{ mt: 1 }}>{assessment.recommendedAction}</Typography>
            <Stack direction="row" gap={1} sx={{ mt: 2, flexWrap: 'wrap' }}>
              <Chip label={`Recommended kite: ${assessment.recommendedKite}`} />
              <Chip label={`Risk score: ${assessment.riskScore}`} />
              <Chip label={`Confidence: ${Math.round(assessment.confidence * 100)}%`} />
            </Stack>
            <Stack direction="row" gap={1} sx={{ mt: 1, flexWrap: 'wrap' }}>
              {(assessment.topHazards || []).slice(0, 4).map((hazard) => (
                <Chip key={hazard} label={hazard.replaceAll('_', ' ')} variant="outlined" />
              ))}
            </Stack>
          </SmartSurfCard>
          <SmartSurfCard title="Environment" eyebrow="Senlay layer">
            <Typography>Wind: {context?.windKmh ?? '-'} km/h</Typography>
            <Typography>Gusts: {context?.gustKmh ?? '-'} km/h</Typography>
            <Typography>Direction: {context?.windDirection ?? '-'} deg</Typography>
            <Typography>
              Waves: {context?.waveM ?? '-'} m / {context?.wavePeriodS ?? '-'} s
            </Typography>
            <Typography>Current direction: {context?.currentDirection ?? '-'} deg</Typography>
            <Typography>Air temperature: {context?.temperatureC ?? '-'} C</Typography>
            <Typography sx={{ mt: 1 }}>
              Senlay sources fused: {context?.activeSources ?? 'pending'}
            </Typography>
            <Typography>Freshness: {context?.sourceFreshness || 'pending'}</Typography>
          </SmartSurfCard>
          <SmartSurfCard title="Forecast prediction" eyebrow="Historic + providers">
            <Typography variant="h5" sx={{ fontWeight: 800 }}>
              {forecast?.bestWindow
                ? `${forecast.bestWindow.label} - ${forecast.bestWindow.status}`
                : 'Forecast pending'}
            </Typography>
            <Typography sx={{ mt: 1 }}>
              {forecast?.summary || 'Waiting for forecast providers and recent tracker history.'}
            </Typography>
            {forecast?.nextWindow && (
              <Stack direction="row" gap={1} sx={{ mt: 2, flexWrap: 'wrap' }}>
                <Chip label={`Next wind ${forecast.nextWindow.windKmh ?? '-'} km/h`} />
                <Chip label={`Gusts ${forecast.nextWindow.gustKmh ?? '-'} km/h`} />
                <Chip label={`Waves ${forecast.nextWindow.waveM ?? '-'} m`} />
                <Chip
                  label={`Tide ${forecast.nextWindow.tideStage || forecast.tidePrediction?.stage || '-'}`}
                />
                <Chip label={`Spread ${forecast.nextWindow.spreadKmh ?? '-'} km/h`} />
              </Stack>
            )}
            {forecast?.tidePrediction && (
              <Typography sx={{ mt: 2, color: '#b9cee1' }}>
                {forecast.tidePrediction.summary} Confidence{' '}
                {Math.round((forecast.tidePrediction.confidence || 0) * 100)}%.
              </Typography>
            )}
          </SmartSurfCard>
          <SmartSurfCard title="Forecast models" eyebrow="Provider comparison">
            <Stack direction="row" gap={1} sx={{ flexWrap: 'wrap' }}>
              {modelLabels.map((model) => (
                <Chip
                  key={model.id}
                  label={`${model.name}: ${model.status === 'active' ? model.detail : 'off'}`}
                  color={model.status === 'active' ? 'secondary' : 'default'}
                  variant={model.status === 'active' ? 'filled' : 'outlined'}
                />
              ))}
            </Stack>
            <Typography sx={{ mt: 2, color: '#b9cee1' }}>
              {forecast?.history?.summary || 'No selected tracker history is available yet.'}
            </Typography>
          </SmartSurfCard>
          <SmartSurfCard title="Senlay Fusion Map" eyebrow="Live layer">
            <Typography>
              The live map now has a Senlay Fusion overlay with switchable wind flow, currents,
              terrain modifier, source points, temperature, and GPS/spot layers.
            </Typography>
            <Button sx={{ mt: 2 }} variant="outlined" color="inherit" href="/map">
              Open Fusion Map
            </Button>
          </SmartSurfCard>
          <SmartSurfCard title="Reasons" eyebrow="Risk engine v1">
            {assessment.reasons.map((reason) => (
              <Typography key={reason} sx={{ mb: 1 }}>
                {reason}
              </Typography>
            ))}
            {(assessment.uncertaintyNotes || []).map((note) => (
              <Typography key={note} sx={{ mb: 1, color: '#b9cee1' }}>
                {note}
              </Typography>
            ))}
          </SmartSurfCard>
          <SmartSurfCard title="Escalation policy" eyebrow="Research context">
            {(assessment.escalationPlan || []).map((step) => (
              <Typography key={step} sx={{ mb: 1 }}>
                {step}
              </Typography>
            ))}
          </SmartSurfCard>
        </SmartSurfGrid>
      </SmartSurfPage>
    </SmartSurfLayout>
  );
};

export default ConditionsPage;
