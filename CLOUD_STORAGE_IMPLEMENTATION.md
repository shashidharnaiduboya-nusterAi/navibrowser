# Cloud Storage Implementation Plan for Navibrowser

## Executive Summary

This document outlines the implementation strategy to enhance Navibrowser's capabilities for navigating and interacting with cloud storage platforms like Google Drive and Dropbox. The current architecture lacks support for Single Page Applications (SPAs) with dynamic content loading, which is essential for modern cloud storage interfaces.

## Current Limitations Analysis

### 1. **Static DOM Snapshot Problem**
- **Current Behavior**: `buildDomTree.js` captures a one-time DOM snapshot
- **Issue**: Cloud storage apps dynamically load content via JavaScript
- **Impact**: Element indices become stale, navigation fails

### 2. **SPA Navigation Gaps**
- **Current Behavior**: Assumes traditional page-based navigation
- **Issue**: Cloud apps use client-side routing without page reloads
- **Impact**: Agent loses context during folder navigation

### 3. **Dynamic Content Loading**
- **Current Behavior**: 1-second static wait between actions
- **Issue**: Cloud apps have variable loading times for file lists
- **Impact**: Premature action execution on incomplete content

### 4. **Element Targeting Instability**
- **Current Behavior**: Fixed element indices for targeting
- **Issue**: Virtual scrolling and lazy loading change DOM structure
- **Impact**: "Element not found" errors in dynamic interfaces

## Implementation Strategy

### Phase 1: Dynamic State Management Framework

#### 1.1 **MutationObserver Integration**
**Location**: `chrome-extension/src/background/browser/dom/observers/`

```typescript
// mutation-observer.ts
export class DOMObserver {
  private observer: MutationObserver;
  private callbacks: Map<string, (mutations: MutationRecord[]) => void>;
  
  constructor(tabId: number) {
    this.observer = new MutationObserver(this.handleMutations.bind(this));
    this.callbacks = new Map();
  }
  
  observeChanges(options: {
    childList?: boolean;
    subtree?: boolean;
    attributes?: boolean;
    attributeOldValue?: boolean;
  }) {
    this.observer.observe(document.body, options);
  }
  
  onContentChange(id: string, callback: (mutations: MutationRecord[]) => void) {
    this.callbacks.set(id, callback);
  }
  
  private handleMutations(mutations: MutationRecord[]) {
    // Debounce and process DOM changes
    // Notify registered callbacks
  }
}
```

#### 1.2 **Network Request Monitoring**
**Location**: `chrome-extension/src/background/browser/network/`

```typescript
// network-monitor.ts
export class NetworkMonitor {
  private pendingRequests: Set<string>;
  private requestCallbacks: Map<string, () => void>;
  
  constructor(tabId: number) {
    this.pendingRequests = new Set();
    this.setupNetworkInterception(tabId);
  }
  
  private async setupNetworkInterception(tabId: number) {
    await chrome.debugger.attach({ tabId }, '1.3');
    chrome.debugger.sendCommand({ tabId }, 'Network.enable');
    
    chrome.debugger.onEvent.addListener((source, method, params) => {
      if (source.tabId === tabId) {
        this.handleNetworkEvent(method, params);
      }
    });
  }
  
  waitForNetworkIdle(timeout: number = 5000): Promise<void> {
    return new Promise((resolve, reject) => {
      const checkIdle = () => {
        if (this.pendingRequests.size === 0) {
          resolve();
        } else {
          setTimeout(checkIdle, 100);
        }
      };
      
      setTimeout(() => reject(new Error('Network timeout')), timeout);
      checkIdle();
    });
  }
}
```

#### 1.3 **Loading State Detection**
**Location**: `chrome-extension/src/background/browser/loading/`

```typescript
// loading-detector.ts
export class LoadingDetector {
  async waitForContentLoaded(patterns: {
    spinnerSelectors?: string[];
    contentSelectors?: string[];
    networkIdle?: boolean;
    timeout?: number;
  }): Promise<boolean> {
    const timeout = patterns.timeout || 10000;
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      // Check for loading spinners
      const hasSpinners = await this.checkForSpinners(patterns.spinnerSelectors);
      if (hasSpinners) {
        await new Promise(resolve => setTimeout(resolve, 500));
        continue;
      }
      
      // Check for expected content
      const hasContent = await this.checkForContent(patterns.contentSelectors);
      if (!hasContent) {
        await new Promise(resolve => setTimeout(resolve, 500));
        continue;
      }
      
      // Wait for network idle if requested
      if (patterns.networkIdle) {
        await this.networkMonitor.waitForNetworkIdle();
      }
      
      return true;
    }
    
    return false;
  }
}
```

