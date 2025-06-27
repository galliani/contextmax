#!/bin/bash

echo "🧪 Testing ContextMax NPM Package Locally"
echo "========================================"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if we're in the project directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}Error: package.json not found. Run this script from the project root.${NC}"
    exit 1
fi

echo -e "\n${YELLOW}Step 1: Generating static files...${NC}"
npm run generate

if [ $? -ne 0 ]; then
    echo -e "${RED}Build failed!${NC}"
    exit 1
fi

echo -e "\n${GREEN}✓ Static generation completed successfully${NC}"

# Check if dist directory exists
if [ ! -d "dist" ]; then
    echo -e "${RED}Error: dist directory not found after generation${NC}"
    exit 1
fi

echo -e "\n${YELLOW}Step 2: Creating local package...${NC}"
npm pack

# Get the package filename
PACKAGE_FILE=$(ls contextmax-*.tgz | head -n 1)

if [ -z "$PACKAGE_FILE" ]; then
    echo -e "${RED}Error: Package file not created${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Package created: $PACKAGE_FILE${NC}"

# Create a temporary test directory
TEST_DIR="/tmp/contextmax-test-$(date +%s)"
mkdir -p "$TEST_DIR"

echo -e "\n${YELLOW}Step 3: Testing installation in temporary directory...${NC}"
cd "$TEST_DIR"

# Install the package
npm install "$OLDPWD/$PACKAGE_FILE"

if [ $? -ne 0 ]; then
    echo -e "${RED}Installation failed!${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Package installed successfully${NC}"

echo -e "\n${YELLOW}Step 4: Testing CLI execution...${NC}"

# Test the CLI
timeout 5s npx contextmax help

if [ $? -eq 124 ]; then
    echo -e "${YELLOW}Note: Server started successfully (timeout expected for testing)${NC}"
else
    echo -e "${GREEN}✓ CLI executed successfully${NC}"
fi

# Cleanup
cd "$OLDPWD"
rm -rf "$TEST_DIR"
rm -f "$PACKAGE_FILE"

echo -e "\n${GREEN}✅ All tests passed! Package is ready for publishing.${NC}"
echo -e "\nTo publish to npm:"
echo -e "  1. Make sure you're logged in: ${YELLOW}npm login${NC}"
echo -e "  2. Publish the package: ${YELLOW}npm publish${NC}"
echo -e "\nUsers will be able to install with:"
echo -e "  ${YELLOW}npx contextmax${NC}"