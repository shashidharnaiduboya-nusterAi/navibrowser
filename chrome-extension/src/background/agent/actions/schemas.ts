import { z } from 'zod';

export interface ActionSchema {
  name: string;
  description: string;
  schema: z.ZodType;
}

export const doneActionSchema: ActionSchema = {
  name: 'done',
  description: 'Complete task',
  schema: z.object({
    text: z.string(),
    success: z.boolean(),
  }),
};

// Basic Navigation Actions
export const searchGoogleActionSchema: ActionSchema = {
  name: 'search_google',
  description:
    'Search the query in Google in the current tab, the query should be a search query like humans search in Google, concrete and not vague or super long. More the single most important items.',
  schema: z.object({
    intent: z.string().default('').describe('purpose of this action'),
    query: z.string(),
  }),
};

export const goToUrlActionSchema: ActionSchema = {
  name: 'go_to_url',
  description: 'Navigate to URL in the current tab',
  schema: z.object({
    intent: z.string().default('').describe('purpose of this action'),
    url: z.string(),
  }),
};

export const goBackActionSchema: ActionSchema = {
  name: 'go_back',
  description: 'Go back to the previous page',
  schema: z.object({
    intent: z.string().default('').describe('purpose of this action'),
  }),
};

export const clickElementActionSchema: ActionSchema = {
  name: 'click_element',
  description: 'Click element by index',
  schema: z.object({
    intent: z.string().default('').describe('purpose of this action'),
    index: z.number().int().describe('index of the element'),
    xpath: z.string().nullable().optional().describe('xpath of the element'),
  }),
};

export const doubleClickElementActionSchema: ActionSchema = {
  name: 'double_click_element',
  description:
    'Double-click element by index. Use this for opening folders, files, or activating items that require double-click (especially useful for file managers and desktop-like interfaces)',
  schema: z.object({
    intent: z.string().default('').describe('purpose of this action'),
    index: z.number().int().describe('index of the element'),
    xpath: z.string().nullable().optional().describe('xpath of the element'),
  }),
};

export const inputTextActionSchema: ActionSchema = {
  name: 'input_text',
  description: 'Input text into an interactive input element',
  schema: z.object({
    intent: z.string().default('').describe('purpose of this action'),
    index: z.number().int().describe('index of the element'),
    text: z.string().describe('text to input'),
    xpath: z.string().nullable().optional().describe('xpath of the element'),
  }),
};

// Tab Management Actions
export const switchTabActionSchema: ActionSchema = {
  name: 'switch_tab',
  description: 'Switch to tab by tab id',
  schema: z.object({
    intent: z.string().default('').describe('purpose of this action'),
    tab_id: z.number().int().describe('id of the tab to switch to'),
  }),
};

export const openTabActionSchema: ActionSchema = {
  name: 'open_tab',
  description: 'Open URL in new tab',
  schema: z.object({
    intent: z.string().default('').describe('purpose of this action'),
    url: z.string().describe('url to open'),
  }),
};

export const closeTabActionSchema: ActionSchema = {
  name: 'close_tab',
  description: 'Close tab by tab id',
  schema: z.object({
    intent: z.string().default('').describe('purpose of this action'),
    tab_id: z.number().int().describe('id of the tab'),
  }),
};

// Content Actions, not used currently
// export const extractContentActionSchema: ActionSchema = {
//   name: 'extract_content',
//   description:
//     'Extract page content to retrieve specific information from the page, e.g. all company names, a specific description, all information about, links with companies in structured format or simply links',
//   schema: z.object({
//     goal: z.string(),
//   }),
// };

// Cache Actions
export const cacheContentActionSchema: ActionSchema = {
  name: 'cache_content',
  description: 'Cache what you have found so far from the current page for future use',
  schema: z.object({
    intent: z.string().default('').describe('purpose of this action'),
    content: z.string().describe('content to cache'),
  }),
};

export const scrollToPercentActionSchema: ActionSchema = {
  name: 'scroll_to_percent',
  description:
    'Scrolls to a particular vertical percentage of the document or an element. If no index of element is specified, scroll the whole document.',
  schema: z.object({
    intent: z.string().default('').describe('purpose of this action'),
    yPercent: z.number().int().describe('percentage to scroll to - min 0, max 100; 0 is top, 100 is bottom'),
    index: z.number().int().nullable().optional().describe('index of the element'),
  }),
};