### Phase 2: SPA-Aware Navigation System

#### 2.1 **Route Change Detection**
**Location**: `chrome-extension/src/background/browser/spa/`

```typescript
// spa-navigator.ts
export class SPANavigator {
  private currentRoute: string;
  private routeChangeCallbacks: ((oldRoute: string, newRoute: string) => void)[];
  
  constructor(tabId: number) {
    this.currentRoute = '';
    this.routeChangeCallbacks = [];
    this.setupRouteMonitoring(tabId);
  }
  
  private setupRouteMonitoring(tabId: number) {
    // Monitor URL changes
    chrome.tabs.onUpdated.addListener((updatedTabId, changeInfo) => {
      if (updatedTabId === tabId && changeInfo.url) {
        this.handleRouteChange(changeInfo.url);
      }
    });
    
    // Monitor hash changes and pushState
    chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const originalPushState = history.pushState;
        const originalReplaceState = history.replaceState;
        
        history.pushState = function(...args) {
          originalPushState.apply(history, args);
          window.dispatchEvent(new CustomEvent('navibrowser:routechange'));
        };
        
        history.replaceState = function(...args) {
          originalReplaceState.apply(history, args);
          window.dispatchEvent(new CustomEvent('navibrowser:routechange'));
        };
        
        window.addEventListener('hashchange', () => {
          window.dispatchEvent(new CustomEvent('navibrowser:routechange'));
        });
      }
    });
  }
  
  onRouteChange(callback: (oldRoute: string, newRoute: string) => void) {
    this.routeChangeCallbacks.push(callback);
  }
}
```

#### 2.2 **Virtual Scrolling Support**
**Location**: `chrome-extension/src/background/browser/virtual/`

```typescript
// virtual-scroll-handler.ts
export class VirtualScrollHandler {
  async scrollToRevealItem(itemSelector: string, maxScrollAttempts: number = 10): Promise<boolean> {
    for (let attempt = 0; attempt < maxScrollAttempts; attempt++) {
      // Check if item is visible
      const isVisible = await this.isElementVisible(itemSelector);
      if (isVisible) {
        return true;
      }
      
      // Scroll down to load more content
      await this.scrollToLoadMore();
      
      // Wait for new content to load
      await this.loadingDetector.waitForContentLoaded({
        networkIdle: true,
        timeout: 3000
      });
    }
    
    return false;
  }
  
  private async scrollToLoadMore(): Promise<void> {
    await chrome.scripting.executeScript({
      target: { tabId: this.tabId },
      func: () => {
        window.scrollTo(0, document.body.scrollHeight * 0.8);
      }
    });
  }
}
```

### Phase 3: Enhanced Element Targeting System

#### 3.1 **Semantic Element Selectors**
**Location**: `chrome-extension/src/background/browser/selectors/`

```typescript
// semantic-selector.ts
export class SemanticSelector {
  createStableSelector(element: Element): string {
    const selectors: string[] = [];
    
    // Use data attributes first (most stable)
    const dataId = element.getAttribute('data-id') || 
                   element.getAttribute('data-test-id') ||
                   element.getAttribute('data-cy');
    if (dataId) {
      selectors.push(`[data-id="${dataId}"]`);
    }
    
    // Use semantic attributes
    const ariaLabel = element.getAttribute('aria-label');
    if (ariaLabel) {
      selectors.push(`[aria-label="${ariaLabel}"]`);
    }
    
    // Use text content for buttons/links
    if (element.tagName === 'BUTTON' || element.tagName === 'A') {
      const text = element.textContent?.trim();
      if (text && text.length < 50) {
        selectors.push(`${element.tagName.toLowerCase()}:contains("${text}")`);
      }
    }
    
    // Fallback to structural selector
    selectors.push(this.generateStructuralSelector(element));
    
    return selectors.join(' || ');
  }
  
  async findElementBySemanticSelector(selector: string): Promise<Element | null> {
    const alternatives = selector.split(' || ');
    
    for (const alternative of alternatives) {
      const element = await this.querySelector(alternative);
      if (element) {
        return element;
      }
    }
    
    return null;
  }
}
```

#### 3.2 **Element Stability Checker**
**Location**: `chrome-extension/src/background/browser/stability/`

