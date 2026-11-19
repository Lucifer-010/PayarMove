import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  Search,
  Filter,
  X,
  Loader2,
  ArrowRight,
  HelpCircle,
  Check,
} from 'lucide-react';
import api from '../../services/api';

export default function LandlordReconciliationView() {
  const [payments, setPayments] = useState([]);
  const [obligations, setObligations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [filterStatus, setFilterStatus] = useState('ALL'); // 'ALL' | 'VERIFIED' | 'PARTIAL' | 'UNMATCHED' | 'FLAGGED'
  const [matchingPayment, setMatchingPayment] = useState(null);
  const [selectedObligationId, setSelectedObligationId] = useState('');
  const [matchNotes, setMatchNotes] = useState('');
  const [matchingLoading, setMatchingLoading] = useState(false);
  const [alertNotice, setAlertNotice] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [paymentsData, obligationsData] = await Promise.all([
        api.reconciliation.listPayments().catch(() => []),
        api.obligations.list().catch(() => []),
      ]);
      setPayments(Array.isArray(paymentsData) ? paymentsData : paymentsData?.results || []);
      setObligations(Array.isArray(obligationsData) ? obligationsData : obligationsData?.results || []);
    } catch (err) {
      console.warn('Reconciliation data fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSyncWallets = async () => {
    setSyncing(true);
    try {
      const res = await api.reconciliation.syncWallets();
      setAlertNotice(res.message || 'Scanned Stellar Testnet Horizon receiving wallets.');
      setTimeout(() => setAlertNotice(''), 4000);
      await fetchData();
    } catch (err) {
      alert(`Sync failed: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const handleManualMatch = async (e) => {
    e.preventDefault();
    if (!matchingPayment || !selectedObligationId) {
      alert('Please select an open obligation to match.');
      return;
    }
    setMatchingLoading(true);
    try {
      await api.reconciliation.resolveUnmatched(matchingPayment.id, selectedObligationId, matchNotes);
      setAlertNotice('Payment successfully reconciled and credited to obligation!');
      setTimeout(() => setAlertNotice(''), 4000);
      setMatchingPayment(null);
      setSelectedObligationId('');
      setMatchNotes('');
      await fetchData();
    } catch (err) {
      alert(`Manual match failed: ${err.message}`);
    } finally {
      setMatchingLoading(false);
    }
  };

  const filteredPayments = payments.filter((p) => {
    if (filterStatus === 'ALL') return true;
    if (filterStatus === 'VERIFIED') return p.status === 'VERIFIED';
    if (filterStatus === 'PARTIAL') return p.is_partial_payment || p.status === 'PARTIALLY_PAID';
    if (filterStatus === 'UNMATCHED') return p.is_unmatched || p.status === 'UNMATCHED';
    if (filterStatus === 'FLAGGED') return p.is_unmatched || p.status === 'EXCESS_PAYMENT' || p.status === 'FLAGGED';
    return true;
  });

  return (
    <div className="w-full max-w-full space-y-8 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#111111]">
            Stellar Payment Reconciliation
          </h1>
          <p className="text-xs sm:text-sm text-[#5C5C5C] mt-1">
            Real-time audit log of Stellar Testnet operations, deduplication, and manual transfer matching
          </p>
        </div>

        <button
          onClick={handleSyncWallets}
          disabled={syncing}
          className="self-start sm:self-auto px-4 py-2.5 rounded-xl bg-[#0A4F4E] hover:bg-[#083D3C] text-white text-xs font-extrabold shadow-md flex items-center gap-2 transition disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Scanning Stellar Horizon...' : 'Check Horizon Payments'}
        </button>
      </div>

      {alertNotice && (
        <div className="mb-6 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{alertNotice}</span>
        </div>
      )}

      {/* Filter Chips (Figma F5 / F15) */}
      <div className="flex flex-wrap items-center gap-2 mb-6 border-b border-gray-200/80 pb-3">
        {[
          { id: 'ALL', label: `All Payments (${payments.length})` },
          { id: 'VERIFIED', label: 'Verified' },
          { id: 'PARTIAL', label: 'Partially Paid' },
          { id: 'UNMATCHED', label: 'Unmatched' },
          { id: 'FLAGGED', label: 'Flagged (Excess / Unknown)' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilterStatus(tab.id)}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition ${
              filterStatus === tab.id
                ? 'bg-[#0A4F4E] text-white shadow-xs'
                : 'bg-white text-gray-600 hover:bg-gray-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-20 text-center">
          <Loader2 className="w-8 h-8 text-[#0A4F4E] animate-spin mx-auto mb-3" />
          <p className="text-xs text-gray-500 font-semibold">Loading Stellar payments audit log...</p>
        </div>
      ) : filteredPayments.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-gray-200/80 shadow-2xs">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 text-gray-400 flex items-center justify-center mx-auto mb-4">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-extrabold text-gray-900 mb-1">No payments match this filter</h3>
          <p className="text-xs text-gray-500 max-w-sm mx-auto">
            Try switching filters or click "Check Horizon Payments" to pull the latest transfers from Stellar Testnet.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-gray-200/80 shadow-2xs overflow-hidden">
          <div className="divide-y divide-gray-100">
            {filteredPayments.map((p) => {
              const isUnmatched = p.is_unmatched || p.status === 'UNMATCHED';
              const isExcess = p.status === 'EXCESS_PAYMENT';
              const isPartial = p.is_partial_payment || p.status === 'PARTIALLY_PAID';

              return (
                <div
                  key={p.id}
                  className="p-5 sm:p-6 hover:bg-gray-50/50 transition flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-black text-gray-950">
                        ${p.amount_usdc} USDC
                      </span>

                      {/* Status Pill */}
                      <span
                        className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase ${
                          isUnmatched
                            ? 'bg-rose-100 text-rose-800'
                            : isExcess
                            ? 'bg-purple-100 text-purple-800'
                            : isPartial
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {isUnmatched ? 'Unmatched' : isExcess ? 'Excess Flagged' : isPartial ? 'Partial' : 'Verified'}
                      </span>

                      {p.memo_text && (
                        <span className="text-[11px] font-mono font-bold bg-gray-100 text-gray-700 px-2 py-0.5 rounded-lg">
                          Memo: {p.memo_text}
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-gray-500 flex flex-wrap items-center gap-3">
                      <span>Sender: <strong className="text-gray-700 font-mono">{p.source_stellar_address?.slice(0, 8)}...{p.source_stellar_address?.slice(-6)}</strong></span>
                      <span>·</span>
                      <span>Receiving: <strong className="text-gray-700 font-mono">{p.receiving_stellar_address?.slice(0, 8)}...{p.receiving_stellar_address?.slice(-6)}</strong></span>
                      <span>·</span>
                      <span>{p.created_at ? new Date(p.created_at).toLocaleString() : ''}</span>
                    </div>

                    {p.stellar_transaction_hash && (
                      <div className="pt-1">
                        <a
                          href={`https://stellar.expert/explorer/testnet/tx/${p.stellar_transaction_hash}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] font-mono text-[#0A4F4E] hover:underline inline-flex items-center gap-1"
                        >
                          Tx: {p.stellar_transaction_hash.slice(0, 16)}...{p.stellar_transaction_hash.slice(-12)}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    {isUnmatched && (
                      <button
                        onClick={() => setMatchingPayment(p)}
                        className="px-4 py-2 rounded-xl bg-[#0A4F4E] hover:bg-[#083D3C] text-white text-xs font-bold shadow-xs transition flex items-center gap-1.5"
                      >
                        <ArrowRight className="w-3.5 h-3.5" />
                        Match to Obligation
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Manual Match Modal (Figma F5) */}
      {matchingPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-gray-100 relative animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => setMatchingPayment(null)}
              className="absolute top-5 right-5 p-2 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-xl font-extrabold text-gray-950 mb-1">Match Unmatched Payment</h2>
            <p className="text-xs text-gray-500 mb-5">
              Reconcile this ${matchingPayment.amount_usdc} USDC transfer to an open tenant obligation
            </p>

            <div className="p-3.5 rounded-2xl bg-gray-50 border border-gray-200 text-xs mb-5 space-y-1.5">
              <div className="flex justify-between">
                <span className="text-gray-400 font-semibold">Amount:</span>
                <strong className="text-gray-900 font-mono">${matchingPayment.amount_usdc} USDC</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400 font-semibold">Stellar Tx:</span>
                <strong className="text-gray-900 font-mono">{matchingPayment.stellar_transaction_hash?.slice(0, 16)}...</strong>
              </div>
            </div>

            <form onSubmit={handleManualMatch} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-gray-700 mb-1">Select Open Obligation to Credit</label>
                <select
                  required
                  value={selectedObligationId}
                  onChange={(e) => setSelectedObligationId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-300 focus:border-[#0A4F4E] outline-none text-xs text-gray-900 bg-white"
                >
                  <option value="">-- Choose an open obligation --</option>
                  {obligations
                    .filter((o) => o.outstanding_balance_usdc > 0)
                    .map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.obligation_reference} · {o.tenant_name || o.tenant_email} · Bal: ${o.outstanding_balance_usdc} USDC
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Reconciliation Notes (Optional)</label>
                <textarea
                  rows="2"
                  placeholder="e.g. Tenant paid from alternate wallet without memo"
                  value={matchNotes}
                  onChange={(e) => setMatchNotes(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-gray-300 focus:border-[#0A4F4E] outline-none text-xs text-gray-900"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setMatchingPayment(null)}
                  className="px-4 py-2.5 rounded-xl border border-gray-200 font-bold text-gray-700 hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={matchingLoading || !selectedObligationId}
                  className="px-5 py-2.5 rounded-xl bg-[#0A4F4E] hover:bg-[#083D3C] text-white font-extrabold shadow-md flex items-center gap-1.5"
                >
                  {matchingLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Confirm Match
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

