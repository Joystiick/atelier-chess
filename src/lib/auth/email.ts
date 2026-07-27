import { Resend } from "resend";

export async function sendPasswordResetEmail(opts: {
  to: string;
  username: string;
  resetUrl: string;
}): Promise<{ ok: boolean; previewUrl?: string; error?: string }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    // Dev / unconfigured: caller can surface the link
    return { ok: true, previewUrl: opts.resetUrl };
  }

  const resend = new Resend(key);
  const from =
    process.env.RESEND_FROM_EMAIL || "Atelier Chess <onboarding@resend.dev>";
  const { error } = await resend.emails.send(
    {
      from,
      to: [opts.to],
      subject: "Reset your Atelier Chess password",
      html: `<p>Hi ${opts.username},</p>
<p>Reset your password with this link (expires in 1 hour):</p>
<p><a href="${opts.resetUrl}">${opts.resetUrl}</a></p>
<p>If you did not ask for this, ignore this email.</p>`,
    },
    { idempotencyKey: `pw-reset/${opts.to}/${Date.now()}` },
  );

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
