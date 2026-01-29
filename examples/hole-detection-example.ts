import * as THREE from 'three';
import { NormalBasedHighlight } from '../src/shared/utils/NormalBasedHighlight';

/**
 * 홈 탐지 및 시각화 예시 코드
 * 
 * 이 예시는 NormalBasedHighlight를 사용하여 노드에서 한 면을 하이라이트하고,
 * 그 면 내에 있는 홈의 개수를 파악하여 각 홈의 중심점에 마젠타색 구를 생성하는 방법을 보여줍니다.
 */

export function demonstrateHoleDetection(
    sceneRoot: THREE.Object3D,
    targetNode: THREE.Object3D,
    camera: THREE.Camera
): void {
    // 1. NormalBasedHighlight 인스턴스 생성 및 초기화
    const highlighter = new NormalBasedHighlight();
    highlighter.initialize(sceneRoot);

    // 2. 카메라를 기준으로 면 하이라이트 (선택 사항)
    // 이 단계는 사용자가 원하는 면을 시각적으로 확인하기 위한 것입니다.
    highlighter.highlightFacesByCameraFilter(
        targetNode,
        camera,
        0xff0000, // 빨간색으로 하이라이트
        15        // 엣지 임계값
    );

    console.log('=== 홈 탐지 시작 ===');

    // 3. 홈 탐지 및 시각화
    // Z축 방향을 바라보는 면들 중에서 홈을 탐지합니다.
    const holes = highlighter.detectAndVisualizeHoles(
        targetNode,
        new THREE.Vector3(0, 0, 1), // Z축 방향 필터링
        0.2,                         // 법선 허용 오차
        0.05,                        // 클러스터링 거리 임계값 (5cm)
        0.005                        // 마젠타색 구 반지름 (5mm)
    );

    // 4. 결과 출력
    console.log(`\n=== 탐지 결과 ===`);
    console.log(`총 ${holes.length}개의 홈이 탐지되었습니다.`);

    holes.forEach((hole, index) => {
        console.log(`\n홈 #${index + 1}:`);
        console.log(`  위치: (${hole.position.x.toFixed(4)}, ${hole.position.y.toFixed(4)}, ${hole.position.z.toFixed(4)})`);
        console.log(`  정점 수: ${hole.filteredVerticesCount}`);
        console.log(`  시각화: 마젠타색 구 생성됨`);
    });

    // 5. (선택 사항) 각 홈의 위치에 추가적인 시각화 요소 생성
    // 예: 홈의 위치에 텍스트 라벨이나 다른 마커 추가
    holes.forEach((hole, index) => {
        // 홈의 위치에 작은 화살표 추가 (선택 사항)
        const arrowHelper = new THREE.ArrowHelper(
            new THREE.Vector3(0, 1, 0), // 위쪽 방향
            hole.position,
            0.02,                       // 길이
            0x00ff00,                   // 녹색
            0.005,                      // 화살표 길이
            0.003                       // 화살표 너비
        );
        arrowHelper.renderOrder = 1001;
        sceneRoot.add(arrowHelper);
    });

    console.log('\n=== 홈 탐지 완료 ===');
}

/**
 * 사용자 정의 방향으로 홈 탐지 예시
 */
export function demonstrateHoleDetectionWithCustomDirection(
    sceneRoot: THREE.Object3D,
    targetNode: THREE.Object3D,
    customDirection: THREE.Vector3
): Array<{
    position: THREE.Vector3;
    filteredVerticesCount: number;
    sphere: THREE.Mesh;
}> {
    const highlighter = new NormalBasedHighlight();
    highlighter.initialize(sceneRoot);

    console.log('=== 사용자 정의 방향으로 홈 탐지 ===');
    console.log(`탐색 방향: (${customDirection.x}, ${customDirection.y}, ${customDirection.z})`);

    const holes = highlighter.detectAndVisualizeHoles(
        targetNode,
        customDirection,
        0.2,    // 법선 허용 오차
        0.05,   // 클러스터링 거리 임계값
        0.005   // 마젠타색 구 반지름
    );

    console.log(`탐지된 홈 개수: ${holes.length}`);

    return holes;
}

/**
 * 다양한 파라미터로 홈 탐지 테스트
 */
export function testHoleDetectionWithVariousParameters(
    sceneRoot: THREE.Object3D,
    targetNode: THREE.Object3D
): void {
    const highlighter = new NormalBasedHighlight();
    highlighter.initialize(sceneRoot);

    const testCases = [
        {
            name: '기본 설정',
            normalFilter: new THREE.Vector3(0, 0, 1),
            normalTolerance: 0.2,
            clusterThreshold: 0.05,
            sphereRadius: 0.005
        },
        {
            name: '엄격한 필터링',
            normalFilter: new THREE.Vector3(0, 0, 1),
            normalTolerance: 0.1,
            clusterThreshold: 0.03,
            sphereRadius: 0.005
        },
        {
            name: '넓은 필터링',
            normalFilter: new THREE.Vector3(0, 0, 1),
            normalTolerance: 0.3,
            clusterThreshold: 0.08,
            sphereRadius: 0.005
        }
    ];

    testCases.forEach((testCase, index) => {
        console.log(`\n=== 테스트 케이스 #${index + 1}: ${testCase.name} ===`);

        // 이전 하이라이트 제거
        highlighter.clearHighlights();

        const holes = highlighter.detectAndVisualizeHoles(
            targetNode,
            testCase.normalFilter,
            testCase.normalTolerance,
            testCase.clusterThreshold,
            testCase.sphereRadius
        );

        console.log(`탐지된 홈 개수: ${holes.length}`);
    });
}

/**
 * 실제 사용 예시 (ModelViewer 또는 다른 컴포넌트에서 호출)
 */
export function exampleUsageInComponent(
    sceneRoot: THREE.Object3D,
    targetNodeName: string,
    camera: THREE.Camera
): void {
    // 타겟 노드 찾기
    const targetNode = sceneRoot.getObjectByName(targetNodeName);

    if (!targetNode) {
        console.error(`노드를 찾을 수 없습니다: ${targetNodeName}`);
        return;
    }

    // 홈 탐지 및 시각화 실행
    demonstrateHoleDetection(sceneRoot, targetNode, camera);
}
