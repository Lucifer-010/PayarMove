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
  UploadCloud,
  Image as ImageIcon,
  Trash2,
  Star,
  Sparkles,
  Eye,
  Check,
} from 'lucide-react';
import api from '../../services/api';
import { useApp } from '../../context/AppContext';

const SAMPLE_PRESET_IMAGES = {
  apartment: [
    'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1200&q=80',
  ],
  villa: [
    'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=80',
  ],
  penthouse: [
    'https://images.unsplash.com/photo-1512918728675-ed5a9ecdebfd?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1600566753376-12c8ab7fb75b?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1600573472591-ee6b68d14c68?auto=format&fit=crop&w=1200&q=80',
  ],
};

export default function LandlordPropertiesView() {
  const { user, navigateTo } = useApp();
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedPropertyUnits, setSelectedPropertyUnits] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  // Image URL input helper
  const [customImageUrl, setCustomImageUrl] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    property_type: 'APARTMENT',
    description: '',
    address: '',
    city: 'Nairobi',
    country: 'Kenya',
    receiving_wallet: user?.primary_stellar_address || user?.walletAddress || '',
    image_url: '',
    images: [],
    units: [
      { unit_number: '1A', bedrooms: 2, bathrooms: 2, monthly_rent_usdc: 500, security_deposit_usdc: 500 },
      { unit_number: '1B', bedrooms: 1, bathrooms: 1, monthly_rent_usdc: 350, security_deposit_usdc: 350 },
    ],
  });

  const formatRentPrice = (val) => {
    if (val === null || val === undefined || val === '') return '0';
    const num = Number(val);
    if (isNaN(num)) return '0';
    return num.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  };

  const getPropertyPriceDisplay = (prop) => {
    if (prop.price_display) return `${prop.price_display} USDC/mo`;
    const units = prop.units || [];
    if (units.length > 0) {
      const rents = units
        .map((u) => Number(u.rent_amount_usdc ?? u.monthly_rent_usdc ?? 0))
        .filter((r) => r > 0);
      if (rents.length > 0) {
        const min = Math.min(...rents);
        const max = Math.max(...rents);
        if (min === max) return `$${formatRentPrice(min)} USDC/mo`;
        return `From $${formatRentPrice(min)} USDC/mo`;
      }
    }
    if (prop.min_rent_usdc) {
      return `From $${formatRentPrice(prop.min_rent_usdc)} USDC/mo`;
    }
    return null;
  };

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

  // Image Upload Handlers
  const handlePhotoFiles = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (uploadEvent) => {
        const dataUrl = uploadEvent.target?.result;
        if (dataUrl) {
          setFormData((prev) => {
            const nextImages = [...prev.images, dataUrl];
            return {
              ...prev,
              images: nextImages,
              image_url: prev.image_url || dataUrl,
            };
          });
        }
      };
      reader.readAsDataURL(file);
    });
    // Reset file input
    e.target.value = '';
  };

  const handleAddCustomImageUrl = (e) => {
    if (e) e.preventDefault();
    const url = customImageUrl.trim();
    if (!url) return;

    setFormData((prev) => {
      const nextImages = [...prev.images, url];
      return {
        ...prev,
        images: nextImages,
        image_url: prev.image_url || url,
      };
    });
    setCustomImageUrl('');
  };

  const handleRemoveImage = (indexToRemove) => {
    setFormData((prev) => {
      const nextImages = prev.images.filter((_, idx) => idx !== indexToRemove);
      return {
        ...prev,
        images: nextImages,
        image_url: nextImages[0] || '',
      };
    });
  };

  const handleSetCoverPhoto = (index) => {
    setFormData((prev) => {
      const chosen = prev.images[index];
      const remaining = prev.images.filter((_, idx) => idx !== index);
      const nextImages = [chosen, ...remaining];
      return {
        ...prev,
        images: nextImages,
        image_url: chosen,
      };
    });
  };

  const handleApplyPresetPhotos = (presetKey) => {
    const preset = SAMPLE_PRESET_IMAGES[presetKey] || [];
    setFormData((prev) => ({
      ...prev,
      images: [...prev.images, ...preset],
      image_url: prev.image_url || preset[0] || '',
    }));
  };

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
    if (!formData.name.trim() || !formData.address.trim()) {
      alert('Please fill in Property Name and Address.');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        ...formData,
        image_url: formData.images[0] || formData.image_url || '',
        images: formData.images,
      };
      await api.properties.create(payload);
      setModalOpen(false);
      setFormData({
        name: '',
        property_type: 'APARTMENT',
        description: '',
        address: '',
        city: 'Nairobi',
        country: 'Kenya',
        receiving_wallet: user?.primary_stellar_address || user?.walletAddress || '',
        image_url: '',
        images: [],
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
            Configure rental units, high-resolution media, and dedicated Stellar Testnet receiving wallets
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchProperties}
            disabled={loading}
            className="p-2.5 rounded-xl bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 shadow-2xs transition"
            title="Refresh"
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
            Add your first property with photos and rental units to start collecting rent in digital USDC on Stellar.
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
          {properties.map((prop) => {
            const coverPhoto = prop.image_url || (prop.images && prop.images[0]) || null;

            return (
              <div
                key={prop.id}
                className="bg-white rounded-3xl overflow-hidden border border-gray-200/80 shadow-2xs hover:shadow-md transition flex flex-col justify-between group"
              >
                <div>
                  {/* Property Cover Image Preview Header */}
                  {coverPhoto ? (
                    <div className="relative h-44 w-full overflow-hidden bg-neutral-900">
                      <img
                        src={coverPhoto}
                        alt={prop.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                      <div className="absolute top-3 left-3 flex items-center gap-2">
                        <span className="bg-white/95 text-gray-900 font-extrabold text-[10px] uppercase px-2.5 py-0.5 rounded-full shadow">
                          {prop.property_type || 'Apartment'}
                        </span>
                        {prop.images && prop.images.length > 1 && (
                          <span className="bg-black/60 text-white font-semibold text-[10px] px-2 py-0.5 rounded-full backdrop-blur-xs">
                            {prop.images.length} Photos
                          </span>
                        )}
                      </div>
                      <div className="absolute bottom-3 left-4 right-4 text-white">
                        <h3 className="text-lg font-black text-white drop-shadow-sm">{prop.name}</h3>
                        <div className="text-xs text-gray-200 flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span>{prop.address}, {prop.city}</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-6 pb-0">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="w-12 h-12 rounded-2xl bg-[#0A4F4E]/10 text-[#0A4F4E] flex items-center justify-center shrink-0">
                          <Building2 className="w-6 h-6" />
                        </div>
                        <span className="text-xs font-extrabold px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full">
                          {prop.total_units_count || prop.units_count || (prop.units && prop.units.length) || 1} Units
                        </span>
                      </div>
                      <h3 className="text-lg font-black text-gray-900">{prop.name}</h3>
                      <div className="text-xs text-gray-500 mt-1 flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        <span>{prop.address}, {prop.city}</span>
                      </div>
                    </div>
                  )}

                  <div className="p-6 pt-4 space-y-3">
                    <div className="flex items-center justify-between text-xs text-gray-500 pb-1">
                      <span className="font-semibold text-gray-700">Units:</span>
                      <span className="font-extrabold text-[#0A4F4E] bg-[#f0f6f4] px-2.5 py-0.5 rounded-full">
                        {prop.total_units_count || prop.units_count || (prop.units && prop.units.length) || 1} Total Units
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs pb-1 border-b border-gray-100">
                      <span className="font-semibold text-gray-700">Monthly Rent:</span>
                      <span className="font-mono font-black text-xs text-[#0A4F4E]">
                        {getPropertyPriceDisplay(prop) || 'Units registered'}
                      </span>
                    </div>

                    <div className="p-3 rounded-2xl bg-gray-50 border border-gray-200 text-xs">
                      <div className="flex items-center gap-1.5 text-gray-500 mb-1 font-semibold">
                        <Wallet className="w-3.5 h-3.5 text-gray-400" />
                        <span>Receiving Stellar Wallet:</span>
                      </div>
                      <div className="font-mono text-[11px] text-gray-800 break-all select-all font-bold">
                        {prop.receiving_wallet}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between bg-gray-50/50">
                  <span className="text-xs font-bold text-gray-500">
                    Occupied: <strong className="text-gray-900">{prop.occupied_units_count || 0} / {prop.total_units_count || prop.units_count || (prop.units && prop.units.length) || 1}</strong>
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => navigateTo('property-detail', prop)}
                      className="px-3 py-1.5 rounded-xl bg-white border border-gray-200 hover:bg-gray-100 text-xs font-bold text-gray-700 transition flex items-center gap-1"
                      title="Preview public listing"
                    >
                      <Eye className="w-3.5 h-3.5 text-gray-500" />
                      Preview
                    </button>
                    <button
                      onClick={() => handleViewUnits(prop)}
                      className="px-3.5 py-1.5 rounded-xl bg-[#0A4F4E] hover:bg-[#083D3C] text-xs font-bold text-white transition"
                    >
                      View Units & Rent
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Property Modal with Comprehensive Image Collection */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-gray-100 relative animate-in fade-in zoom-in-95 duration-200 max-h-[92vh] overflow-y-auto">
            <button
              onClick={() => setModalOpen(false)}
              className="absolute top-5 right-5 p-2 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="w-11 h-11 rounded-2xl bg-[#0A4F4E]/10 text-[#0A4F4E] flex items-center justify-center">
                <Building2 className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-extrabold text-gray-950">Add Rental Property</h2>
                <p className="text-xs text-gray-500">Define building specifications, media gallery & rental units</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5 text-xs">
              {/* Row 1: Name and Type */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block font-bold text-gray-700 mb-1">Property Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Kilimani Palm Residences"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 focus:border-[#0A4F4E] focus:ring-2 focus:ring-[#0A4F4E]/20 outline-none text-xs text-gray-900 font-semibold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">Property Type</label>
                  <select
                    value={formData.property_type}
                    onChange={(e) => setFormData({ ...formData, property_type: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-300 focus:border-[#0A4F4E] focus:ring-2 focus:ring-[#0A4F4E]/20 outline-none text-xs text-gray-900 font-semibold bg-white"
                  >
                    <option value="APARTMENT">Apartment / Flat</option>
                    <option value="VILLA">Luxury Villa</option>
                    <option value="RESIDENTIAL_HOUSE">Single-Family House</option>
                    <option value="MULTI_FAMILY">Multi-Family Complex</option>
                    <option value="COMMERCIAL">Commercial / Office</option>
                    <option value="STUDIO">Studio Unit</option>
                  </select>
                </div>
              </div>

              {/* Row 2: Location */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Street Address *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 14 Argwings Kodhek Rd, Kilimani"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 focus:border-[#0A4F4E] focus:ring-2 focus:ring-[#0A4F4E]/20 outline-none text-xs text-gray-900"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">City / Region *</label>
                  <input
                    type="text"
                    required
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 focus:border-[#0A4F4E] focus:ring-2 focus:ring-[#0A4F4E]/20 outline-none text-xs text-gray-900"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block font-bold text-gray-700 mb-1">Property Description</label>
                <textarea
                  rows={2}
                  placeholder="Describe architectural features, security, views, utilities, and location perks..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-gray-300 focus:border-[#0A4F4E] focus:ring-2 focus:ring-[#0A4F4E]/20 outline-none text-xs text-gray-900 resize-none"
                />
              </div>

              {/* Dedicated Images Collection Section */}
              <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200/90 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-[#0A4F4E]" />
                    <label className="font-extrabold text-gray-900 text-xs">
                      Property Photos & Gallery
                    </label>
                  </div>
                  <span className="text-[11px] font-bold text-gray-500">
                    {formData.images.length} {formData.images.length === 1 ? 'photo' : 'photos'} added
                  </span>
                </div>
                <p className="text-[11px] text-gray-500">
                  Upload property photos or paste direct image URLs. The first image will be displayed as the main listing cover.
                </p>

                {/* Upload & URL Input Tools */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* File Upload Box */}
                  <label className="border-2 border-dashed border-gray-300 hover:border-[#0A4F4E] bg-white rounded-xl p-3 flex flex-col items-center justify-center text-center cursor-pointer transition group">
                    <UploadCloud className="w-5 h-5 text-gray-400 group-hover:text-[#0A4F4E] mb-1" />
                    <span className="font-bold text-[11px] text-gray-700 group-hover:text-[#0A4F4E]">
                      Upload Photos from Device
                    </span>
                    <span className="text-[10px] text-gray-400">PNG, JPG, WEBP (multiple)</span>
                    <input
                      type="file"
                      multiple
                      accept="image/png, image/jpeg, image/webp"
                      onChange={handlePhotoFiles}
                      className="hidden"
                    />
                  </label>

                  {/* Direct URL Input */}
                  <div className="bg-white border border-gray-200 rounded-xl p-3 flex flex-col justify-between">
                    <span className="font-bold text-[11px] text-gray-700 block mb-1">
                      Add Photo by URL
                    </span>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="url"
                        placeholder="https://images.unsplash.com/..."
                        value={customImageUrl}
                        onChange={(e) => setCustomImageUrl(e.target.value)}
                        className="flex-1 px-2.5 py-1.5 rounded-lg border border-gray-200 text-[11px] outline-none focus:border-[#0A4F4E]"
                      />
                      <button
                        type="button"
                        onClick={handleAddCustomImageUrl}
                        className="px-2.5 py-1.5 rounded-lg bg-[#0A4F4E] text-white font-bold text-[11px] hover:bg-[#083D3C] transition shrink-0"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </div>

                {/* Quick Stock Presets */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Quick Presets:</span>
                  <button
                    type="button"
                    onClick={() => handleApplyPresetPhotos('apartment')}
                    className="px-2.5 py-1 rounded-full bg-white border border-gray-200 hover:bg-gray-100 text-[10px] font-bold text-gray-700 transition"
                  >
                    🏢 Modern Apartment
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPresetPhotos('villa')}
                    className="px-2.5 py-1 rounded-full bg-white border border-gray-200 hover:bg-gray-100 text-[10px] font-bold text-gray-700 transition"
                  >
                    🏡 Luxury Villa
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPresetPhotos('penthouse')}
                    className="px-2.5 py-1 rounded-full bg-white border border-gray-200 hover:bg-gray-100 text-[10px] font-bold text-gray-700 transition"
                  >
                    ✨ Penthouse
                  </button>
                </div>

                {/* Uploaded Photos Preview Strip */}
                {formData.images.length > 0 && (
                  <div className="pt-2">
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                      {formData.images.map((img, idx) => {
                        const isCover = idx === 0;
                        return (
                          <div
                            key={idx}
                            className={`relative rounded-xl overflow-hidden aspect-video bg-gray-200 border-2 group shadow-2xs ${
                              isCover ? 'border-[#0A4F4E] ring-2 ring-[#0A4F4E]/20' : 'border-gray-200'
                            }`}
                          >
                            <img src={img} alt={`Property upload ${idx}`} className="w-full h-full object-cover" />

                            {/* Cover Pill */}
                            {isCover && (
                              <span className="absolute top-1 left-1 bg-[#0A4F4E] text-white text-[9px] font-black px-1.5 py-0.5 rounded shadow">
                                Cover Photo
                              </span>
                            )}

                            {/* Overlay Controls */}
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 p-1">
                              {!isCover && (
                                <button
                                  type="button"
                                  onClick={() => handleSetCoverPhoto(idx)}
                                  className="p-1 rounded bg-white text-gray-900 text-[9px] font-bold hover:bg-emerald-50 hover:text-emerald-700 transition"
                                  title="Set as Cover Photo"
                                >
                                  Make Cover
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleRemoveImage(idx)}
                                className="p-1 rounded bg-rose-600 text-white hover:bg-rose-700 transition"
                                title="Remove Image"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Receiving Stellar Wallet */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-bold text-gray-700">
                    Stellar Receiving Wallet (Owner Payout Address)
                  </label>
                  <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                    Auto-synced with Owner Wallet
                  </span>
                </div>
                <input
                  type="text"
                  placeholder="Auto-retrieved from owner wallet (or custom G... address)"
                  value={formData.receiving_wallet}
                  onChange={(e) => setFormData({ ...formData, receiving_wallet: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 focus:border-[#0A4F4E] focus:ring-2 focus:ring-[#0A4F4E]/20 outline-none text-xs font-mono text-gray-900 font-semibold"
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  Automatically defaults to your verified owner wallet. If you update your wallet or an admin reassigns the property, obligations auto-sync to the current owner.
                </p>
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
                        <label className="text-[10px] text-gray-400 block font-semibold">Unit #</label>
                        <input
                          type="text"
                          value={unit.unit_number}
                          onChange={(e) => handleUnitChange(idx, 'unit_number', e.target.value)}
                          className="w-full px-2 py-1 rounded-lg border border-gray-200 font-bold text-xs"
                        />
                      </div>
                      <div className="w-16">
                        <label className="text-[10px] text-gray-400 block font-semibold">Beds</label>
                        <input
                          type="number"
                          value={unit.bedrooms}
                          onChange={(e) => handleUnitChange(idx, 'bedrooms', Number(e.target.value))}
                          className="w-full px-2 py-1 rounded-lg border border-gray-200 text-xs font-bold"
                        />
                      </div>
                      <div className="w-16">
                        <label className="text-[10px] text-gray-400 block font-semibold">Baths</label>
                        <input
                          type="number"
                          value={unit.bathrooms}
                          onChange={(e) => handleUnitChange(idx, 'bathrooms', Number(e.target.value))}
                          className="w-full px-2 py-1 rounded-lg border border-gray-200 text-xs font-bold"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="text-[10px] text-gray-400 block font-semibold">Monthly Rent (USDC)</label>
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
                          title="Remove unit"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="pt-4 flex justify-end gap-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-gray-200 font-bold text-gray-700 hover:bg-gray-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-[#0A4F4E] hover:bg-[#083D3C] text-white font-extrabold shadow-md flex items-center gap-1.5 transition"
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
                    <div className="font-mono text-sm font-black text-gray-900">
                      ${formatRentPrice(u.rent_amount_usdc ?? u.monthly_rent_usdc)} USDC
                    </div>
                    <div className="text-[10px] text-gray-400">
                      Deposit: ${formatRentPrice(u.deposit_amount_usdc ?? u.security_deposit_usdc ?? u.rent_amount_usdc)} USDC
                    </div>
                    <span
                      className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase inline-block mt-1 ${
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
