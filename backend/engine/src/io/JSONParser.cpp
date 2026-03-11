#include "io/JSONParser.h"
#include <cctype>
#include <fstream>
#include <iostream>
#include <map>
#include <sstream>
#include <stdexcept>
#include <string_view>
#include <variant>
#include <vector>

namespace LapTimeSim {

namespace {

namespace SimpleJSON {

struct Value;
using Object = std::map<std::string, Value>;
using Array = std::vector<Value>;

struct Value {
    std::variant<std::nullptr_t, bool, double, std::string, Array, Object> data;

    Value() : data(nullptr) {}
    Value(std::nullptr_t) : data(nullptr) {}
    Value(bool value) : data(value) {}
    Value(double value) : data(value) {}
    Value(std::string value) : data(std::move(value)) {}
    Value(Array value) : data(std::move(value)) {}
    Value(Object value) : data(std::move(value)) {}

    bool isNull() const { return std::holds_alternative<std::nullptr_t>(data); }
    bool isBool() const { return std::holds_alternative<bool>(data); }
    bool isNumber() const { return std::holds_alternative<double>(data); }
    bool isString() const { return std::holds_alternative<std::string>(data); }
    bool isArray() const { return std::holds_alternative<Array>(data); }
    bool isObject() const { return std::holds_alternative<Object>(data); }

    bool asBool() const { return std::get<bool>(data); }
    double asDouble() const { return std::get<double>(data); }
    const std::string& asString() const { return std::get<std::string>(data); }
    const Array& asArray() const { return std::get<Array>(data); }
    const Object& asObject() const { return std::get<Object>(data); }
};

class Parser {
public:
    explicit Parser(std::string_view text) : text_(text), pos_(0) {}

    Value parse() {
        skipWhitespace();
        Value value = parseValue();
        skipWhitespace();
        if (pos_ != text_.size()) {
            throw std::runtime_error("Unexpected trailing characters in JSON");
        }
        return value;
    }

private:
    std::string_view text_;
    size_t pos_;

    Value parseValue() {
        if (pos_ >= text_.size()) {
            throw std::runtime_error("Unexpected end of JSON input");
        }

        switch (text_[pos_]) {
        case '{':
            return parseObject();
        case '[':
            return parseArray();
        case '"':
            return Value(parseString());
        case 't':
            parseLiteral("true");
            return Value(true);
        case 'f':
            parseLiteral("false");
            return Value(false);
        case 'n':
            parseLiteral("null");
            return Value(nullptr);
        default:
            if (text_[pos_] == '-' || std::isdigit(static_cast<unsigned char>(text_[pos_]))) {
                return Value(parseNumber());
            }
            throw std::runtime_error(
                "Invalid JSON value at position " + std::to_string(pos_) +
                " near '" + std::string(1, text_[pos_]) + "'");
        }
    }

    Object parseObject() {
        expect('{');
        skipWhitespace();

        Object object;
        if (consume('}')) {
            return object;
        }

        while (true) {
            skipWhitespace();
            const std::string key = parseString();
            skipWhitespace();
            expect(':');
            skipWhitespace();
            object[key] = parseValue();
            skipWhitespace();
            if (consume('}')) {
                break;
            }
            expect(',');
            skipWhitespace();
        }

        return object;
    }

    Array parseArray() {
        expect('[');
        skipWhitespace();

        Array array;
        if (consume(']')) {
            return array;
        }

        while (true) {
            skipWhitespace();
            array.push_back(parseValue());
            skipWhitespace();
            if (consume(']')) {
                break;
            }
            expect(',');
            skipWhitespace();
        }

        return array;
    }

    std::string parseString() {
        expect('"');
        std::string result;

        while (pos_ < text_.size()) {
            const char ch = text_[pos_++];
            if (ch == '"') {
                return result;
            }
            if (ch == '\\') {
                if (pos_ >= text_.size()) {
                    throw std::runtime_error("Invalid escape sequence in JSON string");
                }

                const char escaped = text_[pos_++];
                switch (escaped) {
                case '"':
                case '\\':
                case '/':
                    result.push_back(escaped);
                    break;
                case 'b':
                    result.push_back('\b');
                    break;
                case 'f':
                    result.push_back('\f');
                    break;
                case 'n':
                    result.push_back('\n');
                    break;
                case 'r':
                    result.push_back('\r');
                    break;
                case 't':
                    result.push_back('\t');
                    break;
                case 'u': {
                    if (pos_ + 4 > text_.size()) {
                        throw std::runtime_error("Invalid unicode escape in JSON string");
                    }
                    unsigned value = 0;
                    for (int i = 0; i < 4; ++i) {
                        value <<= 4;
                        const char hex = text_[pos_++];
                        if (hex >= '0' && hex <= '9') {
                            value += static_cast<unsigned>(hex - '0');
                        } else if (hex >= 'a' && hex <= 'f') {
                            value += static_cast<unsigned>(hex - 'a' + 10);
                        } else if (hex >= 'A' && hex <= 'F') {
                            value += static_cast<unsigned>(hex - 'A' + 10);
                        } else {
                            throw std::runtime_error("Invalid unicode escape in JSON string");
                        }
                    }
                    result.push_back(value <= 0x7F ? static_cast<char>(value) : '?');
                    break;
                }
                default:
                    throw std::runtime_error("Unsupported escape sequence in JSON string");
                }
            } else {
                result.push_back(ch);
            }
        }

        throw std::runtime_error("Unterminated JSON string");
    }

