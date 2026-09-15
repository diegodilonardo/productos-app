const { monitorEventLoopDelay } = require('node:perf_hooks');

const intervaloMs = Math.max(1000, Number(process.env.EVENT_LOOP_SAMPLE_MS || 10000));
const umbralMs = Math.max(100, Number(process.env.EVENT_LOOP_WARN_MS || 2000));

let iniciado = false;
let timer = null;
let histograma = null;
let ultimoRetrasoMs = 0;
let ultimoMaximoMs = 0;
let ultimaMedicion = null;

function iniciarMonitorEventLoop() {
  if (iniciado) return;
  iniciado = true;
  histograma = monitorEventLoopDelay({ resolution: 20 });
  histograma.enable();

  let siguienteEjecucion = Date.now() + intervaloMs;
  timer = setInterval(() => {
    const ahora = Date.now();
    const retrasoTimer = Math.max(0, ahora - siguienteEjecucion);
    siguienteEjecucion = ahora + intervaloMs;
    const maximoHistograma = Number(histograma.max || 0) / 1e6;

    ultimoRetrasoMs = Math.round(retrasoTimer);
    ultimoMaximoMs = Math.round(maximoHistograma);
    ultimaMedicion = new Date().toISOString();

    const bloqueoMs = Math.max(ultimoRetrasoMs, ultimoMaximoMs);
    if (bloqueoMs >= umbralMs) {
      const memoria = process.memoryUsage();
      console.warn('[SALUD] Event loop bloqueado o demorado.', {
        bloqueoMs,
        retrasoTimerMs: ultimoRetrasoMs,
        maximoEventLoopMs: ultimoMaximoMs,
        heapMb: Math.round(memoria.heapUsed / 1024 / 1024),
        rssMb: Math.round(memoria.rss / 1024 / 1024),
        uptimeSegundos: Math.round(process.uptime())
      });
    }

    histograma.reset();
  }, intervaloMs);

  timer.unref();
}

function obtenerEstadoEventLoop() {
  return {
    retrasoMs: ultimoRetrasoMs,
    maximoMs: ultimoMaximoMs,
    umbralMs,
    ultimaMedicion
  };
}

module.exports = { iniciarMonitorEventLoop, obtenerEstadoEventLoop };
