# YDS Words - AI Coding Agent Guide

## Project Overview

YDS Words is an iOS application designed for Turkish students preparing for the YDS (Yabancı Dil Sınavı - Foreign Language Exam). It's a vocabulary learning app that generates dynamic multiple-choice quiz questions using AI.

The app follows a hybrid architecture:
- **Native iOS Layer**: Thin Swift wrapper using UIKit + WebKit (WKWebView)
- **Application Layer**: Single HTML file (`index.html`) containing the complete web application with all UI, logic, and vocabulary data

## Technology Stack

### Native iOS Layer
- **Language**: Swift 5.0
- **Frameworks**: UIKit, WebKit
- **IDE**: Xcode 14.3+
- **Minimum iOS Version**: iOS 14.0
- **Target Device**: iPhone (portrait only)

### Web Application Layer
- **HTML5/CSS3/JavaScript** (vanilla, no frameworks)
- **Font**: Crimson Pro (Google Fonts)
- **AI Backend**: OpenAI API (GPT-4o-mini model) for question generation

## Project Structure

```
YDSWords/
├── YDSWords.xcodeproj/          # Xcode project configuration
│   └── project.pbxproj          # Build settings and file references
├── YDSWords/
│   ├── AppDelegate.swift        # App lifecycle, window setup, navigation bar styling
│   ├── ViewController.swift     # WKWebView setup and delegate handling
│   ├── Info.plist               # App metadata, ATS settings, orientation config
│   ├── index.html               # Main HTML file
│   ├── assets/
│   │   ├── css/styles.css       # Application styles
│   │   └── js/                  # JavaScript modules
│   │       ├── api.js           # API functions (calls Netlify proxy)
│   │       ├── app.js           # Main application logic
│   │       ├── config.js        # Configuration constants
│   │       ├── state.js         # Application state management
│   │       ├── ui.js            # UI manipulation functions
│   │       ├── utils.js         # Utility functions
│   │       └── words.js         # Vocabulary word list
│   └── Assets.xcassets/         # App icons for all iOS sizes
│       └── AppIcon.appiconset/
├── netlify/
│   └── functions/
│       └── generate-question.js # Secure Netlify Function (OpenAI proxy)
├── netlify.toml                 # Netlify configuration
├── .env.example                 # Example environment variables
├── .gitignore                   # Git ignore rules
├── DEPLOYMENT.md                # Deployment guide for Netlify
└── AGENTS.md                    # This file
```

## Key Components

### 1. AppDelegate.swift
- Entry point with `@main` decorator
- Creates window programmatically (no storyboard)
- Sets up hidden navigation controller
- Configures navigation bar appearance for iOS 13+ with custom colors:
  - Background: `#fdfbf7` (cream white)
  - Text: `#1e293b` (dark slate)

### 2. ViewController.swift
- Manages WKWebView instance
- Loads `index.html` from app bundle as local file
- Handles navigation delegate methods for loading states
- Implements WKUIDelegate for JavaScript alerts/confirms/prompts
- Injects safe area insets as CSS variables for iPhone notch support
- Includes activity indicator for loading feedback

### 3. index.html & JavaScript Modules
The core application containing:
- **MYWORDS Array**: ~1000 English vocabulary words and phrases commonly tested in YDS
- **Quiz Logic**: Fill-in-the-blank sentence questions with 5 options (A-E)
- **UI Components**: Welcome screen, question area, feedback section, score tracking
- **API Integration**: Calls Netlify Function proxy (which securely calls OpenAI API)
- **Defense Patterns**: Circuit breaker, retry logic, rate limiting, XSS sanitization

### 4. Netlify Function (generate-question.js)
Serverless function that acts as a secure proxy:
- Receives requests from the iOS app
- Stores OpenAI API key in encrypted environment variables
- Forwards requests to OpenAI API
- Returns responses to the app
- **API key is never exposed to the client**

## Build Configuration

### Xcode Project Settings
- **Bundle Identifier**: `com.yourcompany.YDSWords` (update for production)
- **Development Team**: `8A8XJBZ4CH` (update for your team)
- **Deployment Target**: iOS 14.0
- **Device Family**: iPhone only (`TARGETED_DEVICE_FAMILY = 1`)
- **Orientations**: Portrait only on iPhone, all orientations on iPad

### Info.plist Key Settings
```xml
- UISupportedInterfaceOrientations: Portrait only
- NSAppTransportSecurity: NSAllowsArbitraryLoads = YES (required for AI API)
- UIApplicationSceneManifest: Supports multiple scenes = NO
- UILaunchStoryboardName: Empty (programmatic UI)
```

