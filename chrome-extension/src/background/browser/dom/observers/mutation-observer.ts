import { createLogger } from '@src/background/log';

const logger = createLogger('MutationObserver');

export interface MutationCallback {
  id: string;
  callback: (mutations: MutationRecord[]) => void;
  debounceMs?: number;
}

export interface ObserverOptions {
  childList?: boolean;
  subtree?: boolean;
  attributes?: boolean;
  attributeOldValue?: boolean;
  characterData?: boolean;
  characterDataOldValue?: boolean;
  attributeFilter?: string[];
}

/**
 * Advanced DOM mutation observer for tracking dynamic content changes
 * in SPAs like Google Drive and Dropbox
 */
export class DOMObserver {
  private observer: MutationObserver | null = null;
  private callbacks: Map<string, MutationCallback> = new Map();
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private isObserving: boolean = false;
  private tabId: number;

  constructor(tabId: number) {
    this.tabId = tabId;
  }

  /**
   * Start observing DOM changes with specified options
   */
  async startObserving(options: ObserverOptions = {}): Promise<void> {
    if (this.isObserving) {
      logger.warning('Already observing DOM changes');
      return;
    }

    const defaultOptions: ObserverOptions = {
      childList: true,
      subtree: true,
      attributes: true,
      attributeOldValue: false,
      characterData: false,
      characterDataOldValue: false,
      ...options,
    };

    try {
      await chrome.scripting.executeScript({
        target: { tabId: this.tabId },
        func: (observerOptions: ObserverOptions) => {
          // Create observer in the page context
          if (window.navibrowserMutationObserver) {
            window.navibrowserMutationObserver.disconnect();
          }

          window.navibrowserMutationObserver = new MutationObserver(mutations => {
            // Send mutations back to extension
            window.postMessage(
              {
                type: 'NAVIBROWSER_MUTATIONS',
                mutations: mutations.map(mutation => ({
                  type: mutation.type,
                  target: {
                    tagName: (mutation.target as Element).tagName,
                    className: (mutation.target as Element).className,
                    id: (mutation.target as Element).id,
                  },
                  addedNodes: Array.from(mutation.addedNodes).map(node => ({
                    nodeType: node.nodeType,
                    tagName: (node as Element).tagName,
                    className: (node as Element).className,
                  })),
                  removedNodes: Array.from(mutation.removedNodes).map(node => ({
                    nodeType: node.nodeType,
                    tagName: (node as Element).tagName,
                    className: (node as Element).className,
                  })),
                  attributeName: mutation.attributeName,
                  oldValue: mutation.oldValue,
                })),
              },
              '*',
            );
          });

          window.navibrowserMutationObserver.observe(document.body, observerOptions);

          // Also listen for dynamic script injections
          const scriptObserver = new MutationObserver(mutations => {
            mutations.forEach(mutation => {
              mutation.addedNodes.forEach(node => {
                if (node.nodeType === Node.ELEMENT_NODE) {
                  const element = node as Element;
                  if (element.tagName === 'SCRIPT' || element.querySelector('script')) {
                    window.postMessage(
                      {
                        type: 'NAVIBROWSER_SCRIPT_INJECTION',
                        timestamp: Date.now(),
                      },
                      '*',
                    );
                  }
                }
              });
            });
          });

          scriptObserver.observe(document.head, { childList: true, subtree: true });
        },
        args: [defaultOptions],
      });

      // Set up message listener for mutations
      await this.setupMessageListener();

      this.isObserving = true;
      logger.info('Started DOM observation with options:', defaultOptions);
    } catch (error) {
      logger.error('Failed to start DOM observation:', error);
      throw error;
    }
  }

  /**
   * Stop observing DOM changes
   */
  async stopObserving(): Promise<void> {
    if (!this.isObserving) {
      return;
    }

    try {
      await chrome.scripting.executeScript({
        target: { tabId: this.tabId },
        func: () => {
          if (window.navibrowserMutationObserver) {
            window.navibrowserMutationObserver.disconnect();
            delete window.navibrowserMutationObserver;
          }
        },
      });

      // Clear all debounce timers
      this.debounceTimers.forEach(timer => clearTimeout(timer));
      this.debounceTimers.clear();

      this.isObserving = false;
      logger.info('Stopped DOM observation');
    } catch (error) {
      logger.error('Failed to stop DOM observation:', error);
    }
  }

  /**
   * Register a callback for DOM changes
   */
  onContentChange(id: string, callback: (mutations: MutationRecord[]) => void, debounceMs?: number): void {
    this.callbacks.set(id, {
      id,
      callback,
      debounceMs: debounceMs || 300, // Default 300ms debounce
    });
    logger.debug(`Registered mutation callback: ${id}`);
  }

  /**
   * Unregister a callback
   */
  removeCallback(id: string): void {
    this.callbacks.delete(id);

    // Clear associated debounce timer
    const timer = this.debounceTimers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.debounceTimers.delete(id);
    }

