// Variables globales
let currentBcvMode = 'auto';
let currentBinanceMode = 'auto';
let bcvRate = 0;
let binanceRate = 0;

// Inicialización
document.addEventListener('DOMContentLoaded', function() {
    // Cargar tasas iniciales
    fetchAllRates();
    
    // Actualizar cada 5 minutos
    setInterval(fetchAllRates, 300000);
    
    // Event listeners para cálculos en tiempo real
    document.getElementById('rateBcv').addEventListener('input', calculateAll);
    document.getElementById('rateBinance').addEventListener('input', calculateAll);
    document.getElementById('inputUsd').addEventListener('input', calculateFromUsd);
    document.getElementById('inputUsdt').addEventListener('input', calculateFromUsdt);
    document.getElementById('inputBs').addEventListener('input', calculateFromBs);
    
    // Tema inicial
    loadTheme();
});

// APIs de tasas
async function fetchAllRates() {
    if (currentBcvMode === 'auto') await fetchBcvRate();
    if (currentBinanceMode === 'auto') await fetchBinanceRate();
}

async function fetchBcvRate() {
    const bcvInput = document.getElementById('rateBcv');
    const badge = document.getElementById('badgeBcv');
    
    try {
        // Usando múltiples APIs como respaldo
        const apis = [
            'https://pydolarvenezuela-api.vercel.app/api/v1/dollar/unit/BCV',
            'https://ve.dolarapi.com/v1/dolares/oficial',
            'https://api.exchangerate-api.com/v4/latest/USD'
        ];
        
        let rate = null;
        
        for (const api of apis) {
            try {
                const response = await fetch(api);
                if (!response.ok) continue;
                
                const data = await response.json();
                
                if (api.includes('pydolarvenezuela')) {
                    rate = data.price;
                } else if (api.includes('dolarapi')) {
                    rate = data.promedio;
                } else if (api.includes('exchangerate-api')) {
                    rate = data.rates.VES;
                }
                
                if (rate) break;
            } catch (e) {
                console.log(`Error con API ${api}:`, e);
            }
        }
        
        if (rate) {
            bcvRate = parseFloat(rate);
            bcvInput.value = bcvRate.toFixed(2);
            badge.textContent = 'AUTO ✓';
            updateLastUpdate();
            calculateAll();
        } else {
            throw new Error('No se pudo obtener la tasa');
        }
    } catch (error) {
        console.error('Error fetching BCV:', error);
        badge.textContent = 'AUTO ⚠';
        // Usar tasa por defecto si falla
        bcvRate = 36.50;
        bcvInput.value = bcvRate.toFixed(2);
    }
}

async function fetchBinanceRate() {
    const binanceInput = document.getElementById('rateBinance');
    const badge = document.getElementById('badgeBinance');
    
    try {
        // API de Binance P2P
        const response = await fetch('https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                page: 1,
                rows: 5,
                payTypes: [],
                asset: 'USDT',
                tradeType: 'SELL',
                fiat: 'VES',
                publisherType: null
            })
        });
        
        if (!response.ok) throw new Error('Error en respuesta de Binance');
        
        const data = await response.json();
        
        if (data.data && data.data.length > 0) {
            // Calcular promedio de las mejores ofertas
            let total = 0;
            let count = 0;
            
            data.data.forEach(adv => {
                if (adv.adv && adv.adv.price) {
                    total += parseFloat(adv.adv.price);
                    count++;
                }
            });
            
            if (count > 0) {
                binanceRate = total / count;
                // Aplicar comisión del 0.06%
                binanceRate = binanceRate * (1 + 0.0006);
                binanceInput.value = binanceRate.toFixed(2);
                badge.textContent = 'AUTO ✓';
                calculateAll();
            }
        }
    } catch (error) {
        console.error('Error fetching Binance:', error);
        
        // API de respaldo
        try {
            const backupResponse = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=USDTVES');
            if (backupResponse.ok) {
                const backupData = await backupResponse.json();
                binanceRate = parseFloat(backupData.price);
                binanceInput.value = binanceRate.toFixed(2);
                badge.textContent = 'AUTO ✓';
                calculateAll();
            } else {
                throw new Error('Backup API falló');
            }
        } catch (backupError) {
            console.error('Error en backup API:', backupError);
            badge.textContent = 'AUTO ⚠';
            // Usar tasa por defecto
            binanceRate = 38.50;
            binanceInput.value = binanceRate.toFixed(2);
        }
    }
    
    updateLastUpdate();
}

