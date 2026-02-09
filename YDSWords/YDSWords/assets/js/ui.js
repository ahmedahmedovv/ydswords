/* ═════════════════════════════════════════════════════════════════════════════
   YDS Words - UI Functions
   ═════════════════════════════════════════════════════════════════════════════ */

// ═════════════════════════════════════════════════════════════════════════════
// DOM ELEMENT REFERENCES
// ═════════════════════════════════════════════════════════════════════════════

// Use a getter pattern to handle cases where elements might not exist yet
const DOM = {
    get welcomePage() { return $('welcomePage'); },
    get appPage() { return $('appPage'); },
    get btnStart() { return $('btnStart'); },
    get btnBack() { return $('btnBack'); },
    get loading() { return $('loading'); },
    get loadingText() { return $('loadingText'); },
    get questionArea() { return $('questionArea'); },
    get sentence() { return $('sentence'); },
    get options() { return $('options'); },
    get feedback() { return $('feedback'); },
    get feedbackText() { return $('feedbackText'); },
    get btnNext() { return $('btnNext'); },
    get scoreEl() { return $('score'); },
    get errorState() { return $('errorState'); },
    get errorMessage() { return $('errorMessage'); },
    get btnRetry() { return $('btnRetry'); }
};

// ═════════════════════════════════════════════════════════════════════════════
// NOTIFICATION & ERROR DISPLAY SYSTEM
// ═════════════════════════════════════════════════════════════════════════════

