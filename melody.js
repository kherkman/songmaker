(function() {
    window.SongComposer = window.SongComposer || {};

    const Melody = {
        isOpen: false,
        isArmed: false,
        isRecording: false,
        currentStep: 0,
        maxSteps: 16,
        recordedNotes: [],
        intervalId: null,
        activeNotes: new Set(),
        
        // C3 to B4 base mapping for computer QWERTY keyboard
        pcKeyMap: {
            'z': 48, 's': 49, 'x': 50, 'd': 51, 'c': 52, 'v': 53, 'g': 54, 'b': 55, 'h': 56, 'n': 57, 'j': 58, 'm': 59,
            'q': 60, '2': 61, 'w': 62, '3': 63, 'e': 64, 'r': 65, '5': 66, 't': 67, '6': 68, 'y': 69, '7': 70, 'u': 71
        },
        
        noteNames: ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'],

        init() {
            this.cacheDOM();
            this.bindEvents();
            console.log("Song Composer: Melody module initialized.");
        },

        cacheDOM() {
            this.elements = {
                modal: document.getElementById('melody-modal'),
                closeBtn: document.getElementById('close-melody-modal'),
                stepInput: document.getElementById('melody-steps-input'),
                pianoContainer: document.getElementById('melody-piano'),
                notesDisplay: document.getElementById('melody-notes-display'),
                btnRec: document.getElementById('btn-melody-rec'),
                btnCancel: document.getElementById('btn-melody-cancel'),
                chordResults: document.getElementById('melody-chord-results'),
                sectionSelect: document.getElementById('melody-target-section'),
                btnUse: document.getElementById('btn-melody-use')
            };
        },

        bindEvents() {
            if (this.elements.closeBtn) this.elements.closeBtn.addEventListener('click', () => this.closeModal());
            if (this.elements.btnCancel) this.elements.btnCancel.addEventListener('click', () => this.closeModal());
            if (this.elements.btnRec) this.elements.btnRec.addEventListener('click', () => this.toggleRecord());
            if (this.elements.btnUse) this.elements.btnUse.addEventListener('click', () => this.applyToSection());
            
            // Computer Keyboard Listeners
            document.addEventListener('keydown', (e) => {
                if (!this.isOpen || e.repeat) return;
                // Ignore if typing in an input field
                if (['INPUT', 'SELECT'].includes(e.target.tagName)) return;
                
                const midiNote = this.pcKeyMap[e.key.toLowerCase()];
                if (midiNote) this.triggerNoteOn(midiNote);
            });

            document.addEventListener('keyup', (e) => {
                if (!this.isOpen) return;
                const midiNote = this.pcKeyMap[e.key.toLowerCase()];
                if (midiNote) this.triggerNoteOff(midiNote);
            });
        },

        openModal() {
            this.isOpen = true;
            this.elements.modal.classList.remove('hidden');
            this.maxSteps = parseInt(this.elements.stepInput.value, 10) || 16;
            this.resetRecording();
            this.buildPiano();
        },

        closeModal() {
            this.isOpen = false;
            this.stopRecording();
            this.elements.modal.classList.add('hidden');
        },

        // --- Graphic Piano Builder ---
        buildPiano() {
            const rootMidi = window.SongComposer.Master.getRootMidi();
            const scaleStr = window.SongComposer.Master.getScaleSteps();
            // Build absolute scale notes using Chords utility
            const scaleNotes = window.SongComposer.Chords.buildScale(rootMidi, scaleStr);
            // Expand scale to cover 3 octaves (36 to 72)
            const validPitches = new Set();
            scaleNotes.forEach(n => {
                validPitches.add(n - 12);
                validPitches.add(n);
                validPitches.add(n + 12);
                validPitches.add(n + 24);
            });

            this.elements.pianoContainer.innerHTML = '';
            
            // Calculate total white keys to determine percentage width for absolute positioning
            let totalWhiteKeys = 0;
            for (let i = 48; i < 72; i++) {
                if (![1, 3, 6, 8, 10].includes(i % 12)) totalWhiteKeys++;
            }

            let whiteKeyCount = 0;
            
            // Build keys from C3 (48) to B4 (71)
            for (let i = 48; i < 72; i++) {
                const isBlack = [1, 3, 6, 8, 10].includes(i % 12);
                const isValid = validPitches.has(i);
                const isRoot = (i % 12) === (rootMidi % 12);

                const key = document.createElement('div');
                key.className = `piano-key ${isBlack ? 'black-key' : 'white-key'}`;
                key.dataset.midi = i;

                if (isBlack) {
                    // Position black key precisely at the right edge of the previously drawn white keys
                    key.style.left = `${(whiteKeyCount / totalWhiteKeys) * 100}%`;
                } else {
                    whiteKeyCount++; // Increment white key counter
                }

                if (!isValid) {
                    key.classList.add('disabled');
                } else {
                    // Mouse / Touch events for graphic keys
                    key.addEventListener('mousedown', () => this.triggerNoteOn(i));
                    key.addEventListener('mouseup', () => this.triggerNoteOff(i));
                    key.addEventListener('mouseleave', () => this.triggerNoteOff(i));
                    key.addEventListener('touchstart', (e) => { e.preventDefault(); this.triggerNoteOn(i); });
                    key.addEventListener('touchend', (e) => { e.preventDefault(); this.triggerNoteOff(i); });
                }

                if (isRoot) {
                    const label = document.createElement('span');
                    label.textContent = 'R';
                    label.className = 'root-label';
                    key.appendChild(label);
                }

                this.elements.pianoContainer.appendChild(key);
            }
        },

        // --- Input Triggers ---
        triggerNoteOn(midiNote) {
            if (!this.activeNotes.has(midiNote)) {
                this.activeNotes.add(midiNote);
                this.highlightKey(midiNote, true);
                
                // Play audio preview
                if (window.SongComposer.Audio && window.SongComposer.Audio.scheduleNote) {
                    window.SongComposer.Audio.scheduleNote({
                        bufferName: 'lead1.wav', // Default preview sound
                        time: window.SongComposer.Audio.ctx ? window.SongComposer.Audio.ctx.currentTime : 0,
                        noteMidi: midiNote,
                        baseMidi: 60, // Middle C Reference
                        duration: 0.5
                    });
                }

                // If currently armed but NOT actively recording yet, start actual recording counter!
                // Metronome keeps running in the background untouched.
                if (this.isArmed && !this.isRecording) {
                    this.isRecording = true;
                    this.currentStep = 0;
                }

                // If officially recording, log to sequence as a strike
                if (this.isRecording && this.currentStep < this.maxSteps) {
                    this.recordedNotes[this.currentStep] = { type: 'strike', note: midiNote };
                    this.updateNotesDisplay();
                }
            }
        },

        triggerNoteOff(midiNote) {
            if (this.activeNotes.has(midiNote)) {
                this.activeNotes.delete(midiNote);
                this.highlightKey(midiNote, false);
            }
        },

        highlightKey(midiNote, isOn) {
            const key = this.elements.pianoContainer.querySelector(`.piano-key[data-midi="${midiNote}"]`);
            if (key && !key.classList.contains('disabled')) {
                if (isOn) key.classList.add('active');
                else key.classList.remove('active');
            }
        },

        // --- Recording Loop ---
        resetRecording() {
            this.recordedNotes = new Array(this.maxSteps).fill(null);
            this.currentStep = 0;
            this.metronomeTickCount = 0;
            this.updateNotesDisplay();
            this.elements.chordResults.innerHTML = ''; // Clear old suggestions
        },

        toggleRecord() {
            if (this.isArmed || this.isRecording) {
                this.stopRecording();
            } else {
                this.startRecording();
            }
        },

        startRecording() {
            // Wake audio context in case the user clicked directly before interaction
            if (window.SongComposer.Audio && window.SongComposer.Audio.initAudioContext) {
                window.SongComposer.Audio.initAudioContext();
            }

            this.isArmed = true;
            this.isRecording = false; // Remains false until the first key is pressed
            this.elements.btnRec.textContent = '⏹ Stop Rec';
            this.elements.btnRec.classList.add('recording-active');
            this.maxSteps = parseInt(this.elements.stepInput.value, 10) || 16;
            this.resetRecording();

            const tempo = window.SongComposer.Master.getTempo();
            // Calculate ms per 16th note step: (60000 / BPM) / 4
            const stepDuration = (60000 / tempo) / 4;

            // PLAY IMMEDIATE METRONOME TICK ON BEAT 1 (Constant metronome logic)
            if (window.SongComposer.Audio && window.SongComposer.Audio.scheduleNote) {
                window.SongComposer.Audio.scheduleNote({
                    bufferName: 'hihat.wav',
                    time: window.SongComposer.Audio.ctx ? window.SongComposer.Audio.ctx.currentTime : 0,
                    velocity: 0.5
                });
            }
            if (this.elements.btnRec) {
                this.elements.btnRec.classList.add('recording-flash');
                setTimeout(() => {
                    if (this.elements.btnRec) this.elements.btnRec.classList.remove('recording-flash');
                }, 100);
            }
            
            // Start counter at 1 because Beat 1 (Step 0) just fired immediately
            this.metronomeTickCount = 1; 

            this.intervalId = setInterval(() => {
                // Constantly play metronome every 4 steps (quarter note downbeats)
                if (this.metronomeTickCount % 4 === 0) {
                    if (window.SongComposer.Audio && window.SongComposer.Audio.scheduleNote) {
                        window.SongComposer.Audio.scheduleNote({
                            bufferName: 'hihat.wav',
                            time: window.SongComposer.Audio.ctx ? window.SongComposer.Audio.ctx.currentTime : 0,
                            velocity: 0.5
                        });
                    }
                    
                    // Trigger visual flash synchronized with quarter note
                    if (this.elements.btnRec) {
                        this.elements.btnRec.classList.add('recording-flash');
                        setTimeout(() => {
                            if (this.elements.btnRec) this.elements.btnRec.classList.remove('recording-flash');
                        }, 100); // 100ms flash duration
                    }
                }
                this.metronomeTickCount++;

                // Step advancement ONLY fires when actual recording has begun
                if (this.isRecording) {
                    this.currentStep++;
                    
                    if (this.currentStep >= this.maxSteps) {
                        this.stopRecording();
                        this.harmonize();
                    } else {
                        // Check if a note is currently held down to record a "hold" tie
                        if (this.activeNotes.size > 0 && !this.recordedNotes[this.currentStep]) {
                            const heldNote = [...this.activeNotes][0]; // Extract first held note
                            this.recordedNotes[this.currentStep] = { type: 'hold', note: heldNote };
                        }
                        this.updateNotesDisplay(); // Update visual playhead
                    }
                }
            }, stepDuration);
        },

        stopRecording() {
            this.isArmed = false;
            this.isRecording = false;
            this.elements.btnRec.textContent = '⏺ Rec';
            this.elements.btnRec.classList.remove('recording-active');
            this.elements.btnRec.classList.remove('recording-flash');
            clearInterval(this.intervalId);
            this.currentStep = 0;
            this.metronomeTickCount = 0;
            this.updateNotesDisplay();
        },

        updateNotesDisplay() {
            this.elements.notesDisplay.innerHTML = '';
            for (let i = 0; i < this.maxSteps; i++) {
                const stepData = this.recordedNotes[i];
                const span = document.createElement('span');
                span.className = 'note-step';
                
                if (i === this.currentStep && (this.isRecording || this.isArmed)) {
                    span.classList.add('current-step');
                }
                
                if (stepData) {
                    if (stepData.type === 'strike') {
                        span.textContent = this.noteNames[stepData.note % 12];
                        span.classList.add('has-note');
                    } else if (stepData.type === 'hold') {
                        span.textContent = '-';
                        span.classList.add('has-note');
                    }
                } else {
                    span.textContent = '.';
                }
                this.elements.notesDisplay.appendChild(span);
            }
        },

        // --- Harmonization & Translation Algorithm ---
        harmonize() {
            // Group melody into blocks (e.g., 4 steps per chord)
            const stepsPerChord = 4;
            const numChords = Math.ceil(this.maxSteps / stepsPerChord);
            
            // Diatonic triads in Major scale (simplified map)
            const chords = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'];
            let generatedProgression = [];

            for (let i = 0; i < numChords; i++) {
                // Extract notes for this block
                const blockNotes = this.recordedNotes.slice(i * stepsPerChord, (i + 1) * stepsPerChord);
                const activePitches = blockNotes
                    .filter(n => n !== null && n.type === 'strike')
                    .map(n => n.note % 12);
                
                if (activePitches.length === 0) {
                    // Empty block, just default to I
                    generatedProgression.push(`I${stepsPerChord}`);
                    continue;
                }

                // Pick a random sensible chord that fits the block size
                const randomChord = chords[Math.floor(Math.random() * 6)]; // Exclude diminished for safety
                generatedProgression.push(`${randomChord}${stepsPerChord}`);
            }

            const progString = generatedProgression.join('-');
            
            // Render the options to the user
            this.elements.chordResults.innerHTML = `
                <h4>Suggested Progression:</h4>
                <div class="chord-option selected" data-prog="${progString}">
                    ${progString}
                </div>
            `;
            // Store the generated progression in memory for the 'Use' button
            this.selectedProgression = progString;
        },

        midiToLeadToken(midiNote, activeChord) {
            if (!activeChord || !activeChord.notes || activeChord.notes.length === 0) return '1';
            
            let bestToken = '1';
            let minDiff = Infinity;

            // Check standard triad degrees over multiple octaves (degrees 1 through 9)
            for (let d = 1; d <= 9; d++) {
                let zIdx = d - 1;
                let chordLen = activeChord.notes.length;
                let baseNote = activeChord.notes[zIdx % chordLen];
                let octavesUp = Math.floor(zIdx / chordLen);
                
                // Standard lead notation logic (Lead naturally plays +12 semitones up)
                let noteNormal = baseNote + 12 + (octavesUp * 12);
                let diffNormal = Math.abs(midiNote - noteNormal);
                
                if (diffNormal < minDiff) {
                    minDiff = diffNormal;
                    bestToken = d.toString();
                }

                // Inverted lead notation logic ('i' prefix drops -12 semitones)
                let noteInv = noteNormal - 12;
                let diffInv = Math.abs(midiNote - noteInv);
                
                if (diffInv < minDiff) {
                    minDiff = diffInv;
                    bestToken = 'i' + d.toString();
                }
            }
            
            return bestToken;
        },

        applyToSection() {
            if (!this.selectedProgression) {
                alert("Please record a melody first to generate chords.");
                return;
            }

            const sectionId = this.elements.sectionSelect.value; 
            const sectionEl = document.querySelector(`.song-section[data-section="${sectionId}"]`);
            
            if (!sectionEl) {
                alert(`Section ${sectionId} editor not found. Please create it in the timeline first.`);
                return;
            }

            // 1. Inject Chord Progression
            const chordInput = sectionEl.querySelector('.chord-prog');
            if (chordInput) {
                chordInput.value = this.selectedProgression;
                // Dispatch event so timeline automatically resizes proportionally
                chordInput.dispatchEvent(new Event('change', { bubbles: true })); 
            }

            // 2. Translate absolute recorded notes to relative Lead Syntax mathematically
            let leadSyntax = '';
            
            // Build the absolute scale data for parsing
            const rootMidi = window.SongComposer.Master.getRootMidi();
            const scaleStr = window.SongComposer.Master.getScaleSteps();
            
            // Parse the progression we just injected to find the exact chord triad at every step
            const parsedChords = window.SongComposer.Chords.parseProgression(this.selectedProgression, rootMidi, scaleStr);
            
            const activeChordAtStep = (step) => {
                let accum = 0;
                for (let c of parsedChords) {
                    accum += c.length;
                    if (step < accum) return c;
                }
                return parsedChords[parsedChords.length - 1]; // Fallback to last chord
            };
            
            // Build the syntax string
            for (let i = 0; i < this.maxSteps; i++) {
                const stepData = this.recordedNotes[i];
                if (!stepData) {
                    leadSyntax += '0'; // Rest
                } else if (stepData.type === 'hold') {
                    leadSyntax += '-'; // Note Hold
                } else if (stepData.type === 'strike') {
                    const activeChord = activeChordAtStep(i);
                    leadSyntax += this.midiToLeadToken(stepData.note, activeChord);
                }
            }

            // Inject Lead Rhythm
            const leadInput = sectionEl.querySelector('.lead-rhythm');
            if (leadInput) {
                leadInput.value = leadSyntax;
                leadInput.dispatchEvent(new Event('change', { bubbles: true }));
            }

            alert(`Successfully applied to Section ${sectionId}.`);
            this.closeModal();
        }
    };

    window.SongComposer.Melody = Melody;

    document.addEventListener('DOMContentLoaded', () => {
        Melody.init();
    });

})();