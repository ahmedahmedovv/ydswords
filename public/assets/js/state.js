/* ═════════════════════════════════════════════════════════════════════════════
   YDS Words - Application State Management
   ═════════════════════════════════════════════════════════════════════════════ */

const AppState = {
    correct: 0,
    total: 0,
    currentQuestion: null,
    prefetched: null,
    isFirstQuestion: true,
    
    // Request management
    abortController: null,
    isLoading: false,
    prefetchPromise: null,
    
    // Circuit breaker
    consecutiveFailures: 0,
    circuitOpenUntil: 0,
    
    // Rate limiting
    lastButtonClick: 0,
    
    // Answer state
    hasAnswered: false,
    
    reset() {
        this.correct = 0;
        this.total = 0;
        this.currentQuestion = null;
        this.prefetched = null;
        this.isFirstQuestion = true;
        this.hasAnswered = false;
    },
    
    cancelPendingRequests() {
        if (this.abortController) {
            this.abortController.abort();
            this.abortController = null;
        }
    }
};

// Export for module systems (if needed in future)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AppState };
}
