import { makeStyles } from 'tss-react/mui';
import { ListItemButton, ListItemIcon, ListItemText } from '@mui/material';
import { Link } from 'react-router-dom';

const useStyles = makeStyles()(() => ({
  menuItem: {
    minHeight: 50,
    margin: '4px 10px',
    borderRadius: 12,
    color: '#d8e8f2',
    border: '1px solid transparent',
    '& .MuiListItemIcon-root': {
      minWidth: 42,
      color: 'inherit',
    },
    '& .MuiTypography-root': {
      fontWeight: 700,
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
  menuItemText: {
    whiteSpace: 'nowrap',
  },
}));

const MenuItem = ({ title, link, icon, selected }) => {
  const { classes } = useStyles();
  return (
    <ListItemButton key={link} component={Link} to={link} selected={selected} className={classes.menuItem}>
      <ListItemIcon>{icon}</ListItemIcon>
      <ListItemText primary={title} className={classes.menuItemText} />
    </ListItemButton>
  );
};

export default MenuItem;
