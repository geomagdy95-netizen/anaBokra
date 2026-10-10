export type AssessmentErrorCode =
  | 'unauthenticated'
  | 'forbidden'
  | 'invalid_json'
  | 'invalid_input'
  | 'invalid_station'
  | 'invalid_item'
  | 'invalid_value'
  | 'values_limit_exceeded'
  | 'not_found'
  | 'not_student'
  | 'consent_required'
  | 'session_closed'
  | 'session_paused'
  | 'station_incomplete'
  | 'insufficient_data'
  | 'instrument_version_mismatch'
  | 'server_error';

export const ERROR_STATUS: Record<AssessmentErrorCode, number> = {
  unauthenticated: 401,
  forbidden: 403,
  invalid_json: 400,
  invalid_input: 400,
  invalid_station: 400,
  invalid_item: 422,
  invalid_value: 422,
  values_limit_exceeded: 422,
  not_found: 404,
  not_student: 403,
  consent_required: 403,
  session_closed: 409,
  session_paused: 409,
  station_incomplete: 409,
  insufficient_data: 409,
  instrument_version_mismatch: 409,
  server_error: 500,
};

/** Expected, client-facing failure. Everything else is a 500 `server_error`. */
export class AssessmentError extends Error {
  constructor(
    readonly code: AssessmentErrorCode,
    message?: string,
    readonly details?: unknown,
  ) {
    super(message ?? code);
    this.name = 'AssessmentError';
  }
}

/** Repository signals (mapped to AssessmentError by the service). */
export class RepoConflictError extends Error {
  constructor(message = 'conflict') {
    super(message);
    this.name = 'RepoConflictError';
  }
}
export class RepoForbiddenError extends Error {
  constructor(message = 'forbidden') {
    super(message);
    this.name = 'RepoForbiddenError';
  }
}
