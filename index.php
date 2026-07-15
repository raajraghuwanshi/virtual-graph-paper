<?php
/**
 * index.php — Virtual Graph Paper clone
 * Redesigned: labeled tool buttons, bottom leaderboard ad banner.
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
<meta name="description" content="Free virtual graph paper for drawing, sketching and diagramming. Infinite pan/zoom, multiple grid types, shapes, curves and export.">
<script src="https://cdn.tailwindcss.com"></script>
<link rel="stylesheet" href="style.css">
</head>
<body class="h-screen w-screen overflow-hidden bg-slate-100 text-slate-800 antialiased">

<!-- =====================================================================
     ROOT FLEX COLUMN: Header → Body → Ad Banner
====================================================================== -->
<div id="appRoot" class="flex h-full w-full flex-col">


    <!-- =================================================================
         ROW 1 — TOOLS BAR
    ================================================================== -->
    <header id="toolsBar" class="tools-bar shrink-0">

        <!-- Logo -->
        <div class="tools-logo">
            <span class="logo-icon">📐</span>
            <span class="logo-text">Graph<span class="logo-accent">Paper</span></span>
        </div>

        <div class="tools-vsep"></div>

        <!-- ---- NAVIGATE group ---- -->
        <div class="tool-group" aria-label="Navigate">
            <span class="tool-group-label">Navigate</span>
            <div class="tool-group-btns">
                <button data-tool="select" id="tool-select" class="tool-btn tool-active" title="Select / move shapes (V)">
                    <span class="tool-icon">🖱️</span><span class="tool-label">Select</span>
                </button>
                <button data-tool="pan" id="tool-pan" class="tool-btn" title="Pan canvas (H · Space+drag)">
                    <span class="tool-icon">✋</span><span class="tool-label">Pan</span>
                </button>
            </div>
        </div>

        <div class="tools-vsep"></div>

        <!-- ---- DRAW group ---- -->
        <div class="tool-group" aria-label="Draw">
            <span class="tool-group-label">Draw</span>
            <div class="tool-group-btns">
                <button data-tool="pencil" id="tool-pencil" class="tool-btn" title="Freehand pencil (P)">
                    <span class="tool-icon">✏️</span><span class="tool-label">Pencil</span>
                </button>
                <button data-tool="line" id="tool-line" class="tool-btn" title="Line / Polygon (L) — click pts, Enter to close">
                    <span class="tool-icon">📏</span><span class="tool-label">Line</span>
                </button>
                <button data-tool="curve" id="tool-curve" class="tool-btn" title="Curve (U) — start → end → control pt">
                    <span class="tool-icon">〰️</span><span class="tool-label">Curve</span>
                </button>
                <button data-tool="arrow" id="tool-arrow" class="tool-btn" title="Arrow (A) — drag to draw">
                    <span class="tool-icon">➡️</span><span class="tool-label">Arrow</span>
                </button>
            </div>
        </div>

        <div class="tools-vsep"></div>

        <!-- ---- SHAPES group ---- -->
        <div class="tool-group" aria-label="Shapes">
            <span class="tool-group-label">Shapes</span>
            <div class="tool-group-btns">
                <button data-tool="rect" id="tool-rect" class="tool-btn" title="Rectangle (R)">
                    <span class="tool-icon tool-sym">▭</span><span class="tool-label">Rect</span>
                </button>
                <button data-tool="roundedrect" id="tool-roundedrect" class="tool-btn" title="Rounded Rectangle (K)">
                    <span class="tool-icon tool-sym">▢</span><span class="tool-label">Round</span>
                </button>
                <button data-tool="circle" id="tool-circle" class="tool-btn" title="Circle / Ellipse (C)">
                    <span class="tool-icon tool-sym">◯</span><span class="tool-label">Circle</span>
                </button>
                <button data-tool="triangle" id="tool-triangle" class="tool-btn" title="Triangle (G)">
                    <span class="tool-icon tool-sym">△</span><span class="tool-label">Triangle</span>
                </button>
                <button data-tool="diamond" id="tool-diamond" class="tool-btn" title="Diamond (D)">
                    <span class="tool-icon tool-sym">◇</span><span class="tool-label">Diamond</span>
                </button>
                <button data-tool="star" id="tool-star" class="tool-btn" title="Star (S)">
                    <span class="tool-icon tool-sym">☆</span><span class="tool-label">Star</span>
                </button>
            </div>
        </div>

        <div class="tools-vsep"></div>

        <!-- ---- UTILITIES group ---- -->
        <div class="tool-group" aria-label="Utilities">
            <span class="tool-group-label">Utilities</span>
            <div class="tool-group-btns">
                <button data-tool="fill" id="tool-fill" class="tool-btn" title="Fill bucket (B)">
                    <span class="tool-icon">🪣</span><span class="tool-label">Fill</span>
                </button>
                <button data-tool="text" id="tool-text" class="tool-btn" title="Text (T)">
                    <span class="tool-icon">🔤</span><span class="tool-label">Text</span>
                </button>
                <button data-tool="image" id="tool-image" class="tool-btn" title="Insert Image (I)">
                    <span class="tool-icon">🖼️</span><span class="tool-label">Image</span>
                </button>
                <button data-tool="eraser" id="tool-eraser" class="tool-btn" title="Eraser — click shape to delete (E)">
                    <span class="tool-icon">🧹</span><span class="tool-label">Eraser</span>
                </button>
            </div>
        </div>

        <!-- Push export buttons to the right -->
        <div class="ml-auto flex items-center gap-2 pl-3 shrink-0">
            <button id="newSketchBtn" class="hdr-btn hdr-btn-ghost" title="New sketch">New</button>
            <button id="printBtn"     class="hdr-btn hdr-btn-ghost" title="Print (Ctrl+P)">Print</button>
            <button id="exportPngBtn" class="hdr-btn hdr-btn-primary">Export PNG</button>
            <button id="exportSvgBtn" class="hdr-btn hdr-btn-outline">Export SVG</button>
        </div>

    </header><!-- /toolsBar -->


    <!-- =================================================================
         ROW 2 — STYLE & ACTIONS BAR
    ================================================================== -->
    <div id="styleBar" class="style-bar shrink-0">

        <!-- Style controls -->
        <div class="style-group">
            <label class="style-item">
                <span class="style-label">Stroke</span>
                <input id="strokeColor" type="color" value="#1e293b" class="color-swatch" title="Stroke colour">
            </label>
            <label class="style-item">
                <span class="style-label">Fill</span>
                <input id="fillColor" type="color" value="#93c5fd" class="color-swatch" title="Fill colour">
                <input id="fillEnabled" type="checkbox" class="toggle-check ml-1" title="Enable fill">
            </label>
            <label class="style-item">
                <span class="style-label">Width</span>
                <input id="strokeWidth" type="range" min="1" max="20" value="2" class="slider w-20">
                <b id="strokeWidthLabel" class="style-val">2</b>
            </label>
            <label class="style-item">
                <span class="style-label">Dash</span>
                <select id="dashPattern" class="style-select">
                    <option value="solid">━━ Solid</option>
                    <option value="dashed">╌╌ Dashed</option>
                    <option value="dotted">·· Dotted</option>
                </select>
            </label>
            <label class="style-item">
                <span class="style-label">Opacity</span>
                <input id="opacitySlider" type="range" min="10" max="100" value="100" class="slider w-16">
                <b id="opacityLabel" class="style-val">100%</b>
            </label>

            <!-- Arrow-tool contextual controls -->
            <span id="arrowControls" class="hidden items-center gap-2 style-item">
                <span class="style-label">Arrowheads</span>
                <select id="arrowHeads" class="style-select">
                    <option value="end">→ End only</option>
                    <option value="both">↔ Both ends</option>
                    <option value="start">← Start only</option>
                    <option value="none">── None</option>
                </select>
            </span>

            <!-- Text-tool contextual controls -->
            <span id="textControls" class="hidden items-center gap-2 style-item">
                <span class="style-label">Font</span>
                <select id="fontFamily" class="style-select">
                    <option value="sans-serif">Sans</option>
                    <option value="serif">Serif</option>
                    <option value="monospace">Mono</option>
                    <option value="cursive">Cursive</option>
                </select>
                <select id="fontSize" class="style-select w-14">
                    <option>12</option><option selected>18</option><option>24</option><option>36</option><option>48</option>
                </select>
                <label class="flex items-center gap-1 text-slate-500 text-xs">
                    <input id="textOutline" type="checkbox" class="toggle-check"> Outline
                </label>
            </span>
        </div>

        <div class="style-vsep"></div>

        <!-- Edit actions -->
        <div class="style-group gap-1">
            <button id="undoBtn"  class="act-btn" title="Undo (Ctrl+Z)"><span class="act-icon">↶</span><span class="act-label">Undo</span></button>
            <button id="redoBtn"  class="act-btn" title="Redo (Ctrl+Y)"><span class="act-icon">↷</span><span class="act-label">Redo</span></button>
            <button id="dupBtn"   class="act-btn" title="Duplicate (Ctrl+D)"><span class="act-icon">⧉</span><span class="act-label">Dup</span></button>
        </div>

        <div class="style-vsep"></div>

        <!-- Z-order actions -->
        <div class="style-group gap-1">
            <button id="bringFrontBtn" class="act-btn" title="Bring to Front (Ctrl+])"><span class="act-icon">⬆</span><span class="act-label">Front</span></button>
            <button id="bringFwdBtn"   class="act-btn" title="Bring Forward (])"><span class="act-icon">↑</span><span class="act-label">Fwd</span></button>
            <button id="sendBkwdBtn"   class="act-btn" title="Send Backward ([)"><span class="act-icon">↓</span><span class="act-label">Bkwd</span></button>
            <button id="sendBackBtn"   class="act-btn" title="Send to Back (Ctrl+[)"><span class="act-icon">⬇</span><span class="act-label">Back</span></button>
        </div>

        <div class="style-vsep"></div>

        <!-- Group -->
        <div class="style-group gap-1">
            <button id="groupBtn"   class="act-btn" title="Group selected shapes (Ctrl+Shift+G)"><span class="act-icon">⛓️</span><span class="act-label">Group</span></button>
            <button id="ungroupBtn" class="act-btn" title="Ungroup"><span class="act-icon">🔓</span><span class="act-label">Ungroup</span></button>
        </div>

    </div><!-- /styleBar -->


    <!-- =================================================================
         MAIN AREA: Sidebar + Canvas
    ================================================================== -->
    <div class="flex flex-1 overflow-hidden min-h-0">

        <!-- ---- Left sidebar (settings) ---- -->
        <aside class="sidebar flex flex-col border-r border-slate-200 bg-white text-xs overflow-y-auto shrink-0">
            <div class="p-3 space-y-3">

                <div>
                    <h2 class="sidebar-heading">Setup</h2>

                    <label class="sidebar-label">Grid type</label>
                    <select id="gridType" class="sidebar-select mb-2">
                        <option value="square"    <?= $defaults['gridType']==='square'?'selected':'' ?>>Square grid</option>
                        <option value="dots"      <?= $defaults['gridType']==='dots'?'selected':'' ?>>Dot grid</option>
                        <option value="isometric" <?= $defaults['gridType']==='isometric'?'selected':'' ?>>Isometric grid</option>
                    </select>

                    <label class="sidebar-toggle mb-1"><span>Show grid</span>
                        <input id="gridVisible" type="checkbox" checked class="toggle-check"></label>
                    <label class="sidebar-toggle mb-1"><span>Snap to grid</span>
                        <input id="snapEnabled" type="checkbox" checked class="toggle-check"></label>
                    <label class="sidebar-toggle mb-2"><span>Snap to 15° angles</span>
                        <input id="snapAngle" type="checkbox" class="toggle-check"></label>

                    <label class="sidebar-label">Grid size: <span id="gridSizeLabel"><?= (int)$defaults['gridSize'] ?></span>px</label>
                    <input id="gridSize" type="range" min="5" max="80"
                           value="<?= (int)$defaults['gridSize'] ?>" class="w-full cursor-pointer mb-2">

                    <label class="sidebar-label flex items-center justify-between">
                        <span>Major every</span>
                        <input id="majorEvery" type="number" min="1" max="20"
                               value="<?= (int)$defaults['majorEvery'] ?>"
                               class="sidebar-num-input w-12 text-right"> cells
                    </label>

                    <div class="flex gap-1.5 mt-2">
                        <div class="flex-1 text-center">
                            <div class="text-slate-400 mb-0.5 text-center">Grid</div>
                            <input id="gridColor" type="color" value="<?= htmlspecialchars($defaults['gridColor']) ?>"
                                   class="h-7 w-full cursor-pointer border-0 p-0 rounded">
                        </div>
                        <div class="flex-1 text-center">
                            <div class="text-slate-400 mb-0.5 text-center">Major</div>
                            <input id="majorColor" type="color" value="<?= htmlspecialchars($defaults['majorColor']) ?>"
                                   class="h-7 w-full cursor-pointer border-0 p-0 rounded">
                        </div>
                        <div class="flex-1 text-center">
                            <div class="text-slate-400 mb-0.5 text-center">BG</div>
                            <input id="bgColor" type="color" value="<?= htmlspecialchars($defaults['bgColor']) ?>"
                                   class="h-7 w-full cursor-pointer border-0 p-0 rounded">
                        </div>
                    </div>
                </div>

                <hr class="border-slate-200">

                <div>
                    <h2 class="sidebar-heading">View</h2>
                    <div class="flex items-center gap-1 mb-1">
                        <button id="zoomOutBtn"   class="zoom-btn">−</button>
                        <button id="zoomResetBtn" class="zoom-reset" title="Reset zoom">
                            <span id="zoomLabel">100%</span>
                        </button>
                        <button id="zoomInBtn"    class="zoom-btn">+</button>
                    </div>
                    <button id="gotoBtn" class="w-full rounded border border-slate-200 py-1 text-slate-600 hover:bg-slate-50 text-xs">
                        Go to coordinate…
                    </button>
                </div>

                <hr class="border-slate-200">

                <div>
                    <h2 class="sidebar-heading">Shortcuts</h2>
                    <ul class="space-y-1 text-slate-500 leading-relaxed">
                        <li><kbd class="kbd">V</kbd> Select &nbsp;·&nbsp; <kbd class="kbd">H</kbd> Pan</li>
                        <li><kbd class="kbd">P</kbd> Pencil &nbsp;·&nbsp; <kbd class="kbd">L</kbd> Line &nbsp;·&nbsp; <kbd class="kbd">U</kbd> Curve</li>
                        <li><kbd class="kbd">A</kbd> Arrow &nbsp;·&nbsp; <kbd class="kbd">R</kbd> Rect &nbsp;·&nbsp; <kbd class="kbd">C</kbd> Circle</li>
                        <li><kbd class="kbd">K</kbd> Rounded &nbsp;·&nbsp; <kbd class="kbd">G</kbd> Triangle</li>
                        <li><kbd class="kbd">D</kbd> Diamond &nbsp;·&nbsp; <kbd class="kbd">S</kbd> Star &nbsp;·&nbsp; <kbd class="kbd">I</kbd> Image</li>
                        <li><kbd class="kbd">B</kbd> Fill &nbsp;·&nbsp; <kbd class="kbd">T</kbd> Text &nbsp;·&nbsp; <kbd class="kbd">E</kbd> Eraser</li>
                        <li><kbd class="kbd">Ctrl+Z</kbd> Undo &nbsp;·&nbsp; <kbd class="kbd">Ctrl+Y</kbd> Redo</li>
                        <li><kbd class="kbd">Ctrl+D</kbd> Duplicate</li>
                        <li><kbd class="kbd">[</kbd>&nbsp;<kbd class="kbd">]</kbd> Layer order &nbsp;·&nbsp; <kbd class="kbd">Del</kbd> Delete</li>
                        <li>Scroll = zoom &nbsp;·&nbsp; Right-drag = pan</li>
                    </ul>
                    <p class="mt-3 text-slate-400 leading-relaxed">
                        Sketch autosaves locally. No cloud / account needed.
                    </p>
                </div>

            </div>
        </aside><!-- /aside -->


        <!-- ---- Canvas area ---- -->
        <main class="relative flex-1 overflow-hidden flex flex-col bg-slate-200 min-w-0">

            <div id="canvasWrap" class="flex-1 relative overflow-hidden">
                <canvas id="gridLayer"></canvas>
                <canvas id="drawLayer"></canvas>
            </div>

            <!-- Hidden inputs -->
            <input id="textInput" type="text"
                   class="absolute z-30 hidden border border-indigo-400 bg-white/90 px-1 outline-none"
                   style="font-family: sans-serif;">
            <input id="imageFileInput" type="file" accept="image/*" class="hidden">

            <!-- Coordinate / status bar -->
            <div id="statusBar" class="coord-bar shrink-0">
                <span class="coord-pair">
                    X:&nbsp;<b id="coordX">0</b>&nbsp;&nbsp;Y:&nbsp;<b id="coordY">0</b>
                </span>
                <span id="statusMsg" class="status-msg truncate"></span>
                <span class="ml-auto text-slate-400 hidden md:inline text-xs">Scroll = zoom &nbsp;·&nbsp; Right-drag = pan</span>
            </div>

        </main><!-- /main -->

    </div><!-- /body row -->


    <!-- =================================================================
         FULL-WIDTH ADVERTISEMENT BANNER
         ---------------------------------------------------------------
         Placed below the entire app as a leaderboard-style slot.
         Replace the .ad-placeholder-leaderboard content with your
         actual ad code (e.g. Google AdSense <ins> tag).
    ================================================================== -->
    <div id="bottomAdBanner" class="bottom-ad-banner shrink-0">
        <span class="bottom-ad-label">Advertisement</span>

        <!-- ▼▼ REPLACE THE DIV BELOW WITH YOUR AD CODE ▼▼ -->
        <div class="ad-placeholder-leaderboard" role="complementary" aria-label="Advertisement">
            <div class="ad-lb-inner">
                <span class="ad-lb-icon">📣</span>
                <div class="ad-lb-text">
                    <div class="ad-lb-title">Your Leaderboard Ad Here</div>
                    <div class="ad-lb-dims">728 × 90 &nbsp;|&nbsp; Responsive banner</div>
                </div>
                <div class="ad-lb-cta">Advertise on this site →</div>
            </div>
        </div>
        <!-- ▲▲ END AD CODE ▲▲ -->
    </div>


</div><!-- /#appRoot -->

<script>
    window.APP_CONFIG = <?= json_encode($defaults, JSON_UNESCAPED_SLASHES) ?>;
</script>
<script src="app.js"></script>
</body>
</html>
