import { useState, useEffect } from 'react';

function useCountUp(target, duration = 1000, key) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    let startTime = null;
    let animationFrame;

    const animate = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.floor(eased * target));
      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [target, duration, key]);

  return value;
}

export const AnimatedNumber = ({ value, format, className, style }) => {
  const count = useCountUp(value, 1000, value);

  return (
    <span className={className} style={style}>
      {format ? format(count) : count}
    </span>
  );
};

export default AnimatedNumber;
