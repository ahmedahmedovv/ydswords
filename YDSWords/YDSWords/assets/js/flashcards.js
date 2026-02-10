/* ═════════════════════════════════════════════════════════════════════════════
   YDS Words - Tinder-Style Flashcard Study Mode
   ═════════════════════════════════════════════════════════════════════════════ */

// ═════════════════════════════════════════════════════════════════════════════
// FLASHCARD STATE
// ═════════════════════════════════════════════════════════════════════════════

const FlashcardState = {
    currentIndex: 0,
    shuffledWords: [],
    knownCount: 0,
    totalCount: 0,
    isAnimating: false,
    currentDefinition: null,
    currentExample: null,
    
    // Prefetch state
    prefetchedContent: null,
    prefetchPromise: null,
    nextWordIndex: null,
    
    reset() {
        this.currentIndex = 0;
        this.shuffledWords = [];
        this.knownCount = 0;
        this.totalCount = 0;
        this.isAnimating = false;
        this.currentDefinition = null;
        this.currentExample = null;
        this.prefetchedContent = null;
        this.prefetchPromise = null;
        this.nextWordIndex = null;
    },
    
    shuffleWords() {
        if (!Array.isArray(MYWORDS) || MYWORDS.length === 0) {
            console.error('MYWORDS not available for flashcards');
            return [];
        }
        // Fisher-Yates shuffle
        this.shuffledWords = [...MYWORDS];
        for (let i = this.shuffledWords.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.shuffledWords[i], this.shuffledWords[j]] = [this.shuffledWords[j], this.shuffledWords[i]];
        }
        this.currentIndex = 0;
        return this.shuffledWords;
    },
    
    // Reshuffle and continue when reaching the end
    reshuffleAndContinue() {
        console.log('[Flashcard] Reshuffling words for unlimited study...');
        this.shuffleWords();
    }
};

// ═════════════════════════════════════════════════════════════════════════════
// DOM REFERENCES FOR FLASHCARDS
// ═════════════════════════════════════════════════════════════════════════════

const FlashcardDOM = {
    get flashcardPage() { return $('flashcardPage'); },
    get flashcardContainer() { return $('flashcardContainer'); },
    get flashcardCard() { return $('flashcardCard'); },
    get flashcardWord() { return $('flashcardWord'); },
    get flashcardDefinition() { return $('flashcardDefinition'); },
    get flashcardExample() { return $('flashcardExample'); },
    get flashcardScore() { return $('flashcardScore'); },
    get btnFlashcardBack() { return $('btnFlashcardBack'); },
    get btnDontKnow() { return $('btnDontKnow'); },
    get btnKnow() { return $('btnKnow'); },

    get modeSelection() { return $('modeSelection'); },
    get btnModeQuiz() { return $('btnModeQuiz'); },
    get btnModeFlashcard() { return $('btnModeFlashcard'); }
};

// ═════════════════════════════════════════════════════════════════════════════
// FLASHCARD API - Get definition and example from OpenAI
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Generate flashcard content (definition + example) for a word
 */
async function generateFlashcardContent(word) {
    // Check circuit breaker
    if (isCircuitOpen()) {
        const waitSeconds = Math.ceil((AppState.circuitOpenUntil - Date.now()) / 1000);
        throw new Error(`Too many failures. Please wait ${waitSeconds} seconds.`);
    }
    
    // Check online status
    if (!navigator.onLine) {
        throw new Error('You\'re offline. Please check your internet connection.');
    }
    
    const prompt = `For the English word/phrase "${word}" (commonly used in academic/YDS exam contexts), provide:
1. A clear, concise definition suitable for English language learners
2. One academic-style example sentence showing natural usage

Respond ONLY in this exact JSON format:
{
  "definition": "brief definition here",
  "example": "Example sentence here."
}

Keep the definition under 20 words. The example should be academic/formal in tone.`;

    try {
        const response = await fetchWithTimeout(API_CONFIG.endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt })
        });
        
        if (!response.ok) {
            throw new Error(`Server error (${response.status})`);
        }
        
        const data = await response.json();
        
        if (!data?.choices?.[0]?.message?.content) {
            throw new Error('Invalid response format');
        }
        
        const text = data.choices[0].message.content;
        
        // Parse JSON response
        let content;
        try {
            content = JSON.parse(text);
        } catch (e) {
            // Try extracting from markdown code block
            const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
            if (jsonMatch) {
                content = JSON.parse(jsonMatch[1].trim());
            } else {
                // Try finding JSON object
                const objMatch = text.match(/\{[\s\S]*"definition"[\s\S]*"example"[\s\S]*\}/);
                if (objMatch) {
                    content = JSON.parse(objMatch[0]);
                } else {
                    throw new Error('Could not parse flashcard content');
                }
            }
        }
        
        // Validate
        if (!content.definition || !content.example) {
            throw new Error('Missing definition or example');
        }
        
        recordSuccess();
        return content;
        
    } catch (error) {
        recordFailure();
        throw error;
    }
}

