#!/usr/bin/env bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}=========================================${NC}"
echo -e "${CYAN}     Unturned Mods CLI Installer         ${NC}"
echo -e "${CYAN}=========================================${NC}"

# 1. Check if Bun is installed
if ! command -v bun &> /dev/null; then
    echo -e "${RED}[Error] Bun is not installed or not in your PATH.${NC}"
    echo -e "${YELLOW}Unturned Mods CLI requires Bun (a fast JavaScript/TypeScript runtime).${NC}"
    echo -e "${YELLOW}To install Bun, run the following command:${NC}"
    echo -e "    ${CYAN}curl -fsSL https://bun.sh/install | bash${NC}"
    echo -e "${YELLOW}After installing Bun, please restart your terminal and run this installer again.${NC}"
    exit 1
fi

echo -e "${GREEN}[1/3] Bun detected: $(command -v bun)${NC}"

# 2. Install dependencies
echo -e "${GREEN}[2/3] Installing dependencies...${NC}"
bun install

# 3. Compile binary
echo -e "${GREEN}[3/3] Compiling standalone executable...${NC}"
binary_name="utmod"
bun build --compile ./src/index.ts --outfile ./$binary_name

if [ ! -f "./$binary_name" ]; then
    echo -e "${RED}[Error] Compilation failed! No executable was created.${NC}"
    exit 1
fi

# 4. Install to global PATH
bun_bin_dir="$HOME/.bun/bin"
mkdir -p "$bun_bin_dir"

dest_path="$bun_bin_dir/$binary_name"
echo -e "${GREEN}Installing $binary_name to $dest_path...${NC}"
cp "./$binary_name" "$dest_path"
chmod +x "$dest_path"

# Clean up local build output
rm "./$binary_name"

# Ensure PATH has the directory
if [[ ":$PATH:" != *":$bun_bin_dir:"* ]]; then
    echo -e "${YELLOW}Warning: $bun_bin_dir is not in your PATH.${NC}"
    echo -e "${YELLOW}To add it, append the following line to your shell profile (~/.bashrc, ~/.zshrc, or ~/.profile):${NC}"
    echo -e "    ${CYAN}export PATH=\"\$HOME/.bun/bin:\$PATH\"${NC}"
    echo -e "${YELLOW}Then, run 'source <profile_file>' to apply the change.${NC}"
else
    echo -e "${GREEN}Path $bun_bin_dir is already in your PATH.${NC}"
fi

echo -e "\n${GREEN}=== Installation Complete! ===${NC}"
echo -e "You can now run the CLI using: ${CYAN}utmod${NC}"
echo -e "Try running: ${CYAN}utmod --help${NC}"
