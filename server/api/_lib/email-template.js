const BRAND = {
    ink: '#161B18',
    body: '#5B6560',
    canvasoft: '#F6F7F3',
    line: '#E6E9E3',
    sage: '#2F4B3C',
    sagedeep: '#1E3128',
    sagelight: '#EAF0E9',
};

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[char]);
}

function row(label, value) {
    if (!value) return '';
    return `
        <tr>
            <td style="padding:8px 0;border-bottom:1px solid ${BRAND.line};color:${BRAND.body};font-size:13px;">${escapeHtml(label)}</td>
            <td style="padding:8px 0;border-bottom:1px solid ${BRAND.line};color:${BRAND.ink};font-size:13px;font-weight:600;text-align:right;">${escapeHtml(value)}</td>
        </tr>`;
}

/** Branded booking-confirmation / receipt email shared by customer + business copies. */
export function buildReceiptEmailHtml(receipt) {
    const isOnsiteUnpaid = receipt.paymentMethod === 'onsite' && receipt.paymentStatus !== 'paid';
    const isOnsitePaid = receipt.paymentMethod === 'onsite' && receipt.paymentStatus === 'paid';

    const rows = [
        row('Reference', receipt.reference),
        row('Package', receipt.vehicleType ? `${receipt.packageName} · ${receipt.vehicleType}` : receipt.packageName),
        row('Date & time', `${receipt.bookingDate} at ${receipt.bookingTime}`),
        row('Vehicle registration', receipt.registration),
        row('Customer', receipt.customerName),
        row('Contact', [receipt.customerEmail, receipt.customerMobile].filter(Boolean).join(' · ')),
        row('Service address', receipt.address),
        row('Promo code used', receipt.promoApplied ? `Yes — ${receipt.promoCode} (10% off)` : 'No'),
        row('Subtotal', receipt.discountZar ? receipt.originalAmountZar : ''),
        row('Discount', receipt.discountZar ? `-${receipt.discountZar}` : ''),
        row(isOnsiteUnpaid ? 'Amount due on-site' : 'Amount paid', receipt.amountZar),
    ].join('');

    const paymentNotice = isOnsiteUnpaid
        ? `
                            <div style="margin:0 0 20px;padding:14px 16px;background:#FBF3DC;border:1px solid #F0DFA5;border-radius:10px;">
                                <p style="margin:0;color:#7A5B00;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;">Payment due on-site</p>
                                <p style="margin:6px 0 0;color:#5B4B14;font-size:12.5px;line-height:1.55;">
                                    No payment has been taken yet. Please have <strong>${escapeHtml(receipt.amountZar)}</strong> ready to pay our technician on arrival —
                                    we accept the Yoco card machine (tap, chip &amp; PIN) as well as Google Pay or Apple Pay directly from your phone.
                                </p>
                            </div>`
        : '';

    return `
<!doctype html>
<html>
<body style="margin:0;padding:0;background:${BRAND.canvasoft};font-family:Segoe UI,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.canvasoft};padding:24px 0;">
        <tr>
            <td align="center">
                <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid ${BRAND.line};">
                    <tr>
                        <td style="background:${BRAND.sagedeep};padding:28px 32px;">
                            <p style="margin:0;color:#c4d8c9;font-size:11px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;">A10tion To Detail</p>
                            <h1 style="margin:8px 0 0;color:#ffffff;font-size:22px;font-weight:600;">${isOnsiteUnpaid ? 'Booking confirmed — pay on arrival' : 'Booking confirmed — thank you!'}</h1>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:28px 32px;">
                            <p style="margin:0 0 16px;color:${BRAND.body};font-size:14px;line-height:1.6;">
                                Hi ${escapeHtml(receipt.customerName || 'there')}, ${isOnsiteUnpaid ? "your wash is booked in — you'll pay our technician when we arrive." : "we've received your payment and your wash is booked in."}
                                Keep your reference number handy in case you need to contact us about this booking.
                            </p>
                            <div style="margin:0 0 20px;padding:14px 16px;background:${BRAND.sagelight};border-radius:10px;text-align:center;">
                                <p style="margin:0;color:${BRAND.sage};font-size:11px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;">Your reference number</p>
                                <p style="margin:4px 0 0;color:${BRAND.ink};font-size:20px;font-weight:700;letter-spacing:.04em;">${escapeHtml(receipt.reference)}</p>
                            </div>
                            ${paymentNotice}
                            ${isOnsitePaid ? '<div style="margin:0 0 20px;padding:12px 16px;background:#EAF0E9;border-radius:10px;color:#1E3128;font-size:12px;font-weight:700;">On-site payment received. Thank you.</div>' : ''}
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                                ${rows}
                            </table>
                            <p style="margin:20px 0 0;color:${BRAND.body};font-size:12.5px;line-height:1.6;">
                                Please make sure your vehicle is available at the address above for the full appointment window.
                                If anything about your booking looks incorrect, reply to this email as soon as possible.
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:18px 32px;background:${BRAND.canvasoft};border-top:1px solid ${BRAND.line};">
                            <p style="margin:0;color:${BRAND.body};font-size:11px;">A10tion To Detail · Thank you for choosing us.</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;
}
