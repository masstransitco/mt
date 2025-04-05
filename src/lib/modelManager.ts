import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader';

type ModelCache = {
  model: THREE.Group;
  lastUsed: number;
  references: number;
};

class ModelManager {
  private static instance: ModelManager;
  private models: Map<string, ModelCache> = new Map();
  private loader: GLTFLoader;
  private loading: Map<string, Promise<THREE.Group>> = new Map();
  
  private constructor() {
    // Set up GLTF loader with Draco compression
    this.loader = new GLTFLoader();
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('/draco/');
    this.loader.setDRACOLoader(dracoLoader);
    
    // Enable THREE.Cache for textures
    THREE.Cache.enabled = true;
  }
  
  public static getInstance(): ModelManager {
    if (!ModelManager.instance) {
      ModelManager.instance = new ModelManager();
    }
    return ModelManager.instance;
  }
  
  public preloadModels(urls: string[]): void {
    urls.forEach(url => {
      this.getModel(url).catch(err => 
        console.warn(`Failed to preload model: ${url}`, err)
      );
    });
  }
  
  public async getModel(url: string): Promise<THREE.Group> {
    // If model is already cached, return it
    if (this.models.has(url)) {
      const cache = this.models.get(url)!;
      cache.lastUsed = Date.now();
      cache.references++;
      return cache.model.clone();
    }
    
    // If model is currently loading, wait for it
    if (this.loading.has(url)) {
      return (await this.loading.get(url)!).clone();
    }
    
    // Start loading the model
    const loadPromise = new Promise<THREE.Group>((resolve, reject) => {
      this.loader.load(
        url,
        (gltf) => {
          const model = gltf.scene;
          
          // Optimize the model once during loading
          model.traverse((child: THREE.Object3D) => {
            if (child instanceof THREE.Mesh) {
              if (!child.geometry.boundingBox) child.geometry.computeBoundingBox();
              if (!child.geometry.boundingSphere) child.geometry.computeBoundingSphere();
              
              // Optimize materials
              if (child.material instanceof THREE.MeshStandardMaterial) {
                child.material = child.material.clone();
                child.material.roughness = 0.4;
                child.material.metalness = 0.8;
              }
            }
          });
          
          // Cache the model
          this.models.set(url, {
            model: model.clone(),
            lastUsed: Date.now(),
            references: 1
          });
          
          this.loading.delete(url);
          resolve(model);
        },
        undefined,
        (error) => {
          this.loading.delete(url);
          reject(error);
        }
      );
    });
    
    this.loading.set(url, loadPromise);
    return loadPromise;
  }
  
  public releaseModel(url: string): void {
    if (this.models.has(url)) {
      const cache = this.models.get(url)!;
      cache.references--;
      
      // If no more references, mark for potential cleanup
      if (cache.references <= 0) {
        cache.lastUsed = Date.now();
      }
    }
  }
  
  public cleanUnusedModels(olderThanMs: number = 60000): void {
    const now = Date.now();
    
    for (const [url, cache] of this.models.entries()) {
      if (cache.references <= 0 && now - cache.lastUsed > olderThanMs) {
        // Dispose of geometries and materials
        cache.model.traverse((child: any) => {
          if (child instanceof THREE.Mesh) {
            child.geometry?.dispose();
            if (child.material) {
              if (Array.isArray(child.material)) {
                child.material.forEach((mat: THREE.Material) => mat.dispose());
              } else {
                child.material.dispose();
              }
            }
          }
        });
        
        this.models.delete(url);
        console.log(`[ModelManager] Released unused model: ${url}`);
      }
    }
  }
}

export default ModelManager;