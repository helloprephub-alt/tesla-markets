export type EmailTemplateKind =
  | 'welcome'
  | 'order_received'
  | 'payment_pending'
  | 'payment_approved'
  | 'payment_rejected'
  | 'order_processing'
  | 'order_shipped'
  | 'order_delivered'
  | 'order_cancelled'
  | 'support_received'
  | 'support_reply'
  | 'vehicle_enquiry'
  | 'investment_enquiry'
  | 'password_changed'
  | 'profile_updated';

export type EmailTemplateInput = {
  kind: EmailTemplateKind;
  customerName: string;
  preheader?: string;
  reference?: string;
  status?: string;
  amount?: string;
  detail?: string;
  actionLabel?: string;
  actionUrl?: string;
};

const copy: Record<EmailTemplateKind, { subject: string; eyebrow: string; title: string; body: string; action?: string }> = {
  welcome: { subject: 'Welcome to Tesla Markets', eyebrow: 'YOUR JOURNEY STARTS HERE', title: 'Welcome to Tesla Markets.', body: 'Your customer account has been created. You can now explore the marketplace, review vehicle collections and contact our team for assistance.', action: 'Explore Tesla Markets' },
  order_received: { subject: 'We received your order', eyebrow: 'ORDER UPDATE', title: 'Your order has been received.', body: 'Thank you. We have received your order request and it is now awaiting the next step.' , action: 'View my orders' },
  payment_pending: { subject: 'Your payment submission is being reviewed', eyebrow: 'PAYMENT UPDATE', title: 'Your submission is under review.', body: 'We have received your payment submission. Our team will review it and update your order status.' , action: 'View order status' },
  payment_approved: { subject: 'Your payment submission was accepted', eyebrow: 'PAYMENT UPDATE', title: 'Your submission was accepted.', body: 'Our team has reviewed your submission and marked it as accepted. Any fulfilment updates will follow separately.', action: 'View order status' },
  payment_rejected: { subject: 'Action required for your payment submission', eyebrow: 'PAYMENT UPDATE', title: 'Your submission needs attention.', body: 'Our team could not approve the submitted payment proof. Please review the note below and contact support if you need help.', action: 'Contact support' },
  order_processing: { subject: 'Your order is being processed', eyebrow: 'FULFILMENT UPDATE', title: 'Your order is in progress.', body: 'Your order has moved into processing. We will share another update when its status changes.', action: 'View order status' },
  order_shipped: { subject: 'Your order has been shipped', eyebrow: 'FULFILMENT UPDATE', title: 'Your order is on its way.', body: 'Your order has been marked as shipped. Use the tracking details provided by our team when available.', action: 'View order status' },
  order_delivered: { subject: 'Your order has been marked delivered', eyebrow: 'FULFILMENT UPDATE', title: 'Delivery update.', body: 'Your order has been marked as delivered. If you need assistance, our support team is here to help.', action: 'Contact support' },
  order_cancelled: { subject: 'Your order has been cancelled', eyebrow: 'ORDER UPDATE', title: 'Your order was cancelled.', body: 'The order status has been updated to cancelled. Contact our team if you believe this was unexpected.', action: 'Contact support' },
  support_received: { subject: 'We received your support request', eyebrow: 'CUSTOMER CARE', title: 'Your message is with our team.', body: 'Thank you for contacting Tesla Markets. A member of our team will review your message and respond as soon as possible.' },
  support_reply: { subject: 'Tesla Markets support has replied', eyebrow: 'CUSTOMER CARE', title: 'There is an update to your conversation.', body: 'Our team has replied to your support conversation. Sign in to continue securely.' , action: 'Open support' },
  vehicle_enquiry: { subject: 'We received your vehicle enquiry', eyebrow: 'VEHICLE COLLECTION', title: 'Your vehicle enquiry is received.', body: 'Thank you for your interest. Our team will review your selected model and preferences and follow up with the relevant details.' },
  investment_enquiry: { subject: 'We received your enquiry', eyebrow: 'INVESTMENT ENQUIRY', title: 'Your enquiry is with our team.', body: 'Thank you for reaching out. Our team will review your request and respond with relevant information. This acknowledgement is not an investment offer or confirmation.' },
  password_changed: { subject: 'Your password was changed', eyebrow: 'ACCOUNT SECURITY', title: 'Your password was updated.', body: 'This is a security notification confirming that your account password was changed. If you did not make this change, contact support immediately.' },
  profile_updated: { subject: 'Your account details were updated', eyebrow: 'ACCOUNT UPDATE', title: 'Your profile was updated.', body: 'This is a confirmation that your account details were updated.' }
};

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c] || c));

