import { useState, useEffect } from 'react';
import { Plus, Save, Thermometer, Wind, ToyBrick, Cog, PanelTop, Car, Trash2 } from 'lucide-react';
import FormInput from '../common/FormInput';
import CollapsibleSection from '../common/CollapsibleSection';
import { getBlankCar } from '../../utils/defaultData';

const CarsPage = ({ cars, setCars, selectedCar, setSelectedCar }) => {
  const [carFormData, setCarFormData] = useState(selectedCar);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (selectedCar) {
      setCarFormData(JSON.parse(JSON.stringify(selectedCar))); // Deep copy
      setIsCreating(false);
    } else {
      setCarFormData(getBlankCar());
      setIsCreating(true);
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

  const handleSaveCar = () => {
    const existingCarIndex = cars.findIndex(c => c.id === carFormData.id);
    if (existingCarIndex > -1) {
      const updatedCars = [...cars];
      updatedCars[existingCarIndex] = carFormData;
      setCars(updatedCars);
    } else {
      setCars([...cars, carFormData]);
    }
    setSelectedCar(carFormData);
    setIsCreating(false);
  };

  const handleCreateNew = () => {
    setSelectedCar(null);
    setIsCreating(true);
  };

  const handleSelectCar = (car) => {
    setSelectedCar(car);
    setIsCreating(false);
  };

  const handleDeleteCar = (carId, e) => {
    e.stopPropagation();
    if (cars.length <= 1) {
      alert('You must have at least one car!');
      return;
    }
    const newCars = cars.filter(c => c.id !== carId);
    setCars(newCars);
    if (selectedCar?.id === carId) {
      setSelectedCar(newCars[0]);
    }
  };

  if (!carFormData) return null;

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
        {cars.map(car => (
          <div
            key={car.id}
            onClick={() => handleSelectCar(car)}
            className={`relative group cursor-pointer transition-all duration-300 transform hover:scale-105 ${
              selectedCar?.id === car.id && !isCreating
                ? 'ring-2 ring-cyan-500'
                : ''
            }`}
          >
            <div className="card-gradient h-full p-6 text-center hover:bg-white/10">
              {/* Delete Button */}
              {cars.length > 1 && (
                <button
                  onClick={(e) => handleDeleteCar(car.id, e)}
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-2 rounded-lg bg-red-500/20 hover:bg-red-500/40 text-red-400"
                >
                  <Trash2 size={16} />
                </button>
              )}
              
              {/* Car Icon */}
              <div className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${
                selectedCar?.id === car.id && !isCreating
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600'
                  : 'bg-white/10'
              }`}>
                <Car className={selectedCar?.id === car.id && !isCreating ? 'text-white' : 'text-cyan-400'} size={32} />
              </div>

              {/* Car Name */}
              <h3 className="text-xl font-bold text-white mb-2">{car.name}</h3>

              {/* Quick Stats */}
              <div className="space-y-1 text-sm text-gray-400">
                <p>Mass: {car.mass.mass} kg</p>
                <p>Power: {(car.powertrain.engine_torque_curve['11000'] || 0)} Nm</p>
                <p>Drag: {car.aerodynamics.Cd}</p>
              </div>

              {/* Selection Indicator */}
              {selectedCar?.id === car.id && !isCreating && (
                <div className="mt-4 text-cyan-400 text-sm font-semibold">
                  ✓ Selected
                </div>
              )}
            </div>
          </div>
        ))}

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
      {(selectedCar || isCreating) && (
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
              className="flex items-center gap-2 px-6 py-3 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white transition-all font-semibold shadow-lg shadow-cyan-500/30 transform hover:scale-105"
            >
              <Save size={18} />
              {isCreating ? 'Create Vehicle' : 'Save Changes'}
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
