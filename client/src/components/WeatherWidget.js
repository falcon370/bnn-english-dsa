'use client';

import { useEffect, useState } from 'react';

// ── WMO Weather Code Mappings ──
const getWeatherDetails = (code, isDay) => {
  const codes = {
    0: { label: isDay ? 'Sunny' : 'Clear Sky', icon: 'sunny' },
    1: { label: 'Partly Cloudy', icon: 'cloudy_day' },
    2: { label: 'Cloudy', icon: 'cloudy' },
    3: { label: 'Overcast', icon: 'cloudy' },
    45: { label: 'Foggy', icon: 'cloudy' }, // Map to cloudy for icon availability
    48: { label: 'Foggy', icon: 'cloudy' },
    51: { label: 'Light Drizzle', icon: 'rain' }, // Map drizzle to rain
    53: { label: 'Drizzle', icon: 'rain' },
    55: { label: 'Heavy Drizzle', icon: 'rain' },
    56: { label: 'Light Freezing Drizzle', icon: 'rain' },
    57: { label: 'Freezing Drizzle', icon: 'rain' },
    61: { label: 'Light Rain', icon: 'rain' },
    63: { label: 'Moderate Rain', icon: 'rain' },
    65: { label: 'Heavy Rain', icon: 'rain' },
    66: { label: 'Light Freezing Rain', icon: 'rain' },
    67: { label: 'Freezing Rain', icon: 'rain' },
    71: { label: 'Light Snow', icon: 'snow' },
    73: { label: 'Moderate Snow', icon: 'snow' },
    75: { label: 'Heavy Snow', icon: 'snow' },
    77: { label: 'Snow Grains', icon: 'snow' },
    80: { label: 'Light Showers', icon: 'rain' },
    81: { label: 'Moderate Showers', icon: 'rain' },
    82: { label: 'Heavy Showers', icon: 'rain' },
    85: { label: 'Light Snow Showers', icon: 'snow' },
    86: { label: 'Snow Showers', icon: 'snow' },
    95: { label: 'Thunderstorm', icon: 'thunderstorm' },
    96: { label: 'Thunderstorm with Hail', icon: 'thunderstorm' },
    99: { label: 'Thunderstorm with Hail', icon: 'thunderstorm' },
  };
  return codes[code] || { label: 'Cloudy', icon: 'cloudy' };
};

// ── Wind Direction Compass ──
const getWindDirection = (degree) => {
  if (degree === undefined || degree === null) return 'N';
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const index = Math.round(degree / 22.5) % 16;
  return directions[index];
};

// ── UV Index Helper ──
const getUvIndexLabel = (uv) => {
  if (uv === undefined || uv === null) return 'N/A';
  if (uv <= 2) return `${uv} (Low)`;
  if (uv <= 5) return `${uv} (Mod)`;
  if (uv <= 7) return `${uv} (High)`;
  if (uv <= 10) return `${uv} (Very High)`;
  return `${uv} (Extreme)`;
};

// ── Day Label Formatter ──
const getDayLabel = (dateStr, index) => {
  if (index === 0) return 'Today';
  if (index === 1) return 'Tomorrow';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { weekday: 'short' });
  } catch {
    return 'Later';
  }
};

