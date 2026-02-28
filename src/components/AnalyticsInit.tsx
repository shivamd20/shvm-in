import { useEffect } from 'react';
import { initClarity } from '@/lib/clarity';
import { mixpanelService, MixpanelEvents } from '@/lib/mixpanel';

/**
 * Client-only: initializes Microsoft Clarity and Mixpanel.
 * Mount once at app root so analytics run on every page.
 */
export function AnalyticsInit() {
  useEffect(() => {
    initClarity();
    mixpanelService.init();
    mixpanelService.track(MixpanelEvents.APP_OPEN);
  }, []);
  return null;
}