export const scrollToTopActionSchema: ActionSchema = {
  name: 'scroll_to_top',
  description: 'Scroll the document in the window or an element to the top',
  schema: z.object({
    intent: z.string().default('').describe('purpose of this action'),
    index: z.number().int().nullable().optional().describe('index of the element'),
  }),
};

export const scrollToBottomActionSchema: ActionSchema = {
  name: 'scroll_to_bottom',
  description: 'Scroll the document in the window or an element to the bottom',
  schema: z.object({
    intent: z.string().default('').describe('purpose of this action'),
    index: z.number().int().nullable().optional().describe('index of the element'),
  }),
};

export const previousPageActionSchema: ActionSchema = {
  name: 'previous_page',
  description:
    'Scroll the document in the window or an element to the previous page. If no index is specified, scroll the whole document.',
  schema: z.object({
    intent: z.string().default('').describe('purpose of this action'),
    index: z.number().int().nullable().optional().describe('index of the element'),
  }),
};

export const nextPageActionSchema: ActionSchema = {
  name: 'next_page',
  description:
    'Scroll the document in the window or an element to the next page. If no index is specified, scroll the whole document.',
  schema: z.object({
    intent: z.string().default('').describe('purpose of this action'),
    index: z.number().int().nullable().optional().describe('index of the element'),
  }),
};

export const scrollToTextActionSchema: ActionSchema = {
  name: 'scroll_to_text',
  description: 'If you dont find something which you want to interact with in current viewport, try to scroll to it',
  schema: z.object({
    intent: z.string().default('').describe('purpose of this action'),
    text: z.string().describe('text to scroll to'),
    nth: z
      .number()
      .int()
      .min(1)
      .default(1)
      .describe('which occurrence of the text to scroll to (1-indexed, default: 1)'),
  }),
};

export const searchGoogleDriveActionSchema: ActionSchema = {
  name: 'search_google_drive',
  description:
    'PREFERRED ACTION for finding files in Google Drive. Use this instead of manually browsing folders when looking for specific files. This action navigates to Google Drive (if not already there) and performs a search using the internal Google Drive search functionality. Much more efficient than clicking through folders manually.',
  schema: z.object({
    intent: z.string().default('').describe('purpose of this action'),
    query: z.string().describe('search query for files/folders in Google Drive (e.g., "order.csv", "*.csv", "budget")'),
    waitForResults: z.boolean().default(true).describe('whether to wait for search results to load'),
  }),
};

export const searchInPageActionSchema: ActionSchema = {
  name: 'search_in_page',
  description:
    'Universal search action for finding content within any webpage or application. Automatically detects and uses the most appropriate search method: search boxes, Ctrl+F, or application-specific search interfaces. Works across all platforms including cloud storage (Google Drive, Dropbox, OneDrive), file managers, and websites.',
  schema: z.object({
    intent: z.string().default('').describe('purpose of this action'),
    query: z.string().describe('search query (e.g., "order.csv", "budget report", "specific text")'),
    searchType: z
      .enum(['auto', 'search_box', 'ctrl_f', 'platform_specific'])
      .default('auto')
      .describe('search method to use - auto detects best option'),
    waitForResults: z.boolean().default(true).describe('whether to wait for search results to load'),
  }),
};

export const sendKeysActionSchema: ActionSchema = {
  name: 'send_keys',
  description:
    'Send strings of special keys like Backspace, Insert, PageDown, Delete, Enter. Shortcuts such as `Control+o`, `Control+Shift+T` are supported as well. This gets used in keyboard press. Be aware of different operating systems and their shortcuts',
  schema: z.object({
    intent: z.string().default('').describe('purpose of this action'),
    keys: z.string().describe('keys to send'),
  }),
};

export const getDropdownOptionsActionSchema: ActionSchema = {
  name: 'get_dropdown_options',
  description: 'Get all options from a native dropdown',
  schema: z.object({
    intent: z.string().default('').describe('purpose of this action'),
    index: z.number().int().describe('index of the dropdown element'),
  }),
};

