const BRAND = '#4F46E5';
const INK = '#111827';
const MUTED = '#6B7280';
const LINE = '#E5E7EB';
const PAGE = '#F3F4F8';
const TINT = '#EEF0FF';
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const MONO = "'SF Mono',SFMono-Regular,Menlo,Consolas,'Liberation Mono',monospace";

const OTP_COPY = {
  VERIFY_EMAIL: {
    subject: 'Your AppEnglish verification code',
    eyebrow: 'Email verification',
    title: 'Confirm your email',
    intro: 'Enter this code on AppEnglish to finish creating your account.',
    ignore: 'If you did not sign up, you can ignore this email.',
  },
  RESET_PASSWORD: {
    subject: 'Your AppEnglish password reset code',
    eyebrow: 'Password reset',
    title: 'Reset your password',
    intro: 'Enter this code on AppEnglish to choose a new password.',
    ignore: 'If you did not ask to reset your password, you can ignore this email. Your password stays the same.',
  },
};

const ROLE_NAMES = { STUDENT: 'a learner', CONTENT_MANAGER: 'a Content Manager', TEACHER: 'a teacher', ADMIN: 'an administrator' };

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

function webAppUrl() {
  return (process.env.WEB_APP_URL || '').replace(/\/+$/, '');
}

function codeBlock(code) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:28px 0 12px">
  <tr><td align="center" style="background:${TINT};border:1px solid #D9DBFB;border-radius:18px;padding:22px 12px">
    <div style="font-family:${FONT};font-size:12px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;color:${MUTED};margin-bottom:10px">Your code</div>
    <div style="font-family:${MONO};font-size:36px;line-height:44px;font-weight:700;letter-spacing:12px;padding-left:12px;color:${BRAND}">${escapeHtml(code)}</div>
  </td></tr>
</table>`;
}

function button(href, label) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px auto 4px">
  <tr><td align="center" style="border-radius:999px;background:${BRAND}">
    <a href="${escapeHtml(href)}" style="display:inline-block;padding:14px 32px;font-family:${FONT};font-size:15px;font-weight:600;color:#FFFFFF;text-decoration:none;border-radius:999px">${escapeHtml(label)}</a>
  </td></tr>
</table>`;
}

function layout({ preheader, eyebrow, title, body, ignore }) {
  const year = new Date().getFullYear();
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:${PAGE};-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${escapeHtml(preheader)}</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${PAGE}">
  <tr><td align="center" style="padding:40px 16px">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:520px">
      <tr><td style="padding:0 8px 20px">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
          <td width="36" height="36" align="center" valign="middle" style="width:36px;height:36px;background:${BRAND};border-radius:11px;font-family:${FONT};font-size:18px;font-weight:700;color:#FFFFFF">A</td>
          <td style="padding-left:10px;font-family:${FONT};font-size:18px;font-weight:700;letter-spacing:-0.2px;color:${INK}">AppEnglish</td>
        </tr></table>
      </td></tr>
      <tr><td style="background:#FFFFFF;border:1px solid ${LINE};border-radius:28px;padding:40px 36px">
        <div style="display:inline-block;background:${TINT};color:${BRAND};border-radius:999px;padding:6px 14px;font-family:${FONT};font-size:12px;font-weight:600">${escapeHtml(eyebrow)}</div>
        <h1 style="margin:18px 0 10px;font-family:${FONT};font-size:26px;line-height:32px;font-weight:700;letter-spacing:-0.4px;color:${INK}">${escapeHtml(title)}</h1>
        ${body}
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:28px;border-top:1px solid ${LINE}">
          <tr><td style="padding-top:20px;font-family:${FONT};font-size:13px;line-height:20px;color:${MUTED}">${escapeHtml(ignore)}</td></tr>
        </table>
      </td></tr>
      <tr><td align="center" style="padding:24px 8px 0;font-family:${FONT};font-size:12px;line-height:18px;color:#9CA3AF">
        Learn English, one step a day.<br>&copy; ${year} AppEnglish
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

function paragraph(text) {
  return `<p style="margin:0;font-family:${FONT};font-size:15px;line-height:24px;color:#374151">${text}</p>`;
}

function note(text) {
  return `<p style="margin:0;text-align:center;font-family:${FONT};font-size:13px;line-height:20px;color:${MUTED}">${text}</p>`;
}

export function otpMessage(code, purpose, { expiresInMinutes = 5 } = {}) {
  const copy = OTP_COPY[purpose] || OTP_COPY.VERIFY_EMAIL;
  const expiry = `The code expires in ${expiresInMinutes} minutes. Never share it with anyone.`;
  return {
    subject: copy.subject,
    text: [copy.title, '', copy.intro, '', `    ${code}`, '', expiry, '', copy.ignore].join('\n'),
    html: layout({
      preheader: `Your code is ${code}. It expires in ${expiresInMinutes} minutes.`,
      eyebrow: copy.eyebrow,
      title: copy.title,
      body: paragraph(escapeHtml(copy.intro)) + codeBlock(code) + note(escapeHtml(expiry)),
      ignore: copy.ignore,
    }),
  };
}

export function inviteMessage(email, code, { role = 'STUDENT', displayName = '', expiresInHours = 72 } = {}) {
  const roleName = ROLE_NAMES[role] || 'a member';
  const base = webAppUrl();
  const link = base ? `${base}/accept-invite?email=${encodeURIComponent(email)}` : '';
  const where = link || 'the "Accept invitation" page of AppEnglish';
  const greeting = displayName ? `Hello ${displayName},` : 'Hello,';
  const ignore = 'If you did not expect this invitation, you can ignore this email.';
  const expiry = `The code is valid for ${expiresInHours} hours.`;
  return {
    subject: 'You are invited to AppEnglish',
    text: [
      greeting,
      '',
      `You have been invited to AppEnglish as ${roleName}.`,
      `Open ${where} and enter this invitation code to choose your password:`,
      '',
      `    ${code}`,
      '',
      `${expiry} ${ignore}`,
    ].join('\n'),
    html: layout({
      preheader: `You have been invited to AppEnglish as ${roleName}.`,
      eyebrow: 'Invitation',
      title: 'You are invited',
      body:
        paragraph(`${escapeHtml(greeting)}<br>You have been invited to AppEnglish as <strong style="color:${INK}">${escapeHtml(roleName)}</strong>. Use this code to choose your password.`) +
        codeBlock(code) +
        note(escapeHtml(expiry)) +
        (link ? `<div style="height:20px"></div>${button(link, 'Accept invitation')}` : ''),
      ignore,
    }),
  };
}