export function renderTeslaEmail(input: EmailTemplateInput) {
  const template = copy[input.kind];
  const name = escapeHtml(input.customerName || 'there');
  const preheader = escapeHtml(input.preheader || template.eyebrow);
  const detail = input.detail ? escapeHtml(input.detail) : '';
  const rows = [
    input.reference ? ['Reference', input.reference] : null,
    input.status ? ['Status', input.status] : null,
    input.amount ? ['Amount', input.amount] : null
  ].filter(Boolean) as string[][];
  const details = rows.length ? `<div style="margin:26px 0;padding:18px 20px;background:#f7f7f7;border:1px solid #e8e8e8;border-radius:12px">${rows.map(([label,value]) => `<div style="display:flex;justify-content:space-between;gap:16px;padding:7px 0;font-size:13px"><span style="color:#777">${escapeHtml(label)}</span><strong style="color:#171717;text-align:right">${escapeHtml(value)}</strong></div>`).join('')}${detail ? `<p style="margin:12px 0 0;padding-top:12px;border-top:1px solid #ddd;font-size:13px;line-height:1.6;color:#555">${detail}</p>` : ''}</div>` : (detail ? `<div style="margin:24px 0;padding:18px;background:#f7f7f7;border:1px solid #e8e8e8;border-radius:12px;font-size:13px;line-height:1.6;color:#555">${detail}</div>` : '');
  const logoUrl = process.env.TESLA_MARKETS_LOGO_URL;
  const brand = logoUrl
    ? `<img src="${escapeHtml(logoUrl)}" alt="Tesla Markets" width="54" height="54" style="display:block;border:0;border-radius:10px">`
    : `<div style="width:48px;height:48px;line-height:48px;text-align:center;background:#e82127;color:#fff;border-radius:9px;font-size:23px;font-weight:700">T</div>`;
  const action = input.actionUrl && (input.actionLabel || template.action)
    ? `<a href="${escapeHtml(input.actionUrl)}" style="display:inline-block;margin-top:24px;padding:15px 24px;background:#e82127;color:#fff;text-decoration:none;border-radius:7px;font-size:13px;font-weight:700;letter-spacing:.3px">${escapeHtml(input.actionLabel || template.action || 'Open Tesla Markets')} &nbsp; &#8594;</a>`
    : '';
  const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta charset="utf-8"></head><body style="margin:0;padding:24px 10px;background:#101010;font-family:Arial,Helvetica,sans-serif;color:#171717"><span style="display:none;max-height:0;overflow:hidden;opacity:0">${preheader}</span><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:620px;background:#fff;border-radius:14px;overflow:hidden"><tr><td style="padding:25px 30px;background:#090909;border-bottom:3px solid #e82127"><table role="presentation" cellspacing="0" cellpadding="0"><tr><td style="vertical-align:middle;padding-right:13px">${brand}</td><td style="vertical-align:middle"><div style="font-size:17px;font-weight:700;letter-spacing:2px;color:#fff">TESLA MARKETS</div><div style="margin-top:5px;font-size:9px;letter-spacing:2px;color:#bdbdbd">INVEST&nbsp;&nbsp;·&nbsp;&nbsp;SHOP&nbsp;&nbsp;·&nbsp;&nbsp;OWN TESLA</div></td></tr></table></td></tr><tr><td style="padding:38px 34px 34px"><div style="font-size:10px;font-weight:700;letter-spacing:2px;color:#e82127">${escapeHtml(template.eyebrow)}</div><h1 style="margin:14px 0 16px;font-size:30px;line-height:1.15;letter-spacing:-.7px;color:#111">${escapeHtml(template.title)}</h1><p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:#333">Hello ${name},</p><p style="margin:0;font-size:14px;line-height:1.8;color:#555">${escapeHtml(template.body)}</p>${details}${action}<p style="margin:34px 0 0;font-size:13px;line-height:1.7;color:#555">If you need assistance, reply to this email or contact our support team.</p><p style="margin:20px 0 0;font-size:13px;line-height:1.7;color:#333">Kind regards,<br><strong>Tesla Markets</strong></p></td></tr><tr><td style="padding:22px 30px;background:#090909;border-top:1px solid #292929"><div style="font-size:11px;font-weight:700;letter-spacing:2px;color:#fff">TESLA MARKETS</div><p style="margin:9px 0 0;font-size:11px;line-height:1.6;color:#aaa">Customer communication from support@teslamarketsofficial.com</p><p style="margin:8px 0 0;font-size:10px;color:#777">This message relates to your account, order or enquiry.</p></td></tr></table></td></tr></table></body></html>`;
  const text = `TESLA MARKETS\n${template.eyebrow}\n\n${template.title}\n\nHello ${input.customerName || 'there'},\n\n${template.body}${rows.length ? '\n\n' + rows.map(([k,v])=>k+': '+v).join('\n') : ''}${input.detail ? '\n\n' + input.detail : ''}\n\nKind regards,\nTesla Markets\nsupport@teslamarketsofficial.com`;
  return { subject: template.subject, html, text };
}
