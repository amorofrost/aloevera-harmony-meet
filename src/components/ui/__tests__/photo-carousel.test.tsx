import { render, screen, fireEvent } from '@testing-library/react';
import { PhotoCarousel } from '../photo-carousel';

describe('<PhotoCarousel>', () => {
  it('renders nothing when images is empty', () => {
    const { container } = render(<PhotoCarousel images={[]} mode="deck" />);
    expect(container.firstChild).toBeNull();
  });

  it('renders a single image without dots when only one image', () => {
    render(<PhotoCarousel images={['/a.jpg']} mode="deck" />);
    expect(screen.getByRole('img')).toHaveAttribute('src', '/a.jpg');
    expect(screen.queryByTestId('photo-carousel-dots')).toBeNull();
  });

  it('shows dots when more than one image', () => {
    render(<PhotoCarousel images={['/a.jpg', '/b.jpg']} mode="deck" />);
    const dots = screen.getByTestId('photo-carousel-dots');
    expect(dots.children).toHaveLength(2);
  });

  it('advances on right-half tap (deck mode)', () => {
    render(<PhotoCarousel images={['/a.jpg', '/b.jpg']} mode="deck" />);
    const right = screen.getByTestId('photo-carousel-tap-right');
    fireEvent.pointerDown(right, { clientX: 200 });
    fireEvent.pointerUp(right, { clientX: 200 });
    expect(screen.getByRole('img')).toHaveAttribute('src', '/b.jpg');
  });

  it('rewinds on left-half tap (deck mode)', () => {
    render(<PhotoCarousel images={['/a.jpg', '/b.jpg', '/c.jpg']} mode="deck" />);
    const right = screen.getByTestId('photo-carousel-tap-right');
    const left  = screen.getByTestId('photo-carousel-tap-left');
    fireEvent.pointerDown(right, { clientX: 200 });
    fireEvent.pointerUp(right, { clientX: 200 });
    fireEvent.pointerDown(left, { clientX: 50 });
    fireEvent.pointerUp(left, { clientX: 50 });
    expect(screen.getByRole('img')).toHaveAttribute('src', '/a.jpg');
  });

  it('does not advance if pointer moved more than 10px (treats as drag)', () => {
    render(<PhotoCarousel images={['/a.jpg', '/b.jpg']} mode="deck" />);
    const right = screen.getByTestId('photo-carousel-tap-right');
    fireEvent.pointerDown(right, { clientX: 200 });
    fireEvent.pointerMove(right, { clientX: 250 });
    fireEvent.pointerUp(right, { clientX: 250 });
    expect(screen.getByRole('img')).toHaveAttribute('src', '/a.jpg');
  });

  it('renders arrows in detail mode', () => {
    render(<PhotoCarousel images={['/a.jpg', '/b.jpg']} mode="detail" />);
    expect(screen.getByLabelText(/previous/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/next/i)).toBeInTheDocument();
    expect(screen.queryByTestId('photo-carousel-tap-right')).toBeNull();
  });

  it('shows next-hint in deck mode when more photos exist and hides it on the last photo', () => {
    render(<PhotoCarousel images={['/a.jpg', '/b.jpg']} mode="deck" />);
    expect(screen.getByTestId('photo-carousel-next-hint')).toBeInTheDocument();
    expect(screen.queryByTestId('photo-carousel-prev-hint')).toBeNull();

    const right = screen.getByTestId('photo-carousel-tap-right');
    fireEvent.pointerDown(right, { clientX: 200 });
    fireEvent.pointerUp(right, { clientX: 200 });

    expect(screen.queryByTestId('photo-carousel-next-hint')).toBeNull();
    expect(screen.getByTestId('photo-carousel-prev-hint')).toBeInTheDocument();
  });

  it('does not render hints in deck mode when there is only one image', () => {
    render(<PhotoCarousel images={['/a.jpg']} mode="deck" />);
    expect(screen.queryByTestId('photo-carousel-next-hint')).toBeNull();
    expect(screen.queryByTestId('photo-carousel-prev-hint')).toBeNull();
  });

  it('does not render hints in detail mode', () => {
    render(<PhotoCarousel images={['/a.jpg', '/b.jpg']} mode="detail" />);
    expect(screen.queryByTestId('photo-carousel-next-hint')).toBeNull();
    expect(screen.queryByTestId('photo-carousel-prev-hint')).toBeNull();
  });
});
