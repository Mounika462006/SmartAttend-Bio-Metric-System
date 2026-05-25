import { useEffect, useState } from 'react';
import { adminAPI } from '../../api/services';
import { Crosshair, ExternalLink, Info, Loader, MapPin, Save } from 'lucide-react';
import toast from 'react-hot-toast';

const RADIUS_OPTIONS = [50, 100, 200];

function extractCoordinatesFromLink(value) {
  const input = value.trim();
  if (!input) return null;

  const plainCoords = input.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
  if (plainCoords) {
    return { latitude: parseFloat(plainCoords[1]), longitude: parseFloat(plainCoords[2]) };
  }

  const decoded = decodeURIComponent(input);
  const patterns = [
    /@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
    /[?&](?:q|query|ll|center)=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
    /#map=\d+\/(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)/,
    /[?&]mlat=(-?\d+(?:\.\d+)?).*?[?&]mlon=(-?\d+(?:\.\d+)?)/,
    /[?&]mlon=(-?\d+(?:\.\d+)?).*?[?&]mlat=(-?\d+(?:\.\d+)?)/,
  ];

  for (const pattern of patterns) {
    const match = decoded.match(pattern);
    if (!match) continue;
    if (pattern.source.includes('mlon=(-?') && pattern.source.indexOf('mlon') < pattern.source.indexOf('mlat')) {
      return { latitude: parseFloat(match[2]), longitude: parseFloat(match[1]) };
    }
    return { latitude: parseFloat(match[1]), longitude: parseFloat(match[2]) };
  }

  return null;
}

function isValidCoordinate(latitude, longitude) {
  return Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180;
}

