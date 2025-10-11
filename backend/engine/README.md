# Lap Time Simulation Engine

A high-fidelity physics-based racing simulator that calculates optimal lap times using real vehicle dynamics. Think of it as answering the question: "What's the absolute fastest lap possible for this car on this track?" - but with actual physics, not just guessing.

---

## What Is This?

This is a C++ simulation engine that takes a race car's specifications (mass, power, aerodynamics, tires, etc.) and a race track layout, then figures out the fastest possible lap time. It doesn't just slap some numbers together - it actually simulates the physics of driving: how hard you can accelerate, when you need to brake, how fast you can take corners without spinning out, gear changes, weight transfer, the whole deal.

**What you get:**
- Predicted lap time (accurate to within a few seconds of real world times)
- Full telemetry data: speed, acceleration, G-forces, throttle/brake inputs, gear, RPM - every meter around the track
- CSV output you can graph and analyze
- Realistic physics that respects the laws of nature

**What makes it different from just "car goes vroom":**
- It knows a Formula 1 car can't magically go from 0 to 300 km/h instantly (looking at you, early simulation attempts 😭)
- It understands you can't brake and turn at full force simultaneously (friction circle limits)
- It accounts for aerodynamic downforce increasing with speed
- It simulates proper gear changes based on engine power curves
- It respects the fact that tires have limits

---

## The Problem This Solves

Race teams spend millions on simulators. Engineers need to know: "If we add more downforce, will it make us faster?" or "What's the theoretical best lap time here?" 

This engine lets you answer those questions without building a million-dollar sim rig. Just feed it car data and a track, and it'll tell you what physics says is possible.

---

## Quick Start

### Windows:
```bash
# 1. Build it
build.bat

# 2. Run it
.\build\lap_sim.exe examples\montreal.csv examples\f1_2025.json

# 3. Check your results
dir outputs\
```

### Linux/Ubuntu:
```bash
# 1. Build it
chmod +x build.sh
./build.sh

# 2. Run it
./build/lap_sim examples/montreal.csv examples/f1_2025.json

# 3. Check your results
ls -lh outputs/
```

**Output:** `outputs/F1_2025-montreal-1_17-VSIM.csv`

Open it in Excel/Python/whatever and you've got every data point from the entire lap.

---

## Acknowledgments & Inspiration

### A Huge Thanks to TUM Fast Technology Munich (TUMFTM)

This project wouldn't exist without the incredible work done by the TUM Fast Technology Munich team. Seriously, these folks are legends.

**What I learned from them:**

The entire foundation of this simulation comes from studying TUMFTM's research and implementations:

1. **The Quasi-Steady-State Algorithm**
   - Their approach breaks lap time optimization into three passes: cornering limits, acceleration limits, and braking limits, then combines them
   - This is brilliant because it turns a massively complex problem into something solvable
   - I learned this from their [laptime-simulation](https://github.com/TUMFTM/laptime-simulation) repository

2. **The GGV Diagram Approach** 
   - Pre-computing what accelerations are possible at different speeds and lateral G-forces
   - This makes the simulation fast and physically accurate
   - From their [global_racetrajectory_optimization](https://github.com/TUMFTM/global_racetrajectory_optimization) work

3. **Track Data Format**
   - Their standardized CSV format for tracks (centerline coordinates + track widths)
   - Makes it possible to simulate any track without reinventing the wheel
   - From the [racetrack-database](https://github.com/TUMFTM/racetrack-database)

4. **The YouTube Video**
   - The [explanation video](https://www.youtube.com/watch?v=bZEjFkiK00s) you showed me was super helpful in understanding how all these pieces fit together
   - Seeing the algorithm visualized made everything click

**Their academic papers:**
- **Christ, F., Wischnewski, A., Heilmeier, A., & Lohmann, B.** (2019). "Time-Optimal Trajectory Planning for a Race Car Considering Variable Tyre-Road Friction Coefficients." *Vehicle System Dynamics*, 59(4), 588-612.  
  [https://doi.org/10.1080/00423114.2019.1704804](https://doi.org/10.1080/00423114.2019.1704804)

- **Heilmeier, A., Graf, M., & Lienkamp, M.** (2018). "A Race Simulation for Strategy Decisions in Circuit Motorsports." *2018 21st International Conference on Intelligent Transportation Systems (ITSC)*.  
  [https://doi.org/10.1109/itsc.2018.8570012](https://doi.org/10.1109/itsc.2018.8570012)

- **Heilmeier, A., Graf, M., Betz, J., & Lienkamp, M.** (2020). "Application of Monte Carlo Methods to Consider Probabilistic Effects in a Race Simulation for Circuit Motorsport." *Applied Sciences*, 10(12), 4229.  
  [https://doi.org/10.3390/app10124229](https://doi.org/10.3390/app10124229)

**Big thanks to TUMFTM for:**
- Publishing their research openly
- Maintaining excellent documentation
- Creating the track database
- Making motorsport simulation accessible to everyone

Their Python codebase is fantastic. I learned the concepts from their work, then built my own C++ implementation from scratch. All the code here is original, but the fundamental ideas came from their research.

---

## How It Works (The Science Bit)

Alright, let's get into the nerdy stuff. How does this thing actually predict lap times?

### The Core Problem

Imagine you're a race car. At any point on a track, you can only do so much. Your tires have a limit - they can only provide so much grip. If you're turning hard (lateral force), you can't also accelerate hard (longitudinal force), or you'll exceed the friction limit and spin out.

This is called the **friction circle** (or friction ellipse if we're being fancy). It's why you can't be 100% on the brakes while turning at full lock - the tires would give up.

So the question becomes: **Given the car's capabilities and the track's layout, what's the fastest way around?**

### The Quasi-Steady-State Approach

Instead of simulating every millisecond of the lap (which would be insanely complex), we use a "quasi-steady-state" method. Here's the idea:

**1. Divide the track into small segments** (~1 meter each)

**2. For each segment, calculate three velocity limits:**

**A) Cornering Limit** - How fast can you go through this corner?
   - Based on curvature of the track
   - More curvature = tighter corner = slower speed
   - Formula: `v_corner = sqrt((tire_grip × total_vertical_load) / (mass × curvature))`
   - Vertical load includes both weight and aerodynamic downforce (which increases with speed, so this becomes a quadratic equation)

**B) Acceleration Limit** - How fast can you be going after accelerating from the previous point?
   - Start from the beginning of the track
   - At each point, ask: "How hard can I accelerate?"
   - Use the GGV diagram to get max acceleration for current speed and lateral G
   - Integrate forward: `v² = v_previous² + 2 × a_max × distance`

**C) Braking Limit** - How fast can you be going if you need to brake for the next corner?
   - Start from the end of the track
   - Work backwards: "If I need to be going X speed at the next point, what's the max speed I can be going here?"
   - Integrate backward: `v² = v_next² - 2 × a_brake × distance`

**3. Combine them:**
   - At each point, your actual speed is the **minimum** of all three limits
   - `v_optimal = min(v_corner, v_accel, v_brake)`

**4. Calculate lap time:**
   - Once you have optimal speed at each point: `lap_time = Σ(distance / velocity)`

**5. Iterate until it converges:**
   - The first pass isn't perfect because the limits affect each other
   - Run it multiple times until the lap time stops changing (usually converges in 3-7 iterations)

### The GGV Diagram

This is the secret sauce that makes it all work.

GGV stands for **G-G-V**: lateral G, longitudinal G, velocity.

Before starting the simulation, we pre-compute a big table:
- For every velocity from 0 to top speed (in 0.5 m/s steps)
- For every lateral acceleration from 0 to ~5g (in 1 m/s² steps)
- Calculate: "What's the maximum longitudinal acceleration (forward) possible?"
- And: "What's the maximum deceleration (braking) possible?"

**Why is this powerful?**
- At any point in the simulation, we just look up: "I'm going 75 m/s and pulling 2g lateral... what can I do longitudinally?"
- No need to solve complex physics equations on the fly
- Fast and accurate

**How it's calculated:**
1. Start with tire friction limit (considering load)
2. Subtract the lateral force being used for cornering
3. What's left is available for acceleration/braking
4. Account for engine power limits, drag, downforce
5. Return the max possible acceleration

### The Physics Models

The simulation includes these physics models:

**Aerodynamics:**
- Drag force: `F_drag = 0.5 × air_density × drag_coefficient × frontal_area × v²`
- Downforce: `F_downforce = 0.5 × air_density × lift_coefficient × reference_area × v²`
- Drag slows you down; downforce pushes you onto the track (more grip!)

**Tire Model:**
- Simplified Pacejka-style approach
- Friction circle: `sqrt(F_long² + F_lat²) ≤ μ × F_vertical`
- Load sensitivity: More load = more grip, but not proportionally (diminishing returns)
- Calculates available longitudinal vs lateral force

**Powertrain:**
- Engine torque curve: Torque at different RPMs (from input data)
- Gear ratios: 8-speed gearbox with final drive
- Calculates wheel force: `F_wheel = (engine_torque × gear_ratio × final_drive × efficiency) / tire_radius`
- RPM calculation: `RPM = (velocity / tire_radius) × gear_ratio × final_drive × 60 / (2π)`
- Optimal gear selection: Keeps engine between 70-90% of max RPM for best power

**Weight Transfer:**
- Longitudinal: Acceleration/braking shifts weight forward/backward
- Lateral: Cornering shifts weight to outside tires
- Affects how much grip each tire has
- Formula: `ΔF = (mass × acceleration × CoG_height) / wheelbase`

**Braking:**
- Maximum deceleration based on tire grip and weight distribution
- Brake force distribution between front/rear
- Limited by tire friction circle

### Why These Physics Matter

**Without proper physics:**
- Car would accelerate instantly to top speed (no engine power limits)
- Corners would be taken at impossible speeds (no friction limits)
- Braking distances would be random (no tire models)
- Results would be useless

**With proper physics:**
- Acceleration is limited by engine power AND tire grip
- Corner speeds respect friction circle limits
- Braking is realistic based on tire loads
- Results match real-world lap times (within a few seconds)

---

## Implementation Details

### Why C++?

**Performance:**
- Lap time simulation involves a LOT of calculations (thousands of points, multiple iterations, complex physics)
- C++ is fast. Like, really fast compared to interpreted languages
- Python would work, but C++ makes it snappy

**Control:**
- Direct memory management
- Efficient data structures (std::vector for velocity profiles)
- No garbage collection pauses

**Libraries:**
- Eigen: Fast linear algebra (vectors, matrices) - header-only, easy to use
- JsonCpp: Parse vehicle parameters from JSON files
- Standard library: Everything else

**Learning:**
- Wanted to build something real in C++
- Good practice for performance-critical code

Honestly, Python would've been easier for prototyping, but C++ makes the final product faster and taught me more.

### Project Architecture

The code is organized into clean modules:

**Data Layer** (`include/data/`, `src/data/`)
- `TrackData`: Stores track geometry (points, curvature, arc length)
- `VehicleParams`: All car parameters (mass, aero, tires, engine, gears)
- `SimulationState`: Single snapshot of car state (position, speed, forces, etc.)

**Physics Models** (`include/physics/`, `src/physics/`)
- `AerodynamicsModel`: Calculates drag and downforce
- `TireModel`: Calculates available tire forces
- `PowertrainModel`: Engine torque, gear selection, wheel force

**Solver** (`include/solver/`, `src/solver/`)
- `GGVGenerator`: Pre-computes the GGV diagram
- `QuasiSteadyStateSolver`: The main algorithm - runs the 3-pass optimization

**I/O** (`include/io/`, `src/io/`)
- `JSONParser`: Reads vehicle JSON and track CSV files
- `TelemetryLogger`: Writes results to CSV/JSON

**Main** (`src/main.cpp`)
- Command-line interface
- Ties everything together

**Build System** (`CMakeLists.txt`)
- CMake for cross-platform builds
- Links JsonCpp, sets up include paths

### How the Solver Actually Runs

When you run the simulation:

```cpp
1. Parse inputs (track CSV, vehicle JSON)
2. Preprocess track (calculate curvature, arc length, heading)
3. Validate vehicle parameters
4. Create solver with track + vehicle data
5. Generate GGV diagram (takes ~1 second)
6. Run quasi-steady-state solver:
   - Calculate cornering limit for all points
   - Initialize velocity profiles
   - Iterate:
     - Forward integration (acceleration)
     - Backward integration (braking)  
     - Combine profiles (take minimum)
     - Calculate lap time
     - Check convergence
   - Usually converges in 3-7 iterations
7. Generate detailed telemetry (speed, G-forces, gear, etc. at each point)
8. Export to CSV
9. Print summary
```

### Key Implementation Challenges (aka "Things That Made Me Go 😭")

**1. Initial Speed Too High**
- **Problem:** Simulation started at maximum cornering speed (like 300+ km/h instantly)
- **Solution:** Initialize at realistic 180 km/h and let the solver find the optimal speeds
- **Lesson:** Don't let math assumptions override physics reality

**2. RPM Out of Range**
- **Problem:** Calculated RPM was outside engine's operating range, so engine force = 0
- **Why:** Gear ratios were way off
- **Solution:** Fixed gear ratios to keep engine in 1,000-15,000 RPM range
- **Lesson:** Real cars have real constraints (who knew? 😭)

**3. Unrealistic Acceleration**
- **Problem:** GGV diagram was allowing 20g acceleration at high speeds
- **Solution:** Capped accelerations at realistic values (~5g acceleration, ~6g braking)
- **Lesson:** Just because the math says it's possible doesn't mean it's physically real

**4. Gear Selection Hunting**
- **Problem:** Gears were shifting up/down constantly (4→5→4→5)
- **Solution:** Changed strategy to "highest gear that keeps RPM above 70% of max"
- **Lesson:** Race drivers don't constantly shift; they stay in the power band

**5. Straight Line Detection**
- **Problem:** Tiny curvature values on straights were limiting speed
- **Solution:** Set threshold - if curvature < 0.002, treat as straight (v_corner = very high)
- **Lesson:** Real-world data is messy; you need thresholds

**6. Numerical Instability at Low Speeds**
- **Problem:** Division by near-zero velocities caused crazy numbers
- **Solution:** Set minimum velocity floor (never below 1 m/s in calculations)
- **Lesson:** Protect against edge cases

**7. Track Format Compatibility**
- **Problem:** Initial JSON track format lacked width data
- **Solution:** Implemented CSV parser for TUMFTM track format
- **Lesson:** Use established standards when they exist

### Claude's Role in This Project

Full transparency: I (the developer) used Claude AI to optimize and refine this project. Here's the real story:

**What I built:**
- Came up with the algorithm implementation approach
- Wrote the first working core of the simulation
- Implemented the fundamental physics models
- Created the initial data structures and solver logic

**What Claude helped with:**
- Code optimization (improving runtime performance, making it faster)
- Structure refinement (better organization, cleaner architecture)
- Logic debugging (especially gear shifting logic - that was tricky)
- Numerical stability (catching edge cases, preventing crashes)
- Documentation (writing this README)

**The workflow:**
- I'd implement a feature or fix, then ask Claude to optimize it
- Claude would suggest performance improvements, code restructuring
- I'd review, decide what made sense, implement the changes
- For complex bugs (like gear hunting), Claude helped debug the logic

**Credit where it's due:**
- **The core is mine** - algorithm, physics, initial implementation
- **Claude saved dozens of hours** on optimization and refinement
- Without Claude, this would've taken months instead of weeks
- But the fundamental work and decisions were mine

Think of it like having a senior developer review your code and suggest optimizations - except available 24/7. I built it, Claude helped me make it better and faster.

---

## Technical Specifications

### Input Files

**1. Vehicle Parameters (JSON)**

Example: `examples/f1_2025.json`

```json
{
  "name": "F1_2025",
  "mass": {
    "mass": 798.0,
    "cog_height": 0.3,
    "wheelbase": 3.6,
    "weight_distribution": 0.46
  },
  "aerodynamics": {
    "frontal_area": 1.5,
    "drag_coefficient": 0.7,
    "lift_coefficient": -3.0,
    "reference_area": 1.5
  },
  "tire": {
    "friction_coefficient": 1.6,
    "tire_radius": 0.33,
    "load_sensitivity": 1.2
  },
  "powertrain": {
    "max_power": 820000.0,
    "min_rpm": 1000,
    "max_rpm": 15000,
    "gear_ratios": [13.0, 10.2, 8.3, 6.8, 5.7, 4.9, 4.2, 3.7],
    "final_drive_ratio": 1.0,
    "drivetrain_efficiency": 0.95,
    "engine_torque_curve": {
      "1000": 200, "5000": 280, "8000": 320,
      "11000": 500, "13000": 550, "15000": 520
    }
  },
  "brakes": {
    "max_brake_force": 25000.0,
    "brake_distribution": 0.6
  }
}
```

**Key parameters:**
- Mass parameters: total mass, center of gravity height, wheelbase, weight distribution
- Aero: drag coefficient, downforce coefficient, areas
- Tires: friction coefficient (~1.6 for slicks), radius, load sensitivity
- Powertrain: max power, RPM range, gear ratios, torque curve (RPM → Nm)
- Brakes: max force, front/rear distribution

**2. Track Data (CSV - TUMFTM Format)**

Example: `examples/montreal.csv`

```csv
# x_m,y_m,w_tr_right_m,w_tr_left_m
0.123,-0.739,5.388,5.699
1.227,-5.613,5.352,5.669
2.331,-10.486,5.316,5.640
...
```

**Columns:**
- `x_m`: X coordinate of track centerline (meters)
- `y_m`: Y coordinate of track centerline (meters)
- `w_tr_right_m`: Distance from centerline to right track edge (meters)
- `w_tr_left_m`: Distance from centerline to left track edge (meters)

**The engine automatically calculates:**
- Arc length (distance along track)
- Curvature (1/radius for each point)
- Heading angle (direction of travel)

### Output Files

**Telemetry CSV:** `outputs/CarName-Track-LapTime-VSIM.csv`

Example: `outputs/F1_2025-montreal-1_17-VSIM.csv`

**Columns:**
```csv
time_s,distance_m,x_m,y_m,speed_mps,speed_kph,
ax_mps2,ay_mps2,ax_g,ay_g,throttle,brake,
steering,gear,rpm,engine_force_N,aero_drag_N,
aero_downforce_N,tire_force_long_N,tire_force_lat_N
```

**What you get:**
- Time: Cumulative lap time at each point
- Position: X, Y coordinates and distance along track
- Speed: In m/s and km/h
- Accelerations: Longitudinal (ax) and lateral (ay) in m/s² and g-forces
- Inputs: Throttle (0-1), brake (0-1), steering angle
- Powertrain: Current gear, engine RPM
- Forces: Engine force, drag, downforce, tire forces

**Every meter of the lap is logged** - so a 4.3 km track = ~4,300 data points!

---

## Setup & Installation

### Prerequisites

**C++ Compiler:**
- Windows: Visual Studio 2019+ (MSVC) or MinGW
- Linux: GCC 7+ or Clang 6+
- macOS: Xcode Command Line Tools

**CMake:**
- Version 3.15 or higher
- [Download CMake](https://cmake.org/download/)

**Libraries (automatically handled by CMake):**
- JsonCpp: JSON parsing
- Eigen3: Linear algebra (header-only)

### Building from Source

**Windows:**
```bash
# Clone the repo
git clone <your-repo-url>
cd maarMofsed

# Build
build.bat

# The executable will be in: build\lap_sim.exe
```

**Linux/macOS:**
```bash
# Clone the repo
git clone <your-repo-url>
cd maarMofsed

# Build
chmod +x build.sh
./build.sh

# The executable will be in: build/lap_sim
```

**Manual build (if scripts don't work):**
```bash
mkdir build
cd build
cmake ..
cmake --build .
```

### Project Structure

```
maarMofsed/
├── build.bat                    # Windows build script
├── build.sh                     # Linux/Mac build script
├── CMakeLists.txt              # CMake configuration
│
├── examples/                    # Input files
│   ├── f1_2025.json           # F1 car parameters
│   ├── montreal.csv           # Montreal GP track
│   └── Zandvoort.csv          # Zandvoort track
│
├── outputs/                     # Simulation results (auto-created)
│   └── *.csv                  # Telemetry files
│
├── include/                     # Header files
│   ├── data/                  # Data structures
│   │   ├── SimulationState.h
│   │   ├── TrackData.h
│   │   └── VehicleParams.h
│   ├── physics/               # Physics models
│   │   ├── AerodynamicsModel.h
│   │   ├── TireModel.h
│   │   └── PowertrainModel.h
│   ├── solver/                # Optimization solver
│   │   ├── GGVGenerator.h
│   │   └── QuasiSteadyStateSolver.h
│   ├── telemetry/             # Output system
│   │   └── TelemetryLogger.h
│   └── io/                    # File I/O
│       └── JSONParser.h
│
├── src/                         # Source files
│   ├── data/
│   ├── physics/
│   ├── solver/
│   ├── telemetry/
│   ├── io/
│   └── main.cpp               # Application entry point
│
├── README.md                    # This file
├── LICENSE                      # MIT License
├── NOTICE                       # Legal notices
└── ATTRIBUTION.md              # Licensing details
```

### Running Simulations

**Basic usage:**
```bash
# Windows
.\build\lap_sim.exe <track_file> <vehicle_file>

# Linux/Mac
./build/lap_sim <track_file> <vehicle_file>
```

**Examples:**
```bash
# Montreal with F1 car
.\build\lap_sim.exe examples\montreal.csv examples\f1_2025.json

# Zandvoort with F1 car
.\build\lap_sim.exe examples\Zandvoort.csv examples\f1_2025.json
```

**Advanced options:**
```bash
# Specify output file
.\build\lap_sim.exe examples\montreal.csv examples\f1_2025.json --csv custom_output.csv

# Adjust solver iterations
.\build\lap_sim.exe examples\montreal.csv examples\f1_2025.json --max-iter 20

# Change convergence tolerance
.\build\lap_sim.exe examples\montreal.csv examples\f1_2025.json --tolerance 0.0001
```

**Output:**
- Telemetry automatically saved to `outputs/` directory
- Filename format: `CarName-TrackName-LapTime-VSIM.csv`
- Console shows: lap time, iterations, convergence status

### Getting More Tracks

**TUM Racetrack Database** (Huge thanks to TUMFTM! 🙏)

Visit: [https://github.com/TUMFTM/racetrack-database](https://github.com/TUMFTM/racetrack-database)

**Available tracks:**
- Formula 1: Montreal, Spielberg, Hockenheim, etc.
- Formula E: Berlin, Monaco ePrix
- Other: Various racing circuits worldwide

**Download a track:**

**Option 1: Direct download**
1. Go to the track you want (e.g., `tracks/Berlin.csv`)
2. Click "Raw"
3. Right-click → Save As
4. Save to your `examples/` folder

**Option 2: Clone the whole database**
```bash
# Clone the database
git clone https://github.com/TUMFTM/racetrack-database.git

# Copy a track to your project
cp racetrack-database/tracks/Berlin.csv examples/

# Run simulation
.\build\lap_sim.exe examples\Berlin.csv examples\f1_2025.json
```

**Track format:**
The CSV files use this format:
```
# x_m,y_m,w_tr_right_m,w_tr_left_m
```
That's it! The engine handles the rest (curvature calculation, preprocessing, etc.)

**Big thanks again to TUMFTM** for maintaining this excellent database and making it freely available! It's incredibly useful for testing and makes this simulator way more fun to use.

---

## Understanding the Results

### Lap Time Accuracy

**What to expect:**
- Within 2-5 seconds of real-world times (pretty good!)
- Difference comes from simulation assumptions (centerline only, perfect driving, quasi-steady-state)

**Example: Montreal GP**
- Simulation: ~1:17
- Real F1 qualifying: ~1:13-1:15
- Gap is normal because:
  - Real drivers use optimal racing line (not centerline)
  - Real tracks have grip variations
  - Simulation doesn't optimize the path, just the speed

**This is actually correct behavior!** If we were optimizing the racing line too (finding the best path through corners), we'd get closer. But that's a different (more complex) problem.

### Telemetry Analysis

**Things to look for in the CSV:**

**Speed profile:**
- Where's top speed reached? (end of longest straight)
- How much do you slow for tight corners?
- Smooth acceleration out of corners?

**G-forces:**
- Lateral (ay): How hard are corners? (~3-5g for F1)
- Longitudinal (ax): Braking zones (~5-6g), acceleration (~3-5g)
- Combined: Should stay within friction limits

**Gear changes:**
- Upshifts on straights
- Downshifts before corners
- Should stay in power band (70-90% max RPM)

**Throttle/Brake:**
- 1.0 = full throttle/brake
- 0.0 = coast
- You'll see: brake → coast → throttle in corners

**RPM:**
- Should vary realistically (not stuck at one value)
- Drops with upshifts, jumps with downshifts
- Stays in 10,500-13,500 range for F1

### Common Questions

**Q: Why is my lap time slower than real F1?**
A: You're on the centerline, they're on the optimal racing line. Also: perfect conditions, perfect driving vs. reality.

**Q: Car hits unrealistic speeds (500+ km/h)?**
A: Check your vehicle JSON - probably drag coefficient too low or power too high.

**Q: Lap time is way too fast?**
A: Check tire friction coefficient - 1.6 is realistic for F1 slicks, higher is fantasy.

**Q: Gear stuck at one value?**
A: Check gear ratios - RPM might be out of range for the engine.

**Q: Speeds seem too low everywhere?**
A: Check power curve, gear ratios, or drag coefficient.

---

## Limitations & Future Improvements

### Current Limitations

**No racing line optimization:**
- Simulates centerline only
- Real drivers cut corners, use track width
- This is a lap time simulator, not a racing line optimizer (that's way more complex)

**Quasi-steady-state assumption:**
- Assumes car reaches equilibrium quickly
- Ignores transient dynamics (suspension oscillations, weight transfer delays)
- Good enough for lap time prediction, not for detailed handling simulation

**Simplified tire model:**
- Not full Pacejka Magic Formula
- No temperature effects
- No wear modeling
- Just friction circle with load sensitivity

**No weather/track conditions:**
- Assumes perfect grip everywhere
- No rain, no marbles, no temperature variations

**Fixed setup:**
- Can't adjust suspension, diff settings during sim
- Parameters are constant for entire lap

### Possible Future Improvements

**Racing line optimization:**
- Add path optimization to find the fastest line through corners
- Would require optimal control (way more complex solver)
- This is what TUMFTM's global_racetrajectory_optimization does

**Better tire model:**
- Full Pacejka MF implementation
- Temperature-dependent grip
- Tire wear over stint

**Dynamic simulation:**
- Full transient dynamics (not quasi-steady-state)
- Suspension modeling
- Better weight transfer

**Strategy simulation:**
- Fuel load effects
- Tire degradation
- Pit stop optimization

**Multi-car:**
- Traffic effects
- Slipstream/DRS
- Race strategy

But honestly? For lap time prediction, this works great as-is.

---

## Contributing

Found a bug? Have an idea? Want to add features?

**Feel free to:**
- Open issues
- Submit pull requests
- Suggest improvements
- Share your results

**Some ideas for contributors:**
- Add more vehicle examples (GT3, LMP1, Formula E)
- Improve telemetry visualization
- Better track preprocessing
- More physics models
- GUI frontend

---

## License

**GNU Lesser General Public License v3.0 (LGPL-3.0)**

See [LICENSE](LICENSE) file for full text.

**Why LGPL?**

This project uses LGPL-3.0 to maintain compatibility with TUMFTM's original research implementations, which are also licensed under LGPL-3.0. This respects their excellent work and ensures proper licensing alignment.

**What this means for you:**

✅ **You can:**
- Use this library in commercial, personal, or academic projects
- Modify the source code
- Distribute modified versions
- Link this library with proprietary software

⚠️ **You must:**
- Include the license and copyright notice
- State changes made to the code
- Release source code of modifications to this library (if distributed)
- Use LGPL-3.0 or compatible license for this library component

💡 **Note:** If you link this as a library, your main application can use any license. Only modifications to this library itself must remain LGPL.

**Credit where it's due:**

The algorithm and approach originated from TUMFTM's research. This implementation respects their LGPL licensing while providing an original C++ codebase.

**Built something cool with this?** Let me know at pouyabrn@yahoo.com - I'd love to hear about it!

---

## Final Thoughts

This project started as "I want to understand how lap time simulation works" and turned into a full physics engine. It's been a wild ride (pun intended) with plenty of "why is the car doing 500 km/h?! 😭" moments.

**What I learned:**
- Vehicle dynamics are fascinatingly complex
- Physics simulations are 90% debugging unrealistic behavior
- Real race engineers earn their money (this stuff is hard!)
- Claude AI is a ridiculously good coding partner
- Open source research (thanks TUMFTM!) makes learning accessible

**What you can do with this:**
- Learn about vehicle dynamics
- Predict lap times for car setups
- Understand race car performance
- Build something cooler on top of it
- Just have fun simulating cars going fast

If you use this for something cool, let me know! I'd love to hear about it.

Now go simulate some lap times! 🏁

---

## Academic References

### Primary Inspirations (TUMFTM Research):

**1. Christ, F., Wischnewski, A., Heilmeier, A., & Lohmann, B.** (2019).  
   "Time-Optimal Trajectory Planning for a Race Car Considering Variable Tyre-Road Friction Coefficients."  
   *Vehicle System Dynamics*, 59(4), 588-612.  
   DOI: [10.1080/00423114.2019.1704804](https://doi.org/10.1080/00423114.2019.1704804)

**2. Heilmeier, A., Graf, M., & Lienkamp, M.** (2018).  
   "A Race Simulation for Strategy Decisions in Circuit Motorsports."  
   *2018 21st International Conference on Intelligent Transportation Systems (ITSC)*.  
   DOI: [10.1109/itsc.2018.8570012](https://doi.org/10.1109/itsc.2018.8570012)

**3. Heilmeier, A., Graf, M., Betz, J., & Lienkamp, M.** (2020).  
   "Application of Monte Carlo Methods to Consider Probabilistic Effects in a Race Simulation for Circuit Motorsport."  
   *Applied Sciences*, 10(12), 4229.  
   DOI: [10.3390/app10124229](https://doi.org/10.3390/app10124229)

### Foundational Vehicle Dynamics Literature:

**4. Milliken, W. F., & Milliken, D. L.** (1995).  
   *Race Car Vehicle Dynamics*.  
   Society of Automotive Engineers (SAE International).  
   ISBN: 978-1560915263

**5. Pacejka, H. B.** (2012).  
   *Tire and Vehicle Dynamics* (3rd ed.).  
   Butterworth-Heinemann.  
   ISBN: 978-0080970165

### Additional Relevant Research:

**6. Betz, J., Zheng, H., Liniger, A., Rosolia, U., Karle, P., Behl, M., ... & Lohmann, B.** (2022).  
   "Autonomous Vehicles on the Edge: A Survey on Autonomous Vehicle Racing."  
   *IEEE Open Journal of Intelligent Transportation Systems*, 3, 458-488.  
   DOI: [10.1109/OJITS.2022.3181510](https://doi.org/10.1109/OJITS.2022.3181510)

**7. Kelly, D. P., & Sharp, R. S.** (2010).  
   "Time-Optimal Control of the Race Car: A Numerical Method to Emulate the Ideal Driver."  
   *Vehicle System Dynamics*, 48(12), 1461-1474.  
   DOI: [10.1080/00423110903514236](https://doi.org/10.1080/00423110903514236)

### TUMFTM Open-Source Repositories:

- **Lap Time Simulation:** [github.com/TUMFTM/laptime-simulation](https://github.com/TUMFTM/laptime-simulation)
- **Race Trajectory Optimization:** [github.com/TUMFTM/global_racetrajectory_optimization](https://github.com/TUMFTM/global_racetrajectory_optimization)
- **Racetrack Database:** [github.com/TUMFTM/racetrack-database](https://github.com/TUMFTM/racetrack-database)

---

## Further Reading

**Want to dive deeper into vehicle dynamics and lap time simulation?**

**Essential Books:**
- **Milliken, W. F., & Milliken, D. L.** - *Race Car Vehicle Dynamics* (SAE, 1995)  
  The definitive reference - everything about how race cars work
  
- **Pacejka, H. B.** - *Tire and Vehicle Dynamics* (Butterworth-Heinemann, 2012)  
  Deep dive into tire modeling and the Magic Formula

**Online Resources:**
- **TUMFTM GitHub Repositories** - Excellent Python implementations and documentation
- **Vehicle System Dynamics Journal** - Latest research in the field
- **SAE International Papers** - Technical papers on racing and vehicle dynamics

**Academic Papers:**
- See the Academic References section above for specific papers that inspired this project

---

## Contact

**Questions? Feedback? Built something cool with this?**

Feel free to reach out:  
📧 **pouyabrn@yahoo.com**

I'd love to hear about:
- How you're using the simulator
- Improvements or features you've added
- Results from your simulations
- Any bugs or issues you've found

**Happy simulating!** 🏎️
