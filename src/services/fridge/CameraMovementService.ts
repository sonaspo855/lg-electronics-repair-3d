import { LEFT_DOOR_DAMPER_NODE_NAME } from '../../shared/utils/fridgeConstants';
import * as THREE from 'three';
import { getPreciseBoundingBox } from '../../shared/utils/commonUtils';

// Camera movement options
export interface CameraMoveOptions {
    duration?: number; // milliseconds
    zoomRatio?: number; // Custom zoom ratio
    direction?: THREE.Vector3; // Custom camera direction
    onProgress?: (progress: number) => void; // Progress callback
}

// Camera movement service for fridge animations
export class CameraMovementService {
    private cameraControls: any;
    private sceneRoot: THREE.Object3D | null = null;
    private nodeCache: Map<string, THREE.Object3D> = new Map();

    constructor(cameraControls: any, sceneRoot?: THREE.Object3D) {
        this.cameraControls = cameraControls;
        this.sceneRoot = sceneRoot || null;
    }

    // Set scene root reference for node lookup
    public setSceneRoot(sceneRoot: THREE.Object3D): void {
        this.sceneRoot = sceneRoot;
        this.nodeCache.clear(); // Clear cache when scene root changes
    }

    // Move camera to the specified node position (Promise-based)
    public async moveCameraToNode(nodeName: string, options: CameraMoveOptions = {}): Promise<void> {
        console.log('moveCameraToNode>> ', nodeName, options);
        if (!this.cameraControls) {
            throw new Error('Camera controls are not available.');
        }

        // Find the node in the scene (with caching)
        const node = this.getNodeByName(nodeName);
        if (!node) {
            throw new Error(`Node ${nodeName} not found in the scene.`);
        }

        // Calculate the target position for the camera using bounding box
        const targetPosition = this.calculateTargetPosition(node, options);
        const targetBox = getPreciseBoundingBox(node);
        const center = new THREE.Vector3();
        targetBox.getCenter(center);

        // Smooth camera movement using OrbitControls
        await this.smoothCameraMovement(targetPosition, center, options);

        console.log('Camera moved to node:', nodeName);
    }

    // Smooth camera movement with duration (Promise-based)
    private async smoothCameraMovement(
        targetPosition: THREE.Vector3,
        targetLookAt: THREE.Vector3,
        options: CameraMoveOptions
    ): Promise<void> {
        const duration = options.duration || 1000; // Default 1 second
        const startPosition = this.cameraControls.object.position.clone();
        const startTime = performance.now();

        return new Promise((resolve) => {
            const animate = (currentTime: number) => {
                const elapsed = currentTime - startTime;
                const progress = Math.min(elapsed / duration, 1);

                // Easing function for smooth movement (ease in-out cubic)
                const easeProgress = this.easeInOutCubic(progress);

                // Interpolate between start and target position
                const currentPosition = startPosition.clone().lerp(targetPosition, easeProgress);

                // Update camera position
                this.cameraControls.object.position.copy(currentPosition);

                // Update camera target to look at the node's bounding box center
                this.cameraControls.target.copy(targetLookAt);

                // Update controls
                this.cameraControls.update();

                // Call progress callback
                if (options.onProgress) {
                    options.onProgress(easeProgress);
                }

                if (progress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    resolve();
                }
            };

            requestAnimationFrame(animate);
        });
    }

    // Find a node by name in the scene (with caching)
    private getNodeByName(nodeName: string): THREE.Object3D | null {
        if (this.nodeCache.has(nodeName)) {
            return this.nodeCache.get(nodeName)!;
        }

        if (!this.sceneRoot) {
            console.error('Scene root not available for node lookup');
            return null;
        }

        console.log(`Finding node: ${nodeName}`);
        let found: any = null;
        this.sceneRoot.traverse((child: any) => {
            if (child.name === nodeName) {
                found = child;
            }
        });

        if (found) {
            this.nodeCache.set(nodeName, found);
        }

        return found;
    }

    // Calculate the target position for the camera using bounding box
    private calculateTargetPosition(node: any, options: CameraMoveOptions): THREE.Vector3 {
        // Get precise bounding box of the node
        const targetBox = getPreciseBoundingBox(node);
        const center = new THREE.Vector3();
        targetBox.getCenter(center);

        // Calculate diagonal length for size estimation
        const diagonal = targetBox.min.distanceTo(targetBox.max);

        // Camera FOV in radians
        const camera = this.cameraControls.object;
        const fov = camera.fov * (Math.PI / 180);

        // Calculate base distance to fit the object in view
        let cameraDistance = Math.abs(diagonal / 2 / Math.tan(fov / 2));

        // Dynamic zoom ratio based on object size
        let zoomRatio = options.zoomRatio || 2.0;
        if (diagonal < 5) {
            zoomRatio = options.zoomRatio || 3.0; // Small objects - closer
        } else if (diagonal > 20) {
            zoomRatio = options.zoomRatio || 1.5; // Large objects - farther
        }
        cameraDistance *= zoomRatio;

        console.log(`Camera Focus:`);
        console.log(`   Target Size (Diagonal): ${diagonal.toFixed(2)}`);
        console.log(`   Final Distance: ${cameraDistance.toFixed(2)}`);

        // Camera direction: front-right-top for better view (customizable)
        const direction = options.direction || new THREE.Vector3(0.5, 0.8, 1.0).normalize();

        // Final target position
        const newCameraPos = center.clone().add(direction.multiplyScalar(cameraDistance));

        return newCameraPos;
    }

    // Easing function: ease in-out cubic
    private easeInOutCubic(t: number): number {
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }

    // Default camera movement parameters
    private static readonly DEFAULT_DAMPER_DURATION = 1000;

    // Move camera to the left door damper node (Promise-based)
    public async moveCameraToLeftDoorDamper(options: CameraMoveOptions = {}): Promise<void> {
        console.log('moveCameraToLeftDoorDamper!!');
        await this.moveCameraToNode(LEFT_DOOR_DAMPER_NODE_NAME, {
            duration: options.duration || CameraMovementService.DEFAULT_DAMPER_DURATION,
            ...options
        });
    }
}
