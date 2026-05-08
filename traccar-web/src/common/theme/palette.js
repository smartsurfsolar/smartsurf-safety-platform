import { grey } from '@mui/material/colors';

const validatedColor = (color) => (/^#([0-9A-Fa-f]{3}){1,2}$/.test(color) ? color : null);

export default (server, darkMode) => ({
  mode: darkMode ? 'dark' : 'light',
  background: {
    default: darkMode ? '#06131f' : '#f4f8fb',
  },
  primary: {
    main:
      validatedColor(server?.attributes?.colorPrimary) || (darkMode ? '#8fd3ff' : '#0b2440'),
  },
  secondary: {
    main:
      validatedColor(server?.attributes?.colorSecondary) || (darkMode ? '#35d0a2' : '#19a87f'),
  },
  neutral: {
    main: grey[500],
  },
  geometry: {
    main: '#35d0a2',
  },
  alwaysDark: {
    main: grey[900],
  },
});
