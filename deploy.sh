#!/bin/bash

# V-Qualia FastAPI Deployment Script for AWS Ubuntu Server

echo "Starting V-Qualia FastAPI deployment..."

# Update system packages
sudo apt update && sudo apt upgrade -y

# Install Python 3 and pip if not already installed
sudo apt install python3 python3-pip python3-venv -y

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "Creating .env file from template..."
    cp env.example .env
    echo "Please edit .env file with your actual API key and configuration"
fi

# Set up systemd service (optional)
echo "Setting up systemd service..."
sudo tee /etc/systemd/system/vqualia-api.service > /dev/null <<EOF
[Unit]
Description=V-Qualia FastAPI Server
After=network.target

[Service]
Type=exec
User=ubuntu
WorkingDirectory=$(pwd)
Environment=PATH=$(pwd)/venv/bin
ExecStart=$(pwd)/venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000
Restart=always

[Install]
WantedBy=multi-user.target
EOF

# Enable and start the service
sudo systemctl daemon-reload
sudo systemctl enable vqualia-api
sudo systemctl start vqualia-api

echo "Deployment completed!"
echo "API Documentation: http://your-server-ip:8000/docs"
echo "Health Check: http://your-server-ip:8000/health"
echo ""
echo "To check service status: sudo systemctl status vqualia-api"
echo "To view logs: sudo journalctl -u vqualia-api -f"
