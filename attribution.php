<?php
/**
 * attribution.php — Open-Source Attribution page
 */
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Open-Source Attribution — Virtual Graph Paper</title>
<meta name="description" content="Open-source software licenses and acknowledgments for Virtual Graph Paper.">
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
                <a href="news.php" class="hover:text-indigo-600 transition-colors">What's New</a>
                <a href="contact.php" class="hover:text-indigo-600 transition-colors">Contact</a>
                <a href="privacy.php" class="hover:text-indigo-600 transition-colors">Privacy</a>
                <a href="attribution.php" class="text-indigo-600 font-semibold">Attribution</a>
            </nav>
        </div>
    </header>

    <!-- Main Content -->
    <main class="flex-1 max-w-4xl w-full mx-auto px-4 py-10">
        <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-6 md:p-10 space-y-6">
            
            <div class="border-b border-slate-100 pb-6">
                <div class="inline-flex items-center gap-2 px-3 py-1 bg-indigo-50 text-indigo-700 text-xs font-semibold rounded-full mb-3">
                    <span>❤️</span> Open Source
                </div>
                <h1 class="text-3xl font-extrabold text-slate-900 tracking-tight">Open-Source Attribution</h1>
                <p class="text-slate-500 mt-2 text-sm">Virtual Graph Paper is built with the help of fantastic open-source libraries and projects.</p>
            </div>

            <div class="space-y-4">
                <div class="p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <h3 class="font-bold text-slate-900 text-base">Tailwind CSS</h3>
                    <p class="text-xs text-slate-500 mb-2">MIT License</p>
                    <p class="text-sm text-slate-600">A utility-first CSS framework for rapid UI development.</p>
                </div>

                <div class="p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <h3 class="font-bold text-slate-900 text-base">LZ-String</h3>
                    <p class="text-xs text-slate-500 mb-2">MIT License</p>
                    <p class="text-sm text-slate-600">LZ-based compression algorithm for storing sketches efficiently in URL strings and localStorage.</p>
                </div>

                <div class="p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <h3 class="font-bold text-slate-900 text-base">HTML5 Canvas API</h3>
                    <p class="text-xs text-slate-500 mb-2">W3C Standard</p>
                    <p class="text-sm text-slate-600">High performance 2D vector graphic rendering engine.</p>
                </div>
            </div>

            <div class="pt-6 border-t border-slate-100 flex items-center justify-between">
                <a href="index.php" class="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium">
                    ← Back to Drawing Canvas
                </a>
                <span class="text-xs text-slate-400">Virtual Graph Paper</span>
            </div>
        </div>
    </main>

    <!-- Footer -->
    <footer class="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500">
        <div class="max-w-5xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
            <div>Virtual Graph Paper — Free online infinite graph paper editor.</div>
            <div class="flex items-center gap-4">
                <a href="index.php" class="hover:text-indigo-600">Editor</a>
                <a href="news.php" class="hover:text-indigo-600">What's New</a>
                <a href="contact.php" class="hover:text-indigo-600">Contact</a>
                <a href="privacy.php" class="hover:text-indigo-600">Privacy</a>
                <a href="attribution.php" class="hover:text-indigo-600 font-semibold text-indigo-600">Attribution</a>
            </div>
        </div>
    </footer>
</body>
</html>
