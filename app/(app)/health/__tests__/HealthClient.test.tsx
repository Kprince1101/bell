import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { HealthClient } from '@/app/(app)/health/HealthClient';
import { buildHealthPanel } from '@/lib/health/panel';
import { fetchHealthPanel } from '@/lib/healthApi';
import { HEALTH_NOW, fullEnv, greenReport } from '@/test-utils/healthFixtures';

vi.mock('@/lib/healthApi', () => ({ fetchHealthPanel: vi.fn() }));

const GREEN = buildHealthPanel(greenReport(), fullEnv(), HEALTH_NOW);

const redReport = () => {
  const report = greenReport();
  report.cron.job = null;
  return report;
};

describe('HealthClient', () => {
  it('shows every section and says all green', () => {
    render(<HealthClient panel={GREEN} />);

    expect(screen.getByText('All green.')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Scheduler' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'App secrets (names only)' }),
    ).toBeInTheDocument();
    expect(screen.getByText('pg_cron job bell-notify')).toBeInTheDocument();
    expect(screen.getByText('Work (me@example.com)')).toBeInTheDocument();
    expect(screen.queryAllByRole('img', { name: 'Needs attention' })).toEqual(
      [],
    );
  });

  it('marks red checks and counts them', () => {
    render(
      <HealthClient
        panel={buildHealthPanel(redReport(), fullEnv(), HEALTH_NOW)}
      />,
    );

    expect(screen.getByText('1 check is red.')).toBeInTheDocument();
    expect(screen.getByText('No job named bell-notify.')).toBeInTheDocument();
    expect(
      screen.getAllByRole('img', { name: 'Needs attention' }),
    ).toHaveLength(1);
  });

  it('checks again on demand', async () => {
    vi.mocked(fetchHealthPanel).mockResolvedValue(
      buildHealthPanel(redReport(), fullEnv(), HEALTH_NOW),
    );
    render(<HealthClient panel={GREEN} />);

    fireEvent.click(screen.getByRole('button', { name: 'Check again' }));

    await waitFor(() =>
      expect(screen.getByText('1 check is red.')).toBeInTheDocument(),
    );
    expect(fetchHealthPanel).toHaveBeenCalledTimes(1);
  });

  it('says so when checking again fails', async () => {
    vi.mocked(fetchHealthPanel).mockRejectedValue(new Error('Forbidden'));
    render(<HealthClient panel={GREEN} />);

    fireEvent.click(screen.getByRole('button', { name: 'Check again' }));

    await waitFor(() =>
      expect(screen.getByText('Forbidden')).toBeInTheDocument(),
    );
    expect(screen.getByText('All green.')).toBeInTheDocument();
  });
});
