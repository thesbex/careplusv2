import { describe, it, expect } from 'vitest';
import { AxiosError, AxiosHeaders } from 'axios';
import { toProblemDetail } from '../problemJson';

describe('toProblemDetail', () => {
  it('passes through a well-formed RFC 7807 body', () => {
    const err = new AxiosError('Bad Request', '400', undefined, null, {
      status: 422,
      statusText: 'Unprocessable',
      data: {
        title: 'Validation échouée',
        status: 422,
        detail: '1 champ invalide',
        violations: [{ field: 'email', message: 'Format incorrect' }],
      },
      headers: {},
      config: { headers: new AxiosHeaders() },
    });
    const p = toProblemDetail(err);
    expect(p.status).toBe(422);
    expect(p.title).toBe('Validation échouée');
    expect(p.violations?.[0]?.field).toBe('email');
  });

  it('fabricates a minimal ProblemDetail when the body is missing/malformed', () => {
    const err = new AxiosError('Network Error');
    const p = toProblemDetail(err);
    expect(p.status).toBe(0);
    expect(p.title).toBe('Erreur réseau');
    expect(p.detail).toBe('Network Error');
  });

  it('handles plain Error', () => {
    const p = toProblemDetail(new Error('Boom'));
    expect(p.title).toBe('Erreur');
    expect(p.detail).toBe('Boom');
  });

  it('handles non-error values', () => {
    const p = toProblemDetail('whatever');
    expect(p.title).toBe('Erreur inconnue');
    expect(p.status).toBe(0);
  });
});
