(function() {
window.SongComposer = window.SongComposer || {};

const Main = {
    isPlayingGlobal: false,
    isPlayingLocal: false,
    activeLocalTarget: null,
    startTime: 0,
    pauseTime: 0,
    totalDuration: 0,
    totalSteps: 0,
    sectionBoundaries: [],
    animationFrameId: null,
    
    elements: {},

    init() {
        this.cacheDOM();
        this.bindEvents();
        this.updateScaleSumDisplay(); 
        this.updateTimelineFromInput(); 
        this.initDragAndDrop();
        console.log("Song Composer: Main module initialized.");
    },

    cacheDOM() {
        this.elements = {
            structureInput: document.getElementById('song-structure-input'),
            btnApply: document.getElementById('btn-apply-structure'),
            btnRndStructure: document.querySelector('.structure-input-row .btn-rnd'),
            btnRndAll: document.getElementById('btn-rnd-all'),
            timelineTracks: document.getElementById('timeline-tracks'),
            playhead: document.getElementById('playhead'),
            
            btnPlay: document.getElementById('btn-play-pause'),
            btnStop: document.getElementById('btn-stop'),
            btnRewind: document.getElementById('btn-rewind'),
            btnForward: document.getElementById('btn-forward'),
            
            tempoInput: document.getElementById('master-tempo'),
            scaleInput: document.getElementById('master-scale'),
            scaleSumDisplay: document.getElementById('scale-sum-display'),
            autoFillsToggle: document.getElementById('auto-fills-toggle'),

            sectionsContainer: document.getElementById('sections-container')
        };
    },

    bindEvents() {
        if (this.elements.btnApply) this.elements.btnApply.addEventListener('click', () => this.updateTimelineFromInput());
        if (this.elements.btnRndStructure) this.elements.btnRndStructure.addEventListener('click', () => this.generateRandomStructure());
        if (this.elements.btnRndAll) {
            this.elements.btnRndAll.addEventListener('click', () => this.randomizeAll());
        }
        if (this.elements.scaleInput) {
            this.elements.scaleInput.addEventListener('input', () => this.updateScaleSumDisplay());
        }

        // Global Transport Controls
        if (this.elements.btnPlay) this.elements.btnPlay.addEventListener('click', () => this.toggleGlobalPlay());
        if (this.elements.btnStop) this.elements.btnStop.addEventListener('click', () => this.stopPlayback());
        if (this.elements.btnRewind) this.elements.btnRewind.addEventListener('click', () => this.rewind());
        if (this.elements.btnForward) this.elements.btnForward.addEventListener('click', () => this.forward());

        // Keyboard Shortcuts
        document.addEventListener('keydown', (e) => {
            if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
            switch(e.key.toLowerCase()) {
                case 'w': this.toggleGlobalPlay(); break;
                case 'a': this.rewind(); break;
                case 's': this.stopPlayback(); break;
                case 'd': this.forward(); break;
            }
        });

        // Delegated Events for UI Interactions
        document.body.addEventListener('click', (e) => {
            // 1. Timeline Block Click -> Switch active tab
            const timelineBlock = e.target.closest('.timeline-block');
            if (timelineBlock && !timelineBlock.classList.contains('timeline-fill-block') && !timelineBlock.classList.contains('timeline-outro-block') && !timelineBlock.classList.contains('timeline-mod-block')) {
                const targetSection = timelineBlock.dataset.target;
                this.switchActiveSectionTab(targetSection);
            }

            // 2. Remove old dropzone Fill
            if (e.target.classList.contains('btn-remove-fill')) {
                const marker = e.target.closest('.timeline-fill-marker');
                if (marker) {
                    marker.classList.remove('filled');
                    marker.innerHTML = '';
                    marker.removeAttribute('title');
                    this.recalculateTimelineWidths();
                }
            }

            // 3. Play Local Section
            if (e.target.classList.contains('btn-play-section')) {
                const sectionPanel = e.target.closest('.song-section');
                this.playLocalSection(sectionPanel);
            }
        });

        // Color Picker Live Update
        document.body.addEventListener('input', (e) => {
            if (e.target.classList.contains('section-color-picker')) {
                const section = e.target.closest('.song-section');
                const color = e.target.value;
                section.style.setProperty('--section-color', color);
                
                const sectionLetter = section.dataset.section;
                document.querySelectorAll(`.timeline-block[data-target="${sectionLetter}"]`).forEach(block => {
                    block.style.setProperty('--block-color', color);
                });
            }
        });

        document.body.addEventListener('input', (e) => {
            if (e.target.tagName === 'INPUT' && e.target.type === 'range') {
                if (window.SongComposer.Audio && window.SongComposer.Audio.updateLiveEvents) {
                    window.SongComposer.Audio.updateLiveEvents();
                }
            }
        });

        document.body.addEventListener('change', (e) => {
            if (e.target.classList.contains('chord-prog')) {
                this.updateTimelineFromInput();
            }
        });
    },

    // --- Drag and Drop Engine ---
    initDragAndDrop() {
        let draggedElement = null;
        let dragType = null; 

        document.addEventListener('dragstart', (e) => {
            draggedElement = e.target;
            
            if (draggedElement.classList.contains('timeline-block') && !draggedElement.classList.contains('timeline-outro-block')) {
                dragType = 'timeline-block';
                e.dataTransfer.effectAllowed = 'move';
            } else if (draggedElement.classList.contains('fill-card')) {
                dragType = 'fill-card';
                e.dataTransfer.effectAllowed = 'copy';
                e.dataTransfer.setData('text/plain', draggedElement.dataset.fillId);
                document.querySelectorAll('.timeline-fill-marker:not(.filled)').forEach(m => m.style.width = '15px');
            } else if (draggedElement.classList.contains('timeline-fill-marker') && draggedElement.classList.contains('filled')) {
                dragType = 'existing-fill';
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', draggedElement.querySelector('.fill-label').textContent.replace('F', ''));
                document.querySelectorAll('.timeline-fill-marker:not(.filled)').forEach(m => m.style.width = '15px');
            }
            
            setTimeout(() => { if (draggedElement) draggedElement.style.opacity = '0.5'; }, 0);
        });

        document.addEventListener('dragend', (e) => {
            if (draggedElement) draggedElement.style.opacity = '1';
            draggedElement = null;
            dragType = null;
            
            document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
            document.querySelectorAll('.timeline-fill-marker:not(.filled)').forEach(m => m.style.width = '0px');
        });

        document.addEventListener('dragover', (e) => {
            e.preventDefault(); 
            
            if (dragType === 'timeline-block' && e.target.closest('.timeline-block') && !e.target.closest('.timeline-outro-block')) {
                const targetBlock = e.target.closest('.timeline-block');
                if (targetBlock !== draggedElement) {
                    const rect = targetBlock.getBoundingClientRect();
                    const mid = rect.left + rect.width / 2;
                    
                    if (e.clientX < mid) {
                        targetBlock.parentNode.insertBefore(draggedElement, targetBlock);
                        if(draggedElement.nextElementSibling && draggedElement.nextElementSibling.classList.contains('timeline-fill-marker')) {
                            targetBlock.parentNode.insertBefore(draggedElement.nextElementSibling, targetBlock);
                        }
                    } else {
                        targetBlock.parentNode.insertBefore(draggedElement, targetBlock.nextElementSibling);
                        if(draggedElement.nextElementSibling && draggedElement.nextElementSibling.classList.contains('timeline-fill-marker')) {
                            targetBlock.parentNode.insertBefore(draggedElement.nextElementSibling, targetBlock.nextElementSibling);
                        }
                    }
                    this.updateInputFromTimeline();
                }
            }
            
            if ((dragType === 'fill-card' || dragType === 'existing-fill') && e.target.closest('.timeline-fill-marker')) {
                e.target.closest('.timeline-fill-marker').classList.add('drag-over');
            }
        });

        document.addEventListener('dragleave', (e) => {
            if ((dragType === 'fill-card' || dragType === 'existing-fill') && e.target.classList.contains('timeline-fill-marker')) {
                e.target.classList.remove('drag-over');
            }
        });

        document.addEventListener('drop', (e) => {
            e.preventDefault();
            if (dragType === 'fill-card' || dragType === 'existing-fill') {
                const dropzone = e.target.closest('.timeline-fill-marker');
                if (dropzone && dropzone !== draggedElement) {
                    dropzone.classList.remove('drag-over');
                    const fillId = e.dataTransfer.getData('text/plain');
                    
                    dropzone.classList.add('filled');
                    dropzone.title = `Fill ${fillId}`;
                    dropzone.innerHTML = `
                        <span class="fill-label">F${fillId}</span>
                        <button class="btn-remove-fill" title="Remove Fill">×</button>
                    `;

                    if (dragType === 'existing-fill' && draggedElement) {
                        draggedElement.classList.remove('filled');
                        draggedElement.innerHTML = '';
                        draggedElement.removeAttribute('title');
                    }
                    this.recalculateTimelineWidths();
                }
            }
        });
    },

    // --- Sequence Builder & Lookahead Logic ---
    buildGlobalSequence() {
        if (!this.elements.timelineTracks) return [];
        
        const blocks = Array.from(this.elements.timelineTracks.children);
        const sequence = [];
        const isAuto = this.elements.autoFillsToggle ? this.elements.autoFillsToggle.checked : false;

        let currentBlock = null;

        for (let i = 0; i < blocks.length; i++) {
            const block = blocks[i];
            if (block.classList.contains('timeline-outro-block')) continue;

            // Handle MOD Blocks
            if (block.classList.contains('timeline-mod-block')) {
                sequence.push({ type: 'mod', steps: parseInt(block.dataset.modSteps, 10) });
                continue;
            }

            let fillId = null;
            if (block.classList.contains('timeline-fill-block')) {
                fillId = block.dataset.fillId;
            } else if (block.classList.contains('timeline-fill-marker') && block.classList.contains('filled')) {
                const label = block.querySelector('.fill-label');
                if (label) fillId = label.textContent.replace('F', '');
            }

            // Handle Fills
            if (fillId && !isAuto) {
                if (!currentBlock) {
                    currentBlock = { type: 'standalone_fill', section: null, fills: [fillId], autoCrash: false, autoFill: false };
                    sequence.push(currentBlock);
                } else {
                    currentBlock.fills.push(fillId);
                }
                continue;
            }

            // Handle Sections
            if (block.classList.contains('timeline-block') && block.dataset.target) {
                const sectionLetter = block.dataset.target;
                currentBlock = { type: 'section', section: sectionLetter, fills: [], autoCrash: false, autoFill: false };
                
                if (isAuto) {
                    let nextSection = null;
                    for(let j = i + 1; j < blocks.length; j++) {
                        if(blocks[j].dataset.target && !blocks[j].classList.contains('timeline-fill-block') && !blocks[j].classList.contains('timeline-outro-block') && !blocks[j].classList.contains('timeline-mod-block')) {
                            nextSection = blocks[j].dataset.target;
                            break;
                        }
                    }
                    let prevSection = null;
                    for(let j = i - 1; j >= 0; j--) {
                        if(blocks[j].dataset.target && !blocks[j].classList.contains('timeline-fill-block') && !blocks[j].classList.contains('timeline-outro-block') && !blocks[j].classList.contains('timeline-mod-block')) {
                            prevSection = blocks[j].dataset.target;
                            break;
                        }
                    }
                    if (sequence.length === 0) currentBlock.autoCrash = true;
                    if (nextSection && nextSection !== sectionLetter) currentBlock.autoFill = true;
                    if (prevSection && prevSection !== sectionLetter) currentBlock.autoCrash = true;
                }

                sequence.push(currentBlock);
            }
        }
        return sequence;
    },

    // --- Helpers for naming and mapping sections ---
    getSectionColor(letter) {
        const map = {
            'A': '#4CAF50', 'B': '#2196F3', 'C': '#9C27B0', 
            'D': '#FF9800', 'E': '#E91E63', 'I': '#00BCD4', 'O': '#CDDC39'
        };
        return map[letter.toUpperCase()] || '#8888a0'; 
    },

    getDefaultSectionName(letter) {
        const map = {
            'A': 'Verse', 'B': 'Chorus', 'C': 'Bridge',
            'D': 'Pre-chorus', 'E': 'Post-chorus',
            'I': 'Intro', 'O': 'Outro'
        };
        return map[letter.toUpperCase()] ? map[letter.toUpperCase()] : `Section`;
    },

    // --- Tab Switching & Rendering ---
    switchActiveSectionTab(targetLetter) {
        document.querySelectorAll('.song-section').forEach(sec => {
            sec.style.display = 'none';
            sec.classList.remove('active-tab');
        });

        let targetSection = document.querySelector(`.song-section[data-section="${targetLetter}"]`);
        if (!targetSection) targetSection = this.createNewSectionEditor(targetLetter);

        if (targetSection) {
            targetSection.style.display = 'block';
            targetSection.classList.add('active-tab');
        }
    },

    createNewSectionEditor(letter) {
        const template = document.querySelector('.song-section[data-section="A"]');
        if (!template) return null;

        const newSection = template.cloneNode(true);
        newSection.dataset.section = letter;
        
        const color = this.getSectionColor(letter);
        newSection.style.setProperty('--section-color', color);
        
        const colorPicker = newSection.querySelector('.section-color-picker');
        if (colorPicker) colorPicker.value = color;
        
        const prefix = newSection.querySelector('.section-letter-prefix');
        if (prefix) prefix.textContent = `${letter} - `;
        
        const nameInput = newSection.querySelector('.section-name-input');
        if (nameInput) {
            nameInput.value = this.getDefaultSectionName(letter);
            nameInput.dataset.letter = letter;
        }
        
        const btnPlay = newSection.querySelector('.btn-play-section');
        if (btnPlay) btnPlay.textContent = `▶ Play Section ${letter}`;

        if (this.elements.sectionsContainer) {
            this.elements.sectionsContainer.appendChild(newSection);
        }

        const targetDropdown = document.getElementById('melody-target-section');
        if (targetDropdown) {
            const opt = document.createElement('option');
            opt.value = letter;
            opt.text = `Section ${letter}`;
            targetDropdown.appendChild(opt);
        }
        return newSection;
    },

    updateScaleSumDisplay() {
        if (!this.elements.scaleInput || !this.elements.scaleSumDisplay) return;
        
        const val = this.elements.scaleInput.value;
        let sum = 0;
        let stepsArr = [];
        
        for (let i = 0; i < val.length; i++) {
            const num = parseInt(val[i], 10);
            if (!isNaN(num)) {
                sum += num;
                stepsArr.push(num);
            }
        }
        
        let scaleName = "Custom";
        
        if (typeof scalesList !== 'undefined') {
            const stepsStr = stepsArr.join('');
            const match = scalesList.find(s => s.steps.join('') === stepsStr);
            if (match) scaleName = match.name;
        }
        
        this.elements.scaleSumDisplay.textContent = `(${sum}) - ${scaleName}`;
    },

    updateTimelineFromInput() {
        if (!this.elements.structureInput || !this.elements.timelineTracks) return;

        const structure = this.elements.structureInput.value.trim().toUpperCase();
        const tracksContainer = this.elements.timelineTracks;
        const isAuto = this.elements.autoFillsToggle ? this.elements.autoFillsToggle.checked : false;
        
        const existingManualFills = Array.from(tracksContainer.querySelectorAll('.timeline-fill-block'));
        tracksContainer.innerHTML = ''; 

        this.addFillMarker(tracksContainer);
        
        for (let i = 0; i < structure.length; i++) {
            const letter = structure[i];
            let sectionEditor = document.querySelector(`.song-section[data-section="${letter}"]`);
            if (!sectionEditor) {
                sectionEditor = this.createNewSectionEditor(letter);
            }
            
            let color = sectionEditor ? getComputedStyle(sectionEditor).getPropertyValue('--section-color').trim() : this.getSectionColor(letter);

            const block = document.createElement('div');
            block.className = 'timeline-block';
            block.dataset.target = letter; 
            block.draggable = true;
            
            const secName = sectionEditor ? sectionEditor.querySelector('.section-name-input').value : letter;
            block.title = `${secName}`; 
            
            block.style.setProperty('--block-color', color);
            block.innerHTML = `<span>${letter}</span>`;
            
            tracksContainer.appendChild(block);
            this.addFillMarker(tracksContainer);
        }
        
        if (isAuto && structure.length > 0) {
            const outroBlock = document.createElement('div');
            outroBlock.className = 'timeline-block timeline-outro-block';
            outroBlock.draggable = false;
            outroBlock.style.setProperty('--block-color', 'var(--playhead-color)');
            outroBlock.innerHTML = `<span>END</span>`;
            tracksContainer.appendChild(outroBlock);
        }

        existingManualFills.forEach(fill => tracksContainer.appendChild(fill));
        this.recalculateTimelineWidths();
    },

    recalculateTimelineWidths() {
        if (!this.elements.timelineTracks) return;

        const tracksContainer = this.elements.timelineTracks;
        const elements = Array.from(tracksContainer.children);
        let totalSteps = 0;
        const elementData = [];

        // 1. Assign base steps safely
        elements.forEach(el => {
            let steps = 0;
            let isSection = false;
            let isFill = false;
            let isMod = false;

            if (el.classList.contains('timeline-outro-block')) {
                steps = 16;
            } else if (el.classList.contains('timeline-mod-block')) {
                steps = 4; // Visual base length for mod block
                isMod = true;
            } else if (el.classList.contains('timeline-fill-block')) {
                const fillId = el.dataset.fillId;
                if (window.SongComposer.Fills) {
                    const fillData = window.SongComposer.Fills.getFillData(fillId);
                    steps = fillData ? fillData.replaceSteps : 4;
                } else {
                    steps = 4;
                }
                isFill = true;
            } else if (el.classList.contains('timeline-fill-marker')) {
                if (el.classList.contains('filled')) {
                    const label = el.querySelector('.fill-label');
                    if (label && window.SongComposer.Fills) {
                        const fId = label.textContent.replace('F', '');
                        const fillData = window.SongComposer.Fills.getFillData(fId);
                        steps = fillData ? fillData.replaceSteps : 4;
                        isFill = true;
                    }
                }
            } else if (el.classList.contains('timeline-block')) {
                const letter = el.dataset.target;
                const sectionEditor = document.querySelector(`.song-section[data-section="${letter}"]`);
                
                if (sectionEditor && window.SongComposer.Chords) {
                    const progInput = sectionEditor.querySelector('.chord-prog');
                    if (progInput) {
                        const progStr = progInput.value;
                        steps = window.SongComposer.Chords.calculateSectionLength(progStr) || 16;
                    } else {
                        steps = 16;
                    }
                } else {
                    steps = 16;
                }
                isSection = true;
            }

            elementData.push({ el, steps, isSection, isFill, isMod, finalSteps: steps });
        });

        // 2. Shrink adjacent sections dynamically based on Fills and Mods
        const isAuto = this.elements.autoFillsToggle ? this.elements.autoFillsToggle.checked : false;
        
        for (let i = 0; i < elementData.length; i++) {
            // Backward-stealing for manual fills
            if (!isAuto && elementData[i].isFill && elementData[i].steps > 0) {
                for (let j = i - 1; j >= 0; j--) {
                    if (elementData[j].isSection) {
                        const steal = Math.min(elementData[i].steps, Math.max(0, elementData[j].finalSteps)); 
                        elementData[j].finalSteps = Math.max(0, elementData[j].finalSteps - steal);
                        break;
                    }
                }
            }
            
            // Forward-stealing for Mod blocks
            if (elementData[i].isMod && elementData[i].steps > 0) {
                for (let j = i + 1; j < elementData.length; j++) {
                    if (elementData[j].isSection) {
                        const steal = Math.min(elementData[i].steps, Math.max(0, elementData[j].finalSteps));
                        elementData[j].finalSteps = Math.max(0, elementData[j].finalSteps - steal);
                        break;
                    }
                }
            }
        }

        elementData.forEach(d => totalSteps += d.finalSteps);
        this.totalSteps = totalSteps;

        // 3. Apply precise widths
        elementData.forEach(d => {
            if (d.el.classList.contains('timeline-fill-marker') && !d.el.classList.contains('filled')) {
                d.el.style.width = '0px'; 
            } else {
                const pct = totalSteps > 0 ? (d.finalSteps / totalSteps) * 100 : 0;
                d.el.style.width = `${pct}%`;
            }
        });

        // 4. Calculate step boundaries for transport jumping
        let currentAbsoluteStep = 0;
        this.sectionBoundaries = [];
        elementData.forEach(d => {
            if (d.isSection) {
                this.sectionBoundaries.push(currentAbsoluteStep);
            }
            currentAbsoluteStep += d.finalSteps;
        });
    },

    updateInputFromTimeline() {
        if (!this.elements.timelineTracks || !this.elements.structureInput) return;
        const blocks = this.elements.timelineTracks.querySelectorAll('.timeline-block:not(.timeline-fill-block):not(.timeline-outro-block):not(.timeline-mod-block) span');
        let newStructure = '';
        blocks.forEach(span => newStructure += span.textContent);
        this.elements.structureInput.value = newStructure;
    },

    addFillMarker(container) {
        const marker = document.createElement('div');
        marker.className = 'timeline-fill-marker dropzone';
        marker.draggable = true; 
        container.appendChild(marker);
    },

    generateRandomStructure() {
        if (!this.elements.structureInput) return;
        
        const pool = ['A', 'A', 'B', 'B', 'C', 'D'];
        let length = Math.floor(Math.random() * 4) + 4; 
        let randomStr = 'I'; 
        for(let i=0; i<length-2; i++) randomStr += pool[Math.floor(Math.random() * pool.length)];
        randomStr += 'O'; 
        
        this.elements.structureInput.value = randomStr;
        this.updateTimelineFromInput();
    },

    randomizeAll() {
        if (confirm("This will randomize all the patterns and settings! Do you want to continue?")) {
            this.generateRandomStructure();
            document.querySelectorAll('.btn-rnd').forEach(btn => {
                if (btn.id !== 'btn-rnd-all' && !btn.closest('.structure-input-row')) {
                    btn.click();
                }
            });
        }
    },

    // --- Transport Controls ---
    toggleGlobalPlay() {
        if (!this.elements.btnPlay || !this.elements.playhead) return;
        
        this.isPlayingGlobal = !this.isPlayingGlobal;
        
        if (this.isPlayingGlobal) {
            this.isPlayingLocal = false;
            this.activeLocalTarget = null;
            document.querySelectorAll('.btn-play-section').forEach(btn => btn.textContent = btn.textContent.replace('⏹ Stop', '▶ Play'));

            this.elements.btnPlay.innerHTML = '⏸ Pause';
            this.startTime = performance.now() - this.pauseTime;
            
            if (window.SongComposer.Master && window.SongComposer.Audio) {
                const data = window.SongComposer.Master.compileSongEvents();
                const stepDurationMs = ((60 / window.SongComposer.Master.getTempo()) / 4) * 1000;
                this.totalDuration = (data.totalSteps || 16) * stepDurationMs; 
                
                let currentPct = parseFloat(this.elements.playhead.style.left || 0);
                let startStep = Math.floor((currentPct / 100) * this.totalSteps);
                
                if(window.SongComposer.Audio.play) {
                    window.SongComposer.Audio.play('global', null, startStep); 
                }
            }
            
            this.animatePlayhead();
        } else {
            this.elements.btnPlay.innerHTML = '⏯ Play';
            cancelAnimationFrame(this.animationFrameId);
            this.pauseTime = performance.now() - this.startTime;
            
            if(window.SongComposer.Audio && window.SongComposer.Audio.stop) {
                window.SongComposer.Audio.stop();
            }
        }
    },

    playLocalSection(sectionElement) {
        const sectionLetter = sectionElement.dataset.section;
        const btn = sectionElement.querySelector('.btn-play-section');
        if (!btn || !this.elements.playhead) return;

        if (this.isPlayingLocal) { this.stopPlayback(); return; }
        if (this.isPlayingGlobal) this.stopPlayback();

        this.isPlayingLocal = true;
        this.activeLocalTarget = sectionElement;
        btn.textContent = `⏹ Stop Section ${sectionLetter}`;
        
        if (window.SongComposer.Master && window.SongComposer.Audio) {
            const originalSequenceBuilder = window.SongComposer.Main.buildGlobalSequence;
            window.SongComposer.Main.buildGlobalSequence = () => [{ type: 'section', section: sectionLetter, fills: [], autoCrash: false, autoFill: false }];
            const data = window.SongComposer.Master.compileSongEvents();
            window.SongComposer.Main.buildGlobalSequence = originalSequenceBuilder;

            const stepDurationMs = ((60 / window.SongComposer.Master.getTempo()) / 4) * 1000;
            this.totalDuration = (data.totalSteps || 16) * stepDurationMs; 
            this.totalSteps = data.totalSteps; // Temp override for jump logic

            this.startTime = performance.now();
            this.pauseTime = 0;
            this.elements.playhead.style.left = '0%';

            if(window.SongComposer.Audio.play) {
                window.SongComposer.Audio.play('local', sectionElement, 0);
            }
        }

        this.animatePlayhead();
    },

    stopPlayback() {
        if (!this.elements.btnPlay || !this.elements.playhead) return;
        
        this.isPlayingGlobal = false;
        this.isPlayingLocal = false;
        this.activeLocalTarget = null;
        this.elements.btnPlay.innerHTML = '⏯ Play/Pause';
        
        document.querySelectorAll('.btn-play-section').forEach(btn => btn.textContent = btn.textContent.replace('⏹ Stop', '▶ Play'));

        cancelAnimationFrame(this.animationFrameId);
        this.pauseTime = 0;
        this.elements.playhead.style.left = '0%';
        
        if(window.SongComposer.Audio && window.SongComposer.Audio.stop) {
            window.SongComposer.Audio.stop();
        }
        this.recalculateTimelineWidths(); // Reset totalSteps accurately
    },

    rewind() {
        if (!this.sectionBoundaries || this.sectionBoundaries.length === 0 || !this.elements.playhead) return;
        let currentPct = parseFloat(this.elements.playhead.style.left || 0);
        let currentStep = (currentPct / 100) * this.totalSteps;
        
        let targetStep = 0;
        for (let i = this.sectionBoundaries.length - 1; i >= 0; i--) {
            if (this.sectionBoundaries[i] < currentStep - 1.5) { // 1.5 tolerance
                targetStep = this.sectionBoundaries[i];
                break;
            }
        }
        this.jumpToStep(targetStep);
    },

    forward() {
        if (!this.sectionBoundaries || this.sectionBoundaries.length === 0 || !this.elements.playhead) return;
        let currentPct = parseFloat(this.elements.playhead.style.left || 0);
        let currentStep = (currentPct / 100) * this.totalSteps;
        
        let targetStep = this.totalSteps;
        for (let i = 0; i < this.sectionBoundaries.length; i++) {
            if (this.sectionBoundaries[i] > currentStep + 1.5) { // 1.5 tolerance
                targetStep = this.sectionBoundaries[i];
                break;
            }
        }
        if(targetStep >= this.totalSteps) targetStep = 0;
        this.jumpToStep(targetStep);
    },

    jumpToStep(step) {
        if (this.totalSteps <= 0 || !this.elements.playhead) return;
        let percent = (step / this.totalSteps) * 100;
        this.elements.playhead.style.left = `${percent}%`;
        
        if (window.SongComposer.Master) {
            const stepDurationMs = ((60 / window.SongComposer.Master.getTempo()) / 4) * 1000;
            this.totalDuration = this.totalSteps * stepDurationMs; 
            
            this.pauseTime = (percent / 100) * this.totalDuration;
            
            if (this.isPlayingGlobal || this.isPlayingLocal) {
                if (window.SongComposer.Audio && window.SongComposer.Audio.stop) window.SongComposer.Audio.stop();
                this.startTime = performance.now() - this.pauseTime;
                if (window.SongComposer.Audio && window.SongComposer.Audio.play) {
                    window.SongComposer.Audio.play(this.isPlayingGlobal ? 'global' : 'local', this.activeLocalTarget, step);
                }
            }
        }
    },

    animatePlayhead() {
        if (!this.isPlayingGlobal && !this.isPlayingLocal) return;
        if (!this.elements.playhead) return;

        const currentTime = performance.now() - this.startTime;
        let percent = (currentTime / this.totalDuration) * 100;

        if (percent >= 100) { this.stopPlayback(); return; }

        this.elements.playhead.style.left = `${percent}%`;
        this.animationFrameId = requestAnimationFrame(() => this.animatePlayhead());
    }
};

window.SongComposer.Main = Main;

document.addEventListener('DOMContentLoaded', () => {
    Main.init();
});

})();