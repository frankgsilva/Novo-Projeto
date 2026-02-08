// Configurações Globais do Chart.js
Chart.defaults.font.family = "'Inter', sans-serif";
Chart.defaults.color = '#64748b';
Chart.defaults.scale.grid.color = '#f1f5f9';

let charts = {}; 

window.onload = function() {
    console.log("Sistema WFM Command Center Iniciado.");
    
    // Inicializa gráficos apenas se o canvas existir
    if(document.getElementById('chartPositions')) initCharts();
    
    // Força um cálculo inicial
    calculateAndRender();
    
    // Event Listener
    document.getElementById('btnCalc').addEventListener('click', calculateAndRender);
};

// --- MOTOR MATEMÁTICO ERLANG C (ESTABILIZADO) ---
// Evita estouro de memória com fatorial de números grandes

function calculateErlangC(traffic, agents) {
    if (agents <= traffic) return 1.0; // Sobrecarga total
    
    // Método Estável: Calcula os termos iterativamente
    // Fórmula: ErlangC = 1 / (1 + (1-rho) * (n! / A^n) * Sum(A^i/i!))
    
    let ratio = traffic / agents;
    let invBlock = 1.0; // Este é o termo acumulador
    
    for (let i = 1; i <= agents; i++) {
        invBlock = 1 + invBlock * (i / traffic);
    }
    
    // Probabilidade de espera P(Wait)
    let pWait = 1 / (invBlock * traffic * (1 - ratio) / agents + 1);
    
    // Cap em 1.0
    return Math.min(Math.max(pWait, 0), 1);
}

function calculateServiceLevel(traffic, agents, targetTime, aht) {
    let pWait = calculateErlangC(traffic, agents);
    // SL = 1 - (P(Wait) * e^(-(N-A) * (TargetTime / AHT)))
    let sl = 1 - (pWait * Math.exp(-(agents - traffic) * (targetTime / aht)));
    return Math.max(0, Math.min(sl, 1));
}

function getRequiredAgents(traffic, slTarget, targetTime, aht, maxOcc) {
    if (traffic <= 0) return { agents: 0, occupancy: 0 };
    
    // Começa com N = A + 1
    let agents = Math.floor(traffic) + 1;
    
    // Loop de segurança (Max 500 agentes para evitar travamento)
    let limit = agents + 500;

    while (agents < limit) {
        let occ = traffic / agents;
        
        // 1. Restrição de Ocupação
        if (occ > maxOcc) {
            agents++;
            continue;
        }

        // 2. Restrição de Nível de Serviço
        let currentSL = calculateServiceLevel(traffic, agents, targetTime, aht);
        if (currentSL >= slTarget) {
            return { agents: agents, occupancy: occ, sl: currentSL };
        }

        agents++;
    }
    return { agents: agents, occupancy: traffic/agents, sl: 0 };
}

