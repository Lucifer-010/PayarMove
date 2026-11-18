import React, { useState, useEffect } from 'react';
import {
  Building2,
  MapPin,
  Bed,
  Bath,
  Maximize,
  Search,
  Filter,
  DollarSign,
  ArrowRight,
  CheckCircle2,
  X,
  Calendar,
  Sparkles,
  ShieldCheck,
  Loader2,
  RefreshCw,
  Home,
  Check,
  LogIn,
} from 'lucide-react';
import api from '../../services/api';
import { useApp } from '../../context/AppContext';

export default function PropertiesListView() {
  const { user, navigateTo } = useApp();

  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchLocation, setSearchLocation] = useState('');
  const [selectedNeighborhood, setSelectedNeighborhood] = useState('All');
  const [selectedBedrooms, setSelectedBedrooms] = useState('All');
  const [maxPrice, setMaxPrice] = useState(1000);

  // Selected Property for Details Modal
  const [activeProperty, setActiveProperty] = useState(null);
  const [propertyUnits, setPropertyUnits] = useState([]);
  const [unitsLoading, setUnitsLoading] = useState(false);

  // Selected Unit for Lease Application
  const [applyingUnit, setApplyingUnit] = useState(null);
  const [leaseStartDate, setLeaseStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  });
  const [submittingLease, setSubmittingLease] = useState(false);
  const [leaseSuccessNotice, setLeaseSuccessNotice] = useState(null);

  const fetchProperties = async () => {
    setLoading(true);
    try {
      const data = await api.properties.list();
      const list = Array.isArray(data) ? data : data?.results || [];
      setProperties(list);
    } catch (err) {
      console.warn('Error fetching properties:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProperties();
  }, []);

  const handleOpenPropertyDetails = async (property) => {
    setActiveProperty(property);
    setUnitsLoading(true);
    try {
      const unitsData = await api.units.list(property.id);
      const unitsList = Array.isArray(unitsData) ? unitsData : unitsData?.results || [];
      setPropertyUnits(unitsList);
    } catch (e) {
      setPropertyUnits([]);
    } finally {
      setUnitsLoading(false);
    }
  };

  const handleStartApply = (unit) => {
    if (!user?.isLoggedIn) {
      // Redirect to login
      navigateTo('login');
      return;
    }
    setApplyingUnit(unit);
  };

  const handleConfirmLeaseApplication = async (e) => {
    e.preventDefault();
    if (!applyingUnit || !activeProperty) return;
    setSubmittingLease(true);
    try {
      const assignment = await api.assignments.create({
        property: activeProperty.id,
        unit: applyingUnit.id,
        rent_amount_usdc: applyingUnit.monthly_rent_usdc,
        monthly_due_day: 5,
        start_date: leaseStartDate,
        receiving_wallet: activeProperty.receiving_wallet,
        create_schedule: true,
      });

      setLeaseSuccessNotice({
        unit: applyingUnit,
        property: activeProperty,
        assignment,
      });
      setApplyingUnit(null);
      await fetchProperties();
    } catch (err) {
      alert(`Application failed: ${err.message}`);
    } finally {
      setSubmittingLease(false);
    }
  };

  const neighborhoods = ['All', 'Westlands', 'Kilimani', 'Riverside', 'Kileleshwa', 'Karen'];

  const filteredProperties = properties.filter((p) => {
    const textMatch =
      !searchLocation.trim() ||
      p.name.toLowerCase().includes(searchLocation.toLowerCase()) ||
      p.address.toLowerCase().includes(searchLocation.toLowerCase()) ||
      p.city.toLowerCase().includes(searchLocation.toLowerCase());

    const neighborhoodMatch =
      selectedNeighborhood === 'All' ||
      p.address.toLowerCase().includes(selectedNeighborhood.toLowerCase()) ||
      p.name.toLowerCase().includes(selectedNeighborhood.toLowerCase());

    return textMatch && neighborhoodMatch;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header Banner */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-bold text-[#0A4F4E] bg-[#0A4F4E]/10 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
            Verified Rentals
          </span>
          <span className="text-xs text-gray-400">·</span>
          <span className="text-xs text-gray-500 font-medium">Digital USDC on Stellar</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-gray-950">
          Rental Properties in Nairobi
        </h1>
        <p className="text-sm text-gray-600 mt-1 max-w-2xl leading-relaxed">
          Explore apartments and villas with transparent on-chain rent obligations. Apply instantly with your digital wallet and download verified PDF receipts.
        </p>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-3xl p-4 sm:p-5 border border-gray-200/80 shadow-2xs mb-8">
        <div className="flex flex-col md:flex-row items-center gap-3">
          {/* Text Search */}
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-gray-400 absolute left-4 top-3.5" />
            <input
              type="text"
              placeholder="Search by building name, street, or area..."
              value={searchLocation}
              onChange={(e) => setSearchLocation(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 rounded-2xl border border-gray-200 focus:border-[#0A4F4E] focus:ring-2 focus:ring-[#0A4F4E]/20 outline-none text-xs text-gray-900 font-semibold"
            />
          </div>

          {/* Neighborhood Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto no-scrollbar py-1">
            {neighborhoods.map((n) => (
              <button
                key={n}
                onClick={() => setSelectedNeighborhood(n)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                  selectedNeighborhood === n
                    ? 'bg-[#0A4F4E] text-white shadow-2xs'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Properties Grid */}
      {loading ? (
        <div className="py-24 text-center">
          <Loader2 className="w-10 h-10 text-[#0A4F4E] animate-spin mx-auto mb-3" />
          <p className="text-sm font-bold text-gray-600">Loading rental properties...</p>
        </div>
      ) : filteredProperties.length === 0 ? (
        <div className="bg-white rounded-3xl p-16 text-center border border-gray-200 shadow-2xs">
          <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-lg font-extrabold text-gray-900 mb-1">No matching properties</h3>
          <p className="text-xs text-gray-500 max-w-sm mx-auto">
            Try resetting your search query or selecting "All" neighborhoods to see available listings.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProperties.map((prop) => {
            const img =
              prop.image_url ||
              (prop.images && prop.images[0]) ||
              'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=80';

            return (
              <div
                key={prop.id}
                className="bg-white rounded-3xl overflow-hidden border border-gray-200/80 shadow-2xs hover:shadow-lg transition-all duration-300 flex flex-col group cursor-pointer"
                onClick={() => navigateTo('property-detail', prop)}
              >
                {/* Photo Thumbnail */}
                <div className="relative h-56 w-full overflow-hidden bg-gray-100">
                  <img
                    src={img}
                    alt={prop.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                  <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-md text-white text-[10px] font-extrabold px-3 py-1 rounded-full uppercase tracking-wider">
                    {prop.units_count || 'Units'} Total Units
                  </div>
                  <div className="absolute bottom-3 left-4 right-4 text-white">
                    <span className="text-[11px] font-semibold text-gray-200 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      {prop.city}, Kenya
                    </span>
                  </div>
                </div>

                {/* Content */}
                <div className="p-5 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="text-base font-extrabold text-gray-950 group-hover:text-[#0A4F4E] transition line-clamp-1">
                      {prop.name}
                    </h3>
                    <p className="text-xs text-gray-500 mt-1 line-clamp-1">{prop.address}</p>
                    <p className="text-xs text-gray-600 mt-2 line-clamp-2 leading-relaxed">
                      {prop.description || 'Modern residential living with verified Stellar rent reconciliation.'}
                    </p>
                  </div>

                  <div className="mt-5 pt-4 border-t border-gray-100 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider">Pricing</span>
                      <div className="font-mono font-black text-sm text-gray-900">
                        In USDC <span className="text-xs font-semibold text-gray-400">/mo</span>
                      </div>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigateTo('property-detail', prop);
                      }}
                      className="py-2 px-3.5 rounded-xl bg-[#0A4F4E] hover:bg-[#083D3C] text-white font-extrabold text-xs shadow-2xs transition flex items-center gap-1"
                    >
                      Preview Property
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Property Details & Units Modal */}
      {activeProperty && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-6 sm:p-8 shadow-2xl border border-gray-100 relative animate-in fade-in zoom-in-95 duration-200 max-h-[92vh] overflow-y-auto">
            <button
              onClick={() => setActiveProperty(null)}
              className="absolute top-5 right-5 p-2 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Modal Header */}
            <div className="flex items-start gap-4 mb-6">
              <div className="w-14 h-14 rounded-2xl bg-[#0A4F4E]/10 text-[#0A4F4E] flex items-center justify-center shrink-0">
                <Building2 className="w-7 h-7" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-gray-950">{activeProperty.name}</h2>
                <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-gray-400" />
                  {activeProperty.address}, {activeProperty.city}
                </p>
                <div className="mt-2 text-xs text-gray-600 leading-relaxed max-w-xl">
                  {activeProperty.description}
                </div>
              </div>
            </div>

            {/* Stellar Wallet Info */}
            <div className="p-3.5 rounded-2xl bg-[#F2F7F7] border border-gray-200/80 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#0A4F4E]" />
                <span className="text-gray-600 font-semibold">Dedicated Receiving Stellar Wallet:</span>
              </div>
              <span className="font-mono font-bold text-[11px] text-gray-800 break-all select-all">
                {activeProperty.receiving_wallet}
              </span>
            </div>

            {/* Units Selection List */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-extrabold text-gray-950">Available Rental Units</h3>
                <span className="text-xs text-gray-400 font-semibold">
                  {propertyUnits.filter((u) => !u.is_occupied).length} units available for lease
                </span>
              </div>

              {unitsLoading ? (
                <div className="py-8 text-center">
                  <Loader2 className="w-6 h-6 text-[#0A4F4E] animate-spin mx-auto mb-2" />
                  <p className="text-xs text-gray-500">Loading units...</p>
                </div>
              ) : propertyUnits.length === 0 ? (
                <p className="text-xs text-gray-500 py-6 text-center">No units listed for this property.</p>
              ) : (
                <div className="space-y-3">
                  {propertyUnits.map((unit) => {
                    const isAvailable = !unit.is_occupied;

                    return (
                      <div
                        key={unit.id}
                        className={`p-4 rounded-2xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                          isAvailable
                            ? 'bg-white border-gray-200 hover:border-[#0A4F4E] hover:shadow-xs'
                            : 'bg-gray-50 border-gray-100 opacity-60'
                        }`}
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-sm text-gray-950">
                              Unit {unit.unit_number}
                            </span>
                            <span
                              className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase ${
                                isAvailable ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-200 text-gray-700'
                              }`}
                            >
                              {isAvailable ? 'Available' : 'Occupied'}
                            </span>
                          </div>

                          <div className="text-xs text-gray-500 mt-1 flex items-center gap-3">
                            <span className="flex items-center gap-1">
                              <Bed className="w-3.5 h-3.5 text-gray-400" />
                              {unit.bedrooms} Bedrooms
                            </span>
                            <span>·</span>
                            <span className="flex items-center gap-1">
                              <Bath className="w-3.5 h-3.5 text-gray-400" />
                              {unit.bathrooms} Bathrooms
                            </span>
                            {unit.floor && (
                              <>
                                <span>·</span>
                                <span>{unit.floor}</span>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-4 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-100">
                          <div className="text-left sm:text-right">
                            <div className="font-mono font-black text-sm text-[#0A4F4E]">
                              ${unit.monthly_rent_usdc}{' '}
                              <span className="text-[10px] font-bold text-gray-400">USDC/mo</span>
                            </div>
                            <div className="text-[10px] text-gray-400">
                              Deposit: ${unit.security_deposit_usdc || unit.monthly_rent_usdc} USDC
                            </div>
                          </div>

                          {isAvailable && (
                            <button
                              onClick={() => handleStartApply(unit)}
                              className="px-4 py-2 rounded-xl bg-[#0A4F4E] hover:bg-[#083D3C] text-white font-extrabold text-xs shadow-2xs transition flex items-center gap-1"
                            >
                              Rent Unit
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Lease Application Modal */}
      {applyingUnit && activeProperty && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-gray-100 relative animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => setApplyingUnit(null)}
              className="absolute top-5 right-5 p-2 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-2xl bg-[#0A4F4E]/10 text-[#0A4F4E] flex items-center justify-center">
                <Home className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-gray-950">Lease Application</h3>
                <p className="text-xs text-gray-500">
                  {activeProperty.name} · Unit {applyingUnit.unit_number}
                </p>
              </div>
            </div>

            <form onSubmit={handleConfirmLeaseApplication} className="space-y-4 text-xs">
              <div className="p-3.5 rounded-2xl bg-gray-50 border border-gray-200 space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-500">Monthly Rent:</span>
                  <strong className="text-gray-900 font-mono text-sm">${applyingUnit.monthly_rent_usdc} USDC</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Security Deposit:</span>
                  <strong className="text-gray-900 font-mono">${applyingUnit.security_deposit_usdc || applyingUnit.monthly_rent_usdc} USDC</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Applicant:</span>
                  <strong className="text-gray-900">{user?.email}</strong>
                </div>
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Desired Lease Start Date</label>
                <input
                  type="date"
                  required
                  value={leaseStartDate}
                  onChange={(e) => setLeaseStartDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 focus:border-[#0A4F4E] outline-none text-xs text-gray-900"
                />
              </div>

              <div className="pt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setApplyingUnit(null)}
                  className="flex-1 py-3 px-4 rounded-xl border border-gray-200 font-bold text-gray-700 hover:bg-gray-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingLease}
                  className="flex-1 py-3 px-4 rounded-xl bg-[#0A4F4E] hover:bg-[#083D3C] text-white font-extrabold text-xs shadow-md transition flex items-center justify-center gap-1.5"
                >
                  {submittingLease ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Confirm Lease
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lease Success Modal / Notification */}
      {leaseSuccessNotice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-gray-100 relative animate-in fade-in zoom-in-95 duration-200 text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-black text-gray-950 mb-1">Lease Activated!</h3>
            <p className="text-xs text-gray-600 mb-6">
              You are now assigned to <strong>Unit {leaseSuccessNotice.unit.unit_number}</strong> at {leaseSuccessNotice.property.name}. Your monthly rent obligations have been created.
            </p>

            <button
              onClick={() => {
                setLeaseSuccessNotice(null);
                setActiveProperty(null);
                navigateTo('tenant-home');
              }}
              className="w-full py-3.5 px-4 rounded-xl bg-[#0A4F4E] hover:bg-[#083D3C] text-white font-extrabold text-sm shadow-md transition flex items-center justify-center gap-2"
            >
              Go to My Rent & Pay USDC
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

