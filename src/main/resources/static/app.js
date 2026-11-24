/**
 * KahinPAY — Phone App & Mesh Simulation Engine (Pass 2)
 * Preserves all backend endpoints, element IDs, and event handlers.
 * Adds interactive animated SVG mesh graph, Attack Lab, and tab navigation.
 */

// Global State for Mesh Visualizer
let latestDeviceState = [];

// Toast notification helper
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type === 'success' ? 'toast-success' : type === 'error' ? 'toast-error' : ''}`;
    toast.innerHTML = `
        <span style="font-size: 15px;">${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</span>
        <span>${message}</span>
    `;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'toastOut 0.3s forwards';
        setTimeout(() => toast.remove(), 300);
    }, 3800);
}

// Log to Terminal
function log(msg) {
    const el = document.getElementById('log');
    if (!el) return;
    el.textContent = '[' + new Date().toLocaleTimeString() + '] ' + msg + '\n' + el.textContent;
}

// Copy to Clipboard Helper
function copyKey(fullKey) {
    if (!fullKey) return;
    navigator.clipboard.writeText(fullKey).then(() => {
        showToast('ECDSA Public Key copied to clipboard!', 'success');
    }).catch(() => {
        showToast('Failed to copy key', 'error');
    });
}

// Tab Switching Controller (Pass 2)
function switchConsoleTab(tabId) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        const isTarget = btn.getAttribute('data-tab') === tabId;
        btn.classList.toggle('active', isTarget);
        btn.setAttribute('aria-selected', isTarget ? 'true' : 'false');
    });

    document.querySelectorAll('.tab-panel').forEach(panel => {
        const isTarget = panel.id === `tab-${tabId}`;
        panel.classList.toggle('active', isTarget);
    });
}

// Setup Keyboard Arrow Navigation for Tabs
function setupTabKeyNav() {
    const tabs = Array.from(document.querySelectorAll('.tab-btn'));
    tabs.forEach((tab, index) => {
        tab.addEventListener('keydown', (e) => {
            let nextIndex = null;
            if (e.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length;
            else if (e.key === 'ArrowLeft') nextIndex = (index - 1 + tabs.length) % tabs.length;

            if (nextIndex !== null) {
                e.preventDefault();
                tabs[nextIndex].focus();
                tabs[nextIndex].click();
            }
        });
    });
}

// Balance Count-Up Animation
let lastRenderedBalance = null;
function animateBalance(targetValue) {
    const el = document.getElementById('heroBalanceDisplay');
    if (!el) return;

    const startVal = lastRenderedBalance !== null ? lastRenderedBalance : targetValue;
    lastRenderedBalance = targetValue;
    if (startVal === targetValue) {
        el.textContent = targetValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        return;
    }

    const duration = 600;
    const startTime = performance.now();

    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const ease = 1 - Math.pow(1 - progress, 3); // cubic ease out
        const current = startVal + (targetValue - startVal) * ease;
        el.textContent = current.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        if (progress < 1) {
            requestAnimationFrame(update);
        }
    }
    requestAnimationFrame(update);
}

// Timeline State Manager
function setTimelineStep(stepNumber, state) {
    const stepEl = document.getElementById(`timelineStep${stepNumber}`);
    if (!stepEl) return;

    stepEl.classList.remove('active', 'completed', 'threat');
    if (state === 'active') stepEl.classList.add('active');
    else if (state === 'completed') stepEl.classList.add('completed');
    else if (state === 'threat') stepEl.classList.add('threat');
}

function resetTimeline() {
    for (let i = 1; i <= 4; i++) {
        const stepEl = document.getElementById(`timelineStep${i}`);
        if (stepEl) stepEl.classList.remove('active', 'completed', 'threat');
    }
}

// Bottom Sheet Manager
function showResultSheet({ success, amount, txId, reason, bridgeNode }) {
    const overlay = document.getElementById('bottomSheetOverlay');
    const iconCircle = document.getElementById('sheetIconCircle');
    const title = document.getElementById('sheetTitle');
    const amountEl = document.getElementById('sheetAmount');
    const badge = document.getElementById('sheetBadge');
    const meta = document.getElementById('sheetMeta');

    if (!overlay) return;

    if (success) {
        iconCircle.className = 'result-icon-circle';
        iconCircle.innerHTML = `
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#00D26A" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
        `;
        title.textContent = 'Payment Settled Offline';
        title.style.color = '#FFFFFF';
        amountEl.textContent = `₹${parseFloat(amount).toFixed(2)}`;
        amountEl.style.display = 'block';
        badge.textContent = 'Verified via Mesh Bridge';
        badge.style.display = 'inline-block';
        badge.style.borderColor = '#00D26A';
        badge.style.color = '#00D26A';
        badge.style.background = 'rgba(16, 185, 129, 0.15)';
        meta.innerHTML = `
            <div>Transaction ID: <strong>#${txId}</strong></div>
            <div>Bridge Relay: <strong>${bridgeNode}</strong></div>
            <div class="small" style="color: #10B981;">Non-Repudiation: ECDSA Verified</div>
        `;
    } else {
        iconCircle.className = 'result-icon-circle failure';
        iconCircle.innerHTML = `
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#F43F5E" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
        `;
        title.textContent = 'Payment Rejected';
        title.style.color = '#F43F5E';
        amountEl.style.display = 'none';
        badge.textContent = 'Security Protocol Block';
        badge.style.display = 'inline-block';
        badge.style.borderColor = '#F43F5E';
        badge.style.color = '#F43F5E';
        badge.style.background = 'rgba(244, 63, 94, 0.15)';
        meta.innerHTML = `
            <div>Reason: <strong style="color:#F43F5E;">${reason || 'Authentication Failure'}</strong></div>
            <div class="small">The bank rejected this packet before touching the ledger.</div>
        `;
    }

    overlay.classList.add('open');
}

function closeResultSheet() {
    const overlay = document.getElementById('bottomSheetOverlay');
    if (overlay) overlay.classList.remove('open');
    resetTimeline();
}

// PIN dot visualizer
function setupPinDots() {
    const pinInput = document.getElementById('pin');
    if (!pinInput) return;

    pinInput.addEventListener('input', () => {
        const val = pinInput.value;
        for (let i = 1; i <= 4; i++) {
            const dot = document.getElementById(`pinDot${i}`);
            if (dot) {
                if (i <= val.length) dot.classList.add('filled');
                else dot.classList.remove('filled');
            }
        }
    });
}

// Setup Quick Amount Chips
function setQuickAmount(amt) {
    const input = document.getElementById('amount');
    if (input) {
        input.value = amt;
    }
}

// Setup Avatar Chips Selection
function selectReceiver(vpa, element) {
    const sel = document.getElementById('receiverVpa');
    if (sel) sel.value = vpa;

    document.querySelectorAll('.avatar-chip').forEach(c => c.classList.remove('active'));
    if (element) element.classList.add('active');
}

// ==========================================================================
// SVG Mesh Graph Visualizer (Pass 2)
// ==========================================================================

const MESH_NODE_COORDS = {
    'phone-alice':     { x: 80,  y: 155, label: 'phone-alice', role: 'Sender' },
    'phone-stranger1': { x: 210, y: 75,  label: 'stranger-1',  role: 'Offline' },
    'phone-stranger2': { x: 210, y: 235, label: 'stranger-2',  role: 'Offline' },
    'phone-stranger3': { x: 345, y: 155, label: 'stranger-3',  role: 'Offline' },
    'phone-bridge':    { x: 480, y: 155, label: 'phone-bridge', role: '4G Bridge', isBridge: true },
    'backend':         { x: 615, y: 155, label: 'Bank Backend', role: 'Ledger API', isBackend: true }
};

const MESH_LINKS = [
    ['phone-alice', 'phone-stranger1'],
    ['phone-alice', 'phone-stranger2'],
    ['phone-stranger1', 'phone-stranger3'],
    ['phone-stranger2', 'phone-stranger3'],
    ['phone-stranger3', 'phone-bridge'],
    ['phone-bridge', 'backend'] // 4G cellular link
];

function renderMeshGraph(devices) {
    const svg = document.getElementById('meshSvg');
    if (!svg) return;

    latestDeviceState = devices;

    // Create device lookup
    const devMap = {};
    devices.forEach(d => { devMap[d.deviceId] = d; });

    let linksHtml = '';
    MESH_LINKS.forEach(([src, dst], idx) => {
        const p1 = MESH_NODE_COORDS[src];
        const p2 = MESH_NODE_COORDS[dst];
        if (!p1 || !p2) return;

        const is4G = (src === 'phone-bridge' && dst === 'backend');
        linksHtml += `
            <line id="meshLink-${idx}" class="${is4G ? 'mesh-link-4g' : 'mesh-link'}"
                  x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}" />
        `;
    });

    let nodesHtml = '';
    Object.entries(MESH_NODE_COORDS).forEach(([nodeId, coord]) => {
        const dev = devMap[nodeId] || {};
        const isBridge = coord.isBridge;
        const isBackend = coord.isBackend;
        const packetCount = dev.packetCount || 0;
        const packets = dev.packetIds || [];

        // Node circle
        const circleClass = isBackend ? 'node-circle backend-node' : isBridge ? 'node-circle bridge-node' : 'node-circle';
        const iconSvg = isBackend ? `
            <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" stroke="#38BDF8" stroke-width="2" fill="none"/>
        ` : isBridge ? `
            <circle cx="12" cy="12" r="10" stroke="#00D26A" stroke-width="2" fill="none"/>
            <line x1="2" y1="12" x2="22" y2="12" stroke="#00D26A" stroke-width="1.5"/>
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" stroke="#00D26A" stroke-width="1.5" fill="none"/>
        ` : `
            <rect x="5" y="2" width="14" height="20" rx="3" stroke="#94A3B8" stroke-width="2" fill="none"/>
            <line x1="12" y1="18" x2="12.01" y2="18" stroke="#94A3B8" stroke-width="2" stroke-linecap="round"/>
        `;

        // Packet chip
        let packetTag = '';
        if (packetCount > 0 && packets.length > 0) {
            const firstPkt = packets[0];
            packetTag = `
                <g transform="translate(${coord.x - 26}, ${coord.y - 34})">
                    <rect class="packet-chip-svg" width="52" height="15"/>
                    <text class="packet-text-svg" x="26" y="11">${firstPkt}</text>
                </g>
            `;
        }

        nodesHtml += `
            <g class="node-group" id="node-${nodeId}">
                ${packetTag}
                <circle class="${circleClass}" cx="${coord.x}" cy="${coord.y}" r="22"/>
                <g transform="translate(${coord.x - 12}, ${coord.y - 12}) scale(1)">
                    ${iconSvg}
                </g>
                <text class="node-label" x="${coord.x}" y="${coord.y + 36}">${coord.label}</text>
                <text class="node-sublabel" x="${coord.x}" y="${coord.y + 48}">${coord.role}</text>
            </g>
        `;
    });

    svg.innerHTML = `
        <defs>
            <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
                <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                </feMerge>
            </filter>
        </defs>
        <g id="linksLayer">${linksHtml}</g>
        <g id="particlesLayer"></g>
        <g id="nodesLayer">${nodesHtml}</g>
    `;
}

// Animate Gossip Particles across Mesh Links
function animateGossipParticles() {
    const layer = document.getElementById('particlesLayer');
    if (!layer) return;

    layer.innerHTML = '';
    const activeNodes = (latestDeviceState || []).filter(d => d.packetCount > 0).map(d => d.deviceId);
    if (activeNodes.length === 0) activeNodes.push('phone-alice');

    MESH_LINKS.slice(0, 5).forEach(([src, dst]) => {
        const p1 = MESH_NODE_COORDS[src];
        const p2 = MESH_NODE_COORDS[dst];
        if (!p1 || !p2) return;

        const particle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        particle.setAttribute('class', 'gossip-particle');
        particle.setAttribute('r', '5');
        particle.setAttribute('cx', p1.x);
        particle.setAttribute('cy', p1.y);

        const animX = document.createElementNS('http://www.w3.org/2000/svg', 'animate');
        animX.setAttribute('attributeName', 'cx');
        animX.setAttribute('from', p1.x);
        animX.setAttribute('to', p2.x);
        animX.setAttribute('dur', '0.7s');
        animX.setAttribute('fill', 'freeze');

        const animY = document.createElementNS('http://www.w3.org/2000/svg', 'animate');
        animY.setAttribute('attributeName', 'cy');
        animY.setAttribute('from', p1.y);
        animY.setAttribute('to', p2.y);
        animY.setAttribute('dur', '0.7s');
        animY.setAttribute('fill', 'freeze');

        particle.appendChild(animX);
        particle.appendChild(animY);
        layer.appendChild(particle);

        animX.beginElement();
        animY.beginElement();
    });

    setTimeout(() => {
        if (layer) layer.innerHTML = '';
    }, 850);
}

// Animate Bridge Upload to Backend
function animateBridgeUpload(outcome, txId, reason) {
    const layer = document.getElementById('particlesLayer');
    if (!layer) return;

    const pBridge = MESH_NODE_COORDS['phone-bridge'];
    const pBackend = MESH_NODE_COORDS['backend'];

    const particle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    particle.setAttribute('r', '7');
    particle.setAttribute('fill', outcome === 'SETTLED' ? '#00D26A' : outcome === 'DUPLICATE_DROPPED' ? '#F59E0B' : '#F43F5E');
    particle.setAttribute('cx', pBridge.x);
    particle.setAttribute('cy', pBridge.y);

    const animX = document.createElementNS('http://www.w3.org/2000/svg', 'animate');
    animX.setAttribute('attributeName', 'cx');
    animX.setAttribute('from', pBridge.x);
    animX.setAttribute('to', pBackend.x);
    animX.setAttribute('dur', '0.5s');
    animX.setAttribute('fill', 'freeze');

    particle.appendChild(animX);
    layer.appendChild(particle);
    animX.beginElement();

    setTimeout(() => {
        // Tag above backend
        const tag = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tag.setAttribute('class', 'bridge-tag-svg');
        tag.setAttribute('x', pBackend.x);
        tag.setAttribute('y', pBackend.y - 32);
        tag.setAttribute('fill', outcome === 'SETTLED' ? '#00D26A' : outcome === 'DUPLICATE_DROPPED' ? '#F59E0B' : '#F43F5E');
        tag.textContent = outcome === 'SETTLED' ? `SETTLED #${txId}` : outcome === 'DUPLICATE_DROPPED' ? 'DUPLICATE' : 'INVALID';
        layer.appendChild(tag);

        setTimeout(() => {
            if (layer) layer.innerHTML = '';
        }, 1600);
    }, 500);
}

