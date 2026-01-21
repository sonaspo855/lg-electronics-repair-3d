import { LEFT_DOOR_DAMPER_NODE_NAME } from '../../shared/utils/fridgeConstants';
import * as THREE from 'three';
import { getPreciseBoundingBox } from '../../shared/utils/commonUtils';
import { animate, calculateCameraTargetPosition, NodeCache, type AnimationOptions, type CameraTargetOptions } from '../../shared/utils/animationUtils';

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
    private nodeCache: NodeCache = new NodeCache();

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
        const startTarget = this.cameraControls.target.clone();

        await animate((progress, eased) => {
            // Interpolate between start and target position with horizontal movement constraint
            const currentPosition = new THREE.Vector3(
                startPosition.x + (targetPosition.x - startPosition.x) * eased,
                startPosition.y, // Keep Y position constant for horizontal movement
                startPosition.z + (targetPosition.z - startPosition.z) * eased
            );
            this.cameraControls.object.position.copy(currentPosition);

            // Interpolate between start and target look at position
            const currentLookAt = startTarget.clone().lerp(targetLookAt, eased);
            this.cameraControls.target.copy(currentLookAt);

            // Update controls
            this.cameraControls.update();

            // Call progress callback
            if (options.onProgress) {
                options.onProgress(eased);
            }
        }, { duration });
    }

    // Find a node by name in the scene (with caching)
    private getNodeByName(nodeName: string): THREE.Object3D | null {
        if (!this.sceneRoot) {
            console.error('Scene root not available for node lookup');
            return null;
        }

        return this.nodeCache.findNodeByName(this.sceneRoot, nodeName);
    }

    // Calculate the target position for the camera using bounding box
    private calculateTargetPosition(node: any, options: CameraMoveOptions): THREE.Vector3 {
        const targetBox = getPreciseBoundingBox(node);
        return calculateCameraTargetPosition(this.cameraControls.object, targetBox, {
            zoomRatio: options.zoomRatio,
            direction: options.direction
        });
    }

    // Default camera movement parameters
    private static readonly DEFAULT_DAMPER_DURATION = 1000;

    // Move camera to the left door damper node (Promise-based)
    public async moveCameraToLeftDoorDamper(options: CameraMoveOptions = {}): Promise<void> {
        console.log('moveCameraToLeftDoorDamper!!');
        await this.moveCameraToNode(LEFT_DOOR_DAMPER_NODE_NAME, {
            duration: options.duration || CameraMovementService.DEFAULT_DAMPER_DURATION,
            // Ensure horizontal direction for front view
            direction: new THREE.Vector3(1, 0, 0).normalize(),
            ...options
        });
    }
}
