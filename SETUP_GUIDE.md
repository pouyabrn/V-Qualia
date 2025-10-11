# V-Qualia Setup Guide

Complete guide to get V-Qualia running on your machine.

## 📋 Prerequisites

Before you begin, ensure you have:

- **Node.js** 18+ installed ([Download](https://nodejs.org/))
- **Python** 3.8+ installed ([Download](https://www.python.org/))
- **Git** installed ([Download](https://git-scm.com/))
- A code editor (VS Code recommended)

## 🚀 Installation Steps

### Step 1: Clone the Repository

```bash
git clone https://github.com/pouyabrn/V-Qualia.git
cd V-Qualia
```

### Step 2: Set Up the Frontend

Open a terminal in the project root:

```bash
cd frontend
npm install
```

Wait for all dependencies to install. This may take a few minutes.

### Step 3: Set Up the Backend

Open a **new terminal** in the project root:

#### Windows:
```powershell
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

#### Linux/Mac:
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### Step 4: Configure Environment Variables (Optional)

Create a `.env` file in the `backend` directory:

```env
API_KEY=your_secure_api_key_here
```

If you skip this step, the default API key will be `api_key`.

## ▶️ Running the Application

You need to run **both** the frontend and backend simultaneously.

### Terminal 1: Start the Frontend

```bash
cd frontend
npm run dev
```

You should see:
```
VITE v5.0.8  ready in XXX ms

➜  Local:   http://localhost:3000/
```

### Terminal 2: Start the Backend

#### Windows:
```powershell
cd backend
venv\Scripts\activate
python main.py
```

#### Linux/Mac:
```bash
cd backend
source venv/bin/activate
python main.py
```

You should see:
```
INFO:     Uvicorn running on http://0.0.0.0:8000
INFO:     Application startup complete.
```

## 🌐 Access the Application

Once both servers are running:

- **Frontend**: Open your browser to [http://localhost:3000](http://localhost:3000)
- **Backend API Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **Backend API**: [http://localhost:8000](http://localhost:8000)

## ✅ Verify Installation

### Test the Frontend

1. Navigate to [http://localhost:3000](http://localhost:3000)
2. You should see the V-Qualia home page with an animated background
3. Click "Analyze a Lap" - you should see the upload interface

### Test the Backend

1. Navigate to [http://localhost:8000/docs](http://localhost:8000/docs)
2. You should see the FastAPI Swagger documentation
3. Try the `/health` endpoint - it should return `{"status": "healthy"}`

### Test the Integration

The frontend and backend are currently **separate** - no integration yet. You'll implement the connection later.

## 🎨 Project Overview

### Frontend Structure

```
frontend/
├── src/
│   ├── components/    # React components
│   ├── utils/         # Helper functions
│   ├── styles/        # CSS files
│   └── App.jsx        # Main app
└── package.json
```

**Key Features:**
- ✅ Home page with animated background
- ✅ Telemetry analysis page (upload CSV)
- ✅ Lap time prediction interface
- ✅ Vehicle configuration management
- ✅ Track database management
- ✅ 15+ chart components

### Backend Structure

```
backend/
├── main.py            # FastAPI application
├── requirements.txt   # Python dependencies
└── .env              # Environment variables
```

**Key Features:**
- ✅ F1 telemetry data API (via FastF1)
- ✅ Session data retrieval
- ✅ Telemetry visualization generation
- ✅ API key authentication
- ✅ CORS enabled for frontend

## 🛠️ Development Workflow

### Making Changes to the Frontend

1. Edit files in `frontend/src/`
2. Vite will automatically reload the page
3. Check the browser console for errors

### Making Changes to the Backend

1. Edit `backend/main.py`
2. Uvicorn will automatically reload (hot-reload enabled)
3. Check the terminal for errors

## 📦 Building for Production

### Frontend

```bash
cd frontend
npm run build
```

Output will be in `frontend/dist/`

### Backend

The backend doesn't need a build step. For production:

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
```

## 🐛 Troubleshooting

### Frontend Issues

**Problem**: `npm install` fails
- **Solution**: Clear npm cache: `npm cache clean --force`

**Problem**: Port 3000 already in use
- **Solution**: Edit `frontend/vite.config.js` and change the port

**Problem**: Blank page after starting
- **Solution**: Check browser console for errors

### Backend Issues

**Problem**: `pip install` fails
- **Solution**: Upgrade pip: `python -m pip install --upgrade pip`

**Problem**: Port 8000 already in use
- **Solution**: Edit `backend/main.py` and change the port

**Problem**: FastF1 errors
- **Solution**: FastF1 is disabled by default (cache disabled). This is normal.

### Integration Issues

**Problem**: Frontend can't reach backend
- **Solution**: Ensure both servers are running
- **Solution**: Check CORS configuration in `backend/main.py`

## 📚 Next Steps

Now that you have everything set up:

1. **Explore the Frontend**: Navigate through all pages (Home, Analyze, Predict, Cars, Tracks)
2. **Test the Backend**: Use the Swagger UI at `/docs` to test API endpoints
3. **Upload Test Data**: Try uploading a CSV file to the Analyze page
4. **Configure Vehicles**: Create custom vehicle configurations in the Cars page
5. **Add Tracks**: Upload track data in the Tracks page

## 🎯 Future Integration Tasks

To connect the frontend and backend:

1. **API Service Layer**: Create `frontend/src/services/api.js`
2. **Real Simulation**: Connect prediction page to C++ engine (when ready)
3. **Database**: Add PostgreSQL for persistent storage
4. **Authentication**: Implement user login system

## 💡 Tips

- **Development**: Keep both terminals open side-by-side
- **Debugging**: Use browser DevTools for frontend, terminal logs for backend
- **Testing**: Use the Swagger UI to test backend endpoints before integrating
- **Hot Reload**: Both frontend and backend support hot reload - no need to restart

## 🆘 Getting Help

If you encounter issues:

1. Check the terminal logs for error messages
2. Check the browser console for frontend errors
3. Review the documentation in each directory's README
4. Check if all dependencies are installed correctly

## 📝 Summary

You now have:
- ✅ A fully functional React frontend with professional UI
- ✅ A FastAPI backend with F1 data integration
- ✅ Clean, organized, component-based architecture
- ✅ Hot reload for both frontend and backend
- ✅ Comprehensive documentation

**Everything is ready for development!**

---

Happy coding! 🚀


