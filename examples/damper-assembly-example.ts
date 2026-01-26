/**
 * 댐퍼 조립 애니메이션 사용 예시
 * 
 * 이 파일은 PartAssemblyService를 사용하여
 * LEFT_DOOR_DAMPER_COVER_BODY_NODE를 LEFT_DOOR_DAMPER_ASSEMBLY_NODE로
 * 조립하는 방법을 보여줍니다.
 */

import * as THREE from 'three';
import { PartAssemblyService } from '../src/services/fridge/PartAssemblyService';
import {
    LEFT_DOOR_DAMPER_COVER_BODY_NODE,
    LEFT_DOOR_DAMPER_ASSEMBLY_NODE
} from '../src/shared/utils/fridgeConstants';

/**
 * 기본 사용 예시
 */
export async function basicAssemblyExample(sceneRoot: THREE.Object3D) {
    // 1. 서비스 초기화
    const assemblyService = new PartAssemblyService(sceneRoot);

    // 2. 조립 실행
    await assemblyService.assemblePart(
        LEFT_DOOR_DAMPER_COVER_BODY_NODE,
        LEFT_DOOR_DAMPER_ASSEMBLY_NODE,
        {
            duration: 2500,
            liftHeight: 2.0,
            snapThreshold: 0.2,
            onProgress: (progress) => {
                console.log(`조립 진행률: ${(progress * 100).toFixed(1)}%`);
            },
            onSnap: () => {
                console.log('스냅 존 진입!');
            },
            onComplete: () => {
                console.log('조립 완료!');
            }
        }
    );
}

/**
 * 고급 사용 예시 - 커스텀 이징 및 콜백
 */
export async function advancedAssemblyExample(sceneRoot: THREE.Object3D) {
    const assemblyService = new PartAssemblyService(sceneRoot);

    // 진행률 표시용 UI 업데이트 함수 (예시)
    const updateProgressBar = (progress: number) => {
        const percentage = Math.round(progress * 100);
        console.log(`[UI] 진행률: ${percentage}%`);
        // 실제로는 DOM 요소 업데이트
        // document.getElementById('progress-bar').style.width = `${percentage}%`;
    };

    // 스냅 효과 시각화 (예시)
    const showSnapEffect = () => {
        console.log('[UI] 스냅 효과 표시');
        // 실제로는 파티클 효과나 사운드 재생
    };

    await assemblyService.assemblePart(
        LEFT_DOOR_DAMPER_COVER_BODY_NODE,
        LEFT_DOOR_DAMPER_ASSEMBLY_NODE,
        {
            duration: 3000,
            liftHeight: 2.5,
            snapThreshold: 0.25,
            easing: 'elastic.out(1, 0.5)', // 탄성 효과
            onProgress: updateProgressBar,
            onSnap: showSnapEffect,
            onComplete: () => {
                console.log('[UI] 조립 완료 메시지 표시');
            }
        }
    );
}

/**
 * 조립 후 분해 예시
 */
export async function assembleAndDisassembleExample(sceneRoot: THREE.Object3D) {
    const assemblyService = new PartAssemblyService(sceneRoot);

    // 1. 조립
    console.log('=== 조립 시작 ===');
    await assemblyService.assemblePart(
        LEFT_DOOR_DAMPER_COVER_BODY_NODE,
        LEFT_DOOR_DAMPER_ASSEMBLY_NODE,
        {
            duration: 2000,
            liftHeight: 1.5
        }
    );

    // 2. 2초 대기
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 3. 분해
    console.log('=== 분해 시작 ===');
    await assemblyService.disassemblePart(
        LEFT_DOOR_DAMPER_COVER_BODY_NODE,
        {
            duration: 1500,
            liftHeight: 1.5
        }
    );

    console.log('=== 완료 ===');
}

/**
 * 애니메이션 제어 예시 (일시정지/재개)
 */
