import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import LoginPage from '../LoginPage';

function renderLogin() {
  const router = createMemoryRouter([{ path: '/login', element: <LoginPage /> }], {
    initialEntries: ['/login'],
  });
  return render(<RouterProvider router={router} />);
}

describe('<LoginPage />', () => {
  it('renders the bilingual hero + form with the right copy', () => {
    renderLogin();

    // Hero
    expect(screen.getByText('careplus')).toBeInTheDocument();
    expect(screen.getByText(/La gestion de votre cabinet/)).toBeInTheDocument();
    expect(screen.getByText('simplement.')).toBeInTheDocument();
    expect(screen.getByText('184')).toBeInTheDocument();
    expect(screen.getByText('62k')).toBeInTheDocument();
    expect(screen.getByText('99,98%')).toBeInTheDocument();
    expect(screen.getByText(/Conforme loi 09-08/)).toBeInTheDocument();

    // Form
    expect(screen.getByText('Connexion professionnelle')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Bon retour, docteur.' })).toBeInTheDocument();
    expect(screen.getByLabelText('Adresse email')).toHaveValue('f.benjelloun@cab-elamrani.ma');
    expect(screen.getByLabelText('Mot de passe')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Garder ma session/ })).toBeChecked();
    expect(screen.getByRole('link', { name: 'Mot de passe oublié ?' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Se connecter/ })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Connexion par code SMS envoyé au cabinet/ }),
    ).toBeInTheDocument();
  });

  it('toggles password visibility when the eye button is clicked', async () => {
    const user = userEvent.setup();
    renderLogin();

    const password = screen.getByLabelText('Mot de passe') as HTMLInputElement;
    expect(password.type).toBe('password');

    const toggle = screen.getByRole('button', { name: 'Afficher le mot de passe' });
    await user.click(toggle);

    expect(password.type).toBe('text');
    expect(
      screen.getByRole('button', { name: 'Masquer le mot de passe' }),
    ).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderLogin();
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
