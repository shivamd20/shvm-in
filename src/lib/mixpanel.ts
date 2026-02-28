import mixpanel, { Config, Dict } from 'mixpanel-browser';

const MIXPANEL_TOKEN = import.meta.env.VITE_MIXPANEL_TOKEN || 'YOUR_MIXPANEL_TOKEN';

const config: Partial<Config> = {
  debug: import.meta.env.DEV,
  track_pageview: true,
  persistence: 'localStorage',
};

export const MixpanelEvents = {
  APP_OPEN: 'App: Open',
  PAGE_VIEW: 'Page: View',
  BLOG_VIEW: 'Blog: View',
  BLOG_TAG_VIEW: 'Blog: Tag View',
  VANI_OPEN: 'Vani: Open',
  VANI_SESSION_START: 'Vani: Session Start',
} as const;

export type MixpanelEvent = (typeof MixpanelEvents)[keyof typeof MixpanelEvents];

class MixpanelService {
  private static instance: MixpanelService;
  private isInitialized = false;

  private constructor() {}

  public static getInstance(): MixpanelService {
    if (!MixpanelService.instance) {
      MixpanelService.instance = new MixpanelService();
    }
    return MixpanelService.instance;
  }

  public init() {
    if (this.isInitialized) return;

    if (MIXPANEL_TOKEN === 'YOUR_MIXPANEL_TOKEN') {
      console.warn('Mixpanel Token not found. Analytics will not be tracked.');
      return;
    }

    mixpanel.init(MIXPANEL_TOKEN, config);
    this.isInitialized = true;
  }

  public track(name: MixpanelEvent | string, props?: Dict) {
    if (!this.isInitialized) return;
    mixpanel.track(name, props);
  }

  public identify(id: string, props?: Dict) {
    if (!this.isInitialized) return;
    mixpanel.identify(id);
    if (props) {
      mixpanel.people.set(props);
    }
  }

  public reset() {
    if (!this.isInitialized) return;
    mixpanel.reset();
  }
}

export const mixpanelService = MixpanelService.getInstance();
