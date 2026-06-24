#!/usr/bin/env bash
set -e

echo "DevLaunch - Setup"
echo

if ! command -v node &>/dev/null; then
  echo "ERROR: Node.js is not installed. Please download it from https://nodejs.org"
  exit 1
fi

echo "Node.js $(node --version) found."
echo
echo "Installing dependencies..."
npm install
echo
echo "Launching DevLaunch..."
npm start
