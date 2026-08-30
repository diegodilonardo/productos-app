const { spawn } = require('child_process');
const path = require('path');

let procesos = [];
let cerrando = false;

const REINICIO_SYNC_MS =
  numeroPositivo(
    process.env.SYNC_RESTART_MS,
    60 * 1000
  );


function numeroPositivo(
  valor,
  defecto
) {
  const numero =
    Number(valor);

  return Number.isFinite(numero) &&
    numero > 0
      ? Math.trunc(numero)
      : defecto;
}


function registrarProceso(
  definicion,
  proceso
) {
  const existente =
    procesos.find(
      item =>
        item.nombre ===
        definicion.nombre
    );

  if (existente) {
    existente.proceso =
      proceso;

    return;
  }

  procesos.push({
    ...definicion,
    proceso,
    reinicioTimer: null,
  });
}


function programarReinicio(
  definicion
) {
  if (cerrando) {
    return;
  }

  const item =
    procesos.find(
      x =>
        x.nombre ===
        definicion.nombre
    );

  if (
    item?.reinicioTimer
  ) {
    return;
  }

  console.log(
    `[SYNC] ${definicion.nombre} se reiniciará en ` +
    `${REINICIO_SYNC_MS} ms.`
  );

  const timer =
    setTimeout(
      () => {
        if (cerrando) {
          return;
        }

        const actual =
          procesos.find(
            x =>
              x.nombre ===
              definicion.nombre
          );

        if (actual) {
          actual.reinicioTimer =
            null;
        }

        iniciarProceso(
          definicion
        );
      },
      REINICIO_SYNC_MS
    );

  if (item) {
    item.reinicioTimer =
      timer;
  }
}


function iniciarProceso(
  definicion
) {
  if (cerrando) {
    return null;
  }

  console.log(
    `[SYNC] Iniciando ${definicion.nombre}...`
  );

  const proceso =
    spawn(
      definicion.comando,
      definicion.args,
      {
        cwd: process.cwd(),
        stdio: 'inherit',
        shell: false,
        windowsHide: true,
      }
    );

  registrarProceso(
    definicion,
    proceso
  );

  proceso.on(
    'error',
    (error) => {
      console.error(
        `[SYNC] Error iniciando ${definicion.nombre}:`,
        error.message
      );

      /*
       * IMPORTANTE:
       * un fallo de una sincronización NO apaga
       * las demás.
       */
      programarReinicio(
        definicion
      );
    }
  );

  proceso.on(
    'exit',
    (codigo, signal) => {
      if (cerrando) {
        return;
      }

      console.error(
        `[SYNC] ${definicion.nombre} finalizó.`,
        {
          codigo,
          signal,
        }
      );

      /*
       * Antes, la caída de un scheduler cerraba
       * TODOS los procesos. Ahora aislamos la falla
       * y reiniciamos solamente el afectado.
       */
      programarReinicio(
        definicion
      );
    }
  );

  return proceso;
}


function cerrarTodo(
  codigoSalida = 0
) {
  if (cerrando) {
    return;
  }

  cerrando =
    true;

  console.log(
    '\n[SYNC] Cerrando procesos...'
  );

  for (
    const item
    of procesos
  ) {
    try {
      if (
        item.reinicioTimer
      ) {
        clearTimeout(
          item.reinicioTimer
        );

        item.reinicioTimer =
          null;
      }

      if (
        item.proceso &&
        !item.proceso.killed
      ) {
        console.log(
          `[SYNC] Deteniendo ${item.nombre}...`
        );

        item.proceso.kill();
      }
    } catch (error) {
      console.error(
        `[SYNC] No se pudo detener ${item.nombre}:`,
        error.message
      );
    }
  }

  setTimeout(
    () => {
      process.exit(
        codigoSalida
      );
    },
    500
  );
}


function main() {
  console.log(
    '========================================'
  );
  console.log(
    ' PRODUCTOS_APP - SINCRONIZACION GENERAL'
  );
  console.log(
    '========================================'
  );

  const esWindows =
    process.platform ===
    'win32';

  const npmCmd =
    esWindows
      ? 'npm.cmd'
      : 'npm';

  const definiciones = [
    {
      nombre:
        'MAESTROS',
      comando:
        npmCmd,
      args: [
        'run',
        'rev',
      ],
    },
    {
      nombre:
        'PRODUCTOS ERP',
      comando:
        process.execPath,
      args: [
        path.join(
          'src',
          'jobs',
          'productosErpSync.scheduler.js'
        ),
      ],
    },
  ];

  for (
    const definicion
    of definiciones
  ) {
    iniciarProceso(
      definicion
    );
  }

  console.log('');
  console.log(
    '[SYNC] Maestros + Productos ERP activos.'
  );
  console.log(
    `[SYNC] Reinicio independiente: ${REINICIO_SYNC_MS} ms.`
  );
  console.log(
    '[SYNC] Presioná Ctrl+C para detener ambos.'
  );
}


process.on(
  'SIGINT',
  () =>
    cerrarTodo(0)
);

process.on(
  'SIGTERM',
  () =>
    cerrarTodo(0)
);


/*
 * El supervisor no debe tumbar todos los
 * schedulers por una excepción de uno de ellos.
 * Registramos y seguimos vivos.
 */
process.on(
  'uncaughtException',
  (error) => {
    console.error(
      '[SYNC] Excepción no controlada en supervisor:',
      error
    );
  }
);

process.on(
  'unhandledRejection',
  (error) => {
    console.error(
      '[SYNC] Promesa rechazada en supervisor:',
      error
    );
  }
);


main();
