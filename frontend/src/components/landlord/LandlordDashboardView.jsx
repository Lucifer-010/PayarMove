import React, { useState, useEffect } from 'react';
import {
  Building2,
  DollarSign,
  Users,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowRight,
  Plus,
  RefreshCw,
  Bell,
  Send,
  ShieldCheck,
  Calendar,
  Layers,
  ChevronRight,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import api from '../../services/api';
import { useApp } from '../../context/AppContext';

export default function LandlordDashboardView({ onSwitchTab }) {
  const { user, navigateTo } = useApp();

  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [remindingId, setRemindingId] = useState(null);
  const [alertNotice, setAlertNotice] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const fetchDashboard = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const data = await api.dashboard.getLandlordSummary();
      setDashboardData(data);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to load landlord dashboard.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  // Poll Stellar Horizon Testnet
  const handleSyncStellarWallets = async () => {
    setSyncing(true);
    try {
      const res = await api.reconciliation.syncWallets();
      setAlertNotice(res.message || 'Successfully scanned Stellar Testnet for incoming transfers.');
      await fetchDashboard();
      setTimeout(() => setAlertNotice(''), 4000);
    } catch (err) {
      alert(`Stellar synchronization failed: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  };

  // Send rent reminder (Figma F10)
  const handleSendReminder = async (assignmentId, tenantEmail) => {
    setRemindingId(assignmentId);
    try {
      await api.assignments.remind(assignmentId);
      setAlertNotice(`Reminder successfully sent to ${tenantEmail || 'tenant'}!`);
      setTimeout(() => setAlertNotice(''), 4000);
    } catch (err) {
      alert(`Failed to send reminder: ${err.message}`);
    } finally {
      setRemindingId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center">
        <Loader2 className="w-10 h-10 text-[#0A4F4E] animate-spin mb-3" />
        <p className="text-sm font-bold text-gray-600">Loading landlord dashboard...</p>
      </div>
    );
  }

  const rentDue = Number(dashboardData?.rent_due_usdc || 0);
  const rentCollected = Number(dashboardData?.rent_collected_usdc || 0);
  const rentOutstanding = Number(dashboardData?.outstanding_usdc || 0);
  const activeTenants = Number(dashboardData?.active_tenants || 0);
  const collectionPercent = rentDue > 0 ? Math.min(100, Math.round((rentCollected / rentDue) * 100)) : 0;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold text-[#0A4F4E] bg-[#0A4F4E]/10 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
              Landlord Portal
            </span>
            <span className="text-xs text-gray-400">·</span>
            <span className="text-xs text-gray-500 font-medium">Monthly Collections</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#111111]">
            Monthly Rent & Property Overview
          </h1>
          <p className="text-xs sm:text-sm text-[#5C5C5C] mt-1">
            Track rental collections, active schedules, and reconcile incoming Stellar Testnet payments
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleSyncStellarWallets}
            disabled={syncing}
            className="px-3.5 py-2.5 rounded-xl bg-white border border-gray-200 hover:bg-gray-50 text-xs font-bold text-gray-700 shadow-2xs flex items-center gap-1.5 transition disabled:opacity-50"
            title="Scan Stellar Testnet Horizon for new payments"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin text-[#0A4F4E]' : ''}`} />
            {syncing ? 'Scanning Horizon...' : 'Check Stellar Payments'}
          </button>

          <button
            onClick={() => onSwitchTab ? onSwitchTab('schedules') : navigateTo('landlord-schedules')}
            className="px-4 py-2.5 rounded-xl bg-[#0A4F4E] hover:bg-[#083D3C] text-white text-xs font-extrabold shadow-md flex items-center gap-1.5 transition"
          >
            <Plus className="w-4 h-4" />
            Create Schedule / Invite
          </button>
        </div>
      </div>

      {alertNotice && (
        <div className="mb-6 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{alertNotice}</span>
        </div>
      )}

      {errorMsg && (
        <div className="mb-6 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
          {errorMsg}
        </div>
      )}

      {/* METRICS CARDS (Figma F4) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {/* Rent Due */}
        <div className="bg-white rounded-3xl p-5 sm:p-6 border border-gray-200/80 shadow-2xs">
          <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Total Rent Due</div>
          <div className="text-2xl sm:text-3xl font-black text-gray-950 font-mono">
            ${rentDue.toLocaleString()} <span className="text-xs font-bold text-gray-400">USDC</span>
          </div>
          <div className="text-[11px] text-gray-500 mt-2 font-medium">This billing cycle</div>
        </div>

        {/* Rent Collected */}
        <div className="bg-white rounded-3xl p-5 sm:p-6 border border-gray-200/80 shadow-2xs">
          <div className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-2">Total Collected</div>
          <div className="text-2xl sm:text-3xl font-black text-emerald-700 font-mono">
            ${rentCollected.toLocaleString()} <span className="text-xs font-bold text-emerald-600">USDC</span>
          </div>
          <div className="text-[11px] text-emerald-600 mt-2 font-bold">{collectionPercent}% collected</div>
        </div>

        {/* Outstanding */}
        <div className="bg-white rounded-3xl p-5 sm:p-6 border border-gray-200/80 shadow-2xs">
          <div className="text-xs font-bold text-rose-600 uppercase tracking-wider mb-2">Outstanding Rent</div>
          <div className="text-2xl sm:text-3xl font-black text-rose-600 font-mono">
            ${rentOutstanding.toLocaleString()} <span className="text-xs font-bold text-rose-400">USDC</span>
          </div>
          <div className="text-[11px] text-gray-500 mt-2 font-medium">Pending or partial</div>
        </div>

        {/* Active Tenants */}
        <div className="bg-white rounded-3xl p-5 sm:p-6 border border-gray-200/80 shadow-2xs">
          <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Active Tenants</div>
          <div className="text-2xl sm:text-3xl font-black text-[#0A4F4E]">
            {activeTenants}
          </div>
          <div className="text-[11px] text-gray-500 mt-2 font-medium">
            Across {dashboardData?.managed_properties_count || 2} properties
          </div>
        </div>
      </div>

      {/* COLLECTION PROGRESS BAR */}
      <div className="bg-white rounded-3xl p-6 border border-gray-200/80 shadow-2xs mb-8">
        <div className="flex items-center justify-between mb-3">
          <div>
            <span className="text-sm font-extrabold text-gray-900">Collection Progress</span>
            <span className="text-xs text-gray-500 ml-2">(${rentCollected} of ${rentDue} USDC)</span>
          </div>
          <span className="text-sm font-black text-[#0A4F4E]">{collectionPercent}%</span>
        </div>
        <div className="w-full h-3 rounded-full bg-gray-100 overflow-hidden">
          <div
            className="h-full bg-[#0A4F4E] rounded-full transition-all duration-700"
            style={{ width: `${collectionPercent}%` }}
          />
        </div>
      </div>

      {/* SECTION: Overdue Obligations & Tenant Reminders (Figma F4 & F10) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        <div className="lg:col-span-2 bg-white rounded-3xl p-6 border border-gray-200/80 shadow-2xs">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-extrabold text-gray-950 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              Tenant Collection Overview
            </h2>
            <span className="text-xs text-gray-400 font-semibold">Real-time status</span>
          </div>

          {dashboardData?.rental_collection_overview?.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {dashboardData.rental_collection_overview.map((item, idx) => (
                <div key={idx} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-xs text-gray-900">{item.tenant_name || item.tenant_email}</span>
                      <span
                        className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase ${
                          item.status === 'PAID'
                            ? 'bg-emerald-100 text-emerald-800'
                            : item.status === 'PARTIALLY_PAID'
                            ? 'bg-amber-100 text-amber-800'
                            : item.status === 'OVERDUE'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {item.status?.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1 flex items-center gap-2">
                      <span>{item.property_name} · Unit {item.unit_number}</span>
                      <span>·</span>
                      <span>Due: {item.due_date}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-xs font-bold text-gray-400">
                        Paid: <strong className="text-gray-900">${item.amount_paid_usdc}</strong>
                      </div>
                      <div className={`text-xs font-extrabold font-mono ${item.outstanding_usdc > 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                        Bal: ${item.outstanding_usdc} USDC
                      </div>
                    </div>

                    {item.outstanding_usdc > 0 && item.assignment_id && (
                      <button
                        onClick={() => handleSendReminder(item.assignment_id, item.tenant_email)}
                        disabled={remindingId === item.assignment_id}
                        className="px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-bold transition flex items-center gap-1 shrink-0"
                        title="Send rent payment reminder"
                      >
                        {remindingId === item.assignment_id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Send className="w-3.5 h-3.5" />
                        )}
                        <span>Remind</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-500 py-6 text-center">No active tenant records found.</p>
          )}
        </div>

        {/* Right col: Quick Management Shortcuts */}
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-6 border border-gray-200/80 shadow-2xs">
            <h3 className="text-sm font-extrabold text-gray-900 mb-3 flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#0A4F4E]" />
              Quick Navigation
            </h3>
            <div className="space-y-2.5">
              <button
                onClick={() => onSwitchTab ? onSwitchTab('properties') : navigateTo('landlord-properties')}
                className="w-full p-3 rounded-2xl bg-gray-50 hover:bg-gray-100 text-left flex items-center justify-between transition group"
              >
                <div>
                  <div className="font-extrabold text-xs text-gray-900">Manage Properties</div>
                  <div className="text-[11px] text-gray-500">Add units, configure wallets</div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400 group-hover:translate-x-0.5 transition" />
              </button>

              <button
                onClick={() => onSwitchTab ? onSwitchTab('schedules') : navigateTo('landlord-schedules')}
                className="w-full p-3 rounded-2xl bg-gray-50 hover:bg-gray-100 text-left flex items-center justify-between transition group"
              >
                <div>
                  <div className="font-extrabold text-xs text-gray-900">Rent Schedules</div>
                  <div className="text-[11px] text-gray-500">Recurring payment obligations</div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400 group-hover:translate-x-0.5 transition" />
              </button>

              <button
                onClick={() => onSwitchTab ? onSwitchTab('reconciliation') : navigateTo('landlord-reconciliation')}
                className="w-full p-3 rounded-2xl bg-gray-50 hover:bg-gray-100 text-left flex items-center justify-between transition group"
              >
                <div>
                  <div className="font-extrabold text-xs text-gray-900">Payment Reconciliation</div>
                  <div className="text-[11px] text-gray-500">Match Stellar transfers & audit</div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400 group-hover:translate-x-0.5 transition" />
              </button>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-6 border border-gray-200/80 shadow-2xs">
            <h3 className="text-sm font-extrabold text-gray-900 mb-2 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#0A4F4E]" />
              Stellar Testnet Wallets
            </h3>
            <p className="text-xs text-gray-500 leading-relaxed">
              Every property has a dedicated Stellar receiving address. Automated Celery background workers monitor the Horizon network every 15 seconds to reconcile payments instantly.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

