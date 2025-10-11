const FormInput = ({ label, value, onChange, type = "number", step = "0.01" }) => (
  <div className="space-y-2">
    <label className="block text-sm font-medium text-gray-400">{label}</label>
    <input
      type={type}
      step={step}
      value={value}
      onChange={onChange}
      className="w-full bg-black/30 border border-white/10 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all text-gray-200"
    />
  </div>
);

export default FormInput;


