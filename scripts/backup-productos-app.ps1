param(
    [ValidateSet('FULL', 'DIFF')]
    [string]$Tipo = 'FULL',
    [string]$Instancia = '.\SQLEXPRESS',
    [string]$BaseDatos = 'PRODUCTOS_APP',
    [string]$DirectorioBackup = 'C:\SQLBackups\PRODUCTOS_APP',
    [ValidateRange(1, 3650)]
    [int]$DiasRetencion = 14,
    [string]$DirectorioCopiaExterna = '\\192.168.106.79\sistemas_otros\Bckp_APP_PRODUCTOS',
    [ValidateRange(1, 3650)]
    [int]$DiasRetencionExterna = 30
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

if ($BaseDatos -notmatch '^[A-Za-z0-9_]+$') {
    throw 'El nombre de la base contiene caracteres no permitidos.'
}

$directorioCompleto = [System.IO.Path]::GetFullPath($DirectorioBackup)
New-Item -ItemType Directory -Path $directorioCompleto -Force | Out-Null

$directorioLogs = Join-Path $directorioCompleto 'logs'
New-Item -ItemType Directory -Path $directorioLogs -Force | Out-Null

$marcaTiempo = Get-Date -Format 'yyyyMMdd_HHmmss'
$nombreArchivo = '{0}_{1}_{2}.bak' -f $BaseDatos, $Tipo, $marcaTiempo
$rutaBackup = Join-Path $directorioCompleto $nombreArchivo
$rutaLog = Join-Path $directorioLogs ('backup_{0}.log' -f (Get-Date -Format 'yyyyMMdd'))

function Escribir-Registro {
    param([string]$Mensaje)
    $linea = '{0} {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Mensaje
    Add-Content -LiteralPath $rutaLog -Value $linea -Encoding UTF8
    Write-Host $linea
}

$baseSql = $BaseDatos.Replace(']', ']]')
$rutaSql = $rutaBackup.Replace("'", "''")
$opcionDiferencial = if ($Tipo -eq 'DIFF') { ', DIFFERENTIAL' } else { '' }
$consulta = @"
SET NOCOUNT ON;
BACKUP DATABASE [$baseSql]
TO DISK = N'$rutaSql'
WITH INIT, CHECKSUM$opcionDiferencial, STATS = 10;
RESTORE VERIFYONLY
FROM DISK = N'$rutaSql'
WITH CHECKSUM;
"@

try {
    Escribir-Registro "Inicio backup $Tipo de $BaseDatos en $rutaBackup"

    $salida = & sqlcmd `
        -S $Instancia `
        -d master `
        -E `
        -C `
        -b `
        -Q $consulta 2>&1
    $codigoSalida = $LASTEXITCODE

    foreach ($lineaSalida in $salida) {
        Add-Content -LiteralPath $rutaLog -Value ([string]$lineaSalida) -Encoding UTF8
    }

    if ($codigoSalida -ne 0) {
        throw "sqlcmd finalizó con código $codigoSalida. Revise $rutaLog."
    }
    if (-not (Test-Path -LiteralPath $rutaBackup -PathType Leaf)) {
        throw 'SQL Server informó éxito, pero no se encontró el archivo generado.'
    }

    $archivo = Get-Item -LiteralPath $rutaBackup
    if ($archivo.Length -le 0) {
        throw 'El archivo de backup fue generado vacío.'
    }

    if (-not (Test-Path -LiteralPath $DirectorioCopiaExterna -PathType Container)) {
        throw "No se puede acceder al directorio externo: $DirectorioCopiaExterna"
    }

    $rutaExterna = Join-Path $DirectorioCopiaExterna $nombreArchivo
    Copy-Item -LiteralPath $rutaBackup -Destination $rutaExterna -Force
    $archivoExterno = Get-Item -LiteralPath $rutaExterna
    if ($archivoExterno.Length -ne $archivo.Length) {
        throw "La copia externa no coincide en tamaño con el backup local: $rutaExterna"
    }
    Escribir-Registro "Copia externa verificada en $rutaExterna"

    $limite = (Get-Date).AddDays(-$DiasRetencion)
    $eliminados = 0
    Get-ChildItem -LiteralPath $directorioCompleto -File -Filter ("{0}_*.bak" -f $BaseDatos) |
        Where-Object { $_.LastWriteTime -lt $limite } |
        ForEach-Object {
            Remove-Item -LiteralPath $_.FullName -Force
            $eliminados += 1
        }

    $limiteExterno = (Get-Date).AddDays(-$DiasRetencionExterna)
    $eliminadosExternos = 0
    Get-ChildItem -LiteralPath $DirectorioCopiaExterna -File -Filter ("{0}_*.bak" -f $BaseDatos) |
        Where-Object { $_.LastWriteTime -lt $limiteExterno } |
        ForEach-Object {
            Remove-Item -LiteralPath $_.FullName -Force
            $eliminadosExternos += 1
        }

    $tamanoMb = [Math]::Round($archivo.Length / 1MB, 2)
    Escribir-Registro (
        "Backup verificado correctamente. Tamaño: $tamanoMb MB. " +
        "Backups locales vencidos eliminados: $eliminados. " +
        "Backups externos vencidos eliminados: $eliminadosExternos."
    )
    exit 0
}
catch {
    Escribir-Registro "ERROR: $($_.Exception.Message)"
    exit 1
}
