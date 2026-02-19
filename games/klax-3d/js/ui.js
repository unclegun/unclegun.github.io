/**
 * ui.js - UI and HUD management
 * Binds DOM elements to game state and handles menus
 */

import { getColorRGBA, EVENTS } from './game.js';

export class UI {
    constructor(game, saveSystem, audioSystem) {
        this.game = game;
        this.saveSystem = saveSystem;
        this.audioSystem = audioSystem;
        
        this.elements = {
            score: document.getElementById('score'),
            level: document.getElementById('level'),
            lives: document.getElementById('lives'),
            rackTiles: document.getElementById('rack-tiles'),
            highScore: document.getElementById('high-score'),
            highScoreValue: document.getElementById('high-score-value'),
            pauseIndicator: document.getElementById('pause-indicator'),
            gameOver: document.getElementById('game-over'),
            finalScore: document.getElementById('final-score'),
            newHighScore: document.getElementById('new-high-score'),
            startMenu: document.getElementById('start-menu'),
            howToPlay: document.getElementById('how-to-play'),
            settings: document.getElementById('settings'),
            about: document.getElementById('about'),
            toastContainer: document.getElementById('toast-container')
        };
        
        this.setupButtons();
        this.loadSettings();
        this.updateHighScore();
    }
    
    setupButtons() {
        // Start menu
        document.getElementById('btn-start')?.addEventListener('click', () => {
            this.hideAllPanels();
            this.startGame();
        });
        
        document.getElementById('btn-how-to-play')?.addEventListener('click', () => {
            this.elements.startMenu.classList.add('hidden');
            this.elements.howToPlay.classList.remove('hidden');
        });
        
        document.getElementById('btn-settings')?.addEventListener('click', () => {
            this.elements.startMenu.classList.add('hidden');
            this.elements.settings.classList.remove('hidden');
        });
        
        document.getElementById('btn-about')?.addEventListener('click', () => {
            this.elements.startMenu.classList.add('hidden');
            this.elements.about.classList.remove('hidden');
        });
        
        // Back buttons
        document.getElementById('btn-back-from-help')?.addEventListener('click', () => {
            this.elements.howToPlay.classList.add('hidden');
            this.elements.startMenu.classList.remove('hidden');
        });
        
        document.getElementById('btn-back-from-settings')?.addEventListener('click', () => {
            this.elements.settings.classList.add('hidden');
            this.elements.startMenu.classList.remove('hidden');
        });
        
        document.getElementById('btn-back-from-about')?.addEventListener('click', () => {
            this.elements.about.classList.add('hidden');
            this.elements.startMenu.classList.remove('hidden');
        });
        
        // Game over buttons
        document.getElementById('btn-restart')?.addEventListener('click', () => {
            this.hideAllPanels();
            this.startGame();
        });
        
        document.getElementById('btn-menu')?.addEventListener('click', () => {
            this.hideAllPanels();
            this.elements.startMenu.classList.remove('hidden');
        });
        
        // Settings
        const soundCheckbox = document.getElementById('setting-sound');
        if (soundCheckbox) {
            soundCheckbox.addEventListener('change', (e) => {
                const enabled = e.target.checked;
                this.audioSystem.setEnabled(enabled);
                this.saveSystem.setSetting('soundEnabled', enabled);
            });
        }
        
        const motionCheckbox = document.getElementById('setting-reduced-motion');
        if (motionCheckbox) {
            motionCheckbox.addEventListener('change', (e) => {
                const enabled = e.target.checked;
                this.setReducedMotion(enabled);
                this.saveSystem.setSetting('reducedMotion', enabled);
            });
        }
    }
    
    loadSettings() {
        const soundEnabled = this.saveSystem.getSetting('soundEnabled');
        const reducedMotion = this.saveSystem.getSetting('reducedMotion');
        
        const soundCheckbox = document.getElementById('setting-sound');
        if (soundCheckbox) {
            soundCheckbox.checked = soundEnabled;
        }
        this.audioSystem.setEnabled(soundEnabled);
        
        const motionCheckbox = document.getElementById('setting-reduced-motion');
        if (motionCheckbox) {
            motionCheckbox.checked = reducedMotion;
        }
        this.setReducedMotion(reducedMotion);
    }
    
    setReducedMotion(enabled) {
        if (enabled) {
            document.body.classList.add('reduced-motion-override');
        } else {
            document.body.classList.remove('reduced-motion-override');
        }
    }
    