// ==========================================================================
// Master Refresh & Data Hydration
// ==========================================================================

async function refresh() {
    try {
        // 1. Mesh state
        const m = await fetch('/api/mesh/state').then(r => r.json());

        // Render SVG Mesh Graph (Pass 2)
        renderMeshGraph(m.devices);

        // Render Compact Device Cards
        const devicesDiv = document.getElementById('devices');
        if (devicesDiv) {
            devicesDiv.innerHTML = m.devices.map(d => `
                <div class="device ${d.hasInternet ? 'bridge' : 'offline'}">
                    <strong>${d.deviceId}</strong>
                    <span class="badge ${d.hasInternet ? 'badge-online' : 'badge-offline'}">
                        ${d.hasInternet ? '🌐 4G BRIDGE' : '🚫 OFFLINE'}
                    </span>
                    <span class="small">holding ${d.packetCount} packet(s)</span>
                    <div style="margin-top: 4px;">${d.packetIds.map(id => `<span class="packet-id">${id}</span>`).join('')}</div>
                </div>
            `).join('');
        }

        // Connectivity status pill in phone frame
        const hasAnyInternet = m.devices.some(d => d.hasInternet && d.packetCount > 0);
        const pill = document.getElementById('phoneConnPill');
        if (pill) {
            if (hasAnyInternet) {
                pill.className = 'connectivity-pill online';
                pill.innerHTML = '<span class="pulsing-dot"></span><span>4G Bridge Active</span>';
            } else {
                pill.className = 'connectivity-pill';
                pill.innerHTML = '<span class="pulsing-dot"></span><span>Offline Mesh</span>';
            }
        }

        // Idempotency engine badge
        const badgeEl = document.getElementById('idempotencyBadge');
        if (badgeEl && m.idempotencyMode) {
            badgeEl.textContent = `⚡ Engine: ${m.idempotencyMode}`;
        }
        const cacheInfoEl = document.getElementById('cacheInfo');
        if (cacheInfoEl) {
            cacheInfoEl.innerHTML = `Active Idempotency Store: <strong>${m.idempotencyMode || 'In-Memory'}</strong> | Cached Hashes: <strong>${m.idempotencyCacheSize}</strong>`;
        }

        // 2. Accounts
        const accs = await fetch('/api/accounts').then(r => r.json());
        const accTbody = document.querySelector('#accounts-table tbody');
        if (accTbody) {
            accTbody.innerHTML = accs.map(a => `
                <tr>
                    <td><strong>${a.vpa}</strong></td>
                    <td>${a.holderName}</td>
                    <td class="balance" style="color:#00D26A;">₹${parseFloat(a.balance).toFixed(2)}</td>
                    <td class="crypto-key">
                        <span>${a.publicKey ? a.publicKey.substring(0, 24) + '...' : 'None'}</span>
                        ${a.publicKey ? `<button class="btn-copy-key" onclick="copyKey('${a.publicKey}')" title="Copy ECDSA Public Key">Copy</button>` : ''}
                    </td>
                </tr>
            `).join('');
        }

        // Update Phone Hero Card balance for current sender
        const currentSenderVpa = document.getElementById('senderVpa')?.value || 'alice@demo';
        const currentSenderAccount = accs.find(a => a.vpa === currentSenderVpa);
        if (currentSenderAccount) {
            animateBalance(parseFloat(currentSenderAccount.balance));
            const heroVpaEl = document.getElementById('heroSenderVpa');
            if (heroVpaEl) heroVpaEl.textContent = currentSenderAccount.vpa;
        }

        // 3. Transactions
        const txs = await fetch('/api/transactions').then(r => r.json());
        const txTbody = document.querySelector('#tx-table tbody');
        if (txTbody) {
            txTbody.innerHTML = txs.map(t => `
                <tr>
                    <td>#${t.id}</td><td>${t.senderVpa}</td><td>${t.receiverVpa}</td>
                    <td class="balance">₹${parseFloat(t.amount).toFixed(2)}</td>
                    <td class="status-${t.status}">${t.status}</td>
                    <td>${t.bridgeNodeId}</td><td>${t.hopCount}</td>
                    <td class="small">${new Date(t.settledAt).toLocaleTimeString()}</td>
                </tr>
            `).join('');
        }
    } catch (err) {
        console.error('Refresh error:', err);
    }
}

