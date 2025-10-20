# V-Qualia 

> Professional telemetry analysis platform for racing data

## What is this?

V-Qualia is a full-stack racing telemetry analysis and lap time prediction platform. You upload racing data (CSV), get beautiful charts, compare multiple laps, and predict optimal lap times using a proper physics engine.

**How it works:**
1. **Frontend** - React/Vite web app with all the fancy charts and UI stuff
2. **Backend** - FastAPI server handling data storage, file uploads, and API endpoints
3. **Physics Engine** - C++ simulation engine doing the actual lap time calculations (based on TUMFTM research)

The backend acts as a bridge between your browser and the physics engine. When you hit "predict", it packages your car setup and track data, fires up the C++ engine, waits for results, then sends back the optimal lap time and full telemetry.

Simple as that. Upload your data, visualize it, compare it, or simulate it.

---

## Backend 

The backend API was written from scratch, focusing on performance and simplicity. I chose **FastAPI** for its blazing-fast async capabilities and automatic API documentation. The core engine and API directory structure were all hand-coded, then **Claude AI** was used to create the frontend and connect everything together seamlessly.

### Tech Stack

**Framework:**
- **FastAPI** - Modern, high-performance Python web framework
- **Uvicorn** - Lightning-fast ASGI server
- **Python 3.10+** - Async/await support

**Data Processing:**
- **Pandas** - Data manipulation and CSV handling
- **NumPy** - Numerical computations
- **FastF1** - Formula 1 telemetry data parsing
- **Matplotlib** - Data visualization backend

**API Features:**
- RESTful endpoints with automatic validation
- CORS enabled for frontend communication
- File upload/download support (multipart)
- Simple authentication system (placeholder token)
- JSON-based vehicle and track storage

### Architecture

**Directories:**
- `backend/data/cars/` - Vehicle configuration files (JSON)
- `backend/data/tracks/` - Track data files (CSV)
- `backend/data/predictions/` - Simulation outputs (CSV)

**API Endpoints:**
- `/api/cars` - CRUD operations for vehicle configurations
- `/api/tracks` - Track management and upload
- `/api/predict` - Run lap time prediction (integrates C++ engine)
- `/api/predictions` - Access prediction results
- Auto-generated docs at `/docs` (Swagger UI)

### Prediction Engine

The lap time prediction is powered by a **C++ physics engine** located in `backend/engine/`. This engine uses:
- **Quasi-steady-state point mass model** with 3DOF dynamics
- **Pacejka tire model** for realistic grip simulation
- **Aerodynamic forces** (downforce & drag)
- **Load transfer** calculations
- **Powertrain model** with torque curves and gear ratios

**Python Wrapper (`backend/prediction_engine.py`):**

The Python wrapper handles all communication between the FastAPI backend and the C++ engine. It does the heavy lifting:

- **Engine Management** - Checks if the C++ binary is built, provides build instructions if missing
- **Data Preparation** - Converts car JSON and track CSV from the backend format to the engine's expected format
- **Process Execution** - Spawns the C++ executable as a subprocess, captures stdout/stderr for debugging
- **Result Parsing** - Extracts the optimal lap time from engine output (looks for "OPTIMAL LAP TIME: XX.XXX seconds")
- **File Handling** - Finds the generated telemetry CSV in `engine/outputs/`, copies it to `backend/data/predictions/` with a timestamped filename
- **Progress Tracking** - Enforces minimum 8-second prediction time for better UX (progress bar looks better)
- **Error Handling** - Catches missing files, build errors, unicode issues, and provides detailed error messages

The wrapper is designed to be fault-tolerant - case-insensitive file lookups, encoding error handling for Windows console output, and comprehensive logging for debugging.

**Building the Engine:**
```bash
cd backend/engine
# Windows:
build.bat
# Linux/Mac:
./build.sh
```

**C++ Requirements:**
- **CMake** 3.15 or higher
- **C++17 compatible compiler:**
  - Windows: MinGW-w64 (GCC) or MSVC
  - Linux: GCC 7+ or Clang 5+
  - macOS: Clang (Xcode Command Line Tools)
- **JsonCpp** library (auto-fetched by CMake)

