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
    onUpdate?: () => void;
    onComplete?: () => void;
}

// Promise-based smooth animation function for property interpolation
export const animate = (
    target: any,
    params: any,
    options: AnimationOptions = {}
): Promise<void> => {
    const duration = options.duration || 1000;
    const easing = options.easing || easingFunctions.easeInOutCubic;
    const startTime = performance.now();

    // If target is a function, treat as update callback
    if (typeof target === 'function') {
        return new Promise((resolve) => {
            const step = (currentTime: number) => {
                const elapsed = currentTime - startTime;
                const progress = Math.min(elapsed / duration, 1);
                const eased = easing(progress);

                target(progress, eased);

                if (options.onProgress) {
                    options.onProgress(eased);
                }

                if (progress < 1) {
                    requestAnimationFrame(step);
                } else {
                    if (options.onComplete) {
                        options.onComplete();
                    }
                    resolve();
                }
            };

            requestAnimationFrame(step);
        });
    }

    // Otherwise, treat as property animation
    const startValues: any = {};
    for (const prop in params) {
        if (params.hasOwnProperty(prop) && typeof params[prop] === 'number') {
            startValues[prop] = target[prop];
        }
    }

    return new Promise((resolve) => {
        const step = (currentTime: number) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = easing(progress);

            for (const prop in params) {
                if (params.hasOwnProperty(prop) && typeof params[prop] === 'number') {
                    target[prop] = startValues[prop] + (params[prop] - startValues[prop]) * eased;
                }
            }

            if (options.onUpdate) {
                options.onUpdate();
            }

            if (options.onProgress) {
                options.onProgress(eased);
            }

            if (progress < 1) {
                requestAnimationFrame(step);
            } else {
                if (options.onComplete) {
                    options.onComplete();
                }
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

    // Adjust zoom ratio to bring camera closer for better view
    let zoomRatio = options.zoomRatio || 1.5; // Reduce zoom ratio to get closer
    if (diagonal < 5) {
        zoomRatio = options.zoomRatio || 2.0;
    } else if (diagonal > 20) {
        zoomRatio = options.zoomRatio || 1.2;
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
            // X축이 가장 길 때 -> Z축 정면에서 바라봄
            direction = new THREE.Vector3(0, 0, 1).normalize();
        } else if (maxDimension === size.z) {
            // Z축이 가장 길 때 -> X축 정면에서 바라봄
            direction = new THREE.Vector3(1, 0, 0).normalize();
        } else {
            // [수정 포인트] Y축(높이)이 가장 길 때, 기존의 대각선(1, 0, 1) 대신 
            // 가로 방향인 Z축 정면(0, 0, 1) 혹은 X축 정면(1, 0, 0)으로 고정합니다.
            direction = new THREE.Vector3(0, 0, 1).normalize();
        }
    } else {
        // Always ensure horizontal direction for front view (Y-axis = 0)
        direction = new THREE.Vector3(direction.x, 0, direction.z).normalize();
    }

    const targetPosition = center.clone().add(direction.multiplyScalar(cameraDistance));

    // Ensure camera is at the same height as target center for horizontal view
    targetPosition.y = center.y;

    return targetPosition;
};

/**
 * 하이라이트용 MeshBasicMaterial을 생성하는 함수
 * @param color 색상 (16진수)
 * @param opacity 투명도 (기본값 0.8)
 * @returns 하이라이트 재질
 */
export const createHighlightMaterial = (color: number, opacity: number = 0.8): THREE.MeshStandardMaterial => {
    return new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.5,
        transparent: true,
        opacity,
        side: THREE.DoubleSide
    });
};