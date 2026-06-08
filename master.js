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
                    if (isNaN(fillVol)) fillVol = volDrum;
                    this.extractFillDrums(fd, events, currentFillOffset, fillVol, drumBusParams, seqItem.section);
                    currentFillOffset += fd.replaceSteps;
                });

                globalStepOffset += totalSectionSteps;
            });

            return { events, totalSteps: globalStepOffset };
        },

        extractMelodicEvents(sectionSteps, events, globalStepOffset, instrument, bufferName, ducking, adsr, volume, fx, section, currentPitchOffset) {
            sectionSteps.forEach(step => {
                if (step.action === 'play' || step.action === 'bend') {
                    events.push({
                        type: 'melodic',
                        instrument: instrument,
                        bufferName: bufferName,
                        midiNote: step.note !== null ? step.note + currentPitchOffset : null,
                        timeStep: globalStepOffset + step.stepIndex,
                        durationSteps: 1, 
                        ducking: ducking,
                        adsr: adsr,
                        volume: volume,
                        fx: fx,
                        section: section,
                        isBend: step.action === 'bend'
                    });
                } else if (step.action === 'hold' && events.length > 0) {
                    let lastEvent = null;
                    for (let i = events.length - 1; i >= 0; i--) {
                        if (events[i].instrument === instrument && events[i].section === section) {
                            lastEvent = events[i];
                            break;
                        }
                    }
                    if (lastEvent) {
                        lastEvent.durationSteps++;
                    }
                }
            });
        },

        extractDrumEvents(drumsData, events, globalStepOffset, volume, drumBusParams, section) {
            const instruments = ['kick', 'snare', 'hihat', 'tom1', 'tom2', 'clap'];
            instruments.forEach(inst => {
                if (drumsData[inst]) {
                    drumsData[inst].forEach(step => {
                        if (step.play) {
                            events.push({
                                type: 'drum',
                                instrument: inst,
                                bufferName: `${inst}.wav`,
                                timeStep: globalStepOffset + step.stepIndex,
                                durationSteps: 1,
                                volume: volume,
                                section: section,
                                compression: drumBusParams
                            });
                        }
                    });
                }
            });
            if (drumsData.crashFlag) {
                events.push({
                    type: 'drum',
                    instrument: 'crash',
                    bufferName: 'crash.wav',
                    timeStep: globalStepOffset,
                    durationSteps: 4,
                    volume: volume,
                    section: section,
                    compression: drumBusParams
                });
            }
        },

        extractFillDrums(fd, events, globalStepOffset, fillVol, drumBusParams, section) {
            const length = fd.replaceSteps;
            const instruments = ['kick', 'snare', 'tom1', 'tom2', 'clap'];
            instruments.forEach(inst => {
                const pattern = fd[inst] || '0';
                for (let i = 0; i < length; i++) {
                    const char = pattern[i % pattern.length];
                    if (char === '1') {
                        events.push({
                            type: 'drum',
                            instrument: inst,
                            bufferName: `${inst}.wav`,
                            timeStep: globalStepOffset + i,
                            durationSteps: 1,
                            volume: fillVol,
                            section: section,
                            compression: drumBusParams
                        });
                    }
                }
            });
            if (fd.crashOnNext) {
                events.push({
                    type: 'drum',
                    instrument: 'crash',
                    bufferName: 'crash.wav',
                    timeStep: globalStepOffset + length,
                    durationSteps: 4,
                    volume: fillVol,
                    section: section,
                    compression: drumBusParams
                });
            }
        },

        exportJSON() {
            const data = {
                structure: document.getElementById('song-structure-input')?.value || '',
                tempo: this.getTempo(),
                root: this.elements.root.value,
                scale: this.elements.scale.value,
                vol: this.elements.vol.value,
                humanize: this.elements.humanize.value,
                autoFills: this.elements.autoFillsToggle.checked,
                sections: {}
            };

            document.querySelectorAll('.song-section').forEach(sec => {
                const letter = sec.dataset.section;
                const leadsData = [];
                sec.querySelectorAll('.lead-card').forEach(leadCard => {
                    leadsData.push({
                        rhythm: leadCard.querySelector('.lead-rhythm')?.value || '',
                        sound: leadCard.querySelector('.lead-sound')?.value || '',
                        vol: leadCard.querySelector('.lead-vol')?.value || '0.75',
                        ducking: leadCard.querySelector('.lead-ducking')?.checked || false,
                        flanger: leadCard.querySelector('.lead-flanger')?.value || '0',
                        delay: leadCard.querySelector('.lead-delay')?.value || '0.2',
                        reverb: leadCard.querySelector('.lead-reverb')?.value || '0.8',
                        adsr: window.SongComposer.Lead.getADSRData(leadCard)
                    });
                });

                data.sections[letter] = {
                    name: sec.querySelector('.section-name-input')?.value || '',
                    color: sec.querySelector('.section-color-picker')?.value || '#4CAF50',
                    chordProg: sec.querySelector('.chord-prog')?.value || '',
                    chordSound: sec.querySelector('.chord-sound')?.value || '',
                    chordVol: sec.querySelector('.chord-vol')?.value || '0.65',
                    chordDucking: sec.querySelector('.chord-ducking')?.checked || false,
                    chordArpToggle: sec.querySelector('.chord-arp-toggle')?.checked || false,
                    chordArpPattern: sec.querySelector('.chord-arp-pattern')?.value || '',
                    chordADSR: window.SongComposer.Chords.getADSRData(sec),
                    bassRhythm: sec.querySelector('.bass-rhythm')?.value || '',
                    bassSound: sec.querySelector('.bass-sound')?.value || '',
                    bassVol: sec.querySelector('.bass-vol')?.value || '0.85',
                    bassDucking: sec.querySelector('.bass-ducking')?.checked || false,
                    drumKick: sec.querySelector('.drum-kick')?.value || '',
                    drumSnare: sec.querySelector('.drum-snare')?.value || '',
                    drumHihat: sec.querySelector('.drum-hihat')?.value || '',
                    drumKickVol: sec.querySelector('.drum-kick-vol')?.value || '0.90',
                    drumSnareVol: sec.querySelector('.drum-snare-vol')?.value || '0.85',
                    drumHihatVol: sec.querySelector('.drum-hihat-vol')?.value || '0.75',
                    drumCompThresh: sec.querySelector('.drum-comp-thresh')?.value || '-35',
                    drumCompRatio: sec.querySelector('.drum-comp-ratio')?.value || '4',
                    drumVol: sec.querySelector('.drum-vol')?.value || '0.80',
                    leads: leadsData
                };
            });

            data.fills = [];
            document.querySelectorAll('.fill-card').forEach(card => {
                data.fills.push({
                    id: card.dataset.fillId,
                    replaceSteps: card.querySelector('.fill-steps')?.value || '4',
                    kick: card.querySelector('.fill-kick')?.value || '1010',
                    snare: card.querySelector('.fill-snare')?.value || '1111',
                    tom1: card.querySelector('.fill-tom1')?.value || '1100',
                    tom2: card.querySelector('.fill-tom2')?.value || '0011',
                    clap: card.querySelector('.fill-clap')?.value || '0000',
                    crash: card.querySelector('.fill-crash')?.checked || false,
                    vol: card.querySelector('.fill-vol')?.value || '0.80'
                });
            });

            data.mods = [];
            document.querySelectorAll('.timeline-mod-block').forEach(mod => {
                data.mods.push({
                    steps: parseInt(mod.dataset.modSteps, 10)
                });
            });

            const blob = new Blob([JSON.stringify(data, null, 4)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'song_project.json';
            a.click();
            URL.revokeObjectURL(url);
        },

        importJSON(file) {
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    
                    if (data.structure !== undefined) document.getElementById('song-structure-input').value = data.structure;
                    if (data.tempo !== undefined) this.elements.tempo.value = data.tempo;
                    if (data.root !== undefined) this.elements.root.value = data.root;
                    if (data.scale !== undefined) {
                        this.elements.scale.value = data.scale;
                        if (window.SongComposer.Main) window.SongComposer.Main.updateScaleSumDisplay();
                    }
                    if (data.vol !== undefined) {
                        this.elements.vol.value = data.vol;
                        if (window.SongComposer.Audio) window.SongComposer.Audio.setMasterVolume(data.vol);
                    }
                    if (data.humanize !== undefined) this.elements.humanize.value = data.humanize;
                    if (data.autoFills !== undefined) this.elements.autoFillsToggle.checked = data.autoFills;

                    if (data.fills) {
                        this.elements.fillsContainer.querySelectorAll('.fill-card').forEach(c => c.remove());
                        data.fills.forEach(fill => {
                            const container = this.elements.fillsContainer;
                            const card = document.createElement('div');
                            card.className = 'fill-card';
                            card.draggable = true;
                            card.dataset.fillId = fill.id;
                            card.innerHTML = `
                                <div class="fill-header">
                                    <span class="drag-handle">☰</span> Fill ${fill.id}
                                    <button class="btn-delete-fill-card" title="Remove Fill">✕</button>
                                </div>
                                <div class="fill-controls">
                                    <label>Replace Steps: <input type="number" class="fill-steps" value="${fill.replaceSteps}" min="1"></label>
                                    <label>Kick: <input type="text" class="fill-kick" value="${fill.kick}"> <button class="btn-rnd">RND</button></label>
                                    <label>Snare: <input type="text" class="fill-snare" value="${fill.snare}"> <button class="btn-rnd">RND</button></label>
                                    <label>Tom 1: <input type="text" class="fill-tom1" value="${fill.tom1}"> <button class="btn-rnd">RND</button></label>
                                    <label>Tom 2: <input type="text" class="fill-tom2" value="${fill.tom2}"> <button class="btn-rnd">RND</button></label>
                                    <label>Clap: <input type="text" class="fill-clap" value="${fill.clap}"> <button class="btn-rnd">RND</button></label>
                                    <label class="checkbox-label"><input type="checkbox" class="fill-crash" ${fill.crash ? 'checked' : ''}> Crash on Next</label>
                                    <label>Vol: <input type="range" class="fill-vol" min="0" max="1" step="0.01" value="${fill.vol}"></label>
                                </div>
                            `;
                            container.insertBefore(card, document.getElementById('btn-add-fill'));
                        });
                    }

                    if (data.sections) {
                        Object.keys(data.sections).forEach(letter => {
                            let sec = document.querySelector(`.song-section[data-section="${letter}"]`);
                            if (!sec && window.SongComposer.Main) {
                                sec = window.SongComposer.Main.createNewSectionEditor(letter);
                            }
                            if (sec) {
                                const secData = data.sections[letter];
                                if (secData.name) sec.querySelector('.section-name-input').value = secData.name;
                                if (secData.color) {
                                    sec.querySelector('.section-color-picker').value = secData.color;
                                    sec.style.setProperty('--section-color', secData.color);
                                }
                                if (secData.chordProg) sec.querySelector('.chord-prog').value = secData.chordProg;
                                if (secData.chordSound) sec.querySelector('.chord-sound').value = secData.chordSound;
                                if (secData.chordVol) sec.querySelector('.chord-vol').value = secData.chordVol;
                                if (secData.chordDucking !== undefined) sec.querySelector('.chord-ducking').checked = secData.chordDucking;
                                if (secData.chordArpToggle !== undefined) sec.querySelector('.chord-arp-toggle').checked = secData.chordArpToggle;
                                if (secData.chordArpPattern) sec.querySelector('.chord-arp-pattern').value = secData.chordArpPattern;
                                
                                if (secData.chordADSR) {
                                    window.SongComposer.Chords.setADSRData(sec, secData.chordADSR);
                                }

                                if (secData.bassRhythm) sec.querySelector('.bass-rhythm').value = secData.bassRhythm;
                                if (secData.bassSound) sec.querySelector('.bass-sound').value = secData.bassSound;
                                { sec.querySelector('.bass-vol').value = secData.bassVol; }
                                if (secData.bassDucking !== undefined) sec.querySelector('.bass-ducking').checked = secData.bassDucking;

                                if (secData.drumKick) sec.querySelector('.drum-kick').value = secData.drumKick;
                                if (secData.drumSnare) sec.querySelector('.drum-snare').value = secData.drumSnare;
                                if (secData.drumHihat) sec.querySelector('.drum-hihat').value = secData.drumHihat;
                                if (secData.drumKickVol) sec.querySelector('.drum-kick-vol').value = secData.drumKickVol;
                                if (secData.drumSnareVol) sec.querySelector('.drum-snare-vol').value = secData.drumSnareVol;
                                if (secData.drumHihatVol) sec.querySelector('.drum-hihat-vol').value = secData.drumHihatVol;
                                if (secData.drumCompThresh) sec.querySelector('.drum-comp-thresh').value = secData.drumCompThresh;
                                if (secData.drumCompRatio) sec.querySelector('.drum-comp-ratio').value = secData.drumCompRatio;
                                if (secData.drumVol) sec.querySelector('.drum-vol').value = secData.drumVol;

                                if (secData.leads) {
                                    const leadContainer = sec.querySelector('.leads-container .collapsible-content');
                                    leadContainer.innerHTML = '';
                                    secData.leads.forEach(lead => {
                                        const card = document.createElement('div');
                                        card.className = 'lead-card';
                                        card.innerHTML = `
                                            <button class="btn-delete-lead" title="Remove Lead">✕</button>
                                            <div class="controls-row">
                                                <label>Rhythm: <input type="text" class="lead-rhythm" value="${lead.rhythm}"></label>
                                                <button class="btn-rnd" title="Randomize Pattern">RND</button>
                                                <button class="btn-rnd btn-transpose-down" title="Transpose Down">-1</button>
                                                <button class="btn-rnd btn-transpose-up" title="Transpose Up">+1</button>
                                                <label>Sound: 
                                                    <select class="lead-sound">
                                                        <option value="lead1.wav" ${lead.sound === 'lead1.wav' ? 'selected' : ''}>Lead 1</option>
                                                        <option value="lead2.wav" ${lead.sound === 'lead2.wav' ? 'selected' : ''}>Lead 2</option>
                                                        <option value="lead3.wav" ${lead.sound === 'lead3.wav' ? 'selected' : ''}>Lead 3</option>
                                                        <option value="lead4.wav" ${lead.sound === 'lead4.wav' ? 'selected' : ''}>Lead 4</option>
                                                    </select>
                                                </label>
                                                <label>Vol: <input type="range" class="lead-vol" min="0" max="1" step="0.01" value="${lead.vol}"></label>
                                                <label class="checkbox-label"><input type="checkbox" class="lead-ducking" ${lead.ducking ? 'checked' : ''}> Ducking</label>
                                            </div>
                                            <div class="controls-row fx-row">
                                                <label>Flanger: <input type="range" class="lead-flanger" min="0" max="1" step="0.01" value="${lead.flanger}"></label>
                                                <label>Delay: <input type="range" class="lead-delay" min="0" max="1" step="0.01" value="${lead.delay}"></label>
                                                <label>Reverb: <input type="range" class="lead-reverb" min="0" max="1" step="0.01" value="${lead.reverb}"></label>
                                            </div>
                                            <div class="adsr-container">
                                                <label>ADSR</label>
                                                <canvas class="adsr-canvas" width="200" height="60"></canvas>
                                            </div>
                                        `;
                                        leadContainer.appendChild(card);
                                        if (window.SongComposer.Lead) {
                                            window.SongComposer.Lead.initADSRCanvas(card.querySelector('.adsr-canvas'));
                                            window.SongComposer.Lead.setADSRData(card, lead.adsr);
                                        }
                                    });
                                }
                            }
                        });
                    }

                    if (data.mods && window.SongComposer.Modulation) {
                        document.querySelectorAll('.timeline-mod-block').forEach(m => {
                            if (m.previousElementSibling && m.previousElementSibling.classList.contains('timeline-fill-marker')) {
                                m.previousElementSibling.remove();
                            }
                            m.remove();
                        });
                        data.mods.forEach(mod => {
                            window.SongComposer.Modulation.restoreModBlock(mod.steps);
                        });
                    }

                    this.updateAutoFillsState();
                    if (window.SongComposer.Main) {
                        window.SongComposer.Main.updateTimelineFromInput();
                        window.SongComposer.Main.recalculateTimelineWidths();
                    }
                    alert("Project successfully imported!");
                } catch (err) {
                    console.error("JSON Import failed:", err);
                    alert("Failed to parse JSON project file.");
                }
            };
            reader.readAsText(file);
        },

        exportMIDI() {
            const data = this.compileSongEvents();
            if (!data.events || data.events.length === 0) {
                alert("Nothing to export!");
                return;
            }

            const tempo = this.getTempo();

            const writeString = (str) => {
                const bytes = [];
                for (let i = 0; i < str.length; i++) bytes.push(str.charCodeAt(i));
                return bytes;
            };

            const writeVarInt = (val) => {
                let buffer = val & 0x7F;
                while ((val >>>= 7) > 0) {
                    buffer <<= 8;
                    buffer |= 0x80;
                    buffer |= (val & 0x7F);
                }
                const bytes = [];
                while (true) {
                    bytes.push(buffer & 0xFF);
                    if (buffer & 0x80) buffer >>>= 8;
                    else break;
                }
                return bytes;
            };

            const write32 = (val) => {
                return [
                    (val >>> 24) & 0xFF,
                    (val >>> 16) & 0xFF,
                    (val >>> 8) & 0xFF,
                    val & 0xFF
                ];
            };

            const write16 = (val) => {
                return [
                    (val >>> 8) & 0xFF,
                    val & 0xFF
                ];
            };

            const tempoMicroseconds = Math.round(60000000 / tempo);
            
            const mThd = [
                ...writeString('MThd'),
                ...write32(6), 
                ...write16(1), 
                ...write16(2), 
                ...write16(96) 
            ];

            const stepToTicks = 24; 

            const t1Events = [
                0x00, 0xFF, 0x58, 0x04, 0x04, 0x02, 0x18, 0x08, 
                0x00, 0xFF, 0x51, 0x03, 
                (tempoMicroseconds >>> 16) & 0xFF,
                (tempoMicroseconds >>> 8) & 0xFF,
                tempoMicroseconds & 0xFF, 
                0x00, 0xFF, 0x2F, 0x00 
            ];
            const mTrk1 = [
                ...writeString('MTrk'),
                ...write32(t1Events.length),
                ...t1Events
            ];

            const midiEvents = [];
            
            const addMidiEvent = (tick, status, data1, data2) => {
                midiEvents.push({ tick, bytes: [status, data1, data2] });
            };

            const chMap = { 'chord': 0, 'bass': 1, 'lead': 2, 'drum': 9 };

            data.events.forEach(ev => {
                const ch = chMap[ev.instrument] !== undefined ? chMap[ev.instrument] : (ev.type === 'drum' ? 9 : 0);
                const startTick = ev.timeStep * stepToTicks;
                const endTick = (ev.timeStep + ev.durationSteps) * stepToTicks;
                
                let pitch = ev.midiNote;
                if (ev.type === 'drum') {
                    const name = ev.bufferName.toLowerCase();
                    if (name.includes('kick')) pitch = 36;
                    else if (name.includes('snare')) pitch = 38;
                    else if (name.includes('hihat')) pitch = 42;
                    else if (name.includes('tom1')) pitch = 43;
                    else if (name.includes('tom2')) pitch = 45;
                    else if (name.includes('clap')) pitch = 39;
                    else if (name.includes('crash')) pitch = 49;
                    else pitch = 36; 
                }

                if (pitch) {
                    const vol = Math.max(1, Math.min(127, Math.floor((ev.volume || 0.8) * 127)));
                    addMidiEvent(startTick, 0x90 | ch, pitch, vol);
                    addMidiEvent(endTick, 0x80 | ch, pitch, 0);
                }
            });

            midiEvents.sort((a, b) => a.tick - b.tick);

            const t2Bytes = [];
            let lastTick = 0;
            midiEvents.forEach(e => {
                const delta = e.tick - lastTick;
                t2Bytes.push(...writeVarInt(delta));
                t2Bytes.push(...e.bytes);
                lastTick = e.tick;
            });
            
            t2Bytes.push(...writeVarInt(0));
            t2Bytes.push(0xFF, 0x2F, 0x00);

            const mTrk2 = [
                ...writeString('MTrk'),
                ...write32(t2Bytes.length),
                ...t2Bytes
            ];

            const midiData = new Uint8Array([
                ...mThd,
                ...mTrk1,
                ...mTrk2
            ]);

            const blob = new Blob([midiData], { type: 'audio/midi' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'song_midi_export.mid';
            a.click();
            URL.revokeObjectURL(url);
        }
    };

    window.SongComposer.Master = Master;

    document.addEventListener('DOMContentLoaded', () => {
        Master.init();
    });

})();
