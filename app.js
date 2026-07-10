/**
 * app.js
 * ---------------------------------------------------------------------
 * The full drawing engine. No frameworks — two stacked <canvas> layers,
 * a plain-JS shape list, and a coordinate system that supports an
 * infinite, pannable, zoomable grid (matching how the real product's
 * "local sketch" mode works: no fixed page, you scroll/zoom around an
 * unbounded plane).
 *
 * COORDINATE SYSTEM
 * ------------------
 * Every shape is stored in WORLD space — plain numbers with no notion
 * of the current pan/zoom. `state.zoom` and `state.panX/panY` describe
 * how world space maps onto the screen:
 *
 *      screenX = worldX * zoom + panX
 *      screenY = worldY * zoom + panY
 *
 * `worldToScreen()` / `screenToWorld()` are the only two places that
 * formula (and its inverse) appear — every tool funnels through them,
 * so panning/zooming "just works" for drawing, snapping, and hit
 * testing without each tool having to think about the camera.
 *
 * SHAPE MODEL
 * -----------
 * state.shapes is an array of plain objects. Every shape has an `id`,
 * a `type`, a `style` ({stroke, strokeWidth, fill, fillEnabled}), and
 * an optional `rotation` (radians, applied around the shape's bounding
 * box center at draw time). Types:
 *   - pencil / line : { points: [{x,y}, ...], closed? }  (a line is
 *                      just a pencil stroke that the user built by
 *                      clicking point-by-point instead of dragging)
 *   - rect / circle  : { x1,y1,x2,y2 } (opposite drag corners)
 *   - curve          : { x1,y1,x2,y2,cx,cy } (quadratic Bezier)
 *   - text           : { x,y,text,fontSize,fontFamily,outline }
 *   - group          : { children:[...shape objects] }
 * Because the canvas is always just a rendering of this array, undo/
 * redo, SVG export, and localStorage autosave are all "serialize this
 * array" problems rather than "reverse-engineer the pixels" problems.
 */