For Windows with MSYS2:
```bash
pacman -S mingw-w64-x86_64-gcc mingw-w64-x86_64-cmake
```

The engine takes a vehicle JSON and track CSV, runs the simulation, and outputs:
- Optimal lap time
- Full telemetry CSV (speed, throttle, brake, gear, G-forces, etc.)

Predictions take a minimum of 8 seconds to complete, with progress tracking.

### Dependencies

```txt
fastapi>=0.100.0
uvicorn[standard]>=0.20.0
python-multipart>=0.0.6
python-dotenv>=1.0.0
requests>=2.28.0
fastf1>=3.6.0
matplotlib>=3.5.0
pandas>=1.3.0
numpy>=1.21.0
```

### Running the Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 10000
```

API available at `http://localhost:10000`
Interactive docs at `http://localhost:10000/docs`

---

## Frontend 

This frontend was completely **vibe-coded** by someone who doesn't know anything about frontend development. Thanks to the amazing communities at **shadcn/ui** and **React Bits** for the inspiration and components that made this possible!

### Tech Stack

**Core:**
- **React 18** - Modern UI library
- **Vite** - Lightning-fast build tool and dev server
- **Tailwind CSS** - Utility-first CSS framework

**Visualization:**
- **Recharts** - Composable charting library for React
- All the beautiful charts you see? Recharts magic 

**Data Processing:**
- **PapaParse** - CSV parsing (because telemetry = lots of CSVs)
- Custom downsampling algorithms for smooth performance with 10k+ data points

**Icons & UI:**
- **Lucide React** - Clean, consistent icon set
- Custom components inspired by shadcn/ui patterns
- **React Bits Threads Background** - That smooth animated background on the homepage

### Design Philosophy

