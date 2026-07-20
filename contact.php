<?php
/**
 * contact.php — Contact & Feedback page
 */
$submitted = false;
$error = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $name = trim($_POST['name'] ?? '');
    $email = trim($_POST['email'] ?? '');
    $topic = trim($_POST['topic'] ?? '');
    $message = trim($_POST['message'] ?? '');

    if (empty($email) || empty($message)) {
        $error = 'Please fill in both your email address and message.';
    } else {
        $submitted = true;
    }
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Contact Us — Virtual Graph Paper</title>
<meta name="description" content="Get in touch with the Virtual Graph Paper team. Ask a question, report a bug, or submit feature feedback.">
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
                <a href="contact.php" class="text-indigo-600 font-semibold">Contact</a>
                <a href="privacy.php" class="hover:text-indigo-600 transition-colors">Privacy</a>
                <a href="attribution.php" class="hover:text-indigo-600 transition-colors">Attribution</a>
            </nav>
        </div>
    </header>

    <!-- Main Content -->
    <main class="flex-1 max-w-4xl w-full mx-auto px-4 py-10">
        <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-6 md:p-10 space-y-6">
            
            <div class="border-b border-slate-100 pb-6">
                <div class="inline-flex items-center gap-2 px-3 py-1 bg-indigo-50 text-indigo-700 text-xs font-semibold rounded-full mb-3">
                    <span>💬</span> Support & Feedback
                </div>
                <h1 class="text-3xl font-extrabold text-slate-900 tracking-tight">Ask a Question / Report an Issue</h1>
                <p class="text-slate-500 mt-2 text-sm">Have feedback, discovered a bug, or need help with Virtual Graph Paper? Send us a message below.</p>
            </div>

            <?php if ($submitted): ?>
                <div class="bg-emerald-50 border border-emerald-200 rounded-lg p-5 text-emerald-800 space-y-2">
                    <div class="flex items-center gap-2 font-bold text-lg">
                        <svg class="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                        Thank you for your message!
                    </div>
                    <p class="text-sm text-emerald-700">We have received your message and will review your inquiry shortly.</p>
                    <div class="pt-2">
                        <a href="index.php" class="inline-block px-4 py-2 bg-emerald-600 text-white rounded text-sm font-medium hover:bg-emerald-700 transition-colors">Return to Canvas</a>
                        <a href="contact.php" class="inline-block px-4 py-2 text-emerald-700 text-sm font-medium hover:underline ml-2">Send another message</a>
                    </div>
                </div>
            <?php else: ?>

                <?php if ($error): ?>
                    <div class="bg-rose-50 border border-rose-200 text-rose-700 rounded-lg p-4 text-sm font-medium">
                        ⚠️ <?= htmlspecialchars($error) ?>
                    </div>
                <?php endif; ?>

                <form action="contact.php" method="POST" class="space-y-5">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label for="name" class="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Your Name</label>
                            <input type="text" id="name" name="name" placeholder="John Doe"
                                   class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:bg-white text-sm transition-all outline-none"
                                   value="<?= htmlspecialchars($_POST['name'] ?? '') ?>">
                        </div>
                        <div>
                            <label for="email" class="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Email Address <span class="text-rose-500">*</span></label>
                            <input type="email" id="email" name="email" required placeholder="you@example.com"
                                   class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:bg-white text-sm transition-all outline-none"
                                   value="<?= htmlspecialchars($_POST['email'] ?? '') ?>">
                        </div>
                    </div>

                    <div>
                        <label for="topic" class="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Topic</label>
                        <select id="topic" name="topic"
                                class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:bg-white text-sm transition-all outline-none">
                            <option value="Question">Ask a question</option>
                            <option value="Bug Report">Report a bug / issue</option>
                            <option value="Feature Request">Request a feature</option>
                            <option value="Other">Other enquiry</option>
                        </select>
                    </div>

                    <div>
                        <label for="message" class="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Message / Details <span class="text-rose-500">*</span></label>
                        <textarea id="message" name="message" rows="5" required placeholder="Please describe your question, issue, or feedback in detail..."
                                  class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:bg-white text-sm transition-all outline-none"><?= htmlspecialchars($_POST['message'] ?? '') ?></textarea>
                    </div>

                    <div class="pt-2 flex items-center justify-between">
                        <button type="submit" class="inline-flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium text-sm transition-colors shadow-sm">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg>
                            Submit Message
                        </button>
                        <span class="text-xs text-slate-400">Direct email: <code>support@virtual-graph-paper.com</code></span>
                    </div>
                </form>

            <?php endif; ?>

        </div>
    </main>

    <!-- Footer -->
    <footer class="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500">
        <div class="max-w-5xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
            <div>Virtual Graph Paper — Free online infinite graph paper editor.</div>
            <div class="flex items-center gap-4">
                <a href="index.php" class="hover:text-indigo-600">Editor</a>
                <a href="news.php" class="hover:text-indigo-600">What's New</a>
                <a href="contact.php" class="hover:text-indigo-600 font-semibold text-indigo-600">Contact</a>
                <a href="privacy.php" class="hover:text-indigo-600">Privacy</a>
                <a href="attribution.php" class="hover:text-indigo-600">Attribution</a>
            </div>
        </div>
    </footer>
</body>
</html>