// ═════════════════════════════════════════════════════════════════════════════
// FLASHCARD UI FUNCTIONS
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Show mode selection on welcome page
 */
function showModeSelection() {
    if (FlashcardDOM.modeSelection) {
        FlashcardDOM.modeSelection.classList.remove('hidden');
    }
    // Hide the original start button
    const originalStart = document.getElementById('btnStart');
    if (originalStart) {
        originalStart.style.display = 'none';
    }
}

/**
 * Start flashcard mode
 */
async function startFlashcardMode() {
    // Validate MYWORDS
    if (!Array.isArray(MYWORDS) || MYWORDS.length === 0) {
        showNotification('error', 'Word list is not available.');
        return;
    }
    
    // Check if we have prefetched content from welcome screen
    const hasPrefetched = FlashcardState.prefetchedContent && FlashcardState.nextWordIndex === 0;
    
    if (!hasPrefetched) {
        // No prefetch available, need to shuffle and will fetch
        FlashcardState.reset();
        FlashcardState.shuffleWords();
    }
    // If prefetched, state is already set up with shuffledWords and content
    
    // Switch to flashcard page
    if (DOM.welcomePage) DOM.welcomePage.classList.remove('active');
    if (FlashcardDOM.flashcardPage) FlashcardDOM.flashcardPage.classList.add('active');
    
    // Ensure container is visible
    if (FlashcardDOM.flashcardContainer) {
        FlashcardDOM.flashcardContainer.classList.remove('hidden');
    }
    
    // Load first card (will use prefetched content if available)
    console.log('[Flashcard] Starting flashcard mode - loading first card...');
    if (hasPrefetched) {
        console.log('[Flashcard] Using prefetched content!');
    }
    await loadFlashcard();
    
    // Prefetch second card immediately after first loads
    console.log('[Flashcard] First card loaded, prefetching second...');
    prefetchNextFlashcard();
}

/**
 * Prefetch first flashcard content for welcome screen
 * This runs in parallel with quiz mode prefetch
 */
function prefetchFirstFlashcard() {
    // Don't prefetch if already have content
    if (FlashcardState.prefetchedContent && FlashcardState.nextWordIndex === 0) {
        console.log('[Flashcard Prefetch] First card already prefetched');
        return Promise.resolve();
    }
    
    // Don't prefetch if already fetching
    if (FlashcardState.prefetchPromise) {
        console.log('[Flashcard Prefetch] Already fetching first card');
        return FlashcardState.prefetchPromise;
    }
    
    // Need to shuffle first to know which word to prefetch
    if (FlashcardState.shuffledWords.length === 0) {
        FlashcardState.shuffleWords();
    }
    
    const firstWord = FlashcardState.shuffledWords[0];
    FlashcardState.nextWordIndex = 0;
    
    console.log(`[Flashcard Prefetch] Prefetching first card: "${firstWord}"`);
    
    FlashcardState.prefetchPromise = generateFlashcardContent(firstWord)
        .then(content => {
            console.log('[Flashcard Prefetch] First card ready');
            FlashcardState.prefetchedContent = content;
            FlashcardState.prefetchPromise = null;
        })
        .catch(error => {
            console.error('[Flashcard Prefetch] First card failed:', error.message);
            FlashcardState.prefetchPromise = null;
            FlashcardState.prefetchedContent = null;
        });
    
    return FlashcardState.prefetchPromise;
}

/**
 * Prefetch next flashcard content in background
 */
