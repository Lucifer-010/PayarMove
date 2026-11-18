import React, { useState } from 'react';
import LandlordDashboardView from './LandlordDashboardView';
import LandlordPropertiesView from './LandlordPropertiesView';
import LandlordSchedulesView from './LandlordSchedulesView';
import LandlordTenantsView from './LandlordTenantsView';
import LandlordReconciliationView from './LandlordReconciliationView';
import { LayoutDashboard, Building2, Calendar, Users, ShieldCheck } from 'lucide-react';

export default function LandlordWrapperView({ initialTab = 'dashboard' }) {
  const [activeTab, setActiveTab] = useState(initialTab);

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'properties', label: 'Properties & Units', icon: Building2 },
    { id: 'schedules', label: 'Rent Schedules', icon: Calendar },
    { id: 'tenants', label: 'Tenants & Leases', icon: Users },
    { id: 'reconciliation', label: 'Reconciliation', icon: ShieldCheck },
  ];

  return (
    <div className="min-h-screen bg-[#F2F7F7]">
      {/* Sub-navigation bar for Landlords */}
      <div className="bg-white border-b border-gray-200/80 sticky top-16 sm:top-20 z-30 shadow-2xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto py-2.5 no-scrollbar">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-extrabold whitespace-nowrap transition ${
                    isActive
                      ? 'bg-[#0A4F4E] text-white shadow-xs'
                      : 'text-gray-600 hover:text-gray-950 hover:bg-gray-100/80'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Tab Content */}
      <main className="pb-16">
        {activeTab === 'dashboard' && <LandlordDashboardView onSwitchTab={setActiveTab} />}
        {activeTab === 'properties' && <LandlordPropertiesView />}
        {activeTab === 'schedules' && <LandlordSchedulesView />}
        {activeTab === 'tenants' && <LandlordTenantsView />}
        {activeTab === 'reconciliation' && <LandlordReconciliationView />}
      </main>
    </div>
  );
}

