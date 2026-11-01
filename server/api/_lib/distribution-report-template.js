const COLORS = {
    ink: '#161B18',
    body: '#5B6560',
    canvas: '#F6F7F3',
    line: '#E6E9E3',
    deep: '#1E3128',
    light: '#EAF0E9',
};

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[char]);
}

export function buildDistributionReportHtml(run) {
    const accepted = (run.results || []).filter((entry) => entry.status === 'accepted' || entry.status === 'delivered').length;
    const delivered = (run.results || []).filter((entry) => entry.status === 'delivered').length;
    const failed = (run.results || []).filter((entry) => entry.status === 'failed').length;
    const rows = [
        ...(run.results || []).map((entry) => `<tr>
          <td>${escapeHtml(entry.customerName)}</td><td>${escapeHtml(entry.customerTypeLabel)}</td>
          <td>${escapeHtml(entry.packageLabel)}</td><td>${escapeHtml(entry.email)}</td>
          <td><strong>${escapeHtml(entry.code)}</strong></td>
          <td>${escapeHtml(entry.deliveryLabel || entry.status)}${entry.failureReason ? `<br><small>${escapeHtml(entry.failureReason)}</small>` : ''}</td>
        </tr>`),
        ...(run.exclusions || []).map((entry) => `<tr>
          <td>${escapeHtml(entry.customerName)}</td><td>${escapeHtml(entry.customerTypeLabel || '—')}</td>
          <td>${escapeHtml(entry.packageLabel || '—')}</td><td>${escapeHtml(entry.email)}</td>
          <td>—</td><td>Excluded: ${escapeHtml(entry.reason)}</td>
        </tr>`),
    ].join('');
    return `<!doctype html><html lang="en"><body style="margin:0;padding:24px 12px;background:${COLORS.canvas};font-family:Segoe UI,Helvetica,Arial,sans-serif;color:${COLORS.ink}">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
        <table role="presentation" width="900" cellpadding="0" cellspacing="0" style="max-width:900px;width:100%;background:#fff;border:1px solid ${COLORS.line};border-radius:16px;overflow:hidden">
          <tr><td style="padding:26px 30px;background:${COLORS.deep};color:#fff">
            <p style="margin:0;color:#c4d8c9;font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase">A10tion To Detail · Internal report</p>
            <h1 style="margin:8px 0 0;font-size:22px">Monthly code distribution</h1>
            <p style="margin:8px 0 0;color:#e3ece5;font-size:13px">Run ${escapeHtml(run.id)} · ${escapeHtml(run.status)}</p>
          </td></tr>
          <tr><td style="padding:24px 30px">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px">
              <tr><td style="padding:7px;color:${COLORS.body}">Distribution date</td><td style="padding:7px;text-align:right;font-weight:600">${escapeHtml(run.distributionDate)}</td></tr>
              <tr><td style="padding:7px;color:${COLORS.body}">Initiated (South African time)</td><td style="padding:7px;text-align:right;font-weight:600">${escapeHtml(run.initiatedAtSA)}</td></tr>
              <tr><td style="padding:7px;color:${COLORS.body}">Completed (South African time)</td><td style="padding:7px;text-align:right;font-weight:600">${escapeHtml(run.completedAtSA || 'Still processing')}</td></tr>
              <tr><td style="padding:7px;color:${COLORS.body}">Administrator</td><td style="padding:7px;text-align:right;font-weight:600">${escapeHtml(run.adminName || 'Business Manager admin')}</td></tr>
            </table>
            <div style="display:flex;flex-wrap:wrap;gap:8px;margin:0 0 20px">
              <span style="padding:9px 12px;border-radius:8px;background:${COLORS.light}">Active considered: <strong>${Number(run.activeConsidered || 0)}</strong></span>
              <span style="padding:9px 12px;border-radius:8px;background:${COLORS.light}">Eligible recipients: <strong>${(run.recipients || []).length}</strong></span>
              <span style="padding:9px 12px;border-radius:8px;background:${COLORS.light}">Provider accepted: <strong>${accepted}</strong></span>
              <span style="padding:9px 12px;border-radius:8px;background:${COLORS.light}">Delivered confirmed: <strong>${delivered}</strong></span>
              <span style="padding:9px 12px;border-radius:8px;background:#fff0ee">Failed: <strong>${failed}</strong></span>
              <span style="padding:9px 12px;border-radius:8px;background:#f2f3f1">Excluded: <strong>${(run.exclusions || []).length}</strong></span>
            </div>
            <p style="margin:0 0 12px;color:${COLORS.body};font-size:12px;line-height:1.55">“Accepted” means the email provider accepted the send request; it does not mean delivery. Delivery and failure status may update later from the configured provider webhook.</p>
            <div style="overflow-x:auto">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:12px">
                <thead><tr style="background:${COLORS.light};text-align:left"><th style="padding:9px">Customer</th><th style="padding:9px">Type</th><th style="padding:9px">Package</th><th style="padding:9px">Email</th><th style="padding:9px">Promo code</th><th style="padding:9px">Status / reason</th></tr></thead>
                <tbody>${rows || '<tr><td colspan="6" style="padding:14px">No clients were included in this run.</td></tr>'}</tbody>
              </table>
            </div>
            <p style="margin:18px 0 0;color:${COLORS.body};font-size:11px">Open the Business Manager → Monthly Clients → Distribution history to review this run.</p>
          </td></tr>
        </table>
      </td></tr></table>
    </body></html>`;
}
