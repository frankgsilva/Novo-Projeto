// Configurações Globais
Chart.defaults.font.family = "'Inter', sans-serif";
Chart.defaults.color = '#64748b';
Chart.defaults.scale.grid.color = '#e2e8f0';
// ISSO PREVINE O SCROLL INFINITO GLOBALMENTE
Chart.defaults.maintainAspectRatio = false; 

let charts = {};

window.onload = function() {
    console.log("Sistema Iniciado.");
    
    // Verifica se o database carregou
    if (typeof db_historico === 'undefined') {
        console.error("ERRO CRÍTICO: database.js não carregou.");
        alert("Erro: database.js não encontrado.");
        return;
    }

    // Tenta calcular imediatamente
    calculateAndRender();
    
    const btn = document.getElementById('btnCalc');
    if(btn) btn.addEventListener('click', calculateAndRender);
};

// --- MOTOR ERLANG C ---
function calculateErlangC(traffic, agents) {
    if (agents <= traffic) return 1.0;
    let ratio = traffic / agents;
    let invBlock = 1.0;
    for (let i = 1; i <= agents; i++) invBlock = 1 + invBlock * (i / traffic);
    let pWait = 1 / (invBlock * traffic * (1 - ratio) / agents + 1);
    return Math.min(Math.max(pWait, 0), 1);
}

function calculateServiceLevel(traffic, agents, targetTime, aht) {
    let pWait = calculateErlangC(traffic, agents);
    let sl = 1 - (pWait * Math.exp(-(agents - traffic) * (targetTime / aht)));
    return Math.max(0, Math.min(sl, 1));
}

function getRequiredAgents(traffic, slTarget, targetTime, aht, maxOcc) {
    if (traffic <= 0) return { agents: 0, occupancy: 0 };
    let agents = Math.floor(traffic) + 1;
    let limit = agents + 1000; 
    while (agents < limit) {
        let occ = traffic / agents;
        if (occ > maxOcc) { agents++; continue; }
        let currentSL = calculateServiceLevel(traffic, agents, targetTime, aht);
        if (currentSL >= slTarget) return { agents: agents, occupancy: occ, sl: currentSL };
        agents++;
    }
    return { agents: agents, occupancy: traffic/agents, sl: 0 };
}

// --- FUNÇÃO DE CRIAÇÃO SEGURA DE GRÁFICOS ---
function getOrCreateChart(id, type, config) {
    const canvas = document.getElementById(id);
    if (!canvas) {
        console.warn(`Canvas ${id} não encontrado.`);
        return null;
    }

    // Se já existe um gráfico nesta instância, destrua-o
    if (charts[id]) {
        charts[id].destroy();
    }

    // Cria novo gráfico
    charts[id] = new Chart(canvas.getContext('2d'), {
        type: type,
        data: { labels: [], datasets: [] },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            ...config
        }
    });
    return charts[id];
}

