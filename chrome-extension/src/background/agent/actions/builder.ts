import { ActionResult, type AgentContext } from '@src/background/agent/types';
import { t } from '@extension/i18n';
import {
  clickElementActionSchema,
  doubleClickElementActionSchema,
  doneActionSchema,
  goBackActionSchema,
  goToUrlActionSchema,
  inputTextActionSchema,
  openTabActionSchema,
  searchGoogleActionSchema,
  searchGoogleDriveActionSchema,
  searchInPageActionSchema,
  switchTabActionSchema,
  type ActionSchema,
  sendKeysActionSchema,
  scrollToTextActionSchema,
  cacheContentActionSchema,
  selectDropdownOptionActionSchema,
  getDropdownOptionsActionSchema,
  closeTabActionSchema,
  waitActionSchema,
  previousPageActionSchema,
  scrollToPercentActionSchema,
  nextPageActionSchema,
  scrollToTopActionSchema,
  scrollToBottomActionSchema,
  scanFolderForDocumentsActionSchema,
  verifyDocumentChecklistActionSchema,
  navigateToFolderActionSchema,
  extractDocumentListActionSchema,
  generateMissingDocumentsReportActionSchema,
} from './schemas';
import { z } from 'zod';
import { createLogger } from '@src/background/log';
import { ExecutionState, Actors } from '../event/types';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { wrapUntrustedContent } from '../messages/utils';
import { DynamicStateManager } from '@src/background/browser/dynamic-state-manager';

const logger = createLogger('Action');

export class InvalidInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidInputError';
  }
}

/**
 * An action is a function that takes an input and returns an ActionResult
 */
export class Action {
  constructor(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private readonly handler: (input: any) => Promise<ActionResult>,
    public readonly schema: ActionSchema,
    // Whether this action has an index argument
    public readonly hasIndex: boolean = false,
  ) {}

  async call(input: unknown): Promise<ActionResult> {
    // Validate input before calling the handler
    const schema = this.schema.schema;

    // check if the schema is schema: z.object({}), if so, ignore the input
    const isEmptySchema =
      schema instanceof z.ZodObject &&
      Object.keys((schema as z.ZodObject<Record<string, z.ZodTypeAny>>).shape || {}).length === 0;

    if (isEmptySchema) {
      return await this.handler({});
    }

    const parsedArgs = this.schema.schema.safeParse(input);
    if (!parsedArgs.success) {
      const errorMessage = parsedArgs.error.message;
      throw new InvalidInputError(errorMessage);
    }
    return await this.handler(parsedArgs.data);
  }

  name() {
    return this.schema.name;
  }

  /**
   * Returns the prompt for the action
   * @returns {string} The prompt for the action
   */
  prompt() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const schemaShape = (this.schema.schema as z.ZodObject<any>).shape || {};
    const schemaProperties = Object.entries(schemaShape).map(([key, value]) => {
      const zodValue = value as z.ZodTypeAny;
      return `'${key}': {'type': '${zodValue.description}', ${zodValue.isOptional() ? "'optional': true" : "'required': true"}}`;
    });

    const schemaStr =
      schemaProperties.length > 0 ? `{${this.name()}: {${schemaProperties.join(', ')}}}` : `{${this.name()}: {}}`;

    return `${this.schema.description}:\n${schemaStr}`;
  }

  /**
   * Get the index argument from the input if this action has an index
   * @param input The input to extract the index from
   * @returns The index value if found, null otherwise
   */
  getIndexArg(input: unknown): number | null {
    if (!this.hasIndex) {
      return null;
    }
    if (input && typeof input === 'object' && 'index' in input) {
      return (input as { index: number }).index;
    }
    return null;
  }

  /**
   * Set the index argument in the input if this action has an index
   * @param input The input to update the index in
   * @param newIndex The new index value to set
   * @returns Whether the index was set successfully
   */
  setIndexArg(input: unknown, newIndex: number): boolean {
    if (!this.hasIndex) {
      return false;
    }
    if (input && typeof input === 'object') {
      (input as { index: number }).index = newIndex;
      return true;
    }
    return false;
  }
}

// TODO: can not make every action optional, don't know why
export function buildDynamicActionSchema(actions: Action[]): z.ZodType {
  let schema = z.object({});
  for (const action of actions) {
    // create a schema for the action, it could be action.schema.schema or null
    // but don't use default: null as it causes issues with Google Generative AI
    const actionSchema = action.schema.schema;
    schema = schema.extend({
      [action.name()]: actionSchema.nullable().optional().describe(action.schema.description),
    });
  }
  return schema;
}

export class ActionBuilder {
  private readonly context: AgentContext;
  private readonly extractorLLM: BaseChatModel;
  private dynamicStateManager?: DynamicStateManager;

  constructor(context: AgentContext, extractorLLM: BaseChatModel) {
    this.context = context;
    this.extractorLLM = extractorLLM;

    // Initialize DynamicStateManager for the current tab
    this.initializeDynamicStateManager();
  }

  private async initializeDynamicStateManager(): Promise<void> {
    try {
      const currentPage = await this.context.browserContext.getCurrentPage();
      if (currentPage) {
        this.dynamicStateManager = new DynamicStateManager({
          tabId: currentPage.tabId,
          enableDOMObserver: true,
          enableNetworkMonitor: true,
          enableLoadingDetector: true,
          enableSPANavigator: true,
        });

        await this.dynamicStateManager.initialize();
        logger.info('DynamicStateManager initialized for ActionBuilder');
      }
    } catch (error) {
      logger.error('Failed to initialize DynamicStateManager:', error);
    }
  }