**Minimal & Retro:**
- Windows 95 aesthetic (w95FA pixel font from CDN Fonts)
- Cyberpunk color palette (cyan #06b6d4, blue, purple, magenta)
- Dark theme everywhere because why not ?

**Performance First:**
- Data downsampling (10x for overview, 2x for detailed charts)
- Memoized calculations with `useMemo`
- No animations on real-time charts (60 FPS baby)
- Lazy loading and code splitting ready

**User Experience:**
- Toast notifications for all actions (custom utility)
- Loading skeletons (no blank screens)
- Error boundaries (crashes handled gracefully)
- Drag & drop file uploads
- Smooth animations (CSS-based, hardware accelerated)

### Key Features

**Pages:**
- **Home** - Threads-inspired animated landing page
- **Analyze** - Upload CSV, get 14+ interactive charts
- **Compare** - Multi-lap comparison (up to 10 CSVs with unique colors)
- **Predict** - Lap time prediction interface (ready for core engine)
- **Cars** - Visual vehicle configuration management
- **Tracks** - Visual track database
- **Live** - Real-time telemetry monitoring (standalone mode for performance)
- **Lap Replay** - Animated lap visualization with all telemetry overlays

**Technical Approaches:**

1. **CSV Parsing & Validation**
   - Multi-format support (FastF1, TUM, custom)
   - Auto-detects column names
   - File size limits (10MB)
   - Error handling per file

2. **State Management**
   - React hooks (`useState`, `useEffect`, `useMemo`, `useRef`)
   - LocalStorage for data persistence (lap replay viewer)
   - No Redux (kept it simple)

3. **Chart Rendering**
   - Responsive containers
   - Custom tooltips with dark theme
   - Color-coded datasets
   - Downsampled for performance

4. **Animations**
   - Custom CSS keyframes (fadeIn, slideUp, slideInRight, etc.)
   - Staggered animations with delays
   - Shimmer effects for loading states
   - Smooth transitions everywhere

5. **File Handling**
   - Drag & drop support
   - Batch processing
   - Progress feedback
   - Toast notifications

### Dependencies

**Production:**
```json
{
  "react": "^18.2.0",
  "react-dom": "^18.2.0",
  "recharts": "^2.10.3",
  "lucide-react": "^0.294.0",
  "papaparse": "^5.5.3"
}
```

**Development:**
```json
{
  "vite": "^5.0.8",
  "tailwindcss": "^3.3.6",
  "@vitejs/plugin-react": "^4.2.1",
  "autoprefixer": "^10.4.16",
  "postcss": "^8.4.32",
  "eslint": "^8.55.0"
}
```

### Dev Server

```bash
cd frontend
npm install
npm run dev
```

Runs on `http://localhost:3000` (or next available port)

### Build

```bash
npm run build
```

Outputs to `frontend/dist/` - ready for deployment

---

## ⚙️ Environment Variables

### Frontend Environment Variables

The frontend uses Vite environment variables for configuration:

```bash
# Create .env file in frontend directory
cd frontend
touch .env
```

**frontend/.env:**
```env
# Backend API URL
# Development (default):
VITE_API_URL=http://localhost:10000

# Production:
VITE_API_URL=https://your-production-api.com

# Docker (internal networking):
VITE_API_URL=http://backend:10000
```

### Backend Environment Variables

The backend uses standard environment variables:

```bash
# Copy from template
cp env.example .env

# Edit values
API_KEY=your-secure-api-key-here
HOST=0.0.0.0
PORT=10000
```

## 🐳 Docker Deployment

V-Qualia can be easily deployed using Docker and Docker Compose. This ensures consistent environments across different systems and simplifies the setup process.

### Prerequisites

- **Docker** 20.10+ installed ([Download](https://docker.com/get-started))
- **Docker Compose** 2.0+ installed
- At least 4GB of available RAM (recommended)

### Quick Start with Docker

1. **Clone the repository:**
   ```bash
   git clone https://github.com/pouyabrn/V-Qualia.git
   cd V-Qualia
   ```

2. **Start all services:**
   ```bash
   docker-compose up --build
   ```

3. **Access the application:**
   - **Frontend**: [http://localhost:3000](http://localhost:3000)
- **Backend API**: [http://localhost:10000](http://localhost:10000)
- **API Documentation**: [http://localhost:10000/docs](http://localhost:10000/docs)

### Docker Services

The `docker-compose.yml` includes three main services:

#### Frontend Service
- **Image**: Multi-stage Node.js build with Nginx
- **Port**: 3000 (maps to container port 80)
- **Features**:
  - Production-optimized React build
  - Nginx for static file serving
  - Automatic API proxy to backend service

#### Backend Service
- **Image**: Python 3.11 with C++ engine
- **Port**: 10000
- **Features**:
  - FastAPI server with automatic C++ engine compilation
  - Persistent data volumes for cars, tracks, and predictions
  - Health checks and automatic restarts
  - FastF1 cache persistence

#### Engine Service (Optional)
- **Image**: Standalone C++ engine for testing
- **Profile**: `engine-only` (run with `--profile engine-only`)
- **Usage**: For development and debugging the physics engine

### Data Persistence

The following directories are mounted as volumes for data persistence:

- `backend/data/cars/` - Vehicle configurations
- `backend/data/tracks/` - Race track data
- `backend/data/predictions/` - Simulation results
- `f1_cache/` - FastF1 telemetry cache

Your data will persist between container restarts.

### Development with Docker

#### Running in Development Mode

For development with hot reload:

```bash
# Build and start services
docker-compose up --build

# Or run in background
docker-compose up -d --build
```

#### Viewing Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend
```

#### Rebuilding After Changes

```bash
# Rebuild all services
docker-compose up --build --force-recreate

# Rebuild specific service
docker-compose up --build --force-recreate backend
```

#### Testing the C++ Engine Separately

```bash
# Run only the engine service
docker-compose --profile engine-only up engine

# Or run a quick test
docker-compose run --rm engine ./lap_sim --help
```

### Production Deployment

For production deployment:

1. **Use environment variables** for configuration
2. **Set up proper SSL/TLS** certificates
3. **Configure reverse proxy** (nginx/caddy/traefik)
4. **Set resource limits** in docker-compose.yml
5. **Use Docker secrets** for sensitive data

Example production docker-compose override:

```yaml
version: '3.8'
services:
  frontend:
    environment:
      - NODE_ENV=production
    deploy:
      resources:
        limits:
          memory: 256M
        reservations:
          memory: 128M

  backend:
    environment:
      - API_KEY=your_secure_production_key
    deploy:
      resources:
        limits:
          memory: 1G
        reservations:
          memory: 512M
```

### Troubleshooting Docker Issues

#### Build Failures

**Problem**: C++ compilation fails
```
error: 'jsoncpp/json/json.h' file not found
```
**Solution**: Ensure the container has internet access during build for apt-get

**Problem**: Python dependencies fail to install
```
ERROR: Could not find a version that satisfies the requirement
```
**Solution**: Check your internet connection and try again

#### Runtime Issues

**Problem**: Frontend shows "Network Error"
**Solution**: Ensure backend service is healthy:
```bash
docker-compose ps
docker-compose logs backend
```

**Problem**: Prediction endpoint returns 503 "Prediction Engine Not Built"
**Solution**: The C++ engine wasn't detected due to platform differences (.exe vs no extension). This has been fixed in the Docker build, but if you encounter this:
```bash
# Check if engine exists
docker-compose exec backend ls -la /app/engine/build/

# Rebuild backend if needed
docker-compose build --no-cache backend
docker-compose up -d backend
```

**Problem**: Engine executable not found in Docker
**Solution**: The code now automatically detects both `lap_sim` (Linux) and `lap_sim.exe` (Windows) executables. If issues persist, verify the build:
```bash
docker-compose exec backend find /app/engine -name "lap_sim*"
```

**Problem**: Out of memory during engine compilation
**Solution**: Increase Docker memory limit to 4GB+ in Docker Desktop settings

#### Data Persistence Issues

**Problem**: Data not persisting between restarts
**Solution**: Check volume mounts in docker-compose.yml and ensure directories exist on host

#### Performance Issues

**Problem**: Slow prediction times
**Solution**:
- Ensure sufficient CPU cores allocated to Docker
- Check that the engine compiled with optimizations
- Monitor resource usage: `docker stats`

### Docker Architecture Details

#### Multi-Stage Builds

**Frontend**: Node.js build stage → Nginx runtime stage
- Reduces final image size
- No Node.js runtime in production

**Backend**: Single stage with C++ compilation
- Python environment with compiled C++ binary
- All dependencies included for runtime

#### Security Considerations

- Non-root user execution where possible
- Minimal base images (Alpine, Slim variants)
- No sensitive data in images
- Proper dependency management

#### Networking

- Internal Docker network for service communication
- Proper CORS configuration between frontend and backend
- Health checks ensure service dependencies

### Advanced Docker Usage

#### Custom Build Arguments

```bash
# Build with specific Node.js version
docker-compose build --build-arg NODE_VERSION=18.17.0 frontend

# Build with different Python version
docker-compose build --build-arg PYTHON_VERSION=3.11 backend
```

#### Building Individual Services

```bash
# Build only frontend
docker-compose build frontend

# Build only backend
docker-compose build backend

# Build all
docker-compose build
```

#### Docker Development Workflow

1. **Make code changes**
2. **Rebuild affected services**: `docker-compose up --build <service>`
3. **Test changes**
4. **Commit and push**

This Docker setup provides a complete, production-ready deployment of V-Qualia with proper service orchestration, data persistence, and monitoring.

---

## Acknowledgments & References

### Prediction Engine Inspiration

The core lap time prediction engine was heavily inspired by the groundbreaking work from **TUM (Technical University of Munich) Motorsport** research team. Their open-source algorithms and trajectory optimization methods formed the foundation of our physics simulation:

- **[TUMFTM Global Race Trajectory Optimization](https://github.com/TUMFTM/global_racetrajectory_optimization)** - Minimum curvature and time-optimal trajectory planning algorithms
- **[TUMFTM Lap Time Simulation](https://github.com/TUMFTM/laptime-simulation)** - Quasi-steady-state point mass model with advanced vehicle dynamics

Huge shoutout to the TUMFTM team for their research publications and open-source contributions to the racing simulation community!

### Track Format

This project uses the **TUMFTM race track format** (CSV with x, y, w_tr_right, w_tr_left columns):

- **[TUMFTM Racetrack Database](https://github.com/TUMFTM/racetrack-database)** - Collection of real-world racing circuits in standardized format

### Prediction Engine Repository

The C++ lap time prediction engine is developed and maintained separately:

- **[V-Qualia Lap Prediction Engine](https://github.com/pouyabrn/LapPredictionEngine)** - Standalone C++ physics engine with CMake build system

---

