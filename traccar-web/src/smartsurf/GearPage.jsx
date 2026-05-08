import { useEffect } from 'react';
import { Button, Divider, Stack, Typography } from '@mui/material';
import SmartSurfLayout from './SmartSurfLayout';
import { SmartSurfCard, SmartSurfGrid, SmartSurfPage } from './SmartSurfShell';
import { FieldGrid, SaveBar, SelectInput, TextInput, ToggleInput, useEditable } from './forms';
import { defaultGear, options } from './domain';
import { useSmartSurfData } from './storage';

const GearPage = () => {
  const { gear, saveGear, saving } = useSmartSurfData();
  const [draft, setDraft] = useEditable({ ...defaultGear, ...gear });
  useEffect(() => setDraft({ ...defaultGear, ...gear }), [gear, setDraft]);

  const updateList = (listName, index, field, value) => {
    setDraft((current) => ({
      ...current,
      [listName]: current[listName].map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item,
      ),
    }));
  };

  const addItem = (listName, item) => {
    setDraft((current) => ({ ...current, [listName]: [...(current[listName] || []), item] }));
  };

  const updateSafetyEquipment = (field) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    setDraft((current) => ({
      ...current,
      safetyEquipment: { ...current.safetyEquipment, [field]: value },
    }));
  };

  return (
    <SmartSurfLayout title="smartsurfGear">
      <SmartSurfPage
        eyebrow="Gear"
        title="Kites, boards, foils, and safety equipment."
        text="Gear is a core part of the risk engine. The same wind can be safe or dangerous depending on rider weight, kite size, board type, foil setup, and safety equipment."
      >
        <SmartSurfGrid>
          <SmartSurfCard title="Kites" eyebrow="Quiver">
            {(draft.kites || []).map((kite, index) => (
              <Stack key={kite.kiteId || index} gap={2} sx={{ mb: 3 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>Kite {index + 1}</Typography>
                <FieldGrid>
                  <TextInput label="Brand" value={kite.brand} onChange={(event) => updateList('kites', index, 'brand', event.target.value)} />
                  <TextInput label="Model" value={kite.model} onChange={(event) => updateList('kites', index, 'model', event.target.value)} />
                  <TextInput label="Size m2" type="number" value={kite.sizeM2} onChange={(event) => updateList('kites', index, 'sizeM2', event.target.value)} />
                  <TextInput label="Year optional" type="number" value={kite.year} onChange={(event) => updateList('kites', index, 'year', event.target.value)} />
                  <SelectInput label="Type" value={kite.type} options={options.kiteType} onChange={(event) => updateList('kites', index, 'type', event.target.value)} />
                  <TextInput label="Wind low" type="number" value={kite.windRangeLow} onChange={(event) => updateList('kites', index, 'windRangeLow', event.target.value)} />
                  <TextInput label="Wind high" type="number" value={kite.windRangeHigh} onChange={(event) => updateList('kites', index, 'windRangeHigh', event.target.value)} />
                  <ToggleInput label="Active" checked={kite.active !== false} onChange={(event) => updateList('kites', index, 'active', event.target.checked)} />
                </FieldGrid>
                <TextInput label="Notes" value={kite.notes} onChange={(event) => updateList('kites', index, 'notes', event.target.value)} multiline />
                <Divider />
              </Stack>
            ))}
            <Button
              variant="outlined"
              onClick={() => addItem('kites', { kiteId: `kite-${Date.now()}`, brand: '', model: '', sizeM2: '', type: 'freeride', active: true })}
            >
              Add kite
            </Button>
          </SmartSurfCard>
          <SmartSurfCard title="Boards and foils" eyebrow="Water setup">
            {(draft.boards || []).map((board, index) => (
              <Stack key={board.boardId || index} gap={2} sx={{ mb: 3 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>Board {index + 1}</Typography>
                <FieldGrid>
                  <TextInput label="Brand" value={board.brand} onChange={(event) => updateList('boards', index, 'brand', event.target.value)} />
                  <TextInput label="Model" value={board.model} onChange={(event) => updateList('boards', index, 'model', event.target.value)} />
                  <SelectInput label="Board type" value={board.boardType} options={options.boardType} onChange={(event) => updateList('boards', index, 'boardType', event.target.value)} />
                  <TextInput label="Length cm" type="number" value={board.lengthCm} onChange={(event) => updateList('boards', index, 'lengthCm', event.target.value)} />
                  <TextInput label="Volume liters" type="number" value={board.volumeL} onChange={(event) => updateList('boards', index, 'volumeL', event.target.value)} />
                  <ToggleInput label="Foil compatible" checked={board.foilCompatible} onChange={(event) => updateList('boards', index, 'foilCompatible', event.target.checked)} />
                  <ToggleInput label="Active" checked={board.active !== false} onChange={(event) => updateList('boards', index, 'active', event.target.checked)} />
                </FieldGrid>
                <TextInput label="Notes" value={board.notes} onChange={(event) => updateList('boards', index, 'notes', event.target.value)} multiline />
                <Divider />
              </Stack>
            ))}
            <Button
              variant="outlined"
              onClick={() => addItem('boards', { boardId: `board-${Date.now()}`, brand: '', model: '', boardType: 'twin-tip', active: true })}
            >
              Add board
            </Button>
          </SmartSurfCard>
          <SmartSurfCard title="Harness and safety equipment" eyebrow="Session readiness">
            <FieldGrid>
              <TextInput label="Harness type" value={draft.safetyEquipment?.harnessType} onChange={updateSafetyEquipment('harnessType')} />
              <TextInput label="Wetsuit mm" type="number" value={draft.safetyEquipment?.wetsuitMm} onChange={updateSafetyEquipment('wetsuitMm')} />
              <SelectInput label="Leash type" value={draft.safetyEquipment?.leashType} options={options.leashType} onChange={updateSafetyEquipment('leashType')} />
              <TextInput label="Linked tracker device id" value={draft.safetyEquipment?.trackerDeviceId} onChange={updateSafetyEquipment('trackerDeviceId')} />
              <ToggleInput label="Impact vest" checked={draft.safetyEquipment?.impactVest} onChange={updateSafetyEquipment('impactVest')} />
              <ToggleInput label="Helmet" checked={draft.safetyEquipment?.helmet} onChange={updateSafetyEquipment('helmet')} />
              <ToggleInput label="Leash" checked={draft.safetyEquipment?.leash} onChange={updateSafetyEquipment('leash')} />
              <ToggleInput label="Knife" checked={draft.safetyEquipment?.knife} onChange={updateSafetyEquipment('knife')} />
              <ToggleInput label="Quick-release checked" checked={draft.safetyEquipment?.quickReleaseChecked} onChange={updateSafetyEquipment('quickReleaseChecked')} />
              <ToggleInput label="Radio/intercom" checked={draft.safetyEquipment?.radioIntercom} onChange={updateSafetyEquipment('radioIntercom')} />
              <ToggleInput label="SmartSurf tracker" checked={draft.safetyEquipment?.smartSurfTracker} onChange={updateSafetyEquipment('smartSurfTracker')} />
            </FieldGrid>
          </SmartSurfCard>
        </SmartSurfGrid>
        <SaveBar saving={saving} onSave={() => saveGear(draft)} message="Gear will drive kite recommendation and risk scoring." />
      </SmartSurfPage>
    </SmartSurfLayout>
  );
};

export default GearPage;