// Funciones de cálculo
function calculateAll() {
    const bcv = parseFloat(document.getElementById('rateBcv').value) || 0;
    const binance = parseFloat(document.getElementById('rateBinance').value) || 0;
    
    // Calcular brecha
    if (bcv > 0 && binance > 0) {
        const brecha = ((binance - bcv) / bcv * 100).toFixed(2);
        const factor = (binance / bcv).toFixed(2);
        
        document.getElementById('brechaBadge').textContent = `${brecha}%`;
        document.getElementById('factorBadge').textContent = `${factor}x`;
        
        // Color según brecha
        const badge = document.getElementById('brechaBadge');
        if (brecha > 15) {
            badge.style.background = '#ff3b30';
        } else if (brecha > 8) {
            badge.style.background = '#ff9500';
        } else {
            badge.style.background = '#34c759';
        }
    }
}

function calculateFromUsd() {
    const usd = parseFloat(document.getElementById('inputUsd').value) || 0;
    const bcv = parseFloat(document.getElementById('rateBcv').value) || 0;
    
    if (bcv > 0) {
        const bs = usd * bcv;
        document.getElementById('inputBs').value = bs.toFixed(2);
        updateBigDisplay(bs);
    }
}

function calculateFromUsdt() {
    const usdt = parseFloat(document.getElementById('inputUsdt').value) || 0;
    const binance = parseFloat(document.getElementById('rateBinance').value) || 0;
    
    if (binance > 0) {
        const bs = usdt * binance;
        document.getElementById('inputBs').value = bs.toFixed(2);
        updateBigDisplay(bs);
    }
}

function calculateFromBs() {
    const bs = parseFloat(document.getElementById('inputBs').value) || 0;
    const bcv = parseFloat(document.getElementById('rateBcv').value) || 0;
    const binance = parseFloat(document.getElementById('rateBinance').value) || 0;
    
    if (bcv > 0) {
        const usd = bs / bcv;
        document.getElementById('inputUsd').value = usd.toFixed(2);
        updatePowerUsd(usd);
    }
    
    if (binance > 0) {
        const usdt = bs / binance;
        document.getElementById('inputUsdt').value = usdt.toFixed(2);
    }
    
    updateBigDisplay(bs);
}

function updateBigDisplay(bsAmount) {
    const display = document.getElementById('bigBsDisplay');
    display.textContent = formatNumber(bsAmount) + ' Bs';
}

function updatePowerUsd(usdAmount) {
    document.getElementById('powerUsd').textContent = formatNumber(usdAmount);
}

function formatNumber(num) {
    return num.toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,');
}

function updateLastUpdate() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('es-VE', { 
        hour: '2-digit', 
        minute: '2-digit',
        second: '2-digit'
    });
    document.getElementById('lastUpdate').textContent = `Última actualización: ${timeStr}`;
}

// Toggle de modos
function toggleBcv() {
    const badge = document.getElementById('badgeBcv');
    const input = document.getElementById('rateBcv');
    
    if (currentBcvMode === 'auto') {
        currentBcvMode = 'manual';
        badge.textContent = 'MANUAL';
        input.disabled = false;
    } else {
        currentBcvMode = 'auto';
        badge.textContent = 'AUTO';
        input.disabled = true;
        fetchBcvRate();
    }
}

function toggleBinance() {
    const badge = document.getElementById('badgeBinance');
    const input = document.getElementById('rateBinance');
    
    if (currentBinanceMode === 'auto') {
        currentBinanceMode = 'manual';
        badge.textContent = 'MANUAL';
        input.disabled = false;
    } else {
        currentBinanceMode = 'auto';
        badge.textContent = 'AUTO';
        input.disabled = true;
        fetchBinanceRate();
    }
}

// Utilidades
function resetAll() {
    document.getElementById('inputUsd').value = '';
    document.getElementById('inputUsdt').value = '';
    document.getElementById('inputBs').value = '';
    document.getElementById('bigBsDisplay').textContent = '0,00 Bs';
    document.getElementById('powerUsd').textContent = '0.00';
}

function copyInputBs() {
    const bsInput = document.getElementById('inputBs');
    bsInput.select();
    document.execCommand('copy');
    
    // Feedback visual
    const btn = event.currentTarget;
    btn.style.opacity = '0.5';
    setTimeout(() => btn.style.opacity = '1', 200);
}

function copyToClipboard() {
    const text = document.getElementById('bigBsDisplay').textContent;
    navigator.clipboard.writeText(text);
    
    // Feedback visual
    const btn = document.querySelector('.btn-copy-elegant');
    btn.style.transform = 'scale(0.95)';
    setTimeout(() => btn.style.transform = 'scale(1)', 200);
}

// Tema
function toggleThemeSwitch() {
    const isDark = document.getElementById('themeToggleCheckbox').checked;
    document.body.classList.toggle('dark-mode', isDark);
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
}

function loadTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    const isDark = savedTheme === 'dark';
    document.getElementById('themeToggleCheckbox').checked = isDark;
    document.body.classList.toggle('dark-mode', isDark);
}
