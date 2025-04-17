"use client";

import React, { useRef, useState, useEffect, useMemo, memo } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { VEHICLE_DIMENSIONS } from "@/lib/threeUtils";
import { OrbitControls, Environment, ContactShadows } from '@react-three/drei';
import { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import ModelManager from "@/lib/modelManager";

// Floor component with optimized Apple-inspired dark theme
export const Floor = memo(() => {
  // Create a simplified but visually appealing texture for better performance
  const floorTexture = useMemo(() => {
    // Smaller canvas for better performance
    const canvas = document.createElement('canvas');
    canvas.width = 128; // Reduced size
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    
    if (ctx) {
      // Simpler gradient background
      const gradient = ctx.createLinearGradient(0, 0, 128, 128);
      gradient.addColorStop(0, '#1a1a1a'); // Dark gray
      gradient.addColorStop(1, '#121212'); // Nearly black
      
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 128, 128);
      
      // Fewer grid lines for better performance
      ctx.strokeStyle = 'rgba(50, 50, 50, 0.1)';
      ctx.lineWidth = 1;
      
      // Draw fewer horizontal lines
      for (let i = 0; i <= 128; i += 32) {
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(128, i);
        ctx.stroke();
      }
      
      // Draw fewer vertical lines
      for (let i = 0; i <= 128; i += 32) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, 128);
        ctx.stroke();
      }
    }
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(8, 8); // Reduced repetition
    
    return texture;
  }, []);
  
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
      <planeGeometry args={[100, 100]} />
      <meshBasicMaterial // Using BasicMaterial instead of StandardMaterial for better performance
        map={floorTexture}
        color="#111111"
      />
    </mesh>
  );
});
Floor.displayName = "Floor";

// Parking spot component with clean blue rectangle only
export const ParkingSpot = memo(({ carDimensions = VEHICLE_DIMENSIONS.DEFAULT }: { carDimensions?: { width: number; length: number; height: number } }) => {
  // Apple iOS blue color for the lines
  const LINE_COLOR = '#0A84FF';
  
  // Apply a margin around the car to create a properly sized parking space
  const MARGIN_SIDE = VEHICLE_DIMENSIONS.PARKING_MARGIN_SIDE;
  const MARGIN_END = VEHICLE_DIMENSIONS.PARKING_MARGIN_END;
  
  // Standard parking space dimensions - slightly larger than the car
  const spotWidth = carDimensions.width + MARGIN_SIDE * 2;
  const spotLength = carDimensions.length + MARGIN_END * 2;
  
  // Calculate half dimensions for position
  const halfWidth = spotWidth / 2;
  const halfLength = spotLength / 2;
  
  // Static opacity for better performance
  const opacity = 0.8;
  
  // Material for the blue lines
  const lineMaterial = useMemo(() => {
    return new THREE.MeshBasicMaterial({
      color: LINE_COLOR,
      opacity: opacity,
      transparent: true,
    });
  }, []);
  
  // Create a simple blue rectangular parking spot
  return (
    <group position={[0, 0.001, 0]}>
      {/* Just the parking spot rectangle lines */}
      {[
        [0, 0, halfLength, spotWidth, 0.12], // Front line
        [0, 0, -halfLength, spotWidth, 0.12], // Back line
        [-halfWidth, 0, 0, spotLength, 0.12, Math.PI / 2], // Left line
        [halfWidth, 0, 0, spotLength, 0.12, Math.PI / 2] // Right line
      ].map((item, index) => (
        <mesh 
          key={`line-${index}`} 
          rotation={[-Math.PI / 2, 0, item[5] || 0]} 
          position={[item[0], item[1], item[2]]}
        >
          <planeGeometry args={[item[3], item[4]]} />
          <primitive object={lineMaterial} />
        </mesh>
      ))}
    </group>
  );
});
ParkingSpot.displayName = "ParkingSpot";

// Define CameraController props interface
interface CameraControllerProps {
  targetPosition: [number, number, number];
  lookAtOffset?: [number, number, number];
  onAnimationComplete?: () => void;
}

