#!/bin/bash

echo "Converting JSON to CSV..."
echo

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "Error: Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Run the conversion script
node convert_to_csv.js

echo
echo "Conversion complete!" 