export type ApiErrorEnvelope = {
  error: {
    code: string;
    message: string;
  };
};

export function apiError(code: string, message: string): ApiErrorEnvelope {
  return { error: { code, message } };
}

export class AdminHttpError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = "AdminHttpError";
    this.status = status;
    this.code = code;
  }
}
