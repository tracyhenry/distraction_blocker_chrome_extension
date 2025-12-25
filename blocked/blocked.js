// Blocked page script

const MESSAGES = [
    { main: "Nice try! 😏", sub: "Your future self will thank you." },
    { main: "Whoa there! 🛑", sub: "This site is on timeout. You've got this!" },
    { main: "Focus mode! 💪", sub: "Time to crush it! Stay strong." },
    { main: "Distraction blocked! 🚫", sub: "Back to being awesome." },
    { main: "Not today! 🙅", sub: "You're stronger than this distraction." },
    { main: "Hey champion! 🏆", sub: "Keep your eyes on the prize." },
    { main: "Nope! 🎯", sub: "Stay focused, stay winning." },
    { main: "Good catch! 🎣", sub: "Almost got distracted there!" }
];

// Get random message
function getRandomMessage() {
    return MESSAGES[Math.floor(Math.random() * MESSAGES.length)];
}

// Parse URL parameters
function getUrlParams() {
    const params = new URLSearchParams(window.location.search);
    return {
        domain: params.get('domain') || 'Unknown site',
        category: params.get('category') || null
    };
}

// Go back or close tab
function goBack() {
    // Prefer the tabs API (more reliable for extension pages), fall back to history/close.
    try {
        if (chrome?.tabs?.getCurrent && chrome?.tabs?.goBack) {
            chrome.tabs.getCurrent((tab) => {
                if (chrome.runtime.lastError || !tab?.id) {
                    // Fallback to history
                    if (window.history.length > 1) window.history.back();
                    else window.close();
                    return;
                }

                // Go back once.
                chrome.tabs.goBack(tab.id, () => {
                    // If it fails, fall back.
                    if (chrome.runtime.lastError) {
                        if (window.history.length > 1) window.history.back();
                        else window.close();
                    }
                });
            });
            return;
        }
    } catch {
        // fall through
    }

    if (window.history.length > 1) window.history.back();
    else window.close();
}

// Make goBack available globally
window.goBack = goBack;

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
    const { domain, category } = getUrlParams();
    const message = getRandomMessage();

    // Update message
    document.getElementById('message').textContent = message.main;
    document.getElementById('submessage').textContent = message.sub;

    // Update blocked domain
    document.getElementById('blockedDomain').textContent = domain;

    // Show category badge if available
    if (category) {
        const badge = document.getElementById('categoryBadge');
        badge.textContent = category;
        badge.classList.remove('hidden');
    }

    // Wire up the button click via JS (MV3 CSP blocks inline onclick handlers).
    const backBtn = document.getElementById('backToWorkBtn');
    if (backBtn) backBtn.addEventListener('click', goBack);
});

