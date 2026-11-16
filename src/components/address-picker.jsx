import { useEffect, useId, useRef, useState } from 'react';
import { LocateFixed, LoaderCircle, MapPin } from 'lucide-react';
import 'leaflet/dist/leaflet.css';

const DEFAULT_MAP_CENTER = { latitude: -33.9249, longitude: 18.4241 };

function formatAddress(properties) {
    const street = [properties.housenumber, properties.street || properties.name].filter(Boolean).join(' ');
    const parts = [
        street || properties.name,
        properties.suburb || properties.locality,
        properties.city,
        properties.district,
        properties.state,
        properties.postcode,
        properties.country,
    ].filter(Boolean);
    return [...new Set(parts)].join(', ');
}

function isValidLocation(location) {
    return Number.isFinite(location?.latitude)
        && Number.isFinite(location?.longitude)
        && location.latitude >= -90
        && location.latitude <= 90
        && location.longitude >= -180
        && location.longitude <= 180;
}

function formatAccuracy(accuracy) {
    if (!Number.isFinite(accuracy) || accuracy <= 0) return '';
    return `Estimated device accuracy: about ${Math.max(1, Math.round(accuracy))} m.`;
}

function geolocationErrorMessage(error) {
    if (error.code === 1) return 'Location permission was denied. Allow location access in your browser or enter the address manually.';
    if (error.code === 2) return 'Your location could not be determined. Try again or enter the address manually.';
    if (error.code === 3) return 'The location request timed out. Try again or enter the address manually.';
    return 'Could not get your location. Enter the address manually or try again.';
}

