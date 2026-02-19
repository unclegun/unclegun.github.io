/**
 * game.js - Pure game logic for Klax 3D
 * Renderer-agnostic state machine and game rules
 */

// Game constants
const WELL_COLS = 5;
const WELL_ROWS = 5;
const RACK_CAPACITY = 5;
const CONVEYOR_LENGTH = 10; // Positions along conveyor
const INITIAL_LIVES = 3;
const LEVEL_UP_THRESHOLD = 1000; // Points per level
const BASE_SPAWN_INTERVAL = 120; // Frames (60fps = 2 seconds)
const MIN_SPAWN_INTERVAL = 30; // Fastest spawn
const BASE_TILE_SPEED = 0.15; // Conveyor units per frame
const MAX_TILE_SPEED = 0.4;

// Event types
export const EVENTS = {
    CATCH: 'catch',
    DROP: 'drop',
    MATCH: 'match',
    LIFE_LOST: 'lifeLost',
    LEVEL_UP: 'levelUp',
    GAME_OVER: 'gameOver',
    TILE_SPAWN: 'tileSpawn',
    TILE_FALL: 'tileFall'
};

// Tile colors (RGBA for rendering)
const COLORS = [
    [1.0, 0.2, 0.2, 1.0], // Red
    [0.2, 0.5, 1.0, 1.0], // Blue
    [0.2, 1.0, 0.3, 1.0], // Green
    [1.0, 0.9, 0.2, 1.0], // Yellow
    [1.0, 0.5, 0.2, 1.0], // Orange
    [0.8, 0.2, 1.0, 1.0], // Purple
];

// Simple seeded RNG for reproducibility
class SeededRNG {
    constructor(seed = 42) {
        this.seed = seed;
    }
    
    next() {
        this.seed = (this.seed * 9301 + 49297) % 233280;
        return this.seed / 233280;
    }
    
    nextInt(min, max) {
        return Math.floor(this.next() * (max - min + 1)) + min;
    }
}

export class Game {
    constructor(seed = Date.now()) {
        this.rng = new SeededRNG(seed);
        this.reset();
    }
    
    reset() {
        // Game state
        this.score = 0;
        this.level = 1;
        this.lives = INITIAL_LIVES;
        this.paused = false;
        this.gameOver = false;
        
        // Conveyor tiles: { id, position (0=far, 9.99=near), colorIndex, column }
        this.conveyorTiles = [];
        this.nextTileId = 0;
        this.spawnTimer = 0;
        
        // Catcher position (0-4)
        this.catcherColumn = 2;
        
        // Rack: array of colorIndex (front to back, max 5)
        this.rack = [];
        
        // Well: 5x5 grid [col][row] = colorIndex or null
        this.well = Array(WELL_COLS).fill(null).map(() => Array(WELL_ROWS).fill(null));
        
        // Events queue
        this.events = [];
        
        // Timing
        this.frameCount = 0;
    }
    
    // Game loop update (called at fixed 60fps)
    update() {
        if (this.paused || this.gameOver) {
            return;
        }
        
        this.frameCount++;
        this.events = [];
        
        // Spawn new tiles
        this.updateSpawning();
        
        // Move conveyor tiles
        this.updateConveyor();
        
        // Check for matches and resolve
        this.checkMatches();
    }
    
    updateSpawning() {
        this.spawnTimer++;
        
        const spawnInterval = this.getSpawnInterval();
        if (this.spawnTimer >= spawnInterval) {
            this.spawnTimer = 0;
            this.spawnTile();
        }
    }
    
    spawnTile() {
        const numColors = this.getNumColors();
        const colorIndex = this.rng.nextInt(0, numColors - 1);
        const column = this.rng.nextInt(0, WELL_COLS - 1);
        
        const tile = {
            id: this.nextTileId++,
            position: 0, // Far end
            colorIndex,
            column
        };
        
        this.conveyorTiles.push(tile);
        this.events.push({ type: EVENTS.TILE_SPAWN, tile });
    }
    
    updateConveyor() {
        const speed = this.getTileSpeed();
        
        for (let i = this.conveyorTiles.length - 1; i >= 0; i--) {
            const tile = this.conveyorTiles[i];
            tile.position += speed;
            
            // Check if tile reached the end
            if (tile.position >= CONVEYOR_LENGTH) {
                this.conveyorTiles.splice(i, 1);
                this.handleTileReachedEnd(tile);
            }
        }
    }
    
