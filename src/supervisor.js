require('dotenv').config();

const path = require('node:path');
const { spawn } = require('node:child_process');

const puerto = Number(process.env.PORT || 3000);
const intervaloMs = Math.max(5000, Number(process.env.SUPERVISOR_INTERVAL_MS || 15000));
const timeoutMs = Math.max(1000, Number(process.env.SUPERVISOR_TIMEOUT_MS || 5000));
const toleranciaFallos = Math.max(1, Number(process.env.SUPERVISOR_FAILURE_THRESHOLD || 3));
const graciaInicioMs = Math.max(5000, Number(process.env.SUPERVISOR_STARTUP_GRACE_MS || 45000));
const demoraReinicioMs = Math.max(1000, Number(process.env.SUPERVISOR_RESTART_DELAY_MS || 5000));
const urlSalud = process.env.SUPERVISOR_HEALTH_URL || `http://127.0.0.1:${puerto}/api/status`;

let proceso = null;
let deteniendo = false;
let verificando = false;
let reiniciando = false;
let fallosConsecutivos = 0;
let verificarDesde = 0;
let timerReinicio = null;

function programarInicio() {
  if (deteniendo || timerReinicio || proceso) return;
  timerReinicio = setTimeout(() => {
    timerReinicio = null;
    iniciarAplicacion();
  }, demoraReinicioMs);
}

function iniciarAplicacion() {
  if (deteniendo || proceso) return;

  proceso = spawn(process.execPath, [path.join(__dirname, 'server.js')], {
    cwd: process.cwd(),
    stdio: 'inherit',
    shell: false,
    windowsHide: true
  });
  fallosConsecutivos = 0;
  reiniciando = false;
  verificarDesde = Date.now() + graciaInicioMs;

  console.log('[SUPERVISOR] Aplicación iniciada.', { pid: proceso.pid, urlSalud });

  proceso.once('error', error => {
    console.error('[SUPERVISOR] No se pudo iniciar la aplicación:', error.message);
  });

  proceso.once('exit', (codigo, signal) => {
    console.error('[SUPERVISOR] La aplicación finalizó.', { codigo, signal });
    proceso = null;
    if (!deteniendo) programarInicio();
  });
}

function finalizarArbol(procesoActual) {
  if (!procesoActual?.pid) return;

  if (process.platform === 'win32') {
    const cierre = spawn('taskkill', ['/PID', String(procesoActual.pid), '/T', '/F'], {
      stdio: 'ignore',
      windowsHide: true,
      shell: false
    });
    cierre.once('error', error => {
      console.error('[SUPERVISOR] No se pudo finalizar el árbol del proceso:', error.message);
      try { procesoActual.kill('SIGKILL'); } catch (_) {}
    });
    return;
  }

  try { procesoActual.kill('SIGKILL'); } catch (_) {}
}

async function verificarSalud() {
  if (verificando || deteniendo || !proceso || Date.now() < verificarDesde) return;
  verificando = true;

  const controlador = new AbortController();
  const timeout = setTimeout(() => controlador.abort(), timeoutMs);

  try {
    const respuesta = await fetch(urlSalud, {
      signal: controlador.signal,
      headers: { accept: 'application/json' },
      cache: 'no-store'
    });
    const datos = await respuesta.json();
    if (!respuesta.ok || datos?.ok !== true) throw new Error(`Estado HTTP ${respuesta.status}`);
    fallosConsecutivos = 0;
  } catch (error) {
    fallosConsecutivos += 1;
    console.error('[SUPERVISOR] Control de salud fallido.', {
      intento: fallosConsecutivos,
      limite: toleranciaFallos,
      error: error.name === 'AbortError' ? `timeout de ${timeoutMs} ms` : error.message
    });

    if (fallosConsecutivos >= toleranciaFallos && proceso && !reiniciando) {
      reiniciando = true;
      console.error('[SUPERVISOR] La aplicación no responde. Se reiniciará el proceso web.');
      finalizarArbol(proceso);
    }
  } finally {
    clearTimeout(timeout);
    verificando = false;
  }
}

function detener() {
  if (deteniendo) return;
  deteniendo = true;
  if (timerReinicio) clearTimeout(timerReinicio);
  finalizarArbol(proceso);
  setTimeout(() => process.exit(0), 1000).unref();
}

process.on('SIGINT', detener);
process.on('SIGTERM', detener);

iniciarAplicacion();
setInterval(verificarSalud, intervaloMs).unref();
