import React, { useState, useEffect, useRef } from 'react';
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
  Building,
  RefreshCw,
} from 'lucide-react';
import api from '../../services/api';
import { useApp } from '../../context/AppContext';
import { connectWallet, signTransaction, getConnectedAddress } from '../../services/stellarWallet';

export default function TenantPayModal({ isOpen, onClose, obligation, onSuccess }) {
  const { connectedWallet } = useApp();

  const [payType, setPayType] = useState('full'); // 'full' | 'partial'
  const [customAmount, setCustomAmount] = useState('');
  const [step, setStep] = useState('select_amount'); // 'select_amount' | 'signing' | 'manual_hash' | 'confirming' | 'success' | 'failed'
  const [paymentRequest, setPaymentRequest] = useState(null);
  const [loading, setLoading] = useState(false);
  const [signingStatus, setSigningStatus] = useState('');
  const [txHashInput, setTxHashInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [copiedMemo, setCopiedMemo] = useState(false);
  const [reconciliationResult, setReconciliationResult] = useState(null);

  const outstanding = Number(obligation?.outstanding_balance_usdc || obligation?.amount_due_usdc || 0);

  // Prevent background re-renders from resetting the modal while it is open
  const wasOpenRef = useRef(false);
  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      setStep('select_amount');
      setPayType('full');
      setCustomAmount('');
      setErrorMsg('');
      setSigningStatus('');
      setTxHashInput('');
      setReconciliationResult(null);
      setPaymentRequest(null);
    }
    wasOpenRef.current = isOpen;
  }, [isOpen]);

  if (!isOpen || !obligation) return null;

  const targetAmount = payType === 'full' ? outstanding : Number(customAmount) || 0;

  const receivingWallet =
    paymentRequest?.receiving_wallet ||
    obligation?.receiving_wallet ||
    'GAPSKIPMRDLTFEKHV6VQKKMDUUIX2I56YVURD62KIYJ6Y6EJSOTP2ZWK';

  const memoText =
    paymentRequest?.payment_memo ||
    paymentRequest?.memo_text ||
    obligation?.payment_memo ||
    obligation?.obligation_reference ||
    `OBL-${obligation?.id?.slice(0, 8)}`;

  // TRIGGER TRANSACTION SIGNING IN FREIGHTER WALLET
  const handleSignAndPay = async () => {
    if (payType === 'partial' && (targetAmount <= 0 || targetAmount > outstanding)) {
      setErrorMsg(`Please enter an amount between 1 and ${outstanding} USDC.`);
      return;
    }
    setErrorMsg('');
    setStep('signing');
    setLoading(true);

    try {
      // 1. Get or request connected wallet address
      setSigningStatus('Connecting to Freighter extension...');
      let address = connectedWallet?.address || getConnectedAddress();

      if (typeof window !== 'undefined' && window.freighterApi) {
        try {
          if (typeof window.freighterApi.requestAccess === 'function') {
            const acc = await window.freighterApi.requestAccess();
            if (typeof acc === 'string') address = acc;
            else if (acc?.address) address = acc.address;
          }
          if (!address && typeof window.freighterApi.getPublicKey === 'function') {
            const pk = await window.freighterApi.getPublicKey();
            if (typeof pk === 'string') address = pk;
            else if (pk?.address) address = pk.address;
          }
        } catch (fErr) {
          console.warn('Direct Freighter access check:', fErr);
        }
      }

      if (!address) {
        const connResult = await connectWallet('freighter', false);
        if (connResult?.address) {
          address = connResult.address;
        }
      }

      if (!address) {
        throw new Error(
          'Freighter wallet extension was not detected or permission was not granted. Please install or unlock Freighter, or choose "Verify payment by entering transaction hash" below.'
        );
      }

      // 2. Request backend to create payment request and build Stellar transaction XDR
      setSigningStatus('Preparing payment transaction for property owner address...');
      const reqRes = await api.obligations.createPaymentRequest(obligation.id, targetAmount, address);
      setPaymentRequest(reqRes);

      let txXdr = reqRes?.transaction_xdr;
      const networkPassphrase = reqRes?.network_passphrase || 'Test SDF Network ; September 2015';

      if (!txXdr) {
        // Fallback to prepare-transaction endpoint if needed
        const prepRes = await api.obligations.prepareTransaction(obligation.id, address, targetAmount);
        txXdr = prepRes?.transaction_xdr;
      }

      if (!txXdr) {
        throw new Error('Could not build Stellar transaction XDR for this obligation.');
      }

      // 3. TRIGGER WALLET SIGNING POPUP!
      // This actively invokes Freighter extension popup (window.freighterApi.signTransaction)
      setSigningStatus('Opening Freighter wallet popup... Please approve the transaction to send payment to the property owner.');
      const signResult = await signTransaction(txXdr, networkPassphrase);

      if (!signResult.success) {
        throw new Error(
          signResult.error ||
            'Transaction signing was cancelled or rejected in Freighter wallet.'
        );
      }

      const signedXdr = signResult.signedTxXdr || txXdr;

      // 4. Submit signed transaction to Stellar Testnet Horizon
      setSigningStatus('Submitting signed transaction to Stellar Testnet Horizon...');
      let finalTxHash = null;

      try {
        const horizonRes = await fetch('https://horizon-testnet.stellar.org/transactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ tx: signedXdr }).toString(),
        });
        const horizonData = await horizonRes.json();

        if (horizonRes.ok && horizonData.hash) {
          finalTxHash = horizonData.hash;
        } else {
          const detail =
            horizonData?.extras?.result_codes?.transaction ||
            horizonData?.detail ||
            horizonData?.title ||
            'Stellar Horizon rejected transaction.';
          console.warn('Horizon submit issue:', horizonData);
          throw new Error(`Stellar Horizon error: ${detail}`);
        }
      } catch (hErr) {
        throw new Error(hErr.message || 'Failed to broadcast transaction to Stellar network.');
      }

      if (!finalTxHash) {
        throw new Error('Did not receive transaction hash from Stellar Testnet.');
      }

      // 5. Automatically reconcile with PayarMove backend and generate receipt
      setSigningStatus('Transaction confirmed on-chain! Reconciling obligation and generating receipt...');
      const oblRef = obligation?.obligation_reference || obligation?.obligationReference || obligation?.obligation_ref || '';
      const reconcileRes = await api.reconciliation.verifyTransaction(finalTxHash, oblRef);
      setReconciliationResult(reconcileRes);
      setStep('success');
    } catch (err) {
      console.error('Wallet payment error:', err);
      setErrorMsg(err.message || 'Payment or signing failed.');
      setStep('failed');
    } finally {
      setLoading(false);
    }
  };

  // Reconcile Stellar transaction hash manually
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
      const oblRef = obligation?.obligation_reference || obligation?.obligationReference || obligation?.obligation_ref || '';
      const res = await api.reconciliation.verifyTransaction(hash, oblRef);
      setReconciliationResult(res);
      setStep('success');
    } catch (err) {
      setErrorMsg(
        err.message ||
          'Transaction verification failed. Ensure the payment was sent on Stellar Testnet to the property owner address with the required memo.'
      );
      setStep('failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDone = () => {
    if (onSuccess && reconciliationResult) {
      onSuccess(reconciliationResult);
    }
    onClose();
  };

  const handleClose = () => {
    if (step === 'success' && onSuccess && reconciliationResult) {
      onSuccess(reconciliationResult);
    }
    onClose();
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-gray-100 relative animate-in fade-in zoom-in-95 duration-200">
        <button
          onClick={handleClose}
          className="absolute top-5 right-5 p-2 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* STEP 1: Select Amount & Initiate Payment */}
        {step === 'select_amount' && (
          <div>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-2xl bg-[#0A4F4E]/10 flex items-center justify-center text-[#0A4F4E]">
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-extrabold text-[#111111]">Pay Rent with Stellar</h2>
                <p className="text-xs text-gray-500">
                  {obligation?.property_name || 'Property'} {obligation?.unit_number ? `· Unit ${obligation.unit_number}` : ''}
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
              <div className="text-3xl font-black text-[#111111]">
                {outstanding.toFixed(2)} <span className="text-lg font-bold text-gray-600">USDC</span>
              </div>
              <div className="text-xs text-gray-400 mt-1">
                Period: {obligation?.period_start_date || obligation?.billing_period_start} to {obligation?.period_end_date || obligation?.billing_period_end}
              </div>
            </div>

            {/* Property Owner Wallet Card */}
            <div className="p-3.5 rounded-2xl bg-gray-50 border border-gray-200 mb-5 text-xs">
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-bold text-gray-700 flex items-center gap-1.5">
                  <Building className="w-3.5 h-3.5 text-[#0A4F4E]" />
                  Property Owner Address (Destination):
                </span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(receivingWallet, 'address')}
                  className="text-xs font-semibold text-[#0A4F4E] hover:underline flex items-center gap-1"
                >
                  {copiedAddress ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedAddress ? 'Copied' : 'Copy'}
                </button>
              </div>
              <div className="font-mono text-[11px] text-gray-800 break-all select-all font-semibold bg-white p-2 rounded-xl border border-gray-200">
                {receivingWallet}
              </div>
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
                  <div className="font-bold text-sm text-gray-900">Pay Full Balance</div>
                  <div className="text-xs text-gray-500">Settles this rental obligation in full</div>
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

            {/* Primary Action: Trigger Wallet Transaction Signing */}
            <button
              onClick={handleSignAndPay}
              disabled={loading || (payType === 'partial' && (!customAmount || Number(customAmount) <= 0))}
              className="w-full py-4 px-4 rounded-2xl bg-[#0A4F4E] hover:bg-[#083D3C] text-white font-extrabold text-sm shadow-lg shadow-[#0A4F4E]/25 transition flex items-center justify-center gap-2.5 disabled:opacity-50 cursor-pointer"
            >
              <Wallet className="w-5 h-5 text-emerald-300" />
              <span>Sign & Pay with Wallet (${targetAmount.toFixed(2)} USDC)</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            {/* Secondary Option: Verify by entering transaction hash */}
            <div className="mt-4 pt-4 border-t border-gray-100 text-center">
              <button
                type="button"
                onClick={() => {
                  setErrorMsg('');
                  setStep('manual_hash');
                }}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-[#0A4F4E] transition cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4 text-gray-400" />
                <span>Paid from another wallet? <strong className="text-[#0A4F4E] underline">Verify payment by entering transaction hash</strong></span>
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: Active Wallet Signing Popup State */}
        {step === 'signing' && (
          <div className="py-10 text-center">
            <div className="w-16 h-16 rounded-3xl bg-[#0A4F4E]/10 text-[#0A4F4E] flex items-center justify-center mx-auto mb-4 animate-pulse">
              <Wallet className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-black text-gray-900 mb-2">Triggering Wallet Transaction Signing</h3>
            <p className="text-xs text-gray-600 max-w-sm mx-auto mb-6 leading-relaxed">
              {signingStatus || 'Opening wallet popup. Please confirm and sign the payment to the property owner address in Freighter.'}
            </p>

            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-left space-y-2 mb-6 text-xs max-w-sm mx-auto">
              <div className="flex justify-between">
                <span className="text-amber-800 font-semibold">Payment Destination:</span>
                <span className="font-mono text-gray-900 font-bold">{receivingWallet.slice(0, 6)}...{receivingWallet.slice(-6)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-amber-800 font-semibold">Amount to Send:</span>
                <span className="font-bold text-gray-900">${targetAmount.toFixed(2)} USDC</span>
              </div>
              <div className="flex justify-between">
                <span className="text-amber-800 font-semibold">Attached Memo:</span>
                <span className="font-mono text-gray-900 font-bold">{memoText}</span>
              </div>
            </div>

            <div className="flex items-center justify-center gap-2 text-xs text-gray-400">
              <Loader2 className="w-4 h-4 animate-spin text-[#0A4F4E]" />
              <span>Awaiting Freighter signature...</span>
            </div>
          </div>
        )}

        {/* STEP 3: Manual Transaction Hash Entry View */}
        {step === 'manual_hash' && (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-[#0A4F4E]/10 flex items-center justify-center text-[#0A4F4E]">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-extrabold text-[#111111]">Verify Payment Hash</h2>
                <p className="text-xs text-gray-500">Reconcile transaction sent from external wallet</p>
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
                  <span className="text-xs text-gray-500 font-semibold">Rent Amount</span>
                  <div className="text-2xl font-black text-[#0A4F4E]">{targetAmount.toFixed(2)} USDC</div>
                </div>
                <div className="text-right">
                  <span className="text-[11px] font-bold text-gray-400 uppercase">Network</span>
                  <div className="text-xs font-bold text-gray-800">Stellar Testnet</div>
                </div>
              </div>

              {/* Property Owner Receiving Address */}
              <div className="p-3 rounded-xl border border-gray-200 bg-gray-50">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-gray-500">Property Owner Receiving Wallet</span>
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
                  * Must match the memo used in your transfer for automatic reconciliation.
                </p>
              </div>

              {/* Transaction Hash Input */}
              <div className="pt-2">
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Paste 64-Character Stellar Transaction Hash:
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
                className="py-3 px-4 rounded-xl border border-gray-200 hover:bg-gray-100 font-bold text-xs text-gray-700 transition cursor-pointer"
              >
                Back
              </button>
              <button
                onClick={() => handleVerifyTransaction()}
                disabled={loading || !txHashInput.trim()}
                className="flex-1 py-3 px-4 rounded-xl bg-[#0A4F4E] hover:bg-[#083D3C] text-white font-bold text-sm shadow-md transition flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                Verify & Settle Payment
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: Confirming / Polling Horizon */}
        {step === 'confirming' && (
          <div className="py-12 text-center">
            <Loader2 className="w-12 h-12 text-[#0A4F4E] animate-spin mx-auto mb-4" />
            <h3 className="text-lg font-extrabold text-gray-900 mb-2">Verifying on Stellar Horizon...</h3>
            <p className="text-xs text-gray-500 max-w-xs mx-auto">
              Extracting payment operations, verifying destination address, matching memo, and deducting balance.
            </p>
          </div>
        )}

        {/* STEP 5: Success / Payment Confirmed */}
        {step === 'success' && (
          <div className="text-center py-4">
            <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-black text-gray-950 mb-1">Payment Received!</h3>
            <p className="text-xs text-gray-500 mb-5">
              Your rent payment was verified and credited directly to the property owner on Stellar Testnet.
            </p>

            <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200 text-left space-y-2 mb-6 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">Amount Paid:</span>
                <strong className="text-emerald-700 font-mono text-sm">
                  ${Number(reconciliationResult?.amount_paid_usdc || targetAmount || 0).toFixed(2)} USDC
                </strong>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Remaining Balance:</span>
                <strong className="text-gray-900 font-mono text-sm">
                  ${Number(reconciliationResult?.remaining_balance_usdc ?? 0).toFixed(2)} USDC
                </strong>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Reconciliation Status:</span>
                <span className="font-extrabold text-[#0A4F4E] uppercase">
                  {reconciliationResult?.status || 'CONFIRMED'}
                </span>
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
                onClick={handleDone}
                className="flex-1 py-3 px-4 rounded-xl bg-[#0A4F4E] hover:bg-[#083D3C] text-white font-bold text-sm shadow-md transition cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        )}

        {/* STEP 6: Failed / Rejected */}
        {step === 'failed' && (
          <div className="text-center py-4">
            <div className="w-14 h-14 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-black text-gray-950 mb-1">Payment / Signing Issue</h3>
            <p className="text-xs text-rose-600 mb-6 max-w-sm mx-auto leading-relaxed">
              {errorMsg || 'Could not verify or sign the transaction on Stellar Testnet.'}
            </p>

            <div className="space-y-2">
              <button
                onClick={() => setStep('select_amount')}
                className="w-full py-3 px-4 rounded-xl bg-[#0A4F4E] hover:bg-[#083D3C] text-white font-bold text-sm transition cursor-pointer flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Try Signing Again with Wallet
              </button>
              <button
                onClick={() => {
                  setErrorMsg('');
                  setStep('manual_hash');
                }}
                className="w-full py-3 px-4 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                <ShieldCheck className="w-4 h-4 text-gray-500" />
                Verify Payment by Entering Transaction Hash Instead
              </button>
              <button
                onClick={onClose}
                className="w-full py-2.5 px-4 rounded-xl text-gray-400 hover:text-gray-600 font-semibold text-xs transition cursor-pointer"
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