    handleTileReachedEnd(tile) {
        // Check if catcher is aligned with tile column
        if (tile.column === this.catcherColumn) {
            // Attempt to catch
            if (this.rack.length < RACK_CAPACITY) {
                this.rack.push(tile.colorIndex);
                this.events.push({ type: EVENTS.CATCH, colorIndex: tile.colorIndex });
                
                // Check for rack matches
                this.checkRackMatches();
            } else {
                // Rack overflow - lose life
                this.loseLife('Rack overflow');
            }
        } else {
            // Tile falls into well at its column
            this.dropTileIntoWell(tile.column, tile.colorIndex);
            this.events.push({ type: EVENTS.TILE_FALL, column: tile.column, colorIndex: tile.colorIndex });
        }
    }
    
    dropTileIntoWell(col, colorIndex) {
        // Find lowest empty row in this column
        for (let row = WELL_ROWS - 1; row >= 0; row--) {
            if (this.well[col][row] === null) {
                this.well[col][row] = colorIndex;
                return;
            }
        }
        
        // Column is full - lose life
        this.loseLife('Well column full');
    }
    
    // Player actions
    moveLeft() {
        if (!this.paused && !this.gameOver && this.catcherColumn > 0) {
            this.catcherColumn--;
            return true;
        }
        return false;
    }
    
    moveRight() {
        if (!this.paused && !this.gameOver && this.catcherColumn < WELL_COLS - 1) {
            this.catcherColumn++;
            return true;
        }
        return false;
    }
    
    dropFromRack() {
        if (!this.paused && !this.gameOver && this.rack.length > 0) {
            const colorIndex = this.rack.shift(); // Remove from front
            this.dropTileIntoWell(this.catcherColumn, colorIndex);
            this.events.push({ type: EVENTS.DROP, column: this.catcherColumn, colorIndex });
            return true;
        }
        return false;
    }
    
    // Match detection and resolution
    checkMatches() {
        const matches = this.findMatches();
        
        if (matches.length > 0) {
            // Remove matched tiles
            const removed = new Set();
            matches.forEach(match => {
                match.tiles.forEach(([col, row]) => {
                    removed.add(`${col},${row}`);
                    this.well[col][row] = null;
                });
            });
            
            // Score based on match size
            let points = 0;
            matches.forEach(match => {
                const size = match.tiles.length;
                if (size === 3) points += 100;
                else if (size === 4) points += 300;
                else if (size >= 5) points += 600;
            });
            
            this.score += points;
            this.events.push({ type: EVENTS.MATCH, matches, points });
            
            // Apply gravity
            this.applyGravity();
            
            // Check for level up
            this.checkLevelUp();
        }
    }
    
    findMatches() {
        const matches = [];
        const visited = new Set();
        
        // Check horizontal
        for (let row = 0; row < WELL_ROWS; row++) {
            for (let col = 0; col <= WELL_COLS - 3; col++) {
                const color = this.well[col][row];
                if (color === null) continue;
                
                let length = 1;
                while (col + length < WELL_COLS && this.well[col + length][row] === color) {
                    length++;
                }
                
                if (length >= 3) {
                    const tiles = [];
                    for (let i = 0; i < length; i++) {
                        tiles.push([col + i, row]);
                    }
                    matches.push({ type: 'horizontal', tiles, colorIndex: color });
                    col += length - 1;
                }
            }
        }
        
        // Check vertical
        for (let col = 0; col < WELL_COLS; col++) {
            for (let row = 0; row <= WELL_ROWS - 3; row++) {
                const color = this.well[col][row];
                if (color === null) continue;
                
                let length = 1;
                while (row + length < WELL_ROWS && this.well[col][row + length] === color) {
                    length++;
                }
                
                if (length >= 3) {
                    const tiles = [];
                    for (let i = 0; i < length; i++) {
                        tiles.push([col, row + i]);
                    }
                    matches.push({ type: 'vertical', tiles, colorIndex: color });
                    row += length - 1;
                }
            }
        }
        
        // Check diagonals (down-right)
        for (let col = 0; col <= WELL_COLS - 3; col++) {
            for (let row = 0; row <= WELL_ROWS - 3; row++) {
                const color = this.well[col][row];
                if (color === null) continue;
                
                let length = 1;
                while (col + length < WELL_COLS && row + length < WELL_ROWS &&
                       this.well[col + length][row + length] === color) {
                    length++;
                }
                
                if (length >= 3) {
                    const tiles = [];
                    for (let i = 0; i < length; i++) {
                        tiles.push([col + i, row + i]);
                    }
                    matches.push({ type: 'diagonal-dr', tiles, colorIndex: color });
                }
            }
        }
        
        // Check diagonals (down-left)
        for (let col = 2; col < WELL_COLS; col++) {
            for (let row = 0; row <= WELL_ROWS - 3; row++) {
                const color = this.well[col][row];
                if (color === null) continue;
                
                let length = 1;
                while (col - length >= 0 && row + length < WELL_ROWS &&
                       this.well[col - length][row + length] === color) {
                    length++;
                }
                
                if (length >= 3) {
                    const tiles = [];
                    for (let i = 0; i < length; i++) {
                        tiles.push([col - i, row + i]);
                    }
                    matches.push({ type: 'diagonal-dl', tiles, colorIndex: color });
                }
            }
        }
        
        return matches;
    }
    
