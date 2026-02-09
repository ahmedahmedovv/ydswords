# YDS Words - AI Coding Agent Guide

## Project Overview

YDS Words is an iOS application designed for Turkish students preparing for the YDS (Yabancı Dil Sınavı - Foreign Language Exam). It's a vocabulary learning app that generates dynamic multiple-choice quiz questions using OpenAI's GPT-4o-mini model.

The app follows a hybrid architecture:
- **Native iOS Layer**: Thin Swift wrapper using UIKit + WebKit (WKWebView)
- **Application Layer**: HTML/CSS/JavaScript single-page application containing all UI, logic, and vocabulary data
- **AI Backend**: Netlify Function acting as a secure proxy to OpenAI API

## Technology Stack

### Native iOS Layer
- **Language**: Swift 5.0
- **Frameworks**: UIKit, WebKit
- **IDE**: Xcode 14.3+ (LastUpgradeCheck = 1430)
- **Minimum iOS Version**: iOS 14.0
- **Target Device**: iPhone (portrait only, `TARGETED_DEVICE_FAMILY = 1`)
- **Scene Support**: Single scene only (`UIApplicationSupportsMultipleScenes = false`)

### Web Application Layer
- **Frontend**: HTML5, CSS3, vanilla JavaScript (no frameworks)
- **Design System**: iOS Native Design System with SF Pro typography
- **Responsive Design**: Optimized for iPhone 13 Mini (375px width) with safe area support
- **Dark Mode**: Full support via CSS `prefers-color-scheme` media queries

### Backend / AI Integration
- **Platform**: Netlify Functions (serverless)
- **AI Model**: OpenAI GPT-4o-mini
- **API Proxy**: Node.js function (`generate-question.js`)
- **Security**: API key stored in Netlify environment variables (never exposed to client)

## Project Structure

```
YDSWords/
├── YDSWords.xcodeproj/              # Xcode project configuration
│   └── project.pbxproj              # Build settings and file references
├── YDSWords/
│   ├── AppDelegate.swift            # App lifecycle (@main entry point)
│   ├── SceneDelegate.swift          # Window scene management, iOS appearance config
│   ├── ViewController.swift         # WKWebView setup and delegate handling
│   ├── Info.plist                   # App metadata, ATS settings, orientation
│   ├── index.html                   # Main HTML file (SPA entry point)
│   ├── assets/
│   │   ├── css/styles.css           # iOS Design System styles (~2000 lines)
│   │   └── js/                      # JavaScript modules
│   │       ├── words.js             # ~1000 English vocabulary words/phrases
│   │       ├── config.js            # App configuration & prompt templates
│   │       ├── state.js             # Application state management
│   │       ├── api.js               # API functions (Netlify proxy calls)
│   │       ├── utils.js             # Utility functions (XSS, validation, circuit breaker)
│   │       ├── ui.js                # UI manipulation functions
│   │       └── app.js               # Main application logic & event handlers
│   └── Assets.xcassets/             # App icons (all iOS sizes)
│       └── AppIcon.appiconset/
│           ├── 1024.png, 120.png, 152.png, 167.png, 180.png
│           ├── 20.png, 29.png, 40.png, 58.png, 60.png, 76.png, 80.png, 87.png
│           └── Contents.json
├── netlify/
│   └── functions/
│       └── generate-question.js     # Secure Netlify Function (OpenAI proxy)
├── netlify.toml                     # Netlify configuration (functions, redirects, headers)
├── .env.example                     # Example environment variables template
├── .gitignore                       # Git ignore rules
└── DEPLOYMENT.md                    # Deployment guide for Netlify
```

## Key Components

### 1. AppDelegate.swift
- Entry point with `@main` decorator
- Minimal implementation - delegates to SceneDelegate for UI setup
- Handles app lifecycle events

