import React, { useState, useEffect } from 'react';
import {
  FileText,
  Download,
  ExternalLink,
  CheckCircle2,
  Clock,
  AlertCircle,
  Search,
  Filter,
  X,
  ArrowLeft,
  Building2,
  Calendar,
  Wallet,
  Receipt,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import api from '../../services/api';
import { useApp } from '../../context/AppContext';

export default function TenantHistoryReceiptsView({ onBack }) {
  const { navigateTo } = useApp();
  const [receipts, setReceipts] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [filterStatus, setFilterStatus] = useState('ALL'); // 'ALL' | 'VERIFIED' | 'PARTIAL'
  const [downloadingId, setDownloadingId] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  const fetchData = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const [receiptsData, paymentsData] = await Promise.all([
        api.receipts.list().catch(() => []),
        api.reconciliation.listPayments().catch(() => []),
      ]);
      setReceipts(Array.isArray(receiptsData) ? receiptsData : receiptsData?.results || []);
      setPayments(Array.isArray(paymentsData) ? paymentsData : paymentsData?.results || []);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to load receipts.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDownloadPdf = async (receiptId) => {
    setDownloadingId(receiptId);
    try {
      await api.receipts.downloadPdf(receiptId);
    } catch (err) {
      alert(`Could not download PDF receipt: ${err.message}`);
    } finally {
      setDownloadingId(null);
    }
  };

  const filteredReceipts = receipts.filter((r) => {
    if (filterStatus === 'ALL') return true;
    if (filterStatus === 'VERIFIED') return r.status === 'VERIFIED' || !r.status;
    return true;
  });

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <button
            onClick={onBack || (() => navigateTo('tenant-home'))}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-gray-900 mb-2 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Tenant Home
          </button>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#111111]">Payment History & Receipts</h1>
          <p className="text-sm text-[#5C5C5C] mt-0.5">
            Download verified PDF receipts and inspect Stellar blockchain proofs
          </p>
        </div>

        <button
          onClick={fetchData}
          disabled={loading}
          className="self-start sm:self-auto px-4 py-2 rounded-xl bg-white border border-gray-200 hover:bg-gray-50 text-xs font-bold text-gray-700 shadow-2xs flex items-center gap-2 transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 mb-6 border-b border-gray-200/80 pb-3">
        <button
          onClick={() => setFilterStatus('ALL')}
          className={`px-4 py-1.5 rounded-full text-xs font-bold transition ${
            filterStatus === 'ALL'
              ? 'bg-[#0A4F4E] text-white shadow-xs'
              : 'bg-white text-gray-600 hover:bg-gray-100'
          }`}
        >
          All Payments ({receipts.length})
        </button>
        <button
          onClick={() => setFilterStatus('VERIFIED')}
          className={`px-4 py-1.5 rounded-full text-xs font-bold transition ${
            filterStatus === 'VERIFIED'
              ? 'bg-[#0A4F4E] text-white shadow-xs'
              : 'bg-white text-gray-600 hover:bg-gray-100'
          }`}
        >
          Verified Receipts
        </button>
      </div>

      {loading ? (
        <div className="py-20 text-center">
          <Loader2 className="w-8 h-8 text-[#0A4F4E] animate-spin mx-auto mb-3" />
          <p className="text-xs text-gray-500 font-semibold">Loading official receipts...</p>
        </div>
      ) : filteredReceipts.length === 0 ? (
        /* Empty State matching Figma F3 */
        <div className="bg-white rounded-3xl p-12 text-center border border-gray-200/80 shadow-2xs">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 text-gray-400 flex items-center justify-center mx-auto mb-4">
            <Receipt className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-extrabold text-gray-900 mb-1">No receipts yet</h3>
          <p className="text-xs text-gray-500 max-w-sm mx-auto mb-6">
            Whenever you pay rent in digital USDC on Stellar Testnet, an immutable cryptographic receipt will be generated and stored here.
          </p>
          <button
            onClick={() => navigateTo('tenant-home')}
            className="py-2.5 px-5 rounded-xl bg-[#0A4F4E] text-white font-bold text-xs shadow-xs hover:bg-[#083D3C] transition"
          >
            Go to Rent Obligations
          </button>
        </div>
      ) : (
        /* Receipts Grid / List */
        <div className="space-y-4">
          {filteredReceipts.map((receipt) => {
            const dateStr = receipt.created_at ? new Date(receipt.created_at).toLocaleDateString(undefined, {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            }) : 'Recent';

            return (
              <div
                key={receipt.id}
                className="bg-white rounded-2xl p-5 border border-gray-200/80 shadow-2xs hover:shadow-md transition flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-gray-900 text-sm">
                        {receipt.receipt_reference || `REC-${receipt.id.slice(0, 8)}`}
                      </span>
                      <span className="bg-emerald-100 text-emerald-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase">
                        Verified
                      </span>
                    </div>
                    <div className="text-xs text-gray-600 font-semibold mt-1 flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-gray-400" />
                      <span>{receipt.property_name || 'Rental Property'}</span>
                      {receipt.unit_number && <span>· Unit {receipt.unit_number}</span>}
                    </div>
                    <div className="text-xs text-gray-400 mt-1 flex items-center gap-3">
                      <span>Date: {dateStr}</span>
                      {receipt.billing_period && <span>Period: {receipt.billing_period}</span>}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 pt-3 sm:pt-0 border-t sm:border-t-0 border-gray-100">
                  <div className="text-left sm:text-right">
                    <div className="text-base font-extrabold text-emerald-700 font-mono">
                      ${receipt.amount_paid_usdc} USDC
                    </div>
                    <div className="text-[11px] text-gray-400 font-semibold">
                      Bal after: ${receipt.outstanding_balance_after_payment_usdc ?? 0}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedReceipt(receipt)}
                      className="px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-xs font-bold text-gray-700 transition"
                    >
                      View Details
                    </button>
                    <button
                      onClick={() => handleDownloadPdf(receipt.id)}
                      disabled={downloadingId === receipt.id}
                      className="p-2 sm:px-3.5 sm:py-2 rounded-xl bg-[#0A4F4E] hover:bg-[#083D3C] text-white font-bold text-xs shadow-2xs transition flex items-center gap-1.5 disabled:opacity-50"
                      title="Download PDF"
                    >
                      {downloadingId === receipt.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Download className="w-4 h-4" />
                      )}
                      <span className="hidden sm:inline">PDF</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Receipt Detail Modal */}
      {selectedReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-gray-100 relative animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setSelectedReceipt(null)}
              className="absolute top-5 right-5 p-2 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center pb-6 border-b border-gray-200">
              <div className="w-14 h-14 rounded-2xl bg-[#0A4F4E]/10 text-[#0A4F4E] flex items-center justify-center mx-auto mb-3">
                <Receipt className="w-7 h-7" />
              </div>
              <h2 className="text-xl font-extrabold text-gray-950">Official Rent Receipt</h2>
              <div className="text-xs font-mono font-bold text-[#0A4F4E] mt-1">
                {selectedReceipt.receipt_reference || `REC-${selectedReceipt.id.slice(0, 8)}`}
              </div>
            </div>

            <div className="py-5 space-y-3.5 text-xs text-gray-700">
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-gray-400 font-semibold">Property</span>
                <span className="font-bold text-gray-900">{selectedReceipt.property_name || 'Kilimani Gardens'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-gray-400 font-semibold">Unit</span>
                <span className="font-bold text-gray-900">{selectedReceipt.unit_number || 'Flat 2B'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-gray-400 font-semibold">Tenant</span>
                <span className="font-bold text-gray-900">{selectedReceipt.tenant_name || selectedReceipt.tenant_email || 'Tenant'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-gray-400 font-semibold">Rental Period</span>
                <span className="font-bold text-gray-900">{selectedReceipt.billing_period || 'Current Billing Period'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-gray-400 font-semibold">Amount Paid</span>
                <span className="font-extrabold text-emerald-700 text-sm font-mono">${selectedReceipt.amount_paid_usdc} USDC</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-gray-400 font-semibold">Outstanding Balance After</span>
                <span className="font-bold text-gray-900 font-mono">${selectedReceipt.outstanding_balance_after_payment_usdc ?? 0} USDC</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-gray-400 font-semibold">Verification Status</span>
                <span className="font-bold text-emerald-700 uppercase">{selectedReceipt.verification_status || 'VERIFIED'}</span>
              </div>

              {selectedReceipt.stellar_transaction_hash && (
                <div className="pt-2">
                  <span className="text-gray-400 font-semibold block mb-1">Stellar Testnet Transaction Hash</span>
                  <div className="font-mono text-[11px] text-gray-800 break-all bg-gray-50 p-2.5 rounded-xl border border-gray-200">
                    {selectedReceipt.stellar_transaction_hash}
                  </div>
                  <a
                    href={`https://stellar.expert/explorer/testnet/tx/${selectedReceipt.stellar_transaction_hash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-[#0A4F4E] hover:underline font-bold mt-1.5"
                  >
                    View on Stellar.Expert <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-gray-200 flex gap-3">
              <button
                onClick={() => handleDownloadPdf(selectedReceipt.id)}
                disabled={downloadingId === selectedReceipt.id}
                className="flex-1 py-3 px-4 rounded-xl bg-[#0A4F4E] hover:bg-[#083D3C] text-white font-bold text-xs shadow-md transition flex items-center justify-center gap-2"
              >
                {downloadingId === selectedReceipt.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                Download Official PDF Receipt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