function prefetchNextFlashcard() {
    const nextIndex = FlashcardState.currentIndex + 1;
    
    // Don't prefetch if out of bounds
    if (nextIndex >= FlashcardState.shuffledWords.length) {
        console.log('[Flashcard Prefetch] No more cards to prefetch');
        return;
    }
    
    // Don't prefetch if already have content for next index
    if (FlashcardState.prefetchedContent && FlashcardState.nextWordIndex === nextIndex) {
        console.log('[Flashcard Prefetch] Already have content for next card');
        return;
    }
    
    // Don't prefetch if already fetching
    if (FlashcardState.prefetchPromise) {
        console.log('[Flashcard Prefetch] Already fetching, skipping...');
        return;
    }
    
    const nextWord = FlashcardState.shuffledWords[nextIndex];
    FlashcardState.nextWordIndex = nextIndex;
    
    console.log(`[Flashcard Prefetch] Prefetching card ${nextIndex + 1}: "${nextWord}"`);
    
    FlashcardState.prefetchPromise = generateFlashcardContent(nextWord)
        .then(content => {
            console.log('[Flashcard Prefetch] Successfully prefetched next card');
            FlashcardState.prefetchedContent = content;
            FlashcardState.prefetchPromise = null;
        })
        .catch(error => {
            console.error('[Flashcard Prefetch] Failed:', error.message);
            FlashcardState.prefetchPromise = null;
            FlashcardState.prefetchedContent = null;
            // Silent fail - will retry on load
        });
}

/**
 * Load current flashcard
 */
async function loadFlashcard() {
    // If we've gone through all words, reshuffle and continue (unlimited mode)
    if (FlashcardState.currentIndex >= FlashcardState.shuffledWords.length) {
        FlashcardState.reshuffleAndContinue();
    }
    
    const word = FlashcardState.shuffledWords[FlashcardState.currentIndex];
    
    // Show loading state on card
    if (FlashcardDOM.flashcardWord) FlashcardDOM.flashcardWord.textContent = word;
    if (FlashcardDOM.flashcardDefinition) FlashcardDOM.flashcardDefinition.textContent = 'Loading definition...';
    if (FlashcardDOM.flashcardExample) FlashcardDOM.flashcardExample.textContent = 'Loading example...';
    if (FlashcardDOM.flashcardDefinition) FlashcardDOM.flashcardDefinition.classList.add('loading');
    if (FlashcardDOM.flashcardExample) FlashcardDOM.flashcardExample.classList.add('loading');
    
    // Update score display
    updateFlashcardScore();
    
    // Reset card position
    resetCardPosition();
    
    // Check if we have prefetched content for this word
    let content = null;
    if (FlashcardState.prefetchedContent && FlashcardState.nextWordIndex === FlashcardState.currentIndex) {
        content = FlashcardState.prefetchedContent;
        FlashcardState.prefetchedContent = null;
        FlashcardState.nextWordIndex = null;
    }
    
    // Fetch content if not prefetched
    try {
        if (!content) {
            content = await generateFlashcardContent(word);
        }
        
        FlashcardState.currentDefinition = content.definition;
        FlashcardState.currentExample = content.example;
        
        // Update UI
        if (FlashcardDOM.flashcardDefinition) {
            FlashcardDOM.flashcardDefinition.textContent = content.definition;
            FlashcardDOM.flashcardDefinition.classList.remove('loading');
        }
        if (FlashcardDOM.flashcardExample) {
            // Highlight the word in the example
            const highlightedExample = highlightWordInExample(content.example, word);
            FlashcardDOM.flashcardExample.innerHTML = highlightedExample;
            FlashcardDOM.flashcardExample.classList.remove('loading');
        }
        
        // Prefetch next card while user reads this one
        prefetchNextFlashcard();
        
    } catch (error) {
        console.error('Failed to load flashcard:', error);
        
        // Detect connection type for better error messages
        const connectionType = typeof detectConnectionType === 'function' ? detectConnectionType() : 'unknown';
        const isCellular = connectionType === 'cellular';
        
        let errorMsg = 'Content unavailable';
        if (isCellular || error.message.includes('timeout') || error.message.includes('Failed to fetch')) {
            errorMsg = 'Slow connection. Try WiFi for better results.';
        }
        
        if (FlashcardDOM.flashcardDefinition) {
            FlashcardDOM.flashcardDefinition.textContent = errorMsg;
            FlashcardDOM.flashcardDefinition.classList.remove('loading');
        }
        if (FlashcardDOM.flashcardExample) {
            FlashcardDOM.flashcardExample.textContent = 'Please check your connection and try again.';
            FlashcardDOM.flashcardExample.classList.remove('loading');
        }
    }
}