export const selectDropdownOptionActionSchema: ActionSchema = {
  name: 'select_dropdown_option',
  description: 'Select dropdown option for interactive element index by the text of the option you want to select',
  schema: z.object({
    intent: z.string().default('').describe('purpose of this action'),
    index: z.number().int().describe('index of the dropdown element'),
    text: z.string().describe('text of the option'),
  }),
};

export const waitActionSchema: ActionSchema = {
  name: 'wait',
  description: 'Wait for x seconds default 3, do NOT use this action unless user asks to wait explicitly',
  schema: z.object({
    intent: z.string().default('').describe('purpose of this action'),
    seconds: z.number().int().default(3).describe('amount of seconds'),
  }),
};

// Document and Folder Verification Actions
export const scanFolderForDocumentsActionSchema: ActionSchema = {
  name: 'scan_folder_for_documents',
  description:
    'Scan a folder or directory (local file system, cloud storage like Google Drive, Dropbox, etc.) to inventory all documents and files. Works with file managers, cloud storage interfaces, and any folder-like interface.',
  schema: z.object({
    intent: z.string().default('').describe('purpose of this action'),
    folderPath: z.string().optional().describe('path or name of the folder to scan (if known)'),
    recursive: z.boolean().default(false).describe('whether to scan subfolders recursively'),
    fileTypes: z
      .array(z.string())
      .optional()
      .describe('specific file types to look for (e.g., ["pdf", "docx", "txt"])'),
    waitForLoad: z.boolean().default(true).describe('wait for folder contents to fully load'),
  }),
};

export const verifyDocumentChecklistActionSchema: ActionSchema = {
  name: 'verify_document_checklist',
  description:
    'Compare discovered documents against a required checklist and identify missing documents. Analyzes the current folder/directory contents against a provided list of required documents.',
  schema: z.object({
    intent: z.string().default('').describe('purpose of this action'),
    requiredDocuments: z.array(z.string()).describe('list of required document names or patterns'),
    discoveredDocuments: z.array(z.string()).describe('list of documents found in the current scan'),
    matchingStrategy: z
      .enum(['exact', 'contains', 'pattern'])
      .default('contains')
      .describe('how to match document names'),
    generateReport: z.boolean().default(true).describe('whether to generate a detailed missing documents report'),
  }),
};

export const navigateToFolderActionSchema: ActionSchema = {
  name: 'navigate_to_folder',
  description:
    'Navigate to a specific folder or directory in file managers, cloud storage (Google Drive, Dropbox, OneDrive), or file system interfaces. Handles both clicking folder icons and typing paths.',
  schema: z.object({
    intent: z.string().default('').describe('purpose of this action'),
    folderName: z.string().describe('name or path of the folder to navigate to'),
    navigationMethod: z.enum(['click', 'search', 'path']).default('click').describe('method to use for navigation'),
    createIfMissing: z.boolean().default(false).describe('create folder if it does not exist'),
  }),
};

export const extractDocumentListActionSchema: ActionSchema = {
  name: 'extract_document_list',
  description:
    'Extract and list all documents visible in the current folder/directory view. Works with file managers, cloud storage interfaces, and document listing pages.',
  schema: z.object({
    intent: z.string().default('').describe('purpose of this action'),
    includeMetadata: z.boolean().default(true).describe('include file size, date, type metadata'),
    filterFileTypes: z.array(z.string()).optional().describe('only include specific file types'),
    sortBy: z.enum(['name', 'date', 'size', 'type']).default('name').describe('how to sort the document list'),
  }),
};

export const generateMissingDocumentsReportActionSchema: ActionSchema = {
  name: 'generate_missing_documents_report',
  description:
    'Generate a comprehensive report of missing documents based on checklist verification. Provides structured output with missing items, found items, and recommendations.',
  schema: z.object({
    intent: z.string().default('').describe('purpose of this action'),
    checklist: z.array(z.string()).describe('original required documents checklist'),
    foundDocuments: z.array(z.string()).describe('documents that were found'),
    missingDocuments: z.array(z.string()).describe('documents that are missing'),
    includeRecommendations: z.boolean().default(true).describe('include suggestions for finding missing documents'),
    outputFormat: z.enum(['structured', 'summary', 'detailed']).default('detailed').describe('format of the report'),
  }),
};
