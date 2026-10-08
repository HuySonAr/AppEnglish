export class ZodValidationPipe {
  constructor(schema) {
    this.schema = schema;
  }

  transform(value) {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      const error = new Error('Request validation failed');
      error.status = 400;
      error.issues = result.error.issues;
      throw error;
    }
    return result.data;
  }
}
