import { useState, useEffect } from 'react';
import { Plus, Save, Thermometer, Wind, ToyBrick, Cog, PanelTop, Car, Trash2, RefreshCw } from 'lucide-react';
import FormInput from '../common/FormInput';
import CollapsibleSection from '../common/CollapsibleSection';
import { carsAPI } from '../../utils/api';

const CarsPage = () => {
  const [cars, setCars] = useState([]);
  const [selectedCar, setSelectedCar] = useState(null);
  const [carFormData, setCarFormData] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // load cars from backend on mount
  useEffect(() => {
    loadCars();
  }, []);

  const loadCars = async () => {
    try {
      setLoading(true);
      const response = await carsAPI.getAll();
      const carsList = response.cars || [];
      console.log('loaded cars from backend:', carsList);
      setCars(carsList);
      
      // auto-select first car if we have cars
      if (carsList.length > 0) {
        console.log('selecting first car:', carsList[0]);
        const converted = convertBackendToFrontend(carsList[0]);
        console.log('converted car data:', converted);
        
        if (converted) {
          setSelectedCar(carsList[0]);
          setCarFormData(converted);
          setIsCreating(false);
        } else {
          // conversion failed, show create form
          console.error('failed to convert car data, showing create form');
          setSelectedCar(null);
          setIsCreating(true);
          setCarFormData(getBlankCar());
        }
      } else {
        // no cars in backend, show creating state
        console.log('no cars found, showing create form');
        setSelectedCar(null);
        setIsCreating(true);
        setCarFormData(getBlankCar());
      }
    } catch (error) {
      console.error('failed to load cars:', error);
      alert('couldnt load cars from server: ' + error.message);
      // on error, show blank form so user isn't stuck
      setCarFormData(getBlankCar());
    } finally {
      setLoading(false);
    }
  };

  // convert backend format to frontend format
  const convertBackendToFrontend = (backendCar) => {
    console.log('converting car, full object:', JSON.stringify(backendCar, null, 2));
    
    if (!backendCar) {
      console.error('invalid car data - null or undefined');
      return null;
    }
    
    // check if it's already in frontend format (has "name" instead of "vehicle_name")
    if (backendCar.name && !backendCar.vehicle_name) {
      console.log('car is already in frontend format, using as-is');
      // ensure proper ID
      if (!backendCar.id) {
        backendCar.id = backendCar.name.replace(/\s+/g, '_');
      }
      return backendCar;
    }
    
    // handle backend format with vehicle_name
    if (!backendCar.vehicle_name) {
      console.error('invalid car data - missing both name and vehicle_name. Keys:', Object.keys(backendCar || {}));
      return null;
    }
    
    return {
      id: backendCar.vehicle_name.replace(/\s+/g, '_'),
      name: backendCar.vehicle_name,
      mass: {
        mass: backendCar.mass || 800,
        cog_height: backendCar.cg_height || 0.3,
        wheelbase: backendCar.wheelbase || 3.6,
        weight_distribution: (backendCar.front_weight_dist || 0.46) * 100
      },
      aerodynamics: {
        Cl: backendCar.lift_coefficient_front || -1.8,
        Cd: backendCar.drag_coefficient || 0.7,
        frontal_area: backendCar.frontal_area || 1.6,
        air_density: backendCar.air_density || 1.225
      },
      tire: {
        mu_x: backendCar.tire_friction_long || 1.8,
        mu_y: backendCar.tire_friction_lat || 1.9,
        load_sensitivity: backendCar.tire_load_sensitivity || 0.05,
        tire_radius: backendCar.tire_radius || 0.33
      },
      powertrain: {
        final_drive: backendCar.final_drive || 2.6,
        efficiency: backendCar.drivetrain_efficiency || 0.92,
        max_rpm: backendCar.max_rpm || 15000,
        min_rpm: backendCar.idle_rpm || 5000,
        engine_torque_curve: {
          '11000': backendCar.max_torque || 380
        }
      },
      brake: {
        max_brake_force: backendCar.max_brake_force || 25000,
        brake_bias: (backendCar.brake_bias || 0.58) * 100
      }
    };
  };

  // convert frontend format to backend format
  const convertFrontendToBackend = (frontendCar) => {
    return {
      vehicle_name: frontendCar.name,
      mass: frontendCar.mass.mass,
      wheelbase: frontendCar.mass.wheelbase,
      cg_height: frontendCar.mass.cog_height,
      front_weight_dist: frontendCar.mass.weight_distribution / 100,
      front_track: 1.6, // default
      rear_track: 1.58, // default
      tire_radius: frontendCar.tire.tire_radius,
      drag_coefficient: frontendCar.aerodynamics.Cd,
      lift_coefficient_front: frontendCar.aerodynamics.Cl,
      lift_coefficient_rear: frontendCar.aerodynamics.Cl * 1.2, // estimate
      frontal_area: frontendCar.aerodynamics.frontal_area,
      air_density: frontendCar.aerodynamics.air_density,
      tire_friction_long: frontendCar.tire.mu_x,
      tire_friction_lat: frontendCar.tire.mu_y,
      tire_load_sensitivity: frontendCar.tire.load_sensitivity,
      max_power: 746000.0, // default 1000hp
      max_torque: frontendCar.powertrain.engine_torque_curve['11000'] || 380,
      engine_inertia: 0.15, // default
      drivetrain_efficiency: frontendCar.powertrain.efficiency,
      max_rpm: frontendCar.powertrain.max_rpm,
      idle_rpm: frontendCar.powertrain.min_rpm,
      gear_ratios: [13.2, 10.1, 8.0, 6.5, 5.4, 4.6, 4.0, 3.5], // default F1 ratios
      final_drive: frontendCar.powertrain.final_drive,
      shift_time: 0.05, // default
      brake_bias: frontendCar.brake.brake_bias / 100,
      max_brake_force: frontendCar.brake.max_brake_force,
      brake_efficiency: 0.95 // default
    };
  };

  const getBlankCar = () => ({
    id: `new_car_${Date.now()}`,
    name: 'New Vehicle',
    mass: { mass: 800, cog_height: 0.3, wheelbase: 3.6, weight_distribution: 46 },
    aerodynamics: { Cl: -1.8, Cd: 0.7, frontal_area: 1.6, air_density: 1.225 },
    tire: { mu_x: 1.8, mu_y: 1.9, load_sensitivity: 0.05, tire_radius: 0.33 },
    powertrain: { final_drive: 2.6, efficiency: 0.92, max_rpm: 15000, min_rpm: 5000, engine_torque_curve: { '11000': 380 } },
    brake: { max_brake_force: 25000, brake_bias: 58 }
  });

  // sync form data when user manually selects a different car (not on initial load)
  useEffect(() => {
    if (selectedCar && !loading && carFormData) {
      // only convert if the selected car is different from current form
      if (selectedCar.vehicle_name !== carFormData.name) {
        console.log('user selected different car, converting:', selectedCar.vehicle_name);
        const converted = convertBackendToFrontend(selectedCar);
        if (converted) {
          setCarFormData(converted);
        }
        setIsCreating(false);
      }
    }
  }, [selectedCar]);

  const handleCarFormChange = (section, key, value) => {
    setCarFormData(prev => {
      const newData = JSON.parse(JSON.stringify(prev));
      if (section) {
        newData[section][key] = parseFloat(value) || 0;
      } else {
        newData[key] = value;
      }
      return newData;
    });
  };

  const handleSaveCar = async () => {
    try {
      setSaving(true);
      const backendData = convertFrontendToBackend(carFormData);
      
      // check if updating or creating
      const existingCar = cars.find(c => c.vehicle_name === backendData.vehicle_name);
      
      if (existingCar && !isCreating) {
        // update existing car
        await carsAPI.update(backendData.vehicle_name, backendData);
      } else {
        // create new car
        await carsAPI.create(backendData);
      }
      
      // reload cars from backend
      await loadCars();
      setIsCreating(false);
      
      alert('car saved successfully!');
    } catch (error) {
      console.error('failed to save car:', error);
      alert('failed to save car: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateNew = () => {
    setSelectedCar(null);
    setIsCreating(true);
    setCarFormData(getBlankCar());
  };

  const handleSelectCar = (car) => {
    setSelectedCar(car);
    setCarFormData(convertBackendToFrontend(car));
    setIsCreating(false);
  };

  const handleDeleteCar = async (carName, e) => {
    e.stopPropagation();
    
    if (cars.length <= 1) {
      alert('need at least one car bro');
      return;
    }
    
    if (!confirm(`delete ${carName}?`)) {
      return;
    }
    
    try {
      await carsAPI.delete(carName);
      await loadCars();
    } catch (error) {
      console.error('failed to delete car:', error);
      alert('couldnt delete car: ' + error.message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 text-cyan-400 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">loading cars from server...</p>
        </div>
      </div>
    );
  }

  // if no form data yet, show loading
  if (!carFormData) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 text-cyan-400 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">initializing...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-4xl font-bold mb-2 bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
          Vehicle Garage
        </h2>
        <p className="text-gray-400">Select a vehicle to edit or create a new one</p>
      </div>

      {/* Car Selection Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {/* Existing Cars */}
        {cars.filter(car => car && (car.vehicle_name || car.name)).map(car => {
          const frontendCar = convertBackendToFrontend(car);
          if (!frontendCar) return null;
          
          // get car name from either format
          const carName = car.vehicle_name || car.name;
          const carMass = car.mass?.mass || car.mass || 800;
          const carTorque = car.powertrain?.engine_torque_curve?.['11000'] || car.max_torque || 380;
          const carDrag = car.aerodynamics?.Cd || car.drag_coefficient || 0.7;
          const selectedCarName = selectedCar?.vehicle_name || selectedCar?.name;
          
          return (
            <div
              key={carName}
              onClick={() => handleSelectCar(car)}
              className={`relative group cursor-pointer transition-all duration-300 transform hover:scale-105 ${
                selectedCarName === carName && !isCreating
                  ? 'ring-2 ring-cyan-500'
                  : ''
              }`}
            >
              <div className="card-gradient h-full p-6 text-center hover:bg-white/10">
                {/* Delete Button - always show */}
                <button
                  onClick={(e) => handleDeleteCar(carName, e)}
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-2 rounded-lg bg-red-500/20 hover:bg-red-500/40 text-red-400"
                >
                  <Trash2 size={16} />
                </button>
                
                {/* Car Icon */}
                <div className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${
                  selectedCarName === carName && !isCreating
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-600'
                    : 'bg-white/10'
                }`}>
                  <Car className={selectedCarName === carName && !isCreating ? 'text-white' : 'text-cyan-400'} size={32} />
                </div>

                {/* Car Name */}
                <h3 className="text-xl font-bold text-white mb-2">{carName}</h3>

                {/* Quick Stats */}
                <div className="space-y-1 text-sm text-gray-400">
                  <p>Mass: {carMass} kg</p>
                  <p>Torque: {carTorque} Nm</p>
                  <p>Drag: {carDrag}</p>
                </div>

                {/* Selection Indicator */}
                {selectedCarName === carName && !isCreating && (
                  <div className="mt-4 text-cyan-400 text-sm font-semibold">
                    ✓ Selected
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Create New Car Card */}
        <div
          onClick={handleCreateNew}
          className={`cursor-pointer transition-all duration-300 transform hover:scale-105 ${
            isCreating ? 'ring-2 ring-cyan-500' : ''
          }`}
        >
          <div className="card-gradient h-full p-6 text-center hover:bg-white/10 flex flex-col justify-center items-center min-h-[250px] border-2 border-dashed border-cyan-500/30 hover:border-cyan-500">
            <div className={`w-16 h-16 mb-4 rounded-full flex items-center justify-center ${
              isCreating
                ? 'bg-gradient-to-r from-cyan-500 to-blue-600'
                : 'bg-white/10'
            }`}>
              <Plus className={isCreating ? 'text-white' : 'text-cyan-400'} size={32} />
            </div>
            <h3 className="text-xl font-bold text-cyan-400 mb-2">Create New Vehicle</h3>
            <p className="text-sm text-gray-400">Build your custom race car</p>
            {isCreating && (
              <div className="mt-4 text-cyan-400 text-sm font-semibold">
                ✓ Creating
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Editor Section */}
      {(selectedCar || isCreating) && carFormData && (
        <div className="card-gradient">
          <div className="flex justify-between items-center mb-6 pb-4 border-b border-white/10">
            <div>
              <h3 className="text-2xl font-bold text-cyan-300">
                {isCreating ? '🏗️ Create New Vehicle' : `🔧 Edit: ${carFormData.name}`}
              </h3>
              <p className="text-sm text-gray-400 mt-1">
                {isCreating ? 'Configure your custom race car' : 'Modify vehicle parameters'}
              </p>
            </div>
            <button
              onClick={handleSaveCar}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-3 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white transition-all font-semibold shadow-lg shadow-cyan-500/30 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? <RefreshCw size={18} className="animate-spin" /> : <Save size={18} />}
              {saving ? 'Saving...' : (isCreating ? 'Create Vehicle' : 'Save Changes')}
            </button>
          </div>

          {/* Car Name */}
          <div className="mb-6 p-4 bg-white/5 rounded-lg">
            <FormInput
              label="Vehicle Name"
              type="text"
              value={carFormData.name}
              onChange={(e) => handleCarFormChange(null, 'name', e.target.value)}
            />
          </div>

          {/* Configuration Sections */}
          <div className="space-y-4">
            {/* Mass Section */}
            <CollapsibleSection title="Mass & Dimensions" icon={Thermometer}>
              <FormInput
                label="Mass (kg)"
                value={carFormData.mass.mass}
                onChange={(e) => handleCarFormChange('mass', 'mass', e.target.value)}
              />
              <FormInput
                label="CoG Height (m)"
                value={carFormData.mass.cog_height}
                onChange={(e) => handleCarFormChange('mass', 'cog_height', e.target.value)}
              />
              <FormInput
                label="Wheelbase (m)"
                value={carFormData.mass.wheelbase}
                onChange={(e) => handleCarFormChange('mass', 'wheelbase', e.target.value)}
              />
              <FormInput
                label="Weight Dist. (front %)"
                value={carFormData.mass.weight_distribution}
                onChange={(e) => handleCarFormChange('mass', 'weight_distribution', e.target.value)}
              />
            </CollapsibleSection>

            {/* Aerodynamics Section */}
            <CollapsibleSection title="Aerodynamics" icon={Wind}>
              <FormInput
                label="Cl (Lift Coeff.)"
                value={carFormData.aerodynamics.Cl}
                onChange={(e) => handleCarFormChange('aerodynamics', 'Cl', e.target.value)}
              />
              <FormInput
                label="Cd (Drag Coeff.)"
                value={carFormData.aerodynamics.Cd}
                onChange={(e) => handleCarFormChange('aerodynamics', 'Cd', e.target.value)}
              />
              <FormInput
                label="Frontal Area (m²)"
                value={carFormData.aerodynamics.frontal_area}
                onChange={(e) => handleCarFormChange('aerodynamics', 'frontal_area', e.target.value)}
              />
              <FormInput
                label="Air Density (kg/m³)"
                value={carFormData.aerodynamics.air_density}
                onChange={(e) => handleCarFormChange('aerodynamics', 'air_density', e.target.value)}
              />
            </CollapsibleSection>

            {/* Tire Section */}
            <CollapsibleSection title="Tires" icon={ToyBrick}>
              <FormInput
                label="Mu X (Long. Grip)"
                value={carFormData.tire.mu_x}
                onChange={(e) => handleCarFormChange('tire', 'mu_x', e.target.value)}
              />
              <FormInput
                label="Mu Y (Lat. Grip)"
                value={carFormData.tire.mu_y}
                onChange={(e) => handleCarFormChange('tire', 'mu_y', e.target.value)}
              />
              <FormInput
                label="Load Sensitivity"
                value={carFormData.tire.load_sensitivity}
                onChange={(e) => handleCarFormChange('tire', 'load_sensitivity', e.target.value)}
              />
              <FormInput
                label="Tire Radius (m)"
                value={carFormData.tire.tire_radius}
                onChange={(e) => handleCarFormChange('tire', 'tire_radius', e.target.value)}
              />
            </CollapsibleSection>

            {/* Powertrain Section */}
            <CollapsibleSection title="Powertrain" defaultOpen={false} icon={Cog}>
              <FormInput
                label="Final Drive"
                value={carFormData.powertrain.final_drive}
                onChange={(e) => handleCarFormChange('powertrain', 'final_drive', e.target.value)}
              />
              <FormInput
                label="Efficiency"
                value={carFormData.powertrain.efficiency}
                onChange={(e) => handleCarFormChange('powertrain', 'efficiency', e.target.value)}
              />
              <FormInput
                label="Max RPM"
                value={carFormData.powertrain.max_rpm}
                onChange={(e) => handleCarFormChange('powertrain', 'max_rpm', e.target.value)}
              />
              <FormInput
                label="Min RPM"
                value={carFormData.powertrain.min_rpm}
                onChange={(e) => handleCarFormChange('powertrain', 'min_rpm', e.target.value)}
              />
            </CollapsibleSection>

            {/* Brake Section */}
            <CollapsibleSection title="Brakes" icon={PanelTop}>
              <FormInput
                label="Max Brake Force (N)"
                value={carFormData.brake.max_brake_force}
                onChange={(e) => handleCarFormChange('brake', 'max_brake_force', e.target.value)}
              />
              <FormInput
                label="Brake Bias (front %)"
                value={carFormData.brake.brake_bias}
                onChange={(e) => handleCarFormChange('brake', 'brake_bias', e.target.value)}
              />
            </CollapsibleSection>
          </div>
        </div>
      )}
    </div>
  );
};

export default CarsPage;
