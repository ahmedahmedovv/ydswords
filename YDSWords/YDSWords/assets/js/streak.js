/* ═════════════════════════════════════════════════════════════════════════════
   YDS Words - Streak System
   Tracks daily study streaks separately for Quiz and Flashcard modes
   ═════════════════════════════════════════════════════════════════════════════ */

// ═════════════════════════════════════════════════════════════════════════════
// STREAK CONFIGURATION
// ═════════════════════════════════════════════════════════════════════════════

const STREAK_CONFIG = {
    // Number of words needed to complete a streak for each mode
    wordsPerStreak: 20,
    
    // Storage keys for localStorage
    storageKeys: {
        quizStreak: 'yds_quiz_streak',
        flashcardStreak: 'yds_flashcard_streak',
        quizProgress: 'yds_quiz_progress',
        flashcardProgress: 'yds_flashcard_progress',
        lastStudyDate: 'yds_last_study_date',
        quizCompletedToday: 'yds_quiz_completed_today',
        flashcardCompletedToday: 'yds_flashcard_completed_today'
    }
};

// ═════════════════════════════════════════════════════════════════════════════
// STREAK STATE
// ═════════════════════════════════════════════════════════════════════════════

const StreakState = {
    // Current streak counts (consecutive days)
    quizStreak: 0,
    flashcardStreak: 0,
    
    // Today's progress towards 20 words
    quizProgress: 0,
    flashcardProgress: 0,
    
    // Whether each mode's streak is completed today
    quizCompletedToday: false,
    flashcardCompletedToday: false,
    
    // Last study date for streak continuity checking
    lastStudyDate: null,
    
    // UI notification callback
    onStreakComplete: null,
    
    /**
     * Initialize streak state from localStorage
     */
    init() {
        this.loadFromStorage();
        this.checkDateReset();
        console.log('[Streak] Initialized:', this.getStatus());
    },
    
    /**
     * Load all streak data from localStorage
     */
    loadFromStorage() {
        try {
            this.quizStreak = parseInt(localStorage.getItem(STREAK_CONFIG.storageKeys.quizStreak)) || 0;
            this.flashcardStreak = parseInt(localStorage.getItem(STREAK_CONFIG.storageKeys.flashcardStreak)) || 0;
            this.quizProgress = parseInt(localStorage.getItem(STREAK_CONFIG.storageKeys.quizProgress)) || 0;
            this.flashcardProgress = parseInt(localStorage.getItem(STREAK_CONFIG.storageKeys.flashcardProgress)) || 0;
            this.lastStudyDate = localStorage.getItem(STREAK_CONFIG.storageKeys.lastStudyDate);
            this.quizCompletedToday = localStorage.getItem(STREAK_CONFIG.storageKeys.quizCompletedToday) === 'true';
            this.flashcardCompletedToday = localStorage.getItem(STREAK_CONFIG.storageKeys.flashcardCompletedToday) === 'true';
        } catch (e) {
            console.error('[Streak] Error loading from storage:', e);
            this.reset();
        }
    },
    
    /**
     * Save all streak data to localStorage
     */
    saveToStorage() {
        try {
            localStorage.setItem(STREAK_CONFIG.storageKeys.quizStreak, this.quizStreak.toString());
            localStorage.setItem(STREAK_CONFIG.storageKeys.flashcardStreak, this.flashcardStreak.toString());
            localStorage.setItem(STREAK_CONFIG.storageKeys.quizProgress, this.quizProgress.toString());
            localStorage.setItem(STREAK_CONFIG.storageKeys.flashcardProgress, this.flashcardProgress.toString());
            localStorage.setItem(STREAK_CONFIG.storageKeys.lastStudyDate, this.lastStudyDate || '');
            localStorage.setItem(STREAK_CONFIG.storageKeys.quizCompletedToday, this.quizCompletedToday.toString());
            localStorage.setItem(STREAK_CONFIG.storageKeys.flashcardCompletedToday, this.flashcardCompletedToday.toString());
        } catch (e) {
            console.error('[Streak] Error saving to storage:', e);
        }
    },
    
    /**
     * Check if we need to reset daily progress (new day)
     * Also handles streak breaking if more than 1 day passed
     */
    checkDateReset() {
        const today = getTodayDateString();
        
        if (this.lastStudyDate !== today) {
            // It's a new day
            const yesterday = getYesterdayDateString();
            
            if (this.lastStudyDate !== yesterday && this.lastStudyDate !== null) {
                // More than 1 day passed - break streaks for incomplete modes
                if (!this.quizCompletedToday) {
                    this.quizStreak = 0;
                    console.log('[Streak] Quiz streak broken - missed a day');
                }
                if (!this.flashcardCompletedToday) {
                    this.flashcardStreak = 0;
                    console.log('[Streak] Flashcard streak broken - missed a day');
                }
            }
            
            // Reset daily progress
            this.quizProgress = 0;
            this.flashcardProgress = 0;
            this.quizCompletedToday = false;
            this.flashcardCompletedToday = false;
            this.lastStudyDate = today;
            this.saveToStorage();
            
            console.log('[Streak] New day - progress reset');
        }
    },
    
    /**
     * Record a word studied in quiz mode
     * @returns {Object} Status after recording
     */
    recordQuizWord() {
        this.checkDateReset();
        
        if (this.quizCompletedToday) {
            return { 
                completed: true, 
                progress: this.quizProgress, 
                total: STREAK_CONFIG.wordsPerStreak,
                streak: this.quizStreak,
                justCompleted: false
            };
        }
        
        this.quizProgress++;
        
        // Check if streak completed
        if (this.quizProgress >= STREAK_CONFIG.wordsPerStreak) {
            this.quizCompletedToday = true;
            this.quizStreak++;
            
            this.saveToStorage();
            
            const status = {
                completed: true,
                progress: this.quizProgress,
                total: STREAK_CONFIG.wordsPerStreak,
                streak: this.quizStreak,
                justCompleted: true,
                mode: 'quiz'
            };
            
            if (this.onStreakComplete) {
                this.onStreakComplete(status);
            }
            
            return status;
        }
        
        this.saveToStorage();
        
        return {
            completed: false,
            progress: this.quizProgress,
            total: STREAK_CONFIG.wordsPerStreak,
            streak: this.quizStreak,
            justCompleted: false,
            mode: 'quiz'
        };
    },
    
    /**
     * Record a word studied in flashcard mode
     * @returns {Object} Status after recording
     */
    recordFlashcardWord() {
        this.checkDateReset();
        
        if (this.flashcardCompletedToday) {
            return { 
                completed: true, 
                progress: this.flashcardProgress, 
                total: STREAK_CONFIG.wordsPerStreak,
                streak: this.flashcardStreak,
                justCompleted: false
            };
        }
        
        this.flashcardProgress++;
        
        // Check if streak completed
        if (this.flashcardProgress >= STREAK_CONFIG.wordsPerStreak) {
            this.flashcardCompletedToday = true;
            this.flashcardStreak++;
            
            this.saveToStorage();
            
            const status = {
                completed: true,
                progress: this.flashcardProgress,
                total: STREAK_CONFIG.wordsPerStreak,
                streak: this.flashcardStreak,
                justCompleted: true,
                mode: 'flashcard'
            };
            
            if (this.onStreakComplete) {
                this.onStreakComplete(status);
            }
            
            return status;
        }
        
        this.saveToStorage();
        
        return {
            completed: false,
            progress: this.flashcardProgress,
            total: STREAK_CONFIG.wordsPerStreak,
            streak: this.flashcardStreak,
            justCompleted: false,
            mode: 'flashcard'
        };
    },
    
    /**
     * Get current streak status for both modes
     */
    getStatus() {
        this.checkDateReset();
        return {
            quiz: {
                streak: this.quizStreak,
                progress: this.quizProgress,
                total: STREAK_CONFIG.wordsPerStreak,
                completed: this.quizCompletedToday,
                remaining: Math.max(0, STREAK_CONFIG.wordsPerStreak - this.quizProgress)
            },
            flashcard: {
                streak: this.flashcardStreak,
                progress: this.flashcardProgress,
                total: STREAK_CONFIG.wordsPerStreak,
                completed: this.flashcardCompletedToday,
                remaining: Math.max(0, STREAK_CONFIG.wordsPerStreak - this.flashcardProgress)
            }
        };
    },
    
    /**
     * Get streak status for welcome screen display
     */
    getWelcomeDisplayStatus() {
        this.checkDateReset();
        return {
            quiz: {
                streak: this.quizStreak,
                completed: this.quizCompletedToday,
                progress: this.quizProgress,
                total: STREAK_CONFIG.wordsPerStreak
            },
            flashcard: {
                streak: this.flashcardStreak,
                completed: this.flashcardCompletedToday,
                progress: this.flashcardProgress,
                total: STREAK_CONFIG.wordsPerStreak
            }
        };
    },
    
    /**
     * Reset all streak data (for testing)
     */
    reset() {
        this.quizStreak = 0;
        this.flashcardStreak = 0;
        this.quizProgress = 0;
        this.flashcardProgress = 0;
        this.quizCompletedToday = false;
        this.flashcardCompletedToday = false;
        this.lastStudyDate = null;
        this.saveToStorage();
        console.log('[Streak] All streak data reset');
    },
    
    /**
     * Set callback for when streak is completed
     */
    setStreakCompleteCallback(callback) {
        this.onStreakComplete = callback;
    }
};

