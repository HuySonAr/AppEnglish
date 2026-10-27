import { NextAction } from '@appenglish/auth-contracts';
import { errorNextAction } from '../../../lib/api/response.js';

export function focusOnEnter(next) {
  return (event) => {
    if (event.key !== 'Enter' || event.nativeEvent?.isComposing) return;
    const target = document.getElementById(next);
    if (!target || target.value) return;
    event.preventDefault();
    target.focus();
  };
}

export function accountFromEnvelope(result) {
  return result?.data?.account ?? null;
}

export function dashboardPathForRole(role) {
  return `/${String(role).toLowerCase().replace('_', '-')}`;
}

export function accountHasRole(account, allowedRole) {
  return Boolean(account && account.role === allowedRole);
}

export function isVerificationRequiredError(error) {
  return errorNextAction(error) === NextAction.VERIFY_EMAIL;
}

export function registerOutcome(result) {
  if (result?.data?.nextAction === NextAction.VERIFY_EMAIL) return 'verify-email';
  return null;
}

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
