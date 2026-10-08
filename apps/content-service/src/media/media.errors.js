export class MediaValidationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'MediaValidationError';
    this.code = code;
    this.status = 400;
  }
}
