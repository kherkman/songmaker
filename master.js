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
        getTempo() { return parseFloat(this.elements.tempo.value) || 120; },

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

            // Auto Fill Ending Logic
            const isAuto = this.elements.autoFillsToggle ? this.elements.autoFillsToggle.checked : false;
            if (isAuto && sequence.length > 0) {
                // Ignore mods for picking the last section
                let lastSeqItem = null;
                for (let i = sequence.length - 1; i >= 0; i--) {
                    if (sequence[i].type === 'section') { lastSeqItem = sequence[i]; break; }
                }
                
                if (lastSeqItem) {
                    const lastSecEl = document.querySelector(`.song-section[data-section="${lastSeqItem.section}"]`);
                    if (lastSecEl) {
                        const bufferChords = lastSecEl.querySelector('.chord-sound').value;
                        const bufferBass = lastSecEl.querySelector('.bass-sound').value;
                        
                        let volChordFinal = parseFloat(lastSecEl.querySelector('.chord-vol').value) || 0.8;
                        let volBassFinal = parseFloat(lastSecEl.querySelector('.bass-vol').value) || 0.8;
                        let volDrumFinal = parseFloat(lastSecEl.querySelector('.drum-vol').value) || 0.8;

                        const drumBusParams = window.SongComposer.Drums.getBusCompression(lastSecEl);
                        const adsrChords = window.SongComposer.Chords.getADSRData(lastSecEl);
                        const scaleArr = window.SongComposer.Chords.buildScale(rootMidi, scaleStr);
                        const tonicNotes = [scaleArr[0], scaleArr[2], scaleArr[4]]; 
                        const finalDuration = 16; 

                        events.push({
                            type: 'drum', instrument: 'crash', bufferName: 'crash.wav', midiNote: 49,
                            timeStep: globalStepOffset, durationSteps: finalDuration, drumBusParams, volume: volDrumFinal, section: lastSeqItem.section
                        });
                        events.push({
                            type: 'drum', instrument: 'kick', bufferName: 'kick.wav', midiNote: 36,
                            timeStep: globalStepOffset, durationSteps: finalDuration, drumBusParams, volume: volDrumFinal, section: lastSeqItem.section
                        });

                        tonicNotes.forEach(note => {
                            events.push({
                                type: 'melodic', instrument: 'chord', bufferName: bufferChords,
                                midiNote: note + currentPitchOffset, timeStep: globalStepOffset, durationSteps: finalDuration, ducking: false, 
                                adsr: { a: 0.01, d: adsrChords.d, s: adsrChords.s, r: adsrChords.r }, 
                                volume: volChordFinal, section: lastSeqItem.section
                            });
                        });
                        events.push({
                            type: 'melodic', instrument: 'bass', bufferName: bufferBass, midiNote: rootMidi + currentPitchOffset, timeStep: globalStepOffset,
                            durationSteps: finalDuration, ducking: false, adsr: null, volume: volBassFinal, section: lastSeqItem.section
                        });

                        globalStepOffset += finalDuration; 
                    }
                }
            }

            // Apply Humanize global variances
            const tempo = this.getTempo();
            const stepDurationSec = (60 / tempo) / 4;
            const humanizeAmt = this.elements.humanize ? (parseFloat(this.elements.humanize.value) || 0) : 0;
            
            if (humanizeAmt > 0) {
                events.forEach(ev => {
                    let timeShift = (Math.random() * 2 - 1) * 0.25 * humanizeAmt * stepDurationSec; 
                    ev.timeOffset = timeShift; 
                    let volShift = (Math.random() * 2 - 1) * 0.20 * humanizeAmt;
                    ev.volume = Math.max(0, Math.min(1, ev.volume + volShift));
                });
            }

            return { events, totalSteps: globalStepOffset };
        },

        extractMelodicEvents(parsedTrack, eventsArray, globalOffset, instName, bufName, duck, adsr, vol, fx = null, targetSection = null, pitchOffset = 0) {
            let activeNote = null;
            let noteStartStep = 0;
            
            for (let i = 0; i < parsedTrack.length; i++) {
                const stepData = parsedTrack[i];
                if (stepData.action === 'play') {
                    if (activeNote !== null) {
                        eventsArray.push({
                            type: 'melodic', instrument: instName, bufferName: bufName,
                            midiNote: activeNote + pitchOffset, timeStep: globalOffset + noteStartStep,
                            durationSteps: i - noteStartStep, ducking: duck, adsr: adsr, volume: vol, fx: fx, section: targetSection
                        });
                    }
                    activeNote = stepData.note;
                    noteStartStep = i;
                } else if (stepData.action === 'rest') {
                    if (activeNote !== null) {
                        eventsArray.push({
                            type: 'melodic', instrument: instName, bufferName: bufName,
                            midiNote: activeNote + pitchOffset, timeStep: globalOffset + noteStartStep,
                            durationSteps: i - noteStartStep, ducking: duck, adsr: adsr, volume: vol, fx: fx, section: targetSection
                        });
                        activeNote = null;
                    }
                }
            }
            if (activeNote !== null) {
                eventsArray.push({
                    type: 'melodic', instrument: instName, bufferName: bufName,
                    midiNote: activeNote + pitchOffset, timeStep: globalOffset + noteStartStep,
                    durationSteps: parsedTrack.length - noteStartStep, ducking: duck, adsr: adsr, volume: vol, fx: fx, section: targetSection
                });
            }
        },

        extractDrumEvents(drumData, eventsArray, globalOffset, vol, busParams, sectionTarget) {
            // Read individual drum levels from UI if section target matches
            let volKick = 0.90, volSnare = 0.85, volHihat = 0.75;
            if (sectionTarget) {
                const secEl = document.querySelector(`.song-section[data-section="${sectionTarget}"]`);
                if (secEl) {
                    const kEl = secEl.querySelector('.drum-kick-vol');
                    const sEl = secEl.querySelector('.drum-snare-vol');
                    const hEl = secEl.querySelector('.drum-hihat-vol');
                    if (kEl) volKick = parseFloat(kEl.value);
                    if (sEl) volSnare = parseFloat(sEl.value);
                    if (hEl) volHihat = parseFloat(hEl.value);
                }
            }

            const drumMap = [
                { key: 'kick', sound: 'kick.wav', midi: 36, pieceVol: volKick },
                { key: 'snare', sound: 'snare.wav', midi: 38, pieceVol: volSnare },
                { key: 'hihat', sound: 'hihat.wav', midi: 42, pieceVol: volHihat }
            ];
            
            drumMap.forEach(d => {
                if (drumData[d.key]) {
                    drumData[d.key].forEach(hit => {
                        if (hit.play) {
                            eventsArray.push({
                                type: 'drum', instrument: d.key, bufferName: d.sound, midiNote: d.midi,
                                timeStep: globalOffset + hit.stepIndex, durationSteps: 1, drumBusParams: busParams,
                                volume: vol * d.pieceVol, section: sectionTarget
                            });
                        }
                    });
                }
            });

            if (drumData.crashFlag) {
                eventsArray.push({
                    type: 'drum', instrument: 'crash', bufferName: 'crash.wav', midiNote: 49,
                    timeStep: globalOffset, durationSteps: 4, drumBusParams: busParams, volume: vol, section: sectionTarget
                });
            }
        },

        extractFillDrums(fillData, eventsArray, globalOffset, vol, busParams, sectionTarget) {
            const instruments = ['kick', 'snare', 'tom1', 'tom2', 'clap'];
            const midiMap = { kick: 36, snare: 38, tom1: 48, tom2: 45, clap: 39 };
            const soundMap = { kick: 'kick.wav', snare: 'snare.wav', tom1: 'tom1.wav', tom2: 'tom2.wav', clap: 'clap.wav' };
            
            // Read individual drum levels if section target matches
            let volKick = 0.90, volSnare = 0.85, volHihat = 0.75;
            if (sectionTarget) {
                const secEl = document.querySelector(`.song-section[data-section="${sectionTarget}"]`);
                if (secEl) {
                    const kEl = secEl.querySelector('.drum-kick-vol');
                    const sEl = secEl.querySelector('.drum-snare-vol');
                    const hEl = secEl.querySelector('.drum-hihat-vol');
                    if (kEl) volKick = parseFloat(kEl.value);
                    if (sEl) volSnare = parseFloat(sEl.value);
                    if (hEl) volHihat = parseFloat(hEl.value);
                }
            }

            for (let i = 0; i < fillData.replaceSteps; i++) {
                instruments.forEach(inst => {
                    const pattern = fillData[inst] || '0';
                    if (pattern[i % pattern.length] === '1') {
                        let finalVol = vol;
                        if (inst === 'kick') finalVol *= volKick;
                        else if (inst === 'snare') finalVol *= volSnare;

                        eventsArray.push({
                            type: 'drum', instrument: inst, bufferName: soundMap[inst], midiNote: midiMap[inst],
                            timeStep: globalOffset + i, durationSteps: 1, drumBusParams: busParams,
                            volume: finalVol, section: sectionTarget
                        });
                    }
                });
            }
        },

        exportJSON() {
            const state = {
                master: {
                    root: this.elements.root.value, scale: this.elements.scale.value,
                    tempo: this.elements.tempo.value, vol: this.elements.vol.value,
                    humanize: this.elements.humanize.value,
                    autoFills: this.elements.autoFillsToggle.checked,
                    
                    // Master Effects controls values added to export
                    limGain: document.getElementById('master-lim-gain')?.value || '2.0',
                    limCeiling: document.getElementById('master-lim-ceiling')?.value || '-0.5',
                    limAttack: document.getElementById('master-lim-attack')?.value || '0.005',
                    limRelease: document.getElementById('master-lim-release')?.value || '0.05',
                    hpfFreq: document.getElementById('master-hpf-freq')?.value || '20',
                    lpfFreq: document.getElementById('master-lpf-freq')?.value || '20000',
                    satDrive: document.getElementById('master-sat-drive')?.value || '3',
                    satHpf: document.getElementById('master-sat-hpf')?.value || '150',
                    satMix: document.getElementById('master-sat-mix')?.value || '0.50',
                    mbThresh: document.getElementById('master-mb-thresh')?.value || '-16.0',
                    mbRatio: document.getElementById('master-mb-ratio')?.value || '2.5'
                },
                structure: document.getElementById('song-structure-input').value,
                timelineData: [],
                fills: [],
                sections: []
            };

            // Save actual visual block arrangement for MOD and manual fill preservation
            if (this.elements.timelineTracks) {
                state.timelineData = Array.from(this.elements.timelineTracks.children).map(el => {
                    if (el.classList.contains('timeline-block') && el.dataset.target) return { type: 'section', letter: el.dataset.target };
                    if (el.classList.contains('timeline-mod-block')) return { type: 'mod', steps: parseInt(el.dataset.modSteps) };
                    if (el.classList.contains('timeline-fill-marker') && el.classList.contains('filled')) {
                        const lbl = el.querySelector('.fill-label');
                        if (lbl) return { type: 'fill', id: lbl.textContent.replace('F', '') };
                    }
                    return null;
                }).filter(x => x);
            }

            document.querySelectorAll('.fill-card').forEach(card => {
                state.fills.push({
                    id: card.dataset.fillId,
                    replaceSteps: card.querySelector('.fill-steps').value,
                    kick: card.querySelector('.fill-kick').value,
                    snare: card.querySelector('.fill-snare').value,
                    tom1: card.querySelector('.fill-tom1').value,
                    tom2: card.querySelector('.fill-tom2').value,
                    clap: card.querySelector('.fill-clap') ? card.querySelector('.fill-clap').value : '0',
                    crash: card.querySelector('.fill-crash').checked,
                    vol: card.querySelector('.fill-vol') ? card.querySelector('.fill-vol').value : '0.8'
                });
            });

            document.querySelectorAll('.song-section').forEach(sec => {
                const secState = { 
                    id: sec.dataset.section, 
                    color: sec.querySelector('.section-color-picker').value, 
                    name: sec.querySelector('.section-name-input') ? sec.querySelector('.section-name-input').value : '',
                    leads: [] 
                };
                
                secState.chords = {
                    prog: sec.querySelector('.chord-prog').value, sound: sec.querySelector('.chord-sound').value,
                    ducking: sec.querySelector('.chord-ducking').checked, arp: sec.querySelector('.chord-arp-toggle').checked,
                    arpPattern: sec.querySelector('.chord-arp-pattern').value,
                    vol: sec.querySelector('.chord-vol') ? sec.querySelector('.chord-vol').value : '0.65',
                    adsr: window.SongComposer.Chords.getADSRData(sec)
                };
                secState.bass = {
                    rhythm: sec.querySelector('.bass-rhythm').value, sound: sec.querySelector('.bass-sound').value,
                    ducking: sec.querySelector('.bass-ducking').checked,
                    vol: sec.querySelector('.bass-vol') ? sec.querySelector('.bass-vol').value : '0.85'
                };
                sec.querySelectorAll('.lead-card').forEach(lead => {
                    secState.leads.push({
                        rhythm: lead.querySelector('.lead-rhythm').value, sound: lead.querySelector('.lead-sound').value,
                        ducking: lead.querySelector('.lead-ducking').checked,
                        vol: lead.querySelector('.lead-vol') ? lead.querySelector('.lead-vol').value : '0.75',
                        flanger: lead.querySelector('.lead-flanger') ? lead.querySelector('.lead-flanger').value : '0',
                        delay: lead.querySelector('.lead-delay') ? lead.querySelector('.lead-delay').value : '0.2',
                        reverb: lead.querySelector('.lead-reverb') ? lead.querySelector('.lead-reverb').value : '0.3',
                        adsr: window.SongComposer.Lead.getADSRData(lead)
                    });
                });
                secState.drums = {
                    kick: sec.querySelector('.drum-kick').value, snare: sec.querySelector('.drum-snare').value,
                    hihat: sec.querySelector('.drum-hihat').value,
                    kickVol: sec.querySelector('.drum-kick-vol') ? sec.querySelector('.drum-kick-vol').value : '0.90',
                    snareVol: sec.querySelector('.drum-snare-vol') ? sec.querySelector('.drum-snare-vol').value : '0.85',
                    hihatVol: sec.querySelector('.drum-hihat-vol') ? sec.querySelector('.drum-hihat-vol').value : '0.75',
                    compThresh: sec.querySelector('.drum-comp-thresh').value, compRatio: sec.querySelector('.drum-comp-ratio').value,
                    vol: sec.querySelector('.drum-vol') ? sec.querySelector('.drum-vol').value : '0.8'
                };
                state.sections.push(secState);
            });

            const blob = new Blob([JSON.stringify(state, null, 2)], {type: "application/json"});
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "song_composer_project.json";
            a.click();
            URL.revokeObjectURL(url);
        },

        importJSON(file) {
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const state = JSON.parse(e.target.result);
                    
                    if (state.master) {
                        this.elements.root.value = state.master.root;
                        this.elements.scale.value = state.master.scale;
                        this.elements.tempo.value = state.master.tempo;
                        this.elements.vol.value = state.master.vol;
                        if (state.master.humanize !== undefined) this.elements.humanize.value = state.master.humanize;
                        this.elements.autoFillsToggle.checked = state.master.autoFills;
                        
                        // Import Master Effects controls values
                        if (state.master.limGain !== undefined && document.getElementById('master-lim-gain')) {
                            document.getElementById('master-lim-gain').value = state.master.limGain;
                        }
                        if (state.master.limCeiling !== undefined && document.getElementById('master-lim-ceiling')) {
                            document.getElementById('master-lim-ceiling').value = state.master.limCeiling;
                        }
                        if (state.master.limAttack !== undefined && document.getElementById('master-lim-attack')) {
                            document.getElementById('master-lim-attack').value = state.master.limAttack;
                        }
                        if (state.master.limRelease !== undefined && document.getElementById('master-lim-release')) {
                            document.getElementById('master-lim-release').value = state.master.limRelease;
                        }
                        if (state.master.hpfFreq !== undefined && document.getElementById('master-hpf-freq')) {
                            document.getElementById('master-hpf-freq').value = state.master.hpfFreq;
                        }
                        if (state.master.lpfFreq !== undefined && document.getElementById('master-lpf-freq')) {
                            document.getElementById('master-lpf-freq').value = state.master.lpfFreq;
                        }
                        if (state.master.satDrive !== undefined && document.getElementById('master-sat-drive')) {
                            document.getElementById('master-sat-drive').value = state.master.satDrive;
                        }
                        if (state.master.satHpf !== undefined && document.getElementById('master-sat-hpf')) {
                            document.getElementById('master-sat-hpf').value = state.master.satHpf;
                        }
                        if (state.master.satMix !== undefined && document.getElementById('master-sat-mix')) {
                            document.getElementById('master-sat-mix').value = state.master.satMix;
                        }
                        if (state.master.mbThresh !== undefined && document.getElementById('master-mb-thresh')) {
                            document.getElementById('master-mb-thresh').value = state.master.mbThresh;
                        }
                        if (state.master.mbRatio !== undefined && document.getElementById('master-mb-ratio')) {
                            document.getElementById('master-mb-ratio').value = state.master.mbRatio;
                        }

                        this.updateAutoFillsState();
                        if (window.SongComposer.Main) window.SongComposer.Main.updateScaleSumDisplay();
                        
                        // Let audio.js read the newly imported effects levels
                        if (window.SongComposer.Audio && typeof window.SongComposer.Audio.readDOMFXDefaults === 'function') {
                            window.SongComposer.Audio.readDOMFXDefaults();
                        }
                    }
                    
                    if (state.fills) {
                        const container = document.getElementById('fills-container');
                        container.querySelectorAll('.fill-card').forEach((c, i) => { if(i>0) c.remove(); });
                        state.fills.forEach((f, i) => {
                            if (i > 0) window.SongComposer.Fills.addFillInstance();
                            const cards = container.querySelectorAll('.fill-card');
                            const card = cards[cards.length - 1];
                            card.dataset.fillId = f.id;
                            card.querySelector('.fill-header').innerHTML = `<span class="drag-handle">☰</span> Fill ${f.id} <button class="btn-delete-fill-card" title="Remove Fill">✕</button>`;
                            card.querySelector('.fill-steps').value = f.replaceSteps;
                            card.querySelector('.fill-kick').value = f.kick;
                            card.querySelector('.fill-snare').value = f.snare;
                            card.querySelector('.fill-tom1').value = f.tom1;
                            card.querySelector('.fill-tom2').value = f.tom2;
                            if(card.querySelector('.fill-clap')) card.querySelector('.fill-clap').value = f.clap;
                            card.querySelector('.fill-crash').checked = f.crash;
                            if(f.vol && card.querySelector('.fill-vol')) card.querySelector('.fill-vol').value = f.vol;
                        });
                    }

                    if (state.sections) {
                        state.sections.forEach(s => {
                            let secEl = document.querySelector(`.song-section[data-section="${s.id}"]`);
                            if (!secEl) secEl = window.SongComposer.Main.createNewSectionEditor(s.id);
                            
                            secEl.querySelector('.section-color-picker').value = s.color;
                            secEl.style.setProperty('--section-color', s.color);
                            if (s.name && secEl.querySelector('.section-name-input')) secEl.querySelector('.section-name-input').value = s.name;
                            
                            if (s.chords) {
                                secEl.querySelector('.chord-prog').value = s.chords.prog;
                                secEl.querySelector('.chord-sound').value = s.chords.sound;
                                secEl.querySelector('.chord-ducking').checked = s.chords.ducking;
                                secEl.querySelector('.chord-arp-toggle').checked = s.chords.arp;
                                secEl.querySelector('.chord-arp-pattern').value = s.chords.arpPattern;
                                if (s.chords.vol && secEl.querySelector('.chord-vol')) secEl.querySelector('.chord-vol').value = s.chords.vol;
                                if (s.chords.adsr && window.SongComposer.Chords.setADSRData) window.SongComposer.Chords.setADSRData(secEl, s.chords.adsr);
                            }
                            if (s.bass) {
                                secEl.querySelector('.bass-rhythm').value = s.bass.rhythm;
                                secEl.querySelector('.bass-sound').value = s.bass.sound;
                                secEl.querySelector('.bass-ducking').checked = s.bass.ducking;
                                if (s.bass.vol && secEl.querySelector('.bass-vol')) secEl.querySelector('.bass-vol').value = s.bass.vol;
                            }
                            if (s.drums) {
                                secEl.querySelector('.drum-kick').value = s.drums.kick;
                                secEl.querySelector('.drum-snare').value = s.drums.snare;
                                secEl.querySelector('.drum-hihat').value = s.drums.hihat;
                                
                                // Import individual drum levels dynamically
                                if (s.drums.kickVol && secEl.querySelector('.drum-kick-vol')) secEl.querySelector('.drum-kick-vol').value = s.drums.kickVol;
                                if (s.drums.snareVol && secEl.querySelector('.drum-snare-vol')) secEl.querySelector('.drum-snare-vol').value = s.drums.snareVol;
                                if (s.drums.hihatVol && secEl.querySelector('.drum-hihat-vol')) secEl.querySelector('.drum-hihat-vol').value = s.drums.hihatVol;

                                secEl.querySelector('.drum-comp-thresh').value = s.drums.compThresh;
                                secEl.querySelector('.drum-comp-ratio').value = s.drums.compRatio;
                                if (s.drums.vol && secEl.querySelector('.drum-vol')) secEl.querySelector('.drum-vol').value = s.drums.vol;
                            }
                            if (s.leads) {
                                const lContainer = secEl.querySelector('.leads-container .collapsible-content');
                                lContainer.querySelectorAll('.lead-card').forEach((c, i) => { if(i>0) c.remove(); });
                                s.leads.forEach((l, i) => {
                                    if (i > 0) window.SongComposer.Lead.addLeadInstance(secEl.querySelector('.leads-container'));
                                    const cards = lContainer.querySelectorAll('.lead-card');
                                    const card = cards[cards.length - 1];
                                    card.querySelector('.lead-rhythm').value = l.rhythm;
                                    card.querySelector('.lead-sound').value = l.sound;
                                    card.querySelector('.lead-ducking').checked = l.ducking;
                                    if (l.vol && card.querySelector('.lead-vol')) card.querySelector('.lead-vol').value = l.vol;
                                    if (l.flanger !== undefined && card.querySelector('.lead-flanger')) card.querySelector('.lead-flanger').value = l.flanger;
                                    if (l.delay !== undefined && card.querySelector('.lead-delay')) card.querySelector('.lead-delay').value = l.delay;
                                    if (l.reverb !== undefined && card.querySelector('.lead-reverb')) card.querySelector('.lead-reverb').value = l.reverb;
                                    if (l.adsr && window.SongComposer.Lead.setADSRData) window.SongComposer.Lead.setADSRData(card, l.adsr);
                                });
                            }
                        });
                    }

                    // Restore exact timeline including MODs and Drag&Drop fills
                    if (state.timelineData && state.timelineData.length > 0) {
                        const tc = document.getElementById('timeline-tracks');
                        tc.innerHTML = '';
                        window.SongComposer.Main.addFillMarker(tc);
                        
                        state.timelineData.forEach(d => {
                            if (d.type === 'section') {
                                if (!document.querySelector(`.song-section[data-section="${d.letter}"]`)) {
                                    window.SongComposer.Main.createNewSectionEditor(d.letter);
                                }
                                const block = document.createElement('div');
                                block.className = 'timeline-block';
                                block.dataset.target = d.letter;
                                block.draggable = true;
                                const secEl = document.querySelector(`.song-section[data-section="${d.letter}"]`);
                                block.style.setProperty('--block-color', secEl.querySelector('.section-color-picker').value);
                                
                                const secName = secEl.querySelector('.section-name-input') ? secEl.querySelector('.section-name-input').value : d.letter;
                                block.title = `${secName}`;
                                block.innerHTML = `<span>${d.letter}</span>`;
                                tc.appendChild(block);
                                window.SongComposer.Main.addFillMarker(tc);
                            } else if (d.type === 'mod') {
                                if (window.SongComposer.Modulation) window.SongComposer.Modulation.restoreModBlock(d.steps);
                            } else if (d.type === 'fill') {
                                const markers = tc.querySelectorAll('.timeline-fill-marker:not(.filled)');
                                if (markers.length > 0) {
                                    const dropzone = markers[markers.length - 1]; 
                                    dropzone.classList.add('filled');
                                    dropzone.title = `Fill ${d.id}`;
                                    dropzone.innerHTML = `<span class="fill-label">F${d.id}</span><button class="btn-remove-fill" title="Remove Fill">×</button>`;
                                }
                            }
                        });
                        window.SongComposer.Main.updateInputFromTimeline();
                        // Add Outro if active
                        if (state.master.autoFills) {
                            const outroBlock = document.createElement('div');
                            outroBlock.className = 'timeline-block timeline-outro-block';
                            outroBlock.draggable = false;
                            outroBlock.style.setProperty('--block-color', 'var(--playhead-color)');
                            outroBlock.innerHTML = `<span>END</span>`;
                            tc.appendChild(outroBlock);
                        }
                    } else if (state.structure) {
                        document.getElementById('song-structure-input').value = state.structure;
                        window.SongComposer.Main.updateTimelineFromInput();
                    }

                    if(window.SongComposer.Main) window.SongComposer.Main.recalculateTimelineWidths();
                    alert("Project Loaded Successfully!");
                } catch(err) {
                    alert("Error parsing JSON file: " + err.message);
                }
            };
            reader.readAsText(file);
            this.elements.jsonLoader.value = ''; 
        },

        exportMIDI() {
            const data = this.compileSongEvents();
            if(!data.events || data.events.length === 0) return alert("Nothing to export!");

            const channelMap = { 
                'chord': 0, 'bass': 1, 'lead': 2, 
                'drum': 9, 'kick': 9, 'snare': 9, 'hihat': 9, 'tom1': 9, 'tom2': 9, 'clap': 9, 'crash': 9 
            };
            const PPQ = 96; 
            const ticksPerStep = PPQ / 4; 
            
            const tempo = this.getTempo();
            const stepDurationSec = (60 / tempo) / 4;

            let tracks = { 0: [], 1: [], 2: [], 9: [] };
            
            data.events.forEach(e => {
                const ch = channelMap[e.instrument];
                if (ch === undefined) return;
                
                const timeOffsetTicks = ((e.timeOffset || 0) / stepDurationSec) * ticksPerStep;
                const absStart = Math.max(0, (e.timeStep * ticksPerStep) + timeOffsetTicks);
                const absEnd = Math.max(0, ((e.timeStep + e.durationSteps) * ticksPerStep) + timeOffsetTicks);
                
                const dynamicVol = Math.max(1, Math.min(127, Math.floor(e.volume * 127)));
                
                tracks[ch].push({ time: absStart, type: 'noteOn', ch, note: e.midiNote, vel: dynamicVol });
                tracks[ch].push({ time: absEnd, type: 'noteOff', ch, note: e.midiNote, vel: 0 });
            });

            let trackChunks = [];
            const tempoMapTrack = [];
            const mpqn = Math.floor(60000000 / tempo);
            tempoMapTrack.push(
                [0x00, 0xFF, 0x51, 0x03, (mpqn >> 16) & 0xFF, (mpqn >> 8) & 0xFF, mpqn & 0xFF] 
            );
            tempoMapTrack.push([0x00, 0xFF, 0x2F, 0x00]); 
            trackChunks.push(this.compileMidiTrack(tempoMapTrack));

            [0, 1, 2, 9].forEach(ch => {
                if (tracks[ch].length === 0) return;
                tracks[ch].sort((a, b) => a.time - b.time);
                let lastTime = 0;
                let trackBytes = [];
                tracks[ch].forEach(ev => {
                    const currentSafeTime = Math.round(ev.time);
                    const delta = Math.max(0, currentSafeTime - Math.round(lastTime)); 
                    lastTime = currentSafeTime;
                    
                    const deltaBytes = this.toVLQ(delta);
                    const status = (ev.type === 'noteOn' ? 0x90 : 0x80) | ev.ch;
                    trackBytes.push(deltaBytes.concat([status, ev.note, ev.vel]));
                });
                trackBytes.push([0x00, 0xFF, 0x2F, 0x00]); 
                trackChunks.push(this.compileMidiTrack(trackBytes));
            });

            const numTracks = trackChunks.length;
            const header = [
                0x4D, 0x54, 0x68, 0x64, 
                0x00, 0x00, 0x00, 0x06, 
                0x00, 0x01,             
                (numTracks >> 8) & 0xFF, numTracks & 0xFF, 
                (PPQ >> 8) & 0xFF, PPQ & 0xFF 
            ];

            let finalMidi = new Uint8Array(header.length + trackChunks.reduce((acc, t) => acc + t.length, 0));
            finalMidi.set(header, 0);
            let offset = header.length;
            trackChunks.forEach(t => {
                finalMidi.set(t, offset);
                offset += t.length;
            });

            const blob = new Blob([finalMidi], {type: "audio/midi"});
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "song_composer_export.mid";
            a.click();
            URL.revokeObjectURL(url);
        },

        compileMidiTrack(eventArrays) {
            let body = [];
            eventArrays.forEach(arr => body.push(...arr));
            const len = body.length;
            return new Uint8Array([
                0x4D, 0x54, 0x72, 0x6B, 
                (len >> 24) & 0xFF, (len >> 16) & 0xFF, (len >> 8) & 0xFF, len & 0xFF, 
                ...body
            ]);
        },

        toVLQ(val) {
            let buf = [val & 0x7F];
            while ((val >>= 7)) buf.unshift((val & 0x7F) | 0x80);
            return buf;
        }
    };

    window.SongComposer.Master = Master;
    document.addEventListener('DOMContentLoaded', () => Master.init());

})();
