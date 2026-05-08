import { useEffect } from 'react';
import { Typography } from '@mui/material';
import SmartSurfLayout from './SmartSurfLayout';
import { SmartSurfCard, SmartSurfGrid, SmartSurfPage } from './SmartSurfShell';
import { FieldGrid, SaveBar, SelectInput, TextInput, ToggleInput, useEditable } from './forms';
import { defaultSafety } from './domain';
import { hardStopRules, telemetryPatterns } from './safetyContext';
import { useSmartSurfData } from './storage';

const SafetyPage = () => {
  const { safety, saveSafety, saving } = useSmartSurfData();
  const [draft, setDraft, setField] = useEditable({ ...defaultSafety, ...safety });
  useEffect(() => setDraft({ ...defaultSafety, ...safety }), [safety, setDraft]);

  return (
    <SmartSurfLayout title="smartsurfSafety">
      <SmartSurfPage
        eyebrow="Safety"
        title="Emergency contacts, SOS rules, and local network settings."
        text="SmartSurf treats SOS as a controlled escalation flow: rider check first, private contacts second, station/helper network only when the rider has enabled it."
      >
        <SmartSurfGrid>
          <SmartSurfCard title="Trusted contacts" eyebrow="Private escalation">
            <FieldGrid>
              <TextInput label="Contact 1 name" value={draft.emergencyContact1Name} onChange={setField('emergencyContact1Name')} />
              <TextInput label="Contact 1 phone" value={draft.emergencyContact1Phone} onChange={setField('emergencyContact1Phone')} />
              <TextInput label="Contact 1 email" value={draft.emergencyContact1Email} onChange={setField('emergencyContact1Email')} />
              <TextInput label="Contact 2 name" value={draft.emergencyContact2Name} onChange={setField('emergencyContact2Name')} />
              <TextInput label="Contact 2 phone" value={draft.emergencyContact2Phone} onChange={setField('emergencyContact2Phone')} />
              <TextInput label="Contact 2 email" value={draft.emergencyContact2Email} onChange={setField('emergencyContact2Email')} />
            </FieldGrid>
          </SmartSurfCard>
          <SmartSurfCard title="Rescue notes" eyebrow="For emergency context">
            <FieldGrid>
              <SelectInput label="Swimming level" value={draft.swimmingLevel} onChange={setField('swimmingLevel')} options={[['', 'Not set'], ['weak', 'Weak'], ['normal', 'Normal'], ['strong', 'Strong'], ['lifeguard', 'Lifeguard/rescue trained']]} />
              <TextInput label="Medical notes optional" value={draft.medicalNotes} onChange={setField('medicalNotes')} multiline />
              <TextInput label="Rescue notes optional" value={draft.rescueNotes} onChange={setField('rescueNotes')} multiline />
            </FieldGrid>
          </SmartSurfCard>
          <SmartSurfCard title="Local Safety Network" eyebrow="Opt-in only">
            <ToggleInput label="Enable Local Safety Network" checked={draft.localSafetyNetworkEnabled} onChange={setField('localSafetyNetworkEnabled')} />
            <ToggleInput label="Receive nearby safety alerts" checked={draft.helperModeEnabled} onChange={setField('helperModeEnabled')} />
            <ToggleInput label="Show my incident on local spot map if needed" checked={draft.showIncidentOnSpotMap} onChange={setField('showIncidentOnSpotMap')} />
            <ToggleInput label="Share identity to station during active emergency" checked={draft.shareIdentityToStation} onChange={setField('shareIdentityToStation')} />
            <ToggleInput label="Share exact location during active emergency" checked={draft.shareExactLocationDuringEmergency} onChange={setField('shareExactLocationDuringEmergency')} />
            <TextInput label="Alert radius meters" type="number" value={draft.alertRadiusMeters} onChange={setField('alertRadiusMeters')} />
          </SmartSurfCard>
          <SmartSurfCard title="Safety logic" eyebrow="SmartSurf context v1">
            <Typography sx={{ fontWeight: 800, mb: 1 }}>Hard stops include:</Typography>
            {hardStopRules.slice(0, 3).map((rule) => (
              <Typography key={rule} sx={{ mb: 1 }}>{rule}</Typography>
            ))}
            <Typography sx={{ fontWeight: 800, mt: 2, mb: 1 }}>Monitoring patterns prepared:</Typography>
            {telemetryPatterns.slice(0, 5).map((pattern) => (
              <Typography key={pattern} sx={{ mb: 1 }}>{pattern.replaceAll('_', ' ')}</Typography>
            ))}
          </SmartSurfCard>
        </SmartSurfGrid>
        <SaveBar saving={saving} onSave={() => saveSafety(draft)} message="No private identity is exposed on a local spot map by default." />
      </SmartSurfPage>
    </SmartSurfLayout>
  );
};

export default SafetyPage;
