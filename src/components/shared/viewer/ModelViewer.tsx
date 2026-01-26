import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils";
import { removeClickedNode } from "../../../shared/utils/removeClickedNode";
import { findNodeHeight } from "../../../shared/utils/findNodeHeight";
import { animatorAgent } from "../../../services/AnimatorAgent";
import "./ModelViewer.css";

const DEFAULT_MODEL = "/models/M-Next3.glb";

const DOOR_NODE_NAME = "ADC30035606_Door_Assembly,Refrigerator(Left)";
const RIGHT_DOOR_NODE_NAME = "ADC30009336_Door_Assembly,Refrigerator(Right)";
const LOWER_LEFT_DOOR_NODE_NAME = "ADC30009726_Door_Assembly,Freezer(Left)";
const LOWER_RIGHT_DOOR_NODE_NAME = "ADC30009826_Door_Assembly,Freezer(Right)";
const REMOVE_NODE_NAME = "5210JA3030J_Tube,Plastic";
const BUCKET_NODE_NAME = "AKC73369920_Bucket_Assembly,Ice";
const LEFT_DOOR_LOWER_ANCHOR_NAME = "MBJ42493801_Cam,Locker_14466001";
const LEFT_DOOR_LOWER_SHAFT_NAME = "AEH36821925_Hinge_Assembly,Center_183656_SHAFT";
type DoorState = {
  isOpen: boolean;
  degrees: number;
};

type DoorControls = {
  openByDegrees: (degrees: number, speedSeconds?: number, onComplete?: () => void) => void;
  close: (speedSeconds?: number, onComplete?: () => void) => void;
  openRightByDegrees: (degrees: number, speedSeconds?: number, onComplete?: () => void) => void;
  closeRight: (speedSeconds?: number, onComplete?: () => void) => void;
  openLowerLeftByDegrees: (degrees: number, speedSeconds?: number, onComplete?: () => void) => void;
  closeLowerLeft: (speedSeconds?: number, onComplete?: () => void) => void;
  openLowerRightByDegrees: (degrees: number, speedSeconds?: number, onComplete?: () => void) => void;
  closeLowerRight: (speedSeconds?: number, onComplete?: () => void) => void;
  getState: () => DoorState;
  getRightState: () => DoorState;
  getLowerLeftState: () => DoorState;
  getLowerRightState: () => DoorState;
};

type ModelViewerProps = {
  modelPath?: string;
  onSceneReady?: (scene: THREE.Object3D) => void;
  focusTarget?: THREE.Object3D | null;
  onDoorControlsReady?: (controls: DoorControls) => void;
  onNodeSelect?: (node: THREE.Object3D) => void;
  overlay?: React.ReactNode;
  allowDefaultModel?: boolean;
};

type DoorKey = "left" | "right" | "lowerLeft" | "lowerRight";

type DoorConfig = {
  nodeName: string;
  openDirection: 1 | -1;
};

const DOORS: Record<DoorKey, DoorConfig> = {
  left: {
    nodeName: DOOR_NODE_NAME,
    openDirection: -1,
  },
  right: {
    nodeName: RIGHT_DOOR_NODE_NAME,
    openDirection: 1,
  },
  lowerLeft: {
    nodeName: LOWER_LEFT_DOOR_NODE_NAME,
    openDirection: -1,
  },
  lowerRight: {
    nodeName: LOWER_RIGHT_DOOR_NODE_NAME,
    openDirection: 1,
  },
};

const findNodeByName = (scene: THREE.Object3D, name: string) => {
  let found: THREE.Object3D | null = null;
  scene.traverse((child) => {
    if (child.name === name) {
      found = child;
    }
  });
  return found;
};

const removeNodesByName = (root: THREE.Object3D, name: string): number => {
  const nodesToRemove: THREE.Object3D[] = [];
  root.traverse((child) => {
    if (child.name === name) {
      nodesToRemove.push(child);
    }
  });
  nodesToRemove.forEach((node) => {
    node.parent?.remove(node);
  });
  return nodesToRemove.length;
};

const animatePivotRotation = (
  pivot: THREE.Object3D,
  targetRotation: number,
  durationMs: number,
  axis: "y" | "z",
  onComplete?: () => void
) => {
  const startRotation = axis === "y" ? pivot.rotation.y : pivot.rotation.z;
  const startTime = performance.now();

  const step = (currentTime: number) => {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / durationMs, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const currentRotation = startRotation + (targetRotation - startRotation) * eased;

    if (axis === "y") {
      pivot.rotation.y = currentRotation;
    } else {
      pivot.rotation.z = currentRotation;
    }
    pivot.updateMatrix();
    pivot.updateMatrixWorld(true);

    if (progress < 1) {
      requestAnimationFrame(step);
    } else if (onComplete) {
      onComplete();
    }
  };

  requestAnimationFrame(step);
};

