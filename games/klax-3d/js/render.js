/**
 * render.js - Three.js rendering for Klax 3D
 * Handles scene, camera, lights, and visual updates
 */

import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { getColorRGBA, WELL_COLS, WELL_ROWS, CONVEYOR_LENGTH } from './game.js';

const TILE_SIZE = 0.9;
const TILE_GAP = 0.1;
const CONVEYOR_WIDTH = WELL_COLS;
const WELL_DEPTH = WELL_ROWS;

export class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.setupRenderer();
        this.setupScene();
        this.setupCamera();
        this.setupLights();
        this.setupGeometry();
        this.setupParticles();
        
        // Animation state
        this.catcherTargetX = 0;
        this.catcherCurrentX = 0;
        
        // Handle resize
        window.addEventListener('resize', () => this.onResize());
        this.onResize();
    }
    
    setupRenderer() {
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: true,
            alpha: false
        });
        this.renderer.setClearColor(0x0a1628, 1.0);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }
    
    setupScene() {
        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.Fog(0x0a1628, 15, 30);
    }
    
    setupCamera() {
        const aspect = this.canvas.clientWidth / this.canvas.clientHeight;
        this.camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 100);
        this.camera.position.set(0, 8, 12);
        this.camera.lookAt(0, 0, 0);
    }
    
    setupLights() {
        // Ambient light
        const ambient = new THREE.AmbientLight(0x404060, 0.6);
        this.scene.add(ambient);
        
        // Directional light (sun)
        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(5, 10, 7);
        dirLight.castShadow = true;
        dirLight.shadow.camera.left = -10;
        dirLight.shadow.camera.right = 10;
        dirLight.shadow.camera.top = 10;
        dirLight.shadow.camera.bottom = -10;
        dirLight.shadow.mapSize.width = 2048;
        dirLight.shadow.mapSize.height = 2048;
        this.scene.add(dirLight);
        
        // Fill light
        const fillLight = new THREE.DirectionalLight(0x8080ff, 0.3);
        fillLight.position.set(-5, 3, -5);
        this.scene.add(fillLight);
    }
    
    setupGeometry() {
        // Tile geometry (beveled box)
        this.tileGeometry = new THREE.BoxGeometry(TILE_SIZE, TILE_SIZE, TILE_SIZE, 2, 2, 2);
        
        // Tile material (will be instanced)
        this.tileMaterial = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            metalness: 0.3,
            roughness: 0.4,
            emissive: 0x000000,
            emissiveIntensity: 0.2
        });
        
        // Conveyor
        this.createConveyor();
        
        // Well base
        this.createWellBase();
        
        // Catcher
        this.createCatcher();
        
        // Instanced meshes for tiles
        this.setupInstancedMeshes();
    }
    
    createConveyor() {
        const conveyorGroup = new THREE.Group();
        
        // Main conveyor plane
        const geometry = new THREE.PlaneGeometry(CONVEYOR_WIDTH, CONVEYOR_LENGTH);
        const material = new THREE.MeshStandardMaterial({
            color: 0x1a2a4a,
            metalness: 0.5,
            roughness: 0.7
        });
        const plane = new THREE.Mesh(geometry, material);
        plane.rotation.x = -Math.PI / 2;
        plane.position.y = 0.5;
        plane.position.z = -CONVEYOR_LENGTH / 2;
        plane.receiveShadow = true;
        conveyorGroup.add(plane);
        
        // Side rails
        const railGeometry = new THREE.BoxGeometry(0.2, 0.3, CONVEYOR_LENGTH);
        const railMaterial = new THREE.MeshStandardMaterial({
            color: 0x2a3a5a,
            metalness: 0.6,
            roughness: 0.4
        });
        
        const leftRail = new THREE.Mesh(railGeometry, railMaterial);
        leftRail.position.set(-CONVEYOR_WIDTH / 2 - 0.1, 0.65, -CONVEYOR_LENGTH / 2);
        leftRail.castShadow = true;
        conveyorGroup.add(leftRail);
        
        const rightRail = new THREE.Mesh(railGeometry, railMaterial);
        rightRail.position.set(CONVEYOR_WIDTH / 2 + 0.1, 0.65, -CONVEYOR_LENGTH / 2);
        rightRail.castShadow = true;
        conveyorGroup.add(rightRail);
        
        this.scene.add(conveyorGroup);
    }
    
    createWellBase() {
        const wellGroup = new THREE.Group();
        
        // Base platform
        const baseGeometry = new THREE.BoxGeometry(WELL_COLS + 0.4, 0.2, WELL_ROWS + 0.4);
        const baseMaterial = new THREE.MeshStandardMaterial({
            color: 0x0f1f3f,
            metalness: 0.4,
            roughness: 0.6
        });
        const base = new THREE.Mesh(baseGeometry, baseMaterial);
        base.position.set(0, -0.1, 2.5);
        base.receiveShadow = true;
        wellGroup.add(base);
        
        // Grid lines
        const lineMaterial = new THREE.LineBasicMaterial({ color: 0x304060 });
        
        // Vertical lines
        for (let i = 0; i <= WELL_COLS; i++) {
            const points = [];
            const x = i - WELL_COLS / 2;
            points.push(new THREE.Vector3(x, 0.01, 0));
            points.push(new THREE.Vector3(x, 0.01, WELL_ROWS));
            const geometry = new THREE.BufferGeometry().setFromPoints(points);
            const line = new THREE.Line(geometry, lineMaterial);
            wellGroup.add(line);
        }
        
        // Horizontal lines
        for (let i = 0; i <= WELL_ROWS; i++) {
            const points = [];
            const z = i;
            points.push(new THREE.Vector3(-WELL_COLS / 2, 0.01, z));
            points.push(new THREE.Vector3(WELL_COLS / 2, 0.01, z));
            const geometry = new THREE.BufferGeometry().setFromPoints(points);
            const line = new THREE.Line(geometry, lineMaterial);
            wellGroup.add(line);
        }
        
        this.scene.add(wellGroup);
    }
    
    createCatcher() {
        // Catcher (paddle)
        const catcherGeometry = new THREE.BoxGeometry(TILE_SIZE, 0.2, 0.8);
        const catcherMaterial = new THREE.MeshStandardMaterial({
            color: 0x4080ff,
            metalness: 0.7,
            roughness: 0.3,
            emissive: 0x2040aa,
            emissiveIntensity: 0.3
        });
        this.catcher = new THREE.Mesh(catcherGeometry, catcherMaterial);
        this.catcher.position.set(0, 0.6, 0);
        this.catcher.castShadow = true;
        this.scene.add(this.catcher);
    }
    
    setupInstancedMeshes() {
        const maxConveyorTiles = 20;
        const maxWellTiles = WELL_COLS * WELL_ROWS;
        const maxRackTiles = 5;
        
        // Conveyor tiles
        this.conveyorInstancedMesh = new THREE.InstancedMesh(
            this.tileGeometry,
            this.tileMaterial,
            maxConveyorTiles
        );
        this.conveyorInstancedMesh.castShadow = true;
        this.conveyorInstancedMesh.receiveShadow = true;
        this.scene.add(this.conveyorInstancedMesh);
        
        // Well tiles
        this.wellInstancedMesh = new THREE.InstancedMesh(
            this.tileGeometry,
            this.tileMaterial,
            maxWellTiles
        );
        this.wellInstancedMesh.castShadow = true;
        this.wellInstancedMesh.receiveShadow = true;
        this.scene.add(this.wellInstancedMesh);
        
        // Initialize with invisible matrices
        const dummyMatrix = new THREE.Matrix4();
        dummyMatrix.makeScale(0, 0, 0);
        for (let i = 0; i < maxConveyorTiles; i++) {
            this.conveyorInstancedMesh.setMatrixAt(i, dummyMatrix);
            this.conveyorInstancedMesh.setColorAt(i, new THREE.Color(1, 1, 1));
        }
        for (let i = 0; i < maxWellTiles; i++) {
            this.wellInstancedMesh.setMatrixAt(i, dummyMatrix);
            this.wellInstancedMesh.setColorAt(i, new THREE.Color(1, 1, 1));
        }
        this.conveyorInstancedMesh.instanceMatrix.needsUpdate = true;
        this.wellInstancedMesh.instanceMatrix.needsUpdate = true;
    }
    
    setupParticles() {
        // Particle system for match effects
        const particleGeometry = new THREE.BufferGeometry();
        const particleCount = 100;
        const positions = new Float32Array(particleCount * 3);
        const colors = new Float32Array(particleCount * 3);
        const sizes = new Float32Array(particleCount);
        
        for (let i = 0; i < particleCount; i++) {
            positions[i * 3] = 0;
            positions[i * 3 + 1] = 0;
            positions[i * 3 + 2] = 0;
            colors[i * 3] = 1;
            colors[i * 3 + 1] = 1;
            colors[i * 3 + 2] = 1;
            sizes[i] = 0;
        }
        
        particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        particleGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        particleGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
        
        const particleMaterial = new THREE.PointsMaterial({
            size: 0.2,
            vertexColors: true,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending
        });
        
        this.particles = new THREE.Points(particleGeometry, particleMaterial);
        this.scene.add(this.particles);
        
        this.activeParticles = [];
    }
    
    updateFromState(state, events) {
        // Update catcher position
        this.catcherTargetX = (state.catcherColumn - WELL_COLS / 2 + 0.5);
        this.catcherCurrentX += (this.catcherTargetX - this.catcherCurrentX) * 0.3;
        this.catcher.position.x = this.catcherCurrentX;
        
        // Update conveyor tiles
        this.updateConveyorTiles(state.conveyorTiles);
        
        // Update well tiles
        this.updateWellTiles(state.well);
        
        // Handle events for particles
        events.forEach(event => {
            if (event.type === 'match') {
                this.spawnMatchParticles(event.matches);
            }
        });
        
        // Update particles
        this.updateParticles();
    }
    
    updateConveyorTiles(conveyorTiles) {
        const matrix = new THREE.Matrix4();
        const color = new THREE.Color();
        
        conveyorTiles.forEach((tile, index) => {
            const x = tile.column - WELL_COLS / 2 + 0.5;
            const z = -tile.position;
            const y = 1;
            
            matrix.makeTranslation(x, y, z);
            this.conveyorInstancedMesh.setMatrixAt(index, matrix);
            
            const rgba = getColorRGBA(tile.colorIndex);
            color.setRGB(rgba[0], rgba[1], rgba[2]);
            this.conveyorInstancedMesh.setColorAt(index, color);
        });
        
        // Hide unused instances
        const invisibleMatrix = new THREE.Matrix4();
        invisibleMatrix.makeScale(0, 0, 0);
        for (let i = conveyorTiles.length; i < 20; i++) {
            this.conveyorInstancedMesh.setMatrixAt(i, invisibleMatrix);
        }
        
        this.conveyorInstancedMesh.instanceMatrix.needsUpdate = true;
        if (this.conveyorInstancedMesh.instanceColor) {
            this.conveyorInstancedMesh.instanceColor.needsUpdate = true;
        }
    }
    
    updateWellTiles(well) {
        const matrix = new THREE.Matrix4();
        const color = new THREE.Color();
        let instanceIndex = 0;
        
        for (let col = 0; col < WELL_COLS; col++) {
            for (let row = 0; row < WELL_ROWS; row++) {
                const colorIndex = well[col][row];
                if (colorIndex !== null) {
                    const x = col - WELL_COLS / 2 + 0.5;
                    const z = row + 0.5;
                    const y = 0.5;
                    
                    matrix.makeTranslation(x, y, z);
                    this.wellInstancedMesh.setMatrixAt(instanceIndex, matrix);
                    
                    const rgba = getColorRGBA(colorIndex);
                    color.setRGB(rgba[0], rgba[1], rgba[2]);
                    this.wellInstancedMesh.setColorAt(instanceIndex, color);
                    
                    instanceIndex++;
                }
            }
        }
        
        // Hide unused instances
        const invisibleMatrix = new THREE.Matrix4();
        invisibleMatrix.makeScale(0, 0, 0);
        for (let i = instanceIndex; i < WELL_COLS * WELL_ROWS; i++) {
            this.wellInstancedMesh.setMatrixAt(i, invisibleMatrix);
        }
        
        this.wellInstancedMesh.instanceMatrix.needsUpdate = true;
        if (this.wellInstancedMesh.instanceColor) {
            this.wellInstancedMesh.instanceColor.needsUpdate = true;
        }
    }
    
    spawnMatchParticles(matches) {
        matches.forEach(match => {
            if (match.type === 'rack') return; // Skip rack matches for now
            
            match.tiles.forEach(([col, row]) => {
                const x = col - WELL_COLS / 2 + 0.5;
                const z = row + 0.5;
                const y = 0.5;
                
                // Spawn multiple particles
                for (let i = 0; i < 5; i++) {
                    const rgba = getColorRGBA(match.colorIndex);
                    this.activeParticles.push({
                        x: x,
                        y: y,
                        z: z,
                        vx: (Math.random() - 0.5) * 0.1,
                        vy: Math.random() * 0.15 + 0.05,
                        vz: (Math.random() - 0.5) * 0.1,
                        color: { r: rgba[0], g: rgba[1], b: rgba[2] },
                        life: 1.0,
                        size: 0.15
                    });
                }
            });
        });
    }
    
    updateParticles() {
        const positions = this.particles.geometry.attributes.position.array;
        const colors = this.particles.geometry.attributes.color.array;
        const sizes = this.particles.geometry.attributes.size.array;
        
        // Update active particles
        for (let i = this.activeParticles.length - 1; i >= 0; i--) {
            const p = this.activeParticles[i];
            
            p.x += p.vx;
            p.y += p.vy;
            p.z += p.vz;
            p.vy -= 0.005; // Gravity
            p.life -= 0.02;
            
            if (p.life <= 0 || i >= 100) {
                this.activeParticles.splice(i, 1);
            }
        }
        
        // Update geometry
        for (let i = 0; i < 100; i++) {
            if (i < this.activeParticles.length) {
                const p = this.activeParticles[i];
                positions[i * 3] = p.x;
                positions[i * 3 + 1] = p.y;
                positions[i * 3 + 2] = p.z;
                colors[i * 3] = p.color.r;
                colors[i * 3 + 1] = p.color.g;
                colors[i * 3 + 2] = p.color.b;
                sizes[i] = p.size * p.life;
            } else {
                sizes[i] = 0;
            }
        }
        
        this.particles.geometry.attributes.position.needsUpdate = true;
        this.particles.geometry.attributes.color.needsUpdate = true;
        this.particles.geometry.attributes.size.needsUpdate = true;
    }
    
    render() {
        this.renderer.render(this.scene, this.camera);
    }
    
    onResize() {
        const width = this.canvas.clientWidth;
        const height = this.canvas.clientHeight;
        
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        
        this.renderer.setSize(width, height, false);
    }
    
    dispose() {
        this.renderer.dispose();
        this.tileGeometry.dispose();
        this.tileMaterial.dispose();
    }
}