```typescript
// element-stability.ts
export class ElementStabilityChecker {
  async waitForElementStability(selector: string, options: {
    timeout?: number;
    checkInterval?: number;
    requiredStableTime?: number;
  } = {}): Promise<boolean> {
    const timeout = options.timeout || 5000;
    const checkInterval = options.checkInterval || 100;
    const requiredStableTime = options.requiredStableTime || 500;
    
    let lastPosition: DOMRect | null = null;
    let stableStartTime: number | null = null;
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const element = await this.querySelector(selector);
      if (!element) {
        lastPosition = null;
        stableStartTime = null;
        await new Promise(resolve => setTimeout(resolve, checkInterval));
        continue;
      }
      
      const currentPosition = element.getBoundingClientRect();
      
      if (lastPosition && this.positionsEqual(lastPosition, currentPosition)) {
        if (!stableStartTime) {
          stableStartTime = Date.now();
        } else if (Date.now() - stableStartTime >= requiredStableTime) {
          return true;
        }
      } else {
        stableStartTime = null;
      }
      
      lastPosition = currentPosition;
      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }
    
    return false;
  }
}
```

### Phase 4: Cloud Storage Specific Actions

#### 4.1 **Enhanced Action Schemas**
**Location**: `chrome-extension/src/background/agent/actions/cloud-schemas.ts`

```typescript
// cloud-schemas.ts
export const navigateFolderActionSchema = {
  name: 'navigate_folder',
  description: 'Navigate to a folder in cloud storage, waiting for content to load',
  schema: z.object({
    folder_name: z.string().describe('Name or partial name of the folder to navigate to'),
    wait_for_load: z.boolean().default(true).describe('Wait for folder contents to fully load'),
    timeout: z.number().default(10000).describe('Maximum time to wait for loading'),
    intent: z.string().optional().describe('Human-readable description of the action'),
  }),
};

export const searchFilesActionSchema = {
  name: 'search_files',
  description: 'Search for files in cloud storage with filters',
  schema: z.object({
    query: z.string().describe('Search query for files'),
    file_type: z.string().optional().describe('File type filter (pdf, doc, image, etc.)'),
    date_range: z.string().optional().describe('Date range filter (last week, last month, etc.)'),
    max_results: z.number().default(20).describe('Maximum number of results to return'),
    intent: z.string().optional(),
  }),
};

export const waitForContentActionSchema = {
  name: 'wait_for_content',
  description: 'Wait for dynamic content to finish loading',
  schema: z.object({
    content_type: z.enum(['files', 'folders', 'search_results']).describe('Type of content to wait for'),
    timeout: z.number().default(10000).describe('Maximum wait time in milliseconds'),
    expected_count: z.number().optional().describe('Expected minimum number of items'),
    intent: z.string().optional(),
  }),
};
```

#### 4.2 **Cloud Storage Action Implementation**
**Location**: `chrome-extension/src/background/agent/actions/cloud-actions.ts`

