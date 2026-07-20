<?php
/**
 * privacy.php — Privacy Policy page
 */
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Privacy Policy — Virtual Graph Paper</title>
<meta name="description" content="Privacy policy for Virtual Graph Paper app. Learn about how data is handled and stored.">
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
                <a href="privacy.php" class="text-indigo-600 font-semibold">Privacy</a>
                <a href="attribution.php" class="hover:text-indigo-600 transition-colors">Attribution</a>
            </nav>
        </div>
    </header>

    <!-- Main Content -->
    <main class="flex-1 max-w-4xl w-full mx-auto px-4 py-10">
        <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-6 md:p-10 space-y-6">
            
            <div class="border-b border-slate-100 pb-6">
                <div class="inline-flex items-center gap-2 px-3 py-1 bg-indigo-50 text-indigo-700 text-xs font-semibold rounded-full mb-3">
                    <span>🔒</span> Legal & Privacy
                </div>
                <h1 class="text-3xl font-extrabold text-slate-900 tracking-tight">Privacy Policy</h1>
                <p class="text-slate-500 mt-2 text-sm">Last updated: July 2026</p>
            </div>

            <div class="space-y-6 text-slate-700 leading-relaxed">
                <section class="space-y-3">
                    <h2 class="text-xl font-bold text-slate-900 flex items-center gap-2">
                        <span class="w-2 h-2 rounded-full bg-indigo-600"></span>
                        Data Storage & Privacy Overview
                    </h2>
                    <p>
                        During normal use of <strong>Virtual Graph Paper</strong>, your drawings and sketches are stored directly in your browser's local storage. No drawing data is transmitted to or stored on our servers unless you explicitly choose to export or share your sketch online.
                    </p>
                    <p>
                        No user data or drawing content is shared with 3rd parties.
                    </p>
                </section>

                <section class="space-y-3 pt-4 border-t border-slate-100">
                    <h2 class="text-xl font-bold text-slate-900 flex items-center gap-2">
                        <span class="w-2 h-2 rounded-full bg-indigo-600"></span>
                        Online Drawings & Shared Links
                    </h2>
                    <p>
                        When drawings are saved online or shared via a unique link, they are stored securely on our servers with minimal technical metadata (such as timestamps and IP addresses) strictly for system operations and anti-abuse monitoring.
                    </p>
                </section>

                <section class="space-y-3 pt-4 border-t border-slate-100">
                    <h2 class="text-xl font-bold text-slate-900 flex items-center gap-2">
                        <span class="w-2 h-2 rounded-full bg-indigo-600"></span>
                        Cookies & Local Storage
                    </h2>
                    <p>
                        Virtual Graph Paper uses your browser's <code>localStorage</code> to preserve your grid preferences (grid type, line colors, grid size) and save your current active sketch locally so you can resume work seamlessly.
                    </p>
                </section>

                <section class="space-y-3 pt-4 border-t border-slate-100">
                    <h2 class="text-xl font-bold text-slate-900 flex items-center gap-2">
                        <span class="w-2 h-2 rounded-full bg-indigo-600"></span>
                        Contact Us
                    </h2>
                    <p>
                        If you have any questions regarding this privacy policy or how Virtual Graph Paper handles your data, feel free to reach out via our <a href="contact.php" class="text-indigo-600 hover:underline font-medium">Contact Page</a> or send an email to <code>support@virtual-graph-paper.com</code>.
                    </p>
                </section>
            </div>

            <div class="pt-6 border-t border-slate-100 flex items-center justify-between">
                <a href="index.php" class="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium">
                    ← Back to Drawing Canvas
                </a>
                <span class="text-xs text-slate-400">Virtual Graph Paper © 2026</span>
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
                <a href="privacy.php" class="hover:text-indigo-600 font-semibold text-indigo-600">Privacy</a>
                <a href="attribution.php" class="hover:text-indigo-600">Attribution</a>
            </div>
        </div>
    </footer>
</body>
</html>