/**
 * Highlight word in example sentence
 */
function highlightWordInExample(example, word) {
    // Escape HTML
    let safeExample = sanitizeHtml(example);
    
    // Create case-insensitive regex to find the word
    const wordRegex = new RegExp(`\\b(${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})\\b`, 'gi');
    
    // Wrap in highlight span
    return safeExample.replace(wordRegex, '<span class="word-highlight">$1</span>');
}

/**
 * Update score display (known / total)
 */
function updateFlashcardScore() {
    if (FlashcardDOM.flashcardScore) {
        FlashcardDOM.flashcardScore.textContent = `${FlashcardState.knownCount} / ${FlashcardState.totalCount}`;
    }
}

/**
 * Reset card position after swipe
 */
function resetCardPosition() {
    const card = FlashcardDOM.flashcardCard;
    if (!card) return;
    
    card.style.transform = '';
    card.style.opacity = '1';
    card.classList.remove('swiping-left', 'swiping-right');
}

/**
 * Handle swipe/know word
 */
function handleKnowWord() {
    if (FlashcardState.isAnimating) return;
    FlashcardState.isAnimating = true;
    
    // Increment counters
    FlashcardState.knownCount++;
    FlashcardState.totalCount++;
    
    // Animate card off to right
    const card = FlashcardDOM.flashcardCard;
    if (card) {
        card.classList.add('swipe-right-animation');
        
        setTimeout(() => {
            card.classList.remove('swipe-right-animation');
            FlashcardState.currentIndex++;
            FlashcardState.isAnimating = false;
            // Card content should already be prefetched, show instantly
            loadFlashcard();
        }, 300);
    } else {
        FlashcardState.currentIndex++;
        FlashcardState.isAnimating = false;
        loadFlashcard();
    }
}

/**
 * Handle swipe/don't know word
 */
function handleDontKnowWord() {
    if (FlashcardState.isAnimating) return;
    FlashcardState.isAnimating = true;
    
    // Increment total count (but not known count)
    FlashcardState.totalCount++;
    
    // Animate card off to left
    const card = FlashcardDOM.flashcardCard;
    if (card) {
        card.classList.add('swipe-left-animation');
        
        setTimeout(() => {
            card.classList.remove('swipe-left-animation');
            FlashcardState.currentIndex++;
            FlashcardState.isAnimating = false;
            // Card content should already be prefetched, show instantly
            loadFlashcard();
        }, 300);
    } else {
        FlashcardState.currentIndex++;
        FlashcardState.isAnimating = false;
        loadFlashcard();
    }
}



/**
 * Return to welcome page from flashcards
 */
function exitFlashcardMode() {
    FlashcardState.reset();
    if (FlashcardDOM.flashcardPage) FlashcardDOM.flashcardPage.classList.remove('active');
    if (DOM.welcomePage) DOM.welcomePage.classList.add('active');
}

// ═════════════════════════════════════════════════════════════════════════════
// TOUCH/SWIPE HANDLING
// ═════════════════════════════════════════════════════════════════════════════

let touchStartX = 0;
let touchCurrentX = 0;
let isDragging = false;

function initFlashcardGestures() {
    // Attach to the entire container (main swipe area) for full-area swiping
    const swipeArea = FlashcardDOM.flashcardContainer;
    if (!swipeArea) return;
    
    // Touch events - on entire container
    swipeArea.addEventListener('touchstart', handleTouchStart, { passive: true });
    swipeArea.addEventListener('touchmove', handleTouchMove, { passive: true });
    swipeArea.addEventListener('touchend', handleTouchEnd);
    
    // Mouse events (for desktop testing)
    swipeArea.addEventListener('mousedown', handleMouseDown);
}

function handleTouchStart(e) {
    if (FlashcardState.isAnimating) return;
    // Ignore if touching buttons
    if (e.target.closest('.flashcard-action-btn')) return;
    touchStartX = e.touches[0].clientX;
    isDragging = true;
}

function handleMouseDown(e) {
    if (FlashcardState.isAnimating) return;
    // Ignore if clicking buttons
    if (e.target.closest('.flashcard-action-btn')) return;
    touchStartX = e.clientX;
    isDragging = true;
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
}

