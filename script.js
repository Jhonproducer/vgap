const getEl = (id) => document.getElementById(id);

let isBcvApi = true; 
let isBinanceApi = true; 

let binanceMemoryStack = [localStorage.getItem('vgap_binance') || "613.54"];
let bcvMemoryStack = [localStorage.getItem('vgap_bcv') || "421.87"];

// --- PANTALLA DE BIENVENIDA Y TEMA ---
window.startApp = (theme) => {
    document.body.setAttribute('data-theme', theme);
    getEl('themeToggleCheckbox').checked = theme === 'dark';
    document.querySelector('meta[name="theme-color"]').setAttribute('content', theme === 'dark' ? '#000000' : '#F2F2F7');
    localStorage.setItem('vgap_theme_saved', theme);
    
    getEl('welcomeScreen').classList.add('hidden');
    getEl('mainApp').style.opacity = '1';
};

window.toggleThemeSwitch = () => {
    const isDark = getEl('themeToggleCheckbox').checked;
    const theme = isDark ? 'dark' : 'light';
    document.body.setAttribute('data-theme', theme);
    document.querySelector('meta[name="theme-color"]').setAttribute('content', isDark ? '#000000' : '#F2F2F7');
    localStorage.setItem('vgap_theme_saved', theme);
    
    // Actualizar colores del gráfico interactivo si está abierto
    if(typeof historicalChartInstance !== 'undefined' && historicalChartInstance) {
        const textColor = isDark ? '#8E8E93' : '#636366';
        const gridColor = isDark ? '#333335' : '#D1D1D6';
        const tooltipBg = isDark ? 'rgba(28,28,30,0.95)' : 'rgba(255,255,255,0.95)';
        const tooltipText = isDark ? '#FFFFFF' : '#000000';
        
        historicalChartInstance.options.scales.x.ticks.color = textColor;
        historicalChartInstance.options.scales.y.ticks.color = textColor;
        historicalChartInstance.options.scales.y.grid.color = gridColor;
        historicalChartInstance.options.plugins.tooltip.backgroundColor = tooltipBg;
        historicalChartInstance.options.plugins.tooltip.titleColor = tooltipText;
        historicalChartInstance.options.plugins.tooltip.bodyColor = tooltipText;
        historicalChartInstance.options.plugins.tooltip.borderColor = gridColor;
        historicalChartInstance.update();
    }
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
        input.value = bcvMemoryStack[bcvMemoryStack.length - 1];
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
        input.value = binanceMemoryStack[binanceMemoryStack.length - 1];
        sync('ratebinance');
        input.focus();
    }
};

