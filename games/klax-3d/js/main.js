/**
 * main.js - Entry point for Klax 3D
 * Boot sequence and main game loop
 */

import { Game } from './game.js';
import { Renderer } from './render.js';
import { InputHandler } from './input.js';
import { AudioSystem } from './audio.js';
import { SaveSystem } from './save.js';
import { UI } from './ui.js';

class App {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        
        // Initialize systems
        this.game = new Game();
        this.renderer = new Renderer(this.canvas);
        this.audioSystem = new AudioSystem();
        this.saveSystem = new SaveSystem();
        this.ui = new UI(this.game, this.saveSystem, this.audioSystem);
        this.input = new InputHandler(this.game);
        
        // Setup input callbacks
        this.setupInputCallbacks();
        
        // Game loop state
        this.lastTime = performance.now();
        this.accumulator = 0;
        this.fixedTimeStep = 1000 / 60; // 60 FPS
        
        // Start with menu
        this.ui.showStartMenu();
        
        // Start render loop
        this.run();
    }
    
    setupInputCallbacks() {
        // Input event handlers (for audio/visual feedback)
        this.input.on('pause', () => {
            // Pause state already toggled by input handler
        });
        
        this.input.on('restart', () => {
            if (this.game.gameOver) {
                this.ui.hideAllPanels();
                this.ui.startGame();
            }
        });
    }
    
    run() {
        requestAnimationFrame((time) => this.loop(time));
    }
    
    loop(currentTime) {
        // Calculate delta time
        const deltaTime = currentTime - this.lastTime;
        this.lastTime = currentTime;
        
        // Accumulate time
        this.accumulator += deltaTime;
        
        // Fixed timestep updates (60 FPS)
        while (this.accumulator >= this.fixedTimeStep) {
            this.update();
            this.accumulator -= this.fixedTimeStep;
        }
        
        // Render at display refresh rate
        this.render();
        
        // Continue loop
        requestAnimationFrame((time) => this.loop(time));
    }
    
    update() {
        // Update game logic
        this.game.update();
        
        // Get state and events
        const state = this.game.getState();
        const events = this.game.getEvents();
        
        // Update UI
        this.ui.updateFromState(state);
        this.ui.handleEvents(events);
    }
    
    render() {
        const state = this.game.getState();
        const events = this.game.getEvents();
        
        // Update renderer
        this.renderer.updateFromState(state, events);
        
        // Render frame
        this.renderer.render();
    }
}

// Boot when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new App();
    });
} else {
    new App();
}
