# Nanobrowser Architecture Documentation

## Overview

Nanobrowser is an open-source AI web automation Chrome extension that implements a sophisticated multi-agent system for browser automation. It serves as a free alternative to OpenAI Operator, running entirely locally in the browser with support for multiple LLM providers.

## Core Architecture

### 1. Project Structure

The project is organized as a **monorepo** using **Turbo** for build orchestration and **pnpm workspaces**:

```
nanobrowser/
├── chrome-extension/          # Main Chrome extension
│   └── src/background/        # Background service worker
│       ├── agent/            # Multi-agent system
│       ├── browser/          # Browser automation layer
│       └── services/         # Core services
├── pages/                    # UI Components
│   ├── side-panel/          # Main chat interface
│   ├── options/             # Settings page
│   └── content/             # Content scripts
└── packages/                # Shared libraries
    ├── shared/              # Common utilities
    ├── storage/             # Extension storage
    ├── ui/                  # React components
    └── i18n/                # Internationalization
```

### 2. Multi-Agent System Architecture

The core innovation of Nanobrowser is its **multi-agent system** consisting of three specialized AI agents that collaborate to execute complex web automation tasks:

#### 2.1 Navigator Agent (`chrome-extension/src/background/agent/agents/navigator.ts`)

**Role**: Handles low-level DOM interactions and web navigation

**Key Responsibilities**:
- Executes specific browser actions (click, type, scroll, navigate)
- Interprets LLM outputs into concrete browser actions
- Manages browser state and DOM manipulation
- Handles action execution with retry logic and error handling

**Action Registry**: Maintains a registry of available actions:
- `clickElement` - Click on DOM elements by index
- `inputText` - Input text into form fields
- `goToUrl` - Navigate to URLs
- `searchGoogle` - Perform Google searches
- `scrollToText` - Scroll to specific text content
- `switchTab` / `openTab` / `closeTab` - Tab management
- `selectDropdownOption` - Dropdown interactions
- `sendKeys` - Keyboard input
- `done` - Mark task completion

**Browser State Management**:
- Captures and caches browser state including DOM tree
- Assigns unique indices to clickable elements
- Tracks element changes and updates indices for replay functionality

#### 2.2 Planner Agent (`chrome-extension/src/background/agent/agents/planner.ts`)

**Role**: High-level task planning and strategic decision making

**Key Responsibilities**:
- Analyzes overall task progress and context
- Makes strategic decisions about task completion
- Validates Navigator's work and provides course correction
- Determines when tasks are complete

**Output Schema**:
```typescript
{
  observation: string,      // Current state analysis
  challenges: string,       // Identified obstacles
  done: boolean,           // Task completion status
  next_steps: string,      // Strategic guidance
  final_answer: string,    // Task completion summary
  reasoning: string,       // Decision rationale
  web_task: boolean       // Task type classification
}
```

**Planning Interval**: Runs periodically (every 3 steps by default) to provide oversight and guidance.

#### 2.3 Executor (`chrome-extension/src/background/agent/executor.ts`)

**Role**: Orchestrates the multi-agent system and manages execution flow

**Key Responsibilities**:
- Coordinates between Navigator and Planner agents
- Manages execution state (running, paused, stopped)
- Handles error recovery and retry logic
- Tracks task history for replay functionality
- Emits execution events for UI updates

**Execution Flow**:
1. Initialize task with user input
2. Run Planner for strategic guidance (periodic)
3. Execute Navigator actions
4. Check for task completion
5. Repeat until task is complete or max steps reached

### 3. Browser Context Layer (`chrome-extension/src/background/browser/context.ts`)

**Role**: Abstracts browser interactions and manages browser state

**Key Components**:

#### 3.1 Page Management
- Manages Chrome tabs and Puppeteer page attachments
- Handles navigation, tab switching, and page lifecycle
- Implements URL allowlist/denylist for security

#### 3.2 DOM Processing (`chrome-extension/src/background/browser/dom/`)
- **Service**: Processes DOM trees and assigns interaction indices
- **Views**: Represents browser state with clickable elements
- **History**: Tracks element changes for replay functionality
- **Clickable Service**: Identifies and filters interactive elements

#### 3.3 Security Layer (`chrome-extension/src/background/services/guardrails/`)
- **Sanitizer**: Prevents injection attacks and malicious content
- **Patterns**: Defines blocked content patterns
- **Guardrails**: Implements security policies

### 4. User Interface Architecture

#### 4.1 Side Panel (`pages/side-panel/`)
- **React + TypeScript + Tailwind CSS**
- Real-time chat interface with the AI system
- Task execution monitoring with live status updates
- Conversation history management
- Settings integration for model configuration

#### 4.2 Options Page (`pages/options/`)
- **React + TypeScript**
- LLM provider configuration (OpenAI, Anthropic, Gemini, etc.)
- Agent model assignment (different models for Navigator vs Planner)
- Security and guardrail settings

