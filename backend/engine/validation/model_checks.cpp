#include "io/JSONParser.h"
#include "physics/VehicleModel.h"
#include <algorithm>
#include <cmath>
#include <iostream>
#include <random>
#include <stdexcept>

using namespace LapTimeSim;

int main() {
    try {
        VehicleParams car;
        car.mass.mass = 1000;
        car.mass.cog_height = 3; // force wheel lift to exercise the load boundary
        car.mass.wheelbase = 1;
        car.mass.weight_distribution = 0.5;
        car.aero.Cl = car.aero.Cd = 0;
        car.tire.mu_x = car.tire.mu_y = car.tire.load_sensitivity = 1;
        car.powertrain.drive_type = DriveType::AWD;
        car.powertrain.gear_ratios = {3};
        car.powertrain.engine_torque_curve = {{1000, 500}, {15000, 500}};
        car.brake.ideal_bias = true;
        car.brake.max_brake_force = 1e6;
        VehicleModel model(car);
        ForceBreakdown f;
        const double accel = model.maxAcceleration(20, 0, {}, 1e6, 1, &f);
        if (std::abs(f.fz_front + f.fz_rear - car.mass.mass * VehicleParams::GRAVITY) > 1e-6 ||
            std::abs(accel - VehicleParams::GRAVITY) > 1e-6) {
            throw std::runtime_error("Wheel lift created normal load or excess traction");
        }
        const double decel = model.maxDeceleration(20, 0, {}, &f);
        if (std::abs(f.fz_front + f.fz_rear - car.mass.mass * VehicleParams::GRAVITY) > 1e-6 ||
            std::abs(decel - VehicleParams::GRAVITY) > 1e-6) {
            throw std::runtime_error("Wheel lift created normal load or excess braking");
        }
        auto fsae = JSONParser::parseVehicleJSON("examples/fsae_road_course.json");
        VehicleModel geared(fsae);
        auto hybrid = fsae;
        hybrid.powertrain.ers.max_power = 120000;
        VehicleModel hybrid_model(hybrid);
        const double limit = hybrid.powertrain.max_rpm * 2.0 * 3.14159265358979323846 *
            hybrid.tire.tire_radius / (60.0 * hybrid_model.overallRatio(hybrid_model.numGears()));
        if (hybrid_model.topSpeed(false, true) > limit * 1.002 ||
            hybrid_model.maxAccelerationAy(limit * 1.01, 0, false) > 0) {
            throw std::runtime_error("ERS bypassed the gearbox speed limit");
        }
        for (double v = 0; v < 80; v += 0.001) {
            const auto op = geared.engine(v);
            if (op.valid && geared.rpmAt(v, op.gear) > fsae.powertrain.max_rpm * 1.00200001) {
                throw std::runtime_error("Lookup selected an over-revving gear");
            }
        }
        // Independent exact nonlinear reference for the table acceleration.
        // Include wheel lift, combined-slip limits, large loads and exponents
        // outside the table's supported concave range (which use exact math).
        std::mt19937 random(42);
        std::uniform_real_distribution<double> unit(0.0, 1.0);
        double max_error = 0.0;
        for (double ls : {0.0, 0.25, 0.85, 1.0, 1.5}) {
            for (double exp : {1.0, 1.5749, 2.0, 4.0}) {
                auto test_car = fsae;
                test_car.tire.load_sensitivity = ls;
                test_car.tire.combined_exponent = exp;
                VehicleModel fast(test_car), exact(test_car, false);
                for (int i = 0; i < 1000; ++i) {
                    const double v = 1.0 + 70.0 * unit(random);
                    const double ay = 80.0 * unit(random);
                    const bool drs = i % 2;
                    const double a = fast.maxAccelerationAy(v, ay, drs);
                    const double b = exact.maxAccelerationAy(v, ay, drs);
                    const double d = fast.maxDecelerationAy(v, ay);
                    const double e = exact.maxDecelerationAy(v, ay);
                    max_error = std::max({max_error, std::abs(a - b), std::abs(d - e)});
                    if (std::abs(a - b) > 2e-5 + 1e-4 * std::abs(b) ||
                        std::abs(d - e) > 2e-5 + 1e-4 * std::abs(e)) {
                        throw std::runtime_error("Tire lookup disagrees with exact reference");
                    }
                }
            }
        }
        std::cout << "Tire lookup: 40000 acceleration/braking comparisons, max error " << max_error << " m/s^2\n";
        std::cout << "PASS: normal-load conservation at wheel lift, traction/braking bounds, limiter-safe lookup\n";
        return 0;
    } catch (const std::exception& e) {
        std::cerr << e.what() << '\n';
        return 1;
    }
}
