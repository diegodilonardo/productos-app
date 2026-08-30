document.addEventListener('DOMContentLoaded', iniciarPerfil);

function mostrarMensaje(texto, tipo = 'info') {
  const el = document.getElementById('perfilMensaje');
  if (!el) return;
  el.className = `alert alert-${tipo}`;
  el.textContent = texto;
}

async function jsonFetch(url, opciones = {}) {
  const response = await fetch(url, {
    ...opciones,
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...(opciones.headers || {}) }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.mensaje || 'No se pudo completar la operación.');
  return data;
}

async function cargarPerfil() {
  const data = await jsonFetch('/api/perfil/me');
  const p = data.perfil;
  document.getElementById('perfilUsuario').value = p.usuario || '';
  document.getElementById('perfilNombre').value = p.nombre || '';
  document.getElementById('perfilEmailActual').textContent = p.email || 'Sin email configurado';
  document.getElementById('perfilEmailNuevo').value = '';

  const badge = document.getElementById('perfilEstadoEmail');
  badge.textContent = p.email && p.emailVerificado ? 'EMAIL VERIFICADO' : 'EMAIL SIN VERIFICAR';
  badge.className = `badge ${p.email && p.emailVerificado ? 'text-bg-success' : 'text-bg-warning'}`;

  const bloque = document.getElementById('bloqueEmailPendiente');
  if (p.emailPendiente) {
    document.getElementById('perfilEmailPendiente').textContent = p.emailPendiente;
    bloque.classList.remove('d-none');
  } else {
    bloque.classList.add('d-none');
  }
}

async function iniciarPerfil() {
  try { await cargarPerfil(); } catch (e) { mostrarMensaje(e.message, 'danger'); }

  document.getElementById('formPerfilNombre')?.addEventListener('submit', async event => {
    event.preventDefault();
    try {
      const data = await jsonFetch('/api/perfil/nombre', {
        method: 'PUT',
        body: JSON.stringify({ nombre: document.getElementById('perfilNombre').value })
      });
      mostrarMensaje(data.mensaje, 'success');
      const nav = document.getElementById('navbarUsuario');
      if (nav) nav.textContent = data.nombre;
    } catch (e) { mostrarMensaje(e.message, 'danger'); }
  });

  document.getElementById('formPerfilEmail')?.addEventListener('submit', async event => {
    event.preventDefault();
    const boton = event.currentTarget.querySelector('button[type="submit"]');
    boton.disabled = true;
    try {
      const data = await jsonFetch('/api/perfil/email', {
        method: 'POST',
        body: JSON.stringify({ email: document.getElementById('perfilEmailNuevo').value })
      });
      mostrarMensaje(data.mensaje, 'success');
      await cargarPerfil();
    } catch (e) { mostrarMensaje(e.message, 'danger'); }
    finally { boton.disabled = false; }
  });
}