function ModelContent({
  url,
  onSceneReady,
  onLoaded,
}: {
  url: string;
  onSceneReady: (scene: THREE.Object3D) => void;
  onLoaded?: () => void;
}) {
  const { scene } = useGLTF(url);
  const clonedScene = useMemo(() => cloneSkeleton(scene), [scene]);

  useEffect(() => {
    onSceneReady(clonedScene);
    onLoaded?.();
  }, [clonedScene, onSceneReady, onLoaded]);

  return <primitive object={clonedScene} />;
  // return <primitive object={clonedScene} onClick={removeClickedNode} />;
}

function CameraManager({
  scene,
  focusTarget,
  controlsRef,
}: {
  scene: THREE.Object3D | null;
  focusTarget?: THREE.Object3D | null;
  controlsRef: RefObject<any>;
}) {
  const { camera } = useThree();
  const framedRef = useRef(false);
  const highlightedRef = useRef(false);

  const frameObject = useCallback(
    (object: THREE.Object3D, fitOffset = 1.2) => {
      const box = new THREE.Box3().setFromObject(object);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const maxSize = Math.max(size.x, size.y, size.z, 1);

      const fov = THREE.MathUtils.degToRad((camera as THREE.PerspectiveCamera).fov);
      const distance = maxSize / (2 * Math.tan(fov / 2));
      const direction = new THREE.Vector3(1, 1, 1).normalize();

      camera.position.copy(center.clone().add(direction.multiplyScalar(distance * fitOffset)));
      camera.near = distance / 100;
      camera.far = distance * 100;
      camera.updateProjectionMatrix();

      if (controlsRef.current) {
        controlsRef.current.target.copy(center);
        controlsRef.current.update();
      }
    },
    [camera, controlsRef]
  );

  useEffect(() => {
    if (!scene || framedRef.current) {
      return;
    }
    frameObject(scene, 1.35);
    framedRef.current = true;
  }, [scene, frameObject]);

  useEffect(() => {
    if (focusTarget) {
      frameObject(focusTarget, 1.8);
    }
  }, [focusTarget, frameObject]);

  useEffect(() => {
    if (!scene || highlightedRef.current) {
      return;
    }

    // 초기 렌더링 시 HighlightNode를 하이라이트
    /* findNodeHeight(scene, camera as THREE.PerspectiveCamera, {
      target: controlsRef.current?.target || new THREE.Vector3(0, 0, 0),
      update: () => controlsRef.current?.update(),
    }); */

    highlightedRef.current = true;
  }, [scene, camera, controlsRef]);

  return null;
}

