import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import AgendaMobilePage from '../AgendaPage.mobile';

function renderMobileAgenda() {
  const router = createMemoryRouter(
    [
      { path: '/agenda', element: <AgendaMobilePage /> },
      { path: '/salle', element: <div>Salle</div> },
    ],
    { initialEntries: ['/agenda'] },
  );
  return render(<RouterProvider router={router} />);
}

describe('<AgendaMobilePage />', () => {
  it('renders the mobile shell with brand topbar and bottom tabs', () => {
    const { container } = renderMobileAgenda();
    expect(container.querySelector('.mt-brand-name')).toHaveTextContent('careplus');
    expect(screen.getByRole('navigation', { name: 'Navigation mobile' })).toBeInTheDocument();
  });

  it('renders a 7-day tab strip with Jeudi selected', () => {
    renderMobileAgenda();
    const tablist = screen.getByRole('tablist', { name: 'Jour' });
    expect(tablist).toBeInTheDocument();
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(7);
    const selected = tabs.find((t) => t.getAttribute('aria-selected') === 'true');
    expect(selected).toHaveTextContent('Jeu');
    expect(selected).toHaveTextContent('24');
  });

  it('renders the day section heading and 6 timeline blocks', () => {
    renderMobileAgenda();
    expect(screen.getByText('Jeudi 24 avril · 6 rendez-vous')).toBeInTheDocument();
    ['Laila Bouhlal', 'Ahmed Cherkaoui', 'Youness Alaoui', 'Khadija Tahiri', 'Sanae Kettani', 'Driss Benkirane'].forEach(
      (name) => expect(screen.getByText(name)).toBeInTheDocument(),
    );
  });

  it('renders the allergy chip for the Aspirine patient', () => {
    renderMobileAgenda();
    expect(screen.getByText('Aspirine')).toBeInTheDocument();
  });

  it('renders the FAB for new RDV', () => {
    renderMobileAgenda();
    expect(screen.getByRole('button', { name: 'Nouveau RDV' })).toBeInTheDocument();
  });

  it('has no a11y violations', async () => {
    const { container } = renderMobileAgenda();
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
