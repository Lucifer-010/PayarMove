import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import {
  LayoutDashboard,
  Receipt,
  Car,
  Wallet,
  User,
  LogOut,
  ChevronRight,
  Search,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Loader2,
  Calendar,
  Building2,
  Users,
  ShieldCheck,
  Download,
  ExternalLink,
} from 'lucide-react';
import api from '../../services/api';

export default function HostPaymentsView() {
  const {
    user,
    navigateTo,
    switchMode,
    hostMetrics,
    hostRentals,
    handleConfirmReturn,
    connectedWallet,
    refreshBackendData,
    setHostAccountTab,
  } = useApp();

  const [categoryTab, setCategoryTab] = useState('all'); // 'all' | 'properties' | 'vehicles'
  const [filterTab, setFilterTab] = useState('All'); // 'All' | 'Settled' | 'Pending'
  const [searchQuery, setSearchQuery] = useState('');
  const [payouts, setPayouts] = useState([]);
  const [rentReceipts, setRentReceipts] = useState([]);
  const [landlordSummary, setLandlordSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [actionToast, setActionToast] = useState(null);

  const fetchPaymentsData = async () => {
    try {
      setLoading(true);
      const [payoutsRes, receiptsRes, landlordRes] = await Promise.allSettled([
        api.payouts.list(),
        api.receipts.list(),
        api.dashboard.getLandlordSummary(),
      ]);

      if (payoutsRes.status === 'fulfilled') {
        const list = payoutsRes.value?.results || payoutsRes.value || [];
        setPayouts(list);
      }
      if (receiptsRes.status === 'fulfilled') {
        const rList = receiptsRes.value?.results || receiptsRes.value || [];
        setRentReceipts(rList);
      }
      if (landlordRes.status === 'fulfilled' && landlordRes.value) {
        setLandlordSummary(landlordRes.value);
      }
    } catch (err) {
      console.warn('Failed to fetch host payments / receipts:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPaymentsData();
  }, []);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await refreshBackendData();
    await fetchPaymentsData();
    setIsRefreshing(false);
  };

  const handleDownloadPdf = async (receiptId) => {
    try {
      await api.receipts.downloadPdf(receiptId);
    } catch (err) {
      alert(`Receipt download notice: ${err.message}`);
    }
  };

  // 1. Vehicle mobility payouts
  const allVehiclePayments = useMemo(() => {
    const map = new Map();

    for (const p of payouts) {
      const code = p.rental_code || p.id;
      map.set(code, {
        id: p.id,
        category: 'vehicle',
        rental_code: p.rental_code || `RENT-${p.id.slice(0, 6)}`,
        title: p.vehicle_name || 'Vehicle',
        party: p.renter_name || 'Guest Renter',
        gross_usdc: Number(p.gross_rental_usdc || 0),
        fee_usdc: Number(p.platform_fee_usdc || 0),
        net_usdc: Number(p.net_payout_usdc || 0),
        status: p.status || 'PENDING',
        tx_hash: p.tx_hash,
        created_at: p.created_at,
        receipt_id: null,
      });
    }

    for (const hr of hostRentals || []) {
      const code = hr.rentalId || hr.id;
      const isComp = (hr.rawStatus || hr.status || '').toUpperCase() === 'COMPLETED';
      if (!map.has(code)) {
        const gross = Number(hr.grossAmount || hr.rentalFee || 0);
        const fee = gross * 0.1;
        const net = gross - fee;
        map.set(code, {
          id: hr.dbId || hr.id,
          category: 'vehicle',
          rental_code: code,
          title: hr.vehicleName || hr.vehicle || 'Vehicle',
          party: hr.renterName || hr.renterEmail || 'Guest Renter',
          gross_usdc: gross,
          fee_usdc: fee,
          net_usdc: net,
          status: isComp ? 'COMPLETED' : 'PENDING',
          tx_hash: hr.stellarTxHash,
          created_at: hr.pickupDate,
          rawRental: hr,
          receipt_id: null,
        });
      }
    }

    return Array.from(map.values());
  }, [payouts, hostRentals]);

  // 2. Real estate property rent receipts & collections
  const allPropertyPayments = useMemo(() => {
    const items = [];
    const seen = new Set();

    // From live API receipts
    for (const rec of rentReceipts || []) {
      const key = rec.id || rec.receipt_number || rec.payment_reference;
      if (!seen.has(key)) {
        seen.add(key);
        const amount = Number(rec.amount_paid || rec.amount_paid_usdc || 0);
        items.push({
          id: rec.id,
          category: 'property',
          rental_code: rec.payment_reference || rec.receipt_number || `REC-${rec.id.slice(0, 6)}`,
          title: rec.property_title || rec.property_name || 'Property Unit',
          party: rec.tenant_name || rec.tenant_email || 'Tenant',
          gross_usdc: amount,
          fee_usdc: 0,
          net_usdc: amount,
          status: 'COMPLETED',
          tx_hash: rec.stellar_transaction_hash,
          created_at: rec.payment_date || rec.verified_at || rec.created_at,
          receipt_number: rec.receipt_number,
          receipt_id: rec.id,
        });
      }
    }

    // Also include recent_rent_payments from hostMetrics if not already in list
    for (const p of hostMetrics?.recent_rent_payments || []) {
      const key = p.id || p.payment_reference;
      if (!seen.has(key)) {
        seen.add(key);
        const amount = Number(p.amount_usdc || p.amount || 0);
        items.push({
          id: p.id,
          category: 'property',
          rental_code: p.payment_reference || `REC-${p.id.slice(0, 6)}`,
          title: p.property_name || 'Property Rental',
          party: p.tenant_email || 'Tenant',
          gross_usdc: amount,
          fee_usdc: 0,
          net_usdc: amount,
          status: (p.status || '').toUpperCase() === 'CONFIRMED' ? 'COMPLETED' : 'PENDING',
          tx_hash: p.stellar_tx_hash,
          created_at: p.created_at,
          receipt_number: p.receipt_number,
          receipt_id: p.id,
        });
      }
    }

    // Also include recent_payments from landlordSummary if present
    for (const p of landlordSummary?.recent_payments || []) {
      const key = p.id || p.payment_reference;
      if (!seen.has(key)) {
        seen.add(key);
        const amount = Number(p.amount || 0);
        items.push({
          id: p.id || p.payment_reference,
          category: 'property',
          rental_code: p.payment_reference || `REC-${String(key).slice(0, 6)}`,
          title: p.property_name || 'Property Rental',
          party: p.tenant_email || 'Tenant',
          gross_usdc: amount,
          fee_usdc: 0,
          net_usdc: amount,
          status: (p.status || '').toUpperCase() === 'CONFIRMED' ? 'COMPLETED' : 'PENDING',
          tx_hash: p.stellar_tx_hash,
          created_at: p.date || p.created_at,
          receipt_number: p.receipt_number,
          receipt_id: p.id,
        });
      }
    }

    return items;
  }, [rentReceipts, hostMetrics, landlordSummary]);

  // Combined and filtered payments
  const combinedPayments = useMemo(() => {
    let list = [];
    if (categoryTab === 'all') {
      list = [...allPropertyPayments, ...allVehiclePayments];
    } else if (categoryTab === 'properties') {
      list = allPropertyPayments;
    } else {
      list = allVehiclePayments;
    }

    return list.filter((p) => {
      const st = (p.status || '').toUpperCase();
      const matchesFilter =
        filterTab === 'All' ||
        (filterTab === 'Settled' && (st === 'COMPLETED' || st === 'SETTLED' || st === 'CONFIRMED')) ||
        (filterTab === 'Pending' && (st === 'PENDING' || st === 'PROCESSING' || st === 'PARTIAL'));

      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        (p.rental_code && p.rental_code.toLowerCase().includes(q)) ||
        (p.title && p.title.toLowerCase().includes(q)) ||
        (p.party && p.party.toLowerCase().includes(q)) ||
        (p.tx_hash && p.tx_hash.toLowerCase().includes(q));

      return matchesFilter && matchesSearch;
    });
  }, [categoryTab, filterTab, searchQuery, allPropertyPayments, allVehiclePayments]);

  const totalRentCollected = allPropertyPayments.reduce((sum, p) => sum + p.net_usdc, 0);
  const totalFleetEarned = allVehiclePayments
    .filter((p) => (p.status || '').toUpperCase() === 'COMPLETED')
    .reduce((sum, p) => sum + p.net_usdc, 0);
  const pendingFleetPayout = allVehiclePayments
    .filter((p) => (p.status || '').toUpperCase() === 'PENDING')
    .reduce((sum, p) => sum + p.net_usdc, 0);

  const payoutWalletAddress = user?.walletAddress || user?.primary_stellar_address || connectedWallet?.address || '';
  const shortWallet = payoutWalletAddress
    ? `${payoutWalletAddress.slice(0, 6)}...${payoutWalletAddress.slice(-4)}`
    : 'No wallet connected';

  const onConfirmReturn = async (payout) => {
    const id = payout.rental_code || payout.id;
    try {
      setActionLoadingId(id);
      await handleConfirmReturn(id);
      setActionToast({
        type: 'success',
        message: `Deal closed! Payout for ${payout.rental_code} settled to your wallet.`,
      });
      await fetchPaymentsData();
      setTimeout(() => setActionToast(null), 5000);
    } catch (err) {
      setActionToast({
        type: 'error',
        message: err.message || 'Failed to settle payout.',
      });
      setTimeout(() => setActionToast(null), 5000);
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="w-full max-w-full space-y-6 font-sans">
      {/* Toast Alert */}
      {actionToast && (
        <div
          className={`p-4 rounded-2xl flex items-center justify-between gap-3 shadow-md animate-in fade-in transition ${
            actionToast.type === 'success' ? 'bg-[#06372d] text-white' : 'bg-rose-600 text-white'
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

      {/* Main Area */}
      <div className="space-y-6 w-full max-w-full">
        {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-black text-gray-950 tracking-tight">Payments & Receipts</h1>
                <p className="text-xs text-gray-500 mt-0.5">
                  Direct on-chain property rent collections, tenant receipts, and vehicle rental escrow settlements.
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
                <button
                  type="button"
                  onClick={() => navigateTo('landlord-reconciliation')}
                  className="bg-[#06372d] hover:bg-[#09473b] text-white px-4 py-2 rounded-xl text-xs font-bold transition shadow-2xs hover:shadow-xs"
                >
                  Reconciliation
                </button>
              </div>
            </div>

            {/* 3 Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Property Rent Collected */}
              <div className="bg-white rounded-2xl border border-black/[0.04] p-5 shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:shadow-sm transition">
                <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Rent Collected</span>
                </div>
                <div className="text-2xl font-black text-[#06372d] font-mono mt-1">
                  {totalRentCollected.toFixed(2)} <span className="text-sm font-bold text-gray-500">USDC</span>
                </div>
                <div className="text-[11px] text-emerald-600 mt-1 flex items-center gap-1 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Verified on Stellar Horizon</span>
                </div>
              </div>

              {/* Vehicle Escrow Paid Out */}
              <div className="bg-white rounded-2xl border border-black/[0.04] p-5 shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:shadow-sm transition">
                <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Car className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Fleet Paid Out</span>
                </div>
                <div className="text-2xl font-black text-gray-950 font-mono mt-1">
                  {totalFleetEarned.toFixed(2)} <span className="text-sm font-bold text-gray-500">USDC</span>
                </div>
                <div className="text-[11px] text-gray-400 mt-1">
                  Pending: {pendingFleetPayout.toFixed(2)} USDC in escrow
                </div>
              </div>

              {/* Receiving Destination */}
              <div className="bg-white rounded-2xl border border-black/[0.04] p-5 shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:shadow-sm transition">
                <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                  Receiving Stellar Wallet
                </div>
                <div className="text-sm font-bold text-gray-900 font-mono mt-1 truncate">
                  {shortWallet}
                </div>
                <div className="text-[11px] text-gray-500 mt-1 flex items-center justify-between">
                  <span>Freighter (Testnet)</span>
                  {payoutWalletAddress && (
                    <a
                      href={`https://stellar.expert/explorer/testnet/account/${payoutWalletAddress}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-700 hover:underline flex items-center gap-0.5 font-semibold"
                    >
                      Explorer <ArrowUpRight className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* Category Switcher & Search Bar */}
            <div className="bg-white rounded-2xl border border-black/[0.04] p-4 shadow-[0_4px_20px_rgba(0,0,0,0.03)] space-y-3">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                {/* Category: All | Properties | Vehicles */}
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setCategoryTab('all')}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
                      categoryTab === 'all'
                        ? 'bg-[#06372d] text-white shadow-2xs'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    All Payments ({allPropertyPayments.length + allVehiclePayments.length})
                  </button>

                  <button
                    type="button"
                    onClick={() => setCategoryTab('properties')}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                      categoryTab === 'properties'
                        ? 'bg-[#06372d] text-white shadow-2xs'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <Building2 className="w-3.5 h-3.5" />
                    <span>Property Rent ({allPropertyPayments.length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCategoryTab('vehicles')}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                      categoryTab === 'vehicles'
                        ? 'bg-[#06372d] text-white shadow-2xs'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <Car className="w-3.5 h-3.5" />
                    <span>Vehicle Fleet ({allVehiclePayments.length})</span>
                  </button>
                </div>

                {/* Search */}
                <div className="relative w-full sm:w-64">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search reference, property, tenant..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 bg-gray-50/70 border border-black/[0.06] rounded-xl text-xs focus:bg-white focus:border-[#06372d] shadow-2xs outline-none transition"
                  />
                </div>
              </div>

              {/* Status Filter Sub-pills */}
              <div className="flex items-center gap-2 pt-1 border-t border-black/[0.03]">
                <span className="text-[11px] font-semibold text-gray-400 mr-1">Status:</span>
                {['All', 'Settled', 'Pending'].map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setFilterTab(tab)}
                    className={`px-3 py-0.5 rounded-full text-[11px] font-semibold transition ${
                      filterTab === tab
                        ? 'bg-gray-900 text-white'
                        : 'text-gray-600 hover:text-gray-900 bg-gray-50'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            {/* Payments Table */}
            {loading && combinedPayments.length === 0 ? (
              <div className="bg-white rounded-3xl border border-black/[0.04] p-12 text-center shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
                <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-xs font-semibold text-gray-500">Loading payments and collections...</p>
              </div>
            ) : combinedPayments.length > 0 ? (
              <div className="bg-white rounded-3xl border border-black/[0.04] shadow-[0_8px_30px_rgba(0,0,0,0.04)] overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-black/[0.04] bg-gray-50/50 text-gray-500 font-semibold uppercase tracking-wider text-[10px]">
                        <th className="py-3.5 px-5">Type & Reference</th>
                        <th className="py-3.5 px-5">Property / Vehicle & Payer</th>
                        <th className="py-3.5 px-5 text-right font-bold text-gray-900">Amount (USDC)</th>
                        <th className="py-3.5 px-5">Status</th>
                        <th className="py-3.5 px-5 text-right">Stellar Tx / Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/[0.04]">
                      {combinedPayments.map((p) => {
                        const isCompleted = (p.status || '').toUpperCase() === 'COMPLETED';
                        const isProperty = p.category === 'property';
                        const shortTx = p.tx_hash ? `${p.tx_hash.slice(0, 6)}...${p.tx_hash.slice(-4)}` : '';
                        const explorerUrl = p.tx_hash ? `https://stellar.expert/explorer/testnet/tx/${p.tx_hash}` : null;
                        const isLoading = actionLoadingId === p.rental_code || actionLoadingId === p.id;

                        return (
                          <tr key={`${p.category}-${p.id || p.rental_code}`} className="hover:bg-gray-50/50 transition">
                            <td className="py-3.5 px-5 font-mono">
                              <div className="flex items-center gap-1.5">
                                {isProperty ? (
                                  <span className="bg-emerald-100 text-[#06372d] text-[10px] font-bold px-1.5 py-0.5 rounded">
                                    RENT
                                  </span>
                                ) : (
                                  <span className="bg-blue-100 text-blue-900 text-[10px] font-bold px-1.5 py-0.5 rounded">
                                    CAR
                                  </span>
                                )}
                                <span className="font-bold text-gray-900">{p.rental_code}</span>
                              </div>
                              <div className="text-[10px] text-gray-400 mt-0.5">
                                {p.created_at ? new Date(p.created_at).toLocaleDateString() : 'Recent'}
                              </div>
                            </td>

                            <td className="py-3.5 px-5 text-gray-700">
                              <div className="font-semibold text-gray-950 flex items-center gap-1.5">
                                <span>{p.title}</span>
                              </div>
                              <div className="text-[11px] text-gray-500">
                                {isProperty ? 'Tenant: ' : 'Renter: '}
                                <strong className="text-gray-800">{p.party}</strong>
                              </div>
                            </td>

                            <td className="py-3.5 px-5 text-right font-mono font-black text-[#06372d] text-sm">
                              +{Number(p.net_usdc || 0).toFixed(2)} USDC
                            </td>

                            <td className="py-3.5 px-5">
                              <span
                                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                                  isCompleted
                                    ? 'bg-emerald-100/80 text-[#06372d]'
                                    : 'bg-amber-100/80 text-amber-900'
                                }`}
                              >
                                {isCompleted ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                                <span>{isCompleted ? (isProperty ? 'Confirmed' : 'Settled') : 'Pending'}</span>
                              </span>
                            </td>

                            <td className="py-3.5 px-5 text-right font-mono text-[11px]">
                              <div className="flex items-center justify-end gap-2">
                                {explorerUrl && (
                                  <a
                                    href={explorerUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-emerald-700 hover:underline inline-flex items-center gap-1 font-semibold"
                                  >
                                    <span>{shortTx}</span>
                                    <ExternalLink className="w-3 h-3" />
                                  </a>
                                )}

                                {isProperty && p.receipt_id && (
                                  <button
                                    type="button"
                                    onClick={() => handleDownloadPdf(p.receipt_id)}
                                    className="p-1 text-gray-500 hover:text-emerald-700 rounded hover:bg-gray-100 transition"
                                    title="Download PDF Receipt"
                                  >
                                    <Download className="w-3.5 h-3.5" />
                                  </button>
                                )}

                                {!isProperty && !isCompleted && (
                                  <button
                                    type="button"
                                    onClick={() => onConfirmReturn(p)}
                                    disabled={isLoading}
                                    className="bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white px-3 py-1 rounded-lg text-[11px] font-bold transition shadow-2xs hover:shadow-xs inline-flex items-center gap-1"
                                  >
                                    {isLoading ? (
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : (
                                      <CheckCircle className="w-3 h-3" />
                                    )}
                                    <span>Close Deal</span>
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-3xl border border-black/[0.04] p-12 text-center max-w-lg mx-auto shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
                <div className="w-14 h-14 rounded-full bg-emerald-50 text-[#06372d] flex items-center justify-center mx-auto mb-4">
                  <Receipt className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-gray-900 mb-1">
                  No payment records found
                </h3>
                <p className="text-xs text-gray-500 max-w-sm mx-auto mb-6">
                  {categoryTab === 'properties'
                    ? 'When tenants pay rent obligations via Stellar, verified receipts and collections appear here.'
                    : 'Payments appear here in real time as renters book your vehicles and settlements complete.'}
                </p>
                <div className="flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => navigateTo('landlord-properties')}
                    className="bg-[#06372d] hover:bg-[#09473b] text-white px-5 py-2.5 rounded-xl text-xs font-bold transition shadow-2xs hover:shadow-xs"
                  >
                    View Properties
                  </button>
                  <button
                    type="button"
                    onClick={() => navigateTo('host-vehicles')}
                    className="bg-white border border-black/[0.06] hover:bg-gray-50 text-gray-800 px-4 py-2.5 rounded-xl text-xs font-semibold transition shadow-2xs"
                  >
                    View Vehicles
                  </button>
                </div>
              </div>
            )}
          </div>
    </div>
  );
}
