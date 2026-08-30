document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('formReset')?.addEventListener('submit', restablecer);

  /* El token queda en el DOM pero se elimina de la barra de direcciones. */
  if (window.history?.replaceState) {
    window.history.replaceState({}, document.title, '/restablecer-password');
  }
});

async function restablecer(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const alerta = document.getElementById('alertaReset');
  const boton = document.getElementById('btnRestablecer');
  const password = document.getElementById('passwordNueva').value;
  const confirmar = document.getElementById('passwordConfirmar').value;
  const token = document.getElementById('resetApp')?.dataset.token || '';

  if (!form.checkValidity()) {
    form.classList.add('was-validated');
    return;
  }

  if (password !== confirmar) {
    alerta.className = 'alert alert-danger mt-4';
    alerta.textContent = 'Las contraseñas no coinciden.';
    return;
  }

  try {
    boton.disabled = true;
    boton.textContent = 'Guardando...';

    const response = await fetch('/api/auth/restablecer-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) {
      throw new Error(data.mensaje || `Error HTTP ${response.status}`);
    }

    alerta.className = 'alert alert-success mt-4';
    alerta.textContent = data.mensaje;
    form.classList.add('d-none');
    setTimeout(() => window.location.assign('/login'), 1800);
  } catch (error) {
    alerta.className = 'alert alert-danger mt-4';
    alerta.textContent = error.message;
  } finally {
    boton.disabled = false;
    boton.textContent = 'Guardar nueva contraseña';
  }
}