    hideAllPanels() {
        this.elements.startMenu.classList.add('hidden');
        this.elements.howToPlay.classList.add('hidden');
        this.elements.settings.classList.add('hidden');
        this.elements.about.classList.add('hidden');
        this.elements.gameOver.classList.add('hidden');
        this.elements.pauseIndicator.classList.add('hidden');
    }
    
    startGame() {
        this.game.reset();
    }
    
    updateFromState(state) {
        // Update score
        if (this.elements.score) {
            this.elements.score.textContent = state.score;
        }
        
        // Update level
        if (this.elements.level) {
            this.elements.level.textContent = state.level;
        }
        
        // Update lives
        if (this.elements.lives) {
            const hearts = '❤️'.repeat(Math.max(0, state.lives));
            const empty = '🖤'.repeat(Math.max(0, 3 - state.lives));
            this.elements.lives.textContent = hearts + empty;
        }
        
        // Update rack preview
        this.updateRackPreview(state.rack);
        
        // Update pause indicator
        if (state.paused) {
            this.elements.pauseIndicator.classList.remove('hidden');
        } else {
            this.elements.pauseIndicator.classList.add('hidden');
        }
        
        // Update game over screen
        if (state.gameOver && !this.elements.gameOver.classList.contains('hidden') === false) {
            this.showGameOver(state.score, state.level);
        }
    }
    
    updateRackPreview(rack) {
        if (!this.elements.rackTiles) return;
        
        // Clear existing tiles
        this.elements.rackTiles.innerHTML = '';
        
        // Add tiles (front to back)
        rack.forEach(colorIndex => {
            const tile = document.createElement('div');
            tile.className = 'rack-tile';
            const rgba = getColorRGBA(colorIndex);
            tile.style.backgroundColor = `rgb(${rgba[0] * 255}, ${rgba[1] * 255}, ${rgba[2] * 255})`;
            this.elements.rackTiles.appendChild(tile);
        });
        
        // Add empty slots
        for (let i = rack.length; i < 5; i++) {
            const tile = document.createElement('div');
            tile.className = 'rack-tile';
            tile.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
            this.elements.rackTiles.appendChild(tile);
        }
    }
    
    updateHighScore() {
        const highScore = this.saveSystem.getHighScore();
        if (this.elements.highScoreValue) {
            this.elements.highScoreValue.textContent = highScore;
        }
        
        if (highScore > 0) {
            this.elements.highScore.classList.remove('hidden');
        }
    }
    
    handleEvents(events) {
        events.forEach(event => {
            switch(event.type) {
                case EVENTS.CATCH:
                    this.audioSystem.playCatch();
                    break;
                    
                case EVENTS.DROP:
                    this.audioSystem.playDrop();
                    break;
                    
                case EVENTS.MATCH:
                    const maxMatchSize = Math.max(...event.matches.map(m => m.tiles.length));
                    this.audioSystem.playMatch(maxMatchSize);
                    this.saveSystem.incrementMatches();
                    break;
                    
                case EVENTS.LIFE_LOST:
                    this.audioSystem.playLifeLost();
                    this.screenShake();
                    break;
                    
                case EVENTS.LEVEL_UP:
                    this.audioSystem.playLevelUp();
                    this.showToast(`Level ${event.level}!`);
                    break;
                    
                case EVENTS.GAME_OVER:
                    this.audioSystem.playGameOver();
                    // Game over screen will be shown by updateFromState
                    break;
            }
        });
    }
    
    showGameOver(score, level) {
        const isNewHighScore = this.saveSystem.updateHighScore(score, level);
        
        if (this.elements.finalScore) {
            this.elements.finalScore.textContent = score;
        }
        
        if (isNewHighScore) {
            this.elements.newHighScore.classList.remove('hidden');
            this.showToast('🎉 New High Score! 🎉', 3000);
        } else {
            this.elements.newHighScore.classList.add('hidden');
        }
        
        this.elements.gameOver.classList.remove('hidden');
        this.updateHighScore();
    }
    
    showToast(message, duration = 2000) {
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = message;
        
        this.elements.toastContainer.appendChild(toast);
        
        setTimeout(() => {
            toast.remove();
        }, duration);
    }
    
    screenShake() {
        // Check if reduced motion is enabled
        const reducedMotion = this.saveSystem.getSetting('reducedMotion');
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        
        if (reducedMotion || prefersReducedMotion) {
            return; // Skip shake
        }
        
        document.body.classList.add('shake');
        setTimeout(() => {
            document.body.classList.remove('shake');
        }, 500);
    }
    
    showStartMenu() {
        this.hideAllPanels();
        this.elements.startMenu.classList.remove('hidden');
    }
}