// Handler: Inject Signed Packet (Step 1)
async function sendPacket() {
    try {
        const body = {
            senderVpa: document.getElementById('senderVpa').value,
            receiverVpa: document.getElementById('receiverVpa').value,
            amount: parseFloat(document.getElementById('amount').value),
            pin: document.getElementById('pin').value,
            ttl: 5,
            startDevice: 'phone-alice'
        };

        const r = await fetch('/api/demo/send', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(body)
        }).then(res => res.json());

        // Update Timeline
        resetTimeline();
        setTimelineStep(1, 'completed');
        setTimelineStep(2, 'active');

        log(`✍️ Signed canonical payload with ${body.senderVpa}'s ECDSA private key`);
        log(`🔒 Encrypted instruction using Server RSA-2048 + AES-256-GCM`);
        log(`📤 Injected MeshPacket [${r.packetId.substring(0,8)}] at ${r.injectedAt} (TTL ${r.ttl})`);

        showToast(`Signed ₹${body.amount} payment injected into offline mesh!`, 'success');
        refresh();
    } catch (e) {
        showToast('Error injecting payment', 'error');
        console.error(e);
    }
}

// Handler: Run Gossip Round (Step 2)
async function gossip() {
    try {
        const r = await fetch('/api/mesh/gossip', {method: 'POST'}).then(res => res.json());

        // Animate particles on SVG graph
        animateGossipParticles();

        setTimelineStep(2, 'completed');
        setTimelineStep(3, 'active');

        log(`🔄 Gossip Round: ${r.transfers} packet transfer(s) across Bluetooth peers`);
        showToast(`Gossip round: ${r.transfers} transfer(s) across peer devices`, 'info');
        refresh();
    } catch (e) {
        showToast('Gossip failed', 'error');
        console.error(e);
    }
}

