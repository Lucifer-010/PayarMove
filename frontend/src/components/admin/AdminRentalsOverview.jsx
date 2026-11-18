import React, { useState, useEffect } from 'react';
import {
  Building2,
  DollarSign,
  Users,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  Loader2,
  Calendar,
  CheckCircle2,
} from 'lucide-react';
import api from '../../services/api';
import { useApp } from '../../context/AppContext';

export default function AdminRentalsOverview() {
  const { navigateTo } = useApp();
  const [properties, setProperties] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      const [propData, payData] = await Promise.all([
        api.properties.list().catch(() => []),
        api.reconciliation.listPayments().catch(() => []),
      ]);
      setProperties(Array.isArray(propData) ? propData : propData?.results || []);
      setPayments(Array.isArray(payData) ? payData : payData?.results || []);
    } catch (e) {
      console.warn('Admin fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  const totalVolume = payments.reduce((acc, p) => acc + (Number(p.amount_usdc) || 0), 0);
  const totalProperties = properties.length;
  const flaggedCount = payments.filter((p) => p.is_unmatched || p.status === 'EXCESS_PAYMENT').length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Switcher Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold text-gray-900 bg-gray-200 px-2.5 py-0.5 rounded-full uppercase">
              Admin Portal
            </span>
            <span className="text-xs text-gray-400">·</span>
            <span className="text-xs text-gray-500 font-medium">Property Rentals System</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-gray-950">
            Property Rentals & Stellar Settlement
          </h1>
        </div>

        {/* Mode Switcher */}
        <div className="flex items-center gap-2 bg-gray-100 p-1.5 rounded-2xl">
          <button
            onClick={() => navigateTo('admin-overview')}
            className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 hover:text-gray-950 transition"
          >
            Mobility Vehicles
          </button>
          <button
            className="px-4 py-2 rounded-xl text-xs font-extrabold bg-[#0A4F4E] text-white shadow-xs"
          >
            Property Rentals
          </button>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-3xl p-6 border border-gray-200 shadow-2xs">
          <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Total Volume Reconciled</div>
          <div className="text-3xl font-black text-emerald-700 font-mono">
            ${totalVolume.toLocaleString()} <span className="text-xs font-bold text-gray-400">USDC</span>
          </div>
          <div className="text-xs text-gray-500 mt-2 font-medium">Across all managed properties</div>
        </div>

        <div className="bg-white rounded-3xl p-6 border border-gray-200 shadow-2xs">
          <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Registered Properties</div>
          <div className="text-3xl font-black text-gray-900">
            {totalProperties}
          </div>
          <div className="text-xs text-gray-500 mt-2 font-medium">Configured on Stellar Testnet</div>
        </div>

        <div className="bg-white rounded-3xl p-6 border border-gray-200 shadow-2xs">
          <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Flagged / Unmatched</div>
          <div className="text-3xl font-black text-purple-700">
            {flaggedCount}
          </div>
          <div className="text-xs text-gray-500 mt-2 font-medium">Excess or missing memo</div>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white rounded-3xl border border-gray-200 shadow-2xs overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-base font-extrabold text-gray-950">Recent Stellar Payments Audit Log</h2>
          <button
            onClick={fetchAdminData}
            disabled={loading}
            className="p-2 rounded-xl bg-gray-50 hover:bg-gray-100 text-gray-600 transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="divide-y divide-gray-100">
          {payments.slice(0, 10).map((p) => (
            <div key={p.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-black text-sm text-gray-950">${p.amount_usdc} USDC</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-100 text-emerald-800">
                    {p.status}
                  </span>
                  {p.memo_text && (
                    <span className="font-mono text-[11px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                      Memo: {p.memo_text}
                    </span>
                  )}
                </div>
                <div className="text-gray-500 mt-1 font-mono text-[11px]">
                  Tx: {p.stellar_transaction_hash ? `${p.stellar_transaction_hash.slice(0, 20)}...` : 'N/A'}
                </div>
              </div>

              {p.stellar_transaction_hash && (
                <a
                  href={`https://stellar.expert/explorer/testnet/tx/${p.stellar_transaction_hash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#0A4F4E] hover:underline flex items-center gap-1 font-bold shrink-0"
                >
                  Stellar.Expert <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

