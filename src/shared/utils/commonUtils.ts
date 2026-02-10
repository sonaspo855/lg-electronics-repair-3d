import * as THREE from 'three';
import { invalidate } from '@react-three/fiber';
import { getNodeNameLoader } from './NodeNameLoader';
import { getMetadataLoader } from './MetadataLoader';
import { getAssemblyPathVisualizer } from './AssemblyPathVisualizer';

/**
 * Three.js 객체의 정밀 바운딩 박스를 계산하는 함수
 * @param targetNode 대상 노드
 * @returns 계산된 바운딩 박스
 */
export const getPreciseBoundingBox = (targetNode: THREE.Object3D): THREE.Box3 => {
    const box = new THREE.Box3();
    let hasMesh = false;

    // 월드 매트릭스 최신화
    targetNode.updateMatrixWorld(true);

    targetNode.traverse((child) => {
        if (child instanceof THREE.Mesh && child.geometry) {
            child.geometry.computeBoundingBox();
            const geomBox = child.geometry.boundingBox;
            if (geomBox && !geomBox.isEmpty()) {
                const worldBox = geomBox.clone();
                worldBox.applyMatrix4(child.matrixWorld);
                box.union(worldBox);
                hasMesh = true;
            }
        }
    });

    // 메쉬가 없으면 위치 기준으로라도 잡음
    if (!hasMesh || box.isEmpty()) {
        const pos = new THREE.Vector3();
        targetNode.getWorldPosition(pos);
        box.setFromCenterAndSize(pos, new THREE.Vector3(1, 1, 1));
    }
    return box;
};

/**
 * 카메라를 대상 박스로 포커스하는 애니메이션 함수
 * @param camera 카메라
 * @param targetBox 대상 바운딩 박스
 * @param controls 카메라 컨트롤 (옵션)
 * @param duration 애니메이션 지속 시간 (초)
 */
export const debugFocusCamera = (
    camera: THREE.PerspectiveCamera,
    targetBox: THREE.Box3,
    controls?: { target: THREE.Vector3; update: () => void },
    duration: number = 1.0
) => {
    const center = new THREE.Vector3();
    targetBox.getCenter(center);
    targetBox.getSize(new THREE.Vector3());

    // 객체의 가장 긴 모서리 길이 (대각선 길이 포함 고려)
    // Box3의 min, max를 이용해 대각선 길이를 구하는 것이 더 안전할 수 있음
    const diagonal = targetBox.min.distanceTo(targetBox.max);

    // FOV를 고려한 거리 계산 (화면에 꽉 차게 들어오는 거리)
    const fov = camera.fov * (Math.PI / 180);
    let cameraDistance = Math.abs(diagonal / 2 / Math.tan(fov / 2));

    // 객체 크기에 따라 동적으로 zoomRatio 조절
    // 작은 객체: 3.0, 중간 객체: 2.0, 큰 객체: 1.5
    let zoomRatio = 2.0; // 기본값
    if (diagonal < 5) {
        zoomRatio = 3.0; // 작은 객체는 더 가깝게
    } else if (diagonal > 20) {
        zoomRatio = 1.5; // 큰 객체는 더 가깝게
    }
    cameraDistance *= zoomRatio;

    console.log(`Camera Focus:`);
    console.log(`   Target Size (Diagonal): ${diagonal.toFixed(2)}`);
    console.log(`   Final Distance: ${cameraDistance.toFixed(2)}`);

    // 카메라 방향 설정 (정면에서 살짝만 위/오른쪽)
    // Z축(1.0)을 강조하여 너무 측면으로 돌지 않게 함
    const direction = new THREE.Vector3(0.5, 0.8, 1.0).normalize();

    // 최종 목표 위치
    const newCameraPos = center.clone().add(direction.multiplyScalar(cameraDistance));

    const startCameraPos = camera.position.clone();
    const startTarget = controls?.target?.clone() || new THREE.Vector3();

    const startTime = performance.now();
    const animateCamera = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / (duration * 1000), 1);
        const ease = 1 - Math.pow(1 - progress, 3); // easeOutCubic

        camera.position.lerpVectors(startCameraPos, newCameraPos, ease);
        camera.lookAt(center);

        if (controls) {
            const currentTarget = new THREE.Vector3();
            currentTarget.lerpVectors(startTarget, center, ease);
            controls.target.copy(currentTarget);
            controls.update();
        }
        invalidate();
        if (progress < 1) requestAnimationFrame(animateCamera);
    };
    requestAnimationFrame(animateCamera);
};

/**
 * 하이라이트용 MeshBasicMaterial을 생성하는 함수
 * @param color 색상 (16진수)
 * @param opacity 투명도 (기본값 0.8)
 * @returns 하이라이트 재질
 */
