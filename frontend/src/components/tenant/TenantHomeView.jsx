import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowRight,
  Download,
  Receipt,
  Wallet,
  RefreshCw,
  ExternalLink,
  Loader2,
  ShieldCheck,
  ChevronRight,
  LogIn,
  Search,
} from 'lucide-react';
import api from '../../services/api';
import { useApp } from '../../context/AppContext';
import TenantPayModal from './TenantPayModal';

export default function TenantHomeView() {
  const { user, connectedWallet, handleConnectWallet, navigateTo } = useApp();

  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [activeObligation, setActiveObligation] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);

  const fetchTenantData = async () => {
    if (!user?.isLoggedIn) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMsg('');
    try {
      const data = await api.dashboard.getTenantSummary();
      setDashboardData(data);
      if (data.current_obligation) {
        setActiveObligation(data.current_obligation);
      }
    } catch (err) {
      // If 401 or no auth, don't show a raw error, let user sign in
      if (err.status !== 401) {
        setErrorMsg(err.message || 'Failed to load tenant dashboard.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTenantData();
  }, [user?.isLoggedIn]);

  const handleDownloadPdf = async (receiptId) => {
    setDownloadingId(receiptId);
    try {
      await api.receipts.downloadPdf(receiptId);
    } catch (err) {
      alert(`Download failed: ${err.message}`);
    } finally {
      setDownloadingId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center">
        <Loader2 className="w-10 h-10 text-[#0A4F4E] animate-spin mb-3" />
        <p className="text-sm font-bold text-gray-600">Loading your rental dashboard...</p>
      </div>
    );
  }

  // 1. Unauthenticated Visitor / First Sign-in State (Figma F1 & F0b)
  if (!user?.isLoggedIn) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <div className="w-16 h-16 rounded-3xl bg-[#0A4F4E]/10 text-[#0A4F4E] flex items-center justify-center mx-auto mb-6">
          <Building2 className="w-8 h-8" />
        </div>
        <div className="inline-block px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-extrabold rounded-full mb-3 uppercase tracking-wider">
          Tenant Portal
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-gray-950 mb-3">
          Pay Rent in USDC on Stellar
        </h1>
        <p className="text-sm text-gray-600 max-w-md mx-auto mb-8 leading-relaxed">
          Log in with your tenant account to view your active lease, pay monthly rent or partial instalments, and download cryptographic receipts.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 max-w-md mx-auto">
          <button
            onClick={() => navigateTo('login')}
            className="w-full sm:w-auto py-3.5 px-6 rounded-2xl bg-[#0A4F4E] hover:bg-[#083D3C] text-white font-extrabold text-sm shadow-md transition flex items-center justify-center gap-2"
          >
            <LogIn className="w-4 h-4" />
            Sign in as Tenant
          </button>
          <button
            onClick={() => navigateTo('properties')}
            className="w-full sm:w-auto py-3.5 px-6 rounded-2xl bg-white border border-gray-200 hover:bg-gray-50 text-gray-800 font-extrabold text-sm shadow-2xs transition flex items-center justify-center gap-2"
          >
            <Search className="w-4 h-4 text-[#0A4F4E]" />
            Browse Properties
          </button>
        </div>
      </div>
    );
  }

  const curObligation = dashboardData?.current_obligation;
  const paymentStatus = curObligation?.status || dashboardData?.payment_status || 'UPCOMING';
  const outstandingAmount = Number(curObligation?.outstanding_balance_usdc ?? dashboardData?.outstanding_rent_usdc ?? 0);
  const monthlyRent = Number(curObligation?.amount_due_usdc ?? dashboardData?.monthly_rent_usdc ?? 500);
  const amountPaid = Number(curObligation?.amount_paid_usdc ?? dashboardData?.amount_paid_usdc ?? 0);
  const percentPaid = monthlyRent > 0 ? Math.min(100, Math.round((amountPaid / monthlyRent) * 100)) : 0;

  // 2. Authenticated but No Active Lease (e.g. Brand New Tenant)
  if (!curObligation && (!dashboardData?.upcoming_obligations || dashboardData.upcoming_obligations.length === 0)) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <div className="w-16 h-16 rounded-3xl bg-gray-100 text-gray-400 flex items-center justify-center mx-auto mb-6">
          <Building2 className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-black text-gray-950 mb-2">No Active Lease Found</h2>
        <p className="text-xs sm:text-sm text-gray-600 max-w-md mx-auto mb-8">
          You are signed in as <strong>{user?.email}</strong>. If your landlord created a lease schedule, it will appear here. Or explore our available apartments to apply directly!
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={() => navigateTo('properties')}
            className="py-3.5 px-6 rounded-2xl bg-[#0A4F4E] hover:bg-[#083D3C] text-white font-extrabold text-sm shadow-md transition flex items-center justify-center gap-2"
          >
            <Search className="w-4 h-4" />
            Browse Available Properties
          </button>
          <button
            onClick={fetchTenantData}
            className="py-3.5 px-5 rounded-2xl bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-bold text-sm shadow-2xs transition"
          >
            Refresh Status
          </button>
        </div>
      </div>
    );
  }

  // 3. Active Tenant Dashboard View (Figma F1, F2, F14)
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold text-[#0A4F4E] bg-[#0A4F4E]/10 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
              Tenant Portal
            </span>
            <span className="text-xs text-gray-400">·</span>
            <span className="text-xs text-gray-500 font-medium">Stellar Testnet USDC</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#111111]">
            Welcome back, {user?.name || user?.username || 'Tenant'}
          </h1>
          <p className="text-xs sm:text-sm text-[#5C5C5C] mt-1 flex items-center gap-1.5">
            <Building2 className="w-4 h-4 text-gray-400" />
            <span>{curObligation?.property_name || 'Kilimani Gardens'}</span>
            {curObligation?.unit_number && (
              <>
                <span>·</span>
                <strong className="text-gray-800">Unit {curObligation.unit_number}</strong>
              </>
            )}
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigateTo('properties')}
            className="px-3.5 py-2.5 rounded-xl bg-white border border-gray-200 hover:bg-gray-50 text-xs font-bold text-gray-700 shadow-2xs flex items-center gap-1.5 transition"
          >
            <Building2 className="w-4 h-4 text-[#0A4F4E]" />
            Properties
          </button>
          <button
            onClick={() => navigateTo('tenant-history')}
            className="px-3.5 py-2.5 rounded-xl bg-white border border-gray-200 hover:bg-gray-50 text-xs font-bold text-gray-700 shadow-2xs flex items-center gap-1.5 transition"
          >
            <Receipt className="w-4 h-4 text-[#0A4F4E]" />
            Receipts
          </button>
          <button
            onClick={fetchTenantData}
            className="p-2.5 rounded-xl bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 shadow-2xs transition"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="mb-6 p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">
          {errorMsg}
        </div>
      )}

      {/* RENT DUE HERO CARD (Figma F1 / F2 / F14) */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-200/80 shadow-xs mb-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#0A4F4E]/5 rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />

        <div className="relative z-10">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
            <span className="text-xs font-extrabold uppercase tracking-wider text-gray-400">
              Current Rent Obligation
            </span>
            {/* Status Pill */}
            <span
              className={`px-3.5 py-1 rounded-full text-xs font-extrabold uppercase tracking-wide flex items-center gap-1.5 ${
                paymentStatus === 'PAID'
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                  : paymentStatus === 'PARTIALLY_PAID'
                  ? 'bg-amber-100 text-amber-800 border border-amber-200'
                  : paymentStatus === 'OVERDUE'
                  ? 'bg-rose-100 text-rose-800 border border-rose-200'
                  : 'bg-gray-100 text-gray-700 border border-gray-200'
              }`}
            >
              {paymentStatus === 'PAID' && <CheckCircle2 className="w-4 h-4" />}
              {paymentStatus === 'PARTIALLY_PAID' && <Clock className="w-4 h-4" />}
              {paymentStatus === 'OVERDUE' && <AlertTriangle className="w-4 h-4" />}
              {paymentStatus.replace('_', ' ')}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
            {/* Left: Outstanding amount */}
            <div className="md:col-span-2">
              <div className="text-4xl sm:text-5xl font-black text-[#111111] tracking-tight">
                ${outstandingAmount.toFixed(2)}{' '}
                <span className="text-xl font-bold text-gray-500">USDC</span>
              </div>
              <div className="text-xs sm:text-sm text-[#5C5C5C] mt-2 font-medium">
                {paymentStatus === 'PAID' ? (
                  <span className="text-emerald-700 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" /> All caught up for this month!
                  </span>
                ) : (
                  <span>
                    Monthly rent is <strong>${monthlyRent.toFixed(2)} USDC</strong>. Due date:{' '}
                    <strong className="text-gray-900">{curObligation?.due_date || '5th of this month'}</strong>.
                  </span>
                )}
              </div>

              {/* Progress bar if partial payment */}
              {paymentStatus === 'PARTIALLY_PAID' && (
                <div className="mt-4 max-w-md">
                  <div className="flex justify-between text-xs font-bold mb-1.5">
                    <span className="text-emerald-700">${amountPaid.toFixed(2)} paid</span>
                    <span className="text-gray-400">${monthlyRent.toFixed(2)} total</span>
                  </div>
                  <div className="w-full h-2.5 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className="h-full bg-emerald-600 rounded-full transition-all duration-500"
                      style={{ width: `${percentPaid}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Right: Quick Action Button */}
            <div className="flex flex-col gap-2.5">
              {outstandingAmount > 0 ? (
                <button
                  onClick={() => setPayModalOpen(true)}
                  className="w-full py-4 px-6 rounded-2xl bg-[#0A4F4E] hover:bg-[#083D3C] text-white font-extrabold text-sm shadow-md transition flex items-center justify-center gap-2 group"
                >
                  <CreditCard className="w-4 h-4" />
                  {paymentStatus === 'PARTIALLY_PAID' ? 'Pay Remaining Rent' : 'Pay Rent in USDC'}
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition" />
                </button>
              ) : (
                <button
                  onClick={() => navigateTo('tenant-history')}
                  className="w-full py-4 px-6 rounded-2xl bg-emerald-50 text-emerald-800 border border-emerald-200 font-extrabold text-sm transition flex items-center justify-center gap-2"
                >
                  <Receipt className="w-4 h-4" />
                  View Paid Receipt
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 cols: Upcoming Obligations / Schedule Timeline */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-3xl p-6 border border-gray-200/80 shadow-2xs">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-extrabold text-gray-950 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#0A4F4E]" />
                Upcoming Rent Schedule
              </h2>
              <span className="text-xs text-gray-400 font-semibold">Automatic recurring</span>
            </div>

            {dashboardData?.upcoming_obligations?.length > 0 ? (
              <div className="space-y-3">
                {dashboardData.upcoming_obligations.map((obl, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-2xl border border-gray-100 hover:border-gray-200 bg-gray-50/50 hover:bg-white transition flex items-center justify-between gap-4"
                  >
                    <div>
                      <div className="font-bold text-sm text-gray-900">
                        {obl.period || `${obl.due_date} Cycle`}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        Due: <strong className="text-gray-700">{obl.due_date}</strong> · Ref: {obl.obligation_reference}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="text-sm font-extrabold text-gray-900 font-mono">
                          ${Number(obl.amount_due_usdc).toFixed(2)} USDC
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                          {obl.status}
                        </span>
                      </div>
                      {obl.outstanding_balance_usdc > 0 && (
                        <button
                          onClick={() => {
                            setActiveObligation(obl);
                            setPayModalOpen(true);
                          }}
                          className="px-3 py-1.5 rounded-xl bg-[#0A4F4E] text-white text-xs font-bold hover:bg-[#083D3C] transition"
                        >
                          Pay
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-500 py-4 text-center">No upcoming obligations generated yet.</p>
            )}
          </div>

          {/* Verified Payment History & Receipts */}
          <div className="bg-white rounded-3xl p-6 border border-gray-200/80 shadow-2xs">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-extrabold text-gray-950 flex items-center gap-2">
                <Receipt className="w-4 h-4 text-[#0A4F4E]" />
                Recent Verified Receipts
              </h2>
              <button
                onClick={() => navigateTo('tenant-history')}
                className="text-xs font-bold text-[#0A4F4E] hover:underline flex items-center gap-1"
              >
                View all <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {dashboardData?.downloadable_receipts?.length > 0 || dashboardData?.recent_payments?.length > 0 ? (
              <div className="space-y-3">
                {(dashboardData.downloadable_receipts || dashboardData.recent_payments).slice(0, 3).map((rec, idx) => (
                  <div
                    key={rec.id || idx}
                    className="p-3.5 rounded-2xl border border-gray-100 bg-gray-50/50 flex items-center justify-between gap-3"
                  >
                    <div>
                      <div className="font-extrabold text-xs text-gray-900">
                        {rec.receipt_reference || rec.receipt_number || `REC-${idx + 1}`}
                      </div>
                      <div className="text-[11px] text-gray-500 mt-0.5">
                        {rec.billing_period || rec.rental_period || 'Rental Period'} · {rec.payment_date ? new Date(rec.payment_date).toLocaleDateString() : 'Confirmed'}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs font-extrabold text-emerald-700">
                        ${Number(rec.amount_paid || rec.amount_paid_usdc || rec.amount || 0).toFixed(2)} USDC
                      </span>
                      {rec.id && (
                        <button
                          onClick={() => handleDownloadPdf(rec.id)}
                          disabled={downloadingId === rec.id}
                          className="p-2 rounded-xl bg-white border border-gray-200 hover:bg-gray-100 text-gray-700 transition"
                          title="Download PDF"
                        >
                          {downloadingId === rec.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Download className="w-3.5 h-3.5" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-500 py-4 text-center">No payment receipts yet.</p>
            )}
          </div>
        </div>

        {/* Right col: Security & Network Specs */}
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-6 border border-gray-200/80 shadow-2xs">
            <h3 className="text-sm font-extrabold text-gray-900 mb-3 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#0A4F4E]" />
              Stellar Testnet Security
            </h3>
            <p className="text-xs text-gray-600 leading-relaxed mb-4">
              PayarMove verifies payments via real-time Horizon operations. Every transaction is matched by memo, preventing duplicate credits and ensuring instant downloadable PDF receipts.
            </p>

            <div className="p-3.5 rounded-2xl bg-[#F2F7F7] border border-gray-200/80 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Asset</span>
                <span className="font-bold text-gray-900">USDC (Testnet)</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Grace Period</span>
                <span className="font-bold text-gray-900">5 Days</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Receipt Format</span>
                <span className="font-bold text-[#0A4F4E]">PDF & Blockchain Proof</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Pay Rent Modal */}
      <TenantPayModal
        isOpen={payModalOpen}
        onClose={() => setPayModalOpen(false)}
        obligation={activeObligation || curObligation}
        onSuccess={() => {
          fetchTenantData();
        }}
      />
    </div>
  );
}
