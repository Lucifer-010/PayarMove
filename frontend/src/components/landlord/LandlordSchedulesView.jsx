import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Plus,
  X,
  Building2,
  User,
  DollarSign,
  Clock,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Send,
  Layers,
} from 'lucide-react';
import api from '../../services/api';
import { useApp } from '../../context/AppContext';

export default function LandlordSchedulesView() {
  const { user } = useApp();
  const [schedules, setSchedules] = useState([]);
  const [properties, setProperties] = useState([]);
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [generatingId, setGeneratingId] = useState(null);
  const [alertNotice, setAlertNotice] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    property_id: '',
    unit_id: '',
    tenant_email: '',
    tenant_name: '',
    monthly_rent_usdc: 500,
    due_day_of_month: 5,
    start_date: new Date().toISOString().split('T')[0],
    end_date: '',
    receiving_wallet: user?.walletAddress || 'GC2R34KLSLB2UMOOTPAJ7PGJUHVPYVP77DR27DZCD5CWRD3K7MQOEKLT',
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [schedData, propData] = await Promise.all([
        api.schedules.list().catch(() => []),
        api.properties.list().catch(() => []),
      ]);
      setSchedules(Array.isArray(schedData) ? schedData : schedData?.results || []);
      const propList = Array.isArray(propData) ? propData : propData?.results || [];
      setProperties(propList);
      if (propList.length > 0 && !formData.property_id) {
        setFormData((prev) => ({ ...prev, property_id: propList[0].id }));
        loadUnits(propList[0].id);
      }
    } catch (err) {
      console.warn('Error loading schedules:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadUnits = async (propId) => {
    try {
      const data = await api.units.list(propId);
      const unitList = Array.isArray(data) ? data : data?.results || [];
      setUnits(unitList);
      if (unitList.length > 0) {
        setFormData((prev) => ({
          ...prev,
          unit_id: unitList[0].id,
          monthly_rent_usdc: unitList[0].monthly_rent_usdc || 500,
        }));
      }
    } catch (e) {}
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handlePropertyChange = (propId) => {
    setFormData((prev) => ({ ...prev, property_id: propId }));
    loadUnits(propId);
  };

  const handleUnitChange = (unitId) => {
    const u = units.find((x) => x.id === unitId);
    setFormData((prev) => ({
      ...prev,
      unit_id: unitId,
      monthly_rent_usdc: u?.monthly_rent_usdc || prev.monthly_rent_usdc,
    }));
  };

  const handleCreateSchedule = async (e) => {
    e.preventDefault();
    if (!formData.tenant_email.trim() || !formData.property_id) {
      alert('Please fill in Property, Unit and Tenant Email.');
      return;
    }
    setSubmitting(true);
    try {
      // 1. Create TenantAssignment with auto_schedule=True
      await api.assignments.create({
        property: formData.property_id,
        unit: formData.unit_id || null,
        tenant_email: formData.tenant_email,
        tenant_name: formData.tenant_name,
        rent_amount_usdc: formData.monthly_rent_usdc,
        monthly_due_day: formData.due_day_of_month,
        start_date: formData.start_date,
        end_date: formData.end_date || null,
        receiving_wallet: formData.receiving_wallet,
        create_schedule: true,
      });

      setAlertNotice(`Successfully invited ${formData.tenant_email} and generated rent obligations!`);
      setTimeout(() => setAlertNotice(''), 4000);
      setModalOpen(false);
      await fetchData();
    } catch (err) {
      alert(`Failed to create schedule: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleGenerateMore = async (scheduleId) => {
    setGeneratingId(scheduleId);
    try {
      await api.schedules.generateObligations(scheduleId, 3);
      setAlertNotice('Generated 3 more rent obligations for this schedule.');
      setTimeout(() => setAlertNotice(''), 4000);
      await fetchData();
    } catch (err) {
      alert(`Error generating obligations: ${err.message}`);
    } finally {
      setGeneratingId(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#111111]">Rental Schedules & Leases</h1>
          <p className="text-xs sm:text-sm text-[#5C5C5C] mt-1">
            Configure monthly rent obligations and automate recurring Stellar payment collection
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchData}
            disabled={loading}
            className="p-2.5 rounded-xl bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 shadow-2xs transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-[#0A4F4E] hover:bg-[#083D3C] text-white text-xs font-extrabold shadow-md flex items-center gap-1.5 transition"
          >
            <Plus className="w-4 h-4" />
            New Schedule / Invite Tenant
          </button>
        </div>
      </div>

      {alertNotice && (
        <div className="mb-6 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{alertNotice}</span>
        </div>
      )}

      {loading ? (
        <div className="py-20 text-center">
          <Loader2 className="w-8 h-8 text-[#0A4F4E] animate-spin mx-auto mb-3" />
          <p className="text-xs text-gray-500 font-semibold">Loading rental schedules...</p>
        </div>
      ) : schedules.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-gray-200/80 shadow-2xs">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 text-gray-400 flex items-center justify-center mx-auto mb-4">
            <Calendar className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-extrabold text-gray-900 mb-1">No active rental schedules</h3>
          <p className="text-xs text-gray-500 max-w-sm mx-auto mb-6">
            Create a schedule to assign a tenant to a unit, set monthly rent amounts, and automatically generate recurring payment obligations.
          </p>
          <button
            onClick={() => setModalOpen(true)}
            className="py-2.5 px-5 rounded-xl bg-[#0A4F4E] text-white font-bold text-xs shadow-xs hover:bg-[#083D3C] transition"
          >
            Create Your First Schedule
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-gray-200/80 shadow-2xs overflow-hidden">
          <div className="divide-y divide-gray-100">
            {schedules.map((sched) => (
              <div
                key={sched.id}
                className="p-5 sm:p-6 hover:bg-gray-50/50 transition flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-extrabold text-sm text-gray-900">
                      {sched.tenant_name || sched.tenant_email || 'Tenant'}
                    </span>
                    <span
                      className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase ${
                        sched.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {sched.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  <div className="text-xs text-gray-600 flex items-center gap-2">
                    <Building2 className="w-3.5 h-3.5 text-gray-400" />
                    <span>{sched.property_name || 'Property'}</span>
                    {sched.unit_number && <span>· Unit {sched.unit_number}</span>}
                  </div>

                  <div className="text-xs text-gray-400 mt-1 flex items-center gap-3">
                    <span>Due on the {sched.due_day_of_month || 5}th</span>
                    <span>·</span>
                    <span>Starts: {sched.start_date}</span>
                    {sched.end_date && <span>· Ends: {sched.end_date}</span>}
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-4 pt-3 sm:pt-0 border-t sm:border-t-0 border-gray-100">
                  <div className="text-left sm:text-right">
                    <div className="font-mono text-base font-black text-gray-950">
                      ${sched.rent_amount_usdc} <span className="text-xs font-bold text-gray-400">USDC/mo</span>
                    </div>
                    <div className="text-[11px] text-gray-400 font-semibold">
                      Frequency: {sched.frequency || 'MONTHLY'}
                    </div>
                  </div>

                  <button
                    onClick={() => handleGenerateMore(sched.id)}
                    disabled={generatingId === sched.id}
                    className="px-3.5 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-xs font-bold text-gray-800 transition flex items-center gap-1.5"
                    title="Generate 3 additional monthly obligations"
                  >
                    {generatingId === sched.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Plus className="w-3.5 h-3.5" />
                    )}
                    <span>Generate +3 Obl.</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create Schedule Modal (Figma F13 / F8) */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-gray-100 relative animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setModalOpen(false)}
              className="absolute top-5 right-5 p-2 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-2xl bg-[#0A4F4E]/10 text-[#0A4F4E] flex items-center justify-center">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-extrabold text-gray-950">Create Rent Schedule</h2>
                <p className="text-xs text-gray-500">Assign tenant and set recurring payment dates</p>
              </div>
            </div>

            <form onSubmit={handleCreateSchedule} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Select Property</label>
                  <select
                    value={formData.property_id}
                    onChange={(e) => handlePropertyChange(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-300 focus:border-[#0A4F4E] outline-none text-xs text-gray-900 bg-white"
                  >
                    {properties.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Select Unit</label>
                  <select
                    value={formData.unit_id}
                    onChange={(e) => handleUnitChange(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-300 focus:border-[#0A4F4E] outline-none text-xs text-gray-900 bg-white"
                  >
                    {units.map((u) => (
                      <option key={u.id} value={u.id}>
                        Unit {u.unit_number} (${u.monthly_rent_usdc})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Tenant Email</label>
                  <input
                    type="email"
                    required
                    placeholder="tenant@gmail.com"
                    value={formData.tenant_email}
                    onChange={(e) => setFormData({ ...formData, tenant_email: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 focus:border-[#0A4F4E] outline-none text-xs text-gray-900"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Tenant Full Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Kamau Njoroge"
                    value={formData.tenant_name}
                    onChange={(e) => setFormData({ ...formData, tenant_name: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 focus:border-[#0A4F4E] outline-none text-xs text-gray-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Monthly Rent (USDC)</label>
                  <input
                    type="number"
                    required
                    value={formData.monthly_rent_usdc}
                    onChange={(e) => setFormData({ ...formData, monthly_rent_usdc: Number(e.target.value) })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 focus:border-[#0A4F4E] outline-none text-xs font-mono font-bold text-gray-900"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Due Day of Month</label>
                  <input
                    type="number"
                    min="1"
                    max="28"
                    required
                    value={formData.due_day_of_month}
                    onChange={(e) => setFormData({ ...formData, due_day_of_month: Number(e.target.value) })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 focus:border-[#0A4F4E] outline-none text-xs font-bold text-gray-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    required
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 focus:border-[#0A4F4E] outline-none text-xs text-gray-900"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">End Date (Optional)</label>
                  <input
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 focus:border-[#0A4F4E] outline-none text-xs text-gray-900"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Receiving Stellar Wallet</label>
                <input
                  type="text"
                  required
                  value={formData.receiving_wallet}
                  onChange={(e) => setFormData({ ...formData, receiving_wallet: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 focus:border-[#0A4F4E] outline-none text-xs font-mono text-gray-900"
                />
              </div>

              <div className="pt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-gray-200 font-bold text-gray-700 hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-[#0A4F4E] hover:bg-[#083D3C] text-white font-extrabold shadow-md flex items-center gap-1.5"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Create & Generate Obligations
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