function initCharts() {
    // 1. GAP COMBO CHART
    const ctxPos = document.getElementById('chartPositions').getContext('2d');
    charts.positions = new Chart(ctxPos, {
        type: 'bar',
        data: {
            labels: [],
            datasets: [
                {
                    label: 'Gap (HC)',
                    type: 'bar',
                    backgroundColor: (ctx) => {
                        const v = ctx.raw;
                        return v > 0 ? '#ef4444' : '#10b981'; // Vermelho se falta (>0), Verde se sobra (<0)
                    },
                    data: [],
                    borderRadius: 4,
                    order: 2
                },
                {
                    label: 'HC Necessário',
                    type: 'line',
                    borderColor: '#2563eb', // Azul Principal
                    borderWidth: 3,
                    tension: 0.4,
                    pointRadius: 3,
                    pointBackgroundColor: '#fff',
                    data: [],
                    order: 0
                },
                {
                    label: 'HC Atual',
                    type: 'line',
                    borderColor: '#f59e0b', // Laranja
                    borderWidth: 2,
                    borderDash: [5, 5],
                    pointRadius: 0,
                    data: [],
                    order: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: { legend: { display: true } },
            scales: { y: { beginAtZero: true } }
        }
    });

    // 2. INTRADAY LINE
    const ctxIntra = document.getElementById('chartIntraday').getContext('2d');
    charts.intraday = new Chart(ctxIntra, {
        type: 'line',
        data: {
            labels: ['08', '09', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20'],
            datasets: [{
                label: 'Agentes Hora',
                borderColor: '#8b5cf6', // Roxo
                backgroundColor: 'rgba(139, 92, 246, 0.1)',
                fill: true,
                tension: 0.4,
                borderWidth: 2,
                pointRadius: 0,
                data: []
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { display: false }, x: { grid: { display: false } } }
        }
    });

    // 3. PIE CHART
    const ctxTMA = document.getElementById('chartTMA').getContext('2d');
    charts.tma = new Chart(ctxTMA, {
        type: 'doughnut',
        data: {
            labels: ['Produtivo', 'Ineficiência', 'Perdas', 'Ociosidade'],
            datasets: [{
                data: [],
                backgroundColor: ['#10b981', '#ef4444', '#f59e0b', '#334155'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            cutout: '70%',
            plugins: { legend: { position: 'right', labels: { boxWidth: 10, font: {size: 10} } } }
        }
    });

    // 4. VOLUME
    const ctxVol = document.getElementById('chartVolume').getContext('2d');
    charts.volume = new Chart(ctxVol, {
        type: 'bar',
        data: {
            labels: [],
            datasets: [
                { label: 'Base', backgroundColor: '#cbd5e1', data: [] },
                { label: 'BID', backgroundColor: '#3b82f6', data: [] }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { x: { stacked: true, grid: { display: false } }, y: { stacked: true } }
        }
    });
}

function calculateAndRender() {
    // --- 1. CAPTURA DE INPUTS ---
    const getVal = (id) => parseFloat(document.getElementById(id).value) || 0;

    const currentHc = getVal('currentHcInput');
    const bidVolTotalAno = getVal('inputBidVol');
    const bidMonthlyGrowth = getVal('inputGrowthBid') / 100;
    const growthCarteira = getVal('inputGrowthCarteira') / 100;
    
    // WFM Parameters
    const tmaInput = getVal('tmeInput');
    const slTarget = getVal('slInput') / 100;
    const targetTime = getVal('targetTimeInput');
    const maxOccupancy = getVal('occupancyInput') / 100;
    
    // Capacity
    const contractHours = getVal('contractHoursInput');
    const shrinkage = getVal('shrinkageInput') / 100;
    const absenteeism = getVal('absenteeismInput') / 100;
    const totalShrinkage = shrinkage + absenteeism;
    
    const cost = getVal('costInput');
    const rosteringSafety = 1.15; // Ineficiência de escala

    // --- 2. PREPARAÇÃO DO BID ---
    let baseBidMonth0 = 0;
    if (bidVolTotalAno > 0) {
        if (bidMonthlyGrowth <= 0) baseBidMonth0 = bidVolTotalAno / 12;
        else baseBidMonth0 = (bidVolTotalAno * bidMonthlyGrowth) / (Math.pow(1 + bidMonthlyGrowth, 12) - 1);
    }

    // --- 3. LOOP MENSAL ---
    let labelsMes = [];
    let dataBase = [], dataBid = [];
    let dataReqHC = [], dataCurrentHC = [], dataGap = [];
    let somaIntraday = new Array(13).fill(0);
    
    let totalReqHC = 0, totalPas = 0, totalWeightedSL = 0;

    // Garante que db_historico existe (Caso o database.js falhe)
    const safeDB = (typeof db_historico !== 'undefined') ? db_historico : [];
    
    safeDB.forEach((mesData, index) => {
        labelsMes.push(mesData.mes);

        // A. Volume Forecast
        let volBidMes = baseBidMonth0 * Math.pow(1 + bidMonthlyGrowth, index);
        let totalCli = mesData.yfrank + mesData.cmari;
        let cr = mesData.cr || (totalCli > 0 ? mesData.vol / totalCli : 0);
        let volBaseProj = (totalCli * (1 + growthCarteira)) * cr;
        
        let totalVolMes = volBaseProj + volBidMes;
        let finalVolSac = totalVolMes * 0.27; // Split SAC
        let finalVolAjuda = totalVolMes * 0.73; // Split Voz

        dataBase.push(Math.round(volBaseProj));
        dataBid.push(Math.round(volBidMes));
        dataCurrentHC.push(currentHc);

        // B. Dimensionamento Erlang C (Loop Horário)
        let diasUteis = 22;
        let volDiaSac = finalVolSac / diasUteis;
        let volDiaAjuda = finalVolAjuda / diasUteis;
        let agentsNeededDay = 0;
        let trafficTotalDay = 0;

        // Verifica se curveSAC existe, senão usa padrão
        const safeCurveSAC = (typeof curveSAC !== 'undefined') ? curveSAC : [0.05, 0.08, 0.12, 0.1, 0.07, 0.08, 0.1, 0.13, 0.11, 0.1, 0.06, 0.0, 0.0];

        for(let h=0; h<13; h++) {
            // SAC
            let callsSac = volDiaSac * (safeCurveSAC[h] || 0);
            let trafficSac = (callsSac * tmaInput) / 3600;
            let reqSac = getRequiredAgents(trafficSac, slTarget, targetTime, tmaInput, maxOccupancy);

            // Voz (Curva Hardcoded segura)
            let curveVozVal = (h === 0) ? 0 : [0.09, 0.11, 0.10, 0.08, 0.08, 0.08, 0.10, 0.11, 0.11, 0.08, 0.06, 0.00][h-1] || 0;
            let callsVoz = volDiaAjuda * curveVozVal;
            let trafficVoz = (callsVoz * tmaInput) / 3600;
            let reqVoz = getRequiredAgents(trafficVoz, slTarget, targetTime, tmaInput, maxOccupancy);

            let totalAgentsHour = reqSac.agents + reqVoz.agents;
            agentsNeededDay += totalAgentsHour;
            somaIntraday[h] += totalAgentsHour;
            trafficTotalDay += (trafficSac + trafficVoz);
        }

        // C. Resultados Mensais
        let horasLogadasMes = agentsNeededDay * diasUteis;
        let horasReaisNecessarias = horasLogadasMes * rosteringSafety;
        let horasLiquidasAgente = contractHours * (1 - totalShrinkage);
        
        // Evita divisão por zero
        let hcMensal = horasLiquidasAgente > 0 ? horasReaisNecessarias / horasLiquidasAgente : 0;
        
        dataReqHC.push(hcMensal);
        dataGap.push(hcMensal - currentHc); // Positivo = Falta
        
        totalReqHC += hcMensal;
        totalPas += (agentsNeededDay / 13); // Média de PAs simultâneas

        // SL Estimado com HC Atual (Regra de 3 simples para KPI macro)
        // Se preciso de 100 e tenho 80, meu SL cai.
        // Aproximação: Se HC Atual >= HC Necessário, SL = Meta. Senão, cai exponencialmente.
        let ratioHC = currentHc / (hcMensal || 1);
        let estimatedSL = ratioHC >= 1 ? slTarget : slTarget * Math.pow(ratioHC, 3); // Penalidade por falta de gente
        totalWeightedSL += estimatedSL;
    });

    // --- 4. ATUALIZAÇÃO UI ---
    let avgReqHC = Math.ceil(totalReqHC / 12);
    let avgPas = Math.ceil(totalPas / 12);
    let avgProjSL = (totalWeightedSL / 12) * 100;
    
    let gap = Math.round(avgReqHC - currentHc);
    let costGap = gap * cost;
    let netHours = Math.round(contractHours * (1 - totalShrinkage));

    // KPIs Text
    document.getElementById('resGap').innerText = gap > 0 ? `-${gap}` : `+${Math.abs(gap)}`;
    document.getElementById('resGap').className = gap > 0 ? "fw-bold mb-0 text-danger" : "fw-bold mb-0 text-success";
    document.getElementById('resGapText').innerText = gap > 0 ? "Pessoas Faltando" : "Pessoas Sobrando";

    document.getElementById('resCostGap').innerText = costGap.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    document.getElementById('resCostGap').className = gap > 0 ? "fw-bold mb-0 text-danger" : "fw-bold mb-0 text-success";

    document.getElementById('resProjSL').innerText = avgProjSL.toFixed(1) + "%";
    document.getElementById('resProjSL').className = avgProjSL < (slTarget*100 - 5) ? "fw-bold mb-0 text-danger" : "fw-bold mb-0 text-success";

    document.getElementById('resProdTime').innerText = netHours + "h";

    // Atualiza Gráficos
    let rosteringLoss = (1 - (1/rosteringSafety));
    let curveDisplay = somaIntraday.map(v => Math.ceil(v / 12));
    
    updateCharts(labelsMes, dataBase, dataBid, dataCurrentHC, dataReqHC, dataGap, curveDisplay, shrinkage, absenteeism, rosteringLoss);
}

function updateCharts(labels, base, bid, currentHC, reqHC, gap, curve, shrink, abs, rosteringLoss) {
    // Labels globais
    charts.positions.data.labels = labels;
    charts.volume.data.labels = labels;

    // 1. GAP
    charts.positions.data.datasets[0].data = gap;
    charts.positions.data.datasets[1].data = reqHC;
    charts.positions.data.datasets[2].data = currentHC;
    charts.positions.update();

    // 2. Volume
    charts.volume.data.datasets[0].data = base;
    charts.volume.data.datasets[1].data = bid;
    charts.volume.update();

    // 3. Intraday
    charts.intraday.data.datasets[0].data = curve;
    charts.intraday.update();

    // 4. Pizza
    let totalLoss = shrink + abs;
    let operational = Math.max(0, 1 - (totalLoss + rosteringLoss));
    charts.tma.data.datasets[0].data = [operational*100, rosteringLoss*100, totalLoss*100, 0];
    charts.tma.update();
}