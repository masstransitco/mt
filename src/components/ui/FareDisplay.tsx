"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"

interface FareDisplayProps {
  baseFare?: number;
  currency?: string;
  perMinuteRate?: number;
}

export default function FareDisplay({
  baseFare = 50.00,
  currency = "HKD",
  perMinuteRate = 1
}: FareDisplayProps) {
  return (
    <div className="flex flex-col items-center justify-center">
      <AnimatedFareHeader 
        baseFare={baseFare} 
        currency={currency} 
        perMinuteRate={perMinuteRate} 
      />
    </div>
  )
}

interface AnimatedFareHeaderProps {
  baseFare: number;
  currency: string;
  perMinuteRate: number;
}

function AnimatedFareHeader({ baseFare, currency, perMinuteRate }: AnimatedFareHeaderProps) {
  return (
    <motion.div initial="hidden" animate="visible" className="flex flex-col items-start w-full max-w-md mx-auto">
      {/* Starting fare label with blue illumination animation */}
      <motion.div
        variants={{
          hidden: { opacity: 0, x: -10 },
          visible: {
            opacity: 1,
            x: 0,
            transition: { delay: 0.3, duration: 0.5 },
          },
        }}
        className="text-gray-400 text-sm font-medium relative self-start ml-1 mb-2"
      >
        <motion.span
          initial={{ color: "rgb(156 163 175)" }}
          animate={{
            color: ["rgb(156 163 175)", "rgb(59 130 246)", "rgb(156 163 175)"],
            textShadow: [
              "0 0 0px rgba(59, 130, 246, 0)",
              "0 0 8px rgba(59, 130, 246, 0.5)",
              "0 0 0px rgba(59, 130, 246, 0)",
            ],
          }}
          transition={{
            duration: 3,
            repeat: Number.POSITIVE_INFINITY,
            repeatType: "reverse",
            ease: "easeInOut",
            times: [0, 0.5, 1],
          }}
        >
          Starting fare:
        </motion.span>
      </motion.div>

      {/* Main fare row with HKD $50.00 and $1/minute */}
      <motion.div
        variants={{
          hidden: { opacity: 0 },
          visible: {
            opacity: 1,
            transition: {
              delay: 0.5,
              duration: 0.5,
            },
          },
        }}
        className="flex items-center justify-between w-full bg-[#1D1D1D] px-5 py-4 rounded-xl shadow-xl border border-[#2A2A2A]"
      >
        {/* Left side - HKD $50.00 */}
        <div className="flex items-center">
          <span className="text-[#5A5A5A] text-2xl font-medium flex items-center mr-1.5">{currency}</span>
          <FlippingAmount value={baseFare.toFixed(2)} prefix="$" />
        </div>

        {/* Right side - $1/min here after */}
        <div className="flex items-center">
          <TypewriterText text={`$${perMinuteRate} / min here after`} delay={1.5} typingSpeed={50} />
        </div>
      </motion.div>
    </motion.div>
  )
}

interface TypewriterTextProps {
  text: string;
  delay?: number;
  typingSpeed?: number;
}

function TypewriterText({ text, delay = 0, typingSpeed = 50 }: TypewriterTextProps) {
  const [displayText, setDisplayText] = useState("")

  useEffect(() => {
    let timeout: NodeJS.Timeout;
    let currentIndex = 0;

    const startTyping = () => {
      timeout = setTimeout(() => {
        if (currentIndex <= text.length) {
          setDisplayText(text.substring(0, currentIndex));
          currentIndex++;
          startTyping();
        }
      }, typingSpeed);
    };

    const delayTimeout = setTimeout(() => {
      startTyping();
    }, delay * 1000);

    return () => {
      clearTimeout(timeout);
      clearTimeout(delayTimeout);
    };
  }, [text, delay, typingSpeed]);

  return (
    <div className="flex text-sm">
      <span className="text-gray-400 font-medium">{displayText.startsWith("$1") ? "$1" : ""}</span>
      <span className="text-gray-500">{displayText.startsWith("$1") ? displayText.substring(2) : displayText}</span>
      <span className="animate-pulse ml-0.5 opacity-60">|</span>
    </div>
  );
}

interface FlippingAmountProps {
  value: string;
  prefix?: string;
}

function FlippingAmount({ value, prefix = "" }: FlippingAmountProps) {
  // Split the value into individual digits
  const digits = (prefix + value).split("");

  return (
    <div className="flex">
      {digits.map((digit, index) => {
        // For non-numeric characters like $ and ., we don't use the flip animation
        if (isNaN(Number.parseInt(digit)) && digit !== ".") {
          return (
            <div key={index} className="flex items-center justify-center mx-0.5 text-white font-mono text-2xl">
              {digit}
            </div>
          );
        }

        return <FlipDigit key={index} value={digit} delay={100 + index * 150} />;
      })}
    </div>
  );
}

interface FlipDigitProps {
  value: string;
  delay: number;
}

function FlipDigit({ value, delay }: FlipDigitProps) {
  const [flipped, setFlipped] = useState(false);
  const [glowing, setGlowing] = useState(false);

  useEffect(() => {
    const flipTimer = setTimeout(() => {
      setFlipped(true);

      // Add glow effect after flip completes
      setTimeout(() => {
        setGlowing(true);

        // Remove glow effect after a short duration
        setTimeout(() => {
          setGlowing(false);
        }, 600);
      }, 300);
    }, delay);

    return () => clearTimeout(flipTimer);
  }, [delay]);

  // Special case for decimal point - render it differently
  if (value === ".") {
    return <div className="flex items-center justify-center mx-0.5 text-white font-mono text-2xl">{value}</div>;
  }

  return (
    <div className="relative h-14 w-9 mx-0.5">
      {/* Shadow element */}
      <div className="absolute inset-0 rounded-md bg-black opacity-30 blur-md transform translate-y-1 scale-95"></div>

      {/* Glow effect */}
      <AnimatePresence>
        {glowing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.6 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 rounded-md bg-[#1FBAD6] blur-md z-0"
          />
        )}
      </AnimatePresence>

      {/* Top half (static) */}
      <div className="absolute inset-0 bottom-1/2 bg-[#1A1A1A] rounded-t-md border-t border-l border-r border-[#2A2A2A] overflow-hidden">
        <div
          className="absolute inset-0 flex items-center justify-center text-white font-mono text-2xl font-medium"
          style={{ transform: "translateY(50%)" }}
        >
          {value}
        </div>
      </div>

      {/* Bottom half (animated) */}
      <motion.div
        initial={{ rotateX: -90 }}
        animate={flipped ? { rotateX: 0 } : {}}
        transition={{
          type: "spring",
          stiffness: 300,
          damping: 30,
          delay: delay / 1000,
        }}
        className="absolute inset-0 top-1/2 bg-[#1A1A1A] rounded-b-md border-b border-l border-r border-[#2A2A2A] overflow-hidden origin-top"
        style={{ backfaceVisibility: "hidden" }}
      >
        <div
          className="absolute inset-0 flex items-center justify-center text-white font-mono text-2xl font-medium"
          style={{ transform: "translateY(-50%)" }}
        >
          {value}
        </div>

        {/* Subtle gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#1FBAD6] to-transparent opacity-5"></div>
      </motion.div>

      {/* Divider line */}
      <div className="absolute top-1/2 left-0 right-0 h-[1px] bg-[#2A2A2A] z-10"></div>
    </div>
  );
}