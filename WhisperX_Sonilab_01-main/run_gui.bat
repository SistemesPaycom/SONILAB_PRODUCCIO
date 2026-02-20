@echo off
setlocal EnableExtensions

rem --- Raíz del proyecto (carpeta donde está este .bat) ---
set "ROOT=%~dp0"
pushd "%ROOT%" || (echo ERROR: No puedo entrar en "%ROOT%" & pause & exit /b 1)

rem --- Variables de entorno (solo para este proceso) ---
set "HUGGINGFACE_HUB_TOKEN=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"
set "PYTHONUTF8=1"

set "TORCH_FORCE_NO_WEIGHTS_ONLY_LOAD=1"

rem --- Rutas absolutas (evita problemas con rutas relativas / caracteres raros) ---
set "PYTHON=%ROOT%.venv\Scripts\python.exe"
set "GUI=%ROOT%src\gui.py"

echo ROOT: %ROOT%
echo PYTHON: %PYTHON%
echo GUI: %GUI%

if not exist "%PYTHON%" (
  echo ERROR: No existe "%PYTHON%"
  echo Ejecuta: py -3.11 -m venv .venv
  pause
  popd
  exit /b 1
)

if not exist "%GUI%" (
  echo ERROR: No existe "%GUI%"
  echo Carpeta actual: %CD%
  dir /b
  pause
  popd
  exit /b 1
)

"%PYTHON%" "%GUI%"
set "RC=%ERRORLEVEL%"

if not "%RC%"=="0" (
  echo.
  echo GUI terminó con código %RC%
)

pause
popd
endlocal
