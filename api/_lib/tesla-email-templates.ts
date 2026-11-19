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
  | 'profile_updated'
  | 'email_verification' | 'password_reset' | 'account_recovery' | 'account_closed'
  | 'order_updated' | 'invoice_ready' | 'refund_update' | 'gift_card_received'
  | 'gift_card_review' | 'gift_card_approved' | 'gift_card_rejected'
  | 'vehicle_follow_up' | 'vehicle_quote' | 'vehicle_reservation'
  | 'investment_follow_up' | 'investment_information' | 'investment_status'
  | 'chat_received' | 'ticket_updated' | 'ticket_resolved' | 'feedback_request'
  | 'getting_started' | 'post_purchase' | 'review_request' | 'reengagement'
  | 'product_announcement' | 'vehicle_promotion' | 'discount_announcement'
  | 'limited_offer' | 'newsletter' | 'admin_alert' | 'daily_summary' | 'system_alert';

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
  profile_updated: { subject: 'Your account details were updated', eyebrow: 'ACCOUNT UPDATE', title: 'Your profile was updated.', body: 'This is a confirmation that your account details were updated.' },

  email_verification: { subject: 'Verify your Tesla Markets email', eyebrow: 'ACCOUNT VERIFICATION', title: 'Confirm your email address.', body: 'Please verify your email address to complete your account setup. If you did not create this account, you can ignore this message.', action: 'Verify email' },
  password_reset: { subject: 'Reset your Tesla Markets password', eyebrow: 'ACCOUNT SECURITY', title: 'Password reset requested.', body: 'A password reset was requested for your account. Use the secure reset link to choose a new password. If you did not request this, contact support.' , action: 'Reset password' },
  account_recovery: { subject: 'Account recovery information', eyebrow: 'ACCOUNT SECURITY', title: 'Let’s help you recover access.', body: 'We received a request for help accessing your account. Follow the secure instructions provided by our team.' },
  account_closed: { subject: 'Your account closure request', eyebrow: 'ACCOUNT UPDATE', title: 'Your account closure is confirmed.', body: 'Your account closure request has been processed. If you believe this is a mistake, contact our support team.' },
  order_updated: { subject: 'There is an update to your order', eyebrow: 'ORDER UPDATE', title: 'Your order details have changed.', body: 'There has been an update to your order. Review the details below or contact our team if you need assistance.', action: 'View order' },
  invoice_ready: { subject: 'Your Tesla Markets invoice is ready', eyebrow: 'ORDER DOCUMENT', title: 'Your invoice is ready.', body: 'Your order invoice is available. Keep this email for your records.', action: 'View invoice' },
  refund_update: { subject: 'Your refund status has been updated', eyebrow: 'PAYMENT UPDATE', title: 'There is an update on your refund.', body: 'The status of your refund request has changed. Refer to the details below for the latest information.' },
  gift_card_received: { subject: 'We received your payment submission', eyebrow: 'PAYMENT REVIEW', title: 'Your submission has arrived.', body: 'We have received your payment proof for review. This is an acknowledgement only, not confirmation of payment or settlement.' },
  gift_card_review: { subject: 'Your payment proof is under review', eyebrow: 'PAYMENT REVIEW', title: 'Our team is reviewing your submission.', body: 'Your submitted payment proof is being checked. We will email you when the review is complete.' },
  gift_card_approved: { subject: 'Your payment proof was approved', eyebrow: 'PAYMENT REVIEW', title: 'Your submission was approved.', body: 'Our team approved the submitted payment proof. Order fulfilment will be communicated separately.' },
  gift_card_rejected: { subject: 'Your payment proof needs attention', eyebrow: 'PAYMENT REVIEW', title: 'We could not approve your submission.', body: 'Please review the management note below and contact support if you need assistance.' },
  vehicle_follow_up: { subject: 'Following up on your vehicle enquiry', eyebrow: 'VEHICLE COLLECTION', title: 'Can we help with your vehicle research?', body: 'We are following up on your recent vehicle enquiry. Reply to this email if you would like more information.' },
  vehicle_quote: { subject: 'Your vehicle quotation is ready', eyebrow: 'VEHICLE COLLECTION', title: 'Your requested quotation is ready.', body: 'The team has prepared an update for your selected vehicle. Review the details and contact us with any questions.' },
  vehicle_reservation: { subject: 'Your vehicle reservation update', eyebrow: 'VEHICLE COLLECTION', title: 'There is an update to your reservation.', body: 'Your vehicle reservation details have been updated. Please review the information below.' },
  investment_follow_up: { subject: 'Following up on your information request', eyebrow: 'INVESTMENT INFORMATION', title: 'We are following up on your enquiry.', body: 'Our team is checking in about your request for investment information. This message is informational and is not an investment offer.' },
  investment_information: { subject: 'The information you requested', eyebrow: 'INVESTMENT INFORMATION', title: 'Your requested information is available.', body: 'We have an update to the information you requested. Please review the details and consider seeking independent professional advice.' },
  investment_status: { subject: 'Your enquiry status has changed', eyebrow: 'INVESTMENT ENQUIRY', title: 'There is an update to your enquiry.', body: 'The status of your enquiry has changed. This is an administrative update, not a financial transaction or investment performance statement.' },
  chat_received: { subject: 'We received your message', eyebrow: 'CUSTOMER CARE', title: 'Your message is with Tesla Markets.', body: 'Thank you for contacting our team. We have received your message and will follow up as soon as possible.' },
  ticket_updated: { subject: 'Your support request has an update', eyebrow: 'CUSTOMER CARE', title: 'Your support request was updated.', body: 'There is a new update to your support request. Sign in to view the conversation securely.', action: 'Open support' },
  ticket_resolved: { subject: 'Your support request was resolved', eyebrow: 'CUSTOMER CARE', title: 'Your support request is marked resolved.', body: 'Our team has marked your support request as resolved. If you still need help, reply to this email.' },
  feedback_request: { subject: 'How was your Tesla Markets experience?', eyebrow: 'CUSTOMER FEEDBACK', title: 'We would value your feedback.', body: 'Your feedback helps us improve the experience. Share a few thoughts about your recent interaction.' , action: 'Share feedback' },
  getting_started: { subject: 'Getting started with Tesla Markets', eyebrow: 'GETTING STARTED', title: 'A few helpful next steps.', body: 'Explore the marketplace, review available vehicle information and contact our team whenever you need assistance.', action: 'Explore marketplace' },
  post_purchase: { subject: 'Thank you for choosing Tesla Markets', eyebrow: 'CUSTOMER CARE', title: 'Thank you for your order.', body: 'We appreciate your business. Keep your order reference handy and contact our team if you need support.' },
  review_request: { subject: 'Tell us about your experience', eyebrow: 'CUSTOMER FEEDBACK', title: 'Would you share a review?', body: 'If you have a moment, we would appreciate an honest review of your experience with Tesla Markets.', action: 'Leave a review' },
  reengagement: { subject: 'It has been a while', eyebrow: 'A NOTE FROM TESLA MARKETS', title: 'Would you like to explore again?', body: 'There may be new information and marketplace updates to explore. You are receiving this only because you opted in to updates.', action: 'Explore marketplace' },
  product_announcement: { subject: 'New additions to Tesla Markets', eyebrow: 'MARKETPLACE UPDATE', title: 'Something new has arrived.', body: 'Explore the latest additions to the marketplace and review product information before making a decision.', action: 'Explore new arrivals' },
  vehicle_promotion: { subject: 'A vehicle update from Tesla Markets', eyebrow: 'VEHICLE COLLECTION', title: 'Explore this vehicle feature.', body: 'We are sharing a vehicle update you may find useful. Availability and pricing can change; confirm current details with our team.', action: 'Explore vehicles' },
  discount_announcement: { subject: 'A selected marketplace offer', eyebrow: 'SELECTED OFFER', title: 'A limited selection is on offer.', body: 'Selected items may have promotional pricing. Discounts vary by product and campaign and are subject to availability.', action: 'View selected offers' },
  limited_offer: { subject: 'A limited-time Tesla Markets offer', eyebrow: 'LIMITED-TIME OFFER', title: 'Explore the current offer.', body: 'This offer is available only during the stated campaign period and may be subject to eligibility and availability.', action: 'View offer' },
  newsletter: { subject: 'Tesla Markets update', eyebrow: 'THE TESLA MARKETS EDIT', title: 'News, information and marketplace updates.', body: 'Here is your latest opted-in update from Tesla Markets. You can manage your email preferences at any time.' },
  admin_alert: { subject: 'Tesla Markets admin notification', eyebrow: 'MANAGEMENT NOTIFICATION', title: 'A new item needs attention.', body: 'A new customer or operational event has been recorded. Sign in to the management console to review it.', action: 'Open management' },
  daily_summary: { subject: 'Tesla Markets daily summary', eyebrow: 'DAILY OPERATIONS', title: 'Your daily activity summary.', body: 'The latest operational activity summary is ready for review.', action: 'Open dashboard' },
  system_alert: { subject: 'Tesla Markets system alert', eyebrow: 'SYSTEM MONITORING', title: 'A system event needs attention.', body: 'An automated system check recorded an issue. Review the management console and relevant logs.', action: 'Review system' }
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
  const details = rows.length ? `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:26px 0;background:#f7f8fa;border:1px solid #e6e8eb;border-radius:10px;border-collapse:separate">
      ${rows.map(([label,value]) => `<tr><td style="padding:13px 16px;font-size:13px;line-height:1.4;color:#73777d;border-bottom:1px solid #e6e8eb">${escapeHtml(label)}</td><td align="right" style="padding:13px 16px;font-size:13px;line-height:1.4;font-weight:700;color:#17191c;border-bottom:1px solid #e6e8eb">${escapeHtml(value)}</td></tr>`).join('')}
      ${detail ? `<tr><td colspan="2" style="padding:15px 16px;font-size:13px;line-height:1.65;color:#4d5258">${detail}</td></tr>` : ''}
    </table>` : (detail ? `<div style="margin:24px 0;padding:17px 18px;background:#f7f8fa;border:1px solid #e6e8eb;border-radius:10px;font-size:13px;line-height:1.65;color:#4d5258">${detail}</div>` : '');
  const logoUrl = process.env.TESLA_MARKETS_LOGO_URL || 'https://teslamarketsofficial.com/tesla-markets-logo.jpg';
  const actionUrl = input.actionUrl || 'https://teslamarketsofficial.com';
  const action = input.actionUrl || input.kind === 'welcome' || input.kind === 'getting_started'
    ? `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:28px 0 4px"><tr><td bgcolor="#e82127" style="border-radius:5px"><a href="${escapeHtml(actionUrl)}" style="display:inline-block;padding:15px 25px;color:#ffffff;text-decoration:none;font-size:13px;font-weight:700;letter-spacing:.4px;border-radius:5px">${escapeHtml(input.actionLabel || template.action || 'Explore Tesla Markets')} &nbsp; &#8594;</a></td></tr></table>`
    : '';
  const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta charset="utf-8"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"></head><body bgcolor="#f0f1f3" style="margin:0;padding:28px 12px;background-color:#f0f1f3;font-family:Arial,Helvetica,sans-serif;color:#17191c;-webkit-text-size-adjust:100%">
  <span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;max-height:0;max-width:0;overflow:hidden">${preheader} — Tesla Markets customer update.</span>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#f0f1f3"><tr><td align="center">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:640px;width:100%;border-collapse:separate;border-spacing:0;background:#ffffff;border-radius:12px;overflow:hidden">
      <tr><td bgcolor="#090a0c" style="padding:25px 30px 23px;background-color:#090a0c;border-bottom:3px solid #e82127">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr>
          <td width="112" valign="middle" style="width:112px;padding-right:18px">
            <img src="${escapeHtml(logoUrl)}" alt="Tesla" width="94" style="display:block;width:94px;max-width:100%;height:auto;border:0;outline:none;text-decoration:none">
          </td>
          <td valign="middle">
            <div style="font-size:18px;line-height:1.25;font-weight:700;letter-spacing:2.4px;color:#ffffff">TESLA MARKETS</div>
            <div style="margin-top:7px;font-size:9px;line-height:1.5;letter-spacing:2.1px;color:#c3c5c8">INVEST&nbsp;&nbsp;·&nbsp;&nbsp;SHOP&nbsp;&nbsp;·&nbsp;&nbsp;OWN TESLA</div>
          </td>
        </tr></table>
      </td></tr>
      <tr><td style="height:7px;line-height:7px;font-size:0;background:#f5f5f5">&nbsp;</td></tr>
      <tr><td style="padding:42px 42px 40px;background:#ffffff">
        <div style="font-size:10px;line-height:1.5;font-weight:700;letter-spacing:2.3px;color:#d71920;text-transform:uppercase">${escapeHtml(template.eyebrow)}</div>
        <h1 style="margin:15px 0 20px;font-size:32px;line-height:1.16;letter-spacing:-.7px;font-weight:700;color:#111418">${escapeHtml(template.title)}</h1>
        <p style="margin:0 0 14px;font-size:16px;line-height:1.65;color:#22262b">Hello ${name},</p>
        <p style="margin:0;font-size:15px;line-height:1.85;color:#555b62">${escapeHtml(template.body)}</p>
        ${details}
        ${action}
        <p style="margin:34px 0 0;font-size:13px;line-height:1.75;color:#626870">If you need assistance, reply to this email or contact our support team.</p>
        <p style="margin:21px 0 0;font-size:14px;line-height:1.7;color:#282d33">Kind regards,<br><strong style="color:#111418">Tesla Markets</strong></p>
      </td></tr>
      <tr><td bgcolor="#090a0c" style="padding:25px 32px;background-color:#090a0c;border-top:1px solid #26292d">
        <div style="font-size:11px;line-height:1.5;font-weight:700;letter-spacing:2.2px;color:#ffffff">TESLA MARKETS</div>
        <p style="margin:9px 0 0;font-size:11px;line-height:1.7;color:#b7bbc0">Customer communication from <a href="mailto:support@teslamarketsofficial.com" style="color:#ffffff;text-decoration:none">support@teslamarketsofficial.com</a></p>
        <p style="margin:9px 0 0;font-size:10px;line-height:1.6;color:#858b92">This message relates to your account, order or enquiry. Never share passwords, payment card details or gift-card codes by email.</p>
        <p style="margin:14px 0 0;font-size:10px;line-height:1.5;color:#777e86"><a href="https://teslamarketsofficial.com" style="color:#b9bec5;text-decoration:none">teslamarketsofficial.com</a></p>
      </td></tr>
    </table>
    <div style="padding:15px 12px;font-size:10px;line-height:1.5;color:#868b91;text-align:center">TESLA MARKETS &nbsp;·&nbsp; CUSTOMER EXPERIENCE</div>
  </td></tr></table>
  </body></html>`;
  const text = `TESLA MARKETS
${template.eyebrow}

${template.title}

Hello ${input.customerName || 'there'},

${template.body}${rows.length ? '\n\n' + rows.map(([k,v])=>k+': '+v).join('\n') : ''}${input.detail ? '\n\n' + input.detail : ''}

${input.actionUrl || input.kind === 'welcome' || input.kind === 'getting_started' ? 'Explore Tesla Markets: ' + actionUrl + '\n\n' : ''}Kind regards,
Tesla Markets
support@teslamarketsofficial.com`;
  return { subject: template.subject, html, text };
}
