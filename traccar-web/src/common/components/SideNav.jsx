import { Fragment } from 'react';
import {
  List,
  ListItemText,
  ListItemIcon,
  Divider,
  ListSubheader,
  ListItemButton,
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { Link, useLocation } from 'react-router-dom';

const useStyles = makeStyles()(() => ({
  list: {
    padding: '14px 10px',
    background: 'transparent',
  },
  item: {
    minHeight: 50,
    margin: '4px 0',
    borderRadius: 12,
    color: '#d8e8f2',
    border: '1px solid transparent',
    '& .MuiListItemIcon-root': {
      minWidth: 42,
      color: 'inherit',
    },
    '& .MuiTypography-root': {
      fontWeight: 700,
      whiteSpace: 'nowrap',
    },
    '&:hover': {
      background: 'rgba(53, 208, 162, .11)',
      borderColor: 'rgba(53, 208, 162, .16)',
      color: '#ffffff',
    },
    '&.Mui-selected': {
      background: 'linear-gradient(90deg, rgba(53, 208, 162, .28), rgba(143, 211, 255, .09))',
      borderColor: 'rgba(53, 208, 162, .42)',
      color: '#ffffff',
    },
    '&.Mui-selected:hover': {
      background: 'linear-gradient(90deg, rgba(53, 208, 162, .34), rgba(143, 211, 255, .12))',
    },
  },
  subheader: {
    padding: '18px 6px 7px',
    lineHeight: 1,
    color: '#35d0a2',
    background: 'transparent',
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: '.13em',
    textTransform: 'uppercase',
  },
  divider: {
    margin: '10px 0 4px',
    borderColor: 'rgba(143, 211, 255, .14)',
  },
}));

const SideNav = ({ routes }) => {
  const { classes } = useStyles();
  const location = useLocation();

  return (
    <List disablePadding className={classes.list}>
      {routes.map((route) =>
        route.subheader ? (
          <Fragment key={route.subheader}>
            <Divider className={classes.divider} />
            <ListSubheader className={classes.subheader}>{route.subheader}</ListSubheader>
          </Fragment>
        ) : (
          <ListItemButton
            disableRipple
            component={Link}
            className={classes.item}
            key={route.href}
            to={route.href}
            selected={location.pathname.match(route.match || route.href.split('?')[0]) !== null}
          >
            <ListItemIcon>{route.icon}</ListItemIcon>
            <ListItemText primary={route.name} />
          </ListItemButton>
        ),
      )}
    </List>
  );
};

export default SideNav;
