function rellenar(valor, largo = 2) {
  return String(valor).padStart(largo, '0');
}

/*
 * SQL Server guarda DATETIME con hora local y sin zona horaria. El driver
 * entrega esos valores como Date y JSON.stringify les agrega una Z, haciendo
 * que el navegador reste tres horas. Se conserva la hora de pared de SQL y se
 * envía sin sufijo de zona para que el navegador no vuelva a convertirla.
 */
function fechaLocalSinZona(fecha) {
  return [
    rellenar(fecha.getUTCFullYear(), 4), '-',
    rellenar(fecha.getUTCMonth() + 1), '-',
    rellenar(fecha.getUTCDate()), 'T',
    rellenar(fecha.getUTCHours()), ':',
    rellenar(fecha.getUTCMinutes()), ':',
    rellenar(fecha.getUTCSeconds()), '.',
    rellenar(fecha.getUTCMilliseconds(), 3),
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
