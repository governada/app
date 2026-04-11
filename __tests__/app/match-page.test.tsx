import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const homePageShellMock = vi.fn(
  ({ match, pageViewEvent }: { match?: boolean; pageViewEvent?: string }) => (
    <div
      data-testid="home-page-shell"
      data-match={String(Boolean(match))}
      data-page-view-event={pageViewEvent}
    />
  ),
);

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('@/components/hub/HomePageShell', () => ({
  HomePageShell: homePageShellMock,
}));

const { default: MatchPage } = await import('@/app/match/page');

describe('MatchPage', () => {
  it('renders the shared home shell with a stable match entry surface', () => {
    render(<MatchPage />);

    expect(homePageShellMock).toHaveBeenCalledWith(
      {
        match: true,
        pageViewEvent: 'match_page_viewed',
      },
      undefined,
    );
    expect(screen.getByRole('heading', { name: 'Find Your Match' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Start Match' }).getAttribute('href')).toBe(
      '/?match=true',
    );
    expect(screen.getByRole('link', { name: 'Browse DReps' }).getAttribute('href')).toBe(
      '/?filter=dreps',
    );
    expect(screen.getByTestId('home-page-shell').getAttribute('data-match')).toBe('true');
    expect(screen.getByTestId('home-page-shell').getAttribute('data-page-view-event')).toBe(
      'match_page_viewed',
    );
  });
});
