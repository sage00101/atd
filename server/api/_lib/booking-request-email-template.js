const COLORS = {
    ink: '#161B18',
    body: '#5B6560',
    canvas: '#F6F7F3',
    line: '#E6E9E3',
    sage: '#2F4B3C',
    deep: '#1E3128',
    light: '#EAF0E9',
};

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
    })[char]);
}

function display(value) {
    if (value === null || value === undefined || value === '') return '';
    if (typeof value !== 'object') return String(value);
    return Object.entries(value)
        .filter(([, item]) => item !== null && item !== undefined && item !== '')
        .map(([key, item]) => `${key}: ${typeof item === 'object' ? JSON.stringify(item) : item}`)
        .join(' · ');
}

function tableRows(entries) {
    return entries.filter(([, value]) => display(value)).map(([label, value]) => `
        <tr>
            <td style="padding:8px 0;border-bottom:1px solid ${COLORS.line};color:${COLORS.body};font-size:13px;">${escapeHtml(label)}</td>
            <td style="padding:8px 0;border-bottom:1px solid ${COLORS.line};color:${COLORS.ink};font-size:13px;font-weight:600;text-align:right;">${escapeHtml(display(value))}</td>
        </tr>`).join('');
}

function bookingEntries(request) {
    const booking = request.booking || {};
    const customer = booking.customer || {};
    const requestStatus = request.publicStatus || ({
        pending_approval: 'PENDING APPROVAL',
        approved: 'Approved – Awaiting Completion',
        awaiting_completion: 'Approved – Awaiting Completion',
        confirmed: 'Confirmed',
        declined: 'Declined',
        expired: 'Expired',
        cancelled: 'Cancelled',
    })[request.status] || request.status;
    const latitude = booking.serviceLocation?.latitude ?? booking.serviceLocation?.lat;
    const longitude = booking.serviceLocation?.longitude ?? booking.serviceLocation?.lng;
    const locationLink = latitude != null && longitude != null
        ? `https://maps.google.com/?q=${encodeURIComponent(`${latitude},${longitude}`)}`
        : '';
    const fields = [
        ['Reference', request.reference],
        ['Submitted', request.submittedAt],
        ['Status', requestStatus],
        ['Customer type', request.kind],
        ['Customer name', `${customer.firstName || ''} ${customer.surname || ''}`.trim()],
        ['Contact number', customer.mobile],
        ['Email address', customer.email],
        ['Service / package', booking.packageName || booking.packageId],
        ['Vehicle category', booking.vehicleType],
        ['Fleet size tier', booking.fleetSizeTier],
        ['Fleet vehicle count', booking.fleetVehicleCount],
        ['Vehicle registration', customer.registration],
        ['Requested date', booking.bookingDate],
        ['Requested time', booking.bookingTime],
        ['Address', customer.address],
        ['Map location', locationLink || booking.serviceLocation],
        ['Customer notes', customer.notes],
        ['Monthly client type', booking.monthlyClientType],
        ['Monthly package', booking.monthlyPackageTier],
        ['Monthly entitlement code', booking.bookingType === 'monthly-entitlement' ? booking.promoCode : ''],
        ['Promo code', booking.bookingType === 'monthly-entitlement' ? '' : booking.promoCode],
        ['Payment method requested', booking.requestedPaymentMethod],
        ['Contract accepted', booking.contractAccepted ? 'Yes' : 'No'],
        ['Service area accepted', booking.serviceAreaAccepted ? 'Yes' : 'No'],
        ['Booking terms accepted', booking.termsAccepted ? 'Yes' : 'No'],
    ];
    const excluded = new Set([
        'customer', 'serviceLocation', 'contractFileBase64', 'approvalToken', 'requestedPaymentMethod',
        'bookingDate', 'bookingTime', 'packageName', 'packageId', 'vehicleType', 'monthlyClientType',
        'monthlyPackageTier', 'bookingType', 'purchaseType', 'promoCode', 'contractAccepted',
        'serviceAreaAccepted', 'termsAccepted', 'fleetSizeTier', 'fleetVehicleCount',
    ]);
    for (const [key, value] of Object.entries(booking)) {
        if (!excluded.has(key)) fields.push([key, value]);
    }
    return fields;
}

