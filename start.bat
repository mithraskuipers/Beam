@echo off
setlocal enabledelayedexpansion
title Beam
cd /d "%~dp0"

set VENV_DIR=%~dp0venv
set PY_CMD=

where py >nul 2>nul
if %errorlevel%==0 (
    set PY_CMD=py
) else (
    where python >nul 2>nul
    if !errorlevel!==0 (
        set PY_CMD=python
    )
)

if "%PY_CMD%"=="" (
    echo.
    echo   Python was not found on this computer.
    echo   Install it from https://www.python.org/downloads/ and make sure
    echo   "Add python.exe to PATH" is checked during setup, then run this
    echo   file again.
    echo.
    pause
    exit /b 1
)

if not exist "%VENV_DIR%\Scripts\python.exe" (
    echo Setting up Beam for the first time, this only happens once...
    %PY_CMD% -m venv "%VENV_DIR%"
    if not exist "%VENV_DIR%\Scripts\python.exe" (
        echo.
        echo   Could not create the virtual environment.
        echo.
        pause
        exit /b 1
    )
)

set VENV_PY=%VENV_DIR%\Scripts\python.exe

"%VENV_PY%" -m pip install --upgrade pip --quiet --disable-pip-version-check
"%VENV_PY%" -m pip install -r "%~dp0requirements.txt" --quiet --disable-pip-version-check
if errorlevel 1 (
    echo.
    echo   Installing the required packages failed. Check your internet
    echo   connection and try running this file again.
    echo.
    pause
    exit /b 1
)

echo.
echo Starting Beam...
echo   Closing this window stops the server.
echo.

start "" cmd /c "timeout /t 2 /nobreak >nul & start "" "http://localhost:5050/receive""

"%VENV_PY%" "%~dp0app.py"

echo.
echo Beam has stopped.
pause

endlocal
