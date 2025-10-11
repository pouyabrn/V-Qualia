# V-Qualia 🏎️

> Professional telemetry analysis platform for racing data

---

## Frontend 💻

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

```json
{
  "react": "^18.x",
  "react-dom": "^18.x",
  "vite": "^5.x",
  "tailwindcss": "^3.x",
  "recharts": "^2.x",
  "lucide-react": "latest",
  "papaparse": "^5.x"
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

