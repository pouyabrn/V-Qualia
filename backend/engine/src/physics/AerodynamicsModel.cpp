#include "physics/AerodynamicsModel.h"
#include <cmath>

namespace LapTimeSim {

AerodynamicsModel::AerodynamicsModel(const AeroParams& params)
    : params_(params) {
}

double AerodynamicsModel::getDragForce(double v) const {
    // F_drag = 0.5 × ρ × v² × Cd × A
    double v_squared = v * v;
    return getAeroCoefficient() * params_.Cd * v_squared;
}

double AerodynamicsModel::getDownforce(double v) const {
    // F_lift = 0.5 × ρ × v² × Cl × A
    // Cl is typically negative for race cars (downforce)
    // Return positive value for downforce
    double v_squared = v * v;
    return -getAeroCoefficient() * params_.Cl * v_squared;
}

double AerodynamicsModel::getTotalVerticalLoad(double v, double mass, double g) const {
    // Total vertical load = Weight + Downforce
    double weight = mass * g;
    double downforce = getDownforce(v);
    return weight + downforce;
}

double AerodynamicsModel::getDragPower(double v) const {
    // Power = Force × Velocity
    return getDragForce(v) * v;
}

} // namespace LapTimeSim


