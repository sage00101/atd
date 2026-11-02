import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import {
    ArrowLeft,
    ArrowRight,
    CalendarDays,
    ChevronLeft,
    ChevronRight,
    Clock3,
    LoaderCircle,
    MapPin,
    PackageCheck,
    ShieldCheck,
} from 'lucide-react';
import { getDistanceFromServiceCenter, SERVICE_AREA_NAME } from '../utils/service-area';
import BookingRequestModal from '../components/booking-request-modal';

const ServiceAreaPicker = lazy(() => import('../components/service-area-picker'));
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
const BOOKING_REQUEST_ENDPOINT = `${API_BASE_URL}/api/bookings/requests`;
const AVAILABILITY_ENDPOINT = `${API_BASE_URL}/api/bookings/availability`;
const MIN_LEAD_TIME_MS = 3 * 60 * 60 * 1000;
const SERVICE_RADIUS_KM = Number(import.meta.env.VITE_SERVICE_RADIUS_KM || 7);
const MONTHLY_SELECTION_KEY = 'a10tion-monthly-checkout-selection';
const WASH_PRICES = {
    'Sedan / Hatchback': 65000,
    'SUV / Bakkie': 85000,
    'Minibus / Van': 110000,
};
const BOOKING_SLOTS = ['08:00', '10:30', '13:00', '15:30', '18:00'];
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const CUSTOMER_TYPES = {
    private: 'Private Client',
    business: 'Business / Fleet / Family',
};

function readSelection() {
    const params = new URLSearchParams(window.location.search);
    const fromLink = {
        customerType: params.get('clientType'),
        packageTier: params.get('packageTier'),
    };
    if (['private', 'business'].includes(fromLink.customerType)
        && ['standard', 'premium'].includes(fromLink.packageTier)) return fromLink;
    try {
        const selection = JSON.parse(sessionStorage.getItem(MONTHLY_SELECTION_KEY) || 'null');
        if (['private', 'business'].includes(selection?.customerType)
            && ['standard', 'premium'].includes(selection?.packageTier)) return selection;
    } catch {
        return null;
    }
    return null;
}

function dateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function formatMonth(date) {
    return new Intl.DateTimeFormat('en-ZA', { month: 'long', year: 'numeric' }).format(date);
}

