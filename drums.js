(function() {
    window.SongComposer = window.SongComposer || {};

    const Drums = {
        init() {
            this.bindEvents();
            console.log("Song Composer: Drums module initialized.");
        },

        bindEvents() {
            document.body.addEventListener('click', (e) => {
                if (!e.target.classList.contains('btn-rnd')) return;

                const parentRow = e.target.closest('.controls-row');
                if (!parentRow) return;

                const prevElement = e.target.previousElementSibling;
                if (!prevElement) return;

                const kickInput = prevElement.querySelector('.drum-kick');
                if (kickInput) {
                    kickInput.value = this.generateKick();
                    kickInput.dispatchEvent(new Event('change', { bubbles: true }));
                }

                const snareInput = prevElement.querySelector('.drum-snare');
                if (snareInput) {
                    snareInput.value = this.generateSnare();
                    snareInput.dispatchEvent(new Event('change', { bubbles: true }));
                }

                const hihatInput = prevElement.querySelector('.drum-hihat');
                if (hihatInput) {
                    hihatInput.value = this.generateHihat();
                    hihatInput.dispatchEvent(new Event('change', { bubbles: true }));
                }
            });
        },

        // --- RND Generators ---
        generateKick() {
            let pattern = '1'; 
            let len = 15; 
            for(let i = 1; i <= len; i++) {
                if (i % 4 === 0) { 
                    pattern += Math.random() > 0.2 ? '1' : '0';
                } else if (i % 2 === 0) { 
                    pattern += Math.random() > 0.6 ? '1' : '0';
                } else { 
                    pattern += Math.random() > 0.85 ? '1' : '0'; 
                }
            }
            return pattern;
        },

        generateSnare() {
            let pattern = '';
            for(let i = 0; i < 16; i++) {
                if (i === 4 || i === 12) pattern += '1';
                else pattern += Math.random() > 0.9 ? '1' : '0';
            }
            return pattern;
        },

        generateHihat() {
            const patterns = [
                '1111111111111111', 
                '1010101010101010', 
                '1101110111011101',
                '1000100010001000'
            ];
            let base = patterns[Math.floor(Math.random() * patterns.length)];
            
            return base.split('').map(char => {
                if (char === '1' && Math.random() > 0.85) return '0';
                if (char === '0' && Math.random() > 0.85) return '1';
                return char;
            }).join('');
        },

        // --- Sequencing Logic ---
        parseSection(sectionElement, length, forceCrashOnFirst = false) {
            const kickStr = sectionElement.querySelector('.drum-kick').value || '0';
            const snareStr = sectionElement.querySelector('.drum-snare').value || '0';
            const hihatStr = sectionElement.querySelector('.drum-hihat').value || '0';

            const track = {
                kick: [], snare: [], hihat: [],
                tom1: [], tom2: [], clap: [],
                crashFlag: forceCrashOnFirst
            };

            for (let i = 0; i < length; i++) {
                track.kick.push({ stepIndex: i, play: kickStr[i % kickStr.length] === '1' });
                track.snare.push({ stepIndex: i, play: snareStr[i % snareStr.length] === '1' });
                
                let playHihat = hihatStr[i % hihatStr.length] === '1';
                if (i === 0 && forceCrashOnFirst) {
                    playHihat = false;
                }
                track.hihat.push({ stepIndex: i, play: playHihat });
                
                // Keep defaults empty since section base doesn't play these instruments natively
                track.tom1.push({ stepIndex: i, play: false });
                track.tom2.push({ stepIndex: i, play: false });
                track.clap.push({ stepIndex: i, play: false });
            }

            return track;
        },

        // --- Bus Controls Data ---
        getBusCompression(sectionElement) {
            const threshInput = sectionElement.querySelector('.drum-comp-thresh');
            const ratioInput = sectionElement.querySelector('.drum-comp-ratio');

            return {
                threshold: threshInput ? parseFloat(threshInput.value) : -15,
                ratio: ratioInput ? parseFloat(ratioInput.value) : 4
            };
        }
    };

    window.SongComposer.Drums = Drums;

    document.addEventListener('DOMContentLoaded', () => {
        Drums.init();
    });

})();