function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
    })[char]);
}

function packageLabel(booking) {
    if (booking.bookingType === 'monthly-entitlement') {
        const clientType = booking.monthlyClientType === 'business' ? 'Business / Fleet / Family' : 'Private Client';
        const tier = booking.monthlyPackageTier === 'premium' ? 'Premium' : 'Standard';
        return `${clientType} — ${tier} (${booking.monthlyAllowance || (tier === 'Premium' ? 4 : 2)} washes per billing period)`;
    }
    return booking.packageName || 'Single Wash';
}

export function buildBookingRequestEmailHtml(request, { status, continuationUrl, businessCopy = false }) {
    const booking = request.booking;
    const name = `${booking.customer?.firstName || ''} ${booking.customer?.surname || ''}`.trim() || 'there';
    const isMonthly = booking.bookingType === 'monthly-entitlement';
    const heading = status === 'pending' ? 'Booking request received'
        : status === 'approved' ? 'Your booking request is approved'
            : 'Update on your booking request';
    const intro = status === 'pending'
        ? businessCopy
            ? 'A new booking request is waiting for review. No payment has been taken and the appointment is not yet confirmed.'
            : 'We have received your booking request. It is not confirmed yet; we will email you when the business has reviewed it.'
        : status === 'approved'
            ? 'Your booking request has been approved. Use the secure link below to complete your booking.'
            : 'Unfortunately, the business could not approve this booking request. Any temporary appointment and monthly wash reservations have been released.';
    const decisionReason = status === 'declined'
        ? request.events?.find((event) => event.status === 'declined')?.reason
        : '';
    const fields = [
        ['Reference', request.reference],
        ['Customer', name],
        ['Email', booking.customer?.email],
        ['Mobile', booking.customer?.mobile],
        ['Customer type', isMonthly ? (booking.monthlyClientType === 'business' ? 'Business / Fleet / Family' : 'Private Client') : 'Single Wash'],
        ['Package', packageLabel(booking)],
        ['Wash', booking.vehicleType],
        ['Registration', booking.customer?.registration],
        ['Date and time', `${booking.bookingDate} at ${booking.bookingTime}`],
        ['Payment method', isMonthly ? 'Monthly package entitlement' : 'Choose after the request is approved'],
        ['Monthly code', isMonthly ? `Assigned entitlement ${request.monthlyReservation?.entitlementId?.slice(0, 8)?.toUpperCase() || ''}` : null],
    ].filter(([, value]) => value);
    const rows = fields.map(([label, value]) => `
        <tr><td style="padding:9px 0;border-bottom:1px solid #e6e9e3;color:#5b6560;font-size:13px">${escapeHtml(label)}</td>
        <td style="padding:9px 0;border-bottom:1px solid #e6e9e3;color:#161b18;font-size:13px;font-weight:600;text-align:right">${escapeHtml(value)}</td></tr>`).join('');
    const action = continuationUrl ? `
        <p style="margin:22px 0;text-align:center">
          <a href="${escapeHtml(continuationUrl)}" style="display:inline-block;padding:13px 20px;border-radius:9px;background:#1e4931;color:#fff;text-decoration:none;font-size:14px;font-weight:700">
            ${status === 'approved' ? 'Continue with your booking' : 'View request status'}
          </a>
        </p>
        <p style="color:#68776e;font-size:11px;line-height:1.55">This secure link expires at ${escapeHtml(new Date(request.expiresAt).toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg' }))}. Do not forward it.</p>` : '';
    const brandLine = businessCopy ? 'Business Manager · Booking approval' : 'A10tion To Detail';
    return `<!doctype html><html><body style="margin:0;padding:24px;background:#f6f7f3;font-family:Segoe UI,Arial,sans-serif;color:#161b18">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
        <table role="presentation" width="560" style="max-width:560px;width:100%;background:#fff;border:1px solid #e6e9e3;border-radius:16px;overflow:hidden">
          <tr><td style="padding:25px 28px;background:#1e3128;color:#fff"><p style="margin:0;color:#c4d8c9;font-size:11px;letter-spacing:.13em;text-transform:uppercase">${brandLine}</p><h1 style="margin:9px 0 0;font-size:22px">${heading}</h1></td></tr>
          <tr><td style="padding:26px 28px"><p style="margin:0 0 18px;color:#5b6560;font-size:14px;line-height:1.6">${status === 'pending' && !businessCopy ? `Hi ${escapeHtml(name)}, ` : ''}${intro}</p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
            ${decisionReason ? `<p style="margin:16px 0 0;color:#5b6560;font-size:13px;line-height:1.55"><strong>Reason:</strong> ${escapeHtml(decisionReason)}</p>` : ''}
            ${action}
            <p style="margin:20px 0 0;color:#68776e;font-size:12px;line-height:1.6">Keep your reference number for any questions. Please reply to this email if you need assistance.</p>
          </td></tr><tr><td style="padding:16px 28px;background:#f6f7f3;border-top:1px solid #e6e9e3;color:#5b6560;font-size:11px">A10tion To Detail · Thank you.</td></tr>
        </table>
      </td></tr></table>
    </body></html>`;
}
