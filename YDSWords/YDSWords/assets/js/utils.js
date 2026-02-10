/* ═════════════════════════════════════════════════════════════════════════════
   YDS Words - Utility Functions
   ═════════════════════════════════════════════════════════════════════════════ */

/**
 * DEFENSE: XSS Sanitization
 * PROTECTS AGAINST: Script injection from AI-generated content
 */
function sanitizeHtml(text) {
    if (typeof text !== 'string') return '';
    
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * DEFENSE: Input validation for API responses
 * PROTECTS AGAINST: Malformed AI responses, missing fields
 */
function validateQuestion(data) {
    if (!data || typeof data !== 'object') {
        throw new Error('Invalid question data: not an object');
    }
    
    // Required fields
    if (typeof data.sentence !== 'string' || !data.sentence.trim()) {
        throw new Error('Invalid question: missing or empty sentence');
    }
    
    if (!Array.isArray(data.options) || data.options.length !== 5) {
        throw new Error('Invalid question: options must be an array of 5 items');
    }
    
    if (typeof data.correctIndex !== 'number' || data.correctIndex < 0 || data.correctIndex > 4) {
        throw new Error('Invalid question: correctIndex must be 0-4');
    }
    
    // Validate all options are strings
    for (let i = 0; i < data.options.length; i++) {
        if (typeof data.options[i] !== 'string') {
            throw new Error(`Invalid question: option ${i} is not a string`);
        }
    }
    
    // Validate explanations if present
    if (data.explanations && !Array.isArray(data.explanations)) {
        throw new Error('Invalid question: explanations must be an array');
    }
    
    // Length limits (prevent memory issues)
    // For sentences: truncate at last complete word if too long
    if (data.sentence.length > CONFIG.maxSentenceLength) {
        const truncated = data.sentence.substring(0, CONFIG.maxSentenceLength);
        const lastSpace = truncated.lastIndexOf(' ');
        data.sentence = lastSpace > 0 ? truncated.substring(0, lastSpace) + '...' : truncated + '...';
    }
    
    data.options = data.options.map(opt => 
        opt.length > CONFIG.maxOptionLength ? opt.substring(0, CONFIG.maxOptionLength) + '...' : opt
    );
    
    // Truncate explanations if too long - cut at sentence end or word boundary
    if (data.explanations && Array.isArray(data.explanations)) {
        data.explanations = data.explanations.map(exp => {
            if (typeof exp !== 'string' || exp.length <= CONFIG.maxExplanationLength) {
                return exp;
            }
            // Try to find sentence ending (., !, ?) within limit
            const truncated = exp.substring(0, CONFIG.maxExplanationLength);
            const sentenceEnd = truncated.search(/[.!?](?!.*[.!?])/);
            if (sentenceEnd > 50) { // At least 50 chars before cutting at sentence
                return truncated.substring(0, sentenceEnd + 1);
            }
            // Otherwise cut at last word boundary
            const lastSpace = truncated.lastIndexOf(' ');
            if (lastSpace > 50) {
                return truncated.substring(0, lastSpace);
            }
            return truncated + '...';
        });
    }
    
    return true;
}

/**
 * DEFENSE: Debounce function
 * PROTECTS AGAINST: Double-clicking, rapid-fire button clicks
 */
function debounce(fn, delay) {
    let timeoutId;
    return function(...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn.apply(this, args), delay);
    };
}

/**
 * DEFENSE: Rate limit check
 * PROTECTS AGAINST: Button spam, accidental double-clicks
 */
function checkRateLimit() {
    const now = Date.now();
    if (now - AppState.lastButtonClick < CONFIG.debounceDelay) {
        return false;
    }
    AppState.lastButtonClick = now;
    return true;
}

/**
 * DEFENSE: Sleep/delay utility for retries
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * DEFENSE: Circuit breaker check
 * PROTECTS AGAINST: Cascading failures, hammering a failing API
 */
function isCircuitOpen() {
    if (AppState.consecutiveFailures >= CONFIG.circuitBreakerThreshold) {
        if (Date.now() < AppState.circuitOpenUntil) {
            return true;
        }
        // Reset circuit after timeout
        AppState.consecutiveFailures = 0;
    }
    return false;
}

function recordSuccess() {
    AppState.consecutiveFailures = 0;
}

function recordFailure() {
    AppState.consecutiveFailures++;
    if (AppState.consecutiveFailures >= CONFIG.circuitBreakerThreshold) {
        AppState.circuitOpenUntil = Date.now() + CONFIG.circuitBreakerTimeout;
    }
}

/**
 * DOM Element Helper
 */
const $ = id => document.getElementById(id);

// Export for module systems (if needed in future)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { 
        sanitizeHtml, 
        validateQuestion, 
        debounce, 
        checkRateLimit, 
        sleep,
        isCircuitOpen,
        recordSuccess,
        recordFailure,
        $
    };
}
