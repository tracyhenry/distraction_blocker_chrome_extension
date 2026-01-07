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

function getSiteDisplayName(domain, url) {
    const cleaned = typeof domain === 'string' ? domain.trim() : '';
    if (cleaned && cleaned !== 'Unknown site') return cleaned;
    if (isLikelyHttpUrl(url)) {
        try {
            const host = new URL(url).hostname;
            if (host) return host.replace(/^www\./, '');
        } catch {
            // ignore
        }
    }
    return 'this site';
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
    const siteName = getSiteDisplayName(domain, url);

    // Update message
    document.getElementById('message').textContent = message.main;
    document.getElementById('submessage').textContent = message.sub;

    // Update blocked domain
    document.getElementById('blockedDomain').textContent = siteName;

    // Update quick exception modal website label
    const passDomainEl = document.getElementById('passDomain');
    if (passDomainEl) passDomainEl.textContent = siteName;

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
    const reasonHintEl = document.getElementById('passReasonHint');
    const errorEl = document.getElementById('passError');
    const durationBtns = Array.from(document.querySelectorAll('.durationBtn'));

    const sendMessage = makeSendMessagePromise();

    let selectedDurationMs = 300000; // default 5 minutes
    let modalOpen = false;

    function stripTrailingPunctuation(text) {
        return String(text || '').trim().replace(/[.!?,"'”’]+$/g, '').trim();
    }

    function normalizeForSuffixCheck(text) {
        // Lowercase, trim, and ignore a little trailing punctuation so users can end with a period.
        return stripTrailingPunctuation(text).toLowerCase();
    }

    function requiredSuffixForDuration(durationMs) {
        if (durationMs === 30 * 60_000) return 'i really need 30 minutes';
        if (durationMs === 60 * 60_000) return 'i really need 1 hour';
        return null;
    }

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

    function hasExactFiveWordsPlusSuffix(reason, requiredSuffix) {
        const stripped = stripTrailingPunctuation(reason);
        const lower = stripped.toLowerCase();

        if (!lower.endsWith(requiredSuffix)) return false;

        const suffixStart = lower.length - requiredSuffix.length;
        // Must be "...<space><suffix>" with exactly one space before suffix.
        if (suffixStart <= 0) return false;
        if (lower[suffixStart - 1] !== ' ') return false;
        if (suffixStart - 2 >= 0 && lower[suffixStart - 2] === ' ') return false;

        const prefix = lower.slice(0, suffixStart - 1).trim();
        return countWords(prefix) === 5;
    }

    function validateReason() {
        const reason = (reasonInput?.value || '').trim();
        const requiredSuffix = requiredSuffixForDuration(selectedDurationMs);
        const ok = requiredSuffix
            ? hasExactFiveWordsPlusSuffix(reason, requiredSuffix)
            : countWords(reason) >= 5;

        // Update the helper hint based on duration selection
        if (reasonHintEl) {
            reasonHintEl.textContent = requiredSuffix
                ? `Minimum 5 words, plus the ending phrase: "${requiredSuffix}".`
                : 'Minimum 5 words.';
        }

        setConfirmEnabled(ok);
        if (ok) showError('');
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
        const requiredSuffix = requiredSuffixForDuration(selectedDurationMs);
        if (requiredSuffix) {
            if (!hasExactFiveWordsPlusSuffix(reason, requiredSuffix)) {
                showError(`For ${selectedDurationMs === 30 * 60_000 ? '30 min' : '1 hour'}, write exactly 5 words, then a space, then "${requiredSuffix}".`);
                setConfirmEnabled(false);
                return;
            }
        } else if (countWords(reason) < 5) {
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
                validateReason();
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

