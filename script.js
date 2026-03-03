const getEl = (id) => document.getElementById(id);

// ¡Ambas tasas arrancan en AUTO y vivas gracias a la súper API!
let isBcvApi = true; 
let isBinanceApi = true; 
let lastManualBinance = localStorage.getItem('vgap_binance') || "610.80";

// Lógica del Interruptor Animado iOS
window.toggleThemeSwitch = () => {
    const isDark = getEl('themeToggleCheckbox').checked;
    document.body.setAttribute('data-theme', isDark ? 'dark' : 'light');
    document.querySelector('meta[name="theme-color"]').setAttribute('content', isDark ? '#000000' : '#F2F2F7');
};

// --- CONTROL ETIQUETA BCV ---
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
        if (isBcvApi) badge.innerText = "AUTO";
    } else {
        badge.innerText = "MANUAL";
        badge.className = "mode-badge manual-mode";
        input.disabled = false;
        container.classList.add('unlocked');
        input.focus();
    }
};

// --- CONTROL ETIQUETA BINANCE ---
window.toggleBinance = async () => {
    isBinanceApi = !isBinanceApi;
    const badge = getEl('badgeBinance');
    const input = getEl('rateBinance');
    
    if (isBinanceApi) {
        badge.innerText = "...";
        badge.className = "mode-badge api-binance";
        input.disabled = true;
        await fetchBinanceOnly(); 
        if (isBinanceApi) badge.innerText = "AUTO";
    } else {
        badge.innerText = "MANUAL";
        badge.className = "mode-badge manual-mode";
        input.disabled = false;
        input.value = lastManualBinance;
        sync('ratebinance');
        input.focus();
    }
};

// --- SÚPER MOTOR: PYDOLARVENEZUELA (EXTRACCIÓN BCV) ---
window.fetchBcvOnly = async () => {
    let bcvRate = 0;
    const endpoints = [
        'https://pydolarvenezuela-api.vercel.app/api/v1/dollar/unit/bcv', // EL SANTO GRIAL
        'https://ve.dolarapi.com/v1/dolares/oficial', // Respaldo por si acaso
        'https://api.allorigins.win/raw?url=' + encodeURIComponent('https://pydolarvenezuela-api.vercel.app/api/v1/dollar/unit/bcv') // Proxy
    ];

    for (let url of endpoints) {
        try {
            const r = await fetch(url + (url.includes('?') ? '&' : '?') + 't=' + Date.now(), { cache: 'no-store' });
            const d = await r.json();
            if (d && d.price) bcvRate = parseFloat(d.price);
            else if (d && d.promedio) bcvRate = parseFloat(d.promedio);
            
            if (bcvRate > 0) break;
        } catch (e) {}
    }

    const badge = getEl('badgeBcv');
    const input = getEl('rateBcv');
    const container = getEl('bcvContainer');

    if (bcvRate > 0) {
        input.value = bcvRate.toFixed(2);
        const options = { timeZone: 'America/Caracas', day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit', hour12: true };
        getEl('lastUpdate').innerText = `Actualizado: ${new Intl.DateTimeFormat('es-VE', options).format(new Date())} VEN`;
        sync('ratebcv');
    } else {
        badge.innerText = "ERROR";
        badge.className = "mode-badge manual-mode";
        badge.style.color = "#FF453A";
        setTimeout(() => {
            isBcvApi = false;
            badge.innerText = "MANUAL";
            badge.style.color = "";
            input.disabled = false;
            container.classList.add('unlocked');
        }, 1200);
    }
};

// --- SÚPER MOTOR: PYDOLARVENEZUELA (EXTRACCIÓN BINANCE) ---
window.fetchBinanceOnly = async () => {
    let p2pRate = 0;
    const endpoints = [
        'https://pydolarvenezuela-api.vercel.app/api/v1/dollar/unit/binance', // EL SANTO GRIAL
        'https://api.allorigins.win/raw?url=' + encodeURIComponent('https://pydolarvenezuela-api.vercel.app/api/v1/dollar/unit/binance') // Proxy
    ];

    for (let url of endpoints) {
        try {
            const r = await fetch(url + (url.includes('?') ? '&' : '?') + 't=' + Date.now(), { cache: 'no-store' });
            const d = await r.json();
            if (d && d.price) p2pRate = parseFloat(d.price);
            if (p2pRate > 0) break;
        } catch (e) {}
    }

    const input = getEl('rateBinance');
    const badge = getEl('badgeBinance');

    if (p2pRate > 0) {
        input.value = p2pRate.toFixed(2);
        sync('ratebinance');
    } else {
        badge.innerText = "ERROR";
        badge.className = "mode-badge manual-mode";
        badge.style.color = "#FF453A";
        setTimeout(() => {
            isBinanceApi = false;
            badge.innerText = "MANUAL";
            badge.style.color = "";
            input.disabled = false;
            input.value = lastManualBinance;
            sync('ratebinance');
        }, 1200);
    }
};

window.onload = () => {
    // Apenas abres la página, la súper API trae ambas tasas automáticamente
    getEl('rateBinance').value = lastManualBinance;
    fetchBcvOnly();
    fetchBinanceOnly(); 
    
    ['inputUsd', 'inputUsdt', 'inputBs', 'rateBcv', 'rateBinance'].forEach(id => {
        getEl(id).addEventListener('input', (e) => {
            if(id === 'rateBinance' && !isBinanceApi) {
                const val = e.target.value;
                if(val && parseFloat(val) > 0) {
                    lastManualBinance = val;
                    localStorage.setItem('vgap_binance', val);
                }
            }
            sync(id.replace('input', '').toLowerCase());
        });
    });
};

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
