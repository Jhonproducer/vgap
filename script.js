const getEl = (id) => document.getElementById(id);

// Ambas arrancan en automático conectadas a PyDolarVenezuela
let isBcvApi = true; 
let isBinanceApi = true; 

// Memoria para el auto-deshacer
let lastSavedBinance = localStorage.getItem('vgap_binance') || "610.80";
let lastSavedBcv = localStorage.getItem('vgap_bcv') || "41.50";

// --- INTERRUPTOR DE TEMA ---
window.toggleThemeSwitch = () => {
    const isDark = getEl('themeToggleCheckbox').checked;
    document.body.setAttribute('data-theme', isDark ? 'dark' : 'light');
    document.querySelector('meta[name="theme-color"]').setAttribute('content', isDark ? '#000000' : '#F2F2F7');
};

// --- LÓGICA BCV ---
window.toggleBcv = async () => {
    isBcvApi = !isBcvApi;
    const badge = getEl('badgeBcv');
    const input = getEl('rateBcv');
    const container = getEl('bcvContainer');
    
    if (isBcvApi) {
        badge.innerText = "...";
        badge.className = "mode-badge api-bcv";
        input.disabled = true;
        container.classList.remove('unlocked');
        await fetchBcvOnly();
    } else {
        badge.innerText = "MANUAL";
        badge.className = "mode-badge manual-mode";
        input.disabled = false;
        input.value = lastSavedBcv;
        sync('ratebcv');
        container.classList.add('unlocked');
        input.focus();
    }
};

// --- LÓGICA BINANCE ---
window.toggleBinance = async () => {
    isBinanceApi = !isBinanceApi;
    const badge = getEl('badgeBinance');
    const input = getEl('rateBinance');
    
    if (isBinanceApi) {
        badge.innerText = "...";
        badge.className = "mode-badge api-binance";
        input.disabled = true;
        await fetchBinanceOnly(); 
    } else {
        badge.innerText = "MANUAL";
        badge.className = "mode-badge manual-mode";
        input.disabled = false;
        input.value = lastSavedBinance;
        sync('ratebinance');
        input.focus();
    }
};