// Handler: Bridges Upload to Backend (Step 3)
async function flushBridges() {
    try {
        const r = await fetch('/api/mesh/flush', {method: 'POST'}).then(res => res.json());

        setTimelineStep(3, 'completed');
        log(`📡 Bridge Ingestion: ${r.uploadsAttempted} upload(s) delivered to /api/bridge/ingest`);

        let settledFound = false;
        r.results.forEach(res => {
            // Animate packet flying to backend
            animateBridgeUpload(res.outcome, res.transactionId, res.reason);

            if (res.outcome === 'SETTLED') {
                settledFound = true;
                setTimelineStep(4, 'completed');
                log(`   ✅ [SETTLED] ${res.bridgeNode} packet ${res.packetId} → ECDSA Verified, Settled Tx #${res.transactionId}`);
                showToast(`Settled Tx #${res.transactionId} offline via ${res.bridgeNode}!`, 'success');

                const currentAmt = document.getElementById('amount')?.value || '500';
                showResultSheet({
                    success: true,
                    amount: currentAmt,
                    txId: res.transactionId,
                    bridgeNode: res.bridgeNode
                });
            } else if (res.outcome === 'DUPLICATE_DROPPED') {
                log(`   ⚠️ [DUPLICATE_DROPPED] ${res.bridgeNode} packet ${res.packetId} → Idempotency gate blocked duplicate upload`);
                showToast(`Duplicate packet ${res.packetId} dropped by idempotency gate`, 'warning');
            } else {
                setTimelineStep(4, 'threat');
                log(`   ❌ [REJECTED] ${res.bridgeNode} packet ${res.packetId} → Reason: ${res.reason}`);
                showToast(`Packet rejected: ${res.reason}`, 'error');

                // Update Attack Lab indicator
                const attackIndicator = document.getElementById('attackStatusIndicator');
                if (attackIndicator) {
                    attackIndicator.innerHTML = `<span style="color:#F43F5E;">❌ REJECTED (${res.reason})</span>`;
                }

                showResultSheet({
                    success: false,
                    reason: res.reason
                });
            }
        });

        refresh();
    } catch (e) {
        showToast('Bridge upload failed', 'error');
        console.error(e);
    }
}

