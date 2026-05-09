import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  MenuItem,
  Stack,
  TextField,
} from '@mui/material';

export const useEditable = (initial) => {
  const [value, setValue] = useState(initial);
  const setField = (field) => (event) => {
    const nextValue = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    setValue((current) => ({ ...current, [field]: nextValue }));
  };
  return [value, setValue, setField];
};

export const FieldGrid = ({ children }) => (
  <Box
    sx={{
      display: 'grid',
      gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(auto-fit, minmax(220px, 1fr))' },
      gap: 2,
    }}
  >
    {children}
  </Box>
);

export const TextInput = ({ label, value, onChange, type = 'text', multiline = false }) => (
  <TextField
    label={label}
    value={value || ''}
    onChange={onChange}
    type={type}
    multiline={multiline}
    minRows={multiline ? 3 : undefined}
    fullWidth
  />
);

export const SelectInput = ({ label, value, onChange, options }) => (
  <TextField select label={label} value={value || ''} onChange={onChange} fullWidth>
    {options.map(([optionValue, optionLabel]) => (
      <MenuItem key={optionValue} value={optionValue}>
        {optionLabel}
      </MenuItem>
    ))}
  </TextField>
);

export const ToggleInput = ({ label, checked, onChange }) => (
  <FormControlLabel
    sx={{ alignItems: 'flex-start', '& .MuiFormControlLabel-label': { lineHeight: 1.35, pt: 0.8 } }}
    control={<Checkbox checked={Boolean(checked)} onChange={onChange} />}
    label={label}
  />
);

export const SaveBar = ({ saving, onSave, message }) => (
  <Stack direction={{ xs: 'column', sm: 'row' }} gap={2} sx={{ mt: 3 }} alignItems={{ sm: 'center' }}>
    <Button
      variant="contained"
      color="secondary"
      size="large"
      onClick={onSave}
      disabled={saving}
      sx={{ width: { xs: '100%', sm: 'auto' } }}
    >
      {saving ? 'Saving...' : 'Save'}
    </Button>
    {message && <Alert severity="info" sx={{ flex: 1 }}>{message}</Alert>}
  </Stack>
);
