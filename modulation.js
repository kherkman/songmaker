(function() {
window.SongComposer = window.SongComposer || {};

const Modulation = {
    currentSteps: 1,
    elements: {},

    init() {
        this.injectCSS();
        this.injectUI();
        this.cacheDOM();
        this.bindEvents();
        console.log("Song Composer: Modulation module initialized.");
    },

    injectCSS() {
        // Injects specific styling for the MOD timeline blocks.
        // Width and flex-shrink removed to allow percentage-based scaling in main.js.
        const style = document.createElement('style');
        style.innerHTML = `
            .timeline-mod-block {
                background-color: #2a1b0a !important;
                border: 2px dashed var(--accent-rnd) !important;
                color: var(--accent-rnd) !important;
                box-shadow: 0 0 10px rgba(255, 183, 77, 0.2) !important;
                z-index: 5;
                transition: transform 0.2s ease, filter 0.2s ease;
                overflow: hidden;
            }
            .timeline-mod-block:hover {
                filter: brightness(1.3);
                transform: scale(1.05);
            }
            .mod-controls-wrapper {
                display: flex; gap: 5px; align-items: center; justify-content: flex-start;
            }
            .mod-steps-display {
                font-family: monospace; font-size: 1.1rem; font-weight: bold; 
                width: 35px; text-align: center; color: var(--accent-rnd);
                text-shadow: var(--glow-rnd);
            }
            .btn-remove-timeline-mod {
                position: absolute; top: -8px; right: -4px; 
                background: none; border: none; 
                color: var(--danger); font-size: 1.2rem; font-weight: bold; 
                cursor: pointer; box-shadow: none; padding: 0;
                transition: text-shadow 0.2s;
            }
            .btn-remove-timeline-mod:hover {
                text-shadow: 0 0 8px var(--danger);
            }
        `;
        document.head.appendChild(style);
    },

    injectUI() {
        // Find the Master Controls grid and append the MOD control group
        const grid = document.querySelector('.master-panel .controls-grid');
        if (!grid) {
            console.warn("Modulation UI could not find .controls-grid to attach to.");
            return;
        }

        const group = document.createElement('div');
        group.className = 'control-group';
        group.innerHTML = `
            <label style="color: var(--accent-rnd); text-shadow: 0 0 5px rgba(255, 183, 77, 0.3);">Modulation</label>
            <div class="mod-controls-wrapper">
                <button id="btn-mod-down" class="btn-rnd" style="padding: 4px 12px; font-size: 1rem;">-</button>
                <span id="mod-steps-display" class="mod-steps-display">+1</span>
                <button id="btn-mod-up" class="btn-rnd" style="padding: 4px 12px; font-size: 1rem;">+</button>
                <button id="btn-add-mod" class="btn-accent btn-small" style="margin-left: 8px; background-color: var(--accent-rnd); box-shadow: var(--glow-rnd);">+ Add MOD</button>
            </div>
        `;
        grid.appendChild(group);
    },

    cacheDOM() {
        this.elements = {
            btnDown: document.getElementById('btn-mod-down'),
            btnUp: document.getElementById('btn-mod-up'),
            display: document.getElementById('mod-steps-display'),
            btnAdd: document.getElementById('btn-add-mod'),
            timelineTracks: document.getElementById('timeline-tracks')
        };
    },

    bindEvents() {
        // Adjust step amount UI
        if (this.elements.btnDown) {
            this.elements.btnDown.addEventListener('click', () => this.changeSteps(-1));
        }
        if (this.elements.btnUp) {
            this.elements.btnUp.addEventListener('click', () => this.changeSteps(1));
        }
        
        // Insert MOD block
        if (this.elements.btnAdd) {
            this.elements.btnAdd.addEventListener('click', () => this.insertModToTimeline());
        }

        // Global delegation for removing a MOD block from the timeline
        document.body.addEventListener('click', (e) => {
            if (e.target.classList.contains('btn-remove-timeline-mod')) {
                e.stopPropagation(); // Prevent triggering the block's drag/click events
                
                const block = e.target.closest('.timeline-mod-block');
                
                // Remove the preceding dropzone marker if it exists to prevent timeline ghost gaps
                if (block.previousElementSibling && block.previousElementSibling.classList.contains('timeline-fill-marker')) {
                    block.previousElementSibling.remove();
                }
                
                block.remove();
                
                // Recalculate percentage widths for the remaining section blocks
                if (window.SongComposer.Main) window.SongComposer.Main.recalculateTimelineWidths();
            }
        });
    },

    changeSteps(delta) {
        this.currentSteps += delta;
        
        // Skip 0, as a modulation of 0 semitones does nothing functionally
        if (this.currentSteps === 0) {
            this.currentSteps = delta > 0 ? 1 : -1;
        }
        
        if (this.elements.display) {
            const sign = this.currentSteps > 0 ? '+' : '';
            this.elements.display.textContent = `${sign}${this.currentSteps}`;
        }
    },

    insertModToTimeline(steps = null) {
        if (!this.elements.timelineTracks) return;
        
        const val = steps !== null ? steps : this.currentSteps;
        const sign = val > 0 ? '+' : '';

        // Create the block. Adding 'timeline-block' makes it instantly compatible 
        // with the existing main.js drag-and-drop listeners!
        const block = document.createElement('div');
        block.className = 'timeline-block timeline-mod-block';
        block.draggable = true;
        block.dataset.modSteps = val; // Dataset storing the actual math value
        block.title = `Modulation: ${sign}${val} steps`;

        block.innerHTML = `
            <div style="display:flex; flex-direction:column; align-items:center; pointer-events:none;">
                <span style="font-size:0.6rem; color:#fff; line-height:1; letter-spacing: 1px;">MOD</span>
                <span style="font-size:1.1rem; font-weight:900; line-height:1.2;">${sign}${val}</span>
            </div>
            <button class="btn-remove-timeline-mod" title="Remove Modulation">×</button>
        `;

        // Place before the OUTRO block if it's active, otherwise just append to the end
        const outro = this.elements.timelineTracks.querySelector('.timeline-outro-block');
        
        if (outro) {
            this.elements.timelineTracks.insertBefore(block, outro);
            
            // Add an empty dropzone marker right after the mod block so Fills can still be dropped here
            const marker = document.createElement('div');
            marker.className = 'timeline-fill-marker dropzone';
            this.elements.timelineTracks.insertBefore(marker, outro);
        } else {
            this.elements.timelineTracks.appendChild(block);
            
            const marker = document.createElement('div');
            marker.className = 'timeline-fill-marker dropzone';
            this.elements.timelineTracks.appendChild(marker);
        }

        // Force visual timeline refresh
        if (window.SongComposer.Main) window.SongComposer.Main.recalculateTimelineWidths();
    },
    
    // Expose helper method for JSON import logic in master.js
    restoreModBlock(steps) {
        this.insertModToTimeline(steps);
    }
};

window.SongComposer.Modulation = Modulation;

document.addEventListener('DOMContentLoaded', () => {
    Modulation.init();
});

})();