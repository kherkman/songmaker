(function() {
    window.SongComposer = window.SongComposer || {};

    const AudioEngine = {
        ctx: null,
        buffers: {}, 
        
        masterGain: null,
        masterLimiter: null,
        drumBusComp: null,
        drumBusGain: null,
        duckingBus: null,
        reverbBuffer: null,

        // Scheduler state
        schedulerInterval: null,
        nextStepTime: 0,
        currentStep: 0,
        activeSources: [],
        activeVolNodes: [],
        playbackEvents: [],
        totalSteps: 0,
        stepDuration: 0,

        init() {
            this.bindEvents();
            console.log("Song Composer: Audio engine initialized.");
        },

        initAudioContext() {
            if (this.ctx) return;
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContext();

            this.masterLimiter = this.ctx.createDynamicsCompressor();
            this.masterLimiter.attack.value = 0.005;
            this.masterLimiter.release.value = 0.050;
            this.masterLimiter.ratio.value = 20.0; 
            
            this.masterGain = this.ctx.createGain();
            this.drumBusComp = this.ctx.createDynamicsCompressor();
            this.drumBusGain = this.ctx.createGain();
            this.duckingBus = this.ctx.createGain();

            this.duckingBus.connect(this.masterLimiter);
            this.drumBusGain.connect(this.drumBusComp);
            this.drumBusComp.connect(this.masterLimiter);
            this.masterLimiter.connect(this.masterGain);
            this.masterGain.connect(this.ctx.destination);

            this.generateReverbImpulse();

            const volInput = document.getElementById('master-vol');
            if (volInput) this.setMasterVolume(volInput.value);
        },

        generateReverbImpulse() {
            const sampleRate = this.ctx.sampleRate;
            const length = sampleRate * 2.0; 
            const impulse = this.ctx.createBuffer(2, length, sampleRate);
            const left = impulse.getChannelData(0);
            const right = impulse.getChannelData(1);
            for (let i = 0; i < length; i++) {
                const decay = Math.exp(-i / (sampleRate * 0.5));
                left[i] = (Math.random() * 2 - 1) * decay;
                right[i] = (Math.random() * 2 - 1) * decay;
            }
            this.reverbBuffer = impulse;
        },

        bindEvents() {
            document.body.addEventListener('click', () => {
                this.initAudioContext();
                if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
            }, { once: true });

            const fileInput = document.getElementById('local-wav-loader');
            if (fileInput) {
                fileInput.addEventListener('change', (e) => this.loadLocalFiles(e.target.files));
            }
        },

        loadLocalFiles(files) {
            this.initAudioContext(); 
            Array.from(files).forEach(file => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    this.ctx.decodeAudioData(e.target.result, (decodedBuffer) => {
                        const name = file.name.toLowerCase();
                        if (name.includes('bass') || name.includes('lead') || name.includes('chord')) {
                            this.applyCrossfadeLoop(decodedBuffer, 0.4, 1.4, 0.1); 
                        }
                        this.buffers[file.name] = decodedBuffer;
                        console.log(`Loaded and processed: ${file.name}`);
                    });
                };
                reader.readAsArrayBuffer(file);
            });
            alert(`${files.length} audio files loaded into memory.`);
        },

        applyCrossfadeLoop(buffer, loopStartSec, loopEndSec, fadeDurationSec) {
            if (buffer.duration < loopEndSec) return; 
            const sampleRate = buffer.sampleRate;
            const startSample = Math.floor(loopStartSec * sampleRate);
            const endSample = Math.floor(loopEndSec * sampleRate);
            const fadeSamples = Math.floor(fadeDurationSec * sampleRate);

            for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
                const data = buffer.getChannelData(channel);
                for (let i = 0; i < fadeSamples; i++) {
                    const fadeFactor = i / fadeSamples;
                    data[endSample - fadeSamples + i] = (data[endSample - fadeSamples + i] * (1 - fadeFactor)) + (data[startSample + i] * fadeFactor);
                }
            }
        },

        setMasterVolume(val) {
            if (this.masterGain) this.masterGain.gain.setTargetAtTime(val, this.ctx.currentTime, 0.05);
        },

        setTrackVolume(section, type, val) {
            const time = this.ctx ? this.ctx.currentTime : 0;
            this.activeVolNodes.forEach(node => {
                if (node.section === section && node.group === type) {
                    node.gainNode.gain.setTargetAtTime(val, time, 0.05);
                }
            });
            this.updateLiveEvents();
        },

        updateLiveEvents() {
            if (this.playbackEvents && this.playbackEvents.length > 0 && window.SongComposer.Master) {
                const data = window.SongComposer.Master.compileSongEvents();
                this.playbackEvents = data.events;
            }
        },

        // --- FX Engine ---
        applyFX(ctx, envGain, ev, finalDest, time, stopTime, isOffline, stepDuration) {
            const fx = ev.fx;
            if (!fx) return;
            
            if (fx.reverb > 0 && this.reverbBuffer) {
                const convolver = ctx.createConvolver();
                convolver.buffer = this.reverbBuffer;
                const reverbGain = ctx.createGain();
                reverbGain.gain.value = fx.reverb;
                convolver.connect(reverbGain);
                reverbGain.connect(finalDest);
                envGain.connect(convolver);
            }
            
            if (fx.delay > 0) {
                const delayNode = ctx.createDelay();
                delayNode.delayTime.value = stepDuration * 3; 
                const feedback = ctx.createGain();
                feedback.gain.value = 0.3;
                delayNode.connect(feedback);
                feedback.connect(delayNode);
                
                const delayGain = ctx.createGain();
                delayGain.gain.value = fx.delay;
                delayNode.connect(delayGain);
                delayGain.connect(finalDest);
                envGain.connect(delayNode);
            }
            
            if (fx.flanger > 0) {
                const flangerDelay = ctx.createDelay();
                flangerDelay.delayTime.value = 0.005;
                const osc = ctx.createOscillator();
                osc.frequency.value = 0.5;
                const oscGain = ctx.createGain();
                oscGain.gain.value = 0.002;
                osc.connect(oscGain);
                oscGain.connect(flangerDelay.delayTime);
                osc.start(time);
                osc.stop(stopTime + 2);
                
                const fFeedback = ctx.createGain();
                fFeedback.gain.value = 0.5;
                flangerDelay.connect(fFeedback);
                fFeedback.connect(flangerDelay);
                
                const flangerGain = ctx.createGain();
                flangerGain.gain.value = fx.flanger;
                flangerDelay.connect(flangerGain);
                flangerGain.connect(finalDest);
                envGain.connect(flangerDelay);
                
                if (!isOffline) this.activeSources.push(osc);
            }
        },

        // --- Real-time Playback & MIDI Scheduler ---
        play(mode = 'global', target = null, startStep = 0) {
            this.initAudioContext();
            if (this.ctx.state === 'suspended') this.ctx.resume();

            if (Object.keys(this.buffers).length === 0) {
                console.warn("Song Composer: Playing MIDI only. No WAVs loaded.");
            }

            let origSeq = window.SongComposer.Main.buildGlobalSequence;
            if (mode === 'local' && target) {
                // FIXED: Uses new format required by Master.js compilation
                window.SongComposer.Main.buildGlobalSequence = () => [{
                    type: 'section', section: target.dataset.section, fills: [], autoCrash: false, autoFill: false
                }];
            }
            
            const data = window.SongComposer.Master.compileSongEvents();
            
            if (mode === 'local') {
                window.SongComposer.Main.buildGlobalSequence = origSeq;
            }

            if (!data || !data.events || data.events.length === 0) return;

            this.playbackEvents = data.events;
            this.totalSteps = data.totalSteps;
            this.stepDuration = (60 / window.SongComposer.Master.getTempo()) / 4;
            
            this.currentStep = startStep;
            this.nextStepTime = this.ctx.currentTime + 0.05; 
            
            this.activeSources = [];
            this.activeVolNodes = [];

            if (this.schedulerInterval) clearInterval(this.schedulerInterval);
            this.schedulerInterval = setInterval(() => this.scheduleLookahead(), 25);
            console.log(`Audio Engine: Sequencer Started (${mode}) from Step ${this.currentStep}`);
        },

        scheduleLookahead() {
            const scheduleAheadTime = 0.1; 
            
            const now = this.ctx.currentTime;
            this.activeVolNodes = this.activeVolNodes.filter(n => n.stopTime > now);

            while (this.nextStepTime < this.ctx.currentTime + scheduleAheadTime) {
                this.playStep(this.currentStep, this.nextStepTime);
                this.nextStepTime += this.stepDuration;
                this.currentStep++;
                
                if (this.currentStep >= this.totalSteps) {
                    clearInterval(this.schedulerInterval);
                    break;
                }
            }
        },

        playStep(step, time) {
            const stepEvents = this.playbackEvents.filter(e => e.timeStep === step);
            const midiOut = window.SongComposer.Master.activeMidiOutput;
            
            const midiChannelMap = { 
                'chord': 0, 'bass': 1, 'lead': 2, 
                'drum': 9, 'kick': 9, 'snare': 9, 'hihat': 9, 'tom1': 9, 'tom2': 9, 'clap': 9, 'crash': 9 
            };

            stepEvents.forEach(ev => {
                const durSec = ev.durationSteps * this.stepDuration;
                const vol = ev.volume !== undefined ? ev.volume : 0.8;
                
                let evTime = time + (ev.timeOffset || 0);
                if (evTime < this.ctx.currentTime) evTime = this.ctx.currentTime;
                
                let stopTime = evTime + durSec;

                const buffer = this.buffers[ev.bufferName];
                if (buffer) {
                    const source = this.ctx.createBufferSource();
                    source.buffer = buffer;
                    
                    const name = ev.bufferName.toLowerCase();
                    if (name.includes('bass') || name.includes('lead') || name.includes('chord')) {
                        if (buffer.duration >= 1.4) {
                            source.loop = true;
                            source.loopStart = 0.4;
                            source.loopEnd = 1.4;
                        }
                    }

                    if (ev.midiNote && ev.type !== 'drum') {
                        const baseMidi = 60; 
                        source.playbackRate.value = Math.pow(2, (ev.midiNote - baseMidi) / 12);
                    }

                    const volGroup = ev.type === 'drum' ? 'drum' : ev.instrument;
                    const volGain = this.ctx.createGain();
                    volGain.gain.setValueAtTime(vol, evTime);
                    
                    const envGain = this.ctx.createGain();

                    if (ev.adsr) {
                        const aTime = Math.min(ev.adsr.a, durSec * 0.33);
                        const dTime = Math.min(ev.adsr.d, durSec * 0.33);
                        const rTime = ev.adsr.r;

                        envGain.gain.setValueAtTime(0, evTime);
                        envGain.gain.linearRampToValueAtTime(1.0, evTime + aTime);
                        envGain.gain.linearRampToValueAtTime(ev.adsr.s, evTime + aTime + dTime);
                        envGain.gain.setValueAtTime(ev.adsr.s, Math.max(evTime + aTime + dTime, evTime + durSec));
                        envGain.gain.linearRampToValueAtTime(0.001, evTime + durSec + rTime);
                        
                        stopTime = evTime + durSec + rTime;
                    } else {
                        envGain.gain.setValueAtTime(1.0, evTime);
                        envGain.gain.setTargetAtTime(0.001, evTime + durSec - 0.02, 0.015);
                    }

                    source.connect(volGain);
                    volGain.connect(envGain);

                    let finalDest = this.masterLimiter;
                    if (ev.type === 'drum') {
                        finalDest = this.drumBusGain;
                        if (name.includes('kick')) {
                            this.duckingBus.gain.cancelScheduledValues(evTime);
                            this.duckingBus.gain.setValueAtTime(1.0, evTime);
                            this.duckingBus.gain.linearRampToValueAtTime(0.2, evTime + 0.02); 
                            this.duckingBus.gain.exponentialRampToValueAtTime(1.0, evTime + 0.25);
                        }
                    } else if (ev.ducking) {
                        finalDest = this.duckingBus;
                    }

                    envGain.connect(finalDest); 
                    
                    if (ev.fx) {
                        this.applyFX(this.ctx, envGain, ev, finalDest, evTime, stopTime, false, this.stepDuration);
                    }

                    source.start(evTime);
                    source.stop(stopTime);
                    
                    this.activeSources.push(source);
                    this.activeVolNodes.push({ gainNode: volGain, stopTime: stopTime, section: ev.section, group: volGroup });
                }

                if (midiOut && ev.midiNote) {
                    const ch = midiChannelMap[ev.instrument];
                    if (ch !== undefined) {
                        const timeOffsetMs = (evTime - this.ctx.currentTime) * 1000;
                        const midiTimeOn = performance.now() + timeOffsetMs;
                        const midiTimeOff = midiTimeOn + (durSec * 1000);
                        
                        const dynamicVol = Math.max(1, Math.min(127, Math.floor(vol * 127)));
                        
                        midiOut.send([0x90 | ch, ev.midiNote, dynamicVol], midiTimeOn);
                        midiOut.send([0x80 | ch, ev.midiNote, 0], midiTimeOff);
                    }
                }
            });
        },

        stop() {
            if (this.schedulerInterval) clearInterval(this.schedulerInterval);
            
            this.activeSources.forEach(s => {
                try { s.stop(); } catch(e){}
                try { s.disconnect(); } catch(e){}
            });
            this.activeSources = [];
            this.activeVolNodes = [];

            const midiOut = window.SongComposer.Master && window.SongComposer.Master.activeMidiOutput;
            if (midiOut) {
                [0, 1, 2, 9].forEach(ch => {
                    midiOut.send([0xB0 | ch, 123, 0]); 
                    midiOut.send([0xB0 | ch, 120, 0]); 
                });
            }
            if (this.ctx && this.ctx.state === 'running') this.ctx.suspend();
        },

        pause() { this.stop(); },

        renderOffline() {
            if (Object.keys(this.buffers).length === 0) {
                return alert("Please load .wav samples first!");
            }
            
            const data = window.SongComposer.Master.compileSongEvents();
            if (!data.events || data.events.length === 0) return alert("Timeline is empty!");

            const bpm = window.SongComposer.Master.getTempo();
            const stepDuration = (60 / bpm) / 4;
            const totalDurationSec = (data.totalSteps * stepDuration) + 4.0;
            
            this.initAudioContext();
            const sampleRate = this.ctx.sampleRate; 
            
            const lengthSamples = Math.floor(sampleRate * totalDurationSec);

            const OfflineCtx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
            const offlineCtx = new OfflineCtx(2, lengthSamples, sampleRate);

            const mLimiter = offlineCtx.createDynamicsCompressor();
            mLimiter.attack.value = 0.005; mLimiter.release.value = 0.050; mLimiter.ratio.value = 20.0;
            
            const dComp = offlineCtx.createDynamicsCompressor();
            const dGain = offlineCtx.createGain();
            const duckBus = offlineCtx.createGain();
            
            duckBus.connect(mLimiter);
            dGain.connect(dComp);
            dComp.connect(mLimiter);
            mLimiter.connect(offlineCtx.destination);

            data.events.forEach(ev => {
                const buffer = this.buffers[ev.bufferName];
                if (!buffer) return;

                let timeSec = (ev.timeStep * stepDuration) + (ev.timeOffset || 0);
                timeSec = Math.max(0, timeSec); 
                
                const durSec = ev.durationSteps * stepDuration;
                const vol = ev.volume !== undefined ? ev.volume : 0.8;
                let stopTime = timeSec + durSec;

                const source = offlineCtx.createBufferSource();
                source.buffer = buffer;
                
                const name = ev.bufferName.toLowerCase();
                if (name.includes('bass') || name.includes('lead') || name.includes('chord')) {
                    if (buffer.duration >= 1.4) {
                        source.loop = true;
                        source.loopStart = 0.4;
                        source.loopEnd = 1.4;
                    }
                }

                if (ev.midiNote && ev.type !== 'drum') {
                    const baseMidi = 60; 
                    source.playbackRate.value = Math.pow(2, (ev.midiNote - baseMidi) / 12);
                }

                const volGain = offlineCtx.createGain();
                volGain.gain.setValueAtTime(vol, timeSec);
                const envGain = offlineCtx.createGain();

                if (ev.adsr) {
                    const aTime = Math.min(ev.adsr.a, durSec * 0.33);
                    const dTime = Math.min(ev.adsr.d, durSec * 0.33);
                    const rTime = ev.adsr.r;

                    envGain.gain.setValueAtTime(0, timeSec);
                    envGain.gain.linearRampToValueAtTime(1.0, timeSec + aTime);
                    envGain.gain.linearRampToValueAtTime(ev.adsr.s, timeSec + aTime + dTime);
                    envGain.gain.setValueAtTime(ev.adsr.s, Math.max(timeSec + aTime + dTime, timeSec + durSec));
                    envGain.gain.linearRampToValueAtTime(0.001, timeSec + durSec + rTime);
                    
                    stopTime = timeSec + durSec + rTime;
                } else {
                    envGain.gain.setValueAtTime(1.0, timeSec);
                    envGain.gain.setTargetAtTime(0.001, timeSec + durSec - 0.02, 0.015);
                }

                source.connect(volGain);
                volGain.connect(envGain);

                let finalDest = mLimiter;
                if (ev.type === 'drum') {
                    finalDest = dGain;
                    if (name.includes('kick')) {
                        duckBus.gain.cancelScheduledValues(timeSec);
                        duckBus.gain.setValueAtTime(1.0, timeSec);
                        duckBus.gain.linearRampToValueAtTime(0.2, timeSec + 0.02); 
                        duckBus.gain.exponentialRampToValueAtTime(1.0, timeSec + 0.25);
                    }
                } else if (ev.ducking) {
                    finalDest = duckBus;
                }

                envGain.connect(finalDest); 
                
                if (ev.fx) {
                    this.applyFX(offlineCtx, envGain, ev, finalDest, timeSec, stopTime, true, stepDuration); 
                }

                source.start(timeSec);
                source.stop(stopTime);
            });

            console.log("Starting Offline Render...");
            offlineCtx.startRendering().then((renderedBuffer) => {
                console.log("Render complete. Creating WAV Blob.");
                const wavData = this.bufferToWave(renderedBuffer, lengthSamples);
                const blob = new Blob([wavData], { type: 'audio/wav' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = url;
                a.download = 'song_composer_mixdown.wav';
                document.body.appendChild(a);
                a.click();
                setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
            }).catch(err => {
                console.error('Rendering failed: ', err);
                alert("WAV Rendering Failed. Check console.");
            });
        },

        bufferToWave(abuffer, lenSamples) {
            let numOfChan = abuffer.numberOfChannels,
                length = lenSamples * numOfChan * 2 + 44,
                buffer = new ArrayBuffer(length),
                view = new DataView(buffer),
                channels = [], i, sample,
                offset = 0,
                pos = 0;

            const setUint16 = (data) => { view.setUint16(pos, data, true); pos += 2; };
            const setUint32 = (data) => { view.setUint32(pos, data, true); pos += 4; };

            setUint32(0x46464952); // "RIFF"
            setUint32(length - 8); // file length - 8
            setUint32(0x45564157); // "WAVE"
            setUint32(0x20746d66); // "fmt " chunk
            setUint32(16);         // length = 16
            setUint16(1);          // PCM (uncompressed)
            setUint16(numOfChan);
            setUint32(abuffer.sampleRate);
            setUint32(abuffer.sampleRate * 2 * numOfChan); // avg. bytes/sec
            setUint16(numOfChan * 2); // block-align
            setUint16(16);         // 16-bit
            setUint32(0x61746164); // "data" chunk
            setUint32(length - pos - 4); // chunk length

            for(i = 0; i < abuffer.numberOfChannels; i++) channels.push(abuffer.getChannelData(i));
            while(pos < length) {
                for(i = 0; i < numOfChan; i++) {
                    sample = Math.max(-1, Math.min(1, channels[i][offset])); 
                    sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767)|0; 
                    view.setInt16(pos, sample, true); pos += 2;
                }
                offset++;
            }
            return buffer;
        },

        scheduleNote(params) {
            this.initAudioContext();
            if (this.ctx.state === 'suspended') this.ctx.resume();
            
            const buffer = this.buffers[params.bufferName];
            if (!buffer) return;
            
            const source = this.ctx.createBufferSource();
            source.buffer = buffer;
            
            if (params.noteMidi && !params.bufferName.includes('drum') && !params.bufferName.includes('hihat')) {
                source.playbackRate.value = Math.pow(2, (params.noteMidi - (params.baseMidi || 60)) / 12);
            }
            
            const gain = this.ctx.createGain();
            gain.gain.value = params.velocity !== undefined ? params.velocity : 0.8;
            
            source.connect(gain);
            gain.connect(this.masterGain);
            
            source.start(params.time || this.ctx.currentTime);
            if (params.duration) {
                source.stop((params.time || this.ctx.currentTime) + params.duration);
            }
        }
    };

    window.SongComposer.Audio = AudioEngine;
    document.addEventListener('DOMContentLoaded', () => AudioEngine.init());

})();