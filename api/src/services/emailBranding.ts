import type { EmailMessage, IdentityEmailCategory } from './emailSender';

export interface EmailBrandOptions {
  publicWebUrl: string;
  environment: string;
  deployed: boolean;
  supportEmail?: string;
}
const actions: Record<IdentityEmailCategory, string> = {
  email_verification: 'Verify email address',
  invitation: 'Accept invitation',
  password_reset: 'Reset password',
  recall: 'Review recall notice',
  payment_reminder: 'Review payment',
  fee_statement: 'View fee statement',
  operations_alert: 'Open operations console',
};
const escape = (value: string): string =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!,
  );

export function brandedEmail(message: EmailMessage, options: EmailBrandOptions): EmailMessage {
  const origin = new URL(options.publicWebUrl);
  if (
    !['http:', 'https:'].includes(origin.protocol) ||
    origin.username ||
    origin.password ||
    (options.deployed && origin.protocol !== 'https:')
  )
    throw new Error('Invalid email public origin');
  const environment =
    options.environment === 'production'
      ? 'Production'
      : options.environment === 'staging'
        ? 'Staging - test message'
        : 'Local/demo - test message';
  // Only a URL on a line of its own is eligible as the template action. Never
  // auto-link arbitrary user-authored prose, external URLs or credentialed URLs.
  const lines = message.text.split(/\r?\n/);
  let action: URL | undefined;
  let actionIndex = -1;
  for (let index = lines.length - 1; index >= 0; index--) {
    try {
      const url = new URL(lines[index].trim());
      if (
        url.origin === origin.origin &&
        !url.username &&
        !url.password &&
        !url.hash &&
        ['http:', 'https:'].includes(url.protocol)
      ) {
        action = url;
        actionIndex = index;
        break;
      }
    } catch {
      /* ordinary text is displayed escaped */
    }
  }
  const support = options.supportEmail;
  if (support && !/^[^\s@<>"'\r\n]+@[^\s@<>"'\r\n]+\.[^\s@<>"'\r\n]+$/.test(support)) {
    throw new Error('Invalid email support address');
  }
  const purpose =
    'This automatic message relates to your BetterTrade account or a workflow involving your organization.';
  const credentialMessage = ['email_verification', 'invitation', 'password_reset'].includes(
    message.category,
  );
  const guidance = credentialMessage
    ? 'This link is time-limited. If it has expired, request a new message in BetterTrade. If this was unexpected, do not use the link or share it.'
    : 'Sign in to review the current record. This email does not confirm payment receipt, acknowledgement or completion of an action.';
  const body = lines
    .filter((_, index) => index !== actionIndex)
    .map((line) => escape(line))
    .join('<br>');
  const button = action
    ? `<p style="margin:28px 0"><a href="${escape(action.toString())}" style="display:inline-block;background:#14532d;color:#ffffff;padding:14px 22px;border-radius:6px;font-weight:bold;text-decoration:none">${escape(actions[message.category])}</a></p><p style="font-size:13px;color:#475569">Opens BetterTrade at <strong>${escape(action.host)}</strong>. Check this address before continuing.</p>`
    : '';
  const contact = support
    ? `Questions? Contact <a href="mailto:${escape(support)}">${escape(support)}</a>.`
    : 'Questions? Open BetterTrade using your usual address and use Help &amp; support. Do not reply to this automated message.';
  // Build from escaped text even if a caller provides HTML. All existing
  // transactional categories receive the same trusted wrapper and text fallback.
  return {
    ...message,
    text: `${message.text}\n\n${environment}\n${guidance}\n${support ? `Support: ${support}` : 'For help, open BetterTrade using your usual address and use Help & support.'}`,
    html: `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escape(message.subject)}</title></head><body style="margin:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#172033"><table role="presentation" style="width:100%;border-collapse:collapse"><tr><td style="padding:24px 12px"><table role="presentation" style="width:100%;max-width:600px;margin:auto;border-collapse:collapse;background:#ffffff"><tr><td style="background:#14532d;padding:24px;color:#ffffff"><span style="font-size:26px;font-weight:bold">BetterTrade</span><br><span style="font-size:13px">${escape(environment)}</span></td></tr><tr><td style="padding:28px 24px;line-height:1.6;overflow-wrap:anywhere;word-break:break-word"><h1 style="font-size:23px;line-height:1.3;margin-top:0">${escape(message.subject)}</h1><p style="font-size:13px;color:#475569">${purpose}</p><p>${body}</p>${button}<p style="font-size:13px;color:#475569">${guidance}</p><hr style="border:0;border-top:1px solid #e2e8f0"><p style="font-size:13px;color:#475569">${contact}</p></td></tr></table></td></tr></table></body></html>`,
  };
}
