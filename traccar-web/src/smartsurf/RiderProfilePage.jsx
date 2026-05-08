import { useEffect } from 'react';
import SmartSurfLayout from './SmartSurfLayout';
import { SmartSurfCard, SmartSurfGrid, SmartSurfPage } from './SmartSurfShell';
import { FieldGrid, SaveBar, SelectInput, TextInput, ToggleInput, useEditable } from './forms';
import { defaultRider, defaultSafety, options } from './domain';
import { useSmartSurfData } from './storage';

const RiderProfilePage = () => {
  const { rider, safety, saveRider, saveSafety, saving, user } = useSmartSurfData();
  const [draft, setDraft, setField] = useEditable({ ...defaultRider, ...rider });
  const [safetyDraft, setSafetyDraft, setSafetyField] = useEditable({ ...defaultSafety, ...safety });

  useEffect(() => setDraft({ ...defaultRider, ...rider }), [rider, setDraft]);
  useEffect(() => setSafetyDraft({ ...defaultSafety, ...safety }), [safety, setSafetyDraft]);

  return (
    <SmartSurfLayout title="smartsurfRiderProfile">
      <SmartSurfPage
        eyebrow="Rider Profile"
        title="Personal context for better recommendations."
        text="SmartSurf uses rider identity, body context, skill, home spot, and safety preferences to make Senlay conditions and GPS tracking useful for one real rider."
      >
        <SmartSurfGrid>
          <SmartSurfCard title="Basic identity" eyebrow="Account">
            <FieldGrid>
              <TextInput label="Full name" value={draft.fullName || user.name} onChange={setField('fullName')} />
              <TextInput label="Display name" value={draft.displayName} onChange={setField('displayName')} />
              <TextInput label="Email" value={user.email} onChange={() => {}} />
              <TextInput label="Phone" value={draft.phone} onChange={setField('phone')} />
              <TextInput label="Country" value={draft.country} onChange={setField('country')} />
              <TextInput label="Home spot" value={draft.homeSpot} onChange={setField('homeSpot')} />
              <TextInput label="Preferred language" value={draft.preferredLanguage} onChange={setField('preferredLanguage')} />
            </FieldGrid>
          </SmartSurfCard>
          <SmartSurfCard title="Physical and skill profile" eyebrow="Recommendation context">
            <FieldGrid>
              <TextInput label="Weight kg" type="number" value={draft.weightKg} onChange={setField('weightKg')} />
              <TextInput label="Height cm optional" type="number" value={draft.heightCm} onChange={setField('heightCm')} />
              <TextInput label="Age" type="number" value={draft.age} onChange={setField('age')} />
              <TextInput label="Fitness level optional" value={draft.fitnessLevel} onChange={setField('fitnessLevel')} />
              <SelectInput label="Sport mode" value={draft.sportMode} onChange={setField('sportMode')} options={options.sportMode} />
              <TextInput label="Years experience" type="number" value={draft.yearsExperience} onChange={setField('yearsExperience')} />
              <SelectInput label="Skill level" value={draft.skillLevel} onChange={setField('skillLevel')} options={options.skillLevel} />
              <SelectInput label="Riding style" value={draft.ridingStyle} onChange={setField('ridingStyle')} options={options.ridingStyle} />
              <SelectInput label="Swimming confidence" value={draft.swimmingConfidence} onChange={setField('swimmingConfidence')} options={options.swimmingConfidence} />
              <SelectInput label="Session support" value={draft.buddyStatus} onChange={setField('buddyStatus')} options={options.buddyStatus} />
              <ToggleInput label="Self-rescue competent" checked={draft.selfRescueCompetent} onChange={setField('selfRescueCompetent')} />
              <ToggleInput label="Can reliably ride upwind" checked={draft.reliableUpwind} onChange={setField('reliableUpwind')} />
            </FieldGrid>
          </SmartSurfCard>
          <SmartSurfCard title="Preferences" eyebrow="Units and privacy">
            <FieldGrid>
              <SelectInput label="Preferred units" value={draft.preferredUnits} onChange={setField('preferredUnits')} options={[['metric', 'Metric'], ['imperial', 'Imperial']]} />
              <SelectInput label="Wind units" value={draft.windUnits} onChange={setField('windUnits')} options={[['kmh', 'km/h'], ['knots', 'Knots'], ['ms', 'm/s']]} />
              <SelectInput label="Privacy mode" value={draft.privacyMode} onChange={setField('privacyMode')} options={[['private', 'Private'], ['trusted', 'Trusted contacts'], ['local_network', 'Local safety network']]} />
            </FieldGrid>
            <ToggleInput label="Enable Local Safety Network" checked={safetyDraft.localSafetyNetworkEnabled} onChange={setSafetyField('localSafetyNetworkEnabled')} />
            <ToggleInput label="Helper mode: receive nearby alerts" checked={safetyDraft.helperModeEnabled} onChange={setSafetyField('helperModeEnabled')} />
            <ToggleInput label="Share active emergency with station" checked={safetyDraft.stationSharingEnabled} onChange={setSafetyField('stationSharingEnabled')} />
          </SmartSurfCard>
        </SmartSurfGrid>
        <SaveBar
          saving={saving}
          onSave={() => Promise.all([saveRider(draft), saveSafety(safetyDraft)])}
          message="Saved in Traccar user attributes for the first MVP. The project includes separate SmartSurf database tables for the next backend step."
        />
      </SmartSurfPage>
    </SmartSurfLayout>
  );
};

export default RiderProfilePage;
