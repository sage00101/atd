import { useEffect, useRef, useState } from 'react';
import {
    ArrowRight,
    CarFront,
    Check,
    ChevronDown,
    FileText,
    X,
} from 'lucide-react';
import useReveal from '../hooks/use-reveal';
import ServicesOfferedModal from '../components/services-offered-modal';
import { packageGroups, singleWashPrices } from '../data/pricing';

const publicAssetUrl = (filename) => `${import.meta.env.BASE_URL}assets/${encodeURIComponent(filename)}`;

const CONTRACT_DOWNLOAD_KEY = 'a10tion-client-contract-downloaded';
const MONTHLY_PACKAGE_DOCUMENTS = [
    { name: 'Supplier_Client Contract Agreement.docx', href: publicAssetUrl('Supplier_Client Contract Agreement.docx') },
    { name: 'ATD Terms and Conditions.pdf', href: publicAssetUrl('ATD Terms and Conditions.pdf') },
];

function downloadContractDocuments(documents) {
    documents.forEach((document, index) => {
        window.setTimeout(() => {
            const link = window.document.createElement('a');
            link.href = document.href;
            link.download = document.name;
            link.rel = 'noopener';
            window.document.body.appendChild(link);
            link.click();
            link.remove();
        }, index * 180);
    });
}

function readContractDownloadState() {
    try {
        return sessionStorage.getItem(CONTRACT_DOWNLOAD_KEY) === 'true';
    } catch {
        return false;
    }
}

function readContractDuration() {
    try {
        const storedContract = sessionStorage.getItem('a10tion-selected-contract') || '';
        const months = storedContract.match(/^(\d+)-months$/)?.[1];
        return months || '';
    } catch {
        return '';
    }
}

function rememberContractDownload() {
    try {
        sessionStorage.setItem(CONTRACT_DOWNLOAD_KEY, 'true');
    } catch {
        // The current modal state still works if storage is unavailable.
    }
}

const SINGLE_WASH_VEHICLE_KEY = 'a10tion-single-wash-vehicle-type';

function readSingleWashVehicle() {
    try {
        return sessionStorage.getItem(SINGLE_WASH_VEHICLE_KEY) || '';
    } catch {
        return '';
    }
}

function saveSingleWashVehicle(vehicleType) {
    try {
        sessionStorage.setItem(SINGLE_WASH_VEHICLE_KEY, vehicleType);
    } catch {
        // Booking still works if storage is unavailable.
    }
}

