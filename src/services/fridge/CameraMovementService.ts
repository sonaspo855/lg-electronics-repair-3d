import { LEFT_DOOR_DAMPER_NODE_NAME } from '../../shared/utils/fridgeConstants';
import * as THREE from 'three';
import { getPreciseBoundingBox } from '../../shared/utils/commonUtils';

// Camera movement service for fridge animations
export class CameraMovementService {
    private cameraControls: any;
    private sceneRoot: THREE.Object3D | null = null;

    constructor(cameraControls: any, sceneRoot?: THREE.Object3D) {
        this.cameraControls = cameraControls;
        this.sceneRoot = sceneRoot || null;
    }

    // Set scene root reference for node lookup
    public setSceneRoot(sceneRoot: THREE.Object3D): void {
        this.sceneRoot = sceneRoot;
    }

    // Move camera to the specified node position
    public moveCameraToNode(nodeName: string, distance: number, time: number): void {
        console.log('moveCameraToNode>> ', nodeName, distance, time);
        if (!this.cameraControls) {
            console.error('Camera controls are not available.');
            return;
        }

        // Find the node in the scene
        const node = this.findNodeByName(nodeName);
        if (!node) {
            console.error(`Node ${nodeName} not found in the scene.`);
            return;
        }

        // Calculate the target position for the camera using bounding box
        const targetPosition = this.calculateTargetPosition(node);
        const targetBox = getPreciseBoundingBox(node);
        const center = new THREE.Vector3();
        targetBox.getCenter(center);

        // Smooth camera movement using OrbitControls
        this.smoothCameraMovement(targetPosition, center, time);

        console.log('Camera moved to node:', nodeName);
    }

    // Smooth camera movement with duration
    private smoothCameraMovement(
        targetPosition: { x: number; y: number; z: number },
        targetLookAt: { x: number; y: number; z: number },
        duration: number
    ): void {
        console.log('smoothCameraMovement>> ', targetPosition, targetLookAt, duration);
        const startPosition = this.cameraControls.object.position.clone();
        const startTime = Date.now();

        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / (duration * 1000), 1);

            // Easing function for smooth movement (ease out)
            const easeProgress = 1 - Math.pow(1 - progress, 3);

            // Interpolate between start and target position
            const currentPosition = startPosition.clone().lerp(targetPosition, easeProgress);

            // Update camera position
            this.cameraControls.object.position.copy(currentPosition);

            // Update camera target to look at the node's bounding box center
            this.cameraControls.target.copy({
                x: targetLookAt.x,
                y: targetLookAt.y,
                z: targetLookAt.z
            });

            // Update controls
            this.cameraControls.update();

            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };

        animate();
    }

    // Find a node by name in the scene
    private findNodeByName(nodeName: string): any {
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
        return found;
    }

    // Calculate the target position for the camera using bounding box
    private calculateTargetPosition(node: any): { x: number, y: number, z: number } {
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
        let zoomRatio = 2.0;
        if (diagonal < 5) {
            zoomRatio = 3.0; // Small objects - closer
        } else if (diagonal > 20) {
            zoomRatio = 1.5; // Large objects - farther
        }
        cameraDistance *= zoomRatio;

        console.log(`Camera Focus:`);
        console.log(`   Target Size (Diagonal): ${diagonal.toFixed(2)}`);
        console.log(`   Final Distance: ${cameraDistance.toFixed(2)}`);

        // Camera direction: front-right-top for better view
        const direction = new THREE.Vector3(0.5, 0.8, 1.0).normalize();

        // Final target position
        const newCameraPos = center.clone().add(direction.multiplyScalar(cameraDistance));

        return {
            x: newCameraPos.x,
            y: newCameraPos.y,
            z: newCameraPos.z
        };
    }

    // Default camera movement parameters - reduced distance for closer view
    private static readonly DEFAULT_DAMPER_DISTANCE = 150;
    private static readonly DEFAULT_DAMPER_TIME = 1;

    // Move camera to the left door damper node
    public moveCameraToLeftDoorDamper(distance: number = CameraMovementService.DEFAULT_DAMPER_DISTANCE, time: number = CameraMovementService.DEFAULT_DAMPER_TIME): void {
        console.log('moveCameraToLeftDoorDamper!!');
        this.moveCameraToNode(LEFT_DOOR_DAMPER_NODE_NAME, distance, time);
    }
}
