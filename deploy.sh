#!/bin/bash

# V-Qualia Deployment Script
# Supports both traditional deployment and Docker deployment

set -e

echo "========================================"
echo "  V-Qualia Deployment Script"
echo "========================================"

# Check if Docker is available
if command -v docker &> /dev/null && command -v docker-compose &> /dev/null; then
    echo "🐳 Docker detected. Using Docker deployment..."
    DEPLOY_MODE="docker"
else
    echo "🐍 Using traditional Python deployment..."
    DEPLOY_MODE="traditional"
fi

if [ "$DEPLOY_MODE" = "docker" ]; then
    echo "Starting Docker deployment..."

    # Check if docker-compose.yml exists
    if [ ! -f "docker-compose.yml" ]; then
        echo "❌ docker-compose.yml not found!"
        exit 1
    fi

    # Stop any existing containers
    echo "Stopping existing containers..."
    docker-compose down || true

    # Build and start services
    echo "Building and starting services..."
    docker-compose up --build -d

    # Wait for services to be healthy
    echo "Waiting for services to start..."
    sleep 30

    # Check service status
    echo "Service status:"
    docker-compose ps

    echo ""
    echo "✅ Docker deployment completed!"
    echo "🌐 Frontend: http://localhost:3000"
    echo "🔌 Backend API: http://localhost:8000"
    echo "📚 API Docs: http://localhost:8000/docs"
    echo ""
    echo "To view logs: docker-compose logs -f"
    echo "To stop: docker-compose down"

elif [ "$DEPLOY_MODE" = "traditional" ]; then
    echo "Starting traditional Python deployment..."

    # Update system packages
    sudo apt update && sudo apt upgrade -y

    # Install Python 3 and pip if not already installed
    sudo apt install python3 python3-pip python3-venv -y

    # Install Node.js for frontend (if deploying full stack)
    if [ -d "frontend" ]; then
        echo "Installing Node.js for frontend..."
        curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
        sudo apt-get install -y nodejs
    fi

    # Install C++ build dependencies for engine
    echo "Installing C++ build dependencies..."
    sudo apt install cmake build-essential pkg-config libjsoncpp-dev -y

    # Deploy backend
    if [ -d "backend" ]; then
        echo "Deploying backend..."
        cd backend

        # Create virtual environment
        python3 -m venv venv
        source venv/bin/activate

        # Install dependencies
        pip install -r requirements.txt

        # Build the C++ engine
        echo "Building C++ engine..."
        cd engine
        mkdir -p build
        cd build
        cmake ..
        make -j$(nproc)
        cd ../..

        # Create .env file if it doesn't exist
        if [ ! -f .env ]; then
            echo "Creating .env file from template..."
            cp ../env.example .env 2>/dev/null || echo "API_KEY=ididntwriteauthsystemyetLOL" > .env
            echo "Please edit .env file with your actual API key and configuration"
        fi

        # Set up systemd service
        echo "Setting up systemd service..."
        sudo tee /etc/systemd/system/vqualia-backend.service > /dev/null <<EOF
[Unit]
Description=V-Qualia Backend API Server
After=network.target

[Service]
Type=exec
User=$USER
WorkingDirectory=$(pwd)
Environment=PATH=$(pwd)/venv/bin
ExecStart=$(pwd)/venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000
Restart=always

[Install]
WantedBy=multi-user.target
EOF

        # Enable and start the service
        sudo systemctl daemon-reload
        sudo systemctl enable vqualia-backend
        sudo systemctl start vqualia-backend

        cd ..
    fi

    # Deploy frontend (optional)
    if [ -d "frontend" ]; then
        echo "Deploying frontend..."
        cd frontend

        # Install dependencies and build
        npm install
        npm run build

        # Install nginx if not present
        sudo apt install nginx -y

        # Configure nginx
        sudo tee /etc/nginx/sites-available/vqualia-frontend > /dev/null <<EOF
server {
    listen 80;
    server_name localhost;
    root $(pwd)/dist;
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://localhost:8000/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

        # Enable site
        sudo ln -sf /etc/nginx/sites-available/vqualia-frontend /etc/nginx/sites-enabled/
        sudo nginx -t
        sudo systemctl reload nginx

        cd ..
    fi

    echo "✅ Traditional deployment completed!"
    echo "🌐 Frontend: http://localhost"
    echo "🔌 Backend API: http://localhost:8000"
    echo "📚 API Docs: http://localhost:8000/docs"
    echo ""
    echo "Backend service status: sudo systemctl status vqualia-backend"
    echo "Backend logs: sudo journalctl -u vqualia-backend -f"
    if [ -d "frontend" ]; then
        echo "Frontend nginx status: sudo systemctl status nginx"
    fi
fi

echo ""
echo "🎉 Deployment successful!"
echo "========================================"
