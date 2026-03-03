#!/bin/bash
# Klingi Backend Startup Script

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}╔════════════════════════════════════╗${NC}"
echo -e "${GREEN}║     Klingi Smart Doorbell System    ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════╝${NC}"

# Check if running in virtual environment
if [ -z "$VIRTUAL_ENV" ]; then
    echo -e "${YELLOW}⚠️  Virtual environment not activated${NC}"
    echo -e "${YELLOW}Activating venv...${NC}"
    
    if [ -d "venv" ]; then
        source venv/bin/activate
        echo -e "${GREEN}✓ Virtual environment activated${NC}"
    else
        echo -e "${RED}✗ Virtual environment not found${NC}"
        echo -e "${YELLOW}Creating virtual environment...${NC}"
        python -m venv venv
        source venv/bin/activate
        echo -e "${GREEN}✓ Virtual environment created${NC}"
        
        echo -e "${YELLOW}Installing dependencies...${NC}"
        pip install -r requirements.txt
        echo -e "${GREEN}✓ Dependencies installed${NC}"
    fi
fi

# Check if dependencies are installed
echo -e "${YELLOW}Checking dependencies...${NC}"
python -c "import fastapi, cv2, numpy, pydantic" 2>/dev/null
if [ $? -ne 0 ]; then
    echo -e "${YELLOW}Installing missing dependencies...${NC}"
    pip install -r requirements.txt
    echo -e "${GREEN}✓ Dependencies installed${NC}"
fi

# Start the server
echo -e "${YELLOW}Starting Klingi backend server...${NC}"
echo -e "${YELLOW}Server will run on: ${GREEN}http://0.0.0.0:8000${NC}"
echo -e "${YELLOW}Access from local machine: ${GREEN}http://localhost:8000${NC}"
echo -e "${YELLOW}Access from network: ${GREEN}http://<YOUR_IP>:8000${NC}"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop${NC}"
echo ""

cd backend
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
