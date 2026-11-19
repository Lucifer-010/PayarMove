import React from 'react';
import LandlordDashboardView from './LandlordDashboardView';
import LandlordPropertiesView from './LandlordPropertiesView';
import LandlordSchedulesView from './LandlordSchedulesView';
import LandlordTenantsView from './LandlordTenantsView';
import LandlordReconciliationView from './LandlordReconciliationView';
import HostDashboardView from '../host/HostDashboardView';

export default function LandlordWrapperView({ initialTab = 'dashboard' }) {
  switch (initialTab) {
    case 'properties':
      return <LandlordPropertiesView />;
    case 'schedules':
      return <LandlordSchedulesView />;
    case 'tenants':
      return <LandlordTenantsView />;
    case 'reconciliation':
      return <LandlordReconciliationView />;
    case 'dashboard':
    default:
      return <HostDashboardView />;
  }
}
