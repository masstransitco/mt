import { useEffect, useState } from 'react';
import { useCameraAnimation } from '@/hooks/useCameraAnimation';
import { logger, LOG_LEVELS } from '@/lib/logger';

/**
 * Simplified animation debugger component that shows if camera animation is active
 * Only displayed in development environment
 */
export function AnimationDebugger() {
  const { isAnimating } = useCameraAnimation();
  const [inDevMode, setInDevMode] = useState(false);
  const [logLevel, setLogLevel] = useState<number>(LOG_LEVELS.INFO);
  
  useEffect(() => {
    // Only show in development
    setInDevMode(process.env.NODE_ENV === 'development');
  }, []);
  
  // Update log level state when it changes
  useEffect(() => {
    const checkLogLevel = () => {
      const currentLevel = logger.getLevel();
      setLogLevel(currentLevel);
    };
    
    // Initial check
    checkLogLevel();
    
    // Setup an interval to check for changes
    const intervalId = setInterval(checkLogLevel, 1000);
    
    return () => clearInterval(intervalId);
  }, []);
  
  // Function to toggle log level
  const toggleLogLevel = () => {
    const newLevel = logLevel === LOG_LEVELS.DEBUG ? LOG_LEVELS.INFO : LOG_LEVELS.DEBUG;
    logger.setLevel(newLevel);
    setLogLevel(newLevel);
  };
  
  // Get log level name
  const getLogLevelName = (level: number): string => {
    return Object.keys(LOG_LEVELS).find(key => 
      LOG_LEVELS[key as keyof typeof LOG_LEVELS] === level
    ) || 'UNKNOWN';
  };
  
  if (!inDevMode) {
    return null;
  }
  
  return (
    <div className="fixed bottom-0 right-0 bg-black/80 text-white p-2 text-xs max-w-xs overflow-auto max-h-40 z-50">
      <div>Camera animation active: {isAnimating ? 'Yes' : 'No'}</div>
      <div>
        Log level: {getLogLevelName(logLevel)} 
        <button 
          className="ml-2 bg-blue-500 hover:bg-blue-700 text-white font-bold py-0 px-2 rounded text-xs"
          onClick={toggleLogLevel}
        >
          Toggle
        </button>
        <div className="text-gray-400 text-[10px]">Shortcut: Ctrl+Shift+D</div>
      </div>
    </div>
  );
}