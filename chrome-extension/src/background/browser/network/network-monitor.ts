import { createLogger } from '@src/background/log';

const logger = createLogger('NetworkMonitor');

export interface NetworkRequest {
  requestId: string;
  url: string;
  method: string;
  timestamp: number;
  status?: number;
  completed: boolean;
  failed: boolean;
}

export interface NetworkIdleOptions {
  timeout?: number;
  idleTime?: number;
  ignoreUrls?: string[];
  onlyUrls?: string[];
}

/**
 * Monitor network requests to detect when cloud storage content is loading
 * Particularly useful for Google Drive, Dropbox, and other SPAs
 */
export class NetworkMonitor {
  private tabId: number;
  private isMonitoring: boolean = false;
  private pendingRequests: Map<string, NetworkRequest> = new Map();
  private requestCallbacks: Map<string, (request: NetworkRequest) => void> = new Map();
  private completedRequests: NetworkRequest[] = [];
  private maxCompletedRequests: number = 100; // Keep last 100 requests

  constructor(tabId: number) {
    this.tabId = tabId;
  }

  /**
   * Start monitoring network requests
   */
  async startMonitoring(): Promise<void> {
    if (this.isMonitoring) {
      logger.warning('Already monitoring network requests');
      return;
    }

    try {
      // Attach debugger to monitor network events
      await chrome.debugger.attach({ tabId: this.tabId }, '1.3');
      await chrome.debugger.sendCommand({ tabId: this.tabId }, 'Network.enable');

      // Set up event listeners
      chrome.debugger.onEvent.addListener(this.handleNetworkEvent.bind(this));

      this.isMonitoring = true;
      logger.info(`Started network monitoring for tab ${this.tabId}`);
    } catch (error) {
      logger.error('Failed to start network monitoring:', error);
      throw error;
    }
  }

  /**
   * Stop monitoring network requests
   */
  async stopMonitoring(): Promise<void> {
    if (!this.isMonitoring) {
      return;
    }

    try {
      await chrome.debugger.sendCommand({ tabId: this.tabId }, 'Network.disable');
      await chrome.debugger.detach({ tabId: this.tabId });

      chrome.debugger.onEvent.removeListener(this.handleNetworkEvent.bind(this));

      this.isMonitoring = false;
      this.pendingRequests.clear();
      this.requestCallbacks.clear();

      logger.info(`Stopped network monitoring for tab ${this.tabId}`);
    } catch (error) {
      logger.error('Failed to stop network monitoring:', error);
    }
  }

  /**
   * Wait for network idle (no pending requests)
   */
  async waitForNetworkIdle(options: NetworkIdleOptions = {}): Promise<boolean> {
    const { timeout = 10000, idleTime = 1000, ignoreUrls = [], onlyUrls = [] } = options;

    return new Promise(resolve => {
      const startTime = Date.now();
      let lastActivityTime = Date.now();

      const checkNetworkIdle = () => {
        const now = Date.now();

        // Check for timeout
        if (now - startTime >= timeout) {
          logger.warning(`Network idle timeout after ${timeout}ms`);
          resolve(false);
          return;
        }

        // Filter pending requests based on options
        const relevantRequests = Array.from(this.pendingRequests.values()).filter(request => {
          // Apply URL filters
          if (onlyUrls.length > 0) {
            return onlyUrls.some(pattern => request.url.includes(pattern));
          }

          if (ignoreUrls.length > 0) {
            return !ignoreUrls.some(pattern => request.url.includes(pattern));
          }

          return true;
        });

        // Check if we have pending relevant requests
        if (relevantRequests.length === 0) {
          // No pending requests, check if we've been idle long enough
          if (now - lastActivityTime >= idleTime) {
            logger.debug('Network is idle');
            resolve(true);
            return;
          }
        } else {
          // Update last activity time
          lastActivityTime = now;
        }

        // Continue checking
        setTimeout(checkNetworkIdle, 100);
      };

      checkNetworkIdle();
    });
  }

  /**
   * Wait for specific requests to complete
   */
  async waitForRequests(urlPatterns: string[], timeout: number = 10000): Promise<boolean> {
    return new Promise(resolve => {
      // const startTime = Date.now(); // Currently unused
      const matchedRequests = new Set<string>();

      // Check existing completed requests
      this.completedRequests.forEach(request => {
        urlPatterns.forEach(pattern => {
          if (request.url.includes(pattern) && request.completed) {
            matchedRequests.add(pattern);
          }
        });
      });

      if (matchedRequests.size === urlPatterns.length) {
        resolve(true);
        return;
      }

      // Set up listener for new requests
      const requestListener = (request: NetworkRequest) => {
        if (request.completed) {
          urlPatterns.forEach(pattern => {
            if (request.url.includes(pattern)) {
              matchedRequests.add(pattern);
            }
          });

          if (matchedRequests.size === urlPatterns.length) {
            this.removeRequestCallback('waitForRequests');
            resolve(true);
          }
        }
      };

      this.onRequest('waitForRequests', requestListener);

      // Set timeout
      setTimeout(() => {
        this.removeRequestCallback('waitForRequests');
        resolve(false);
      }, timeout);
    });
  }

