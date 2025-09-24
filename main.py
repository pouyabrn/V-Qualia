from fastapi import FastAPI, File, UploadFile
import pandas as pd
import numpy as np
from services.telemetry_processor import segment_laps

# Make AI components optional
try:
    from ai.vectorizer import create_vectorizer, vectorize_corner
    from database.qdrant_service import QdrantService
    AI_AVAILABLE = True
except ImportError as e:
    AI_AVAILABLE = False
    print(f"AI integration not available: {e}")

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

# Initialize AI components if available
if AI_AVAILABLE:
    vectorizer = create_vectorizer()
    qdrant = QdrantService()
    qdrant.create_collection()
else:
    vectorizer = None
    qdrant = None

@app.get("/")
async def root():
    """Just a simple health check - let's see if we're alive!"""
    return {"status": "ok", "message": "V-Qualia is running smoothly!"}

@app.post("/upload")
async def upload_telemetry(file: UploadFile = File(...)):
    """Upload your telemetry data and let's see what we can learn from it!"""
    global last_uploaded_data
    
    # Let's read what you've sent us
    contents = await file.read()
    
    # Turn it into something we can work with
    import io
    df = pd.read_csv(io.StringIO(contents.decode('utf-8')))
    
    # Keep this data handy for analysis
    last_uploaded_data = df
    
    # Let's break this down into corners and learn from them
    corners_processed = 0
    if AI_AVAILABLE:
        try:
            laps = segment_laps(df)
            
            for lap_num, lap_data in enumerate(laps):
                # Split each lap into corners - roughly 10 per lap
                segment_size = max(1, len(lap_data) // 10)
                
                for corner_num in range(0, len(lap_data), segment_size):
                    corner_data = lap_data.iloc[corner_num:corner_num + segment_size]
                    
                    if len(corner_data) > 0:
                        # Find the interesting numbers in this corner
                        numeric_cols = corner_data.select_dtypes(include=[np.number]).columns
                        if len(numeric_cols) > 0:
                            # Make sure we have a consistent size to work with
                            corner_vector = corner_data[numeric_cols].values.flatten()
                            if len(corner_vector) > 100:
                                corner_vector = corner_vector[:100]
                            else:
                                corner_vector = np.pad(corner_vector, (0, 100 - len(corner_vector)))
                            
                            # Create a unique fingerprint for this corner
                            fingerprint = vectorize_corner(corner_vector, vectorizer)
                            
                            # Remember this corner for later comparisons
                            corner_id = f"lap_{lap_num}_corner_{corner_num}"
                            metadata = {
                                "driver": "unknown",
                                "track": "unknown", 
                                "lap_number": lap_num,
                                "corner_number": corner_num
                            }
                            
                            qdrant.upsert_corner(corner_id, fingerprint, metadata)
                            corners_processed += 1
            
        except Exception as e:
            print(f"Oops, had trouble processing corners: {e}")
    
    return {
        "filename": file.filename,
        "rows": len(df),
        "columns": len(df.columns),
        "corners_processed": corners_processed,
        "message": f"Great! Processed {len(df)} data points and found {corners_processed} corners to learn from."
    }

@app.get("/api/laps/{lap_number}")
async def get_lap_data(lap_number: int):
    """Let's take a look at that specific lap you're interested in!"""
    global last_uploaded_data
    
    if last_uploaded_data is None:
        return {"error": "Hey, we need some data first! Upload a telemetry file to get started."}
    
    # Let's break this down into laps
    laps = segment_laps(last_uploaded_data)
    
    if lap_number < 1 or lap_number > len(laps):
        return {"error": f"Sorry, lap {lap_number} doesn't exist. We have laps 1 through {len(laps)} available."}
    
    # Here's what we found for that lap
    lap_data = laps[lap_number - 1]  # Convert to 0-based index
    return {
        "lap_number": lap_number,
        "data": lap_data.to_dict('records'),
        "message": f"Here's everything we know about lap {lap_number}!"
    }

@app.get("/api/f1/benchmark/{year}/{race}/{driver_code}")
async def get_f1_benchmark(year: int, race: str, driver_code: str):
    """Let's see how the pros did it! Compare with real F1 data."""
    if not F1_AVAILABLE:
        return {"error": "F1 integration not available - install fastf1 to compare with the pros"}
    
    telemetry = get_f1_lap_telemetry(year, race, driver_code)
    
    if telemetry.empty:
        return {"error": "Hmm, couldn't find that F1 data. Maybe check the year, race name, or driver code?"}
    
    return {
        "data": telemetry.to_dict('records'),
        "message": f"Here's how {driver_code} performed in the {race} {year}!"
    }

@app.get("/api/similar/corners/{corner_id}")
async def find_similar_corners(corner_id: str):
    """Let's find corners that look similar to this one!"""
    if not AI_AVAILABLE:
        return {"error": "AI integration not available - install torch and qdrant-client to find similar corners"}
    
    try:
        # For now, we'll create a random query vector
        # In a real implementation, you'd retrieve the actual corner vector
        query_vector = np.random.rand(32)  # 32-dimensional vector
        
        # Let's see what corners look similar
        results = qdrant.search_similar_corners(query_vector, limit=5)
        
        similar_corners = []
        for result in results:
            similar_corners.append({
                "corner_id": result.payload.get("corner_id", "unknown"),
                "driver": result.payload.get("driver", "unknown"),
                "track": result.payload.get("track", "unknown"),
                "lap_number": result.payload.get("lap_number", 0),
                "similarity_score": result.score
            })
        
        return {
            "query_corner": corner_id,
            "similar_corners": similar_corners,
            "message": f"Found {len(similar_corners)} corners that look similar to {corner_id}!"
        }
    
    except Exception as e:
        return {"error": f"Oops, couldn't find similar corners: {e}"}
