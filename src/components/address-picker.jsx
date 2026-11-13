import { useEffect, useId, useState } from 'react';
import { MapPin } from 'lucide-react';

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

export default function AddressPicker({ address, onAddressChange, onLocationChange }) {
    const listId = useId();
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
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
            } catch (searchError) {
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

    const selectAddress = (suggestion) => {
        setOpen(false);
        onAddressChange(suggestion.label, true);
        onLocationChange(suggestion.location);
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
        <div className='mt-3 rounded-xl border border-line bg-white p-3'>
            <label className='block text-left'>
                <span className='mb-1 block text-[8.5px] font-semibold text-ink sm:text-[9.5px]'>Service address</span>
                <input
                    className='min-h-[44px] w-full rounded-[9px] border border-line bg-white px-2.5 py-2 text-[10.5px] text-ink outline-none transition placeholder:text-[10px] placeholder:text-body/45 focus:border-sage/60 focus:ring-2 focus:ring-sage/10 sm:text-[11.5px]'
                    name='address'
                    value={address}
                    onChange={(event) => { onAddressChange(event.target.value); setOpen(true); }}
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
            <p className='mt-2 text-[7.5px] text-body/65'>Choose a suggestion or enter your full address manually. Address searches go to Photon (OpenStreetMap data).</p>
        </div>
    );
}
