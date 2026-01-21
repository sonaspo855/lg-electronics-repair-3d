import * as THREE from 'three';

// Easing function types
export type EasingFunction = (t: number) => number;

// Easing functions
export const easingFunctions = {
    // Ease in-out cubic
    easeInOutCubic: (t: number): number => {
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    },
    // Ease out cubic
    easeOutCubic: (t: number): number => {
        return 1 - Math.pow(1 - t, 3);
    },
    // Ease in cubic
    easeInCubic: (t: number): number => {
        return t * t * t;
    },
    // Linear
    linear: (t: number): number => {
        return t;
    }
};

// Animation options
export interface AnimationOptions {
    duration?: number; // milliseconds
    easing?: EasingFunction;
    onProgress?: (progress: number) => void;
}

// Promise-based smooth animation function
export const animate = (
    update: (progress: number, eased: number) => void,
    options: AnimationOptions = {}
): Promise<void> => {
    const duration = options.duration || 1000;
    const easing = options.easing || easingFunctions.easeInOutCubic;
    const startTime = performance.now();

    return new Promise((resolve) => {
        const step = (currentTime: number) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = easing(progress);

            update(progress, eased);

            if (options.onProgress) {
                options.onProgress(eased);
            }

            if (progress < 1) {
                requestAnimationFrame(step);
            } else {
                resolve();
            }
        };

        requestAnimationFrame(step);
    });
};

// Node caching utility
export class NodeCache {
    private cache: Map<string, THREE.Object3D> = new Map();

    /**
     * Find a node by name in the scene with caching
     */
    findNodeByName(sceneRoot: THREE.Object3D, nodeName: string): THREE.Object3D | null {
        if (this.cache.has(nodeName)) {
            return this.cache.get(nodeName)!;
        }

        let found: THREE.Object3D | null = null;
        sceneRoot.traverse((child) => {
            if (child.name === nodeName) {
                found = child;
            }
        });

        if (found) {
            this.cache.set(nodeName, found);
        }

        return found;
    }

    /**
     * Clear all cached nodes
     */
    clear(): void {
        this.cache.clear();
    }

    /**
     * Get number of cached nodes
     */
    size(): number {
        return this.cache.size;
    }
}

// Camera targeting options
export interface CameraTargetOptions {
    zoomRatio?: number;
    direction?: THREE.Vector3;
}

// Calculate camera target position based on bounding box
export const calculateCameraTargetPosition = (
    camera: THREE.PerspectiveCamera,
    targetBox: THREE.Box3,
    options: CameraTargetOptions = {}
): THREE.Vector3 => {
    const center = new THREE.Vector3();
    targetBox.getCenter(center);

    const diagonal = targetBox.min.distanceTo(targetBox.max);
    const fov = camera.fov * (Math.PI / 180);

    let cameraDistance = Math.abs(diagonal / 2 / Math.tan(fov / 2));

    let zoomRatio = options.zoomRatio || 2.0;
    if (diagonal < 5) {
        zoomRatio = options.zoomRatio || 3.0;
    } else if (diagonal > 20) {
        zoomRatio = options.zoomRatio || 1.5;
    }
    cameraDistance *= zoomRatio;

    // Determine the main face of the target box for front view
    const size = new THREE.Vector3();
    targetBox.getSize(size);

    let direction = options.direction;

    if (!direction) {
        // Find the largest face to determine front direction
        const maxDimension = Math.max(size.x, size.y, size.z);

        if (maxDimension === size.x) {
            // Largest face is along X-axis (front face is along Z-axis)
            direction = new THREE.Vector3(0, 0, 1).normalize();
        } else if (maxDimension === size.z) {
            // Largest face is along Z-axis (front face is along X-axis)
            direction = new THREE.Vector3(1, 0, 0).normalize();
        } else {
            // Largest face is along Y-axis (front face is along X-Z plane)
            direction = new THREE.Vector3(1, 0, 1).normalize();
        }
    } else {
        // Ensure direction is horizontal if requested (optional but recommended for this use case)
        direction = new THREE.Vector3(direction.x, 0, direction.z).normalize();
    }

    return center.clone().add(direction.multiplyScalar(cameraDistance));
};
