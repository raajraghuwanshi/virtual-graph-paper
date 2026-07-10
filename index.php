<?php
/**
 * index.php
 * ---------------------------------------------------------------------
 * Entry point. Server-side responsibilities are intentionally minimal:
 * serve the shell HTML and pass a handful of tunable defaults into JS.
 * There is no session, database, or account system. The "local sketch"
 * concept (see app.js) is implemented with the browser's localStorage,
 * which is a client-side feature, not a server one — nothing is ever
 * sent to this PHP file after the initial page load.
 */
$defaults = [
    'gridSize'   => 20,
    'majorEvery' => 5,
    'gridColor'  => '#B9C4D0',
    'majorColor' => '#8FA0B3',
    'gridType'   => 'square', // square | dots | isometric
];
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Graph Paper — Free Online Drawing Grid</title>
<script src="https://cdn.tailwindcss.com"></script>
<link rel="stylesheet" href="style.css">
</head>
<body class="h-screen w-screen overflow-hidden bg-slate-100 text-slate-800 antialiased">

<div class="flex h-full w-full flex-col">

    <!-- ============ TOP BAR ============ -->
    <header class="flex flex-wrap items-center gap-3 border-b border-slate-300 bg-white px-3 py-2 shadow-sm z-20">
        <h1 class="text-lg font-semibold tracking-tight text-slate-700 select-none shrink-0">
            📐 Graph<span class="text-indigo-500">Paper</span>
        </h1>

        <div class="h-6 w-px bg-slate-200 shrink-0"></div>

        <!-- Drawing tools -->
        <div id="toolbar" class="flex flex-wrap items-center gap-1" role="toolbar" aria-label="Drawing tools">
            <button data-tool="select" class="tool-btn tool-active" title="Select (V) — click, shift-click, or drag a marquee">🖱️</button>
            <button data-tool="pan"    class="tool-btn" title="Pan (Space+drag or right-drag also works)">✋</button>
            <button data-tool="pencil" class="tool-btn" title="Freehand pencil (P)">✏️</button>
            <button data-tool="line"   class="tool-btn" title="Line / Polygon (L) — click to add points, Enter to close, Esc to finish">📏</button>
            <button data-tool="curve"  class="tool-btn" title="Curve (U) — click start, end, then drag the bulge">〰️</button>
            <button data-tool="rect"   class="tool-btn" title="Rectangle (R)">▭</button>
            <button data-tool="circle" class="tool-btn" title="Circle / Ellipse (C)">◯</button>
            <button data-tool="fill"   class="tool-btn" title="Fill bucket (B) — click a shape to apply the fill color">🪣</button>
            <button data-tool="text"   class="tool-btn" title="Text (T)">🔤</button>
            <button data-tool="eraser" class="tool-btn" title="Eraser (E)">🧹</button>
        </div>

        <div class="h-6 w-px bg-slate-200 shrink-0"></div>

        <!-- Style controls -->
        <div class="flex items-center gap-3 text-sm">
            <label class="flex items-center gap-1">
                <span class="text-slate-500">Stroke</span>
                <input id="strokeColor" type="color" value="#1e293b" class="h-7 w-8 cursor-pointer border-0 bg-transparent p-0">
            </label>
            <label class="flex items-center gap-1">
                <span class="text-slate-500">Fill</span>
                <input id="fillColor" type="color" value="#93c5fd" class="h-7 w-8 cursor-pointer border-0 bg-transparent p-0">
                <input id="fillEnabled" type="checkbox" class="ml-1 cursor-pointer" title="Enable fill for new shapes">
            </label>
            <label class="flex items-center gap-1">
                <span class="text-slate-500">Width</span>
                <input id="strokeWidth" type="range" min="1" max="20" value="2" class="w-16 cursor-pointer">
                <span id="strokeWidthLabel" class="w-5 text-slate-500">2</span>
            </label>
            <!-- Text-tool-only controls, hidden unless the Text tool is active -->
            <span id="textControls" class="hidden items-center gap-2">
                <select id="fontFamily" class="rounded border border-slate-300 p-1">
                    <option value="sans-serif">Sans</option>
                    <option value="serif">Serif</option>
                    <option value="monospace">Mono</option>
                    <option value="cursive">Cursive</option>
                </select>
                <select id="fontSize" class="rounded border border-slate-300 p-1">
                    <option>12</option><option selected>18</option><option>24</option><option>36</option><option>48</option>
                </select>
                <label class="flex items-center gap-1 text-slate-500" title="Draw an outline around the text using the stroke color">
                    <input id="textOutline" type="checkbox"> Outline
                </label>
            </span>
        </div>

        <div class="h-6 w-px bg-slate-200 shrink-0"></div>

        <div class="flex items-center gap-1">
            <button id="undoBtn" class="tool-btn" title="Undo (Ctrl+Z)">↶</button>
            <button id="redoBtn" class="tool-btn" title="Redo (Ctrl+Y)">↷</button>
            <button id="groupBtn" class="tool-btn" title="Group selected shapes">⛓️</button>
            <button id="ungroupBtn" class="tool-btn" title="Ungroup selected group">🔓</button>
        </div>

        <div class="ml-auto flex items-center gap-2">
            <button id="newSketchBtn" class="rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-600 hover:bg-slate-50">New sketch</button>
            <button id="printBtn" class="rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-600 hover:bg-slate-50">Print</button>
            <button id="exportPngBtn" class="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700">Export PNG</button>
            <button id="exportSvgBtn" class="rounded-md border border-indigo-600 px-3 py-1.5 text-sm font-medium text-indigo-600 hover:bg-indigo-50">Export SVG</button>
        </div>
    </header>

    <!-- ============ BODY: sidebar + canvas ============ -->
    <div class="flex flex-1 overflow-hidden">

        <!-- ---- Left sidebar: grid / view / setup ---- -->
        <aside class="w-64 shrink-0 overflow-y-auto border-r border-slate-300 bg-white p-4 text-sm">
            <h2 class="mb-3 font-semibold text-slate-600">Setup</h2>

            <label class="mb-1 block text-slate-500">Grid type</label>
            <select id="gridType" class="mb-3 w-full rounded border border-slate-300 p-1">
                <option value="square"    <?= $defaults['gridType']==='square'?'selected':'' ?>>Square</option>
                <option value="dots"      <?= $defaults['gridType']==='dots'?'selected':'' ?>>Dot grid</option>
                <option value="isometric" <?= $defaults['gridType']==='isometric'?'selected':'' ?>>Isometric</option>
            </select>

            <label class="mb-3 flex items-center justify-between">
                <span>Show grid</span>
                <input id="gridVisible" type="checkbox" checked class="cursor-pointer">
            </label>

            <label class="mb-3 flex items-center justify-between">
                <span>Snap to grid</span>
                <input id="snapEnabled" type="checkbox" checked class="cursor-pointer">
            </label>

            <label class="mb-1 block text-slate-500">Grid size (px)</label>
            <input id="gridSize" type="range" min="5" max="80"
                   value="<?= (int)$defaults['gridSize'] ?>" class="mb-3 w-full cursor-pointer">

            <label class="mb-1 block text-slate-500">Grid color</label>
            <input id="gridColor" type="color"
                   value="<?= htmlspecialchars($defaults['gridColor']) ?>"
                   class="mb-4 h-8 w-full cursor-pointer border-0 p-0">

            <h2 class="mb-2 font-semibold text-slate-600">View</h2>
            <div class="mb-1 flex items-center gap-2">
                <button id="zoomOutBtn" class="tool-btn" title="Zoom out">−</button>
                <button id="zoomResetBtn" class="flex-1 rounded border border-slate-300 py-1 text-slate-600 hover:bg-slate-50" title="Reset zoom">
                    <span id="zoomLabel">100%</span>
                </button>
                <button id="zoomInBtn" class="tool-btn" title="Zoom in">+</button>
            </div>
            <button id="gotoBtn" class="mb-4 mt-2 w-full rounded border border-slate-300 py-1 text-slate-600 hover:bg-slate-50" title="Ctrl+G">Go to coordinate…</button>

            <hr class="my-4 border-slate-200">

            <h2 class="mb-2 font-semibold text-slate-600">Keyboard shortcuts</h2>
            <ul class="space-y-1 text-slate-500">
                <li><kbd class="kbd">V</kbd> Select · <kbd class="kbd">Space</kbd>+drag Pan</li>
                <li><kbd class="kbd">P</kbd> Pencil · <kbd class="kbd">L</kbd> Line/Polygon</li>
                <li><kbd class="kbd">U</kbd> Curve · <kbd class="kbd">R</kbd> Rect · <kbd class="kbd">C</kbd> Circle</li>
                <li><kbd class="kbd">B</kbd> Fill · <kbd class="kbd">T</kbd> Text · <kbd class="kbd">E</kbd> Eraser</li>
                <li><kbd class="kbd">Enter</kbd> close polygon · <kbd class="kbd">Esc</kbd> finish</li>
                <li><kbd class="kbd">Backspace</kbd> remove last point (while drawing)</li>
                <li><kbd class="kbd">Delete</kbd> remove selected shape(s)</li>
                <li><kbd class="kbd">Ctrl+Z</kbd> / <kbd class="kbd">Ctrl+Y</kbd> Undo / Redo</li>
                <li><kbd class="kbd">Ctrl+G</kbd> Go to coordinate</li>
                <li>Scroll wheel to zoom, right-drag to pan</li>
            </ul>

            <p class="mt-6 text-xs leading-relaxed text-slate-400">
                Your sketch autosaves to this browser only (a "local sketch",
                just like the free tier of the site this clones). Clearing
                site data or switching browsers will lose it — there's no
                account system or cloud storage here.
            </p>
        </aside>

        <!-- ---- Canvas area (infinite pan/zoom surface) ---- -->
        <main class="relative flex-1 overflow-hidden bg-slate-200">
            <div id="canvasWrap">
                <canvas id="gridLayer"></canvas>
                <canvas id="drawLayer"></canvas>
            </div>

            <!-- Hidden text input used by the Text tool for in-place editing -->
            <input id="textInput" type="text"
                   class="absolute z-30 hidden border border-indigo-400 bg-white/90 px-1 outline-none"
                   style="font-family: sans-serif;">
        </main>
    </div>
</div>

<script>
    window.APP_CONFIG = <?= json_encode($defaults, JSON_UNESCAPED_SLASHES) ?>;
</script>
<script src="app.js"></script>
</body>
</html>
