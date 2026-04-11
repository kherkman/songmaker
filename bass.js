(function() {
    window.SongComposer = window.SongComposer || {};

    const Bass = {
        init() {
            this.bindEvents();
            console.log("Song Composer: Bass module initialized.");
        },

        bindEvents() {
            document.body.addEventListener('click', (e) => {
                if (!e.target.classList.contains('btn-rnd')) return;

                const parentRow = e.target.closest('.controls-row');
                if (!parentRow) return;

                const prevElement = e.target.previousElementSibling;
                if (!prevElement) return;

                const bassInput = prevElement.querySelector('.bass-rhythm');
                if (bassInput) {
                    bassInput.value = this.generateRandomBass();
                    bassInput.dispatchEvent(new Event('change', { bubbles: true }));
                }
            });
        },

        // --- RND Generator ---
        generateRandomBass() {
            // Added 'i1' for lower sub hits in the randomizer
            const chars = ['1', '1', '1', 'i1', '0', '-', '3', '4']; 
            let pattern = '';
            let len = 16; // Force exactly 16 steps
            
            pattern += '1';
            
            for(let i = 1; i < len; i++) {
                if (i % 4 === 0 && Math.random() > 0.3) {
                    pattern += '1';
                } else {
                    pattern += chars[Math.floor(Math.random() * chars.length)];
                }
            }
            return pattern;
        },

        // --- Tokenizer ---
        tokenizePattern(pattern) {
            const tokens = [];
            let currentToken = '';
            for (let i = 0; i < pattern.length; i++) {
                const char = pattern[i].toLowerCase();
                if (char === '0' || char === '-') {
                    tokens.push(char);
                } else if (char === 'i' || char === 'b') {
                    currentToken += char; 
                } else if (/[0-9]/.test(char)) {
                    currentToken += char;
                    tokens.push(currentToken);
                    currentToken = ''; 
                }
            }
            if (tokens.length === 0) tokens.push('0');
            return tokens;
        },

        // --- Sequencing Logic ---
        parseSection(rhythmString, chordsSequence) {
            if (!rhythmString || !chordsSequence) return [];

            let sectionSteps = [];
            let totalSectionLength = 0;
            
            chordsSequence.forEach(chord => totalSectionLength += chord.length);

            const tokens = this.tokenizePattern(rhythmString);
            const patternLength = tokens.length;

            for (let step = 0; step < totalSectionLength; step++) {
                let activeChord = this.getActiveChordAtStep(step, chordsSequence);
                const token = tokens[step % patternLength];
                
                let note = null;
                let action = 'play'; 

                if (token === '0') {
                    action = 'rest';
                } else if (token === '-') {
                    action = 'hold';
                } else {
                    const digitMatch = token.match(/[0-9]/);
                    if (digitMatch && activeChord) {
                        const degree = parseInt(digitMatch[0], 10);
                        if (degree > 0) {
                            const zeroBasedIdx = degree - 1;
                            const chordLen = activeChord.notes.length; 
                            
                            const baseNote = activeChord.notes[zeroBasedIdx % chordLen];
                            const octavesUp = Math.floor(zeroBasedIdx / chordLen);
                            
                            // Bass is usually played 2 octaves lower (-24) changed to 0, so the octave is right
                            note = (baseNote - 0) + (octavesUp * 12);
                            
                            // If inverted 'i' flag is present, pitch down 1 more octave
                            if (token.includes('i')) {
                                note -= 12;
                            }
                        } else {
                            action = 'rest';
                        }
                    } else {
                        action = 'rest';
                    }
                }

                sectionSteps.push({
                    stepIndex: step,
                    action: action,
                    note: note
                });
            }

            return sectionSteps;
        },

        getActiveChordAtStep(currentStep, chordsSequence) {
            let stepAccumulator = 0;
            for (let i = 0; i < chordsSequence.length; i++) {
                stepAccumulator += chordsSequence[i].length;
                if (currentStep < stepAccumulator) {
                    return chordsSequence[i];
                }
            }
            return null;
        },

        getDuckingFlag(sectionElement) {
            const duckingCheckbox = sectionElement.querySelector('.bass-ducking');
            return duckingCheckbox ? duckingCheckbox.checked : false;
        },

        getSoundFile(sectionElement) {
            const soundSelect = sectionElement.querySelector('.bass-sound');
            return soundSelect ? soundSelect.value : 'bass1.wav';
        }
    };

    window.SongComposer.Bass = Bass;

    document.addEventListener('DOMContentLoaded', () => {
        Bass.init();
    });

})();