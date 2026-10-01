import { useEffect, useMemo, useRef, useState } from 'react';
import {
    ArrowRight,
    CalendarClock,
    CarFront,
    CheckCircle2,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    Clock3,
    CreditCard,
    LoaderCircle,
    MapPin,
    Package,
    RefreshCw,
    ShieldCheck,
    Sun,
    Tag,
    X,
    Zap,
    Droplet,
} from 'lucide-react';
import useReveal from '../hooks/use-reveal';
import VehiclePromoModal from '../components/vehicle-promo-modal';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
const PAYMENT_API_ENDPOINT = `${API_BASE_URL}/api/payments/yoco/checkout`;
const AVAILABILITY_API_ENDPOINT = `${API_BASE_URL}/api/bookings/availability`;
const AVAILABILITY_REFRESH_MS = 30_000;
const SERVICE_RADIUS_KM = Number(import.meta.env.VITE_SERVICE_RADIUS_KM || 15);
const BUSINESS_ADDRESS = '2 Pinnacle Crescent, Strandfontein';
const SINGLE_WASH_VEHICLE_KEY = 'a10tion-single-wash-vehicle-type';

const PAYMENT_STATUS_MESSAGES = {
    success: { tone: 'success', text: 'Payment received - thank you! Your booking is confirmed and a receipt is on its way.' },
    cancelled: { tone: 'info', text: 'Checkout was cancelled. No payment was taken - you can restart whenever you\u2019re ready.' },
    failed: { tone: 'error', text: 'The payment did not go through. Please try again or use a different card.' },
};

const REQUIRED_CONTRACT_FILE_NAME = 'Supplier_Client Contract Agreement.docx';

function readSingleWashVehicle() {
    try {
        return sessionStorage.getItem(SINGLE_WASH_VEHICLE_KEY) || '';
    } catch {
        return '';
    }
}

const packageNames = {
    'single-wash': 'Single Wash',
    'private-standard': 'Private Client - Standard Package',
    'private-premium': 'Private Client - Premium Package',
    'business-standard': 'Business / Fleet / Family - Standard Package',
    'business-premium': 'Business / Fleet / Family - Premium Package',
};

const bookingSlots = [
    { time: '08:00', window: '08:00 - 09:30' },
    { time: '10:30', window: '10:30 - 13:00' },
    { time: '13:00', window: '13:00 - 15:30' },
    { time: '15:30', window: '15:30 - 18:00' },
    { time: '18:00', window: '18:00 - 20:30' },
];

const bookingPoints = [
    { icon: CalendarClock, title: 'Flexible slots' },
    { icon: MapPin, title: 'Mobile service' },
    { icon: ShieldCheck, title: 'Secure checkout' },
];

const unavailableSlots = {};

/** Loose SA-style plate check: letters/digits with optional spaces or hyphens, 5–12 chars after stripping. */
function looksLikeVehicleRegistration(value) {
    const cleaned = String(value || '').trim().toUpperCase().replace(/[\s-]/g, '');
    if (cleaned.length < 5 || cleaned.length > 12) return false;
    if (!/^[A-Z0-9]+$/.test(cleaned)) return false;
    if (!/[A-Z]/.test(cleaned) || !/[0-9]/.test(cleaned)) return false;
    return true;
}

/** Client-side reference prices in cents (server recalculates securely). */
const SINGLE_WASH_BASE_PRICES = {
    'Sedan / Hatchback': 65000,
    'SUV / Bakkie': 85000,
    'Minibus / Van': 110000,
};

