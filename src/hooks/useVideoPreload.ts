"use client"

import { useEffect, useState, useRef } from 'react'

interface VideoPreloadOptions {
  /** Cache videos to prevent reloading */
  cacheVideos?: boolean
  /** Apply specific optimizations for WebM format */
  optimizeWebM?: boolean
}

/**
 * Custom hook to preload and optimize video playback
 * Especially useful for WebM video formats which can have playback issues
 */
export function useVideoPreload(
  videoUrls: string[],
  options: VideoPreloadOptions = {}
) {
  const { cacheVideos = true, optimizeWebM = true } = options
  const [loadedVideos, setLoadedVideos] = useState<Record<string, boolean>>({})
  const videosRef = useRef<Record<string, HTMLVideoElement>>({})

  useEffect(() => {
    // Skip if no videos to preload
    if (!videoUrls.length) return
    
    const videoCache: Record<string, HTMLVideoElement> = {}
    let mounted = true
    
    const preloadVideo = async (videoUrl: string) => {
      try {
        // Create video element for preloading
        const video = document.createElement('video')
        
        // Apply WebM-specific optimizations
        if (optimizeWebM && videoUrl.endsWith('.webm')) {
          // Force hardware acceleration when available
          video.style.transform = 'translateZ(0)'
          video.style.willChange = 'transform'
          
          // Force higher quality decoding
          video.style.imageRendering = 'high-quality'
        }
        
        // Setup video element
        video.muted = true
        video.autoplay = false
        video.preload = 'auto'
        video.playsInline = true
        video.src = videoUrl
        
        // Optimize video loading
        await new Promise<void>((resolve) => {
          // Handle successful loading
          video.oncanplaythrough = () => {
            // Pause to prevent unnecessary resource usage
            video.pause()
            if (mounted) {
              setLoadedVideos(prev => ({ ...prev, [videoUrl]: true }))
              
              // Cache the video element if caching is enabled
              if (cacheVideos) {
                videoCache[videoUrl] = video
              }
            }
            resolve()
          }
          
          // Handle load errors
          video.onerror = () => {
            console.error(`Failed to preload video: ${videoUrl}`)
            resolve()
          }
          
          // Force load attempt
          video.load()
        })
      } catch (err) {
        console.error(`Error preloading video ${videoUrl}:`, err)
      }
    }
    
    // Preload all videos concurrently
    Promise.all(videoUrls.map(preloadVideo))
    
    // Save cache reference
    if (cacheVideos) {
      videosRef.current = videoCache
    }
    
    // Cleanup
    return () => {
      mounted = false
      
      // Clean up cached videos
      if (cacheVideos) {
        Object.values(videoCache).forEach(video => {
          video.src = ''
          video.load()
        })
      }
    }
  }, [videoUrls, cacheVideos, optimizeWebM])
  
  return { loadedVideos, videosRef }
}