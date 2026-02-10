/* ═════════════════════════════════════════════════════════════════════════════
   Thunder YDS - Streak System
   Tracks daily study streaks separately for Quiz and Flashcard modes
   Uses native iOS storage (UserDefaults) via WKWebView bridge for persistence
   ═════════════════════════════════════════════════════════════════════════════ */

// ═════════════════════════════════════════════════════════════════════════════
// NATIVE STORAGE BRIDGE
// Provides persistent storage via iOS UserDefaults instead of volatile localStorage
// ═════════════════════════════════════════════════════════════════════════════

const NativeStorage = {
    // Check if running in native iOS app with storage bridge
    isAvailable() {
        const available = window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.nativeStorage;
        return !!available;
    },
    
    // Save data to native storage
    async save(key, value) {
        return new Promise((resolve) => {
            if (!this.isAvailable()) {
                // Fallback to localStorage for browser testing
                try {
                    localStorage.setItem(key, value);
                    resolve(true);
                } catch (e) {
                    console.error('[NativeStorage] Fallback save failed:', e);
                    resolve(false);
                }
                return;
            }
            
            // Use native storage
            const callbackId = 'native_save_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            window[callbackId] = (success) => {
                cleanup();
                resolve(success === true);
            };
            
            const cleanup = () => {
                delete window[callbackId];
            };
            
            try {
                window.webkit.messageHandlers.nativeStorage.postMessage({
                    action: 'save',
                    key: key,
                    value: String(value),
                    callback: callbackId
                });
            } catch (e) {
                console.error('[NativeStorage] postMessage failed:', e);
                cleanup();
                resolve(false);
                return;
            }
            
            // Timeout fallback
            setTimeout(() => {
                if (window[callbackId]) {
                    cleanup();
                    resolve(false);
                }
            }, 2000);
        });
    },
    
    // Load data from native storage
    async load(key) {
        return new Promise((resolve) => {
            if (!this.isAvailable()) {
                // Fallback to localStorage for browser testing
                try {
                    const value = localStorage.getItem(key) || '';
                    resolve(value);
                } catch (e) {
                    console.error('[NativeStorage] Fallback load failed:', e);
                    resolve('');
                }
                return;
            }
            
            // Use native storage
            const callbackId = 'native_load_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            window[callbackId] = (value) => {
                cleanup();
                // Value comes through JSON.parse, so it's already a string
                resolve(value || '');
            };
            
            const cleanup = () => {
                delete window[callbackId];
            };
            
            try {
                window.webkit.messageHandlers.nativeStorage.postMessage({
                    action: 'load',
                    key: key,
                    callback: callbackId
                });
            } catch (e) {
                console.error('[NativeStorage] postMessage failed:', e);
                cleanup();
                resolve('');
                return;
            }
            
            // Timeout fallback
            setTimeout(() => {
                if (window[callbackId]) {
                    cleanup();
                    resolve('');
                }
            }, 2000);
        });
    },
    
    // Load all streak data at once
    async loadAll() {
        return new Promise((resolve) => {
            if (!this.isAvailable()) {
                // Fallback to localStorage for browser testing
                const data = {};
                try {
                    for (const key of Object.values(STREAK_CONFIG.storageKeys)) {
                        const value = localStorage.getItem(key);
                        if (value !== null) {
                            data[key] = value;
                        }
                    }
                } catch (e) {
                    console.error('[NativeStorage] Fallback loadAll failed:', e);
                }
                resolve(data);
                return;
            }
            
            // Use native storage
            const callbackId = 'native_loadall_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            window[callbackId] = (data) => {
                cleanup();
                resolve(data || {});
            };
            
            const cleanup = () => {
                delete window[callbackId];
            };
            
            try {
                window.webkit.messageHandlers.nativeStorage.postMessage({
                    action: 'loadAll',
                    callback: callbackId
                });
            } catch (e) {
                console.error('[NativeStorage] postMessage failed:', e);
                cleanup();
                resolve({});
                return;
            }
            
            // Timeout fallback
            setTimeout(() => {
                if (window[callbackId]) {
                    cleanup();
                    resolve({});
                }
            }, 2000);
        });
    },
    
    // Clear all streak data (for testing)
    async clear() {
        if (this.isAvailable()) {
            try {
                window.webkit.messageHandlers.nativeStorage.postMessage({
                    action: 'clear'
                });
            } catch (e) {
                console.error('[NativeStorage] Clear postMessage failed:', e);
            }
        }
        // Also clear localStorage fallback
        try {
            for (const key of Object.values(STREAK_CONFIG.storageKeys)) {
                localStorage.removeItem(key);
            }
        } catch (e) {
            console.error('[NativeStorage] Clear fallback failed:', e);
        }
    }
};

