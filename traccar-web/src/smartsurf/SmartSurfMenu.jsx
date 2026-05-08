import DashboardIcon from '@mui/icons-material/Dashboard';
import MapIcon from '@mui/icons-material/Map';
import TimelineIcon from '@mui/icons-material/Timeline';
import SensorsIcon from '@mui/icons-material/Sensors';
import PersonIcon from '@mui/icons-material/Person';
import SurfingIcon from '@mui/icons-material/Surfing';
import DevicesIcon from '@mui/icons-material/Devices';
import HealthAndSafetyIcon from '@mui/icons-material/HealthAndSafety';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import PublicIcon from '@mui/icons-material/Public';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import StorageIcon from '@mui/icons-material/Storage';
import PeopleIcon from '@mui/icons-material/People';
import AssessmentIcon from '@mui/icons-material/Assessment';
import { useSelector } from 'react-redux';
import SideNav from '../common/components/SideNav';

export const smartSurfProductRoutes = [
  { name: 'Dashboard', href: '/', match: '^/$', icon: <DashboardIcon /> },
  { name: 'Fusion Map', href: '/map', icon: <MapIcon /> },
  { name: 'Sessions', href: '/smartsurf/sessions', icon: <TimelineIcon /> },
  { name: 'Conditions', href: '/smartsurf/conditions', icon: <SensorsIcon /> },
  { subheader: 'Rider Setup' },
  { name: 'Rider Profile', href: '/smartsurf/rider-profile', icon: <PersonIcon /> },
  { name: 'Gear', href: '/smartsurf/gear', icon: <SurfingIcon /> },
  { name: 'SmartSurf Devices', href: '/smartsurf/devices', icon: <DevicesIcon /> },
  { name: 'Safety', href: '/smartsurf/safety', icon: <HealthAndSafetyIcon /> },
  { name: 'Incidents', href: '/smartsurf/incidents', icon: <WarningAmberIcon /> },
  { name: 'Local Safety Map', href: '/smartsurf/local-safety-map', icon: <PublicIcon /> },
];

export const smartSurfAdminRoutes = [
  { subheader: 'Traccar Admin' },
  { name: 'Admin Preferences', href: '/settings/preferences?menu=true', icon: <AdminPanelSettingsIcon /> },
  { name: 'Traccar Devices', href: '/settings/devices?menu=true', icon: <StorageIcon /> },
  { name: 'Users', href: '/settings/users?menu=true', icon: <PeopleIcon /> },
  { name: 'Server', href: '/settings/server?menu=true', icon: <AdminPanelSettingsIcon /> },
  { name: 'Reports', href: '/reports/combined?menu=true', icon: <AssessmentIcon /> },
];

const SmartSurfMenu = () => {
  const user = useSelector((state) => state.session.user);
  const routes = [
    ...smartSurfProductRoutes,
    ...(user?.administrator ? smartSurfAdminRoutes : []),
  ];

  return <SideNav routes={routes} />;
};

export default SmartSurfMenu;
