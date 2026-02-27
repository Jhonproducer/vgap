const getEl = (id) => document.getElementById(id);

// Memoria para guardar tu número manual y no perderlo
let lastManualBinance = localStorage.getItem('vgap_binance') || "610.80";
let isBcvAuto = true;
let isBinanceAuto = false;

window.toggleTheme = () => {
    const isLight = document.body.getAttribute('data-theme') === 'light';
    document.body.setAttribute('data-theme', isLight ? 'dark' : 'light');
    getEl('themeBtn').innerText = isLight ? "🌙" : "☀️";
};

// Control del botón BCV
window.toggleBcv = () => {
    isBcvAuto = !isBcvAuto;
    const btn = getEl('btnModeBcv');
    const input = getEl('rateBcv');
    
    if (isBcvAuto) {
        btn.classList.add('active');
        input.disabled = true;
        getEl('bcvContainer').classList.remove('unlocked');
        fetchRates();
    } else {
        btn.classList.remove('active');
        input.disabled = false;
        getEl('bcvContainer').classList.add('unlocked');
        input.focus();
    }
};

// Control del botón BINANCE
window.toggleBinance = async () => {
    isBinanceAuto = !isBinanceAuto;
    const btn = getEl('btnModeBinance');
    const input = getEl('rateBinance');
    
    if (isBinanceAuto) {
        btn.classList.add('active');
        input.disabled = true;
        await fetchBinance();
    } else {
        btn.classList.remove('active');
        input.disabled = false;
        input.value = lastManualBinance;
        sync('ratebinance');
        input.focus();
    }
};

window.fetchRates = async () => {
    const btn = getEl('btnModeBcv');
    if (btn) btn.innerText = "CARGANDO...";
    try {
        const res = await fetch('https://ve.dolarapi.com/v1/dolares/oficial?t=' + Date.now());
        const data = await res.json();
        getEl('rateBcv').value = parseFloat(data.promedio).toFixed(2);
        
        const options = { timeZone: 'America/Caracas', day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit', hour12: true };
        const formattedDate = new Intl.DateTimeFormat('es-VE', options).format(new Date());
        getEl('lastUpdate').innerText = `Actualizado: ${formattedDate} VEN`;
        
        sync('ratebcv');
    } catch (e) { console.error("Error API BCV"); }
    if (btn) btn.innerText = "AUTO API";
};

window.fetchBinance = async () => {
    const btn = getEl('btnModeBinance');
    const input = getEl('rateBinance');
    if (btn) btn.innerText = "CARGANDO...";
    try {
        const res = await fetch('https://ve.dolarapi.com/v1/dolares/binance?t=' + Date.now());
        const data = await res.json();
        input.value = parseFloat(data.promedio).toFixed(2);
        sync('ratebinance');
    } catch (e) { console.error("Error API Binance"); }
    if (btn) btn.innerText = "PROMEDIO API";
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
    getEl('rateBinance').value = lastManualBinance;
    fetchRates();
    ['inputUsd', 'inputUsdt', 'inputBs', 'rateBcv', 'rateBinance'].forEach(id => {
        getEl(id).addEventListener('input', (e) => {
            // Guarda tu número silenciosamente solo si estás en modo manual
            if(id === 'rateBinance' && !isBinanceAuto) {
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