window.fetchBcvOnly = async () => {
    const badge = getEl('badgeBcv');
    const input = getEl('rateBcv');
    try {
        const r = await fetch('https://ve.dolarapi.com/v1/dolares?t=' + new Date().getTime());
        const data = await r.json();
        const bcvData = data.find(item => item.fuente === 'oficial');
        if (bcvData && bcvData.promedio) {
            input.value = parseFloat(bcvData.promedio).toFixed(2);
            // Usamos tu API para la fecha exacta de la última actualización real
            const apiDate = new Date(bcvData.fechaActualizacion);
            const options = { timeZone: 'America/Caracas', day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit', hour12: true };
            getEl('lastUpdate').innerText = `Actualizado: ${new Intl.DateTimeFormat('es-VE', options).format(apiDate)} VEN`;
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

window.fetchBinanceOnly = async () => {
    const badge = getEl('badgeBinance');
    const input = getEl('rateBinance');
    try {
        const r = await fetch('https://ve.dolarapi.com/v1/dolares?t=' + new Date().getTime());
        const data = await r.json();
        const paraleloData = data.find(item => item.fuente === 'paralelo');
        if (paraleloData && paraleloData.promedio) {
            input.value = parseFloat(paraleloData.promedio).toFixed(2);
            badge.innerText = "AUTO";
            sync('ratebinance');
        } else {
            throw new Error("Sin datos");
        }
    } catch (e) {
        badge.innerText = "ERROR";
        setTimeout(() => window.toggleBinance(), 1000);
    }
};

window.onload = () => {
    const savedTheme = localStorage.getItem('vgap_theme_saved');
    if (savedTheme) {
        getEl('welcomeScreen').style.display = 'none';
        document.body.setAttribute('data-theme', savedTheme);
        getEl('themeToggleCheckbox').checked = savedTheme === 'dark';
        document.querySelector('meta[name="theme-color"]').setAttribute('content', savedTheme === 'dark' ? '#000000' : '#F2F2F7');
        getEl('mainApp').style.opacity = '1';
    }

    fetchBcvOnly();
    fetchBinanceOnly(); 
    
    // Carga los datos del gráfico en secreto por detrás para que estén listos
    backgroundPreloadChart(); 

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
    
    ['inputUsd', 'inputUsdt', 'inputBs', 'rateBcv', 'rateBinance'].forEach(id => {
        getEl(id).addEventListener('input', () => sync(id.replace('input', '').toLowerCase()));
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


// =========================================================================
// MÓDULO INTELIGENTE "GRÁFICO BINANCE" (CON CHART.JS ESTABLE)
// =========================================================================

let rawChartData = { oficial: { labels: [], data: [] }, paralelo: { labels: [], data: [] } };
let historicalChartInstance = null;
let currentGraphType = 'paralelo'; 
let chartIsExpanded = false;

// 1. Descarga y procesa la data plana que mostraste, de forma silenciosa
async function backgroundPreloadChart() {
    try {
        const resp = await fetch('https://ve.dolarapi.com/v1/historicos/dolares?t=' + new Date().getTime());
        const data = await resp.json();
        
        ['oficial', 'paralelo'].forEach(fuente => {
            // Filtramos
            let filtered = data.filter(d => d.fuente === fuente);
            
            // Ordenamos del más viejo al más nuevo usando la "fecha"
            // Se le suma T12:00:00 para evitar que la zona horaria reste un día
            filtered.sort((a, b) => new Date(a.fecha + "T12:00:00") - new Date(b.fecha + "T12:00:00"));
            
            // Guardamos solo los últimos 30 días para no saturar
            filtered = filtered.slice(-30);
            
            rawChartData[fuente].labels = filtered.map(item => {
                let d = new Date(item.fecha + "T12:00:00");
                return d.toLocaleDateString('es-VE', {day: '2-digit', month: 'short'}); // Ejemplo: 14 feb
            });
            rawChartData[fuente].data = filtered.map(item => parseFloat(item.promedio));
        });
    } catch(e) {
        console.error("Error cargando históricos", e);
    }
}

// 2. Control del Acordeón
window.toggleChart = () => {
    chartIsExpanded = !chartIsExpanded;
    getEl('chartContent').classList.toggle('collapsed');
    getEl('chartChevron').classList.toggle('rotate');
    
    if(chartIsExpanded) {
        // Damos 300ms a que el CSS abra la caja, y luego pintamos el gráfico
        setTimeout(() => {
            if(!historicalChartInstance && rawChartData.paralelo.data.length > 0) {
                renderChart();
            }
        }, 300);
    }
}

// 3. Cambio de Pestañas (P2P vs BCV)
window.switchChartType = (type) => {
    currentGraphType = type;
    getEl('tabBinChart').classList.toggle('active', type === 'paralelo');
    getEl('tabBcvChart').classList.toggle('active', type === 'oficial');
    
    if(historicalChartInstance) {
        historicalChartInstance.data = getChartDataset();
        historicalChartInstance.update();
    } 
}

// 4. El motor de dibujo (Chart.js interactivo)
function renderChart() {
    const ctx = getEl('ultraHistoryCanvas').getContext('2d');
    
    // Leemos el tema actual
    const isDark = document.body.getAttribute('data-theme') === 'dark';
    const textColor = isDark ? '#8E8E93' : '#636366';
    const gridColor = isDark ? '#333335' : '#D1D1D6';
    const tooltipBg = isDark ? 'rgba(28,28,30,0.95)' : 'rgba(255,255,255,0.95)';
    const tooltipText = isDark ? '#FFFFFF' : '#000000';
    
    historicalChartInstance = new Chart(ctx, {
        type: 'line',
        data: getChartDataset(),
        options: {
            responsive: true,
            maintainAspectRatio: false, // Fundamental para que respete el contenedor fijo y no desborde
            plugins: {
                legend: { display: false },
                // Aquí nace la magia interactiva: la burbuja al pasar el dedo
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: tooltipBg,
                    titleColor: tooltipText,
                    bodyColor: tooltipText,
                    borderColor: gridColor,
                    borderWidth: 1,
                    padding: 10,
                    displayColors: false,
                    callbacks: {
                        label: function(context) {
                            return 'Precio: ' + new Intl.NumberFormat('de-DE', {minimumFractionDigits: 2}).format(context.parsed.y) + ' Bs';
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: textColor, maxTicksLimit: 7 } // Máximo 7 fechas abajo para no amontonar
                },
                y: {
                    grid: { color: gridColor, borderDash: [5, 5] },
                    ticks: { color: textColor }
                }
            },
            interaction: {
                mode: 'nearest',
                axis: 'x',
                intersect: false
            },
            elements: {
                line: { tension: 0.4 }, // Curvas suaves y orgánicas
                point: { radius: 0, hitRadius: 15, hoverRadius: 6 } // Los puntos son invisibles hasta que los tocas
            }
        }
    });
}

// 5. Gestor de Datos (Colores y Valores)
function getChartDataset() {
    const isParalelo = currentGraphType === 'paralelo';
    const colorLine = isParalelo ? '#FF9F0A' : '#0A84FF';
    const bgColor = isParalelo ? 'rgba(255, 159, 10, 0.15)' : 'rgba(10, 132, 255, 0.15)';
    
    return {
        labels: rawChartData[currentGraphType].labels,
        datasets: [{
            label: isParalelo ? 'Paralelo' : 'BCV',
            data: rawChartData[currentGraphType].data,
            borderColor: colorLine,
            backgroundColor: bgColor,
            borderWidth: 3,
            fill: true
        }]
    };
}
