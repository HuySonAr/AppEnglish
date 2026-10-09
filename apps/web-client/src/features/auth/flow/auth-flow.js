import { NextAction } from '@appenglish/auth-contracts';
import { errorNextAction } from '../../../lib/api/response.js';

// auth-api.js returns the parsed response body (the envelope { code, msg, data }),
// not the raw axios response. Account payloads therefore live at
// envelope.data.account; passing the envelope to responseData() reads
// envelope.data.data and silently yields undefined — that mismatch left the app
// "authenticated" with no account and triggered the 403 Access-denied page.
export function accountFromEnvelope(result) {
  return result?.data?.account ?? null;
}

export function dashboardPathForRole(role) {
  return `/${String(role).toLowerCase().replace('_', '-')}`;
}

export function accountHasRole(account, allowedRole) {
  return Boolean(account && account.role === allowedRole);
}

// The backend only sends nextAction VERIFY_EMAIL on login after the email and
// password matched and the account is PENDING_VERIFICATION (code 13); wrong
// credentials stay AUTH_INVALID_CREDENTIALS without a nextAction.
export function isVerificationRequiredError(error) {
  return errorNextAction(error) === NextAction.VERIFY_EMAIL;
}

// A register response with nextAction VERIFY_EMAIL (new or still-pending
// account) means the next screen is the OTP page with this email prefilled.
export function registerOutcome(result) {
  if (result?.data?.nextAction === NextAction.VERIFY_EMAIL) return 'verify-email';
  return null;
}

// Runs the two steps of OTP verification as one outcome: verify the OTP (the
// backend activates the account and creates the cookie session), then load that
// session into client state via /auth/me. Outcomes:
// - thrown error: the verify step failed (invalid/expired/rate-limited OTP);
// - alreadyVerified: the account was already ACTIVE, the backend returned
//   nextAction LOGIN and no session was created;
// - restoredAccount null: verification succeeded but the session could not be
//   loaded afterwards.
export async function verifyOtpAndRestoreSession({ verifyEmail, restoreSession }) {
  const result = await verifyEmail();
  if (result?.data?.nextAction === NextAction.LOGIN) {
    return { alreadyVerified: true, account: null, restoredAccount: null };
  }
  const account = accountFromEnvelope(result);
  if (!account?.role) {
    throw new Error('Verify-email response did not include an account');
  }
  const restoredAccount = await restoreSession();
  return { alreadyVerified: false, account, restoredAccount };
}