// --- CÁLCULO E RENDERIZAÇÃO ---
function calculateAndRender() {
    console.log("Calculando...");
    
    // Helpers
    const getVal = (id) => {
        const el = document.getElementById(id);
        return el ? (parseFloat(el.value) || 0) : 0;
    };

    // Inputs
    const currentHc = getVal('currentHcInput');
    const bidVolTotalAno = getVal('inputBidVol');
    const bidMonthlyGrowth = getVal('inputGrowthBid') / 100;
    const growthCarteira = getVal('inputGrowthCarteira') / 100;
    
    const tmaInput = getVal('tmeInput');
    const slTarget = getVal('slInput') / 100;
    const targetTime = getVal('targetTimeInput');
    const maxOccupancy = getVal('occupancyInput') / 100;
    
    const contractHours = getVal('contractHoursInput');
    const shrinkage = getVal('shrinkageInput') / 100;
    const absenteeism = getVal('absenteeismInput') / 100;
    const totalShrinkage = shrinkage + absenteeism;
    const cost = getVal('costInput');
    const rosteringSafety = 1.15;

    // Lógica Financeira (BID)
    let baseBidMonth0 = 0;
    if (bidVolTotalAno > 0) {
        if (bidMonthlyGrowth <= 0) baseBidMonth0 = bidVolTotalAno / 12;
        else baseBidMonth0 = (bidVolTotalAno * bidMonthlyGrowth) / (Math.pow(1 + bidMonthlyGrowth, 12) - 1);
    }

    // Arrays de Dados
    let labels = [], dBase = [], dBid = [], dReqHC = [], dCurrHC = [], dGap = [];
    let somaIntra = new Array(13).fill(0);
    let totalReqHC = 0, totalPas = 0, totalSL = 0;

    db_historico.forEach((m, i) => {
        labels.push(m.mes);
        
        let volBid = baseBidMonth0 * Math.pow(1 + bidMonthlyGrowth, i);
        let cliProj = (m.yfrank + m.cmari) * (1 + growthCarteira);
        let cr = m.cr || 0.05;
        let volBase = cliProj * cr;
        
        dBase.push(Math.round(volBase));
        dBid.push(Math.round(volBid));
        dCurrHC.push(currentHc);

        let totalVol = volBase + volBid;
        let dias = 22;
        let volDia = totalVol / dias;
        
        let sacCalls = volDia * 0.27; 
        let vozCalls = volDia * 0.73;
        
        let agentsNeededDay = 0;

        for(let h=0; h<13; h++) {
            let curveVal = (typeof curveSAC !== 'undefined') ? (curveSAC[h] || 0) : 0.07;
            
            let distSac = sacCalls * curveVal;
            let tfSac = (distSac * tmaInput) / 3600;
            let reqSac = getRequiredAgents(tfSac, slTarget, targetTime, tmaInput, maxOccupancy);

            let vozCurve = [0.09, 0.11, 0.10, 0.08, 0.08, 0.08, 0.10, 0.11, 0.11, 0.08, 0.06, 0.0, 0.0];
            let distVoz = vozCalls * (vozCurve[h] || 0);
            let tfVoz = (distVoz * tmaInput) / 3600;
            let reqVoz = getRequiredAgents(tfVoz, slTarget, targetTime, tmaInput, maxOccupancy);

            let totalH = reqSac.agents + reqVoz.agents;
            agentsNeededDay += totalH;
            somaIntra[h] += totalH;
        }

        let horasLogadas = agentsNeededDay * dias;
        let horasReais = horasLogadas * rosteringSafety;
        let horasLiqAgente = contractHours * (1 - totalShrinkage);
        let hc = horasLiqAgente > 0 ? horasReais / horasLiqAgente : 0;

        dReqHC.push(hc);
        dGap.push(hc - currentHc);
        
        totalReqHC += hc;
        totalPas += (agentsNeededDay / 13);
        
        let ratio = currentHc / (hc || 1);
        let estSL = ratio >= 1 ? slTarget : slTarget * Math.pow(ratio, 3);
        totalSL += estSL;
    });

    // Totais e KPIs
    let avgReqHC = Math.ceil(totalReqHC / 12);
    let avgGap = Math.round(avgReqHC - currentHc);
    let avgCost = avgGap * cost;
    let avgSLFinal = (totalSL / 12) * 100;
    let avgPasFinal = Math.ceil(totalPas / 12);
    let prodLiq = Math.round(contractHours * (1 - totalShrinkage));

    const set = (id, txt, cls) => {
        const el = document.getElementById(id);
        if(el) { el.innerText = txt; if(cls) el.className = `fw-bold mb-0 ${cls}`; }
    };

    set('resPas', avgPasFinal, 'text-info');
    
    let gapColor = avgGap > 0 ? 'text-danger' : 'text-success';
    set('resGap', avgGap > 0 ? `-${avgGap}` : `+${Math.abs(avgGap)}`, gapColor);
    
    if(document.getElementById('resGapText')) {
        document.getElementById('resGapText').innerText = avgGap > 0 ? "Deficit de Pessoas" : "Excesso de Pessoas";
    }

    set('resCostGap', avgCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), gapColor);
    
    let slColor = avgSLFinal < (slTarget*100 - 5) ? 'text-danger' : 'text-success';
    set('resProjSL', avgSLFinal.toFixed(1) + "%", slColor);
    
    set('resProdTime', prodLiq + "h", 'text-secondary');

    // --- ATUALIZAÇÃO DOS GRÁFICOS ---
    
    // 1. Chart Headcount (Combo)
    const cPos = getOrCreateChart('chartPositions', 'bar', {
        interaction: { mode: 'index', intersect: false },
        scales: { y: { beginAtZero: true } }
    });
    if(cPos) {
        cPos.data.labels = labels;
        cPos.data.datasets = [
            { label: 'Gap', data: dGap, backgroundColor: dGap.map(v => v > 0 ? '#ef4444' : '#10b981'), borderRadius: 4, order: 2 },
            { label: 'Necessário', data: dReqHC, type: 'line', borderColor: '#2563eb', borderWidth: 3, order: 0 },
            { label: 'Atual', data: dCurrHC, type: 'line', borderColor: '#f59e0b', borderWidth: 2, borderDash: [5,5], order: 1 }
        ];
        cPos.update();
    }

    // 2. Chart Volume (Forecast)
    const cVol = getOrCreateChart('chartVolume', 'bar', {
        scales: { x: { stacked: true }, y: { stacked: true } }
    });
    if(cVol) {
        cVol.data.labels = labels;
        cVol.data.datasets = [
            { label: 'Base', data: dBase, backgroundColor: '#cbd5e1' },
            { label: 'BID', data: dBid, backgroundColor: '#3b82f6' }
        ];
        cVol.update();
    }

    // 3. Chart Intraday (PAs)
    const cIntra = getOrCreateChart('chartIntraday', 'line', {
        plugins: { legend: { display: false } },
        scales: { x: { grid: { display: false } } }
    });
    if(cIntra) {
        cIntra.data.labels = ['08','09','10','11','12','13','14','15','16','17','18','19','20'];
        cIntra.data.datasets = [{ 
            label: 'Agentes', 
            data: somaIntra.map(v => Math.ceil(v/12)), 
            borderColor: '#8b5cf6', 
            backgroundColor: 'rgba(139, 92, 246, 0.1)', 
            fill: true 
        }];
        cIntra.update();
    }

    // 4. Chart Cost Composition (TMA)
    const cTMA = getOrCreateChart('chartTMA', 'doughnut', {
        cutout: '75%',
        plugins: { legend: { position: 'right', labels: { boxWidth: 10, font: {size: 10} } } }
    });
    if(cTMA) {
        let roster = 1 - (1/rosteringSafety);
        let totalLoss = shrinkage + absenteeism;
        let op = Math.max(0, 1 - (totalLoss + roster));
        cTMA.data.labels = ['Produtivo', 'Ineficiência', 'Perdas', 'Ociosidade'];
        cTMA.data.datasets = [{
            data: [op*100, roster*100, totalLoss*100, 0],
            backgroundColor: ['#10b981', '#ef4444', '#f59e0b', '#334155'],
            borderWidth: 0
        }];
        cTMA.update();
    }
}