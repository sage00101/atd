import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { LocateFixed, MapPin } from 'lucide-react';
import { BUSINESS_LOCATION, getDistanceFromServiceCenter, SERVICE_AREA_CENTER } from '../utils/service-area';

function formatAddress(properties) {
    const street = [properties.housenumber, properties.street || properties.name]
        .filter(Boolean)
        .join(' ');
    const locality = properties.suburb || properties.locality || properties.city || properties.district;
    const parts = [
        street || properties.name,
        locality,
        properties.city && properties.city !== locality ? properties.city : null,
        properties.postcode,
    ].filter(Boolean);
    return [...new Set(parts)].join(', ');
}

export default function ServiceAreaPicker({ address, onAddressChange, location, onLocationChange, radiusKm, addressInvalid }) {
    const mapElementRef = useRef(null);
    const mapRef = useRef(null);
    const markerRef = useRef(null);
    const onLocationChangeRef = useRef(onLocationChange);
    const onAddressChangeRef = useRef(onAddressChange);
    const reverseGeocodeControllerRef = useRef(null);
    const reverseGeocodeRequestRef = useRef(0);
    const [locationError, setLocationError] = useState('');
    const [addressLookupLoading, setAddressLookupLoading] = useState(false);
    const [addressLookupError, setAddressLookupError] = useState('');
    const [addressSuggestions, setAddressSuggestions] = useState([]);
    const [addressSearchOpen, setAddressSearchOpen] = useState(false);
    const [addressSearchLoading, setAddressSearchLoading] = useState(false);
    const [addressSearchError, setAddressSearchError] = useState('');
    const [activeSuggestion, setActiveSuggestion] = useState(0);

    useEffect(() => {
        onLocationChangeRef.current = onLocationChange;
        onAddressChangeRef.current = onAddressChange;
    }, [onAddressChange, onLocationChange]);

    useEffect(() => {
        const query = address.trim();
        if (!addressSearchOpen || query.length < 4) {
            setAddressSuggestions([]);
            setAddressSearchLoading(false);
            setAddressSearchError('');
            return undefined;
        }

        const controller = new AbortController();
        const timer = window.setTimeout(async () => {
            setAddressSearchLoading(true);
            setAddressSearchError('');
            try {
                const endpoint = new URL('https://photon.komoot.io/api/');
                endpoint.searchParams.set('q', query);
                endpoint.searchParams.set('lat', String(SERVICE_AREA_CENTER.latitude));
                endpoint.searchParams.set('lon', String(SERVICE_AREA_CENTER.longitude));
                endpoint.searchParams.set('limit', '5');
                endpoint.searchParams.set('lang', 'en');
                const response = await fetch(endpoint, { signal: controller.signal });
                if (!response.ok) throw new Error('Address search failed.');
                const result = await response.json();
                const suggestions = (result.features || [])
                    .filter((feature) => feature.properties?.countrycode === 'ZA')
                    .map((feature) => {
                        const [longitude, latitude] = feature.geometry?.coordinates || [];
                        return {
                            id: `${feature.properties.osm_type}-${feature.properties.osm_id}`,
                            label: formatAddress(feature.properties),
                            latitude: Number(latitude),
                            longitude: Number(longitude),
                        };
                    })
                    .filter((suggestion) => suggestion.label
                        && Number.isFinite(suggestion.latitude)
                        && Number.isFinite(suggestion.longitude));
                setAddressSuggestions(suggestions);
                setActiveSuggestion(0);
                if (!suggestions.length) setAddressSearchError('No South African matches found. Add a suburb or select the location on the map.');
            } catch (error) {
                if (error.name !== 'AbortError') {
                    setAddressSuggestions([]);
                    setAddressSearchError('Address search is unavailable. You can still select the location on the map.');
                }
            } finally {
                if (!controller.signal.aborted) setAddressSearchLoading(false);
            }
        }, 450);

        return () => {
            window.clearTimeout(timer);
            controller.abort();
        };
    }, [address, addressSearchOpen]);

    const resolvePinnedAddress = async (latitude, longitude) => {
        reverseGeocodeControllerRef.current?.abort();
        const controller = new AbortController();
        reverseGeocodeControllerRef.current = controller;
        const requestId = ++reverseGeocodeRequestRef.current;
        const selectedLocation = { latitude, longitude };

        setAddressSearchOpen(false);
        setAddressSuggestions([]);
        setAddressSearchError('');
        setAddressLookupError('');
        setAddressLookupLoading(true);
        onAddressChangeRef.current('', true);
        onLocationChangeRef.current(selectedLocation);

        try {
            const endpoint = new URL('https://photon.komoot.io/reverse');
            endpoint.searchParams.set('lat', String(latitude));
            endpoint.searchParams.set('lon', String(longitude));
            endpoint.searchParams.set('lang', 'en');
            const response = await fetch(endpoint, { signal: controller.signal });
            if (!response.ok) throw new Error('Address lookup failed.');
            const result = await response.json();
            const label = result.features?.[0]?.properties
                ? formatAddress(result.features[0].properties)
                : '';

            if (!label) throw new Error('No address found for this pin.');
            const distanceKm = getDistanceFromServiceCenter(selectedLocation);
            if (distanceKm !== null && distanceKm > radiusKm) return;
            if (requestId === reverseGeocodeRequestRef.current) {
                onAddressChangeRef.current(label, true);
            }
        } catch (error) {
            if (error.name !== 'AbortError' && requestId === reverseGeocodeRequestRef.current) {
                setAddressLookupError('No address was found for this pin. Search for the address above or adjust the pin.');
            }
        } finally {
            if (requestId === reverseGeocodeRequestRef.current) setAddressLookupLoading(false);
        }
    };

    useEffect(() => {
        if (!mapElementRef.current || mapRef.current) return undefined;

        const map = L.map(mapElementRef.current, { scrollWheelZoom: false })
            .setView([SERVICE_AREA_CENTER.latitude, SERVICE_AREA_CENTER.longitude], 12);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
            maxZoom: 19,
        }).addTo(map);
        L.circle([SERVICE_AREA_CENTER.latitude, SERVICE_AREA_CENTER.longitude], {
            radius: radiusKm * 1000,
            color: '#31553c',
            fillColor: '#8daa91',
            fillOpacity: 0.12,
            weight: 2,
        }).addTo(map);
        L.circleMarker([BUSINESS_LOCATION.latitude, BUSINESS_LOCATION.longitude], {
            radius: 5,
            color: '#fff',
            weight: 2,
            fillColor: '#c74d35',
            fillOpacity: 1,
        }).addTo(map).bindTooltip('2 Pinnacle Crescent, Strandfontein');

        map.on('click', (event) => resolvePinnedAddress(event.latlng.lat, event.latlng.lng));
        mapRef.current = map;
        map.invalidateSize();

        return () => {
            reverseGeocodeControllerRef.current?.abort();
            map.remove();
            mapRef.current = null;
        };
    }, [radiusKm]);

    useEffect(() => {
        const map = mapRef.current;
        if (!map || !location) {
            markerRef.current?.remove();
            markerRef.current = null;
            return;
        }

        const point = [location.latitude, location.longitude];
        if (markerRef.current) markerRef.current.setLatLng(point);
        else {
            markerRef.current = L.circleMarker(point, {
                radius: 8,
                color: '#fff',
                weight: 3,
                fillColor: '#c74d35',
                fillOpacity: 1,
            }).addTo(map);
        }
    }, [location]);

    const useDeviceLocation = () => {
        setLocationError('');
        if (!navigator.geolocation) {
            setLocationError('Location is not available in this browser. Select a point on the map instead.');
            return;
        }

        navigator.geolocation.getCurrentPosition(
            ({ coords }) => {
                const point = [coords.latitude, coords.longitude];
                resolvePinnedAddress(coords.latitude, coords.longitude);
                mapRef.current?.setView(point, 15);
            },
            () => setLocationError('Could not access your location. Select a point on the map instead.'),
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
        );
    };

    const selectAddress = (suggestion) => {
        const point = [suggestion.latitude, suggestion.longitude];
        setAddressSearchOpen(false);
        setAddressSuggestions([]);
        setAddressSearchError('');
        reverseGeocodeControllerRef.current?.abort();
        setAddressLookupLoading(false);
        setAddressLookupError('');
        onAddressChangeRef.current(suggestion.label, true);
        onLocationChangeRef.current({ latitude: suggestion.latitude, longitude: suggestion.longitude });
        mapRef.current?.setView(point, 16);
    };

    const handleAddressKeyDown = (event) => {
        if (!addressSuggestions.length || !addressSearchOpen) {
            if (event.key === 'Escape') setAddressSearchOpen(false);
            return;
        }
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            setActiveSuggestion((current) => (current + 1) % addressSuggestions.length);
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setActiveSuggestion((current) => (current - 1 + addressSuggestions.length) % addressSuggestions.length);
        } else if (event.key === 'Enter') {
            event.preventDefault();
            selectAddress(addressSuggestions[activeSuggestion]);
        } else if (event.key === 'Escape') {
            setAddressSearchOpen(false);
        }
    };

    return (
        <div className='mt-3 overflow-hidden rounded-xl border border-line bg-white'>
            <div className='p-3'>
                <label className='block text-left'>
                    <span className='mb-1 block text-[8.5px] font-semibold text-ink sm:text-[9.5px]'>Service address</span>
                    <span className='block'>
                        <textarea
                            className={`min-h-[54px] w-full resize-none rounded-[9px] border bg-white px-2.5 py-2 text-[10.5px] text-ink outline-none transition placeholder:text-[10px] placeholder:text-body/45 focus:ring-2 sm:min-h-[62px] sm:text-[11.5px] ${addressInvalid ? 'border-red-400 bg-red-50/50 focus:border-red-500 focus:ring-red-100' : 'border-line focus:border-sage/60 focus:ring-sage/10'}`}
                            name='address'
                            value={address}
                            onChange={(event) => {
                                reverseGeocodeControllerRef.current?.abort();
                                setAddressLookupLoading(false);
                                setAddressLookupError('');
                                onAddressChangeRef.current(event.target.value);
                                setAddressSearchOpen(true);
                            }}
                            onFocus={() => setAddressSearchOpen(true)}
                            onKeyDown={handleAddressKeyDown}
                            placeholder='Start typing your street address and suburb'
                            rows={2}
                            autoComplete='street-address'
                            aria-autocomplete='list'
                            aria-expanded={addressSearchOpen && address.trim().length >= 4}
                            aria-controls='service-address-suggestions'
                            aria-invalid={addressInvalid}
                            required
                        />
                        {addressSearchOpen && address.trim().length >= 4 && (addressSearchLoading || addressSuggestions.length > 0 || addressSearchError) && (
                            <div className='mt-1 overflow-hidden rounded-lg border border-line bg-white shadow-sm'>
                                {addressSearchLoading && <p className='px-3 py-2 text-[8.5px] text-body' role='status'>Searching South African addresses...</p>}
                                {addressSuggestions.length > 0 && (
                                    <ul id='service-address-suggestions' role='listbox' aria-label='Address suggestions' className='max-h-48 overflow-y-auto py-1'>
                                        {addressSuggestions.map((suggestion, index) => (
                                            <li key={suggestion.id} role='option' aria-selected={index === activeSuggestion}>
                                                <button
                                                    type='button'
                                                    onClick={() => selectAddress(suggestion)}
                                                    className={`w-full px-3 py-2 text-left text-[9px] leading-[1.45] transition sm:text-[10px] ${index === activeSuggestion ? 'bg-sagelight text-sagedeep' : 'text-ink hover:bg-[#f7f8f5]'}`}
                                                >
                                                    <MapPin className='mr-1.5 inline size-3 shrink-0 text-sage' />{suggestion.label}
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                                {!addressSearchLoading && addressSearchError && <p className='px-3 py-2 text-[8.5px] leading-[1.45] text-body' role='status'>{addressSearchError}</p>}
                            </div>
                        )}
                    </span>
                </label>
                <div className='mt-2 flex flex-wrap items-center justify-between gap-2'>
                    <span className='text-[7.5px] text-body/65'>Address searches go to Photon (OpenStreetMap data).</span>
                    <button
                        type='button'
                        onClick={useDeviceLocation}
                        className='inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-line px-2.5 text-[8px] font-semibold text-sagedeep transition hover:bg-sagelight sm:text-[9px]'
                    >
                        <LocateFixed className='size-3.5' /> Use my location
                    </button>
                </div>
                {addressLookupLoading && <p className='pt-2 text-[8px] text-body' role='status'>Finding the address for this pin...</p>}
                {addressLookupError && <p className='pt-2 text-[8px] text-red-700' role='alert'>{addressLookupError}</p>}
                {locationError && <p className='pt-2 text-[8px] text-red-700' role='status'>{locationError}</p>}
            </div>
            <div ref={mapElementRef} className='h-[220px] w-full sm:h-[260px]' aria-label='Map to select the service location' />
            <div className='flex items-start gap-2 border-t border-line bg-[#f8faf8] px-3 py-2 text-[8px] leading-[1.5] text-body sm:text-[8.5px]'>
                <MapPin className='mt-0.5 size-3 shrink-0 text-sage' />
                <span>Tap the map to place the pin at the address above. The shaded circle shows the service coverage area.</span>
            </div>
        </div>
    );
}