(function() {
    window.SongComposer = window.SongComposer || {};

    const Master = {
        rootNotesMap: {
            'C': 48, 'C#': 49, 'D': 50, 'D#': 51, 'E': 52, 'F': 53,
            'F#': 54, 'G': 55, 'G#': 56, 'A': 57, 'A#': 58, 'B': 59
        },
        
        midiAccess: null,
        activeMidiInput: null,
        activeMidiOutput: null,

        init() {
            this.cacheDOM();
            this.populateScalePresets();
            this.bindEvents();
            this.initMIDI();
            this.initAutoFills();
            this.initFillsObserver();
            console.log("Song Composer: Master module initialized.");
        },

        cacheDOM() {
            this.elements = {
                root: document.getElementById('master-root'),
                scale: document.getElementById('master-scale'),
                btnRndScale: document.getElementById('btn-rnd-scale'),
                scalePreset: document.getElementById('master-scale-preset'),
                tempo: document.getElementById('master-tempo'),
                vol: document.getElementById('master-vol'),
                humanize: document.getElementById('master-humanize'),
                
                autoFillsToggle: document.getElementById('auto-fills-toggle'),
                manualFillsUi: document.getElementById('manual-fills-ui'),
                fillsPanel: document.getElementById('fills-section-panel'),
                manualFillSelect: document.getElementById('manual-fill-select'),
                btnAddFillTimeline: document.getElementById('btn-add-fill-timeline'),
                timelineTracks: document.getElementById('timeline-tracks'),
                fillsContainer: document.getElementById('fills-container'),
                
                midiInSelect: document.getElementById('midi-in-select'), 
                midiOutSelect: document.getElementById('midi-out-select'), 
                btnMelodyToChords: document.getElementById('btn-melody-to-chords'), 
                btnExportJson: document.getElementById('btn-export-json'),
                btnImportJson: document.getElementById('btn-import-json'),
                jsonLoader: document.getElementById('local-json-loader'),
                btnExportMidi: document.getElementById('btn-export-midi'),
                btnExportWav: document.getElementById('btn-export-wav'),
                btnInfo: document.getElementById('btn-info'),
                infoModal: document.getElementById('info-modal'),
                closeInfo: document.getElementById('close-info-top')
            };
        },

        populateScalePresets() {
            if (!this.elements.scalePreset || typeof scalesList === 'undefined') return;
            scalesList.forEach((scale, index) => {
                const opt = document.createElement('option');
                opt.value = index;
                opt.text = scale.name;
                this.elements.scalePreset.appendChild(opt);
            });
        },

        bindEvents() {
            this.elements.vol.addEventListener('input', (e) => {
                if (window.SongComposer.Audio) window.SongComposer.Audio.setMasterVolume(e.target.value);
            });
            
            if (this.elements.btnRndScale) {
                this.elements.btnRndScale.addEventListener('click', () => {
                    let steps = [];
                    let sum = 0;
                    while (sum < 12) {
                        let step = Math.floor(Math.random() * 3) + 1; 
                        if (sum + step > 12) step = 12 - sum;
                        steps.push(step);
                        sum += step;
                    }
                    this.elements.scale.value = steps.join('');
                    if (window.SongComposer.Main) window.SongComposer.Main.updateScaleSumDisplay();
                    this.elements.scalePreset.value = ""; 
                });
            }

            if (this.elements.scalePreset) {
                this.elements.scalePreset.addEventListener('change', (e) => {
                    if (e.target.value === "") return;
                    const scale = scalesList[e.target.value];
                    if (scale) {
                        this.elements.scale.value = scale.steps.join('');
                        if (window.SongComposer.Main) window.SongComposer.Main.updateScaleSumDisplay();
                    }
                });
            }

            document.body.addEventListener('input', (e) => {
                if (e.target.matches('.chord-vol, .bass-vol, .lead-vol, .drum-vol')) {
                    if (window.SongComposer.Audio && window.SongComposer.Audio.setTrackVolume) {
                        const sectionElement = e.target.closest('.song-section');
                        if (!sectionElement) return;
                        
                        const section = sectionElement.dataset.section;
                        let type = '';
                        if(e.target.classList.contains('chord-vol')) type = 'chord';
                        if(e.target.classList.contains('bass-vol')) type = 'bass';
                        if(e.target.classList.contains('lead-vol')) type = 'lead';
                        if(e.target.classList.contains('drum-vol')) type = 'drum';
                        
                        window.SongComposer.Audio.setTrackVolume(section, type, e.target.value);
                    }
                }
            });

            if (this.elements.midiInSelect) this.elements.midiInSelect.addEventListener('change', (e) => this.selectMidiInput(e.target.value));
            if (this.elements.midiOutSelect) this.elements.midiOutSelect.addEventListener('change', (e) => this.selectMidiOutput(e.target.value));

            if (this.elements.btnMelodyToChords) {
                this.elements.btnMelodyToChords.addEventListener('click', () => {
                    if (window.SongComposer.Melody) window.SongComposer.Melody.openModal();
                });
            }

            this.elements.btnInfo.addEventListener('click', () => {
                this.elements.infoModal.classList.remove('hidden');
                if (window.SongComposer.Info) window.SongComposer.Info.renderText();
            });
            if (this.elements.closeInfo) {
                this.elements.closeInfo.addEventListener('click', () => this.elements.infoModal.classList.add('hidden'));
            }

            this.elements.btnExportJson.addEventListener('click', () => this.exportJSON());
            this.elements.btnImportJson.addEventListener('click', () => this.elements.jsonLoader.click());
            this.elements.jsonLoader.addEventListener('change', (e) => this.importJSON(e.target.files[0]));
            
            this.elements.btnExportMidi.addEventListener('click', () => this.exportMIDI());
            this.elements.btnExportWav.addEventListener('click', () => {
                if (window.SongComposer.Audio) window.SongComposer.Audio.renderOffline();
            });

            if (this.elements.autoFillsToggle) {
                this.elements.autoFillsToggle.addEventListener('change', () => this.updateAutoFillsState());
            }

            if (this.elements.btnAddFillTimeline) {
                this.elements.btnAddFillTimeline.addEventListener('click', () => this.addFillToTimeline());
            }

            document.body.addEventListener('click', (e) => {
                if (e.target.classList.contains('btn-delete-lead')) {
                    const card = e.target.closest('.lead-card');
                    const container = card.closest('.collapsible-content');
                    if (container.querySelectorAll('.lead-card').length > 1) {
                        card.remove();
                    } else {
                        alert("You cannot delete the last lead in a section.");
                    }
                    return;
                }
                if (e.target.classList.contains('btn-delete-fill-card')) {
                    const card = e.target.closest('.fill-card');
                    if (card) card.remove(); 
                    if(window.SongComposer.Main) window.SongComposer.Main.recalculateTimelineWidths();
                    return;
                }
                if (e.target.classList.contains('btn-remove-timeline-fill')) {
                    e.stopPropagation();
                    e.target.closest('.timeline-fill-block').remove();
                    if(window.SongComposer.Main) window.SongComposer.Main.recalculateTimelineWidths();
                    return;
                }
                if (e.target.closest('.timeline-fill-block')) {
                    e.stopPropagation();
                    return;
                }
                const header = e.target.closest('.collapsible-header');
                if (header) {
                    const ignoreTags = ['BUTTON', 'INPUT', 'SELECT', 'OPTION', 'COLOR'];
                    if (ignoreTags.includes(e.target.tagName)) return;
                    header.classList.toggle('collapsed');
                }
            }, true);
        },

        initAutoFills() { this.updateAutoFillsState(); },
        updateAutoFillsState() {
            const isAuto = this.elements.autoFillsToggle.checked;
            if (isAuto) {
                document.body.classList.add('auto-fills-active');
            } else { 
                document.body.classList.remove('auto-fills-active'); 
                this.updateManualFillsDropdown(); 
            }
            if (window.SongComposer.Main && typeof window.SongComposer.Main.updateTimelineFromInput === 'function') {
                window.SongComposer.Main.updateTimelineFromInput();
            }
        },

        initFillsObserver() {
            if (this.elements.fillsContainer) {
                const observer = new MutationObserver(() => {
                    if (!this.elements.autoFillsToggle.checked) this.updateManualFillsDropdown();
                });
                observer.observe(this.elements.fillsContainer, { childList: true, subtree: true });
            }
        },

        updateManualFillsDropdown() {
            if (!this.elements.manualFillSelect) return;
            this.elements.manualFillSelect.innerHTML = '';
            const fillCards = document.querySelectorAll('.fill-card');
            fillCards.forEach(card => {
                const id = card.dataset.fillId;
                const opt = document.createElement('option');
                opt.value = id;
                opt.textContent = `Fill ${id}`;
                this.elements.manualFillSelect.appendChild(opt);
            });
        },

        addFillToTimeline() {
            const fillId = this.elements.manualFillSelect.value;
            if (!fillId || !this.elements.timelineTracks) return;

            const emptyMarkers = Array.from(this.elements.timelineTracks.querySelectorAll('.timeline-fill-marker:not(.filled)'));
            if (emptyMarkers.length === 0) {
                alert("No empty gaps available on the timeline to add a fill. Add more sections first.");
                return;
            }
            
            const dropzone = emptyMarkers[0]; 
            dropzone.classList.add('filled');
            dropzone.title = `Fill ${fillId}`;
            dropzone.innerHTML = `
                <span class="fill-label">F${fillId}</span>
                <button class="btn-remove-fill" title="Remove Fill">×</button>
            `;
            
            if (window.SongComposer.Main) window.SongComposer.Main.recalculateTimelineWidths();
        },

        initMIDI() {
            if (navigator.requestMIDIAccess) {
                navigator.requestMIDIAccess().then(
                    (midiAccess) => {
                        this.midiAccess = midiAccess;
                        this.updateMidiDropdown();
                        this.midiAccess.onstatechange = () => this.updateMidiDropdown();
                    },
                    (err) => console.warn("MIDI Access failed or denied.", err)
                );
            }
        },
        
        updateMidiDropdown() {
            if (!this.midiAccess) return;
            if (this.elements.midiInSelect) {
                const inputs = this.midiAccess.inputs.values();
                this.elements.midiInSelect.innerHTML = '<option value="">-- Select MIDI Input --</option>';
                for (let input of inputs) {
                    const option = document.createElement('option');
                    option.value = input.id;
                    option.text = input.name;
                    this.elements.midiInSelect.appendChild(option);
                }
            }
            if (this.elements.midiOutSelect) {
                const outputs = this.midiAccess.outputs.values();
                this.elements.midiOutSelect.innerHTML = '<option value="">-- Select MIDI Output --</option>';
                for (let output of outputs) {
                    const option = document.createElement('option');
                    option.value = output.id;
                    option.text = output.name;
                    this.elements.midiOutSelect.appendChild(option);
                }
            }
        },

        selectMidiInput(inputId) {
            if (this.activeMidiInput) this.activeMidiInput.onmidimessage = null;
            if (!inputId || !this.midiAccess) return;
            this.activeMidiInput = this.midiAccess.inputs.get(inputId);
            if (this.activeMidiInput) {
                this.activeMidiInput.onmidimessage = (message) => this.handleMidiMessage(message);
            }
        },
        
        selectMidiOutput(outputId) {
            if (!outputId || !this.midiAccess) {
                this.activeMidiOutput = null;
                return;
            }
            this.activeMidiOutput = this.midiAccess.outputs.get(outputId);
        },

        handleMidiMessage(message) {
            const [command, note, velocity] = message.data;
            if (command === 144 && velocity > 0) {
                if (window.SongComposer.Melody && window.SongComposer.Melody.isOpen) window.SongComposer.Melody.triggerNoteOn(note);
            } else if (command === 128 || (command === 144 && velocity === 0)) {
                if (window.SongComposer.Melody && window.SongComposer.Melody.isOpen) window.SongComposer.Melody.triggerNoteOff(note);
            }
        },

        getRootMidi() { return this.rootNotesMap[this.elements.root.value] || 48; },
        getScaleSteps() { return this.elements.scale.value || "2212221"; },
        getTempo() { return parseFloat(this.elements.tempo.value) || 100; },

        // --- Core Data Compiler ---
        compileSongEvents() {
            const sequence = window.SongComposer.Main.buildGlobalSequence();
            if(!sequence || sequence.length === 0) return { events: [], totalSteps: 0 };

            const rootMidi = this.getRootMidi();
            const scaleStr = this.getScaleSteps();
            let events = [];
            let globalStepOffset = 0;
            let currentPitchOffset = 0; // Accommodates MOD logic

            sequence.forEach(seqItem => {
                // If it's a MOD block, adjust pitch globally going forward
                if (seqItem.type === 'mod') {
                    currentPitchOffset += seqItem.steps;
                    return;
                }

                let volDrum = 0.8;
                let drumBusParams = { threshold: -15, ratio: 4 };

                if (seqItem.type === 'section') {
                    const secEl = document.querySelector(`.song-section[data-section="${seqItem.section}"]`);
                    if (secEl) {
                        volDrum = parseFloat(secEl.querySelector('.drum-vol').value);
                        if (isNaN(volDrum)) volDrum = 0.8;
                        drumBusParams = window.SongComposer.Drums.getBusCompression(secEl);
                    }
                }

                // Prepare Fill Data for this block safely
                let fillsData = [];
                if (seqItem.autoFill) {
                    const autoFillSteps = Math.floor(Math.random() * 4) + 1;
                    fillsData.push({
                        isVirtual: true,
                        replaceSteps: autoFillSteps,
                        kick: window.SongComposer.Fills.generateFillKick(),
                        snare: window.SongComposer.Fills.generateFillSnare(),
                        tom1: window.SongComposer.Fills.generateFillTom1(),
                        tom2: window.SongComposer.Fills.generateFillTom2(),
                        clap: window.SongComposer.Fills.generateFillClap(),
                        crashOnNext: false,
                        vol: volDrum
                    });
                } else {
                    // Safe iteration: default to empty array if fills is undefined
                    (seqItem.fills || []).forEach(fId => {
                        const fd = window.SongComposer.Fills.getFillData(fId);
                        if (fd) fillsData.push(fd);
                    });
                }

                const totalFillSteps = fillsData.reduce((sum, f) => sum + f.replaceSteps, 0);

                // --- Handle Standalone Fills (No Melodic Data attached) ---
                if (seqItem.type === 'standalone_fill') {
                    fillsData.forEach(fd => {
                        let fillVol = parseFloat(fd.vol);
                        if (isNaN(fillVol)) fillVol = volDrum;
                        this.extractFillDrums(fd, events, globalStepOffset, fillVol, drumBusParams, null);
                        globalStepOffset += fd.replaceSteps;
                    });
                    return; // Skip section logic
                }

                // --- Handle Full Sections ---
                const secEl = document.querySelector(`.song-section[data-section="${seqItem.section}"]`);
                if (!secEl) return;

                let volChords = parseFloat(secEl.querySelector('.chord-vol').value);
                if (isNaN(volChords)) volChords = 0.8;
                let volBass = parseFloat(secEl.querySelector('.bass-vol').value);
                if (isNaN(volBass)) volBass = 0.8;

                // 1. Parse Chords & Arp
                const progStr = secEl.querySelector('.chord-prog').value;
                const duckingChords = secEl.querySelector('.chord-ducking') ? secEl.querySelector('.chord-ducking').checked : false;
                const arpToggle = secEl.querySelector('.chord-arp-toggle') ? secEl.querySelector('.chord-arp-toggle').checked : false;
                const arpPattern = secEl.querySelector('.chord-arp-pattern') ? secEl.querySelector('.chord-arp-pattern').value : '';
                const bufferChords = secEl.querySelector('.chord-sound').value;
                const adsrChords = window.SongComposer.Chords.getADSRData(secEl);
                const parsedChords = window.SongComposer.Chords.parseProgression(progStr, rootMidi, scaleStr);
                
                let totalSectionSteps = 0;
                parsedChords.forEach(c => totalSectionSteps += c.length);
                
                const standardLen = Math.max(0, totalSectionSteps - totalFillSteps);
                
                if (arpToggle && window.SongComposer.Chords.tokenizePattern) {
                    let arpTokens = window.SongComposer.Chords.tokenizePattern(arpPattern);
                    let sectionSteps = [];
                    for(let step=0; step < totalSectionSteps; step++) {
                        let activeChord = null;
                        let accum = 0;
                        for(let c of parsedChords) {
                            accum += c.length;
                            if(step < accum) { activeChord = c; break; }
                        }
                        if(!activeChord) activeChord = parsedChords[parsedChords.length-1];

                        const token = arpTokens[step % arpTokens.length];
                        let note = null; let action = 'play';
                        
                        if (token === '0') action = 'rest';
                        else if (token === '-') action = 'hold';
                        else {
                            const digitMatch = token.match(/[0-9]/);
                            if(digitMatch) {
                                const degree = parseInt(digitMatch[0], 10);
                                if(degree > 0) {
                                    const zeroBasedIdx = degree - 1;
                                    const chordLen = activeChord.notes.length;
                                    const baseNote = activeChord.notes[zeroBasedIdx % chordLen];
                                    const octavesUp = Math.floor(zeroBasedIdx / chordLen);
                                    note = baseNote + (octavesUp * 12);
                                    if(token.includes('i')) note -= 12;
                                } else action = 'rest';
                            } else action = 'rest';
                        }
                        sectionSteps.push({ stepIndex: step, action, note });
                    }
                    this.extractMelodicEvents(sectionSteps, events, globalStepOffset, 'chord', bufferChords, duckingChords, adsrChords, volChords, null, seqItem.section, currentPitchOffset);
                } else {
                    let chordStepOffset = 0;
                    parsedChords.forEach(chord => {
                        chord.notes.forEach(note => {
                            events.push({
                                type: 'melodic', instrument: 'chord', bufferName: bufferChords,
                                midiNote: note + currentPitchOffset, timeStep: globalStepOffset + chordStepOffset,
                                durationSteps: chord.length, ducking: duckingChords, adsr: adsrChords, volume: volChords, section: seqItem.section
                            });
                        });
                        chordStepOffset += chord.length;
                    });
                }

                // 2. Parse Bass
                const bassStr = secEl.querySelector('.bass-rhythm').value;
                const bufferBass = secEl.querySelector('.bass-sound').value;
                const duckingBass = window.SongComposer.Bass.getDuckingFlag(secEl);
                const parsedBass = window.SongComposer.Bass.parseSection(bassStr, parsedChords);
                this.extractMelodicEvents(parsedBass, events, globalStepOffset, 'bass', bufferBass, duckingBass, null, volBass, null, seqItem.section, currentPitchOffset);

                // 3. Parse Leads
                const leads = secEl.querySelectorAll('.lead-card');
                leads.forEach(leadCard => {
                    const leadStr = leadCard.querySelector('.lead-rhythm').value;
                    const bufferLead = leadCard.querySelector('.lead-sound').value;
                    let volLead = parseFloat(leadCard.querySelector('.lead-vol').value);
                    if (isNaN(volLead)) volLead = 0.8;
                    const duckingLead = leadCard.querySelector('.lead-ducking').checked;
                    const adsrLead = window.SongComposer.Lead.getADSRData(leadCard);
                    
                    const flanger = parseFloat(leadCard.querySelector('.lead-flanger').value) || 0;
                    const delay = parseFloat(leadCard.querySelector('.lead-delay').value) || 0;
                    const reverb = parseFloat(leadCard.querySelector('.lead-reverb').value) || 0;
                    const leadFx = { flanger, delay, reverb };

                    const parsedLead = window.SongComposer.Lead.parseSection(leadStr, parsedChords);
                    this.extractMelodicEvents(parsedLead, events, globalStepOffset, 'lead', bufferLead, duckingLead, adsrLead, volLead, leadFx, seqItem.section, currentPitchOffset);
                });

                // 4. Extract Standard Drums
                if (standardLen > 0) {
                    const baseDrums = window.SongComposer.Drums.parseSection(secEl, standardLen, seqItem.autoCrash);
                    this.extractDrumEvents(baseDrums, events, globalStepOffset, volDrum, drumBusParams, seqItem.section);
                }

                // 5. Extract Chronological Fills at the end
                let currentFillOffset = globalStepOffset + standardLen;
                fillsData.forEach(fd => {
                    let fillVol = parseFloat(fd.vol);
            
