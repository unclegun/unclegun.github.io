/**
 * SVG rendering engine for the garden
 * Stardew Valley-inspired aesthetic: warm colors, soft borders, cozy feel
 */

const TILE_SIZE = 32; // px per tile
const MARGIN = 16;

/**
 * Create the main garden SVG
 * @param {Object} manifest - the manifest data
 * @param {Object} allUserGardens - { userId: garden }
 * @param {string} currentUserId - current selected user
 * @param {Object} selected - { tileX, tileY, plantId }
 * @param {number} now - current timestamp
 * @returns {SVGElement}
 */
function renderGardenSVG(manifest, allUserGardens, currentUserId, selected, now) {
  const { width, height } = window.State.GARDEN_SIZE;
  const svgWidth = MARGIN + width * TILE_SIZE + MARGIN;
  const svgHeight = MARGIN + height * TILE_SIZE + MARGIN;

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${svgWidth} ${svgHeight}`);
  svg.setAttribute('width', svgWidth);
  svg.setAttribute('height', svgHeight);
  svg.setAttribute('class', 'garden-svg');

  // Background
  const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  bg.setAttribute('width', svgWidth);
  bg.setAttribute('height', svgHeight);
  bg.setAttribute('fill', '#3A5A40');
  bg.setAttribute('class', 'garden-bg');
  svg.appendChild(bg);

  // Draw tile grid background
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const tileX = MARGIN + x * TILE_SIZE;
      const tileY = MARGIN + y * TILE_SIZE;
      
      const tile = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      tile.setAttribute('x', tileX);
      tile.setAttribute('y', tileY);
      tile.setAttribute('width', TILE_SIZE);
      tile.setAttribute('height', TILE_SIZE);
      tile.setAttribute('fill', '#5A7A60');
      tile.setAttribute('class', 'garden-tile');
      tile.setAttribute('rx', '2');
      tile.setAttribute('data-x', x);
      tile.setAttribute('data-y', y);
      
      // Selected tile highlight
      if (selected && selected.tileX === x && selected.tileY === y) {
        tile.setAttribute('stroke', '#FFD700');
        tile.setAttribute('stroke-width', '2');
      }

      svg.appendChild(tile);
    }
  }

  // Draw plot borders
  manifest.plots.forEach(plotEntry => {
    const { userId, name, plot } = plotEntry;
    const x1 = MARGIN + plot.x * TILE_SIZE;
    const y1 = MARGIN + plot.y * TILE_SIZE;
    const x2 = x1 + plot.w * TILE_SIZE;
    const y2 = y1 + plot.h * TILE_SIZE;

    const border = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    border.setAttribute('x', x1);
    border.setAttribute('y', y1);
    border.setAttribute('width', plot.w * TILE_SIZE);
    border.setAttribute('height', plot.h * TILE_SIZE);
    border.setAttribute('fill', 'none');
    border.setAttribute('stroke', userId === currentUserId ? '#FFD700' : '#8B7355');
    border.setAttribute('stroke-width', userId === currentUserId ? '3' : '2');
    border.setAttribute('class', 'plot-border');
    border.setAttribute('data-user-id', userId);
    svg.appendChild(border);

    // User name label
    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('x', x1 + plot.w * TILE_SIZE / 2);
    label.setAttribute('y', y1 - 4);
    label.setAttribute('text-anchor', 'middle');
    label.setAttribute('fill', '#E8C89F');
    label.setAttribute('font-size', '12');
    label.setAttribute('font-family', 'Georgia, serif');
    label.setAttribute('class', 'plot-label');
    label.textContent = name;
    svg.appendChild(label);
  });

  // Draw plants
  for (const userId in allUserGardens) {
    const ug = allUserGardens[userId];
    ug.plants.forEach(plant => {
      const tileX = MARGIN + plant.x * TILE_SIZE;
      const tileY = MARGIN + plant.y * TILE_SIZE;

      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('data-plant-id', plant.id);
      g.setAttribute('data-user-id', userId);
      g.setAttribute('class', 'plant-group');

      const stage = window.State.deriveStage(plant, now);
      const isSelected = selected && selected.plantId === plant.id;

      // Render the plant based on archetype
      const archetype = window.Genes.ARCHETYPES[plant.genes.archetype];
      const renderer = PLANT_RENDERERS[archetype];
      
      if (renderer) {
        renderer(g, tileX, tileY, plant, stage, isSelected, now);
      }

      // Selection highlight
      if (isSelected) {
        const highlight = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        highlight.setAttribute('cx', tileX + TILE_SIZE / 2);
        highlight.setAttribute('cy', tileY + TILE_SIZE / 2);
        highlight.setAttribute('r', TILE_SIZE / 2 + 3);
        highlight.setAttribute('fill', 'none');
        highlight.setAttribute('stroke', '#FFD700');
        highlight.setAttribute('stroke-width', '2');
        highlight.setAttribute('class', 'plant-selection');
        g.appendChild(highlight);
      }

      svg.appendChild(g);
    });
  }

  return svg;
}

/**
 * Plant rendering functions by archetype
 * Each receives: (g, tileX, tileY, plant, stage, isSelected, now)
 */
const PLANT_RENDERERS = {
  flower: function(g, tileX, tileY, plant, stage, isSelected, now) {
    const cx = tileX + TILE_SIZE / 2;
    const cy = tileY + TILE_SIZE / 2;
    const colors = window.Genes.getPaletteColors(plant.genes);
    const baseRadius = 3 + stage * 2;

    // Stem
    const stem = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    stem.setAttribute('x1', cx);
    stem.setAttribute('y1', cy + TILE_SIZE / 2 - 2);
    stem.setAttribute('x2', cx);
    stem.setAttribute('y2', cy);
    stem.setAttribute('stroke', '#6B8E23');
    stem.setAttribute('stroke-width', '1.5');
    g.appendChild(stem);

    // Petals
    const petalCount = 5 + Math.floor(plant.watered / 2);
    for (let i = 0; i < petalCount; i++) {
      const angle = (i / petalCount) * Math.PI * 2;
      const px = cx + Math.cos(angle) * baseRadius * 1.5;
      const py = cy + Math.sin(angle) * baseRadius;

      const petal = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      petal.setAttribute('cx', px);
      petal.setAttribute('cy', py);
      petal.setAttribute('r', baseRadius);
      petal.setAttribute('fill', colors[stage % colors.length]);
      petal.setAttribute('opacity', '0.9');
      petal.setAttribute('class', 'plant-part sway');
      g.appendChild(petal);
    }

    // Center
    const center = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    center.setAttribute('cx', cx);
    center.setAttribute('cy', cy);
    center.setAttribute('r', baseRadius * 0.6);
    center.setAttribute('fill', colors[(stage + 1) % colors.length]);
    center.setAttribute('class', 'plant-part');
    g.appendChild(center);

    // Glow for rarity
    if (plant.genes.rarity >= 2) {
      const glow = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      glow.setAttribute('cx', cx);
      glow.setAttribute('cy', cy);
      glow.setAttribute('r', baseRadius * 2);
      glow.setAttribute('fill', 'none');
      glow.setAttribute('stroke', colors[0]);
      glow.setAttribute('stroke-width', '0.5');
      glow.setAttribute('opacity', '0.4');
      glow.setAttribute('class', 'plant-glow');
      g.appendChild(glow);
    }
  },

  fern: function(g, tileX, tileY, plant, stage, isSelected, now) {
    const cx = tileX + TILE_SIZE / 2;
    const cy = tileY + TILE_SIZE / 2;
    const colors = window.Genes.getPaletteColors(plant.genes);
    const height = 4 + stage * 2;

    // Stem
    const stem = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    stem.setAttribute('x1', cx);
    stem.setAttribute('y1', cy + TILE_SIZE / 2 - 2);
    stem.setAttribute('x2', cx);
    stem.setAttribute('y2', cy - height);
    stem.setAttribute('stroke', colors[0]);
    stem.setAttribute('stroke-width', '1');
    stem.setAttribute('class', 'plant-part sway');
    g.appendChild(stem);

    // Fronds
    for (let i = 0; i < 3 + stage; i++) {
      const offset = (i / (3 + stage)) * height;
      const angle = (Math.PI / 6) + (i % 2) * Math.PI / 3;
      const fx = cx + Math.cos(angle) * (3 + offset / 2);
      const fy = cy - height + offset;

      const frond = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      frond.setAttribute('cx', fx);
      frond.setAttribute('cy', fy);
      frond.setAttribute('r', '1.5');
      frond.setAttribute('fill', colors[0]);
      frond.setAttribute('opacity', '0.8');
      frond.setAttribute('class', 'plant-part sway');
      g.appendChild(frond);
    }
  },

  shrub: function(g, tileX, tileY, plant, stage, isSelected, now) {
    const cx = tileX + TILE_SIZE / 2;
    const cy = tileY + TILE_SIZE / 2;
    const colors = window.Genes.getPaletteColors(plant.genes);
    const size = 2 + stage * 1.5;

    // Layers of foliage
    for (let layer = 2; layer >= 0; layer--) {
      const r = size + layer;
      for (let i = 0; i < 4 + layer * 2; i++) {
        const angle = (i / (4 + layer * 2)) * Math.PI * 2;
        const x = cx + Math.cos(angle) * r * 1.2;
        const y = cy + Math.sin(angle) * r * 0.8;

        const leaf = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        leaf.setAttribute('cx', x);
        leaf.setAttribute('cy', y);
        leaf.setAttribute('r', size * 0.6);
        leaf.setAttribute('fill', colors[layer % colors.length]);
        leaf.setAttribute('opacity', '0.7');
        leaf.setAttribute('class', 'plant-part sway');
        g.appendChild(leaf);
      }
    }
  },

  cactus: function(g, tileX, tileY, plant, stage, isSelected, now) {
    const cx = tileX + TILE_SIZE / 2;
    const cy = tileY + TILE_SIZE / 2;
    const colors = window.Genes.getPaletteColors(plant.genes);
    const height = 3 + stage * 1.5;

    // Main body
    const body = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    body.setAttribute('x', cx - 2);
    body.setAttribute('y', cy - height);
    body.setAttribute('width', '4');
    body.setAttribute('height', height);
    body.setAttribute('fill', colors[0]);
    body.setAttribute('rx', '1');
    body.setAttribute('class', 'plant-part');
    g.appendChild(body);

    // Spines
    if (stage > 0) {
      for (let i = 0; i < stage * 2; i++) {
        const sideX = cx + (i % 2 === 0 ? -3 : 3);
        const sideY = cy - (i / 2);
        const spine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        spine.setAttribute('x1', cx + (i % 2 === 0 ? -2 : 2));
        spine.setAttribute('y1', sideY);
        spine.setAttribute('x2', sideX);
        spine.setAttribute('y2', sideY);
        spine.setAttribute('stroke', '#8B7355');
        spine.setAttribute('stroke-width', '0.5');
        spine.setAttribute('class', 'plant-part');
        g.appendChild(spine);
      }
    }
  },

  vine: function(g, tileX, tileY, plant, stage, isSelected, now) {
    const cx = tileX + TILE_SIZE / 2;
    const cy = tileY + TILE_SIZE / 2;
    const colors = window.Genes.getPaletteColors(plant.genes);

    // Curvy vine path
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    const d = `M ${cx},${cy + TILE_SIZE / 2} Q ${cx + 3},${cy + 2} ${cx + 4},${cy - 2}`;
    path.setAttribute('d', d);
    path.setAttribute('stroke', colors[0]);
    path.setAttribute('stroke-width', '1.5');
    path.setAttribute('fill', 'none');
    path.setAttribute('class', 'plant-part sway');
    g.appendChild(path);

    // Leaves
    for (let i = 0; i < 2 + stage; i++) {
      const leafX = cx + (i / (2 + stage)) * 4;
      const leafY = cy + 2 - (i / (2 + stage)) * 4;

      const leaf = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      leaf.setAttribute('cx', leafX);
      leaf.setAttribute('cy', leafY);
      leaf.setAttribute('r', '1.5');
      leaf.setAttribute('fill', colors[stage % colors.length]);
      leaf.setAttribute('opacity', '0.8');
      leaf.setAttribute('class', 'plant-part sway');
      g.appendChild(leaf);
    }
  },

  tree: function(g, tileX, tileY, plant, stage, isSelected, now) {
    const cx = tileX + TILE_SIZE / 2;
    const cy = tileY + TILE_SIZE / 2;
    const colors = window.Genes.getPaletteColors(plant.genes);
    const trunkHeight = 4 + stage;

    // Trunk
    const trunk = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    trunk.setAttribute('x', cx - 1);
    trunk.setAttribute('y', cy - trunkHeight);
    trunk.setAttribute('width', '2');
    trunk.setAttribute('height', trunkHeight);
    trunk.setAttribute('fill', '#8B6F47');
    trunk.setAttribute('class', 'plant-part');
    g.appendChild(trunk);

    // Canopy
    const canopySize = 4 + stage * 1.5;
    for (let i = 0; i < 2 + stage; i++) {
      const cHeight = canopySize - i;
      for (let j = 0; j < 3 + i; j++) {
        const angle = (j / (3 + i)) * Math.PI * 2;
        const x = cx + Math.cos(angle) * (cHeight / 2);
        const y = cy - trunkHeight - i;
        const leaf = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        leaf.setAttribute('cx', x);
        leaf.setAttribute('cy', y);
        leaf.setAttribute('r', '2');
        leaf.setAttribute('fill', colors[i % colors.length]);
        leaf.setAttribute('opacity', '0.8');
        leaf.setAttribute('class', 'plant-part sway');
        g.appendChild(leaf);
      }
    }
  },

  mushroom: function(g, tileX, tileY, plant, stage, isSelected, now) {
    const cx = tileX + TILE_SIZE / 2;
    const cy = tileY + TILE_SIZE / 2;
    const colors = window.Genes.getPaletteColors(plant.genes);

    // Stem
    const stem = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    stem.setAttribute('x1', cx);
    stem.setAttribute('y1', cy);
    stem.setAttribute('x2', cx);
    stem.setAttribute('y2', cy + TILE_SIZE / 3);
    stem.setAttribute('stroke', '#D4A574');
    stem.setAttribute('stroke-width', '1');
    stem.setAttribute('class', 'plant-part');
    g.appendChild(stem);

    // Cap
    const capSize = 2 + stage;
    const cap = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
    cap.setAttribute('cx', cx);
    cap.setAttribute('cy', cy - 1);
    cap.setAttribute('rx', capSize);
    cap.setAttribute('ry', capSize * 0.6);
    cap.setAttribute('fill', colors[0]);
    cap.setAttribute('class', 'plant-part');
    g.appendChild(cap);

    // Spots
    if (stage > 1) {
      for (let i = 0; i < stage; i++) {
        const spot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        spot.setAttribute('cx', cx - capSize + (i / stage) * capSize * 1.5);
        spot.setAttribute('cy', cy - 1);
        spot.setAttribute('r', '0.8');
        spot.setAttribute('fill', '#E8C89F');
        spot.setAttribute('class', 'plant-part');
        g.appendChild(spot);
      }
    }
  },

  lotus: function(g, tileX, tileY, plant, stage, isSelected, now) {
    const cx = tileX + TILE_SIZE / 2;
    const cy = tileY + TILE_SIZE / 2;
    const colors = window.Genes.getPaletteColors(plant.genes);

    // Petals
    const petalCount = 8 + stage * 2;
    const petalSize = 2 + stage;
    for (let i = 0; i < petalCount; i++) {
      const angle = (i / petalCount) * Math.PI * 2;
      const px = cx + Math.cos(angle) * petalSize * 1.8;
      const py = cy + Math.sin(angle) * petalSize * 1.5;

      const petal = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
      petal.setAttribute('cx', px);
      petal.setAttribute('cy', py);
      petal.setAttribute('rx', petalSize);
      petal.setAttribute('ry', petalSize * 1.5);
      petal.setAttribute('fill', colors[i % colors.length]);
      petal.setAttribute('opacity', '0.85');
      petal.setAttribute('class', 'plant-part sway');
      const rotation = (angle * 180) / Math.PI;
      petal.setAttribute('transform', `rotate(${rotation} ${px} ${py})`);
      g.appendChild(petal);
    }

    // Center
    const center = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    center.setAttribute('cx', cx);
    center.setAttribute('cy', cy);
    center.setAttribute('r', petalSize * 0.7);
    center.setAttribute('fill', colors[(petalCount % 1) % colors.length]);
    center.setAttribute('class', 'plant-part');
    g.appendChild(center);

    // Glow for rarity
    if (plant.genes.rarity >= 2) {
      const glow = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      glow.setAttribute('cx', cx);
      glow.setAttribute('cy', cy);
      glow.setAttribute('r', petalSize * 2.5);
      glow.setAttribute('fill', 'none');
      glow.setAttribute('stroke', colors[0]);
      glow.setAttribute('stroke-width', '0.5');
      glow.setAttribute('opacity', '0.3');
      glow.setAttribute('class', 'plant-glow pulse');
      g.appendChild(glow);
    }
  }
};

// Export
window.Render = {
  TILE_SIZE,
  MARGIN,
  renderGardenSVG
};
