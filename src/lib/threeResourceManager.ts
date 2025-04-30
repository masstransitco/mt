import * as THREE from "three";

/**
 * Resource manager for THREE.js resources with reference counting.
 * Manages geometries, materials, and textures to avoid memory leaks.
 */
class ThreeResourceManager {
  private geometries: Map<string, THREE.BufferGeometry> = new Map();
  private materials: Map<string, THREE.Material> = new Map();
  private textures: Map<string, THREE.Texture> = new Map();
  private refCounts: Map<string, number> = new Map();

  /**
   * Retrieves a geometry from the cache or creates a new one using the factory function.
   * @param key Unique identifier for the geometry
   * @param factory Function that creates the geometry if not found in cache
   * @returns The cached or newly created geometry
   */
  getGeometry(key: string, factory: () => THREE.BufferGeometry): THREE.BufferGeometry {
    if (this.geometries.has(key)) {
      this.incrementRefCount(key);
      return this.geometries.get(key)!;
    }
    
    const geometry = factory();
    this.geometries.set(key, geometry);
    this.refCounts.set(key, 1);
    return geometry;
  }

  /**
   * Retrieves a material from the cache or creates a new one using the factory function.
   * @param key Unique identifier for the material
   * @param factory Function that creates the material if not found in cache
   * @returns The cached or newly created material
   */
  getMaterial(key: string, factory: () => THREE.Material): THREE.Material {
    if (this.materials.has(key)) {
      this.incrementRefCount(key);
      return this.materials.get(key)!;
    }
    
    const material = factory();
    this.materials.set(key, material);
    this.refCounts.set(key, 1);
    return material;
  }

  /**
   * Retrieves a texture from the cache or creates a new one using the factory function.
   * @param key Unique identifier for the texture
   * @param factory Function that creates the texture if not found in cache
   * @returns The cached or newly created texture
   */
  getTexture(key: string, factory: () => THREE.Texture): THREE.Texture {
    if (this.textures.has(key)) {
      this.incrementRefCount(key);
      return this.textures.get(key)!;
    }
    
    const texture = factory();
    this.textures.set(key, texture);
    this.refCounts.set(key, 1);
    return texture;
  }

  /**
   * Releases a geometry, decreasing its reference count.
   * If count reaches zero, the geometry is disposed.
   * @param key Unique identifier for the geometry
   */
  releaseGeometry(key: string): void {
    if (!this.geometries.has(key)) return;
    
    const count = this.decrementRefCount(key);
    if (count === 0) {
      const geometry = this.geometries.get(key)!;
      geometry.dispose();
      this.geometries.delete(key);
    }
  }

  /**
   * Releases a material, decreasing its reference count.
   * If count reaches zero, the material and its textures are disposed.
   * @param key Unique identifier for the material
   */
  releaseMaterial(key: string): void {
    if (!this.materials.has(key)) return;
    
    const count = this.decrementRefCount(key);
    if (count === 0) {
      const material = this.materials.get(key)!;
      this.disposeTextures(material);
      material.dispose();
      this.materials.delete(key);
    }
  }

  /**
   * Releases a texture, decreasing its reference count.
   * If count reaches zero, the texture is disposed.
   * @param key Unique identifier for the texture
   */
  releaseTexture(key: string): void {
    if (!this.textures.has(key)) return;
    
    const count = this.decrementRefCount(key);
    if (count === 0) {
      const texture = this.textures.get(key)!;
      texture.dispose();
      this.textures.delete(key);
    }
  }

  /**
   * Disposes all textures attached to a material.
   * @param material Material to clean up
   */
  private disposeTextures(material: THREE.Material): void {
    const textureProps = [
      'map', 'normalMap', 'bumpMap', 'emissiveMap', 'displacementMap',
      'specularMap', 'metalnessMap', 'roughnessMap', 'alphaMap', 'aoMap'
    ];
    
    textureProps.forEach(prop => {
      const texture = (material as any)[prop];
      if (texture && texture.isTexture) {
        texture.dispose();
      }
    });
  }

  /**
   * Increments the reference count for a resource.
   * @param key Unique identifier for the resource
   * @returns The new reference count
   */
  private incrementRefCount(key: string): number {
    const count = this.refCounts.get(key) || 0;
    this.refCounts.set(key, count + 1);
    return count + 1;
  }

  /**
   * Decrements the reference count for a resource.
   * @param key Unique identifier for the resource
   * @returns The new reference count
   */
  private decrementRefCount(key: string): number {
    const count = this.refCounts.get(key) || 1;
    const newCount = Math.max(0, count - 1);
    this.refCounts.set(key, newCount);
    return newCount;
  }

  /**
   * Disposes all resources managed by this instance.
   * Should be called on component unmount.
   */
  disposeAll(): void {
    // Clean up geometries
    this.geometries.forEach(geometry => geometry.dispose());
    this.geometries.clear();
    
    // Clean up materials
    this.materials.forEach(material => {
      this.disposeTextures(material);
      material.dispose();
    });
    this.materials.clear();
    
    // Clean up textures
    this.textures.forEach(texture => texture.dispose());
    this.textures.clear();
    
    // Clear reference counts
    this.refCounts.clear();
  }

  /**
   * Debug method to log the current state of managed resources.
   * Useful for tracking memory usage during development.
   */
  debugLog(): void {
    console.group("ThreeResourceManager State:");
    console.log(`Geometries: ${this.geometries.size}`);
    console.log(`Materials: ${this.materials.size}`);
    console.log(`Textures: ${this.textures.size}`);
    
    console.group("Reference counts:");
    this.refCounts.forEach((count, key) => {
      console.log(`${key}: ${count}`);
    });
    console.groupEnd();
    
    console.groupEnd();
  }
}

/**
 * Create a singleton instance of the resource manager
 */
const threeResourceManager = new ThreeResourceManager();

/**
 * React hook for using the ThreeResourceManager in components.
 * @returns The singleton ThreeResourceManager instance
 */
export function useThreeResourceManager() {
  return threeResourceManager;
}

export default threeResourceManager;