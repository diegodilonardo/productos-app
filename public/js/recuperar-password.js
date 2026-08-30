document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('formRecuperacion')?.addEventListener('submit', solicitar);
});

async function solicitar(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.checkValidity()) {
    form.classList.add('was-validated');
    return;
  }

  const boton = document.getElementById('btnEnviarRecuperacion');
  const alerta = document.getElementById('alertaRecuperacion');
  const identificador = document.getElementById('identificador').value.trim();

  try {
    boton.disabled = true;
    boton.textContent = 'Enviando...';
    alerta.className = 'alert d-none';

    const response = await fetch('/api/auth/recuperar-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identificador })
    });
    const data = await response.json();

    alerta.className = 'alert alert-success mt-4';
    alerta.textContent = data.mensaje || 'Si la cuenta existe, recibirá un correo de recuperación.';
    form.reset();
  } catch (_) {
    alerta.className = 'alert alert-success mt-4';
    alerta.textContent = 'Si la cuenta existe, recibirá un correo de recuperación.';
  } finally {
    boton.disabled = false;
    boton.textContent = 'Enviar enlace';
  }
}
