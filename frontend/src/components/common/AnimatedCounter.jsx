import { useState, useEffect, useRef } from 'react';

const AnimatedCounter = ({ value, duration = 2000 }) => {
  const [count, setCount] = useState(0);
  const hasAnimated = useRef(false);
  const animationRef = useRef(null);
  const previousValue = useRef(null);

  useEffect(() => {
    if (!value) return;

    const targetValue = parseFloat(value);
    
    // If value changed, reset the animation flag
    if (previousValue.current !== targetValue) {
      hasAnimated.current = false;
      previousValue.current = targetValue;
    }
    
    // If we've already animated to this value, just set it and return
    if (hasAnimated.current) {
      setCount(targetValue);
      return;
    }

    // Mark that we're animating to this value
    hasAnimated.current = true;
    
    const start = 0;
    const startTime = Date.now();

    const animate = () => {
      const now = Date.now();
      const progress = Math.min((now - startTime) / duration, 1);
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      const currentValue = start + (targetValue - start) * easeOutQuart;
      
      setCount(currentValue);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        setCount(targetValue); // Ensure we end exactly at target value
        animationRef.current = null;
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    // Cleanup function to cancel animation if component unmounts
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [value, duration]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  return <span>{formatTime(count)}</span>;
};

export default AnimatedCounter;

