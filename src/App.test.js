import { render, screen } from '@testing-library/react';
import App from './App';

test('renders the device report and browser access note', async () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: /your device, in detail/i })).toBeInTheDocument();
  expect(screen.getByText(/browser-limited report/i)).toBeInTheDocument();
  expect(await screen.findByRole('button', { name: /refresh/i })).toBeInTheDocument();
});
