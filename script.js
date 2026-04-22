/* Conservamos toda tu lógica original e inyectamos el cálculo en updateUI */
const getEl = (id) => document.getElementById(id);

let isBcvApi = true; 
let isBinanceApi = true; 
let binanceMemoryStack = [localStorage.getItem('vgap_binance') || "613.54"];
let bcvMemoryStack = [localStorage.getItem('vgap_bcv') || "421.87"];

// ... (Todas tus funciones startApp, toggleBcv, fetchBcvOnly, etc., se quedan IGUAL) ...

// MODIFICACIÓN EN LA FUNCIÓN SYNC PARA INCLUIR LA GANANCIA
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
    const bcv = parseFloat(getEl('rateBcv').value) || 1;
    const p2p = parseFloat(getEl('rateBinance').value) || 1;
    const bs = parseFloat(getEl('inputBs').value) || 0;
    const usdtRaw = parseFloat(getEl('inputUsdt').value) || 0;
    
    // UI Básica
    getEl('bigBsDisplay').innerText = new Intl.NumberFormat('de-DE', {minimumFractionDigits: 2}).format(bs) + " Bs";
    const power = bs > 0 ? (bs / bcv) : 0;
    getEl('powerUsd').innerText = power.toFixed(2);
    getEl('brechaBadge').innerText = (((p2p - bcv)/bcv)*100).toFixed(2) + "%";
    getEl('factorBadge').innerText = (p2p/bcv).toFixed(2) + "x";

    // CÁLCULO DE GANANCIA EXTRA
    // Si metes 10 USDT, realmente tienes más poder de compra en $ BCV que si tuvieras 10$ en efectivo.
    // La ganancia es: (Monto en Bolívares / Tasa BCV) - Monto USDT neto usado.
    const usdtNeto = usdtRaw > 0.06 ? usdtRaw - 0.06 : 0;
    if (bs > 0 && usdtNeto > 0) {
        const extra = power - usdtNeto;
        getEl('extraProfit').innerText = "+$" + extra.toFixed(2);
        getEl('profitArea').style.display = 'inline-block';
    } else {
        getEl('profitArea').style.display = 'none';
    }
};

// ... (Conserva todo tu código de Canvas y Gráficos al final del archivo sin cambios) ...
