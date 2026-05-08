import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Paper,
  BottomNavigation,
  BottomNavigationAction,
  Menu,
  MenuItem,
  Typography,
  Badge,
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';

import DescriptionIcon from '@mui/icons-material/Description';
import HealthAndSafetyIcon from '@mui/icons-material/HealthAndSafety';
import SensorsIcon from '@mui/icons-material/Sensors';
import MapIcon from '@mui/icons-material/Map';
import PersonIcon from '@mui/icons-material/Person';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import DashboardIcon from '@mui/icons-material/Dashboard';

import { sessionActions } from '../../store';
import { useTranslation } from './LocalizationProvider';
import { useRestriction } from '../util/permissions';
import { nativePostMessage } from './NativeInterface';

const useStyles = makeStyles()(() => ({
  paper: {
    background: 'linear-gradient(90deg, #10263d 0%, #071827 100%)',
    borderTop: '1px solid rgba(53, 208, 162, .24)',
    color: '#eaf3f7',
    boxShadow: '0 -12px 30px rgba(0, 0, 0, .28)',
    '& .MuiBottomNavigation-root': {
      background: 'transparent',
    },
    '& .MuiBottomNavigationAction-root': {
      color: '#b8c8d9',
      minWidth: 64,
      fontWeight: 700,
    },
    '& .MuiBottomNavigationAction-label': {
      fontWeight: 700,
    },
    '& .Mui-selected': {
      color: '#35d0a2',
    },
    '& .MuiSvgIcon-root': {
      color: 'inherit',
    },
  },
  accountMenu: {
    color: '#eaf3f7',
    background: 'linear-gradient(180deg, #10263d 0%, #071827 100%)',
    border: '1px solid rgba(53, 208, 162, .22)',
    '& .MuiMenuItem-root': {
      color: '#d8e8f2',
      fontWeight: 700,
    },
    '& .MuiTypography-root': {
      color: 'inherit',
    },
    '& .MuiMenuItem-root:hover': {
      background: 'rgba(53, 208, 162, .12)',
      color: '#ffffff',
    },
  },
}));

const BottomMenu = () => {
  const { classes } = useStyles();
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const t = useTranslation();

  const readonly = useRestriction('readonly');
  const disableReports = useRestriction('disableReports');
  const devices = useSelector((state) => state.devices.items);
  const user = useSelector((state) => state.session.user);
  const admin = !!user?.administrator;
  const socket = useSelector((state) => state.session.socket);
  const selectedDeviceId = useSelector((state) => state.devices.selectedId);

  const [anchorEl, setAnchorEl] = useState(null);

  const currentSelection = () => {
    if (location.pathname === `/settings/user/${user.id}`) {
      return 'account';
    }
    if (location.pathname.startsWith('/smartsurf/sessions')) {
      return 'sessions';
    }
    if (location.pathname.startsWith('/smartsurf/safety') || location.pathname.startsWith('/smartsurf/incidents')) {
      return 'safety';
    }
    if (location.pathname.startsWith('/smartsurf/conditions')) {
      return 'conditions';
    }
    if (location.pathname.startsWith('/reports')) {
      return 'sessions';
    }
    if (location.pathname === '/map') {
      return 'map';
    }
    if (location.pathname === '/') {
      return 'dashboard';
    }
    return null;
  };

  const handleAccount = () => {
    setAnchorEl(null);
    navigate('/smartsurf/rider-profile');
  };

  const handleLogout = async () => {
    setAnchorEl(null);

    const notificationToken = window.localStorage.getItem('notificationToken');
    if (notificationToken && !user.readonly) {
      window.localStorage.removeItem('notificationToken');
      const tokens = user.attributes.notificationTokens?.split(',') || [];
      if (tokens.includes(notificationToken)) {
        const updatedUser = {
          ...user,
          attributes: {
            ...user.attributes,
            notificationTokens:
              tokens.length > 1
                ? tokens.filter((it) => it !== notificationToken).join(',')
                : undefined,
          },
        };
        await fetch(`/api/users/${user.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedUser),
        });
      }
    }

    await fetch('/api/session', { method: 'DELETE' });
    nativePostMessage('logout');
    navigate('/login');
    dispatch(sessionActions.updateUser(null));
  };

  const handleSelection = (event, value) => {
    switch (value) {
      case 'map':
        navigate('/map');
        break;
      case 'dashboard':
        navigate('/');
        break;
      case 'sessions': {
        let id = selectedDeviceId;
        if (id == null) {
          const deviceIds = Object.keys(devices);
          if (deviceIds.length === 1) {
            id = deviceIds[0];
          }
        }

        if (id != null) {
          navigate('/smartsurf/sessions');
        } else {
          navigate('/smartsurf/sessions');
        }
        break;
      }
      case 'safety':
        navigate('/smartsurf/safety');
        break;
      case 'conditions':
        navigate('/smartsurf/conditions');
        break;
      case 'account':
        setAnchorEl(event.currentTarget);
        break;
      case 'logout':
        handleLogout();
        break;
      default:
        break;
    }
  };

  return (
    <Paper square elevation={3} className={classes.paper}>
      <BottomNavigation value={currentSelection()} onChange={handleSelection} showLabels>
        <BottomNavigationAction
          label="Dashboard"
          icon={<DashboardIcon />}
          value="dashboard"
        />
        <BottomNavigationAction
          label="Fusion Map"
          icon={
            <Badge color="error" variant="dot" overlap="circular" invisible={socket !== false}>
              <MapIcon />
            </Badge>
          }
          value="map"
        />
        {!disableReports && (
          <BottomNavigationAction
            label="Sessions"
            icon={<DescriptionIcon />}
            value="sessions"
          />
        )}
        <BottomNavigationAction
          label="Safety"
          icon={<HealthAndSafetyIcon />}
          value="safety"
        />
        <BottomNavigationAction
          label="Conditions"
          icon={<SensorsIcon />}
          value="conditions"
        />
        {readonly ? (
          <BottomNavigationAction
            label={t('loginLogout')}
            icon={<ExitToAppIcon />}
            value="logout"
          />
        ) : (
          <BottomNavigationAction label={t('settingsUser')} icon={<PersonIcon />} value="account" />
        )}
      </BottomNavigation>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        PaperProps={{ className: classes.accountMenu }}
      >
        <MenuItem onClick={handleAccount}>
          <Typography color="textPrimary">Rider Profile</Typography>
        </MenuItem>
        <MenuItem onClick={() => { setAnchorEl(null); navigate('/smartsurf/gear'); }}>
          <Typography color="textPrimary">Gear</Typography>
        </MenuItem>
        <MenuItem onClick={() => { setAnchorEl(null); navigate('/smartsurf/devices'); }}>
          <Typography color="textPrimary">SmartSurf Devices</Typography>
        </MenuItem>
        {admin && (
          <MenuItem onClick={() => { setAnchorEl(null); navigate('/settings/preferences?menu=true'); }}>
            <Typography color="textPrimary">Traccar Admin</Typography>
          </MenuItem>
        )}
        {admin && (
          <MenuItem onClick={() => { setAnchorEl(null); navigate('/settings/users?menu=true'); }}>
            <Typography color="textPrimary">Traccar Users</Typography>
          </MenuItem>
        )}
        <MenuItem onClick={handleLogout}>
          <Typography color="error">{t('loginLogout')}</Typography>
        </MenuItem>
      </Menu>
    </Paper>
  );
};

export default BottomMenu;
