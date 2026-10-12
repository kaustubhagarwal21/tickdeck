import { render, screen } from '@testing-library/react';
import { useMarketStore } from '@/store/marketStore';
import { FeedErrorBanner } from '../FeedErrorBanner';
import { Header } from '../Header';

beforeEach(() => {
  useMarketStore.setState(useMarketStore.getInitialState(), true);
});

describe('Header', () => {
  test('marks the running feed as current and shows the connection status', () => {
    useMarketStore.setState({ feedKind: 'simulated', status: 'open', symbols: ['TCS'] });
    render(<Header />);

    const simulated = screen.getByRole('link', { name: 'Simulated · NSE-style' });
    const live = screen.getByRole('link', { name: 'Live · Binance' });
    expect(simulated).toHaveAttribute('aria-current', 'page');
    expect(simulated).toHaveAttribute('href', '/?feed=sim');
    expect(live).not.toHaveAttribute('aria-current');
    expect(live).toHaveAttribute('href', '/?feed=binance');

    expect(screen.getByRole('status')).toHaveTextContent('Market feed: Connected');
  });

  test('marks no feed as current before a feed has started', () => {
    render(<Header />);

    expect(screen.getByRole('link', { name: 'Live · Binance' })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('link', { name: 'Simulated · NSE-style' })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('status')).toHaveTextContent('Market feed: Connecting');
  });
});

describe('FeedErrorBanner', () => {
  test('stays hidden while the feed is healthy', () => {
    useMarketStore.setState({ feedKind: 'binance', status: 'open', symbols: ['BTCUSDT'] });
    render(<FeedErrorBanner />);

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  test('explains a feed error and offers a retry link', () => {
    useMarketStore.setState({ feedKind: 'binance', status: 'error', symbols: ['BTCUSDT'] });
    render(<FeedErrorBanner />);

    expect(screen.getByRole('alert')).toHaveTextContent('The Binance feed stopped sending prices');
    expect(screen.getByRole('link', { name: 'Retry' })).toHaveAttribute('href', '/?feed=binance');
  });
});
