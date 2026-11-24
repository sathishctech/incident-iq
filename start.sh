#!/bin/bash
# Start script for Service Incident Review Dashboard
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

echo "=========================================================="
echo " Starting IncidentIQ — Service Incident Review"
echo " Directory: $DIR"
echo " Data file: $DIR/data/incidents.tsv"
echo "=========================================================="

# Check Python 3
if command -v python3 &>/dev/null; then
    python3 serve.py --open
elif command -v python &>/dev/null; then
    python serve.py --open
else
    echo "Python not detected. Opening index.html directly in your default browser..."
    open index.html || xdg-open index.html
fi