// --- BUSCADOR BCV (PYDOLARVENEZUELA) ---
window.fetchBcvOnly = async () => {
    let bcvRate = 0;
    const endpoints = [
        'https://pydolarvenezuela-api.vercel.app/api/v1/dollar/unit/bcv',
        'https://api.allorigins.win/raw?url=' + encodeURIComponent('https://pydolarvenezuela-api.vercel.app/api/v1/dollar/unit/bcv')
    ];

    for (let url of endpoints) {
        try {
            const r = await fetch(url + (url.includes('?') ? '&' : '?') + 't=' + Date.now(), { cache: 'no-store' });
            const d = await r.json();
            if (d && d.price) { bcvRate = parseFloat(d.price); break; }
        } catch (e) { }
    }

    const badge = getEl('badgeBcv');
    const input = getEl('rateBcv');

    if (bcvRate > 0) {
        input.value = bcvRate.toFixed(2);
        lastSavedBcv = input.value;
        localStorage.setItem('vgap_bcv', input.value);
        
        const options = { timeZone: 'America/Caracas', day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit', hour12: true };
        getEl('lastUpdate').innerText = `Actualizado: ${new Intl.DateTimeFormat('es-VE', options).format(new Date())} VEN`;
        badge.innerText = "AUTO";
        sync('ratebcv');
    } else {
        badge.innerText = "ERROR";
        setTimeout(() => window.toggleBcv(), 1000); // Si falla, pasa a manual solo
    }
};

// --- BUSCADOR BINANCE (PYDOLARVENEZUELA) ---
window.fetchBinanceOnly = async () => {
    let p2pRate = 0;
    const endpoints = [
        'https://pydolarvenezuela-api.vercel.app/api/v1/dollar/unit/binance',
        'https://api.allorigins.win/raw?url=' + encodeURIComponent('https://pydolarvenezuela-api.vercel.app/api/v1/dollar/unit/binance')
    ];

    for (let url of endpoints) {
        try {
            const r = await fetch(url + (url.includes('?') ? '&' : '?') + 't=' + Date.now(), { cache: 'no-store' });
            const d = await r.json();
            if (d && d.price) { p2pRate = parseFloat(d.price); break; }
        } catch (e) { }
    }

    const badge = getEl('badgeBinance');
    const input = getEl('rateBinance');

    if (p2pRate > 0) {
        input.value = p2pRate.toFixed(2);
        badge.innerText = "AUTO";
        sync('ratebinance');
    } else {
        badge.innerText = "ERROR";
        setTimeout(() => window.toggleBinance(), 1000); // Si falla, pasa a manual solo
    }
};

window.onload = () => {
    getEl('rateBinance').value = lastManualBinance;
    getEl('rateBcv').value = lastSavedBcv;
    
    // Arranca trayendo ambas de la API automáticamente
    fetchBcvOnly();
    fetchBinanceOnly(); 
    
    // MAGIA AUTO-DESHACER: Si borras el número por error y sales de la caja, te lo devuelve
    getEl('rateBinance').addEventListener('blur', (e) => {
        if(!isBinanceApi) {
            const val = e.target.value;
            if(!val || parseFloat(val) <= 0) {
                e.target.value = lastManualBinance; // Auto-Deshacer
                sync('ratebinance');
            } else {
                lastManualBinance = val; // Guarda el nuevo número bueno
                localStorage.setItem('vgap_binance', val);
            }
        }
    });

    getEl('rateBcv').addEventListener('blur', (e) => {
        if(!isBcvApi) {
            const val = e.target.value;
            if(!val || parseFloat(val) <= 0) {
                e.target.value = lastSavedBcv; // Auto-Deshacer
                sync('ratebcv');
            } else {
                lastSavedBcv = val;
                localStorage.setItem('vgap_bcv', val);
            }
        }
    });
    
    // Sincronización en vivo mientras escribes
    ['inputUsd', 'inputUsdt', 'inputBs', 'rateBcv', 'rateBinance'].forEach(id => {
        getEl(id).addEventListener('input', (e) => {
            sync(id.replace('input', '').toLowerCase());
        });
    });
};

// --- CALCULADORA PRINCIPAL ---
const sync = (origin) => {
    const bcv = parseFloat(getEl('rateBcv').value) || 1;
    const p2p = parseFloat(getEl('rateBinance').value) || 1;
    const com = 0.06;
    const usd = getEl('inputUsd'), usdt = getEl('inputUsdt'), bs = getEl('inputBs');

    if (origin === 'usd' || origin === 'ratebcv') {
        const v = parseFloat(usd.value) || 0;
        bs.value = v > 0 ? (v * bcv).toFixed(2) : "";
        usdt.value = v > 0 ? ((v * bcv / p2p) + com).toFixed(2) : "";
    } else if (origin === 'usdt') {
        const v = parseFloat(usdt.value) || 0;
        const neto = v > com ? v - com : 0;
        bs.value = neto > 0 ? (neto * p2p).toFixed(2) : "";
        usd.value = neto > 0 ? (neto * p2p / bcv).toFixed(2) : "";
    } else if (origin === 'bs' || origin === 'ratebinance') {
        const v = parseFloat(bs.value) || 0;
        usd.value = v > 0 ? (v / bcv).toFixed(2) : "";
        usdt.value = v > 0 ? ((v / p2p) + com).toFixed(2) : "";
    }
    updateUI();
};

const updateUI = () => {
    const bcv = parseFloat(getEl('rateBcv').value) || 1, p2p = parseFloat(getEl('rateBinance').value) || 1, bs = parseFloat(getEl('inputBs').value) || 0;
    getEl('bigBsDisplay').innerText = new Intl.NumberFormat('de-DE', {minimumFractionDigits: 2}).format(bs) + " Bs";
    getEl('powerUsd').innerText = bs > 0 ? (bs / bcv).toFixed(2) : "0.00";
    getEl('brechaBadge').innerText = (((p2p - bcv)/bcv)*100).toFixed(2) + "%";
    getEl('factorBadge').innerText = (p2p/bcv).toFixed(2) + "x";
};

window.copyToClipboard = async () => {
    const txt = getEl('bigBsDisplay').innerText.split(' ')[0].replace(/[^\d,]/g, '').replace(',', '.');
    await navigator.clipboard.writeText(txt);
    const btn = document.querySelector('.btn-copy-elegant');
    btn.innerText = "¡COPIADO!";
    setTimeout(() => btn.innerText = "COPIAR MONTO", 1000);
};

window.copyInputBs = async () => {
    const val = getEl('inputBs').value;
    if(val) await navigator.clipboard.writeText(val);
};

window.resetAll = () => { ['inputUsd', 'inputUsdt', 'inputBs'].forEach(id => getEl(id).value = ""); updateUI(); };
