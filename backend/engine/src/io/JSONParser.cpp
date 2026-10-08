#include "io/JSONParser.h"
#include <algorithm>
#include <cctype>
#include <cmath>
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

/// Sets root["a"]["b"]... = value for a dotted path, creating objects as needed.
void applyOverride(Value& root, const std::string& path, const std::string& raw) {
    std::vector<std::string> parts;
    std::stringstream stream(path);
    std::string part;
    while (std::getline(stream, part, '.')) {
        if (part.empty()) {
            throw std::runtime_error("Invalid override path: " + path);
        }
        parts.push_back(part);
    }
    if (parts.empty()) {
        throw std::runtime_error("Invalid override path: " + path);
    }

    Value* node = &root;
    for (size_t i = 0; i < parts.size(); ++i) {
        if (!node->isObject()) {
            node->data = SimpleJSON::Object{};
        }
        auto& object = std::get<SimpleJSON::Object>(node->data);
        node = &object[parts[i]];
    }

    if (raw == "true" || raw == "false") {
        node->data = (raw == "true");
        return;
    }
    try {
        size_t used = 0;
        const double number = std::stod(raw, &used);
        if (used == raw.size()) {
            node->data = number;
            return;
        }
    } catch (...) {
    }
    if (!raw.empty() && (raw.front() == '[' || raw.front() == '{')) {
        SimpleJSON::Parser parser(raw);
        *node = parser.parse();
        return;
    }
    node->data = raw;
}

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
    if (member == nullptr) return default_value;
    if (!member->isNumber() || !std::isfinite(member->asDouble())) {
        throw std::runtime_error("Field '" + key + "' must be a finite number");
    }
    return member->asDouble();
}

std::string getString(const Value& value, const std::string& key, const std::string& default_value) {
    const Value* member = getMember(value, key);
    return (member != nullptr && member->isString()) ? member->asString() : default_value;
}

bool getBool(const Value& value, const std::string& key, bool default_value) {
    const Value* member = getMember(value, key);
    if (member == nullptr) {
        return default_value;
    }
    if (member->isBool()) {
        return member->asBool();
    }
    if (member->isNumber()) {
        return member->asDouble() != 0.0;
    }
    return default_value;
}

std::string toUpper(std::string text) {
    for (auto& ch : text) {
        ch = static_cast<char>(std::toupper(static_cast<unsigned char>(ch)));
    }
    return text;
}

