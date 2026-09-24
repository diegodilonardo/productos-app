param([Parameter(Mandatory = $true)][string]$Mensaje)

$ErrorActionPreference = 'Stop'
$rutaDev = Split-Path -Parent $PSScriptRoot
function Git-Dev {
    param([string[]]$Argumentos)
    $salida = & git -C $rutaDev @Argumentos
    if ($LASTEXITCODE -ne 0) { throw "Git falló: $($Argumentos -join ' ')" }
    return $salida
}
if ([string]::IsNullOrWhiteSpace($Mensaje)) { throw 'Indicá una descripción del cambio.' }
$rama = Git-Dev -Argumentos @('branch', '--show-current')
if ($rama -ne 'codex/descarga-imagenes-alta') { throw "Rama inesperada: $rama. No se publicaron cambios." }
$preparados = Git-Dev -Argumentos @('diff', '--cached', '--name-only')
if ($preparados) { throw 'Ya hay archivos preparados. Revisalos antes de usar este script.' }
$archivos = @(Git-Dev -Argumentos @('-c', 'core.quotePath=false', 'ls-files', '--modified', '--others', '--exclude-standard'))
$permitidos = @($archivos | Where-Object {
    $_ -match '^(src/|public/(js|css)/|views/|test/|scripts/|docs/|sql/)' -or
    $_ -in @('package.json', 'package-lock.json', '.gitignore', '.gitattributes')
} | Where-Object {
    $_ -notmatch '(^|/)(\.env[^/]*|node_modules|storage|salidas|tmp|\.tmp|output|outputs)(/|$)' -and
    $_ -notmatch '\.(7z|zip|rar|png|jpe?g|webp|gif|DBI|DBF|log)$'
})
if (-not $permitidos.Count) { Write-Host 'No hay cambios permitidos para publicar.'; return }
Write-Host 'Archivos que se publicarán (revisá también que no contengan credenciales):'
$permitidos | Out-Host
$excluidos = @($archivos | Where-Object { $_ -notin $permitidos })
if ($excluidos.Count) { Write-Host "Se dejan fuera $($excluidos.Count) archivos de otras carpetas o formatos." }
Push-Location $rutaDev
try {
    & npm.cmd test
    if ($LASTEXITCODE -ne 0) { throw 'Fallaron las pruebas. No se hizo commit ni push.' }
} finally { Pop-Location }
$confirmacion = Read-Host '¿Publicar estos archivos? Escribí SI para confirmar'
if ($confirmacion -cne 'SI') { Write-Host 'Cancelado. No se hizo commit ni push.'; return }
Git-Dev -Argumentos (@('add', '--') + $permitidos) | Out-Host
Git-Dev -Argumentos @('diff', '--cached', '--stat') | Out-Host
Git-Dev -Argumentos @('commit', '-m', $Mensaje) | Out-Host
Git-Dev -Argumentos @('push', 'origin', $rama) | Out-Host
Write-Host 'Publicado. Ahora podés ejecutar actualizar-produccion.ps1 en el servidor.'
