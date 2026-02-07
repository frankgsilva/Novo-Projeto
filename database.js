// --- BANCO DE DADOS: VOLUME SEPARADO POR FILA (2025) ---
// Baseado na proporção dos seus arquivos: ~27% SAC e ~73% Ajuda/Voz
// Horários: SAC (08-21) | Ajuda (09-21)

const db_historico = [
    // Jan copiado de Fev para consistência (dado original estava zerado/inconsistente)
    { mes: 'Jan', yfrank: 217517, cmari: 37455, vol: 13605, tma: 345, cr: 0.05336 },
    { mes: 'Fev', yfrank: 219200, cmari: 37172, vol: 13605, tma: 345, cr: 0.05336 },
    { mes: 'Mar', yfrank: 219845, cmari: 36860, vol: 13605, tma: 357, cr: 0.05307 },
    { mes: 'Abr', yfrank: 220086, cmari: 36618, vol: 13605, tma: 383, cr: 0.05300 },
    { mes: 'Mai', yfrank: 220639, cmari: 36257, vol: 13605, tma: 371, cr: 0.05300 },
    { mes: 'Jun', yfrank: 221955, cmari: 35820, vol: 13605, tma: 381, cr: 0.05296 },
    { mes: 'Jul', yfrank: 260870, cmari: 35277, vol: 13605, tma: 377, cr: 0.05278 },
    { mes: 'Ago', yfrank: 261120, cmari: 34789, vol: 13605, tma: 408, cr: 0.04594 },
    { mes: 'Set', yfrank: 267159, cmari: 34330, vol: 13605, tma: 392, cr: 0.04598 },
    { mes: 'Out', yfrank: 270288, cmari: 33925, vol: 13605, tma: 376, cr: 0.04513 },
    { mes: 'Nov', yfrank: 276870, cmari: 33555, vol: 13605, tma: 394, cr: 0.04472 },
    { mes: 'Dez', yfrank: 287464, cmari: 33114, vol: 13605, tma: 372, cr: 0.04383 }
];

// Curvas de Distribuição (Pesos por hora)
// SAC: 08:00 as 21:00 (13 horas)
const curveSAC = [
    0.04, 0.08, 0.10, 0.09, 0.08, 0.08, 0.08, 0.09, 0.09, 0.10, 0.08, 0.06, 0.03
]; 
// Labels correspondentes ao SAC
const labelsSAC = ['08', '09', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20'];

// AJUDA: 09:00 as 21:00 (12 horas)
const curveAjuda = [
    0.00, 0.09, 0.11, 0.10, 0.08, 0.08, 0.08, 0.10, 0.11, 0.11, 0.08, 0.06, 0.00 // O index 0 é 08h (vazio), preenchido no script
];
// A lógica do script vai alinhar as horas.