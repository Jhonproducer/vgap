const getEl = (id) => document.getElementById(id);

let isBcvApi = true; 
let isBinanceApi = true; 

// SÚPER ANTI-CACHÉ DEFENSIVO para burlar a cualquier operadora WiFi y navegador normal
const noCacheOptions = { 
    cache: 'no-store', // Orden directa al fetch api
    headers: {
        'Pragma': 'no-cache',      // Orden para caches viejos
        'Cache-Control': 'no-cache', // Orden moderna
        'Expires': '0'             // Orden de expiración total
    }
};

// --- GESTIÓN DE TEMAS BRUTAL (CON SELECTOR PRE-ENTRADA) ---
const checkInitialTheme = () => {
    const savedTheme = localStorage.getItem('vgap_theme_brutal');
    const overlay = getEl('themeSelectionOverlay');
    const app = getEl('mainApp');
    const checkbox = getEl('themeToggleCheckbox');

    if (savedTheme) {
        // Ya eligió tema antes, entra directo
        applyThemeBrutal(savedTheme);
        overlay.style.display = 'none'; // Desaparece selector
        app.style.display = 'block'; // Aparece app
        
        checkbox.checked = savedTheme === 'dark'; // Sincroniza switch
    } else {
        // Primera vez o sin tema guardado, muestra selector sobre fondo negro
        applyThemeBrutal('dark'); // Overlay es oscuro por defecto para look premium negro
        overlay.style.display = 'flex';
        app.style.display = 'none';
    }
};

// Guardado permanente y transición brutal
window.chooseTheme = (theme) => {
    applyThemeBrutal(theme);
    localStorage.setItem('vgap_theme_brutal', theme);
    getEl('themeToggleCheckbox').checked = theme === 'dark'; // Sincroniza switch de la app

    // Transición suave de salida
    getEl('themeSelectionOverlay').classList.add('fade-out');
    setTimeout(() => {
        getEl('themeSelectionOverlay').style.display = 'none';
        getEl('mainApp').style.display = 'block';
    }, 500); // 0.5s coincidente con css transition
};

// Interruptor Premium de Sol/Luna dentro de la App
window.toggleThemeSwitch = () => {
    const isChecked = getEl('themeToggleCheckbox').checked;
    const theme = isChecked ? 'dark' : 'light';
    applyThemeBrutal(theme);
    localStorage.setItem('vgap_theme_brutal', theme);
};

// Aplicación técnica del tema visual
const applyThemeBrutal = (theme) => {
    document.body.setAttribute('data-theme', theme);
    const isDark = theme === 'dark';
    // Cambia color del top bar en móviles
    document.querySelector('meta[name="theme-color"]').setAttribute('content', isDark ? '#000000' : '#F2F2F7');
};

// --- LÓGICA BCV INTELIGENTE (100% PyDolarDirecto) ---
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
        getEl('sparklineBcv').parentNode.style.display = "block"; // Muestra grafico
        await fetchRatesAndDrawGraphs(); // Recarga y actualiza graficos
        if (isBcvApi) badge.innerText = "AUTO";
    } else {
        badge.innerText = "MANUAL";
        badge.className = "mode-badge manual-mode";
        input.disabled = false;
        container.classList.add('unlocked');
        getEl('sparklineBcv').parentNode.style.display = "none"; // Oculta grafico en manual
        input.focus();
    }
};

// --- LÓGICA BINANCE/PARALELO INTELIGENTE (100% PyDolarDirecto) ---
window.toggleBinance = async () => {
    isBinanceApi = !isBinanceApi;
    const badge = getEl('badgeBinance');
    const input = getEl('rateBinance');
    
    if (isBinanceApi) {
        badge.innerText = "...";
        badge.className = "mode-badge api-binance";
        input.disabled = true;
        getEl('sparklineBinance').parentNode.style.display = "block"; // Muestra grafico
        await fetchRatesAndDrawGraphs(); // Recarga y actualiza graficos
        if (isBinanceApi) badge.innerText = "AUTO";
    } else {
        badge.innerText = "MANUAL";
        badge.className = "mode-badge manual-mode";
        input.disabled = false;
        getEl('sparklineBinance').parentNode.style.display = "none"; // Oculta grafico en manual
        input.focus();
    }
};