function formatZar(cents) {
    return `R${(cents / 100).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function looksLikeRegistration(value) {
    const cleaned = String(value || '').trim().toUpperCase().replace(/[\s-]/g, '');
    return cleaned.length >= 5 && cleaned.length <= 12
        && /^[A-Z0-9]+$/.test(cleaned) && /[A-Z]/.test(cleaned) && /[0-9]/.test(cleaned);
}

function clearMonthlyRoute(goToBooking = false) {
    const url = new URL(window.location.href);
    url.searchParams.delete('monthly-checkout');
    url.searchParams.delete('clientType');
    url.searchParams.delete('packageTier');
    url.hash = goToBooking ? 'booking' : '';
    window.location.assign(url.toString());
}

function makeCalendarDays(month) {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const offset = (first.getDay() + 6) % 7;
    const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    return [
        ...Array(offset).fill(null),
        ...Array.from({ length: count }, (_, index) => new Date(month.getFullYear(), month.getMonth(), index + 1)),
    ];
}

export default function MonthlyCheckoutPage({ bookingRequest }) {
    const [selection] = useState(readSelection);
    const [now, setNow] = useState(() => new Date());
    const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
    const [selectedDate, setSelectedDate] = useState(null);
    const [selectedTime, setSelectedTime] = useState('');
    const [bookedSlots, setBookedSlots] = useState({});
    const [availabilityError, setAvailabilityError] = useState('');
    const [promoCode, setPromoCode] = useState('');
    const [customer, setCustomer] = useState({
        firstName: '',
        surname: '',
        mobile: '',
        email: '',
        confirmEmail: '',
        registration: '',
        address: '',
        notes: '',
    });
    const [serviceLocation, setServiceLocation] = useState(null);
    const [termsAccepted, setTermsAccepted] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [serviceAreaStatus, setServiceAreaStatus] = useState(null);

    const allowance = selection?.packageTier === 'premium' ? 4 : 2;
    const customerTypeLabel = selection ? CUSTOMER_TYPES[selection.customerType] : '';
    const packageLabel = selection ? `${selection.packageTier[0].toUpperCase()}${selection.packageTier.slice(1)}` : '';
    const days = useMemo(() => makeCalendarDays(month), [month]);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const selectedDateKey = selectedDate ? dateKey(selectedDate) : '';
    const distanceKm = getDistanceFromServiceCenter(serviceLocation);
    const serviceAreaAllowed = distanceKm !== null && distanceKm <= SERVICE_RADIUS_KM;

    useEffect(() => {
        const timer = window.setInterval(() => setNow(new Date()), 30_000);
        return () => window.clearInterval(timer);
    }, []);

    useEffect(() => {
        const first = new Date(month.getFullYear(), month.getMonth(), 1);
        const last = new Date(month.getFullYear(), month.getMonth() + 1, 0);
        const controller = new AbortController();
        const loadAvailability = async () => {
            setAvailabilityError('');
            try {
                const url = new URL(AVAILABILITY_ENDPOINT, window.location.origin);
                url.searchParams.set('from', dateKey(first));
                url.searchParams.set('to', dateKey(last));
                const response = await fetch(url, { signal: controller.signal });
                if (!response.ok) throw new Error('Booking availability could not be loaded.');
                const result = await response.json();
                setBookedSlots(result.bookedSlots || {});
            } catch (loadError) {
                if (loadError.name !== 'AbortError') {
                    setAvailabilityError('Live availability is temporarily unavailable. Please try again shortly.');
                }
            }
        };
        loadAvailability();
        const timer = window.setInterval(loadAvailability, 30_000);
        return () => {
            controller.abort();
            window.clearInterval(timer);
        };
    }, [month]);

    useEffect(() => {
        if (!selectedDate || !selectedTime) return;
        const isPast = selectedDate < today;
        const isWeekend = selectedDate.getDay() === 0 || selectedDate.getDay() === 6;
        const slotDateTime = new Date(`${selectedDateKey}T${selectedTime}:00+02:00`);
        if (isPast || isWeekend || (bookedSlots[selectedDateKey] || []).includes(selectedTime)
            || slotDateTime.getTime() - now.getTime() < MIN_LEAD_TIME_MS) {
            setSelectedTime('');
        }
    }, [bookedSlots, now, selectedDate, selectedDateKey, selectedTime, today]);

    const updateCustomer = (event) => {
        const { name, value } = event.target;
        setCustomer((current) => ({ ...current, [name]: value }));
        setError('');
    };

    const updateAddress = (address, preserveServiceLocation = false) => {
        setCustomer((current) => ({ ...current, address }));
        if (!preserveServiceLocation) {
            setServiceLocation(null);
            setServiceAreaStatus(null);
        }
    };

    const updateLocation = (location) => {
        setServiceLocation(location);
        const distance = getDistanceFromServiceCenter(location);
        setServiceAreaStatus(distance);
        if (distance !== null && distance > SERVICE_RADIUS_KM) {
            setCustomer((current) => ({ ...current, address: '' }));
        }
    };

    const submitBooking = async (event) => {
        event.preventDefault();
        if (isSubmitting || !selection || bookingRequest.request) return;
        setError('');
        if (!selectedDate || !selectedTime) {
            setError('Choose an available booking date and time.');
            return;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email.trim())) {
            setError('Enter the email address assigned to your monthly package.');
            return;
        }
        if (customer.email.trim().toLowerCase() !== customer.confirmEmail.trim().toLowerCase()) {
            setError('Please make sure both email addresses match.');
            return;
        }
        if (!looksLikeRegistration(customer.registration)) {
            setError('Enter a valid-looking vehicle registration number.');
            return;
        }
        if (!serviceAreaAllowed || !customer.address.trim()) {
            setError('Pin your service location on the map and enter an in-area address.');
            return;
        }
        if (!termsAccepted) {
            setError('Accept the booking terms and confirm your service details to continue.');
            return;
        }
        if (!promoCode.trim()) {
            setError('Enter the monthly promo code assigned to your entitlement.');
            return;
        }

        setIsSubmitting(true);
        try {
            const booking = {
                bookingType: 'monthly-entitlement',
                purchaseType: 'single',
                packageId: 'single-wash',
                packageName: 'Single Wash',
                monthlyClientType: selection.customerType,
                monthlyPackageTier: selection.packageTier,
                vehicleType: customer.vehicleType || 'Sedan / Hatchback',
                bookingDate: selectedDateKey,
                bookingTime: selectedTime,
                serviceDurationMinutes: 90,
                travelBufferMinutes: 60,
                serviceLocation,
                promoCode: promoCode.trim().toUpperCase(),
                serviceAreaAccepted: true,
                termsAccepted: true,
                contractAccepted: false,
                customer: {
                    firstName: customer.firstName.trim(),
                    surname: customer.surname.trim(),
                    mobile: customer.mobile.trim(),
                    email: customer.email.trim().toLowerCase(),
                    registration: customer.registration.trim().toUpperCase(),
                    address: customer.address.trim(),
                    notes: customer.notes.trim(),
                },
            };
            const body = new FormData();
            body.append('booking', JSON.stringify(booking));
            const response = await fetch(BOOKING_REQUEST_ENDPOINT, { method: 'POST', body });
            const result = await response.json().catch(() => ({}));
            if (!response.ok || !result.reference || !result.continuationUrl) {
                throw new Error(result.message || 'The monthly booking request could not be submitted.');
            }
            bookingRequest.saveRequest(result, {
                bookingDate: booking.bookingDate,
                bookingTime: booking.bookingTime,
                bookingType: 'monthly',
                customerType: customerTypeLabel,
                packageTier: packageLabel,
            });
        } catch (submitError) {
            setError(submitError.message || 'The monthly booking could not be confirmed.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!selection) {
        return (
            <main className='min-h-screen bg-[#f5f7f3] px-4 py-10 sm:px-6'>
                <section className='mx-auto max-w-xl rounded-3xl border border-[#dce6de] bg-white p-6 text-center shadow-xl sm:p-10'>
                    <PackageCheck className='mx-auto size-10 text-[#31553c]' />
                    <h1 className='mt-4 font-display text-2xl font-semibold text-[#1e3128]'>Choose your monthly package</h1>
                    <p className='mt-2 text-sm leading-6 text-[#5b6560]'>Start from the booking page to select your customer type and monthly package.</p>
                    <button type='button' onClick={() => clearMonthlyRoute(true)} className='mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#1e3128] px-5 text-sm font-semibold text-white'>
                        <ArrowLeft className='size-4' /> Back to booking
                    </button>
                </section>
            </main>
        );
    }

    const selectedWash = customer.vehicleType || 'Sedan / Hatchback';
    const washPrice = WASH_PRICES[selectedWash] || WASH_PRICES['Sedan / Hatchback'];

    return (
        <main className='min-h-screen bg-[#f5f7f3] px-3 py-5 text-[#17241c] sm:px-6 sm:py-9'>
            <div className='mx-auto max-w-6xl'>
                <header className='mb-5 flex items-center justify-between gap-3 rounded-2xl bg-gradient-to-r from-[#14251c] to-[#294c37] px-4 py-4 text-white shadow-lg sm:px-7'>
                    <div>
                        <p className='text-[9px] font-bold uppercase tracking-[.18em] text-[#c5d9c9]'>A10tion To Detail · Monthly Clients</p>
                        <h1 className='mt-1 font-display text-xl font-semibold sm:text-2xl'>Book a monthly wash</h1>
                    </div>
                    <button type='button' onClick={() => clearMonthlyRoute(true)} className='inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg border border-white/20 px-3 text-xs font-semibold text-white transition hover:bg-white/10 sm:px-4'>
                        <ArrowLeft className='size-4' /><span className='hidden sm:inline'>Back</span>
                    </button>
                </header>

                <div className='grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]'>
                    <form onSubmit={submitBooking} className='min-w-0 space-y-5 rounded-2xl border border-[#dce6de] bg-white p-4 shadow-sm sm:p-6'>
                        <section className='rounded-xl border border-[#d8e5da] bg-[#f4f8f4] p-4'>
                            <div className='flex items-start gap-3'>
                                <span className='grid size-10 shrink-0 place-items-center rounded-xl bg-[#e1eee3] text-[#31553c]'><PackageCheck className='size-5' /></span>
                                <div className='min-w-0'>
                                    <h2 className='text-sm font-bold text-[#1e3128]'>Your monthly package</h2>
                                    <p className='mt-1 text-xs leading-5 text-[#52635a]'>The promo code validates your assigned entitlement and covers one eligible wash at 100%, subject to your available prepaid credits and the booking cap for this billing period.</p>
                                    <div className='mt-3 flex flex-wrap gap-2'>
                                        <span className='rounded-full bg-white px-3 py-1.5 text-[11px] font-bold text-[#31553c]'>{customerTypeLabel}</span>
                                        <span className='rounded-full bg-white px-3 py-1.5 text-[11px] font-bold text-[#31553c]'>{packageLabel} · {allowance} bookings per billing period</span>
                                    </div>
                                </div>
                            </div>
                        </section>

                        <section>
                            <h2 className='flex items-center gap-2 text-sm font-bold text-[#1e3128]'><CalendarDays className='size-4' /> Choose a date and time</h2>
                            <div className='mt-3 rounded-xl border border-[#e1e9e2] p-3 sm:p-4'>
                                <div className='flex items-center justify-between gap-3'>
                                    <button type='button' aria-label='Previous month' disabled={month.getFullYear() === today.getFullYear() && month.getMonth() <= today.getMonth()} onClick={() => { setMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1)); setSelectedDate(null); setSelectedTime(''); }} className='grid size-9 place-items-center rounded-lg border border-[#dce6de] disabled:opacity-35'><ChevronLeft className='size-4' /></button>
                                    <h3 className='text-sm font-bold text-[#1e3128]'>{formatMonth(month)}</h3>
                                    <button type='button' aria-label='Next month' onClick={() => { setMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1)); setSelectedDate(null); setSelectedTime(''); }} className='grid size-9 place-items-center rounded-lg border border-[#dce6de]'><ChevronRight className='size-4' /></button>
                                </div>
                                <div className='mt-3 grid grid-cols-7 gap-1 text-center'>
                                    {WEEKDAYS.map((day) => <span key={day} className='py-1 text-[9px] font-bold text-[#68776e]'>{day}</span>)}
                                    {days.map((date, index) => {
                                        if (!date) return <span key={`empty-${index}`} />;
                                        const key = dateKey(date);
                                        const disabled = date < today || date.getDay() === 0 || date.getDay() === 6;
                                        const active = selectedDateKey === key;
                                        return <button key={key} type='button' disabled={disabled} onClick={() => { setSelectedDate(date); setSelectedTime(''); }} className={`aspect-square rounded-lg text-xs font-semibold transition ${active ? 'bg-[#1e4931] text-white' : disabled ? 'cursor-not-allowed text-[#b3bbb5]' : 'text-[#35483b] hover:bg-[#edf4ee]'}`}>{date.getDate()}</button>;
                                    })}
                                </div>
                                <p className='mt-2 text-[10px] text-[#68776e]' role='status'>{availabilityError || 'Weekday appointments require at least 3 hours notice.'}</p>
                                <div className='mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5'>
                                    {BOOKING_SLOTS.map((time) => {
                                        const slotDateTime = selectedDate ? new Date(`${selectedDateKey}T${time}:00+02:00`) : null;
                                        const unavailable = !selectedDate || (bookedSlots[selectedDateKey] || []).includes(time)
                                            || (slotDateTime && slotDateTime.getTime() - now.getTime() < MIN_LEAD_TIME_MS);
                                        const active = selectedTime === time;
                                        return <button key={time} type='button' disabled={unavailable} onClick={() => setSelectedTime(time)} className={`min-h-10 rounded-lg border text-xs font-semibold ${active ? 'border-[#1e4931] bg-[#1e4931] text-white' : unavailable ? 'cursor-not-allowed border-[#e1e9e2] bg-[#f5f7f3] text-[#aab3ac]' : 'border-[#dce6de] text-[#35483b] hover:bg-[#edf4ee]'}`}>{time}</button>;
                                    })}
                                </div>
                            </div>
                        </section>

                        <section>
                            <h2 className='text-sm font-bold text-[#1e3128]'>Your details and wash</h2>
                            <div className='mt-3 grid gap-3 sm:grid-cols-2'>
                                <label className='text-[11px] font-semibold text-[#35483b]'>First name<input className='mt-1.5 min-h-11 w-full rounded-lg border border-[#cbd9cf] px-3 text-sm font-normal outline-none focus:border-[#31553c]' name='firstName' value={customer.firstName} onChange={updateCustomer} autoComplete='given-name' required /></label>
                                <label className='text-[11px] font-semibold text-[#35483b]'>Surname<input className='mt-1.5 min-h-11 w-full rounded-lg border border-[#cbd9cf] px-3 text-sm font-normal outline-none focus:border-[#31553c]' name='surname' value={customer.surname} onChange={updateCustomer} autoComplete='family-name' required /></label>
                                <label className='text-[11px] font-semibold text-[#35483b]'>Mobile number<input className='mt-1.5 min-h-11 w-full rounded-lg border border-[#cbd9cf] px-3 text-sm font-normal outline-none focus:border-[#31553c]' name='mobile' type='tel' value={customer.mobile} onChange={updateCustomer} autoComplete='tel' required /></label>
                                <label className='text-[11px] font-semibold text-[#35483b]'>Vehicle registration<input className='mt-1.5 min-h-11 w-full rounded-lg border border-[#cbd9cf] px-3 text-sm font-normal uppercase outline-none focus:border-[#31553c]' name='registration' value={customer.registration} onChange={updateCustomer} required /></label>
                                <label className='text-[11px] font-semibold text-[#35483b]'>Email address<input className='mt-1.5 min-h-11 w-full rounded-lg border border-[#cbd9cf] px-3 text-sm font-normal outline-none focus:border-[#31553c]' name='email' type='email' value={customer.email} onChange={updateCustomer} autoComplete='email' required /></label>
                                <label className='text-[11px] font-semibold text-[#35483b]'>Confirm email<input className='mt-1.5 min-h-11 w-full rounded-lg border border-[#cbd9cf] px-3 text-sm font-normal outline-none focus:border-[#31553c]' name='confirmEmail' type='email' value={customer.confirmEmail} onChange={updateCustomer} autoComplete='email' required /></label>
                                <label className='text-[11px] font-semibold text-[#35483b] sm:col-span-2'>Vehicle category<select className='mt-1.5 min-h-11 w-full rounded-lg border border-[#cbd9cf] bg-white px-3 text-sm font-normal outline-none focus:border-[#31553c]' name='vehicleType' value={customer.vehicleType || 'Sedan / Hatchback'} onChange={updateCustomer}><option>Sedan / Hatchback</option><option>SUV / Bakkie</option><option>Minibus / Van</option></select></label>
                                <label className='text-[11px] font-semibold text-[#35483b] sm:col-span-2'>Booking message <span className='font-normal text-[#68776e]'>(optional)</span><textarea className='mt-1.5 min-h-20 w-full resize-y rounded-lg border border-[#cbd9cf] px-3 py-2 text-sm font-normal outline-none focus:border-[#31553c]' name='notes' value={customer.notes} onChange={updateCustomer} maxLength={300} /></label>
                            </div>
                        </section>

                        <section>
                            <h2 className='flex items-center gap-2 text-sm font-bold text-[#1e3128]'><MapPin className='size-4' /> Service address</h2>
                            <div className='mt-3 overflow-hidden rounded-xl border border-[#e1e9e2] p-3 sm:p-4'>
                                <Suspense fallback={<div className='grid min-h-48 place-items-center text-xs text-[#68776e]'>Loading service-area map…</div>}>
                                    <ServiceAreaPicker
                                        address={customer.address}
                                        onAddressChange={updateAddress}
                                        location={serviceLocation}
                                        onLocationChange={updateLocation}
                                        radiusKm={SERVICE_RADIUS_KM}
                                        addressInvalid={serviceAreaStatus !== null && !serviceAreaAllowed}
                                    />
                                </Suspense>
                                <p className={`mt-2 rounded-lg px-3 py-2 text-xs ${distanceKm === null ? 'bg-[#f0f2ef] text-[#52635a]' : serviceAreaAllowed ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'}`} role={distanceKm !== null && !serviceAreaAllowed ? 'alert' : 'status'}>
                                    {distanceKm === null ? 'Select your exact location on the map to check service coverage.' : serviceAreaAllowed ? `In service area · ${distanceKm.toFixed(1)} km from ${SERVICE_AREA_NAME}.` : `Outside service coverage · ${distanceKm.toFixed(1)} km away. Please contact us.`}
                                </p>
                            </div>
                        </section>

                        <section className='rounded-xl border border-[#dce6de] bg-[#f8faf8] p-4'>
                            <label className='block text-[11px] font-bold text-[#35483b]'>Monthly promo code
                                <input className='mt-1.5 min-h-12 w-full rounded-lg border border-[#cbd9cf] bg-white px-3 text-base font-bold uppercase tracking-wider outline-none focus:border-[#31553c]' value={promoCode} onChange={(event) => { setPromoCode(event.target.value.toUpperCase()); setError(''); }} autoCapitalize='characters' autoComplete='off' placeholder='Enter your assigned code' required />
                            </label>
                            <p className='mt-2 text-xs leading-5 text-[#52635a]'>Your code is checked securely against the email and monthly package assigned to you. A valid entitlement covers this eligible wash at 100%, subject to available monthly washes.</p>
                        </section>

                        <label className='flex items-start gap-2.5 text-xs leading-5 text-[#52635a]'>
                            <input type='checkbox' checked={termsAccepted} onChange={(event) => setTermsAccepted(event.target.checked)} className='mt-1 size-4 shrink-0 accent-[#31553c]' />
                            <span>I confirm my booking details and service location are accurate, and agree to the booking terms.</span>
                        </label>
                        {error && <p className='rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800' role='alert'>{error}</p>}
                        <button type='submit' disabled={isSubmitting || Boolean(bookingRequest.request)} className='flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#1e3128] px-4 text-sm font-bold text-white transition hover:bg-[#294c37] disabled:cursor-wait disabled:opacity-60'>
                            {isSubmitting ? <><LoaderCircle className='size-4 animate-spin' /> Validating entitlement and confirming…</> : <>Confirm monthly booking · R0.00 <ArrowRight className='size-4' /></>}
                        </button>
                        <p className='flex items-center justify-center gap-1.5 text-[10px] text-[#68776e]'><ShieldCheck className='size-3.5' /> No Yoco payment required for a valid monthly wash.</p>
                    </form>

                    <aside className='space-y-4 lg:sticky lg:top-5'>
                        <section className='rounded-2xl border border-[#dce6de] bg-white p-5 shadow-sm'>
                            <p className='text-[10px] font-bold uppercase tracking-[.14em] text-[#31553c]'>Booking summary</p>
                            <h2 className='mt-2 text-lg font-bold text-[#1e3128]'>{customerTypeLabel}</h2>
                            <p className='text-sm text-[#52635a]'>{packageLabel} · up to {allowance} bookings per billing period; unused prepaid washes roll over.</p>
                            <div className='my-4 h-px bg-[#e6e9e3]' />
                            <div className='flex justify-between gap-3 text-xs'><span className='text-[#68776e]'>Wash</span><strong className='text-right'>{selectedWash}</strong></div>
                            <div className='mt-2 flex justify-between gap-3 text-xs'><span className='text-[#68776e]'>Standard wash price</span><strong>{formatZar(washPrice)}</strong></div>
                            <div className='mt-3 flex justify-between gap-3 border-t border-[#e6e9e3] pt-3 text-sm'><span className='font-semibold'>Amount due</span><strong className='text-[#1e4931]'>R0.00*</strong></div>
                            <p className='mt-2 text-[10px] leading-4 text-[#68776e]'>*The monthly code is validated when you confirm. If it is inactive, mismatched, expired or out of washes, the booking will not be confirmed.</p>
                        </section>
                        <section className='rounded-2xl border border-[#dce6de] bg-[#edf4ee] p-5'>
                            <div className='flex items-center gap-2 text-sm font-bold text-[#1e3128]'><Clock3 className='size-4' /> How monthly booking works</div>
                            <ol className='mt-3 space-y-2 text-xs leading-5 text-[#52635a]'>
                                <li>1. Enter the email linked to your entitlement and its assigned code.</li>
                                <li>2. We check your available wash credits and the booking cap for this billing period.</li>
                                <li>3. Once confirmed, one wash is recorded and your total due is R0.00.</li>
                            </ol>
                        </section>
                    </aside>
                </div>
            </div>
            <BookingRequestModal controller={bookingRequest} />
        </main>
    );
}
