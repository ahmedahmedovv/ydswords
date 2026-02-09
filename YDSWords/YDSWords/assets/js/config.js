/* ═════════════════════════════════════════════════════════════════════════════
   YDS Words - Configuration
   ═════════════════════════════════════════════════════════════════════════════ */

const CONFIG = {
    model: 'mistralai/ministral-8b',
    temperature: 0.8,
    maxTokens: 1024,
    
    // Timeouts and rate limiting
    apiTimeout: 30000,           // 30 second API timeout
    retryAttempts: 3,            // Number of retry attempts
    retryDelay: 1000,            // Initial retry delay (ms)
    debounceDelay: 300,          // Button debounce delay
    
    // Circuit breaker settings
    circuitBreakerThreshold: 5,  // Failures before opening circuit
    circuitBreakerTimeout: 60000, // Time before trying again (1 min)
    
    // Input validation
    maxSentenceLength: 150,      // Max characters in sentence (was 2000)
    maxOptionLength: 50,         // Max characters per option (was 500)
    maxExplanationLength: 120,   // Max characters per explanation (prevents UI overflow)
    
    getPrompt: function(word) {
        // DEFENSE: Validate word before using in prompt
        if (!word || typeof word !== 'string') {
            throw new Error('Invalid word provided to prompt generator');
        }
        
        // DEFENSE: Escape special characters that could affect JSON
        const sanitizedWord = word
            .replace(/\\/g, '\\\\')
            .replace(/"/g, '\\"')
            .substring(0, 100); // Limit word length
            
        const isMultiWord = sanitizedWord.includes(' ');
        const typeHint = isMultiWord
            ? `IMPORTANT: "${sanitizedWord}" is a multi-word expression. ALL 5 options must be multi-word expressions of the same type (e.g., all phrasal verbs, all prepositional phrases, or all connectors). Do NOT mix single words with multi-word expressions.`
            : '';

        return `You are an academic English instructor. Create ONE fill-in-the-blank question.

The correct answer MUST be: "${sanitizedWord}"

${typeHint}

CRITICAL: Vary the sentence context based on the word's meaning. Do NOT default to "research study" contexts. Choose contexts that match the word's natural usage:
- For nature/environment words: use environmental, seasonal, or ecological contexts
- For business/economic words: use corporate, financial, or market contexts  
- For social/emotional words: use interpersonal, psychological, or societal contexts
- For technical words: use technological, scientific, or mechanical contexts
- For abstract/conceptual words: use philosophical, theoretical, or analytical contexts

Requirements:
- Write a concise sentence (15-25 words) with rich context where "${sanitizedWord}" is the ONLY natural fit in the blank _____
- Be concise but specific - include only essential context clues that make the correct choice unambiguous
- The sentence should feel authentic to academic writing (research papers, essays, lectures, or formal discussions)
- Provide exactly 5 options including "${sanitizedWord}" - all options must be the same grammatical type
- "${sanitizedWord}" must be the correct answer (index 0)
- Other 4 options should be plausible distractors that would NOT fit naturally given the specific context
- For EACH option, provide a BRIEF explanation (max 10-15 words) why it is correct or wrong

EXAMPLES of diverse contexts (for illustration only - create appropriate context for "${sanitizedWord}"):

Example 1 (Nature context for "blossom"): After the spring rains, the hillsides began to _____ with colorful wildflowers.

Example 2 (Business context for "merge"): The two rival companies decided to _____ and become a single organization.

Example 3 (Social context for "alienate"): His rude behavior began to _____ even his closest friends.

Example 4 (Technical context for "disrupt"): The new technology threatens to _____ the traditional industry.

Respond with JSON only:
{
  "sentence": "Your contextually appropriate sentence here with _____ for the blank",
  "options": ["${sanitizedWord}", "distractor1", "distractor2", "distractor3", "distractor4"],
  "correctIndex": 0,
  "explanations": [
    "'${sanitizedWord}' fits because it matches the context of _____.",
    "'Distractor1' is wrong because it means _____, not _____.",
    "'Distractor2' is wrong because it refers to _____, not _____.",
    "'Distractor3' is wrong because it describes _____, not _____.",
    "'Distractor4' is wrong because it implies _____, not _____."
  ]
}`;
    }
};

// Export for module systems (if needed in future)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CONFIG };
}
