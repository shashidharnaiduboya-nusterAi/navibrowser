import { createLogger } from '@src/background/log';
import { DOMObserver } from './dom/observers/mutation-observer';
import { NetworkMonitor } from './network/network-monitor';
import { LoadingDetector } from './loading/loading-detector';
import { SPANavigator } from './spa/spa-navigator';

const logger = createLogger('DynamicStateManager');

export interface DynamicStateManagerOptions {
  tabId: number;
  enableDOMObserver?: boolean;
  enableNetworkMonitor?: boolean;
  enableLoadingDetector?: boolean;
  enableSPANavigator?: boolean;
}

/**
 * Central manager for all dynamic state management components
 * Coordinates DOM observation, network monitoring, loading detection, and SPA navigation
 */
export class DynamicStateManager {
  private tabId: number;
  private domObserver?: DOMObserver;
  private networkMonitor?: NetworkMonitor;
  private loadingDetector?: LoadingDetector;
  private spaNavigator?: SPANavigator;
  private isInitialized: boolean = false;

  constructor(options: DynamicStateManagerOptions) {
    this.tabId = options.tabId;

    // Initialize components based on options
    if (options.enableDOMObserver !== false) {
      this.domObserver = new DOMObserver(this.tabId);
    }

    if (options.enableNetworkMonitor !== false) {
      this.networkMonitor = new NetworkMonitor(this.tabId);
    }

    if (options.enableLoadingDetector !== false) {
      this.loadingDetector = new LoadingDetector({
        tabId: this.tabId,
        domObserver: this.domObserver,
        networkMonitor: this.networkMonitor,
      });
    }

    if (options.enableSPANavigator !== false) {
      this.spaNavigator = new SPANavigator(this.tabId, this.loadingDetector);
    }

    logger.info(`Initialized DynamicStateManager for tab ${this.tabId}`);
  }

  /**
   * Initialize all enabled components
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warning('DynamicStateManager already initialized');
      return;
    }

    try {
      const promises: Promise<void>[] = [];

      // Start DOM observer
      if (this.domObserver) {
        promises.push(this.domObserver.startObserving());
      }

      // Start network monitor
      if (this.networkMonitor) {
        promises.push(this.networkMonitor.startMonitoring());
      }

      // Start SPA navigator
      if (this.spaNavigator) {
        promises.push(this.spaNavigator.startMonitoring());
      }

      await Promise.all(promises);

      this.isInitialized = true;
      logger.info('DynamicStateManager initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize DynamicStateManager:', error);
      throw error;
    }
  }

  /**
   * Cleanup all components
   */
  async cleanup(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    try {
      const promises: Promise<void>[] = [];

      // Stop DOM observer
      if (this.domObserver) {
        promises.push(this.domObserver.stopObserving());
      }

      // Stop network monitor
      if (this.networkMonitor) {
        promises.push(this.networkMonitor.stopMonitoring());
      }

      // Stop SPA navigator
      if (this.spaNavigator) {
        promises.push(this.spaNavigator.stopMonitoring());
      }

      await Promise.allSettled(promises); // Use allSettled to ensure all cleanup attempts are made

      this.isInitialized = false;
      logger.info('DynamicStateManager cleaned up successfully');
    } catch (error) {
      logger.error('Error during DynamicStateManager cleanup:', error);
    }
  }

  /**
   * Get DOM observer instance
   */
  getDOMObserver(): DOMObserver | undefined {
    return this.domObserver;
  }

  /**
   * Get network monitor instance
   */
  getNetworkMonitor(): NetworkMonitor | undefined {
    return this.networkMonitor;
  }

  /**
   * Get loading detector instance
   */
  getLoadingDetector(): LoadingDetector | undefined {
    return this.loadingDetector;
  }

  /**
   * Get SPA navigator instance
   */
  getSPANavigator(): SPANavigator | undefined {
    return this.spaNavigator;
  }

  /**
   * Check if manager is initialized
   */
  isActive(): boolean {
    return this.isInitialized;
  }

  /**
   * Get status of all components
   */
  getStatus(): {
    isInitialized: boolean;
    domObserver: boolean;
    networkMonitor: boolean;
    spaNavigator: boolean;
    tabId: number;
  } {
    return {
      isInitialized: this.isInitialized,
      domObserver: this.domObserver?.isActive() || false,
      networkMonitor: this.networkMonitor?.isActive() || false,
      spaNavigator: this.spaNavigator?.isActive() || false,
      tabId: this.tabId,
    };
  }

  /**
   * Wait for content to load using the loading detector
   */
  async waitForContentLoaded(patterns?: any): Promise<boolean> {
    if (!this.loadingDetector) {
      logger.warning('LoadingDetector not available');
      return false;
    }

    return this.loadingDetector.waitForContentLoaded(patterns || {});
  }

  /**
   * Navigate to a route using the SPA navigator
   */
  async navigateToRoute(route: string, options?: any): Promise<boolean> {
    if (!this.spaNavigator) {
      logger.warning('SPANavigator not available');
      return false;
    }

    return this.spaNavigator.navigateToRoute(route, options);
  }

  /**
   * Register for route changes
   */
  onRouteChange(id: string, callback: (event: any) => void): void {
    if (this.spaNavigator) {
      this.spaNavigator.onRouteChange(id, callback);
    }
  }

  /**
   * Register for DOM changes
   */
  onDOMChange(id: string, callback: (mutations: MutationRecord[]) => void, debounceMs?: number): void {
    if (this.domObserver) {
      this.domObserver.onContentChange(id, callback, debounceMs);
    }
  }

  /**
   * Register for network events
   */
  onNetworkRequest(id: string, callback: (request: any) => void): void {
    if (this.networkMonitor) {
      this.networkMonitor.onRequest(id, callback);
    }
  }
}

// Export all components for individual use
export { DOMObserver, NetworkMonitor, LoadingDetector, SPANavigator };
