const LoadingSkeleton = ({ className = '', variant = 'default' }) => {
  const variants = {
    default: 'h-4 w-full',
    title: 'h-8 w-3/4',
    subtitle: 'h-6 w-1/2',
    card: 'h-64 w-full',
    chart: 'h-96 w-full',
    circle: 'h-12 w-12 rounded-full',
    stat: 'h-24 w-full'
  };

  return (
    <div className={`animate-pulse bg-gradient-to-r from-gray-800/50 via-gray-700/50 to-gray-800/50 rounded-lg ${variants[variant]} ${className}`}>
      <div className="h-full w-full bg-gradient-to-r from-transparent via-gray-600/20 to-transparent animate-shimmer" />
    </div>
  );
};

export const ChartSkeleton = () => (
  <div className="bg-gradient-to-br from-gray-900/50 to-gray-800/30 backdrop-blur-sm border border-gray-700/50 rounded-xl p-6 space-y-4">
    <LoadingSkeleton variant="subtitle" />
    <LoadingSkeleton variant="chart" />
  </div>
);

export const StatsSkeleton = () => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
    {[...Array(6)].map((_, i) => (
      <LoadingSkeleton key={i} variant="stat" />
    ))}
  </div>
);

export const PageSkeleton = () => (
  <div className="space-y-6 animate-fadeIn">
    <LoadingSkeleton variant="title" className="mb-8" />
    <StatsSkeleton />
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {[...Array(4)].map((_, i) => (
        <ChartSkeleton key={i} />
      ))}
    </div>
  </div>
);

export default LoadingSkeleton;

