(function crearReglasTallesParSuelto(raiz, fabrica) {
  const api = fabrica();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else raiz.ReglasTallesParSuelto = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function fabrica() {
  const indumentaria = new Set(['T_XS','T_S','T_M','T_L','T_XL','T_2X','T_3X','T_2XL','T_3XL']);
  const accesorios = new Set(['T00','T01','T02','T03','XS','S','M','L','XL','2X','3X']);
  const pop = new Set(['T00']);

  const texto = valor => String(valor ?? '').trim().toUpperCase();
  const codigo = fila => texto(fila?.CODIGO_TALLE ?? fila?.codigoTalle);
  const detalle = fila => String(fila?.DETALLE_TALLE ?? fila?.detalleTalle ?? '').trim();

  function esTalleCalzado(fila) {
    const numero = Number(detalle(fila).replace(',', '.'));
    return Boolean(codigo(fila)) && Number.isFinite(numero) && numero > 0;
  }

  function comparar(a, b) {
    const numeroA = Number(detalle(a).replace(',', '.'));
    const numeroB = Number(detalle(b).replace(',', '.'));
    const aNumero = Number.isFinite(numeroA);
    const bNumero = Number.isFinite(numeroB);
    if (aNumero && bNumero) return numeroA - numeroB;
    if (aNumero !== bNumero) return aNumero ? -1 : 1;
    const orden = ['XS','S','M','L','XL','2X','2XL','3X','3XL'];
    const posA = orden.indexOf(texto(detalle(a)));
    const posB = orden.indexOf(texto(detalle(b)));
    if (posA >= 0 || posB >= 0) {
      if (posA < 0) return 1;
      if (posB < 0) return -1;
      return posA - posB;
    }
    return detalle(a).localeCompare(detalle(b), 'es', { sensitivity: 'base', numeric: true });
  }

  function filtrar(lista, rubroEntrada) {
    const rubro = texto(rubroEntrada).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const permitidos = rubro === 'INDUMENTARIA' ? indumentaria : rubro === 'ACCESORIOS' ? accesorios : rubro === 'POP' ? pop : null;
    return (Array.isArray(lista) ? lista : []).filter(fila => {
      if (rubro === 'CALZADO') return esTalleCalzado(fila);
      return permitidos ? permitidos.has(codigo(fila)) : false;
    }).sort(comparar);
  }

  return { filtrar, esTalleCalzado, comparar };
});
