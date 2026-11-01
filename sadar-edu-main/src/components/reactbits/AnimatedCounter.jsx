import { useEffect, useRef } from "react";
import { motion, useInView, useMotionValue, useSpring } from "framer-motion";

export default function AnimatedCounter({
  from = 0,
  to,
  animationOptions,
  className = "",
}) {
  const ref = useRef(null);
  const motionValue = useMotionValue(from);
  const springValue = useSpring(motionValue, {
    damping: 30,
    stiffness: 100,
    ...animationOptions,
  });
  const isInView = useInView(ref, { once: true, margin: "0px" });

  useEffect(() => {
    if (isInView) {
      motionValue.set(to);
    }
  }, [motionValue, isInView, to]);

  useEffect(
    () =>
      springValue.on("change", (latest) => {
        if (ref.current) {
          ref.current.textContent = Intl.NumberFormat("id-ID").format(
            Math.floor(latest)
          );
        }
      }),
    [springValue]
  );

  return <span ref={ref} className={className} />;
}
