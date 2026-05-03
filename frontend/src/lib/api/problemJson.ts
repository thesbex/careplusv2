/**
 * RFC 7807 problem+json helpers.
 * careplus's `ma.careplus.shared.web.GlobalExceptionHandler` always returns
 * errors in this shape — the toast + form-error layers decode it once here.
 */
import type { AxiosError } from 'axios';
import { isAxiosError } from 'axios';

export interface Violation {
  field: string;
  message: string;
}

export interface ProblemDetail {
  type?: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  /** Field-level errors emitted by bean-validation failures (422). */
  violations?: Violation[];
}

export function toProblemDetail(err: unknown): ProblemDetail {
  if (isAxiosError(err)) {
    const e = err as AxiosError<ProblemDetail>;
    const body = e.response?.data;
    if (body && typeof body === 'object' && typeof body.title === 'string') {
      return body;
    }
    return {
      title: e.response?.statusText ?? 'Erreur réseau',
      status: e.response?.status ?? 0,
      ...(e.message ? { detail: e.message } : {}),
    };
  }
  if (err instanceof Error) {
    return { title: 'Erreur', status: 0, detail: err.message };
  }
  return { title: 'Erreur inconnue', status: 0 };
}
