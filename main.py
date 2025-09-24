from fastapi import FastAPI, File, UploadFile
import pandas as pd

app = FastAPI()

@app.get("/")
async def root():
    return {"status": "ok"}

@app.post("/upload")
async def upload_telemetry(file: UploadFile = File(...)):
    # Read the uploaded CSV file
    contents = await file.read()
    
    # Create a temporary file-like object from the contents
    import io
    df = pd.read_csv(io.StringIO(contents.decode('utf-8')))
    
    return {
        "filename": file.filename,
        "rows": len(df),
        "columns": len(df.columns)
    }