function showNotification(type, message, duration = 5000) {
    const container = document.getElementById('notificationContainer');
    if (!container) return;
    
    const icons = {
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️',
        success: '✅'
    };
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <span class="notification-icon">${icons[type] || 'ℹ️'}</span>
        <span>${sanitizeHtml(message)}</span>
        <button class="notification-close" onclick="this.parentElement.remove()">×</button>
    `;
    
    container.appendChild(notification);
    
    // Auto-remove after duration
    if (duration > 0) {
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, duration);
    }
    
    return notification;
}

function showGlobalError(message = null) {
    const boundary = document.getElementById('globalErrorBoundary');
    if (boundary) {
        if (message) {
            const p = boundary.querySelector('p');
            if (p) p.textContent = message;
        }
        boundary.classList.add('active');
    }
}

function hideGlobalError() {
    const boundary = document.getElementById('globalErrorBoundary');
    if (boundary) {
        boundary.classList.remove('active');
    }
}

// ═════════════════════════════════════════════════════════════════════════════
// OFFLINE DETECTION
// ═════════════════════════════════════════════════════════════════════════════

function initOfflineDetection() {
    const updateOnlineStatus = () => {
        const indicator = document.getElementById('offlineIndicator');
        if (!indicator) return;
        
        if (navigator.onLine) {
            indicator.classList.remove('active');
            // Try to prefetch if we were offline
            if (!AppState.prefetched && !AppState.isLoading) {
                prefetchQuestion();
            }
        } else {
            indicator.classList.add('active');
            showNotification('warning', 'You\'re offline. Check your connection to continue.', 3000);
        }
    };
    
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    updateOnlineStatus();
}

// ═════════════════════════════════════════════════════════════════════════════
// VIEW MANAGEMENT
// ═════════════════════════════════════════════════════════════════════════════

function showApp() {
    // DEFENSE: Rate limit start button
    if (!checkRateLimit()) return;
    
    // DEFENSE: Check MYWORDS
    if (!Array.isArray(MYWORDS) || MYWORDS.length === 0) {
        showNotification('error', 'Word list is not available. Please refresh the page.');
        return;
    }
    
    if (DOM.welcomePage) DOM.welcomePage.classList.remove('active');
    if (DOM.appPage) DOM.appPage.classList.add('active');
    
    // Use prefetched question if available (instant display)
    if (AppState.prefetched && AppState.isFirstQuestion) {
        AppState.isFirstQuestion = false;
        showLoading(false);
        AppState.currentQuestion = AppState.prefetched;
        AppState.prefetched = null;
        displayQuestion();
        // Prefetch next one in background
        prefetchQuestion();
    } else {
        loadQuestion();
    }
}

function showWelcome() {
    // DEFENSE: Cancel any pending requests when going back
    AppState.cancelPendingRequests();
    AppState.reset();
    
    if (DOM.appPage) DOM.appPage.classList.remove('active');
    if (DOM.welcomePage) DOM.welcomePage.classList.add('active');
    
    // Reset score display
    if (DOM.scoreEl) DOM.scoreEl.textContent = '0 / 0';
    
    // Prefetch for next time
    prefetchQuestion();
}

function showLoading(show) {
    AppState.isLoading = show;
    if (DOM.loading) DOM.loading.classList.toggle('hidden', !show);
    if (DOM.questionArea) DOM.questionArea.classList.toggle('hidden', show);
    if (DOM.errorState) DOM.errorState.classList.add('hidden');
}

function showError(message, showRetry = true) {
    showLoading(false);
    if (DOM.questionArea) DOM.questionArea.classList.add('hidden');
    if (DOM.errorState) {
        DOM.errorState.classList.remove('hidden');
        if (DOM.errorMessage) DOM.errorMessage.textContent = message;
        if (DOM.btnRetry) DOM.btnRetry.style.display = showRetry ? 'block' : 'none';
    }
}

// ═════════════════════════════════════════════════════════════════════════════
// QUESTION LOADING & DISPLAY
// ═════════════════════════════════════════════════════════════════════════════

async function loadQuestion() {
    // DEFENSE: Prevent concurrent loads
    if (AppState.isLoading) return;
    
    // DEFENSE: Reset answer state
    AppState.hasAnswered = false;
    
    showLoading(true);
    if (DOM.loadingText) DOM.loadingText.textContent = 'Generating question...';
    
    // Scroll to top when loading new question
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    try {
        // Use prefetched question or generate new one
        if (AppState.prefetched) {
            AppState.currentQuestion = AppState.prefetched;
            AppState.prefetched = null;
        } else {
            AppState.currentQuestion = await generateQuestion();
        }
        
        displayQuestion();
        showLoading(false);
        
        // Prefetch next one in background
        prefetchQuestion();
        
    } catch (error) {
        console.error('Failed to load question:', error);
        
        // User-friendly error messages
        let userMessage = 'Couldn\'t load the question.';
        let showRetry = true;
        
        if (error.message.includes('offline')) {
            userMessage = 'You\'re offline. Check your connection and try again.';
        } else if (error.message.includes('timeout')) {
            userMessage = 'The server is taking too long. Please try again.';
        } else if (error.message.includes('Too many')) {
            userMessage = error.message;
            showRetry = false;
        } else if (error.message.includes('circuit')) {
            userMessage = 'Service temporarily unavailable. Please wait a moment.';
            showRetry = false;
        }
        
        showError(userMessage, showRetry);
    }
}

function displayQuestion() {
    const question = AppState.currentQuestion;
    
    // DEFENSE: Validate question before display
    if (!question) {
        showError('Something went wrong. Please try again.');
        return;
    }
    
    try {
        // DEFENSE: Sanitize and display sentence (XSS protection)
        const sentenceHtml = sanitizeHtml(question.sentence)
            .replace(/_{3,}/g, '<span class="blank">_____</span>');
        
        if (DOM.sentence) DOM.sentence.innerHTML = sentenceHtml;
        
        // Shuffle options with original indices preserved
        const originalCorrectIndex = question.correctIndex;
        const indexed = question.options.map((opt, i) => ({ 
            opt, 
            origIndex: i, 
            explanation: question.explanations?.[i] 
        }));
        
        // DEFENSE: Fisher-Yates shuffle with validation
        if (indexed.length !== 5) {
            throw new Error('Invalid options count');
        }
        
        for (let i = indexed.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [indexed[i], indexed[j]] = [indexed[j], indexed[i]];
        }
        
        question.options = indexed.map(x => x.opt);
        question.correctIndex = indexed.findIndex(x => x.origIndex === originalCorrectIndex);
        if (question.explanations) {
            question.explanations = indexed.map(x => x.explanation);
        }
        
        // DEFENSE: Validate shuffled indices
        if (question.correctIndex < 0 || question.correctIndex > 4) {
            throw new Error('Shuffle algorithm error');
        }
        
        // Render options with sanitization (lowercase)
        const keys = ['A', 'B', 'C', 'D', 'E'];
        if (DOM.options) {
            DOM.options.innerHTML = question.options.map((opt, i) => `
                <button class="option" data-index="${i}" type="button">
                    <span class="key">${keys[i]}</span>
                    <span>${sanitizeHtml(opt).toLowerCase()}</span>
                </button>
            `).join('');
            
            // DEFENSE: Use event delegation and check for disabled state
            DOM.options.querySelectorAll('.option').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    if (!AppState.hasAnswered && !btn.disabled) {
                        selectAnswer(+btn.dataset.index);
                    }
                });
            });
        }
        
        if (DOM.feedback) DOM.feedback.classList.add('hidden');
        if (DOM.btnNext) DOM.btnNext.classList.add('hidden');
        
    } catch (error) {
        console.error('Error displaying question:', error);
        showError('Failed to display question. Please try again.');
    }
}

function selectAnswer(index) {
    // DEFENSE: Prevent multiple answers
    if (AppState.hasAnswered) return;
    AppState.hasAnswered = true;
    
    // DEFENSE: Validate index
    if (typeof index !== 'number' || index < 0 || index > 4) {
        console.error('Invalid answer index:', index);
        return;
    }
    
    const question = AppState.currentQuestion;
    if (!question || typeof question.correctIndex !== 'number') {
        console.error('No valid question state');
        return;
    }
    
    const isCorrect = index === question.correctIndex;
    
    // Update score
    AppState.total++;
    if (isCorrect) AppState.correct++;
    if (DOM.scoreEl) DOM.scoreEl.textContent = `${AppState.correct} / ${AppState.total}`;
    
    // Update UI with visual feedback
    const optionButtons = DOM.options ? DOM.options.querySelectorAll('.option') : [];
    optionButtons.forEach((btn, i) => {
        btn.disabled = true;
        if (i === index) btn.classList.add(isCorrect ? 'correct' : 'incorrect');
        if (i === question.correctIndex && !isCorrect) btn.classList.add('revealed');
    });
    
    // Build feedback HTML with sanitization
    const keys = ['A', 'B', 'C', 'D', 'E'];
    let feedbackHTML = '';
    
    if (question.explanations && question.explanations.length === 5) {
        feedbackHTML = '<div class="explanation-list">';
        question.options.forEach((opt, i) => {
            const isOptCorrect = i === question.correctIndex;
            const explanation = question.explanations[i] || '';
            feedbackHTML += `
                <div class="explanation-item ${isOptCorrect ? 'correct' : 'wrong'}">
                    <span class="opt-label">${keys[i]}</span>
                    <span class="opt-text"><strong>${sanitizeHtml(opt).toLowerCase()}:</strong> ${sanitizeHtml(explanation)}</span>
                </div>
            `;
        });
        feedbackHTML += '</div>';
    } else {
        feedbackHTML = `<p>${isCorrect ? '✅ Correct!' : '❌ Incorrect. The correct answer is shown above.'}</p>`;
    }
    
    if (DOM.feedbackText) DOM.feedbackText.innerHTML = feedbackHTML;
    if (DOM.feedback) DOM.feedback.classList.remove('hidden');
    if (DOM.btnNext) DOM.btnNext.classList.remove('hidden');
    
    // Scroll to bottom to show feedback and Next button
    setTimeout(() => {
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    }, 100);
}

// Export for module systems (if needed in future)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { 
        DOM, 
        showNotification, 
        showGlobalError, 
        hideGlobalError,
        initOfflineDetection,
        showApp,
        showWelcome,
        showLoading,
        showError,
        loadQuestion,
        displayQuestion,
        selectAnswer
    };
}
