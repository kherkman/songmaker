(function() {
    window.SongComposer = window.SongComposer || {};

    const Chords = {
        romanMap: {
            'i': 0, 'ii': 1, 'iii': 2, 'iv': 3, 'v': 4, 'vi': 5, 'vii': 6
        },

        init() {
            this.bindEvents();
            this.initExistingCanvases();
            this.observeNewSections();
            console.log("Song Composer: Chords module initialized.");
        },

        bindEvents() {
            document.body.addEventListener('click', (e) => {
                if (!e.target.classList.contains('btn-rnd')) return;

                const parentRow = e.target.closest('.controls-row');
                if (!parentRow) return;
                
                const prevElement = e.target.previousElementSibling;
                if (!prevElement) return;

                const progInput = prevElement.querySelector('.chord-prog');
                if (progInput) {
                    progInput.value = this.generateRandomProgression();
                    progInput.dispatchEvent(new Event('change', { bubbles: true }));
                }

                const arpInput = prevElement.querySelector('.chord-arp-pattern');
                if (arpInput) {
                    arpInput.value = this.generateRandomArp();
                    arpInput.dispatchEvent(new Event('change', { bubbles: true }));
                }
            });
        },

        // --- Dynamic UI Initialization ---
        initExistingCanvases() {
            document.querySelectorAll('.instrument-group:first-of-type .adsr-canvas').forEach(canvas => {
                this.initADSRCanvas(canvas);
            });
        },

        observeNewSections() {
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === 1 && node.classList.contains('song-section')) {
                            const newCanvas = node.querySelector('.instrument-group:first-of-type .adsr-canvas');
                            if (newCanvas) this.initADSRCanvas(newCanvas);
                        }
                    });
                });
            });

            const container = document.getElementById('sections-container');
            if (container) observer.observe(container, { childList: true });
        },

        // --- ADSR Canvas Engine ---
        initADSRCanvas(canvas) {
            const ctx = canvas.getContext('2d');
            let adsr = { a: 0.2, d: 0.3, s: 0.8, r: 0.5 }; 
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
                
                ctx.strokeStyle = '#bb86fc'; 
                ctx.lineWidth = 2;
                ctx.stroke();
                
                ctx.lineTo(pR.x, h);
                ctx.lineTo(0, h);
                ctx.fillStyle = 'rgba(187, 134, 252, 0.2)';
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

        getADSRData(sectionElement) {
            const canvas = sectionElement.querySelector('.instrument-group:first-of-type .adsr-canvas');
            return canvas && canvas.adsrData ? canvas.adsrData : { a: 0.2, d: 0.3, s: 0.8, r: 0.5 };
        },

        setADSRData(sectionElement, data) {
            const canvas = sectionElement.querySelector('.instrument-group:first-of-type .adsr-canvas');
            if (canvas && canvas.adsrData) {
                canvas.adsrData = { ...canvas.adsrData, ...data };
                if (canvas.drawADSR) canvas.drawADSR();
            }
        },

        // --- RND Generators ---
        generateRandomProgression() {
            const numerals = ['I', 'ii', 'iii', 'IV', 'V', 'vi']; 
            const lengths = [8, 16, 16, 32]; 
            
            let prog = [];
            let numChords = Math.floor(Math.random() * 3) + 2; 
            
            prog.push('I' + lengths[Math.floor(Math.random() * lengths.length)]);
            
            for(let i = 1; i < numChords; i++) {
                let numeral = numerals[Math.floor(Math.random() * numerals.length)];
                let length = lengths[Math.floor(Math.random() * lengths.length)];
                prog.push(numeral + length);
            }
            return prog.join('-');
        },

        generateRandomArp() {
            const pool = ['1','2','3','4','i1','i2','i3','1','2','3','0','-'];
            let arp = '';
            let len = 16; 
            
            arp += ['1','2','3','4','i1'][Math.floor(Math.random() * 5)];
            
            for(let i = 1; i < len; i++) {
                arp += pool[Math.floor(Math.random() * pool.length)];
            }
            return arp;
        },

        // --- Parsing & Length Calculation ---
        calculateSectionLength(progString) {
            if (!progString) return 0;
            const chords = progString.split('-');
            let totalSteps = 0;
            
            chords.forEach(chordStr => {
                const match = chordStr.match(/[0-9]+$/);
                if (match) {
                    totalSteps += parseInt(match[0], 10);
                }
            });
            
            return totalSteps;
        },

        parseProgression(progString, rootMidi = 48, scaleSteps = [2, 2, 1, 2, 2, 2, 1]) {
            const scale = this.buildScale(rootMidi, scaleSteps);
            const chordsRaw = progString.split('-');
            let parsedSequence = [];
            let previousVoicing = null;

            chordsRaw.forEach(chordStr => {
                const match = chordStr.match(/^([IVvi]+)(°?)([0-9]+)$/i);
                if (!match) return;

                const numeral = match[1].toLowerCase();
                const length = parseInt(match[3], 10);
                
                const degreeIdx = this.romanMap[numeral];
                if (degreeIdx === undefined) return;

                const sLen = scale.length;
                const rootNote = scale[degreeIdx % sLen] + Math.floor(degreeIdx / sLen) * 12;
                
                const thirdIdx = degreeIdx + 2;
                const thirdNote = scale[thirdIdx % sLen] + Math.floor(thirdIdx / sLen) * 12;
                
                const fifthIdx = degreeIdx + 4;
                const fifthNote = scale[fifthIdx % sLen] + Math.floor(fifthIdx / sLen) * 12;

                const rootPositionTriad = [rootNote, thirdNote, fifthNote];
                const bestVoicing = this.getNearestVoicing(previousVoicing, rootPositionTriad);
                
                parsedSequence.push({
                    name: chordStr,
                    notes: bestVoicing,
                    length: length
                });

                previousVoicing = bestVoicing;
            });

            return parsedSequence;
        },

        getNearestVoicing(prevChord, rootPosition) {
            if (!prevChord) return rootPosition;

            const [r, t, f] = rootPosition;
            const possibleVoicings = [
                [r, t, f],
                [t, f, r + 12],
                [f, r + 12, t + 12],
                [r - 12, t - 12, f - 12],
                [t - 12, f - 12, r],
                [f - 12, r, t]
            ];

            let bestVoicing = null;
            let minDistance = Infinity;

            possibleVoicings.forEach(voicing => {
                voicing.sort((a, b) => a - b);
                
                let distance = 0;
                for (let i = 0; i < 3; i++) {
                    distance += Math.abs(voicing[i] - prevChord[i]);
                }

                if (distance < minDistance) {
                    minDistance = distance;
                    bestVoicing = voicing;
                }
            });

            return bestVoicing;
        },

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

        buildScale(rootMidi, scaleStepsStr) {
            const steps = String(scaleStepsStr).split('').map(Number);
            const scale = [rootMidi];
            let current = rootMidi;
            
            for(let i = 0; i < steps.length - 1; i++) {
                current += steps[i];
                scale.push(current);
            }
            return scale;
        }
    };

    window.SongComposer.Chords = Chords;

    document.addEventListener('DOMContentLoaded', () => {
        Chords.init();
    });

})();