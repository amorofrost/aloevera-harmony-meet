import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '@/test/utils';
import { UserBadges } from '@/components/ui/user-badges';

describe('<UserBadges />', () => {
  it('renders nothing for novice with no staff role', () => {
    const { container } = renderWithProviders(
      <UserBadges rank="novice" staffRole="none" />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders rank for activeMember', () => {
    renderWithProviders(<UserBadges rank="activeMember" staffRole="none" />);
    expect(screen.getByText('rank.activeMember')).toBeInTheDocument();
  });

  it('renders both rank and staff role', () => {
    renderWithProviders(<UserBadges rank="aloeCrew" staffRole="admin" />);
    expect(screen.getByText('rank.aloeCrew')).toBeInTheDocument();
    expect(screen.getByText('staffRole.admin')).toBeInTheDocument();
  });

  it('renders only staff when rank is novice but role is moderator', () => {
    renderWithProviders(<UserBadges rank="novice" staffRole="moderator" />);
    expect(screen.queryByText('rank.novice')).not.toBeInTheDocument();
    expect(screen.getByText('staffRole.moderator')).toBeInTheDocument();
  });
});
