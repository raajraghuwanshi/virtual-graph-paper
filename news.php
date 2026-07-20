<?php
/**
 * news.php — What's New & Updates page
 */

$updates = [
    [
        'date' => 'April 29, 2026',
        'badge' => 'Feature',
        'title' => 'Teams & Folder Sharing',
        'content' => 'Subscribers and team members can now collaborate on sketches in shared folders. Team quotas allow turn-based sketch editing across shared workspaces.'
    ],
    [
        'date' => 'March 8, 2026',
        'badge' => 'Plugin',
        'title' => 'Grid Fill & Background Coloring',
        'content' => 'Coloring background grid cells is now supported! Enable the Grid Fill plugin under Setup → Grid to start filling cells on standard or isometric grids.'
    ],
    [
        'date' => 'August 10, 2025',
        'badge' => 'UI Update',
        'title' => 'Tool Icons & Compact Mode',
        'content' => 'Tool buttons now feature distinct visual icons! You can toggle between Icon+Text or Icon-Only modes to maximize your canvas drawing area.'
    ],
    [
        'date' => 'July 10, 2025',
        'badge' => 'Export',
        'title' => 'Advanced Export Controls & Transparent PNGs',
        'content' => 'Expanded export capabilities allow custom document dimension targeting, transparent background PNG exports, and diameter-based circle drawing.'
    ],
    [
        'date' => 'April 23, 2025',
        'badge' => 'Feature',
        'title' => 'Folder Organization',
        'content' => 'Organize your saved online and local sketches with custom folders and improved search.'
    ],
    [
        'date' => 'January 13, 2025',
        'badge' => 'Plugin',
        'title' => 'Dimensions Mode & Arc Drawing',
        'content' => 'Add precise dimension labels to lines and shapes on the grid. Added arc support for circles and layer opacity sliders.'
    ]
];
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>What's New — Virtual Graph Paper</title>
<meta name="description" content="Latest news, updates, and feature releases for Virtual Graph Paper.">
<script src="https://cdn.tailwindcss.com"></script>
<link rel="stylesheet" href="style.css">
</head>
<body class="bg-slate-50 text-slate-800 antialiased min-h-screen flex flex-col">

    <!-- Header Navigation -->
    <header class="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div class="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
            <a href="index.php" class="flex items-center gap-2 font-bold text-slate-800 text-lg hover:text-indigo-600 transition-colors">
                <span>📐</span>
                <span>Graph<span class="text-indigo-600">Paper</span></span>
            </a>
            <nav class="flex items-center gap-4 text-sm font-medium text-slate-600">
                <a href="index.php" class="hover:text-indigo-600 transition-colors flex items-center gap-1">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/></svg>
                    Back to Canvas
                </a>
                <a href="news.php" class="text-indigo-600 font-semibold">What's New</a>
                <a href="contact.php" class="hover:text-indigo-600 transition-colors">Contact</a>
                <a href="privacy.php" class="hover:text-indigo-600 transition-colors">Privacy</a>
                <a href="attribution.php" class="hover:text-indigo-600 transition-colors">Attribution</a>
            </nav>
        </div>
    </header>

    <!-- Main Content -->
    <main class="flex-1 max-w-4xl w-full mx-auto px-4 py-10">
        <div class="space-y-6">
            
            <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-6 md:p-8">
                <div class="inline-flex items-center gap-2 px-3 py-1 bg-indigo-50 text-indigo-700 text-xs font-semibold rounded-full mb-3">
                    <span>📰</span> Release Notes
                </div>
                <h1 class="text-3xl font-extrabold text-slate-900 tracking-tight">What's New in Virtual Graph Paper</h1>
                <p class="text-slate-500 mt-2 text-sm">Stay up to date with new drawing tools, plugins, and feature improvements.</p>
            </div>

            <!-- News list -->
            <div class="space-y-4">
                <?php foreach ($updates as $item): ?>
                    <article class="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow">
                        <div class="flex items-center justify-between gap-4 mb-2">
                            <span class="text-xs font-medium text-slate-400"><?= htmlspecialchars($item['date']) ?></span>
                            <span class="px-2.5 py-0.5 bg-slate-100 text-slate-700 text-xs font-semibold rounded-full"><?= htmlspecialchars($item['badge']) ?></span>
                        </div>
                        <h2 class="text-xl font-bold text-slate-900 mb-2"><?= htmlspecialchars($item['title']) ?></h2>
                        <p class="text-slate-600 text-sm leading-relaxed"><?= htmlspecialchars($item['content']) ?></p>
                    </article>
                <?php endforeach; ?>
            </div>

            <div class="pt-4 flex items-center justify-between">
                <a href="index.php" class="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium">
                    ← Return to Canvas
                </a>
                <span class="text-xs text-slate-400">Virtual Graph Paper Updates</span>
            </div>

        </div>
    </main>

    <!-- Footer -->
    <footer class="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500">
        <div class="max-w-5xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
            <div>Virtual Graph Paper — Free online infinite graph paper editor.</div>
            <div class="flex items-center gap-4">
                <a href="index.php" class="hover:text-indigo-600">Editor</a>
                <a href="news.php" class="hover:text-indigo-600 font-semibold text-indigo-600">What's New</a>
                <a href="contact.php" class="hover:text-indigo-600">Contact</a>
                <a href="privacy.php" class="hover:text-indigo-600">Privacy</a>
                <a href="attribution.php" class="hover:text-indigo-600">Attribution</a>
            </div>
        </div>
    </footer>
</body>
</html>
