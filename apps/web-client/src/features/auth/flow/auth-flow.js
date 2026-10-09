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

// Runs the two steps of OTP verification as one outcome: verify the OTP (the
// backend activates the account and creates the cookie session), then load that
// session into client state via /auth/me. A thrown error means the verify step
// failed; a null restoredAccount means the session could not be loaded after a
// successful verification.
export async function verifyOtpAndRestoreSession({ verifyEmail, restoreSession }) {
  const result = await verifyEmail();
  const account = accountFromEnvelope(result);
  if (!account?.role) {
    throw new Error('Verify-email response did not include an account');
  }
  const restoredAccount = await restoreSession();
  return { account, restoredAccount };
}
