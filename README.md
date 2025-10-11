# V-Qualia 

> Professional telemetry analysis platform for racing data

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
- `/api/predictions` - Lap simulation results
- Auto-generated docs at `/docs` (Swagger UI)

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
uvicorn main:app --reload --port 8000
```

API available at `http://localhost:8000`
Interactive docs at `http://localhost:8000/docs`

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

