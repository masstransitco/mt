"use client";

import { useState, useEffect, useMemo } from "react";
import * as THREE from "three";
import { VEHICLE_DIMENSIONS } from "@/lib/threeUtils";
import ModelManager from "@/lib/modelManager";

// Hook for loading and managing 3D car models
export function useModelLoader(modelUrl: string, isInteractive = false) {
  const [model, setModel] = useState<THREE.Group | null>(null);
  const [carDimensions, setCarDimensions] = useState(VEHICLE_DIMENSIONS.DEFAULT);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  
  // Create unselected material once
  const unselectedMaterial = useMemo(() => {
    return new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0.4,
      color: 0x888888,
    });
  }, []);
  
  // Load model effect
  useEffect(() => {
    if (!modelUrl) return;
    
    let mounted = true;
    const modelManager = ModelManager.getInstance();
    if (!modelManager) return;
    
    setLoading(true);
    setError(false);
    
    modelManager
      .getModel(modelUrl)
      .then((loadedModel) => {
        if (!mounted) return;
        
        // Clone model to avoid modifying cache
        const clonedModel = loadedModel.clone();
        
        // Apply appropriate rotation based on model type
        // kona.glb and defaultModel.glb need to be rotated 180 degrees differently
        if (modelUrl.includes('kona.glb') || modelUrl.includes('defaultModel.glb')) {
          // No rotation needed for these models as they're already facing the user
          clonedModel.rotation.y = 0;
        } else {
          // Standard rotation (facing backward) for other models
          clonedModel.rotation.y = Math.PI;
        }
        
        // Calculate model dimensions and scale to real-world size
        const box = new THREE.Box3().setFromObject(clonedModel);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        
        // Find the longest dimension (usually length for cars)
        const isWidthLonger = size.x > size.z;
        const maxDimension = Math.max(size.x, size.z);
        
        // Calculate uniform scale factor based on target vehicle length
        const scaleFactor = VEHICLE_DIMENSIONS.TARGET_LENGTH / maxDimension;
        
        // Apply uniform scaling to normalize size
        clonedModel.scale.set(scaleFactor, scaleFactor, scaleFactor);
        
        // Re-compute bounding box after scaling for accurate positioning
        const scaledBox = new THREE.Box3().setFromObject(clonedModel);
        const scaledCenter = scaledBox.getCenter(new THREE.Vector3());
        
        // Center model horizontally and position at ground level
        clonedModel.position.set(
          -scaledCenter.x,           // Center on X axis
          -scaledBox.min.y,          // Align bottom with ground
          -scaledCenter.z            // Center on Z axis
        );
        
        // Calculate real-world dimensions of the scaled model
        const scaledSize = scaledBox.getSize(new THREE.Vector3());
        const dimensions = {
          width: isWidthLonger ? scaledSize.z : scaledSize.x,
          length: isWidthLonger ? scaledSize.x : scaledSize.z,
          height: scaledSize.y
        };
        setCarDimensions(dimensions);
        
        // Store original materials and ensure model is visible
        clonedModel.visible = true;
        clonedModel.traverse(child => {
          if ((child as THREE.Mesh).isMesh) {
            // Store original material
            child.visible = true;
            
            const isGlass = 
              child.name.toLowerCase().includes('glass') || 
              child.name.toLowerCase().includes('window');
            
            child.userData.isGlass = isGlass;
            
            const meshChild = child as THREE.Mesh;
            if (meshChild.material) {
              // Handle both single materials and material arrays
              if (Array.isArray(meshChild.material)) {
                // For material arrays, store an array of cloned materials
                child.userData.originalMaterial = meshChild.material.map(mat => mat.clone());
              } else {
                // For single material, clone it directly
                child.userData.originalMaterial = meshChild.material.clone();
                
                // Apply glass properties if needed
                if (isGlass) {
                  const glassMaterial = child.userData.originalMaterial;
                  glassMaterial.transparent = true;
                  glassMaterial.opacity = 0.7;
                }
              }
            }
          }
        });
        
        setModel(clonedModel);
        setLoading(false);
      })
      .catch((err) => {
        if (!mounted) return;
        console.error(`Error loading model: ${modelUrl}`, err);
        setError(true);
        setLoading(false);
      });
    
    return () => {
      mounted = false;
      if (modelManager && modelUrl) {
        modelManager.releaseModel(modelUrl);
      }
    };
  }, [modelUrl]);
  
  // Update model's interactive state
  useEffect(() => {
    if (!model) return;
    
    model.traverse(child => {
      if ((child as THREE.Mesh).isMesh) {
        const meshChild = child as THREE.Mesh;
        // Always set shadow properties based on selection
        meshChild.castShadow = isInteractive;
        meshChild.receiveShadow = isInteractive;
        
        // Apply materials based on selection state
        if (isInteractive) {
          // Selected cars use their original materials
          if (child.userData.originalMaterial) {
            // Handle both single materials and material arrays
            meshChild.material = child.userData.originalMaterial;
          }
        } else {
          // Unselected cars use the shared unselected material
          meshChild.material = unselectedMaterial;
        }
        
        // Make sure materials update
        if (meshChild.material) {
          if (Array.isArray(meshChild.material)) {
            // Update each material in the array
            meshChild.material.forEach(mat => {
              mat.needsUpdate = true;
            });
          } else {
            // Update single material
            meshChild.material.needsUpdate = true;
          }
        }
      }
    });
    
    // Force material update and matrix recalculation
    model.updateMatrixWorld(true);
    
  }, [isInteractive, model, unselectedMaterial]);
  
  return { model, carDimensions, loading, error };
}

export default useModelLoader;