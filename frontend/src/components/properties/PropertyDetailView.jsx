import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import api from '../../services/api';
import {
  ArrowLeft,
  Share2,
  Heart,
  Building2,
  MapPin,
  Bed,
  Bath,
  Maximize,
  ShieldCheck,
  Star,
  CheckCircle2,
  Calendar,
  Sparkles,
  DollarSign,
  Copy,
  Check,
  ChevronRight,
  Wifi,
  Zap,
  Droplets,
  Dumbbell,
  Shield,
  Car,
  Home,
  AlertCircle,
  Loader2,
  LogIn,
} from 'lucide-react';

const FALLBACK_PROPERTY_IMAGES = [
  'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=80',
];

const AMENITY_LIST = [
  { icon: Shield, name: '24/7 Gated Security & CCTV' },
  { icon: Wifi, name: 'High-Speed Fiber Internet' },
  { icon: Zap, name: 'Backup Power Generator' },
  { icon: Droplets, name: 'Dedicated Borehole & Solar Water' },
  { icon: Dumbbell, name: 'Modern Fitness Center & Gym' },
  { icon: Car, name: 'Assigned Covered Parking' },
  { icon: Sparkles, name: 'Swimming Pool & Sun Deck' },
  { icon: Home, name: 'Private Balcony / Terrace' },
];

