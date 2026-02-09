import { Resend } from 'resend';
import { env } from '$env/dynamic/private';

function getResend() {
	const apiKey = env.RESEND_API_KEY;
	if (!apiKey) {
		throw new Error('RESEND_API_KEY is not set');
	}
	return new Resend(apiKey);
}

interface SendMagicLinkEmailParams {
	to: string;
	magicLinkUrl: string;
	recipientName?: string;
	isInvite?: boolean;
}

export async function sendMagicLinkEmail({
	to,
	magicLinkUrl,
	recipientName,
	isInvite = false
}: SendMagicLinkEmailParams): Promise<{ success: boolean; error?: string }> {
	const resend = getResend();

	const subject = isInvite
		? "You're Invited: Boese West Coast Trip 2026"
		: 'Sign in to Boese Trip Planner';

	const greeting = recipientName ? `Hey ${recipientName}!` : 'Hey!';

	const bodyText = isInvite
		? "You've been invited to join the Boese West Coast Trip 2026. Click below to accept your invite and start planning."
		: 'Click the button below to sign in to the Boese Trip Planner.';

	const ctaText = isInvite ? 'Join the Trip' : 'Sign In';

	const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;">
        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#7c3aed,#a855f7);border-radius:16px 16px 0 0;padding:32px 24px;text-align:center;">
          <div style="font-size:28px;font-weight:700;color:#fff;letter-spacing:-0.5px;">Boese Trip 2026</div>
          <div style="font-size:14px;color:rgba(255,255,255,0.8);margin-top:4px;">Detroit → West Coast → Detroit</div>
        </td></tr>
        <!-- Body -->
        <tr><td style="background:#fff;padding:32px 24px;border-radius:0 0 16px 16px;">
          <div style="font-size:18px;font-weight:600;color:#18181b;margin-bottom:12px;">${greeting}</div>
          <div style="font-size:15px;color:#52525b;line-height:1.6;margin-bottom:28px;">${bodyText}</div>
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td align="center">
              <a href="${magicLinkUrl}" style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#a855f7);color:#fff;font-size:16px;font-weight:600;text-decoration:none;padding:14px 36px;border-radius:10px;">${ctaText}</a>
            </td></tr>
          </table>
          <div style="font-size:13px;color:#a1a1aa;margin-top:28px;line-height:1.5;">
            This link expires in 24 hours. If you didn't request this email, you can safely ignore it.
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`.trim();

	try {
		const { error } = await resend.emails.send({
			from: 'Boese Trip <onboarding@dylanreed.dev>',
			to,
			subject,
			html
		});

		if (error) {
			return { success: false, error: error.message };
		}

		return { success: true };
	} catch (err) {
		return { success: false, error: err instanceof Error ? err.message : 'Failed to send email' };
	}
}
