import React, { useState, useEffect } from 'react';
import {
  Building2,
  Plus,
  X,
  MapPin,
  Wallet,
  Layers,
  CheckCircle2,
  ArrowRight,
  ExternalLink,
  Loader2,
  RefreshCw,
  Home,
} from 'lucide-react';
import api from '../../services/api';
import { useApp } from '../../context/AppContext';

export default function LandlordPropertiesView() {
  const { user } = useApp();
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedPropertyUnits, setSelectedPropertyUnits] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    city: 'Nairobi',
    country: 'Kenya',
    receiving_wallet: user?.walletAddress || 'GC2R34KLSLB2UMOOTPAJ7PGJUHVPYVP77DR27DZCD5CWRD3K7MQOEKLT',
    units: [
      { unit_number: '1A', bedrooms: 2, bathrooms: 2, monthly_rent_usdc: 500, security_deposit_usdc: 500 },
      { unit_number: '1B', bedrooms: 1, bathrooms: 1, monthly_rent_usdc: 350, security_deposit_usdc: 350 },
    ],
  });

  const fetchProperties = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const data = await api.properties.list();
      setProperties(Array.isArray(data) ? data : data?.results || []);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to fetch properties.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProperties();
  }, []);

  const handleAddUnitField = () => {
    setFormData((prev) => ({
      ...prev,
      units: [
        ...prev.units,
        {
          unit_number: `${prev.units.length + 1}A`,
          bedrooms: 1,
          bathrooms: 1,
          monthly_rent_usdc: 400,
          security_deposit_usdc: 400,
        },
      ],
    }));
  };

  const handleRemoveUnitField = (index) => {
    setFormData((prev) => ({
      ...prev,
      units: prev.units.filter((_, idx) => idx !== index),
    }));
  };

  const handleUnitChange = (index, field, value) => {
    setFormData((prev) => {
      const copy = [...prev.units];
      copy[index] = { ...copy[index], [field]: value };
      return { ...prev, units: copy };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.address.trim() || !formData.receiving_wallet.trim()) {
      alert('Please fill in Property Name, Address, and Receiving Stellar Wallet.');
      return;
    }
    setSubmitting(true);
    try {
      await api.properties.create(formData);
      setModalOpen(false);
      setFormData({
        name: '',
        address: '',
        city: 'Nairobi',
        country: 'Kenya',
        receiving_wallet: user?.walletAddress || 'GC2R34KLSLB2UMOOTPAJ7PGJUHVPYVP77DR27DZCD5CWRD3K7MQOEKLT',
        units: [
          { unit_number: '1A', bedrooms: 2, bathrooms: 2, monthly_rent_usdc: 500, security_deposit_usdc: 500 },
        ],
      });
      await fetchProperties();
    } catch (err) {
      alert(`Failed to add property: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleViewUnits = async (property) => {
    try {
      const units = await api.units.list(property.id);
      setSelectedPropertyUnits({
        property,
        units: Array.isArray(units) ? units : units?.results || [],
      });
    } catch (err) {
      alert('Could not load units.');
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#111111]">Managed Properties</h1>
          <p className="text-xs sm:text-sm text-[#5C5C5C] mt-1">
            Configure rental units and dedicated Stellar Testnet receiving wallets
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchProperties}
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
            Add Property
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center">
          <Loader2 className="w-8 h-8 text-[#0A4F4E] animate-spin mx-auto mb-3" />
          <p className="text-xs text-gray-500 font-semibold">Loading your properties...</p>
        </div>
      ) : properties.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-gray-200/80 shadow-2xs">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 text-gray-400 flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-extrabold text-gray-900 mb-1">No properties added yet</h3>
          <p className="text-xs text-gray-500 max-w-sm mx-auto mb-6">
            Add your first property and define rental units to start collecting rent in digital USDC on Stellar.
          </p>
          <button
            onClick={() => setModalOpen(true)}
            className="py-2.5 px-5 rounded-xl bg-[#0A4F4E] text-white font-bold text-xs shadow-xs hover:bg-[#083D3C] transition"
          >
            Add Your First Property
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {properties.map((prop) => (
            <div
              key={prop.id}
              className="bg-white rounded-3xl p-6 border border-gray-200/80 shadow-2xs hover:shadow-md transition flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="w-12 h-12 rounded-2xl bg-[#0A4F4E]/10 text-[#0A4F4E] flex items-center justify-center shrink-0">
                    <Building2 className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-extrabold px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full">
                    {prop.units_count || 2} Units
                  </span>
                </div>

                <h3 className="text-lg font-black text-gray-900">{prop.name}</h3>
                <div className="text-xs text-gray-500 mt-1 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  <span>{prop.address}, {prop.city}</span>
                </div>

                <div className="mt-4 p-3 rounded-2xl bg-gray-50 border border-gray-200 text-xs">
                  <div className="flex items-center gap-1.5 text-gray-500 mb-1 font-semibold">
                    <Wallet className="w-3.5 h-3.5 text-gray-400" />
                    <span>Receiving Stellar Wallet:</span>
                  </div>
                  <div className="font-mono text-[11px] text-gray-800 break-all select-all font-bold">
                    {prop.receiving_wallet}
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between">
                <span className="text-xs font-bold text-gray-400">
                  Occupied: <strong className="text-gray-900">{prop.occupied_units_count || 0} / {prop.units_count || 2}</strong>
                </span>
                <button
                  onClick={() => handleViewUnits(prop)}
                  className="px-3.5 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-xs font-bold text-gray-800 transition"
                >
                  View Units & Rent
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Property Modal (Figma F7) */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl border border-gray-100 relative animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setModalOpen(false)}
              className="absolute top-5 right-5 p-2 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-2xl bg-[#0A4F4E]/10 text-[#0A4F4E] flex items-center justify-center">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-extrabold text-gray-950">Add Rental Property</h2>
                <p className="text-xs text-gray-500">Define building details & initial rental units</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-gray-700 mb-1">Property Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Kilimani Gardens"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 focus:border-[#0A4F4E] focus:ring-2 focus:ring-[#0A4F4E]/20 outline-none text-xs text-gray-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Street Address</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 14 Argwings Kodhek Rd"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 focus:border-[#0A4F4E] focus:ring-2 focus:ring-[#0A4F4E]/20 outline-none text-xs text-gray-900"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">City</label>
                  <input
                    type="text"
                    required
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 focus:border-[#0A4F4E] focus:ring-2 focus:ring-[#0A4F4E]/20 outline-none text-xs text-gray-900"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Stellar Receiving Wallet (Testnet)</label>
                <input
                  type="text"
                  required
                  value={formData.receiving_wallet}
                  onChange={(e) => setFormData({ ...formData, receiving_wallet: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 focus:border-[#0A4F4E] focus:ring-2 focus:ring-[#0A4F4E]/20 outline-none text-xs font-mono text-gray-900"
                />
              </div>

              {/* Units Section */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-2">
                  <label className="font-extrabold text-gray-900">Rental Units</label>
                  <button
                    type="button"
                    onClick={handleAddUnitField}
                    className="text-[#0A4F4E] font-bold hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Unit
                  </button>
                </div>

                <div className="space-y-2">
                  {formData.units.map((unit, idx) => (
                    <div key={idx} className="p-3 rounded-xl bg-gray-50 border border-gray-200 flex items-center gap-2">
                      <div className="w-16">
                        <label className="text-[10px] text-gray-400 block">Unit #</label>
                        <input
                          type="text"
                          value={unit.unit_number}
                          onChange={(e) => handleUnitChange(idx, 'unit_number', e.target.value)}
                          className="w-full px-2 py-1 rounded-lg border border-gray-200 font-bold text-xs"
                        />
                      </div>
                      <div className="w-16">
                        <label className="text-[10px] text-gray-400 block">Beds</label>
                        <input
                          type="number"
                          value={unit.bedrooms}
                          onChange={(e) => handleUnitChange(idx, 'bedrooms', Number(e.target.value))}
                          className="w-full px-2 py-1 rounded-lg border border-gray-200 text-xs"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="text-[10px] text-gray-400 block">Monthly Rent (USDC)</label>
                        <input
                          type="number"
                          value={unit.monthly_rent_usdc}
                          onChange={(e) => handleUnitChange(idx, 'monthly_rent_usdc', Number(e.target.value))}
                          className="w-full px-2 py-1 rounded-lg border border-gray-200 text-xs font-bold font-mono"
                        />
                      </div>
                      {formData.units.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveUnitField(idx)}
                          className="p-1.5 text-gray-400 hover:text-rose-600 rounded-lg transition"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
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
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Save Property
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Units Drawer Modal */}
      {selectedPropertyUnits && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-gray-100 relative animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => setSelectedPropertyUnits(null)}
              className="absolute top-5 right-5 p-2 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-xl font-extrabold text-gray-950 mb-1">
              {selectedPropertyUnits.property.name} Units
            </h2>
            <p className="text-xs text-gray-500 mb-6">
              {selectedPropertyUnits.units.length} total units registered
            </p>

            <div className="space-y-3 max-h-96 overflow-y-auto">
              {selectedPropertyUnits.units.map((u) => (
                <div key={u.id} className="p-4 rounded-2xl border border-gray-200 flex items-center justify-between">
                  <div>
                    <div className="font-extrabold text-sm text-gray-900">Unit {u.unit_number}</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {u.bedrooms} Bed · {u.bathrooms} Bath
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-sm font-black text-gray-900">${u.monthly_rent_usdc} USDC</div>
                    <span
                      className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase ${
                        u.is_occupied ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {u.is_occupied ? 'Occupied' : 'Vacant'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