export default function PropertyDetailView() {
  const {
    selectedProperty: ctxSelectedProperty,
    navigateTo,
    user,
  } = useApp();

  const [property, setProperty] = useState(ctxSelectedProperty || null);
  const [units, setUnits] = useState([]);
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const [loading, setLoading] = useState(!ctxSelectedProperty);
  const [isSaved, setIsSaved] = useState(false);
  const [copiedWallet, setCopiedWallet] = useState(false);
  const [shareToast, setShareToast] = useState(false);

  // Lease booking state
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  });
  const [submittingLease, setSubmittingLease] = useState(false);
  const [leaseSuccessNotice, setLeaseSuccessNotice] = useState(null);
  const [leaseError, setLeaseError] = useState(null);

  // Load property & units from backend if needed or on initial mount
  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        let currentProp = ctxSelectedProperty;
        const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
        const queryPropId = urlParams?.get('propertyId') || urlParams?.get('id');

        if (!currentProp && queryPropId) {
          const fetched = await api.properties.get(queryPropId);
          currentProp = fetched;
          if (isMounted) setProperty(fetched);
        } else if (!currentProp) {
          const list = await api.properties.list();
          const props = Array.isArray(list) ? list : list?.results || [];
          if (props.length > 0) {
            currentProp = props[0];
            if (isMounted) setProperty(props[0]);
          }
        }

        if (currentProp?.id) {
          // Fetch units for this property
          try {
            const unitsData = await api.properties.getUnits(currentProp.id);
            const unitsList = Array.isArray(unitsData) ? unitsData : unitsData?.results || [];
            if (isMounted) {
              setUnits(unitsList);
              const firstVacant = unitsList.find((u) => !u.is_occupied) || unitsList[0];
              setSelectedUnit(firstVacant || null);
            }
          } catch (e) {
            if (isMounted && currentProp.units) {
              setUnits(currentProp.units);
              const firstVacant = currentProp.units.find((u) => !u.is_occupied) || currentProp.units[0];
              setSelectedUnit(firstVacant || null);
            }
          }
        }
      } catch (err) {
        console.error('Failed to load property details:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, [ctxSelectedProperty]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-8">
        <div className="w-10 h-10 border-3 border-[#0A4F4E] border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm text-gray-500 font-semibold">Loading property specifications...</p>
      </div>
    );
  }

  if (!property) {
    return (
      <div className="max-w-3xl mx-auto py-16 px-4 text-center">
        <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-gray-900 mb-2">Property Not Found</h2>
        <p className="text-gray-500 text-sm mb-6">The property details could not be loaded from the registry.</p>
        <button
          onClick={() => navigateTo('properties')}
          className="bg-[#0A4F4E] hover:bg-[#083e3d] text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow transition"
        >
          Return to Properties Catalog
        </button>
      </div>
    );
  }

  const images = property.images && property.images.length > 0 ? property.images : [property.image_url || FALLBACK_PROPERTY_IMAGES[0], ...FALLBACK_PROPERTY_IMAGES.slice(1)];
  const currentImage = images[activeImageIdx] || images[0];

  const totalUnits = units.length || property.total_units_count || 1;
  const occupiedUnits = units.filter((u) => u.is_occupied).length;
  const availableUnitsCount = Math.max(0, totalUnits - occupiedUnits);

  const formatRentPrice = (val) => {
    if (val === null || val === undefined || val === '') return '0';
    const num = Number(val);
    if (isNaN(num)) return '0';
    return num.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  };

  const rawRent = selectedUnit?.rent_amount_usdc ?? selectedUnit?.monthly_rent_usdc;
  const monthlyRent = rawRent !== undefined && rawRent !== null ? Number(rawRent) : 0;
  const rawDeposit = selectedUnit?.deposit_amount_usdc ?? selectedUnit?.security_deposit_usdc;
  const securityDeposit = rawDeposit !== undefined && rawDeposit !== null ? Number(rawDeposit) : monthlyRent;
  const totalDueNow = (monthlyRent + securityDeposit).toFixed(2);

  const handleCopyWallet = () => {
    if (property.receiving_wallet) {
      navigator.clipboard.writeText(property.receiving_wallet);
      setCopiedWallet(true);
      setTimeout(() => setCopiedWallet(false), 2000);
    }
  };

  const handleShare = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      setShareToast(true);
      setTimeout(() => setShareToast(false), 2500);
    }
  };

  const handleApplyForLease = async (e) => {
    e.preventDefault();
    setLeaseError(null);

    if (!user?.isLoggedIn) {
      navigateTo('login');
      return;
    }

    if (!selectedUnit) {
      setLeaseError('Please select an available unit to lease.');
      return;
    }

    if (selectedUnit.is_occupied) {
      setLeaseError('The selected unit is already occupied. Please select an available unit.');
      return;
    }

    setSubmittingLease(true);
    try {
      const assignment = await api.assignments.create({
        property: property.id,
        unit: selectedUnit.id,
        rent_amount_usdc: selectedUnit.rent_amount_usdc,
        deposit_amount_usdc: selectedUnit.deposit_amount_usdc || selectedUnit.rent_amount_usdc,
        monthly_due_day: 1,
        start_date: startDate,
      });

      setLeaseSuccessNotice({
        unitNumber: selectedUnit.unit_number,
        propertyName: property.name,
        assignmentCode: assignment?.assignment_code,
      });

      // Update unit status locally
      setUnits((prev) =>
        prev.map((u) => (u.id === selectedUnit.id ? { ...u, is_occupied: true, current_tenant: user } : u))
      );

      // Auto redirect to tenant-home after 1.8 seconds
      setTimeout(() => {
        navigateTo('tenant-home');
      }, 1800);
    } catch (err) {
      console.error('Failed to submit lease application:', err);
      setLeaseError(err.message || 'Failed to submit lease application. Please try again.');
    } finally {
      setSubmittingLease(false);
    }
  };

  return (
    <div className="bg-[#fafbfb] min-h-screen pb-24 text-gray-900">
      {/* Share Toast */}
      {shareToast && (
        <div className="fixed top-24 right-6 z-50 bg-gray-900 text-white px-4 py-2.5 rounded-xl shadow-2xl text-xs font-bold flex items-center gap-2 animate-bounce">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>Property preview link copied to clipboard!</span>
        </div>
      )}

      {/* Breadcrumb / Top Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 flex items-center justify-between">
        <button
          onClick={() => navigateTo('properties')}
          className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-gray-600 hover:text-gray-950 transition group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span>Back to Properties</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={handleShare}
            className="w-9 h-9 rounded-full bg-white border border-gray-200 shadow-2xs flex items-center justify-center text-gray-600 hover:text-gray-950 hover:bg-gray-50 transition"
            title="Share Property"
          >
            <Share2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsSaved(!isSaved)}
            className={`w-9 h-9 rounded-full bg-white border border-gray-200 shadow-2xs flex items-center justify-center transition ${
              isSaved ? 'text-rose-500 fill-rose-500' : 'text-gray-600 hover:text-rose-500'
            }`}
            title="Save Property"
          >
            <Heart className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column (8 cols): Photo Gallery & Specs & Units */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-8">
          {/* Hero Image Showcase */}
          <div className="relative rounded-3xl overflow-hidden bg-neutral-900 shadow-lg border border-black/5 aspect-[16/10] sm:aspect-[16/9]">
            <img
              src={currentImage}
              alt={property.name}
              className="w-full h-full object-cover transition-opacity duration-300"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20 pointer-events-none" />

            {/* Badges on top */}
            <div className="absolute top-4 left-4 flex items-center gap-2">
              <span className="bg-white/95 backdrop-blur-md text-gray-900 font-extrabold text-[11px] uppercase tracking-wider px-3 py-1 rounded-full shadow-md">
                {property.property_type || 'Luxury Residence'}
              </span>
              <span className="bg-[#0A4F4E]/90 backdrop-blur-md text-white font-bold text-[11px] px-3 py-1 rounded-full shadow-md flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                Verified Listing
              </span>
            </div>

            {/* Photo Counter */}
            <div className="absolute bottom-4 right-4 bg-black/60 backdrop-blur-md text-white text-xs font-semibold px-3 py-1 rounded-full shadow">
              {activeImageIdx + 1} / {images.length}
            </div>
          </div>

          {/* Thumbnails Row */}
          {images.length > 1 && (
            <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-thin">
              {images.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveImageIdx(idx)}
                  className={`relative w-20 h-14 sm:w-24 sm:h-16 rounded-xl overflow-hidden shrink-0 border-2 transition ${
                    activeImageIdx === idx ? 'border-[#0A4F4E] ring-2 ring-[#0A4F4E]/20 scale-105' : 'border-transparent opacity-75 hover:opacity-100'
                  }`}
                >
                  <img src={img} alt={`Thumb ${idx}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}

          {/* Property Title & Address */}
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 mb-2">
              <MapPin className="w-4 h-4 text-[#0A4F4E] shrink-0" />
              <span>
                {property.address ? `${property.address}, ` : ''}
                {property.city || 'Nairobi'}, {property.country || 'Kenya'}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-gray-950 tracking-tight">
              {property.name}
            </h1>
          </div>

          {/* 3 Soft Highlight Cards (Just like VehicleDetailView) */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-[#f0f6f4] border border-emerald-500/10 rounded-2xl p-3 sm:p-4 flex flex-col sm:flex-row items-center justify-center gap-2 text-center sm:text-left shadow-2xs">
              <Building2 className="w-5 h-5 text-[#0A4F4E] shrink-0" />
              <div>
                <span className="block text-xs sm:text-sm font-bold text-gray-900">{totalUnits} Units</span>
                <span className="text-[10px] sm:text-xs text-emerald-700 font-semibold">{availableUnitsCount} available</span>
              </div>
            </div>

            <div className="bg-[#f0f6f4] border border-emerald-500/10 rounded-2xl p-3 sm:p-4 flex flex-col sm:flex-row items-center justify-center gap-2 text-center sm:text-left shadow-2xs">
              <Star className="w-5 h-5 text-amber-500 shrink-0 fill-amber-500" />
              <div>
                <span className="block text-xs sm:text-sm font-bold text-gray-900">★ 4.95 / 5.0</span>
                <span className="text-[10px] sm:text-xs text-gray-500">Verified Tenants</span>
              </div>
            </div>

            <div className="bg-[#f0f6f4] border border-emerald-500/10 rounded-2xl p-3 sm:p-4 flex flex-col sm:flex-row items-center justify-center gap-2 text-center sm:text-left shadow-2xs">
              <ShieldCheck className="w-5 h-5 text-[#0A4F4E] shrink-0" />
              <div>
                <span className="block text-xs sm:text-sm font-bold text-gray-900">Stellar Testnet</span>
                <span className="text-[10px] sm:text-xs text-emerald-700 font-semibold">Instant Escrow</span>
              </div>
            </div>
          </div>

          {/* Landlord Info Card */}
          <div className="bg-white border border-gray-200/80 rounded-2xl p-4 sm:p-5 flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-[#0A4F4E] to-emerald-600 text-white font-bold flex items-center justify-center text-base shadow-sm">
                {(property.landlord_name || property.landlord_email || 'L').charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm sm:text-base text-gray-950">
                    Managed by {property.landlord_name || property.landlord_email?.split('@')[0] || 'Property Landlord'}
                  </span>
                  <CheckCircle2 className="w-4 h-4 text-[#0A4F4E]" />
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  Verified Landlord · Direct USDC Settlements on Stellar
                </p>
              </div>
            </div>
            <span className="hidden sm:inline-block text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-3 py-1 rounded-full">
              Responsive Host
            </span>
          </div>

          {/* Description */}
          <div className="bg-white border border-gray-200/80 rounded-3xl p-6 shadow-xs space-y-3">
            <h2 className="text-lg font-bold text-gray-950">About This Residence</h2>
            <p className="text-sm text-gray-600 leading-relaxed">
              {property.description ||
                `${property.name} offers contemporary luxury living in the vibrant heart of ${property.city || 'Nairobi'}. Built with premium architecture, uninterrupted utilities, and automated blockchain-verified rent payment reconciliation powered by Stellar.`}
            </p>
          </div>

          {/* Available Units Selection Grid */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-950">Select Rental Unit</h2>
                <p className="text-xs text-gray-500">Choose an available unit to review pricing and start your lease application.</p>
              </div>
              <span className="text-xs font-bold text-[#0A4F4E] bg-[#f0f6f4] px-3 py-1 rounded-full border border-emerald-500/10">
                {availableUnitsCount} available of {totalUnits}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {units.map((unit) => {
                const isSelected = selectedUnit?.id === unit.id;
                const isOccupied = unit.is_occupied;

                return (
                  <div
                    key={unit.id}
                    onClick={() => {
                      if (!isOccupied) setSelectedUnit(unit);
                    }}
                    className={`relative rounded-2xl p-5 border transition-all text-left ${
                      isOccupied
                        ? 'bg-gray-50/70 border-gray-200/60 opacity-60 cursor-not-allowed'
                        : isSelected
                        ? 'bg-[#f0f6f4]/90 border-[#0A4F4E] ring-2 ring-[#0A4F4E]/20 shadow-md cursor-pointer'
                        : 'bg-white border-gray-200 hover:border-[#0A4F4E]/60 shadow-xs cursor-pointer hover:shadow-md'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-base text-gray-950">
                            {unit.unit_number}
                          </span>
                          {isSelected && (
                            <span className="bg-[#0A4F4E] text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                              Selected
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-gray-500 block mt-0.5">
                          {unit.floor ? `${unit.floor} · ` : ''}{unit.square_feet ? `${unit.square_feet} sq ft` : 'Standard Layout'}
                        </span>
                      </div>

                      <span
                        className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${
                          isOccupied
                            ? 'bg-gray-200 text-gray-600'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {isOccupied ? 'Occupied' : 'Available'}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-gray-600 mb-4 pt-2 border-t border-gray-100">
                      <div className="flex items-center gap-1.5 font-medium">
                        <Bed className="w-4 h-4 text-gray-400" />
                        <span>{unit.bedrooms} {unit.bedrooms === 1 ? 'Bedroom' : 'Bedrooms'}</span>
                      </div>
                      <div className="flex items-center gap-1.5 font-medium">
                        <Bath className="w-4 h-4 text-gray-400" />
                        <span>{unit.bathrooms} {Number(unit.bathrooms) === 1 ? 'Bath' : 'Baths'}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                      <div>
                        <span className="text-[11px] text-gray-400 block font-medium">Monthly Rent</span>
                        <div className="flex items-baseline gap-1">
                          <span className="text-lg font-black text-gray-950">
                            ${formatRentPrice(unit.rent_amount_usdc ?? unit.monthly_rent_usdc)}
                          </span>
                          <span className="text-[11px] font-bold text-gray-500">USDC</span>
                        </div>
                      </div>

                      {!isOccupied && (
                        <button
                          type="button"
                          className={`text-xs font-bold px-3 py-1.5 rounded-lg transition ${
                            isSelected
                              ? 'bg-[#0A4F4E] text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {isSelected ? 'Ready to Apply' : 'Select Unit'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Amenities & Residence Features */}
          <div className="bg-white border border-gray-200/80 rounded-3xl p-6 shadow-xs space-y-4">
            <h2 className="text-lg font-bold text-gray-950">Features & Building Amenities</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {AMENITY_LIST.map((amenity, i) => {
                const Icon = amenity.icon;
                return (
                  <div
                    key={i}
                    className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100"
                  >
                    <div className="w-8 h-8 rounded-lg bg-white shadow-2xs border border-gray-200 flex items-center justify-center text-[#0A4F4E]">
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-bold text-gray-800">{amenity.name}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Stellar Smart Contract Verification Box */}
          <div className="bg-gradient-to-r from-emerald-950 to-[#0A4F4E] rounded-3xl p-6 text-white shadow-md space-y-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              <h3 className="font-bold text-base">On-Chain Stellar Escrow & Instant Receipts</h3>
            </div>
            <p className="text-xs text-emerald-100/90 leading-relaxed">
              Rent obligations are scheduled on the Stellar Testnet. When you pay from any Stellar wallet using your custom payment memo, transactions reconcile automatically within 5 seconds and issue cryptographically verifiable PDF receipts.
            </p>

            {property.receiving_wallet && (
              <div className="pt-2">
                <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-300 block mb-1">
                  Receiving Stellar Merchant Address
                </span>
                <div className="flex items-center gap-2 bg-black/30 backdrop-blur-sm p-2.5 rounded-xl border border-white/10 font-mono text-xs">
                  <span className="truncate text-emerald-200">{property.receiving_wallet}</span>
                  <button
                    onClick={handleCopyWallet}
                    className="shrink-0 p-1 rounded-md bg-white/10 hover:bg-white/20 text-white transition"
                    title="Copy Address"
                  >
                    {copiedWallet ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column (4 cols): Sticky Rental Booking & Lease Card */}
        <div className="lg:col-span-5 xl:col-span-4 sticky top-24 space-y-4">
          <div className="bg-white border border-gray-200/90 rounded-3xl p-6 shadow-xl space-y-5">
            <div className="border-b border-gray-100 pb-4">
              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full uppercase tracking-wider">
                Lease Application
              </span>
              <div className="mt-3 flex items-baseline justify-between">
                <div>
                  <span className="text-2xl sm:text-3xl font-black text-gray-950">
                    ${formatRentPrice(monthlyRent)}
                  </span>
                  <span className="text-xs font-bold text-gray-500 ml-1">USDC / month</span>
                </div>
                {selectedUnit && (
                  <span className="text-xs font-extrabold text-[#0A4F4E] bg-[#f0f6f4] px-2.5 py-1 rounded-lg">
                    {selectedUnit.unit_number}
                  </span>
                )}
              </div>
            </div>

            {/* Error notice */}
            {leaseError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-xl text-xs font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{leaseError}</span>
              </div>
            )}

            {/* Success notice */}
            {leaseSuccessNotice && (
              <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 p-4 rounded-xl text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-emerald-800">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Lease Application Approved!</span>
                </div>
                <p>
                  You are now assigned to <b>{leaseSuccessNotice.unitNumber}</b> at {leaseSuccessNotice.propertyName}.
                </p>
                <p className="text-[11px] text-emerald-700 pt-1">
                  Redirecting to your Tenant Rent Dashboard...
                </p>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleApplyForLease} className="space-y-4">
              {/* Unit selection reminder if none selected */}
              {!selectedUnit && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 font-medium">
                  Please select a unit from the available units list above.
                </div>
              )}

              {/* Start Date */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-[#0A4F4E]" />
                  <span>Lease Start Date</span>
                </label>
                <input
                  type="date"
                  value={startDate}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#0A4F4E]"
                  required
                />
              </div>

              {/* Payment Frequency */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  Payment Frequency
                </label>
                <div className="px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 flex items-center justify-between">
                  <span>Monthly (Due on 1st of each month)</span>
                  <Check className="w-4 h-4 text-[#0A4F4E]" />
                </div>
              </div>

              {/* Price Breakdown */}
              <div className="bg-gray-50 rounded-2xl p-4 space-y-2.5 text-xs border border-gray-100">
                <div className="flex items-center justify-between text-gray-600">
                  <span>First Month Rent</span>
                  <span className="font-bold text-gray-900">${monthlyRent.toFixed(2)} USDC</span>
                </div>
                <div className="flex items-center justify-between text-gray-600">
                  <span>Refundable Security Deposit</span>
                  <span className="font-bold text-gray-900">${securityDeposit.toFixed(2)} USDC</span>
                </div>
                <div className="flex items-center justify-between text-gray-600">
                  <span>Stellar Protocol Settlement Fee</span>
                  <span className="font-bold text-emerald-700">0.00 USDC (Free)</span>
                </div>
                <div className="pt-2 border-t border-gray-200 flex items-center justify-between text-sm font-black text-gray-950">
                  <span>Total Due at Signing</span>
                  <span className="text-[#0A4F4E]">${totalDueNow} USDC</span>
                </div>
              </div>

              {/* CTA Button */}
              {user?.isLoggedIn ? (
                <button
                  type="submit"
                  disabled={submittingLease || !selectedUnit || selectedUnit.is_occupied}
                  className="w-full py-3.5 px-4 bg-[#0A4F4E] hover:bg-[#083e3d] disabled:bg-gray-300 text-white font-extrabold text-sm rounded-xl shadow-lg transition flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
                >
                  {submittingLease ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Creating Lease Agreement...</span>
                    </>
                  ) : (
                    <>
                      <span>Apply for Lease & Move In</span>
                      <ChevronRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => navigateTo('login')}
                  className="w-full py-3.5 px-4 bg-gray-900 hover:bg-black text-white font-extrabold text-sm rounded-xl shadow-lg transition flex items-center justify-center gap-2"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Sign In to Rent Unit</span>
                </button>
              )}
            </form>

            <div className="text-center pt-2">
              <span className="text-[11px] text-gray-400 font-medium">
                🔒 Protected by Stellar Testnet Smart Contracts & Escrow
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

