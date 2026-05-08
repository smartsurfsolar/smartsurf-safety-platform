import { useEffect } from 'react';
import { Button, Typography } from '@mui/material';
import SmartSurfLayout from './SmartSurfLayout';
import { SmartSurfCard, SmartSurfGrid, SmartSurfPage } from './SmartSurfShell';
import { FieldGrid, SaveBar, SelectInput, TextInput, ToggleInput, useEditable } from './forms';
import { options } from './domain';
import { useSmartSurfData } from './storage';

const DeviceMappingPage = () => {
  const { devices, deviceMappings, saveDeviceMappings, saving } = useSmartSurfData();
  const [draft, setDraft] = useEditable(deviceMappings.length ? deviceMappings : []);
  useEffect(() => setDraft(deviceMappings.length ? deviceMappings : []), [deviceMappings, setDraft]);

  const deviceList = Object.values(devices || {});
  const update = (index, field, value) => {
    setDraft((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, [field]: value } : item)));
  };
  const add = () => setDraft((current) => [...current, {
    deviceId: `mapping-${Date.now()}`,
    traccarDeviceId: deviceList[0]?.id || '',
    deviceType: 'phone_tracker',
    label: '',
    assignedTo: 'rider',
    active: true,
    waterproofTracker: false,
    solarPowered: false,
    hardwareVersion: '',
    firmwareVersion: '',
  }]);

  return (
    <SmartSurfLayout title="smartsurfDevices">
      <SmartSurfPage
        eyebrow="Devices"
        title="Give Traccar devices SmartSurf meaning."
        text="Traccar stores low-level GPS devices. SmartSurf maps each one to rider, board, kite, helmet, school fleet, or future waterproof hardware tracker."
        actions={<Button variant="contained" color="secondary" size="large" onClick={add}>Add mapping</Button>}
      >
        <SmartSurfGrid>
          {draft.map((mapping, index) => (
            <SmartSurfCard title={mapping.label || `Tracking source ${index + 1}`} eyebrow="SmartSurf device" key={mapping.deviceId || index}>
              <FieldGrid>
                <SelectInput
                  label="Traccar device"
                  value={String(mapping.traccarDeviceId || '')}
                  onChange={(event) => update(index, 'traccarDeviceId', event.target.value)}
                  options={(deviceList.length ? deviceList : [{ id: '', name: 'No Traccar devices yet' }]).map((device) => [String(device.id), device.name])}
                />
                <SelectInput label="Device type" value={mapping.deviceType} onChange={(event) => update(index, 'deviceType', event.target.value)} options={options.deviceType} />
                <TextInput label="Label" value={mapping.label} onChange={(event) => update(index, 'label', event.target.value)} />
                <SelectInput label="Assigned to" value={mapping.assignedTo} onChange={(event) => update(index, 'assignedTo', event.target.value)} options={options.assignedTo} />
                <TextInput label="Hardware version optional" value={mapping.hardwareVersion} onChange={(event) => update(index, 'hardwareVersion', event.target.value)} />
                <TextInput label="Firmware version optional" value={mapping.firmwareVersion} onChange={(event) => update(index, 'firmwareVersion', event.target.value)} />
                <ToggleInput label="Active" checked={mapping.active !== false} onChange={(event) => update(index, 'active', event.target.checked)} />
                <ToggleInput label="Waterproof tracker" checked={mapping.waterproofTracker} onChange={(event) => update(index, 'waterproofTracker', event.target.checked)} />
                <ToggleInput label="Solar powered" checked={mapping.solarPowered} onChange={(event) => update(index, 'solarPowered', event.target.checked)} />
              </FieldGrid>
            </SmartSurfCard>
          ))}
          {!draft.length && (
            <SmartSurfCard title="No mappings yet" eyebrow="Start here">
              <Typography>Add a Traccar device, then map it to rider, board, helmet, or future SmartSurf tracker.</Typography>
            </SmartSurfCard>
          )}
        </SmartSurfGrid>
        <SaveBar saving={saving} onSave={() => saveDeviceMappings(draft)} message="Device mapping is stored in the same Traccar user account for one-login MVP usage." />
      </SmartSurfPage>
    </SmartSurfLayout>
  );
};

export default DeviceMappingPage;
