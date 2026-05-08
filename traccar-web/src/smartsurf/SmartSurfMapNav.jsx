import { useState } from 'react';
import {
  Button,
  Divider,
  Menu,
  MenuItem,
  Paper,
  Stack,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { makeStyles } from 'tss-react/mui';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';

const useStyles = makeStyles()((theme, { mapExpanded }) => ({
  bar: {
    position: 'fixed',
    top: theme.spacing(1.5),
    left: mapExpanded
      ? theme.spacing(1.5)
      : `calc(${theme.dimensions.drawerWidthDesktop} + ${theme.spacing(3)})`,
    zIndex: 12,
    padding: theme.spacing(0.75),
    borderRadius: 16,
    background: 'linear-gradient(135deg, rgba(16, 38, 61, .95), rgba(10, 44, 54, .92))',
    color: '#fff',
    border: '1px solid rgba(53, 208, 162, .32)',
    backdropFilter: 'blur(14px)',
    boxShadow: '0 18px 50px rgba(0,0,0,.28)',
    [theme.breakpoints.down('md')]: {
      top: theme.spacing(1),
      left: theme.spacing(1),
      right: theme.spacing(1),
    },
  },
  title: {
    fontWeight: 900,
    letterSpacing: 1.2,
    whiteSpace: 'nowrap',
    padding: theme.spacing(0, 1),
    color: '#eaf3f7',
    [theme.breakpoints.down('sm')]: {
      display: 'none',
    },
  },
  button: {
    color: '#fff',
    borderColor: 'rgba(255,255,255,.28)',
    whiteSpace: 'nowrap',
    borderRadius: 10,
    fontWeight: 800,
  },
  secondaryButton: {
    color: '#eaf3f7',
    borderColor: 'rgba(143, 211, 255, .24)',
    background: 'rgba(7, 24, 39, .55)',
    whiteSpace: 'nowrap',
    borderRadius: 10,
    fontWeight: 800,
    '&:hover': {
      borderColor: 'rgba(53, 208, 162, .55)',
      background: 'rgba(53, 208, 162, .1)',
    },
  },
}));

const appItems = [
  ['Dashboard', '/'],
  ['Fusion Map', '/map'],
  ['Can I ride now?', '/smartsurf/conditions'],
  ['Sessions', '/smartsurf/sessions'],
  ['Rider Profile', '/smartsurf/rider-profile'],
  ['Gear', '/smartsurf/gear'],
  ['SmartSurf Devices', '/smartsurf/devices'],
  ['Safety', '/smartsurf/safety'],
  ['Incidents', '/smartsurf/incidents'],
  ['Local Safety Map', '/smartsurf/local-safety-map'],
];

const adminItems = [
  ['Admin Preferences', '/settings/preferences?menu=true'],
  ['Traccar Devices', '/settings/devices?menu=true'],
  ['Users', '/settings/users?menu=true'],
  ['Server', '/settings/server?menu=true'],
  ['Reports', '/reports/combined?menu=true'],
];

const SmartSurfMapNav = ({ devicesOpen, setDevicesOpen, mapExpanded, setMapExpanded }) => {
  const theme = useTheme();
  const mobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { classes } = useStyles({ mapExpanded });
  const navigate = useNavigate();
  const admin = useSelector((state) => !!state.session.user?.administrator);
  const [appAnchor, setAppAnchor] = useState(null);
  const [adminAnchor, setAdminAnchor] = useState(null);

  const go = (path) => {
    setAppAnchor(null);
    setAdminAnchor(null);
    navigate(path);
  };

  return (
    <Paper className={classes.bar}>
      <Stack direction="row" gap={1} alignItems="center" sx={{ overflowX: 'auto' }}>
        <Typography className={classes.title}>SMARTSURF</Typography>
        <Button
          className={classes.button}
          variant="contained"
          color="secondary"
          size={mobile ? 'small' : 'medium'}
          onClick={() => navigate('/')}
        >
          Dashboard
        </Button>
        <Button
          className={classes.secondaryButton}
          variant="outlined"
          size={mobile ? 'small' : 'medium'}
          onClick={(event) => setAppAnchor(event.currentTarget)}
        >
          App Menu
        </Button>
        <Button
          className={classes.secondaryButton}
          variant="outlined"
          size={mobile ? 'small' : 'medium'}
          onClick={() => {
            if (mobile) {
              setDevicesOpen(!devicesOpen);
            } else {
              setMapExpanded(!mapExpanded);
            }
          }}
        >
          {mobile
            ? devicesOpen ? 'Hide Trackers' : 'Show Trackers'
            : mapExpanded ? 'Show Tracker Panel' : 'Full Map'}
        </Button>
        {admin && (
          <Button
            className={classes.secondaryButton}
            variant="outlined"
            color="warning"
            size={mobile ? 'small' : 'medium'}
            onClick={(event) => setAdminAnchor(event.currentTarget)}
          >
            Admin Tools
          </Button>
        )}
      </Stack>
      <Menu anchorEl={appAnchor} open={Boolean(appAnchor)} onClose={() => setAppAnchor(null)}>
        {appItems.map(([label, path]) => (
          <MenuItem key={path} onClick={() => go(path)}>{label}</MenuItem>
        ))}
      </Menu>
      <Menu anchorEl={adminAnchor} open={Boolean(adminAnchor)} onClose={() => setAdminAnchor(null)}>
        <Typography variant="overline" sx={{ px: 2, py: 1, display: 'block' }}>
          Traccar Admin
        </Typography>
        <Divider />
        {adminItems.map(([label, path]) => (
          <MenuItem key={path} onClick={() => go(path)}>{label}</MenuItem>
        ))}
      </Menu>
    </Paper>
  );
};

export default SmartSurfMapNav;
