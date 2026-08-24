document.addEventListener('DOMContentLoaded', iniciarDetallePedido);
const ID_PEDIDO = document.getElementById('pedidoDetalleApp')?.dataset.idPedido;
let pedido=null, detalle=[], disponibles=[], productosAlta=[], exportaciones=[], productoModal=null, historialExportacionesAbierto=false;
let modalProducto, modalAnular;

async function iniciarDetallePedido(){
  modalProducto=new bootstrap.Modal(document.getElementById('modalProductoPedido'));
  modalAnular=new bootstrap.Modal(document.getElementById('modalAnularPedido'));
  document.getElementById('buscarProductoPedido').addEventListener('input', pintarDisponibles);
  document.getElementById('formProductoPedido').addEventListener('submit', guardarProducto);
  document.getElementById('modalCantidadPares').addEventListener('input', pintarCalculoModal);
  document.getElementById('modalFobPar').addEventListener('input', pintarCalculoModal);
  document.getElementById('modalAdicional').addEventListener('input', pintarCalculoModal);
  document.getElementById('btnValidarPedido').addEventListener('click', validarPedido);
  document.getElementById('btnAnularPedido').addEventListener('click',abrirModalAnulacion);
  document.getElementById('formAnularPedido').addEventListener('submit', anularPedido);
  document.getElementById('btnExportarPedidoExcel')?.addEventListener('click',ev=>descargarExportacion(ev,'pedido-excel','Pedido Excel'));
  document.getElementById('btnExportarMasterData')?.addEventListener('click',ev=>descargarExportacion(ev,'master-data-app','Master Data'));
  document.getElementById('btnExportarPrecFob')?.addEventListener('click',ev=>descargarExportacion(ev,'prec-fob','PREC_FOB'));
  document.getElementById('btnToggleHistorialExportaciones')?.addEventListener('click',toggleHistorialExportaciones);
  await cargarTodo();
}