  buildDefaultActions() {
    const actions = [];

    const done = new Action(async (input: z.infer<typeof doneActionSchema.schema>) => {
      this.context.emitEvent(Actors.NAVIGATOR, ExecutionState.ACT_START, doneActionSchema.name);
      this.context.emitEvent(Actors.NAVIGATOR, ExecutionState.ACT_OK, input.text);
      return new ActionResult({
        isDone: true,
        extractedContent: input.text,
      });
    }, doneActionSchema);
    actions.push(done);

    const searchGoogle = new Action(async (input: z.infer<typeof searchGoogleActionSchema.schema>) => {
      const context = this.context;
      const intent = input.intent || t('act_searchGoogle_start', [input.query]);
      context.emitEvent(Actors.NAVIGATOR, ExecutionState.ACT_START, intent);

      await context.browserContext.navigateTo(`https://www.google.com/search?q=${input.query}`);

      const msg2 = t('act_searchGoogle_ok', [input.query]);
      context.emitEvent(Actors.NAVIGATOR, ExecutionState.ACT_OK, msg2);
      return new ActionResult({
        extractedContent: msg2,
        includeInMemory: true,
      });
    }, searchGoogleActionSchema);
    actions.push(searchGoogle);

    const searchGoogleDrive = new Action(async (input: z.infer<typeof searchGoogleDriveActionSchema.schema>) => {
      const context = this.context;
      const intent = input.intent || t('act_searchGoogleDrive_start', [input.query]);
      context.emitEvent(Actors.NAVIGATOR, ExecutionState.ACT_START, intent);

      try {
        const page = await context.browserContext.getCurrentPage();
        const currentUrl = page.url();

        // Check if we're already on Google Drive, if not navigate there
        if (!currentUrl.includes('drive.google.com')) {
          logger.info('Navigating to Google Drive');
          await context.browserContext.navigateTo('https://drive.google.com');

          // Wait for Google Drive to load using dynamic state manager
          const loadingDetector = this.dynamicStateManager?.getLoadingDetector();
          if (loadingDetector) {
            const loaded = await loadingDetector.waitForContentLoaded({
              timeout: 15000,
              contentSelectors: ['[data-testid="file-row"]', '[role="grid"]', '[aria-label="Search Drive"]'],
              networkIdle: true,
            });
            if (!loaded) {
              logger.warning('Google Drive may not have fully loaded');
            }
          } else {
            // Fallback: wait a bit for the page to load
            await new Promise(resolve => setTimeout(resolve, 3000));
          }
        }

        // Get current state after navigation/wait
        const state = await page.getState();

        // Look for Google Drive search box by checking aria-label attribute
        let searchElement = null;
        let searchIndex = -1;

        for (const [index, element] of state.selectorMap) {
          // Check for aria-label containing "Search" (case insensitive)
          const ariaLabel = element.attributes['aria-label'];
          if (ariaLabel && ariaLabel.toLowerCase().includes('search')) {
            searchElement = element;
            searchIndex = index;
            logger.info(`Found search element with aria-label: ${ariaLabel}`);
            break;
          }

          // Check for input elements with search-related placeholders
          if (element.tagName === 'input') {
            const placeholder = element.attributes['placeholder'];
            const type = element.attributes['type'];
            if (
              (placeholder && placeholder.toLowerCase().includes('search')) ||
              (type && type.toLowerCase() === 'search')
            ) {
              searchElement = element;
              searchIndex = index;
              logger.info(`Found search input element`);
              break;
            }
          }
        }

        if (!searchElement || searchIndex === -1) {
          throw new Error('Could not find Google Drive search box');
        }

        logger.info(`Found search box at index ${searchIndex}`);

        // Click the search box and input the query
        await page.clickElementNode(context.options.useVision, searchElement);

        // Clear any existing text and input the search query
        await page.sendKeys('Control+a'); // Select all
        await page.inputTextElementNode(context.options.useVision, searchElement, input.query);

        // Press Enter to execute the search
        await page.sendKeys('Enter');

        if (input.waitForResults) {
          // Wait for search results to load using dynamic state management
          logger.info('Waiting for Google Drive search results...');

          const loadingDetector2 = this.dynamicStateManager?.getLoadingDetector();
          if (loadingDetector2) {
            const resultsLoaded = await loadingDetector2.waitForContentLoaded({
              timeout: 10000,
              contentSelectors: [
                '[data-testid="file-row"]',
                '[role="gridcell"]',
                '.a-s-oa-d-w', // Google Drive file items
                '[aria-label*="files"]',
              ],
              networkIdle: true,
            });

            if (resultsLoaded) {
              logger.info('Search results loaded successfully');
            } else {
              logger.warning('Search results may not have fully loaded');
            }
          }
        }

        const msg = t('act_searchGoogleDrive_ok', [input.query]);
        context.emitEvent(Actors.NAVIGATOR, ExecutionState.ACT_OK, msg);
        return new ActionResult({
          extractedContent: msg,
          includeInMemory: true,
        });
      } catch (error) {
        const errorMsg = t('act_searchGoogleDrive_fail', [error instanceof Error ? error.message : String(error)]);
        context.emitEvent(Actors.NAVIGATOR, ExecutionState.ACT_FAIL, errorMsg);
        return new ActionResult({
          error: errorMsg,
          includeInMemory: true,
        });
      }
    }, searchGoogleDriveActionSchema);
    actions.push(searchGoogleDrive);

    const searchInPage = new Action(async (input: z.infer<typeof searchInPageActionSchema.schema>) => {
      const context = this.context;
      const intent = input.intent || t('act_searchInPage_start', [input.query]);
      context.emitEvent(Actors.NAVIGATOR, ExecutionState.ACT_START, intent);

      try {
        const page = await context.browserContext.getCurrentPage();
        const currentUrl = page.url();

        // Auto-detect the best search method
        let searchMethod = input.searchType;
        if (searchMethod === 'auto') {
          if (currentUrl.includes('drive.google.com')) {
            searchMethod = 'platform_specific'; // Use Google Drive search
          } else if (currentUrl.includes('dropbox.com') || currentUrl.includes('onedrive.live.com')) {
            searchMethod = 'search_box'; // Use search box for other cloud platforms
          } else {
            searchMethod = 'ctrl_f'; // Use Ctrl+F for general websites
          }
        }

        let success = false;
        let resultMessage = '';

        if (searchMethod === 'platform_specific' && currentUrl.includes('drive.google.com')) {
          // Delegate to Google Drive search for best performance
          logger.info('Using Google Drive specific search');
          const loadingDetector = this.dynamicStateManager?.getLoadingDetector();

          const state = await page.getState();
          let searchElement = null;
          let searchIndex = -1;

          // Find Google Drive search box
          for (const [index, element] of state.selectorMap) {
            const ariaLabel = element.attributes['aria-label'];
            if (ariaLabel && ariaLabel.toLowerCase().includes('search')) {
              searchElement = element;
              searchIndex = index;
              break;
            }

            if (element.tagName === 'input') {
              const placeholder = element.attributes['placeholder'];
              const type = element.attributes['type'];
              if (
                (placeholder && placeholder.toLowerCase().includes('search')) ||
                (type && type.toLowerCase() === 'search')
              ) {
                searchElement = element;
                searchIndex = index;
                break;
              }
            }
          }

          if (searchElement && searchIndex !== -1) {
            await page.clickElementNode(context.options.useVision, searchElement);
            await page.sendKeys('Control+a');
            await page.inputTextElementNode(context.options.useVision, searchElement, input.query);
            await page.sendKeys('Enter');

            if (input.waitForResults && loadingDetector) {
              await loadingDetector.waitForContentLoaded({
                timeout: 10000,
                contentSelectors: ['[data-testid="file-row"]', '[role="gridcell"]'],
                networkIdle: true,
              });
            }
            success = true;
            resultMessage = `Successfully searched Google Drive for "${input.query}"`;
          }
        } else if (searchMethod === 'search_box') {
          // Look for search boxes on the page
          const state = await page.getState();
          let searchElement = null;
          let searchIndex = -1;

          for (const [index, element] of state.selectorMap) {
            if (element.tagName === 'input') {
              const placeholder = element.attributes['placeholder'];
              const type = element.attributes['type'];
              const ariaLabel = element.attributes['aria-label'];

              if (
                (placeholder && placeholder.toLowerCase().includes('search')) ||
                (type && type.toLowerCase() === 'search') ||
                (ariaLabel && ariaLabel.toLowerCase().includes('search'))
              ) {
                searchElement = element;
                searchIndex = index;
                break;
              }
            }
          }

          if (searchElement && searchIndex !== -1) {
            await page.clickElementNode(context.options.useVision, searchElement);
            await page.sendKeys('Control+a');
            await page.inputTextElementNode(context.options.useVision, searchElement, input.query);
            await page.sendKeys('Enter');
            success = true;
            resultMessage = `Searched using search box for "${input.query}"`;
          }
        } else if (searchMethod === 'ctrl_f') {
          // Use Ctrl+F for in-page search
          await page.sendKeys('Control+f');
          await new Promise(resolve => setTimeout(resolve, 500)); // Wait for search box to appear
          await page.sendKeys(input.query);
          success = true;
          resultMessage = `Used Ctrl+F to search for "${input.query}" on the page`;
        }

        if (!success) {
          throw new Error('Could not find appropriate search method on this page');
        }

        const msg = t('act_searchInPage_ok', [input.query, resultMessage]);
        context.emitEvent(Actors.NAVIGATOR, ExecutionState.ACT_OK, msg);
        return new ActionResult({
          extractedContent: msg,
          includeInMemory: true,
        });
      } catch (error) {
        const errorMsg = t('act_searchInPage_fail', [error instanceof Error ? error.message : String(error)]);
        context.emitEvent(Actors.NAVIGATOR, ExecutionState.ACT_FAIL, errorMsg);
        return new ActionResult({
          error: errorMsg,
          includeInMemory: true,
        });
      }
    }, searchInPageActionSchema);
    actions.push(searchInPage);

    const goToUrl = new Action(async (input: z.infer<typeof goToUrlActionSchema.schema>) => {
      const intent = input.intent || t('act_goToUrl_start', [input.url]);
      this.context.emitEvent(Actors.NAVIGATOR, ExecutionState.ACT_START, intent);

      await this.context.browserContext.navigateTo(input.url);
      const msg2 = t('act_goToUrl_ok', [input.url]);
      this.context.emitEvent(Actors.NAVIGATOR, ExecutionState.ACT_OK, msg2);
      return new ActionResult({
        extractedContent: msg2,
        includeInMemory: true,
      });
    }, goToUrlActionSchema);
    actions.push(goToUrl);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const goBack = new Action(async (input: z.infer<typeof goBackActionSchema.schema>) => {
      const intent = input.intent || t('act_goBack_start');
      this.context.emitEvent(Actors.NAVIGATOR, ExecutionState.ACT_START, intent);

      const page = await this.context.browserContext.getCurrentPage();
      await page.goBack();
      const msg2 = t('act_goBack_ok');
      this.context.emitEvent(Actors.NAVIGATOR, ExecutionState.ACT_OK, msg2);
      return new ActionResult({
        extractedContent: msg2,
        includeInMemory: true,
      });
    }, goBackActionSchema);
    actions.push(goBack);

    const wait = new Action(async (input: z.infer<typeof waitActionSchema.schema>) => {
      const seconds = input.seconds || 3;
      const intent = input.intent || t('act_wait_start', [seconds.toString()]);
      this.context.emitEvent(Actors.NAVIGATOR, ExecutionState.ACT_START, intent);
      await new Promise(resolve => setTimeout(resolve, seconds * 1000));
      const msg = t('act_wait_ok', [seconds.toString()]);
      this.context.emitEvent(Actors.NAVIGATOR, ExecutionState.ACT_OK, msg);
      return new ActionResult({ extractedContent: msg, includeInMemory: true });
    }, waitActionSchema);
    actions.push(wait);

    // Element Interaction Actions
    const clickElement = new Action(
      async (input: z.infer<typeof clickElementActionSchema.schema>) => {
        const intent = input.intent || t('act_click_start', [input.index.toString()]);
        this.context.emitEvent(Actors.NAVIGATOR, ExecutionState.ACT_START, intent);

        const page = await this.context.browserContext.getCurrentPage();
        const state = await page.getState();

        const elementNode = state?.selectorMap.get(input.index);
        if (!elementNode) {
          throw new Error(t('act_errors_elementNotExist', [input.index.toString()]));
        }

        // Check if element is a file uploader
        if (page.isFileUploader(elementNode)) {
          const msg = t('act_click_fileUploader', [input.index.toString()]);
          logger.info(msg);
          return new ActionResult({
            extractedContent: msg,
            includeInMemory: true,
          });
        }

        try {
          const initialTabIds = await this.context.browserContext.getAllTabIds();
          await page.clickElementNode(this.context.options.useVision, elementNode);
          let msg = t('act_click_ok', [input.index.toString(), elementNode.getAllTextTillNextClickableElement(2)]);
          logger.info(msg);

          // TODO: could be optimized by chrome extension tab api
          const currentTabIds = await this.context.browserContext.getAllTabIds();
          if (currentTabIds.size > initialTabIds.size) {
            const newTabMsg = t('act_click_newTabOpened');
            msg += ` - ${newTabMsg}`;
            logger.info(newTabMsg);
            // find the tab id that is not in the initial tab ids
            const newTabId = Array.from(currentTabIds).find(id => !initialTabIds.has(id));
            if (newTabId) {
              await this.context.browserContext.switchTab(newTabId);
            }
          }
          this.context.emitEvent(Actors.NAVIGATOR, ExecutionState.ACT_OK, msg);
          return new ActionResult({ extractedContent: msg, includeInMemory: true });
        } catch (error) {
          const msg = t('act_errors_elementNoLongerAvailable', [input.index.toString()]);
          this.context.emitEvent(Actors.NAVIGATOR, ExecutionState.ACT_FAIL, msg);
          return new ActionResult({
            error: error instanceof Error ? error.message : String(error),
          });
        }
      },
      clickElementActionSchema,
      true,
    );
    actions.push(clickElement);

    const doubleClickElement = new Action(
      async (input: z.infer<typeof doubleClickElementActionSchema.schema>) => {
        const intent = input.intent || t('act_doubleClick_start', [input.index.toString()]);
        this.context.emitEvent(Actors.NAVIGATOR, ExecutionState.ACT_START, intent);

        const page = await this.context.browserContext.getCurrentPage();
        const state = await page.getState();

        const elementNode = state?.selectorMap.get(input.index);
        if (!elementNode) {
          throw new Error(t('act_errors_elementNotExist', [input.index.toString()]));
        }

        try {
          const initialTabIds = await this.context.browserContext.getAllTabIds();

          // Perform double-click by clicking twice with small delay
          await page.clickElementNode(this.context.options.useVision, elementNode);
          await new Promise(resolve => setTimeout(resolve, 100)); // Small delay between clicks
          await page.clickElementNode(this.context.options.useVision, elementNode);

          let msg = t('act_doubleClick_ok', [
            input.index.toString(),
            elementNode.getAllTextTillNextClickableElement(2),
          ]);
          logger.info(msg);

          // Check if new tab opened (same logic as single click)
          const currentTabIds = await this.context.browserContext.getAllTabIds();
          if (currentTabIds.size > initialTabIds.size) {
            const newTabMsg = t('act_click_newTabOpened');
            msg += ` - ${newTabMsg}`;
            logger.info(newTabMsg);
            const newTabId = Array.from(currentTabIds).find(id => !initialTabIds.has(id));
            if (newTabId) {
              await this.context.browserContext.switchTab(newTabId);
            }
          }

          this.context.emitEvent(Actors.NAVIGATOR, ExecutionState.ACT_OK, msg);
          return new ActionResult({ extractedContent: msg, includeInMemory: true });
        } catch (error) {
          const msg = t('act_errors_elementNoLongerAvailable', [input.index.toString()]);
          this.context.emitEvent(Actors.NAVIGATOR, ExecutionState.ACT_FAIL, msg);
          return new ActionResult({
            error: error instanceof Error ? error.message : String(error),
          });
        }
      },
      doubleClickElementActionSchema,
      true,
    );
    actions.push(doubleClickElement);

    const inputText = new Action(
      async (input: z.infer<typeof inputTextActionSchema.schema>) => {
        const intent = input.intent || t('act_inputText_start', [input.index.toString()]);
        this.context.emitEvent(Actors.NAVIGATOR, ExecutionState.ACT_START, intent);

        const page = await this.context.browserContext.getCurrentPage();
        const state = await page.getState();

        const elementNode = state?.selectorMap.get(input.index);
        if (!elementNode) {
          throw new Error(t('act_errors_elementNotExist', [input.index.toString()]));
        }

        await page.inputTextElementNode(this.context.options.useVision, elementNode, input.text);
        const msg = t('act_inputText_ok', [input.text, input.index.toString()]);
        this.context.emitEvent(Actors.NAVIGATOR, ExecutionState.ACT_OK, msg);
        return new ActionResult({ extractedContent: msg, includeInMemory: true });
      },
      inputTextActionSchema,
      true,
    );
    actions.push(inputText);

    // Tab Management Actions
    const switchTab = new Action(async (input: z.infer<typeof switchTabActionSchema.schema>) => {
      const intent = input.intent || t('act_switchTab_start', [input.tab_id.toString()]);
      this.context.emitEvent(Actors.NAVIGATOR, ExecutionState.ACT_START, intent);
      await this.context.browserContext.switchTab(input.tab_id);
      const msg = t('act_switchTab_ok', [input.tab_id.toString()]);
      this.context.emitEvent(Actors.NAVIGATOR, ExecutionState.ACT_OK, msg);
      return new ActionResult({ extractedContent: msg, includeInMemory: true });
    }, switchTabActionSchema);
    actions.push(switchTab);

    const openTab = new Action(async (input: z.infer<typeof openTabActionSchema.schema>) => {
      const intent = input.intent || t('act_openTab_start', [input.url]);
      this.context.emitEvent(Actors.NAVIGATOR, ExecutionState.ACT_START, intent);
      await this.context.browserContext.openTab(input.url);
      const msg = t('act_openTab_ok', [input.url]);
      this.context.emitEvent(Actors.NAVIGATOR, ExecutionState.ACT_OK, msg);
      return new ActionResult({ extractedContent: msg, includeInMemory: true });
    }, openTabActionSchema);
    actions.push(openTab);

    const closeTab = new Action(async (input: z.infer<typeof closeTabActionSchema.schema>) => {
      const intent = input.intent || t('act_closeTab_start', [input.tab_id.toString()]);
      this.context.emitEvent(Actors.NAVIGATOR, ExecutionState.ACT_START, intent);
      await this.context.browserContext.closeTab(input.tab_id);
      const msg = t('act_closeTab_ok', [input.tab_id.toString()]);
      this.context.emitEvent(Actors.NAVIGATOR, ExecutionState.ACT_OK, msg);
      return new ActionResult({ extractedContent: msg, includeInMemory: true });
    }, closeTabActionSchema);
    actions.push(closeTab);

    // Content Actions
    // TODO: this is not used currently, need to improve on input size
    // const extractContent = new Action(async (input: z.infer<typeof extractContentActionSchema.schema>) => {
    //   const goal = input.goal;
    //   const intent = input.intent || `Extracting content from page`;
    //   this.context.emitEvent(Actors.NAVIGATOR, ExecutionState.ACT_START, intent);
    //   const page = await this.context.browserContext.getCurrentPage();
    //   const content = await page.getReadabilityContent();
    //   const promptTemplate = PromptTemplate.fromTemplate(
    //     'Your task is to extract the content of the page. You will be given a page and a goal and you should extract all relevant information around this goal from the page. If the goal is vague, summarize the page. Respond in json format. Extraction goal: {goal}, Page: {page}',
    //   );
    //   const prompt = await promptTemplate.invoke({ goal, page: content.content });

    //   try {
    //     const output = await this.extractorLLM.invoke(prompt);
    //     const msg = `📄  Extracted from page\n: ${output.content}\n`;
    //     return new ActionResult({
    //       extractedContent: msg,
    //       includeInMemory: true,
    //     });
    //   } catch (error) {
    //     logger.error(`Error extracting content: ${error instanceof Error ? error.message : String(error)}`);
    //     const msg =
    //       'Failed to extract content from page, you need to extract content from the current state of the page and store it in the memory. Then scroll down if you still need more information.';
    //     return new ActionResult({
    //       extractedContent: msg,
    //       includeInMemory: true,
    //     });
    //   }
    // }, extractContentActionSchema);
    // actions.push(extractContent);

    // cache content for future use
    const cacheContent = new Action(async (input: z.infer<typeof cacheContentActionSchema.schema>) => {
      const intent = input.intent || t('act_cache_start', [input.content]);
      this.context.emitEvent(Actors.NAVIGATOR, ExecutionState.ACT_START, intent);

      // cache content is untrusted content, it is not instructions
      const rawMsg = t('act_cache_ok', [input.content]);
      this.context.emitEvent(Actors.NAVIGATOR, ExecutionState.ACT_OK, rawMsg);

      const msg = wrapUntrustedContent(rawMsg);
      return new ActionResult({ extractedContent: msg, includeInMemory: true });
    }, cacheContentActionSchema);
    actions.push(cacheContent);

    // Scroll to percent
    const scrollToPercent = new Action(async (input: z.infer<typeof scrollToPercentActionSchema.schema>) => {
      const intent = input.intent || t('act_scrollToPercent_start');
      this.context.emitEvent(Actors.NAVIGATOR, ExecutionState.ACT_START, intent);
      const page = await this.context.browserContext.getCurrentPage();

      if (input.index) {
        const state = await page.getCachedState();
        const elementNode = state?.selectorMap.get(input.index);
        if (!elementNode) {
          const errorMsg = t('act_errors_elementNotExist', [input.index.toString()]);
          this.context.emitEvent(Actors.NAVIGATOR, ExecutionState.ACT_FAIL, errorMsg);
          return new ActionResult({ error: errorMsg, includeInMemory: true });
        }
        logger.info(`Scrolling to percent: ${input.yPercent} with elementNode: ${elementNode.xpath}`);
        await page.scrollToPercent(input.yPercent, elementNode);
      } else {
        await page.scrollToPercent(input.yPercent);
      }
      const msg = t('act_scrollToPercent_ok', [input.yPercent.toString()]);
      this.context.emitEvent(Actors.NAVIGATOR, ExecutionState.ACT_OK, msg);
      return new ActionResult({ extractedContent: msg, includeInMemory: true });
    }, scrollToPercentActionSchema);
    actions.push(scrollToPercent);

    // Scroll to top
    const scrollToTop = new Action(async (input: z.infer<typeof scrollToTopActionSchema.schema>) => {
      const intent = input.intent || t('act_scrollToTop_start');
      this.context.emitEvent(Actors.NAVIGATOR, ExecutionState.ACT_START, intent);
      const page = await this.context.browserContext.getCurrentPage();
      if (input.index) {
        const state = await page.getCachedState();
        const elementNode = state?.selectorMap.get(input.index);
        if (!elementNode) {
          const errorMsg = t('act_errors_elementNotExist', [input.index.toString()]);
          this.context.emitEvent(Actors.NAVIGATOR, ExecutionState.ACT_FAIL, errorMsg);
          return new ActionResult({ error: errorMsg, includeInMemory: true });
        }
        await page.scrollToPercent(0, elementNode);
      } else {
        await page.scrollToPercent(0);
      }
      const msg = t('act_scrollToTop_ok');
      this.context.emitEvent(Actors.NAVIGATOR, ExecutionState.ACT_OK, msg);
      return new ActionResult({ extractedContent: msg, includeInMemory: true });
    }, scrollToTopActionSchema);
    actions.push(scrollToTop);

    // Scroll to bottom
    const scrollToBottom = new Action(async (input: z.infer<typeof scrollToBottomActionSchema.schema>) => {
      const intent = input.intent || t('act_scrollToBottom_start');
      this.context.emitEvent(Actors.NAVIGATOR, ExecutionState.ACT_START, intent);
      const page = await this.context.browserContext.getCurrentPage();
      if (input.index) {
        const state = await page.getCachedState();
        const elementNode = state?.selectorMap.get(input.index);
        if (!elementNode) {
          const errorMsg = t('act_errors_elementNotExist', [input.index.toString()]);
          this.context.emitEvent(Actors.NAVIGATOR, ExecutionState.ACT_FAIL, errorMsg);
          return new ActionResult({ error: errorMsg, includeInMemory: true });
        }
        await page.scrollToPercent(100, elementNode);
      } else {
        await page.scrollToPercent(100);
      }
      const msg = t('act_scrollToBottom_ok');
      this.context.emitEvent(Actors.NAVIGATOR, ExecutionState.ACT_OK, msg);
      return new ActionResult({ extractedContent: msg, includeInMemory: true });
    }, scrollToBottomActionSchema);
    actions.push(scrollToBottom);

    // Scroll to previous page
    const previousPage = new Action(async (input: z.infer<typeof previousPageActionSchema.schema>) => {
      const intent = input.intent || t('act_previousPage_start');
      this.context.emitEvent(Actors.NAVIGATOR, ExecutionState.ACT_START, intent);
      const page = await this.context.browserContext.getCurrentPage();

      if (input.index) {
        const state = await page.getCachedState();
        const elementNode = state?.selectorMap.get(input.index);
        if (!elementNode) {
          const errorMsg = t('act_errors_elementNotExist', [input.index.toString()]);
          this.context.emitEvent(Actors.NAVIGATOR, ExecutionState.ACT_FAIL, errorMsg);
          return new ActionResult({ error: errorMsg, includeInMemory: true });
        }

        // Check if element is already at top of its scrollable area
        try {
          const [elementScrollTop] = await page.getElementScrollInfo(elementNode);
          if (elementScrollTop === 0) {
            const msg = t('act_errors_alreadyAtTop', [input.index.toString()]);
            this.context.emitEvent(Actors.NAVIGATOR, ExecutionState.ACT_OK, msg);
            return new ActionResult({ extractedContent: msg, includeInMemory: true });
          }
        } catch (error) {
          // If we can't get scroll info, let the scrollToPreviousPage method handle it
          logger.warning(
            `Could not get element scroll info: ${error instanceof Error ? error.message : String(error)}`,
          );
        }

        await page.scrollToPreviousPage(elementNode);
      } else {
        // Check if page is already at top
        const [initialScrollY] = await page.getScrollInfo();
        if (initialScrollY === 0) {
          const msg = t('act_errors_pageAlreadyAtTop');
          this.context.emitEvent(Actors.NAVIGATOR, ExecutionState.ACT_OK, msg);
          return new ActionResult({ extractedContent: msg, includeInMemory: true });
        }

        await page.scrollToPreviousPage();
      }
      const msg = t('act_previousPage_ok');
      this.context.emitEvent(Actors.NAVIGATOR, ExecutionState.ACT_OK, msg);
      return new ActionResult({ extractedContent: msg, includeInMemory: true });
    }, previousPageActionSchema);
    actions.push(previousPage);

    // Scroll to next page
    const nextPage = new Action(async (input: z.infer<typeof nextPageActionSchema.schema>) => {
      const intent = input.intent || t('act_nextPage_start');
      this.context.emitEvent(Actors.NAVIGATOR, ExecutionState.ACT_START, intent);
      const page = await this.context.browserContext.getCurrentPage();

      if (input.index) {
        const state = await page.getCachedState();
        const elementNode = state?.selectorMap.get(input.index);
        if (!elementNode) {
          const errorMsg = t('act_errors_elementNotExist', [input.index.toString()]);
          this.context.emitEvent(Actors.NAVIGATOR, ExecutionState.ACT_FAIL, errorMsg);
          return new ActionResult({ error: errorMsg, includeInMemory: true });
        }

        // Check if element is already at bottom of its scrollable area
        try {
          const [elementScrollTop, elementClientHeight, elementScrollHeight] =
            await page.getElementScrollInfo(elementNode);
          if (elementScrollTop + elementClientHeight >= elementScrollHeight) {
            const msg = t('act_errors_alreadyAtBottom', [input.index.toString()]);
            this.context.emitEvent(Actors.NAVIGATOR, ExecutionState.ACT_OK, msg);
            return new ActionResult({ extractedContent: msg, includeInMemory: true });
          }
        } catch (error) {
          // If we can't get scroll info, let the scrollToNextPage method handle it
          logger.warning(
            `Could not get element scroll info: ${error instanceof Error ? error.message : String(error)}`,
          );
        }

        await page.scrollToNextPage(elementNode);
      } else {
        // Check if page is already at bottom
        const [initialScrollY, initialVisualViewportHeight, initialScrollHeight] = await page.getScrollInfo();
        if (initialScrollY + initialVisualViewportHeight >= initialScrollHeight) {
          const msg = t('act_errors_pageAlreadyAtBottom');
          this.context.emitEvent(Actors.NAVIGATOR, ExecutionState.ACT_OK, msg);
          return new ActionResult({ extractedContent: msg, includeInMemory: true });
        }

        await page.scrollToNextPage();
      }
      const msg = t('act_nextPage_ok');
      this.context.emitEvent(Actors.NAVIGATOR, ExecutionState.ACT_OK, msg);
      return new ActionResult({ extractedContent: msg, includeInMemory: true });
    }, nextPageActionSchema);
    actions.push(nextPage);

    // Scroll to text
    const scrollToText = new Action(async (input: z.infer<typeof scrollToTextActionSchema.schema>) => {
      const intent = input.intent || t('act_scrollToText_start', [input.text, input.nth.toString()]);
      this.context.emitEvent(Actors.NAVIGATOR, ExecutionState.ACT_START, intent);

      const page = await this.context.browserContext.getCurrentPage();
      try {
        const scrolled = await page.scrollToText(input.text, input.nth);
        const msg = scrolled
          ? t('act_scrollToText_ok', [input.text, input.nth.toString()])
          : t('act_scrollToText_notFound', [input.text, input.nth.toString()]);
        this.context.emitEvent(Actors.NAVIGATOR, ExecutionState.ACT_OK, msg);
        return new ActionResult({ extractedContent: msg, includeInMemory: true });
      } catch (error) {
        const msg = t('act_scrollToText_failed', [error instanceof Error ? error.message : String(error)]);
        this.context.emitEvent(Actors.NAVIGATOR, ExecutionState.ACT_FAIL, msg);
        return new ActionResult({ error: msg, includeInMemory: true });
      }
    }, scrollToTextActionSchema);
    actions.push(scrollToText);

    // Keyboard Actions
    const sendKeys = new Action(async (input: z.infer<typeof sendKeysActionSchema.schema>) => {
      const intent = input.intent || t('act_sendKeys_start', [input.keys]);
      this.context.emitEvent(Actors.NAVIGATOR, ExecutionState.ACT_START, intent);

      const page = await this.context.browserContext.getCurrentPage();
      await page.sendKeys(input.keys);
      const msg = t('act_sendKeys_ok', [input.keys]);
      this.context.emitEvent(Actors.NAVIGATOR, ExecutionState.ACT_OK, msg);
      return new ActionResult({ extractedContent: msg, includeInMemory: true });
    }, sendKeysActionSchema);
    actions.push(sendKeys);

    // Get all options from a native dropdown
    const getDropdownOptions = new Action(
      async (input: z.infer<typeof getDropdownOptionsActionSchema.schema>) => {
        const intent = input.intent || t('act_getDropdownOptions_start', [input.index.toString()]);
        this.context.emitEvent(Actors.NAVIGATOR, ExecutionState.ACT_START, intent);

        const page = await this.context.browserContext.getCurrentPage();
        const state = await page.getState();

        const elementNode = state?.selectorMap.get(input.index);
        if (!elementNode) {
          const errorMsg = t('act_errors_elementNotExist', [input.index.toString()]);
          this.context.emitEvent(Actors.NAVIGATOR, ExecutionState.ACT_FAIL, errorMsg);
          return new ActionResult({
            error: errorMsg,
            includeInMemory: true,
          });
        }

        try {
          // Use the existing getDropdownOptions method
          const options = await page.getDropdownOptions(input.index);

          if (options && options.length > 0) {
            // Format options for display
            const formattedOptions: string[] = options.map(opt => {
              // Encoding ensures AI uses the exact string in select_dropdown_option
              const encodedText = JSON.stringify(opt.text);
              return `${opt.index}: text=${encodedText}`;
            });

            let msg = formattedOptions.join('\n');
            msg += '\n' + t('act_getDropdownOptions_useExactText');
            this.context.emitEvent(
              Actors.NAVIGATOR,
              ExecutionState.ACT_OK,
              t('act_getDropdownOptions_ok', [options.length.toString()]),
            );
            return new ActionResult({
              extractedContent: msg,
              includeInMemory: true,
            });
          }

          // This code should not be reached as getDropdownOptions throws an error when no options found
          // But keeping as fallback
          const msg = t('act_getDropdownOptions_noOptions');
          this.context.emitEvent(Actors.NAVIGATOR, ExecutionState.ACT_OK, msg);
          return new ActionResult({
            extractedContent: msg,
            includeInMemory: true,
          });
        } catch (error) {
          const errorMsg = t('act_getDropdownOptions_failed', [error instanceof Error ? error.message : String(error)]);
          this.context.emitEvent(Actors.NAVIGATOR, ExecutionState.ACT_FAIL, errorMsg);
          return new ActionResult({
            error: errorMsg,
            includeInMemory: true,
          });
        }
      },
      getDropdownOptionsActionSchema,
      true,
    );
    actions.push(getDropdownOptions);

    // Select dropdown option for interactive element index by the text of the option you want to select'
    const selectDropdownOption = new Action(
      async (input: z.infer<typeof selectDropdownOptionActionSchema.schema>) => {
        const intent = input.intent || t('act_selectDropdownOption_start', [input.text, input.index.toString()]);
        this.context.emitEvent(Actors.NAVIGATOR, ExecutionState.ACT_START, intent);

        const page = await this.context.browserContext.getCurrentPage();
        const state = await page.getState();

        const elementNode = state?.selectorMap.get(input.index);
        if (!elementNode) {
          const errorMsg = t('act_errors_elementNotExist', [input.index.toString()]);
          this.context.emitEvent(Actors.NAVIGATOR, ExecutionState.ACT_FAIL, errorMsg);
          return new ActionResult({
            error: errorMsg,
            includeInMemory: true,
          });
        }

        // Validate that we're working with a select element
        if (!elementNode.tagName || elementNode.tagName.toLowerCase() !== 'select') {
          const errorMsg = t('act_selectDropdownOption_notSelect', [
            input.index.toString(),
            elementNode.tagName || 'unknown',
          ]);
          this.context.emitEvent(Actors.NAVIGATOR, ExecutionState.ACT_FAIL, errorMsg);
          return new ActionResult({
            error: errorMsg,
            includeInMemory: true,
          });
        }

        logger.debug(`Attempting to select '${input.text}' using xpath: ${elementNode.xpath}`);

        try {
          const result = await page.selectDropdownOption(input.index, input.text);
          const msg = t('act_selectDropdownOption_ok', [input.text, input.index.toString()]);
          this.context.emitEvent(Actors.NAVIGATOR, ExecutionState.ACT_OK, msg);
          return new ActionResult({
            extractedContent: result,
            includeInMemory: true,
          });
        } catch (error) {
          const errorMsg = t('act_selectDropdownOption_failed', [
            error instanceof Error ? error.message : String(error),
          ]);
          this.context.emitEvent(Actors.NAVIGATOR, ExecutionState.ACT_FAIL, errorMsg);
          return new ActionResult({
            error: errorMsg,
            includeInMemory: true,
          });
        }
      },
      selectDropdownOptionActionSchema,
      true,
    );
    actions.push(selectDropdownOption);

    // Document and Folder Verification Actions
    const scanFolderForDocuments = new Action(
      async (input: z.infer<typeof scanFolderForDocumentsActionSchema.schema>) => {
        const intent =
          input.intent || `Scanning folder for documents${input.folderPath ? `: ${input.folderPath}` : ''}`;
        this.context.emitEvent(Actors.NAVIGATOR, ExecutionState.ACT_START, intent);

        try {
          const page = await this.context.browserContext.getCurrentPage();
          const state = await page.getState();

          // Wait for folder contents to load if requested
          if (input.waitForLoad) {
            const loadingDetector = this.dynamicStateManager?.getLoadingDetector();
            if (loadingDetector) {
              await loadingDetector.waitForContentLoaded({
                timeout: 10000,
                contentSelectors: [
                  '[role="grid"]',
                  '[data-testid*="file"]',
                  '.file',
                  '.document',
                  '[aria-label*="file"]',
                ],
                networkIdle: false,
              });
            } else {
              await new Promise(resolve => setTimeout(resolve, 2000));
            }
          }

          // Extract document list from current view
          const documents: string[] = [];

          if (state?.selectorMap) {
            // Look for file/document elements in the current state
            for (const [index, element] of state.selectorMap) {
              const text = element.text?.trim() || '';
              const ariaLabel = element.ariaLabel?.trim() || '';
              const title = element.title?.trim() || '';

              // Check if this looks like a file/document
              const isFile =
                element.tagName?.toLowerCase() === 'a' ||
                text.includes('.') ||
                ariaLabel.toLowerCase().includes('file') ||
                ariaLabel.toLowerCase().includes('document') ||
                title.toLowerCase().includes('file') ||
                element.xpath?.includes('file') ||
                element.xpath?.includes('document');

              if (isFile && text) {
                // Filter by file types if specified
                if (input.fileTypes && input.fileTypes.length > 0) {
                  const hasMatchingType = input.fileTypes.some(type =>
                    text.toLowerCase().includes(`.${type.toLowerCase()}`),
                  );
                  if (hasMatchingType) {
                    documents.push(text);
                  }
                } else {
                  documents.push(text);
                }
              }
            }
          }

          const msg = `Found ${documents.length} documents: ${documents.slice(0, 10).join(', ')}${documents.length > 10 ? '...' : ''}`;
          this.context.emitEvent(Actors.NAVIGATOR, ExecutionState.ACT_OK, msg);

          return new ActionResult({
            extractedContent: JSON.stringify({
              folderPath: input.folderPath || 'current folder',
              documentCount: documents.length,
              documents: documents,
              fileTypes: input.fileTypes || ['all'],
              recursive: input.recursive,
            }),
            includeInMemory: true,
          });
        } catch (error) {
          const errorMsg = `Failed to scan folder: ${error instanceof Error ? error.message : String(error)}`;
          this.context.emitEvent(Actors.NAVIGATOR, ExecutionState.ACT_FAIL, errorMsg);
          return new ActionResult({
            error: errorMsg,
            includeInMemory: true,
          });
        }
      },
      scanFolderForDocumentsActionSchema,
    );
    actions.push(scanFolderForDocuments);

    const verifyDocumentChecklist = new Action(
      async (input: z.infer<typeof verifyDocumentChecklistActionSchema.schema>) => {
        const intent =
          input.intent || `Verifying document checklist (${input.requiredDocuments.length} required documents)`;
        this.context.emitEvent(Actors.NAVIGATOR, ExecutionState.ACT_START, intent);

        try {
          const foundDocuments: string[] = [];
          const missingDocuments: string[] = [];

          // Compare required documents with discovered documents
          for (const required of input.requiredDocuments) {
            let found = false;

            for (const discovered of input.discoveredDocuments) {
              let match = false;

              switch (input.matchingStrategy) {
                case 'exact':
                  match = discovered.toLowerCase() === required.toLowerCase();
                  break;
                case 'contains':
                  match =
                    discovered.toLowerCase().includes(required.toLowerCase()) ||
                    required.toLowerCase().includes(discovered.toLowerCase());
                  break;
                case 'pattern':
                  // Simple pattern matching (contains wildcard support)
                  const pattern = required.replace(/\*/g, '.*').replace(/\?/g, '.');
                  const regex = new RegExp(pattern, 'i');
                  match = regex.test(discovered);
                  break;
              }

              if (match) {
                found = true;
                foundDocuments.push(`${required} → ${discovered}`);
                break;
              }
            }

            if (!found) {
              missingDocuments.push(required);
            }
          }

          const result = {
            totalRequired: input.requiredDocuments.length,
            totalFound: foundDocuments.length,
            totalMissing: missingDocuments.length,
            foundDocuments,
            missingDocuments,
            completionPercentage: Math.round((foundDocuments.length / input.requiredDocuments.length) * 100),
          };

          const msg = `Checklist verification complete: ${foundDocuments.length}/${input.requiredDocuments.length} documents found (${result.completionPercentage}%)`;
          this.context.emitEvent(Actors.NAVIGATOR, ExecutionState.ACT_OK, msg);

          return new ActionResult({
            extractedContent: JSON.stringify(result),
            includeInMemory: true,
          });
        } catch (error) {
          const errorMsg = `Failed to verify checklist: ${error instanceof Error ? error.message : String(error)}`;
          this.context.emitEvent(Actors.NAVIGATOR, ExecutionState.ACT_FAIL, errorMsg);
          return new ActionResult({
            error: errorMsg,
            includeInMemory: true,
          });
        }
      },
      verifyDocumentChecklistActionSchema,
    );
    actions.push(verifyDocumentChecklist);

    const navigateToFolder = new Action(async (input: z.infer<typeof navigateToFolderActionSchema.schema>) => {
      const intent = input.intent || `Navigating to folder: ${input.folderName}`;
      this.context.emitEvent(Actors.NAVIGATOR, ExecutionState.ACT_START, intent);

      try {
        const page = await this.context.browserContext.getCurrentPage();

        switch (input.navigationMethod) {
          case 'click':
            // Look for folder with matching name in current view
            const state = await page.getState();
            let folderElement = null;

            if (state?.selectorMap) {
              for (const [index, element] of state.selectorMap) {
                const text = element.text?.trim() || '';
                const ariaLabel = element.ariaLabel?.trim() || '';

                if (
                  (text.toLowerCase().includes(input.folderName.toLowerCase()) ||
                    ariaLabel.toLowerCase().includes(input.folderName.toLowerCase())) &&
                  (element.tagName?.toLowerCase() === 'button' ||
                    element.tagName?.toLowerCase() === 'a' ||
                    ariaLabel.toLowerCase().includes('folder') ||
                    text.toLowerCase().includes('folder'))
                ) {
                  folderElement = index;
                  break;
                }
              }
            }

            if (folderElement) {
              await page.clickElement(folderElement);
              const msg = `Successfully navigated to folder: ${input.folderName}`;
              this.context.emitEvent(Actors.NAVIGATOR, ExecutionState.ACT_OK, msg);
              return new ActionResult({
                extractedContent: msg,
                includeInMemory: true,
              });
            }
            break;

          case 'search':
            // Use search functionality to find the folder
            await page.sendKeys('Control+f');
            await new Promise(resolve => setTimeout(resolve, 500));
            await page.sendKeys(input.folderName);
            break;

          case 'path':
            // Try to navigate using URL path (for file managers)
            const currentUrl = page.url();
            const newUrl = currentUrl.includes('?')
              ? currentUrl + `&path=${encodeURIComponent(input.folderName)}`
              : currentUrl + `?path=${encodeURIComponent(input.folderName)}`;
            await this.context.browserContext.navigateTo(newUrl);
            break;
        }

        const msg = `Attempted to navigate to folder: ${input.folderName}`;
        this.context.emitEvent(Actors.NAVIGATOR, ExecutionState.ACT_OK, msg);

        return new ActionResult({
          extractedContent: msg,
          includeInMemory: true,
        });
      } catch (error) {
        const errorMsg = `Failed to navigate to folder: ${error instanceof Error ? error.message : String(error)}`;
        this.context.emitEvent(Actors.NAVIGATOR, ExecutionState.ACT_FAIL, errorMsg);
        return new ActionResult({
          error: errorMsg,
          includeInMemory: true,
        });
      }
    }, navigateToFolderActionSchema);
    actions.push(navigateToFolder);

    const extractDocumentList = new Action(async (input: z.infer<typeof extractDocumentListActionSchema.schema>) => {
      const intent = input.intent || 'Extracting document list from current view';
      this.context.emitEvent(Actors.NAVIGATOR, ExecutionState.ACT_START, intent);

      try {
        const page = await this.context.browserContext.getCurrentPage();
        const state = await page.getState();

        const documents: Array<{
          name: string;
          index: number;
          metadata?: {
            size?: string;
            date?: string;
            type?: string;
          };
        }> = [];

        if (state?.selectorMap) {
          for (const [index, element] of state.selectorMap) {
            const text = element.text?.trim() || '';
            const ariaLabel = element.ariaLabel?.trim() || '';

            // Check if this looks like a document/file
            const isDocument =
              text.includes('.') ||
              ariaLabel.toLowerCase().includes('file') ||
              ariaLabel.toLowerCase().includes('document') ||
              element.xpath?.includes('file');

            if (isDocument && text) {
              // Filter by file types if specified
              if (input.filterFileTypes && input.filterFileTypes.length > 0) {
                const hasMatchingType = input.filterFileTypes.some(type =>
                  text.toLowerCase().includes(`.${type.toLowerCase()}`),
                );
                if (!hasMatchingType) continue;
              }

              const docInfo: any = {
                name: text,
                index: index,
              };

              if (input.includeMetadata) {
                // Try to extract metadata from surrounding elements
                docInfo.metadata = {
                  type: text.split('.').pop()?.toLowerCase() || 'unknown',
                  // Additional metadata could be extracted from sibling elements
                };
              }

              documents.push(docInfo);
            }
          }
        }

        // Sort documents based on requested criteria
        documents.sort((a, b) => {
          switch (input.sortBy) {
            case 'name':
              return a.name.localeCompare(b.name);
            case 'type':
              return (a.metadata?.type || '').localeCompare(b.metadata?.type || '');
            default:
              return 0;
          }
        });

        const msg = `Extracted ${documents.length} documents from current view`;
        this.context.emitEvent(Actors.NAVIGATOR, ExecutionState.ACT_OK, msg);

        return new ActionResult({
          extractedContent: JSON.stringify({
            documentCount: documents.length,
            documents: documents,
            sortBy: input.sortBy,
            filterFileTypes: input.filterFileTypes || ['all'],
          }),
          includeInMemory: true,
        });
      } catch (error) {
        const errorMsg = `Failed to extract document list: ${error instanceof Error ? error.message : String(error)}`;
        this.context.emitEvent(Actors.NAVIGATOR, ExecutionState.ACT_FAIL, errorMsg);
        return new ActionResult({
          error: errorMsg,
          includeInMemory: true,
        });
      }
    }, extractDocumentListActionSchema);
    actions.push(extractDocumentList);

    const generateMissingDocumentsReport = new Action(
      async (input: z.infer<typeof generateMissingDocumentsReportActionSchema.schema>) => {
        const intent = input.intent || 'Generating missing documents report';
        this.context.emitEvent(Actors.NAVIGATOR, ExecutionState.ACT_START, intent);

        try {
          const report: any = {
            timestamp: new Date().toISOString(),
            summary: {
              totalRequired: input.checklist.length,
              totalFound: input.foundDocuments.length,
              totalMissing: input.missingDocuments.length,
              completionPercentage: Math.round((input.foundDocuments.length / input.checklist.length) * 100),
            },
            foundDocuments: input.foundDocuments,
            missingDocuments: input.missingDocuments,
          };

          if (input.includeRecommendations) {
            report.recommendations = [
              'Search for alternative file names or extensions',
              'Check subdirectories for missing documents',
              'Verify if documents were moved to different locations',
              'Contact document owners for missing files',
              'Check if documents are in different formats (PDF vs DOCX)',
            ];
          }

          let formattedReport = '';

          switch (input.outputFormat) {
            case 'summary':
              formattedReport = `Document Checklist Summary:
✅ Found: ${report.summary.totalFound}/${report.summary.totalRequired} (${report.summary.completionPercentage}%)
❌ Missing: ${report.summary.totalMissing} documents`;
              break;

            case 'structured':
              formattedReport = JSON.stringify(report, null, 2);
              break;

            case 'detailed':
            default:
              formattedReport = `📋 DOCUMENT CHECKLIST REPORT
Generated: ${report.timestamp}

📊 SUMMARY:
• Total Required: ${report.summary.totalRequired}
• Found: ${report.summary.totalFound}
• Missing: ${report.summary.totalMissing}
• Completion: ${report.summary.completionPercentage}%

✅ FOUND DOCUMENTS (${report.summary.totalFound}):
${input.foundDocuments.map(doc => `• ${doc}`).join('\n')}

❌ MISSING DOCUMENTS (${report.summary.totalMissing}):
${input.missingDocuments.map(doc => `• ${doc}`).join('\n')}

${input.includeRecommendations ? `\n💡 RECOMMENDATIONS:\n${report.recommendations.map((rec: string) => `• ${rec}`).join('\n')}` : ''}`;
              break;
          }

          const msg = `Generated missing documents report: ${report.summary.completionPercentage}% complete`;
          this.context.emitEvent(Actors.NAVIGATOR, ExecutionState.ACT_OK, msg);

          return new ActionResult({
            extractedContent: formattedReport,
            includeInMemory: true,
          });
        } catch (error) {
          const errorMsg = `Failed to generate report: ${error instanceof Error ? error.message : String(error)}`;
          this.context.emitEvent(Actors.NAVIGATOR, ExecutionState.ACT_FAIL, errorMsg);
          return new ActionResult({
            error: errorMsg,
            includeInMemory: true,
          });
        }
      },
      generateMissingDocumentsReportActionSchema,
    );
    actions.push(generateMissingDocumentsReport);

    return actions;
  }
}
