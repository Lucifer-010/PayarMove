import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import MobileBottomNav from '../common/MobileBottomNav';
import {
  LayoutDashboard,
  Calendar,
  Building2,
  Users,
  ShieldCheck,
  Car,
  Receipt,
  Wallet,
  Search,
  Menu,
  X,
  ArrowRightLeft,
  ChevronDown,
  ExternalLink,
  CheckCircle,
  Copy,
  LogOut,
} from 'lucide-react';

export default function HostUnifiedLayout({ children, activeView }) {
  const { user, navigateTo, switchMode, connectedWallet, disconnectWallet } = useApp();
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [copiedWallet, setCopiedWallet] = useState(false);

  const current = activeView || 'host-dashboard';

  // Payout address and user info
  const payoutAddress =
    user?.walletAddress ||
    user?.primary_stellar_address ||
    connectedWallet?.address ||
    '';
  const shortAddress = payoutAddress
    ? `${payoutAddress.slice(0, 4)}...${payoutAddress.slice(-4)}`
    : '';

  const userName = user?.name || user?.username || 'Exxon';
  const userInitials = userName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'EX';

  const handleCopyWallet = () => {
    if (!payoutAddress) return;
    navigator.clipboard?.writeText(payoutAddress);
    setCopiedWallet(true);
    setTimeout(() => setCopiedWallet(false), 2000);
  };

  const navItems = [
    {
      group: 'REAL ESTATE',
      items: [
        { id: 'host-dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'landlord-schedules', label: 'Rent schedules', icon: Calendar },
        { id: 'landlord-properties', label: 'Properties & Units', icon: Building2 },
        { id: 'landlord-tenants', label: 'Tenants & Leases', icon: Users },
        { id: 'landlord-reconciliation', label: 'Reconciliation', icon: ShieldCheck },
      ],
    },
    {
      group: 'MOBILITY FLEET',
      items: [
        { id: 'host-vehicles', label: 'My Vehicles', icon: Car },
      ],
    },
    {
      group: 'FINANCE & SETTINGS',
      items: [
        { id: 'host-payments', label: 'Payments & Receipts', icon: Receipt },
        { id: 'host-account', label: 'Payout & Settings', icon: Wallet },
      ],
    },
  ];

  const handleNavClick = (viewId) => {
    navigateTo(viewId);
    setMobileDrawerOpen(false);
  };

  // Reusable Sidebar Content (Matches Figma CSS specification)
  const renderSidebarContent = () => (
    <div className="flex flex-col h-full bg-white select-none">
      {/* Brand: Logo 40x40 #0A4F4E, rounded 12px + Wordmark 22px bold #111111 */}
      <div className="flex items-center gap-3 px-4 py-6 border-b border-gray-100/80">
        <button
          onClick={() => handleNavClick('host-dashboard')}
          className="flex items-center gap-3 text-left group"
        >
          <div className="w-10 h-10 rounded-xl bg-[#0A4F4E] flex items-center justify-center shadow-xs shrink-0 group-hover:scale-105 transition">
            <svg
              className="w-5 h-5 text-white"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </div>
          <div>
            <div className="font-extrabold text-[20px] text-[#111111] leading-tight tracking-tight">
              PayarMove
            </div>
            <div className="text-[10px] font-bold text-[#0A4F4E] uppercase tracking-wider">
              Host & Landlord
            </div>
          </div>
        </button>
      </div>

      {/* Search Input: 231px wide, height 48px, rounded 9999px, border #E0E0E0 */}
      <div className="px-4 py-3">
        <div className="relative flex items-center bg-white border border-[#E0E0E0] rounded-full h-11 px-3.5 focus-within:border-[#0A4F4E] transition">
          <Search className="w-4 h-4 text-[#757575] shrink-0" />
          <input
            type="text"
            placeholder="Search..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="w-full bg-transparent px-2 text-sm text-[#111111] placeholder-[#757575] focus:outline-none"
          />
          <span className="text-[11px] font-bold text-[#5C5C5C] bg-[#F3F3F3] px-2 py-0.5 rounded shrink-0">
            ⌘K
          </span>
        </div>
      </div>

      {/* Navigation Groups */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-4">
        {navItems.map((group) => {
          const visibleItems = group.items.filter((item) =>
            searchFilter
              ? item.label.toLowerCase().includes(searchFilter.toLowerCase())
              : true
          );

          if (visibleItems.length === 0) return null;

          return (
            <div key={group.group}>
              <div className="text-[11px] font-bold text-[#757575] tracking-wider uppercase px-3 py-1.5">
                {group.group}
              </div>
              <div className="space-y-1 mt-1">
                {visibleItems.map((item) => {
                  const Icon = item.icon;
                  const isActive =
                    current === item.id ||
                    (item.id === 'host-dashboard' && current === 'landlord-dashboard');

                  return (
                    <button
                      key={item.id}
                      onClick={() => handleNavClick(item.id)}
                      className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-bold transition text-left ${
                        isActive
                          ? 'bg-[#EAF6F5] text-[#0A4F4E]'
                          : 'text-[#5C5C5C] hover:bg-gray-100/70 hover:text-[#111111]'
                      }`}
                    >
                      <Icon
                        className={`w-4 h-4 shrink-0 ${
                          isActive ? 'text-[#0A4F4E]' : 'text-[#757575]'
                        }`}
                      />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Role Box (Matches Figma: width 231px, bg #F3F3F3, rounded 16px, padding 12px) */}
      <div className="p-3 border-t border-gray-100">
        <div className="bg-[#F3F3F3] rounded-2xl p-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full bg-[#EAF6F5] text-[#0A4F4E] font-bold text-sm flex items-center justify-center shrink-0">
              {userInitials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold text-[#111111] truncate">{userName}</div>
              <div className="text-xs text-[#5C5C5C] truncate">Host & Landlord</div>
            </div>
          </div>
          <button
            onClick={() => {
              switchMode('renter');
              navigateTo('tenant-home');
            }}
            title="Switch to Renter / Tenant mode"
            className="p-1.5 rounded-lg bg-white hover:bg-gray-200 text-gray-700 transition shrink-0 shadow-2xs"
          >
            <ArrowRightLeft className="w-4 h-4" />
          </button>
        </div>

        {/* Quick Switch mode toggle button */}
        <button
          onClick={() => {
            switchMode('renter');
            navigateTo('tenant-home');
          }}
          className="w-full mt-2 py-2 px-3 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:text-[#0A4F4E] hover:bg-white transition flex items-center justify-center gap-1.5"
        >
          <ArrowRightLeft className="w-3.5 h-3.5" />
          <span>Switch to Renter View</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F2F7F7] flex flex-col w-full max-w-full overflow-x-hidden font-sans">
      {/* Top Header: Responsive across mobile and desktop */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-gray-200/80 shadow-2xs h-16 sm:h-20 flex items-center justify-between px-4 sm:px-8 w-full max-w-full">
        <div className="flex items-center gap-3 sm:gap-6 min-w-0">
          {/* Mobile hamburger menu button */}
          <button
            onClick={() => setMobileDrawerOpen(true)}
            className="lg:hidden p-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 transition shrink-0"
            aria-label="Open Host Menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Mobile logo when sidebar is hidden */}
          <div className="lg:hidden flex items-center gap-2 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-[#0A4F4E] flex items-center justify-center">
              <Building2 className="w-4 h-4 text-white" />
            </div>
            <span className="font-extrabold text-base text-[#111111]">PayarMove</span>
          </div>

          {/* Desktop Breadcrumb / Status */}
          <div className="hidden lg:flex items-center gap-2 text-xs font-bold text-gray-500">
            <span className="text-[#0A4F4E]">Host Portal</span>
            <span>/</span>
            <span className="text-gray-900 capitalize">
              {current.replace('landlord-', '').replace('host-', '').replace('-', ' ')}
            </span>
          </div>
        </div>

        {/* Right Header Controls */}
        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
          {/* Stellar Horizon Testnet status badge */}
          <div className="hidden sm:flex items-center gap-2 bg-[#EAF6F5] border border-[#A6D9B8]/40 px-3 py-1.5 rounded-full text-xs font-bold text-[#0A4F4E]">
            <span className="w-2 h-2 rounded-full bg-[#2F9E5B] animate-pulse" />
            <span>Stellar Testnet</span>
          </div>

          {/* Connected Payout Wallet Pill */}
          {payoutAddress ? (
            <button
              onClick={handleCopyWallet}
              className="flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 px-3 py-1.5 rounded-full text-xs font-mono font-bold transition shadow-2xs"
              title="Click to copy Stellar wallet address"
            >
              <Wallet className="w-3.5 h-3.5 text-[#0A4F4E]" />
              <span>{shortAddress}</span>
              {copiedWallet ? (
                <CheckCircle className="w-3.5 h-3.5 text-emerald-600 ml-0.5" />
              ) : (
                <Copy className="w-3 h-3 text-gray-400 ml-0.5" />
              )}
            </button>
          ) : (
            <button
              onClick={() => handleNavClick('host-account')}
              className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 text-amber-900 px-3 py-1.5 rounded-full text-xs font-bold hover:bg-amber-100 transition"
            >
              <Wallet className="w-3.5 h-3.5 text-amber-700" />
              <span>Set Wallet</span>
            </button>
          )}

          {/* Mode Switcher Pill */}
          <div className="flex items-center bg-[#EAF6F5] p-1 rounded-full border border-[#0A4F4E]/20">
            <span className="bg-[#0A4F4E] text-white px-3 py-1 rounded-full text-xs font-extrabold shadow-2xs">
              Hosting
            </span>
            <button
              onClick={() => {
                switchMode('renter');
                navigateTo('tenant-home');
              }}
              className="px-3 py-1 rounded-full text-xs font-bold text-[#0A4F4E] hover:text-black transition"
            >
              Renting
            </button>
          </div>
        </div>
      </header>

      {/* Main Body: Desktop Sidebar + Content Area */}
      <div className="flex flex-1 w-full max-w-full min-w-0">
        {/* Desktop Fixed Sidebar (264px width matching Figma) */}
        <aside className="hidden lg:block w-[264px] border-r border-[#E0E0E0] bg-white shrink-0 min-h-[calc(100vh-80px)]">
          <div className="sticky top-20 h-[calc(100vh-80px)] overflow-y-auto">
            {renderSidebarContent()}
          </div>
        </aside>

        {/* Mobile Slide-Over Drawer with Backdrop */}
        {mobileDrawerOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in"
              onClick={() => setMobileDrawerOpen(false)}
            />

            {/* Drawer Content */}
            <div className="relative w-[280px] max-w-[85vw] h-full bg-white shadow-2xl z-10 flex flex-col animate-in slide-in-from-left duration-250">
              <button
                onClick={() => setMobileDrawerOpen(false)}
                className="absolute top-4 right-4 p-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 transition z-20"
                aria-label="Close drawer"
              >
                <X className="w-5 h-5" />
              </button>
              {renderSidebarContent()}
            </div>
          </div>
        )}

        {/* Responsive Content Area: min-w-0 and max-w-full prevent any mobile horizontal overflow */}
        <main className="flex-1 min-w-0 max-w-full overflow-x-hidden p-3 sm:p-6 lg:p-8 pb-20 md:pb-8">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <div className="md:hidden">
        <MobileBottomNav />
      </div>
    </div>
  );
}