function formatZarFromCents(cents) {
    return `R${(cents / 100).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const onsiteRequirements = [
    { icon: CarFront, text: 'A paved, level parking bay' },
    { icon: Sun, text: 'Preferable shaded area' },
    { icon: Clock3, text: 'Vehicle available for the full appointment window' },
];

const fieldClassName = `
    min-h-[37px] w-full rounded-[9px] border border-line bg-white px-2.5
    text-[10.5px] text-left text-ink outline-none transition placeholder:text-[10px] placeholder:text-body/45
    focus:border-sage/60 focus:ring-2 focus:ring-sage/10
    sm:min-h-[43px] sm:px-3 sm:text-[11.5px] sm:placeholder:text-[11px]
`;

const monthFormatter = new Intl.DateTimeFormat('en-ZA', { month: 'long', year: 'numeric' });
const dateFormatter = new Intl.DateTimeFormat('en-ZA', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });

function startOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfMonth(date) {
    return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date) {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function addMonths(date, amount) {
    return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function dateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function isSameDate(a, b) {
    return dateKey(a) === dateKey(b);
}

function isSameMonth(a, b) {
    return a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
}

function slotDateTime(date, time) {
    const [hours, minutes] = time.split(':').map(Number);
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), hours, minutes);
}

function normaliseBookedSlots(payload) {
    const source = payload?.bookedSlots ?? payload?.unavailableSlots ?? payload?.bookings ?? payload ?? {};
    if (!Array.isArray(source)) return source && typeof source === 'object' ? source : {};

    return source.reduce((result, booking) => {
        const bookingDate = booking?.date ?? booking?.bookingDate;
        const bookingTime = booking?.time ?? booking?.bookingTime;
        if (!bookingDate || !bookingTime) return result;
        result[bookingDate] = [...(result[bookingDate] || []), bookingTime];
        return result;
    }, {});
}

function readStoredSelection() {
    try {
        const purchaseType = sessionStorage.getItem('a10tion-purchase-type') || 'single';
        const packageId = sessionStorage.getItem('a10tion-selected-package') || 'single-wash';
        const contract = sessionStorage.getItem('a10tion-selected-contract');
        return { purchaseType, packageId, contract };
    } catch {
        return { purchaseType: 'single', packageId: 'single-wash', contract: null };
    }
}

export default function BookingSection() {
    const ref = useReveal();
    const checkoutDialogRef = useRef(null);
    const checkoutScrollRef = useRef(null);
    const [now, setNow] = useState(() => new Date());
    const [paymentStatus, setPaymentStatus] = useState(null);
    const [paymentReference, setPaymentReference] = useState(null);
    const [calendarMonth, setCalendarMonth] = useState(() => startOfMonth(new Date()));
    const [bookedSlots, setBookedSlots] = useState({});
    const [selectedDate, setSelectedDate] = useState(null);
    const [selectedTime, setSelectedTime] = useState(null);
    const initialSelection = readStoredSelection();
    const [purchaseType, setPurchaseType] = useState(initialSelection.purchaseType);
    const [selectedPackage, setSelectedPackage] = useState(initialSelection.packageId);
    const [selectedContract, setSelectedContract] = useState(initialSelection.contract);
    const [selectedVehicleType, setSelectedVehicleType] = useState(readSingleWashVehicle);
    const [requirementsOpen, setRequirementsOpen] = useState(false);
    const [checkoutOpen, setCheckoutOpen] = useState(false);
    const [promoRegistrationOpen, setPromoRegistrationOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [paymentError, setPaymentError] = useState('');
    const [promoCode, setPromoCode] = useState(() => {
        try {
            return sessionStorage.getItem('a10tionPromoCode') || '';
        } catch {
            return '';
        }
    });
    const [termsAccepted, setTermsAccepted] = useState(false);
    const [contractAccepted, setContractAccepted] = useState(false);
    const [contractFiles, setContractFiles] = useState([]);
    const [contractFileError, setContractFileError] = useState('');
    const [serviceAreaAccepted, setServiceAreaAccepted] = useState(false);
    const [customer, setCustomer] = useState({
        firstName: '',
        surname: '',
        mobile: '',
        email: '',
        vehicle: '',
        registration: '',
        address: '',
        notes: '',
    });
    const [confirmEmail, setConfirmEmail] = useState('');

    useEffect(() => {
        const syncPromoCode = (event) => setPromoCode(event.detail?.promoCode || '');
        window.addEventListener('a10tion-promo-code-updated', syncPromoCode);
        return () => window.removeEventListener('a10tion-promo-code-updated', syncPromoCode);
    }, []);

    const today = startOfDay(now);
    const todayKey = dateKey(today);
    const calendarMonthKey = dateKey(calendarMonth);

    const isWeekday = (date) => {
        if (!date) return false;
        const day = date.getDay();
        return day >= 1 && day <= 5; // Mon–Fri only
    };

    /** Monday-first offset: Mon=0 … Fri=4 (weekends never appear). */
    const mondayFirstOffset = (date) => {
        const day = date.getDay(); // 0=Sun … 6=Sat
        if (day === 0 || day === 6) return 0; // unused for weekends
        return day - 1; // Mon→0, Tue→1, … Fri→4
    };

    const calendarDates = useMemo(() => {
        const monthEnd = endOfMonth(calendarMonth);
        const firstVisibleDate = isSameMonth(calendarMonth, today) ? today : startOfMonth(calendarMonth);

        // Leading empty cells so the first weekday lines up under Mon–Fri headers
        let lead = 0;
        if (isWeekday(firstVisibleDate)) {
            lead = mondayFirstOffset(firstVisibleDate);
        } else {
            // If first visible day is a weekend, find the next Monday and lead with 0
            const probe = new Date(firstVisibleDate);
            while (!isWeekday(probe) && probe <= monthEnd) {
                probe.setDate(probe.getDate() + 1);
            }
            lead = isWeekday(probe) ? mondayFirstOffset(probe) : 0;
        }

        const dates = Array.from({ length: lead }, () => null);

        for (let day = firstVisibleDate.getDate(); day <= monthEnd.getDate(); day += 1) {
            const d = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day);
            if (isWeekday(d)) dates.push(d);
        }
        while (dates.length % 5 !== 0) dates.push(null);
        return dates;
    }, [calendarMonthKey, todayKey]);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const status = params.get('payment');
        if (status && PAYMENT_STATUS_MESSAGES[status]) {
            setPaymentStatus(status);
            setPaymentReference(params.get('ref'));
            params.delete('payment');
            params.delete('ref');
            const cleanedSearch = params.toString();
            const cleanedUrl = `${window.location.pathname}${cleanedSearch ? `?${cleanedSearch}` : ''}${window.location.hash}`;
            window.history.replaceState(null, '', cleanedUrl);
        }
    }, []);

    useEffect(() => {
        const refreshClock = () => setNow(new Date());
        const timer = window.setInterval(refreshClock, AVAILABILITY_REFRESH_MS);
        window.addEventListener('focus', refreshClock);
        return () => {
            window.clearInterval(timer);
            window.removeEventListener('focus', refreshClock);
        };
    }, []);

    useEffect(() => {
        const minimum = startOfMonth(today);
        const maximum = addMonths(minimum, 1);
        setCalendarMonth((current) => current < minimum ? minimum : current > maximum ? maximum : current);
    }, [todayKey]);

    useEffect(() => {
        let active = true;
        let controller;

        const refresh = async () => {
            controller?.abort();
            controller = new AbortController();
            const from = isSameMonth(calendarMonth, today) ? today : startOfMonth(calendarMonth);
            const endpoint = new URL(AVAILABILITY_API_ENDPOINT, window.location.origin);
            endpoint.searchParams.set('from', dateKey(from));
            endpoint.searchParams.set('to', dateKey(endOfMonth(calendarMonth)));

            try {
                const response = await fetch(endpoint, { cache: 'no-store', signal: controller.signal });
                if (!response.ok) return;
                const result = await response.json();
                if (active) setBookedSlots(normaliseBookedSlots(result));
            } catch (error) {
                if (error?.name !== 'AbortError') {
                    // Keep last-known availability if the endpoint is temporarily unavailable.
                }
            }
        };

        refresh();
        const timer = window.setInterval(refresh, AVAILABILITY_REFRESH_MS);
        window.addEventListener('focus', refresh);
        return () => {
            active = false;
            controller?.abort();
            window.clearInterval(timer);
            window.removeEventListener('focus', refresh);
        };
    }, [calendarMonthKey, todayKey]);

    useEffect(() => {
        const syncSelection = () => {
            const next = readStoredSelection();
            setPurchaseType(next.purchaseType);
            setSelectedPackage(next.packageId);
            setSelectedContract(next.contract);
            setSelectedVehicleType(readSingleWashVehicle());
            if (next.purchaseType !== 'single') {
                setPromoCode('');
            }
        };

        window.addEventListener('a10tion-package-selected', syncSelection);
        window.addEventListener('hashchange', syncSelection);
        return () => {
            window.removeEventListener('a10tion-package-selected', syncSelection);
            window.removeEventListener('hashchange', syncSelection);
        };
    }, []);

    useEffect(() => {
        if (!checkoutOpen) return undefined;
        const previous = document.body.style.overflow;
        const escape = (event) => {
            if (event.key === 'Escape' && !isSubmitting) setCheckoutOpen(false);
        };
        document.body.style.overflow = 'hidden';
        document.addEventListener('keydown', escape);
        return () => {
            document.body.style.overflow = previous;
            document.removeEventListener('keydown', escape);
        };
    }, [checkoutOpen, isSubmitting]);

    useEffect(() => {
        if (!checkoutOpen) return undefined;
        const dialog = checkoutDialogRef.current;
        const scroller = checkoutScrollRef.current;
        if (!dialog || !scroller) return undefined;

        const handleWheel = (event) => {
            if (event.deltaY === 0) return;
            const target = event.target;
            const textareaCanScroll = target instanceof HTMLTextAreaElement
                && target.scrollHeight > target.clientHeight
                && (event.deltaY < 0
                    ? target.scrollTop > 0
                    : target.scrollTop + target.clientHeight < target.scrollHeight);
            if (textareaCanScroll) return;

            event.preventDefault();
            const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? scroller.clientHeight : 1);
            scroller.scrollTop += delta;
        };

        dialog.addEventListener('wheel', handleWheel, { passive: false });
        return () => dialog.removeEventListener('wheel', handleWheel);
    }, [checkoutOpen]);

    const selectedDateKey = selectedDate ? dateKey(selectedDate) : null;
    const blockedTimes = selectedDateKey
        ? [...new Set([...(unavailableSlots[selectedDateKey] || []), ...(bookedSlots[selectedDateKey] || [])])]
        : [];

    useEffect(() => {
        if (selectedDate && (selectedDate < today || !isWeekday(selectedDate))) {
            setSelectedDate(null);
            setSelectedTime(null);
            return;
        }
        if (selectedDate && selectedTime && (blockedTimes.includes(selectedTime) || slotDateTime(selectedDate, selectedTime) <= now)) {
            setSelectedTime(null);
        }
    }, [selectedDateKey, selectedTime, bookedSlots, now, todayKey]);

    const selectedPackageName = packageNames[selectedPackage] || 'Single Wash';
    const isMonthly = purchaseType === 'monthly';
    const missingSelection = !selectedDate
        ? 'Choose a date to continue'
        : !selectedTime
          ? 'Choose a time to continue'
                    : !isMonthly && !selectedVehicleType
                        ? 'Select your package to purchase'
          : isMonthly && !selectedContract
            ? 'Choose a monthly package first'
            : null;

    const updateCustomer = (event) => {
        const { name, value } = event.target;
        setCustomer((current) => ({ ...current, [name]: value }));
    };

    const emailMismatch = confirmEmail.length > 0
        && confirmEmail.trim().toLowerCase() !== customer.email.trim().toLowerCase();

    const beginSecurePayment = async (event) => {
        event.preventDefault();
        if (missingSelection || isSubmitting) return;

        if (!looksLikeVehicleRegistration(customer.registration)) {
            setPaymentError('Please enter a valid-looking vehicle registration number (e.g. CA 123-456 or GP 12 AB C).');
            return;
        }

        if (confirmEmail.trim().toLowerCase() !== customer.email.trim().toLowerCase()) {
            setPaymentError('Please make sure both email addresses match.');
            return;
        }

        if (!termsAccepted || !serviceAreaAccepted || (isMonthly && !contractAccepted)) {
            setPaymentError('Please accept the required booking and agreement confirmations before continuing.');
            return;
        }

        if (isMonthly) {
            const [contractFile] = contractFiles;
            const isValidContractFile = contractFiles.length === 1
                && contractFile?.name === REQUIRED_CONTRACT_FILE_NAME
                && (contractFile.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                    || contractFile.name.toLowerCase().endsWith('.docx'))
                && contractFile.size <= 10 * 1024 * 1024;

            if (!isValidContractFile) {
                setContractFileError(`Attach the completed ${REQUIRED_CONTRACT_FILE_NAME}. It must be a DOCX no larger than 10 MB.`);
                setPaymentError('The completed supplier client contract agreement is required for a monthly package.');
                return;
            }
        }

        setIsSubmitting(true);
        setPaymentError('');

        try {
            const bookingPayload = {
                    purchaseType,
                    packageId: selectedPackage,
                    packageName: selectedPackageName,
                    vehicleType: !isMonthly ? selectedVehicleType : null,
                    contractOption: isMonthly ? selectedContract : null,
                    bookingDate: selectedDateKey,
                    bookingTime: selectedTime,
                    serviceDurationMinutes: 90,
                    travelBufferMinutes: 60,
                    promoCode: purchaseType === 'single' && promoCode.trim() ? promoCode.trim().toUpperCase() : null,
                    serviceAreaAccepted,
                    termsAccepted,
                    contractAccepted: isMonthly ? contractAccepted : false,
                    customer: {
                        ...customer,
                        registration: customer.registration.trim().toUpperCase(),
                    },
                };
            const formData = new FormData();
            formData.append('booking', JSON.stringify(bookingPayload));
            if (isMonthly) contractFiles.forEach((file) => formData.append('contract_files', file, file.name));

            const response = await fetch(PAYMENT_API_ENDPOINT, {
                method: 'POST',
                body: formData,
            });

            const result = await response.json().catch(() => ({}));
            if (!response.ok || typeof result.redirectUrl !== 'string') {
                throw new Error(result.message || 'Secure payment could not be started.');
            }
            window.location.assign(result.redirectUrl);
        } catch (error) {
            setPaymentError(error instanceof Error ? error.message : 'Secure payment could not be started. Please try again.');
            setIsSubmitting(false);
        }
    };

    const previousMonthDisabled = isSameMonth(calendarMonth, today);
    const nextMonthDisabled = isSameMonth(calendarMonth, addMonths(startOfMonth(today), 1));

    return (
        <section id='booking' className='w-full min-w-0 overflow-x-clip px-2 pt-9 sm:px-4 sm:pt-12 md:px-8 lg:px-10 lg:pt-14'>
            <div ref={ref} className='reveal mx-auto w-full max-w-6xl rounded-[19px] bg-canvasoft p-2.5 sm:rounded-[25px] sm:p-5 lg:p-6'>
                <div className='text-center'>
                    <p className='inline-flex items-center gap-2 text-[8.5px] font-semibold uppercase tracking-[0.16em] text-sage sm:text-[10px]'><span className='h-px w-5 bg-sage' /> Booking <span className='h-px w-5 bg-sage' /></p>
                    <h2 className='mt-1 font-display text-[24px] font-medium tracking-[-0.025em] text-ink sm:text-[32px]'>Reserve your slot</h2>
                    <p className='mx-auto mt-1 max-w-lg text-[9.5px] leading-[1.5] text-body sm:text-[11px]'>Choose a date and time, then complete your vehicle and payment details.</p>
                </div>

                {paymentStatus && PAYMENT_STATUS_MESSAGES[paymentStatus] && (
                    <div
                        role='status'
                        className={`mx-auto mt-3 flex max-w-xl items-start gap-2 rounded-[12px] border px-3 py-2.5 text-[9.5px] leading-[1.5] sm:text-[10.5px] ${
                            PAYMENT_STATUS_MESSAGES[paymentStatus].tone === 'success'
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                                : PAYMENT_STATUS_MESSAGES[paymentStatus].tone === 'error'
                                  ? 'border-red-200 bg-red-50 text-red-700'
                                  : 'border-line bg-white text-body'
                        }`}
                    >
                        <span className='flex-1'>
                            {PAYMENT_STATUS_MESSAGES[paymentStatus].text}
                            {paymentStatus === 'success' && paymentReference && (
                                <span className='mt-1 block font-semibold'>Reference: {paymentReference}</span>
                            )}
                        </span>
                        <button type='button' onClick={() => setPaymentStatus(null)} className='shrink-0 text-current/70 hover:text-current' aria-label='Dismiss'>
                            <X className='size-3.5' />
                        </button>
                    </div>
                )}

                <div className='mx-auto mt-3 flex max-w-xl items-center justify-between gap-2 rounded-[12px] border border-line bg-white px-2.5 py-2 sm:mt-4 sm:px-3'>
                    <div className='flex min-w-0 items-center gap-2'>
                        <div className='grid size-7 shrink-0 place-items-center rounded-full bg-sagelight text-sagedeep'><Package className='size-3.5' /></div>
                        <div className='min-w-0 text-left'>
                            <p className='text-[7.5px] font-semibold uppercase tracking-[0.11em] text-sage'>{isMonthly ? 'Monthly package' : 'Once-off booking'}</p>
                            <p className='truncate text-[9.5px] font-semibold text-ink sm:text-[10.5px]'>{selectedPackageName}{!isMonthly && selectedVehicleType ? ` · ${selectedVehicleType}` : ''}{isMonthly && selectedContract ? ` · ${selectedContract.replace('-', ' ')}` : ''}</p>
                        </div>
                    </div>
                    <a href='#pricing' className='shrink-0 rounded-full border border-sage/25 bg-canvasoft px-2.5 py-1.5 text-[8px] font-semibold text-sagedeep transition hover:border-sage/45'>Change</a>
                </div>

                <div className='mt-3 grid gap-3 lg:grid-cols-[0.7fr_1.3fr] lg:gap-5'>
                    <aside className='order-2 lg:order-1'>
                        <div className='rounded-[15px] border border-line bg-white/70 p-3 sm:p-4'>
                            <div className='flex items-start gap-2'>
                                <MapPin className='mt-0.5 size-4 shrink-0 text-sagedeep' />
                                <div>
                                    <p className='text-[9px] font-bold uppercase tracking-[0.12em] text-sage sm:text-[10px]'>Mobile service radius</p>
                                    <p className='mt-1 text-[9.5px] leading-[1.5] text-body sm:text-[10.5px]'>Approximately <strong>{SERVICE_RADIUS_KM} km</strong> from {BUSINESS_ADDRESS}. For addresses beyond the standard radius, include a request in your booking message or enquire through the contact form before purchasing.</p>
                                </div>
                            </div>

                            <button type='button' onClick={() => setRequirementsOpen((current) => !current)} className='mt-2.5 flex min-h-[36px] w-full items-center justify-between rounded-[9px] border border-line bg-canvasoft px-3 text-[9px] font-semibold text-ink sm:text-[10px]' aria-expanded={requirementsOpen}>
                                What we need on-site
                                <ChevronDown className={`size-3.5 transition-transform ${requirementsOpen ? 'rotate-180' : ''}`} />
                            </button>
                            <div className={`grid transition-[grid-template-rows] duration-300 ${requirementsOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                                <div className='overflow-hidden'>
                                    <div className='mt-2 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2'>
                                        {onsiteRequirements.map(({ icon: Icon, text }) => (
                                            <div key={text} className='flex items-start gap-2 rounded-[9px] bg-canvasoft px-2.5 py-2'>
                                                <Icon className='mt-0.5 size-3.5 shrink-0 text-sagedeep' />
                                                <p className='text-[8.5px] leading-[1.4] text-body sm:text-[9.5px]'>{text}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className='mt-2 grid grid-cols-3 gap-1.5'>
                            {bookingPoints.map(({ icon: Icon, title }) => (
                                <div key={title} className='flex min-h-[54px] flex-col items-center justify-center gap-1 rounded-[10px] border border-line bg-white/70 px-1.5 text-center'>
                                    <Icon className='size-3.5 text-sagedeep' />
                                    <p className='text-[7.5px] font-semibold leading-tight text-ink sm:text-[8.5px]'>{title}</p>
                                </div>
                            ))}
                        </div>
                    </aside>

                    <div className='order-1 min-w-0 rounded-[15px] border border-line bg-white p-2.5 shadow-[0_20px_55px_-40px_rgba(20,26,22,.35)] sm:p-4 lg:order-2'>
                        <div className='flex items-center justify-between gap-2'>
                            <div className='min-w-0'>
                                <p className='truncate font-display text-[15px] font-medium text-ink sm:text-[18px]'>{monthFormatter.format(calendarMonth)}</p>
                            </div>
                            <div className='flex gap-1'>
                                <button type='button' disabled={previousMonthDisabled} onClick={() => { setCalendarMonth((current) => addMonths(current, -1)); setSelectedDate(null); setSelectedTime(null); }} className='grid size-7 place-items-center rounded-full border border-line text-body disabled:opacity-25 sm:size-8' aria-label='Previous month'><ChevronLeft className='size-3.5' /></button>
                                <button type='button' disabled={nextMonthDisabled} onClick={() => { setCalendarMonth((current) => addMonths(current, 1)); setSelectedDate(null); setSelectedTime(null); }} className='grid size-7 place-items-center rounded-full border border-line text-body disabled:opacity-25 sm:size-8' aria-label='Next month'><ChevronRight className='size-3.5' /></button>
                            </div>
                        </div>

                        <div className='mt-2 grid grid-cols-5 gap-0.5 sm:gap-1'>
                            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((day) => (
                                <span key={day} className='text-center text-[6.5px] font-bold uppercase text-body/45 sm:text-[8px]'>{day}</span>
                            ))}
                            {calendarDates.map((date, index) => {
                                if (!date) return <span key={`empty-${index}`} className='min-h-[29px] sm:min-h-[37px]' />;
                                const selected = Boolean(selectedDate && isSameDate(date, selectedDate));
                                const todayDate = isSameDate(date, today);
                                return (
                                    <button
                                        key={dateKey(date)}
                                        type='button'
                                        onClick={() => {
                                            setSelectedDate(date);
                                            setSelectedTime(null);
                                        }}
                                        className={`grid min-h-[29px] place-items-center rounded-[7px] border px-0 text-[9px] font-semibold transition sm:min-h-[37px] sm:text-[10.5px] ${
                                            selected
                                                ? 'border-sage/50 bg-[#1d3426] text-white'
                                                : todayDate
                                                  ? 'border-sage/40 bg-sagelight text-sagedeep'
                                                  : 'border-transparent bg-canvasoft/65 text-body hover:border-sage/25 hover:text-ink'
                                        }`}
                                        aria-pressed={selected}
                                    >
                                        {date.getDate()}
                                    </button>
                                );
                            })}
                        </div>

                        <div className='mt-2 flex items-center justify-between gap-2'>
                            <p className='truncate text-[7.5px] font-semibold uppercase tracking-[0.05em] text-body/70 sm:text-[9px]'>{selectedDate ? dateFormatter.format(selectedDate) : 'Choose a booking date'}</p>
                            <p className='shrink-0 text-[8px] font-medium text-sagedeep sm:text-[9px]'>1.5hr service</p>
                        </div>

                        <div className='mt-1.5 grid grid-cols-3 gap-1 sm:grid-cols-4 sm:gap-2'>
                            {bookingSlots.map((slot) => {
                                const unavailable = blockedTimes.includes(slot.time) || Boolean(selectedDate && slotDateTime(selectedDate, slot.time) <= now);
                                const selected = selectedTime === slot.time;
                                return (
                                    <button key={slot.time} type='button' disabled={!selectedDate || unavailable} onClick={() => setSelectedTime(slot.time)} className={`min-h-[31px] rounded-[7px] border px-0 text-[8.5px] font-semibold transition sm:min-h-[40px] sm:text-[10.5px] ${selected ? 'border-[#274633] bg-[#1d3426] text-white' : unavailable ? 'cursor-not-allowed border-line bg-canvasoft text-body/25 line-through' : !selectedDate ? 'cursor-not-allowed border-line bg-canvasoft text-body/30' : 'border-line bg-white text-ink hover:border-sage/45 hover:bg-sagelight'}`} title={slot.window}>
                                        {slot.time}
                                    </button>
                                );
                            })}
                        </div>
                        <div className='mt-2 flex items-start gap-2 rounded-[10px] border border-amber-200/80 bg-amber-50 px-2.5 py-2 sm:px-3 sm:py-2.5' role='note'>
                            <Clock3 className='mt-0.5 size-3.5 shrink-0 text-amber-700' aria-hidden='true' />
                            <p className='text-[10px] leading-[1.45] text-amber-950 sm:text-[11px]'>
                                <span className='font-semibold'>Public holidays:</span> Hours may differ
                            </p>
                        </div>

                        <button
                            type='button'
                            disabled={Boolean(missingSelection) && missingSelection !== 'Select your package to purchase'}
                            onClick={() => {
                                if (missingSelection === 'Select your package to purchase') {
                                    document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                    return;
                                }
                                setPaymentError('');
                                setCheckoutOpen(true);
                            }}
                            className={`group mt-2.5 flex min-h-[38px] w-full items-center justify-center gap-2 rounded-[11px] px-4 text-[10px] font-semibold transition sm:min-h-[44px] sm:text-[11px] ${missingSelection ? missingSelection === 'Select your package to purchase' ? 'bg-ink text-white hover:-translate-y-px' : 'cursor-not-allowed bg-ink/15 text-body/55' : 'bg-ink text-white hover:-translate-y-px'}`}
                        >
                            {missingSelection || 'Continue to payment details'}
                            <ArrowRight className='size-3.5 transition-transform group-hover:translate-x-1' />
                        </button>
                    </div>
                </div>
            </div>

            {checkoutOpen && (
                <div
                    ref={checkoutDialogRef}
                    className='fixed inset-0 z-[100] h-[100dvh] w-screen overflow-hidden bg-[#f5f7f3]'
                    style={{ scrollbarWidth: 'none' }}
                    role='dialog'
                    aria-modal='true'
                    aria-labelledby='checkout-title'
                >
                    <button
                        type='button'
                        className='absolute inset-0 cursor-default'
                        onClick={() => !isSubmitting && setCheckoutOpen(false)}
                        aria-label='Close checkout'
                    />

                    <div className='relative mx-auto flex h-full min-h-0 w-full max-w-[1500px] items-stretch overflow-hidden'>
                        <aside className='relative hidden w-[34%] overflow-hidden bg-gradient-to-br from-[#0e1d14] via-[#172c1f] to-[#2e5039] px-10 py-10 text-white lg:h-full lg:flex lg:flex-col lg:justify-between xl:px-14'>
                            <span className='pointer-events-none absolute -right-24 -top-28 h-80 w-80 rounded-full bg-[#a8cbb0]/15 blur-[90px]' />
                            <span className='pointer-events-none absolute -bottom-32 -left-24 h-80 w-80 rounded-full bg-black/20 blur-[100px]' />

                            <div className='relative z-10'>
                                <div className='inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.06] px-3 py-1.5 text-[8px] font-semibold uppercase tracking-[0.16em] text-[#c4d8c9]'>
                                    <CreditCard className='h-3 w-3' /> Secure booking
                                </div>

                                <h2 className='mt-7 max-w-md font-display text-[42px] font-semibold leading-[1.02] tracking-[-0.04em] text-white'>
                                    Complete your booking
                                </h2>

                                <p className='mt-4 max-w-md text-[12px] leading-[1.7] text-white/65'>
                                    Everything you need to get your monthly wash package confirmed and ready for payment.
                                </p>

                                <div className='mt-9 space-y-4'>
                                    {[
                                        'Your selected monthly package and appointment.',
                                        'Your vehicle and service address details.',
                                        'Your completed package documents.',
                                        'Secure payment through Yoco.',
                                    ].map((step, index) => (
                                        <div key={step} className='flex items-start gap-3'>
                                            <span className='grid h-7 w-7 shrink-0 place-items-center rounded-full border border-white/15 bg-white/[0.06] text-[8px] font-semibold text-[#c9ddce]'>
                                                0{index + 1}
                                            </span>
                                            <p className='pt-1 text-[9.5px] leading-[1.55] text-white/55'>{step}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className='relative z-10 rounded-2xl border border-white/10 bg-white/[0.06] p-4'>
                                <p className='text-[8px] font-semibold uppercase tracking-[0.14em] text-[#c4d8c9]'>Selected package</p>
                                <p className='mt-1 text-[12px] font-semibold text-white'>{selectedPackageName}</p>
                                {selectedContract && (
                                    <p className='mt-0.5 text-[9px] capitalize text-white/55'>{selectedContract.replace('-', ' ')} duration</p>
                                )}
                            </div>
                        </aside>

                        <main ref={checkoutScrollRef} className='relative min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain bg-[#f7f8f5] [-webkit-overflow-scrolling:touch]'>
                            <div className='mx-auto flex min-h-[100dvh] w-full max-w-3xl flex-col px-4 pb-5 pt-5 sm:px-7 sm:pb-7 sm:pt-7 lg:px-10 lg:py-10 xl:px-14'>
                                <div className='flex items-start justify-between gap-4'>
                                    <div>
                                        <p className='flex items-center gap-1.5 text-[8px] font-semibold uppercase tracking-[0.14em] text-sage sm:text-[9px]'>
                                            <CreditCard className='size-3.5' /> Secure checkout
                                        </p>
                                        <h3 id='checkout-title' className='mt-1 font-display text-[24px] font-medium tracking-[-0.025em] text-ink sm:text-[30px]'>
                                            Your booking details
                                        </h3>
                                        <p className='mt-1 max-w-xl text-[9px] leading-[1.5] text-body sm:text-[10px]'>
                                            Complete the details below. Your information is used only to process and manage your booking.
                                        </p>
                                    </div>

                                    <button
                                        type='button'
                                        disabled={isSubmitting}
                                        onClick={() => setCheckoutOpen(false)}
                                        className='relative z-30 grid size-9 shrink-0 place-items-center rounded-none border-0 bg-transparent text-[#34443b] shadow-none transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sagedeep sm:rounded-full sm:border sm:border-[#dbe3dd] sm:bg-white sm:shadow-sm sm:hover:border-[#a7baac] sm:hover:bg-[#f8faf8] disabled:opacity-40'
                                        aria-label='Close checkout'
                                    >
                                        <X className='size-4' />
                                    </button>
                                </div>

                                <div className='mt-4 grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center rounded-2xl border border-sage/20 bg-[#edf4ee] p-3.5'>
                                    <div className='min-w-0'>
                                        <p className='text-[8px] font-semibold uppercase tracking-[0.11em] text-sage'>Monthly package selected</p>
                                        <p className='mt-1 truncate text-[11px] font-semibold text-ink sm:text-[12px]'>{selectedPackageName}</p>
                                    </div>
                                    <div className='rounded-xl border border-sage/15 bg-white/65 px-3 py-2 text-left sm:text-right'>
                                        <p className='text-[8px] font-medium text-body'>Appointment</p>
                                        <p className='mt-0.5 text-[9px] font-semibold text-sagedeep sm:text-[10px]'>
                                            {dateFormatter.format(selectedDate)} · {selectedTime}
                                        </p>
                                    </div>
                                </div>

                                <form className='mt-4 flex flex-1 flex-col' onSubmit={beginSecurePayment}>
                                    <div className='grid grid-cols-1 gap-2.5 sm:grid-cols-2'>
                                        <label>
                                            <span className='mb-1 block text-[8.5px] font-semibold text-ink sm:text-[9.5px]'>First name</span>
                                            <input className={fieldClassName} name='firstName' value={customer.firstName} onChange={updateCustomer} autoComplete='given-name' required />
                                        </label>
                                        <label>
                                            <span className='mb-1 block text-[8.5px] font-semibold text-ink sm:text-[9.5px]'>Surname</span>
                                            <input className={fieldClassName} name='surname' value={customer.surname} onChange={updateCustomer} autoComplete='family-name' required />
                                        </label>
                                        <label>
                                            <span className='mb-1 block text-[8.5px] font-semibold text-ink sm:text-[9.5px]'>Cell number</span>
                                            <input className={fieldClassName} type='tel' name='mobile' value={customer.mobile} onChange={updateCustomer} autoComplete='tel' required />
                                        </label>
                                        <label>
                                            <span className='mb-1 block text-[8.5px] font-semibold text-ink sm:text-[9.5px]'>Email address</span>
                                            <input className={fieldClassName} type='email' name='email' value={customer.email} onChange={updateCustomer} autoComplete='email' required />
                                        </label>
                                        <label>
                                            <span className='mb-1 block text-[8.5px] font-semibold text-ink sm:text-[9.5px]'>Confirm email address</span>
                                            <input
                                                className={`${fieldClassName} ${emailMismatch ? 'border-red-300 focus:border-red-400' : ''}`}
                                                type='email'
                                                name='confirmEmail'
                                                value={confirmEmail}
                                                onChange={(event) => setConfirmEmail(event.target.value)}
                                                onPaste={(event) => event.preventDefault()}
                                                autoComplete='off'
                                                required
                                            />
                                            {emailMismatch && (
                                                <span className='mt-1 block text-[8px] font-medium text-red-600 sm:text-[9px]'>Email addresses don't match.</span>
                                            )}
                                        </label>
                                        <label>
                                            <span className='mb-1 block text-[8.5px] font-semibold text-ink sm:text-[9.5px]'>Vehicle</span>
                                            <input className={fieldClassName} name='vehicle' value={customer.vehicle} onChange={updateCustomer} placeholder='Make, model and colour' required />
                                        </label>
                                        <label>
                                            <span className='mb-1 block text-[8.5px] font-semibold text-ink sm:text-[9.5px]'>Registration number</span>
                                            <input className={`${fieldClassName} uppercase`} name='registration' value={customer.registration} onChange={updateCustomer} placeholder='e.g. CA 123-456' autoCapitalize='characters' required />
                                        </label>
                                    </div>

                                    {!isMonthly && (
                                        <label className='mt-2.5 block'>
                                            <span className='mb-1 block text-[8.5px] font-semibold text-ink sm:text-[9.5px]'>Promo code <span className='font-normal text-body/55'>(optional)</span></span>
                                            <input
                                                className={`${fieldClassName} uppercase`}
                                                name='promoCode'
                                                value={promoCode}
                                                onChange={(event) => setPromoCode(event.target.value)}
                                                placeholder='Paste your unlocked code'
                                                autoCapitalize='characters'
                                                autoComplete='off'
                                            />
                                            <span className='mt-1 block text-[8px] leading-[1.45] text-body/65 sm:text-[9px]'>An active code takes 10% off this single wash. Each code can be redeemed once.</span>
                                        </label>
                                    )}

                                    <label className='mt-2.5 block'>
                                        <span className='mb-1 block text-[8.5px] font-semibold text-ink sm:text-[9.5px]'>Service address</span>
                                        <textarea className={`${fieldClassName} min-h-[54px] resize-none py-2 sm:min-h-[62px]`} name='address' value={customer.address} onChange={updateCustomer} placeholder='Street address and suburb' rows={2} required />
                                    </label>

                                    <label className='mt-2.5 block'>
                                        <span className='mb-1 flex justify-between text-[8.5px] font-semibold text-ink sm:text-[9.5px]'>
                                            <span>Booking message / request <span className='font-normal text-body/55'>(optional)</span></span>
                                            <span className='font-normal text-body/50'>{customer.notes.length}/300</span>
                                        </span>
                                        <textarea className={`${fieldClassName} min-h-[54px] resize-none py-2 sm:min-h-[62px]`} name='notes' value={customer.notes} onChange={updateCustomer} placeholder={`Outside ${SERVICE_RADIUS_KM} km? Add your travel request here.`} maxLength={300} rows={2} />
                                    </label>

                                    {isMonthly && (
                                        <div className='mt-3 rounded-2xl border border-[#cddbd0] bg-white p-3.5 sm:p-4'>
                                            <div className='flex items-start gap-3'>
                                                <div className='grid size-8 shrink-0 place-items-center rounded-xl bg-[#edf3ee] text-sage'>
                                                    <Package className='size-4' />
                                                </div>
                                                <div className='min-w-0'>
                                                    <p className='text-[8px] font-semibold uppercase tracking-[0.11em] text-sage sm:text-[9px]'>Required package document</p>
                                                    <p className='mt-1 text-[8.5px] leading-[1.5] text-body sm:text-[9.5px]'>
                                                        Attach the completed Supplier Client Contract Agreement before continuing.
                                                    </p>
                                                </div>
                                            </div>

                                            <div className='mt-3 rounded-xl border border-dashed border-[#c9d6cc] bg-[#f8faf8] p-3'>
                                                <input
                                                    type='file'
                                                    name='contract_files'
                                                    accept='.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                                                    onChange={(event) => {
                                                        const [selectedFile] = Array.from(event.target.files || []);
                                                        setContractFiles(selectedFile ? [selectedFile] : []);
                                                        setContractFileError('');
                                                        setPaymentError('');
                                                    }}
                                                    className='block w-full cursor-pointer text-[9px] text-body file:mr-2 file:cursor-pointer file:rounded-full file:border-0 file:bg-[#dfece2] file:px-3 file:py-1.5 file:text-[9px] file:font-semibold file:text-[#31553c]'
                                                />

                                                {contractFiles.length > 0 && (
                                                    <div className='mt-2 grid gap-1'>
                                                        {contractFiles.map((file) => (
                                                            <div key={`${file.name}-${file.lastModified}`} className='flex min-w-0 items-center gap-1.5 rounded-lg bg-white px-2 py-1.5 text-[8.5px] font-medium text-emerald-700'>
                                                                <CheckCircle2 className='size-3 shrink-0' />
                                                                <span className='min-w-0 flex-1 truncate'>{file.name}</span>
                                                                <button
                                                                    type='button'
                                                                    onClick={() => {
                                                                        setContractFiles((current) => current.filter((currentFile) => currentFile.name !== file.name));
                                                                        setContractFileError('');
                                                                        setPaymentError('');
                                                                    }}
                                                                    className='grid size-6 shrink-0 place-items-center rounded text-body transition hover:bg-red-50 hover:text-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-sagedeep'
                                                                    aria-label={`Remove ${file.name}`}
                                                                    title='Remove file'
                                                                >
                                                                    <X className='size-3.5' />
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

                                                {contractFileError && (
                                                    <p className='mt-2 rounded-lg bg-red-50 px-2.5 py-2 text-[8.5px] leading-[1.4] text-red-700' role='alert'>
                                                        {contractFileError}
                                                    </p>
                                                )}
                                            </div>

                                            <label className='mt-3 flex items-start gap-2 text-[8.5px] leading-[1.5] text-body sm:text-[9.5px]'>
                                                <input type='checkbox' checked={contractAccepted} onChange={(event) => setContractAccepted(event.target.checked)} className='mt-0.5 accent-[#365943]' required />
                                                <span>I confirm that I have reviewed the terms and completed and attached the Supplier Client Contract Agreement for my selected {selectedContract?.replace('-', ' ')} duration.</span>
                                            </label>
                                        </div>
                                    )}

                                    <div className='mt-2.5 grid gap-2'>
                                        <label className='flex items-start gap-2 rounded-xl border border-line bg-white/80 px-3 py-2.5'>
                                            <input type='checkbox' checked={serviceAreaAccepted} onChange={(event) => setServiceAreaAccepted(event.target.checked)} className='mt-0.5 accent-[#365943]' required />
                                            <span className='text-[8.5px] leading-[1.5] text-body sm:text-[9.5px]'>I understand the standard service radius is approximately {SERVICE_RADIUS_KM} km from {BUSINESS_ADDRESS}, and outside-area requests are subject to confirmation and possible travel charges.</span>
                                        </label>

                                        <label className='flex items-start gap-2 rounded-xl border border-line bg-white/80 px-3 py-2.5'>
                                            <input type='checkbox' checked={termsAccepted} onChange={(event) => setTermsAccepted(event.target.checked)} className='mt-0.5 accent-[#365943]' required />
                                            <span className='text-[8.5px] leading-[1.5] text-body sm:text-[9.5px]'>I agree to the <a href={`${import.meta.env.BASE_URL}terms.html`} target='_blank' rel='noreferrer' className='font-semibold text-sagedeep underline underline-offset-2'>Terms &amp; Conditions</a> and acknowledge the booking/cancellation rules.</span>
                                        </label>
                                    </div>

                                    <div className='mt-2.5 flex items-start gap-2 rounded-xl bg-sagelight/65 px-3 py-2.5'>
                                        <ShieldCheck className='mt-0.5 size-3.5 shrink-0 text-sage' />
                                        <p className='text-[8px] leading-[1.45] text-body sm:text-[9px]'>Yoco handles card details securely. A10tion To Detail stores only the booking/order details needed to provide the service and reconcile payment.</p>
                                    </div>

                                    <div className='sticky bottom-0 z-20 -mx-4 mt-3 shrink-0 border-t border-[#dfe6e0] bg-[#f7f8f5]/95 px-4 pb-[max(4px,env(safe-area-inset-bottom))] pt-3 backdrop-blur-md sm:-mx-7 sm:px-7 lg:-mx-10 lg:px-10 xl:-mx-14 xl:px-14'>
                                        {paymentError && (
                                            <p className='mb-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-[8.5px] leading-[1.45] text-red-700 sm:text-[9.5px]' role='alert'>
                                                {paymentError}
                                            </p>
                                        )}

                                        <button
                                            type='submit'
                                            disabled={isSubmitting}
                                            className='group flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl bg-ink px-4 text-[10px] font-semibold text-white shadow-[0_10px_25px_-15px_rgba(20,26,22,.8)] transition hover:-translate-y-px hover:bg-[#18231d] disabled:cursor-wait disabled:opacity-60 sm:min-h-[49px] sm:text-[11px]'
                                        >
                                            {isSubmitting
                                                ? <><LoaderCircle className='size-3.5 animate-spin' /> Preparing secure payment…</>
                                                : <>Continue to secure payment <ArrowRight className='size-3.5 transition-transform group-hover:translate-x-1' /></>}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </main>
                    </div>
                </div>
            )}

            <VehiclePromoModal
                open={promoRegistrationOpen}
                onClose={() => setPromoRegistrationOpen(false)}
                defaults={{ ...customer }}
            />

        </section>
    );
}