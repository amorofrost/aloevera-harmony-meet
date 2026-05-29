import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GaugeBandChart } from '../GaugeBandChart';

describe('GaugeBandChart', () => {
  it('shows an empty state when there are no points', () => {
    render(<GaugeBandChart points={[]} />);
    expect(screen.getByText('No data.')).toBeInTheDocument();
  });
});