function SelectionManager({
  scene,
  onNodeSelect,
}: {
  scene: THREE.Object3D | null;
  onNodeSelect?: (node: THREE.Object3D) => void;
}) {
  const { camera, gl } = useThree();

  useEffect(() => {
    if (!scene || !onNodeSelect) {
      return;
    }

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    const handlePointerDown = (event: PointerEvent) => {
      if (!event.ctrlKey || event.button !== 0) {
        return;
      }
      const rect = gl.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(scene.children, true);
      if (hits.length > 0) {
        // 클릭된 Mesh의 최상위 부모 노드를 찾음 (Mesh가 포함된 그룹/장면)
        let targetNode: THREE.Object3D = hits[0].object;
        console.log('클릭된 원본 노드: ', targetNode);
        let parent = targetNode.parent;
        while (parent && parent !== scene) {
          // 부모가 Mesh가 아닌 경우(Group 등)면 그 부모를 선택 대상으로 삼음
          // 단, Mesh가 직접 클릭된 경우는 그 Mesh의 최상위 부모까지 탐색
          targetNode = parent;
          parent = parent.parent;
        }
        console.log('최종 선택된 노드: ', targetNode);
        onNodeSelect(targetNode);
      }
    };

    gl.domElement.addEventListener("pointerdown", handlePointerDown);
    return () => {
      gl.domElement.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [scene, onNodeSelect, camera, gl]);

  return null;
}

export default function ModelViewer({
  modelPath,
  onSceneReady,
  focusTarget,
  onDoorControlsReady,
  onNodeSelect,
  overlay,
  allowDefaultModel = true,
}: ModelViewerProps) {
  const modelUrl = useMemo(
    () => (allowDefaultModel ? modelPath ?? DEFAULT_MODEL : modelPath),
    [allowDefaultModel, modelPath]
  );
  const [sceneRoot, setSceneRoot] = useState<THREE.Object3D | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const controlsRef = useRef<any>(null);
  const cameraProps = useMemo(
    () => ({ fov: 45, near: 0.1, far: 100000, up: [0, 1, 0] as [number, number, number] }),
    []
  );
  const glProps = useMemo(() => ({ antialias: true, powerPreference: "high-performance" as any }), []);
  const orbitTarget = useMemo(() => [0, 0, 0] as [number, number, number], []);
  const pivotsRef = useRef<Record<DoorKey, THREE.Object3D | null>>({
    left: null,
    right: null,
    lowerLeft: null,
    lowerRight: null,
  });
  const doorStatesRef = useRef<Record<DoorKey, DoorState>>({
    left: { isOpen: false, degrees: 0 },
    right: { isOpen: false, degrees: 0 },
    lowerLeft: { isOpen: false, degrees: 0 },
    lowerRight: { isOpen: false, degrees: 0 },
  });
  const controlsRefValue = useRef<DoorControls | null>(null);

  useEffect(() => {
    if (!modelUrl) {
      return;
    }
    useGLTF.preload(modelUrl);
  }, [modelUrl]);

  useEffect(() => {
    setIsLoading(Boolean(modelUrl));
  }, [modelUrl]);

  useEffect(() => {
    return () => {
      if (modelUrl) {
        useGLTF.clear(modelUrl);
      }
    };
  }, [modelUrl]);

  const setupDoorHingePivot = useCallback(
    (
      doorObject: THREE.Object3D,
      anchorNode?: THREE.Object3D | null,
      shaftNode?: THREE.Object3D | null
    ) => {
      if (!doorObject || pivotsRef.current.left) {
        return;
      }
      doorObject.updateWorldMatrix(true, true);
      const parent = doorObject.parent;
      if (!parent) {
        return;
      }

      let hingeWorld: THREE.Vector3 | null = null;

      if (anchorNode && shaftNode) {
        anchorNode.updateWorldMatrix(true, true);
        shaftNode.updateWorldMatrix(true, true);
        const anchorWorld = new THREE.Vector3();
        const shaftWorld = new THREE.Vector3();
        anchorNode.getWorldPosition(anchorWorld);
        shaftNode.getWorldPosition(shaftWorld);
        const delta = anchorWorld.clone().sub(shaftWorld);
        const doorWorld = new THREE.Vector3();
        doorObject.getWorldPosition(doorWorld);
        const targetWorld = doorWorld.add(delta);
        const targetInParent = targetWorld.clone();
        parent.worldToLocal(targetInParent);
        doorObject.position.copy(targetInParent);
        doorObject.updateWorldMatrix(true, true);
        hingeWorld = anchorWorld;
      } else {
        const worldBox = new THREE.Box3().setFromObject(doorObject);
        if (!isFinite(worldBox.min.x)) {
          return;
        }
        hingeWorld = new THREE.Vector3(
          worldBox.min.x,
          (worldBox.min.y + worldBox.max.y) / 2,
          (worldBox.min.z + worldBox.max.z) / 2
        );
      }
      const hingeInParent = hingeWorld.clone();
      parent.worldToLocal(hingeInParent);
      const pivot = new THREE.Group();
      pivot.name = "DoorHingePivot_Left";
      pivot.position.copy(hingeInParent);
      parent.add(pivot);
      pivot.updateMatrixWorld(true);
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore three.js has Object3D.attach in typings
      pivot.attach(doorObject);
      pivot.rotation.set(0, 0, 0);
      pivot.updateMatrixWorld(true);
      pivotsRef.current.left = pivot;
    }, []);

  const setupRightDoorHingePivot = useCallback((doorObject: THREE.Object3D) => {
    if (!doorObject || pivotsRef.current.right) {
      return;
    }
    doorObject.updateWorldMatrix(true, true);
    const worldBox = new THREE.Box3().setFromObject(doorObject);
    if (!isFinite(worldBox.max.x) || !doorObject.parent) {
      return;
    }
    const hingeWorld = new THREE.Vector3(
      worldBox.max.x,
      (worldBox.min.y + worldBox.max.y) / 2,
      (worldBox.min.z + worldBox.max.z) / 2
    );
    const parent = doorObject.parent;
    const hingeInParent = hingeWorld.clone();
    parent.worldToLocal(hingeInParent);
    const pivot = new THREE.Group();
    pivot.name = "DoorHingePivot_Right";
    pivot.position.copy(hingeInParent);
    parent.add(pivot);
    pivot.updateMatrixWorld(true);
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore three.js has Object3D.attach in typings
    pivot.attach(doorObject);
    pivot.rotation.set(0, 0, 0);
    pivot.updateMatrixWorld(true);
    pivotsRef.current.right = pivot;
  }, []);

  const setupLowerLeftDoorHingePivot = useCallback((doorObject: THREE.Object3D) => {
    if (!doorObject || pivotsRef.current.lowerLeft) {
      return;
    }
    doorObject.updateWorldMatrix(true, true);
    const worldBox = new THREE.Box3().setFromObject(doorObject);
    if (!isFinite(worldBox.min.x) || !doorObject.parent) {
      return;
    }
    const hingeWorld = new THREE.Vector3(
      worldBox.min.x,
      (worldBox.min.y + worldBox.max.y) / 2,
      (worldBox.min.z + worldBox.max.z) / 2
    );
    const parent = doorObject.parent;
    const hingeInParent = hingeWorld.clone();
    parent.worldToLocal(hingeInParent);
    const pivot = new THREE.Group();
    pivot.name = "DoorHingePivot_LowerLeft";
    pivot.position.copy(hingeInParent);
    parent.add(pivot);
    pivot.updateMatrixWorld(true);
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore three.js has Object3D.attach in typings
    pivot.attach(doorObject);
    pivot.rotation.set(0, 0, 0);
    pivot.updateMatrixWorld(true);
    pivotsRef.current.lowerLeft = pivot;
  }, []);

  const setupLowerRightDoorHingePivot = useCallback((doorObject: THREE.Object3D) => {
    if (!doorObject || pivotsRef.current.lowerRight) {
      return;
    }
    doorObject.updateWorldMatrix(true, true);
    const worldBox = new THREE.Box3().setFromObject(doorObject);
    if (!isFinite(worldBox.max.x) || !doorObject.parent) {
      return;
    }
    const hingeWorld = new THREE.Vector3(
      worldBox.max.x,
      (worldBox.min.y + worldBox.max.y) / 2,
      (worldBox.min.z + worldBox.max.z) / 2
    );
    const parent = doorObject.parent;
    const hingeInParent = hingeWorld.clone();
    parent.worldToLocal(hingeInParent);
    const pivot = new THREE.Group();
    pivot.name = "DoorHingePivot_LowerRight";
    pivot.position.copy(hingeInParent);
    parent.add(pivot);
    pivot.updateMatrixWorld(true);
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore three.js has Object3D.attach in typings
    pivot.attach(doorObject);
    pivot.rotation.set(0, 0, 0);
    pivot.updateMatrixWorld(true);
    pivotsRef.current.lowerRight = pivot;
  }, []);

  useEffect(() => {
    if (!sceneRoot) {
      return;
    }

    // CameraControls 초기화
    if (controlsRef.current) {
      animatorAgent.setCameraControls(controlsRef.current, sceneRoot);
    }

    removeNodesByName(sceneRoot, REMOVE_NODE_NAME);

    const leftDoor = findNodeByName(sceneRoot, DOORS.left.nodeName);
    if (leftDoor) {
      const anchorNode = findNodeByName(sceneRoot, LEFT_DOOR_LOWER_ANCHOR_NAME);
      const shaftNode = findNodeByName(sceneRoot, LEFT_DOOR_LOWER_SHAFT_NAME);
      setupDoorHingePivot(leftDoor, anchorNode, shaftNode);
      const bucketNode = findNodeByName(sceneRoot, BUCKET_NODE_NAME);
      if (bucketNode && pivotsRef.current.left) {
        (bucketNode as THREE.Object3D).updateWorldMatrix(true, true);
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore three.js has Object3D.attach in typings
        pivotsRef.current.left.attach(bucketNode);
        pivotsRef.current.left.updateMatrixWorld(true);
      }
    }

    const rightDoor = findNodeByName(sceneRoot, DOORS.right.nodeName);
    if (rightDoor) {
      setupRightDoorHingePivot(rightDoor);
    }

    const lowerLeftDoor = findNodeByName(sceneRoot, DOORS.lowerLeft.nodeName);
    if (lowerLeftDoor) {
      setupLowerLeftDoorHingePivot(lowerLeftDoor);
    }

    const lowerRightDoor = findNodeByName(sceneRoot, DOORS.lowerRight.nodeName);
    if (lowerRightDoor) {
      setupLowerRightDoorHingePivot(lowerRightDoor);
    }

    const runDoorAnimation = (
      doorKey: DoorKey,
      degrees: number,
      speedSeconds: number,
      onComplete?: () => void
    ) => {
      const pivot = pivotsRef.current[doorKey];
      if (!pivot) {
        return;
      }
      const direction = DOORS[doorKey].openDirection;
      const targetRotation = direction * THREE.MathUtils.degToRad(degrees);
      const durationMs = Math.max(speedSeconds, 0.1) * 1000;
      const axis = "z";

      animatePivotRotation(pivot, targetRotation, durationMs, axis, () => {
        doorStatesRef.current[doorKey] = {
          isOpen: degrees > 0,
          degrees,
        };
        onComplete?.();
      });
    };

    const closeDoor = (doorKey: DoorKey, speedSeconds: number, onComplete?: () => void) => {
      const pivot = pivotsRef.current[doorKey];
      if (!pivot) {
        return;
      }
      const durationMs = Math.max(speedSeconds, 0.1) * 1000;
      const axis = "z";
      animatePivotRotation(pivot, 0, durationMs, axis, () => {
        doorStatesRef.current[doorKey] = {
          isOpen: false,
          degrees: 0,
        };
        onComplete?.();
      });
    };

    controlsRefValue.current = {
      openByDegrees: (degrees, speedSeconds = 1, onComplete) =>
        runDoorAnimation("left", degrees, speedSeconds, onComplete),
      close: (speedSeconds = 1, onComplete) => closeDoor("left", speedSeconds, onComplete),
      openRightByDegrees: (degrees, speedSeconds = 1, onComplete) =>
        runDoorAnimation("right", degrees, speedSeconds, onComplete),
      closeRight: (speedSeconds = 1, onComplete) => closeDoor("right", speedSeconds, onComplete),
      openLowerLeftByDegrees: (degrees, speedSeconds = 1, onComplete) =>
        runDoorAnimation("lowerLeft", degrees, speedSeconds, onComplete),
      closeLowerLeft: (speedSeconds = 1, onComplete) =>
        closeDoor("lowerLeft", speedSeconds, onComplete),
      openLowerRightByDegrees: (degrees, speedSeconds = 1, onComplete) =>
        runDoorAnimation("lowerRight", degrees, speedSeconds, onComplete),
      closeLowerRight: (speedSeconds = 1, onComplete) =>
        closeDoor("lowerRight", speedSeconds, onComplete),
      getState: () => doorStatesRef.current.left,
      getRightState: () => doorStatesRef.current.right,
      getLowerLeftState: () => doorStatesRef.current.lowerLeft,
      getLowerRightState: () => doorStatesRef.current.lowerRight,
    };

    onDoorControlsReady?.(controlsRefValue.current);
    onSceneReady?.(sceneRoot);
  }, [
    sceneRoot,
    onDoorControlsReady,
    onSceneReady,
    setupDoorHingePivot,
    setupRightDoorHingePivot,
    setupLowerLeftDoorHingePivot,
    setupLowerRightDoorHingePivot,
  ]);

  if (!modelUrl) {
    return <div className="viewer-placeholder">No model available.</div>;
  }

  return (
    <div className="viewer-canvas">
      {overlay}
      {isLoading && (
        <div className="viewer-loading-overlay" role="status" aria-label="Loading model">
          <div className="viewer-loading-dots">
            <span className="viewer-loading-dot" />
            <span className="viewer-loading-dot" />
            <span className="viewer-loading-dot" />
          </div>
          <div className="viewer-loading-text">Loading 3D model...</div>
        </div>
      )}
      <Canvas
        camera={cameraProps}
        gl={glProps}
      // gl={{ antialias: true, powerPreference: "high-performance" }}
      >
        <color attach="background" args={["#f5f5f5"]} />
        <ambientLight intensity={0.8} />
        <directionalLight position={[1, 1, 1]} intensity={0.8} />
        <directionalLight position={[-1, -1, -1]} intensity={0.4} />
        <Suspense fallback={null}>
          <ModelContent url={modelUrl} onSceneReady={setSceneRoot} onLoaded={() => setIsLoading(false)} />
        </Suspense>
        <CameraManager scene={sceneRoot} focusTarget={focusTarget} controlsRef={controlsRef} />
        <SelectionManager scene={sceneRoot} onNodeSelect={onNodeSelect} />
        <OrbitControls
          ref={controlsRef}
          makeDefault
          enablePan
          enableZoom
          enableRotate
          dampingFactor={0.1}
          rotateSpeed={0.5}
          target={orbitTarget}
        />
      </Canvas>
    </div>
  );
}
