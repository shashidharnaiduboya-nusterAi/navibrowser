import { createLogger } from '@src/background/log';
import { DOMObserver } from '../dom/observers/mutation-observer';
import { NetworkMonitor } from '../network/network-monitor';

const logger = createLogger('LoadingDetector');

export interface LoadingPattern {
  spinnerSelectors?: string[];
  contentSelectors?: string[];
  loadingTextPatterns?: string[];
  networkUrls?: string[];
  networkIdle?: boolean;
  timeout?: number;
}

export interface LoadingDetectorOptions {
  domObserver?: DOMObserver;
  networkMonitor?: NetworkMonitor;
  tabId: number;
}

/**
 * Intelligent loading detector that combines DOM observation and network monitoring
 * to determine when cloud storage content has finished loading
 */
export class LoadingDetector {
  private tabId: number;
  private domObserver?: DOMObserver;
  private networkMonitor?: NetworkMonitor;

  constructor(options: LoadingDetectorOptions) {
    this.tabId = options.tabId;
    this.domObserver = options.domObserver;
    this.networkMonitor = options.networkMonitor;
  }

  /**
   * Wait for content to finish loading based on multiple indicators
   */
  async waitForContentLoaded(patterns: LoadingPattern): Promise<boolean> {
    const {
      spinnerSelectors = [],
      contentSelectors = [],
      loadingTextPatterns = [],
      networkUrls = [],
      networkIdle = false,
      timeout = 15000,
    } = patterns;

    logger.info('Waiting for content to load with patterns:', patterns);

    const startTime = Date.now();
    const promises: Promise<boolean>[] = [];

    // 1. Wait for loading spinners to disappear
    if (spinnerSelectors.length > 0) {
      promises.push(this.waitForSpinnersToDisappear(spinnerSelectors, timeout));
    }

    // 2. Wait for expected content to appear
    if (contentSelectors.length > 0) {
      promises.push(this.waitForContentToAppear(contentSelectors, timeout));
    }

    // 3. Wait for loading text to disappear
    if (loadingTextPatterns.length > 0) {
      promises.push(this.waitForLoadingTextToDisappear(loadingTextPatterns, timeout));
    }

    // 4. Wait for specific network requests
    if (networkUrls.length > 0 && this.networkMonitor) {
      promises.push(this.networkMonitor.waitForRequests(networkUrls, timeout));
    }

    // 5. Wait for network idle
    if (networkIdle && this.networkMonitor) {
      promises.push(this.networkMonitor.waitForNetworkIdle({ timeout }));
    }

    try {
      // Wait for at least one condition to be met, or all if multiple are specified
      let result: boolean;

      if (promises.length === 1) {
        result = await promises[0];
      } else if (promises.length > 1) {
        // Wait for all conditions to be met
        const results = await Promise.all(promises);
        result = results.every(r => r);
      } else {
        // No specific patterns, use default cloud storage detection
        result = await this.detectCloudStorageLoading(timeout);
      }

      const duration = Date.now() - startTime;
      logger.info(`Content loading completed in ${duration}ms, success: ${result}`);

      return result;
    } catch (error) {
      logger.error('Error waiting for content to load:', error);
      return false;
    }
  }

  /**
   * Wait for loading spinners to disappear
   */
  private async waitForSpinnersToDisappear(selectors: string[], timeout: number): Promise<boolean> {
    const promises = selectors.map(selector => this.waitForElementToDisappear(selector, timeout));

    // Wait for all spinners to disappear
    const results = await Promise.all(promises);
    return results.every(result => result);
  }

  /**
   * Wait for content elements to appear
   */
  private async waitForContentToAppear(selectors: string[], timeout: number): Promise<boolean> {
    // Wait for at least one content selector to appear
    const promises = selectors.map(
      selector => this.waitForElementToAppear(selector, timeout / 2), // Give each selector half the timeout
    );

    try {
      // Use Promise.race to return true as soon as any content appears
      await Promise.race(promises);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Wait for loading text patterns to disappear
   */
  private async waitForLoadingTextToDisappear(patterns: string[], timeout: number): Promise<boolean> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      try {
        const result = await chrome.scripting.executeScript({
          target: { tabId: this.tabId },
          func: (textPatterns: string[]) => {
            const bodyText = document.body.textContent?.toLowerCase() || '';
            return !textPatterns.some(pattern => bodyText.includes(pattern.toLowerCase()));
          },
          args: [patterns],
        });

        if (result[0]?.result) {
          return true;
        }

        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        logger.error('Error checking for loading text:', error);
        return false;
      }
    }

    return false;
  }

  /**
   * Wait for an element to appear
   */
  private async waitForElementToAppear(selector: string, timeout: number): Promise<boolean> {
    if (this.domObserver) {
      return this.domObserver.waitForContent({ selector, timeout });
    }

    // Fallback to polling
    return this.pollForElement(selector, timeout, true);
  }

  /**
   * Wait for an element to disappear
   */
  private async waitForElementToDisappear(selector: string, timeout: number): Promise<boolean> {
    if (this.domObserver) {
      return this.domObserver.waitForContentRemoval({ selector, timeout });
    }

    // Fallback to polling
    return this.pollForElement(selector, timeout, false);
  }

