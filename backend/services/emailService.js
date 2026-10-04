const dns = require('dns');
const nodemailer = require('nodemailer');

dns.setDefaultResultOrder('ipv4first');

let transporter;

async function getTransporter() {
  if (transporter) return transporter;

  const user = process.env.GMAIL_USER?.trim();
  const pass = process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, '');
  if (!user || !pass) {
    throw new Error('GMAIL_USER or GMAIL_APP_PASSWORD is not set in environment variables.');
  }

  // Render has no working IPv6 route to Gmail. Connecting to an IPv4 address
  // avoids ENETUNREACH on smtp.gmail.com:465.
  const addresses = await dns.promises.resolve4('smtp.gmail.com');
  transporter = nodemailer.createTransport({
    host: addresses[0],
    port: 587,
    secure: false,
    requireTLS: true,
    auth: { user, pass },
    tls: { servername: 'smtp.gmail.com' },
    connectionTimeout: 20000,
    greetingTimeout: 20000,
    socketTimeout: 30000,
  });
  return transporter;
}

/**
 * Send a security alert email when an incorrect recovery code is entered.
 * Triggers the 30-minute account lockout notification.
 * @param {string} email - the user's email address
 */
async function sendLockoutAlert(email) {
  const mailer = await getTransporter();
  await mailer.sendMail({
    from: `"SecureBank Security" <${process.env.GMAIL_USER}>`,
    to: email,
    subject: '⚠️ Security Alert: Failed Recovery Attempt on Your Account',
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 24px;">
        <h2 style="color: #dc2626;">⚠️ Security Alert</h2>
        <p>An incorrect emergency recovery code was entered for the account associated with this email address.</p>
        <p>As a protective measure, <strong>your account has been temporarily locked for 30 minutes</strong>.</p>
        <p>If this was you, please wait 30 minutes and try again with your correct recovery code.</p>
        <p>If this was <strong>not</strong> you, your account may be under attack. Please contact support immediately.</p>
        <hr style="margin: 24px 0;" />
        <p style="color: #6b7280; font-size: 12px;">SecureBank Security Team — This is an automated message, do not reply.</p>
      </div>
    `,
  });
}

/**
 * Send a magic-link verification email.
 * The user clicks the link to confirm their mailbox is real.
 * @param {string} email - recipient address
 * @param {string} verifyUrl - the full verification URL with token
 */
async function sendVerificationEmail(email, verifyUrl) {
  let mailer;
  try {
    mailer = await getTransporter();
  } catch (err) {
    console.error('❌ Verification email not sent:', err.message);
    throw err;
  }
  try {
    await mailer.sendMail({
      from: `"SecureBank Security" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: '✅ Verify your SecureBank email address',
      html: `
        <div style="font-family: 'Inter', -apple-system, sans-serif; max-width: 560px; margin: auto; background: #0f172a; border-radius: 16px; overflow: hidden;">
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%); padding: 40px 40px 32px; text-align: center;">
            <div style="display: inline-flex; align-items: center; justify-content: center; width: 56px; height: 56px; background: rgba(59,130,246,0.15); border-radius: 14px; margin-bottom: 16px;">
              <span style="font-size: 28px;">🔐</span>
            </div>
            <h1 style="color: #f1f5f9; font-size: 22px; font-weight: 700; margin: 0;">SecureBank</h1>
            <p style="color: #94a3b8; font-size: 13px; margin: 6px 0 0;">Biometric Authentication Platform</p>
          </div>

          <!-- Body -->
          <div style="padding: 36px 40px;">
            <h2 style="color: #f1f5f9; font-size: 18px; font-weight: 600; margin: 0 0 12px;">Verify your email address</h2>
            <p style="color: #94a3b8; font-size: 14px; line-height: 1.6; margin: 0 0 8px;">
              We received a request to verify <strong style="color: #e2e8f0;">${email}</strong> for a new SecureBank account.
            </p>
            <p style="color: #94a3b8; font-size: 14px; line-height: 1.6; margin: 0 0 32px;">
              Click the button below to confirm this is your email address and continue registration.
            </p>

            <!-- CTA Button -->
            <div style="text-align: center; margin-bottom: 32px;">
              <a href="${verifyUrl}"
                 style="display: inline-block; background: #3b82f6; color: #ffffff; font-size: 15px; font-weight: 600;
                        text-decoration: none; padding: 14px 36px; border-radius: 10px; letter-spacing: 0.01em;">
                ✓ &nbsp;Verify my email address
              </a>
            </div>

            <p style="color: #64748b; font-size: 12px; line-height: 1.6; margin: 0 0 8px;">
              This link expires in <strong>15 minutes</strong> and can only be used once.
            </p>
            <p style="color: #64748b; font-size: 12px; line-height: 1.6; margin: 0;">
              If you did not request this, you can safely ignore this email. No account will be created.
            </p>
          </div>

          <!-- Footer -->
          <div style="border-top: 1px solid #1e293b; padding: 20px 40px; text-align: center;">
            <p style="color: #475569; font-size: 11px; margin: 0;">
              SecureBank Security Team &mdash; Do not reply to this email.
            </p>
          </div>
        </div>
      `,
    });
  } catch (err) {
    console.error('❌ Failed to send verification email (Nodemailer error):', err.message);
    
    // In development, if the credentials aren't set up yet, we don't throw, 
    // because the terminal printed the magic link and we want them to test using that link.
    if (err.message.includes('Invalid login') || err.message.includes('GMAIL_USER')) {
      console.warn('⚠️  Skipping email dispatch: Gmail credentials not configured. Use the link printed above.');
      return;
    }
    throw err;
  }
}

/**
 * Send an OTP code for resetting the S-PIN.
 * @param {string} email - recipient address
 * @param {string} otp - 6 digit code
 */
async function sendSPINResetEmail(email, otp) {
  const mailer = await getTransporter();
  try {
    await mailer.sendMail({
      from: `"SecureBank Security" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: '🔐 Your S-PIN Reset Code',
      html: `
        <div style="font-family: 'Inter', -apple-system, sans-serif; max-width: 560px; margin: auto; background: #0f172a; border-radius: 16px; overflow: hidden;">
          <div style="padding: 36px 40px;">
            <h2 style="color: #f1f5f9; font-size: 18px;">Reset your S-PIN</h2>
            <p style="color: #94a3b8; font-size: 14px; margin-bottom: 32px;">
              You requested to reset your S-PIN. Please use the 6-digit verification code below to securely set your new S-PIN.
            </p>
            <div style="text-align: center; margin-bottom: 32px;">
              <div style="display: inline-block; background: #1e293b; border: 2px solid #3b82f6; border-radius: 12px; padding: 16px 32px;">
                <span style="font-size: 32px; font-weight: bold; color: #f1f5f9; letter-spacing: 0.25em;">${otp}</span>
              </div>
            </div>
            <p style="color: #64748b; font-size: 12px;">This code expires in 10 minutes. If you did not request this, please ignore this email.</p>
          </div>
        </div>
      `,
    });
  } catch (err) {
    console.error('❌ Failed to send OTP email:', err.message);
    if (err.message.includes('Invalid login') || err.message.includes('GMAIL_USER')) {
      console.warn(`⚠️  OTP for ${email} is: ${otp}`);
      return;
    }
    throw err;
  }
}

module.exports = { sendLockoutAlert, sendVerificationEmail, sendSPINResetEmail };
