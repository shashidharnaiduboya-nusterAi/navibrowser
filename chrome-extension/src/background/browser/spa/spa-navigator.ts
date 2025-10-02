import { createLogger } from '@src/background/log';
import { LoadingDetector } from '../loading/loading-detector';

const logger = createLogger('SPANavigator');

export interface RouteChangeEvent {
  oldRoute: string;
  newRoute: string;
  timestamp: number;
  method: 'pushState' | 'replaceState' | 'hashchange' | 'popstate' | 'navigation';
}

export interface NavigationOptions {
  waitForLoad?: boolean;
  timeout?: number;
  expectedContent?: string[];
}

/**
 * SPA Navigator handles client-side routing and navigation detection
 * Particularly useful for cloud storage platforms that use hash routing or pushState
 */
export class SPANavigator {
  private tabId: number;
  private currentRoute: string = '';
  private isMonitoring: boolean = false;
  private routeChangeCallbacks: Map<string, (event: RouteChangeEvent) => void> = new Map();
  private navigationHistory: RouteChangeEvent[] = [];
  private loadingDetector?: LoadingDetector;

  constructor(tabId: number, loadingDetector?: LoadingDetector) {
    this.tabId = tabId;
    this.loadingDetector = loadingDetector;
  }

  /**
   * Start monitoring route changes
   */
  async startMonitoring(): Promise<void> {
    if (this.isMonitoring) {
      logger.warning('Already monitoring route changes');
      return;
    }

    try {
      // Get initial route
      this.currentRoute = await this.getCurrentRoute();

      // Set up route monitoring in the page
      await this.setupRouteMonitoring();

      // Set up Chrome tab listeners
      this.setupTabListeners();

      this.isMonitoring = true;
      logger.info(`Started SPA navigation monitoring for tab ${this.tabId}`);
      logger.debug(`Initial route: ${this.currentRoute}`);
    } catch (error) {
      logger.error('Failed to start SPA navigation monitoring:', error);
      throw error;
    }
  }

  /**
   * Stop monitoring route changes
   */
  async stopMonitoring(): Promise<void> {
    if (!this.isMonitoring) {
      return;
    }

    try {
      // Clean up page-level monitoring
      await chrome.scripting.executeScript({
        target: { tabId: this.tabId },
        func: () => {
          // Remove event listeners
          if (window.navibrowserRouteListener) {
            window.removeEventListener('popstate', window.navibrowserRouteListener);
            window.removeEventListener('hashchange', window.navibrowserRouteListener);
            delete window.navibrowserRouteListener;
          }

          // Restore original methods
          if (window.navibrowserOriginalPushState) {
            history.pushState = window.navibrowserOriginalPushState;
            delete window.navibrowserOriginalPushState;
          }

          if (window.navibrowserOriginalReplaceState) {
            history.replaceState = window.navibrowserOriginalReplaceState;
            delete window.navibrowserOriginalReplaceState;
          }

          delete window.navibrowserRouteChanges;
        },
      });

      this.isMonitoring = false;
      this.routeChangeCallbacks.clear();

      logger.info('Stopped SPA navigation monitoring');
    } catch (error) {
      logger.error('Failed to stop SPA navigation monitoring:', error);
    }
  }

  /**
   * Navigate to a specific route within the SPA
   */
  async navigateToRoute(route: string, options: NavigationOptions = {}): Promise<boolean> {
    const { waitForLoad = true, timeout = 10000, expectedContent = [] } = options;

    logger.info(`Navigating to route: ${route}`);

    try {
      const startTime = Date.now();

      // Determine navigation method based on current platform
      const navigationMethod = await this.detectNavigationMethod();

      await this.performNavigation(route, navigationMethod);

      if (waitForLoad) {
        // Wait for route change to be detected
        const routeChanged = await this.waitForRouteChange(route, timeout / 2);
        if (!routeChanged) {
          logger.warning(`Route change not detected within ${timeout / 2}ms`);
        }

        // Wait for content to load if LoadingDetector is available
        if (this.loadingDetector) {
          const contentLoaded = await this.loadingDetector.waitForContentLoaded({
            contentSelectors: expectedContent,
            timeout: timeout / 2,
            networkIdle: true,
          });

          if (!contentLoaded) {
            logger.warning('Content loading timeout');
            return false;
          }
        }
      }

      const duration = Date.now() - startTime;
      logger.info(`Navigation completed in ${duration}ms`);
      return true;
    } catch (error) {
      logger.error(`Navigation to route ${route} failed:`, error);
      return false;
    }
  }

