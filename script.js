const phases = {
    start: document.getElementById('phase-start'),
    loading: document.getElementById('phase-loading'),
    confirm: document.getElementById('phase-confirm'),
    wheel: document.getElementById('phase-wheel'),
    reward: document.getElementById('phase-reward')
};

const btnLixi = document.getElementById('btn-lixi');
const gameContainer = document.getElementById('game-container');
const progressBar = document.getElementById('progress-bar');
const loadingText = document.getElementById('loading-text');

// State
let dodgeCount = 0;
const maxDodges = 5;
let hasFailedLoadingOnce = false;

// Audio Context for generated sounds (No 404s!)
const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioContext();

function playSound(type) {
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    const now = audioCtx.currentTime;

    if (type === 'dodge') {
        // Swoosh
        osc.type = 'sine';
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.exponentialRampToValueAtTime(800, now + 0.1);
        gainNode.gain.setValueAtTime(0.3, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
    } else if (type === 'fail') {
        // Error buzz
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(100, now);
        osc.frequency.linearRampToValueAtTime(80, now + 0.3);
        gainNode.gain.setValueAtTime(0.5, now);
        gainNode.gain.linearRampToValueAtTime(0.01, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
    } else if (type === 'win') {
        // Chime/Coin
        osc.type = 'square';
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.setValueAtTime(800, now + 0.1);
        gainNode.gain.setValueAtTime(0.1, now);
        gainNode.gain.setValueAtTime(0.1, now + 0.1);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
    } else if (type === 'spin') {
        // Tick
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(200, now);
        gainNode.gain.setValueAtTime(0.2, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
        osc.start(now);
        osc.stop(now + 0.05);
    }
}


// --- Phase 1: Dodge Logic ---

function initDodge() {
    dodgeCount = 0;
    btnLixi.style.position = 'relative'; // Reset style
    btnLixi.style.top = '0';
    btnLixi.style.left = '0';

    // Desktop interaction
    btnLixi.addEventListener('mouseover', handleDodge);
    // Mobile interaction (touchstart is tricky as it often also fires click, using click handler logic to check dodge count)
}

function handleDodge(e) {
    if (dodgeCount >= maxDodges) {
        btnLixi.removeEventListener('mouseover', handleDodge);
        return; // Allow click
    }

    dodgeCount++;
    moveButton();
}

function moveButton() {
    // Get container dimensions
    const containerRect = gameContainer.getBoundingClientRect();
    const btnRect = btnLixi.getBoundingClientRect();

    // Calculate max available space within the container
    // However, to be "troll", moving outside the container relative to viewport is funnier but risks layout breaking.
    // Let's keep it inside the container for safety on mobile, or just randomly translate.

    // We will use fixed/absolute positioning relative to viewport for maximum chaos? 
    // No, keep relative to container so it doesn't get lost. 
    // Actually, "absolute" within the "relative" container is best.

    btnLixi.style.position = 'absolute';

    // Random position within container (with padding)
    const maxX = containerRect.width - btnRect.width - 40;
    const maxY = containerRect.height - btnRect.height - 40;

    const randomX = Math.random() * maxX;
    const randomY = Math.random() * maxY;

    // Apply
    btnLixi.style.left = `${Math.max(20, randomX)}px`;
    btnLixi.style.top = `${Math.max(20, randomY)}px`;

    // Add shake effect briefly
    btnLixi.classList.add('shake-active');
    setTimeout(() => btnLixi.classList.remove('shake-active'), 500);
    playSound('dodge');
}

btnLixi.addEventListener('click', (e) => {
    // If on mobile, the first few taps might trigger dodge if we use touchstart, 
    // but here we rely on 'click'. If they manage to click it:
    if (dodgeCount < maxDodges) {
        e.preventDefault();
        moveButton();
        dodgeCount++; // Increment here too in case they are fast
    } else {
        startLoadingPhase();
    }
});

initDodge();


// --- Phase 2: Fake Loading ---

function startLoadingPhase() {
    switchPhase('loading');

    let progress = 0;
    const interval = setInterval(() => {
        // Slow down as it gets higher
        const increment = Math.max(0.1, (100 - progress) / 50);
        progress += increment;

        if (progress >= 99) {
            progress = 99;
            progressBar.style.width = '99%';
            loadingText.innerText = '99%';
            clearInterval(interval);

            setTimeout(() => {
                if (!hasFailedLoadingOnce) {
                    playSound('fail');
                    showMessage("Lỗi Kết Nối", "Lỗi kết nối tâm linh: Ví tiền đang bị phong ấn! Vui lòng thử lại.", () => {
                        hasFailedLoadingOnce = true;
                        resetGame();
                    });
                } else {
                    // Success on second try
                    startConfirmPhase();
                }
            }, 2000);
        } else {
            progressBar.style.width = `${progress}%`;
            loadingText.innerText = `${Math.round(progress)}%`;
        }
    }, 100);
}

function resetGame() {
    // Reset to start but keep 'hasFailedLoadingOnce' true
    switchPhase('start');
    initDodge();
}


// --- Phase 3: Infinite Confirm ---

let confirmStep = 0;
const confirmTexts = [
    "Bạn chắc chắn muốn nhận toàn bộ số tiền này?",
    "Thật sự chắc chắn? Không hối hận chứ?",
    "Hỏi lần cuối: Tiền nhiều quá tiêu không hết thì sao?"
];

function startConfirmPhase() {
    switchPhase('confirm');
    confirmStep = 0;
    updateConfirmText();
}

function updateConfirmText() {
    const textEl = document.getElementById('confirm-text');
    if (confirmStep < confirmTexts.length) {
        textEl.innerText = confirmTexts[confirmStep];
    } else {
        // Done
        startWheelPhase();
    }
}

document.getElementById('btn-confirm-yes').addEventListener('click', () => {
    confirmStep++;
    if (confirmStep >= confirmTexts.length) {
        startWheelPhase();
    } else {
        updateConfirmText();
    }
});

document.getElementById('btn-confirm-no').addEventListener('click', () => {
    showMessage("Tiếc Quá", "Thôi được, không nhận thì thôi!", () => {
        resetGame();
    });
});


// --- Phase 4: Fake Wheel ---

function startWheelPhase() {
    switchPhase('wheel');
}

const wheel = document.getElementById('wheel');
document.getElementById('btn-spin').addEventListener('click', () => {
    // Spin logic
    // We want to land on "Chúc may mắn" which is at 315 degrees (top-left segment)
    // Or "1k" (not visualized clearly, let's say "Chúc may mắn").
    // The wheel has segments. To land on "Chúc may mắn" (at 270-360 deg in CSS conic), 
    // we need to rotate such that this segment is at the pointer (top).
    // Pointer is at Top. 
    // Segment 270-360 is the blue one.
    // If we rotate 0deg, 0-90 is at top-right. 
    // We need 270-360 to be at top.
    // Let's just spin a huge amount + random offset ensuring it lands on the "Blue" zone.

    // Actually, simple troll: Just rotate a fixed amount that looks random but is hardcoded to fail.
    const baseSpins = 360 * 10; // 10 spins
    const targetDegree = 45 + baseSpins; // 45 degrees lands somewhere specific

    wheel.style.transform = `rotate(${targetDegree}deg)`;

    // Disable button
    document.getElementById('btn-spin').disabled = true;

    // Simulate ticking sound
    let spins = 0;
    const tickInterval = setInterval(() => {
        playSound('spin');
        spins++;
        if (spins > 20) clearInterval(tickInterval);
    }, 200);

    setTimeout(() => {
        playSound('fail');
        showMessage("Chia Buồn", "Chúc bạn may mắn lần sau! (Hoặc nhận giải an ủi)", () => {
            startRewardPhase();
        });
    }, 4500); // 4s transition + buffer
});


// --- Phase 5: Reward ---

function startRewardPhase() {
    switchPhase('reward');

    const envelope = document.querySelector('.lucky-money-envelope');
    const finalMsg = document.getElementById('final-message');
    const meme = document.getElementById('reward-meme');

    envelope.addEventListener('click', () => {
        if (!envelope.classList.contains('opened')) {
            envelope.classList.add('opened');

            // Confetti
            playSound('win');
            confetti({
                particleCount: 150,
                spread: 70,
                origin: { y: 0.6 }
            });

            // Show content
            setTimeout(() => {
                envelope.style.display = 'none';
                meme.classList.remove('hidden');
                finalMsg.classList.remove('hidden');
                finalMsg.classList.add('animate-message-pop');
            }, 500);
        }
    });
}


// --- Utilities ---

function switchPhase(phaseName) {
    // Hide all
    Object.values(phases).forEach(el => {
        if (el) el.classList.add('hidden');
    });
    // Show target
    if (phases[phaseName]) {
        phases[phaseName].classList.remove('hidden');
    }
}

// --- Message Modal Utility ---
const msgModal = document.getElementById('message-modal');
const msgTitle = document.getElementById('msg-title');
const msgContent = document.getElementById('msg-content');
const btnMsgOk = document.getElementById('btn-msg-ok');
let currentMsgCallback = null;

function showMessage(title, text, callback = null) {
    if (!msgModal) return;

    msgTitle.innerText = title;
    msgContent.innerText = text;

    currentMsgCallback = callback;

    msgModal.classList.remove('hidden');
    msgModal.classList.add('flex');
}

if (btnMsgOk) {
    btnMsgOk.addEventListener('click', () => {
        msgModal.classList.add('hidden');
        msgModal.classList.remove('flex');

        if (typeof currentMsgCallback === 'function') {
            currentMsgCallback();
            currentMsgCallback = null;
        }
    });

    // Close on overlay click
    msgModal.addEventListener('click', (e) => {
        if (e.target === msgModal) {
            msgModal.classList.add('hidden');
            msgModal.classList.remove('flex');
            // Depending on UX, clicking outside might or might not run the callback.
            // For forced flows (like game reset), usually we want the callback to run.
            // But let's assume clicking OK is the primary way. 
            // If they click outside, well, maybe just close.
            // To be safe for game flow, let's treat outside click as OK.
            if (typeof currentMsgCallback === 'function') {
                currentMsgCallback();
                currentMsgCallback = null;
            }
        }
    });
}


// --- QR Modal Logic ---
const btnTransfer = document.getElementById('btn-transfer');
const qrModal = document.getElementById('qr-modal');
const closeQr = document.getElementById('close-qr');

if (btnTransfer && qrModal && closeQr) {
    btnTransfer.addEventListener('click', (e) => {
        e.preventDefault();
        qrModal.classList.remove('hidden');
        qrModal.classList.add('flex'); // Ensure it uses flex display
        playSound('win'); // Replay win sound for effect

        // Confetti again!
        confetti({
            particleCount: 100,
            spread: 100,
            origin: { y: 0.6 },
            colors: ['#ffd700', '#d32f2f']
        });
    });

    closeQr.addEventListener('click', () => {
        qrModal.classList.add('hidden');
        qrModal.classList.remove('flex');
    });

    // Close on click outside
    qrModal.addEventListener('click', (e) => {
        if (e.target === qrModal) {
            qrModal.classList.add('hidden');
            qrModal.classList.remove('flex');
        }
    });
}

// --- Falling Effects (Peach Blossoms / Hoa Đào) ---
function initFallingEffects() {
    const container = document.getElementById('bg-effects');
    if (!container) return;

    function createPetal(isInitial = false) {
        const petal = document.createElement('div');
        petal.classList.add('petal');

        // Randomize
        const sizeValue = Math.random() * 20 + 15; // Size in px
        const size = sizeValue + 'px';
        const left = Math.random() * 100 + 'vw';
        const durationValue = Math.random() * 5 + 5; // 5-10s
        const duration = durationValue + 's';

        petal.innerText = '🌸'; // Use Emoji
        petal.style.fontSize = size;
        petal.style.width = size;
        petal.style.height = size;
        petal.style.left = left;
        petal.style.backgroundColor = 'transparent';
        petal.style.animationDuration = duration;
        petal.style.opacity = Math.random() * 0.6 + 0.4;
        petal.style.transform = `rotate(${Math.random() * 360}deg)`;

        // Center the emoji
        petal.style.display = 'flex';
        petal.style.justifyContent = 'center';
        petal.style.alignItems = 'center';

        // Initial position
        if (isInitial) {
            petal.style.top = Math.random() * 100 + 'vh';
        } else {
            petal.style.top = '-40px'; // Start slightly higher
        }

        container.appendChild(petal);

        // Cleanup after animation
        setTimeout(() => {
            petal.remove();
        }, durationValue * 1000);
    }

    // Pre-populate
    for (let i = 0; i < 30; i++) {
        createPetal(true);
    }

    // Continuous generation
    setInterval(() => {
        createPetal(false);
    }, 300);
}

// Start effect
initFallingEffects();
