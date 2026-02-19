/**
 * audio.js - WebAudio sound effects
 * Simple procedural audio generation for game events
 */

export class AudioSystem {
    constructor() {
        this.enabled = true;
        this.context = null;
        this.masterGain = null;
        
        // Initialize audio context lazily (user gesture required)
        this.initialized = false;
    }
    
    init() {
        if (this.initialized) return;
        
        try {
            this.context = new (window.AudioContext || window.webkitAudioContext)();
            this.masterGain = this.context.createGain();
            this.masterGain.gain.value = 0.3;
            this.masterGain.connect(this.context.destination);
            this.initialized = true;
        } catch (e) {
            console.warn('AudioContext not supported', e);
            this.enabled = false;
        }
    }
    
    setEnabled(enabled) {
        this.enabled = enabled;
    }
    
    isEnabled() {
        return this.enabled;
    }
    
    // Simple tone generator
    playTone(frequency, duration, type = 'sine') {
        if (!this.enabled || !this.initialized) return;
        
        try {
            const osc = this.context.createOscillator();
            const gain = this.context.createGain();
            
            osc.type = type;
            osc.frequency.value = frequency;
            
            gain.gain.setValueAtTime(0.3, this.context.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, this.context.currentTime + duration);
            
            osc.connect(gain);
            gain.connect(this.masterGain);
            
            osc.start(this.context.currentTime);
            osc.stop(this.context.currentTime + duration);
        } catch (e) {
            console.warn('Audio playback error', e);
        }
    }
    
    // Event-specific sounds
    playCatch() {
        this.init();
        this.playTone(440, 0.1, 'triangle');
    }
    
    playDrop() {
        this.init();
        this.playTone(330, 0.15, 'square');
    }
    
    playMatch(matchSize) {
        this.init();
        // Play a chord based on match size
        const baseFreq = 523; // C5
        this.playTone(baseFreq, 0.2, 'sine');
        this.playTone(baseFreq * 1.25, 0.2, 'sine'); // E5
        if (matchSize >= 4) {
            this.playTone(baseFreq * 1.5, 0.2, 'sine'); // G5
        }
        if (matchSize >= 5) {
            this.playTone(baseFreq * 2, 0.2, 'sine'); // C6
        }
    }
    
    playLifeLost() {
        this.init();
        // Descending tone
        if (!this.enabled || !this.initialized) return;
        
        try {
            const osc = this.context.createOscillator();
            const gain = this.context.createGain();
            
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(440, this.context.currentTime);
            osc.frequency.exponentialRampToValueAtTime(110, this.context.currentTime + 0.3);
            
            gain.gain.setValueAtTime(0.4, this.context.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, this.context.currentTime + 0.3);
            
            osc.connect(gain);
            gain.connect(this.masterGain);
            
            osc.start(this.context.currentTime);
            osc.stop(this.context.currentTime + 0.3);
        } catch (e) {
            console.warn('Audio playback error', e);
        }
    }
    
    playLevelUp() {
        this.init();
        // Ascending arpeggio
        const notes = [523, 659, 784, 1047]; // C5, E5, G5, C6
        notes.forEach((freq, i) => {
            setTimeout(() => {
                this.playTone(freq, 0.15, 'sine');
            }, i * 100);
        });
    }
    
    playGameOver() {
        this.init();
        // Sad trombone effect
        if (!this.enabled || !this.initialized) return;
        
        try {
            const osc = this.context.createOscillator();
            const gain = this.context.createGain();
            
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(392, this.context.currentTime);
            osc.frequency.linearRampToValueAtTime(349, this.context.currentTime + 0.2);
            osc.frequency.linearRampToValueAtTime(311, this.context.currentTime + 0.4);
            osc.frequency.linearRampToValueAtTime(277, this.context.currentTime + 0.6);
            
            gain.gain.setValueAtTime(0.4, this.context.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, this.context.currentTime + 0.8);
            
            osc.connect(gain);
            gain.connect(this.masterGain);
            
            osc.start(this.context.currentTime);
            osc.stop(this.context.currentTime + 0.8);
        } catch (e) {
            console.warn('Audio playback error', e);
        }
    }
}