// ═════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Get today's date as YYYY-MM-DD string
 */
function getTodayDateString() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/**
 * Get yesterday's date as YYYY-MM-DD string
 */
function getYesterdayDateString() {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
}

// ═════════════════════════════════════════════════════════════════════════════
// STREAK UI FUNCTIONS
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Update the streak badge on mode cards
 */
function updateStreakBadges() {
    const status = StreakState.getWelcomeDisplayStatus();
    
    // Update quiz mode card
    const quizBadge = document.getElementById('quizStreakBadge');
    if (quizBadge) {
        const quizText = document.getElementById('quizStreakText');
        if (status.quiz.completed) {
            quizBadge.classList.add('completed');
            quizBadge.classList.remove('in-progress');
            if (quizText) quizText.textContent = `${status.quiz.streak} 🔥`;
        } else if (status.quiz.progress > 0) {
            quizBadge.classList.add('in-progress');
            quizBadge.classList.remove('completed');
            if (quizText) quizText.textContent = `${status.quiz.progress}/${STREAK_CONFIG.wordsPerStreak}`;
        } else {
            quizBadge.classList.remove('completed', 'in-progress');
            if (quizText) quizText.textContent = `${status.quiz.streak} 🔥`;
        }
    }
    
    // Update flashcard mode card
    const flashcardBadge = document.getElementById('flashcardStreakBadge');
    if (flashcardBadge) {
        const flashcardText = document.getElementById('flashcardStreakText');
        if (status.flashcard.completed) {
            flashcardBadge.classList.add('completed');
            flashcardBadge.classList.remove('in-progress');
            if (flashcardText) flashcardText.textContent = `${status.flashcard.streak} 🔥`;
        } else if (status.flashcard.progress > 0) {
            flashcardBadge.classList.add('in-progress');
            flashcardBadge.classList.remove('completed');
            if (flashcardText) flashcardText.textContent = `${status.flashcard.progress}/${STREAK_CONFIG.wordsPerStreak}`;
        } else {
            flashcardBadge.classList.remove('completed', 'in-progress');
            if (flashcardText) flashcardText.textContent = `${status.flashcard.streak} 🔥`;
        }
    }
}