async function api(url,opciones){const r=await fetch(url,opciones);let d=null;try{d=await r.json();}catch{}if(!r.ok||d?.ok===false)throw new Error(d?.mensaje||`Error HTTP ${r.status}`);return d;}
async function cargarTodo(){ocultarAlerta();try{const p=await api(`/api/pedidos/${ID_PEDIDO}`);pedido=p.resultado;const d=await api(`/api/pedidos/${ID_PEDIDO}/detalle`);detalle=Array.isArray(d?.datos)?d.datos:[];productosAlta=[];try{const u=`/api/pedidos/altas/${encodeURIComponent(pedido.ID_ALTA)}/productos?codigoProveedor=${encodeURIComponent(pedido.CODIGO_PROVEEDOR)}`;const a=await api(u);productosAlta=Array.isArray(a?.datos)?a.datos:[];}catch(_){productosAlta=[];}if(estado()==='BORRADOR'){disponibles=productosAlta.filter(x=>!detalle.some(y=>String(y.ID_PRODUCTO)===String(x.ID_PRODUCTO)));}else{disponibles=[];}if(['VALIDADO','ANULADO'].includes(estado())){const ex=await api(`/api/pedidos/${ID_PEDIDO}/exportaciones`);exportaciones=Array.isArray(ex?.datos)?ex.datos:[];}else{exportaciones=[];}pintarCabecera();pintarDisponibles();pintarDetalle();pintarExportaciones();pintarResumenSuperior();}catch(e){mostrarAlerta(e.message,'danger');}}
function pintarCabecera(){setTexto('tituloPedido',pedido.CODIGO_PEDIDO||`Pedido ${pedido.ID_PEDIDO}`);setTexto('subtituloPedido',`${pedido.DETALLE_PROVEEDOR} · Orden ${pedido.NUMERO_ORDEN}`);setTexto('infoCodigoAlta',pedido.CODIGO_ALTA);setTexto('infoProveedor',pedido.DETALLE_PROVEEDOR);setTexto('infoOrden',pedido.NUMERO_ORDEN);setTexto('infoMoneda',pedido.MONEDA);document.getElementById('infoEstado').innerHTML=`<span class="badge ${claseEstado(estado())}">${esc(estado())}</span>`;setTexto('infoFecha',fecha(pedido.FECHA_CREACION));document.getElementById('infoObservaciones').textContent=pedido.OBSERVACIONES?`Observaciones: ${pedido.OBSERVACIONES}`:'';document.getElementById('panelProductosDisponibles').classList.toggle('d-none',estado()!=='BORRADOR');document.getElementById('btnValidarPedido').classList.toggle('d-none',estado()!=='BORRADOR');document.getElementById('btnAnularPedido').classList.toggle('d-none',!['BORRADOR','VALIDADO'].includes(estado()));actualizarExportaciones();}
function actualizarExportaciones(){const panel=document.getElementById('accionesExportacionPedido');if(!panel)return;const habilitado=estado()==='VALIDADO';panel.classList.toggle('d-none',!habilitado);if(!habilitado)return;document.getElementById('btnExportarPedidoExcel').href=`/api/pedidos/${encodeURIComponent(ID_PEDIDO)}/exportacion/pedido-excel`;document.getElementById('btnExportarMasterData').href=`/api/pedidos/${encodeURIComponent(ID_PEDIDO)}/exportacion/master-data-app`;document.getElementById('btnExportarPrecFob').href=`/api/pedidos/${encodeURIComponent(ID_PEDIDO)}/exportacion/prec-fob`;}
async function descargarExportacion(ev,tipo,etiqueta){ev.preventDefault();if(estado()!=='VALIDADO'){mostrarAlerta('Solo se pueden exportar pedidos VALIDADO.','warning');return;}const boton=ev.currentTarget;const url=`/api/pedidos/${encodeURIComponent(ID_PEDIDO)}/exportacion/${tipo}`;const textoOriginal=boton.textContent;try{boton.classList.add('disabled');boton.setAttribute('aria-disabled','true');boton.textContent='Generando...';const r=await fetch(url);if(!r.ok){let mensaje=`Error HTTP ${r.status}`;try{const d=await r.json();mensaje=d?.mensaje||mensaje;}catch{}throw new Error(mensaje);}const blob=await r.blob();const cd=r.headers.get('Content-Disposition')||'';let nombre=`exportacion_${ID_PEDIDO}`;const m=cd.match(/filename="?([^";]+)"?/i);if(m?.[1])nombre=m[1];const objeto=URL.createObjectURL(blob);const a=document.createElement('a');a.href=objeto;a.download=nombre;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(objeto),1500);mostrarAlerta(`${etiqueta} exportado correctamente: ${nombre}`,'success');await cargarHistorialExportaciones();}catch(e){mostrarAlerta(e.message,'danger');}finally{boton.classList.remove('disabled');boton.removeAttribute('aria-disabled');boton.textContent=textoOriginal;}}
async function cargarHistorialExportaciones(){if(!['VALIDADO','ANULADO'].includes(estado())){exportaciones=[];pintarExportaciones();return;}try{const ex=await api(`/api/pedidos/${ID_PEDIDO}/exportaciones`);exportaciones=Array.isArray(ex?.datos)?ex.datos:[];pintarExportaciones();pintarResumenSuperior();}catch(e){mostrarAlerta(`El archivo fue procesado, pero no se pudo actualizar el historial: ${e.message}`,'warning');}}
function pintarExportaciones(){const panel=document.getElementById('panelHistorialExportaciones'),tbody=document.getElementById('tablaExportacionesPedido'),resumen=document.getElementById('resumenExportacionesPedido');if(!panel||!tbody)return;const visible=['VALIDADO','ANULADO'].includes(estado());panel.classList.toggle('d-none',!visible);if(!visible){historialExportacionesAbierto=false;actualizarEstadoHistorialExportaciones();return;}tbody.innerHTML='';if(!exportaciones.length){tbody.innerHTML='<tr><td colspan="6" class="text-center py-4 text-secondary">Todavía no se registraron exportaciones para este pedido.</td></tr>';if(resumen)resumen.textContent='0 exportaciones';}else{for(const x of exportaciones){const tr=document.createElement('tr');tr.innerHTML=`<td>${esc(fechaHora(x.FECHA_EXPORTACION))}</td><td>${esc(nombreTipoExportacion(x.TIPO_EXPORTACION))}</td><td><span class="fw-semibold">${esc(x.NOMBRE_ARCHIVO)}</span></td><td>${num(x.CANTIDAD_REGISTROS)}</td><td>${esc(x.USUARIO_EXPORTACION||'-')}</td><td><span class="badge text-bg-success">${esc(x.ESTADO||'OK')}</span></td>`;tbody.appendChild(tr);}if(resumen)resumen.textContent=`${exportaciones.length} exportaciones`;}actualizarEstadoHistorialExportaciones();}
function toggleHistorialExportaciones(){historialExportacionesAbierto=!historialExportacionesAbierto;actualizarEstadoHistorialExportaciones();}
function actualizarEstadoHistorialExportaciones(){const contenido=document.getElementById('contenidoHistorialExportaciones'),boton=document.getElementById('btnToggleHistorialExportaciones'),texto=document.getElementById('textoToggleHistorialExportaciones');if(!contenido||!boton)return;const visible=['VALIDADO','ANULADO'].includes(estado());boton.classList.toggle('d-none',!visible);if(!visible){contenido.classList.add('d-none');boton.setAttribute('aria-expanded','false');boton.classList.remove('is-open');if(texto)texto.textContent='Ver historial';return;}contenido.classList.toggle('d-none',!historialExportacionesAbierto);boton.setAttribute('aria-expanded',historialExportacionesAbierto?'true':'false');boton.classList.toggle('is-open',historialExportacionesAbierto);if(texto)texto.textContent=historialExportacionesAbierto?'Ocultar historial':'Ver historial';}
function nombreTipoExportacion(v){const t=String(v||'').toUpperCase();return t==='PEDIDO_EXCEL'?'Pedido Excel':t==='MASTER_DATA_APP'?'Master Data':t==='PREC_FOB'?'PREC_FOB':t;}
function fechaHora(v){if(!v)return '-';const d=new Date(v);return Number.isNaN(d.getTime())?String(v):d.toLocaleString('es-AR');}
function abrirModalAnulacion(){const aviso=document.getElementById('advertenciaAnulacionExportada');if(aviso){const cantidad=exportaciones.length;if(estado()==='VALIDADO'&&cantidad>0){aviso.textContent=`Atención: este pedido ya posee ${num(cantidad)} exportación${cantidad===1?'':'es'} registrada${cantidad===1?'':'s'}. La anulación no elimina los archivos ya generados ni su historial.`;aviso.classList.remove('d-none');}else{aviso.textContent='';aviso.classList.add('d-none');}}document.getElementById('motivoAnulacion').value='';modalAnular.show();}
function pintarDisponibles(){
  const contenedor=document.getElementById('tablaProductosDisponibles');
  const resumen=document.getElementById('resumenProductosDisponibles');
  const q=(document.getElementById('buscarProductoPedido').value||'').trim().toUpperCase();
  const lista=disponibles.filter(p=>[p.DETALLE_MODELO,p.DETALLE_COLOR,p.DETALLE_PRODUCTO,p.TALLE_CURVA,p.DETALLE_EDAD,p.CODIGO_ALFA].join(' ').toUpperCase().includes(q));
  if(resumen)resumen.textContent=q?`${num(lista.length)} de ${num(disponibles.length)} disponibles`:`${num(disponibles.length)} disponibles`;
  contenedor.innerHTML='';
  if(!lista.length){
    contenedor.innerHTML=`<div class="pedido-available-empty">${q?'No encontramos productos que coincidan con la búsqueda.':'No hay productos disponibles para agregar a este pedido.'}</div>`;
    return;
  }
  for(const p of lista){
    const tipo=String(p.TIPO_PRODUCTO_DETALLE||p.TIPO_PRODUCTO||'').toUpperCase();
    const curva=p.TALLE_CURVA||'-';
    const esModulo=tipo==='MODULO';
    const pares=esModulo?num(p.PARES):null;
    const etiquetaCurva=esModulo?'Talle / Curva':'Talle';
    const imagen=p.URL_IMAGEN
      ? `<img class="pedido-available-img" src="${esc(p.URL_IMAGEN)}" alt="" onerror="this.outerHTML='<span class=&quot;pedido-available-placeholder&quot;><svg viewBox=&quot;0 0 24 24&quot; fill=&quot;none&quot; stroke=&quot;currentColor&quot; stroke-width=&quot;2&quot;><path d=&quot;m3 16 5-5 4 4 3-3 6 6&quot;/><rect x=&quot;3&quot; y=&quot;3&quot; width=&quot;18&quot; height=&quot;18&quot; rx=&quot;2&quot;/></svg></span>'">`
      : `<span class="pedido-available-placeholder"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m3 16 5-5 4 4 3-3 6 6"/><rect x="3" y="3" width="18" height="18" rx="2"/></svg></span>`;
    const card=document.createElement('article');
    card.className=`pedido-available-card${esModulo?'':' is-par-suelto'}`;
    card.innerHTML=`
      <div class="pedido-available-top">
        ${imagen}
        <div class="min-w-0">
          <div class="pedido-available-model">${esc(p.DETALLE_MODELO||'-')}</div>
          <div class="pedido-available-title" title="${esc(p.DETALLE_PRODUCTO||'')}">${esc(p.DETALLE_PRODUCTO||'-')}</div>
        </div>
      </div>
      <div class="pedido-available-meta">
        <div><span>Color</span><strong title="${esc(p.DETALLE_COLOR||'-')}">${esc(p.DETALLE_COLOR||'-')}</strong></div>
        <div><span>${etiquetaCurva}</span><strong class="pedido-available-curve" title="${esc(curva)}">${esc(curva)}</strong></div>
        ${esModulo?`<div><span>Pares módulo</span><strong>${pares}</strong></div>`:''}
      </div>
      <div class="pedido-available-actions">
        <span class="pedido-available-age">${esc(p.DETALLE_EDAD||'-')}</span>
        <button class="btn btn-sm btn-primary" type="button" data-cargar="${esc(p.ID_PRODUCTO)}">Cargar</button>
      </div>`;
    contenedor.appendChild(card);
  }
  contenedor.querySelectorAll('[data-cargar]').forEach(b=>b.addEventListener('click',()=>abrirAltaProducto(b.dataset.cargar)));
}
function pintarResumenSuperior(){const totalPares=detalle.reduce((a,x)=>a+Number(x.CANTIDAD_PARES||0),0),total=detalle.reduce((a,x)=>a+Number(x.TOTAL_PRODUCTO||0),0),cantidadExp=exportaciones.length;setTexto('metDetalleProductos',num(detalle.length));setTexto('metDetallePares',num(totalPares));setTexto('metDetalleTotal',dinero(total));setTexto('metDetalleMoneda',pedido?.MONEDA||'USD');setTexto('metDetalleExportaciones',num(cantidadExp));setTexto('metDetalleExportacionEstado',cantidadExp===0?'Sin exportaciones':`${num(cantidadExp)} salida${cantidadExp===1?'':'s'} registrada${cantidadExp===1?'':'s'}`);}
function pintarDetalle(){
  const contenedor=document.getElementById('tablaDetallePedido');
  contenedor.innerHTML='';
  if(!detalle.length){
    contenedor.innerHTML='<div class="pedido-loaded-empty">El pedido todavía no tiene productos.</div>';
  }else{
    for(const d of detalle){
      const tipo=String(d.TIPO_PRODUCTO||d.TIPO_PRODUCTO_DETALLE||'').toUpperCase();
      const curva=d.DETALLE_MODULO||d.DETALLE_TALLE||'-';
      const modulos=d.CANTIDAD_MODULOS==null?'-':num(d.CANTIDAD_MODULOS);
      const adicional=Number(d.ADICIONAL||0);
      const totalAdicional=Number(d.CANTIDAD_PARES||0)*adicional;
      const productoOrigen=productosAlta.find(p=>String(p.ID_PRODUCTO)===String(d.ID_PRODUCTO));
      const urlImagen=productoOrigen?.URL_IMAGEN||d.URL_IMAGEN||'';
      const imagen=urlImagen
        ? `<img class="pedido-loaded-img" src="${esc(urlImagen)}" alt="" onerror="this.outerHTML='<span class=&quot;pedido-loaded-placeholder&quot;><svg viewBox=&quot;0 0 24 24&quot; fill=&quot;none&quot; stroke=&quot;currentColor&quot; stroke-width=&quot;2&quot;><path d=&quot;m3 16 5-5 4 4 3-3 6 6&quot;/><rect x=&quot;3&quot; y=&quot;3&quot; width=&quot;18&quot; height=&quot;18&quot; rx=&quot;2&quot;/></svg></span>'">`
        : `<span class="pedido-loaded-placeholder"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m3 16 5-5 4 4 3-3 6 6"/><rect x="3" y="3" width="18" height="18" rx="2"/></svg></span>`;
      const acciones=estado()==='BORRADOR'?`<div class="pedido-loaded-actions"><button class="btn btn-sm btn-outline-primary" type="button" data-editar="${esc(d.ID_PEDIDO_DETALLE)}">Editar</button><button class="btn btn-sm btn-outline-danger" type="button" data-eliminar="${esc(d.ID_PEDIDO_DETALLE)}">Quitar</button></div>`:'';
      const card=document.createElement('article');
      card.className='pedido-loaded-card';
      card.innerHTML=`
        <div class="pedido-loaded-head">
          ${imagen}
          <div class="pedido-loaded-titlewrap">
            <div class="pedido-loaded-title" title="${esc(d.DETALLE_PRODUCTO)}">${esc(d.DETALLE_PRODUCTO)}</div>
            <div class="pedido-loaded-code">${esc(d.CODIGO_ALFA)}</div>
          </div>
          <span class="pedido-loaded-curve" title="${esc(curva)}">${esc(curva)}</span>
        </div>
        <div class="pedido-loaded-metrics">
          <div class="pedido-loaded-metric"><span>Pares</span><strong>${num(d.CANTIDAD_PARES)}</strong></div>
          <div class="pedido-loaded-metric"><span>${tipo==='MODULO'?'Módulos':'Tipo'}</span><strong>${tipo==='MODULO'?modulos:'Par suelto'}</strong></div>
          <div class="pedido-loaded-metric"><span>FOB / par</span><strong>${dinero(d.PRECIO_FOB_PAR)}</strong></div>
          <div class="pedido-loaded-metric"><span>Adicional / par</span><strong>${dinero(adicional)}</strong></div>
        </div>
        <div class="pedido-loaded-financial">
          <div><span>FOB total</span><strong>${dinero(d.TOTAL_FOB)}</strong></div>
          <div><span>Adicional total</span><strong>${dinero(totalAdicional)}</strong></div>
          <div class="pedido-loaded-total"><span>Total producto</span><strong>${pedido?.MONEDA||'USD'} ${dinero(d.TOTAL_PRODUCTO)}</strong></div>
        </div>
        <div class="pedido-loaded-footer">
          <span class="pedido-loaded-note" title="${esc(d.OBSERVACIONES||'')}">${d.OBSERVACIONES?`Obs.: ${esc(d.OBSERVACIONES)}`:'Sin observaciones'}</span>
          ${acciones}
        </div>`;
      contenedor.appendChild(card);
    }
  }
  contenedor.querySelectorAll('[data-editar]').forEach(b=>b.addEventListener('click',()=>abrirEditarProducto(b.dataset.editar)));
  contenedor.querySelectorAll('[data-eliminar]').forEach(b=>b.addEventListener('click',()=>eliminarProducto(b.dataset.eliminar)));
  const totalPares=detalle.reduce((a,x)=>a+Number(x.CANTIDAD_PARES||0),0),total=detalle.reduce((a,x)=>a+Number(x.TOTAL_PRODUCTO||0),0);
  const resumen=document.getElementById('resumenPedido');if(resumen)resumen.innerHTML=`<span class="pedido-summary-chip"><small>Productos</small><strong>${num(detalle.length)}</strong></span><span class="pedido-summary-chip"><small>Pares</small><strong>${num(totalPares)}</strong></span><span class="pedido-summary-chip pedido-summary-chip-total"><small>Total</small><strong>${esc(pedido?.MONEDA||'USD')} ${dinero(total)}</strong></span>`;
}
function abrirAltaProducto(id){productoModal=disponibles.find(x=>String(x.ID_PRODUCTO)===String(id));if(!productoModal)return;document.getElementById('modalProductoTitulo').textContent='Cargar producto';document.getElementById('modalIdProducto').value=productoModal.ID_PRODUCTO;document.getElementById('modalIdDetalle').value='';const tipo=String(productoModal.TIPO_PRODUCTO_DETALLE||productoModal.TIPO_PRODUCTO||'').toUpperCase();const complemento=tipo==='MODULO'?`${esc(productoModal.TALLE_CURVA||'')} · ${num(productoModal.PARES)} pares por módulo`:`Talle ${esc(productoModal.TALLE_CURVA||'-')} · Par suelto`;document.getElementById('modalProductoInfo').innerHTML=`<div class="pedido-modal-product"><span class="pedido-modal-product-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m12 3 8 4-8 4-8-4 8-4Z"/><path d="m4 11 8 4 8-4M4 15l8 4 8-4"/></svg></span><div><div class="pedido-modal-product-title">${esc(productoModal.DETALLE_PRODUCTO)}</div><div class="pedido-modal-product-sub">${complemento}</div></div></div>`;document.getElementById('modalCantidadPares').value='';document.getElementById('modalFobPar').value='';document.getElementById('modalAdicional').value='0';document.getElementById('modalObservaciones').value='';pintarCalculoModal();modalProducto.show();}
function abrirEditarProducto(id){const d=detalle.find(x=>String(x.ID_PEDIDO_DETALLE)===String(id));if(!d)return;productoModal={...d,PARES:d.PARES_MODULO};document.getElementById('modalProductoTitulo').textContent='Editar producto';document.getElementById('modalIdProducto').value=d.ID_PRODUCTO;document.getElementById('modalIdDetalle').value=d.ID_PEDIDO_DETALLE;document.getElementById('modalProductoInfo').innerHTML=`<div class="pedido-modal-product"><span class="pedido-modal-product-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m12 3 8 4-8 4-8-4 8-4Z"/><path d="m4 11 8 4 8-4M4 15l8 4 8-4"/></svg></span><div><div class="pedido-modal-product-title">${esc(d.DETALLE_PRODUCTO)}</div><div class="pedido-modal-product-sub">${esc(d.DETALLE_MODULO||d.DETALLE_TALLE||'')}</div></div></div>`;document.getElementById('modalCantidadPares').value=d.CANTIDAD_PARES;document.getElementById('modalFobPar').value=d.PRECIO_FOB_PAR;document.getElementById('modalAdicional').value=d.ADICIONAL;document.getElementById('modalObservaciones').value=d.OBSERVACIONES||'';pintarCalculoModal();modalProducto.show();}
function pintarCalculoModal(){const box=document.getElementById('modalCalculo');if(!productoModal){box.innerHTML='';box.classList.remove('is-four');return;}const cantidadRaw=document.getElementById('modalCantidadPares').value;const pares=Number(cantidadRaw||0),fob=Number(document.getElementById('modalFobPar').value||0),ad=Number(document.getElementById('modalAdicional').value||0),pm=Number(productoModal.PARES||productoModal.PARES_MODULO||0),tipo=String(productoModal.TIPO_PRODUCTO_DETALLE||productoModal.TIPO_PRODUCTO||'').toUpperCase();const totalFob=pares*fob,totalAdicional=pares*ad,total=totalFob+totalAdicional;const cantidadIngresada=cantidadRaw!==''&&Number.isFinite(pares)&&pares>0;const moduloValido=tipo==='MODULO'&&pm>0&&cantidadIngresada&&pares%pm===0;box.classList.toggle('is-four',moduloValido);let extra='';if(tipo==='MODULO'&&pm>0){if(moduloValido){extra=`<div class="pedido-calc-item pedido-calc-modulos"><span>Módulos</span><strong>${num(pares/pm)}</strong></div>`;}else if(cantidadIngresada){extra=`<div class="pedido-calc-warning">La cantidad de pares debe ser divisible exactamente por ${num(pm)} pares del módulo.</div>`;}}box.innerHTML=`<div class="pedido-calc-item"><span>FOB total</span><strong>${dinero(totalFob)}</strong></div><div class="pedido-calc-item"><span>Adicional total</span><strong>${dinero(totalAdicional)}</strong></div><div class="pedido-calc-item"><span>Total producto</span><strong>${dinero(total)}</strong></div>${extra}`;}
async function guardarProducto(ev){ev.preventDefault();const idDetalle=document.getElementById('modalIdDetalle').value;const payload={cantidadPares:Number(document.getElementById('modalCantidadPares').value),precioFobPar:Number(document.getElementById('modalFobPar').value),adicional:Number(document.getElementById('modalAdicional').value||0),observaciones:document.getElementById('modalObservaciones').value.trim()};if(!idDetalle)payload.idProducto=Number(document.getElementById('modalIdProducto').value);const url=idDetalle?`/api/pedidos/${ID_PEDIDO}/detalle/${idDetalle}`:`/api/pedidos/${ID_PEDIDO}/detalle`;const method=idDetalle?'PUT':'POST';const btn=document.getElementById('btnGuardarProducto');try{btn.disabled=true;await api(url,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});modalProducto.hide();mostrarAlerta(idDetalle?'Producto actualizado.':'Producto agregado.','success');await cargarTodo();}catch(e){mostrarAlerta(e.message,'danger');}finally{btn.disabled=false;}}
async function eliminarProducto(id){if(!confirm('¿Quitar este producto del pedido?'))return;try{await api(`/api/pedidos/${ID_PEDIDO}/detalle/${id}`,{method:'DELETE'});mostrarAlerta('Producto eliminado.','success');await cargarTodo();}catch(e){mostrarAlerta(e.message,'danger');}}
async function validarPedido(){if(!detalle.length){mostrarAlerta('El pedido no contiene productos para validar.','warning');return;}if(!confirm('Después de validar el pedido quedará bloqueado para modificaciones. ¿Continuar?'))return;try{await api(`/api/pedidos/${ID_PEDIDO}/validar`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({usuario:'SISTEMA'})});mostrarAlerta('Pedido validado correctamente.','success');await cargarTodo();}catch(e){mostrarAlerta(e.message,'danger');}}
async function anularPedido(ev){ev.preventDefault();const motivo=document.getElementById('motivoAnulacion').value.trim();if(!motivo){mostrarAlerta('El motivo de anulación es obligatorio.','warning');return;}const btn=document.getElementById('btnConfirmarAnulacion');try{btn.disabled=true;await api(`/api/pedidos/${ID_PEDIDO}/anular`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({motivo,usuario:'SISTEMA'})});modalAnular.hide();mostrarAlerta('Pedido anulado correctamente.','success');await cargarTodo();}catch(e){mostrarAlerta(e.message,'danger');}finally{btn.disabled=false;}}
function estado(){return String(pedido?.ESTADO||'').toUpperCase();}function claseEstado(e){return e==='BORRADOR'?'text-bg-secondary':e==='VALIDADO'?'text-bg-success':e==='ANULADO'?'text-bg-danger':'text-bg-secondary';}function num(v){return Number(v||0).toLocaleString('es-AR');}function dinero(v){return Number(v||0).toLocaleString('es-AR',{minimumFractionDigits:2,maximumFractionDigits:4});}function fecha(v){return v?new Date(v).toLocaleDateString('es-AR'):'-';}function setTexto(id,v){const e=document.getElementById(id);if(e)e.textContent=v??'-';}function esc(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}function mostrarAlerta(m,t){const e=document.getElementById('alertaDetallePedido');e.className=`alert alert-${t}`;e.textContent=m;window.scrollTo({top:0,behavior:'smooth'});}function ocultarAlerta(){const e=document.getElementById('alertaDetallePedido');e.className='alert d-none';e.textContent='';}
