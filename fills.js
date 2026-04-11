(function() {
    window.SongComposer = window.SongComposer || {};

    const Fills = {
        init() {
            this.bindEvents();
            console.log("Song Composer: Fills module initialized.");
        },

        bindEvents() {
            // Add new Fill Card
            const btnAddFill = document.getElementById('btn-add-fill');
            if (btnAddFill) {
                btnAddFill.addEventListener('click', () => this.addFillInstance());
            }

            // Delegated events for Fill RND buttons
            document.body.addEventListener('click', (e) => {
                if (!e.target.classList.contains('btn-rnd')) return;

                const parentLabel = e.target.closest('label');
                if (!parentLabel) return;

                const input = parentLabel.querySelector('input[type="text"]');
                if (!input) return;

                if (input.classList.contains('fill-kick')) input.value = this.generateFillKick();
                else if (input.classList.contains('fill-snare')) input.value = this.generateFillSnare();
                else if (input.classList.contains('fill-tom1')) input.value = this.generateFillTom1();
                else if (input.classList.contains('fill-tom2')) input.value = this.generateFillTom2();
                else if (input.classList.contains('fill-clap')) input.value = this.generateFillClap();

                if (input) input.dispatchEvent(new Event('change', { bubbles: true }));
            });
        },

        addFillInstance() {
            const container = document.getElementById('fills-container');
            const existingCards = container.querySelectorAll('.fill-card');
            
            // Generate a unique ID based on timestamp to avoid duplicate IDs when things are deleted
            const newId = Date.now().toString().slice(-4); 

            // Clone the first card as a template
            const templateCard = existingCards.length > 0 ? existingCards[0] : null;
            if (!templateCard) return;

            const newCard = templateCard.cloneNode(true);
            newCard.dataset.fillId = newId;
            
            // Update header text and preserve the Delete button
            const header = newCard.querySelector('.fill-header');
            header.innerHTML = `
                <span class="drag-handle">☰</span> Fill ${newId}
                <button class="btn-delete-fill-card" title="Remove Fill">✕</button>
            `;

            // Randomize inputs slightly for the new fill
            newCard.querySelector('.fill-kick').value = this.generateFillKick();
            newCard.querySelector('.fill-snare').value = this.generateFillSnare();
            newCard.querySelector('.fill-tom1').value = this.generateFillTom1();
            newCard.querySelector('.fill-tom2').value = this.generateFillTom2();
            
            const clapInput = newCard.querySelector('.fill-clap');
            if (clapInput) clapInput.value = this.generateFillClap();

            newCard.querySelector('.fill-crash').checked = Math.random() > 0.5;

            // Insert before the add button
            container.insertBefore(newCard, document.getElementById('btn-add-fill'));
        },

        // --- RND Generators for Fills ---
        generateFillKick() {
            return ['1000', '1010', '1100', '1111'][Math.floor(Math.random() * 4)];
        },
        generateFillSnare() {
            return ['0000', '0101', '1111', '0011'][Math.floor(Math.random() * 4)];
        },
        generateFillTom1() {
            return ['1100', '1000', '1110', '0000'][Math.floor(Math.random() * 4)];
        },
        generateFillTom2() {
            return ['0011', '0001', '0111', '0000'][Math.floor(Math.random() * 4)];
        },
        generateFillClap() {
            return ['0000', '0101', '1111', '1010'][Math.floor(Math.random() * 4)];
        },

        // --- Sequencer Logic ---
        getFillData(fillId) {
            const card = document.querySelector(`.fill-card[data-fill-id="${fillId}"]`);
            if (!card) return null;

            const clapInput = card.querySelector('.fill-clap');

            return {
                replaceSteps: parseInt(card.querySelector('.fill-steps').value, 10) || 0,
                kick: card.querySelector('.fill-kick').value || '0',
                snare: card.querySelector('.fill-snare').value || '0',
                tom1: card.querySelector('.fill-tom1').value || '0',
                tom2: card.querySelector('.fill-tom2').value || '0',
                clap: clapInput ? clapInput.value : '0',
                crashOnNext: card.querySelector('.fill-crash').checked
            };
        }
    };

    window.SongComposer.Fills = Fills;

    document.addEventListener('DOMContentLoaded', () => {
        Fills.init();
    });

})();