    checkRackMatches() {
        // Check for 3+ consecutive same colors in rack
        if (this.rack.length < 3) return;
        
        for (let start = 0; start <= this.rack.length - 3; start++) {
            const color = this.rack[start];
            let length = 1;
            
            while (start + length < this.rack.length && this.rack[start + length] === color) {
                length++;
            }
            
            if (length >= 3) {
                // Remove matched tiles from rack
                const matched = this.rack.splice(start, length);
                
                // Score
                let points = 0;
                if (length === 3) points = 100;
                else if (length === 4) points = 300;
                else if (length >= 5) points = 600;
                
                this.score += points;
                this.events.push({ 
                    type: EVENTS.MATCH, 
                    matches: [{ type: 'rack', tiles: matched, colorIndex: color }], 
                    points 
                });
                
                this.checkLevelUp();
                
                // Check again for more matches (recursive)
                this.checkRackMatches();
                return;
            }
        }
    }
    
    applyGravity() {
        // For each column, compact tiles downward
        for (let col = 0; col < WELL_COLS; col++) {
            const compacted = [];
            for (let row = WELL_ROWS - 1; row >= 0; row--) {
                if (this.well[col][row] !== null) {
                    compacted.push(this.well[col][row]);
                }
            }
            
            // Rebuild column
            for (let row = 0; row < WELL_ROWS; row++) {
                const index = WELL_ROWS - 1 - row;
                this.well[col][row] = index < compacted.length ? compacted[index] : null;
            }
        }
    }
    
    checkLevelUp() {
        const newLevel = Math.floor(this.score / LEVEL_UP_THRESHOLD) + 1;
        if (newLevel > this.level) {
            this.level = newLevel;
            this.events.push({ type: EVENTS.LEVEL_UP, level: this.level });
        }
    }
    
    loseLife(reason) {
        this.lives--;
        this.events.push({ type: EVENTS.LIFE_LOST, lives: this.lives, reason });
        
        if (this.lives <= 0) {
            this.gameOver = true;
            this.events.push({ type: EVENTS.GAME_OVER, score: this.score, level: this.level });
        }
    }
    
    // Difficulty scaling
    getSpawnInterval() {
        const interval = BASE_SPAWN_INTERVAL - (this.level - 1) * 8;
        return Math.max(interval, MIN_SPAWN_INTERVAL);
    }
    
    getTileSpeed() {
        const speed = BASE_TILE_SPEED + (this.level - 1) * 0.02;
        return Math.min(speed, MAX_TILE_SPEED);
    }
    
    getNumColors() {
        // Start with 3 colors, gradually unlock more
        return Math.min(3 + Math.floor(this.level / 3), COLORS.length);
    }
    
    // Getters
    getState() {
        return {
            score: this.score,
            level: this.level,
            lives: this.lives,
            paused: this.paused,
            gameOver: this.gameOver,
            conveyorTiles: [...this.conveyorTiles],
            catcherColumn: this.catcherColumn,
            rack: [...this.rack],
            well: this.well.map(col => [...col]),
            frameCount: this.frameCount
        };
    }
    
    getEvents() {
        return [...this.events];
    }
    
    togglePause() {
        if (!this.gameOver) {
            this.paused = !this.paused;
        }
    }
}

// Export color palette
export function getColorRGBA(colorIndex) {
    return COLORS[colorIndex] || [1, 1, 1, 1];
}

export { COLORS, WELL_COLS, WELL_ROWS, RACK_CAPACITY, CONVEYOR_LENGTH };
