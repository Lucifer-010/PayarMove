import React, { useState, useEffect } from 'react';
import { X, Calculator, ArrowRight, CheckCircle2, AlertTriangle, Clock, RefreshCw } from 'lucide-react';
import api from '../../services/api';

export default function RentCalculatorModal({ isOpen, onClose, initialRent = 500 }) {
  const [monthlyRent, setMonthlyRent] = useState(initialRent);
  const [paymentAmount, setPaymentAmount] = useState(initialRent);
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(5);
    return d.toISOString().split('T')[0];
  });
  const [gracePeriodDays, setGracePeriodDays] = useState(5);
  const [simulatedDate, setSimulatedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const calculate = async () => {
    setLoading(true);
    try {
      const data = await api.calculator.simulate({
        monthly_rent: Number(monthlyRent),
        payment_amount: Number(paymentAmount),
        due_date: dueDate,
        grace_period_days: Number(gracePeriodDays),
        simulated_date: simulatedDate,
      });
      setResult(data);
    } catch (err) {
      // Fallback local calculation
      const rent = Number(monthlyRent) || 0;
      const paid = Number(paymentAmount) || 0;
      const remaining = Math.max(0, rent - paid);
      const due = new Date(dueDate);
      const sim = new Date(simulatedDate);
      const graceEnd = new Date(due.getTime() + gracePeriodDays * 86400000);
      let status = 'UPCOMING';
      if (remaining === 0) status = 'PAID';
      else if (paid > 0 && remaining > 0) status = sim > graceEnd ? 'OVERDUE' : 'PARTIALLY_PAID';
      else if (sim > graceEnd) status = 'OVERDUE';

      setResult({
        calculated_status: status,
        total_due_usdc: rent,
        total_paid_usdc: paid,
        outstanding_rent_usdc: remaining,
        is_overdue: status === 'OVERDUE',
        grace_period_ends: graceEnd.toISOString().split('T')[0],
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      calculate();
    }
  }, [isOpen, monthlyRent, paymentAmount, dueDate, gracePeriodDays, simulatedDate]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-gray-100 relative animate-in fade-in zoom-in-95 duration-200">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-2xl bg-[#0A4F4E]/10 flex items-center justify-center text-[#0A4F4E]">
            <Calculator className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-[#111111]">Rent Payment Simulator</h2>
            <p className="text-xs text-gray-500">Test partial payments, grace periods & overdue states</p>
          </div>
        </div>

        <div className="space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Monthly Rent (USDC)</label>
              <input
                type="number"
                value={monthlyRent}
                onChange={(e) => setMonthlyRent(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 focus:border-[#0A4F4E] focus:ring-2 focus:ring-[#0A4F4E]/20 outline-none font-semibold text-gray-900"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Simulated Payment (USDC)</label>
              <input
                type="number"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 focus:border-[#0A4F4E] focus:ring-2 focus:ring-[#0A4F4E]/20 outline-none font-semibold text-gray-900"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Due Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 focus:border-[#0A4F4E] focus:ring-2 focus:ring-[#0A4F4E]/20 outline-none text-xs text-gray-900"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Simulated Date (Today)</label>
              <input
                type="date"
                value={simulatedDate}
                onChange={(e) => setSimulatedDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 focus:border-[#0A4F4E] focus:ring-2 focus:ring-[#0A4F4E]/20 outline-none text-xs text-gray-900"
              />
            </div>
          </div>

          {/* Quick preset buttons */}
          <div className="flex items-center gap-2 pt-1">
            <span className="text-[11px] font-bold text-gray-400">Presets:</span>
            <button
              type="button"
              onClick={() => setPaymentAmount(monthlyRent)}
              className="text-[11px] px-2.5 py-1 bg-gray-100 hover:bg-gray-200 rounded-lg font-semibold text-gray-700"
            >
              Full (100%)
            </button>
            <button
              type="button"
              onClick={() => setPaymentAmount((Number(monthlyRent) / 2).toFixed(0))}
              className="text-[11px] px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-lg font-semibold"
            >
              Partial (50%)
            </button>
            <button
              type="button"
              onClick={() => setPaymentAmount(0)}
              className="text-[11px] px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-800 rounded-lg font-semibold"
            >
              Unpaid ($0)
            </button>
          </div>

          {/* Live Outcome Card */}
          {result && (
            <div className="mt-4 p-4 rounded-2xl bg-[#F2F7F7] border border-[#0A4F4E]/15">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Calculated Status</span>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wide flex items-center gap-1.5 ${
                    result.calculated_status === 'PAID'
                      ? 'bg-emerald-100 text-emerald-800'
                      : result.calculated_status === 'PARTIALLY_PAID'
                      ? 'bg-amber-100 text-amber-800'
                      : result.calculated_status === 'OVERDUE'
                      ? 'bg-rose-100 text-rose-800'
                      : 'bg-gray-200 text-gray-800'
                  }`}
                >
                  {result.calculated_status === 'PAID' && <CheckCircle2 className="w-3.5 h-3.5" />}
                  {result.calculated_status === 'PARTIALLY_PAID' && <Clock className="w-3.5 h-3.5" />}
                  {result.calculated_status === 'OVERDUE' && <AlertTriangle className="w-3.5 h-3.5" />}
                  {result.calculated_status.replace('_', ' ')}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center py-2 bg-white rounded-xl border border-gray-100 shadow-2xs">
                <div>
                  <div className="text-[11px] text-gray-400 font-semibold">Rent Amount</div>
                  <div className="text-sm font-extrabold text-gray-900">${result.total_due_usdc} USDC</div>
                </div>
                <div>
                  <div className="text-[11px] text-gray-400 font-semibold">Paid</div>
                  <div className="text-sm font-extrabold text-emerald-700">${result.total_paid_usdc} USDC</div>
                </div>
                <div>
                  <div className="text-[11px] text-gray-400 font-semibold">Outstanding</div>
                  <div className={`text-sm font-extrabold ${result.outstanding_rent_usdc > 0 ? 'text-rose-600' : 'text-gray-900'}`}>
                    ${result.outstanding_rent_usdc} USDC
                  </div>
                </div>
              </div>

              <div className="mt-3 text-xs text-gray-600 flex items-center justify-between">
                <span>Grace Period (Ends):</span>
                <span className="font-semibold text-gray-800">{result.grace_period_ends || '5 days post due'}</span>
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="w-full py-3 px-4 rounded-xl bg-[#0A4F4E] hover:bg-[#083D3C] text-white font-bold text-sm shadow-md transition"
          >
            Close Calculator
          </button>
        </div>
      </div>
    </div>
  );
}

