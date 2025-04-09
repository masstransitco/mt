"use client"

import { useState, useRef } from 'react'

/**
 * A simple hook for tracking video load states
 * 
 * @deprecated Use the self-contained Card component from PickupGuide instead
 */
export function useVideoPreload(videoUrls: string[]) {
  // For backward compatibility: return mock structure
  // New components should use the self-contained Card pattern instead
  const [loadedVideos] = useState<Record<string, boolean>>({})
  const videosRef = useRef<Record<string, HTMLVideoElement>>({})
  
  return { loadedVideos, videosRef }
}