import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  LinearProgress,
  Stack,
  Typography,
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { Link } from 'react-router-dom';
import { calculateCompletion } from './domain';
import { useSmartSurfData } from './storage';

const useStyles = makeStyles()((theme) => ({
  page: {
    minHeight: '100%',
    padding: theme.spacing(3),
    background:
      'linear-gradient(180deg, #071827 0%, #082338 100%)',
    color: '#eaf3f7',
    [theme.breakpoints.down('sm')]: {
      padding: theme.spacing(1.25),
    },
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: theme.spacing(2),
    [theme.breakpoints.down('sm')]: {
      gridTemplateColumns: 'minmax(0, 1fr)',
      gap: theme.spacing(1.25),
    },
  },
  card: {
    borderRadius: 16,
    border: '1px solid rgba(53, 208, 162, .22)',
    background: 'linear-gradient(145deg, rgba(16, 38, 61, .98), rgba(9, 32, 52, .98))',
    color: '#eaf3f7',
    boxShadow: '0 16px 34px rgba(0, 0, 0, .22)',
    [theme.breakpoints.down('sm')]: {
      borderRadius: 12,
      '& .MuiCardContent-root': {
        padding: theme.spacing(1.5),
      },
    },
    '& .MuiTypography-body1, & .MuiTypography-body2': {
      color: '#c4d6e4',
    },
    '& .MuiLinearProgress-root': {
      backgroundColor: 'rgba(143, 211, 255, .24)',
    },
    '& .MuiLinearProgress-bar': {
      backgroundColor: '#35d0a2',
    },
  },
  hero: {
    marginBottom: theme.spacing(3),
    borderRadius: 20,
    background:
      'linear-gradient(135deg, #10263d 0%, #0a4d5c 100%)',
    color: '#fff',
    border: '1px solid rgba(53, 208, 162, .22)',
    boxShadow: '0 18px 38px rgba(0, 0, 0, .26)',
    [theme.breakpoints.down('sm')]: {
      marginBottom: theme.spacing(1.25),
      borderRadius: 14,
      '& .MuiCardContent-root': {
        padding: theme.spacing(1.75),
      },
    },
  },
  heroText: {
    color: '#c4d6e4',
    maxWidth: 760,
  },
  actions: {
    marginTop: theme.spacing(2),
    flexWrap: 'wrap',
    [theme.breakpoints.down('sm')]: {
      flexDirection: 'column',
      alignItems: 'stretch',
      '& .MuiButton-root': {
        width: '100%',
      },
    },
  },
}));

export const SmartSurfPage = ({ eyebrow, title, text, actions, children }) => {
  const { classes } = useStyles();
  return (
    <Box className={classes.page}>
      <Card className={classes.hero}>
        <CardContent>
          <Typography variant="overline" color="secondary">{eyebrow}</Typography>
          <Typography
            variant="h3"
            sx={{
              fontWeight: 800,
              lineHeight: 1.05,
              mt: 0.5,
              fontSize: { xs: 34, sm: 44, md: 48 },
            }}
          >
            {title}
          </Typography>
          {text && (
            <Typography className={classes.heroText} sx={{ mt: 1.5 }}>
              {text}
            </Typography>
          )}
          {actions && <Stack direction="row" gap={1.5} className={classes.actions}>{actions}</Stack>}
        </CardContent>
      </Card>
      {children}
    </Box>
  );
};

export const SmartSurfGrid = ({ children }) => {
  const { classes } = useStyles();
  return <Box className={classes.grid}>{children}</Box>;
};

export const SmartSurfCard = ({ title, eyebrow, children, action, tone }) => {
  const { classes } = useStyles();
  return (
    <Card className={classes.card}>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1}>
          <Box>
            {eyebrow && <Typography variant="overline" color="secondary">{eyebrow}</Typography>}
            <Typography variant="h6" sx={{ fontWeight: 800 }}>{title}</Typography>
          </Box>
          {tone && <Chip size="small" label={tone} color={tone === 'Ready' ? 'success' : 'warning'} />}
        </Stack>
        <Box sx={{ mt: 2 }}>{children}</Box>
        {action && <Box sx={{ mt: 2 }}>{action}</Box>}
      </CardContent>
    </Card>
  );
};

export const ProfileCompletion = () => {
  const data = useSmartSurfData();
  const completion = calculateCompletion(data);
  return (
    <SmartSurfCard title="Profile readiness" eyebrow="Safety foundation">
      {Object.entries(completion).map(([key, value]) => (
        <Box key={key} sx={{ mb: 1.5 }}>
          <Stack direction="row" justifyContent="space-between">
            <Typography sx={{ textTransform: 'capitalize' }}>{key}</Typography>
            <Typography>{value}%</Typography>
          </Stack>
          <LinearProgress variant="determinate" value={value} sx={{ mt: 0.5, height: 8, borderRadius: 8 }} />
        </Box>
      ))}
      {completion.safety < 70 && (
        <Alert severity="warning" sx={{ mt: 2 }}>
          Add an emergency contact before relying on private SOS escalation.
        </Alert>
      )}
    </SmartSurfCard>
  );
};

export const PrimaryLinkButton = ({ to, children, color = 'secondary' }) => (
  <Button component={Link} to={to} variant="contained" color={color} size="large">
    {children}
  </Button>
);