// Simple camera controller with auto-return on idle
export const CameraController = memo(({ 
  targetPosition, 
  lookAtOffset = [-3, 0.5, 0],
  onAnimationComplete 
}: CameraControllerProps) => {
  const { camera, controls } = useThree((state) => ({
    camera: state.camera,
    controls: state.controls as unknown as OrbitControlsImpl
  }));
  
  // Store default position and look-at point
  const defaultPosition = useRef<[number, number, number]>(targetPosition);
  const defaultLookAt = useRef<[number, number, number]>([
    targetPosition[0] + lookAtOffset[0], 
    lookAtOffset[1], 
    targetPosition[2] + lookAtOffset[2]
  ]);
  
  // Track user interaction
  const lastInteraction = useRef(Date.now());
  const isReturning = useRef(false);
  
  // Update camera position and look-at point when targetPosition changes
  useEffect(() => {
    if (!camera || !controls) return;
    
    // Directly set camera position without animation
    camera.position.set(
      targetPosition[0],
      targetPosition[1],
      targetPosition[2]
    );
    
    // Set the controls target (where the camera is looking)
    const lookAtPoint: [number, number, number] = [
      targetPosition[0] + lookAtOffset[0],
      lookAtOffset[1],
      targetPosition[2] + lookAtOffset[2]
    ];
    
    controls.target.set(
      lookAtPoint[0],
      lookAtPoint[1],
      lookAtPoint[2]
    );
    
    // Update default positions
    defaultPosition.current = targetPosition;
    defaultLookAt.current = lookAtPoint;
    
    // Reset last interaction time to prevent immediate auto-return
    lastInteraction.current = Date.now();
    isReturning.current = false;
    
    // Log the camera update
    console.log("%c CAMERA POSITION UPDATED", "background: #2ecc71; color: white; padding: 4px; border-radius: 4px;");
    
    // Call animation complete callback immediately since there's no animation
    if (onAnimationComplete) {
      setTimeout(() => {
        onAnimationComplete();
      }, 50); // Small delay to ensure the camera update has been processed
    }
    
  }, [camera, controls, targetPosition, lookAtOffset, onAnimationComplete]);
  
  // Track user interaction with controls
  useEffect(() => {
    if (!controls) return;
    
    // Event handlers
    const handleStart = () => {
      lastInteraction.current = Date.now();
      isReturning.current = false;
    };
    
    // Add event listeners to orbit controls
    controls.addEventListener('start', handleStart);
    
    return () => {
      controls.removeEventListener('start', handleStart);
    };
  }, [controls]);
  
  // Animation frame for handling automatic return to default position
  useFrame(() => {
    if (!controls || !camera) return;
    
    // Handle automatic return to default after user interaction
    const now = Date.now();
    const idleTime = now - lastInteraction.current;
    
    // If idle for more than 1.5 seconds and not already returning, start returning to default
    if (idleTime > 1500 && !isReturning.current) {
      isReturning.current = true;
    }
    
    // Return to default position
    if (isReturning.current) {
      // Get current positions
      const currentPos = new THREE.Vector3().copy(camera.position);
      const currentTarget = new THREE.Vector3().copy(controls.target);
      
      // Get target positions
      const [x, y, z] = defaultPosition.current;
      const targetPos = new THREE.Vector3(x, y, z);
      
      const [lookX, lookY, lookZ] = defaultLookAt.current;
      const targetLook = new THREE.Vector3(lookX, lookY, lookZ);
      
      // Calculate distance to target
      const posDistance = currentPos.distanceTo(targetPos);
      const targetDistance = currentTarget.distanceTo(targetLook);
      
      // If close enough, stop returning
      if (posDistance < 0.01 && targetDistance < 0.01) {
        isReturning.current = false;
        return;
      }
      
      // Smoothly interpolate (2% per frame for gentle motion)
      camera.position.lerp(targetPos, 0.02);
      controls.target.lerp(targetLook, 0.02);
    }
  });
  
  return null;
});
CameraController.displayName = "CameraController";