    double parseNumber() {
        const size_t start = pos_;
        if (text_[pos_] == '-') {
            ++pos_;
        }

        while (pos_ < text_.size() && std::isdigit(static_cast<unsigned char>(text_[pos_]))) {
            ++pos_;
        }
        if (pos_ < text_.size() && text_[pos_] == '.') {
            ++pos_;
            while (pos_ < text_.size() && std::isdigit(static_cast<unsigned char>(text_[pos_]))) {
                ++pos_;
            }
        }
        if (pos_ < text_.size() && (text_[pos_] == 'e' || text_[pos_] == 'E')) {
            ++pos_;
            if (pos_ < text_.size() && (text_[pos_] == '+' || text_[pos_] == '-')) {
                ++pos_;
            }
            while (pos_ < text_.size() && std::isdigit(static_cast<unsigned char>(text_[pos_]))) {
                ++pos_;
            }
        }

        return std::stod(std::string(text_.substr(start, pos_ - start)));
    }

    void parseLiteral(std::string_view literal) {
        if (text_.substr(pos_, literal.size()) != literal) {
            throw std::runtime_error("Invalid JSON literal");
        }
        pos_ += literal.size();
    }

    void skipWhitespace() {
        while (pos_ < text_.size() && std::isspace(static_cast<unsigned char>(text_[pos_]))) {
            ++pos_;
        }
    }

    void expect(char expected) {
        if (pos_ >= text_.size() || text_[pos_] != expected) {
            throw std::runtime_error(
                std::string("Expected '") + expected +
                "' in JSON at position " + std::to_string(pos_));
        }
        ++pos_;
    }