  /**
   * Wait for a specific route change
   */
  async waitForRouteChange(expectedRoute?: string, timeout: number = 5000): Promise<boolean> {
    return new Promise(resolve => {
      const startTime = Date.now();

      const checkRoute = async () => {
        try {
          const currentRoute = await this.getCurrentRoute();

          if (expectedRoute) {
            if (currentRoute.includes(expectedRoute) || currentRoute === expectedRoute) {
              resolve(true);
              return;
            }
          } else if (currentRoute !== this.currentRoute) {
            resolve(true);
            return;
          }

          if (Date.now() - startTime >= timeout) {
            resolve(false);
            return;
          }

          setTimeout(checkRoute, 100);
        } catch (error) {
          resolve(false);
        }
      };

      checkRoute();
    });
  }

  /**
   * Register callback for route changes
   */
  onRouteChange(id: string, callback: (event: RouteChangeEvent) => void): void {
    this.routeChangeCallbacks.set(id, callback);
  }

  /**
   * Remove route change callback
   */
  removeRouteChangeCallback(id: string): void {
    this.routeChangeCallbacks.delete(id);
  }

  /**
   * Get current route
   */
  async getCurrentRoute(): Promise<string> {
    try {
      const result = await chrome.scripting.executeScript({
        target: { tabId: this.tabId },
        func: () => {
          const url = window.location.href;
          const pathname = window.location.pathname;
          const search = window.location.search;
          const hash = window.location.hash;

          return {
            fullUrl: url,
            pathname,
            search,
            hash,
            combined: pathname + search + hash,
          };
        },
      });

      return result[0]?.result?.combined || '';
    } catch (error) {
      logger.error('Error getting current route:', error);
      return '';
    }
  }

  /**
   * Get navigation history
   */
  getNavigationHistory(): RouteChangeEvent[] {
    return [...this.navigationHistory];
  }

  /**
   * Check if monitoring is active
   */
  isActive(): boolean {
    return this.isMonitoring;
  }

  /**
   * Setup route monitoring in the page context
   */
  private async setupRouteMonitoring(): Promise<void> {
    await chrome.scripting.executeScript({
      target: { tabId: this.tabId },
      func: () => {
        // Initialize route change storage
        window.navibrowserRouteChanges = [];

        // Store original methods
        window.navibrowserOriginalPushState = history.pushState;
        window.navibrowserOriginalReplaceState = history.replaceState;

        // Override pushState
        history.pushState = function (...args) {
          const oldRoute = window.location.pathname + window.location.search + window.location.hash;
          window.navibrowserOriginalPushState.apply(history, args);
          const newRoute = window.location.pathname + window.location.search + window.location.hash;

          window.navibrowserRouteChanges.push({
            oldRoute,
            newRoute,
            timestamp: Date.now(),
            method: 'pushState',
          });
        };

        // Override replaceState
        history.replaceState = function (...args) {
          const oldRoute = window.location.pathname + window.location.search + window.location.hash;
          window.navibrowserOriginalReplaceState.apply(history, args);
          const newRoute = window.location.pathname + window.location.search + window.location.hash;

          window.navibrowserRouteChanges.push({
            oldRoute,
            newRoute,
            timestamp: Date.now(),
            method: 'replaceState',
          });
        };

        // Listen for popstate events
        window.navibrowserRouteListener = (event: PopStateEvent) => {
          const route = window.location.pathname + window.location.search + window.location.hash;
          window.navibrowserRouteChanges.push({
            oldRoute: window.navibrowserLastRoute || '',
            newRoute: route,
            timestamp: Date.now(),
            method: 'popstate',
          });
          window.navibrowserLastRoute = route;
        };

        // Listen for hash changes
        const hashChangeListener = (event: HashChangeEvent) => {
          window.navibrowserRouteChanges.push({
            oldRoute: event.oldURL,
            newRoute: event.newURL,
            timestamp: Date.now(),
            method: 'hashchange',
          });
        };

        window.addEventListener('popstate', window.navibrowserRouteListener);
        window.addEventListener('hashchange', hashChangeListener);

        // Store initial route
        window.navibrowserLastRoute = window.location.pathname + window.location.search + window.location.hash;
      },
    });

    // Start polling for route changes
    this.startRouteChangePolling();
  }

