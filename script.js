// --- CONFIGURAÇÃO GLOBAL ---
// Assegura que o Chart.js use cores visíveis no fundo preto
Chart.defaults.color = '#ccc';
Chart.defaults.borderColor = '#333';

let charts = {}; // Armazena as instâncias dos gráficos

// 1. DADOS DE BANCO DE DADOS (SIMULADO)
const historicalData = {
    avgMonthlyVolume: 5000, 
    avgTME: 180
};

// 2. CURVA DE DISTRIBUIÇÃO (CURVA M)
const distributionCurve = {
    labels: ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'],
    values: [0.05,   0.08,    0.12,    0.10,    0.07,    0.08,    0.10,    0.13,    0.11,    0.10,    0.06]
};

document.addEventListener('DOMContentLoaded', () => {
    console.log("Sistema Iniciado.");

    // Preenche inputs iniciais
    if(document.getElementById('baseVolumeInput')) {
        document.getElementById('baseVolumeInput').value = historicalData.avgMonthlyVolume;
        document.getElementById('tmeInput').value = historicalData.avgTME;
    }

    // Inicializa e Calcula
    initCharts();
    calculateAndRender();

    // Eventos
    const btn = document.getElementById('btnCalc');
    if(btn) btn.addEventListener('click', calculateAndRender);
});

function initCharts() {
    // --- GRÁFICO 1: LINHA ---
    const ctxPos = document.getElementById('chartPositions');
    if (ctxPos) {
        charts.positions = new Chart(ctxPos.getContext('2d'), {
            type: 'line',
            data: {
                labels: distributionCurve.labels,
                datasets: [{
                    label: 'Agentes',
                    borderColor: '#a64ca6',
                    backgroundColor: 'rgba(166, 76, 166, 0.2)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    data: []
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false, // Importante para preencher a div
                plugins: { legend: { display: false } },
                scales: { y: { beginAtZero: true } }
            }
        });
    }

    // --- GRÁFICO 2: BARRAS ---
    const ctxVol = document.getElementById('chartVolume');
    if (ctxVol) {
        charts.volume = new Chart(ctxVol.getContext('2d'), {
            type: 'bar',
            data: {
                labels: ['Volume Mensal'],
                datasets: [
                    { label: 'Base', backgroundColor: '#5b76f2', data: [] },
                    { label: 'Novo', backgroundColor: '#2fa86d', data: [] }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: { x: { stacked: true }, y: { stacked: true } }
            }
        });
    }

    // --- GRÁFICO 3: PIZZA ---
    const ctxTme = document.getElementById('chartTME');
    if (ctxTme) {
        charts.tme = new Chart(ctxTme.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: ['Falado', 'Hold', 'ACW'],
                datasets: [{
                    data: [],
                    backgroundColor: ['#a64ca6', '#5b76f2', '#f5a623'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { 
                    legend: { position: 'right', labels: { boxWidth: 10, color: '#fff' } } 
                }
            }
        });
    }
}

function calculateAndRender() {
    // Coleta Inputs
    const baseVolume = parseFloat(document.getElementById('baseVolumeInput').value) || 0;
    const newVolume = parseFloat(document.getElementById('newVolumeInput').value) || 0;
    const tme = parseFloat(document.getElementById('tmeInput').value) || 0;
    const occupancyTarget = (parseFloat(document.getElementById('occupancyInput').value) || 100) / 100;
    const shrinkagePercent = (parseFloat(document.getElementById('shrinkageInput').value) || 0) / 100;
    const costPerPA = parseFloat(document.getElementById('costInput').value) || 0;

    // Lógica de Cálculo
    const totalMonthlyVolume = baseVolume + newVolume;
    const dailyVolume = totalMonthlyVolume / 22; // 22 dias úteis
    
    // Pico (Maior % da curva * Volume Diário)
    const maxHourlyShare = Math.max(...distributionCurve.values);
    const peakHourVolume = dailyVolume * maxHourlyShare;

    // Erlangs no Pico
    const peakErlangs = (peakHourVolume * tme) / 3600;

    // Dimensionamento
    let netAgents = peakErlangs / occupancyTarget;
    const requiredHeadcount = Math.ceil(netAgents / (1 - shrinkagePercent));
    const totalCost = requiredHeadcount * costPerPA;

    // Atualiza Texto
    document.getElementById('resHeadcount').innerText = requiredHeadcount;
    document.getElementById('resPasPeak').innerText = Math.ceil(netAgents);
    document.getElementById('resErlangs').innerText = peakErlangs.toFixed(2);
    document.getElementById('resTotalCost').innerText = totalCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    // Atualiza Gráficos
    updateCharts(baseVolume, newVolume, Math.ceil(netAgents), tme);
}

function updateCharts(baseVol, newVol, peakAgents, tmeTotal) {
    // Atualiza Linha (Intraday)
    if (charts.positions) {
        const maxVal = Math.max(...distributionCurve.values);
        // Evita divisão por zero
        const safeMax = maxVal === 0 ? 1 : maxVal;
        
        const hourlyAgents = distributionCurve.values.map(val => {
            return Math.ceil((val * peakAgents) / safeMax);
        });
        charts.positions.data.datasets[0].data = hourlyAgents;
        charts.positions.update();
    }

    // Atualiza Barras
    if (charts.volume) {
        charts.volume.data.datasets[0].data = [baseVol];
        charts.volume.data.datasets[1].data = [newVol];
        charts.volume.update();
    }

    // Atualiza Pizza
    if (charts.tme) {
        charts.tme.data.datasets[0].data = [
            tmeTotal * 0.70, 
            tmeTotal * 0.10, 
            tmeTotal * 0.20
        ];
        charts.tme.update();
    }
}