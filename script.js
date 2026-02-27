const getEl = (id) => document.getElementById(id);

// Memoria inteligente: guarda tu última tasa manual de Binance
let lastManualRate = localStorage.getItem('vgap_binance') || "610.80";

// Iconos vectoriales para el botón de tema (Sin Emojis)
const moonSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>';
const sunSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>';

window.toggleTheme = () => {
    const isLight = document.body.getAttribute('data-theme') === 'light';
    document.body.setAttribute('data-theme', isLight ? 'dark' : 'light');
    getEl('themeBtn').innerHTML = isLight ? moonSvg : sunSvg;
};

// Botón Desplazable BCV
window.toggleBcvMode = () => {
    const isAuto = getEl('bcvSwitch').checked;
    const bcv = getEl('rateBcv');
    bcv.disabled = isAuto;
    getEl('bcvContainer').classList.toggle('unlocked', !isAuto);
    if (isAuto) fetchRates();
};

// Botón Desplazable BINANCE (Auto vs Manual)
window.toggleBinanceMode = async () => {
    const isAuto = getEl('binanceSwitch').checked;
    const binInput = getEl('rateBinance');
    
    binInput.disabled = isAuto;
    
    if (isAuto) {
        await window.fetchBinance(); // Si enciendes el switch, trae el promedio API
    } else {
        binInput.value = lastManualRate; // Si lo apagas, devuelve tu número escrito
        sync('ratebinance');
    }
};

window.fetchRates = async () => {
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

window.fetchBinance = async () => {
    const btn = getEl('btnBinFetch');
    const binInput = getEl('rateBinance');
    const binSwitch = getEl('binanceSwitch');
    
    btn.classList.add('spinning');
    try {
        const res = await fetch('https://ve.dolarapi.com/v1/dolares/binance?t=' + Date.now());
        const data = await res.json();
        binInput.value = parseFloat(data.promedio).toFixed(2);
        
        // Activar el switch automáticamente si usas la flechita
        binInput.disabled = true;
        binSwitch.checked = true;
        
        sync('ratebinance');
    } catch (e) { console.error("Error API Binance"); }
    setTimeout(() => btn.classList.remove('spinning'), 500);
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

window.onload = () => {
    getEl('rateBinance').value = lastManualRate;
    fetchRates();
    ['inputUsd', 'inputUsdt', 'inputBs', 'rateBcv', 'rateBinance'].forEach(id => {
        getEl(id).addEventListener('input', (e) => {
            // Guarda tu número manual automáticamente
            if(id === 'rateBinance') {
                const val = e.target.value;
                if(val && parseFloat(val) > 0) {
                    lastManualRate = val;
                    localStorage.setItem('vgap_binance', val);
                }
            }
            sync(id.replace('input', '').toLowerCase());
        });
    });
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
