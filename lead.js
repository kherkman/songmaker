(function() {
    window.SongComposer = window.SongComposer || {};

    const Lead = {
        init() {
            this.bindEvents();
            document.querySelectorAll('.lead-card .adsr-canvas').forEach(canvas => this.initADSRCanvas(canvas));
            this.observeNewSections();
            console.log("Song Composer: Lead module initialized.");
        },

        bindEvents() {
            document.body.addEventListener('click', (e) => {
                if (e.target.classList.contains('btn-add-lead')) {
                    this.addLeadInstance(e.target.closest('.leads-container'));
                    return;
                }

                // Handle Randomize Button
                if (e.target.classList.contains('btn-rnd') && !e.target.classList.contains('btn-transpose-up') && !e.target.classList.contains('btn-transpose-down')) {
                    const parentRow = e.target.closest('.controls-row');
                    if (!parentRow) return;

                    const leadInput = parentRow.querySelector('.lead-rhythm');
                    if (leadInput) {
                        leadInput.value = this.generateRandomLead();
                        leadInput.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                    return;
                }
                
                // Handle Transpose Buttons
                if (e.target.classList.contains('btn-transpose-up') || e.target.classList.contains('btn-transpose-down')) {
                    const parentRow = e.target.closest('.controls-row');
                    if (!parentRow) return;
                    
                    const input = parentRow.querySelector('.lead-rhythm');
                    if (input) {
                        const direction = e.target.classList.contains('btn-transpose-up') ? 1 : -1;
                        input.value = this.transposePattern(input.value, direction);
                        input.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                }
            });
        },

        observeNewSections() {
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === 1 && node.classList.contains('song-section')) {
                            const newCanvases = node.querySelectorAll('.lead-card .adsr-canvas');
                            newCanvases.forEach(canvas => this.initADSRCanvas(canvas));
                        }
                    });
                });
            });

            const container = document.getElementById('sections-container');
            if (container) observer.observe(container, { childList: true });
        },

        addLeadInstance(container) {
            const wrapper = container.querySelector('.collapsible-content');
            const existingCard = wrapper.querySelector('.lead-card');
            if (!existingCard) return;

            const newCard = existingCard.cloneNode(true);
            newCard.querySelector('.lead-rhythm').value = this.generateRandomLead();
            
            const canvas = newCard.querySelector('.adsr-canvas');
            this.initADSRCanvas(canvas);

            wrapper.appendChild(newCard);
        },

        // --- RND Generator ---
        generateRandomLead() {
            const chars = ['1', '2', '3', '4', '5', 'i1', 'i2', '0', '-', '-', '-', '-', '-', '-', '-', '-']; 
            let pattern = '';
            let len = 16; 
            
            for(let i = 0; i < len; i++) {
                if (i > 0 && i < len - 1 && Math.random() < 0.1 && pattern[pattern.length-1] !== '-') {
                    const targetNote = ['1', '2', '3', '4', 'i1'][Math.floor(Math.random() * 5)];
                    pattern += 'b' + targetNote;
                } else {
                    pattern += chars[Math.floor(Math.random() * chars.length)];
                }
            }
            return pattern;
        },

        // --- Transposer Engine ---
        transposePattern(pattern, amount) {
            const tokens = this.tokenizePattern(pattern);
            
            return tokens.map(tok => {
                // Ignore rests and holds
                if (tok === '0' || tok === '-') return tok;
                
                let isBend = tok.includes('b');
                let core = tok.replace('b', '');
                let isLower = core.includes('i');
                let numStr = core.replace('i', '');
                let num = parseInt(numStr, 10);
                
                // Safety fallback if completely unparseable
                if (isNaN(num)) return tok;
                
                // Map to a continuous mathematical plane (e.g. i2=-2, i1=-1, 1=1, 2=2)
                let val = isLower ? -num : num;
                
                if (amount > 0) {
                    val++;
                    if (val === 0) val = 1; // Skip 0 (Rest)
                } else if (amount < 0) {
                    val--;
                    if (val === 0) val = -1; // Skip 0 (Rest)
                }
                
                let resStr = '';
                if (val < 0) resStr = 'i' + Math.abs(val);
                else resStr = val.toString();
                
                return isBend ? 'b' + resStr : resStr;
            }).join('');
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
            // Catch trailing data if any
            if (currentToken !== '') tokens.push(currentToken);
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
            let previousNote = null;

            for (let step = 0; step < totalSectionLength; step++) {
                let activeChord = this.getActiveChordAtStep(step, chordsSequence);
                const token = tokens[step % patternLength];
                
                let action = 'play';
                let targetNote = null;

                if (token === '0') {
                    action = 'rest';
                } 
                else if (token === '-') {
                    action = 'hold';
                    targetNote = previousNote;
                } 
                else {
                    if (token.includes('b')) {
                        action = 'bend';
                    }
                    
                    targetNote = this.calculateNoteFromToken(token, activeChord);
                    
                    if (action !== 'bend' && targetNote !== null) {
                        previousNote = targetNote;
                    }
                }

                sectionSteps.push({
                    stepIndex: step,
                    action: action,
                    note: targetNote
                });
            }

            return sectionSteps;
        },

        calculateNoteFromToken(token, activeChord) {
            const digitMatch = token.match(/[0-9]/);
            if (!digitMatch || !activeChord) return null;
            
            const degree = parseInt(digitMatch[0], 10);
            if (degree <= 0) return null;
            
            const zeroBasedIdx = degree - 1;
            const chordLen = activeChord.notes.length;
            
            const baseNote = activeChord.notes[zeroBasedIdx % chordLen];
            const octavesUp = Math.floor(zeroBasedIdx / chordLen);
            
            let note = baseNote + 12 + (octavesUp * 12);
            
            if (token.includes('i')) {
                note -= 12;
            }

            return note;
        },

        getActiveChordAtStep(currentStep, chordsSequence) {
            let stepAccumulator = 0;
            for (let i = 0; i < chordsSequence.length; i++) {
                stepAccumulator += chordsSequence[i].length;
                if (currentStep < stepAccumulator) return chordsSequence[i];
            }
            return null;
        },

        // --- ADSR Canvas Engine ---
        initADSRCanvas(canvas) {
            const ctx = canvas.getContext('2d');
            let adsr = { a: 0.1, d: 0.2, s: 0.6, r: 0.3 };
            canvas.adsrData = adsr; 

            let isDragging = false;
            let activePoint = null;

            const draw = () => {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                
                const w = canvas.width;
                const h = canvas.height;
                const pA = { x: canvas.adsrData.a * w * 0.33, y: 5 }; 
                const pD = { x: pA.x + (canvas.adsrData.d * w * 0.33), y: h - (canvas.adsrData.s * h) }; 
                const pS = { x: w * 0.75, y: h - (canvas.adsrData.s * h) }; 
                const pR = { x: pS.x + (canvas.adsrData.r * w * 0.25), y: h - 5 }; 
                
                ctx.beginPath();
                ctx.moveTo(5, h - 5);
                ctx.lineTo(pA.x, pA.y);
                ctx.lineTo(pD.x, pD.y);
                ctx.lineTo(pS.x, pS.y);
                ctx.lineTo(pR.x, pR.y);
                
                ctx.strokeStyle = '#03dac6'; 
                ctx.lineWidth = 2;
                ctx.stroke();
                
                ctx.lineTo(pR.x, h);
                ctx.lineTo(0, h);
                ctx.fillStyle = 'rgba(3, 218, 198, 0.2)';
                ctx.fill();

                ctx.fillStyle = '#ff2a6d';
                [pA, pD, pR].forEach(p => {
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
                    ctx.fill();
                });
            };

            canvas.drawADSR = draw;

            canvas.addEventListener('mousedown', (e) => {
                isDragging = true;
                const rect = canvas.getBoundingClientRect();
                const x = e.clientX - rect.left;
                if (x < canvas.width * 0.33) activePoint = 'a';
                else if (x < canvas.width * 0.66) activePoint = 'd';
                else activePoint = 'r';
            });

            canvas.addEventListener('mousemove', (e) => {
                if (!isDragging) return;
                const rect = canvas.getBoundingClientRect();
                const x = Math.max(0, Math.min(e.clientX - rect.left, canvas.width));
                const y = Math.max(0, Math.min(e.clientY - rect.top, canvas.height));

                if (activePoint === 'a') canvas.adsrData.a = x / (canvas.width * 0.33);
                if (activePoint === 'd') {
                    canvas.adsrData.d = (x - (canvas.adsrData.a * canvas.width * 0.33)) / (canvas.width * 0.33);
                    canvas.adsrData.s = 1 - (y / canvas.height);
                }
                if (activePoint === 'r') canvas.adsrData.r = (x - (canvas.width * 0.75)) / (canvas.width * 0.25);
                
                Object.keys(canvas.adsrData).forEach(k => canvas.adsrData[k] = Math.max(0.01, Math.min(canvas.adsrData[k], 1)));
                draw();
            });

            window.addEventListener('mouseup', () => {
                isDragging = false;
                activePoint = null;
            });

            draw();
        },

        getADSRData(leadCard) {
            const canvas = leadCard.querySelector('.adsr-canvas');
            return canvas && canvas.adsrData ? canvas.adsrData : { a: 0.1, d: 0.2, s: 0.6, r: 0.3 };
        },

        setADSRData(leadCard, data) {
            const canvas = leadCard.querySelector('.adsr-canvas');
            if (canvas && canvas.adsrData) {
                canvas.adsrData = { ...canvas.adsrData, ...data };
                if (canvas.drawADSR) canvas.drawADSR();
            }
        }
    };

    window.SongComposer.Lead = Lead;

    document.addEventListener('DOMContentLoaded', () => {
        Lead.init();
    });

})();