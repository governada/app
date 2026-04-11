import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const matchExperienceClientMock = vi.fn(() => <div data-testid="match-experience-client" />);

vi.mock('@/app/match/MatchExperienceClient', () => ({
  MatchExperienceClient: matchExperienceClientMock,
}));

const { default: MatchPage } = await import('@/app/match/page');

describe('MatchPage', () => {
  it('renders the dedicated public match experience', () => {
    render(<MatchPage />);

    expect(matchExperienceClientMock).toHaveBeenCalledOnce();
    expect(screen.getByTestId('match-experience-client')).not.toBeNull();
  });
});
