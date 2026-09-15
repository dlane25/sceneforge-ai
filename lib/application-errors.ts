export class InvalidStateError extends Error {
  readonly code = 'INVALID_STATE';
  readonly status = 409;

  constructor(message = 'The requested operation is not valid in the current state') {
    super(message);
    this.name = 'InvalidStateError';
  }
}