// --- SÚPER MOTOR UNIFICADO: TASAS ACTUALES (DolarApi Unificado) ---
// Obtiene tasas y dispara el dibujo de gráficos
const fetchRatesAndDrawGraphs = async () => {
    try {
        // 1. PETICIÓN UNIFICADA A DOLARAPI DIRECTO (Usando la tumba-caché y cabeceras anti-bloqueo)
        // Agregamos timestamp ?t= para asegurar que la operadora wifi traiga dato fresco
        const r = await fetch('https://ve.dolarapi.com/v1/dolares?t=' + Date.now(), noCacheOptions);
        const data = await r.json();
        
        // Buscamos las fuentes oficiales y paralelo directamente en la respuesta cruda unificada
        const bcvData = data.find(item => item.fuente === 'oficial');
        const paraleloData = data.find(item => item.fuente === 'paralelo');
        
        // Actualizamos Inputs si están en modo AUTO
        if (isBcvApi && bcvData && bcvData.promedio) {
            getEl('rateBcv').value = parseFloat(bcvData.promedio).toFixed(2);
        }
        
        if (isBinanceApi && paraleloData && paraleloData.promedio) {
            getEl('rateBinance').value = parseFloat(paraleloData.promedio).toFixed(2);
        }
        
        // Actualizamos hora de Venezuela
        if (data.length > 0) {
            const options = { timeZone: 'America/Caracas', day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit', hour12: true };
            getEl('lastUpdate').innerText = `Actualizado: ${new Intl.DateTimeFormat('es-VE', options).format(new Date())} VEN`;
        }
        
        // Sincronizamos cálculos y Badges AUTO
        if (isBcvApi) getEl('badgeBcv').innerText = "AUTO";
        if (isBinanceApi) getEl('badgeBinance').innerText = "AUTO";
        
        sync('ratebcv'); // Lanza cálculos iniciales

        // 2. PETICIÓN A HISTÓRICOS Y DIBUJO DE GRÁFICOS (Idea 2 Brutal)
        await fetchHistoricalDataAndDraw();

    } catch (e) { 
        console.error("Error API DolarApi Crudo:", e); 
        if(isBcvApi) { getEl('badgeBcv').innerText = "ERROR"; setTimeout(() => toggleBcv(), 1200); }
        if(isBinanceApi) { getEl('badgeBinance').innerText = "ERROR"; setTimeout(() => toggleBinance(), 1200); }
    }
};

// --- MOTOR DE HISTÓRICOS Y DIBUJO DE GRÁFICOS SPARKLINE (Idea 2 Brutal) ---
const fetchHistoricalDataAndDraw = async () => {
    try {
        // Petición a históricos (Usando la tumba-caché)
        const r_h = await fetch('https://ve.dolarapi.com/v1/historicos/dolares?t=' + Date.now(), noCacheOptions);
        const histData = await r_h.json();
        
        // Filtramos históricos de los últimos 10 días para oficial y paralelo
        // El array crudo viene ordenado de nuevo a viejo. Tomamos los primeros 10.
        const histOficial = histData.filter(h => h.fuente === 'oficial').slice(0, 10).reverse(); // Invertimos para graficar de viejo a nuevo
        const histParalelo = histData.filter(h => h.fuente === 'paralelo').slice(0, 10).reverse();
        
        // Dibujamos mini-gráficos
        if(histOficial.length > 1 && isBcvApi) drawSparklineBrutal('sparklineBcv', histOficial);
        if(histParalelo.length > 1 && isBinanceApi) drawSparklineBrutal('sparklineBinance', histParalelo);

    } catch (e) { console.error("Error Gráficos DolarApi Históricos:", e); }
};

// --- DIBUJANTE DE GRÁFICOS SPARKLINE SIN LIBRERÍAS (Arte SVG Puro) ---
const drawSparklineBrutal = (svgId, histArray) => {
    const svg = getEl(svgId);
    const path = svg.querySelector('.sparkline-path');
    const container = svg.parentNode;
    
    // Extraemos solo los precios promedios
    const prices = histArray.map(h => parseFloat(h.promedio));
    const firstPrice = prices[0];
    const lastPrice = prices[prices.length - 1];
    
    // Calculamos min/max para escalar
    const minPrice = Math.min(...prices) * 0.999; // Agregamos margen mínimo
    const maxPrice = Math.max(...prices) * 1.001; // Agregamos margen máximo
    
    if (minPrice === maxPrice) return; // No hay cambio, no graficamos

    // Dimensiones del VIEWBOX del SVG
    const svgW = 100; // Ancho Viewbox fixed
    const svgH = 30; // Alto Viewbox fixed
    
    // Paso de X (distancia entre puntos)
    const stepX = svgW / (prices.length - 1);
    
    // Generación de string de ruta SVG M x,y L x,y ...
    let pathString = "M ";
    
    for (let i = 0; i < prices.length; i++) {
        const p = prices[i];
        
        const x = i * stepX;
        // Y es invertida en SVG, escalamos el precio al alto del Viewbox
        const y = svgH - ((p - minPrice) / (maxPrice - minPrice) * svgH);
        
        // Coordenadas con precisión bruta
        pathString += `${x.toFixed(2)},${y.toFixed(2)} `;
        if (i < prices.length - 1) pathString += " L ";
    }
    
    // Aplicamos la ruta al path SVG
    path.setAttribute('d', pathString);
    
    // --- INTELIGENCIA DE COLOR (Lógica de tendencia) ---
    // Compara el precio de hoy contra el primero de hace 10 dias
    const trendContainer = container.parentNode.parentNode; // .input-field
    
    if (lastPrice < firstPrice) {
        // BAJÓ: ¡Nivel Brutal, brilla verde!
        trendContainer.classList.add('green_trend');
    } else {
        // SUBIÓ O IGUAL: Mantiene su color Azul/Naranja normal brillante
        trendContainer.classList.remove('green_trend');
    }
    
    // Activamos el contenedor para efecto de entrada suave
    container.classList.add('active');
};

// --- CALCULADORA UNIFICADA BRUTAL ---
window.onload = () => {
    // 1. Chequeo de tema Pre-entrada Brutal
    checkInitialTheme();
    
    // 2. Carga inicial de datos Brutal
    fetchRatesAndDrawGraphs(); // Carga rates unificados y dibuja graficos
    
    // 3. Listeners unificados para cálculos en vivo y guardado de manuales
    ['inputUsd', 'inputUsdt', 'inputBs', 'rateBcv', 'rateBinance'].forEach(id => {
        getEl(id).addEventListener('input', (e) => {
            sync(id.replace('input', '').toLowerCase());
        });
    });
};

// --- NÚCLEO CALCULADOR VGAP (Mantenido intacto y preciso) ---
const sync = (origin) => {
    const bcvInput = parseFloat(getEl('rateBcv').value) || 1;
    const p2pInput = parseFloat(getEl('rateBinance').value) || 1;
    const com = 0.06;
    const usd = getEl('inputUsd'), usdt = getEl('inputUsdt'), bs = getEl('inputBs');

    if (origin === 'usd' || origin === 'ratebcv') {
        const v = parseFloat(usd.value) || 0;
        bs.value = v > 0 ? (v * bcvInput).toFixed(2) : "";
        usdt.value = v > 0 ? ((v * bcvInput / p2pInput) + com).toFixed(2) : "";
    } else if (origin === 'usdt') {
        const v = parseFloat(usdt.value) || 0;
        const neto = v > com ? v - com : 0;
        bs.value = neto > 0 ? (neto * p2pInput).toFixed(2) : "";
        usd.value = neto > 0 ? (neto * p2pInput / bcvInput).toFixed(2) : "";
    } else if (origin === 'bs' || origin === 'ratebinance') {
        const v = parseFloat(bs.value) || 0;
        usd.value = v > 0 ? (v / bcvInput).toFixed(2) : "";
        usdt.value = v > 0 ? ((v / p2pInput) + com).toFixed(2) : "";
    }
    updateUI();
};

const updateUI = () => {
    const bcvInput = parseFloat(getEl('rateBcv').value) || 1, p2pInput = parseFloat(getEl('rateBinance').value) || 1, bs = parseFloat(getEl('inputBs').value) || 0;
    // Gran formato alemán de puntos y comas para el Bolivar
    getEl('bigBsDisplay').innerText = new Intl.NumberFormat('de-DE', {minimumFractionDigits: 2}).format(bs) + " Bs";
    getEl('powerUsd').innerText = bs > 0 ? (bs / bcvInput).toFixed(2) : "0.00";
    getEl('brechaBadge').innerText = (((p2pInput - bcvInput)/bcvInput)*100).toFixed(2) + "%";
    getEl('factorBadge').innerText = (p2pInput/bcvInput).toFixed(2) + "x";
};

// --- ACCIONES SECUNDARIAS ---
window.copyToClipboard = async () => {
    // Formatea el monto Bs gran de para copiarlo limpio a la banca
    const txt = getEl('bigBsDisplay').innerText.split(' ')[0].replace(/[^\d,]/g, '').replace(',', '.');
    await navigator.clipboard.writeText(txt);
    const btn = document.querySelector('.btn-copy-elegant');
    btn.innerText = "¡COPIADO!"; btn.disabled = true;
    setTimeout(() => { btn.innerText = "COPIAR MONTO"; btn.disabled = false; }, 1000);
};

window.copyInputBs = async () => {
    const val = getEl('inputBs').value;
    if(val) await navigator.clipboard.writeText(val);
};

window.resetAll = () => { ['inputUsd', 'inputUsdt', 'inputBs'].forEach(id => getEl(id).value = ""); updateUI(); };
