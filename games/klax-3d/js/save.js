/**
 * save.js - localStorage persistence with version migration
 */

const SAVE_KEY = 'klax3d:v1';
const CURRENT_VERSION = 1;

const DEFAULT_SAVE = {
    version: CURRENT_VERSION,
    highScore: 0,
    bestLevel: 1,
    settings: {
        soundEnabled: true,
        reducedMotion: false
    },
    lastPlayed: null,
    stats: {
        gamesPlayed: 0,
        totalMatches: 0
    }
};

export class SaveSystem {
    constructor() {
        this.data = this.load();
    }
    
    load() {
        try {
            const saved = localStorage.getItem(SAVE_KEY);
            if (!saved) {
                return { ...DEFAULT_SAVE };
            }
            
            const data = JSON.parse(saved);
            
            // Version migration
            return this.migrate(data);
        } catch (e) {
            console.warn('Failed to load save data', e);
            return { ...DEFAULT_SAVE };
        }
    }
    
    migrate(data) {
        // Migrate from older versions if needed
        if (data.version < CURRENT_VERSION) {
            console.log(`Migrating save data from v${data.version} to v${CURRENT_VERSION}`);
            
            // Perform migrations as needed
            // For now, we only have v1, so no migrations needed
            data.version = CURRENT_VERSION;
        }
        
        // Ensure all fields exist (in case of partial data)
        return {
            ...DEFAULT_SAVE,
            ...data,
            settings: {
                ...DEFAULT_SAVE.settings,
                ...(data.settings || {})
            },
            stats: {
                ...DEFAULT_SAVE.stats,
                ...(data.stats || {})
            }
        };
    }
    
    save() {
        try {
            const json = JSON.stringify(this.data);
            localStorage.setItem(SAVE_KEY, json);
        } catch (e) {
            console.warn('Failed to save data', e);
        }
    }
    
    // High score management
    getHighScore() {
        return this.data.highScore;
    }
    
    updateHighScore(score, level) {
        let isNewHighScore = false;
        
        if (score > this.data.highScore) {
            this.data.highScore = score;
            isNewHighScore = true;
        }
        
        if (level > this.data.bestLevel) {
            this.data.bestLevel = level;
        }
        
        this.data.lastPlayed = Date.now();
        this.data.stats.gamesPlayed++;
        
        this.save();
        
        return isNewHighScore;
    }
    
    getBestLevel() {
        return this.data.bestLevel;
    }
    
    // Settings
    getSetting(key) {
        return this.data.settings[key];
    }
    
    setSetting(key, value) {
        this.data.settings[key] = value;
        this.save();
    }
    
    // Stats
    incrementMatches() {
        this.data.stats.totalMatches++;
        this.save();
    }
    
    getStats() {
        return { ...this.data.stats };
    }
    
    // Reset
    reset() {
        this.data = { ...DEFAULT_SAVE };
        this.save();
    }
    
    // Export/Import for debugging
    export() {
        return JSON.stringify(this.data, null, 2);
    }
    
    import(jsonString) {
        try {
            const data = JSON.parse(jsonString);
            this.data = this.migrate(data);
            this.save();
            return true;
        } catch (e) {
            console.error('Failed to import save data', e);
            return false;
        }
    }
}
