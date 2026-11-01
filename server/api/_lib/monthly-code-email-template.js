const BRAND = {
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
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[char]);
}

export function buildMonthlyCodeEmailHtml({
    customerName,
    clientType,
    packageTier,
    monthlyAllowance,
    validUntil,
    code,
    checkoutUrl,
}) {
    const typeLabel = clientType === 'business' ? 'Business / Fleet / Family' : 'Private Client';
    const packageLabel = packageTier === 'premium' ? 'Premium' : 'Standard';
    return `<!doctype html>
<html lang="en">
<body style="margin:0;padding:24px 12px;background:${BRAND.canvas};font-family:Segoe UI,Helvetica,Arial,sans-serif;color:${BRAND.ink}">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#fff;border:1px solid ${BRAND.line};border-radius:16px;overflow:hidden">
      <tr><td style="padding:28px 32px;background:${BRAND.deep}">
        <p style="margin:0;color:#c4d8c9;font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase">A10tion To Detail</p>
        <h1 style="margin:9px 0 0;color:#fff;font-size:22px">Your monthly wash package is ready</h1>
      </td></tr>
      <tr><td style="padding:28px 32px">
        <p style="margin:0 0 16px;color:${BRAND.body};font-size:14px;line-height:1.6">Hi ${escapeHtml(customerName)}, your monthly wash entitlement is ready to use. Enter the code below when booking an eligible wash.</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:18px">
          <tr><td style="padding:8px 0;border-bottom:1px solid ${BRAND.line};color:${BRAND.body};font-size:13px">Customer type</td><td align="right" style="padding:8px 0;border-bottom:1px solid ${BRAND.line};font-size:13px;font-weight:600">${typeLabel}</td></tr>
          <tr><td style="padding:8px 0;border-bottom:1px solid ${BRAND.line};color:${BRAND.body};font-size:13px">Package</td><td align="right" style="padding:8px 0;border-bottom:1px solid ${BRAND.line};font-size:13px;font-weight:600">${packageLabel}</td></tr>
          <tr><td style="padding:8px 0;border-bottom:1px solid ${BRAND.line};color:${BRAND.body};font-size:13px">Monthly allowance</td><td align="right" style="padding:8px 0;border-bottom:1px solid ${BRAND.line};font-size:13px;font-weight:600">${Number(monthlyAllowance)} washes per month</td></tr>
          ${validUntil ? `<tr><td style="padding:8px 0;color:${BRAND.body};font-size:13px">Valid until</td><td align="right" style="padding:8px 0;font-size:13px;font-weight:600">${escapeHtml(validUntil)}</td></tr>` : ''}
        </table>
        <div style="padding:16px;border:1px dashed #cbd9cf;border-radius:10px;background:${BRAND.light};text-align:center">
          <p style="margin:0;color:${BRAND.sage};font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase">Your monthly access code</p>
          <p style="margin:7px 0 0;color:${BRAND.ink};font-size:22px;font-weight:800;letter-spacing:.06em">${escapeHtml(code)}</p>
        </div>
        <p style="margin:16px 0;color:${BRAND.body};font-size:12.5px;line-height:1.6">The code provides a 100% discount for eligible washes, subject to your remaining monthly allowance. Unused washes do not roll over. Please keep this code private.</p>
        <p style="margin:22px 0;text-align:center"><a href="${escapeHtml(checkoutUrl)}" style="display:inline-block;padding:12px 20px;border-radius:8px;background:${BRAND.deep};color:#fff;font-size:13px;font-weight:700;text-decoration:none">Book a monthly wash</a></p>
      </td></tr>
      <tr><td style="padding:18px 32px;border-top:1px solid ${BRAND.line};background:${BRAND.canvas};color:${BRAND.body};font-size:11px">A10tion To Detail · Thank you for choosing us.</td></tr>
    </table>
  </td></tr></table>
</body>
</html>`;
}