  /**
   * Poll for element presence/absence
   */
  private async pollForElement(selector: string, timeout: number, shouldExist: boolean): Promise<boolean> {
    const startTime = Date.now();
    const checkInterval = 200;

    while (Date.now() - startTime < timeout) {
      try {
        const result = await chrome.scripting.executeScript({
          target: { tabId: this.tabId },
          func: (sel: string) => {
            const element = document.querySelector(sel);
            return element !== null;
          },
          args: [selector],
        });

        const exists = result[0]?.result;
        if ((shouldExist && exists) || (!shouldExist && !exists)) {
          return true;
        }

        await new Promise(resolve => setTimeout(resolve, checkInterval));
      } catch (error) {
        logger.error(`Error polling for element ${selector}:`, error);
        return false;
      }
    }

    return false;
  }

  /**
   * Detect loading for common cloud storage platforms
   */
  private async detectCloudStorageLoading(timeout: number): Promise<boolean> {
    // Detect platform and use appropriate patterns
    const platform = await this.detectPlatform();

    let patterns: LoadingPattern;

    switch (platform) {
      case 'google-drive':
        patterns = {
          spinnerSelectors: [
            '[role="progressbar"]',
            '.gb_Ua', // Google loading spinner
            '[data-testid="loading"]',
            '.loading',
            '.spinner',
          ],
          contentSelectors: ['[data-testid="file-row"]', '[role="grid"]', '.files-list', '[aria-label*="file"]'],
          loadingTextPatterns: ['loading', 'please wait', 'updating'],
          networkIdle: true,
          timeout,
        };
        break;

      case 'dropbox':
        patterns = {
          spinnerSelectors: ['[data-testid="loading-spinner"]', '.loading-spinner', '.loader'],
          contentSelectors: ['[data-testid="file-name"]', '.file-row', '[data-testid="virtualized-file-browser"]'],
          loadingTextPatterns: ['loading', 'please wait'],
          networkIdle: true,
          timeout,
        };
        break;

      case 'onedrive':
        patterns = {
          spinnerSelectors: ['[data-automationid="Spinner"]', '.ms-Spinner', '.loading'],
          contentSelectors: ['[data-automationid="ListCell"]', '.od-ItemTile', '[role="row"]'],
          loadingTextPatterns: ['loading', 'please wait'],
          networkIdle: true,
          timeout,
        };
        break;

      default:
        // Generic patterns for unknown platforms
        patterns = {
          spinnerSelectors: ['.loading', '.spinner', '[role="progressbar"]', '.loader'],
          contentSelectors: ['.file', '.folder', '[role="grid"]', '[role="listbox"]'],
          loadingTextPatterns: ['loading', 'please wait'],
          networkIdle: true,
          timeout,
        };
    }

    return this.waitForContentLoaded(patterns);
  }

  /**
   * Detect which cloud storage platform we're on
   */
  private async detectPlatform(): Promise<string> {
    try {
      const result = await chrome.scripting.executeScript({
        target: { tabId: this.tabId },
        func: () => {
          const url = window.location.href;
          const hostname = window.location.hostname;

          if (hostname.includes('drive.google.com')) {
            return 'google-drive';
          } else if (hostname.includes('dropbox.com')) {
            return 'dropbox';
          } else if (hostname.includes('onedrive.live.com') || hostname.includes('sharepoint.com')) {
            return 'onedrive';
          }

          // Check for platform-specific elements
          if (document.querySelector('[data-testid="file-row"]') || document.querySelector('.gb_Ua')) {
            return 'google-drive';
          } else if (document.querySelector('[data-testid="file-name"]')) {
            return 'dropbox';
          } else if (document.querySelector('[data-automationid="ListCell"]')) {
            return 'onedrive';
          }

          return 'unknown';
        },
      });

      const platform = result[0]?.result || 'unknown';
      logger.debug(`Detected platform: ${platform}`);
      return platform;
    } catch (error) {
      logger.error('Error detecting platform:', error);
      return 'unknown';
    }
  }

  /**
   * Check if content is currently loading
   */
  async isContentLoading(): Promise<boolean> {
    try {
      const result = await chrome.scripting.executeScript({
        target: { tabId: this.tabId },
        func: () => {
          // Check for common loading indicators
          const loadingSelectors = [
            '[role="progressbar"]',
            '.loading',
            '.spinner',
            '.loader',
            '[data-testid="loading"]',
            '[data-testid="loading-spinner"]',
          ];

          return loadingSelectors.some(selector => {
            const element = document.querySelector(selector);
            return element && getComputedStyle(element).display !== 'none';
          });
        },
      });

      return result[0]?.result || false;
    } catch (error) {
      logger.error('Error checking if content is loading:', error);
      return false;
    }
  }

  /**
   * Get loading status with details
   */
  async getLoadingStatus(): Promise<{
    isLoading: boolean;
    hasSpinners: boolean;
    networkActivity: boolean;
    platform: string;
  }> {
    const [isLoading, platform] = await Promise.all([this.isContentLoading(), this.detectPlatform()]);

    const networkActivity = this.networkMonitor ? this.networkMonitor.getPendingRequests().length > 0 : false;

    return {
      isLoading,
      hasSpinners: isLoading,
      networkActivity,
      platform,
    };
  }
}
