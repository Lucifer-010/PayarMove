import React from 'react';
import { useApp } from '../../context/AppContext';
import {
  Compass,
  Heart,
  User,
  LayoutDashboard,
  Receipt,
  Car,
  Home,
  Building2,
  Calendar,
} from 'lucide-react';

export default function MobileBottomNav({ forceMobile = false }) {
  const { currentView, navigateTo, mode, previewDevice } = useApp();

  // Don't show bottom nav on auth, admin, or full-screen checkout flows
  const hiddenViews = [
    'login',
    'signup',
    'forgot-password',
    'admin-signin',
    'checkout-wallet',
  ];
  if (hiddenViews.includes(currentView)) return null;

  const isMobile = forceMobile || previewDevice === 'mobile';

  return (
    <nav className={`${isMobile ? 'flex absolute' : 'md:hidden fixed'} bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-black/[0.04] px-4 py-2 shadow-[0_-4px_25px_rgba(0,0,0,0.06)]`}>
      <div className="flex items-center justify-around max-w-md mx-auto w-full">
        {mode === 'host' ? (
          <>
            {/* Landlord Dashboard */}
            <button
              onClick={() => navigateTo('landlord-dashboard')}
              className={`flex flex-col items-center gap-1 py-1 transition ${
                currentView === 'landlord-dashboard'
                  ? 'text-[#0A4F4E] font-bold'
                  : 'text-gray-400 hover:text-gray-600 font-medium'
              }`}
            >
              <LayoutDashboard className={`w-5 h-5 ${currentView === 'landlord-dashboard' ? 'stroke-[2.5]' : 'stroke-[1.75]'}`} />
              <span className="text-[10px] tracking-tight">Rentals</span>
            </button>

            {/* Properties */}
            <button
              onClick={() => navigateTo('landlord-properties')}
              className={`flex flex-col items-center gap-1 py-1 transition ${
                currentView === 'landlord-properties'
                  ? 'text-[#0A4F4E] font-bold'
                  : 'text-gray-400 hover:text-gray-600 font-medium'
              }`}
            >
              <Building2 className={`w-5 h-5 ${currentView === 'landlord-properties' ? 'stroke-[2.5]' : 'stroke-[1.75]'}`} />
              <span className="text-[10px] tracking-tight">Properties</span>
            </button>

            {/* Schedules */}
            <button
              onClick={() => navigateTo('landlord-schedules')}
              className={`flex flex-col items-center gap-1 py-1 transition ${
                currentView === 'landlord-schedules'
                  ? 'text-[#0A4F4E] font-bold'
                  : 'text-gray-400 hover:text-gray-600 font-medium'
              }`}
            >
              <Calendar className={`w-5 h-5 ${currentView === 'landlord-schedules' ? 'stroke-[2.5]' : 'stroke-[1.75]'}`} />
              <span className="text-[10px] tracking-tight">Schedules</span>
            </button>

            {/* Account */}
            <button
              onClick={() => navigateTo('host-account')}
              className={`flex flex-col items-center gap-1 py-1 transition ${
                currentView === 'host-account'
                  ? 'text-[#0A4F4E] font-bold'
                  : 'text-gray-400 hover:text-gray-600 font-medium'
              }`}
            >
              <User className={`w-5 h-5 ${currentView === 'host-account' ? 'stroke-[2.5]' : 'stroke-[1.75]'}`} />
              <span className="text-[10px] tracking-tight">Account</span>
            </button>
          </>
        ) : (
          <>
            {/* Properties */}
            <button
              onClick={() => navigateTo('properties')}
              className={`flex flex-col items-center gap-1 py-1 transition ${
                currentView === 'properties' || currentView === 'property-detail'
                  ? 'text-[#0A4F4E] font-bold'
                  : 'text-gray-400 hover:text-gray-600 font-medium'
              }`}
            >
              <Building2 className={`w-5 h-5 ${currentView === 'properties' || currentView === 'property-detail' ? 'stroke-[2.5]' : 'stroke-[1.75]'}`} />
              <span className="text-[10px] tracking-tight">Properties</span>
            </button>

            {/* Explore Vehicles */}
            <button
              onClick={() => navigateTo('explore')}
              className={`flex flex-col items-center gap-1 py-1 transition ${
                currentView === 'explore' || currentView === 'search' || currentView === 'vehicle-detail'
                  ? 'text-[#0A4F4E] font-bold'
                  : 'text-gray-400 hover:text-gray-600 font-medium'
              }`}
            >
              <Compass className={`w-5 h-5 ${currentView === 'explore' || currentView === 'search' || currentView === 'vehicle-detail' ? 'stroke-[2.5]' : 'stroke-[1.75]'}`} />
              <span className="text-[10px] tracking-tight">Vehicles</span>
            </button>

            {/* Tenant Rent (Figma F0 / F1 / F2) */}
            <button
              onClick={() => navigateTo('tenant-home')}
              className={`flex flex-col items-center gap-1 py-1 transition ${
                currentView === 'tenant-home'
                  ? 'text-[#0A4F4E] font-bold'
                  : 'text-gray-400 hover:text-gray-600 font-medium'
              }`}
            >
              <Home className={`w-5 h-5 ${currentView === 'tenant-home' ? 'stroke-[2.5]' : 'stroke-[1.75]'}`} />
              <span className="text-[10px] tracking-tight">My Rent</span>
            </button>

            {/* Receipts */}
            <button
              onClick={() => navigateTo('tenant-history')}
              className={`flex flex-col items-center gap-1 py-1 transition ${
                currentView === 'tenant-history'
                  ? 'text-[#0A4F4E] font-bold'
                  : 'text-gray-400 hover:text-gray-600 font-medium'
              }`}
            >
              <Receipt className={`w-5 h-5 ${currentView === 'tenant-history' ? 'stroke-[2.5]' : 'stroke-[1.75]'}`} />
              <span className="text-[10px] tracking-tight">Receipts</span>
            </button>

            {/* Account */}
            <button
              onClick={() => navigateTo('renter-profile')}
              className={`flex flex-col items-center gap-1 py-1 transition ${
                currentView === 'renter-profile' || currentView === 'my-rentals' || currentView === 'rental-detail' || currentView === 'become-host'
                  ? 'text-[#0A4F4E] font-bold'
                  : 'text-gray-400 hover:text-gray-600 font-medium'
              }`}
            >
              <User className={`w-5 h-5 ${currentView === 'renter-profile' || currentView === 'my-rentals' || currentView === 'rental-detail' || currentView === 'become-host' ? 'stroke-[2.5]' : 'stroke-[1.75]'}`} />
              <span className="text-[10px] tracking-tight">Account</span>
            </button>
          </>
        )}
      </div>
    </nav>
  );
}
