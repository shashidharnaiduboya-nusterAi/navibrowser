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

export const googleDriveDirectAccessActionSchema: ActionSchema = {
  name: 'google_drive_direct_access',
  description:
    'ULTRA-FAST Google Drive direct access using search URLs and keyboard shortcuts. Bypasses all UI clicking by using Google Drive URL patterns and Ctrl+F browser search for instant file/folder access.',
  schema: z.object({
    intent: z.string().default('').describe('purpose of this action'),
    searchTerms: z
      .array(z.string())
      .describe('search terms to try in sequence (e.g., ["site105/patient001", "patient001", "site105"])'),
    targetFiles: z.array(z.string()).optional().describe('specific files to look for in the directory'),
    useUrlNavigation: z.boolean().default(true).describe('use direct URL navigation when possible'),
    useKeyboardShortcuts: z.boolean().default(true).describe('use Ctrl+F and keyboard shortcuts for instant search'),
  }),
};

export const sharepointDocumentScanActionSchema: ActionSchema = {
  name: 'sharepoint_document_scan',
  description:
    'FAST document verification in SharePoint directories. Scans ONLY what is currently visible on screen for specific documents and generates a comprehensive status table. Does NOT navigate - only analyzes current view.',
  schema: z.object({
    intent: z.string().default('').describe('purpose of this action'),
    requiredDocuments: z
      .array(z.string())
      .describe('list of required document names to check for (e.g., ["ICF", "CV", "training records"])'),
    directoryContext: z.string().describe('context about the directory being scanned (e.g., "Patient 01 in Site 105")'),
    generateTable: z.boolean().default(true).describe('generate a formatted table of document status'),
    exactMatchOnly: z.boolean().default(true).describe('only count exact matches, no similar names'),
  }),
};

export const sharepointPatientCheckActionSchema: ActionSchema = {
  name: 'sharepoint_patient_check',
  description:
    'SCREEN-BASED patient document verification in SharePoint. Analyzes ONLY what is currently visible on screen to check for required documents. Does NOT search or navigate - only examines current folder contents exactly as displayed.',
  schema: z.object({
    intent: z.string().default('').describe('purpose of this action'),
    siteId: z.string().describe('site identifier visible on screen (e.g., "Site 105")'),
    patientId: z.string().describe('patient identifier visible on screen (e.g., "Patient 01")'),
    requiredDocuments: z
      .array(z.string())
      .describe('list of required document names to check for (e.g., ["ICF", "CV", "training records"])'),
    screenAnalysisOnly: z.boolean().default(true).describe('only analyze what is currently visible, no navigation'),
  }),
};