/**
 * Show streak progress in the active study mode
 */
function updateActiveStreakDisplay(mode) {
    const status = StreakState.getStatus();
    const modeStatus = mode === 'quiz' ? status.quiz : status.flashcard;
    
    const container = document.getElementById(mode === 'quiz' ? 'quizStreakDisplay' : 'flashcardStreakDisplay');
    if (!container) return;
    
    const progressBar = container.querySelector('.streak-progress-bar');
    const progressText = container.querySelector('.streak-progress-text');
    const streakCount = container.querySelector('.streak-count');
    
    if (progressBar) {
        const percentage = (modeStatus.progress / STREAK_CONFIG.wordsPerStreak) * 100;
        progressBar.style.width = `${Math.min(100, percentage)}%`;
    }
    
    if (progressText) {
        if (modeStatus.completed) {
            progressText.textContent = 'Streak Complete! 🔥';
        } else {
            progressText.textContent = `${modeStatus.progress}/${STREAK_CONFIG.wordsPerStreak} words`;
        }
    }
    
    if (streakCount) {
        streakCount.textContent = `${modeStatus.streak} day${modeStatus.streak !== 1 ? 's' : ''}`;
    }
}

/**
 * Show streak completion celebration
 */
function showStreakCelebration(status) {
    const modeName = status.mode === 'quiz' ? 'Quiz' : 'Flashcards';
    const message = `🔥 ${modeName} Streak: ${status.streak} day${status.streak !== 1 ? 's' : ''}!`;
    
    showNotification('success', message, 5000);
    
    // Add visual celebration effect
    const container = document.getElementById(status.mode === 'quiz' ? 'appPage' : 'flashcardPage');
    if (container) {
        container.classList.add('streak-celebration');
        setTimeout(() => {
            container.classList.remove('streak-celebration');
        }, 1000);
    }
}

/**
 * Initialize streak system
 */
function initStreak() {
    StreakState.init();
    StreakState.setStreakCompleteCallback(showStreakCelebration);
    updateStreakBadges();
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { 
        StreakState, 
        STREAK_CONFIG,
        updateStreakBadges,
        updateActiveStreakDisplay,
        showStreakCelebration,
        initStreak
    };
}