// ── SVG Weather Icons ──
const SunnyIcon = ({ className = "w-4 h-4 text-amber-400 shrink-0" }) => (
  <svg className={`${className} animate-spin-slow`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <circle cx="12" cy="12" r="5" fill="currentColor" opacity="0.2" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m12.022 12.022l.707-.707M12 7a5 5 0 100 10 5 5 0 000-10z" />
  </svg>
);

const CloudyDayIcon = ({ className = "w-4 h-4 text-blue-300 shrink-0" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1M4.929 4.929l.707.707m12.728 12.728l.707.707M2 12h1m18 0h-1M4.929 19.071l.707-.707m12.728-12.728l.707-.707" />
    <path fill="currentColor" opacity="0.8" d="M19.125 15.75H18.75a3.75 3.75 0 01-3.75-3.75v-.375c0-1.036-.84-1.875-1.875-1.875H12.75a2.25 2.25 0 00-2.25 2.25v.375a3.75 3.75 0 01-3.75 3.75h-.375C5.337 16.125 4.5 16.963 4.5 18c0 1.037.837 1.875 1.875 1.875h12.75c1.038 0 1.875-.838 1.875-1.875 0-1.037-.837-1.875-1.875-1.875z" />
  </svg>
);

const CloudyIcon = ({ className = "w-4 h-4 text-blue-300 shrink-0" }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M19.375 13.5H18.75a3.75 3.75 0 00-3.75-3.75v-.375c0-2.072-1.678-3.75-3.75-3.75h-.375a2.25 2.25 0 00-2.25 2.25v.375a3.75 3.75 0 00-3.75 3.75h-.375C2.8 12 1 13.8 1 16c0 2.2 1.8 4 4 4h14.375C21.378 20 23 18.322 23 16.25c0-2.072-1.622-3.75-3.625-3.75z" />
  </svg>
);

const RainyIcon = ({ className = "w-4 h-4 text-blue-400 shrink-0" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.375 13.5H18.75a3.75 3.75 0 00-3.75-3.75v-.375c0-2.072-1.678-3.75-3.75-3.75h-.375a2.25 2.25 0 00-2.25 2.25v.375a3.75 3.75 0 00-3.75 3.75h-.375C2.8 12 1 13.8 1 16c0 2.2 1.8 4 4 4h14.375C21.378 20 23 18.322 23 16.25c0-2.072-1.622-3.75-3.625-3.75z" fill="currentColor" opacity="0.2" />
    <path strokeLinecap="round" d="M9 20l-1 2m4-2l-1 2m4-2l-1 2" />
  </svg>
);

const SnowyIcon = ({ className = "w-4 h-4 text-blue-200 shrink-0" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.375 13.5H18.75a3.75 3.75 0 00-3.75-3.75v-.375c0-2.072-1.678-3.75-3.75-3.75h-.375a2.25 2.25 0 00-2.25 2.25v.375a3.75 3.75 0 00-3.75 3.75h-.375C2.8 12 1 13.8 1 16c0 2.2 1.8 4 4 4h14.375C21.378 20 23 18.322 23 16.25c0-2.072-1.622-3.75-3.625-3.75z" fill="currentColor" opacity="0.2" />
    <path strokeLinecap="round" d="M8 20h.01M12 20h.01M16 20h.01M10 22h.01M14 22h.01" strokeWidth={3} />
  </svg>
);

const ThunderstormIcon = ({ className = "w-4 h-4 text-amber-400 shrink-0" }) => (
  <svg className={`${className} animate-pulse`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.375 13.5H18.75a3.75 3.75 0 00-3.75-3.75v-.375c0-2.072-1.678-3.75-3.75-3.75h-.375a2.25 2.25 0 00-2.25 2.25v.375a3.75 3.75 0 00-3.75 3.75h-.375C2.8 12 1 13.8 1 16c0 2.2 1.8 4 4 4h14.375C21.378 20 23 18.322 23 16.25c0-2.072-1.622-3.75-3.625-3.75z" fill="currentColor" opacity="0.2" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M13 18l-3 4h3l-2 3" />
  </svg>
);

const LocateIcon = () => (
  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="3 11 22 2 13 21 11 13 3 11" />
  </svg>
);

const SpinnerIcon = () => (
  <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
  </svg>
);

const RenderWeatherIcon = ({ iconType, className }) => {
  switch (iconType) {
    case 'sunny':
      return <SunnyIcon className={className} />;
    case 'cloudy_day':
      return <CloudyDayIcon className={className} />;
    case 'cloudy':
      return <CloudyIcon className={className} />;
    case 'rain':
      return <RainyIcon className={className} />;
    case 'snow':
      return <SnowyIcon className={className} />;
    case 'thunderstorm':
      return <ThunderstormIcon className={className} />;
    default:
      return <CloudyIcon className={className} />;
  }
};

// ── SVG Metric Icons ──
const ThermometerIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z" />
  </svg>
);

const DropletIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
  </svg>
);

const PrecipitationIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 17.58A5 5 0 0 0 18 8h-1.26A8 8 0 1 0 4 16.25" />
    <path d="M8 16v4" />
    <path d="M12 18v4" />
    <path d="M16 16v4" />
  </svg>
);

const WindIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2" />
  </svg>
);

const WindGustIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 4h18a2 2 0 0 1 0 4H10M2 12h14a2 2 0 0 0 0-4H6M2 20h10a2 2 0 0 1 0-4H4" />
  </svg>
);

const DewPointIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22a7 7 0 0 0 7-7c0-4.3-7-11-7-11S5 10.7 5 15a7 7 0 0 0 7 7z" />
    <circle cx="12" cy="15" r="2" />
  </svg>
);

const UvIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="5" />
    <line x1="12" y1="1" x2="12" y2="3" />
    <line x1="12" y1="21" x2="12" y2="23" />
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
    <line x1="1" y1="12" x2="3" y2="12" />
    <line x1="21" y1="12" x2="23" y2="12" />
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
  </svg>
);

const EyeIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const PressureIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <path d="M12 6v6l4-2" />
  </svg>
);

// ── Indian Cities Database ──
const INDIAN_CITIES = [
  { name: 'New Delhi', lat: 28.6139, lon: 77.2090 },
  { name: 'Mumbai', lat: 19.0760, lon: 72.8777 },
  { name: 'Bengaluru', lat: 12.9716, lon: 77.5946 },
  { name: 'Kolkata', lat: 22.5726, lon: 88.3639 },
  { name: 'Chennai', lat: 13.0827, lon: 80.2707 },
  { name: 'Hyderabad', lat: 17.3850, lon: 78.4867 },
  { name: 'Ahmedabad', lat: 23.0225, lon: 72.5714 },
  { name: 'Pune', lat: 18.5204, lon: 73.8567 },
  { name: 'Jaipur', lat: 26.9124, lon: 75.7873 },
  { name: 'Lucknow', lat: 26.8467, lon: 80.9462 },
];

