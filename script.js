const getEl = (id) => document.getElementById(id);

// Estado independiente para cada tasa
let isBcvApi = true; 
let isBinanceApi = false; 
let lastManualBinance = localStorage.getItem('vgap_binance') || "610.80";

// Iconos limpios para el modo oscuro
const moonSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>';
const sunSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>';

window.toggleTheme = () => {
    const isLight = document.body.getAttribute('data-theme') === 'light';
    document.body.setAttribute('data-theme', isLight ? 'dark' : 'light');
    getEl('themeBtn').innerHTML = isLight ? moonSvg : sunSvg;
};

// --- LÓGICA BCV PERFECTA ---
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
        badge.innerText = "AUTO";
    } else {
        badge.innerText = "MANUAL";
        badge.className = "mode-badge manual-mode";
        input.disabled = false;
        container.classList.add('unlocked');
        input.focus();
    }
};

// --- LÓGICA BINANCE BLINDADA ---
window.toggleBinance = async () => {
    isBinanceApi = !isBinanceApi;
    const badge = getEl('badgeBinance');
    const input = getEl('rateBinance');
    
    if (isBinanceApi) {
        badge.innerText = "...";
        badge.className = "mode-badge api-binance";
        input.disabled = true;
        await fetchBinanceOnly(); // Va a la API
    } else {
        badge.innerText = "MANUAL";
        badge.className = "mode-badge manual-mode";
        input.disabled = false;
        input.value = lastManualBinance; // Te devuelve el tuyo instantáneo
        sync('ratebinance');
        input.focus();
    }
};

// Buscador API BCV
window.fetchBcvOnly = async () => {
    try {
        const res = await fetch('https://ve.dolarapi.com/v1/dolares/oficial?t=' + Date.now());
        const data = await res.json();
        getEl('rateBcv').value = parseFloat(data.promedio).toFixed(2);
        
        const options = { timeZone: 'America/Caracas', day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit', hour12: true };
        const formattedDate = new Intl.DateTimeFormat('es-VE', options).format(new Date());
        getEl('lastUpdate').innerText = `Actualizado: ${formattedDate} VEN`;
        sync('ratebcv');
    } catch (e) { console.error("Error API BCV"); }
};

// Buscador API Binance Doble-Filtro
window.fetchBinanceOnly = async () => {
    let success = false;
    let p2pRate = 0;

    // Intento 1: API PyDolarVenezuela (La más precisa para P2P en Vzla)
    try {
        const res1 = await fetch('https://pydolarvenezuela-api.vercel.app/api/v1/dollar/unit/binance');
        const data1 = await res1.json();
        if (data1 && data1.price) {
            p2pRate = parseFloat(data1.price);
            success = true;
        }
    } catch (e) {}

    // Intento 2: DolarApi (Respaldo por si la primera se cae)
    if (!success) {
        try {
            const res2 = await fetch('https://ve.dolarapi.com/v1/dolares/binance?t=' + Date.now());
            const data2 = await res2.json();
            if (data2 && data2.promedio) {
                p2pRate = parseFloat(data2.promedio);
                success = true;
            }
        } catch (e) {}
    }

    const input = getEl('rateBinance');
    const badge = getEl('badgeBinance');

    if (success && p2pRate > 0) {
        input.value = p2pRate.toFixed(2);
        sync('ratebinance');
        badge.innerText = "AUTO"; // ¡Éxito total, se queda en AUTO!
    } else {
        // SI TODO FALLA: No se congela, te devuelve a manual y te avisa.
        alert("⚠️ La API de Binance está saturada o no responde. Te hemos devuelto al modo MANUAL.");
        isBinanceApi = false;
        badge.innerText = "MANUAL";
        badge.className = "mode-badge manual-mode";
        input.disabled = false;
        input.value = lastManualBinance;
        sync('ratebinance');
    }
};

// Arranque de la App
window.onload = () => {
    getEl('rateBinance').value = lastManualBinance;
    fetchBcvOnly(); // Arranca con el BCV real por defecto
    
    ['inputUsd', 'inputUsdt', 'inputBs', 'rateBcv', 'rateBinance'].forEach(id => {
        getEl(id).addEventListener('input', (e) => {
            // Guarda tu número en la memoria oculta SOLO si estás en manual
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
