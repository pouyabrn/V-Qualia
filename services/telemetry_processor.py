import pandas as pd

def segment_laps(df):
    """
    Split telemetry data into individual laps.
    A new lap starts when LapDistance resets to a lower value.
    """
    if 'LapDistance' not in df.columns:
        return [df]  # Return whole dataframe if no lap distance column
    
    laps = []
    current_lap = []
    last_distance = 0
    
    for idx, row in df.iterrows():
        current_distance = row['LapDistance']
        
        # If distance resets (new lap), save current lap and start new one
        if current_distance < last_distance and len(current_lap) > 0:
            laps.append(pd.DataFrame(current_lap))
            current_lap = []
        
        current_lap.append(row)
        last_distance = current_distance
    
    # Don't forget the last lap
    if current_lap:
        laps.append(pd.DataFrame(current_lap))
    
    return laps