export default function GeoFencingSettings() {
  const [settings, setSettings] = useState({
    college_name: '',
    latitude: '',
    longitude: '',
    radius_meters: 100,
  });
  const [mapLink, setMapLink] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    adminAPI.getGeoFencing()
      .then(({ data }) => {
        if (data.data) {
          setSettings({
            ...data.data,
            radius_meters: RADIUS_OPTIONS.includes(parseInt(data.data.radius_meters))
              ? parseInt(data.data.radius_meters)
              : 100,
          });
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const update = (key, value) => setSettings(prev => ({ ...prev, [key]: value }));
  const mapsUrl = settings.latitude && settings.longitude
    ? `https://www.openstreetmap.org/?mlat=${settings.latitude}&mlon=${settings.longitude}#map=18/${settings.latitude}/${settings.longitude}`
    : '';

  const applyCoordinates = (latitude, longitude, message) => {
    if (!isValidCoordinate(latitude, longitude)) {
      toast.error('Could not find valid latitude and longitude.');
      return;
    }

    setSettings(prev => ({
      ...prev,
      latitude: latitude.toFixed(7),
      longitude: longitude.toFixed(7),
    }));
    toast.success(message);
  };

  const extractFromMapLink = () => {
    const coords = extractCoordinatesFromLink(mapLink);
    if (!coords) {
      toast.error('Paste a Google Maps/OpenStreetMap link that contains coordinates.');
      return;
    }
    applyCoordinates(coords.latitude, coords.longitude, 'Location extracted from map link.');
  };

  const useLiveLocation = () => {
    // Check geolocation support
    if (!navigator.geolocation) {
      toast.error('Location unavailable');
      return;
    }

    // Show loading toast and flag
    const id = toast.loading('Getting your live location...');
    setLocating(true);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        toast.dismiss(id);
        applyCoordinates(pos.coords.latitude, pos.coords.longitude, 'Live location selected.');
        setLocating(false);
        toast.success('Live location acquired.');
      },
      (err) => {
        toast.dismiss(id);
        setLocating(false);

        // Map error codes to human-friendly messages
        let message = 'Location unavailable';
        if (err.code === 1) message = 'Location permission denied. Please enable GPS and allow browser permission.';
        else if (err.code === 2) message = 'Location unavailable';
        else if (err.code === 3) message = 'Location request timeout';

        toast.error(message);
        // Provide quick fallback hint for the admin
        toast('You can paste a map link or enter coordinates manually in the form.', { icon: 'ℹ️' });
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const latitude = parseFloat(settings.latitude);
    const longitude = parseFloat(settings.longitude);
    const radius = parseInt(settings.radius_meters);

    if (!settings.college_name.trim()) {
      toast.error('College name is required.');
      return;
    }
    if (!isValidCoordinate(latitude, longitude)) {
      toast.error('Select a valid geo-fence location first.');
      return;
    }
    if (!RADIUS_OPTIONS.includes(radius)) {
      toast.error('Select a valid radius.');
      return;
    }

    setSaving(true);
    try {
      await adminAPI.updateGeoFencing({
        college_name: settings.college_name,
        latitude,
        longitude,
        radius_meters: radius,
      });
      toast.success('Geo-fence location saved successfully.');
    } catch {
      toast.error('Failed to save location.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="skeleton h-64 rounded-lg" />;

  return (
    <div className="max-w-2xl space-y-6">
      <div className="page-header">
        <h1 className="page-title">Geo-Fencing Settings</h1>
        <p className="page-subtitle">Configure the attendance location and allowed radius</p>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="flex items-center gap-2">
            <MapPin size={18} className="text-blue-600" />
            <span className="card-title">Use Live Location</span>
          </div>
        </div>

        <form onSubmit={handleSave} className="card-body space-y-4">
          <div>
            <label className="form-label">College Name</label>
            <input
              type="text"
              className="form-input"
              value={settings.college_name}
              onChange={e => update('college_name', e.target.value)}
              placeholder="Smart College of Technology"
            />
          </div>

          <div>
            <label className="form-label">Google Maps or OpenStreetMap Link</label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type="text"
                className="form-input"
                value={mapLink}
                onChange={e => setMapLink(e.target.value)}
                placeholder="Paste map link with coordinates"
              />
              <button type="button" onClick={extractFromMapLink} className="btn-secondary whitespace-nowrap">
                <MapPin size={15} />
                Extract Location
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">Latitude</label>
              <input
                type="number"
                step="any"
                className="form-input"
                value={settings.latitude}
                onChange={e => update('latitude', e.target.value)}
                placeholder="11.0168"
              />
            </div>
            <div>
              <label className="form-label">Longitude</label>
              <input
                type="number"
                step="any"
                className="form-input"
                value={settings.longitude}
                onChange={e => update('longitude', e.target.value)}
                placeholder="76.9558"
              />
            </div>
          </div>

          <div>
            <label className="form-label">Geo-Fence Radius</label>
            <select
              className="form-input"
              value={settings.radius_meters}
              onChange={e => update('radius_meters', parseInt(e.target.value))}
            >
              {RADIUS_OPTIONS.map(radius => (
                <option key={radius} value={radius}>{radius}m</option>
              ))}
            </select>
            <p className="text-xs text-surface-400 mt-1">
              Students must be inside this radius to mark biometric attendance.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={useLiveLocation} disabled={locating} className="btn-secondary">
              {locating ? <Loader size={15} className="animate-spin" /> : <Crosshair size={15} />}
              {locating ? 'Getting Location...' : 'Use Current Device Location'}
            </button>
            {mapsUrl && (
              <a href={mapsUrl} target="_blank" rel="noreferrer" className="btn-secondary">
                <ExternalLink size={15} />
                View on OpenStreetMap
              </a>
            )}
          </div>

          <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg flex gap-2">
            <Info size={15} className="text-blue-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-blue-700">
              Paste a map link that contains coordinates, or use the current device location while standing at the attendance point.
            </p>
          </div>

          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? <Loader size={15} className="animate-spin" /> : <Save size={15} />}
            Save Location
          </button>
        </form>
      </div>
    </div>
  );
}