// Define SceneSetup props interface
interface SceneSetupProps {
  children: React.ReactNode;
  interactive?: boolean;
}

// Scene setup with floor and shadows
export const SceneSetup = memo(({ 
  children,
  interactive = false
}: SceneSetupProps) => {
  return (
    <>
      <Floor />
      <ContactShadows
        position={[0, 0.002, 0]}
        opacity={0.7}
        scale={40}
        blur={2}
        far={10}
        resolution={interactive ? 128 : 64}
      />
      <Environment preset="city" background={false} />
      <directionalLight
        position={[3, 5, 3]}
        intensity={0.8}
        castShadow={interactive}
      />
      <ambientLight intensity={0.5} />
      {children}
    </>
  );
});
SceneSetup.displayName = "SceneSetup";

// FallbackCar with optimized Apple-inspired design for when model fails to load
export const FallbackCar = memo(() => {
  // Apple-inspired materials with simplified rendering properties
  const bodyMaterial = useMemo(() => new THREE.MeshBasicMaterial({ 
    color: "#1c1c1e" // Apple dark UI color
  }), []);
  
  const accentMaterial = useMemo(() => new THREE.MeshBasicMaterial({ 
    color: "#0A84FF" // Apple iOS blue
  }), []);
  
  const glassMaterial = useMemo(() => new THREE.MeshBasicMaterial({ 
    color: "#8A8A8E",
    transparent: true, 
    opacity: 0.7 
  }), []);
  
  const wheelMaterial = useMemo(() => new THREE.MeshBasicMaterial({ 
    color: "#2c2c2e"
  }), []);
  
  return (
    <group rotation={[0, Math.PI, 0] as [number, number, number]} scale={[1, 1, 1] as [number, number, number]}>
      {/* Car body - simplified */}
      <mesh position={[0, 0.25, 0] as [number, number, number]}>
        <boxGeometry args={[4, 0.5, 1.8]} />
        <primitive object={bodyMaterial} />
      </mesh>
      
      {/* Car cabin - simplified */}
      <mesh position={[0.1, 0.6, 0] as [number, number, number]}>
        <boxGeometry args={[2.6, 0.4, 1.5]} />
        <primitive object={bodyMaterial} />
      </mesh>
      
      {/* Car accent strip */}
      <mesh position={[0, 0.35, 0] as [number, number, number]}>
        <boxGeometry args={[4.1, 0.05, 1.81]} />
        <primitive object={accentMaterial} />
      </mesh>
      
      {/* Wheels - simplified with fewer segments */}
      {[
        [1.4, 0, 0.9] as [number, number, number], 
        [-1.4, 0, 0.9] as [number, number, number], 
        [1.4, 0, -0.9] as [number, number, number], 
        [-1.4, 0, -0.9] as [number, number, number]
      ].map((pos, index) => (
        <mesh key={`wheel-${index}`} position={pos} rotation={[Math.PI / 2, 0, 0] as [number, number, number]}>
          <cylinderGeometry args={[0.35, 0.35, 0.2, 8]} /> {/* Reduced segments from 16 to 8 */}
          <primitive object={wheelMaterial} />
        </mesh>
      ))}
      
      {/* Front windshield */}
      <mesh position={[0.8, 0.65, 0] as [number, number, number]} rotation={[0, 0, -0.2] as [number, number, number]}>
        <boxGeometry args={[0.7, 0.35, 1.45]} />
        <primitive object={glassMaterial} />
      </mesh>
      
      {/* Headlights - just the accent color elements that are important */}
      {[
        [1.95, 0.35, 0.6] as [number, number, number],
        [1.95, 0.35, -0.6] as [number, number, number]
      ].map((pos, index) => (
        <mesh key={`headlight-${index}`} position={pos}>
          <boxGeometry args={[0.1, 0.15, 0.3]} />
          <primitive object={accentMaterial} />
        </mesh>
      ))}
    </group>
  );
});
FallbackCar.displayName = "FallbackCar";