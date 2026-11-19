import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  LayoutDashboard,
  Receipt,
  Car,
  Wallet,
  User,
  LogOut,
  Plus,
  CheckCircle2,
  ChevronRight,
  Check,
  Clock,
  Key,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Loader2,
  Calendar,
  Building2,
  Users,
  ShieldCheck,
  ExternalLink,
  ArrowUpRight,
  Layers,
} from 'lucide-react';

export default function HostDashboardView() {
  const {
    user,
    navigateTo,
    switchMode,
    hostMetrics,
    hostVehicles,
    hostRentals,
    handleConfirmDelivery,
    handleConfirmReturn,
    setHostAccountTab,
    connectedWallet,
    refreshBackendData,
  } = useApp();

  const [activeTab, setActiveTab] = useState('properties'); // 'properties' | 'mobility'
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [actionToast, setActionToast] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const payoutAddress = user?.walletAddress || user?.primary_stellar_address || connectedWallet?.address || '';
  const hasPayoutWallet = Boolean(payoutAddress && payoutAddress.trim());
  const shortWallet = hasPayoutWallet ? `${payoutAddress.slice(0, 6)}...${payoutAddress.slice(-4)}` : '';
  const hasVehicles = (hostVehicles && hostVehicles.length > 0) || Number(hostMetrics?.vehicles_listed_count || 0) > 0;

  // Mobility Rentals
  const activeRentalsList = (hostRentals || []).filter((r) =>
    ['Active', 'Confirmed', 'CONFIRMED', 'ACTIVE'].includes(r.rawStatus || r.status)
  );

  const completedRentalsList = (hostRentals || []).filter((r) =>
    ['Completed', 'COMPLETED'].includes(r.rawStatus || r.status)
  );

  const totalEarnedFleet = Number(
    hostMetrics?.total_earned_usdc ??
    completedRentalsList.reduce((sum, r) => sum + Number(r.netPayout || (r.grossAmount * 0.9) || 0), 0)
  );

  const pendingPayoutFleet = Number(
    hostMetrics?.pending_payout_usdc ??
    activeRentalsList.reduce((sum, r) => sum + Number(r.netPayout || (r.grossAmount * 0.9) || 0), 0)
  );

  const activeCountFleet = hostMetrics?.active_bookings_count ?? activeRentalsList.length;
  const completedCountFleet = hostMetrics?.completed_bookings_count ?? completedRentalsList.length;
  const vehiclesCount = hostMetrics?.vehicles_listed_count ?? (hostVehicles?.length || 0);

  // Property Rent Metrics
  const propertiesCount = Number(hostMetrics?.properties_listed_count || 0);
  const totalUnits = Number(hostMetrics?.total_units_count || 0);
  const occupiedUnits = Number(hostMetrics?.occupied_units_count || 0);
  const activeTenants = Number(hostMetrics?.active_tenants_count || 0);
  const rentCollected = Number(hostMetrics?.total_rent_collected_usdc || 0);
  const rentOutstanding = Number(hostMetrics?.outstanding_rent_usdc || 0);
  const rentDue = Number(hostMetrics?.rent_due_usdc || 0);
  const recentRentPayments = hostMetrics?.recent_rent_payments || [];
  const managedProperties = hostMetrics?.managed_properties || [];

  const occupancyRate = totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0;

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshBackendData();
    } finally {
      setIsRefreshing(false);
    }
  };

  const onConfirmDelivery = async (rental) => {
    const id = rental.rentalId || rental.dbId || rental.id;
    try {
      setActionLoadingId(id);
      await handleConfirmDelivery(id);
      setActionToast({
        type: 'success',
        message: `Vehicle ${rental.vehicleName || 'car'} marked as delivered successfully! Rental is now Active.`,
      });
      setTimeout(() => setActionToast(null), 5000);
    } catch (err) {
      setActionToast({
        type: 'error',
        message: err.message || 'Failed to confirm delivery.',
      });
      setTimeout(() => setActionToast(null), 5000);
    } finally {
      setActionLoadingId(null);
    }
  };

  const onConfirmReturn = async (rental) => {
    const id = rental.rentalId || rental.dbId || rental.id;
    try {
      setActionLoadingId(id);
      await handleConfirmReturn(id);
      setActionToast({
        type: 'success',
        message: `Vehicle ${rental.vehicleName || 'car'} returned successfully! Deal closed and escrow payout settled.`,
      });
      setTimeout(() => setActionToast(null), 5000);
    } catch (err) {
      setActionToast({
        type: 'error',
        message: err.message || 'Failed to confirm return.',
      });
      setTimeout(() => setActionToast(null), 5000);
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50/50 pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-8">
        {/* Toast Alert */}
        {actionToast && (
          <div
            className={`mb-6 p-4 rounded-2xl flex items-center justify-between gap-3 shadow-md animate-in fade-in transition ${
              actionToast.type === 'success'
                ? 'bg-[#06372d] text-white'
                : 'bg-rose-600 text-white'
            }`}
          >
            <div className="flex items-center gap-3">
              {actionToast.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-300 shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 text-rose-200 shrink-0" />
              )}
              <span className="text-xs font-semibold">{actionToast.message}</span>
            </div>
            <button
              onClick={() => setActionToast(null)}
              className="text-white/80 hover:text-white text-xs font-bold px-2 py-1"
            >
              ✕
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Host Sidebar */}
          <aside className="lg:col-span-1 hidden lg:block">
            <div className="bg-white rounded-2xl border border-black/[0.04] p-5 shadow-[0_8px_30px_rgba(0,0,0,0.04)] space-y-5">
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-3 mb-2">Host Overview</p>
                <nav className="space-y-1 text-xs font-semibold">
                  <button
                    type="button"
                    className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-[#06372d] text-white shadow-2xs font-bold"
                  >
                    <span className="flex items-center gap-2.5">
                      <LayoutDashboard className="w-4 h-4" />
                      <span>Dashboard</span>
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-white" />
                  </button>

                  <button
                    type="button"
                    onClick={() => navigateTo('host-payments')}
                    className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-gray-700 hover:bg-gray-50 transition"
                  >
                    <span className="flex items-center gap-2.5">
                      <Receipt className="w-4 h-4 text-gray-400" />
                      <span>Payments & Receipts</span>
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                  </button>
                </nav>
              </div>

              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-3 mb-2">Real Estate</p>
                <nav className="space-y-1 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => navigateTo('landlord-properties')}
                    className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-gray-700 hover:bg-gray-50 transition"
                  >
                    <span className="flex items-center gap-2.5">
                      <Building2 className="w-4 h-4 text-emerald-700" />
                      <span>Properties & Units</span>
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                  </button>

                  <button
                    type="button"
                    onClick={() => navigateTo('landlord-schedules')}
                    className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-gray-700 hover:bg-gray-50 transition"
                  >
                    <span className="flex items-center gap-2.5">
                      <Calendar className="w-4 h-4 text-emerald-700" />
                      <span>Rent Schedules</span>
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                  </button>

                  <button
                    type="button"
                    onClick={() => navigateTo('landlord-tenants')}
                    className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-gray-700 hover:bg-gray-50 transition"
                  >
                    <span className="flex items-center gap-2.5">
                      <Users className="w-4 h-4 text-emerald-700" />
                      <span>Tenants & Leases</span>
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                  </button>

                  <button
                    type="button"
                    onClick={() => navigateTo('landlord-reconciliation')}
                    className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-gray-700 hover:bg-gray-50 transition"
                  >
                    <span className="flex items-center gap-2.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-700" />
                      <span>Reconciliation</span>
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                  </button>
                </nav>
              </div>

              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-3 mb-2">Fleet Mobility</p>
                <nav className="space-y-1 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => navigateTo('host-vehicles')}
                    className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-gray-700 hover:bg-gray-50 transition"
                  >
                    <span className="flex items-center gap-2.5">
                      <Car className="w-4 h-4 text-gray-400" />
                      <span>My vehicles</span>
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                  </button>
                </nav>
              </div>

              <div className="pt-2 border-t border-black/[0.04]">
                <nav className="space-y-1 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => {
                      setHostAccountTab?.('wallet');
                      navigateTo('host-account');
                    }}
                    className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-gray-700 hover:bg-gray-50 transition"
                  >
                    <span className="flex items-center gap-2.5">
                      <Wallet className="w-4 h-4 text-gray-400" />
                      <span>Payout wallet</span>
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setHostAccountTab?.('profile');
                      navigateTo('host-account');
                    }}
                    className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-gray-700 hover:bg-gray-50 transition"
                  >
                    <span className="flex items-center gap-2.5">
                      <User className="w-4 h-4 text-gray-400" />
                      <span>Account</span>
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      switchMode('renter');
                      navigateTo('explore');
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-gray-500 hover:text-red-600 transition"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Switch to Renter</span>
                  </button>
                </nav>
              </div>
            </div>
          </aside>

          {/* Main Dashboard Area */}
          <main className="lg:col-span-3 space-y-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-black text-gray-950 tracking-tight">Host Dashboard</h1>
                <p className="text-xs text-gray-500 mt-0.5">
                  Welcome back, <span className="font-bold text-gray-900">{user?.name || user?.username || 'Host'}</span>. Manage real estate property rent & fleet mobility.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleManualRefresh}
                  disabled={isRefreshing}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-white border border-black/[0.06] hover:bg-gray-50 text-gray-700 rounded-xl text-xs font-semibold transition shadow-2xs"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
                {activeTab === 'properties' ? (
                  <button
                    type="button"
                    onClick={() => navigateTo('landlord-properties')}
                    className="bg-[#06372d] hover:bg-[#09473b] text-white px-4 py-2 rounded-xl text-xs font-bold transition shadow-2xs hover:shadow-xs flex items-center gap-1.5 shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Property</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => navigateTo('host-add-vehicle')}
                    className="bg-[#06372d] hover:bg-[#09473b] text-white px-4 py-2 rounded-xl text-xs font-bold transition shadow-2xs hover:shadow-xs flex items-center gap-1.5 shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Vehicle</span>
                  </button>
                )}
              </div>
            </div>

            {/* TAB SELECTOR: Property Rentals vs Fleet Mobility */}
            <div className="flex items-center gap-2 border-b border-gray-200 pb-2">
              <button
                type="button"
                onClick={() => setActiveTab('properties')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold transition ${
                  activeTab === 'properties'
                    ? 'bg-[#06372d] text-white shadow-xs'
                    : 'text-gray-600 hover:text-gray-950 hover:bg-gray-100'
                }`}
              >
                <Building2 className="w-4 h-4" />
                <span>Property Rentals ({propertiesCount})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('mobility')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold transition ${
                  activeTab === 'mobility'
                    ? 'bg-[#06372d] text-white shadow-xs'
                    : 'text-gray-600 hover:text-gray-950 hover:bg-gray-100'
                }`}
              >
                <Car className="w-4 h-4" />
                <span>Mobility Fleet ({vehiclesCount})</span>
              </button>
            </div>

            {/* TAB 1: PROPERTY RENTALS DASHBOARD */}
            {activeTab === 'properties' && (
              <div className="space-y-8 animate-in fade-in duration-200">
                {/* 4 Metric Cards for Real Estate */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {/* Total Rent Collected */}
                  <div className="bg-white rounded-2xl border border-black/[0.04] p-4 shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:shadow-sm transition">
                    <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                      Rent Collected
                    </div>
                    <div className="text-xl font-black text-[#06372d] font-mono mt-1">
                      {rentCollected.toFixed(2)} USDC
                    </div>
                    <div className="text-[11px] text-gray-400 mt-0.5">
                      {activeTenants} active tenant{activeTenants === 1 ? '' : 's'}
                    </div>
                  </div>

                  {/* Outstanding Balance */}
                  <div className="bg-white rounded-2xl border border-black/[0.04] p-4 shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:shadow-sm transition">
                    <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                      Outstanding Rent
                    </div>
                    <div className={`text-xl font-black font-mono mt-1 ${rentOutstanding > 0 ? 'text-amber-600' : 'text-gray-950'}`}>
                      {rentOutstanding.toFixed(2)} USDC
                    </div>
                    <div className="text-[11px] text-gray-400 mt-0.5">
                      Total due: {rentDue.toFixed(2)} USDC
                    </div>
                  </div>

                  {/* Properties Listed */}
                  <div className="bg-white rounded-2xl border border-black/[0.04] p-4 shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:shadow-sm transition">
                    <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                      Properties Listed
                    </div>
                    <div className="text-xl font-black text-gray-950 font-mono mt-1">
                      {propertiesCount} propert{propertiesCount === 1 ? 'y' : 'ies'}
                    </div>
                    <div className="text-[11px] text-gray-500 mt-0.5">
                      {totalUnits} total unit{totalUnits === 1 ? '' : 's'}
                    </div>
                  </div>

                  {/* Occupancy Rate */}
                  <div className="bg-[#f0faf6] rounded-2xl border border-emerald-500/15 p-4 shadow-[0_4px_20px_rgba(6,55,45,0.03)] hover:shadow-sm transition">
                    <div className="text-[11px] font-semibold text-gray-600 uppercase tracking-wider">
                      Occupancy Rate
                    </div>
                    <div className="text-xl font-black text-[#06372d] font-mono mt-1">
                      {occupancyRate}%
                    </div>
                    <div className="text-[11px] text-emerald-700 mt-0.5 font-medium flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span>{occupiedUnits} of {totalUnits} units occupied</span>
                    </div>
                  </div>
                </div>

                {/* RECENT PROPERTY RENT COLLECTIONS & RECEIPTS TABLE */}
                <div className="bg-white rounded-3xl border border-black/[0.04] p-6 shadow-[0_8px_30px_rgba(0,0,0,0.04)] space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h2 className="text-sm font-bold text-gray-950 uppercase tracking-wider flex items-center gap-2">
                        <span>Recent Property Rent Collections</span>
                        {recentRentPayments.length > 0 && (
                          <span className="bg-emerald-100 text-[#06372d] text-[10px] font-bold px-2 py-0.5 rounded-full">
                            {recentRentPayments.length} Verified
                          </span>
                        )}
                      </h2>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Direct on-chain Stellar USDC rent payments received from tenants with immutable cryptographic receipts.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigateTo('landlord-reconciliation')}
                      className="text-xs font-bold text-[#06372d] hover:underline flex items-center gap-1 self-start sm:self-auto shrink-0"
                    >
                      <span>View in Reconciliation</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {recentRentPayments.length > 0 ? (
                    <div className="divide-y divide-black/[0.04] border border-black/[0.04] rounded-2xl overflow-hidden shadow-2xs">
                      {recentRentPayments.map((p) => {
                        const shortTx = p.stellar_tx_hash ? `${p.stellar_tx_hash.slice(0, 8)}...${p.stellar_tx_hash.slice(-6)}` : 'On-Chain';
                        const explorerUrl = p.stellar_tx_hash ? `https://stellar.expert/explorer/testnet/tx/${p.stellar_tx_hash}` : '#';

                        return (
                          <div
                            key={p.id || p.payment_reference}
                            className="p-4 sm:p-5 hover:bg-gray-50/50 transition flex flex-col md:flex-row md:items-center justify-between gap-4"
                          >
                            <div className="flex items-start gap-4">
                              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#06372d] flex items-center justify-center shrink-0 border border-emerald-500/20">
                                <Receipt className="w-5 h-5" />
                              </div>
                              <div className="space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h3 className="font-bold text-sm text-gray-950">
                                    {p.property_name || 'Rental Property'}
                                  </h3>
                                  <span className="text-[11px] font-mono font-semibold text-emerald-800 bg-emerald-100/80 border border-emerald-300 px-2 py-0.5 rounded-md">
                                    {p.payment_reference}
                                  </span>
                                  {p.receipt_number && (
                                    <span className="text-[10px] font-mono text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                                      Receipt #{p.receipt_number}
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-gray-500 flex items-center gap-2 flex-wrap">
                                  <span>Tenant: <strong className="text-gray-800">{p.tenant_email || 'Tenant'}</strong></span>
                                  <span>·</span>
                                  <span>{new Date(p.created_at).toLocaleDateString()}</span>
                                  <span>·</span>
                                  <a
                                    href={explorerUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="font-mono text-blue-600 hover:underline inline-flex items-center gap-1"
                                  >
                                    <span>Tx: {shortTx}</span>
                                    <ExternalLink className="w-3 h-3" />
                                  </a>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-4 self-end md:self-auto shrink-0">
                              <div className="text-right">
                                <div className="text-base font-black text-[#06372d] font-mono">
                                  +{Number(p.amount_usdc || p.amount || 0).toFixed(2)} USDC
                                </div>
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-2 py-0.5 rounded-full">
                                  <CheckCircle className="w-3 h-3 text-emerald-600" />
                                  <span>{p.status || 'CONFIRMED'}</span>
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-8 text-center bg-gray-50/50 rounded-2xl border border-dashed border-black/[0.08]">
                      <div className="w-10 h-10 rounded-full bg-emerald-50 text-[#06372d] flex items-center justify-center mx-auto mb-2.5">
                        <Receipt className="w-5 h-5" />
                      </div>
                      <h3 className="text-xs font-bold text-gray-900 mb-0.5">No rent payments received yet</h3>
                      <p className="text-[11px] text-gray-500 max-w-sm mx-auto">
                        When tenants pay rent obligations via Stellar Testnet or Freighter, verified collections appear here automatically.
                      </p>
                    </div>
                  )}
                </div>

                {/* MANAGED PROPERTIES PORTFOLIO */}
                <div className="bg-white rounded-3xl border border-black/[0.04] p-6 shadow-[0_8px_30px_rgba(0,0,0,0.04)] space-y-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-sm font-bold text-gray-950 uppercase tracking-wider">
                        Managed Properties ({managedProperties.length})
                      </h2>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Real estate properties listed under your account with receiving Stellar wallets.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigateTo('landlord-properties')}
                      className="text-xs font-bold text-[#06372d] hover:underline flex items-center gap-1"
                    >
                      <span>Manage All Properties</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {managedProperties.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {managedProperties.map((prop) => (
                        <div
                          key={prop.id}
                          className="bg-gray-50/70 border border-black/[0.06] rounded-2xl p-4 space-y-3 hover:border-black/[0.12] transition"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h3 className="font-bold text-sm text-gray-950">{prop.name}</h3>
                              <p className="text-xs text-gray-500">{prop.city || 'Nairobi, Kenya'}</p>
                            </div>
                            <span className="bg-emerald-100 text-[#06372d] text-[10px] font-bold px-2 py-0.5 rounded-full">
                              Active
                            </span>
                          </div>

                          <div className="text-xs text-gray-600 flex items-center justify-between pt-2 border-t border-black/[0.04]">
                            <span>Units: <strong>{prop.occupied_units || 0}/{prop.total_units || 0} occupied</strong></span>
                          </div>

                          <div className="text-[11px] font-mono text-gray-500 bg-white p-2 rounded-xl border border-black/[0.04] truncate">
                            <span className="text-[10px] text-gray-400 block uppercase">Owner Receiving Wallet:</span>
                            {prop.receiving_wallet ? `${prop.receiving_wallet.slice(0, 10)}...${prop.receiving_wallet.slice(-8)}` : 'Not set'}
                          </div>

                          <div className="flex items-center gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => navigateTo('landlord-schedules')}
                              className="w-full text-center text-xs font-semibold py-1.5 bg-white border border-black/[0.06] rounded-xl hover:bg-gray-100 text-gray-800 transition"
                            >
                              Schedules
                            </button>
                            <button
                              type="button"
                              onClick={() => navigateTo('landlord-properties')}
                              className="w-full text-center text-xs font-semibold py-1.5 bg-[#06372d] text-white rounded-xl hover:bg-[#09473b] transition"
                            >
                              Units
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-8 text-center bg-gray-50/50 rounded-2xl border border-dashed border-black/[0.08]">
                      <div className="w-10 h-10 rounded-full bg-emerald-50 text-[#06372d] flex items-center justify-center mx-auto mb-2.5">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <h3 className="text-xs font-bold text-gray-900 mb-0.5">No properties listed</h3>
                      <p className="text-[11px] text-gray-500 max-w-sm mx-auto mb-3">
                        List residential units and apartments to accept rent payments with Stellar smart contracts.
                      </p>
                      <button
                        type="button"
                        onClick={() => navigateTo('landlord-properties')}
                        className="bg-[#06372d] text-white text-xs font-bold px-4 py-2 rounded-xl"
                      >
                        Add First Property
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 2: MOBILITY FLEET DASHBOARD */}
            {activeTab === 'mobility' && (
              <div className="space-y-8 animate-in fade-in duration-200">
                {/* 4 Metrics Cards for Mobility Fleet */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {/* Total Earned */}
                  <div className="bg-white rounded-2xl border border-black/[0.04] p-4 shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:shadow-sm transition">
                    <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                      Fleet Earnings
                    </div>
                    <div className="text-xl font-black text-gray-950 font-mono mt-1">
                      {totalEarnedFleet.toFixed(2)} USDC
                    </div>
                    <div className="text-[11px] text-gray-400 mt-0.5">
                      {completedCountFleet} deal{completedCountFleet === 1 ? '' : 's'} closed
                    </div>
                  </div>

                  {/* Active Rentals */}
                  <div className="bg-[#f0faf6] rounded-2xl border border-emerald-500/15 p-4 shadow-[0_4px_20px_rgba(6,55,45,0.03)] hover:shadow-sm transition">
                    <div className="text-[11px] font-semibold text-gray-600 uppercase tracking-wider">
                      Active Car Rentals
                    </div>
                    <div className="text-xl font-black text-[#06372d] font-mono mt-1">
                      {activeCountFleet} active
                    </div>
                    <div className="text-[11px] text-emerald-700 mt-0.5 font-medium flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span>Escrow locked</span>
                    </div>
                  </div>

                  {/* Vehicles Listed */}
                  <div className="bg-white rounded-2xl border border-black/[0.04] p-4 shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:shadow-sm transition">
                    <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                      Vehicles Listed
                    </div>
                    <div className="text-xl font-black text-gray-950 font-mono mt-1">
                      {vehiclesCount} car{vehiclesCount === 1 ? '' : 's'}
                    </div>
                    <div className="text-[11px] text-gray-500 mt-0.5">Nairobi Fleet</div>
                  </div>

                  {/* Pending Payout */}
                  <div className="bg-white rounded-2xl border border-black/[0.04] p-4 shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:shadow-sm transition">
                    <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                      Pending Payout
                    </div>
                    <div className="text-xl font-black text-gray-950 font-mono mt-1">
                      {pendingPayoutFleet.toFixed(2)} USDC
                    </div>
                    <div className="text-[11px] text-gray-400 mt-0.5">Awaiting return</div>
                  </div>
                </div>

                {/* ACTIVE GUEST RENTALS & FLEET MANAGEMENT TABLE */}
                <div className="bg-white rounded-3xl border border-black/[0.04] p-6 shadow-[0_8px_30px_rgba(0,0,0,0.04)] space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h2 className="text-sm font-bold text-gray-950 uppercase tracking-wider flex items-center gap-2">
                        <span>Fleet Guest Rentals</span>
                        {activeRentalsList.length > 0 && (
                          <span className="bg-emerald-100/80 text-[#06372d] text-[10px] font-bold px-2 py-0.5 rounded-full">
                            {activeRentalsList.length} In Progress
                          </span>
                        )}
                      </h2>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Confirm car handover when delivering vehicle, and confirm return when guest brings car back to close deal and settle payout.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigateTo('host-payments')}
                      className="text-xs font-bold text-[#06372d] hover:underline flex items-center gap-1 self-start sm:self-auto shrink-0"
                    >
                      <span>View payment history</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {hostRentals && hostRentals.length > 0 ? (
                    <div className="divide-y divide-black/[0.04] border border-black/[0.04] rounded-2xl overflow-hidden shadow-2xs">
                      {hostRentals.map((r) => {
                        const rawSt = (r.rawStatus || r.status || '').toUpperCase();
                        const isConfirmed = rawSt === 'CONFIRMED';
                        const isActive = rawSt === 'ACTIVE';
                        const isCompleted = rawSt === 'COMPLETED';
                        const isLoading = actionLoadingId === (r.rentalId || r.dbId || r.id);

                        return (
                          <div
                            key={r.rentalId || r.dbId || r.id}
                            className="p-4 sm:p-5 hover:bg-gray-50/50 transition flex flex-col md:flex-row md:items-center justify-between gap-4"
                          >
                            <div className="flex items-start gap-4">
                              <div className="w-20 h-14 sm:w-24 sm:h-16 rounded-xl overflow-hidden bg-gray-100 border border-black/[0.06] shadow-2xs shrink-0">
                                <img
                                  src={r.vehiclePhoto || r.image || '/cars/gwagon.jpg'}
                                  alt="Car"
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              <div className="space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h3 className="font-bold text-sm text-gray-950">
                                    {r.vehicleName || r.vehicle || 'Rented Vehicle'}
                                  </h3>
                                  <span className="text-[11px] font-mono font-semibold text-gray-500 bg-gray-100/80 border border-black/[0.04] px-2 py-0.5 rounded-md">
                                    {r.rentalId || r.id}
                                  </span>
                                </div>
                                <div className="text-xs text-gray-500 flex items-center gap-2 flex-wrap">
                                  <span>Renter: <strong className="text-gray-800">{r.renterName || r.renterEmail || 'Guest'}</strong></span>
                                  <span>·</span>
                                  <span className="flex items-center gap-1">
                                    <Calendar className="w-3 h-3 text-gray-400" />
                                    <span>{r.pickupDate} – {r.returnDate || r.dropoffDate}</span>
                                  </span>
                                </div>
                                <div className="text-xs font-mono font-semibold text-gray-700">
                                  Host Net Payout: <strong className="text-[#06372d]">{Number(r.netPayout || (r.grossAmount * 0.9) || 0).toFixed(2)} USDC</strong>
                                  <span className="text-[10px] text-gray-400 font-normal ml-1.5">(Gross: {Number(r.grossAmount || r.rentalFee || 0).toFixed(2)} USDC)</span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-3 self-end md:self-auto shrink-0 flex-wrap">
                              {isConfirmed && (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-900 border border-amber-200/60 shadow-2xs">
                                  <Clock className="w-3.5 h-3.5 text-amber-700" />
                                  <span>Ready for Delivery</span>
                                </span>
                              )}
                              {isActive && (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-[#06372d] border border-emerald-200/60 shadow-2xs">
                                  <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
                                  <span>On Trip (Active)</span>
                                </span>
                              )}
                              {isCompleted && (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-gray-100/80 text-gray-700 border border-black/[0.05] shadow-2xs">
                                  <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>Deal Closed</span>
                                </span>
                              )}

                              {isConfirmed && (
                                <button
                                  type="button"
                                  onClick={() => onConfirmDelivery(r)}
                                  disabled={isLoading}
                                  className="bg-[#06372d] hover:bg-[#09473b] disabled:opacity-50 text-white px-4 py-2 rounded-xl text-xs font-bold transition shadow-2xs hover:shadow-xs flex items-center gap-1.5"
                                >
                                  {isLoading ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <Key className="w-3.5 h-3.5" />
                                  )}
                                  <span>Confirm Delivery</span>
                                </button>
                              )}

                              {isActive && (
                                <button
                                  type="button"
                                  onClick={() => onConfirmReturn(r)}
                                  disabled={isLoading}
                                  className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-xs font-bold transition shadow-2xs hover:shadow-xs flex items-center gap-1.5"
                                >
                                  {isLoading ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <CheckCircle className="w-3.5 h-3.5" />
                                  )}
                                  <span>Confirm Return & Close Deal</span>
                                </button>
                              )}

                              {isCompleted && (
                                <button
                                  type="button"
                                  onClick={() => navigateTo('host-payments')}
                                  className="bg-white border border-black/[0.06] hover:bg-gray-50 text-gray-700 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition shadow-2xs"
                                >
                                  View Payout
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-8 text-center bg-gray-50/50 rounded-2xl border border-dashed border-black/[0.08]">
                      <div className="w-10 h-10 rounded-full bg-emerald-50 text-[#06372d] flex items-center justify-center mx-auto mb-2.5">
                        <Car className="w-5 h-5" />
                      </div>
                      <h3 className="text-xs font-bold text-gray-900 mb-0.5">No guest bookings yet</h3>
                      <p className="text-[11px] text-gray-500 max-w-sm mx-auto">
                        When renters book vehicles from your fleet, the bookings appear here with controls to confirm delivery and close deals upon return.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Host Setup Checklist */}
            <div className="bg-white rounded-3xl border border-black/[0.04] p-6 shadow-[0_8px_30px_rgba(0,0,0,0.04)] space-y-4">
              <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                Host setup checklist
              </h2>

              <div className="space-y-3">
                {/* 1. Add a payout wallet */}
                <div className={`p-4 rounded-2xl border transition ${hasPayoutWallet ? 'border-emerald-500/20 bg-[#f0faf6]' : 'border-black/[0.04] bg-gray-50/50 shadow-2xs'} flex items-center justify-between gap-4`}>
                  <div className="flex items-start gap-3">
                    {hasPayoutWallet ? (
                      <div className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                        <Check className="w-3.5 h-3.5" />
                      </div>
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-black text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                        1
                      </div>
                    )}
                    <div>
                      <h3 className="font-bold text-gray-900 text-xs flex items-center gap-2">
                        <span>{hasPayoutWallet ? 'Payout wallet configured' : 'Add a payout wallet'}</span>
                        {hasPayoutWallet && (
                          <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                            Active
                          </span>
                        )}
                      </h3>
                      <p className="text-[11px] text-gray-500 mt-0.5 font-mono">
                        {hasPayoutWallet
                          ? `Disbursements routed to ${shortWallet}`
                          : 'So PayarMove knows where to record what you are owed.'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setHostAccountTab?.('wallet');
                      navigateTo('host-account');
                    }}
                    className="bg-white border border-black/[0.06] hover:bg-gray-50 text-gray-900 text-xs font-semibold px-3 py-1.5 rounded-xl transition shadow-2xs shrink-0"
                  >
                    {hasPayoutWallet ? 'Manage wallet' : 'Add wallet'}
                  </button>
                </div>

                {/* 2. List Properties or Vehicles */}
                <div className={`p-4 rounded-2xl border transition ${(propertiesCount > 0 || hasVehicles) ? 'border-emerald-500/20 bg-[#f0faf6]' : 'border-black/[0.04] bg-gray-50/50 shadow-2xs'} flex items-center justify-between gap-4`}>
                  <div className="flex items-start gap-3">
                    {(propertiesCount > 0 || hasVehicles) ? (
                      <div className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                        <Check className="w-3.5 h-3.5" />
                      </div>
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-black text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                        2
                      </div>
                    )}
                    <div>
                      <h3 className="font-bold text-gray-900 text-xs flex items-center gap-2">
                        <span>
                          {propertiesCount > 0
                            ? `Properties listed (${propertiesCount} properties, ${totalUnits} units)`
                            : hasVehicles
                            ? `Vehicles listed (${vehiclesCount} cars)`
                            : 'List your first property or vehicle'}
                        </span>
                        {(propertiesCount > 0 || hasVehicles) && (
                          <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                            Live
                          </span>
                        )}
                      </h3>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        {(propertiesCount > 0 || hasVehicles)
                          ? 'Your listings are published and generating on-chain returns.'
                          : 'Publish properties or vehicles to start collecting USDC rent.'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigateTo(propertiesCount > 0 ? 'landlord-properties' : 'host-vehicles')}
                    className="bg-white border border-black/[0.06] hover:bg-gray-50 text-gray-900 text-xs font-semibold px-3 py-1.5 rounded-xl transition shadow-2xs shrink-0"
                  >
                    Manage Listings
                  </button>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