std::vector<std::pair<double, double>> parseZoneList(const Value& zones) {
    std::vector<std::pair<double, double>> result;
    if (!zones.isArray()) {
        return result;
    }
    for (const Value& zone : zones.asArray()) {
        if (zone.isArray() && zone.asArray().size() >= 2 &&
            zone.asArray()[0].isNumber() && zone.asArray()[1].isNumber()) {
            result.emplace_back(zone.asArray()[0].asDouble(), zone.asArray()[1].asDouble());
        } else if (zone.isObject()) {
            result.emplace_back(getDouble(zone, "start", 0.0), getDouble(zone, "end", 0.0));
        }
    }
    return result;
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

namespace {
std::string sidecarPath(const std::string& track_filepath, const std::string& suffix) {
    std::string base = track_filepath;
    const size_t dot = base.find_last_of('.');
    const size_t slash = base.find_last_of("/\\");
    if (dot != std::string::npos && (slash == std::string::npos || dot > slash)) {
        base = base.substr(0, dot);
    }
    return base + suffix;
}
} // namespace

std::vector<std::pair<double, double>> JSONParser::loadDRSSidecar(const std::string& track_filepath) {
    std::vector<std::pair<double, double>> zones;
    const std::string path = sidecarPath(track_filepath, ".drs.csv");
    std::ifstream file(path);
    if (!file.is_open()) {
        return zones;
    }
    std::string line;
    while (std::getline(file, line)) {
        if (line.empty() || line[0] == '#') {
            continue;
        }
        const size_t comma = line.find(',');
        if (comma == std::string::npos) {
            throw std::runtime_error("DRS sidecar rows need s_start_m,s_end_m: " + path);
        }
        zones.emplace_back(std::stod(line.substr(0, comma)), std::stod(line.substr(comma + 1)));
    }
    std::cout << "Loaded " << zones.size() << " DRS zone(s) from " << path << std::endl;
    return zones;
}

bool JSONParser::applyElevationSidecar(TrackData& track, const std::string& track_filepath) {
    const std::string path = sidecarPath(track_filepath, ".elevation.csv");
    std::ifstream file(path);
    if (!file.is_open()) {
        return false;
    }
    std::vector<std::pair<double, double>> profile;
    std::string line;
    while (std::getline(file, line)) {
        if (line.empty() || line[0] == '#') {
            continue;
        }
        const size_t comma = line.find(',');
        if (comma == std::string::npos) {
            throw std::runtime_error("Elevation sidecar rows need s_m,z_m: " + path);
        }
        try {
            profile.emplace_back(std::stod(line.substr(0, comma)), std::stod(line.substr(comma + 1)));
        } catch (const std::exception&) {
            continue;  // header line
        }
    }
    if (profile.size() < 2) {
        throw std::runtime_error("Elevation sidecar needs at least two rows: " + path);
    }
    std::sort(profile.begin(), profile.end());

    const double length = track.getTotalLength();
    auto elevation_at = [&](double s) {
        s = std::fmod(s, length);
        if (s < 0.0) {
            s += length;
        }
        const auto upper = std::upper_bound(profile.begin(), profile.end(), std::make_pair(s, -1e300));
        // periodic neighbours (the profile wraps from its last sample back to the first + length)
        const std::pair<double, double> hi = (upper == profile.end())
            ? std::make_pair(profile.front().first + length, profile.front().second) : *upper;
        const std::pair<double, double> lo = (upper == profile.begin())
            ? std::make_pair(profile.back().first - length, profile.back().second) : *std::prev(upper);
        const double span = hi.first - lo.first;
        const double f = (span > 1e-9) ? (s - lo.first) / span : 0.0;
        return lo.second + f * (hi.second - lo.second);
    };

    std::vector<double> s_values(track.getNumPoints());
    for (size_t i = 0; i < track.getNumPoints(); ++i) {
        s_values[i] = track.getPoint(i).s;
    }
    double z_min = 1e300;
    double z_max = -1e300;
    for (size_t i = 0; i < track.getNumPoints(); ++i) {
        const double z = elevation_at(s_values[i]);
        z_min = std::min(z_min, z);
        z_max = std::max(z_max, z);
        track.setElevationAt(i, z);
    }
    track.preprocess();
    std::cout << "Applied elevation profile (" << profile.size() << " samples, range "
              << (z_max - z_min) << " m) from " << path << std::endl;
    return true;
}

int JSONParser::applyBankingSidecar(TrackData& track, const std::string& track_filepath) {
    const std::string path = sidecarPath(track_filepath, ".banking.csv");
    std::ifstream file(path);
    if (!file.is_open()) {
        return 0;
    }

    struct Section {
        double start, end, angle, ramp;
    };
    std::vector<Section> sections;
    std::string line;
    while (std::getline(file, line)) {
        if (line.empty() || line[0] == '#') {
            continue;
        }
        std::stringstream stream(line);
        std::string token;
        std::vector<double> values;
        while (std::getline(stream, token, ',')) {
            values.push_back(std::stod(token));
        }
        if (values.size() < 3) {
            throw std::runtime_error("Banking sidecar rows need s_start_m,s_end_m,banking_deg[,ramp_m]: " + path);
        }
        sections.push_back({values[0], values[1], values[2] * 3.14159265358979323846 / 180.0,
                            values.size() > 3 ? std::max(0.0, values[3]) : 20.0});
    }

    const double length = track.getTotalLength();
    auto inside_weight = [length](double s, const Section& sec) {
        double span = sec.end - sec.start;
        if (span < 0.0) {
            span += length;  // wraps over the start line
        }
        double rel = s - sec.start;
        if (rel < 0.0) {
            rel += length;
        }
        if (rel > span) {
            return 0.0;
        }
        const double edge = std::min(rel, span - rel);
        return (sec.ramp > 0.0) ? std::min(1.0, edge / sec.ramp) : 1.0;
    };

    for (size_t i = 0; i < track.getNumPoints(); ++i) {
        const double s = track.getPoint(i).s;
        double banking = track.getPoint(i).banking;
        for (const Section& sec : sections) {
            const double w = inside_weight(s, sec);
            if (w > 0.0) {
                banking = w * sec.angle + (1.0 - w) * banking;
            }
        }
        track.setBankingAt(i, banking);
    }
    std::cout << "Applied " << sections.size() << " banked section(s) from " << path << std::endl;
    return static_cast<int>(sections.size());
}

VehicleParams JSONParser::parseVehicleJSON(const std::string& filepath) {
    return parseVehicleJSON(filepath, {});
}

VehicleParams JSONParser::parseVehicleJSON(const std::string& filepath,
                                           const std::vector<std::pair<std::string, std::string>>& overrides) {
    std::cout << "Parsing vehicle JSON: " << filepath << std::endl;

    Value root = readJSONFile(filepath);
    for (const auto& [path, value] : overrides) {
        applyOverride(root, path, value);
        std::cout << "  override " << path << " = " << value << std::endl;
    }
    VehicleParams vehicle;
    vehicle.setName(getString(root, "name", extractBaseName(filepath)));

    if (const Value* mass = getMember(root, "mass"); mass != nullptr && mass->isObject()) {
        vehicle.mass.mass = getDouble(*mass, "mass", vehicle.mass.mass);
        vehicle.mass.cog_height = getDouble(*mass, "cog_height", vehicle.mass.cog_height);
        vehicle.mass.wheelbase = getDouble(*mass, "wheelbase", vehicle.mass.wheelbase);
        vehicle.mass.weight_distribution = getDouble(*mass, "weight_distribution", vehicle.mass.weight_distribution);
        const double track = getDouble(*mass, "track_width", -1.0);
        vehicle.mass.track_width_front = getDouble(*mass, "track_width_front", track);
        vehicle.mass.track_width_rear = getDouble(*mass, "track_width_rear", track);
        vehicle.mass.vehicle_width = getDouble(*mass, "vehicle_width", vehicle.mass.vehicle_width);
        vehicle.mass.lltd_front = getDouble(*mass, "lltd_front", vehicle.mass.lltd_front);
    }

    if (const Value* aero = getMember(root, "aerodynamics"); aero != nullptr && aero->isObject()) {
        vehicle.aero.Cl = getDouble(*aero, "Cl", vehicle.aero.Cl);
        vehicle.aero.Cd = getDouble(*aero, "Cd", vehicle.aero.Cd);
        vehicle.aero.frontal_area = getDouble(*aero, "frontal_area", vehicle.aero.frontal_area);
        vehicle.aero.air_density = getDouble(*aero, "air_density", vehicle.aero.air_density);
        vehicle.aero.aero_balance = getDouble(*aero, "aero_balance", vehicle.aero.aero_balance);
        vehicle.aero.downforce_speed_exponent =
            getDouble(*aero, "downforce_speed_exponent", vehicle.aero.downforce_speed_exponent);
        vehicle.aero.downforce_reference_speed =
            getDouble(*aero, "downforce_reference_speed_kmh", vehicle.aero.downforce_reference_speed * 3.6) / 3.6;
        vehicle.aero.downforce_saturation_speed =
            getDouble(*aero, "downforce_saturation_speed_kmh", vehicle.aero.downforce_saturation_speed * 3.6) / 3.6;
        vehicle.aero.downforce_min_speed =
            getDouble(*aero, "downforce_min_speed_kmh", vehicle.aero.downforce_min_speed * 3.6) / 3.6;
        // Optional direct area-coefficient inputs override Cl / Cd.
        if (const Value* cla = getMember(*aero, "ClA"); cla != nullptr && cla->isNumber()) {
            vehicle.aero.Cl = -cla->asDouble() / vehicle.aero.frontal_area;
        }
        if (const Value* cda = getMember(*aero, "CdA"); cda != nullptr && cda->isNumber()) {
            vehicle.aero.Cd = cda->asDouble() / vehicle.aero.frontal_area;
        }

        if (const Value* drs = getMember(*aero, "drs"); drs != nullptr && drs->isObject()) {
            DRSParams& d = vehicle.aero.drs;
            d.enabled = getBool(*drs, "enabled", true);
            d.drag_reduction = getDouble(*drs, "drag_reduction", d.drag_reduction);
            d.downforce_reduction = getDouble(*drs, "downforce_reduction", d.downforce_reduction);
            d.max_zones = static_cast<int>(getDouble(*drs, "max_zones", d.max_zones));
            d.min_zone_length = getDouble(*drs, "min_zone_length", d.min_zone_length);
            d.straight_radius = getDouble(*drs, "straight_radius", d.straight_radius);
            if (const Value* zones = getMember(*drs, "zones"); zones != nullptr && zones->isArray()) {
                d.zones = parseZoneList(*zones);
            }
        }
    }

    if (const Value* tire = getMember(root, "tire"); tire != nullptr && tire->isObject()) {
        vehicle.tire.mu_x = getDouble(*tire, "mu_x", vehicle.tire.mu_x);
        vehicle.tire.mu_y = getDouble(*tire, "mu_y", vehicle.tire.mu_y);
        vehicle.tire.load_sensitivity = getDouble(*tire, "load_sensitivity", vehicle.tire.load_sensitivity);
        vehicle.tire.tire_radius = getDouble(*tire, "tire_radius", vehicle.tire.tire_radius);
        vehicle.tire.reference_load = getDouble(*tire, "reference_load", vehicle.tire.reference_load);
        vehicle.tire.combined_exponent = getDouble(*tire, "combined_exponent", vehicle.tire.combined_exponent);
        vehicle.tire.rolling_resistance = getDouble(*tire, "rolling_resistance", vehicle.tire.rolling_resistance);
        vehicle.tire.wheel_inertia = getDouble(*tire, "wheel_inertia", vehicle.tire.wheel_inertia);
        vehicle.tire.rear_mu_scale = getDouble(*tire, "rear_mu_scale", vehicle.tire.rear_mu_scale);
    }

    if (const Value* line = getMember(root, "racing_line"); line != nullptr && line->isObject()) {
        vehicle.line.edge_margin = getDouble(*line, "edge_margin", vehicle.line.edge_margin);
    }

    if (const Value* powertrain = getMember(root, "powertrain"); powertrain != nullptr && powertrain->isObject()) {
        if (const Value* curve = getMember(*powertrain, "engine_torque_curve"); curve != nullptr && curve->isObject()) {
            const double torque_scale = getDouble(*powertrain, "torque_scale", 1.0);
            if (torque_scale <= 0.0) {
                throw std::runtime_error("powertrain.torque_scale must be positive");
            }
            vehicle.powertrain.engine_torque_curve.clear();
            for (const auto& [rpm_key, torque_value] : curve->asObject()) {
                if (torque_value.isNumber()) {
                    vehicle.powertrain.engine_torque_curve[std::stod(rpm_key)] = torque_value.asDouble() * torque_scale;
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
        vehicle.powertrain.engine_inertia = getDouble(*powertrain, "engine_inertia", vehicle.powertrain.engine_inertia);

        const std::string drive = toUpper(getString(*powertrain, "drive", "RWD"));
        if (drive == "FWD") {
            vehicle.powertrain.drive_type = DriveType::FWD;
        } else if (drive == "AWD" || drive == "4WD") {
            vehicle.powertrain.drive_type = DriveType::AWD;
        } else if (drive == "RWD") {
            vehicle.powertrain.drive_type = DriveType::RWD;
        } else {
            throw std::runtime_error("Unknown powertrain.drive '" + drive + "' (use RWD, FWD or AWD)");
        }

        if (const Value* ers = getMember(*powertrain, "ers"); ers != nullptr && ers->isObject()) {
            vehicle.powertrain.ers.max_power = getDouble(*ers, "max_power_kw", 0.0) * 1000.0;
            vehicle.powertrain.ers.energy_per_lap = getDouble(*ers, "energy_per_lap_mj", 0.0) * 1e6;
            vehicle.powertrain.ers.recovery_power = getDouble(*ers, "recovery_power_kw", 0.0) * 1000.0;
        }
    }

    if (const Value* brake = getMember(root, "brake"); brake != nullptr && brake->isObject()) {
        vehicle.brake.max_brake_force = getDouble(*brake, "max_brake_force", vehicle.brake.max_brake_force);
        vehicle.brake.brake_bias = getDouble(*brake, "brake_bias", vehicle.brake.brake_bias);
        vehicle.brake.ideal_bias = getBool(*brake, "ideal_bias", vehicle.brake.ideal_bias);
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
