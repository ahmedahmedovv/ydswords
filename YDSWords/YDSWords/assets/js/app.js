/* ═════════════════════════════════════════════════════════════════════════════
   YDS Words - Main Application
   ═════════════════════════════════════════════════════════════════════════════ */

// ═════════════════════════════════════════════════════════════════════════════
// GLOBAL ERROR HANDLING
// ═════════════════════════════════════════════════════════════════════════════

/**
 * DEFENSE: Global error handler - catches all unhandled errors
 * PROTECTS AGAINST: White screen crashes from unexpected exceptions
 */
window.addEventListener('error', (event) => {
    console.error('Global error caught:', event.error);
    showGlobalError();
    event.preventDefault();
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    showNotification('error', 'Something unexpected happened. Please refresh if issues continue.');
    event.preventDefault();
});

// ═════════════════════════════════════════════════════════════════════════════
// INITIALIZATION
// ═════════════════════════════════════════════════════════════════════════════

/**
 * DEFENSE: DOM Content Loaded validation
 * PROTECTS AGAINST: MYWORDS not loaded, missing elements
 */
document.addEventListener('DOMContentLoaded', () => {
    // Validate MYWORDS exists and is valid
    if (typeof MYWORDS === 'undefined' || !Array.isArray(MYWORDS) || MYWORDS.length === 0) {
        console.error('MYWORDS is not properly defined');
        showGlobalError('Word list failed to load. Please refresh the page.');
        return;
    }
    
    // Validate critical DOM elements exist
    const criticalElements = ['welcomePage', 'appPage', 'btnStart', 'loading', 'questionArea'];
    const missing = criticalElements.filter(id => !document.getElementById(id));
    if (missing.length > 0) {
        console.error('Missing critical DOM elements:', missing);
        showGlobalError('Page failed to load correctly. Please refresh.');
        return;
    }
    
    // Initialize offline detection
    initOfflineDetection();
    
    // Start prefetching first question
    prefetchQuestion();
});

// ═════════════════════════════════════════════════════════════════════════════
// EVENT LISTENERS
// ═════════════════════════════════════════════════════════════════════════════

// DEFENSE: Debounced start button
if (DOM.btnStart) {
    DOM.btnStart.addEventListener('click', debounce(showApp, CONFIG.debounceDelay));
}

// DEFENSE: Debounced back button
if (DOM.btnBack) {
    DOM.btnBack.addEventListener('click', debounce(showWelcome, CONFIG.debounceDelay));
}

// DEFENSE: Debounced next button
if (DOM.btnNext) {
    DOM.btnNext.addEventListener('click', debounce(() => {
        if (!AppState.isLoading) {
            loadQuestion();
        }
    }, CONFIG.debounceDelay));
}

// DEFENSE: Retry button
if (DOM.btnRetry) {
    DOM.btnRetry.addEventListener('click', debounce(() => {
        loadQuestion();
    }, CONFIG.debounceDelay));
}

// ═════════════════════════════════════════════════════════════════════════════
// KEYBOARD SUPPORT (Desktop Browsers)
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Keyboard shortcuts for desktop browsers
 * A-E or 1-5: Select answer option
 * Enter/Space: Next question (when showing feedback)
 * Escape: Go back to welcome screen
 */
document.addEventListener('keydown', (e) => {
    // Only handle keyboard when app page is active
    if (!DOM.appPage?.classList.contains('active')) return;
    
    // Don't handle if currently loading
    if (AppState.isLoading) return;
    
    const key = e.key.toUpperCase();
    
    // Answer selection (A-E or 1-5)
    if (!AppState.answered && AppState.currentQuestion) {
        const optionIndex = ['A', 'B', 'C', 'D', 'E'].indexOf(key);
        const numberIndex = ['1', '2', '3', '4', '5'].indexOf(e.key);
        const index = optionIndex !== -1 ? optionIndex : numberIndex;
        
        if (index !== -1 && index < AppState.currentQuestion.options.length) {
            e.preventDefault();
            handleAnswer(index);
            return;
        }
    }
    
    // Next question (Enter or Space when feedback is showing)
    if (AppState.answered && (key === 'ENTER' || key === ' ')) {
        e.preventDefault();
        if (!DOM.btnNext?.classList.contains('hidden')) {
            DOM.btnNext.click();
        }
        return;
    }
    
    // Go back (Escape)
    if (key === 'ESCAPE') {
        e.preventDefault();
        showWelcome();
        return;
    }
});

// DEFENSE: Handle page visibility changes (pause/resume logic)
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        // Page hidden - cancel non-critical requests
        if (AppState.prefetchPromise && !AppState.currentQuestion) {
            AppState.cancelPendingRequests();
        }
    } else {
        // Page visible again - prefetch if needed
        if (!AppState.prefetched && !AppState.isLoading && DOM.appPage?.classList.contains('active')) {
            prefetchQuestion();
        }
    }
});

// DEFENSE: Handle beforeunload to warn about in-progress requests
window.addEventListener('beforeunload', (e) => {
    if (AppState.isLoading) {
        e.preventDefault();
        e.returnValue = 'A question is loading. Are you sure you want to leave?';
    }
});

// ═════════════════════════════════════════════════════════════════════════════
// APP VERSION
// ═════════════════════════════════════════════════════════════════════════════

const APP_VERSION = '1.0.0';
console.log(`YDS Words v${APP_VERSION} initialized`);

// Export for module systems (if needed in future)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { APP_VERSION };
}
