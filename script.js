const getEl = (id) => document.getElementById(id);

let isBcvApi = false; 
let isBinanceApi = false; 

// Memoria para el auto-deshacer manual
let binanceMemoryStack = [localStorage.getItem('vgap_binance') || "613.54"];
let bcvMemoryStack = [localStorage.getItem('vgap_bcv') || "421.87"];

// --- ARRANQUE DESDE LA PANTALLA DE BIENVENIDA ---
window.startApp = (mode) => {
    // Oculta la pantalla de bienvenida con un efecto suave
    const overlay = getEl('welcomeOverlay');
    overlay.style.opacity = '0';
    setTimeout(() => { overlay.style.display = 'none'; }, 400);

    // Enciende la App quitando el desenfoque
    const app = getEl('mainApp');
    app.style.filter = 'none';
    app.style.pointerEvents = 'auto';

    // Aplica la elección del usuario
    if (mode === 'auto') {
        isBcvApi = true;
        isBinanceApi = true;
        
        getEl('badgeBcv').innerText = "...";
        getEl('badgeBcv').className = "mode-badge api-bcv";
        getEl('rateBcv').disabled = true;
        getEl('bcvContainer').classList.remove('unlocked');
        
        getEl('badgeBinance').innerText = "...";
        getEl('badgeBinance').className = "mode-badge api-binance";
        getEl('rateBinance').disabled = true;

        fetchBcvOnly();
        fetchBinanceOnly();

    } else {
        isBcvApi = false;
        isBinanceApi = false;
        
        getEl('badgeBcv').innerText = "MANUAL";
        getEl('badgeBcv').className = "mode-badge manual-mode";
        getEl('rateBcv').disabled = false;
        getEl('rateBcv').value = bcvMemoryStack[bcvMemoryStack.length - 1];
        getEl('bcvContainer').classList.add('unlocked');
        
        getEl('badgeBinance').innerText = "MANUAL";
        getEl('badgeBinance').className = "mode-badge manual-mode";
        getEl('rateBinance').disabled = false;
        getEl('rateBinance').value = binanceMemoryStack[binanceMemoryStack.length - 1];
        
        getEl('lastUpdate').innerText = "Modo Manual Activado";
        sync('ratebcv');
    }
};

// --- INTERRUPTOR DE TEMA (SOL/LUNA) ---
window.toggleThemeSwitch = () => {
    const isLight = getEl('themeToggleCheckbox').checked;
    document.body.setAttribute('data-theme', isLight ? 'light' : 'dark');
    document.querySelector('meta[name="theme-color"]').setAttribute('content', isLight ? '#F2F2F7' : '#000000');
};

// --- CONTROLES MANUALES INDIVIDUALES ---
window.toggleBcv = async () => {
    isBcvApi = !isBcvApi;
    if (isBcvApi) {
        getEl('badgeBcv').innerText = "...";
        getEl('badgeBcv').className = "mode-badge api-bcv";
        getEl('rateBcv').disabled = true;
        getEl('bcvContainer').classList.remove('unlocked');
        await fetchBcvOnly();
    } else {
        getEl('badgeBcv').innerText = "MANUAL";
        getEl('badgeBcv').className = "mode-badge manual-mode";
        getEl('rateBcv').disabled = false;
        getEl('rateBcv').value = bcvMemoryStack[bcvMemoryStack.length - 1];
        getEl('bcvContainer').classList.add('unlocked');
        sync('ratebcv');
        getEl('rateBcv').focus();
    }
};

window.toggleBinance = async () => {
    isBinanceApi = !isBinanceApi;
    if (isBinanceApi) {
        getEl('badgeBinance').innerText = "...";
        getEl('badgeBinance').className = "mode-badge api-binance";
        getEl('rateBinance').disabled = true;
        await fetchBinanceOnly(); 
    } else {
        getEl('badgeBinance').innerText = "MANUAL";
        getEl('badgeBinance').className = "mode-badge manual-mode";
        getEl('rateBinance').disabled = false;
        getEl('rateBinance').value = binanceMemoryStack[binanceMemoryStack.length - 1];
        sync('ratebinance');
        getEl('rateBinance').focus();
    }
};