## Build and Run Commands

### Via Xcode IDE
1. Open `YDSWords.xcodeproj` in Xcode 14.3 or later
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

## Development Guidelines

### Modifying Native Code
- **AppDelegate.swift**: Modify app lifecycle behavior, deep linking, or global UI appearance
- **ViewController.swift**: Modify WebView configuration, add native bridges, or change loading behavior
- **Info.plist**: Update app metadata, permissions, or ATS settings

### Modifying Web Content
- **index.html**: Contains the entire application logic
  - Update `MYWORDS` array to modify vocabulary list
  - Modify CSS in `<style>` section for styling changes
  - Update JavaScript for quiz logic changes
  - API endpoint and model configuration in `generateQuestion()` function

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
- [ ] Welcome screen displays correctly
- [ ] "Start Learning" button transitions to quiz
- [ ] Questions load from AI service (requires internet)
- [ ] Answer selection updates score correctly
- [ ] Keyboard shortcuts work (1-5, A-E, Enter)
- [ ] Back button returns to welcome screen
- [ ] Error states display correctly (offline, API failure)
- [ ] App handles iPhone notch/safe area correctly
- [ ] Orientation stays locked to portrait on iPhone

### Testing AI Integration
The app depends on Netlify Function → OpenAI API. To test:
1. Ensure device/simulator has internet connection
2. Deploy Netlify function first (see `DEPLOYMENT.md`)
3. Update `API_CONFIG.endpoint` in `assets/js/api.js` with your Netlify URL
4. Monitor Xcode console for API errors
5. Check Netlify Function logs for server-side errors
6. Check that questions generate within ~5 seconds timeout

## Security Considerations

### App Transport Security
- `NSAllowsArbitraryLoads` is set to YES in Info.plist
- This is required for the AI API endpoint
- **Recommendation**: Pin to specific HTTPS endpoints in production

### Input Sanitization
The web layer implements XSS protection:
- `sanitizeHtml()` function escapes HTML entities
- All user-facing content is sanitized before DOM insertion

### API Key Handling
✅ **Secure**: OpenAI API key is stored in Netlify environment variables
- API key is NOT exposed in client-side code
- iOS app calls Netlify Function → Function calls OpenAI API
- Key is encrypted at rest in Netlify, only decrypted during function execution
- See `DEPLOYMENT.md` for setup instructions
- **Important**: If you previously had the key in client-side code, rotate it immediately at https://platform.openai.com/api-keys

## Deployment

### App Store Submission
1. Update `PRODUCT_BUNDLE_IDENTIFIER` to your unique ID
2. Set `DEVELOPMENT_TEAM` to your Apple Developer Team ID
3. Update version in Info.plist (`CFBundleShortVersionString`)
4. Create App Store icon (1024x1024 PNG) in `Assets.xcassets/AppIcon.appiconset/1024.png`
5. Archive and upload via Xcode Organizer or `xcodebuild`

### Updating Web Content Only
If only `index.html` changes (no native code changes):
1. Increment `CURRENT_PROJECT_VERSION` in build settings
2. Rebuild and resubmit to App Store
3. No review delay for web content updates if using hot-reload (not implemented)

## Troubleshooting

### Common Issues

**White screen on launch:**
- Check that `index.html` is included in "Copy Bundle Resources" build phase
- Verify file path in `Bundle.main.path(forResource: "index", ofType: "html")`

**Questions not loading:**
- Verify internet connection on device
- Check Xcode console for API errors
- OpenAI API key may be expired/invalid

**Layout issues on iPhone with notch:**
- Check that CSS `env(safe-area-inset-*)` properties are applied
- Verify JavaScript injection of safe area values in `webView(_:didFinish:)`

**Build errors:**
- Ensure Xcode 14.3+ is installed
- Check Swift version is set to 5.0
- Verify iOS Deployment Target matches (14.0)

## Code Style Guidelines

### Swift
- Use 4-space indentation
- Follow Apple's Swift API Design Guidelines
- Use `MARK:` comments to separate sections
- Prefer `let` over `var`, avoid force unwrapping

### JavaScript (in index.html)
- Use defensive programming patterns (extensive validation)
- Comment sections with decorative banners for major features
- Prefix defense mechanisms with `DEFENSE:` in comments
- Use `const` by default, `let` when reassignment needed

## External Dependencies

The project has no external Swift package dependencies. The web layer uses:
- Google Fonts (Crimson Pro) - loaded from CDN
- OpenAI API - requires valid API key

## License and Attribution

Ensure you have proper licensing for:
- App icon assets
- Vocabulary word list content
- Google Fonts usage
