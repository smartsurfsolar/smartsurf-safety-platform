import { useState } from 'react';
import {
  AppBar,
  Breadcrumbs,
  Drawer,
  IconButton,
  Toolbar,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import MenuIcon from '@mui/icons-material/Menu';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from './LocalizationProvider';
import BackIcon from './BackIcon';

const useStyles = makeStyles()((theme, { miniVariant }) => ({
  root: {
    height: '100%',
    display: 'flex',
    background: '#071827',
    [theme.breakpoints.down('md')]: {
      flexDirection: 'column',
    },
  },
  desktopDrawer: {
    width: miniVariant ? theme.spacing(7) : theme.dimensions.drawerWidthDesktop,
    overflowX: 'hidden',
    boxSizing: 'border-box',
    background: 'linear-gradient(180deg, #10263d 0%, #071827 100%)',
    color: '#eaf3f7',
    borderRight: '1px solid rgba(53, 208, 162, .22)',
    transition: theme.transitions.create('width', {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.enteringScreen,
    }),
    '& .MuiDivider-root': {
      borderColor: 'rgba(143, 211, 255, .14)',
    },
    ...(miniVariant && {
      '& .MuiListItemButton-root': {
        minHeight: 48,
      },
      '& .MuiListItemText-root': {
        display: 'none',
      },
    }),
    '@media print': {
      display: 'none',
    },
  },
  mobileDrawer: {
    width: theme.dimensions.drawerWidthTablet,
    maxWidth: '86vw',
    boxSizing: 'border-box',
    background: 'linear-gradient(180deg, #10263d 0%, #071827 100%)',
    color: '#eaf3f7',
    borderRight: '1px solid rgba(53, 208, 162, .22)',
    '@media print': {
      display: 'none',
    },
  },
  drawerToolbar: {
    minHeight: 72,
    borderBottom: '1px solid rgba(143, 211, 255, .14)',
    '& .MuiTypography-root': {
      color: '#eaf3f7',
      fontWeight: 800,
      letterSpacing: '.04em',
      textTransform: 'uppercase',
    },
    '& .MuiIconButton-root': {
      color: '#eaf3f7',
      borderRadius: 12,
    },
    '& .MuiIconButton-root:hover': {
      background: 'rgba(53, 208, 162, .13)',
    },
  },
  mobileToolbar: {
    zIndex: 1,
    color: '#eaf3f7',
    background: 'linear-gradient(90deg, #10263d 0%, #0b4050 100%)',
    borderBottom: '1px solid rgba(53, 208, 162, .24)',
    boxShadow: '0 10px 28px rgba(0, 0, 0, .22)',
    '& .MuiTypography-root': {
      color: '#eaf3f7',
      fontWeight: 800,
    },
    '@media print': {
      display: 'none',
    },
  },
  content: {
    flexGrow: 1,
    alignItems: 'stretch',
    display: 'flex',
    flexDirection: 'column',
    overflowY: 'auto',
    background: '#071827',
  },
}));

const PageTitle = ({ breadcrumbs }) => {
  const theme = useTheme();
  const t = useTranslation();

  const desktop = useMediaQuery(theme.breakpoints.up('md'));

  if (desktop) {
    return (
      <Typography variant="h6" noWrap>
        {t(breadcrumbs[0])}
      </Typography>
    );
  }
  return (
    <Breadcrumbs>
      {breadcrumbs.slice(0, -1).map((breadcrumb) => (
        <Typography variant="h6" color="inherit" key={breadcrumb}>
          {t(breadcrumb)}
        </Typography>
      ))}
      <Typography variant="h6" color="textPrimary">
        {t(breadcrumbs[breadcrumbs.length - 1])}
      </Typography>
    </Breadcrumbs>
  );
};

const PageLayout = ({ menu, breadcrumbs, children }) => {
  const [miniVariant, setMiniVariant] = useState(false);
  const { classes } = useStyles({ miniVariant });
  const theme = useTheme();
  const navigate = useNavigate();

  const desktop = useMediaQuery(theme.breakpoints.up('md'));

  const [searchParams] = useSearchParams();

  const [openDrawer, setOpenDrawer] = useState(!desktop && searchParams.has('menu'));

  const toggleDrawer = () => setMiniVariant(!miniVariant);

  return (
    <div className={classes.root}>
      {desktop ? (
        <Drawer
          variant="permanent"
          className={classes.desktopDrawer}
          slotProps={{ paper: { className: classes.desktopDrawer } }}
        >
          <Toolbar className={classes.drawerToolbar}>
            {!miniVariant && (
              <>
                <IconButton
                  color="inherit"
                  edge="start"
                  sx={{ mr: 2 }}
                  onClick={() => navigate('/')}
                >
                  <BackIcon />
                </IconButton>
                <PageTitle breadcrumbs={breadcrumbs} />
              </>
            )}
            <IconButton
              color="inherit"
              edge="start"
              sx={{ ml: miniVariant ? -2 : 'auto' }}
              onClick={toggleDrawer}
            >
              {miniVariant !== (theme.direction === 'rtl') ? (
                <ChevronRightIcon />
              ) : (
                <ChevronLeftIcon />
              )}
            </IconButton>
          </Toolbar>
          {menu}
        </Drawer>
      ) : (
        <Drawer
          variant="temporary"
          open={openDrawer}
          onClose={() => setOpenDrawer(false)}
          slotProps={{ paper: { className: classes.mobileDrawer } }}
        >
          {menu}
        </Drawer>
      )}
      {!desktop && (
        <AppBar className={classes.mobileToolbar} position="static" color="inherit">
          <Toolbar>
            <IconButton
              color="inherit"
              edge="start"
              sx={{ mr: 2 }}
              onClick={() => setOpenDrawer(true)}
            >
              <MenuIcon />
            </IconButton>
            <PageTitle breadcrumbs={breadcrumbs} />
          </Toolbar>
        </AppBar>
      )}
      <div className={classes.content}>{children}</div>
    </div>
  );
};

export default PageLayout;
