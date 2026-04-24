import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore } from '../authStore';

describe('authStore', () => {
  beforeEach(() => {
    useAuthStore.getState().clear();
  });

  it('starts empty and unauthenticated', () => {
    const s = useAuthStore.getState();
    expect(s.accessToken).toBeNull();
    expect(s.user).toBeNull();
    expect(s.isAuthenticated()).toBe(false);
    expect(s.hasRole('MEDECIN')).toBe(false);
  });

  it('setSession stores both token and user', () => {
    useAuthStore.getState().setSession('t-123', {
      id: 'u1',
      email: 'dr@cab.ma',
      firstName: 'Karim',
      lastName: 'El Amrani',
      roles: ['MEDECIN'],
    });
    const s = useAuthStore.getState();
    expect(s.accessToken).toBe('t-123');
    expect(s.user?.firstName).toBe('Karim');
    expect(s.isAuthenticated()).toBe(true);
    expect(s.hasRole('MEDECIN')).toBe(true);
    expect(s.hasRole('SECRETAIRE')).toBe(false);
  });

  it('setAccessToken updates the token without losing the user', () => {
    useAuthStore.getState().setSession('t1', {
      id: 'u1', email: 'x@y', firstName: 'X', lastName: 'Y', roles: ['SECRETAIRE'],
    });
    useAuthStore.getState().setAccessToken('t2');
    expect(useAuthStore.getState().accessToken).toBe('t2');
    expect(useAuthStore.getState().user?.id).toBe('u1');
  });

  it('clear wipes everything', () => {
    useAuthStore.getState().setSession('t', {
      id: 'u', email: 'x', firstName: 'x', lastName: 'x', roles: [],
    });
    useAuthStore.getState().clear();
    const s = useAuthStore.getState();
    expect(s.accessToken).toBeNull();
    expect(s.user).toBeNull();
    expect(s.isAuthenticated()).toBe(false);
  });
});