// --- BUSCADOR BCV (CON DESTRUCTOR DE CACHÉ AGRESIVO) ---
window.fetchBcvOnly = async () => {
    const badge = getEl('badgeBcv');
    const input = getEl('rateBcv');

    try {
        // Truco Anti-Caché: Forzamos a descargar datos nuevos añadiendo código aleatorio y Headers estrictos
        const nocacheUrl = 'https://ve.dolarapi.com/v1/dolares?v=' + new Date().getTime() + '&rnd=' + Math.random();
        
        const r = await fetch(nocacheUrl, {
            method: 'GET',
            headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate', 'Pragma': 'no-cache', 'Expires': '0' }
        });
        
        const data = await r.json();
        const bcvData = data.find(item => item.fuente === 'oficial');
        
        if (bcvData && bcvData.promedio) {
            input.value = parseFloat(bcvData.promedio).toFixed(2);
            
            const options = { timeZone: 'America/Caracas', day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit', hour12: true };
            getEl('lastUpdate').innerText = `Actualizado: ${new Intl.DateTimeFormat('es-VE', options).format(new Date())} VEN`;
            
            badge.innerText = "AUTO";
            sync('ratebcv');
        } else {
            throw new Error("Sin datos de BCV");
        }
    } catch (e) {
        badge.innerText = "ERROR";
        setTimeout(() => window.toggleBcv(), 1000);
    }
};

// --- BUSCADOR PARALELO/BINANCE (CON DESTRUCTOR DE CACHÉ AGRESIVO) ---
window.fetchBinanceOnly = async () => {
    const badge = getEl('badgeBinance');
    const input = getEl('rateBinance');

    try {
        const nocacheUrl = 'https://ve.dolarapi.com/v1/dolares?v=' + new Date().getTime() + '&rnd=' + Math.random();
        
        const r = await fetch(nocacheUrl, {
            method: 'GET',
            headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate', 'Pragma': 'no-cache', 'Expires': '0' }
        });
        
        const data = await r.json();
        const paraleloData = data.find(item => item.fuente === 'paralelo');
        
        if (paraleloData && paraleloData.promedio) {
            input.value = parseFloat(paraleloData.promedio).toFixed(2);
            badge.innerText = "AUTO";
            sync('ratebinance');
        } else {
            throw new Error("Sin datos de Paralelo");
        }
    } catch (e) {
        badge.innerText = "ERROR";
        setTimeout(() => window.toggleBinance(), 1000);
    }
};

window.onload = () => {
    // La app arranca esperando que toques el botón de la Pantalla de Bienvenida
    getEl('rateBinance').value = binanceMemoryStack[binanceMemoryStack.length - 1];
    getEl('rateBcv').value = bcvMemoryStack[bcvMemoryStack.length - 1];
    
    // MAGIA AUTO-DESHACER
    getEl('rateBinance').addEventListener('blur', (e) => {
        if(!isBinanceApi) {
            const val = e.target.value;
            if(!val || parseFloat(val) <= 0) {
                e.target.value = binanceMemoryStack[binanceMemoryStack.length - 1]; 
                sync('ratebinance');
            } else {
                binanceMemoryStack.push(val);
                if(binanceMemoryStack.length > 10) binanceMemoryStack.shift();
                localStorage.setItem('vgap_binance', val);
            }
        }
    });

    getEl('rateBcv').addEventListener('blur', (e) => {
        if(!isBcvApi) {
            const val = e.target.value;
            if(!val || parseFloat(val) <= 0) {
                e.target.value = bcvMemoryStack[bcvMemoryStack.length - 1]; 
                sync('ratebcv');
            } else {
                bcvMemoryStack.push(val);
                if(bcvMemoryStack.length > 10) bcvMemoryStack.shift();
                localStorage.setItem('vgap_bcv', val);
            }
        }
    });
    
    // Sincronización en vivo
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