    logger.debug(`Removed mutation callback: ${id}`);
  }

  /**
   * Wait for specific content to appear
   */
  async waitForContent(options: { selector: string; timeout?: number; checkInterval?: number }): Promise<boolean> {
    const { selector, timeout = 10000, checkInterval = 500 } = options;
    const startTime = Date.now();

    return new Promise(resolve => {
      const checkContent = async () => {
        try {
          const result = await chrome.scripting.executeScript({
            target: { tabId: this.tabId },
            func: (sel: string) => {
              const element = document.querySelector(sel);
              return element !== null;
            },
            args: [selector],
          });

          if (result[0]?.result) {
            resolve(true);
            return;
          }

          if (Date.now() - startTime >= timeout) {
            resolve(false);
            return;
          }

          setTimeout(checkContent, checkInterval);
        } catch (error) {
          logger.error('Error checking for content:', error);
          resolve(false);
        }
      };

      checkContent();
    });
  }

  /**
   * Wait for content to disappear (e.g., loading spinners)
   */
  async waitForContentRemoval(options: {
    selector: string;
    timeout?: number;
    checkInterval?: number;
  }): Promise<boolean> {
    const { selector, timeout = 10000, checkInterval = 500 } = options;
    const startTime = Date.now();

    return new Promise(resolve => {
      const checkRemoval = async () => {
        try {
          const result = await chrome.scripting.executeScript({
            target: { tabId: this.tabId },
            func: (sel: string) => {
              const element = document.querySelector(sel);
              return element === null;
            },
            args: [selector],
          });

          if (result[0]?.result) {
            resolve(true);
            return;
          }

          if (Date.now() - startTime >= timeout) {
            resolve(false);
            return;
          }

          setTimeout(checkRemoval, checkInterval);
        } catch (error) {
          logger.error('Error checking for content removal:', error);
          resolve(false);
        }
      };

      checkRemoval();
    });
  }

  /**
   * Get current observation status
   */
  isActive(): boolean {
    return this.isObserving;
  }

  /**
   * Get the number of registered callbacks
   */
  getCallbackCount(): number {
    return this.callbacks.size;
  }

  /**
   * Set up message listener to receive mutations from content script
   */
  private async setupMessageListener(): Promise<void> {
    await chrome.scripting.executeScript({
      target: { tabId: this.tabId },
      func: () => {
        if (window.navibrowserMessageListener) {
          window.removeEventListener('message', window.navibrowserMessageListener);
        }

        window.navibrowserMessageListener = (event: MessageEvent) => {
          if (event.data.type === 'NAVIBROWSER_MUTATIONS') {
            // Store mutations for extension to retrieve
            window.navibrowserLatestMutations = event.data.mutations;
          } else if (event.data.type === 'NAVIBROWSER_SCRIPT_INJECTION') {
            window.navibrowserLastScriptInjection = event.data.timestamp;
          }
        };

        window.addEventListener('message', window.navibrowserMessageListener);
      },
    });

    // Poll for mutations in the background
    this.startMutationPolling();
  }

  /**
   * Poll for mutations from the content script
   */
  private startMutationPolling(): void {
    const pollMutations = async () => {
      if (!this.isObserving) {
        return;
      }

      try {
        const result = await chrome.scripting.executeScript({
          target: { tabId: this.tabId },
          func: () => {
            const mutations = window.navibrowserLatestMutations;
            window.navibrowserLatestMutations = null; // Clear after reading
            return mutations;
          },
        });

        const mutations = result[0]?.result;
        if (mutations && mutations.length > 0) {
          this.processMutations(mutations);
        }
      } catch (error) {
        // Tab might be closed or navigation occurred
        logger.debug('Mutation polling error (tab might be closed):', error);
      }

      // Continue polling
      setTimeout(pollMutations, 100);
    };

    pollMutations();
  }

  /**
   * Process received mutations and trigger callbacks
   */
  private processMutations(mutations: any[]): void {
    this.callbacks.forEach(callbackInfo => {
      const { id, callback, debounceMs } = callbackInfo;

      // Clear existing timer
      const existingTimer = this.debounceTimers.get(id);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      // Set new debounced timer
      const timer = setTimeout(() => {
        try {
          callback(mutations as MutationRecord[]);
        } catch (error) {
          logger.error(`Error in mutation callback ${id}:`, error);
        }
        this.debounceTimers.delete(id);
      }, debounceMs);

      this.debounceTimers.set(id, timer);
    });
  }
}

// Type augmentation for window object
declare global {
  interface Window {
    navibrowserMutationObserver?: MutationObserver;
    navibrowserMessageListener?: (event: MessageEvent) => void;
    navibrowserLatestMutations?: any[];
    navibrowserLastScriptInjection?: number;
  }
}