```typescript
// cloud-actions.ts
export class CloudStorageActions {
  constructor(
    private context: AgentContext,
    private domObserver: DOMObserver,
    private networkMonitor: NetworkMonitor,
    private loadingDetector: LoadingDetector,
    private semanticSelector: SemanticSelector
  ) {}
  
  buildCloudActions(): Action[] {
    const actions: Action[] = [];
    
    // Navigate Folder Action
    const navigateFolder = new Action(
      async (input: z.infer<typeof navigateFolderActionSchema.schema>) => {
        const intent = input.intent || `Navigating to folder: ${input.folder_name}`;
        this.context.emitEvent(Actors.NAVIGATOR, ExecutionState.ACT_START, intent);
        
        try {
          // Find folder by name using semantic selectors
          const folderSelector = await this.findFolderSelector(input.folder_name);
          if (!folderSelector) {
            throw new Error(`Folder "${input.folder_name}" not found`);
          }
          
          // Wait for element stability before clicking
          await this.elementStabilityChecker.waitForElementStability(folderSelector);
          
          // Click folder
          const folderElement = await this.semanticSelector.findElementBySemanticSelector(folderSelector);
          await this.clickElement(folderElement);
          
          if (input.wait_for_load) {
            // Wait for navigation and content loading
            await this.waitForFolderNavigation(input.timeout);
          }
          
          const msg = `Successfully navigated to folder: ${input.folder_name}`;
          this.context.emitEvent(Actors.NAVIGATOR, ExecutionState.ACT_OK, msg);
          return new ActionResult({
            extractedContent: msg,
            includeInMemory: true,
          });
        } catch (error) {
          const errorMsg = `Failed to navigate to folder: ${error.message}`;
          this.context.emitEvent(Actors.NAVIGATOR, ExecutionState.ACT_FAIL, errorMsg);
          return new ActionResult({
            error: errorMsg,
            includeInMemory: true,
          });
        }
      },
      navigateFolderActionSchema
    );
    
    // Wait for Content Action
    const waitForContent = new Action(
      async (input: z.infer<typeof waitForContentActionSchema.schema>) => {
        const intent = input.intent || `Waiting for ${input.content_type} to load`;
        this.context.emitEvent(Actors.NAVIGATOR, ExecutionState.ACT_START, intent);
        
        try {
          const contentPatterns = this.getContentPatterns(input.content_type);
          const loaded = await this.loadingDetector.waitForContentLoaded({
            ...contentPatterns,
            timeout: input.timeout,
            networkIdle: true,
          });
          
          if (!loaded) {
            throw new Error(`Content loading timeout after ${input.timeout}ms`);
          }
          
          // Verify expected count if provided
          if (input.expected_count) {
            const actualCount = await this.countContentItems(input.content_type);
            if (actualCount < input.expected_count) {
              await this.loadMoreContent(input.content_type);
            }
          }
          
          const msg = `Content loaded successfully: ${input.content_type}`;
          this.context.emitEvent(Actors.NAVIGATOR, ExecutionState.ACT_OK, msg);
          return new ActionResult({
            extractedContent: msg,
            includeInMemory: true,
          });
        } catch (error) {
          const errorMsg = `Failed to wait for content: ${error.message}`;
          this.context.emitEvent(Actors.NAVIGATOR, ExecutionState.ACT_FAIL, errorMsg);
          return new ActionResult({
            error: errorMsg,
            includeInMemory: true,
          });
        }
      },
      waitForContentActionSchema
    );
    
    actions.push(navigateFolder, waitForContent);
    return actions;
  }
  
  private async findFolderSelector(folderName: string): Promise<string | null> {
    // Google Drive specific selectors
    const driveSelectors = [
      `[data-tooltip*="${folderName}"]`,
      `[aria-label*="${folderName}"]`,
      `[title*="${folderName}"]`,
      `.files-list [data-id*="${folderName}"]`,
    ];
    
    // Dropbox specific selectors
    const dropboxSelectors = [
      `[data-testid="file-name"]:contains("${folderName}")`,
      `[title*="${folderName}"]`,
      `.file-row [aria-label*="${folderName}"]`,
    ];
    
    const allSelectors = [...driveSelectors, ...dropboxSelectors];
    
    for (const selector of allSelectors) {
      const element = await this.semanticSelector.findElementBySemanticSelector(selector);
      if (element) {
        return selector;
      }
    }
    
    return null;
  }
  
  private getContentPatterns(contentType: string) {
    const patterns = {
      files: {
        spinnerSelectors: ['.loading', '.spinner', '[data-testid="loading"]'],
        contentSelectors: ['.files-list', '[data-testid="file-list"]', '.file-row'],
      },
      folders: {
        spinnerSelectors: ['.loading', '.spinner'],
        contentSelectors: ['.folder-list', '[data-testid="folder"]'],
      },
      search_results: {
        spinnerSelectors: ['.search-loading', '.spinner'],
        contentSelectors: ['.search-results', '[data-testid="search-result"]'],
      },
    };
    
    return patterns[contentType] || patterns.files;
  }
}
```

### Phase 5: Enhanced Planner Agent

#### 5.1 **Cloud Storage Domain Knowledge**
**Location**: `chrome-extension/src/background/agent/prompts/cloud-planner.ts`

```typescript
// cloud-planner.ts
export class CloudStoragePlanner extends PlannerPrompt {
  getCloudStorageSystemMessage(): string {
    return `You are an AI planner specialized in cloud storage navigation and file management.

CLOUD STORAGE EXPERTISE:
- Google Drive: Folder navigation, file search, sharing, organization
- Dropbox: File management, folder structure, collaboration features
- OneDrive: Document management, folder navigation, search capabilities

KEY BEHAVIORS FOR CLOUD STORAGE:
1. ALWAYS wait for content to load after navigation
2. Use semantic search for files/folders (partial names work)
3. Handle virtual scrolling for large file lists
4. Recognize loading states and wait appropriately
5. Use search functionality when browsing is inefficient