export default function AddressPicker({ address, onAddressChange, onLocationChange }) {
    const listId = useId();
    const inputId = useId();
    const mapContainerRef = useRef(null);
    const leafletRef = useRef(null);
    const mapRef = useRef(null);
    const markerRef = useRef(null);
    const accuracyCircleRef = useRef(null);
    const mapSelectionRef = useRef(null);
    const mapAccuracyRef = useRef(null);
    const reverseGeocodeControllerRef = useRef(null);
    const mapPickHandlerRef = useRef(null);
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [isLocating, setIsLocating] = useState(false);
    const [error, setError] = useState('');
    const [locationMessage, setLocationMessage] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [active, setActive] = useState(-1);

    useEffect(() => {
        const query = address.trim();
        setSuggestions([]);
        setActive(-1);
        setLoading(false);
        setError('');
        if (!open || query.length < 4) return undefined;

        const controller = new AbortController();
        const timer = window.setTimeout(async () => {
            setLoading(true);
            try {
                const endpoint = new URL('https://photon.komoot.io/api/');
                endpoint.searchParams.set('q', query);
                endpoint.searchParams.set('limit', '5');
                endpoint.searchParams.set('lang', 'en');
                const response = await fetch(endpoint, { signal: controller.signal });
                if (!response.ok) throw new Error('Address search failed.');
                const result = await response.json();
                if (controller.signal.aborted) return;
                const matches = (result.features || []).map((feature) => {
                    const [longitude, latitude] = feature.geometry?.coordinates || [];
                    return {
                        id: `${feature.properties?.osm_type}-${feature.properties?.osm_id}`,
                        label: formatAddress(feature.properties || {}),
                        location: Number.isFinite(latitude) && Number.isFinite(longitude) ? { latitude, longitude } : null,
                    };
                }).filter((suggestion) => suggestion.label);
                setSuggestions(matches);
                if (!matches.length) setError('No matches found. You can enter your address manually.');
            } catch {
                if (!controller.signal.aborted) {
                    setError('Address search is unavailable. You can enter your address manually.');
                }
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        }, 450);
        return () => {
            window.clearTimeout(timer);
            controller.abort();
        };
    }, [address, open]);

    useEffect(() => {
        if (!mapContainerRef.current) return undefined;

        let isActive = true;
        let frame;
        const initializeMap = async () => {
            try {
                const L = (await import('leaflet')).default;
                if (!isActive || !mapContainerRef.current) return;
                leafletRef.current = L;
                const map = L.map(mapContainerRef.current, {
                    scrollWheelZoom: false,
                }).setView([DEFAULT_MAP_CENTER.latitude, DEFAULT_MAP_CENTER.longitude], 11);
                const tiles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    maxZoom: 19,
                    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
                });
                tiles.on('tileerror', () => {
                    setLocationMessage('Map tiles could not load. You can still enter your address manually.');
                });
                tiles.addTo(map);
                map.on('click', (event) => {
                    mapPickHandlerRef.current?.({
                        latitude: event.latlng.lat,
                        longitude: event.latlng.lng,
                    });
                });
                mapRef.current = map;
                if (mapSelectionRef.current) showLocationOnMap(mapSelectionRef.current, mapAccuracyRef.current);
                frame = window.requestAnimationFrame(() => map.invalidateSize());
            } catch {
                if (isActive) setLocationMessage('The map could not be loaded. You can still enter your address manually.');
            }
        };
        void initializeMap();

        return () => {
            isActive = false;
            if (frame) window.cancelAnimationFrame(frame);
            reverseGeocodeControllerRef.current?.abort();
            mapRef.current?.remove();
            mapRef.current = null;
            leafletRef.current = null;
        };
    }, []);

    const showLocationOnMap = (location, accuracy = null) => {
        if (!isValidLocation(location)) return;
        mapSelectionRef.current = location;
        mapAccuracyRef.current = accuracy;
        const map = mapRef.current;
        const L = leafletRef.current;
        if (!map || !L) return;

        const point = [location.latitude, location.longitude];
        map.setView(point, 16, { animate: true });

        if (markerRef.current) {
            markerRef.current.setLatLng(point);
        } else {
            markerRef.current = L.circleMarker(point, {
                radius: 8,
                color: '#ffffff',
                weight: 3,
                fillColor: '#1e4931',
                fillOpacity: 1,
            }).addTo(map);
        }

        if (Number.isFinite(accuracy) && accuracy > 0) {
            if (accuracyCircleRef.current) {
                accuracyCircleRef.current.setLatLng(point).setRadius(accuracy);
            } else {
                accuracyCircleRef.current = L.circle(point, {
                    radius: accuracy,
                    color: '#31553c',
                    weight: 1,
                    fillColor: '#6f9c79',
                    fillOpacity: 0.18,
                }).addTo(map);
            }
        } else if (accuracyCircleRef.current) {
            accuracyCircleRef.current.remove();
            accuracyCircleRef.current = null;
        }
    };

    const reverseGeocode = async (location, accuracy = null) => {
        reverseGeocodeControllerRef.current?.abort();
        const controller = new AbortController();
        reverseGeocodeControllerRef.current = controller;
        onAddressChange('', true);
        onLocationChange(location);
        showLocationOnMap(location, accuracy);
        setLocationMessage(accuracy ? `${formatAccuracy(accuracy)} Looking up the address; please verify both.` : 'Pin selected. Looking up the address; please verify it.');

        try {
            const endpoint = new URL('https://photon.komoot.io/reverse');
            endpoint.searchParams.set('lat', String(location.latitude));
            endpoint.searchParams.set('lon', String(location.longitude));
            endpoint.searchParams.set('lang', 'en');
            const response = await fetch(endpoint, { signal: controller.signal });
            if (!response.ok) throw new Error('Address lookup failed.');
            const result = await response.json();
            if (controller.signal.aborted) return;
            const label = formatAddress(result.features?.[0]?.properties || {});
            if (!label) {
                setLocationMessage('The pin is saved, but no nearby address was found. Please enter the full street address manually.');
                return;
            }
            onAddressChange(label, true);
            setLocationMessage(`${accuracy ? `${formatAccuracy(accuracy)} ` : ''}Please confirm the address and map pin before continuing.`);
        } catch {
            if (!controller.signal.aborted) {
                setLocationMessage('The pin is saved, but address lookup is unavailable. Please enter the full street address manually.');
            }
        }
    };

    mapPickHandlerRef.current = (location) => {
        if (!isValidLocation(location)) return;
        setLocationMessage('');
        void reverseGeocode(location);
    };

    const selectAddress = (suggestion) => {
        setOpen(false);
        onAddressChange(suggestion.label, true);
        onLocationChange(suggestion.location);
        setLocationMessage('');
        if (suggestion.location) {
            showLocationOnMap(suggestion.location);
        } else {
            mapSelectionRef.current = null;
            mapAccuracyRef.current = null;
            if (markerRef.current) {
                markerRef.current.remove();
                markerRef.current = null;
            }
        }
        if (!suggestion.location && accuracyCircleRef.current) {
            accuracyCircleRef.current.remove();
            accuracyCircleRef.current = null;
        }
    };

    const clearSelectedLocation = () => {
        reverseGeocodeControllerRef.current?.abort();
        onLocationChange(null);
        setLocationMessage('');
        mapSelectionRef.current = null;
        mapAccuracyRef.current = null;
        if (markerRef.current) {
            markerRef.current.remove();
            markerRef.current = null;
        }
        if (accuracyCircleRef.current) {
            accuracyCircleRef.current.remove();
            accuracyCircleRef.current = null;
        }
        mapRef.current?.setView([DEFAULT_MAP_CENTER.latitude, DEFAULT_MAP_CENTER.longitude], 11);
    };

    const useMyLocation = () => {
        setError('');
        setLocationMessage('');
        if (!navigator.geolocation) {
            setLocationMessage('Location is not supported by this browser. Enter the address manually.');
            return;
        }

        setIsLocating(true);
        navigator.geolocation.getCurrentPosition(
            (position) => {
                setIsLocating(false);
                const location = {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                };
                if (!isValidLocation(location)) {
                    setLocationMessage('The device returned an invalid location. Enter the address manually or try again.');
                    return;
                }
                void reverseGeocode(location, position.coords.accuracy);
            },
            (locationError) => {
                setIsLocating(false);
                setLocationMessage(geolocationErrorMessage(locationError));
            },
            { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
        );
    };

    const handleKeyDown = (event) => {
        if (event.key === 'Escape') {
            setOpen(false);
        } else if (suggestions.length && event.key === 'ArrowDown') {
            event.preventDefault();
            setActive((current) => (current + 1) % suggestions.length);
        } else if (suggestions.length && event.key === 'ArrowUp') {
            event.preventDefault();
            setActive((current) => current <= 0 ? suggestions.length - 1 : current - 1);
        } else if (event.key === 'Enter' && open && active >= 0) {
            event.preventDefault();
            selectAddress(suggestions[active]);
        }
    };

    const expanded = open && suggestions.length > 0;
    return (
        <div className='mt-3 grid gap-3 rounded-xl border border-line bg-white p-3 text-left lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]'>
            <div className='min-w-0'>
                <label htmlFor={inputId} className='block text-left'>
                    <span className='mb-1 block text-[8.5px] font-semibold text-ink sm:text-[9.5px]'>Service address</span>
                    <input
                        id={inputId}
                        className='min-h-[44px] w-full rounded-[9px] border border-line bg-white px-2.5 py-2 text-[10.5px] text-ink outline-none transition placeholder:text-[10px] placeholder:text-body/45 focus:border-sage/60 focus:ring-2 focus:ring-sage/10 sm:text-[11.5px]'
                        name='address'
                        value={address}
                        onChange={(event) => {
                            onAddressChange(event.target.value);
                            clearSelectedLocation();
                            setOpen(true);
                        }}
                        onFocus={() => setOpen(true)}
                        onBlur={() => setOpen(false)}
                        onKeyDown={handleKeyDown}
                        placeholder='Start typing your full service address'
                        autoComplete='street-address'
                        role='combobox'
                        aria-autocomplete='list'
                        aria-expanded={expanded}
                        aria-controls={expanded ? listId : undefined}
                        aria-activedescendant={expanded && active >= 0 ? `${listId}-${active}` : undefined}
                        required
                    />
                </label>
                {open && (loading || expanded || error) && (
                    <div className='mt-1 overflow-hidden rounded-lg border border-line bg-white shadow-sm'>
                        {loading && <p className='px-3 py-2 text-[8.5px] text-body' role='status'>Searching addresses...</p>}
                        {expanded && (
                            <ul id={listId} role='listbox' aria-label='Address suggestions' className='max-h-48 overflow-y-auto py-1'>
                                {suggestions.map((suggestion, index) => (
                                    <li
                                        id={`${listId}-${index}`}
                                        key={`${suggestion.id}-${index}`}
                                        role='option'
                                        aria-selected={index === active}
                                        onPointerDown={(event) => event.preventDefault()}
                                        onClick={() => selectAddress(suggestion)}
                                        className={`cursor-pointer px-3 py-2 text-left text-[9px] leading-[1.45] transition sm:text-[10px] ${index === active ? 'bg-sagelight text-sagedeep' : 'text-ink hover:bg-[#f7f8f5]'}`}
                                    >
                                        <MapPin className='mr-1.5 inline size-3 shrink-0 text-sage' />{suggestion.label}
                                    </li>
                                ))}
                            </ul>
                        )}
                        {!loading && error && <p className='px-3 py-2 text-[8.5px] text-body' role='status'>{error}</p>}
                    </div>
                )}
                <p className='mt-2 text-[7.5px] leading-relaxed text-body/65'>Choose a suggestion or enter your full address. Address searches and location lookups use Photon with OpenStreetMap data.</p>
            </div>

            <div className='min-w-0'>
                <div className='mb-2 flex items-center justify-between gap-2'>
                    <div>
                        <p className='text-[9px] font-semibold text-ink sm:text-[10px]'>Choose your map location</p>
                        <p className='text-[7.5px] text-body/65 sm:text-[8px]'>Tap the map to place or adjust the pin.</p>
                    </div>
                    <button
                        type='button'
                        onClick={useMyLocation}
                        disabled={isLocating}
                        className='inline-flex min-h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-[#d4e2d7] bg-[#edf4ee] px-2.5 text-[8px] font-semibold text-[#21452e] transition hover:border-[#9db6a3] hover:bg-[#e2eee4] disabled:cursor-wait disabled:opacity-65 sm:px-3 sm:text-[9px]'
                    >
                        {isLocating ? <LoaderCircle className='size-3 animate-spin' /> : <LocateFixed className='size-3' />}
                        {isLocating ? 'Finding you…' : 'Use my location'}
                    </button>
                </div>
                <div
                    ref={mapContainerRef}
                    className='h-[210px] w-full overflow-hidden rounded-lg border border-[#dce6de] bg-[#edf2ed] sm:h-[230px]'
                    aria-label='Interactive map for choosing the service location'
                />
                <p className='mt-2 min-h-4 text-[7.5px] leading-relaxed text-body/70 sm:text-[8px]' role='status' aria-live='polite'>
                    {locationMessage || 'Map and device locations are estimates. Please confirm the pin and full street address.'}
                </p>
                <p className='mt-1 text-[7px] leading-relaxed text-body/55'>Map data © OpenStreetMap contributors. Location accuracy depends on your device and surroundings.</p>
            </div>
        </div>
    );
}