function SingleWashPricingModal({ open, onClose, onContinue }) {
    useEffect(() => {
        if (!open) return undefined;

        const previousOverflow = document.body.style.overflow;
        const closeOnEscape = (event) => {
            if (event.key === 'Escape') onClose();
        };

        document.body.style.overflow = 'hidden';
        document.addEventListener('keydown', closeOnEscape);

        return () => {
            document.body.style.overflow = previousOverflow;
            document.removeEventListener('keydown', closeOnEscape);
        };
    }, [open, onClose]);

    const [selectedVehicle, setSelectedVehicle] = useState(readSingleWashVehicle);

    useEffect(() => {
        if (open) setSelectedVehicle(readSingleWashVehicle());
    }, [open]);

    if (!open) return null;

    return (
        <div className='fixed inset-0 z-[120] grid h-[100dvh] w-full place-items-center overflow-y-auto bg-[#0c1710]/70 p-3 backdrop-blur-[4px] sm:p-5' role='dialog' aria-modal='true' aria-labelledby='single-wash-pricing-title'>
            <button type='button' className='absolute inset-0 cursor-default' onClick={onClose} aria-label='Close single wash pricing' />
            <div className='relative z-10 flex max-h-[calc(100dvh-24px)] w-full max-w-3xl flex-col overflow-hidden rounded-[20px] bg-[#f7f9f6] shadow-[0_28px_90px_-30px_rgba(4,14,8,.72)] sm:max-h-[calc(100dvh-40px)] sm:rounded-[24px]'>
                <div className='relative shrink-0 bg-gradient-to-br from-[#17261d] via-[#203529] to-[#2f4d39] px-4 py-5 text-white sm:px-7 sm:py-6'>
                    <button type='button' onClick={onClose} className='absolute right-3 top-3 grid size-4 place-items-center rounded-full border border-white/25 bg-black/15 transition hover:bg-white/15 sm:right-5 sm:top-5 sm:size-5' aria-label='Close single wash pricing'>
                        <X className='size-2.5 sm:size-3' />
                    </button>
                    <p className='text-[8px] font-semibold uppercase tracking-[0.15em] text-[#bdd3c2]'>Once-off service</p>
                    <h2 id='single-wash-pricing-title' className='mt-1 font-display text-[24px] font-medium leading-tight sm:text-[32px]'>Single Wash pricing</h2>
                    <p className='mt-1.5 max-w-xl text-[9.5px] leading-[1.55] text-white/65 sm:text-[11px]'>Choose the vehicle size that matches your once-off wash.</p>
                </div>

                <div className='min-h-0 overflow-y-auto overscroll-contain p-3.5 text-left [&::-webkit-scrollbar]:hidden sm:p-6' style={{ scrollbarWidth: 'none' }}>
                    <section className='mx-auto max-w-xl rounded-[14px] border border-[#dfe8e1] bg-white p-3.5 sm:p-5'>
                        <h3 className='font-display text-[17px] font-semibold text-ink sm:text-[21px]'>Single washes</h3>
                        <p className='mb-3 mt-1 text-[9px] leading-[1.4] text-body sm:text-[10px]'>Once-off pricing with no contract.</p>
                        <div className='space-y-1.5'>
                            {singleWashPrices.map(([vehicle, price]) => {
                                const selected = selectedVehicle === vehicle;
                                return (
                                    <button key={vehicle} type='button' onClick={() => setSelectedVehicle(vehicle)} className={`grid min-h-[42px] w-full grid-cols-[auto_1fr_auto] items-center gap-2 rounded-[9px] border px-2.5 text-left text-[9px] transition sm:text-[10px] ${selected ? 'border-[#294633] bg-[#eaf2eb] text-ink' : 'border-[#e6eee7] bg-white text-body hover:border-[#9ab6a0]'}`} aria-pressed={selected}>
                                        <span className={`grid size-4 place-items-center rounded-full border ${selected ? 'border-[#294633] bg-[#294633]' : 'border-[#b9cdbd]'}`}><span className={selected ? 'size-1.5 rounded-full bg-white' : ''} /></span>
                                        <span>{vehicle}</span>
                                        <span className='font-semibold text-ink'>{price}</span>
                                    </button>
                                );
                            })}
                        </div>
                        <p className='mt-3 text-[8.5px] leading-[1.5] text-body sm:text-[9.5px]'>Payment is 100% in advance before the first wash. We come to your home or office. Terms &amp; Conditions apply.</p>
                    </section>
                </div>

                <div className='shrink-0 border-t border-[#e1e8e2] bg-white px-3.5 py-3 text-right sm:px-6 sm:py-4'>
                    <div className='flex justify-end gap-2'>
                        <button type='button' onClick={onClose} className='min-h-[38px] rounded-[10px] border border-line bg-white px-4 text-[10px] font-semibold text-body sm:min-h-[41px] sm:text-[11px]'>Close</button>
                        <button type='button' disabled={!selectedVehicle} onClick={() => { saveSingleWashVehicle(selectedVehicle); onContinue(selectedVehicle); }} className='min-h-[38px] rounded-[10px] bg-[#18241d] px-4 text-[10px] font-semibold text-white transition hover:bg-[#24362a] disabled:cursor-not-allowed disabled:opacity-40 sm:min-h-[41px] sm:text-[11px]'>Continue to booking</button>
                    </div>
                </div>
            </div>
        </div>
    );
}

