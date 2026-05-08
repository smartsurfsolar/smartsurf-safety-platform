import PageLayout from '../common/components/PageLayout';
import SmartSurfMenu from './SmartSurfMenu';

const SmartSurfLayout = ({ title = 'Dashboard', children }) => (
  <PageLayout menu={<SmartSurfMenu />} breadcrumbs={['smartsurfTitle', title]}>
    {children}
  </PageLayout>
);

export default SmartSurfLayout;
