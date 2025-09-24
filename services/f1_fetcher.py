import fastf1
import pandas as pd

# Enable caching to avoid re-downloading data
fastf1.Cache.enable_cache('f1_cache')

def get_f1_lap_telemetry(year, race, driver_code):
    """
    Get the fastest lap telemetry for a specific driver in a race.
    Returns the telemetry data as a pandas DataFrame.
    """
    try:
        # Load the session
        session = fastf1.get_session(year, race, 'R')  # Race session
        session.load()
        
        # Get the driver's fastest lap
        driver_laps = session.laps.pick_driver(driver_code)
        fastest_lap = driver_laps.pick_fastest()
        
        # Get telemetry for that lap
        telemetry = fastest_lap.get_telemetry()
        
        return telemetry
    
    except Exception as e:
        print(f"Error fetching F1 data: {e}")
        return pd.DataFrame()  # Return empty dataframe on error