function PackageDetailsModal({ pkg, open, onClose }) {
    useEffect(() => {
        if (!open) return undefined;

        const previousOverflow = document.body.style.overflow;
        const closeOnEscape = (event) => {
            if (event.key === 'Escape') onClose();
        };

        document.body.style.overflow = 'hidden';
        document.addEventListener('keydown', closeOnEscape);

        return () => {
            document.body.style.overflow = previousOverflow;
            document.removeEventListener('keydown', closeOnEscape);
        };
    }, [open, onClose]);

    if (!open || !pkg) return null;

    const hasPackagePricing = Array.isArray(pkg.monthlyPrices);

    return (
        <div className='fixed inset-0 z-[120] grid h-[100dvh] w-full place-items-center overflow-y-auto bg-[#0c1710]/70 p-3 backdrop-blur-[4px] sm:p-5' role='dialog' aria-modal='true' aria-labelledby='package-details-title'>
            <button type='button' className='absolute inset-0 cursor-default' onClick={onClose} aria-label='Close package details' />
            <div className='relative z-10 flex max-h-[calc(100dvh-24px)] w-full max-w-[560px] flex-col overflow-hidden rounded-[20px] bg-[#f7f9f6] shadow-[0_28px_90px_-30px_rgba(4,14,8,.72)] sm:max-h-[calc(100dvh-40px)] sm:rounded-[24px]'>
                <div className='relative h-[105px] shrink-0 overflow-hidden bg-[#17261d] sm:h-[145px]'>
                    <img src={pkg.image} alt='' className='h-full w-full object-cover opacity-70' loading='lazy' decoding='async' />
                    <div className='absolute inset-0 bg-gradient-to-t from-[#17261d] via-[#17261d]/45 to-transparent' />
                    <button type='button' onClick={onClose} className='absolute right-3 top-3 grid size-5 place-items-center rounded-full border border-white/25 bg-black/20 text-white transition hover:bg-white/15 sm:right-5 sm:top-5' aria-label='Close package details'>
                        <X className='size-3' />
                    </button>
                    <div className='absolute bottom-3 left-4 text-white sm:bottom-4 sm:left-6'>
                        <p className='text-[8px] font-semibold uppercase tracking-[0.15em] text-[#bdd3c2]'>{pkg.id.startsWith('business-') ? 'Business / Fleet / Family' : 'Private Client'}</p>
                        <h2 id='package-details-title' className='mt-0.5 font-display text-[23px] font-medium leading-tight sm:text-[30px]'>{pkg.title}</h2>
                    </div>
                </div>

                <div className='min-h-0 overflow-y-auto overscroll-contain p-3.5 text-left [&::-webkit-scrollbar]:hidden sm:p-5' style={{ scrollbarWidth: 'none' }}>
                    <div className='flex flex-wrap items-center justify-between gap-2'>
                        <div>
                            <p className='text-[9px] font-semibold uppercase tracking-[0.12em] text-sage sm:text-[10px]'>{pkg.washes}</p>
                            <p className='mt-0.5 text-[9px] text-body sm:text-[10px]'>Choose your own contract duration.</p>
                        </div>
                        <span className='rounded-full bg-[#fbe9e9] px-2.5 py-1 text-[8px] font-bold text-[#c32828] sm:text-[9px]'>{pkg.monthlyNote}</span>
                    </div>

                    {hasPackagePricing ? (
                        <div className='mt-3 overflow-hidden rounded-[11px] border border-[#dce8de] bg-white'>
                            <div className='grid grid-cols-[1fr_auto] border-b border-[#dce8de] bg-[#f3f8f4] px-2.5 py-2 text-[7.5px] font-bold uppercase tracking-[0.08em] text-sage sm:text-[8px]'>
                                <span>Car type</span>
                                <span>Per month</span>
                            </div>
                            {pkg.monthlyPrices.map(([vehicle, price]) => (
                                <div key={vehicle} className='grid grid-cols-[1fr_auto] gap-2 border-b border-[#e6eee7] px-2.5 py-1.5 text-[9px] last:border-b-0 sm:text-[10px]'>
                                    <span className='text-body'>{vehicle}</span>
                                    <span className='font-semibold text-ink'>{price}</span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className='mt-3 rounded-[10px] bg-sagelight/70 px-3 py-2 text-[9px] leading-[1.45] text-body sm:text-[10px]'>Pricing for Business / Fleet / Family packages is confirmed according to the selected vehicle and service requirements.</p>
                    )}

                    {hasPackagePricing && Array.isArray(pkg.threeMonthPrices) && (
                        <div className='mt-3 rounded-[11px] border border-[#dce8de] bg-white p-3'>
                            <p className='text-[8px] font-semibold uppercase tracking-[0.1em] text-sage sm:text-[9px]'>3-month contract totals</p>
                            <div className='mt-2 space-y-1.5'>
                                {pkg.monthlyPrices.map(([vehicle], index) => (
                                    <div key={vehicle} className='flex items-center justify-between gap-3 text-[9px] sm:text-[10px]'>
                                        <span className='text-body'>{vehicle}</span>
                                        <span className='font-semibold text-ink'>{pkg.threeMonthPrices[index]}</span>
                                    </div>
                                ))}
                            </div>
                            <p className='mt-2 text-[8px] leading-[1.45] text-body'>6- and 12-month contract totals are not specified in the current rate sheet and will be confirmed before payment.</p>
                        </div>
                    )}

                    <div className='mt-3 rounded-[11px] border border-[#dce8de] bg-white p-3'>
                        <p className='text-[8px] font-semibold uppercase tracking-[0.1em] text-sage sm:text-[9px]'>Included with this package</p>
                        <ul className='mt-2 grid gap-1.5 sm:grid-cols-2'>
                            {pkg.details.map((detail) => (
                                <li key={detail} className='flex items-start gap-1.5 text-[9px] leading-[1.45] text-body sm:text-[10px]'>
                                    <Check className='mt-0.5 size-3 shrink-0 text-sage' />
                                    {detail}
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div className='mt-3 rounded-[10px] bg-sagelight/70 px-2.5 py-2'>
                        <p className='text-[7.5px] uppercase tracking-[0.08em] text-body sm:text-[8px]'>{hasPackagePricing ? 'Payment' : 'Package note'}</p>
                        <p className='mt-0.5 text-[9px] font-semibold text-sagedeep sm:text-[10px]'>{hasPackagePricing ? '100% in advance' : 'Contact us for package pricing'}</p>
                    </div>
                    {pkg.packageNote && <p className='mt-2 text-[8.5px] leading-[1.45] text-body sm:text-[9.5px]'>{pkg.packageNote}</p>}
                </div>

                <div className='shrink-0 border-t border-[#e1e8e2] bg-white px-3.5 py-3 text-right sm:px-5 sm:py-4'>
                    <button type='button' onClick={onClose} className='min-h-[38px] rounded-[10px] bg-[#18241d] px-5 text-[10px] font-semibold text-white transition hover:bg-[#24362a] sm:min-h-[41px] sm:text-[11px]'>Close</button>
                </div>
            </div>
        </div>
    );
}

function saveSelection({ purchaseType, packageId, contract }) {
    try {
        sessionStorage.setItem('a10tion-purchase-type', purchaseType);
        sessionStorage.setItem('a10tion-selected-package', packageId);
        if (contract) sessionStorage.setItem('a10tion-selected-contract', contract);
        else sessionStorage.removeItem('a10tion-selected-contract');
        window.dispatchEvent(new Event('a10tion-package-selected'));
    } catch {
        // Booking still works if storage is unavailable.
    }
}

function scrollToBooking() {
    window.requestAnimationFrame(() => {
        const booking = document.getElementById('booking');
        if (booking) booking.scrollIntoView({ behavior: 'smooth', block: 'start' });
        else window.location.hash = 'booking';
    });
}

function MonthlyPackageCard({ pkg, onDetails, onChoose }) {
    const ref = useReveal();

    return (
        <article ref={ref} className='reveal overflow-hidden rounded-[18px] border border-line bg-white shadow-[0_18px_50px_-38px_rgba(20,26,22,.3)] sm:rounded-[22px]'>
            <div className='relative h-[132px] overflow-hidden sm:h-[165px] lg:h-[178px]'>
                <img src={pkg.image} alt={pkg.imageAlt} className='h-full w-full object-cover' loading='lazy' decoding='async' sizes='(max-width: 640px) 100vw, 50vw' />
                <div className='absolute inset-0 bg-gradient-to-t from-[#0d1711]/55 via-transparent to-transparent' />
                <span className='absolute left-2.5 top-2.5 rounded-full border border-white/20 bg-[#132018]/80 px-2.5 py-1 text-[7.5px] font-semibold uppercase tracking-[0.1em] text-white backdrop-blur sm:text-[8.5px]'>
                    {pkg.title}
                </span>
                <span className='absolute bottom-2.5 right-2.5 rounded-full bg-[#9abd9f]/95 px-2.5 py-1 text-[7.5px] font-bold uppercase tracking-[0.07em] text-[#142018] sm:text-[8.5px]'>
                    {pkg.badge}
                </span>
            </div>

            <div className='p-3.5 sm:p-4'>
                <p className='text-[8px] font-semibold uppercase tracking-[0.14em] text-sage sm:text-[9px]'>Monthly Wash Package</p>
                <h3 className='mt-1 font-display text-[20px] font-medium leading-tight text-ink sm:text-[23px]'>{pkg.washes}</h3>
                <p className='mt-1.5 text-[9.5px] leading-[1.5] text-body sm:text-[10.5px]'>Choose your own contract duration.</p>

                <button
                    type='button'
                    onClick={() => onDetails(pkg)}
                    className='mt-2.5 flex min-h-[34px] w-full items-center justify-between rounded-[10px] border border-line bg-canvasoft px-3 text-[9px] font-semibold text-body transition hover:border-sage/35 hover:text-ink sm:min-h-[37px] sm:text-[10px]'
                    aria-haspopup='dialog'
                >
                    Package details
                    <ChevronDown className='size-3.5' />
                </button>

                <button
                    type='button'
                    onClick={(event) => onChoose(pkg, event.currentTarget)}
                    className='group mt-2.5 flex min-h-[38px] w-full items-center justify-center gap-2 rounded-[11px] bg-[#18241d] px-4 text-[10px] font-semibold text-white transition hover:-translate-y-px hover:bg-[#203027] sm:min-h-[41px] sm:text-[11px]'
                >
                    Select &amp; Schedule
                    <ArrowRight className='size-3.5 transition-transform group-hover:translate-x-1' />
                </button>
            </div>
        </article>
    );
}

export default function PricingSection() {
    const ref = useReveal();
    const lastButtonRef = useRef(null);
    const [mode, setMode] = useState('single');
    const [activeGroup, setActiveGroup] = useState('private');
    const [packageDetailsOpen, setPackageDetailsOpen] = useState(null);
    const [pendingPackage, setPendingPackage] = useState(null);
    const [contractMonths, setContractMonths] = useState(null);
    const [contractPrompted, setContractPrompted] = useState(false);
    const [contractDownloaded, setContractDownloaded] = useState(false);
    const [servicesOpen, setServicesOpen] = useState(false);
    const [singleWashPricingOpen, setSingleWashPricingOpen] = useState(false);
    const [selectedPackageVehicle, setSelectedPackageVehicle] = useState(readSingleWashVehicle);

    useEffect(() => {
        const syncTarget = () => {
            try {
                const requestedMode = sessionStorage.getItem('a10tion-pricing-mode');
                const requestedGroup = sessionStorage.getItem('a10tion-package-group');
                if (requestedMode === 'monthly') setMode('monthly');
                else if (requestedMode === 'single') setMode('single');
                if (requestedGroup && packageGroups[requestedGroup]) setActiveGroup(requestedGroup);
            } catch {
                // Safe fallback.
            }
        };

        syncTarget();
        window.addEventListener('a10tion-pricing-target', syncTarget);
        return () => window.removeEventListener('a10tion-pricing-target', syncTarget);
    }, []);

    const chooseSingleWash = () => {
        setSingleWashPricingOpen(true);
    };

    const continueSingleWash = () => {
        saveSelection({ purchaseType: 'single', packageId: 'single-wash', contract: null });
        setSingleWashPricingOpen(false);
        scrollToBooking();
    };

    const openContractModal = (pkg, button) => {
        lastButtonRef.current = button;
        setPendingPackage(pkg);
        setContractMonths(readContractDuration());
        setContractPrompted(false);
        setContractDownloaded(readContractDownloadState());
        setSelectedPackageVehicle(readSingleWashVehicle());
    };

    const closeContractModal = () => {
        setPendingPackage(null);
        setContractMonths(null);
        setContractPrompted(false);
        requestAnimationFrame(() => lastButtonRef.current?.focus({ preventScroll: true }));
    };

    const continueToBooking = () => {
        if (!pendingPackage || !contractMonths || !contractDownloaded || !selectedPackageVehicle) {
            setContractPrompted(true);
            return;
        }

        saveSingleWashVehicle(selectedPackageVehicle);
        saveSelection({
            purchaseType: 'monthly',
            packageId: pendingPackage.id,
            contract: `${contractMonths}-months`,
        });
        closeContractModal();
        scrollToBooking();
    };

    useEffect(() => {
        if (!pendingPackage) return undefined;
        const previous = document.body.style.overflow;
        const escape = (event) => event.key === 'Escape' && closeContractModal();
        document.body.style.overflow = 'hidden';
        document.addEventListener('keydown', escape);
        return () => {
            document.body.style.overflow = previous;
            document.removeEventListener('keydown', escape);
        };
    }, [pendingPackage]);

    const activeData = packageGroups[activeGroup];

    return (
        <section id='pricing' className='px-3 pt-10 sm:px-4 sm:pt-12 md:px-8 lg:px-10 lg:pt-14'>
            <div ref={ref} className='reveal mx-auto max-w-7xl'>
                <div className='text-center'>
                    <p className='inline-flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.17em] text-sage sm:text-[10px]'>
                        <span className='h-px w-5 bg-sage' /> Choose your wash <span className='h-px w-5 bg-sage' />
                    </p>
                    <h2 className='mt-1.5 font-display text-[25px] font-medium tracking-[-0.025em] text-ink sm:text-[33px]'>Once-off or monthly. Your call.</h2>
                    <p className='mx-auto mt-1.5 max-w-lg text-[10px] leading-[1.5] text-body sm:text-[11.5px]'></p>
                </div>

                <div className='mx-auto mt-4 grid max-w-[720px] grid-cols-1 items-center gap-1.5 sm:mt-5 sm:grid-cols-[minmax(0,1fr)_auto]'>
                    <div className='grid min-w-0 grid-cols-2 gap-1.5 rounded-[14px] border border-line bg-canvasoft p-1.5'>
                        {[
                            ['single', 'Single Wash', CarFront],
                            ['monthly', 'Monthly Packages', FileText],
                        ].map(([value, label, Icon]) => {
                            const active = mode === value;
                            return (
                                <button
                                    key={value}
                                    type='button'
                                    onClick={() => setMode(value)}
                                    className={`flex min-h-[39px] items-center justify-center gap-1.5 rounded-[10px] px-2 text-[9.5px] font-semibold transition sm:min-h-[43px] sm:text-[10.5px] ${active ? 'bg-[#1a2a20] text-white shadow-sm' : 'text-body hover:bg-white hover:text-ink'}`}
                                >
                                    <Icon className={`size-3.5 ${active ? 'text-[#9abd9f]' : 'text-sage'}`} />
                                    {label}
                                </button>
                            );
                        })}
                    </div>

                    <button type='button' onClick={() => setServicesOpen(true)} className='flex min-h-[39px] min-w-0 items-center justify-center gap-1 rounded-[12px] border border-[#cbdace] bg-white px-2 text-[9.5px] font-semibold text-[#31553c] transition hover:border-[#91ae98] hover:bg-[#edf4ee] sm:min-h-[43px] sm:min-w-[125px] sm:px-2.5 sm:text-[10.5px]' aria-haspopup='dialog'>
                        Services offered
                        <ChevronDown className='size-3.5' />
                    </button>

                </div>

                {mode === 'single' ? (
                    <div className='mx-auto mt-4 max-w-3xl overflow-hidden rounded-[19px] border border-line bg-gradient-to-br from-white via-white to-[#edf4ef] shadow-[0_20px_55px_-42px_rgba(20,49,30,.4)] sm:mt-5'>
                        <div className='grid gap-0 sm:grid-cols-[0.72fr_1.28fr] sm:items-stretch'>
                            <div className='relative flex min-h-[130px] items-center justify-center overflow-hidden bg-gradient-to-br from-[#17271d] via-[#21382a] to-[#34563f] p-4 text-white sm:min-h-[190px]'>
                                <span className='absolute -right-12 -top-14 size-36 rounded-full bg-[#9fc4a7]/20 blur-2xl' />
                                <div className='relative text-center'>
                                    <div className='mx-auto grid size-10 place-items-center rounded-full border border-white/15 bg-white/10 sm:size-12'>
                                        <CarFront className='size-5 text-[#b9d2bf] sm:size-6' />
                                    </div>
                                    <p className='mt-0.5 font-display text-[19px] font-medium sm:text-[23px]'>Single Wash</p>
                                </div>
                            </div>

                            <div className='p-3.5 sm:p-5'>
                                <h3 className='font-display text-[21px] font-medium text-ink sm:text-[26px]'>Book one wash when you need it.</h3>
                                <p className='mt-1.5 text-[9.5px] leading-[1.55] text-body sm:text-[11px]'>Select an option and continue to book.</p>
                                <button onClick={chooseSingleWash} type='button' className='group mt-3 flex min-h-[39px] w-full items-center justify-center gap-2 rounded-[11px] bg-[#18241d] px-3 text-[9px] font-semibold text-white transition hover:-translate-y-px hover:bg-[#203027] sm:min-h-[43px] sm:px-4 sm:text-[11px]'>
                                        Book a Single Wash
                                        <ArrowRight className='size-3.5 transition-transform group-hover:translate-x-1' />
                                    </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className='mx-auto mt-4 grid max-w-[540px] grid-cols-2 gap-1.5 rounded-[14px] border border-line bg-canvasoft p-1.5'>
                            {Object.entries(packageGroups).map(([key, group]) => {
                                const Icon = group.icon;
                                const active = activeGroup === key;
                                return (
                                    <button key={key} type='button' onClick={() => { setActiveGroup(key); setPackageDetailsOpen(null); }} className={`flex min-h-[37px] items-center justify-center gap-1.5 rounded-[9px] px-1.5 text-[8.5px] font-semibold transition sm:min-h-[41px] sm:text-[10px] ${active ? 'bg-white text-ink shadow-sm' : 'text-body hover:text-ink'}`}>
                                        <Icon className='hidden size-3.5 text-sage min-[390px]:block' />
                                        <span className='sm:hidden'>{group.shortLabel}</span>
                                        <span className='hidden sm:inline'>{group.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                        <p className='mx-auto mt-2 max-w-[540px] text-center text-[10px] font-medium text-body sm:text-[11.5px]'>Contract options: 3, 6, or 12 months.</p>

                        <div className='mt-3 grid items-start gap-3 sm:grid-cols-2 sm:gap-4'>
                            {activeData.packages.map((pkg) => (
                                <MonthlyPackageCard
                                    key={pkg.id}
                                    pkg={pkg}
                                    onDetails={setPackageDetailsOpen}
                                    onChoose={openContractModal}
                                />
                            ))}
                        </div>

                    </>
                )}
            </div>

            {pendingPackage && (
                <div className='fixed inset-0 z-[110] grid place-items-center overflow-y-auto bg-[#0c1710]/65 p-3 backdrop-blur-[4px]' role='dialog' aria-modal='true' aria-labelledby='contract-title'>
                    <button type='button' className='absolute inset-0 cursor-default' onClick={closeContractModal} aria-label='Close contract selection' />
                    <div className='relative z-10 w-full max-w-[590px] overflow-hidden rounded-[20px] bg-white shadow-[0_28px_90px_-30px_rgba(4,14,8,.72)]'>
                        <div className='relative bg-gradient-to-br from-[#17261d] via-[#203529] to-[#2f4d39] px-4 py-4 text-white sm:px-6 sm:py-5'>
                            <button type='button' onClick={closeContractModal} className='absolute right-3 top-3 grid size-8 place-items-center rounded-full border border-white/30 bg-black/15 sm:right-4 sm:top-4' aria-label='Close'>
                                <X className='size-4' />
                            </button>
                            <p className='flex items-center gap-1.5 text-[8px] font-semibold uppercase tracking-[0.15em] text-[#bdd3c2]'><FileText className='size-3' /> Monthly contract</p>
                            <h3 id='contract-title' className='mt-1 font-display text-[23px] font-medium sm:text-[28px]'>Choose your contract term</h3>
                            <p className='mt-1 text-[9.5px] text-white/65 sm:text-[10.5px]'>{activeData.label} · {pendingPackage.title} · {pendingPackage.washes}</p>
                        </div>

                        <div className='p-3.5 sm:p-5'>
                            <p className='text-[9.5px] leading-[1.5] text-body sm:text-[10.5px]'>Choose how many months you want your washes for. Review, complete and attach all required documents when making your purchase.</p>

                            {Array.isArray(pendingPackage.monthlyPrices) && (
                                <div className={`mt-3 rounded-[12px] border border-line bg-[#fafcfb] p-3 ${contractPrompted && !selectedPackageVehicle ? 'ring-2 ring-sage/30 ring-offset-2' : ''}`}>
                                    <p className='text-[8.5px] font-semibold text-ink sm:text-[9.5px]'>Vehicle type</p>
                                    <div className='mt-1.5 space-y-1.5'>
                                        {pendingPackage.monthlyPrices.map(([vehicle, price]) => {
                                            const selected = selectedPackageVehicle === vehicle;
                                            return (
                                                <button key={vehicle} type='button' onClick={() => setSelectedPackageVehicle(vehicle)} className={`grid min-h-[40px] w-full grid-cols-[auto_1fr_auto] items-center gap-2 rounded-[9px] border px-2.5 text-left text-[9px] transition sm:text-[10px] ${selected ? 'border-[#294633] bg-[#eaf2eb] text-ink' : 'border-[#e6eee7] bg-white text-body hover:border-[#9ab6a0]'}`} aria-pressed={selected}>
                                                    <span className={`grid size-4 place-items-center rounded-full border ${selected ? 'border-[#294633] bg-[#294633]' : 'border-[#b9cdbd]'}`}><span className={selected ? 'size-1.5 rounded-full bg-white' : ''} /></span>
                                                    <span>{vehicle}</span>
                                                    <span className='font-semibold text-ink'>{price}/mo</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            <div className={`mt-3 space-y-2 rounded-[12px] border border-line bg-[#fafcfb] p-3 ${contractPrompted ? 'ring-2 ring-sage/30 ring-offset-2' : ''}`}>
                                <div className='block text-[8.5px] font-semibold text-ink sm:text-[9.5px]'>
                                    Contract duration in months
                                    <div className='mt-1 grid grid-cols-3 gap-2'>
                                        {[3, 6, 12].map((months) => {
                                            const selected = String(contractMonths) === String(months);
                                            return (
                                                <button
                                                    key={months}
                                                    type='button'
                                                    onClick={() => { setContractMonths(String(months)); setContractPrompted(false); }}
                                                    aria-pressed={selected}
                                                    className={`min-h-[40px] rounded-[9px] border text-[11px] font-semibold transition sm:text-[12px] ${selected ? 'border-sage/60 bg-[#1d3426] text-white' : 'border-line bg-white text-ink hover:border-sage/45 hover:bg-sagelight'}`}
                                                >
                                                    {months}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                                {selectedPackageVehicle && contractMonths && Array.isArray(pendingPackage.monthlyPrices) && (() => {
                                    const vehicleIndex = pendingPackage.monthlyPrices.findIndex(([vehicle]) => vehicle === selectedPackageVehicle);
                                    const monthlyPrice = vehicleIndex >= 0 ? pendingPackage.monthlyPrices[vehicleIndex][1] : '';
                                    const threeMonthTotal = pendingPackage.threeMonthPrices?.[vehicleIndex];
                                    return (
                                        <div className='rounded-[9px] border border-[#dce8de] bg-white px-3 py-2 text-[9px] sm:text-[10px]'>
                                            <div className='flex justify-between gap-3'><span className='text-body'>Monthly rate</span><strong className='text-ink'>{monthlyPrice}</strong></div>
                                            {contractMonths === '3' && threeMonthTotal ? (
                                                <div className='mt-1 flex justify-between gap-3 border-t border-[#edf1ed] pt-1'><span className='text-body'>3-month contract total</span><strong className='text-ink'>{threeMonthTotal}</strong></div>
                                            ) : (
                                                <p className='mt-1 border-t border-[#edf1ed] pt-1 leading-[1.45] text-body'>Total for {contractMonths} months: to be confirmed. The rate sheet does not provide this contract total.</p>
                                            )}
                                        </div>
                                    );
                                })()}
                                <button type='button' onClick={() => { downloadContractDocuments(MONTHLY_PACKAGE_DOCUMENTS); rememberContractDownload(); setContractDownloaded(true); }} className='flex min-h-[38px] w-full items-center justify-center gap-2 rounded-[9px] bg-[#1a2a20] px-3 text-[9px] font-semibold text-white transition hover:bg-[#24362a] sm:text-[10px]'>
                                    <FileText className='size-3.5' />
                                    {contractDownloaded ? 'Download documents' : 'Download required documents'}
                                </button>
                                <ul className='space-y-1 rounded-[9px] border border-[#e1e9e2] bg-white px-2.5 py-2 text-[8px] leading-[1.4] text-body sm:text-[9px]'>
                                    {MONTHLY_PACKAGE_DOCUMENTS.map((document) => <li key={document.name}>{document.name}</li>)}
                                </ul>
                                <label className='flex items-start gap-2 text-[8.5px] leading-[1.45] text-body sm:text-[9.5px]'>
                                    <input type='checkbox' checked={contractDownloaded} readOnly disabled className='mt-0.5 accent-[#365943] disabled:opacity-100' />
                                    <span>I have downloaded these documents and will review, complete and attach all of them during checkout.</span>
                                </label>
                            </div>

                            <p className={`mt-2 min-h-[14px] text-center text-[8.5px] font-medium ${contractPrompted ? 'text-[#466b50]' : 'text-body/60'}`} role={contractPrompted ? 'alert' : undefined}>
                                {contractPrompted ? 'Choose a vehicle type, duration, download the contract and confirm before continuing.' : contractMonths ? `${contractMonths}-month contract selected.` : 'A contract is required for monthly packages.'}
                            </p>

                            <div className='mt-2 grid gap-2 sm:grid-cols-[auto_1fr]'>
                                <button type='button' onClick={closeContractModal} className='order-2 min-h-[40px] rounded-[10px] border border-line bg-white px-5 text-[9.5px] font-semibold text-body sm:order-1'>Cancel</button>
                                <button type='button' onClick={continueToBooking} className='group order-1 flex min-h-[41px] items-center justify-center gap-2 rounded-[10px] bg-[#18241d] px-5 text-[10px] font-semibold text-white sm:order-2 sm:text-[11px]'>
                                    Continue to booking <ArrowRight className='size-3.5 transition-transform group-hover:translate-x-1' />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <ServicesOfferedModal open={servicesOpen} onClose={() => setServicesOpen(false)} />
            <SingleWashPricingModal open={singleWashPricingOpen} onClose={() => setSingleWashPricingOpen(false)} onContinue={continueSingleWash} />
            <PackageDetailsModal open={Boolean(packageDetailsOpen)} pkg={packageDetailsOpen} onClose={() => setPackageDetailsOpen(null)} />

        </section>
    );
}
