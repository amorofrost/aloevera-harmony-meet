import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RequestCountChart } from '../RequestCountChart';

describe('RequestCountChart', () => {
  it('shows an empty state when there are no points', () => {
    render(<RequestCountChart points={[]} />);
    expect(screen.getByText('No request data.')).toBeInTheDocument();
  });
});
