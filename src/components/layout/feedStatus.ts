import type { FeedStatus } from '@/lib/types';

/** How each feed status reads on screen. Shared by the header pill and the status bar. */
export const FEED_STATUS_TEXT: Record<FeedStatus, string> = {
  connecting: 'Connecting',
  open: 'Connected',
  closed: 'Disconnected',
  error: 'Feed error',
};