// ── Main Component ──
export default function WeatherWidget() {
  const [lat, setLat] = useState(28.6139);
  const [lon, setLon] = useState(77.2090);
  const [city, setCity] = useState('New Delhi, India');
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(true);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  // Fetch weather from Open-Meteo (current metrics & daily forecast)
  const fetchWeather = async (latitude, longitude) => {
    try {
      setLoading(true);
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m,visibility,uv_index,dew_point_2m,precipitation,wind_gusts_10m&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch weather data');
      const data = await res.json();
      
      const current = data.current;
      const daily = data.daily;
      
      // Parse 3-day forecast
      const forecast = [];
      if (daily && daily.time) {
        for (let i = 0; i < 3; i++) {
          if (daily.time[i]) {
            forecast.push({
              date: daily.time[i],
              code: daily.weather_code[i],
              tempMax: Math.round(daily.temperature_2m_max[i]),
              tempMin: Math.round(daily.temperature_2m_min[i]),
            });
          }
        }
      }

      setWeather({
        temp: Math.round(current.temperature_2m),
        apparentTemp: Math.round(current.apparent_temperature),
        humidity: current.relative_humidity_2m,
        windSpeed: Math.round(current.wind_speed_10m),
        windDirection: current.wind_direction_10m,
        cloudCover: current.cloud_cover,
        pressure: Math.round(current.pressure_msl),
        visibility: current.visibility ? Math.round(current.visibility / 100) / 10 : 10, // Default 10km
        uvIndex: current.uv_index !== undefined ? Math.round(current.uv_index * 10) / 10 : null,
        dewPoint: current.dew_point_2m !== undefined ? Math.round(current.dew_point_2m) : null,
        precipitation: current.precipitation !== undefined ? current.precipitation : 0,
        windGusts: current.wind_gusts_10m !== undefined ? Math.round(current.wind_gusts_10m) : null,
        isDay: current.is_day === 1,
        code: current.weather_code,
        forecast: forecast,
      });
      setError(null);
    } catch (err) {
      console.error(err);
      setError('Error loading weather');
    } finally {
      setLoading(false);
    }
  };

  // Run initial fetch for Delhi
  useEffect(() => {
    fetchWeather(lat, lon);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle Geolocation
  const handleLocate = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;
        setLat(latitude);
        setLon(longitude);

        await fetchWeather(latitude, longitude);

        // Geocoding request
        try {
          const geocodeUrl = `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`;
          const res = await fetch(geocodeUrl, {
            headers: {
              'User-Agent': 'BNN-Weather/1.0 (contact: admin@bharatnewsnarratives.com)',
            },
          });
          if (res.ok) {
            const data = await res.json();
            const addr = data.address;
            const resolvedCity = addr.city || addr.town || addr.village || addr.suburb || addr.city_district || addr.state || 'Local Area';
            const country = addr.country || 'India';
            setCity(`${resolvedCity}, ${country}`);
          }
        } catch (err) {
          console.warn('Reverse geocoding failed:', err.message);
          setCity('My Location');
        } finally {
          setLocating(false);
        }
      },
      (err) => {
        console.warn('Geolocation failed:', err.message);
        alert('Could not retrieve your location. Check browser location access permissions.');
        setLocating(false);
      },
      { timeout: 8000 }
    );
  };

  const weatherDetails = weather ? getWeatherDetails(weather.code, weather.isDay) : null;
  const currentDateStr = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).toUpperCase();

  // Extract clean city name for Navbar display (e.g. "New Delhi" instead of "New Delhi, India")
  const displayName = city.split(',')[0].trim();

  return (
    <>
      <div className="flex items-center gap-1.5 text-blue-200">
        
        {/* Weather data display grouped button */}
        {loading ? (
          <div className="flex items-center gap-1.5 text-[9px] text-blue-300 font-bold uppercase tracking-wider select-none">
            <div className="w-3.5 h-3.5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin shrink-0" />
            <span>Weather...</span>
          </div>
        ) : error || !weather ? (
          <span className="text-[10px] font-bold uppercase text-blue-300 shrink-0 select-none">Weather N/A</span>
        ) : (
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 text-blue-200 hover:text-white transition-all py-1 px-2 -my-1 rounded-md hover:bg-white/10 group focus:outline-none shrink-0"
            title="Click for detailed weather info"
          >
            <RenderWeatherIcon iconType={weatherDetails.icon} className="w-4 h-4 shrink-0 transition-transform group-hover:scale-110" />
            <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-blue-200 group-hover:text-white transition-colors truncate max-w-[100px] sm:max-w-[140px]">
              {displayName}
            </span>
            <span className="text-[10px] font-extrabold tracking-wide text-white bg-blue-500/30 group-hover:bg-blue-500/50 px-1.5 py-0.5 rounded transition-all">
              {weather.temp}°C
            </span>
          </button>
        )}

        {/* Locate Button */}
        <button
          onClick={handleLocate}
          disabled={locating}
          className="flex items-center justify-center w-6 h-6 rounded-full text-blue-300 hover:text-white hover:bg-white/15 disabled:opacity-50 transition-all focus:outline-none shrink-0"
          title="Locate my position"
        >
          {locating ? <SpinnerIcon /> : <LocateIcon />}
        </button>
      </div>

      {/* ── Detailed Weather Modal ── */}
      {modalOpen && weather && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
          
          {/* Backdrop blur overlay */}
          <div 
            onClick={() => setModalOpen(false)}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-md transition-opacity"
          />

          {/* Modal Card content */}
          <div className="relative w-full max-w-md bg-white border border-slate-200 text-slate-800 rounded-3xl shadow-2xl overflow-hidden z-10 animate-fade-in-scale">
            
            {/* Top brand header bar */}
            <div className="h-2 bg-[#1A56C4] w-full" />

            {/* Header top-right close cross */}
            <button
              onClick={() => setModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 text-xl font-bold transition-colors focus:outline-none"
            >
              &times;
            </button>

            <div className="p-6">
              {/* City Title */}
              <div className="mb-4">
                <span className="text-[9px] font-black uppercase tracking-widest text-[#1A56C4]">{currentDateStr}</span>
                <h3 className="text-2xl font-black tracking-tight mt-1 text-slate-900 truncate" style={{ fontFamily: 'Georgia, serif' }}>
                  {city}
                </h3>
              </div>

              {/* City Select Dropdown */}
              <div className="mb-4">
                <label htmlFor="city-select" className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1">
                  Select city
                </label>
                <select
                  id="city-select"
                  value={INDIAN_CITIES.find(c => Math.abs(c.lat - lat) < 0.01 && Math.abs(c.lon - lon) < 0.01)?.name || 'custom'}
                  onChange={(e) => {
                    const selected = INDIAN_CITIES.find(c => c.name === e.target.value);
                    if (selected) {
                      setLat(selected.lat);
                      setLon(selected.lon);
                      setCity(`${selected.name}, India`);
                      fetchWeather(selected.lat, selected.lon);
                    }
                  }}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs font-bold rounded-xl py-2 px-3 focus:outline-none focus:ring-2 focus:ring-[#1A56C4] transition-all cursor-pointer"
                >
                  {!INDIAN_CITIES.some(c => Math.abs(c.lat - lat) < 0.01 && Math.abs(c.lon - lon) < 0.01) && (
                    <option value="custom">
                      📍 {city}
                    </option>
                  )}
                  {INDIAN_CITIES.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Big Temp and Condition Area */}
              <div className="flex items-center gap-4 bg-slate-50 border border-slate-100 rounded-2xl p-4 mb-4">
                <div className="p-3.5 bg-blue-50 text-[#1A56C4] rounded-2xl shrink-0 scale-110 shadow-sm border border-blue-100/50">
                  <RenderWeatherIcon iconType={weatherDetails.icon} className="w-8 h-8 shrink-0" />
                </div>
                <div>
                  <span className="text-4xl font-black tracking-tight text-slate-950 leading-none">{weather.temp}°C</span>
                  <p className="text-[10px] font-black text-[#1A56C4] mt-1.5 uppercase tracking-wider">{weatherDetails.label}</p>
                </div>
              </div>

              {/* Weather parameters grid (3x3 layout) */}
              <div className="grid grid-cols-3 gap-2 mb-5">
                
                {/* Feels Like */}
                <div className="bg-slate-50 border border-slate-100/80 rounded-xl p-2.5 flex flex-col justify-between items-start">
                  <div className="flex items-center gap-1 text-slate-400">
                    <ThermometerIcon className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                    <span className="text-[8px] font-black uppercase tracking-wider">Feels Like</span>
                  </div>
                  <span className="text-sm font-black text-slate-900 mt-1">{weather.apparentTemp}°C</span>
                </div>
                
                {/* Humidity */}
                <div className="bg-slate-50 border border-slate-100/80 rounded-xl p-2.5 flex flex-col justify-between items-start">
                  <div className="flex items-center gap-1 text-slate-400">
                    <DropletIcon className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                    <span className="text-[8px] font-black uppercase tracking-wider">Humidity</span>
                  </div>
                  <span className="text-sm font-black text-slate-900 mt-1">{weather.humidity}%</span>
                </div>

                {/* Precipitation */}
                <div className="bg-slate-50 border border-slate-100/80 rounded-xl p-2.5 flex flex-col justify-between items-start">
                  <div className="flex items-center gap-1 text-slate-400">
                    <PrecipitationIcon className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                    <span className="text-[8px] font-black uppercase tracking-wider">Rain</span>
                  </div>
                  <span className="text-sm font-black text-slate-900 mt-1">{weather.precipitation} mm</span>
                </div>

                {/* Wind Speed */}
                <div className="bg-slate-50 border border-slate-100/80 rounded-xl p-2.5 flex flex-col justify-between items-start">
                  <div className="flex items-center gap-1 text-slate-400">
                    <WindIcon className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                    <span className="text-[8px] font-black uppercase tracking-wider">Wind</span>
                  </div>
                  <span className="text-xs font-black text-slate-900 mt-1">
                    {weather.windSpeed} km/h <span className="text-blue-600 font-bold ml-0.5">{getWindDirection(weather.windDirection)}</span>
                  </span>
                </div>

                {/* Wind Gusts */}
                <div className="bg-slate-50 border border-slate-100/80 rounded-xl p-2.5 flex flex-col justify-between items-start">
                  <div className="flex items-center gap-1 text-slate-400">
                    <WindGustIcon className="w-3.5 h-3.5 text-teal-500 shrink-0" />
                    <span className="text-[8px] font-black uppercase tracking-wider">Gusts</span>
                  </div>
                  <span className="text-sm font-black text-slate-900 mt-1">{weather.windGusts || 0} km/h</span>
                </div>

                {/* Dew Point */}
                <div className="bg-slate-50 border border-slate-100/80 rounded-xl p-2.5 flex flex-col justify-between items-start">
                  <div className="flex items-center gap-1 text-slate-400">
                    <DewPointIcon className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                    <span className="text-[8px] font-black uppercase tracking-wider">Dew Point</span>
                  </div>
                  <span className="text-sm font-black text-slate-900 mt-1">{weather.dewPoint || 0}°C</span>
                </div>

                {/* UV Index */}
                <div className="bg-slate-50 border border-slate-100/80 rounded-xl p-2.5 flex flex-col justify-between items-start">
                  <div className="flex items-center gap-1 text-slate-400">
                    <UvIcon className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    <span className="text-[8px] font-black uppercase tracking-wider">UV Index</span>
                  </div>
                  <span className="text-xs font-black text-slate-900 mt-1">{getUvIndexLabel(weather.uvIndex)}</span>
                </div>

                {/* Visibility */}
                <div className="bg-slate-50 border border-slate-100/80 rounded-xl p-2.5 flex flex-col justify-between items-start">
                  <div className="flex items-center gap-1 text-slate-400">
                    <EyeIcon className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span className="text-[8px] font-black uppercase tracking-wider">Visibility</span>
                  </div>
                  <span className="text-sm font-black text-slate-900 mt-1">{weather.visibility} km</span>
                </div>

                {/* Pressure */}
                <div className="bg-slate-50 border border-slate-100/80 rounded-xl p-2.5 flex flex-col justify-between items-start">
                  <div className="flex items-center gap-1 text-slate-400">
                    <PressureIcon className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                    <span className="text-[8px] font-black uppercase tracking-wider">Pressure</span>
                  </div>
                  <span className="text-xs font-black text-slate-900 mt-1">{weather.pressure} hPa</span>
                </div>

              </div>

              {/* 3-Day Forecast Section */}
              {weather.forecast && weather.forecast.length > 0 && (
                <div className="mb-6 pt-4 border-t border-slate-100">
                  <h4 className="text-[9px] font-black uppercase tracking-widest text-[#1A56C4] mb-3">3-Day Forecast</h4>
                  <div className="grid grid-cols-3 gap-2">
                    {weather.forecast.map((day, idx) => {
                      const dayDetails = getWeatherDetails(day.code, true);
                      return (
                        <div key={idx} className="flex flex-col items-center p-2.5 bg-slate-50 border border-slate-100/70 rounded-xl shadow-sm">
                          <span className="text-[9px] font-black uppercase text-slate-500 tracking-wider mb-1">
                            {getDayLabel(day.date, idx)}
                          </span>
                          <RenderWeatherIcon iconType={dayDetails.icon} className="w-6 h-6 my-1" />
                          <span className="text-[9px] text-[#1A56C4] uppercase font-bold tracking-wide mt-0.5 text-center leading-none">
                            {dayDetails.label}
                          </span>
                          <span className="text-xs font-black text-slate-900 mt-1.5">
                            {day.tempMin}° / {day.tempMax}°
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Close CTA */}
              <button
                onClick={() => setModalOpen(false)}
                className="w-full py-3 bg-[#1A56C4] hover:bg-[#1248A8] text-white text-xs font-black uppercase tracking-widest rounded-xl transition-colors focus:outline-none shadow-md"
              >
                Close Details
              </button>
            </div>

          </div>

        </div>
      )}
    </>
  );
}
