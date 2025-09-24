from fastapi import FastAPI, File, UploadFile
import pandas as pd
from services.telemetry_processor import segment_laps

# Make F1 import optional for now
try:
    from services.f1_fetcher import get_f1_lap_telemetry
    F1_AVAILABLE = True
except ImportError:
    F1_AVAILABLE = False
    print("F1 integration not available - install fastf1 to enable")

app = FastAPI()

# Store the last uploaded data in memory (simple approach for MVP)
last_uploaded_data = None

@app.get("/")
async def root():
    return {"status": "ok"}

@app.post("/upload")
async def upload_telemetry(file: UploadFile = File(...)):
    global last_uploaded_data
    
    # Read the uploaded CSV file
    contents = await file.read()
    
    # Create a temporary file-like object from the contents
    import io
    df = pd.read_csv(io.StringIO(contents.decode('utf-8')))
    
    # Store the data for later use
    last_uploaded_data = df
    
    return {
        "filename": file.filename,
        "rows": len(df),
        "columns": len(df.columns)
    }

@app.get("/api/laps/{lap_number}")
async def get_lap_data(lap_number: int):
    """Get telemetry data for a specific lap number."""
    global last_uploaded_data
    
    if last_uploaded_data is None:
        return {"error": "No data uploaded yet"}
    
    # Split into laps
    laps = segment_laps(last_uploaded_data)
    
    if lap_number < 1 or lap_number > len(laps):
        return {"error": f"Lap {lap_number} not found. Available laps: 1-{len(laps)}"}
    
    # Return the requested lap as JSON
    lap_data = laps[lap_number - 1]  # Convert to 0-based index
    return lap_data.to_dict('records')

@app.get("/api/f1/benchmark/{year}/{race}/{driver_code}")
async def get_f1_benchmark(year: int, race: str, driver_code: str):
    """Get F1 telemetry data for comparison."""
    if not F1_AVAILABLE:
        return {"error": "F1 integration not available - install fastf1"}
    
    telemetry = get_f1_lap_telemetry(year, race, driver_code)
    
    if telemetry.empty:
        return {"error": "Could not fetch F1 data"}
    
    return telemetry.to_dict('records')
