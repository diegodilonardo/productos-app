function rellenar(valor, largo = 2) {
  return String(valor).padStart(largo, '0');
}

/*
 * SQL Server guarda DATETIME con hora local y sin zona horaria. La conexión
 * usa useUTC:false, por lo que los componentes locales del Date representan
 * exactamente la hora de pared guardada en SQL. Se envían sin sufijo de zona
 * para impedir una conversión adicional en el navegador.
 */
function fechaLocalSinZona(fecha) {
  return [
    rellenar(fecha.getFullYear(), 4), '-',
    rellenar(fecha.getMonth() + 1), '-',
    rellenar(fecha.getDate()), 'T',
    rellenar(fecha.getHours()), ':',
    rellenar(fecha.getMinutes()), ':',
    rellenar(fecha.getSeconds()), '.',
    rellenar(fecha.getMilliseconds(), 3),
  ].join('');
}

function reemplazarFechaLocalJson(clave, valor) {
  const original = this?.[clave];
  return original instanceof Date ? fechaLocalSinZona(original) : valor;
}

module.exports = {
  fechaLocalSinZona,
  reemplazarFechaLocalJson,
};