function handleMouseMove(e) {
    if (!isDragging) return;
    touchCurrentX = e.clientX;
    updateCardPosition();
}

function handleTouchMove(e) {
    if (!isDragging) return;
    touchCurrentX = e.touches[0].clientX;
    updateCardPosition();
}

function updateCardPosition() {
    const card = FlashcardDOM.flashcardCard;
    if (!card) return;
    
    const deltaX = touchCurrentX - touchStartX;
    const rotate = deltaX * 0.05; // Rotation based on drag
    const opacity = 1 - Math.abs(deltaX) / 500;
    
    card.style.transform = `translateX(${deltaX}px) rotate(${rotate}deg)`;
    card.style.opacity = Math.max(0.5, opacity);
    
    // Visual feedback
    card.classList.remove('swiping-left', 'swiping-right');
    if (deltaX > 50) {
        card.classList.add('swiping-right');
    } else if (deltaX < -50) {
        card.classList.add('swiping-left');
    }
}

function handleTouchEnd() {
    if (!isDragging) return;
    isDragging = false;
    
    const deltaX = touchCurrentX - touchStartX;
    const threshold = 100; // Swipe threshold
    
    if (deltaX > threshold) {
        handleKnowWord();
    } else if (deltaX < -threshold) {
        handleDontKnowWord();
    } else {
        // Snap back
        resetCardPosition();
    }
}

function handleMouseUp() {
    handleTouchEnd();
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
}

// ═════════════════════════════════════════════════════════════════════════════
// KEYBOARD SUPPORT FOR FLASHCARDS
// ═════════════════════════════════════════════════════════════════════════════

document.addEventListener('keydown', (e) => {
    // Only handle when flashcard page is active
    if (!FlashcardDOM.flashcardPage?.classList.contains('active')) return;
    
    // Don't handle if currently animating
    if (FlashcardState.isAnimating) return;
    
    const key = e.key.toUpperCase();
    
    switch (key) {
        case 'ARROWLEFT':
        case 'LEFT':
        case 'N': // N for "No/Don't know"
            e.preventDefault();
            handleDontKnowWord();
            break;
        case 'ARROWRIGHT':
        case 'RIGHT':
        case 'K': // K for "Know"
        case 'Y': // Y for "Yes"
            e.preventDefault();
            handleKnowWord();
            break;
        case 'ESCAPE':
            e.preventDefault();
            exitFlashcardMode();
            break;
    }
});

// ═════════════════════════════════════════════════════════════════════════════
// INITIALIZATION
// ═════════════════════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
    // Setup mode selection buttons
    if (FlashcardDOM.btnModeQuiz) {
        FlashcardDOM.btnModeQuiz.addEventListener('click', () => {
            // Use prefetched question if available for instant display
            if (AppState.prefetched) {
                AppState.isFirstQuestion = false;
                if (DOM.welcomePage) DOM.welcomePage.classList.remove('active');
                if (DOM.appPage) DOM.appPage.classList.add('active');
                showLoading(false);
                AppState.currentQuestion = AppState.prefetched;
                AppState.prefetched = null;
                displayQuestion();
                // Prefetch next one in background
                prefetchQuestion();
            } else {
                showApp();
            }
        });
    }
    
    if (FlashcardDOM.btnModeFlashcard) {
        FlashcardDOM.btnModeFlashcard.addEventListener('click', () => {
            startFlashcardMode();
        });
    }
    
    // Setup flashcard control buttons
    if (FlashcardDOM.btnFlashcardBack) {
        FlashcardDOM.btnFlashcardBack.addEventListener('click', exitFlashcardMode);
    }
    
    if (FlashcardDOM.btnDontKnow) {
        FlashcardDOM.btnDontKnow.addEventListener('click', handleDontKnowWord);
    }
    
    if (FlashcardDOM.btnKnow) {
        FlashcardDOM.btnKnow.addEventListener('click', handleKnowWord);
    }
    
    // Initialize gestures
    initFlashcardGestures();
});

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { 
        FlashcardState, 
        FlashcardDOM, 
        startFlashcardMode, 
        exitFlashcardMode,
        handleKnowWord,
        handleDontKnowWord,
        prefetchFirstFlashcard
    };
}