  /**
   * Register callback for request events
   */
  onRequest(id: string, callback: (request: NetworkRequest) => void): void {
    this.requestCallbacks.set(id, callback);
  }

  /**
   * Remove request callback
   */
  removeRequestCallback(id: string): void {
    this.requestCallbacks.delete(id);
  }

  /**
   * Get current pending requests
   */
  getPendingRequests(): NetworkRequest[] {
    return Array.from(this.pendingRequests.values());
  }

  /**
   * Get completed requests
   */
  getCompletedRequests(): NetworkRequest[] {
    return [...this.completedRequests];
  }

  /**
   * Get requests matching a URL pattern
   */
  getRequestsByPattern(pattern: string): NetworkRequest[] {
    const allRequests = [...this.pendingRequests.values(), ...this.completedRequests];
    return allRequests.filter(request => request.url.includes(pattern));
  }

  /**
   * Check if monitoring is active
   */
  isActive(): boolean {
    return this.isMonitoring;
  }

  /**
   * Handle network events from Chrome debugger
   */
  private handleNetworkEvent(source: chrome.debugger.Debuggee, method: string, params?: any): void {
    if (source.tabId !== this.tabId) {
      return;
    }

    switch (method) {
      case 'Network.requestWillBeSent':
        this.handleRequestStart(params);
        break;
      case 'Network.responseReceived':
        this.handleResponseReceived(params);
        break;
      case 'Network.loadingFinished':
        this.handleRequestFinished(params);
        break;
      case 'Network.loadingFailed':
        this.handleRequestFailed(params);
        break;
    }
  }

  /**
   * Handle request start
   */
  private handleRequestStart(params: any): void {
    const { requestId, request } = params;

    const networkRequest: NetworkRequest = {
      requestId,
      url: request.url,
      method: request.method,
      timestamp: Date.now(),
      completed: false,
      failed: false,
    };

    this.pendingRequests.set(requestId, networkRequest);
    logger.debug(`Request started: ${request.method} ${request.url}`);

    // Notify callbacks
    this.notifyCallbacks(networkRequest);
  }

  /**
   * Handle response received
   */
  private handleResponseReceived(params: any): void {
    const { requestId, response } = params;
    const request = this.pendingRequests.get(requestId);

    if (request) {
      request.status = response.status;
      logger.debug(`Response received: ${response.status} for ${request.url}`);
    }
  }

  /**
   * Handle request completion
   */
  private handleRequestFinished(params: any): void {
    const { requestId } = params;
    const request = this.pendingRequests.get(requestId);

    if (request) {
      request.completed = true;
      this.pendingRequests.delete(requestId);

      // Add to completed requests (with size limit)
      this.completedRequests.push(request);
      if (this.completedRequests.length > this.maxCompletedRequests) {
        this.completedRequests.shift();
      }

      logger.debug(`Request completed: ${request.url}`);
      this.notifyCallbacks(request);
    }
  }

  /**
   * Handle request failure
   */
  private handleRequestFailed(params: any): void {
    const { requestId, errorText } = params;
    const request = this.pendingRequests.get(requestId);

    if (request) {
      request.failed = true;
      request.completed = true;
      this.pendingRequests.delete(requestId);

      // Add to completed requests
      this.completedRequests.push(request);
      if (this.completedRequests.length > this.maxCompletedRequests) {
        this.completedRequests.shift();
      }

      logger.debug(`Request failed: ${request.url} - ${errorText}`);
      this.notifyCallbacks(request);
    }
  }

  /**
   * Notify all registered callbacks
   */
  private notifyCallbacks(request: NetworkRequest): void {
    this.requestCallbacks.forEach((callback, id) => {
      try {
        callback(request);
      } catch (error) {
        logger.error(`Error in request callback ${id}:`, error);
      }
    });
  }

  /**
   * Get network statistics
   */
  getNetworkStats(): {
    pending: number;
    completed: number;
    failed: number;
  } {
    const failed = this.completedRequests.filter(r => r.failed).length;

    return {
      pending: this.pendingRequests.size,
      completed: this.completedRequests.length - failed,
      failed,
    };
  }
}
