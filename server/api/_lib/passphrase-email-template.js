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

function codeBlock(label, value) {
    return `<div style="margin-bottom:12px;padding:16px;border:1px dashed #cbd9cf;border-radius:10px;background:${BRAND.light};text-align:center">
          <p style="margin:0;color:${BRAND.sage};font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase">${escapeHtml(label)}</p>
          <p style="margin:7px 0 0;color:${BRAND.ink};font-size:22px;font-weight:800;letter-spacing:.06em;word-break:break-all">${escapeHtml(value)}</p>
        </div>`;
}

export function buildPassphraseEmailHtml({ recipientName, passphrase, promoCode, message, siteUrl }) {
    const greeting = recipientName ? `Hi ${escapeHtml(recipientName)},` : 'Hi there,';
    const note = message
        ? `<p style="margin:0 0 16px;color:${BRAND.body};font-size:14px;line-height:1.6;white-space:pre-line">${escapeHtml(message)}</p>`
        : '';
    return `<!doctype html>
<html lang="en">
<body style="margin:0;padding:24px 12px;background:${BRAND.canvas};font-family:Segoe UI,Helvetica,Arial,sans-serif;color:${BRAND.ink}">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#fff;border:1px solid ${BRAND.line};border-radius:16px;overflow:hidden">
      <tr><td style="padding:28px 32px;background:${BRAND.deep}">
        <p style="margin:0;color:#c4d8c9;font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase">A10tion To Detail</p>
        <h1 style="margin:9px 0 0;color:#fff;font-size:22px">Your access details</h1>
      </td></tr>
      <tr><td style="padding:28px 32px">
        <p style="margin:0 0 16px;color:${BRAND.body};font-size:14px;line-height:1.6">${greeting} here are your A10tion To Detail access details. Enter them exactly as shown when you book.</p>
        ${note}
        ${codeBlock('Your passphrase', passphrase)}
        ${promoCode ? codeBlock('Your promo code', promoCode) : ''}
        <p style="margin:16px 0;color:${BRAND.body};font-size:12.5px;line-height:1.6">Passphrases are case-sensitive and each promo code can only be redeemed once. Please keep these details private.</p>
        <p style="margin:22px 0;text-align:center"><a href="${escapeHtml(siteUrl)}" style="display:inline-block;padding:12px 20px;border-radius:8px;background:${BRAND.deep};color:#fff;font-size:13px;font-weight:700;text-decoration:none">Book a wash</a></p>
      </td></tr>
      <tr><td style="padding:18px 32px;border-top:1px solid ${BRAND.line};background:${BRAND.canvas};color:${BRAND.body};font-size:11px">A10tion To Detail · Thank you for choosing us.</td></tr>
    </table>
  </td></tr></table>
</body>
</html>`;
}
