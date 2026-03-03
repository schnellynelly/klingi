@echo off
REM Klingi Backend Startup Script for Windows

echo.
echo ===============================================
echo     Klingi Smart Doorbell System
echo ===============================================
echo.

REM Check if running in virtual environment
if "%VIRTUAL_ENV%"=="" (
    echo [WARN] Virtual environment not activated
    echo Activating venv...
    
    if exist "venv\" (
        call venv\Scripts\activate.bat
        echo [OK] Virtual environment activated
    ) else (
        echo [ERROR] Virtual environment not found
        echo Creating virtual environment...
        python -m venv venv
        call venv\Scripts\activate.bat
        echo [OK] Virtual environment created
        
        echo Installing dependencies...
        pip install -r requirements.txt
        echo [OK] Dependencies installed
    )
)

REM Check if dependencies are installed
echo Checking dependencies...
python -c "import fastapi, cv2, numpy, pydantic" 2>nul
if errorlevel 1 (
    echo Installing missing dependencies...
    pip install -r requirements.txt
    echo [OK] Dependencies installed
)

REM Start the server
echo.
echo Starting Klingi backend server...
echo Server will run on: http://0.0.0.0:8000
echo Access from local machine: http://localhost:8000
echo Access from network: http://^<YOUR_IP^>:8000
echo.
echo Press Ctrl+C to stop
echo.

cd backend
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
pause
