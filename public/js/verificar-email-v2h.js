document.addEventListener('DOMContentLoaded', async () => {
  const mensaje = document.getElementById('verificarEmailMensaje');
  const boton = document.getElementById('verificarEmailLogin');
  const token = document.getElementById('verificarEmailToken')?.value || '';
  try {
    const response = await fetch('/api/perfil/verificar-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ token })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.mensaje || 'No se pudo verificar el email.');
    mensaje.className = 'alert alert-success';
    mensaje.textContent = data.mensaje;
  } catch (error) {
    mensaje.className = 'alert alert-danger';
    mensaje.textContent = error.message;
  }
  boton.classList.remove('d-none');
});
