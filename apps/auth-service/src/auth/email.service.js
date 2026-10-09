import nodemailer from 'nodemailer';

export class EmailService {
  constructor(transporter = null) {
    this.transporter = transporter || nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined
    });
  }

  async sendOtp(email, code, purpose) {
    if (!process.env.SMTP_HOST) {
      if (process.env.NODE_ENV === 'test') return;
      throw new Error('SMTP_HOST is not configured');
    }
    await this.transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: email,
      subject: purpose === 'VERIFY_EMAIL' ? 'Verify your AppEnglish email' : 'Reset your AppEnglish password',
      text: `Your AppEnglish code is ${code}. It expires in 5 minutes.`
    });
  }
}
