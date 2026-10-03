const BRAND = {
    ink: '#161B18',
    body: '#5B6560',
    canvas: '#F6F7F3',
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

function detailRow(label, value) {
    if (!value) return '';
    return `
        <tr>
            <td style="padding:9px 0;border-bottom:1px solid ${BRAND.line};color:${BRAND.body};font-size:13px;">${escapeHtml(label)}</td>
            <td style="padding:9px 0;border-bottom:1px solid ${BRAND.line};color:${BRAND.ink};font-size:13px;font-weight:600;text-align:right;">${escapeHtml(value)}</td>
        </tr>`;
}

export function buildSupportEmailHtml({ name, email, issueType, reference, message }) {
    const details = [
        detailRow('Issue type', issueType),
        detailRow('Name', name),
        detailRow('Email', email),
        detailRow('Booking / payment reference', reference),
    ].join('');

    return `
<!doctype html>
<html>
<body style="margin:0;padding:0;background:${BRAND.canvas};font-family:Segoe UI,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.canvas};padding:24px 0;">
        <tr>
            <td align="center">
                <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid ${BRAND.line};">
                    <tr>
                        <td style="background:${BRAND.sagedeep};padding:26px 30px;">
                            <p style="margin:0;color:#c4d8c9;font-size:11px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;">A10tion To Detail</p>
                            <h1 style="margin:8px 0 0;color:#ffffff;font-size:22px;font-weight:600;">Website support request</h1>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:26px 30px;">
                            <p style="margin:0 0 14px;color:${BRAND.body};font-size:14px;line-height:1.6;">A customer sent a support request through the website.</p>
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${details}</table>
                            <div style="margin:20px 0 0;padding:16px 18px;background:${BRAND.sagelight};border-radius:10px;">
                                <p style="margin:0 0 8px;color:${BRAND.sage};font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;">Message</p>
                                <p style="margin:0;color:${BRAND.ink};font-size:13px;line-height:1.65;white-space:pre-wrap;">${escapeHtml(message)}</p>
                            </div>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:16px 30px;background:${BRAND.canvas};border-top:1px solid ${BRAND.line};">
                            <p style="margin:0;color:${BRAND.body};font-size:11px;">Reply directly to this email to respond to ${escapeHtml(name)}.</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;
}