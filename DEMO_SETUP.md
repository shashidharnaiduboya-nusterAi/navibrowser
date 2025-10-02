# Nanobrowser Demo Setup Guide

## Quick Demo Installation (No Chrome Store Required)

### Method 1: Load Unpacked Extension (Recommended)

1. **Build the extension**:
   ```bash
   cd nanobrowser
   pnpm install
   pnpm build
   ```

2. **Install in Chrome**:
   - Open `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)
   - Click "Load unpacked"
   - Select the `nanobrowser/dist` folder
   - Extension icon should appear in toolbar

3. **Verify installation**:
   - Click the Nanobrowser icon
   - Side panel should open
   - Configure API keys in Settings

### Method 2: Development Mode (For Active Development)

1. **Start development server**:
   ```bash
   pnpm dev
   ```

2. **Load unpacked** as above, but extension will auto-reload on code changes

### Method 3: Distribution Package

1. **Create distribution zip**:
   ```bash
   pnpm zip
   ```

2. **Share the zip file**:
   - Send `dist-zip/nanobrowser.zip` to others
   - They can extract and load unpacked
   - No Chrome Store required

## Cloud Storage Demo Workflow

### Testing Google Drive Navigation

1. **Before improvements** - Document current limitations:
   ```
   1. Navigate to https://drive.google.com
   2. Try: "Find my documents folder and list the files"
   3. Observe: Agent loses track of elements, fails on dynamic content
   ```

2. **After improvements** - Show enhanced capabilities:
   ```
   1. Load improved extension
   2. Same task: "Find my documents folder and list the files"
   3. Demonstrate: Proper SPA navigation, dynamic content handling
   ```

### Demo Script for Cloud Storage

```javascript
// Add to ActionBuilder for demo
const waitForDynamicContent = new Action(async (input) => {
  // Wait for network requests to complete
  await new Promise(resolve => {
    const checkLoading = () => {
      if (!document.querySelector('.loading-spinner')) {
        resolve();
      } else {
        setTimeout(checkLoading, 100);
      }
    };
    checkLoading();
  });
  
  return new ActionResult({
    extractedContent: "Dynamic content loaded",
    includeInMemory: true
  });
}, waitForDynamicContentSchema);
```

## Performance Comparison Demo

### Metrics to Track:
1. **Success Rate**: Tasks completed successfully
2. **Element Targeting**: Accuracy of element identification
3. **Dynamic Content**: Handling of loading states
4. **Navigation**: SPA route changes
5. **Error Recovery**: Graceful handling of failures

### Demo Scenarios:

#### Scenario 1: File Search
- **Task**: "Find all PDF files in my Drive"
- **Before**: Fails on dynamic loading
- **After**: Successfully navigates and searches

#### Scenario 2: Folder Navigation
- **Task**: "Open the 'Projects' folder and find the latest file"
- **Before**: Lost on folder navigation
- **After**: Handles SPA navigation correctly

#### Scenario 3: File Operations
- **Task**: "Share the presentation file with view permissions"
- **Before**: Cannot handle complex interactions
- **After**: Completes multi-step workflows

## Development Workflow for Demos

### 1. Quick Iteration Cycle
```bash
# Make changes to code
pnpm build
# Refresh extension in chrome://extensions/
# Test immediately
```

### 2. Real-time Development
```bash
# For active development
pnpm dev
# Extension auto-reloads on save
```

### 3. Testing Framework
```bash
# Run tests
pnpm -F chrome-extension test

# Type checking
pnpm type-check

# Linting
pnpm lint
```

## Demo Environment Setup

### Local Test Server
Create a local test environment that mimics cloud storage:

```html
<!-- demo-cloud-storage.html -->
<!DOCTYPE html>
<html>
<head>
    <title>Cloud Storage Demo</title>
</head>
<body>
    <div id="app">
        <!-- Simulated cloud storage interface -->
        <div class="file-grid" id="fileGrid">
            <!-- Dynamic content will be loaded here -->
        </div>
    </div>
    
    <script>
        // Simulate dynamic loading behavior
        setTimeout(() => {
            loadFiles();
        }, 1000);
        
        function loadFiles() {
            // Simulate file loading
        }
    </script>
</body>
</html>
```

### Extension Testing Checklist

- [ ] Extension loads without errors
- [ ] Side panel opens correctly
- [ ] API keys can be configured
- [ ] Basic navigation works
- [ ] Dynamic content detection works
- [ ] Error handling is graceful
- [ ] Performance is acceptable

## Sharing Demos

### Option 1: Screen Recording
- Record extension in action
- Show before/after comparison
- Highlight key improvements

### Option 2: Live Demo
- Load unpacked extension
- Demonstrate real-time functionality
- Show code changes and immediate effects

### Option 3: Packaged Demo
- Create demo package with:
  - Pre-built extension
  - Test files
  - Setup instructions
  - Demo script

## Troubleshooting

### Common Issues:
1. **Extension not loading**: Check manifest.json syntax
2. **API errors**: Verify API keys in settings
3. **DOM access issues**: Check content script injection
4. **Performance issues**: Monitor CPU/memory usage

### Debug Mode:
```bash
# Enable debug logging
pnpm dev # Includes debug flags
```

### Chrome DevTools:
- Background script debugging: chrome://extensions/ → "Inspect views: background page"
- Content script debugging: F12 on target page
- Extension popup debugging: Right-click extension icon → "Inspect popup"