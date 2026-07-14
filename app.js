/**
 * app.js  —  Virtual Graph Paper drawing engine (extended)
 * -------------------------------------------------------------------------
 * Two stacked <canvas> layers, plain-JS shape list, infinite pan/zoom grid.
 *
 * COORDINATE SYSTEM
 *   screenX = worldX * zoom + panX
 *   screenY = worldY * zoom + panY
 *
 * SHAPE TYPES
 *   pencil / line        : { points:[{x,y}…], closed? }
 *   rect / roundedrect   : { x1,y1,x2,y2, radius? }
 *   circle               : { x1,y1,x2,y2 }
 *   triangle / diamond   : { x1,y1,x2,y2 }
 *   star                 : { x1,y1,x2,y2 }
 *   arrow                : { x1,y1,x2,y2, arrowStart, arrowEnd }
 *   curve                : { x1,y1,x2,y2,cx,cy }  (quadratic Bézier)
 *   text                 : { x,y,text,fontSize,fontFamily,outline }
 *   image                : { x,y,w,h,src }  (base64 data-URL)
 *   group                : { children:[…shape objects] }
 *
 * STYLE OBJECT (stored per-shape)
 *   { stroke, strokeWidth, fill, fillEnabled, dash, opacity }
 */

(function () {
  'use strict';

  const cfg = window.APP_CONFIG || {};
  const STORAGE_KEY = 'vgp_clone_local_sketch_v2';
  const imageCache  = new Map(); // src → HTMLImageElement

  // =========================================================================
  // 1. STATE
  // =========================================================================
  const state = {
    // Active tool
    tool: 'select',

    // Current style settings (applied to every new shape)
    strokeColor : '#1e293b',
    fillColor   : '#93c5fd',
    fillEnabled : false,
    strokeWidth : 2,
    dash        : 'solid',   // 'solid' | 'dashed' | 'dotted'
    opacity     : 1.0,       // 0.1 – 1.0
    arrowHeads  : 'end',     // 'none' | 'start' | 'end' | 'both'
    cornerRadius: 12,        // for roundedrect
    fontFamily  : 'sans-serif',
    fontSize    : 18,
    textOutline : false,

    // Grid / canvas settings
    gridVisible : true,
    snapEnabled : true,
    snapAngle   : false,
    gridType    : cfg.gridType  || 'square',
    gridSize    : cfg.gridSize  || 20,
    gridColor   : cfg.gridColor || '#B9C4D0',
    majorEvery  : cfg.majorEvery|| 5,
    majorColor  : cfg.majorColor|| '#8FA0B3',
    bgColor     : cfg.bgColor   || '#ffffff',

    // Camera
    zoom            : 1,
    panX            : 0,
    panY            : 0,
    viewInitialized : false,

    // Shape list
    shapes      : [],
    selectedIds : [],
    nextId      : 1,

    // Transient drawing state
    drawing    : false,
    draftShape : null,
    panning    : false,
    panStart   : null,
    panOrigin  : null,
    spaceDown  : false,

    // Select-tool drag state
    dragMode       : null,   // 'move' | 'scale' | 'rotate'
    dragHandle     : null,
    dragOrigins    : null,
    dragCenter     : null,
    dragStartWorld : null,
    dragStartAngle : null,
    dragStartDist  : null,
    marquee        : null,

    // Line / polygon tool
    polyActive  : false,
    polyPoints  : [],
    polyPreview : null,

    // Curve tool
    curveStep    : 0,
    curveDraft   : null,
    curvePreview : null,

    // Undo / redo stacks
    undoStack : [],
    redoStack : [],
  };

  // =========================================================================
  // 2. DOM REFERENCES
  // =========================================================================
  const gridCanvas     = document.getElementById('gridLayer');
  const drawCanvas     = document.getElementById('drawLayer');
  const gctx           = gridCanvas.getContext('2d');
  const dctx           = drawCanvas.getContext('2d');
  const canvasWrap     = document.getElementById('canvasWrap');
  const textInput      = document.getElementById('textInput');
  const imageFileInput = document.getElementById('imageFileInput');
  const coordXEl       = document.getElementById('coordX');
  const coordYEl       = document.getElementById('coordY');
  const statusMsgEl    = document.getElementById('statusMsg');

  // =========================================================================
  // 3. CANVAS SIZING
  // =========================================================================
  function resizeCanvases() {
    const w = canvasWrap.clientWidth;
    const h = canvasWrap.clientHeight;
    [gridCanvas, drawCanvas].forEach((c) => { c.width = w; c.height = h; });

    if (!state.viewInitialized) {
      state.panX = w / 2;
      state.panY = h / 2;
      state.viewInitialized = true;
    }
    drawGrid();
    render();
  }
  window.addEventListener('resize', resizeCanvases);

  // =========================================================================
  // 4. COORDINATE HELPERS
  // =========================================================================
  function worldToScreen(wx, wy) {
    return { x: wx * state.zoom + state.panX, y: wy * state.zoom + state.panY };
  }
  function screenToWorld(sx, sy) {
    return { x: (sx - state.panX) / state.zoom, y: (sy - state.panY) / state.zoom };
  }
  function getWorldPos(evt) {
    const rect   = drawCanvas.getBoundingClientRect();
    const scaleX = drawCanvas.width  / rect.width;
    const scaleY = drawCanvas.height / rect.height;
    return screenToWorld(
      (evt.clientX - rect.left) * scaleX,
      (evt.clientY - rect.top)  * scaleY
    );
  }
  function getScreenPos(evt) {
    const rect   = drawCanvas.getBoundingClientRect();
    const scaleX = drawCanvas.width  / rect.width;
    const scaleY = drawCanvas.height / rect.height;
    return {
      x: (evt.clientX - rect.left) * scaleX,
      y: (evt.clientY - rect.top)  * scaleY,
    };
  }

  /** Snap world-space point to nearest grid intersection. */
  function snap(pos) {
    if (!state.snapEnabled) return pos;
    const s = state.gridSize;
    return { x: Math.round(pos.x / s) * s, y: Math.round(pos.y / s) * s };
  }

  /** Snap a direction to the nearest 15° increment. */
  function snapToAngle(from, to) {
    if (!state.snapAngle) return to;
    const dx   = to.x - from.x;
    const dy   = to.y - from.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 1) return to;
    const angle   = Math.atan2(dy, dx);
    const step    = Math.PI / 12; // 15°
    const snapped = Math.round(angle / step) * step;
    return { x: from.x + dist * Math.cos(snapped), y: from.y + dist * Math.sin(snapped) };
  }

  function setZoomAtScreenPoint(newZoom, sx, sy) {
    newZoom = Math.min(12, Math.max(0.05, newZoom));
    const worldBefore = screenToWorld(sx, sy);
    state.zoom = newZoom;
    const screenAfter = worldToScreen(worldBefore.x, worldBefore.y);
    state.panX += sx - screenAfter.x;
    state.panY += sy - screenAfter.y;
    document.getElementById('zoomLabel').textContent = Math.round(state.zoom * 100) + '%';
    drawGrid();
    render();
  }

  // =========================================================================
  // 5. GRID RENDERING
  // =========================================================================
  function drawGrid() {
    const w = gridCanvas.width, h = gridCanvas.height;
    gctx.setTransform(1, 0, 0, 1, 0, 0);
    gctx.clearRect(0, 0, w, h);
    // Background colour
    gctx.fillStyle = state.bgColor;
    gctx.fillRect(0, 0, w, h);
    if (!state.gridVisible) return;

    if (state.gridType === 'isometric') { drawIsometricGrid(); return; }

    const size       = state.gridSize;
    const topLeft    = screenToWorld(0, 0);
    const bottomRight= screenToWorld(w, h);
    const startCol   = Math.floor(topLeft.x    / size);
    const endCol     = Math.ceil (bottomRight.x / size);
    const startRow   = Math.floor(topLeft.y    / size);
    const endRow     = Math.ceil (bottomRight.y / size);

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

    // Square grid — vertical lines
    for (let col = startCol; col <= endCol; col++) {
      const isMajor = col % state.majorEvery === 0;
      const sx = Math.round(worldToScreen(col * size, 0).x) + 0.5;
      gctx.beginPath();
      gctx.moveTo(sx, 0);
      gctx.lineTo(sx, h);
      gctx.strokeStyle = isMajor ? state.majorColor : state.gridColor;
      gctx.lineWidth   = isMajor ? 1.5 : 1;
      gctx.stroke();
    }
    // Horizontal lines
    for (let row = startRow; row <= endRow; row++) {
      const isMajor = row % state.majorEvery === 0;
      const sy = Math.round(worldToScreen(0, row * size).y) + 0.5;
      gctx.beginPath();
      gctx.moveTo(0, sy);
      gctx.lineTo(w, sy);
      gctx.strokeStyle = isMajor ? state.majorColor : state.gridColor;
      gctx.lineWidth   = isMajor ? 1.5 : 1;
      gctx.stroke();
    }
  }

  function drawIsometricGrid() {
    const w = gridCanvas.width, h = gridCanvas.height;
    const size        = state.gridSize;
    const centerWorld = screenToWorld(w / 2, h / 2);
    const range       = Math.sqrt(w * w + h * h) / state.zoom / 2 + size * 4;
    [0, Math.PI / 3, -Math.PI / 3].forEach((angle) => {
      const cosA = Math.cos(angle), sinA = Math.sin(angle);
      const start = Math.floor(-range / size) * size;
      for (let k = start; k <= range; k += size) {
        const rot = (lx, ly) => ({
          x: centerWorld.x + lx * cosA - ly * sinA,
          y: centerWorld.y + lx * sinA + ly * cosA,
        });
        const sp1 = worldToScreen(rot(k, -range).x, rot(k, -range).y);
        const sp2 = worldToScreen(rot(k,  range).x, rot(k,  range).y);
        gctx.beginPath();
        gctx.moveTo(sp1.x, sp1.y);
        gctx.lineTo(sp2.x, sp2.y);
        const isMajor = Math.round(k / size) % state.majorEvery === 0;
        gctx.strokeStyle = isMajor ? state.majorColor : state.gridColor;
        gctx.lineWidth   = 1;
        gctx.stroke();
      }
    });
  }

  let gridRedrawQueued = false;
  function requestGridRedraw() {
    if (gridRedrawQueued) return;
    gridRedrawQueued = true;
    requestAnimationFrame(() => { gridRedrawQueued = false; drawGrid(); render(); });
  }

  // =========================================================================
  // 6. SHAPE FACTORY & UTILITIES
  // =========================================================================
  function currentStyle() {
    return {
      stroke     : state.strokeColor,
      strokeWidth: state.strokeWidth,
      fill       : state.fillColor,
      fillEnabled: state.fillEnabled,
      dash       : state.dash,
      opacity    : state.opacity,
    };
  }
  function makeShape(type, extra) {
    return Object.assign({ id: state.nextId++, type, style: currentStyle(), rotation: 0 }, extra);
  }
  function deepClone(obj) { return JSON.parse(JSON.stringify(obj)); }

  // =========================================================================
  // 7. PRIMITIVE DRAWING HELPERS
  // =========================================================================

  /** Draw the 10 vertices of a 5-pointed star. */
  function starPoints(cx, cy, outerR, innerR, n = 5) {
    const pts = [];
    for (let i = 0; i < n * 2; i++) {
      const r     = i % 2 === 0 ? outerR : innerR;
      const angle = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2;
      pts.push({ x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) });
    }
    return pts;
  }

  /** Draw a filled arrowhead pointing from (fromX,fromY) toward (toX,toY). */
  function drawArrowHead(ctx, fromX, fromY, toX, toY) {
    const angle = Math.atan2(toY - fromY, toX - fromX);
    const size  = Math.max(10, ctx.lineWidth * 3.5);
    ctx.beginPath();
    ctx.moveTo(toX, toY);
    ctx.lineTo(toX - size * Math.cos(angle - Math.PI / 6), toY - size * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(toX - size * Math.cos(angle + Math.PI / 6), toY - size * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fill();
  }

  /** Draw a rounded rectangle path (without fill/stroke). */
  function pathRoundRect(ctx, x, y, w, h, r) {
    if (w < 0) { x += w; w = -w; }
    if (h < 0) { y += h; h = -h; }
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y,     x + w, y + r,     r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h,     x, y + h - r,     r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y,         x + r, y,         r);
    ctx.closePath();
  }

  /** Return a cached HTMLImageElement for a base64 data-URL. */
  function getCachedImage(src) {
    if (!imageCache.has(src)) {
      const img = new Image();
      img.src    = src;
      img.onload = () => render(); // repaint once loaded
      imageCache.set(src, img);
    }
    return imageCache.get(src);
  }

  // =========================================================================
  // 8. STYLE APPLICATION
  // =========================================================================
  function applyStyle(ctx, style) {
    ctx.strokeStyle  = style.stroke;
    ctx.lineWidth    = style.strokeWidth;
    ctx.lineJoin     = 'round';
    ctx.lineCap      = 'round';
    ctx.fillStyle    = style.fill;
    ctx.globalAlpha  = (style.opacity !== undefined) ? style.opacity : 1;
    const w = style.strokeWidth || 2;
    if      (style.dash === 'dashed') ctx.setLineDash([w * 4,   w * 2  ]);
    else if (style.dash === 'dotted') ctx.setLineDash([w * 0.5, w * 2.5]);
    else                              ctx.setLineDash([]);
  }

  // =========================================================================
  // 9. RENDERING
  // =========================================================================
  function render() {
    const w = drawCanvas.width, h = drawCanvas.height;
    dctx.setTransform(1, 0, 0, 1, 0, 0);
    dctx.clearRect(0, 0, w, h);

    // Shapes in world space (camera applied as canvas transform)
    dctx.setTransform(state.zoom, 0, 0, state.zoom, state.panX, state.panY);
    state.shapes.forEach((shape) => drawShape(dctx, shape));
    if (state.draftShape) drawShape(dctx, state.draftShape);
    drawToolPreview(dctx);

    // Selection UI in constant screen space
    dctx.setTransform(1, 0, 0, 1, 0, 0);
    drawSelectionUI(dctx);
    if (state.marquee) drawMarquee(dctx);
  }

  function drawShape(ctx, shape) {
    ctx.save();
    if (shape.type !== 'group' && shape.type !== 'image') {
      applyStyle(ctx, shape.style);
    }

    // Rotation around bounding-box centre
    if (shape.rotation) {
      const b  = getBounds(shape);
      const cx = (b.x1 + b.x2) / 2, cy = (b.y1 + b.y2) / 2;
      ctx.translate(cx, cy);
      ctx.rotate(shape.rotation);
      ctx.translate(-cx, -cy);
    }

    switch (shape.type) {

      // ---- Pencil / Line -----------------------------------------------
      case 'pencil':
      case 'line': {
        if (shape.points.length < 2) break;
        ctx.beginPath();
        ctx.moveTo(shape.points[0].x, shape.points[0].y);
        for (let i = 1; i < shape.points.length; i++)
          ctx.lineTo(shape.points[i].x, shape.points[i].y);
        if (shape.closed) ctx.closePath();
        if (shape.closed && shape.style.fillEnabled) ctx.fill();
        ctx.stroke();
        break;
      }

      // ---- Rectangle ---------------------------------------------------
      case 'rect': {
        const x = Math.min(shape.x1, shape.x2), y = Math.min(shape.y1, shape.y2);
        const w = Math.abs(shape.x2 - shape.x1), h = Math.abs(shape.y2 - shape.y1);
        if (shape.style.fillEnabled) ctx.fillRect(x, y, w, h);
        ctx.strokeRect(x, y, w, h);
        break;
      }

      // ---- Rounded Rectangle -------------------------------------------
      case 'roundedrect': {
        const x = Math.min(shape.x1, shape.x2), y = Math.min(shape.y1, shape.y2);
        const w = Math.abs(shape.x2 - shape.x1), h = Math.abs(shape.y2 - shape.y1);
        pathRoundRect(ctx, x, y, w, h, shape.radius || 12);
        if (shape.style.fillEnabled) ctx.fill();
        ctx.stroke();
        break;
      }

      // ---- Circle / Ellipse -------------------------------------------
      case 'circle': {
        const cx = (shape.x1 + shape.x2) / 2, cy = (shape.y1 + shape.y2) / 2;
        const rx = Math.abs(shape.x2 - shape.x1) / 2;
        const ry = Math.abs(shape.y2 - shape.y1) / 2;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        if (shape.style.fillEnabled) ctx.fill();
        ctx.stroke();
        break;
      }

      // ---- Triangle ----------------------------------------------------
      case 'triangle': {
        const x1 = Math.min(shape.x1, shape.x2), y1 = Math.min(shape.y1, shape.y2);
        const x2 = Math.max(shape.x1, shape.x2), y2 = Math.max(shape.y1, shape.y2);
        ctx.beginPath();
        ctx.moveTo((x1 + x2) / 2, y1); // apex
        ctx.lineTo(x2, y2);
        ctx.lineTo(x1, y2);
        ctx.closePath();
        if (shape.style.fillEnabled) ctx.fill();
        ctx.stroke();
        break;
      }

      // ---- Diamond -----------------------------------------------------
      case 'diamond': {
        const x1 = Math.min(shape.x1, shape.x2), y1 = Math.min(shape.y1, shape.y2);
        const x2 = Math.max(shape.x1, shape.x2), y2 = Math.max(shape.y1, shape.y2);
        const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
        ctx.beginPath();
        ctx.moveTo(mx, y1);
        ctx.lineTo(x2, my);
        ctx.lineTo(mx, y2);
        ctx.lineTo(x1, my);
        ctx.closePath();
        if (shape.style.fillEnabled) ctx.fill();
        ctx.stroke();
        break;
      }

      // ---- Star --------------------------------------------------------
      case 'star': {
        const cx     = (shape.x1 + shape.x2) / 2, cy = (shape.y1 + shape.y2) / 2;
        const outerR = Math.max(Math.abs(shape.x2 - shape.x1), Math.abs(shape.y2 - shape.y1)) / 2;
        const innerR = outerR * 0.4;
        const pts    = starPoints(cx, cy, outerR, innerR);
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.closePath();
        if (shape.style.fillEnabled) ctx.fill();
        ctx.stroke();
        break;
      }

      // ---- Arrow -------------------------------------------------------
      case 'arrow': {
        ctx.beginPath();
        ctx.moveTo(shape.x1, shape.y1);
        ctx.lineTo(shape.x2, shape.y2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = shape.style.stroke; // arrowhead same colour as stroke
        if (shape.arrowEnd)   drawArrowHead(ctx, shape.x1, shape.y1, shape.x2, shape.y2);
        if (shape.arrowStart) drawArrowHead(ctx, shape.x2, shape.y2, shape.x1, shape.y1);
        break;
      }

      // ---- Bézier Curve ------------------------------------------------
      case 'curve': {
        ctx.beginPath();
        ctx.moveTo(shape.x1, shape.y1);
        ctx.quadraticCurveTo(shape.cx, shape.cy, shape.x2, shape.y2);
        ctx.stroke();
        break;
      }

      // ---- Text --------------------------------------------------------
      case 'text': {
        const alpha = (shape.style.opacity !== undefined) ? shape.style.opacity : 1;
        ctx.globalAlpha = alpha;
        ctx.font = `${shape.fontSize}px ${shape.fontFamily || 'sans-serif'}`;
        ctx.textBaseline = 'top';
        if (shape.outline) {
          ctx.lineWidth   = shape.style.strokeWidth;
          ctx.strokeStyle = shape.style.stroke;
          ctx.setLineDash([]);
          ctx.strokeText(shape.text, shape.x, shape.y);
        }
        ctx.fillStyle = shape.style.fill;
        ctx.fillText(shape.text, shape.x, shape.y);
        break;
      }

      // ---- Image -------------------------------------------------------
      case 'image': {
        const alpha = (shape.style && shape.style.opacity !== undefined) ? shape.style.opacity : 1;
        ctx.globalAlpha = alpha;
        const img = getCachedImage(shape.src);
        if (img.complete && img.naturalWidth > 0) {
          ctx.drawImage(img, shape.x, shape.y, shape.w, shape.h);
        } else {
          // Placeholder while loading
          ctx.fillStyle = '#e2e8f0';
          ctx.fillRect(shape.x, shape.y, shape.w, shape.h);
          ctx.strokeStyle = '#94a3b8';
          ctx.lineWidth = 1;
          ctx.setLineDash([]);
          ctx.strokeRect(shape.x, shape.y, shape.w, shape.h);
          ctx.fillStyle = '#94a3b8';
          ctx.font = `${Math.min(14, shape.h * 0.2)}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('Loading…', shape.x + shape.w / 2, shape.y + shape.h / 2);
          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';
        }
        break;
      }

      // ---- Group -------------------------------------------------------
      case 'group':
        shape.children.forEach((child) => drawShape(ctx, child));
        break;
    }

    ctx.restore();
  }

  // In-progress interactions not yet committed to state.shapes
  function drawToolPreview(ctx) {
    ctx.save();
    ctx.strokeStyle = state.strokeColor;
    ctx.lineWidth   = Math.max(1, state.strokeWidth);
    ctx.setLineDash([6 / state.zoom, 4 / state.zoom]);

    // Line / polygon tool preview
    if (state.polyActive && state.polyPoints.length > 0) {
      ctx.beginPath();
      ctx.moveTo(state.polyPoints[0].x, state.polyPoints[0].y);
      for (let i = 1; i < state.polyPoints.length; i++)
        ctx.lineTo(state.polyPoints[i].x, state.polyPoints[i].y);
      if (state.polyPreview) ctx.lineTo(state.polyPreview.x, state.polyPreview.y);
      ctx.stroke();
      // Vertex dots
      ctx.setLineDash([]);
      state.polyPoints.forEach((p, i) => {
        ctx.beginPath();
        ctx.fillStyle   = i === 0 ? '#6366f1' : '#ffffff';
        ctx.arc(p.x, p.y, 3.5 / state.zoom, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#6366f1';
        ctx.lineWidth   = 1.5 / state.zoom;
        ctx.stroke();
      });
    }

    // Curve tool preview
    if (state.curveDraft) {
      ctx.setLineDash([6 / state.zoom, 4 / state.zoom]);
      ctx.beginPath();
      if (state.curveStep === 1 && state.curvePreview) {
        ctx.moveTo(state.curveDraft.x1, state.curveDraft.y1);
        ctx.lineTo(state.curvePreview.x, state.curvePreview.y);
      } else if (state.curveStep === 2 && state.curvePreview) {
        ctx.moveTo(state.curveDraft.x1, state.curveDraft.y1);
        ctx.quadraticCurveTo(state.curvePreview.x, state.curvePreview.y,
                             state.curveDraft.x2, state.curveDraft.y2);
      }
      ctx.stroke();
    }

    ctx.restore();
  }

  // =========================================================================
  // 10. BOUNDING BOXES & HIT TESTING
  // =========================================================================
  function getBounds(shape) {
    switch (shape.type) {
      case 'pencil':
      case 'line': {
        const xs = shape.points.map((p) => p.x);
        const ys = shape.points.map((p) => p.y);
        return { x1: Math.min(...xs), y1: Math.min(...ys), x2: Math.max(...xs), y2: Math.max(...ys) };
      }
      case 'rect':
      case 'roundedrect':
      case 'circle':
      case 'triangle':
      case 'diamond':
      case 'star':
      case 'arrow':
        return {
          x1: Math.min(shape.x1, shape.x2), y1: Math.min(shape.y1, shape.y2),
          x2: Math.max(shape.x1, shape.x2), y2: Math.max(shape.y1, shape.y2),
        };
      case 'curve': {
        const xs = [shape.x1, shape.x2, shape.cx];
        const ys = [shape.y1, shape.y2, shape.cy];
        return { x1: Math.min(...xs), y1: Math.min(...ys), x2: Math.max(...xs), y2: Math.max(...ys) };
      }
      case 'text': {
        const approxW = shape.text.length * shape.fontSize * 0.6;
        return { x1: shape.x, y1: shape.y, x2: shape.x + approxW, y2: shape.y + shape.fontSize * 1.2 };
      }
      case 'image':
        return { x1: shape.x, y1: shape.y, x2: shape.x + shape.w, y2: shape.y + shape.h };
      case 'group': {
        const boxes = shape.children.map(getBounds);
        return {
          x1: Math.min(...boxes.map((b) => b.x1)), y1: Math.min(...boxes.map((b) => b.y1)),
          x2: Math.max(...boxes.map((b) => b.x2)), y2: Math.max(...boxes.map((b) => b.y2)),
        };
      }
      default: return { x1: 0, y1: 0, x2: 0, y2: 0 };
    }
  }

  function hitTest(worldPos) {
    const padding = 6 / state.zoom;
    for (let i = state.shapes.length - 1; i >= 0; i--) {
      const shape = state.shapes[i];
      const b     = getBounds(shape);
      if (worldPos.x >= b.x1 - padding && worldPos.x <= b.x2 + padding &&
          worldPos.y >= b.y1 - padding && worldPos.y <= b.y2 + padding) {
        return shape;
      }
    }
    return null;
  }

  // =========================================================================
  // 11. SELECTION UI
  // =========================================================================
  function drawSelectionUI(ctx) {
    state.selectedIds.forEach((id) => {
      const shape = state.shapes.find((s) => s.id === id);
      if (!shape) return;
      const b  = getBounds(shape);
      const p1 = worldToScreen(b.x1, b.y1);
      const p2 = worldToScreen(b.x2, b.y2);
      ctx.save();
      ctx.strokeStyle = '#6366f1';
      ctx.lineWidth   = 1;
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(
        Math.min(p1.x, p2.x) - 4, Math.min(p1.y, p2.y) - 4,
        Math.abs(p2.x - p1.x) + 8, Math.abs(p2.y - p1.y) + 8
      );
      ctx.restore();
    });

    if (state.selectedIds.length === 1) {
      const shape = state.shapes.find((s) => s.id === state.selectedIds[0]);
      if (shape && shape.type !== 'group') {
        const handles = getHandleScreenPositions(shape);
        ctx.save();
        ctx.fillStyle   = '#ffffff';
        ctx.strokeStyle = '#6366f1';
        ctx.lineWidth   = 1.5;
        ['nw', 'ne', 'se', 'sw'].forEach((k) => {
          const p = handles[k];
          ctx.fillRect(p.x - 4, p.y - 4, 8, 8);
          ctx.strokeRect(p.x - 4, p.y - 4, 8, 8);
        });
        ctx.beginPath();
        ctx.moveTo(handles.topMid.x, handles.topMid.y);
        ctx.lineTo(handles.rotate.x,  handles.rotate.y);
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
    const b      = getBounds(shape);
    const nw     = worldToScreen(b.x1, b.y1);
    const ne     = worldToScreen(b.x2, b.y1);
    const se     = worldToScreen(b.x2, b.y2);
    const sw     = worldToScreen(b.x1, b.y2);
    const topMid = worldToScreen((b.x1 + b.x2) / 2, b.y1);
    return { nw, ne, se, sw, topMid, rotate: { x: topMid.x, y: topMid.y - 26 } };
  }

  function drawMarquee(ctx) {
    const m = state.marquee;
    ctx.save();
    ctx.fillStyle   = 'rgba(99,102,241,0.08)';
    ctx.strokeStyle = '#6366f1';
    ctx.lineWidth   = 1;
    const x = Math.min(m.x1, m.x2), y = Math.min(m.y1, m.y2);
    ctx.fillRect(x, y, Math.abs(m.x2 - m.x1), Math.abs(m.y2 - m.y1));
    ctx.strokeRect(x, y, Math.abs(m.x2 - m.x1), Math.abs(m.y2 - m.y1));
    ctx.restore();
  }

  // =========================================================================
  // 12. TRANSFORM HELPERS
  // =========================================================================
  function translateShape(shape, dx, dy) {
    switch (shape.type) {
      case 'pencil':
      case 'line':
        shape.points = shape.points.map((p) => ({ x: p.x + dx, y: p.y + dy }));
        break;
      case 'rect':
      case 'roundedrect':
      case 'circle':
      case 'triangle':
      case 'diamond':
      case 'star':
      case 'arrow':
        shape.x1 += dx; shape.y1 += dy; shape.x2 += dx; shape.y2 += dy;
        break;
      case 'curve':
        shape.x1 += dx; shape.y1 += dy; shape.x2 += dx; shape.y2 += dy;
        shape.cx  += dx; shape.cy  += dy;
        break;
      case 'text':
        shape.x += dx; shape.y += dy;
        break;
      case 'image':
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
      case 'roundedrect':
      case 'circle':
      case 'triangle':
      case 'diamond':
      case 'star':
      case 'arrow':
        shape.x1 = sx(shape.x1); shape.y1 = sy(shape.y1);
        shape.x2 = sx(shape.x2); shape.y2 = sy(shape.y2);
        break;
      case 'curve':
        shape.x1 = sx(shape.x1); shape.y1 = sy(shape.y1);
        shape.x2 = sx(shape.x2); shape.y2 = sy(shape.y2);
        shape.cx = sx(shape.cx);  shape.cy = sy(shape.cy);
        break;
      case 'text':
        shape.x        = sx(shape.x); shape.y = sy(shape.y);
        shape.fontSize = Math.max(6, shape.fontSize * factor);
        break;
      case 'image': {
        shape.x = sx(shape.x); shape.y = sy(shape.y);
        shape.w *= factor;     shape.h *= factor;
        break;
      }
      case 'group':
        shape.children.forEach((c) => scaleShapeAboutCenter(c, center, factor));
        break;
    }
  }

  // =========================================================================
  // 13. UNDO / REDO + LOCAL AUTOSAVE
  // =========================================================================
  function pushHistory() {
    state.undoStack.push(JSON.stringify(state.shapes));
    if (state.undoStack.length > 100) state.undoStack.shift();
    state.redoStack = [];
  }
  function undo() {
    if (!state.undoStack.length) return;
    state.redoStack.push(JSON.stringify(state.shapes));
    state.shapes      = JSON.parse(state.undoStack.pop());
    state.selectedIds = [];
    saveLocal(); render();
  }
  function redo() {
    if (!state.redoStack.length) return;
    state.undoStack.push(JSON.stringify(state.shapes));
    state.shapes      = JSON.parse(state.redoStack.pop());
    state.selectedIds = [];
    saveLocal(); render();
  }

  let saveQueued = false;
  function saveLocal() {
    if (saveQueued) return;
    saveQueued = true;
    requestAnimationFrame(() => {
      saveQueued = false;
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          shapes: state.shapes, nextId: state.nextId,
        }));
      } catch (_) { /* quota exceeded — fail silently */ }
    });
  }
  function loadLocal() {
    try {
      const raw  = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      state.shapes  = data.shapes  || [];
      state.nextId  = data.nextId  || 1;
    } catch (_) { /* corrupt data — start fresh */ }
  }

  // =========================================================================
  // 14. POINTER INTERACTION
  // =========================================================================
  drawCanvas.addEventListener('contextmenu', (e) => e.preventDefault());
  drawCanvas.addEventListener('pointerdown', onPointerDown);
  drawCanvas.addEventListener('pointermove', onPointerMove);
  window  .addEventListener('pointerup',   onPointerUp);
  drawCanvas.addEventListener('wheel',       onWheel, { passive: false });
  drawCanvas.addEventListener('dblclick',    onDoubleClick);

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
    // Pan gesture
    if (isPanGesture(evt)) {
      state.panning   = true;
      state.panStart  = { x: evt.clientX, y: evt.clientY };
      state.panOrigin = { x: state.panX,  y: state.panY  };
      drawCanvas.classList.add('cursor-panning');
      return;
    }

    const screen = getScreenPos(evt);
    const raw    = getWorldPos(evt);
    const pos    = snap(raw);

    if (state.tool === 'select')  return handleSelectDown(screen, raw, evt);
    if (state.tool === 'eraser')  return handleEraserDown(raw);
    if (state.tool === 'fill')    return handleFillDown(raw);
    if (state.tool === 'text')    return openTextEditor(pos, screen);
    if (state.tool === 'image')   return handleImageDown(pos);
    if (state.tool === 'line')    return handleLineDown(pos);
    if (state.tool === 'curve')   return handleCurveDown(pos);

    // All drag-to-draw tools
    state.drawing = true;
    switch (state.tool) {
      case 'pencil':
        state.draftShape = makeShape('pencil', { points: [pos] });
        break;
      case 'arrow':
        state.draftShape = makeShape('arrow', {
          x1: pos.x, y1: pos.y, x2: pos.x, y2: pos.y,
          arrowStart: state.arrowHeads === 'start' || state.arrowHeads === 'both',
          arrowEnd  : state.arrowHeads === 'end'   || state.arrowHeads === 'both',
        });
        break;
      case 'rect':
        state.draftShape = makeShape('rect',  { x1: pos.x, y1: pos.y, x2: pos.x, y2: pos.y });
        break;
      case 'roundedrect':
        state.draftShape = makeShape('roundedrect', {
          x1: pos.x, y1: pos.y, x2: pos.x, y2: pos.y, radius: state.cornerRadius,
        });
        break;
      case 'circle':
        state.draftShape = makeShape('circle',   { x1: pos.x, y1: pos.y, x2: pos.x, y2: pos.y });
        break;
      case 'triangle':
        state.draftShape = makeShape('triangle', { x1: pos.x, y1: pos.y, x2: pos.x, y2: pos.y });
        break;
      case 'diamond':
        state.draftShape = makeShape('diamond',  { x1: pos.x, y1: pos.y, x2: pos.x, y2: pos.y });
        break;
      case 'star':
        state.draftShape = makeShape('star',     { x1: pos.x, y1: pos.y, x2: pos.x, y2: pos.y });
        break;
    }
    render();
  }

  function onPointerMove(evt) {
    // Update coordinate display
    const rawForCoord = getWorldPos(evt);
    if (coordXEl) coordXEl.textContent = Math.round(rawForCoord.x);
    if (coordYEl) coordYEl.textContent = Math.round(rawForCoord.y);

    if (state.panning) {
      const dx  = evt.clientX - state.panStart.x;
      const dy  = evt.clientY - state.panStart.y;
      state.panX = state.panOrigin.x + dx;
      state.panY = state.panOrigin.y + dy;
      requestGridRedraw();
      return;
    }

    const raw = getWorldPos(evt);
    const pos = snap(raw);

    if (state.tool === 'select' && state.dragMode)  { handleSelectDrag(raw, evt); return; }
    if (state.tool === 'select' && state.marquee)   {
      const screen = getScreenPos(evt);
      state.marquee.x2 = screen.x; state.marquee.y2 = screen.y;
      render(); return;
    }
    if (state.tool === 'line' && state.polyActive)  {
      const lastPt = state.polyPoints[state.polyPoints.length - 1];
      state.polyPreview = state.snapAngle ? snapToAngle(lastPt, pos) : pos;
      render(); return;
    }
    if (state.tool === 'curve' && state.curveDraft) { state.curvePreview = pos; render(); return; }

    if (!state.drawing || !state.draftShape) return;

    if (state.tool === 'pencil') {
      state.draftShape.points.push(pos);
    } else {
      // For arrow: apply angle snapping relative to start point
      let endPos = pos;
      if (state.tool === 'arrow' && state.snapAngle) {
        endPos = snapToAngle({ x: state.draftShape.x1, y: state.draftShape.y1 }, pos);
      }
      state.draftShape.x2 = endPos.x;
      state.draftShape.y2 = endPos.y;
    }
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
      if (state.marquee)  { finishMarquee();    return; }
    }
    if (!state.drawing) return;
    state.drawing = false;
    if (state.draftShape) {
      // Only commit shapes that have some actual size
      const b = getBounds(state.draftShape);
      const hasSize = (Math.abs(b.x2 - b.x1) > 1 || Math.abs(b.y2 - b.y1) > 1) ||
                       state.draftShape.type === 'pencil';
      if (hasSize) {
        pushHistory();
        state.shapes.push(state.draftShape);
        saveLocal();
      }
      state.draftShape = null;
      render();
    }
  }

  function onDoubleClick() {
    if (state.tool === 'line' && state.polyActive) finishPolygon(false);
  }

  // ---- Line / Polygon tool -----------------------------------------------
  function handleLineDown(pos) {
    // Apply angle snap relative to the previous point
    if (state.snapAngle && state.polyPoints.length > 0) {
      pos = snapToAngle(state.polyPoints[state.polyPoints.length - 1], pos);
    }

    if (!state.polyActive) {
      state.polyActive = true;
      state.polyPoints = [pos];
      render();
      return;
    }
    // Click near first vertex to close
    const first      = state.polyPoints[0];
    const screenFirst= worldToScreen(first.x, first.y);
    const screenPos  = worldToScreen(pos.x,   pos.y);
    if (Math.hypot(screenFirst.x - screenPos.x, screenFirst.y - screenPos.y) < 12 &&
        state.polyPoints.length >= 2) {
      finishPolygon(true);
      return;
    }
    state.polyPoints.push(pos);
    render();
  }

  function finishPolygon(closed) {
    if (state.polyPoints.length >= 2) {
      pushHistory();
      state.shapes.push(makeShape('line', { points: state.polyPoints.slice(), closed }));
      saveLocal();
    }
    state.polyActive  = false;
    state.polyPoints  = [];
    state.polyPreview = null;
    render();
  }

  // ---- Curve tool --------------------------------------------------------
  function handleCurveDown(pos) {
    if (state.curveStep === 0) {
      state.curveDraft = { x1: pos.x, y1: pos.y };
      state.curveStep  = 1;
    } else if (state.curveStep === 1) {
      state.curveDraft.x2 = pos.x; state.curveDraft.y2 = pos.y;
      state.curveStep      = 2;
    } else if (state.curveStep === 2) {
      state.curveDraft.cx = pos.x; state.curveDraft.cy = pos.y;
      pushHistory();
      state.shapes.push(makeShape('curve', state.curveDraft));
      saveLocal();
      state.curveDraft  = null;
      state.curveStep   = 0;
      state.curvePreview= null;
    }
    render();
  }
  function cancelCurve() {
    state.curveDraft   = null;
    state.curveStep    = 0;
    state.curvePreview = null;
    render();
  }

  // ---- Fill tool ---------------------------------------------------------
  function handleFillDown(raw) {
    const hit = hitTest(raw);
    if (!hit) return;
    pushHistory();
    hit.style.fill        = state.fillColor;
    hit.style.fillEnabled = true;
    saveLocal(); render();
  }

  // ---- Eraser tool -------------------------------------------------------
  function handleEraserDown(raw) {
    const hit = hitTest(raw);
    if (!hit) return;
    pushHistory();
    state.shapes      = state.shapes.filter((s) => s.id !== hit.id);
    state.selectedIds = state.selectedIds.filter((id) => id !== hit.id);
    saveLocal(); render();
  }

  // ---- Image tool --------------------------------------------------------
  function handleImageDown(pos) {
    imageFileInput.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      // Warn for very large images that may exhaust localStorage
      if (file.size > 500_000) {
        const ok = confirm(`This image is ${(file.size / 1024).toFixed(0)} KB. Large images may not autosave. Continue?`);
        if (!ok) { imageFileInput.value = ''; return; }
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        const src = ev.target.result;
        const img = new Image();
        img.onload = () => {
          // Scale to at most 600 wide/tall in world space
          const maxSide = 600;
          let w = img.naturalWidth, h = img.naturalHeight;
          if (w > maxSide || h > maxSide) {
            const scale = maxSide / Math.max(w, h);
            w = Math.round(w * scale); h = Math.round(h * scale);
          }
          pushHistory();
          state.shapes.push(makeShape('image', { x: pos.x, y: pos.y, w, h, src }));
          saveLocal(); render();
        };
        img.src = src;
      };
      reader.readAsDataURL(file);
      imageFileInput.value = '';
    };
    imageFileInput.click();
  }

  // ---- Select tool -------------------------------------------------------
  function handleSelectDown(screen, raw, evt) {
    // Check scale / rotate handles first
    if (state.selectedIds.length === 1) {
      const shape = state.shapes.find((s) => s.id === state.selectedIds[0]);
      if (shape && shape.type !== 'group') {
        const handles = getHandleScreenPositions(shape);
        const near    = (p) => Math.hypot(p.x - screen.x, p.y - screen.y) < 8;
        for (const key of ['nw', 'ne', 'se', 'sw']) {
          if (near(handles[key])) { beginScale(shape, key, raw); return; }
        }
        if (near(handles.rotate)) { beginRotate(shape, raw); return; }
      }
    }

    const hit = hitTest(raw);
    if (hit) {
      if (evt.shiftKey) {
        state.selectedIds = state.selectedIds.includes(hit.id)
          ? state.selectedIds.filter((id) => id !== hit.id)
          : [...state.selectedIds, hit.id];
      } else if (!state.selectedIds.includes(hit.id)) {
        state.selectedIds = [hit.id];
      }
      state.dragMode       = 'move';
      state.dragStartWorld = raw;
      state.dragOrigins    = state.selectedIds
        .map((id) => deepClone(state.shapes.find((s) => s.id === id)));
      render();
      return;
    }

    // Empty space → marquee
    if (!evt.shiftKey) state.selectedIds = [];
    state.marquee = { x1: screen.x, y1: screen.y, x2: screen.x, y2: screen.y };
    render();
  }

  function beginScale(shape, handleKey, raw) {
    const b              = getBounds(shape);
    state.dragMode       = 'scale';
    state.dragHandle     = handleKey;
    state.dragCenter     = { x: (b.x1 + b.x2) / 2, y: (b.y1 + b.y2) / 2 };
    state.dragOrigins    = [deepClone(shape)];
    state.dragStartWorld = raw;
    state.dragStartDist  = Math.hypot(raw.x - state.dragCenter.x, raw.y - state.dragCenter.y) || 1;
  }
  function beginRotate(shape, raw) {
    const b              = getBounds(shape);
    const center         = { x: (b.x1 + b.x2) / 2, y: (b.y1 + b.y2) / 2 };
    state.dragMode       = 'rotate';
    state.dragCenter     = center;
    state.dragOrigins    = [deepClone(shape)];
    state.dragStartAngle = Math.atan2(raw.y - center.y, raw.x - center.x) - (shape.rotation || 0);
  }

  function handleSelectDrag(raw) {
    if (state.dragMode === 'move') {
      let dx = raw.x - state.dragStartWorld.x;
      let dy = raw.y - state.dragStartWorld.y;
      if (state.snapEnabled) {
        const s = state.gridSize;
        dx = Math.round(dx / s) * s;
        dy = Math.round(dy / s) * s;
      }
      state.selectedIds.forEach((id, i) => {
        const shape  = state.shapes.find((s) => s.id === id);
        const origin = state.dragOrigins[i];
        Object.assign(shape, deepClone(origin));
        translateShape(shape, dx, dy);
      });
      render();
    } else if (state.dragMode === 'scale') {
      const shape  = state.shapes.find((s) => s.id === state.selectedIds[0]);
      const dist   = Math.hypot(raw.x - state.dragCenter.x, raw.y - state.dragCenter.y) || 1;
      const factor = dist / state.dragStartDist;
      Object.assign(shape, deepClone(state.dragOrigins[0]));
      scaleShapeAboutCenter(shape, state.dragCenter, factor);
      render();
    } else if (state.dragMode === 'rotate') {
      const shape  = state.shapes.find((s) => s.id === state.selectedIds[0]);
      shape.rotation = Math.atan2(raw.y - state.dragCenter.y, raw.x - state.dragCenter.x) - state.dragStartAngle;
      render();
    }
  }

  function finishSelectDrag() {
    pushHistory();
    state.dragMode    = null;
    state.dragOrigins = null;
    saveLocal();
  }

  function finishMarquee() {
    const m  = state.marquee;
    const x1 = Math.min(m.x1, m.x2), x2 = Math.max(m.x1, m.x2);
    const y1 = Math.min(m.y1, m.y2), y2 = Math.max(m.y1, m.y2);
    if (Math.abs(x2 - x1) > 3 || Math.abs(y2 - y1) > 3) {
      const worldTL = screenToWorld(x1, y1), worldBR = screenToWorld(x2, y2);
      const hits    = state.shapes.filter((shape) => {
        const b = getBounds(shape);
        return b.x1 <= worldBR.x && b.x2 >= worldTL.x &&
               b.y1 <= worldBR.y && b.y2 >= worldTL.y;
      });
      state.selectedIds = Array.from(new Set([...state.selectedIds, ...hits.map((s) => s.id)]));
    }
    state.marquee = null;
    render();
  }

  // =========================================================================
  // 15. TEXT TOOL
  // =========================================================================
  function openTextEditor(pos, screen) {
    textInput.style.left       = `${screen.x}px`;
    textInput.style.top        = `${screen.y}px`;
    textInput.style.fontSize   = `${Math.max(10, state.fontSize * state.zoom)}px`;
    textInput.style.fontFamily = state.fontFamily;
    textInput.style.color      = state.fillColor;
    textInput.value            = '';
    textInput.classList.remove('hidden');
    textInput.focus();

    function commit() {
      const value = textInput.value.trim();
      textInput.classList.add('hidden');
      textInput.removeEventListener('blur',    commit);
      textInput.removeEventListener('keydown', onKey);
      if (value.length > 0) {
        pushHistory();
        state.shapes.push(makeShape('text', {
          x: pos.x, y: pos.y, text: value,
          fontSize: state.fontSize, fontFamily: state.fontFamily, outline: state.textOutline,
        }));
        saveLocal(); render();
      }
    }
    function onKey(e) {
      if (e.key === 'Enter')  textInput.blur();
      if (e.key === 'Escape') { textInput.value = ''; textInput.blur(); }
    }
    textInput.addEventListener('blur',    commit);
    textInput.addEventListener('keydown', onKey);
  }

  // =========================================================================
  // 16. GROUP / UNGROUP
  // =========================================================================
  function groupSelection() {
    if (state.selectedIds.length < 2) return;
    pushHistory();
    const children = state.shapes.filter((s) =>  state.selectedIds.includes(s.id));
    state.shapes   = state.shapes.filter((s) => !state.selectedIds.includes(s.id));
    const group    = makeShape('group', { children });
    state.shapes.push(group);
    state.selectedIds = [group.id];
    saveLocal(); render();
  }
  function ungroupSelection() {
    if (state.selectedIds.length !== 1) return;
    const group = state.shapes.find((s) => s.id === state.selectedIds[0]);
    if (!group || group.type !== 'group') return;
    pushHistory();
    state.shapes   = state.shapes.filter((s) => s.id !== group.id);
    state.shapes.push(...group.children);
    state.selectedIds = group.children.map((c) => c.id);
    saveLocal(); render();
  }

  // =========================================================================
  // 17. Z-ORDER
  // =========================================================================
  function bringToFront() {
    if (!state.selectedIds.length) return;
    pushHistory();
    const sel   = state.shapes.filter((s) =>  state.selectedIds.includes(s.id));
    state.shapes= state.shapes.filter((s) => !state.selectedIds.includes(s.id));
    state.shapes.push(...sel);
    saveLocal(); render();
  }
  function sendToBack() {
    if (!state.selectedIds.length) return;
    pushHistory();
    const sel   = state.shapes.filter((s) =>  state.selectedIds.includes(s.id));
    state.shapes= state.shapes.filter((s) => !state.selectedIds.includes(s.id));
    state.shapes.unshift(...sel);
    saveLocal(); render();
  }
  function bringForward() {
    if (state.selectedIds.length !== 1) return;
    const id  = state.selectedIds[0];
    const idx = state.shapes.findIndex((s) => s.id === id);
    if (idx < 0 || idx >= state.shapes.length - 1) return;
    pushHistory();
    [state.shapes[idx], state.shapes[idx + 1]] = [state.shapes[idx + 1], state.shapes[idx]];
    saveLocal(); render();
  }
  function sendBackward() {
    if (state.selectedIds.length !== 1) return;
    const id  = state.selectedIds[0];
    const idx = state.shapes.findIndex((s) => s.id === id);
    if (idx <= 0) return;
    pushHistory();
    [state.shapes[idx], state.shapes[idx - 1]] = [state.shapes[idx - 1], state.shapes[idx]];
    saveLocal(); render();
  }

  // =========================================================================
  // 18. DUPLICATE
  // =========================================================================
  function duplicateSelection() {
    if (!state.selectedIds.length) return;
    pushHistory();
    const offset = state.gridSize;
    const newIds = [];
    state.selectedIds.forEach((id) => {
      const shape = state.shapes.find((s) => s.id === id);
      if (!shape) return;
      const copy = deepClone(shape);
      copy.id = state.nextId++;
      translateShape(copy, offset, offset);
      state.shapes.push(copy);
      newIds.push(copy.id);
    });
    state.selectedIds = newIds;
    saveLocal(); render();
  }

  // =========================================================================
  // 19. EXPORT (PNG / SVG) + PRINT
  // =========================================================================
  function exportPng() {
    const transparent = confirm('Transparent background?\n\nOK = transparent · Cancel = include grid/background.');
    const off  = document.createElement('canvas');
    off.width  = drawCanvas.width;
    off.height = drawCanvas.height;
    const octx = off.getContext('2d');
    if (!transparent) octx.drawImage(gridCanvas, 0, 0);
    octx.drawImage(drawCanvas, 0, 0);
    downloadUrl(off.toDataURL('image/png'), 'graph-paper.png');
  }

  function exportSvg() {
    const w = drawCanvas.width, h = drawCanvas.height;
    const topLeft     = screenToWorld(0, 0);
    const bottomRight = screenToWorld(w, h);
    const vw = bottomRight.x - topLeft.x;
    const vh = bottomRight.y - topLeft.y;
    const parts = [
      `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w}" height="${h}" viewBox="${topLeft.x} ${topLeft.y} ${vw} ${vh}">`,
      `<rect x="${topLeft.x}" y="${topLeft.y}" width="${vw}" height="${vh}" fill="${state.bgColor}"/>`,
    ];
    state.shapes.forEach((shape) => parts.push(shapeToSvg(shape)));
    parts.push('</svg>');
    const blob = new Blob([parts.join('\n')], { type: 'image/svg+xml' });
    downloadUrl(URL.createObjectURL(blob), 'graph-paper.svg');
  }

  // Helpers for SVG attribute strings
  function svgDash(style) {
    const w = style.strokeWidth || 2;
    if (style.dash === 'dashed') return ` stroke-dasharray="${w * 4},${w * 2}"`;
    if (style.dash === 'dotted') return ` stroke-dasharray="${w * 0.5},${w * 2.5}"`;
    return '';
  }
  function svgOpacity(style) {
    return (style.opacity !== undefined && style.opacity < 1) ? ` opacity="${style.opacity}"` : '';
  }
  function svgTransform(shape) {
    if (!shape.rotation) return '';
    const b  = getBounds(shape);
    const cx = (b.x1 + b.x2) / 2, cy = (b.y1 + b.y2) / 2;
    return ` transform="rotate(${(shape.rotation * 180 / Math.PI).toFixed(2)} ${cx} ${cy})"`;
  }
  function svgArrowHeadPoly(tx, ty, angle, size, color) {
    const f = (n) => n.toFixed(3);
    const x1 = tx - size * Math.cos(angle - Math.PI / 6);
    const y1 = ty - size * Math.sin(angle - Math.PI / 6);
    const x2 = tx - size * Math.cos(angle + Math.PI / 6);
    const y2 = ty - size * Math.sin(angle + Math.PI / 6);
    return `<polygon points="${f(tx)},${f(ty)} ${f(x1)},${f(y1)} ${f(x2)},${f(y2)}" fill="${color}"/>`;
  }

  function shapeToSvg(shape) {
    if (shape.type === 'group') return `<g>${shape.children.map(shapeToSvg).join('')}</g>`;
    const s    = shape.style;
    const fill = s.fillEnabled ? s.fill : 'none';
    const t    = svgTransform(shape);
    const d    = svgDash(s);
    const op   = svgOpacity(s);

    switch (shape.type) {
      case 'pencil':
      case 'line': {
        const pts = shape.points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ') + (shape.closed ? ' Z' : '');
        return `<path d="${pts}" fill="${shape.closed ? fill : 'none'}" stroke="${s.stroke}" stroke-width="${s.strokeWidth}" stroke-linecap="round" stroke-linejoin="round"${d}${op}${t}/>`;
      }
      case 'rect': {
        const x = Math.min(shape.x1, shape.x2), y = Math.min(shape.y1, shape.y2);
        const w = Math.abs(shape.x2 - shape.x1), h = Math.abs(shape.y2 - shape.y1);
        return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" stroke="${s.stroke}" stroke-width="${s.strokeWidth}"${d}${op}${t}/>`;
      }
      case 'roundedrect': {
        const x = Math.min(shape.x1, shape.x2), y = Math.min(shape.y1, shape.y2);
        const w = Math.abs(shape.x2 - shape.x1), h = Math.abs(shape.y2 - shape.y1);
        const r = shape.radius || 12;
        return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" ry="${r}" fill="${fill}" stroke="${s.stroke}" stroke-width="${s.strokeWidth}"${d}${op}${t}/>`;
      }
      case 'circle': {
        const cx = (shape.x1 + shape.x2) / 2, cy = (shape.y1 + shape.y2) / 2;
        const rx = Math.abs(shape.x2 - shape.x1) / 2, ry = Math.abs(shape.y2 - shape.y1) / 2;
        return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}" stroke="${s.stroke}" stroke-width="${s.strokeWidth}"${d}${op}${t}/>`;
      }
      case 'triangle': {
        const x1 = Math.min(shape.x1, shape.x2), y1 = Math.min(shape.y1, shape.y2);
        const x2 = Math.max(shape.x1, shape.x2), y2 = Math.max(shape.y1, shape.y2);
        const pts = `${(x1+x2)/2},${y1} ${x2},${y2} ${x1},${y2}`;
        return `<polygon points="${pts}" fill="${fill}" stroke="${s.stroke}" stroke-width="${s.strokeWidth}" stroke-linejoin="round"${d}${op}${t}/>`;
      }
      case 'diamond': {
        const x1 = Math.min(shape.x1, shape.x2), y1 = Math.min(shape.y1, shape.y2);
        const x2 = Math.max(shape.x1, shape.x2), y2 = Math.max(shape.y1, shape.y2);
        const pts = `${(x1+x2)/2},${y1} ${x2},${(y1+y2)/2} ${(x1+x2)/2},${y2} ${x1},${(y1+y2)/2}`;
        return `<polygon points="${pts}" fill="${fill}" stroke="${s.stroke}" stroke-width="${s.strokeWidth}"${d}${op}${t}/>`;
      }
      case 'star': {
        const cx = (shape.x1 + shape.x2) / 2, cy = (shape.y1 + shape.y2) / 2;
        const outerR = Math.max(Math.abs(shape.x2 - shape.x1), Math.abs(shape.y2 - shape.y1)) / 2;
        const pts    = starPoints(cx, cy, outerR, outerR * 0.4).map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');
        return `<polygon points="${pts}" fill="${fill}" stroke="${s.stroke}" stroke-width="${s.strokeWidth}"${d}${op}${t}/>`;
      }
      case 'arrow': {
        const angle  = Math.atan2(shape.y2 - shape.y1, shape.x2 - shape.x1);
        const size   = Math.max(10, s.strokeWidth * 3.5);
        let   result = `<line x1="${shape.x1}" y1="${shape.y1}" x2="${shape.x2}" y2="${shape.y2}" stroke="${s.stroke}" stroke-width="${s.strokeWidth}"${d}${op}${t}/>`;
        if (shape.arrowEnd)   result += svgArrowHeadPoly(shape.x2, shape.y2, angle,           size, s.stroke);
        if (shape.arrowStart) result += svgArrowHeadPoly(shape.x1, shape.y1, angle + Math.PI, size, s.stroke);
        return result;
      }
      case 'curve':
        return `<path d="M${shape.x1},${shape.y1} Q${shape.cx},${shape.cy} ${shape.x2},${shape.y2}" fill="none" stroke="${s.stroke}" stroke-width="${s.strokeWidth}"${d}${op}${t}/>`;
      case 'text':
        return `<text x="${shape.x}" y="${shape.y + shape.fontSize}" font-family="${shape.fontFamily || 'sans-serif'}" font-size="${shape.fontSize}" fill="${s.fill}"${shape.outline ? ` stroke="${s.stroke}" stroke-width="${s.strokeWidth}"` : ''}${op}${t}>${escapeXml(shape.text)}</text>`;
      case 'image':
        return `<image href="${shape.src}" x="${shape.x}" y="${shape.y}" width="${shape.w}" height="${shape.h}"${op}${t}/>`;
      default:
        return '';
    }
  }

  function escapeXml(str) {
    return str.replace(/[<>&'"]/g, (c) =>
      ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));
  }
  function downloadUrl(url, filename) {
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
  }

  // =========================================================================
  // 20. TOOL HINTS
  // =========================================================================
  const TOOL_HINTS = {
    select     : 'Click to select · Shift+click multi-select · Drag to marquee',
    pan        : 'Drag to pan the canvas',
    pencil     : 'Drag to draw freehand',
    line       : 'Click to place points · Enter/dblclick to close · Esc to finish',
    curve      : 'Click start → click end → click to set control point',
    arrow      : 'Drag to draw an arrow',
    rect       : 'Drag to draw a rectangle',
    roundedrect: 'Drag to draw a rounded rectangle',
    circle     : 'Drag to draw a circle / ellipse',
    triangle   : 'Drag to draw an isosceles triangle',
    diamond    : 'Drag to draw a diamond',
    star       : 'Drag to draw a 5-pointed star',
    fill       : 'Click a shape to apply the fill colour',
    text       : 'Click to place text · Enter to commit · Esc to cancel',
    image      : 'Click to insert an image from a file',
    eraser     : 'Click a shape to delete it',
  };

  // =========================================================================
  // 21. UI WIRING — TOOL BUTTONS
  // =========================================================================
  const toolButtons = document.querySelectorAll('.tool-btn[data-tool]');

  function setTool(tool) {
    if (state.tool === 'line'  && state.polyActive)  finishPolygon(false);
    if (state.tool === 'curve' && state.curveDraft)  cancelCurve();
    state.tool = tool;
    if (tool !== 'select') state.selectedIds = [];

    toolButtons.forEach((b) => b.classList.toggle('tool-active', b.dataset.tool === tool));

    // Context-sensitive toolbar panels
    const show = (id, visible) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.classList.toggle('hidden', !visible);
      el.classList.toggle('flex',   visible);
    };
    show('textControls',  tool === 'text');
    show('arrowControls', tool === 'arrow');

    // Cursor class
    drawCanvas.classList.remove('cursor-select','cursor-crosshair','cursor-text','cursor-eraser','cursor-pan');
    const cursorClass = ({ select:'cursor-select', text:'cursor-text', eraser:'cursor-eraser', pan:'cursor-pan' })[tool] || 'cursor-crosshair';
    drawCanvas.classList.add(cursorClass);

    // Status hint
    if (statusMsgEl) statusMsgEl.textContent = TOOL_HINTS[tool] || '';

    render();
  }

  toolButtons.forEach((btn) => btn.addEventListener('click', () => setTool(btn.dataset.tool)));

  // =========================================================================
  // 22. UI WIRING — KEYBOARD
  // =========================================================================
  const KEY_TO_TOOL = {
    v:'select', h:'pan',
    p:'pencil', l:'line', u:'curve', a:'arrow',
    r:'rect', k:'roundedrect', c:'circle',
    g:'triangle', d:'diamond', s:'star',
    b:'fill', t:'text', i:'image', e:'eraser',
  };

  window.addEventListener('keydown', (e) => {
    if (document.activeElement === textInput) return;

    // Space = temporary pan
    if (e.key === ' ') { state.spaceDown = true; drawCanvas.classList.add('cursor-pan'); return; }

    // Ctrl / Meta combos
    if (e.ctrlKey || e.metaKey) {
      if (e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); return; }
      if (e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }
      if (e.key.toLowerCase() === 'd') { e.preventDefault(); duplicateSelection(); return; }
      if (e.key.toLowerCase() === 'g') { e.preventDefault(); gotoCoordinate(); return; }
      if (e.key === ']') { e.preventDefault(); bringToFront(); return; }
      if (e.key === '[') { e.preventDefault(); sendToBack();   return; }
    }

    // Layer order (no ctrl)
    if (!e.ctrlKey && !e.metaKey) {
      if (e.key === ']') { bringForward(); return; }
      if (e.key === '[') { sendBackward(); return; }
    }

    // Line/polygon in-flight shortcuts
    if (state.tool === 'line' && state.polyActive) {
      if (e.key === 'Enter')     { finishPolygon(true);  return; }
      if (e.key === 'Escape')    { finishPolygon(false); return; }
      if (e.key === 'Backspace') {
        if (state.polyPoints.length > 1) state.polyPoints.pop();
        render(); return;
      }
    }
    if (state.tool === 'curve' && state.curveDraft && e.key === 'Escape') { cancelCurve(); return; }

    // Delete / Backspace on selected shapes
    if ((e.key === 'Delete' || e.key === 'Backspace') && state.selectedIds.length) {
      e.preventDefault();
      pushHistory();
      state.shapes      = state.shapes.filter((s) => !state.selectedIds.includes(s.id));
      state.selectedIds = [];
      saveLocal(); render();
      return;
    }

    // Tool hotkeys
    const tool = KEY_TO_TOOL[e.key.toLowerCase()];
    if (tool) setTool(tool);
  });

  window.addEventListener('keyup', (e) => {
    if (e.key === ' ') {
      state.spaceDown = false;
      if (state.tool !== 'pan') drawCanvas.classList.remove('cursor-pan');
    }
  });

  function gotoCoordinate() {
    const xStr = prompt('Go to X coordinate:', '0');
    if (xStr === null) return;
    const yStr = prompt('Go to Y coordinate:', '0');
    if (yStr === null) return;
    const x = parseFloat(xStr), y = parseFloat(yStr);
    if (Number.isNaN(x) || Number.isNaN(y)) return;
    state.panX = drawCanvas.width  / 2 - x * state.zoom;
    state.panY = drawCanvas.height / 2 - y * state.zoom;
    drawGrid(); render();
  }

  // =========================================================================
  // 23. UI WIRING — STYLE CONTROLS
  // =========================================================================
  document.getElementById('strokeColor').addEventListener('input',  (e) => { state.strokeColor = e.target.value; });
  document.getElementById('fillColor')  .addEventListener('input',  (e) => { state.fillColor   = e.target.value; });
  document.getElementById('fillEnabled').addEventListener('change', (e) => { state.fillEnabled  = e.target.checked; });
  document.getElementById('strokeWidth').addEventListener('input',  (e) => {
    state.strokeWidth = parseInt(e.target.value, 10);
    document.getElementById('strokeWidthLabel').textContent = e.target.value;
  });
  document.getElementById('dashPattern') .addEventListener('change', (e) => { state.dash      = e.target.value; });
  document.getElementById('opacitySlider').addEventListener('input', (e) => {
    state.opacity = parseInt(e.target.value, 10) / 100;
    document.getElementById('opacityLabel').textContent = e.target.value;
  });
  document.getElementById('arrowHeads') .addEventListener('change', (e) => { state.arrowHeads = e.target.value; });
  document.getElementById('fontFamily') .addEventListener('change', (e) => { state.fontFamily  = e.target.value; });
  document.getElementById('fontSize')   .addEventListener('change', (e) => { state.fontSize    = parseInt(e.target.value, 10); });
  document.getElementById('textOutline').addEventListener('change', (e) => { state.textOutline = e.target.checked; });

  // =========================================================================
  // 24. UI WIRING — GRID / SETUP
  // =========================================================================
  document.getElementById('gridType')   .addEventListener('change', (e) => { state.gridType    = e.target.value;              drawGrid(); });
  document.getElementById('gridVisible').addEventListener('change', (e) => { state.gridVisible  = e.target.checked;           drawGrid(); });
  document.getElementById('snapEnabled').addEventListener('change', (e) => { state.snapEnabled  = e.target.checked; });
  document.getElementById('snapAngle')  .addEventListener('change', (e) => { state.snapAngle    = e.target.checked; });
  document.getElementById('gridSize')   .addEventListener('input',  (e) => {
    state.gridSize = parseInt(e.target.value, 10);
    document.getElementById('gridSizeLabel').textContent = e.target.value;
    drawGrid();
  });
  document.getElementById('majorEvery') .addEventListener('input',  (e) => {
    const v = parseInt(e.target.value, 10);
    if (v >= 1) { state.majorEvery = v; drawGrid(); }
  });
  document.getElementById('gridColor')  .addEventListener('input',  (e) => { state.gridColor   = e.target.value; drawGrid(); });
  document.getElementById('majorColor') .addEventListener('input',  (e) => { state.majorColor  = e.target.value; drawGrid(); });
  document.getElementById('bgColor')    .addEventListener('input',  (e) => { state.bgColor     = e.target.value; drawGrid(); });

  // =========================================================================
  // 25. UI WIRING — VIEW
  // =========================================================================
  document.getElementById('zoomInBtn')   .addEventListener('click', () => setZoomAtScreenPoint(state.zoom * 1.25, drawCanvas.width / 2, drawCanvas.height / 2));
  document.getElementById('zoomOutBtn')  .addEventListener('click', () => setZoomAtScreenPoint(state.zoom / 1.25, drawCanvas.width / 2, drawCanvas.height / 2));
  document.getElementById('zoomResetBtn').addEventListener('click', () => setZoomAtScreenPoint(1,                 drawCanvas.width / 2, drawCanvas.height / 2));
  document.getElementById('gotoBtn')     .addEventListener('click', gotoCoordinate);

  // =========================================================================
  // 26. UI WIRING — HISTORY / LAYER / GROUP / EXPORT
  // =========================================================================
  document.getElementById('undoBtn')      .addEventListener('click', undo);
  document.getElementById('redoBtn')      .addEventListener('click', redo);
  document.getElementById('dupBtn')       .addEventListener('click', duplicateSelection);
  document.getElementById('bringFrontBtn').addEventListener('click', bringToFront);
  document.getElementById('bringFwdBtn')  .addEventListener('click', bringForward);
  document.getElementById('sendBkwdBtn')  .addEventListener('click', sendBackward);
  document.getElementById('sendBackBtn')  .addEventListener('click', sendToBack);
  document.getElementById('groupBtn')     .addEventListener('click', groupSelection);
  document.getElementById('ungroupBtn')   .addEventListener('click', ungroupSelection);

  document.getElementById('newSketchBtn').addEventListener('click', () => {
    if (state.shapes.length === 0) return;
    if (!confirm('Clear this sketch and start fresh? This cannot be undone.')) return;
    state.shapes      = [];
    state.selectedIds = [];
    state.undoStack   = [];
    state.redoStack   = [];
    try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
    render();
  });
  document.getElementById('printBtn')    .addEventListener('click', () => window.print());
  document.getElementById('exportPngBtn').addEventListener('click', exportPng);
  document.getElementById('exportSvgBtn').addEventListener('click', exportSvg);

  // =========================================================================
  // 27. INIT
  // =========================================================================
  loadLocal();
  setTool('select');
  resizeCanvases();

})();