function renderEmail({ title, greeting, message, request, buttonLabel, buttonUrl, declineReason, footerNote }) {
    const rows = tableRows(bookingEntries(request));
    const cta = buttonLabel && buttonUrl
        ? `<p style="margin:24px 0;text-align:center;"><a href="${escapeHtml(buttonUrl)}" style="display:inline-block;background:${COLORS.deep};border-radius:9px;color:#fff;padding:13px 22px;text-decoration:none;font-size:14px;font-weight:700;">${escapeHtml(buttonLabel)}</a></p>`
        : '';
    return `<!doctype html>
<html>
<body style="margin:0;padding:0;background:${COLORS.canvas};font-family:Segoe UI,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.canvas};padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:16px;overflow:hidden;border:1px solid ${COLORS.line};">
        <tr><td style="background:${COLORS.deep};padding:26px 30px;">
          <p style="margin:0;color:#c4d8c9;font-size:11px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;">A10tion To Detail</p>
          <h1 style="margin:8px 0 0;color:#fff;font-size:22px;font-weight:650;">${escapeHtml(title)}</h1>
        </td></tr>
        <tr><td style="padding:26px 30px;">
          <p style="margin:0 0 14px;color:${COLORS.body};font-size:14px;line-height:1.65;">${escapeHtml(greeting)}</p>
          <p style="margin:0 0 20px;color:${COLORS.body};font-size:14px;line-height:1.65;">${escapeHtml(message)}</p>
          ${declineReason ? `<div style="margin:0 0 20px;padding:14px 16px;background:#FBF3DC;border:1px solid #F0DFA5;border-radius:10px;color:#5B4B14;font-size:13px;line-height:1.6;"><strong>Reason:</strong> ${escapeHtml(declineReason)}</div>` : ''}
          <div style="margin:0 0 20px;padding:14px 16px;background:${COLORS.light};border-radius:10px;text-align:center;">
            <p style="margin:0;color:${COLORS.sage};font-size:11px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;">Booking reference</p>
            <p style="margin:4px 0 0;color:${COLORS.ink};font-size:20px;font-weight:700;letter-spacing:.04em;">${escapeHtml(request.reference)}</p>
          </div>
          ${cta}
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
          ${footerNote ? `<p style="margin:20px 0 0;color:${COLORS.body};font-size:12px;line-height:1.6;">${escapeHtml(footerNote)}</p>` : ''}
        </td></tr>
        <tr><td style="padding:18px 30px;background:${COLORS.canvas};border-top:1px solid ${COLORS.line};">
          <p style="margin:0;color:${COLORS.body};font-size:11px;">A10tion To Detail · Thank you for choosing us.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export function buildBookingRequestReceivedEmail(request, statusUrl) {
    const name = request.booking.customer.firstName || 'there';
    return renderEmail({
        title: 'Booking request received',
        greeting: `Hi ${name}, thank you for submitting your booking request.`,
        message: 'We have received your request. Your booking is not yet confirmed and no payment or monthly wash credit has been processed. Our team will review it and email you with the outcome.',
        request,
        buttonLabel: 'Check My Request Status',
        buttonUrl: statusUrl,
        footerNote: 'You can revisit the private status link above to see the latest update. Please do not share it with anyone else.',
    });
}

export function buildBookingRequestBusinessEmail(request, managerUrl) {
    return renderEmail({
        title: 'PENDING APPROVAL · New booking request',
        greeting: 'A new website booking request is waiting for review.',
        message: `Submitted ${request.submittedAt}. This request has not been confirmed and no payment or monthly wash credit has been processed.`,
        request,
        buttonLabel: 'Open Business Manager',
        buttonUrl: managerUrl,
    });
}

export function buildBookingApprovedEmail(request, continueUrl) {
    const message = request.booking.bookingType === 'monthly-entitlement'
        ? 'Your booking request has been approved. Continue to verify your active monthly entitlement and complete the booking without being charged again for a covered wash.'
        : request.booking.requestedPaymentMethod === 'onsite'
            ? 'Your booking request has been approved. Continue to confirm your booking. You selected payment on site; no payment has been processed yet.'
            : 'Your booking request has been approved. Continue to complete your booking through the secure Yoco checkout.';
    return renderEmail({
        title: 'Your booking request is approved',
        greeting: `Hi ${request.booking.customer.firstName || 'there'}, thank you for your patience.`,
        message,
        request,
        buttonLabel: 'Continue With My Booking',
        buttonUrl: continueUrl,
        footerNote: 'The booking is not fully confirmed until payment or monthly entitlement completion has been processed.',
    });
}

export function buildBookingDeclinedEmail(request) {
    return renderEmail({
        title: 'Booking request update',
        greeting: `Hi ${request.booking.customer.firstName || 'there'},`,
        message: 'Thank you for your booking request. Unfortunately, we could not accommodate it.',
        request,
        declineReason: request.declineReason,
        footerNote: 'If you would like to discuss another date or time, please reply to this email.',
    });
}

export function buildBookingCancelledEmail(request, reason) {
    return renderEmail({
        title: 'Your booking has been cancelled',
        greeting: `Hi ${request.booking.customer.firstName || 'there'},`,
        message: 'We are sorry, but we have had to cancel your booked appointment. The time slot below has been released.',
        request,
        declineReason: reason,
        footerNote: 'If you paid online or would like to rebook for another date or time, please reply to this email and we will gladly help.',
    });
}
