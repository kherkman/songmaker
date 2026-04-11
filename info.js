(function() {
    window.SongComposer = window.SongComposer || {};

    const Info = {
        init() {
            this.cacheDOM();
            this.bindEvents();
            console.log("Song Composer: Info module initialized.");
        },

        cacheDOM() {
            this.modal = document.getElementById('info-modal');
            this.container = document.getElementById('info-text');
            this.btnTopClose = document.getElementById('close-info-top');
            this.btnBottomClose = document.getElementById('btn-close-info-bottom');
            this.btnOpenInfo = document.getElementById('btn-info'); // From master panel
        },

        bindEvents() {
            if (this.btnOpenInfo) {
                this.btnOpenInfo.addEventListener('click', () => this.openModal());
            }

            if (this.btnTopClose) {
                this.btnTopClose.addEventListener('click', () => this.closeModal());
            }
            if (this.btnBottomClose) {
                this.btnBottomClose.addEventListener('click', () => this.closeModal());
            }

            if (this.modal) {
                this.modal.addEventListener('click', (e) => {
                    if (e.target === this.modal) {
                        this.closeModal();
                    }
                });
            }

            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && this.modal && !this.modal.classList.contains('hidden')) {
                    this.closeModal();
                }
            });
        },

        openModal() {
            if (!this.modal) return;
            this.renderText();
            this.modal.classList.remove('hidden');
        },

        closeModal() {
            if (!this.modal) return;
            this.modal.classList.add('hidden');
        },

        renderText() {
            if (!this.container) return;

            this.container.innerHTML = `
                <h2 style="color: var(--accent-secondary); margin-top: 0; padding-top: 10px;">How to use Song Composer</h2>
                
                <h3>1. Arrangement & Naming</h3>
                <p>Build your song by typing letters in the <strong>Structure</strong> box (e.g., <code>ABABCB</code>) or by dragging and dropping the timeline blocks.</p>
                <p>Click on any section block in the timeline to open its editor panel below. You can change the name of the section directly in its header input.</p>
                
                <strong>Standard Section Designations:</strong>
                <ul style="margin-bottom: 10px;">
                    <li><strong>A</strong> = Verse</li>
                    <li><strong>B</strong> = Chorus</li>
                    <li><strong>C</strong> = Bridge</li>
                    <li><strong>D</strong> = Pre-chorus</li>
                    <li><strong>E</strong> = Post-chorus</li>
                    <li><strong>I</strong> = Intro</li>
                    <li><strong>O</strong> = Outro</li>
                </ul>

                <h3>2. Fills & Modulations</h3>
                <p>Drag <strong>Fills</strong> from the Fill Engine and drop them into the dashed gaps between sections on the timeline.</p>
                <p>Click the <strong>+ Add MOD</strong> button in the Master Controls to insert a modulation block. Drag it to a gap in the timeline to raise or lower the pitch of all sections played after it by the specified amount of semitones.</p>

                <h3>3. Chord Progression Syntax</h3>
                <p>Type Roman numerals followed by the number of steps they hold. Use upper-case for Major, lower-case for Minor, and <code>°</code> for diminished.</p>
                <ul>
                    <li><code>I4</code> = Tonic Major for 4 steps.</li>
                    <li><code>vi8</code> = Minor 6th for 8 steps.</li>
                    <li>Example: <code>I4-V4-vi4-IV4</code></li>
                </ul>

                <h3>4. Step Notation (Bass, Leads, Arps)</h3>
                <p><strong>Note: All rhythmic step patterns (Bass, Lead, Drums, Arps) operate as 16th notes.</strong></p>
                <p>Numbers represent the degrees of the <em>current chord inversion</em> playing at that moment. <code>1</code> is the lowest note of the chord.</p>
                <ul>
                    <li><code>1, 2, 3</code> = Core chord notes.</li>
                    <li><code>4, 5, 6</code> = Chord notes one octave higher (+12 semitones).</li>
                    <li><strong>Inverted Octaves:</strong> Add an <code>i</code> before a number (e.g., <code>i1</code>, <code>i4</code>) to play that note one octave <em>lower</em> (-12 semitones).</li>
                    <li><code>0</code> = Rest (Pause).</li>
                    <li><code>-</code> = Hold the previous note.</li>
                    <li>Example Bass: <code>11i1i1-1110</code></li>
                </ul>

                <h3>5. Lead Notation Bends</h3>
                <p>Insert a <code>b</code> between notes to create a pitch-bend glide that lasts exactly one step.</p>
                <ul>
                    <li>Example: <code>12b4</code> plays note 1, plays note 2, then glides from 2 up to 4 over the duration of the step.</li>
                </ul>

                <h3>6. Melody Harmonizer 🎹</h3>
                <p>Click the <strong>Melody to Chords</strong> button in the Master section to open the recording studio.</p>
                <p>Press "Rec" to start the metronome. Play a melody using your Mouse, Computer Keyboard (Z,X,C,V...), or an attached MIDI Keyboard.</p>
                <p>When recording stops, the algorithm will generate the best chord progressions that fit your melody. Select one and inject it straight into your desired Section!</p>

                <h3>7. Audio Engine & Routing</h3>
                <p>The app will automatically download the default instrument sounds from the server the first time you click anywhere on the page. You can also click <strong>📁 Load WAVs</strong> to load your own custom instrument sounds (e.g., <code>kick.wav</code>, <code>bass1.wav</code>) from your computer.</p>
                <p><strong>MIDI Routing & Settings Reference:</strong></p>
                <ul>
                    <li>The <code>baseMidi</code> value used for calculating pitch-shifted sample playback is <strong>60 (Middle C)</strong>. Ensure your instrument samples are recorded near C4.</li>
                    <li><strong>MIDI Channel Map Out:</strong> 
                        <code>chord</code>: 0, <code>bass</code>: 1, <code>lead</code>: 2, 
                        <code>drum</code>: 9, <code>kick</code>: 9, <code>snare</code>: 9, <code>hihat</code>: 9, <code>tom1</code>: 9, <code>tom2</code>: 9, <code>clap</code>: 9, <code>crash</code>: 9
                    </li>
                </ul>
            `;
        }
    };

    window.SongComposer.Info = Info;

    document.addEventListener('DOMContentLoaded', () => {
        Info.init();
    });

})();
