import React, { useState, useEffect } from 'react';
import {
  Users,
  Send,
  Trash2,
  Building2,
  Mail,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Loader2,
  RefreshCw,
  X,
  AlertCircle,
} from 'lucide-react';
import api from '../../services/api';
import { useApp } from '../../context/AppContext';

export default function LandlordTenantsView() {
  const { navigateTo } = useApp();
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [remindingId, setRemindingId] = useState(null);
  const [terminatingId, setTerminatingId] = useState(null);
  const [confirmTerminate, setConfirmTerminate] = useState(null);
  const [alertNotice, setAlertNotice] = useState('');

  const fetchTenants = async () => {
    setLoading(true);
    try {
      const data = await api.assignments.list();
      setAssignments(Array.isArray(data) ? data : data?.results || []);
    } catch (err) {
      console.warn('Failed to load tenant assignments:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTenants();
  }, []);

  const handleSendReminder = async (assignment) => {
    setRemindingId(assignment.id);
    try {
      await api.assignments.remind(assignment.id);
      setAlertNotice(`Reminder successfully sent to ${assignment.tenant_email || 'tenant'}!`);
      setTimeout(() => setAlertNotice(''), 4000);
    } catch (err) {
      alert(`Error sending reminder: ${err.message}`);
    } finally {
      setRemindingId(null);
    }
  };

  const handleTerminateLease = async (assignmentId) => {
    setTerminatingId(assignmentId);
    try {
      await api.assignments.terminate(assignmentId);
      setAlertNotice('Lease successfully terminated.');
      setTimeout(() => setAlertNotice(''), 4000);
      setConfirmTerminate(null);
      await fetchTenants();
    } catch (err) {
      alert(`Error terminating lease: ${err.message}`);
    } finally {
      setTerminatingId(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#111111]">Tenants & Leases</h1>
          <p className="text-xs sm:text-sm text-[#5C5C5C] mt-1">
            Manage active tenant assignments, send rent payment reminders, or terminate leases
          </p>
        </div>

        <button
          onClick={fetchTenants}
          disabled={loading}
          className="self-start sm:self-auto p-2.5 rounded-xl bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 shadow-2xs transition"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
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
          <p className="text-xs text-gray-500 font-semibold">Loading tenant directory...</p>
        </div>
      ) : assignments.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-gray-200/80 shadow-2xs">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 text-gray-400 flex items-center justify-center mx-auto mb-4">
            <Users className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-extrabold text-gray-900 mb-1">No tenants assigned yet</h3>
          <p className="text-xs text-gray-500 max-w-sm mx-auto mb-6">
            When you invite a tenant or create a schedule, their lease profile and contact details appear here.
          </p>
          <button
            onClick={() => navigateTo('landlord-schedules')}
            className="py-2.5 px-5 rounded-xl bg-[#0A4F4E] text-white font-bold text-xs shadow-xs hover:bg-[#083D3C] transition"
          >
            Create Schedule / Invite
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {assignments.map((assignment) => (
            <div
              key={assignment.id}
              className="bg-white rounded-3xl p-6 border border-gray-200/80 shadow-2xs hover:shadow-md transition flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="w-12 h-12 rounded-2xl bg-[#0A4F4E]/10 text-[#0A4F4E] flex items-center justify-center shrink-0">
                    <Users className="w-6 h-6" />
                  </div>
                  <span
                    className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase ${
                      assignment.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {assignment.is_active ? 'Active Lease' : 'Terminated'}
                  </span>
                </div>

                <h3 className="text-base font-extrabold text-gray-950">
                  {assignment.tenant_name || assignment.tenant_email || 'Tenant'}
                </h3>
                <div className="text-xs text-gray-500 mt-1 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  <span>{assignment.tenant_email}</span>
                </div>
                <div className="text-xs text-gray-600 mt-1 flex items-center gap-1.5 font-semibold">
                  <Building2 className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  <span>{assignment.property_name || 'Property'}</span>
                  {assignment.unit_number && <span>· Unit {assignment.unit_number}</span>}
                </div>

                <div className="mt-4 p-3 rounded-2xl bg-gray-50 border border-gray-200 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-gray-400 text-[10px] uppercase font-bold">Monthly Rent</span>
                    <div className="font-mono font-black text-gray-900">${assignment.rent_amount_usdc} USDC</div>
                  </div>
                  <div>
                    <span className="text-gray-400 text-[10px] uppercase font-bold">Due Day</span>
                    <div className="font-bold text-gray-900">Every {assignment.monthly_due_day || 5}th</div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between gap-2">
                {assignment.is_active ? (
                  <>
                    <button
                      onClick={() => handleSendReminder(assignment)}
                      disabled={remindingId === assignment.id}
                      className="px-3.5 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {remindingId === assignment.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Send className="w-3.5 h-3.5" />
                      )}
                      <span>Send Reminder</span>
                    </button>

                    <button
                      onClick={() => setConfirmTerminate(assignment)}
                      className="px-3.5 py-2 rounded-xl border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-bold transition flex items-center gap-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Remove</span>
                    </button>
                  </>
                ) : (
                  <span className="text-xs font-semibold text-gray-400">Lease closed</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Terminate Lease Modal (Figma F10) */}
      {confirmTerminate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-gray-100 relative animate-in fade-in zoom-in-95 duration-200 text-center">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center mx-auto mb-3">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-extrabold text-gray-900 mb-1">Confirm Lease Termination</h3>
            <p className="text-xs text-gray-600 mb-6">
              Are you sure you want to remove <strong>{confirmTerminate.tenant_name || confirmTerminate.tenant_email}</strong> from Unit {confirmTerminate.unit_number}? This will deactivate their schedule and mark the unit as vacant.
            </p>

            <div className="flex gap-2">
              <button
                onClick={() => setConfirmTerminate(null)}
                className="flex-1 py-2.5 px-4 rounded-xl border border-gray-200 font-bold text-xs text-gray-700 hover:bg-gray-100 transition"
              >
                Cancel
              </button>
              <button
                onClick={() => handleTerminateLease(confirmTerminate.id)}
                disabled={terminatingId === confirmTerminate.id}
                className="flex-1 py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md transition flex items-center justify-center gap-1.5"
              >
                {terminatingId === confirmTerminate.id ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
                Confirm Termination
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

