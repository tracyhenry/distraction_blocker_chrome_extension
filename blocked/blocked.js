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
        category: params.get('category') || null,
        url: params.get('url') || null
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

function isLikelyHttpUrl(url) {
    return typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://'));
}

function setElHidden(el, hidden) {
    if (!el) return;
    el.classList.toggle('hidden', hidden);
    el.setAttribute('aria-hidden', hidden ? 'true' : 'false');
}

function makeSendMessagePromise() {
    return (msg) => new Promise((resolve) => {
        try {
            chrome.runtime.sendMessage(msg, (resp) => resolve(resp));
        } catch {
            resolve({ success: false, error: 'sendMessage failed' });
        }
    });
}

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
    const { domain, category, url } = getUrlParams();
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

    // --- Option B: intentional temporary pass modal ---
    const passModal = document.getElementById('passModal');
    const openPassModalBtn = document.getElementById('openPassModalBtn');
    const closePassModalBtn = document.getElementById('closePassModalBtn');
    const cancelPassBtn = document.getElementById('cancelPassBtn');
    const confirmPassBtn = document.getElementById('confirmPassBtn');
    const reasonInput = document.getElementById('passReasonInput');
    const errorEl = document.getElementById('passError');
    const durationBtns = Array.from(document.querySelectorAll('.durationBtn'));

    const sendMessage = makeSendMessagePromise();

    let selectedDurationMs = 300000; // default 5 minutes
    let modalOpen = false;

    function showError(msg) {
        if (!errorEl) return;
        errorEl.textContent = msg || '';
        errorEl.classList.toggle('hidden', !msg);
    }

    function setConfirmEnabled(enabled) {
        if (!confirmPassBtn) return;
        confirmPassBtn.disabled = !enabled;
        confirmPassBtn.style.opacity = enabled ? '1' : '0.6';
    }

    function updateDurationButtonStyles() {
        durationBtns.forEach((btn) => {
            const ms = Number(btn.getAttribute('data-duration-ms'));
            const selected = ms === selectedDurationMs;
            btn.classList.toggle('btn-secondary', selected);
            btn.classList.toggle('bg-white/10', !selected);
            btn.classList.toggle('text-white', selected);
            btn.classList.toggle('text-white/80', !selected);
        });
    }

    function countWords(text) {
        return text.trim().split(/\s+/).filter(w => w.length > 0).length;
    }

    function validateReason() {
        const reason = (reasonInput?.value || '').trim();
        const wordCount = countWords(reason);
        setConfirmEnabled(wordCount >= 5);
        if (wordCount >= 5) showError('');
    }

    function openModal() {
        if (!passModal) return;
        modalOpen = true;
        setElHidden(passModal, false);
        updateDurationButtonStyles();
        validateReason();
        setTimeout(() => reasonInput?.focus(), 0);
    }

    function closeModal() {
        if (!passModal) return;
        modalOpen = false;
        setElHidden(passModal, true);
        showError('');
        openPassModalBtn?.focus();
    }

    async function confirmPass() {
        const reason = (reasonInput?.value || '').trim();
        const wordCount = countWords(reason);
        if (wordCount < 5) {
            showError('Please write a reason with at least 5 words.');
            setConfirmEnabled(false);
            return;
        }

        setConfirmEnabled(false);
        if (confirmPassBtn) confirmPassBtn.textContent = 'Allowing…';
        showError('');

        const targetUrl = isLikelyHttpUrl(url) ? url : (domain && domain !== 'Unknown site' ? `https://${domain}` : null);

        const resp = await sendMessage({
            action: 'grantTemporaryPass',
            domain,
            durationMs: selectedDurationMs,
            reason,
            targetUrl
        });

        if (!resp || resp.success !== true) {
            if (confirmPassBtn) confirmPassBtn.textContent = 'Allow temporarily';
            setConfirmEnabled(true);
            showError(resp?.error || 'Could not create a temporary pass. Try again.');
            return;
        }

        // Redirect back to the original URL the user tried to open.
        if (targetUrl) window.location.href = targetUrl;
        else goBack();
    }

    if (openPassModalBtn) openPassModalBtn.addEventListener('click', openModal);
    if (closePassModalBtn) closePassModalBtn.addEventListener('click', closeModal);
    if (cancelPassBtn) cancelPassBtn.addEventListener('click', closeModal);
    if (reasonInput) reasonInput.addEventListener('input', validateReason);
    if (confirmPassBtn) confirmPassBtn.addEventListener('click', confirmPass);

    durationBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
            const ms = Number(btn.getAttribute('data-duration-ms'));
            if (Number.isFinite(ms) && ms > 0) {
                selectedDurationMs = ms;
                updateDurationButtonStyles();
            }
        });
    });

    // Click on backdrop closes modal.
    if (passModal) {
        const backdrop = passModal.querySelector('div.absolute');
        if (backdrop) backdrop.addEventListener('click', closeModal);
    }

    // ESC closes modal.
    document.addEventListener('keydown', (e) => {
        if (!modalOpen) return;
        if (e.key === 'Escape') closeModal();
    });
});

