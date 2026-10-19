import { ProgressResponseCode } from '@appenglish/progress-contracts';

export class ProgressError extends Error {
  constructor(code, message, status = 400, data = {}) {
    super(message);
    this.name = 'ProgressError';
    this.code = code;
    this.status = status;
    this.data = data;
  }
}

export const progressErrors = Object.freeze({
  forbiddenRole: () =>
    new ProgressError(ProgressResponseCode.FORBIDDEN_ROLE, 'Account does not have the required role', 403),
});
