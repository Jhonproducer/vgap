const getEl = (id) => document.getElementById(id);

let isBcvApi = true; 
let lastSavedBinance = localStorage.getItem('vgap_binance') || "610.80";

// Cambio de Tema con Texto Explicito
window.toggleTheme = () => {
    // Revisa si el modo oscuro está activo (porque el blanco es el default ahora)
    const isDark = document.body.getAttribute('data-theme') === 'dark';
    document.body.setAttribute('data-theme', isDark ? 'light' : 'dark');
    
    // Cambia el texto del botón
    getEl('themeBtn').innerText = isDark ? "MODO: CLARO" : "MODO: OSCURO";
    
    // Cambia el color del top bar en celulares
    document.querySelector('meta[name="theme-color"]').setAttribute('content', isDark ? '#F2F2F7' : '#000000');
};

// --- LÓGICA BCV (Se mantiene su API porque esa sí sirve) ---
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

// --- EL SALVAVIDAS DE BINANCE (BOTÓN DESHACER) ---
window.restoreBinance = () => {
    const input = getEl('rateBinance');
    const badge = getEl('badgeBinance');
    
    // Devuelve el valor a la última tasa guardada
    input.value = lastSavedBinance;
    sync('ratebinance');
    
    // Efecto visual para que sepas que se restauró
    badge.innerText = "¡LISTO!";
    badge.style.background = "var(--green)";
    badge.style.color = "black";
    
    setTimeout(() => {
        badge.innerText = "DESHACER";
        badge.style.background = ""; // Vuelve a su color normal de css
        badge.style.color = "";
    }, 1000);
};

window.onload = () => {
    getEl('rateBinance').value = lastSavedBinance;
    fetchBcvOnly();
    
    // TRUCO: Solo guardamos la tasa de Binance permanentemente cuando terminas de escribir y tocas fuera de la caja (evento 'blur')
    getEl('rateBinance').addEventListener('blur', (e) => {
        const val = e.target.value;
        if(val && parseFloat(val) > 0) {
            lastSavedBinance = val;
            localStorage.setItem('vgap_binance', val);
        }
    });
    
    // Mientras escribes, solo sincronizamos los cálculos en vivo, pero no sobreescribimos la memoria
    ['inputUsd', 'inputUsdt', 'inputBs', 'rateBcv', 'rateBinance'].forEach(id => {
        getEl(id).addEventListener('input', (e) => {
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
