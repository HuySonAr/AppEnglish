import nodemailer from 'nodemailer';

export class EmailService {
  constructor(transporter = null) {
    this.transporter =
      transporter ||
      nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_SECURE === 'true',
        auth: process.env.SMTP_USER
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
          : undefined,
      });
  }

  async sendOtp(email, code, purpose, context = {}) {
    if (!process.env.SMTP_HOST) {
      if (process.env.NODE_ENV === 'test') return;
      throw new Error('SMTP_HOST is not configured');
    }
    await this.transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: email,
      ...(purpose === 'INVITE' ? inviteMessage(email, code, context) : otpMessage(code, purpose)),
    });
  }
}

function otpMessage(code, purpose) {
  return {
    subject: purpose === 'VERIFY_EMAIL' ? 'Verify your AppEnglish email' : 'Reset your AppEnglish password',
    text: `Your AppEnglish code is ${code}. It expires in 5 minutes.`,
  };
}

export function inviteMessage(email, code, { role = 'STUDENT', displayName = '', expiresInHours = 72 } = {}) {
  const roleName = { STUDENT: 'a learner', CONTENT_MANAGER: 'a Content Manager', ADMIN: 'an administrator' }[role] || 'a member';
  const base = (process.env.WEB_APP_URL || '').replace(/\/+$/, '');
  const where = base ? `${base}/accept-invite?email=${encodeURIComponent(email)}` : 'the "Accept invitation" page of AppEnglish';
  const greeting = displayName ? `Hello ${displayName},` : 'Hello,';
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
      `The code is valid for ${expiresInHours} hours. If you did not expect this invitation, you can ignore this email.`,
    ].join('\n'),
  };
}
