import { Box, Typography, useMediaQuery, Paper } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { useTheme } from '@mui/material/styles';
import LogoImage from './LogoImage';

const useStyles = makeStyles()((theme) => ({
  root: {
    display: 'flex',
    height: '100%',
    background:
      'linear-gradient(135deg, #06131f 0%, #0d2740 48%, #092a35 100%)',
  },
  sidebar: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    background:
      'linear-gradient(180deg, rgba(7,24,39,.96), rgba(10,52,66,.92)), radial-gradient(circle at 20% 20%, rgba(53,208,162,.24), transparent 32%)',
    color: '#ffffff',
    padding: theme.spacing(6),
    width: theme.dimensions.sidebarWidth,
    [theme.breakpoints.down('lg')]: {
      width: theme.dimensions.sidebarWidthTablet,
    },
    [theme.breakpoints.down('sm')]: {
      width: '0px',
    },
  },
  paper: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
    background:
      'linear-gradient(180deg, rgba(255,255,255,.98), rgba(241,247,251,.96))',
    boxShadow: '-2px 0px 32px rgba(0, 0, 0, 0.34)',
    [theme.breakpoints.up('lg')]: {
      padding: theme.spacing(0, 25, 0, 0),
    },
  },
  form: {
    maxWidth: theme.spacing(52),
    padding: theme.spacing(5),
    width: '100%',
  },
  sidebarCopy: {
    maxWidth: 360,
  },
  eyebrow: {
    color: '#35d0a2',
    fontWeight: 800,
    letterSpacing: 2.4,
    textTransform: 'uppercase',
    marginBottom: theme.spacing(2),
  },
  title: {
    fontWeight: 800,
    lineHeight: 1.06,
    marginBottom: theme.spacing(2),
  },
  text: {
    color: '#b8c8d9',
    fontSize: 17,
    lineHeight: 1.65,
  },
}));

const LoginLayout = ({ children }) => {
  const { classes } = useStyles();
  const theme = useTheme();

  return (
    <main className={classes.root}>
      <div className={classes.sidebar}>
        {!useMediaQuery(theme.breakpoints.down('lg')) && (
          <>
            <LogoImage color="#ffffff" />
            <Box className={classes.sidebarCopy}>
              <Typography className={classes.eyebrow}>SmartSurf Safety Platform</Typography>
              <Typography className={classes.title} variant="h3">
                Track your session. Understand the conditions. Stay safer on the water.
              </Typography>
              <Typography className={classes.text}>
                GPS tracking, rider profiles, gear context, and Senlay-powered environmental
                intelligence in one login.
              </Typography>
            </Box>
            <Typography className={classes.text}>Powered by Traccar tracking and Senlay context.</Typography>
          </>
        )}
      </div>
      <Paper className={classes.paper}>
        <form className={classes.form}>{children}</form>
      </Paper>
    </main>
  );
};

export default LoginLayout;
