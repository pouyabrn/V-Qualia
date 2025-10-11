const DrivingStylePanel = ({ drivingStyleData }) => {
  if (!drivingStyleData) return null;

  return (
    <div className="card-gradient">
      <h3 className="text-xl font-semibold mb-6 text-cyan-300 text-center">
        Driving Style Analysis
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
        <div className="p-4 backdrop-blur-sm text-center rounded-xl border border-pink-500/50 bg-pink-500/10 flex flex-col justify-center items-center">
          <p className="text-sm text-gray-400">Aggressiveness</p>
          <p className="text-4xl font-bold text-white my-2">{drivingStyleData.aggressiveness}</p>
          <div className="w-full bg-gray-700 rounded-full h-2.5">
            <div
              className="bg-pink-500 h-2.5 rounded-full"
              style={{ width: `${drivingStyleData.aggressiveness}%` }}
            ></div>
          </div>
        </div>
        {drivingStyleData.stats.map(item => (
          <div
            key={item.label}
            className="p-4 backdrop-blur-sm text-center rounded-xl border"
            style={{
              backgroundColor: `${item.color}20`,
              borderColor: `${item.color}50`
            }}
          >
            <item.icon className="w-8 h-8 mx-auto mb-2" style={{ color: item.color }} />
            <p className="text-sm text-gray-400">{item.label}</p>
            <p className="text-2xl font-bold text-white">{item.value}</p>
            <p className="text-sm" style={{ color: item.color }}>
              {item.unit}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DrivingStylePanel;


