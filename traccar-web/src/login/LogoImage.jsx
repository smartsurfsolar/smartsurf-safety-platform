import { useTheme, useMediaQuery } from '@mui/material';
import { useSelector } from 'react-redux';
import { makeStyles } from 'tss-react/mui';

const useStyles = makeStyles()((theme) => ({
  image: {
    alignSelf: 'center',
    width: 132,
    height: 132,
    margin: theme.spacing(2),
    borderRadius: 28,
    objectFit: 'cover',
    boxShadow: '0 18px 46px rgba(0, 0, 0, .34)',
  },
}));

const LogoImage = () => {
  const theme = useTheme();
  const { classes } = useStyles();

  const expanded = !useMediaQuery(theme.breakpoints.down('lg'));

  const logo = useSelector((state) => state.session.server.attributes?.logo);
  const logoInverted = useSelector((state) => state.session.server.attributes?.logoInverted);

  if (logo) {
    if (expanded && logoInverted) {
      return <img className={classes.image} src={logoInverted} alt="" />;
    }
    return <img className={classes.image} src={logo} alt="" />;
  }
  return <img className={classes.image} src="/LogoMain.png" alt="SmartSurf" />;
};

export default LogoImage;
