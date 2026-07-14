<?php
/**
 * index.php
 * Virtual Graph Paper clone — entry point.
 * Server side is intentionally minimal; all logic lives in app.js.
 */
$defaults = [
    'gridSize'   => 20,
    'majorEvery' => 5,
    'gridColor'  => '#B9C4D0',
    'majorColor' => '#8FA0B3',
    'bgColor'    => '#ffffff',
    'gridType'   => 'square',
];
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Graph Paper — Free Online Infinite Drawing Grid</title>
<meta name="description" content="Free virtual graph paper for drawing, sketching, and diagramming. Infinite pan and zoom, multiple grid types, shapes, curves, and export.">
<script src="https://cdn.tailwindcss.com"></script>
<link rel="stylesheet" href="style.css">
</head>
<body class="h-screen w-screen overflow-hidden bg-slate-100 text-slate-800 antialiased">

<div class="flex h-full w-full flex-col">

    <!-- ============================================================
         TOP BAR
    ============================================================ -->
    <header class="flex flex-wrap items-center gap-2 border-b border-slate-300 bg-white px-2 py-1.5 shadow-sm z-20 shrink-0">

        <!-- Logo -->
        <h1 class="text-sm font-semibold tracking-tight text-slate-700 select-none shrink-0 pr-1">
            📐 Graph<span class="text-indigo-500">Paper</span>
        </h1>

        <div class="h-5 w-px bg-slate-200 shrink-0"></div>

        <!-- ---- Drawing tools ---- -->
        <div id="toolbar" class="flex flex-wrap items-center gap-0.5" role="toolbar" aria-label="Drawing tools">

            <!-- Navigate -->
            <button data-tool="select"      id="tool-select"      class="tool-btn tool-active" title="Select (V)">🖱️</button>
            <button data-tool="pan"         id="tool-pan"         class="tool-btn" title="Pan (H · Space+drag)">✋</button>
            <span class="tool-sep"></span>

            <!-- Freeform -->
            <button data-tool="pencil"      id="tool-pencil"      class="tool-btn" title="Freehand pencil (P)">✏️</button>
            <button data-tool="line"        id="tool-line"        class="tool-btn" title="Line / Polygon (L) — click pts, Enter to close">📏</button>
            <button data-tool="curve"       id="tool-curve"       class="tool-btn" title="Curve (U) — click start, end, then control pt">〰️</button>
            <button data-tool="arrow"       id="tool-arrow"       class="tool-btn" title="Arrow (A) — drag to draw">➡️</button>
            <span class="tool-sep"></span>

            <!-- Shapes -->
            <button data-tool="rect"        id="tool-rect"        class="tool-btn" title="Rectangle (R)">▭</button>
            <button data-tool="roundedrect" id="tool-roundedrect" class="tool-btn tool-symbol" title="Rounded Rectangle (K)">▢</button>
            <button data-tool="circle"      id="tool-circle"      class="tool-btn" title="Circle / Ellipse (C)">◯</button>
            <button data-tool="triangle"    id="tool-triangle"    class="tool-btn tool-symbol" title="Triangle (G)">△</button>
            <button data-tool="diamond"     id="tool-diamond"     class="tool-btn tool-symbol" title="Diamond (D)">◇</button>
            <button data-tool="star"        id="tool-star"        class="tool-btn tool-symbol" title="Star (S)">☆</button>
            <span class="tool-sep"></span>

            <!-- Utility -->
            <button data-tool="fill"        id="tool-fill"        class="tool-btn" title="Fill bucket (B)">🪣</button>
            <button data-tool="text"        id="tool-text"        class="tool-btn" title="Text (T)">🔤</button>
            <button data-tool="image"       id="tool-image"       class="tool-btn" title="Insert image (I)">🖼️</button>
            <button data-tool="eraser"      id="tool-eraser"      class="tool-btn" title="Eraser (E)">🧹</button>
        </div>

        <div class="h-5 w-px bg-slate-200 shrink-0"></div>

        <!-- ---- Style controls ---- -->
        <div class="flex flex-wrap items-center gap-2 text-xs">

            <label class="flex items-center gap-1">
                <span class="text-slate-500">Stroke</span>
                <input id="strokeColor" type="color" value="#1e293b"
                       class="h-6 w-7 cursor-pointer rounded border-0 bg-transparent p-0">
            </label>

            <label class="flex items-center gap-1">
                <span class="text-slate-500">Fill</span>
                <input id="fillColor" type="color" value="#93c5fd"
                       class="h-6 w-7 cursor-pointer rounded border-0 bg-transparent p-0">
                <input id="fillEnabled" type="checkbox" class="cursor-pointer" title="Enable fill colour">
            </label>

            <label class="flex items-center gap-1">
                <span class="text-slate-500">W</span>
                <input id="strokeWidth" type="range" min="1" max="20" value="2" class="w-14 cursor-pointer">
                <span id="strokeWidthLabel" class="w-4 text-slate-500 text-right">2</span>
            </label>

            <label class="flex items-center gap-1">
                <span class="text-slate-500">Dash</span>
                <select id="dashPattern" class="rounded border border-slate-300 px-1 py-0.5 text-xs bg-white">
                    <option value="solid">━━</option>
                    <option value="dashed">╌╌</option>
                    <option value="dotted">···</option>
                </select>
            </label>

            <label class="flex items-center gap-1">
                <span class="text-slate-500">α%</span>
                <input id="opacitySlider" type="range" min="10" max="100" value="100" class="w-12 cursor-pointer">
                <span id="opacityLabel" class="w-6 text-slate-500 text-right">100</span>
            </label>

            <!-- Arrow-tool controls (hidden unless arrow tool active) -->
            <span id="arrowControls" class="hidden items-center gap-1">
                <span class="text-slate-500">Heads</span>
                <select id="arrowHeads" class="rounded border border-slate-300 px-1 py-0.5 text-xs bg-white">
                    <option value="end">→ End</option>
                    <option value="both">↔ Both</option>
                    <option value="start">← Start</option>
                    <option value="none">— None</option>
                </select>
            </span>

            <!-- Text-tool controls (hidden unless text tool active) -->
            <span id="textControls" class="hidden items-center gap-2">
                <select id="fontFamily" class="rounded border border-slate-300 px-1 py-0.5 text-xs bg-white">
                    <option value="sans-serif">Sans</option>
                    <option value="serif">Serif</option>
                    <option value="monospace">Mono</option>
                    <option value="cursive">Cursive</option>
                </select>
                <select id="fontSize" class="rounded border border-slate-300 px-1 py-0.5 text-xs bg-white">
                    <option>12</option><option selected>18</option><option>24</option><option>36</option><option>48</option>
                </select>
                <label class="flex items-center gap-1 text-slate-500" title="Draw stroke outline around text">
                    <input id="textOutline" type="checkbox"> Outline
                </label>
            </span>
        </div>

        <div class="h-5 w-px bg-slate-200 shrink-0"></div>

        <!-- ---- History / Layer / Group buttons ---- -->
        <div class="flex items-center gap-0.5">
            <button id="undoBtn"       class="tool-btn" title="Undo (Ctrl+Z)">↶</button>
            <button id="redoBtn"       class="tool-btn" title="Redo (Ctrl+Y)">↷</button>
            <button id="dupBtn"        class="tool-btn" title="Duplicate (Ctrl+D)" style="font-size:0.8rem">⧉</button>
            <span class="tool-sep"></span>
            <button id="bringFrontBtn" class="tool-btn" title="Bring to Front (Ctrl+])" style="font-size:0.7rem">⬆</button>
            <button id="bringFwdBtn"   class="tool-btn" title="Bring Forward (])" style="font-size:0.7rem">↑</button>
            <button id="sendBkwdBtn"   class="tool-btn" title="Send Backward ([)" style="font-size:0.7rem">↓</button>
            <button id="sendBackBtn"   class="tool-btn" title="Send to Back (Ctrl+[)" style="font-size:0.7rem">⬇</button>
            <span class="tool-sep"></span>
            <button id="groupBtn"      class="tool-btn" title="Group selected (Ctrl+Shift+G)">⛓️</button>
            <button id="ungroupBtn"    class="tool-btn" title="Ungroup">🔓</button>
        </div>

        <!-- ---- Right-side actions ---- -->
        <div class="ml-auto flex items-center gap-1.5 shrink-0">
            <button id="newSketchBtn" class="rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 transition-colors">New</button>
            <button id="printBtn"     class="rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 transition-colors">Print</button>
            <button id="exportPngBtn" class="rounded bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-indigo-700 transition-colors">PNG</button>
            <button id="exportSvgBtn" class="rounded border border-indigo-600 px-2.5 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50 transition-colors">SVG</button>
        </div>

    </header><!-- /header -->


    <!-- ============================================================
         BODY  —  Sidebar + Canvas
    ============================================================ -->
    <div class="flex flex-1 overflow-hidden">

        <!-- ---- Left sidebar ---- -->
        <aside class="sidebar flex flex-col border-r border-slate-300 bg-white text-xs overflow-y-auto">

            <div class="p-3 space-y-3 flex-1">

                <!-- Setup section -->
                <div>
                    <h2 class="sidebar-heading">Setup</h2>

                    <label class="sidebar-label">Grid type</label>
                    <select id="gridType" class="sidebar-select mb-2">
                        <option value="square"    <?= $defaults['gridType']==='square'?'selected':'' ?>>Square</option>
                        <option value="dots"      <?= $defaults['gridType']==='dots'?'selected':'' ?>>Dot grid</option>
                        <option value="isometric" <?= $defaults['gridType']==='isometric'?'selected':'' ?>>Isometric</option>
                    </select>

                    <label class="sidebar-toggle mb-1">
                        <span>Show grid</span>
                        <input id="gridVisible" type="checkbox" checked class="toggle-check">
                    </label>
                    <label class="sidebar-toggle mb-1">
                        <span>Snap to grid</span>
                        <input id="snapEnabled" type="checkbox" checked class="toggle-check">
                    </label>
                    <label class="sidebar-toggle mb-2">
                        <span>Snap to 15° angles</span>
                        <input id="snapAngle" type="checkbox" class="toggle-check">
                    </label>

                    <label class="sidebar-label">Grid size: <span id="gridSizeLabel"><?= (int)$defaults['gridSize'] ?></span>px</label>
                    <input id="gridSize" type="range" min="5" max="80"
                           value="<?= (int)$defaults['gridSize'] ?>" class="w-full cursor-pointer mb-2">

                    <label class="sidebar-label">Major every
                        <input id="majorEvery" type="number" min="1" max="20"
                               value="<?= (int)$defaults['majorEvery'] ?>"
                               class="sidebar-num-input ml-1 w-12">
                        cells
                    </label>

                    <!-- Colour trio -->
                    <div class="flex gap-1.5 mt-2">
                        <div class="flex-1 text-center">
                            <div class="text-slate-400 mb-0.5">Grid</div>
                            <input id="gridColor" type="color"
                                   value="<?= htmlspecialchars($defaults['gridColor']) ?>"
                                   class="h-7 w-full cursor-pointer border-0 p-0 rounded">
                        </div>
                        <div class="flex-1 text-center">
                            <div class="text-slate-400 mb-0.5">Major</div>
                            <input id="majorColor" type="color"
                                   value="<?= htmlspecialchars($defaults['majorColor']) ?>"
                                   class="h-7 w-full cursor-pointer border-0 p-0 rounded">
                        </div>
                        <div class="flex-1 text-center">
                            <div class="text-slate-400 mb-0.5">BG</div>
                            <input id="bgColor" type="color"
                                   value="<?= htmlspecialchars($defaults['bgColor']) ?>"
                                   class="h-7 w-full cursor-pointer border-0 p-0 rounded">
                        </div>
                    </div>
                </div>

                <hr class="border-slate-200">

                <!-- View section -->
                <div>
                    <h2 class="sidebar-heading">View</h2>
                    <div class="flex items-center gap-1 mb-1">
                        <button id="zoomOutBtn"   class="tool-btn flex-none" title="Zoom out (−)">−</button>
                        <button id="zoomResetBtn"
                                class="flex-1 rounded border border-slate-300 py-1 text-slate-600 hover:bg-slate-50 text-center text-xs transition-colors"
                                title="Reset zoom (0)">
                            <span id="zoomLabel">100%</span>
                        </button>
                        <button id="zoomInBtn"    class="tool-btn flex-none" title="Zoom in (+)">+</button>
                    </div>
                    <button id="gotoBtn"
                            class="w-full rounded border border-slate-300 py-1 text-slate-600 hover:bg-slate-50 text-center text-xs transition-colors"
                            title="Go to coordinate (Ctrl+G)">Go to coordinate…</button>
                </div>

                <hr class="border-slate-200">

                <!-- Shortcuts -->
                <div>
                    <h2 class="sidebar-heading">Shortcuts</h2>
                    <ul class="space-y-1 text-slate-500 leading-relaxed">
                        <li><kbd class="kbd">V</kbd> Select &nbsp;·&nbsp; <kbd class="kbd">H</kbd> Pan</li>
                        <li><kbd class="kbd">P</kbd> Pencil &nbsp;·&nbsp; <kbd class="kbd">L</kbd> Line &nbsp;·&nbsp; <kbd class="kbd">U</kbd> Curve</li>
                        <li><kbd class="kbd">A</kbd> Arrow &nbsp;·&nbsp; <kbd class="kbd">R</kbd> Rect &nbsp;·&nbsp; <kbd class="kbd">C</kbd> Circle</li>
                        <li><kbd class="kbd">K</kbd> Rounded Rect &nbsp;·&nbsp; <kbd class="kbd">G</kbd> Triangle</li>
                        <li><kbd class="kbd">D</kbd> Diamond &nbsp;·&nbsp; <kbd class="kbd">S</kbd> Star &nbsp;·&nbsp; <kbd class="kbd">I</kbd> Image</li>
                        <li><kbd class="kbd">B</kbd> Fill &nbsp;·&nbsp; <kbd class="kbd">T</kbd> Text &nbsp;·&nbsp; <kbd class="kbd">E</kbd> Eraser</li>
                        <li><kbd class="kbd">Ctrl+Z</kbd> Undo &nbsp;·&nbsp; <kbd class="kbd">Ctrl+Y</kbd> Redo</li>
                        <li><kbd class="kbd">Ctrl+D</kbd> Duplicate</li>
                        <li><kbd class="kbd">[</kbd>&nbsp;<kbd class="kbd">]</kbd> Layer order &nbsp;·&nbsp; <kbd class="kbd">Del</kbd> Delete</li>
                        <li>Scroll = zoom &nbsp;·&nbsp; Right-drag = pan</li>
                    </ul>

                    <p class="mt-3 text-slate-400 leading-relaxed">
                        Sketch autosaves locally in this browser. No account or cloud storage.
                    </p>
                </div>

            </div><!-- /flex-1 content -->


            <!-- ================================================================
                 ADVERTISEMENT SLOT
                 ----------------------------------------------------------------
                 This block is placed at the bottom of the sidebar — a high-
                 visibility, non-intrusive position that stays in view while the
                 user works without covering the canvas.

                 To display a real ad, replace the inner div with your ad code
                 (e.g. Google AdSense <ins> tag).
            ================================================================ -->
            <div class="ad-slot shrink-0 border-t border-slate-200 p-3">
                <p class="text-center text-slate-400 tracking-widest uppercase text-xs mb-2 font-medium">Advertisement</p>
                <!-- ▼▼ REPLACE EVERYTHING BELOW WITH YOUR AD CODE ▼▼ -->
                <div class="ad-placeholder" role="complementary" aria-label="Advertisement">
                    <div class="ad-inner">
                        <div class="ad-icon">📢</div>
                        <div class="ad-label">Your Ad Here</div>
                        <div class="ad-dims">300 × 250</div>
                        <div class="ad-cta">Advertise on this site</div>
                    </div>
                </div>
                <!-- ▲▲ END AD CODE ▲▲ -->
            </div>

        </aside><!-- /aside -->


        <!-- ---- Canvas area ---- -->
        <main class="relative flex-1 overflow-hidden flex flex-col bg-slate-200">

            <!-- Canvas layers -->
            <div id="canvasWrap" class="flex-1 relative overflow-hidden">
                <canvas id="gridLayer"></canvas>
                <canvas id="drawLayer"></canvas>
            </div>

            <!-- Hidden: text in-place editor -->
            <input id="textInput" type="text"
                   class="absolute z-30 hidden border border-indigo-400 bg-white/90 px-1 outline-none"
                   style="font-family: sans-serif;">

            <!-- Hidden: image file picker -->
            <input id="imageFileInput" type="file" accept="image/*" class="hidden">

            <!-- ---- Status / Coordinate bar ---- -->
            <div id="statusBar" class="coord-bar shrink-0">
                <span class="flex items-center gap-3 font-mono">
                    X:&nbsp;<b id="coordX">0</b>
                    Y:&nbsp;<b id="coordY">0</b>
                </span>
                <span id="statusMsg" class="ml-4 text-slate-400 truncate"></span>
                <span class="ml-auto text-slate-400 hidden sm:inline">Scroll = zoom &nbsp;·&nbsp; Right-drag = pan</span>
            </div>

        </main><!-- /main -->

    </div><!-- /body row -->

</div><!-- /app root -->

<script>
    window.APP_CONFIG = <?= json_encode($defaults, JSON_UNESCAPED_SLASHES) ?>;
</script>
<script src="app.js"></script>
</body>
</html>
