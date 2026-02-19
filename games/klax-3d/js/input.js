/**
 * input.js - Unified keyboard and touch input handling
 */

export class InputHandler {
    constructor(game) {
        this.game = game;
        this.callbacks = {
            moveLeft: [],
            moveRight: [],
            drop: [],
            pause: [],
            restart: []
        };
        
        this.setupKeyboard();
        this.setupTouch();
    }
    
    setupKeyboard() {
        document.addEventListener('keydown', (e) => {
            if (e.repeat) return;
            
            switch(e.key.toLowerCase()) {
                case 'arrowleft':
                case 'a':
                    e.preventDefault();
                    if (this.game.moveLeft()) {
                        this.trigger('moveLeft');
                    }
                    break;
                    
                case 'arrowright':
                case 'd':
                    e.preventDefault();
                    if (this.game.moveRight()) {
                        this.trigger('moveRight');
                    }
                    break;
                    
                case ' ':
                case 'enter':
                    e.preventDefault();
                    if (this.game.dropFromRack()) {
                        this.trigger('drop');
                    }
                    break;
                    
                case 'p':
                    e.preventDefault();
                    this.game.togglePause();
                    this.trigger('pause');
                    break;
                    
                case 'r':
                    e.preventDefault();
                    this.trigger('restart');
                    break;
            }
        });
    }
    
    setupTouch() {
        // Touch control buttons
        const btnLeft = document.getElementById('btn-left');
        const btnRight = document.getElementById('btn-right');
        const btnDrop = document.getElementById('btn-drop');
        
        if (btnLeft) {
            btnLeft.addEventListener('touchstart', (e) => {
                e.preventDefault();
                if (this.game.moveLeft()) {
                    this.trigger('moveLeft');
                }
            });
            btnLeft.addEventListener('click', (e) => {
                e.preventDefault();
                if (this.game.moveLeft()) {
                    this.trigger('moveLeft');
                }
            });
        }
        
        if (btnRight) {
            btnRight.addEventListener('touchstart', (e) => {
                e.preventDefault();
                if (this.game.moveRight()) {
                    this.trigger('moveRight');
                }
            });
            btnRight.addEventListener('click', (e) => {
                e.preventDefault();
                if (this.game.moveRight()) {
                    this.trigger('moveRight');
                }
            });
        }
        
        if (btnDrop) {
            btnDrop.addEventListener('touchstart', (e) => {
                e.preventDefault();
                if (this.game.dropFromRack()) {
                    this.trigger('drop');
                }
            });
            btnDrop.addEventListener('click', (e) => {
                e.preventDefault();
                if (this.game.dropFromRack()) {
                    this.trigger('drop');
                }
            });
        }
        
        // Detect touch device and show controls
        this.detectTouchDevice();
    }
    
    detectTouchDevice() {
        const isTouchDevice = ('ontouchstart' in window) || 
                            (navigator.maxTouchPoints > 0) || 
                            (navigator.msMaxTouchPoints > 0);
        
        if (isTouchDevice) {
            const touchControls = document.getElementById('touch-controls');
            if (touchControls) {
                touchControls.classList.remove('hidden');
            }
        }
    }
    
    on(event, callback) {
        if (this.callbacks[event]) {
            this.callbacks[event].push(callback);
        }
    }
    
    trigger(event) {
        if (this.callbacks[event]) {
            this.callbacks[event].forEach(cb => cb());
        }
    }
}
