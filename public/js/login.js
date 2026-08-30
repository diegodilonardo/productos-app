document.addEventListener('DOMContentLoaded', iniciarLogin);

function iniciarLogin() {
  document
    .getElementById('formLogin')
    ?.addEventListener(
      'submit',
      iniciarSesion
    );

  document
    .getElementById('btnMostrarPassword')
    ?.addEventListener(
      'click',
      alternarPassword
    );
}

async function iniciarSesion(event) {
  event.preventDefault();

  const form =
    event.currentTarget;

  if (!form.checkValidity()) {
    form.classList.add(
      'was-validated'
    );
    return;
  }

  ocultarAlerta();

  const boton =
    document.getElementById(
      'btnIngresar'
    );

  const usuario =
    document.getElementById(
      'usuario'
    ).value.trim();

  const password =
    document.getElementById(
      'password'
    ).value;

  try {
    boton.disabled = true;
    boton.textContent =
      'Ingresando...';

    const response =
      await fetch(
        '/api/auth/login',
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json'
          },
          body: JSON.stringify({
            usuario,
            password
          })
        }
      );

    let data = null;

    try {
      data =
        await response.json();
    } catch {}

    if (
      !response.ok ||
      data?.ok === false
    ) {
      throw new Error(
        data?.mensaje ||
        `Error HTTP ${response.status}`
      );
    }

    /*
     * Limpiamos una empresa anterior para evitar
     * reutilizar la selección de otro usuario.
     */
    sessionStorage.removeItem(
      'pedidos.idEmpresa'
    );

    const next =
      obtenerDestino();

    window.location.assign(
      next
    );

  } catch (error) {
    mostrarAlerta(
      error.message,
      'danger'
    );

    document
      .getElementById('password')
      ?.focus();

  } finally {
    boton.disabled = false;
    boton.textContent =
      'Ingresar';
  }
}

function obtenerDestino() {
  const valor =
    document
      .getElementById('loginApp')
      ?.dataset.next ||
    '/pedidos';

  /*
   * Seguridad: solo aceptamos destinos internos.
   */
  if (
    !valor.startsWith('/') ||
    valor.startsWith('//')
  ) {
    return '/pedidos';
  }

  return valor;
}

function alternarPassword() {
  const input =
    document.getElementById(
      'password'
    );

  const boton =
    document.getElementById(
      'btnMostrarPassword'
    );

  if (!input || !boton) {
    return;
  }

  const mostrar =
    input.type === 'password';

  input.type =
    mostrar
      ? 'text'
      : 'password';

  boton.textContent =
    mostrar
      ? 'Ocultar'
      : 'Mostrar';
}

function mostrarAlerta(
  mensaje,
  tipo
) {
  const alerta =
    document.getElementById(
      'alertaLogin'
    );

  alerta.className =
    `alert alert-${tipo}`;

  alerta.textContent =
    mensaje;
}

function ocultarAlerta() {
  const alerta =
    document.getElementById(
      'alertaLogin'
    );

  alerta.className =
    'alert d-none';

  alerta.textContent =
    '';
}
