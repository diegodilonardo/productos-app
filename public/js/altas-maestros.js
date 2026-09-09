document.addEventListener('DOMContentLoaded', iniciar);
const $ = id => document.getElementById(id);
let vistaPreviaModelos = [];
let consultaMaestros = [];
let paginaConsultaMaestros = 1;
const filasPorPaginaConsulta = 25;
function idEmpresa() { return Number(sessionStorage.getItem('app.idEmpresa') || sessionStorage.getItem('pedidos.idEmpresa')); }
function empresaValida() { const id = idEmpresa(); return Number.isInteger(id) && id > 0 ? id : null; }
async function esperarEmpresaActiva(maximoMs = 4000) {
  const inicio = Date.now();
  while (!empresaValida() && Date.now() - inicio < maximoMs) {
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  return empresaValida();
}
async function api(url, opciones = {}) { const empresa = empresaValida(); if (!empresa) throw new Error('Debe seleccionar una empresa desde la barra superior.'); const r = await fetch(url, { ...opciones, headers: { 'Content-Type': 'application/json', 'x-id-empresa': String(empresa), ...(opciones.headers || {}) } }); const d = await r.json(); if (!r.ok) throw new Error(d.mensaje || 'No se pudo completar la operación.'); return d; }
function alerta(m, tipo = 'success') { const e = $('alertaAltasMaestros'); e.textContent = m; e.className = `alert alert-${tipo}`; }
function textoSeguro(v) { return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function esLicenciaNueva() { return $('licenciaModelo').value === '__NUEVA__'; }
function ajustarLicenciaNueva() { $('datosLicenciaNueva').classList.toggle('d-none', !esLicenciaNueva()); $('codigoMaestro').value = ''; }
function esLicenciaNuevaMasiva() { return $('licenciaModelosMasivos').value === '__NUEVA__'; }
function ajustarLicenciaNuevaMasiva() { $('datosLicenciaNuevaMasiva').classList.toggle('d-none', !esLicenciaNuevaMasiva()); vistaPreviaModelos = []; $('panelVistaPreviaModelos').classList.add('d-none'); }
function disciplinaRequierePrefijo(rubro, licencia, disciplina) {
  return String(licencia).toUpperCase() === '__SIN_LICENCIA__' && String(rubro).toUpperCase() === 'INDUMENTARIA' && !['__SIN_DISCIPLINA__', 'FUTBOL'].includes(String(disciplina).toUpperCase());
}
function ajustarDisciplina() { const selector = $('disciplinaModelo'), conLicencia = Boolean($('licenciaModelo').value) && $('licenciaModelo').value !== '__SIN_LICENCIA__'; if (conLicencia) selector.value = '__SIN_DISCIPLINA__'; selector.disabled = conLicencia; $('datosDisciplina').classList.toggle('d-none', !disciplinaRequierePrefijo($('rubroModelo').value, $('licenciaModelo').value, selector.value)); $('codigoMaestro').value = ''; }
function ajustarDisciplinaMasiva() { const selector = $('disciplinaModelosMasivos'), conLicencia = Boolean($('licenciaModelosMasivos').value) && $('licenciaModelosMasivos').value !== '__SIN_LICENCIA__'; if (conLicencia) selector.value = '__SIN_DISCIPLINA__'; selector.disabled = conLicencia; $('datosDisciplinaMasiva').classList.toggle('d-none', !disciplinaRequierePrefijo($('rubroModelosMasivos').value, $('licenciaModelosMasivos').value, selector.value)); vistaPreviaModelos = []; $('panelVistaPreviaModelos').classList.add('d-none'); }
function ajustarCampos() { const t = $('tipoMaestro').value; $('camposModeloPrevios').classList.toggle('d-none', t !== 'MODELO'); $('camposModeloPosteriores').classList.toggle('d-none', t !== 'MODELO'); $('avisoModulo').classList.toggle('d-none', t !== 'MODULO'); $('codigoMaestro').maxLength = t === 'MODELO' ? 6 : 2; $('codigoMaestro').readOnly = t === 'MODELO'; }
function proveedorVistaPrevia(x) { return textoSeguro(x.proveedorNombre || '-') + '<div class="small text-secondary">' + textoSeguro(x.cProveedor || '') + '</div>'; }
function cambiarPanelMaestros(panel) {
  const consulta = panel === 'consulta';
  $('panelGestionMaestros').classList.toggle('d-none', consulta);
  $('panelConsultaMaestros').classList.toggle('d-none', !consulta);
  $('accionesAltasMaestros').classList.toggle('d-none', consulta);
  $('tabAltasMaestros').classList.toggle('active', !consulta);
  $('tabConsultaMaestros').classList.toggle('active', consulta);
  if (consulta && empresaValida() && !consultaMaestros.length) cargarConsultaMaestros();
}
function filasConsultaFiltradas() {
  const texto = $('buscarConsultaMaestros').value.trim().toUpperCase();
  const estado = $('estadoConsultaModulos').value;
  const tipo = $('tipoConsultaMaestros').value;
  const marca = $('filtroMarcaModelos').value;
  const rubro = $('filtroRubroModelos').value;
  const licencia = $('filtroLicenciaModelos').value;
  return consultaMaestros.filter(item => {
    if (texto && !Object.values(item).some(valor => String(valor ?? '').toUpperCase().includes(texto))) return false;
    if (tipo === 'MODELOS') {
      if (marca && String(item.MARCA_MODELO || '').trim().toUpperCase() !== marca) return false;
      if (rubro && String(item.RUBRO_MODELO || '').trim().toUpperCase() !== rubro) return false;
      const licenciaItem = String(item.LICENCIA || '').trim().toUpperCase() || '__SIN_LICENCIA__';
      if (licencia && licenciaItem !== licencia) return false;
    }
    if (tipo === 'MODULOS' && estado !== 'TODOS') {
      const consistente = Boolean(Number(item.ES_CONSISTENTE));
      if (estado === 'CONSISTENTES' && !consistente) return false;
      if (estado === 'INCONSISTENTES' && consistente) return false;
    }
    return true;
  });
}
function cargarOpcionesFiltroModelos() {
  const crear = (id, campo, etiquetaTodos, transformar = valor => valor) => {
    const selector = $(id), anterior = selector.value;
    const valores = [...new Set(consultaMaestros.map(item => transformar(item[campo])).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
    selector.innerHTML = `<option value="">${etiquetaTodos}</option>` + valores.map(valor => `<option value="${textoSeguro(valor)}">${valor === '__SIN_LICENCIA__' ? 'Sin licencia' : textoSeguro(valor)}</option>`).join('');
    if (valores.includes(anterior)) selector.value = anterior;
  };
  crear('filtroMarcaModelos', 'MARCA_MODELO', 'Todas las marcas', valor => String(valor || '').trim().toUpperCase());
  crear('filtroRubroModelos', 'RUBRO_MODELO', 'Todos los rubros', valor => String(valor || '').trim().toUpperCase());
  crear('filtroLicenciaModelos', 'LICENCIA', 'Todas las licencias', valor => String(valor || '').trim().toUpperCase() || '__SIN_LICENCIA__');
}
function renderConsultaMaestros() {
  const tipo = $('tipoConsultaMaestros').value, filas = filasConsultaFiltradas();
  const paginas = Math.max(1, Math.ceil(filas.length / filasPorPaginaConsulta));
  paginaConsultaMaestros = Math.min(Math.max(1, paginaConsultaMaestros), paginas);
  const inicio = (paginaConsultaMaestros - 1) * filasPorPaginaConsulta, pagina = filas.slice(inicio, inicio + filasPorPaginaConsulta);
  let encabezado, cuerpo;
  if (tipo === 'MODELOS') {
    encabezado = '<tr><th>Código</th><th>Descripción</th><th>Marca</th><th>Rubro</th><th>Licencia</th></tr>';
    cuerpo = pagina.map(x => `<tr><td class="font-monospace fw-bold">${textoSeguro(x.CODIGO_MODELO)}</td><td>${textoSeguro(x.DETALLE_MODELO)}</td><td>${textoSeguro(x.MARCA_MODELO || '-')}</td><td>${textoSeguro(x.RUBRO_MODELO || '-')}</td><td>${textoSeguro(x.LICENCIA || 'Sin licencia')}</td></tr>`).join('');
  } else if (tipo === 'COLORES') {
    encabezado = '<tr><th>Código</th><th>Descripción</th></tr>';
    cuerpo = pagina.map(x => `<tr><td class="font-monospace fw-bold">${textoSeguro(x.CODIGO_COLOR)}</td><td>${textoSeguro(x.DETALLE_COLOR)}</td></tr>`).join('');
  } else if (tipo === 'MODULOS') {
    encabezado = '<tr><th>Código</th><th>Descripción</th><th>Distribución</th><th>Pares</th><th>Estado</th></tr>';
    cuerpo = pagina.map(x => { const ok = Boolean(Number(x.ES_CONSISTENTE)); return `<tr class="${ok ? '' : 'table-warning'}"><td class="font-monospace fw-bold">${textoSeguro(x.CODIGO_MODULO)}</td><td>${textoSeguro(x.DETALLE_MODULO)}</td><td>${textoSeguro(x.DESCRIPCION_CURVA)}</td><td>${textoSeguro(x.PARES)}</td><td><span class="badge ${ok ? 'text-bg-success' : 'text-bg-warning'}">${ok ? 'CONSISTENTE' : 'INCONSISTENTE'}</span>${x.OBSERVACION ? `<div class="small mt-1">${textoSeguro(x.OBSERVACION)}</div>` : ''}</td></tr>`; }).join('');
  } else {
    encabezado = '<tr><th>Código</th><th>Disciplina</th></tr>';
    cuerpo = pagina.map(x => `<tr><td class="font-monospace fw-bold">${textoSeguro(x.CODIGO_DEPORTE)}</td><td>${textoSeguro(x.DETALLE_DEPORTE)}</td></tr>`).join('');
  }
  $('encabezadoConsultaMaestros').innerHTML = encabezado;
  $('tablaConsultaMaestros').innerHTML = cuerpo || `<tr><td colspan="6" class="text-center py-5 text-secondary">No hay resultados.</td></tr>`;
  $('resumenConsultaMaestros').textContent = `${filas.length} registro(s) encontrados`;
  $('rangoConsultaMaestros').textContent = filas.length ? `Mostrando ${inicio + 1}–${Math.min(inicio + filasPorPaginaConsulta, filas.length)} de ${filas.length}` : 'Sin resultados';
  $('paginaConsultaMaestros').textContent = `Página ${paginaConsultaMaestros} de ${paginas}`;
  $('btnAnteriorConsultaMaestros').disabled = paginaConsultaMaestros <= 1;
  $('btnSiguienteConsultaMaestros').disabled = paginaConsultaMaestros >= paginas;
}
async function cargarConsultaMaestros() {
  const tipo = $('tipoConsultaMaestros').value;
  $('estadoConsultaModulos').classList.toggle('d-none', tipo !== 'MODULOS');
  $('filtrosModelosConsulta').classList.toggle('d-none', tipo !== 'MODELOS');
  $('tablaConsultaMaestros').innerHTML = '<tr><td colspan="6" class="text-center py-5 text-secondary">Cargando...</td></tr>';
  try {
    const endpoint = tipo === 'MODELOS' ? '/api/maestros/consulta/modelos' : tipo === 'COLORES' ? '/api/maestros/colores' : tipo === 'MODULOS' ? '/api/maestros/consulta/talles-modulos' : '/api/maestros/deportes';
    const datos = await api(endpoint);
    consultaMaestros = Array.isArray(datos.datos) ? datos.datos : [];
    if (tipo === 'MODELOS') cargarOpcionesFiltroModelos();
    paginaConsultaMaestros = 1; renderConsultaMaestros();
  } catch (e) { alerta(e.message, 'danger'); }
}
async function exportarConsultaMaestros() {
  const filas = filasConsultaFiltradas();
  if (!filas.length) return;
  const tipo = $('tipoConsultaMaestros').value, empresa = empresaValida();
  try {
    const respuesta = await fetch('/api/maestros/consulta/exportar', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-id-empresa': String(empresa) }, body: JSON.stringify({ tipo, filas }) });
    if (!respuesta.ok) { const error = await respuesta.json(); throw new Error(error.mensaje || 'No se pudo exportar la consulta.'); }
    const enlace = document.createElement('a'); enlace.href = URL.createObjectURL(await respuesta.blob()); enlace.download = `MAESTRO_${tipo}.xlsx`; document.body.appendChild(enlace); enlace.click(); enlace.remove(); URL.revokeObjectURL(enlace.href);
  } catch (e) { alerta(e.message, 'danger'); }
}
async function aplicarPermisosPantallaMaestros() {
  try {
    const respuesta = await fetch('/api/auth/me', { headers: { Accept: 'application/json' } });
    const datos = await respuesta.json();
    const usuario = datos.usuario || {};
    const accesoActivo = (usuario.empresas || []).find(x => Number(x.idEmpresa) === empresaValida());
    const puedeEscribir = Boolean(usuario.superAdmin) || ['SUPER_ADMIN','ADMIN','OPERADOR'].includes(String(accesoActivo?.rol || '').toUpperCase());
    $('tabAltasMaestros').classList.toggle('d-none', !puedeEscribir);
    if (!puedeEscribir) cambiarPanelMaestros('consulta');
  } catch (_) {}
}
function opciones(items, codigo, detalle, inicial) { return `<option value="">${inicial}</option>` + items.map(x => `<option value="${x[codigo]}">${x[detalle]} (${x[codigo]})</option>`).join(''); }
async function cargarCatalogosModelo() {
  const [marcas, rubros, proveedores, disciplinas] = await Promise.all([api('/api/maestros/marcas'), api('/api/maestros/rubros'), api('/api/maestros/proveedores'), api('/api/maestros/deportes')]);
  $('marcaModelo').innerHTML = opciones(marcas.datos, 'DETALLE_MARCA', 'DETALLE_MARCA', 'Seleccione marca...');
  $('rubroModelo').innerHTML = opciones(rubros.datos, 'DETALLE_RUBRO', 'DETALLE_RUBRO', 'Seleccione rubro...');
  const proveedoresPresea = proveedores.datos.map(x => ({
    codigo: String(x.CODIGO || '').trim().toUpperCase(),
    nombre: String(x.NVA_RAZON_SOCIAL || '').trim()
  })).filter(x => /^PB[A-Z0-9]{4}$/.test(x.codigo));
  const opcionesProveedor = '<option value="">Seleccione proveedor...</option>' + proveedoresPresea.map(x => `<option value="${x.codigo}">${x.nombre || x.codigo} (${x.codigo})</option>`).join('');
  $('proveedorModelo').innerHTML = opcionesProveedor;
  $('marcaModelosMasivos').innerHTML = opciones(marcas.datos, 'DETALLE_MARCA', 'DETALLE_MARCA', 'Seleccione marca...');
  $('rubroModelosMasivos').innerHTML = opciones(rubros.datos, 'DETALLE_RUBRO', 'DETALLE_RUBRO', 'Seleccione rubro...');
  const opcionesDisciplina = '<option value="__SIN_DISCIPLINA__">Sin disciplina</option>' + disciplinas.datos.map(x => `<option value="${textoSeguro(x.DETALLE_DEPORTE)}">${textoSeguro(x.DETALLE_DEPORTE)} (${textoSeguro(x.CODIGO_DEPORTE)})</option>`).join('');
  $('disciplinaModelo').innerHTML = opcionesDisciplina;
  $('disciplinaModelosMasivos').innerHTML = opcionesDisciplina;
  await cargarLicencias();
  await cargarLicenciasMasivas();
  ajustarDisciplina();
  ajustarDisciplinaMasiva();
}
async function cargarLicencias() {
  const marca = $('marcaModelo').value, rubro = $('rubroModelo').value;
  $('codigoMaestro').value = '';
  $('datosLicenciaNueva').classList.add('d-none');
  if (!marca || !rubro) { $('licenciaModelo').innerHTML = '<option value="">Seleccione primero marca y rubro...</option>'; $('licenciaModelo').disabled = true; return; }
  const d = await api(`/api/maestros/licencias-modelos?marca=${encodeURIComponent(marca)}&rubro=${encodeURIComponent(rubro)}`);
  const permiteSinLicencia = String(marca).trim().toUpperCase() === 'ATOMIK' && ['INDUMENTARIA', 'CALZADO', 'POP', 'ACCESORIOS'].includes(String(rubro).trim().toUpperCase());
  const licencias = Array.isArray(d.datos) ? d.datos : [];
  const tieneSinLicencia = licencias.some(x => x.CODIGO_LICENCIA === '__SIN_LICENCIA__');
  const opcionesLicencia = (permiteSinLicencia && !tieneSinLicencia ? [{ CODIGO_LICENCIA: '__SIN_LICENCIA__', DETALLE_LICENCIA: 'Sin licencia' }, ...licencias] : licencias);
  $('licenciaModelo').innerHTML = '<option value="">Seleccione licencia...</option>' + opcionesLicencia.map(x => `<option value="${x.CODIGO_LICENCIA}">${x.DETALLE_LICENCIA}</option>`).join('') + '<option value="__NUEVA__">+ Nueva licencia</option>';
  if (permiteSinLicencia || tieneSinLicencia) $('licenciaModelo').value = '__SIN_LICENCIA__';
  $('licenciaModelo').disabled = false;
  ajustarDisciplina();
}
async function cargarLicenciasMasivas() {
  const marca = $('marcaModelosMasivos').value, rubro = $('rubroModelosMasivos').value;
  vistaPreviaModelos = []; $('panelVistaPreviaModelos').classList.add('d-none'); $('datosLicenciaNuevaMasiva').classList.add('d-none');
  if (!marca || !rubro) { $('licenciaModelosMasivos').innerHTML = '<option value="">Seleccione primero marca y rubro...</option>'; $('licenciaModelosMasivos').disabled = true; return; }
  const d = await api(`/api/maestros/licencias-modelos?marca=${encodeURIComponent(marca)}&rubro=${encodeURIComponent(rubro)}`);
  const permiteSinLicencia = String(marca).trim().toUpperCase() === 'ATOMIK' && ['INDUMENTARIA', 'CALZADO', 'POP', 'ACCESORIOS'].includes(String(rubro).trim().toUpperCase());
  const licencias = Array.isArray(d.datos) ? d.datos : [], tieneSinLicencia = licencias.some(x => x.CODIGO_LICENCIA === '__SIN_LICENCIA__');
  const lista = permiteSinLicencia && !tieneSinLicencia ? [{ CODIGO_LICENCIA: '__SIN_LICENCIA__', DETALLE_LICENCIA: 'Sin licencia' }, ...licencias] : licencias;
  $('licenciaModelosMasivos').innerHTML = '<option value="">Seleccione licencia...</option>' + lista.map(x => `<option value="${x.CODIGO_LICENCIA}">${x.DETALLE_LICENCIA}</option>`).join('') + '<option value="__NUEVA__">+ Nueva licencia</option>';
  if (permiteSinLicencia || tieneSinLicencia) $('licenciaModelosMasivos').value = '__SIN_LICENCIA__';
  $('licenciaModelosMasivos').disabled = false;
  ajustarDisciplinaMasiva();
}
async function sugerir() { try { const tipo = $('tipoMaestro').value; let url = `/api/altas-maestros/siguiente-codigo/${tipo}`; if (tipo === 'MODELO') { const licencia = esLicenciaNueva() ? $('detalleLicenciaNueva').value : $('licenciaModelo').value; const q = new URLSearchParams({ marca: $('marcaModelo').value, rubro: $('rubroModelo').value, licencia, disciplina: $('disciplinaModelo').value, prefijoDisciplina: $('prefijoDisciplina').value, nuevaLicencia: String(esLicenciaNueva()), prefijo: $('prefijoLicencia').value }); url += `?${q}`; } const d = await api(url); $('codigoMaestro').value = d.codigo; } catch (e) { alerta(e.message, 'danger'); } }
async function cargar() { try { const d = await api('/api/altas-maestros'); $('tablaAltasMaestros').innerHTML = d.registros.map(x => { const confirmado = x.ESTADO === 'CONFIRMADO_ERP'; const estado = confirmado ? 'REGISTRADO EN PRESEA' : x.ESTADO.replaceAll('_', ' '); return `<tr><td>${textoSeguro(x.TIPO)}</td><td class="font-monospace fw-bold">${textoSeguro(x.CODIGO)}</td><td>${textoSeguro(x.NOMBRE)}</td><td>${textoSeguro(x.USUARIO_CREACION || '-')}</td><td><span class="badge ${confirmado ? 'text-bg-success' : 'text-bg-secondary'}">${estado}</span></td><td>${new Date(x.FECHA_CREACION).toLocaleString('es-AR')}</td></tr>`; }).join('') || '<tr><td colspan="6" class="text-center text-secondary py-4">Todavía no hay solicitudes.</td></tr>'; } catch (e) { alerta(e.message, 'danger'); } }
async function guardar(ev) { ev.preventDefault(); try { const tipo = $('tipoMaestro').value; if (tipo === 'MODELO' && !$('codigoMaestro').value) throw new Error('Primero debe sugerir el código de modelo.'); const cuerpo = { tipo, codigo: $('codigoMaestro').value, nombre: $('nombreMaestro').value, cProveedor: $('proveedorModelo').value, licencia: esLicenciaNueva() ? $('detalleLicenciaNueva').value : $('licenciaModelo').value, marca: $('marcaModelo').value, rubro: $('rubroModelo').value, disciplina: $('disciplinaModelo').value, prefijoDisciplina: $('prefijoDisciplina').value }; const d = await api('/api/altas-maestros', { method: 'POST', body: JSON.stringify(cuerpo) }); alerta(`${d.registro.TIPO} ${d.registro.CODIGO} reservado correctamente.`); ev.target.reset(); ajustarCampos(); await cargarCatalogosModelo(); await cargar(); } catch (e) { alerta(e.message, 'danger'); } }
async function enviar() { if (!confirm('¿Generar y enviar los DBI pendientes a Presea?')) return; try { const d = await api('/api/altas-maestros/enviar-presea', { method: 'POST', body: '{}' }); alerta(`${d.registros} registros enviados correctamente en ${d.archivos.length} archivo(s).`); await cargar(); } catch (e) { alerta(e.message, 'danger'); } }
function pintarVistaPreviaModelos(resultado) {
  vistaPreviaModelos = resultado.filas || [];
  $('panelVistaPreviaModelos').classList.remove('d-none');
  $('resumenVistaPreviaModelos').textContent = `${resultado.listos} de ${resultado.total} modelos listos`;
  $('tablaVistaPreviaModelos').innerHTML = vistaPreviaModelos.map((x, indice) => `<tr class="${x.estado === 'LISTO' ? '' : 'table-danger'}"><td>${x.fila}</td><td class="font-monospace fw-bold">${textoSeguro(x.codigo || '-')}</td><td><input class="form-control form-control-sm text-uppercase nombre-modelo-vista-previa" data-indice="${indice}" maxlength="100" value="${textoSeguro(x.nombre)}" aria-label="Nombre del modelo de la fila ${x.fila}"></td><td>${textoSeguro(x.marca)}</td><td>${textoSeguro(x.rubro)}</td><td>${textoSeguro(x.licencia)}</td><td>${textoSeguro(x.disciplina)}</td><td>${proveedorVistaPrevia(x)}</td><td>${x.estado === 'LISTO' ? '<span class="badge text-bg-success">LISTO</span>' : `<span class="badge text-bg-danger">REVISAR</span><div class="small text-danger mt-1">${textoSeguro(x.error)}</div>`}</td></tr>`).join('');
  $('btnConfirmarModelosMasivos').disabled = resultado.listos !== resultado.total || !resultado.total;
  $('btnDescargarVistaPreviaModelos').disabled = !resultado.total;
}
function actualizarNombreModeloVistaPrevia(evento) {
  const campo = evento.target.closest('.nombre-modelo-vista-previa');
  if (!campo) return;
  const indice = Number(campo.dataset.indice);
  if (!Number.isInteger(indice) || !vistaPreviaModelos[indice]) return;
  const nombre = campo.value.trim().toUpperCase();
  campo.value = nombre;
  vistaPreviaModelos[indice].nombre = nombre;
  const hayNombresVacios = vistaPreviaModelos.some(x => !String(x.nombre || '').trim());
  $('btnConfirmarModelosMasivos').disabled = hayNombresVacios || vistaPreviaModelos.some(x => x.estado !== 'LISTO' || !x.codigo);
  $('btnDescargarVistaPreviaModelos').disabled = hayNombresVacios;
  if (hayNombresVacios) alerta('Todos los modelos deben conservar un nombre antes de descargar o guardar.', 'warning');
}
async function previsualizarModelosMasivos() {
  const archivo = $('archivoModelosMasivos').files[0];
  if (!archivo) { alerta('Seleccione el template de modelos.', 'warning'); return; }
  const marca = $('marcaModelosMasivos').value;
  const rubro = $('rubroModelosMasivos').value;
  const licencia = esLicenciaNuevaMasiva() ? $('detalleLicenciaMasiva').value.trim() : $('licenciaModelosMasivos').value;
  const prefijo = esLicenciaNuevaMasiva() ? $('prefijoLicenciaMasiva').value.trim() : '';
  const disciplina = $('disciplinaModelosMasivos').value;
  const prefijoDisciplina = $('prefijoDisciplinaMasiva').value.trim();
  if (!marca || !rubro || !licencia) { alerta('Seleccione marca, rubro y licencia.', 'warning'); return; }
  if (esLicenciaNuevaMasiva() && (!/^[A-Za-z0-9]{2}$/.test(prefijo) || !licencia)) { alerta('Para una licencia nueva indique su nombre y dos caracteres.', 'warning'); return; }
  const btn = $('btnPrevisualizarModelos'), original = btn.textContent;
  try {
    btn.disabled = true; btn.textContent = 'Procesando...';
    const empresa = empresaValida(); if (!empresa) throw new Error('Debe seleccionar una empresa desde la barra superior.');
    const parametros = new URLSearchParams({ marca, rubro, licencia, prefijo, disciplina, prefijoDisciplina });
    const r = await fetch(`/api/altas-maestros/modelos/vista-previa?${parametros}`, { method: 'POST', headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'x-id-empresa': String(empresa) }, body: await archivo.arrayBuffer() });
    const d = await r.json(); if (!r.ok) throw new Error(d.mensaje || 'No se pudo procesar el template.');
    pintarVistaPreviaModelos(d); alerta('Template procesado. Revise los códigos antes de guardar.', 'info');
  } catch (e) { alerta(e.message, 'danger'); }
  finally { btn.disabled = false; btn.textContent = original; }
}
async function descargarTemplateModelos() {
  const btn = $('btnDescargarTemplateModelos'), original = btn.textContent;
  try {
    btn.disabled = true; btn.textContent = 'Preparando...';
    const empresa = empresaValida(); if (!empresa) throw new Error('Debe seleccionar una empresa desde la barra superior.');
    const r = await fetch('/api/altas-maestros/modelos/template', { headers: { 'x-id-empresa': String(empresa) } });
    if (!r.ok) { const d = await r.json(); throw new Error(d.mensaje || 'No se pudo generar el template.'); }
    const blob = await r.blob(), enlace = document.createElement('a');
    enlace.href = URL.createObjectURL(blob); enlace.download = 'ALTA_MODELOS_TEMPLATE.xlsx';
    document.body.appendChild(enlace); enlace.click(); enlace.remove(); URL.revokeObjectURL(enlace.href);
  } catch (e) { alerta(e.message, 'danger'); }
  finally { btn.disabled = false; btn.textContent = original; }
}
async function confirmarModelosMasivos() {
  if (!vistaPreviaModelos.length) return;
  const btn = $('btnConfirmarModelosMasivos'), original = btn.textContent;
  try {
    btn.disabled = true; btn.textContent = 'Guardando...';
    const d = await api('/api/altas-maestros/modelos/confirmar', { method: 'POST', body: JSON.stringify({ filas: vistaPreviaModelos }) });
    alerta(`${d.cantidad} modelos reservados correctamente.`, 'success');
    vistaPreviaModelos = []; $('panelVistaPreviaModelos').classList.add('d-none'); $('archivoModelosMasivos').value = ''; await cargar();
  } catch (e) { alerta(e.message, 'danger'); btn.disabled = false; }
  finally { btn.textContent = original; }
}
async function descargarVistaPreviaModelos() {
  if (!vistaPreviaModelos.length) return;
  const btn = $('btnDescargarVistaPreviaModelos'), original = btn.textContent;
  try {
    btn.disabled = true; btn.textContent = 'Preparando...';
    const empresa = empresaValida(); if (!empresa) throw new Error('Debe seleccionar una empresa desde la barra superior.');
    const r = await fetch('/api/altas-maestros/modelos/descargar-vista-previa', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-id-empresa': String(empresa) }, body: JSON.stringify({ filas: vistaPreviaModelos }) });
    if (!r.ok) { const d = await r.json(); throw new Error(d.mensaje || 'No se pudo generar el archivo.'); }
    const blob = await r.blob();
    const enlace = document.createElement('a');
    enlace.href = URL.createObjectURL(blob);
    enlace.download = `MODELOS_ASIGNADOS_${new Date().toISOString().slice(0, 10)}.xlsx`;
    document.body.appendChild(enlace); enlace.click(); enlace.remove(); URL.revokeObjectURL(enlace.href);
    alerta('Archivo de asignación descargado. Todavía puede revisar los datos antes de guardarlos.', 'info');
  } catch (e) { alerta(e.message, 'danger'); }
  finally { btn.disabled = false; btn.textContent = original; }
}
async function iniciar() {
  $('tabAltasMaestros').addEventListener('click', () => cambiarPanelMaestros('altas'));
  $('tabConsultaMaestros').addEventListener('click', () => cambiarPanelMaestros('consulta'));
  $('tipoConsultaMaestros').addEventListener('change', cargarConsultaMaestros);
  $('buscarConsultaMaestros').addEventListener('input', () => { paginaConsultaMaestros = 1; renderConsultaMaestros(); });
  $('estadoConsultaModulos').addEventListener('change', () => { paginaConsultaMaestros = 1; renderConsultaMaestros(); });
  for (const id of ['filtroMarcaModelos', 'filtroRubroModelos', 'filtroLicenciaModelos']) $(id).addEventListener('change', () => { paginaConsultaMaestros = 1; renderConsultaMaestros(); });
  $('btnAnteriorConsultaMaestros').addEventListener('click', () => { paginaConsultaMaestros -= 1; renderConsultaMaestros(); });
  $('btnSiguienteConsultaMaestros').addEventListener('click', () => { paginaConsultaMaestros += 1; renderConsultaMaestros(); });
  $('btnExportarConsultaMaestros').addEventListener('click', exportarConsultaMaestros);
  $('tipoMaestro').addEventListener('change', ajustarCampos);
  $('marcaModelo').addEventListener('change', cargarLicencias);
  $('rubroModelo').addEventListener('change', cargarLicencias);
  $('licenciaModelo').addEventListener('change', () => { ajustarLicenciaNueva(); ajustarDisciplina(); });
  $('disciplinaModelo').addEventListener('change', ajustarDisciplina);
  $('marcaModelosMasivos').addEventListener('change', cargarLicenciasMasivas);
  $('rubroModelosMasivos').addEventListener('change', cargarLicenciasMasivas);
  $('licenciaModelosMasivos').addEventListener('change', () => { ajustarLicenciaNuevaMasiva(); ajustarDisciplinaMasiva(); });
  $('disciplinaModelosMasivos').addEventListener('change', ajustarDisciplinaMasiva);
  $('btnSugerirCodigo').addEventListener('click', sugerir);
  $('btnActualizarMaestros').addEventListener('click', cargar);
  $('btnEnviarMaestros').addEventListener('click', enviar);
  $('btnPrevisualizarModelos').addEventListener('click', previsualizarModelosMasivos);
  $('btnDescargarTemplateModelos').addEventListener('click', descargarTemplateModelos);
  $('btnDescargarVistaPreviaModelos').addEventListener('click', descargarVistaPreviaModelos);
  $('tablaVistaPreviaModelos').addEventListener('input', actualizarNombreModeloVistaPrevia);
  $('btnConfirmarModelosMasivos').addEventListener('click', confirmarModelosMasivos);
  $('formAltaMaestro').addEventListener('submit', guardar);
  window.addEventListener('app:empresa-cambiada', event => {
    event.preventDefault();
    vistaPreviaModelos = [];
    consultaMaestros = [];
    paginaConsultaMaestros = 1;
    $('panelVistaPreviaModelos').classList.add('d-none');
    $('archivoModelosMasivos').value = '';
    aplicarPermisosPantallaMaestros()
      .then(() => Promise.all([
        cargarCatalogosModelo(),
        cargar(),
        $('panelConsultaMaestros').classList.contains('d-none') ? Promise.resolve() : cargarConsultaMaestros()
      ]))
      .catch(e => alerta(e.message, 'danger'));
  });
  window.addEventListener('app:datos-actualizar', cargar);
  ajustarCampos();
  await aplicarPermisosPantallaMaestros();
  if (await esperarEmpresaActiva()) {
    await cargarCatalogosModelo();
    await cargar();
    if (!$('panelConsultaMaestros').classList.contains('d-none')) await cargarConsultaMaestros();
  }
  else alerta('Debe seleccionar una empresa desde la barra superior.', 'danger');
}