// Handler: Inject Spoofed Packet (Step 4 Threat Simulation)
async function sendSpoofedPacket() {
    try {
        const body = {
            senderVpa: document.getElementById('senderVpa').value,
            receiverVpa: document.getElementById('receiverVpa').value,
            amount: parseFloat(document.getElementById('amount').value),
            pin: '0000',
            ttl: 5,
            startDevice: 'phone-stranger1'
        };

        const r = await fetch('/api/demo/spoof', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(body)
        }).then(res => res.json());

        resetTimeline();
        setTimelineStep(1, 'threat');
        setTimelineStep(2, 'active');

        log(`⚠️ ATTACK INJECTED: Packet claiming to be from ${body.senderVpa} signed with adversary's unauthorized key`);
        log(`📤 Injected forged packet [${r.packetId.substring(0,8)}] at ${r.injectedAt}`);

        // Update Attack Lab status indicator
        const attackIndicator = document.getElementById('attackStatusIndicator');
        if (attackIndicator) {
            attackIndicator.innerHTML = '<span style="color:#FBBF24;">⚠️ Spoofed Packet Injected into stranger-1. Run Gossip & Bridge Upload!</span>';
        }

        showToast('⚠️ Attack simulation injected with forged signature', 'error');
        refresh();
    } catch (e) {
        showToast('Error injecting spoofed packet', 'error');
        console.error(e);
    }
}

// Handler: Reset Mesh
async function resetMesh() {
    try {
        await fetch('/api/mesh/reset', {method: 'POST'});
        resetTimeline();
        closeResultSheet();

        const attackIndicator = document.getElementById('attackStatusIndicator');
        if (attackIndicator) {
            attackIndicator.innerHTML = '<span>Status: Ready to test</span>';
        }

        log('🗑 Mesh and idempotency cache cleared');
        showToast('Mesh & idempotency cache reset', 'info');
        refresh();
    } catch (e) {
        console.error(e);
    }
}

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    setupPinDots();
    setupTabKeyNav();
    refresh();
    setInterval(refresh, 3000);
});