COMMON PATTERNS:
- Navigate to folder → Wait for content → Browse files
- Search for files → Filter results → Select target
- Upload files → Wait for completion → Verify upload
- Share files → Configure permissions → Copy link

FAILURE RECOVERY:
- If navigation fails, try search instead
- If content doesn't load, refresh and retry
- If element not found, wait and try alternative selectors
- If timeout occurs, break task into smaller steps

Remember: Cloud storage apps are dynamic SPAs. Always account for loading time and content changes.`;
  }
}
```

#### 5.2 **Multi-Step Workflow Coordination**
**Location**: `chrome-extension/src/background/agent/workflows/`

```typescript
// cloud-workflow.ts
export class CloudWorkflowCoordinator {
  async executeCloudTask(task: string): Promise<void> {
    const workflow = this.analyzeCloudTask(task);
    
    for (const step of workflow.steps) {
      await this.executeWorkflowStep(step);
      
      // Validate step completion
      const validation = await this.validateStepCompletion(step);
      if (!validation.success) {
        // Attempt recovery
        await this.attemptStepRecovery(step, validation.error);
      }
    }
  }
  
  private analyzeCloudTask(task: string): CloudWorkflow {
    // Analyze task and break into steps
    // Example: "Find my presentation files from last month"
    // Steps:
    // 1. Navigate to root or recent files
    // 2. Use search with "presentation" filter
    // 3. Apply date filter for last month
    // 4. Extract and present results
    
    return {
      steps: [
        { type: 'navigate', target: 'recent' },
        { type: 'search', query: 'presentation', filters: ['date:last_month'] },
        { type: 'extract', target: 'file_list' },
      ]
    };
  }
}
```

## Implementation Timeline

### Week 1-2: Foundation
- [ ] Implement MutationObserver system
- [ ] Build NetworkMonitor for request tracking
- [ ] Create LoadingDetector for dynamic content
- [ ] Set up basic SPA navigation detection

### Week 3-4: Element Targeting
- [ ] Develop SemanticSelector system
- [ ] Implement ElementStabilityChecker
- [ ] Create VirtualScrollHandler
- [ ] Build retry mechanisms for stale elements

### Week 5-6: Cloud Actions
- [ ] Design cloud storage action schemas
- [ ] Implement navigate_folder action
- [ ] Build wait_for_content action
- [ ] Create search_files action
- [ ] Add file_upload/download actions

### Week 7-8: Integration & Testing
- [ ] Integrate with existing Navigator Agent
- [ ] Enhance Planner with cloud storage knowledge
- [ ] Build CloudWorkflowCoordinator
- [ ] Create comprehensive test suite

### Week 9-10: Optimization & Polish
- [ ] Performance optimization
- [ ] Error handling improvements
- [ ] User experience enhancements
- [ ] Documentation and examples

## Success Metrics

### Functional Requirements
- [ ] Successfully navigate Google Drive folder structure
- [ ] Find specific files by name/type/date
- [ ] Handle large file lists with virtual scrolling
- [ ] Maintain stability during dynamic content loading
- [ ] Recover from common navigation failures

### Performance Requirements
- [ ] < 5 seconds average for folder navigation
- [ ] < 10 seconds for file search completion
- [ ] 95% success rate for basic file operations
- [ ] Minimal memory/CPU impact on browser

### Compatibility Requirements
- [ ] Google Drive (personal & workspace)
- [ ] Dropbox (personal & business)
- [ ] OneDrive (personal & business)
- [ ] Support for Chrome and Edge browsers

## Risk Mitigation

### Technical Risks
1. **SPA Framework Changes**: Build adaptable selectors
2. **Rate Limiting**: Implement respectful request patterns
3. **Authentication Issues**: Handle session timeouts gracefully
4. **Performance Impact**: Monitor and optimize resource usage

### User Experience Risks
1. **Slower Response Times**: Set appropriate expectations
2. **Complex Error Messages**: Provide clear, actionable feedback
3. **Inconsistent Behavior**: Thorough testing across platforms

## Conclusion

This implementation plan transforms Navibrowser from a traditional web automation tool into a sophisticated cloud storage navigator. By addressing the core limitations of static DOM snapshots and implementing dynamic content awareness, we enable seamless interaction with modern cloud storage platforms.

The phased approach ensures incremental progress with testable milestones, while the focus on semantic element targeting and workflow coordination provides robust, maintainable solutions for complex cloud storage tasks.