### 2. SceneDelegate.swift
- Creates window programmatically (no storyboard: `UILaunchStoryboardName = ""
- Sets up navigation controller with hidden navigation bar
- Configures iOS system appearance with automatic dark mode support:
  - Uses `.systemBackground` and `.label` colors
  - Supports both light and dark color schemes

### 3. ViewController.swift
- Manages WKWebView with custom configuration
- Loads `index.html` from app bundle via `loadFileURL(_:allowingReadAccessTo:)`
- Handles navigation delegate methods for loading states
- Implements WKUIDelegate for JavaScript alerts/confirms/prompts
- Activity indicator for loading feedback
- Safe area layout support for iPhone notch
- Uses `.systemBackground` for automatic dark mode support

### 4. JavaScript Application Architecture

#### words.js
- `MYWORDS` array: ~1000 English vocabulary words and phrases for YDS exam
- Includes single words (e.g., "Abnormal", "Accelerate") and phrases (e.g., "Abide by", "Account for")
- Total of 1273 lines

#### config.js
- `CONFIG` object with OpenAI parameters (model, temperature, maxTokens)
- Timeout and retry configuration
- Circuit breaker settings
- `getPrompt(word)`: Generates detailed prompts for fill-in-the-blank questions with context-aware examples
- Supports multi-word expressions with special handling

#### state.js
- `AppState` singleton managing:
  - Score tracking (`correct`, `total`)
  - Current question and prefetched question
  - Request management (AbortController, loading states)
  - Circuit breaker state
  - Rate limiting timestamps

#### api.js
- `API_CONFIG.endpoint`: Points to Netlify function URL
- `fetchWithTimeout()`: AbortController-based timeout handling
- `generateQuestion()`: Main API call with retry logic and circuit breaker
- `prefetchQuestion()`: Background question prefetching for instant display
- Production endpoint: `https://ydswordsios.netlify.app/.netlify/functions/generate-question`

#### utils.js
- `sanitizeHtml()`: XSS protection via textContent/innerHTML
- `validateQuestion()`: Schema validation for API responses
- `debounce()`: Input rate limiting
- `checkRateLimit()`: Button click throttling
- `isCircuitOpen()`, `recordSuccess()`, `recordFailure()`: Circuit breaker implementation

#### ui.js
- `DOM` getter object for lazy element access
- `showNotification()`: Toast notification system
- `showApp()`, `showWelcome()`: View transitions
- `loadQuestion()`, `displayQuestion()`: Question flow management
- `selectAnswer()`: Answer handling with visual feedback
- Offline detection with indicator
- Fisher-Yates shuffle for answer options

#### app.js
- Global error handlers (`error`, `unhandledrejection` events)
- DOMContentLoaded initialization with validation
- Event listeners for all buttons (debounced)
- Keyboard shortcuts (A-E, 1-5, Enter, Escape)
- Page visibility change handling
- `APP_VERSION = '1.0.0'`

### 5. Netlify Function (generate-question.js)
Serverless function that acts as a secure proxy:
- Receives POST requests from iOS app with `{ prompt }` body
- Reads `OPENAI_API_KEY` from environment variables
- Forwards to OpenAI API with JSON response format
- Returns structured response to app
- CORS headers configured for cross-origin requests
- Model: `gpt-4o-mini` with temperature 0.8 and max_tokens 1024

### 6. CSS (styles.css)
iOS Design System implementation:
- CSS custom properties for iOS system colors
- Dark mode support via `prefers-color-scheme: dark`
- High contrast mode support
- Reduced motion support
- Safe area inset support (`env(safe-area-inset-*)`)
- Responsive breakpoints for iPhone 13 Mini (375px) and standard iPhone (390px)
- iOS-style components: buttons, cards, lists, toggles, inputs, segmented controls
- Spring animations and transitions matching iOS feel

## Build Configuration

### Xcode Project Settings (project.pbxproj)
```
PRODUCT_BUNDLE_IDENTIFIER = com.yourcompany.YDSWords
DEVELOPMENT_TEAM = 8A8XJBZ4CH
CURRENT_PROJECT_VERSION = 1
MARKETING_VERSION = 1.0
IPHONEOS_DEPLOYMENT_TARGET = 14.0
TARGETED_DEVICE_FAMILY = 1  (iPhone only)
SWIFT_VERSION = 5.0
CODE_SIGN_STYLE = Automatic
```

### Info.plist Key Settings
```xml
- UISupportedInterfaceOrientations: Portrait only on iPhone
- UISupportedInterfaceOrientations~ipad: All orientations on iPad
- NSAppTransportSecurity: NSAllowsArbitraryLoads = YES (required for AI API)
- UIApplicationSceneManifest: Supports multiple scenes = NO
- UILaunchStoryboardName: Empty string (programmatic UI)
- UIApplicationSupportsIndirectInputEvents: YES
```

### Netlify Configuration (netlify.toml)
```toml
[build]
  command = ""
  publish = "YDSWords/YDSWords"

[functions]
  directory = "netlify/functions"
  node_bundler = "esbuild"

[[redirects]]
  from = "/api/*"
  to = "/.netlify/functions/:splat"
  status = 200

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-Content-Type-Options = "nosniff"
    X-XSS-Protection = "1; mode=block"
    Referrer-Policy = "strict-origin-when-cross-origin"
```

## Build and Run Commands

### Via Xcode IDE
1. Open `YDSWords/YDSWords.xcodeproj` in Xcode 14.3 or later
2. Select target device/simulator
3. Press Cmd+R to build and run

### Via Command Line (xcodebuild)
```bash
# Build for simulator
cd YDSWords
xcodebuild -project YDSWords.xcodeproj -scheme YDSWords -destination 'platform=iOS Simulator,name=iPhone 15' build

# Build for device (requires signing)
xcodebuild -project YDSWords.xcodeproj -scheme YDSWords -destination 'platform=iOS,name=Your Device' build

# Archive for App Store
xcodebuild -project YDSWords.xcodeproj -scheme YDSWords -archivePath YDSWords.xcarchive archive
```

### Netlify Function Local Development
```bash
# Install Netlify CLI
npm install -g netlify-cli

# Create .env file
echo "OPENAI_API_KEY=sk-proj-..." > YDSWords/.env

# Start dev server
netlify dev

# Function available at: http://localhost:8888/.netlify/functions/generate-question
```

## Development Guidelines

### Modifying Native Code
- **AppDelegate.swift**: App lifecycle, deep linking
- **SceneDelegate.swift**: Window setup, appearance configuration (uses iOS system colors)
- **ViewController.swift**: WebView configuration, native-JS bridge (if needed)
- **Info.plist**: App metadata, permissions, ATS settings

### Modifying Web Content
- **index.html**: SPA structure, script loading order
- **assets/css/styles.css**: Styling, responsive breakpoints (iPhone 13 Mini optimized)
  - Uses CSS custom properties for iOS system colors
  - Supports dark mode via `prefers-color-scheme`
- **assets/js/words.js**: Update `MYWORDS` array to modify vocabulary
- **assets/js/config.js**: Modify prompt templates, timeout values
- **assets/js/api.js**: Update `API_CONFIG.endpoint` when deploying new Netlify URL

### Adding Native-JavaScript Bridge
To expose native functions to JavaScript:
1. In `ViewController.swift`, add script message handler:
```swift
configuration.userContentController.add(self, name: "nativeHandler")
```
2. Implement `WKScriptMessageHandler` protocol
3. In JavaScript: `window.webkit.messageHandlers.nativeHandler.postMessage(data)`

## Testing Strategy

### Manual Testing Checklist
- [ ] App launches without crash
- [ ] Welcome screen displays correctly in both light and dark mode
- [ ] "Start Practice" button transitions to quiz
- [ ] Questions load from AI service (requires internet)
- [ ] Answer selection updates score correctly
- [ ] Explanations display after answering
- [ ] "Next" button loads new question
- [ ] Keyboard shortcuts work (1-5, A-E, Enter, Escape)
- [ ] Back button returns to welcome screen
- [ ] Score resets when returning to welcome
- [ ] Error states display correctly (offline, API failure)
- [ ] App handles iPhone notch/safe area correctly
- [ ] Orientation stays locked to portrait on iPhone
- [ ] Dark mode toggle works correctly

### Testing AI Integration
1. Ensure device/simulator has internet connection
2. Deploy Netlify function first (see `DEPLOYMENT.md`)
3. Update `API_CONFIG.endpoint` in `assets/js/api.js` with your Netlify URL
4. Monitor Xcode console for API errors
5. Check Netlify Function logs for server-side errors
6. Verify questions generate within ~5 seconds (timeout: 30s)

### Testing Circuit Breaker
1. Enable airplane mode
2. Try loading 5+ questions (all will fail)
3. Circuit should open, showing "Too many failures" message
4. Wait 60 seconds, circuit should reset

## Security Considerations

### App Transport Security
- `NSAllowsArbitraryLoads = YES` in Info.plist (required for AI API)
- **Note**: In production, consider pinning to specific HTTPS endpoints

### Input Sanitization (Web Layer)
- `sanitizeHtml()` function escapes HTML entities
- All AI-generated content is sanitized before DOM insertion
- `validateQuestion()` ensures API response structure

### API Key Handling
✅ **Secure Architecture**:
- OpenAI API key stored in Netlify environment variables (encrypted at rest)
- iOS app calls Netlify Function → Function calls OpenAI API
- Key is never exposed to client-side code
- Key only exists in server memory during function execution

⚠️ **If key was previously exposed**:
1. Rotate immediately at https://platform.openai.com/api-keys
2. Update Netlify environment variable
3. Never commit keys to version control

### XSS Protection
- All user-facing content sanitized via `textContent`
- JSON parsing with multiple fallback strategies
- Length limits on sentence and option text

## Deployment

### App Store Submission
1. Update `PRODUCT_BUNDLE_IDENTIFIER` to unique ID
2. Set `DEVELOPMENT_TEAM` to your Apple Developer Team ID
3. Update `MARKETING_VERSION` and `CURRENT_PROJECT_VERSION`
4. Verify all icon sizes present in `Assets.xcassets`
5. Archive and upload via Xcode Organizer or `xcodebuild`

### Netlify Function Deployment
1. Push code to Git repository
2. Connect repo to Netlify or deploy manually
3. Add `OPENAI_API_KEY` environment variable in Netlify dashboard
4. Update API endpoint in `assets/js/api.js` with deployed URL
5. Rebuild and resubmit iOS app

## Troubleshooting

### White Screen on Launch
- Check `index.html` is in "Copy Bundle Resources" build phase
- Verify file path in `Bundle.main.url(forResource:withExtension:)`
- Check Safari Web Inspector for JS errors

### Questions Not Loading
- Verify internet connection
- Check Xcode console for API errors
- Verify `OPENAI_API_KEY` is set in Netlify
- Check Netlify Function logs

### Layout Issues on Notch Devices
- Verify `env(safe-area-inset-*)` CSS properties applied
- Check WebView uses `safeAreaLayoutGuide` constraints

### Build Errors
- Ensure Xcode 14.3+ installed
- Check Swift version is 5.0
- Verify iOS Deployment Target is 14.0
- Clean build folder: `Cmd+Shift+K`

### Dark Mode Issues
- Verify CSS uses `var(--ios-label)` and `var(--ios-system-background)`
- Check `prefers-color-scheme: dark` media queries are properly defined
- Ensure WebKit respects color scheme via meta tags in HTML

## Code Style Guidelines

### Swift
- 4-space indentation
- Follow Apple's Swift API Design Guidelines
- Use `MARK:` comments to separate sections
- Prefer `let` over `var`, avoid force unwrapping
- Use iOS system colors for automatic dark mode support

### JavaScript
- Defensive programming patterns (extensive validation)
- Comment sections with decorative banners (`/* ═══...═══ */`)
- Prefix defense mechanisms with `DEFENSE:` in comments
- Use `const` by default, `let` when reassignment needed
- Module export pattern for future compatibility:
```javascript
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ... };
}
```

### CSS
- Mobile-first approach
- iPhone 13 Mini specific breakpoint at 375px
- Safe area inset support: `env(safe-area-inset-*)`
- CSS variables for consistent colors (iOS Design System)
- Dark mode via `prefers-color-scheme` media queries
- Reduced motion support via `prefers-reduced-motion`

## External Dependencies

The project has no external Swift package dependencies.

The web layer uses:
- **iOS System Fonts**: SF Pro (system font, no CDN required)
- **OpenAI API**: Requires valid API key configured in Netlify

## Version History

- **v1.0.0**: Initial release with AI-powered quiz generation, circuit breaker, offline detection, iOS Design System, dark mode support

## License and Attribution

Ensure proper licensing for:
- App icon assets
- Vocabulary word list content (YDS exam words)