    bool consume(char expected) {
        if (pos_ < text_.size() && text_[pos_] == expected) {
            ++pos_;
            return true;
        }
        return false;
    }
};

} // namespace SimpleJSON

using SimpleJSON::Value;

Value readJSONFile(const std::string& filepath) {
    std::ifstream file(filepath);
    if (!file.is_open()) {
        throw std::runtime_error("Could not open file: " + filepath);
    }

    std::stringstream buffer;
    buffer << file.rdbuf();
    const std::string content = buffer.str();
    SimpleJSON::Parser parser(content);
    return parser.parse();
}

const Value* getMember(const Value& value, const std::string& key) {
    if (!value.isObject()) {
        return nullptr;
    }
    const auto& object = value.asObject();
    const auto it = object.find(key);
    return (it != object.end()) ? &it->second : nullptr;
}

double getDouble(const Value& value, const std::string& key, double default_value) {
    const Value* member = getMember(value, key);
    return (member != nullptr && member->isNumber()) ? member->asDouble() : default_value;
}

std::string getString(const Value& value, const std::string& key, const std::string& default_value) {
    const Value* member = getMember(value, key);
    return (member != nullptr && member->isString()) ? member->asString() : default_value;
}

std::string extractBaseName(const std::string& filepath) {
    std::string name = filepath;
    const size_t slash = name.find_last_of("/\\");
    if (slash != std::string::npos) {
        name = name.substr(slash + 1);
    }
    const size_t dot = name.find_last_of('.');
    if (dot != std::string::npos) {
        name = name.substr(0, dot);
    }
    return name;
}

} // namespace

TrackData JSONParser::parseTrackJSON(const std::string& filepath) {
    std::cout << "Parsing track JSON: " << filepath << std::endl;

    const Value root = readJSONFile(filepath);
    TrackData track;
    track.setName(getString(root, "name", extractBaseName(filepath)));

    const Value* points = getMember(root, "points");
    if (points == nullptr || !points->isArray()) {
        throw std::runtime_error("Track JSON must contain a 'points' array");
    }

    for (const Value& point : points->asArray()) {
        const double x = getDouble(point, "x", 0.0);
        const double y = getDouble(point, "y", 0.0);
        const double z = getDouble(point, "elevation", getDouble(point, "z", 0.0));
        const double w_left = getDouble(point, "w_tr_left", 5.0);
        const double w_right = getDouble(point, "w_tr_right", 5.0);
        const double banking = getDouble(point, "banking", 0.0);
        track.addPoint(x, y, z, w_left, w_right, banking);
    }

    track.preprocess();
    std::cout << "Track preprocessed. Total length: " << track.getTotalLength() << " m" << std::endl;
    return track;
}

TrackData JSONParser::parseTrackCSV(const std::string& filepath) {
    std::cout << "Parsing TUMFTM CSV track: " << filepath << std::endl;

    std::ifstream file(filepath);
    if (!file.is_open()) {
        throw std::runtime_error("Failed to open CSV track file: " + filepath);
    }

    TrackData track;
    track.setName(extractBaseName(filepath));

    std::string line;
    int point_count = 0;
    while (std::getline(file, line)) {
        if (line.empty() || line[0] == '#') {
            continue;
        }

        std::stringstream stream(line);
        std::string token;
        std::vector<double> values;
        while (std::getline(stream, token, ',')) {
            try {
                values.push_back(std::stod(token));
            } catch (...) {
                values.clear();
                break;
            }
        }

        if (values.size() >= 4) {
            track.addPoint(values[0], values[1], 0.0, values[3], values[2], 0.0);
            ++point_count;
        }
    }

    if (point_count == 0) {
        throw std::runtime_error("No valid track points found in CSV");
    }

    track.preprocess();
    std::cout << "Loaded " << point_count << " points from CSV" << std::endl;
    std::cout << "Track preprocessed. Total length: " << track.getTotalLength() << " m" << std::endl;
    return track;
}

VehicleParams JSONParser::parseVehicleJSON(const std::string& filepath) {
    std::cout << "Parsing vehicle JSON: " << filepath << std::endl;

    const Value root = readJSONFile(filepath);
    VehicleParams vehicle;
    vehicle.setName(getString(root, "name", extractBaseName(filepath)));

    if (const Value* mass = getMember(root, "mass"); mass != nullptr && mass->isObject()) {
        vehicle.mass.mass = getDouble(*mass, "mass", vehicle.mass.mass);
        vehicle.mass.cog_height = getDouble(*mass, "cog_height", vehicle.mass.cog_height);
        vehicle.mass.wheelbase = getDouble(*mass, "wheelbase", vehicle.mass.wheelbase);
        vehicle.mass.weight_distribution = getDouble(*mass, "weight_distribution", vehicle.mass.weight_distribution);
    }

    if (const Value* aero = getMember(root, "aerodynamics"); aero != nullptr && aero->isObject()) {
        vehicle.aero.Cl = getDouble(*aero, "Cl", vehicle.aero.Cl);
        vehicle.aero.Cd = getDouble(*aero, "Cd", vehicle.aero.Cd);
        vehicle.aero.frontal_area = getDouble(*aero, "frontal_area", vehicle.aero.frontal_area);
        vehicle.aero.air_density = getDouble(*aero, "air_density", vehicle.aero.air_density);
    }

    if (const Value* tire = getMember(root, "tire"); tire != nullptr && tire->isObject()) {
        vehicle.tire.mu_x = getDouble(*tire, "mu_x", vehicle.tire.mu_x);
        vehicle.tire.mu_y = getDouble(*tire, "mu_y", vehicle.tire.mu_y);
        vehicle.tire.load_sensitivity = getDouble(*tire, "load_sensitivity", vehicle.tire.load_sensitivity);
        vehicle.tire.tire_radius = getDouble(*tire, "tire_radius", vehicle.tire.tire_radius);
    }

    if (const Value* powertrain = getMember(root, "powertrain"); powertrain != nullptr && powertrain->isObject()) {
        if (const Value* curve = getMember(*powertrain, "engine_torque_curve"); curve != nullptr && curve->isObject()) {
            for (const auto& [rpm_key, torque_value] : curve->asObject()) {
                if (torque_value.isNumber()) {
                    vehicle.powertrain.engine_torque_curve[std::stod(rpm_key)] = torque_value.asDouble();
                }
            }
        }

        if (const Value* gears = getMember(*powertrain, "gear_ratios"); gears != nullptr && gears->isArray()) {
            vehicle.powertrain.gear_ratios.clear();
            for (const Value& gear : gears->asArray()) {
                if (gear.isNumber()) {
                    vehicle.powertrain.gear_ratios.push_back(gear.asDouble());
                }
            }
        }

        vehicle.powertrain.final_drive_ratio = getDouble(*powertrain, "final_drive", vehicle.powertrain.final_drive_ratio);
        vehicle.powertrain.drivetrain_efficiency = getDouble(*powertrain, "efficiency", vehicle.powertrain.drivetrain_efficiency);
        vehicle.powertrain.max_rpm = getDouble(*powertrain, "max_rpm", vehicle.powertrain.max_rpm);
        vehicle.powertrain.min_rpm = getDouble(*powertrain, "min_rpm", vehicle.powertrain.min_rpm);
        vehicle.powertrain.shift_time = getDouble(*powertrain, "shift_time", vehicle.powertrain.shift_time);
    }

    if (const Value* brake = getMember(root, "brake"); brake != nullptr && brake->isObject()) {
        vehicle.brake.max_brake_force = getDouble(*brake, "max_brake_force", vehicle.brake.max_brake_force);
        vehicle.brake.brake_bias = getDouble(*brake, "brake_bias", vehicle.brake.brake_bias);
    }

    if (!vehicle.validate()) {
        throw std::runtime_error("Vehicle parameters failed validation");
    }

    std::cout << "Vehicle parsed successfully: " << vehicle.getName() << std::endl;
    std::cout << "  Mass: " << vehicle.mass.mass << " kg" << std::endl;
    std::cout << "  Power/Weight: " << vehicle.getPowerToWeightRatio() << " hp/kg" << std::endl;

    return vehicle;
}

} // namespace LapTimeSim
