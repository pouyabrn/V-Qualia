# Gear Ratio Configuration Guide

## Understanding Gear Ratios

Gear ratios determine how engine power is transmitted to the wheels. The total gear ratio is:
```
Total Ratio = Gear Ratio × Final Drive Ratio
```

Higher ratios = More torque, lower top speed  
Lower ratios = Less torque, higher top speed

## How RPM is Calculated

```
RPM = (Velocity / Tire_Radius) × Gear_Ratio × Final_Drive × 60 / (2π)
```

**Example:** 200 km/h (55.56 m/s), tire radius 0.22m, gear ratio 3.0, final drive 3.5:
```
RPM = (55.56 / 0.22) × 3.0 × 3.5 × 60 / 6.283 = 10,050
```

## Gear Ratio Recommendations

### Formula 1 (High Power, High Speed)
```json
{
  "gear_ratios": [13.0, 10.2, 8.3, 6.8, 5.7, 4.9, 4.2, 3.7],
  "final_drive": 1.0,
  "max_rpm": 15000,
  "min_rpm": 5000,
  "tire_radius": 0.33
}
```
- **Characteristics:** 8 gears, wide speed range (180-360+ km/h)
- **Top speed:** ~360 km/h in 8th gear
- **Acceleration:** Strong in lower gears with high ratios

### Formula SAE (Medium Power, Autocross Focus)
```json
{
  "gear_ratios": [3.2, 2.5, 2.0, 1.7, 1.5],
  "final_drive": 3.8,
  "max_rpm": 12000,
  "min_rpm": 6000,
  "tire_radius": 0.22
}
```
- **Characteristics:** 5 gears, optimized for 0-160 km/h
- **Top speed:** ~160 km/h in 5th gear
- **Acceleration:** Tight ratios for quick acceleration in autocross

### GT3 / Endurance Racing
```json
{
  "gear_ratios": [11.5, 9.2, 7.5, 6.3, 5.4, 4.7, 4.1],
  "final_drive": 1.2,
  "max_rpm": 9000,
  "min_rpm": 3500,
  "tire_radius": 0.32
}
```
- **Characteristics:** 7 gears, balance of speed and efficiency
- **Top speed:** ~310 km/h
- **Fuel efficiency:** Optimized for long stints

### Hillclimb / Time Attack
```json
{
  "gear_ratios": [4.5, 3.5, 2.8, 2.3, 1.9, 1.6],
  "final_drive": 3.2,
  "max_rpm": 10500,
  "min_rpm": 4500,
  "tire_radius": 0.28
}
```
- **Characteristics:** 6 gears, focus on mid-range acceleration
- **Top speed:** ~250 km/h
- **Torque delivery:** Optimized for corner exits

## Common Issues and Solutions

### Issue 1: Car Stuck in Gear 1
**Symptoms:** All gears result in RPM > max_rpm at current speed

**Solution:** Your gear ratios are too high. Either:
1. Lower the gear ratios (divide by 2-3)
2. Increase final_drive (multiply by 0.5)
3. Increase tire_radius

**Example Fix:**
```json
// BEFORE (BROKEN)
"gear_ratios": [14.5, 11.8, 10.1, 8.9, 8.0],
"final_drive": 3.5,

// AFTER (FIXED)
"gear_ratios": [3.2, 2.5, 2.0, 1.7, 1.5],
"final_drive": 3.8,
```

### Issue 2: No Gear Changes
**Symptoms:** Vehicle stays in one gear the entire lap

**Solution:** Check if your speed range fits within one gear's RPM range:
1. Calculate RPM at min speed and max speed
2. If both are in min_rpm to max_rpm range, add more/different gears
3. Ensure gears are in descending order (1st = highest, top = lowest)

### Issue 3: RPM Always at Redline
**Symptoms:** RPM constantly at or above max_rpm

**Solution:** Your top gear ratio is too high:
1. Lower the top gear ratio
2. Check final_drive isn't too high

### Issue 4: Load Sensitivity Error
**Symptoms:** "Load sensitivity must be between 0.0 and 1.5"

**Solution:** Adjust tire load_sensitivity:
- Racing slicks: 0.80-0.95
- Road tires: 1.0-1.2
- Never exceed 1.5

## Calculating Gear Ratios from Scratch

### Step 1: Determine Speed Range
- **Min speed:** Slowest corner (~50-100 km/h for F1, ~40-70 km/h for FSAE)
- **Max speed:** Top speed on longest straight

### Step 2: Calculate Top Gear Ratio
```
Top_Gear_Ratio = (Max_RPM × Tire_Radius × 2π) / (Max_Speed × 60 × Final_Drive)
```

### Step 3: Calculate 1st Gear Ratio
```
First_Gear_Ratio = (Optimal_RPM × Tire_Radius × 2π) / (Min_Speed × 60 × Final_Drive)
```
Where Optimal_RPM = 0.75 × Max_RPM

### Step 4: Fill Intermediate Gears
Use geometric progression:
```
Ratio_i = First_Gear × (Top_Gear / First_Gear)^((i-1)/(n-1))
```
Where n = number of gears, i = gear number

### Example: FSAE Car
```
Max Speed = 160 km/h = 44.44 m/s
Min Speed = 60 km/h = 16.67 m/s
Tire Radius = 0.22 m
Max RPM = 12000
Final Drive = 3.8

Top Gear (5th):
  Ratio_5 = (12000 × 0.22 × 6.283) / (44.44 × 60 × 3.8) = 1.56 ≈ 1.5

1st Gear:
  Optimal_RPM = 12000 × 0.75 = 9000
  Ratio_1 = (9000 × 0.22 × 6.283) / (16.67 × 60 × 3.8) = 3.27 ≈ 3.2

Intermediate Gears (geometric):
  Ratio_2 = 3.2 × (1.5/3.2)^(1/4) = 2.5
  Ratio_3 = 3.2 × (1.5/3.2)^(2/4) = 2.0
  Ratio_4 = 3.2 × (1.5/3.2)^(3/4) = 1.7

Final: [3.2, 2.5, 2.0, 1.7, 1.5]
```

## Validation Checklist

✅ **Gear ratios in descending order** (1st highest, top lowest)  
✅ **RPM at max speed < max_rpm** (with safety margin)  
✅ **RPM at min speed > min_rpm** (in lowest appropriate gear)  
✅ **No huge gaps between gears** (typically 15-30% reduction per gear)  
✅ **Final drive makes sense** (typically 1.0-4.5)  
✅ **Tire radius is realistic** (0.20-0.35m for most race cars)

## Quick Reference: RPM at Speed

| Speed (km/h) | Gear Ratio | Final Drive | Tire Radius (m) | RPM   |
|--------------|------------|-------------|-----------------|-------|
| 100          | 3.0        | 3.5         | 0.22            | 9,084 |
| 150          | 3.0        | 3.5         | 0.22            | 13,626|
| 200          | 2.0        | 3.5         | 0.22            | 12,112|
| 250          | 1.5        | 3.5         | 0.22            | 11,355|
| 300          | 1.5        | 2.5         | 0.30            | 7,162 |
| 350          | 1.2        | 2.0         | 0.33            | 7,296 |

## Need Help?

If you're still having issues with gear ratios:
1. Check the telemetry CSV for actual RPM values
2. Verify your vehicle parameters (mass, power, aero)
3. Ensure track data is valid
4. Review the solver output for warnings

For questions: pouyabrn@yahoo.com

