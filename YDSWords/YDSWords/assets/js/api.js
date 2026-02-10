/* ═════════════════════════════════════════════════════════════════════════════
   YDS Words - API Functions
   ═════════════════════════════════════════════════════════════════════════════ */

/**
 * API Configuration
 * Change this URL to your Netlify function endpoint after deployment
 */
const API_CONFIG = {
    // Local development (netlify dev)
    // endpoint: 'http://localhost:8888/.netlify/functions/generate-question',
    
    // Production - custom domain endpoint
    endpoint: 'https://test.yds.today/.netlify/functions/generate-question',
    
    // Fallback configuration for cellular networks
    timeout: {
        wifi: 30000,      // 30 seconds for WiFi
        cellular: 60000   // 60 seconds for cellular (slower networks)
    }
};

/**
 * DEFENSE: Detect connection type for adaptive timeouts
 * PROTECTS AGAINST: Cellular networks being slower than WiFi
 */
function detectConnectionType() {
    // Check if Network Information API is available
    if ('connection' in navigator) {
        const connection = navigator.connection;
        if (connection.type === 'cellular' || connection.effectiveType === '2g' || connection.effectiveType === '3g') {
            return 'cellular';
        }
    }
    // Fallback: assume cellular if online but we can't detect
    return navigator.onLine ? 'wifi' : 'offline';
}

/**
 * DEFENSE: Fetch with timeout and abort support
 * PROTECTS AGAINST: Hanging requests, slow networks
 */
async function fetchWithTimeout(url, options = {}, timeoutMs = null) {
    // Adaptive timeout based on connection type
    const connectionType = detectConnectionType();
    const actualTimeout = timeoutMs || API_CONFIG.timeout[connectionType] || CONFIG.apiTimeout;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), actualTimeout);
    
    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        return response;
    } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            throw new Error('Request timed out. Please check your connection.');
        }
        throw error;
    }
}

/**
 * DEFENSE: Generate question with retry logic and circuit breaker
 * PROTECTS AGAINST: Network failures, API errors, timeout
 */
async function generateQuestion(attempt = 1) {
    // Check circuit breaker
    if (isCircuitOpen()) {
        const waitSeconds = Math.ceil((AppState.circuitOpenUntil - Date.now()) / 1000);
        throw new Error(`Too many failures. Please wait ${waitSeconds} seconds before trying again.`);
    }
    
    // Check online status
    if (!navigator.onLine) {
        throw new Error('You\'re offline. Please check your internet connection.');
    }
    
    // Validate MYWORDS
    if (!Array.isArray(MYWORDS) || MYWORDS.length === 0) {
        throw new Error('Word list is not available.');
    }
    
    const word = MYWORDS[Math.floor(Math.random() * MYWORDS.length)];
    
    let prompt;
    try {
        prompt = CONFIG.getPrompt(word);
    } catch (error) {
        throw new Error('Failed to generate question prompt: ' + error.message);
    }
    
    try {
        // Call our secure Netlify proxy instead of OpenAI directly
        const response = await fetchWithTimeout(API_CONFIG.endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ prompt })
        });
        
        if (!response.ok) {
            let errorMessage = `Server error (${response.status})`;
            
            // Specific error messages for common status codes
            switch (response.status) {
                case 400:
                    errorMessage = 'Invalid request. Please try again.';
                    break;
                case 401:
                    errorMessage = 'Authentication failed. Please contact support.';
                    break;
                case 404:
                    errorMessage = 'Question service not found. Please try again later.';
                    break;
                case 429:
                    errorMessage = 'Too many requests. Please wait a moment.';
                    break;
                case 500:
                case 502:
                case 503:
                case 504:
                    errorMessage = 'Server is busy. Please try again in a moment.';
                    break;
            }
            
            throw new Error(errorMessage);
        }
        
        const data = await response.json();
        
        // DEFENSE: Validate response structure
        if (!data || typeof data !== 'object') {
            throw new Error('Invalid response from server');
        }
        
        if (!data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
            throw new Error('Invalid response format from AI service');
        }
        
        if (!data.choices[0].message || typeof data.choices[0].message.content !== 'string') {
            throw new Error('Missing question content in response');
        }
        
        const text = data.choices[0].message.content;
        
        // DEFENSE: Robust JSON parsing with multiple fallbacks
        let question;
        const parseErrors = [];
        
        // Try 1: Direct parse
        try {
            question = JSON.parse(text);
        } catch (e) {
            parseErrors.push(e.message);
            
            // Try 2: Clean control characters
            try {
                const cleaned = text.replace(/[\x00-\x1F\x7F]/g, ' ');
                question = JSON.parse(cleaned);
            } catch (e2) {
                parseErrors.push(e2.message);
                
                // Try 3: Extract JSON from markdown code blocks
                try {
                    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
                    if (jsonMatch) {
                        question = JSON.parse(jsonMatch[1].trim());
                    } else {
                        // Try 4: Find JSON object pattern
                        const objMatch = text.match(/\{[\s\S]*"sentence"[\s\S]*"options"[\s\S]*\}/);
                        if (objMatch) {
                            question = JSON.parse(objMatch[0]);
                        }
                    }
                } catch (e3) {
                    parseErrors.push(e3.message);
                    throw new Error('Could not parse question data after multiple attempts');
                }
            }
        }
        
        // DEFENSE: Validate parsed question
        validateQuestion(question);
        
        // Success! Reset failure count
        recordSuccess();
        
        return question;
        
    } catch (error) {
        // DEFENSE: Retry logic for transient failures
        const isRetryable = error.message.includes('timeout') ||
                           error.message.includes('network') ||
                           error.message.includes('busy') ||
                           error.message.includes('Server error');
        
        if (isRetryable && attempt < CONFIG.retryAttempts) {
            const delay = CONFIG.retryDelay * Math.pow(2, attempt - 1); // Exponential backoff
            
            if (DOM.loadingText) {
                DOM.loadingText.textContent = `Retrying... (${attempt}/${CONFIG.retryAttempts})`;
            }
            
            await sleep(delay);
            return generateQuestion(attempt + 1);
        }
        
        // Record failure for circuit breaker
        recordFailure();
        throw error;
    }
}

/**
 * DEFENSE: Prefetch with duplicate request prevention
 * PROTECTS AGAINST: Multiple simultaneous prefetch requests
 */
async function prefetchQuestion() {
    // Don't prefetch if already have one
    if (AppState.prefetched) return;
    
    // Don't prefetch if already fetching
    if (AppState.prefetchPromise) return;
    
    // Create a single promise that can be shared
    AppState.prefetchPromise = generateQuestion()
        .then(question => {
            AppState.prefetched = question;
            AppState.prefetchPromise = null;
        })
        .catch(error => {
            console.error('Prefetch failed:', error);
            AppState.prefetchPromise = null;
            // Don't show error for prefetch failures - silent fail
        });
    
    return AppState.prefetchPromise;
}

// Export for module systems (if needed in future)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { fetchWithTimeout, generateQuestion, prefetchQuestion, API_CONFIG };
}