  /**
   * Setup Chrome tab listeners
   */
  private setupTabListeners(): void {
    chrome.tabs.onUpdated.addListener((updatedTabId, changeInfo) => {
      if (updatedTabId === this.tabId && changeInfo.url) {
        this.handleTabUrlChange(changeInfo.url);
      }
    });
  }

  /**
   * Start polling for route changes from the page
   */
  private startRouteChangePolling(): void {
    const pollRouteChanges = async () => {
      if (!this.isMonitoring) {
        return;
      }

      try {
        const result = await chrome.scripting.executeScript({
          target: { tabId: this.tabId },
          func: () => {
            const changes = window.navibrowserRouteChanges || [];
            window.navibrowserRouteChanges = []; // Clear after reading
            return changes;
          },
        });

        const changes = result[0]?.result || [];
        changes.forEach((change: RouteChangeEvent) => {
          this.handleRouteChange(change);
        });
      } catch (error) {
        // Tab might be closed or navigation occurred
        logger.debug('Route change polling error:', error);
      }

      // Continue polling
      setTimeout(pollRouteChanges, 100);
    };

    pollRouteChanges();
  }

  /**
   * Handle route change events
   */
  private handleRouteChange(event: RouteChangeEvent): void {
    logger.debug('Route change detected:', event);

    // Update current route
    this.currentRoute = event.newRoute;

    // Add to history
    this.navigationHistory.push(event);

    // Limit history size
    if (this.navigationHistory.length > 100) {
      this.navigationHistory.shift();
    }

    // Notify callbacks
    this.routeChangeCallbacks.forEach((callback, id) => {
      try {
        callback(event);
      } catch (error) {
        logger.error(`Error in route change callback ${id}:`, error);
      }
    });
  }

  /**
   * Handle tab URL changes (full navigation)
   */
  private handleTabUrlChange(newUrl: string): void {
    const event: RouteChangeEvent = {
      oldRoute: this.currentRoute,
      newRoute: newUrl,
      timestamp: Date.now(),
      method: 'navigation',
    };

    this.handleRouteChange(event);
  }

  /**
   * Detect the navigation method used by the current platform
   */
  private async detectNavigationMethod(): Promise<string> {
    try {
      const result = await chrome.scripting.executeScript({
        target: { tabId: this.tabId },
        func: () => {
          const hostname = window.location.hostname;

          // Platform-specific navigation detection
          if (hostname.includes('drive.google.com')) {
            return 'hash'; // Google Drive uses hash-based routing
          } else if (hostname.includes('dropbox.com')) {
            return 'pushState'; // Dropbox uses pushState
          } else if (hostname.includes('onedrive.live.com')) {
            return 'pushState'; // OneDrive uses pushState
          }

          // Check for presence of routing frameworks
          if (window.location.hash.includes('#/')) {
            return 'hash';
          }

          return 'pushState';
        },
      });

      return result[0]?.result || 'pushState';
    } catch (error) {
      logger.error('Error detecting navigation method:', error);
      return 'pushState';
    }
  }

  /**
   * Perform navigation using the detected method
   */
  private async performNavigation(route: string, method: string): Promise<void> {
    await chrome.scripting.executeScript({
      target: { tabId: this.tabId },
      func: (targetRoute: string, navMethod: string) => {
        if (navMethod === 'hash') {
          // Hash-based navigation
          window.location.hash = targetRoute.startsWith('#') ? targetRoute : `#${targetRoute}`;
        } else {
          // pushState navigation
          window.history.pushState({}, '', targetRoute);

          // Trigger a custom event to simulate framework routing
          window.dispatchEvent(new PopStateEvent('popstate', { state: {} }));
        }
      },
      args: [route, method],
    });
  }
}

// Type augmentation for window object
declare global {
  interface Window {
    navibrowserRouteChanges?: RouteChangeEvent[];
    navibrowserRouteListener?: (event: PopStateEvent) => void;
    navibrowserOriginalPushState?: typeof history.pushState;
    navibrowserOriginalReplaceState?: typeof history.replaceState;
    navibrowserLastRoute?: string;
  }
}