(function () {
  'use strict';

  const cfg = window.APP_CONFIG || {};
  const STORAGE_KEY = 'vgp_clone_local_sketch_v1';

  // =====================================================================
  // 1. STATE
  // =====================================================================
  const state = {
    tool: 'select',
    strokeColor: '#1e293b',
    fillColor: '#93c5fd',
    fillEnabled: false,
    strokeWidth: 2,
    fontFamily: 'sans-serif',
    fontSize: 18,
    textOutline: false,

    gridVisible: true,
    snapEnabled: true,
    gridType: cfg.gridType || 'square', // square | dots | isometric
    gridSize: cfg.gridSize || 20,
    gridColor: cfg.gridColor || '#B9C4D0',
    majorEvery: cfg.majorEvery || 5,
    majorColor: cfg.majorColor || '#8FA0B3',

    zoom: 1,
    panX: 0,
    panY: 0,
    viewInitialized: false,

    shapes: [],
    selectedIds: [],
    nextId: 1,

    // Transient interaction state
    drawing: false,
    draftShape: null,
    panning: false,
    panStart: null,
    panOrigin: null,
    spaceDown: false,

    // Select-tool drag state
    dragMode: null,        // 'move' | 'scale' | 'rotate' | null
    dragHandle: null,      // which corner, for scale
    dragOrigins: null,     // deep-cloned shapes at drag start
    dragCenter: null,      // world-space center used for scale/rotate math
    dragStartWorld: null,
    dragStartAngle: null,
    marquee: null,         // {x1,y1,x2,y2} in screen space, while marquee-selecting

    // Line/polygon tool state
    polyActive: false,
    polyPoints: [],
    polyPreview: null,

    // Curve tool state
    curveStep: 0,
    curveDraft: null,
    curvePreview: null,

    undoStack: [],
    redoStack: [],
  };

  // =====================================================================
  // 2. DOM REFERENCES
  // =====================================================================
  const gridCanvas = document.getElementById('gridLayer');
  const drawCanvas = document.getElementById('drawLayer');
  const gctx = gridCanvas.getContext('2d');
  const dctx = drawCanvas.getContext('2d');
  const mainEl = document.querySelector('main');
  const textInput = document.getElementById('textInput');

  // =====================================================================
  // 3. CANVAS SIZING
  // =====================================================================
  function resizeCanvases() {
    const w = mainEl.clientWidth;
    const h = mainEl.clientHeight;
    [gridCanvas, drawCanvas].forEach((c) => { c.width = w; c.height = h; });

    // Center the world origin in the viewport the first time we size up,
    // so a fresh sketch starts looking at (0,0) instead of a corner.
    if (!state.viewInitialized) {
      state.panX = w / 2;
      state.panY = h / 2;
      state.viewInitialized = true;
    }
    drawGrid();
    render();
  }
  window.addEventListener('resize', resizeCanvases);

  // =====================================================================
  // 4. COORDINATE HELPERS
  // =====================================================================
  function worldToScreen(wx, wy) {
    return { x: wx * state.zoom + state.panX, y: wy * state.zoom + state.panY };
  }
  function screenToWorld(sx, sy) {
    return { x: (sx - state.panX) / state.zoom, y: (sy - state.panY) / state.zoom };
  }
  // Converts a pointer event's page coordinates into world space,
  // accounting for the canvas's on-screen position, CSS scaling, and
  // the current pan/zoom camera.
  function getWorldPos(evt) {
    const rect = drawCanvas.getBoundingClientRect();
    const scaleX = drawCanvas.width / rect.width;
    const scaleY = drawCanvas.height / rect.height;
    const sx = (evt.clientX - rect.left) * scaleX;
    const sy = (evt.clientY - rect.top) * scaleY;
    return screenToWorld(sx, sy);
  }
  function getScreenPos(evt) {
    const rect = drawCanvas.getBoundingClientRect();
    const scaleX = drawCanvas.width / rect.width;
    const scaleY = drawCanvas.height / rect.height;
    return { x: (evt.clientX - rect.left) * scaleX, y: (evt.clientY - rect.top) * scaleY };
  }

  // Snap a WORLD-space point to the nearest grid intersection. The core
  // trick: dividing by grid size converts pixels -> grid units, rounding
  // picks the nearest whole unit, multiplying converts back to pixels.
  function snap(pos) {
    if (!state.snapEnabled) return pos;
    const s = state.gridSize;
    return { x: Math.round(pos.x / s) * s, y: Math.round(pos.y / s) * s };
  }

  function setZoomAtScreenPoint(newZoom, sx, sy) {
    newZoom = Math.min(8, Math.max(0.1, newZoom));
    const worldBefore = screenToWorld(sx, sy);
    state.zoom = newZoom;
    const screenAfter = worldToScreen(worldBefore.x, worldBefore.y);
    state.panX += sx - screenAfter.x;
    state.panY += sy - screenAfter.y;
    document.getElementById('zoomLabel').textContent = Math.round(state.zoom * 100) + '%';
    drawGrid();
    render();
  }

  // =====================================================================
  // 5. GRID RENDERING
  // =====================================================================
  // Grid lines are generated from WORLD-space indices (col/row), not
  // screen position, so the "major" line pattern stays anchored to the
  // world origin as the user pans around — it doesn't shift or flicker.
  function drawGrid() {
    const w = gridCanvas.width;
    const h = gridCanvas.height;
    gctx.setTransform(1, 0, 0, 1, 0, 0);
    gctx.clearRect(0, 0, w, h);
    gctx.fillStyle = '#ffffff';
    gctx.fillRect(0, 0, w, h);
    if (!state.gridVisible) return;

    if (state.gridType === 'isometric') { drawIsometricGrid(); return; }

    const size = state.gridSize;
    const topLeft = screenToWorld(0, 0);
    const bottomRight = screenToWorld(w, h);
    const startCol = Math.floor(topLeft.x / size);
    const endCol = Math.ceil(bottomRight.x / size);
    const startRow = Math.floor(topLeft.y / size);
    const endRow = Math.ceil(bottomRight.y / size);

    if (state.gridType === 'dots') {
      gctx.fillStyle = state.gridColor;
      const r = Math.max(1, 1.4 * state.zoom);
      for (let col = startCol; col <= endCol; col++) {
        for (let row = startRow; row <= endRow; row++) {
          const p = worldToScreen(col * size, row * size);
          gctx.beginPath();
          gctx.arc(p.x, p.y, r, 0, Math.PI * 2);
          gctx.fill();
        }
      }
      return;
    }

    // Square grid: vertical then horizontal line families.
    for (let col = startCol; col <= endCol; col++) {
      const isMajor = col % state.majorEvery === 0;
      const sx = Math.round(worldToScreen(col * size, 0).x) + 0.5; // +0.5 keeps 1px lines crisp
      gctx.beginPath();
      gctx.moveTo(sx, 0);
      gctx.lineTo(sx, h);
      gctx.strokeStyle = isMajor ? state.majorColor : state.gridColor;
      gctx.lineWidth = 1;
      gctx.stroke();
    }
    for (let row = startRow; row <= endRow; row++) {
      const isMajor = row % state.majorEvery === 0;
      const sy = Math.round(worldToScreen(0, row * size).y) + 0.5;
      gctx.beginPath();
      gctx.moveTo(0, sy);
      gctx.lineTo(w, sy);
      gctx.strokeStyle = isMajor ? state.majorColor : state.gridColor;
      gctx.lineWidth = 1;
      gctx.stroke();
    }
  }

  // Isometric/triangular grid: draw a plain "vertical line" family three
  // times, rotated 0°, 60°, and -60° around the point currently at the
  // center of the viewport. Three rotated copies of the same line family
  // is exactly what produces the classic 60°-triangle isometric pattern,
  // without needing separate trig for each family.
  function drawIsometricGrid() {
    const w = gridCanvas.width, h = gridCanvas.height;
    const size = state.gridSize;
    const centerWorld = screenToWorld(w / 2, h / 2);
    const range = Math.sqrt(w * w + h * h) / state.zoom / 2 + size * 4;
    const angles = [0, Math.PI / 3, -Math.PI / 3];

    angles.forEach((angle) => {
      const cosA = Math.cos(angle), sinA = Math.sin(angle);
      const start = Math.floor(-range / size) * size;
      for (let k = start; k <= range; k += size) {
        // A vertical line at local x=k, spanning -range..range in y,
        // rotated by `angle` and re-centered on the viewport's world center.
        const rot = (lx, ly) => ({
          x: centerWorld.x + lx * cosA - ly * sinA,
          y: centerWorld.y + lx * sinA + ly * cosA,
        });
        const wp1 = rot(k, -range);
        const wp2 = rot(k, range);
        const sp1 = worldToScreen(wp1.x, wp1.y);
        const sp2 = worldToScreen(wp2.x, wp2.y);
        gctx.beginPath();
        gctx.moveTo(sp1.x, sp1.y);
        gctx.lineTo(sp2.x, sp2.y);
        const isMajor = Math.round(k / size) % state.majorEvery === 0;
        gctx.strokeStyle = isMajor ? state.majorColor : state.gridColor;
        gctx.lineWidth = 1;
        gctx.stroke();
      }
    });
  }

  // Coalesce grid redraws during fast pan/zoom gestures into one per frame.
  let gridRedrawQueued = false;
  function requestGridRedraw() {
    if (gridRedrawQueued) return;
    gridRedrawQueued = true;
    requestAnimationFrame(() => { gridRedrawQueued = false; drawGrid(); render(); });
  }

  // =====================================================================
  // 6. SHAPE FACTORY
  // =====================================================================
  function currentStyle() {
    return {
      stroke: state.strokeColor,
      strokeWidth: state.strokeWidth,
      fill: state.fillColor,
      fillEnabled: state.fillEnabled,
    };
  }
  function makeShape(type, extra) {
    return Object.assign({ id: state.nextId++, type, style: currentStyle(), rotation: 0 }, extra);
  }
  function deepClone(obj) { return JSON.parse(JSON.stringify(obj)); }

  // =====================================================================
  // 7. RENDERING
  // =====================================================================
  function render() {
    const w = drawCanvas.width, h = drawCanvas.height;
    dctx.setTransform(1, 0, 0, 1, 0, 0);
    dctx.clearRect(0, 0, w, h);

    // Shapes are drawn in WORLD space by applying the pan/zoom camera as
    // the canvas transform, so shape code never has to think about it.
    dctx.setTransform(state.zoom, 0, 0, state.zoom, state.panX, state.panY);
    state.shapes.forEach((shape) => drawShape(dctx, shape));
    if (state.draftShape) drawShape(dctx, state.draftShape);
    drawToolPreview(dctx);

    // Selection UI (handles, marquee) is drawn in constant-size screen
    // space, so handles don't shrink/grow as the user zooms.
    dctx.setTransform(1, 0, 0, 1, 0, 0);
    drawSelectionUI(dctx);
    if (state.marquee) drawMarquee(dctx);
  }

  function applyStyle(ctx, style) {
    ctx.strokeStyle = style.stroke;
    ctx.lineWidth = style.strokeWidth;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.fillStyle = style.fill;
  }

  function drawShape(ctx, shape) {
    ctx.save();
    if (shape.type !== 'group') applyStyle(ctx, shape.style);

    if (shape.rotation) {
      const b = getBounds(shape);
      const cx = (b.x1 + b.x2) / 2, cy = (b.y1 + b.y2) / 2;
      ctx.translate(cx, cy);
      ctx.rotate(shape.rotation);
      ctx.translate(-cx, -cy);
    }

    switch (shape.type) {
      case 'pencil':
      case 'line': {
        if (shape.points.length < 2) break;
        ctx.beginPath();
        ctx.moveTo(shape.points[0].x, shape.points[0].y);
        for (let i = 1; i < shape.points.length; i++) ctx.lineTo(shape.points[i].x, shape.points[i].y);
        if (shape.closed) ctx.closePath();
        if (shape.closed && shape.style.fillEnabled) ctx.fill();
        ctx.stroke();
        break;
      }
      case 'rect': {
        const x = Math.min(shape.x1, shape.x2), y = Math.min(shape.y1, shape.y2);
        const w = Math.abs(shape.x2 - shape.x1), h = Math.abs(shape.y2 - shape.y1);
        if (shape.style.fillEnabled) ctx.fillRect(x, y, w, h);
        ctx.strokeRect(x, y, w, h);
        break;
      }
      case 'circle': {
        const cx = (shape.x1 + shape.x2) / 2, cy = (shape.y1 + shape.y2) / 2;
        const rx = Math.abs(shape.x2 - shape.x1) / 2, ry = Math.abs(shape.y2 - shape.y1) / 2;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        if (shape.style.fillEnabled) ctx.fill();
        ctx.stroke();
        break;
      }
      case 'curve': {
        ctx.beginPath();
        ctx.moveTo(shape.x1, shape.y1);
        ctx.quadraticCurveTo(shape.cx, shape.cy, shape.x2, shape.y2);
        ctx.stroke();
        break;
      }
      case 'text': {
        ctx.font = `${shape.fontSize}px ${shape.fontFamily || 'sans-serif'}`;
        ctx.textBaseline = 'top';
        if (shape.outline) {
          ctx.lineWidth = shape.style.strokeWidth;
          ctx.strokeStyle = shape.style.stroke;
          ctx.strokeText(shape.text, shape.x, shape.y);
        }
        ctx.fillStyle = shape.style.fill;
        ctx.fillText(shape.text, shape.x, shape.y);
        break;
      }
      case 'group': {
        shape.children.forEach((child) => drawShape(ctx, child));
        break;
      }
    }
    ctx.restore();
  }

  // In-progress interactions that haven't become a committed shape yet:
  // the polygon being clicked out point-by-point, and the curve tool's
  // multi-click sequence.
  function drawToolPreview(ctx) {
    ctx.save();
    ctx.strokeStyle = state.strokeColor;
    ctx.lineWidth = Math.max(1, state.strokeWidth); // world-space width (auto-scales with the camera transform)
    ctx.setLineDash([6 / state.zoom, 4 / state.zoom]);

    if (state.polyActive && state.polyPoints.length > 0) {
      ctx.beginPath();
      ctx.moveTo(state.polyPoints[0].x, state.polyPoints[0].y);
      for (let i = 1; i < state.polyPoints.length; i++) ctx.lineTo(state.polyPoints[i].x, state.polyPoints[i].y);
      if (state.polyPreview) ctx.lineTo(state.polyPreview.x, state.polyPreview.y);
      ctx.stroke();
      // Vertex markers, drawn at a fixed *screen* size regardless of zoom.
      ctx.setLineDash([]);
      state.polyPoints.forEach((p, i) => {
        ctx.beginPath();
        ctx.fillStyle = i === 0 ? '#6366f1' : '#ffffff';
        ctx.arc(p.x, p.y, 3.5 / state.zoom, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#6366f1';
        ctx.lineWidth = 1.5 / state.zoom;
        ctx.stroke();
      });
    }

    if (state.curveDraft) {
      ctx.setLineDash([6 / state.zoom, 4 / state.zoom]);
      ctx.beginPath();
      if (state.curveStep === 1 && state.curvePreview) {
        ctx.moveTo(state.curveDraft.x1, state.curveDraft.y1);
        ctx.lineTo(state.curvePreview.x, state.curvePreview.y);
      } else if (state.curveStep === 2 && state.curvePreview) {
        ctx.moveTo(state.curveDraft.x1, state.curveDraft.y1);
        ctx.quadraticCurveTo(state.curvePreview.x, state.curvePreview.y, state.curveDraft.x2, state.curveDraft.y2);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  // Bounding box for any shape type, in WORLD space. Used for hit
  // testing, selection outlines, and as the pivot for scale/rotate.
  function getBounds(shape) {
    switch (shape.type) {
      case 'pencil':
      case 'line': {
        const xs = shape.points.map((p) => p.x), ys = shape.points.map((p) => p.y);
        return { x1: Math.min(...xs), y1: Math.min(...ys), x2: Math.max(...xs), y2: Math.max(...ys) };
      }
      case 'rect':
      case 'circle':
        return {
          x1: Math.min(shape.x1, shape.x2), y1: Math.min(shape.y1, shape.y2),
          x2: Math.max(shape.x1, shape.x2), y2: Math.max(shape.y1, shape.y2),
        };
      case 'curve': {
        const xs = [shape.x1, shape.x2, shape.cx], ys = [shape.y1, shape.y2, shape.cy];
        return { x1: Math.min(...xs), y1: Math.min(...ys), x2: Math.max(...xs), y2: Math.max(...ys) };
      }
      case 'text': {
        const approxWidth = shape.text.length * shape.fontSize * 0.6;
        return { x1: shape.x, y1: shape.y, x2: shape.x + approxWidth, y2: shape.y + shape.fontSize * 1.2 };
      }
      case 'group': {
        const boxes = shape.children.map(getBounds);
        return {
          x1: Math.min(...boxes.map((b) => b.x1)), y1: Math.min(...boxes.map((b) => b.y1)),
          x2: Math.max(...boxes.map((b) => b.x2)), y2: Math.max(...boxes.map((b) => b.y2)),
        };
      }
    }
  }

  function drawSelectionUI(ctx) {
    state.selectedIds.forEach((id) => {
      const shape = state.shapes.find((s) => s.id === id);
      if (!shape) return;
      const b = getBounds(shape);
      const p1 = worldToScreen(b.x1, b.y1), p2 = worldToScreen(b.x2, b.y2);
      ctx.save();
      ctx.strokeStyle = '#6366f1';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(Math.min(p1.x, p2.x) - 4, Math.min(p1.y, p2.y) - 4, Math.abs(p2.x - p1.x) + 8, Math.abs(p2.y - p1.y) + 8);
      ctx.restore();
    });

    // Scale + rotate handles only make sense (and are only drawn) for a
    // single, non-group selection — dragging handles for a multi-shape
    // or grouped selection would need a shared transform we don't model.
    if (state.selectedIds.length === 1) {
      const shape = state.shapes.find((s) => s.id === state.selectedIds[0]);
      if (shape && shape.type !== 'group') {
        const handles = getHandleScreenPositions(shape);
        ctx.save();
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#6366f1';
        ctx.lineWidth = 1.5;
        ['nw', 'ne', 'se', 'sw'].forEach((k) => {
          const p = handles[k];
          ctx.fillRect(p.x - 4, p.y - 4, 8, 8);
          ctx.strokeRect(p.x - 4, p.y - 4, 8, 8);
        });
        // Line connecting the shape to its rotate handle
        ctx.beginPath();
        ctx.moveTo(handles.topMid.x, handles.topMid.y);
        ctx.lineTo(handles.rotate.x, handles.rotate.y);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(handles.rotate.x, handles.rotate.y, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  function getHandleScreenPositions(shape) {
    const b = getBounds(shape);
    const nw = worldToScreen(b.x1, b.y1);
    const ne = worldToScreen(b.x2, b.y1);
    const se = worldToScreen(b.x2, b.y2);
    const sw = worldToScreen(b.x1, b.y2);
    const topMid = worldToScreen((b.x1 + b.x2) / 2, b.y1);
    const rotate = { x: topMid.x, y: topMid.y - 26 };
    return { nw, ne, se, sw, topMid, rotate };
  }

  function drawMarquee(ctx) {
    const m = state.marquee;
    ctx.save();
    ctx.fillStyle = 'rgba(99,102,241,0.1)';
    ctx.strokeStyle = '#6366f1';
    ctx.lineWidth = 1;
    const x = Math.min(m.x1, m.x2), y = Math.min(m.y1, m.y2);
    const w = Math.abs(m.x2 - m.x1), h = Math.abs(m.y2 - m.y1);
    ctx.fillRect(x, y, w, h);
    ctx.strokeRect(x, y, w, h);
    ctx.restore();
  }

  // Padding-expanded bounding-box hit test in WORLD space. Iterates
  // back-to-front so the topmost drawn shape wins when shapes overlap.
  function hitTest(worldPos) {
    const padding = 6 / state.zoom;
    for (let i = state.shapes.length - 1; i >= 0; i--) {
      const shape = state.shapes[i];
      const b = getBounds(shape);
      if (worldPos.x >= b.x1 - padding && worldPos.x <= b.x2 + padding &&
          worldPos.y >= b.y1 - padding && worldPos.y <= b.y2 + padding) {
        return shape;
      }
    }
    return null;
  }

  // =====================================================================
  // 8. TRANSFORM HELPERS (translate / scale about a point)
  // =====================================================================
  function translateShape(shape, dx, dy) {
    switch (shape.type) {
      case 'pencil':
      case 'line':
        shape.points = shape.points.map((p) => ({ x: p.x + dx, y: p.y + dy }));
        break;
      case 'rect':
      case 'circle':
        shape.x1 += dx; shape.y1 += dy; shape.x2 += dx; shape.y2 += dy;
        break;
      case 'curve':
        shape.x1 += dx; shape.y1 += dy; shape.x2 += dx; shape.y2 += dy; shape.cx += dx; shape.cy += dy;
        break;
      case 'text':
        shape.x += dx; shape.y += dy;
        break;
      case 'group':
        shape.children.forEach((c) => translateShape(c, dx, dy));
        break;
    }
  }

  function scaleShapeAboutCenter(shape, center, factor) {
    const sx = (v) => center.x + (v - center.x) * factor;
    const sy = (v) => center.y + (v - center.y) * factor;
    switch (shape.type) {
      case 'pencil':
      case 'line':
        shape.points = shape.points.map((p) => ({ x: sx(p.x), y: sy(p.y) }));
        break;
      case 'rect':
      case 'circle':
        shape.x1 = sx(shape.x1); shape.y1 = sy(shape.y1); shape.x2 = sx(shape.x2); shape.y2 = sy(shape.y2);
        break;
      case 'curve':
        shape.x1 = sx(shape.x1); shape.y1 = sy(shape.y1);
        shape.x2 = sx(shape.x2); shape.y2 = sy(shape.y2);
        shape.cx = sx(shape.cx); shape.cy = sy(shape.cy);
        break;
      case 'text':
        shape.x = sx(shape.x); shape.y = sy(shape.y);
        shape.fontSize = Math.max(6, shape.fontSize * factor);
        break;
      case 'group':
        shape.children.forEach((c) => scaleShapeAboutCenter(c, center, factor));
        break;
    }
  }

  // =====================================================================
  // 9. UNDO / REDO + LOCAL AUTOSAVE
  // =====================================================================
  function pushHistory() {
    state.undoStack.push(JSON.stringify(state.shapes));
    if (state.undoStack.length > 100) state.undoStack.shift();
    state.redoStack = [];
  }
  function undo() {
    if (!state.undoStack.length) return;
    state.redoStack.push(JSON.stringify(state.shapes));
    state.shapes = JSON.parse(state.undoStack.pop());
    state.selectedIds = [];
    saveLocal(); render();
  }
  function redo() {
    if (!state.redoStack.length) return;
    state.undoStack.push(JSON.stringify(state.shapes));
    state.shapes = JSON.parse(state.redoStack.pop());
    state.selectedIds = [];
    saveLocal(); render();
  }

  // "Local sketch" — mirrors the real app's free-tier storage model:
  // everything lives in this browser only, autosaved after every
  // committed change, restored automatically on the next visit.
  let saveQueued = false;
  function saveLocal() {
    if (saveQueued) return;
    saveQueued = true;
    requestAnimationFrame(() => {
      saveQueued = false;
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ shapes: state.shapes, nextId: state.nextId }));
      } catch (e) { /* storage full or unavailable — fail silently, drawing still works */ }
    });
  }
  function loadLocal() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      state.shapes = data.shapes || [];
      state.nextId = data.nextId || 1;
    } catch (e) { /* corrupt/missing data — start with a blank sketch */ }
  }

  // =====================================================================
  // 10. POINTER INTERACTION
  // =====================================================================
  drawCanvas.addEventListener('contextmenu', (e) => e.preventDefault());
  drawCanvas.addEventListener('pointerdown', onPointerDown);
  drawCanvas.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  drawCanvas.addEventListener('wheel', onWheel, { passive: false });
  drawCanvas.addEventListener('dblclick', onDoubleClick);

  function isPanGesture(evt) {
    return state.tool === 'pan' || state.spaceDown || evt.button === 2;
  }

  function onWheel(evt) {
    evt.preventDefault();
    const screen = getScreenPos(evt);
    const factor = evt.deltaY < 0 ? 1.1 : 1 / 1.1;
    setZoomAtScreenPoint(state.zoom * factor, screen.x, screen.y);
  }

  function onPointerDown(evt) {
    if (isPanGesture(evt)) {
      state.panning = true;
      state.panStart = { x: evt.clientX, y: evt.clientY };
      state.panOrigin = { x: state.panX, y: state.panY };
      drawCanvas.classList.add('cursor-panning');
      return;
    }

    const screen = getScreenPos(evt);
    const raw = getWorldPos(evt);
    const pos = snap(raw);

    if (state.tool === 'select') return handleSelectDown(screen, raw, evt);
    if (state.tool === 'eraser') return handleEraserDown(raw);
    if (state.tool === 'fill') return handleFillDown(raw);
    if (state.tool === 'text') return openTextEditor(pos, screen);
    if (state.tool === 'line') return handleLineDown(pos);
    if (state.tool === 'curve') return handleCurveDown(pos);

    // Pencil / rect / circle: simple drag-to-draw.
    state.drawing = true;
    if (state.tool === 'pencil') state.draftShape = makeShape('pencil', { points: [pos] });
    else if (state.tool === 'rect') state.draftShape = makeShape('rect', { x1: pos.x, y1: pos.y, x2: pos.x, y2: pos.y });
    else if (state.tool === 'circle') state.draftShape = makeShape('circle', { x1: pos.x, y1: pos.y, x2: pos.x, y2: pos.y });
    render();
  }

  function onPointerMove(evt) {
    if (state.panning) {
      const dx = evt.clientX - state.panStart.x, dy = evt.clientY - state.panStart.y;
      state.panX = state.panOrigin.x + dx;
      state.panY = state.panOrigin.y + dy;
      requestGridRedraw();
      return;
    }

    const raw = getWorldPos(evt);
    const pos = snap(raw);

    if (state.tool === 'select' && state.dragMode) return handleSelectDrag(raw, evt);
    if (state.tool === 'select' && state.marquee) {
      const screen = getScreenPos(evt);
      state.marquee.x2 = screen.x; state.marquee.y2 = screen.y;
      render();
      return;
    }
    if (state.tool === 'line' && state.polyActive) { state.polyPreview = pos; render(); return; }
    if (state.tool === 'curve' && state.curveDraft) { state.curvePreview = pos; render(); return; }

    if (!state.drawing || !state.draftShape) return;
    if (state.tool === 'pencil') state.draftShape.points.push(pos);
    else { state.draftShape.x2 = pos.x; state.draftShape.y2 = pos.y; }
    render();
  }

  function onPointerUp(evt) {
    if (state.panning) {
      state.panning = false;
      drawCanvas.classList.remove('cursor-panning');
      return;
    }
    if (state.tool === 'select') {
      if (state.dragMode) { finishSelectDrag(); return; }
      if (state.marquee) { finishMarquee(); return; }
    }
    if (!state.drawing) return;
    state.drawing = false;
    if (state.draftShape) {
      pushHistory();
      state.shapes.push(state.draftShape);
      state.draftShape = null;
      saveLocal();
      render();
    }
  }

  function onDoubleClick() {
    if (state.tool === 'line' && state.polyActive) finishPolygon(false);
  }

  // ---- Line / Polygon tool ----
  function handleLineDown(pos) {
    if (!state.polyActive) {
      state.polyActive = true;
      state.polyPoints = [pos];
      render();
      return;
    }
    // Clicking near the first vertex closes the polygon.
    const first = state.polyPoints[0];
    const screenFirst = worldToScreen(first.x, first.y);
    const screenPos = worldToScreen(pos.x, pos.y);
    const dist = Math.hypot(screenFirst.x - screenPos.x, screenFirst.y - screenPos.y);
    if (dist < 10 && state.polyPoints.length >= 2) { finishPolygon(true); return; }
    state.polyPoints.push(pos);
    render();
  }
  function finishPolygon(closed) {
    if (state.polyPoints.length >= 2) {
      pushHistory();
      state.shapes.push(makeShape('line', { points: state.polyPoints.slice(), closed }));
      saveLocal();
    }
    state.polyActive = false;
    state.polyPoints = [];
    state.polyPreview = null;
    render();
  }

  // ---- Curve tool ----
  function handleCurveDown(pos) {
    if (state.curveStep === 0) {
      state.curveDraft = { x1: pos.x, y1: pos.y };
      state.curveStep = 1;
    } else if (state.curveStep === 1) {
      state.curveDraft.x2 = pos.x; state.curveDraft.y2 = pos.y;
      state.curveStep = 2;
    } else if (state.curveStep === 2) {
      state.curveDraft.cx = pos.x; state.curveDraft.cy = pos.y;
      pushHistory();
      state.shapes.push(makeShape('curve', state.curveDraft));
      saveLocal();
      state.curveDraft = null;
      state.curveStep = 0;
    }
    render();
  }
  function cancelCurve() { state.curveDraft = null; state.curveStep = 0; state.curvePreview = null; render(); }

  // ---- Fill tool ----
  function handleFillDown(raw) {
    const hit = hitTest(raw);
    if (!hit) return;
    pushHistory();
    hit.style.fill = state.fillColor;
    hit.style.fillEnabled = true;
    saveLocal();
    render();
  }

  // ---- Eraser tool ----
  function handleEraserDown(raw) {
    const hit = hitTest(raw);
    if (!hit) return;
    pushHistory();
    state.shapes = state.shapes.filter((s) => s.id !== hit.id);
    state.selectedIds = state.selectedIds.filter((id) => id !== hit.id);
    saveLocal();
    render();
  }

  // ---- Select tool: click / shift-click / marquee / move / scale / rotate ----
  function handleSelectDown(screen, raw, evt) {
    // 1. Check for a handle hit first (only shown for single selections).
    if (state.selectedIds.length === 1) {
      const shape = state.shapes.find((s) => s.id === state.selectedIds[0]);
      if (shape && shape.type !== 'group') {
        const handles = getHandleScreenPositions(shape);
        const near = (p) => Math.hypot(p.x - screen.x, p.y - screen.y) < 8;
        for (const key of ['nw', 'ne', 'se', 'sw']) {
          if (near(handles[key])) return beginScale(shape, key, raw);
        }
        if (near(handles.rotate)) return beginRotate(shape, raw);
      }
    }

    // 2. Ordinary click / shift-click selection.
    const hit = hitTest(raw);
    if (hit) {
      if (evt.shiftKey) {
        state.selectedIds = state.selectedIds.includes(hit.id)
          ? state.selectedIds.filter((id) => id !== hit.id)
          : [...state.selectedIds, hit.id];
      } else if (!state.selectedIds.includes(hit.id)) {
        state.selectedIds = [hit.id];
      }
      // Begin a move drag for whatever is now selected.
      state.dragMode = 'move';
      state.dragStartWorld = raw;
      state.dragOrigins = state.selectedIds.map((id) => deepClone(state.shapes.find((s) => s.id === id)));
      render();
      return;
    }

    // 3. Empty space: start a marquee selection (extends existing
    // selection if Shift is held).
    if (!evt.shiftKey) state.selectedIds = [];
    state.marquee = { x1: screen.x, y1: screen.y, x2: screen.x, y2: screen.y };
    render();
  }

  function beginScale(shape, handleKey, raw) {
    const b = getBounds(shape);
    state.dragMode = 'scale';
    state.dragHandle = handleKey;
    state.dragCenter = { x: (b.x1 + b.x2) / 2, y: (b.y1 + b.y2) / 2 };
    state.dragOrigins = [deepClone(shape)];
    state.dragStartWorld = raw;
    // Reference distance from center to the dragged corner, used to compute a scale factor.
    state.dragStartDist = Math.hypot(raw.x - state.dragCenter.x, raw.y - state.dragCenter.y) || 1;
  }
  function beginRotate(shape, raw) {
    const b = getBounds(shape);
    const center = { x: (b.x1 + b.x2) / 2, y: (b.y1 + b.y2) / 2 };
    state.dragMode = 'rotate';
    state.dragCenter = center;
    state.dragOrigins = [deepClone(shape)];
    state.dragStartAngle = Math.atan2(raw.y - center.y, raw.x - center.x) - (shape.rotation || 0);
  }

  function handleSelectDrag(raw) {
    if (state.dragMode === 'move') {
      let dx = raw.x - state.dragStartWorld.x, dy = raw.y - state.dragStartWorld.y;
      if (state.snapEnabled) {
        const s = state.gridSize;
        dx = Math.round(dx / s) * s;
        dy = Math.round(dy / s) * s;
      }
      state.selectedIds.forEach((id, i) => {
        const shape = state.shapes.find((s) => s.id === id);
        const origin = state.dragOrigins[i];
        Object.assign(shape, deepClone(origin));
        translateShape(shape, dx, dy);
      });
      render();
    } else if (state.dragMode === 'scale') {
      const shape = state.shapes.find((s) => s.id === state.selectedIds[0]);
      const dist = Math.hypot(raw.x - state.dragCenter.x, raw.y - state.dragCenter.y) || 1;
      const factor = dist / state.dragStartDist;
      Object.assign(shape, deepClone(state.dragOrigins[0]));
      scaleShapeAboutCenter(shape, state.dragCenter, factor);
      render();
    } else if (state.dragMode === 'rotate') {
      const shape = state.shapes.find((s) => s.id === state.selectedIds[0]);
      const angle = Math.atan2(raw.y - state.dragCenter.y, raw.x - state.dragCenter.x) - state.dragStartAngle;
      shape.rotation = angle;
      render();
    }
  }

  function finishSelectDrag() {
    pushHistory();
    state.dragMode = null;
    state.dragOrigins = null;
    saveLocal();
  }

  function finishMarquee() {
    const m = state.marquee;
    const x1 = Math.min(m.x1, m.x2), x2 = Math.max(m.x1, m.x2);
    const y1 = Math.min(m.y1, m.y2), y2 = Math.max(m.y1, m.y2);
    // Only treat it as a marquee drag if the user actually dragged a bit;
    // a near-zero-size marquee is just an empty-space click to deselect.
    if (Math.abs(x2 - x1) > 3 || Math.abs(y2 - y1) > 3) {
      const worldTL = screenToWorld(x1, y1), worldBR = screenToWorld(x2, y2);
      const hits = state.shapes.filter((shape) => {
        const b = getBounds(shape);
        return b.x1 <= worldBR.x && b.x2 >= worldTL.x && b.y1 <= worldBR.y && b.y2 >= worldTL.y;
      });
      const ids = hits.map((s) => s.id);
      state.selectedIds = Array.from(new Set([...state.selectedIds, ...ids]));
    }
    state.marquee = null;
    render();
  }

  // =====================================================================
  // 11. TEXT TOOL
  // =====================================================================
  function openTextEditor(pos, screen) {
    textInput.style.left = `${screen.x}px`;
    textInput.style.top = `${screen.y}px`;
    textInput.style.fontSize = `${Math.max(10, state.fontSize * state.zoom)}px`;
    textInput.style.fontFamily = state.fontFamily;
    textInput.style.color = state.fillColor;
    textInput.value = '';
    textInput.classList.remove('hidden');
    textInput.focus();

    function commit() {
      const value = textInput.value.trim();
      textInput.classList.add('hidden');
      textInput.removeEventListener('blur', commit);
      textInput.removeEventListener('keydown', onKey);
      if (value.length > 0) {
        pushHistory();
        state.shapes.push(makeShape('text', {
          x: pos.x, y: pos.y, text: value,
          fontSize: state.fontSize, fontFamily: state.fontFamily, outline: state.textOutline,
        }));
        saveLocal();
        render();
      }
    }
    function onKey(e) {
      if (e.key === 'Enter') textInput.blur();
      if (e.key === 'Escape') { textInput.value = ''; textInput.blur(); }
    }
    textInput.addEventListener('blur', commit);
    textInput.addEventListener('keydown', onKey);
  }

  // =====================================================================
  // 12. GROUP / UNGROUP
  // =====================================================================
  function groupSelection() {
    if (state.selectedIds.length < 2) return;
    pushHistory();
    const children = state.shapes.filter((s) => state.selectedIds.includes(s.id));
    state.shapes = state.shapes.filter((s) => !state.selectedIds.includes(s.id));
    const group = makeShape('group', { children });
    state.shapes.push(group);
    state.selectedIds = [group.id];
    saveLocal(); render();
  }
  function ungroupSelection() {
    if (state.selectedIds.length !== 1) return;
    const group = state.shapes.find((s) => s.id === state.selectedIds[0]);
    if (!group || group.type !== 'group') return;
    pushHistory();
    state.shapes = state.shapes.filter((s) => s.id !== group.id);
    state.shapes.push(...group.children);
    state.selectedIds = group.children.map((c) => c.id);
    saveLocal(); render();
  }

  // =====================================================================
  // 13. EXPORT (PNG / SVG) + PRINT
  // =====================================================================
  function exportPng() {
    const transparent = confirm('Export with a transparent background?\n\nOK = transparent, Cancel = white background + grid.');
    const off = document.createElement('canvas');
    off.width = drawCanvas.width;
    off.height = drawCanvas.height;
    const octx = off.getContext('2d');
    if (!transparent) octx.drawImage(gridCanvas, 0, 0);
    octx.drawImage(drawCanvas, 0, 0);
    downloadUrl(off.toDataURL('image/png'), 'graph-paper.png');
  }

  function exportSvg() {
    const w = drawCanvas.width, h = drawCanvas.height;
    // Export at 1:1 world scale within the current viewport bounds, so
    // "what you see is what you get" without baking in pan/zoom quirks.
    const topLeft = screenToWorld(0, 0), bottomRight = screenToWorld(w, h);
    const vw = bottomRight.x - topLeft.x, vh = bottomRight.y - topLeft.y;
    const parts = [];
    parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${topLeft.x} ${topLeft.y} ${vw} ${vh}">`);
    parts.push(`<rect x="${topLeft.x}" y="${topLeft.y}" width="${vw}" height="${vh}" fill="#ffffff"/>`);
    state.shapes.forEach((shape) => parts.push(shapeToSvg(shape)));
    parts.push('</svg>');
    const blob = new Blob([parts.join('\n')], { type: 'image/svg+xml' });
    downloadUrl(URL.createObjectURL(blob), 'graph-paper.svg');
  }

  function shapeToSvg(shape) {
    if (shape.type === 'group') return `<g>${shape.children.map(shapeToSvg).join('')}</g>`;
    const s = shape.style;
    const fill = s.fillEnabled ? s.fill : 'none';
    const b = getBounds(shape);
    const cx = (b.x1 + b.x2) / 2, cy = (b.y1 + b.y2) / 2;
    const transform = shape.rotation
      ? ` transform="rotate(${(shape.rotation * 180 / Math.PI).toFixed(2)} ${cx} ${cy})"` : '';

    switch (shape.type) {
      case 'pencil':
      case 'line': {
        const d = shape.points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ') + (shape.closed ? ' Z' : '');
        return `<path d="${d}" fill="${shape.closed ? fill : 'none'}" stroke="${s.stroke}" stroke-width="${s.strokeWidth}" stroke-linecap="round" stroke-linejoin="round"${transform}/>`;
      }
      case 'rect': {
        const x = Math.min(shape.x1, shape.x2), y = Math.min(shape.y1, shape.y2);
        const w = Math.abs(shape.x2 - shape.x1), h = Math.abs(shape.y2 - shape.y1);
        return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" stroke="${s.stroke}" stroke-width="${s.strokeWidth}"${transform}/>`;
      }
      case 'circle': {
        const rx = Math.abs(shape.x2 - shape.x1) / 2, ry = Math.abs(shape.y2 - shape.y1) / 2;
        return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}" stroke="${s.stroke}" stroke-width="${s.strokeWidth}"${transform}/>`;
      }
      case 'curve':
        return `<path d="M${shape.x1},${shape.y1} Q${shape.cx},${shape.cy} ${shape.x2},${shape.y2}" fill="none" stroke="${s.stroke}" stroke-width="${s.strokeWidth}"${transform}/>`;
      case 'text':
        return `<text x="${shape.x}" y="${shape.y + shape.fontSize}" font-family="${shape.fontFamily || 'sans-serif'}" font-size="${shape.fontSize}" fill="${s.fill}"${shape.outline ? ` stroke="${s.stroke}" stroke-width="${s.strokeWidth}"` : ''}${transform}>${escapeXml(shape.text)}</text>`;
      default:
        return '';
    }
  }
  function escapeXml(str) {
    return str.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));
  }
  function downloadUrl(url, filename) {
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
  }

  // =====================================================================
  // 14. UI WIRING
  // =====================================================================
  const toolButtons = document.querySelectorAll('.tool-btn[data-tool]');
  toolButtons.forEach((btn) => btn.addEventListener('click', () => setTool(btn.dataset.tool)));

  function setTool(tool) {
    // Leaving mid-flight polygon/curve tools should finalize/cancel cleanly.
    if (state.tool === 'line' && state.polyActive) finishPolygon(false);
    if (state.tool === 'curve' && state.curveDraft) cancelCurve();

    state.tool = tool;
    if (tool !== 'select') state.selectedIds = [];

    toolButtons.forEach((b) => b.classList.toggle('tool-active', b.dataset.tool === tool));
    document.getElementById('textControls').classList.toggle('hidden', tool !== 'text');
    document.getElementById('textControls').classList.toggle('flex', tool === 'text');

    drawCanvas.classList.remove('cursor-select', 'cursor-crosshair', 'cursor-text', 'cursor-eraser', 'cursor-pan');
    const cursorClass = { select: 'cursor-select', text: 'cursor-text', eraser: 'cursor-eraser', pan: 'cursor-pan' }[tool] || 'cursor-crosshair';
    drawCanvas.classList.add(cursorClass);
    render();
  }

  const KEY_TO_TOOL = { v: 'select', p: 'pencil', l: 'line', u: 'curve', r: 'rect', c: 'circle', b: 'fill', t: 'text', e: 'eraser' };
  window.addEventListener('keydown', (e) => {
    if (document.activeElement === textInput) return;

    if (e.key === ' ') { state.spaceDown = true; drawCanvas.classList.add('cursor-pan'); return; }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); return; }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'g') { e.preventDefault(); gotoCoordinate(); return; }

    if (state.tool === 'line' && state.polyActive) {
      if (e.key === 'Enter') { finishPolygon(true); return; }
      if (e.key === 'Escape') { finishPolygon(false); return; }
      if (e.key === 'Backspace') { if (state.polyPoints.length > 1) state.polyPoints.pop(); render(); return; }
    }
    if (state.tool === 'curve' && state.curveDraft && e.key === 'Escape') { cancelCurve(); return; }

    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (state.selectedIds.length) {
        e.preventDefault();
        pushHistory();
        state.shapes = state.shapes.filter((s) => !state.selectedIds.includes(s.id));
        state.selectedIds = [];
        saveLocal(); render();
      }
      return;
    }

    const tool = KEY_TO_TOOL[e.key.toLowerCase()];
    if (tool) setTool(tool);
  });
  window.addEventListener('keyup', (e) => {
    if (e.key === ' ') { state.spaceDown = false; if (state.tool !== 'pan') drawCanvas.classList.remove('cursor-pan'); }
  });

  function gotoCoordinate() {
    const xStr = prompt('Go to X coordinate:', '0');
    if (xStr === null) return;
    const yStr = prompt('Go to Y coordinate:', '0');
    if (yStr === null) return;
    const x = parseFloat(xStr), y = parseFloat(yStr);
    if (Number.isNaN(x) || Number.isNaN(y)) return;
    state.panX = drawCanvas.width / 2 - x * state.zoom;
    state.panY = drawCanvas.height / 2 - y * state.zoom;
    drawGrid(); render();
  }

  // Style controls
  document.getElementById('strokeColor').addEventListener('input', (e) => { state.strokeColor = e.target.value; });
  document.getElementById('fillColor').addEventListener('input', (e) => { state.fillColor = e.target.value; });
  document.getElementById('fillEnabled').addEventListener('change', (e) => { state.fillEnabled = e.target.checked; });
  document.getElementById('strokeWidth').addEventListener('input', (e) => {
    state.strokeWidth = parseInt(e.target.value, 10);
    document.getElementById('strokeWidthLabel').textContent = e.target.value;
  });
  document.getElementById('fontFamily').addEventListener('change', (e) => { state.fontFamily = e.target.value; });
  document.getElementById('fontSize').addEventListener('change', (e) => { state.fontSize = parseInt(e.target.value, 10); });
  document.getElementById('textOutline').addEventListener('change', (e) => { state.textOutline = e.target.checked; });

  // Grid / setup
  document.getElementById('gridType').addEventListener('change', (e) => { state.gridType = e.target.value; drawGrid(); });
  document.getElementById('gridVisible').addEventListener('change', (e) => { state.gridVisible = e.target.checked; drawGrid(); });
  document.getElementById('snapEnabled').addEventListener('change', (e) => { state.snapEnabled = e.target.checked; });
  document.getElementById('gridSize').addEventListener('input', (e) => { state.gridSize = parseInt(e.target.value, 10); drawGrid(); });
  document.getElementById('gridColor').addEventListener('input', (e) => { state.gridColor = e.target.value; drawGrid(); });

  // View: zoom + goto
  document.getElementById('zoomInBtn').addEventListener('click', () => setZoomAtScreenPoint(state.zoom * 1.25, drawCanvas.width / 2, drawCanvas.height / 2));
  document.getElementById('zoomOutBtn').addEventListener('click', () => setZoomAtScreenPoint(state.zoom / 1.25, drawCanvas.width / 2, drawCanvas.height / 2));
  document.getElementById('zoomResetBtn').addEventListener('click', () => setZoomAtScreenPoint(1, drawCanvas.width / 2, drawCanvas.height / 2));
  document.getElementById('gotoBtn').addEventListener('click', gotoCoordinate);

  // Undo/redo/group
  document.getElementById('undoBtn').addEventListener('click', undo);
  document.getElementById('redoBtn').addEventListener('click', redo);
  document.getElementById('groupBtn').addEventListener('click', groupSelection);
  document.getElementById('ungroupBtn').addEventListener('click', ungroupSelection);

  // New sketch / print / export
  document.getElementById('newSketchBtn').addEventListener('click', () => {
    if (state.shapes.length === 0) return;
    if (!confirm('Start a new sketch? This clears your current local sketch and cannot be undone.')) return;
    state.shapes = [];
    state.selectedIds = [];
    state.undoStack = [];
    state.redoStack = [];
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* ignore */ }
    render();
  });
  document.getElementById('printBtn').addEventListener('click', () => window.print());
  document.getElementById('exportPngBtn').addEventListener('click', exportPng);
  document.getElementById('exportSvgBtn').addEventListener('click', exportSvg);

  // =====================================================================
  // 15. INIT
  // =====================================================================
  loadLocal();
  setTool('select');
  resizeCanvases();
})();