export async function animationControlExample(sceneRoot: THREE.Object3D) {
    const assemblyService = new PartAssemblyService(sceneRoot);

    // 조립 시작 (await 없이)
    const assemblyPromise = assemblyService.assemblePart(
        LEFT_DOOR_DAMPER_COVER_BODY_NODE,
        LEFT_DOOR_DAMPER_ASSEMBLY_NODE,
        {
            duration: 5000, // 긴 시간으로 설정
            liftHeight: 2.0
        }
    );

    // 1초 후 일시정지
    setTimeout(() => {
        console.log('애니메이션 일시정지');
        assemblyService.pause();
    }, 1000);

    // 3초 후 재개
    setTimeout(() => {
        console.log('애니메이션 재개');
        assemblyService.resume();
    }, 3000);

    // 완료 대기
    await assemblyPromise;
    console.log('애니메이션 완료');
}

/**
 * 진행률 모니터링 예시
 */
export async function progressMonitoringExample(sceneRoot: THREE.Object3D) {
    const assemblyService = new PartAssemblyService(sceneRoot);

    // 조립 시작 (await 없이)
    const assemblyPromise = assemblyService.assemblePart(
        LEFT_DOOR_DAMPER_COVER_BODY_NODE,
        LEFT_DOOR_DAMPER_ASSEMBLY_NODE,
        {
            duration: 3000,
            liftHeight: 2.0
        }
    );

    // 진행률 모니터링 (100ms마다)
    const monitorInterval = setInterval(() => {
        const progress = assemblyService.getProgress();
        const isPlaying = assemblyService.isPlaying();

        console.log(`진행률: ${(progress * 100).toFixed(1)}%, 재생 중: ${isPlaying}`);

        if (!isPlaying) {
            clearInterval(monitorInterval);
        }
    }, 100);

    // 완료 대기
    await assemblyPromise;
    clearInterval(monitorInterval);
}

/**
 * 에러 처리 예시
 */
export async function errorHandlingExample(sceneRoot: THREE.Object3D) {
    const assemblyService = new PartAssemblyService(sceneRoot);

    try {
        await assemblyService.assemblePart(
            'INVALID_NODE_NAME', // 존재하지 않는 노드
            LEFT_DOOR_DAMPER_ASSEMBLY_NODE,
            {
                duration: 2000
            }
        );
    } catch (error) {
        console.error('조립 실패:', error);
        // 에러 처리 로직
    }
}

/**
 * React 컴포넌트에서 사용 예시
 */
export function ReactComponentExample() {
    // React 컴포넌트 내부에서 사용하는 방법

    const handleAssemble = async (sceneRoot: THREE.Object3D) => {
        const assemblyService = new PartAssemblyService(sceneRoot);

        try {
            await assemblyService.assemblePart(
                LEFT_DOOR_DAMPER_COVER_BODY_NODE,
                LEFT_DOOR_DAMPER_ASSEMBLY_NODE,
                {
                    duration: 2500,
                    liftHeight: 2.0,
                    onProgress: (progress) => {
                        // React state 업데이트
                        // setProgress(progress);
                    },
                    onComplete: () => {
                        // 완료 후 처리
                        // setIsAssembled(true);
                    }
                }
            );
        } catch (error) {
            console.error('조립 실패:', error);
            // setError(error);
        }
    };

    return {
        handleAssemble
    };
}

/**
 * 여러 부품 순차 조립 예시
 */
export async function sequentialAssemblyExample(sceneRoot: THREE.Object3D) {
    const assemblyService = new PartAssemblyService(sceneRoot);

    const parts = [
        { source: 'PART_1', target: 'TARGET_1' },
        { source: 'PART_2', target: 'TARGET_2' },
        { source: 'PART_3', target: 'TARGET_3' }
    ];

    for (const part of parts) {
        console.log(`조립 중: ${part.source} → ${part.target}`);

        await assemblyService.assemblePart(
            part.source,
            part.target,
            {
                duration: 2000,
                liftHeight: 1.5
            }
        );

        // 각 조립 사이에 0.5초 대기
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log('모든 부품 조립 완료');
}

/**
 * 메모리 정리 예시
 */
export function cleanupExample(assemblyService: PartAssemblyService) {
    // 컴포넌트 언마운트 시 또는 더 이상 사용하지 않을 때
    assemblyService.dispose();
    console.log('서비스 정리 완료');
}
