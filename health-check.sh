#!/bin/bash

# SynoBridge Universal Health Check
# This script verifies the build integrity of all three components.

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=======================================${NC}"
echo -e "${BLUE}   SynoBridge Global Health Check      ${NC}"
echo -e "${BLUE}=======================================${NC}"

# 1. Check Bridge Agent
echo -ne "📦 Checking Bridge Agent... "
cd bridge && go build ./... > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo -e "${GREEN}PASSED${NC}"
else
    echo -e "${RED}FAILED${NC}"
    FAIL=1
fi
cd ..

# 2. Check Backend
echo -ne "🖥️  Checking Backend...      "
cd backend && go build ./... > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo -e "${GREEN}PASSED${NC}"
else
    echo -e "${RED}FAILED${NC}"
    FAIL=1
fi
cd ..

# 3. Check Frontend (Syntax only for speed)
echo -ne "🎨 Checking Frontend...     "
cd frontend && npx tsc > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo -e "${GREEN}PASSED${NC}"
else
    echo -e "${RED}FAILED${NC}"
    FAIL=1
fi
cd ..

echo -e "${BLUE}=======================================${NC}"
if [ "$FAIL" == "1" ]; then
    echo -e "${RED}❌ System has build errors.${NC}"
    exit 1
else
    echo -e "${GREEN}✨ All systems healthy and buildable!${NC}"
    exit 0
fi