// ═════════════════════════════════════════════════════════════════════════════
// STREAK CONFIGURATION
// ═════════════════════════════════════════════════════════════════════════════

const STREAK_CONFIG = {
    // Number of words needed to complete a streak for each mode
    wordsPerStreak: 20,
    
    // Storage keys (must match ViewController.swift)
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
    
    // Track pending saves to prevent data loss
    _pendingSaves: 0,
    
    /**
     * Initialize streak state from native storage
     */
    async init() {
        console.log('[Streak] Initializing with native storage...');
        await this.loadFromStorage();
        this.checkDateReset();
        console.log('[Streak] Initialized:', this.getStatus());
        
        // Set up periodic save check (in case app is terminated)
        this._setupAutoSave();
    },
    
    /**
     * Setup auto-save on page hide/visibility change
     */
    _setupAutoSave() {
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                // Page is being hidden - ensure data is saved
                this.saveToStorage();
            }
        });
        
        window.addEventListener('beforeunload', () => {
            // App is closing - emergency save
            this.saveToStorage();
        });
    },
    
    /**
     * Load all streak data from native storage
     */
    async loadFromStorage() {
        try {
            const data = await NativeStorage.loadAll();
            
            this.quizStreak = parseInt(data[STREAK_CONFIG.storageKeys.quizStreak]) || 0;
            this.flashcardStreak = parseInt(data[STREAK_CONFIG.storageKeys.flashcardStreak]) || 0;
            this.quizProgress = parseInt(data[STREAK_CONFIG.storageKeys.quizProgress]) || 0;
            this.flashcardProgress = parseInt(data[STREAK_CONFIG.storageKeys.flashcardProgress]) || 0;
            this.lastStudyDate = data[STREAK_CONFIG.storageKeys.lastStudyDate] || null;
            this.quizCompletedToday = data[STREAK_CONFIG.storageKeys.quizCompletedToday] === 'true';
            this.flashcardCompletedToday = data[STREAK_CONFIG.storageKeys.flashcardCompletedToday] === 'true';
            
            console.log('[Streak] Loaded from native storage');
        } catch (e) {
            console.error('[Streak] Error loading from storage:', e);
            this.reset();
        }
    },
    
    /**
     * Save all streak data to native storage
     */
    async saveToStorage() {
        this._pendingSaves++;
        const currentSave = this._pendingSaves;
        
        try {
            const saves = [
                NativeStorage.save(STREAK_CONFIG.storageKeys.quizStreak, this.quizStreak.toString()),
                NativeStorage.save(STREAK_CONFIG.storageKeys.flashcardStreak, this.flashcardStreak.toString()),
                NativeStorage.save(STREAK_CONFIG.storageKeys.quizProgress, this.quizProgress.toString()),
                NativeStorage.save(STREAK_CONFIG.storageKeys.flashcardProgress, this.flashcardProgress.toString()),
                NativeStorage.save(STREAK_CONFIG.storageKeys.lastStudyDate, this.lastStudyDate || ''),
                NativeStorage.save(STREAK_CONFIG.storageKeys.quizCompletedToday, this.quizCompletedToday.toString()),
                NativeStorage.save(STREAK_CONFIG.storageKeys.flashcardCompletedToday, this.flashcardCompletedToday.toString())
            ];
            
            await Promise.all(saves);
            
            // Only log if this was the most recent save
            if (currentSave === this._pendingSaves) {
                console.log('[Streak] Saved to native storage');
            }
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
    async reset() {
        this.quizStreak = 0;
        this.flashcardStreak = 0;
        this.quizProgress = 0;
        this.flashcardProgress = 0;
        this.quizCompletedToday = false;
        this.flashcardCompletedToday = false;
        this.lastStudyDate = null;
        await NativeStorage.clear();
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
    
    // DEFENSE: Check if showNotification is available (loaded from ui.js)
    if (typeof showNotification === 'function') {
        showNotification('success', message, 5000);
    } else {
        console.log('[Streak] Celebration:', message);
    }
    
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
async function initStreak() {
    await StreakState.init();
    StreakState.setStreakCompleteCallback(showStreakCelebration);
    updateStreakBadges();
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { 
        NativeStorage,
        StreakState, 
        STREAK_CONFIG,
        updateStreakBadges,
        updateActiveStreakDisplay,
        showStreakCelebration,
        initStreak
    };
}
