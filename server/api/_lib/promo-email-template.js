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

/** Email confirming a vehicle's registration number now works as a 10%-off single-wash promo code. */
export function buildVehiclePromoApprovedEmailHtml({ vehicleRegistration }) {
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
                            <h1 style="margin:8px 0 0;color:#ffffff;font-size:22px;font-weight:600;">Your 10% single-wash discount is ready</h1>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:28px 32px;">
                            <p style="margin:0 0 16px;color:${BRAND.body};font-size:14px;line-height:1.6;">
                                You're approved! There's no separate code to remember — your vehicle's own
                                registration number now works as your promo code.
                            </p>
                            <div style="margin:0 0 20px;padding:14px 16px;background:${BRAND.sagelight};border-radius:10px;text-align:center;">
                                <p style="margin:0;color:${BRAND.sage};font-size:11px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;">Your promo code</p>
                                <p style="margin:4px 0 0;color:${BRAND.ink};font-size:22px;font-weight:700;letter-spacing:.06em;">${escapeHtml(vehicleRegistration)}</p>
                            </div>
                            <p style="margin:0;color:${BRAND.body};font-size:12.5px;line-height:1.6;">
                                Just enter this vehicle's registration number as usual when booking a single wash and the 10% discount is applied automatically.
                                It can only be used once and becomes invalid immediately after a successful purchase.
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