#### 4.3 Content Scripts (`pages/content/`)
- Injected into web pages for DOM manipulation
- Provides interface between extension and page content
- Handles element highlighting and interaction feedback

### 5. Message Flow Architecture

#### 5.1 Message Manager (`chrome-extension/src/background/agent/messages/service.ts`)
- Manages conversation history between agents and user
- Implements token limit management for LLM context windows
- Handles message formatting and state synchronization

#### 5.2 Event System (`chrome-extension/src/background/agent/event/`)
- **Event Manager**: Pub/sub system for execution events
- **Event Types**: Hierarchical event classification (Task/Step/Action levels)
- **Real-time Updates**: Streams execution status to UI

#### 5.3 Communication Flow
```
User Input → Side Panel → Background Script → Agent System → Browser Actions → DOM Updates → State Feedback → UI Updates
```

### 6. Storage and Persistence

#### 6.1 Extension Storage (`packages/storage/`)
- **Chat History**: Conversation persistence across sessions
- **Agent History**: Action history for replay functionality
- **Settings**: User preferences and API configurations
- **Cache**: Browser state and element mappings

#### 6.2 Replay System
- Records all agent actions with DOM context
- Enables task reproduction and debugging
- Handles element index updates for dynamic pages
- Supports partial replay with error recovery

### 7. LLM Integration

#### 7.1 Multi-Provider Support
- **LangChain.js** integration for provider abstraction
- Support for OpenAI, Anthropic, Google Gemini, Ollama, Groq, Cerebras
- Structured output parsing with fallback mechanisms
- Custom provider support via OpenAI-compatible APIs

#### 7.2 Prompt Engineering
- **Base Prompts** (`chrome-extension/src/background/agent/prompts/`):
  - Navigator prompts for action-oriented tasks
  - Planner prompts for strategic thinking
  - Template-based prompt composition

#### 7.3 Context Management
- Dynamic context window management
- Message truncation and summarization
- Vision support for screenshot-based reasoning
- Memory optimization for long conversations

### 8. Build and Development System

#### 8.1 Build Pipeline
- **Turbo**: Monorepo task orchestration with caching
- **Vite**: Module bundling for all workspaces
- **TypeScript**: Type safety across the entire codebase
- **ESLint + Prettier**: Code quality and formatting

#### 8.2 Development Workflow
- Hot reload for extension development
- Workspace-scoped commands for efficiency
- Automated version management
- Extension packaging and distribution

### 9. Security Architecture

#### 9.1 Content Security Policy
- Strict CSP implementation for extension security
- Isolated execution contexts for different components
- Secure message passing between contexts

#### 9.2 Input Validation
- Zod schema validation for all agent inputs/outputs
- URL allowlist/denylist enforcement
- Sanitization of user content and LLM outputs
- Prevention of code injection attacks

#### 9.3 Privacy Design
- Local execution - no data sent to third-party services
- User-controlled API keys
- Optional telemetry with user consent
- No credential harvesting or bulk data collection

### 10. Extension Manifest and Permissions

#### 10.1 Manifest V3 Configuration
```javascript
{
  manifest_version: 3,
  permissions: [
    'storage',        // Local data storage
    'scripting',      // Content script injection
    'tabs',           // Tab management
    'debugger',       // Puppeteer integration
    'webNavigation'   // Navigation events
  ],
  host_permissions: ['<all_urls>'] // Universal web access
}
```

#### 10.2 Content Scripts
- Injected into all web pages
- Provides DOM manipulation capabilities
- Handles element highlighting and user feedback

### 11. Key Design Principles

#### 11.1 Modularity
- Clean separation between agents, browser layer, and UI
- Pluggable action system for easy extension
- Provider-agnostic LLM integration

#### 11.2 Robustness
- Comprehensive error handling and recovery
- Retry mechanisms for failed actions
- Graceful degradation for unsupported features

#### 11.3 Observability
- Detailed logging throughout the system
- Real-time execution monitoring
- Historical task replay for debugging

#### 11.4 Extensibility
- Plugin architecture for custom actions
- Configurable agent behaviors
- Support for custom LLM providers

## Technical Innovation

### 1. Multi-Agent Coordination
The separation of concerns between Navigator (execution) and Planner (strategy) allows for more sophisticated reasoning while maintaining execution reliability.

### 2. DOM State Management
Advanced DOM tree processing with element indexing enables reliable element targeting across dynamic page changes.

### 3. Replay System
Complete action history with context enables debugging, task reproduction, and potential future features like task templates.

### 4. Local-First Architecture
Everything runs in the browser without requiring cloud services, ensuring privacy and reducing latency.

## Conclusion

Nanobrowser represents a sophisticated approach to AI web automation, combining multi-agent AI systems with robust browser automation technology. Its architecture prioritizes modularity, security, and user control while providing powerful automation capabilities through natural language interaction.

The system's design enables complex web tasks to be broken down into strategic planning (Planner) and tactical execution (Navigator), coordinated by a robust execution engine that handles errors, provides observability, and maintains conversation context across complex multi-step workflows.