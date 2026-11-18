import React, { useState, useEffect } from 'react';
import {
  X,
  CreditCard,
  Wallet,
  Copy,
  Check,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ArrowRight,
  ShieldCheck,
  FileText,
} from 'lucide-react';
import api from '../../services/api';
import { useApp } from '../../context/AppContext';

export default function TenantPayModal({ isOpen, onClose, obligation, onSuccess }) {
  const { connectedWallet, handleConnectWallet } = useApp();

  const [payType, setPayType] = useState('full'); // 'full' | 'partial'
  const [customAmount, setCustomAmount] = useState('');
  const [step, setStep] = useState('select_amount'); // 'select_amount' | 'stellar_details' | 'confirming' | 'success' | 'failed'
  const [paymentRequest, setPaymentRequest] = useState(null);
  const [loading, setLoading] = useState(false);
  const [txHashInput, setTxHashInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [copiedMemo, setCopiedMemo] = useState(false);
  const [reconciliationResult, setReconciliationResult] = useState(null);

  const outstanding = Number(obligation?.outstanding_balance_usdc || obligation?.amount_due_usdc || 0);

  useEffect(() => {
    if (isOpen) {
      setStep('select_amount');
      setPayType('full');
      setCustomAmount('');
      setErrorMsg('');
      setTxHashInput('');
      setReconciliationResult(null);
    }
  }, [isOpen, obligation]);

  if (!isOpen || !obligation) return null;

  const targetAmount = payType === 'full' ? outstanding : Number(customAmount) || 0;

  // Step 1 -> Step 2: Generate / fetch payment request with memo
  const handleProceedToPayment = async () => {
    if (payType === 'partial' && (targetAmount <= 0 || targetAmount > outstanding)) {
      setErrorMsg(`Please enter an amount between 1 and ${outstanding} USDC.`);
      return;
    }
    setErrorMsg('');
    setLoading(true);
    try {
      const res = await api.obligations.createPaymentRequest(obligation.id, targetAmount);
      setPaymentRequest(res);
      setStep('stellar_details');
    } catch (err) {
      setErrorMsg(err.message || 'Failed to initiate payment request.');
    } finally {
      setLoading(false);
    }
  };

  // Reconcile Stellar transaction hash
  const handleVerifyTransaction = async (hashToVerify) => {
    const hash = (hashToVerify || txHashInput).trim();
    if (!hash || hash.length !== 64) {
      setErrorMsg('Please enter a valid 64-character Stellar transaction hash.');
      return;
    }
    setErrorMsg('');
    setLoading(true);
    setStep('confirming');

    try {
      const res = await api.reconciliation.verifyTransaction(hash);
      setReconciliationResult(res);
      setStep('success');
      if (onSuccess) onSuccess(res);
    } catch (err) {
      setErrorMsg(err.message || 'Transaction verification failed. Ensure the payment was sent on Stellar Testnet with the correct memo.');
      setStep('failed');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text, type) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      if (type === 'address') {
        setCopiedAddress(true);
        setTimeout(() => setCopiedAddress(false), 2000);
      } else {
        setCopiedMemo(true);
        setTimeout(() => setCopiedMemo(false), 2000);
      }
    }
  };

  const receivingWallet = paymentRequest?.receiving_wallet || obligation?.receiving_wallet || 'GC2R34KLSLB2UMOOTPAJ7PGJUHVPYVP77DR27DZCD5CWRD3K7MQOEKLT';
  const memoText = paymentRequest?.payment_memo || paymentRequest?.memo_text || obligation?.payment_memo || obligation?.obligation_reference || `OBL-${obligation?.id?.slice(0, 8)}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-gray-100 relative animate-in fade-in zoom-in-95 duration-200">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* STEP 1: Select Amount */}
        {step === 'select_amount' && (
          <div>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-2xl bg-[#0A4F4E]/10 flex items-center justify-center text-[#0A4F4E]">
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-extrabold text-[#111111]">Pay Rent in USDC</h2>
                <p className="text-xs text-gray-500">
                  {obligation?.property_name || 'Property'} · {obligation?.unit_number ? `Unit ${obligation.unit_number}` : ''}
                </p>
              </div>
            </div>

            {errorMsg && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="p-4 rounded-2xl bg-[#F2F7F7] border border-gray-200/80 mb-5">
              <div className="text-xs text-gray-500 font-semibold mb-1">Total Outstanding Rent</div>
              <div className="text-3xl font-black text-[#111111]">{outstanding.toFixed(2)} <span className="text-lg font-bold text-gray-600">USDC</span></div>
              <div className="text-xs text-gray-400 mt-1">Period: {obligation?.billing_period_start} to {obligation?.billing_period_end}</div>
            </div>

            <div className="space-y-3 mb-6">
              <label className="text-xs font-bold text-gray-700 block">Choose Payment Option</label>

              {/* Full payment card */}
              <div
                onClick={() => setPayType('full')}
                className={`p-4 rounded-2xl border-2 cursor-pointer transition flex items-center justify-between ${
                  payType === 'full' ? 'border-[#0A4F4E] bg-[#0A4F4E]/5' : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div>
                  <div className="font-bold text-sm text-gray-900">Pay Full Outstanding Balance</div>
                  <div className="text-xs text-gray-500">Settles this obligation in full</div>
                </div>
                <div className="text-base font-extrabold text-[#0A4F4E]">${outstanding.toFixed(2)} USDC</div>
              </div>

              {/* Partial instalment card */}
              <div
                onClick={() => setPayType('partial')}
                className={`p-4 rounded-2xl border-2 cursor-pointer transition ${
                  payType === 'partial' ? 'border-[#0A4F4E] bg-[#0A4F4E]/5' : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="font-bold text-sm text-gray-900">Pay Custom Instalment (Partial)</div>
                  <span className="text-xs font-bold text-amber-700 bg-amber-100 px-2.5 py-0.5 rounded-full">Flexible</span>
                </div>
                {payType === 'partial' && (
                  <div className="mt-3">
                    <div className="relative">
                      <input
                        type="number"
                        placeholder="Enter amount (e.g. 250)"
                        value={customAmount}
                        onChange={(e) => setCustomAmount(e.target.value)}
                        className="w-full pl-4 pr-16 py-2.5 rounded-xl border border-gray-300 focus:border-[#0A4F4E] focus:ring-2 focus:ring-[#0A4F4E]/20 outline-none text-sm font-bold text-gray-900"
                        min="1"
                        max={outstanding}
                      />
                      <span className="absolute right-3.5 top-2.5 text-xs font-extrabold text-gray-400">USDC</span>
                    </div>
                    {customAmount && Number(customAmount) > 0 && (
                      <div className="text-xs text-gray-500 mt-2">
                        Remaining balance after payment: <strong className="text-gray-900">${Math.max(0, outstanding - Number(customAmount)).toFixed(2)} USDC</strong>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={handleProceedToPayment}
              disabled={loading || (payType === 'partial' && (!customAmount || Number(customAmount) <= 0))}
              className="w-full py-3.5 px-4 rounded-xl bg-[#0A4F4E] hover:bg-[#083D3C] text-white font-bold text-sm shadow-md transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating Request...
                </>
              ) : (
                <>
                  Continue to Stellar Payment (${targetAmount.toFixed(2)} USDC)
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        )}

        {/* STEP 2: Stellar Payment Details & Verification */}
        {step === 'stellar_details' && (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-[#0A4F4E]/10 flex items-center justify-center text-[#0A4F4E]">
                <Wallet className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-extrabold text-[#111111]">Send Stellar Payment</h2>
                <p className="text-xs text-gray-500">Pay on Stellar Testnet in digital USDC</p>
              </div>
            </div>

            {errorMsg && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="space-y-3 mb-5 text-sm">
              {/* Payment Amount Card */}
              <div className="p-3.5 rounded-2xl bg-[#0A4F4E]/5 border border-[#0A4F4E]/20 flex items-center justify-between">
                <div>
                  <span className="text-xs text-gray-500 font-semibold">Amount to Send</span>
                  <div className="text-2xl font-black text-[#0A4F4E]">{targetAmount.toFixed(2)} USDC</div>
                </div>
                <div className="text-right">
                  <span className="text-[11px] font-bold text-gray-400 uppercase">Network</span>
                  <div className="text-xs font-bold text-gray-800">Stellar Testnet</div>
                </div>
              </div>

              {/* Receiving Address */}
              <div className="p-3 rounded-xl border border-gray-200 bg-gray-50">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-gray-500">Landlord Receiving Wallet</span>
                  <button
                    onClick={() => copyToClipboard(receivingWallet, 'address')}
                    className="text-xs font-semibold text-[#0A4F4E] hover:underline flex items-center gap-1"
                  >
                    {copiedAddress ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedAddress ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <div className="font-mono text-xs text-gray-800 break-all select-all font-semibold">
                  {receivingWallet}
                </div>
              </div>

              {/* Required Memo */}
              <div className="p-3 rounded-xl border border-amber-200 bg-amber-50/60">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-amber-900">Required Memo (MEMO_TEXT)</span>
                  <button
                    onClick={() => copyToClipboard(memoText, 'memo')}
                    className="text-xs font-semibold text-amber-900 hover:underline flex items-center gap-1"
                  >
                    {copiedMemo ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedMemo ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <div className="font-mono text-xs text-amber-950 font-bold select-all">
                  {memoText}
                </div>
                <p className="text-[11px] text-amber-800 mt-1">
                  * Important: Always attach this memo so the payment is automatically credited to your rental obligation.
                </p>
              </div>

              {/* Transaction Hash Input */}
              <div className="pt-2">
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Already paid? Paste Stellar Transaction Hash:
                </label>
                <input
                  type="text"
                  placeholder="e.g. 5241b71d6044ea746ef8148b59df95b348d6bb5e56e0..."
                  value={txHashInput}
                  onChange={(e) => setTxHashInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 focus:border-[#0A4F4E] focus:ring-2 focus:ring-[#0A4F4E]/20 outline-none text-xs font-mono text-gray-900"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setStep('select_amount')}
                className="py-3 px-4 rounded-xl border border-gray-200 hover:bg-gray-100 font-bold text-xs text-gray-700 transition"
              >
                Back
              </button>
              <button
                onClick={() => handleVerifyTransaction()}
                disabled={loading || !txHashInput.trim()}
                className="flex-1 py-3 px-4 rounded-xl bg-[#0A4F4E] hover:bg-[#083D3C] text-white font-bold text-sm shadow-md transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                Verify & Settle Payment
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Confirming / Polling Horizon */}
        {step === 'confirming' && (
          <div className="py-12 text-center">
            <Loader2 className="w-12 h-12 text-[#0A4F4E] animate-spin mx-auto mb-4" />
            <h3 className="text-lg font-extrabold text-gray-900 mb-2">Verifying on Stellar Horizon...</h3>
            <p className="text-xs text-gray-500 max-w-xs mx-auto">
              Extracting payment operations, verifying destination address, matching memo, and deducting balance.
            </p>
          </div>
        )}

        {/* STEP 4: Success / Payment Received (F2 Step 4) */}
        {step === 'success' && (
          <div className="text-center py-4">
            <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-black text-gray-950 mb-1">Payment Received!</h3>
            <p className="text-xs text-gray-500 mb-5">
              Your rent payment was verified and credited on Stellar Testnet.
            </p>

            <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200 text-left space-y-2 mb-6 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">Amount Paid:</span>
                <strong className="text-emerald-700 font-mono text-sm">${reconciliationResult?.amount_paid_usdc || targetAmount} USDC</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Remaining Balance:</span>
                <strong className="text-gray-900 font-mono text-sm">${reconciliationResult?.remaining_balance_usdc ?? 0} USDC</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">New Status:</span>
                <span className="font-extrabold text-[#0A4F4E] uppercase">{reconciliationResult?.status || 'VERIFIED'}</span>
              </div>
              {reconciliationResult?.tx_hash && (
                <div className="pt-2 border-t border-gray-200">
                  <a
                    href={`https://stellar.expert/explorer/testnet/tx/${reconciliationResult.tx_hash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#0A4F4E] hover:underline flex items-center gap-1 font-mono text-[11px]"
                  >
                    View on Stellar.Expert <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-3 px-4 rounded-xl bg-[#0A4F4E] hover:bg-[#083D3C] text-white font-bold text-sm shadow-md transition"
              >
                Done
              </button>
            </div>
          </div>
        )}

        {/* STEP 5: Failed */}
        {step === 'failed' && (
          <div className="text-center py-4">
            <div className="w-14 h-14 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-black text-gray-950 mb-1">Verification Failed</h3>
            <p className="text-xs text-rose-600 mb-6 max-w-sm mx-auto">
              {errorMsg || 'Could not verify the transaction on Stellar Testnet.'}
            </p>

            <div className="flex gap-2">
              <button
                onClick={() => setStep('stellar_details')}
                className="flex-1 py-3 px-4 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold text-sm transition"
              >
                Try Again
              </button>
              <button
                onClick={onClose}
                className="flex-1 py-3 px-4 rounded-xl bg-gray-900 hover:bg-black text-white font-bold text-sm transition"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