export const createHighlightMaterial = (color: number, opacity: number = 0.8): THREE.MeshBasicMaterial => {
    return new THREE.MeshBasicMaterial({
        color,
        depthTest: false,
        depthWrite: false,
        transparent: true,
        opacity,
        side: THREE.DoubleSide
    });
};

/**
 * Three.js 객체의 계층 구조를 재귀적으로 추출하는 함수
 * @param node 대상 노드
 * @returns 계층 구조 정보가 담긴 객체
 */
export const getNodeHierarchy = (node: THREE.Object3D): any => {
    const result: any = {
        name: node.name,
        type: node.type,
        children: [],
    };

    if (node.children.length > 0) {
        node.children.forEach((child) => {
            result.children.push(getNodeHierarchy(child));
        });
    }

    return result;
};

/**
 * 노드 계층 구조를 JSON 파일로 내보내는 함수
 * @param hierarchy 계층 구조 정보
 * @param filename 저장할 파일 이름 (기본값: scene_hierarchy.json)
 */
export const exportHierarchyToJson = (hierarchy: any, filename: string = "scene_hierarchy.json") => {
    const json = JSON.stringify(hierarchy, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
};

/**
 * 노드 경로에서 메타데이터 키를 추출합니다.
 * @param nodePath 노드 경로 (예: 'fridge.leftDoorDamper.screw1Customized')
 * @returns 메타데이터 키 (예: 'screw1Customized')
 */
export function extractMetadataKey(nodePath: string): string {
    return nodePath.includes('.')
        ? nodePath.split('.').pop() || nodePath
        : nodePath;
}

/**
 * 각도를 도에서 라디안으로 변환합니다.
 * @param degrees 도 단위 각도
 * @returns 라디안 단위 각도
 */
export function degreesToRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
}

/**
 * 메타데이터 전역 초기화 함수
 * 애플리케이션 시작 시 메타데이터를 한 번만 로드합니다.
 */
export async function initializeMetadata(): Promise<void> {
    const metadataLoader = getMetadataLoader();
    if (!metadataLoader.isLoaded()) {
        try {
            await metadataLoader.loadMetadata('/metadata/assembly-offsets.json');
            console.log('메타데이터 전역 초기화 완료');
        } catch (error) {
            console.error('메타데이터 로드 실패:', error);
        }
    }
}

/**
 * 스크류 머리 중심을 시각화합니다.
 * @param sceneRoot 씬 루트 노드
 * @param screwNode 스크류 노드
 * @param targetWorldPosition 타겟 월드 위치
 * @param extractDirection 추출 방향 (로컬 좌표계)
 * @param options 옵션 (headOffset: 머리 오프셋 거리, downwardOffset: 아래 방향 오프셋 거리)
 */
export const visualizeScrewHeadCenter = (
    sceneRoot: THREE.Object3D의 
    screwNode: THREE.Object3D,
    targetWorldPosition: THREE.Vector3,
    extractDirection: THREE.Vector3,
    options: {
        headOffset?: number;
        downwardOffset?: number;
    } = {}
): void => {
    const { headOffset = 0.02, downwardOffset = 0.05 } = options;

    // 스크류의 월드 회전을 반영하여 추출 방향을 월드 좌표계로 변환
    const worldQuaternion = new THREE.Quaternion();
    screwNode.getWorldQuaternion(worldQuaternion);
    const worldExtractDir = extractDirection.clone().applyQuaternion(worldQuaternion);

    // 이동된 위치에서 추출 방향의 끝점(머리) 계산
    const headCenter = targetWorldPosition.clone().add(worldExtractDir.clone().multiplyScalar(headOffset));

    const visualizer = getAssemblyPathVisualizer();
    visualizer.initialize(sceneRoot);

    // "아래로" 선 그리기 (월드 Y축 양의 방향으로 오프셋)
    const downwardPoint = headCenter.clone().add(new THREE.Vector3(0, downwardOffset, 0));
    visualizer.visualizeAssemblyPath(headCenter, downwardPoint);
};

/**
 * 스크류 머리 중심 좌표를 계산합니다 (시각화 없이 좌표만 반환).
 * @param screwNode 스크류 노드
 * @param targetWorldPosition 타겟 월드 위치
 * @param extractDirection 추출 방향 (로컬 좌표계)
 * @param headOffset 머리 오프셋 거리 (기본값: 0.02)
 * @returns 머리 중심 좌표
 */
export const calculateScrewHeadCenter = (
    screwNode: THREE.Object3D,
    targetWorldPosition: THREE.Vector3,
    extractDirection: THREE.Vector3,
    headOffset: number = 0.02
): THREE.Vector3 => {
    const worldQuaternion = new THREE.Quaternion();
    screwNode.getWorldQuaternion(worldQuaternion);
    const worldExtractDir = extractDirection.clone().applyQuaternion(worldQuaternion);
    return targetWorldPosition.clone().add(worldExtractDir.clone().multiplyScalar(headOffset));
};