export const sharepointMultiPatientCheckActionSchema: ActionSchema = {
  name: 'sharepoint_multi_patient_check',
  description:
    'SCREEN-BASED multi-patient document verification for SharePoint. Analyzes current visible folder structure to identify all patient folders and their document status. Perfect for site-level compliance checking. Does NOT navigate - only analyzes current screen.',
  schema: z.object({
    intent: z.string().default('').describe('purpose of this action'),
    siteId: z.string().describe('site identifier visible on screen (e.g., "Site 105")'),
    requiredDocuments: z
      .array(z.string())
      .describe('list of required document names to check for each patient (e.g., ["ICF", "CV", "training records"])'),
    generateSummaryTable: z
      .boolean()
      .default(true)
      .describe('generate a comprehensive table showing all patients and their document status'),
    screenAnalysisOnly: z.boolean().default(true).describe('only analyze what is currently visible, no navigation'),
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

export const smartScrollSearchActionSchema: ActionSchema = {
  name: 'smart_scroll_search',
  description:
    'INTELLIGENT scrolling and searching action for finding specific elements on a page. Automatically scrolls through the page while searching for target text or elements. Perfect for finding folders, files, or specific content that may not be currently visible. Much more effective than manual scrolling when looking for specific items.',
  schema: z.object({
    intent: z.string().default('').describe('purpose of this action'),
    searchText: z.string().describe('text to search for while scrolling (e.g., "Clinical trial sites", "patient001")'),
    maxScrolls: z.number().int().default(5).describe('maximum number of scroll attempts (default: 5)'),
    scrollDirection: z.enum(['down', 'up']).default('down').describe('direction to scroll'),
    scrollAmount: z.enum(['small', 'medium', 'large']).default('medium').describe('amount to scroll each time'),
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

// Enhanced Visual-First Actions for Performance
export const visualClickActionSchema: ActionSchema = {
  name: 'visual_click',
  description:
    'FAST visual-first click action that uses screenshot analysis to identify and click elements without waiting for DOM parsing. Much faster than click_element for simple interactions.',
  schema: z.object({
    intent: z.string().default('').describe('purpose of this action'),
    target: z
      .string()
      .describe('visual description of element to click (e.g., "blue Submit button", "search icon", "Login link")'),
    confidence: z.number().min(0).max(1).default(0.8).describe('confidence threshold for element detection'),
    waitAfterClick: z.number().default(0.5).describe('seconds to wait after clicking'),
  }),
};

export const visualScrollActionSchema: ActionSchema = {
  name: 'visual_scroll',
  description:
    'FAST visual-first scrolling that immediately scrolls without DOM analysis. Use this for quick navigation when you need to find content fast.',
  schema: z.object({
    intent: z.string().default('').describe('purpose of this action'),
    direction: z.enum(['up', 'down', 'left', 'right']).describe('scroll direction'),
    amount: z.enum(['small', 'medium', 'large', 'page']).default('medium').describe('scroll distance'),
    speed: z.enum(['fast', 'normal', 'slow']).default('fast').describe('scroll speed for performance'),
  }),
};

export const visualInputActionSchema: ActionSchema = {
  name: 'visual_input',
  description:
    'FAST visual-first text input that identifies input fields visually and types without DOM parsing delays. Much faster than input_text.',
  schema: z.object({
    intent: z.string().default('').describe('purpose of this action'),
    target: z
      .string()
      .describe('visual description of input field (e.g., "search box", "username field", "password input")'),
    text: z.string().describe('text to input'),
    clearFirst: z.boolean().default(true).describe('clear field before typing'),
    confidence: z.number().min(0).max(1).default(0.8).describe('confidence threshold for field detection'),
  }),
};

export const visualScanActionSchema: ActionSchema = {
  name: 'visual_scan',
  description:
    'FAST visual-first content scanning that quickly analyzes the current screen for specific elements or content without building DOM tree. Returns visual elements found.',
  schema: z.object({
    intent: z.string().default('').describe('purpose of this action'),
    searchFor: z
      .array(z.string())
      .describe('visual elements to look for (e.g., ["buttons", "input fields", "links", "images"])'),
    includeText: z.boolean().default(true).describe('include text content in scan results'),
    includeImages: z.boolean().default(false).describe('include image elements'),
    fastMode: z.boolean().default(true).describe('use fast visual detection (recommended)'),
  }),
};

export const visualNavigateActionSchema: ActionSchema = {
  name: 'visual_navigate',
  description:
    'FAST visual-first navigation that combines quick scrolling and visual scanning to find content rapidly. Ideal for exploring pages efficiently.',
  schema: z.object({
    intent: z.string().default('').describe('purpose of this action'),
    searchTarget: z
      .string()
      .describe('what to look for while navigating (e.g., "download button", "contact form", "pricing table")'),
    maxScrolls: z.number().default(5).describe('maximum number of scroll attempts'),
    scrollDirection: z.enum(['down', 'up']).default('down').describe('primary scroll direction'),
    returnOnFirst: z.boolean().default(true).describe('stop on first match found'),
  }),
};

// Hybrid Smart Actions that auto-select best approach
export const smartClickActionSchema: ActionSchema = {
  name: 'smart_click',
  description:
    'HYBRID smart clicking that automatically chooses between visual-first (fast) or DOM-based (precise) clicking based on page complexity and element visibility. Best of both worlds.',
  schema: z.object({
    intent: z.string().default('').describe('purpose of this action'),
    target: z.string().describe('element to click - can be visual description OR text content'),
    index: z.number().int().optional().describe('DOM index if known (optional)'),
    preferVisual: z.boolean().default(true).describe('prefer visual approach when possible'),
    confidence: z.number().min(0).max(1).default(0.8).describe('confidence threshold for visual detection'),
  }),
};

export const smartInputActionSchema: ActionSchema = {
  name: 'smart_input',
  description:
    'HYBRID smart text input that automatically chooses between visual-first (fast) or DOM-based (precise) input based on field complexity. Optimizes for speed while maintaining accuracy.',
  schema: z.object({
    intent: z.string().default('').describe('purpose of this action'),
    target: z.string().describe('input field to target - can be visual description OR text content'),
    text: z.string().describe('text to input'),
    index: z.number().int().optional().describe('DOM index if known (optional)'),
    clearFirst: z.boolean().default(true).describe('clear field before typing'),
    preferVisual: z.boolean().default(true).describe('prefer visual approach when possible'),
  }),
};
