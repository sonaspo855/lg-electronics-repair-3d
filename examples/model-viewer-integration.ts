/**
 * ModelViewer 통합 예시
 * 
 * 이 파일은 실제 프로젝트(ModelViewer.tsx 등)에서
 * 댐퍼 조립 서비스를 어떻게 통합해서 사용하는지 보여줍니다.
 */

import * as THREE from 'three';
import { DamperAssemblyService, getDamperAssemblyService } from '../src/services/fridge/DamperAssemblyService';
import { LEFT_DOOR_DAMPER_COVER_BODY_NODE } from '../src/shared/utils/fridgeConstants';

// 전역 서비스 인스턴스
let damperAssemblyService: DamperAssemblyService | null = null;

/**
 * ModelViewer 컴포넌트에서 초기화
 */
export function initializeDamperAssembly(sceneRoot: THREE.Object3D) {
    damperAssemblyService = getDamperAssemblyService();
    damperAssemblyService.initialize(sceneRoot);
    console.log('✅ 댐퍼 조립 서비스 초기화 완료');
}

/**
 * 버튼 클릭 시 조립 실행
 */
export async function onAssembleDamperCover() {
    if (!damperAssemblyService) {
        console.error('❌ 서비스가 초기화되지 않았습니다');
        return;
    }

    console.log('🚀 댐퍼 커버 조립 시작');

    try {
        await damperAssemblyService.assembleDamperCover({
            duration: 2500,
            liftHeight: 2.0,
            snapThreshold: 0.2,
            onComplete: () => {
                console.log('🎉 조립 완료! 커버가 Assembly 위치에 결합되었습니다.');
                // UI 업데이트나 다른 후속 작업
            }
        });
    } catch (error) {
        console.error('❌ 조립 실패:', error);
    }
}

/**
 * 버튼 클릭 시 분해 실행
 */
export async function onDisassembleDamperCover() {
    if (!damperAssemblyService) {
        console.error('❌ 서비스가 초기화되지 않았습니다');
        return;
    }

    console.log('🚀 댐퍼 커버 분해 시작');

    try {
        await damperAssemblyService.disassembleDamperCover({
            duration: 1500,
            liftHeight: 1.5,
            onComplete: () => {
                console.log('🔄 분해 완료!');
            }
        });
    } catch (error) {
        console.error('❌ 분해 실패:', error);
    }
}

/**
 * 현재 진행률 모니터링
 */
export function getAssemblyProgress(): number {
    if (!damperAssemblyService) {
        return 0;
    }
    return damperAssemblyService.getProgress();
}

/**
 * 정리
 */
export function cleanupDamperAssembly() {
    if (damperAssemblyService) {
        damperAssemblyService.dispose();
        damperAssemblyService = null;
    }
}

/**
 * React 컴포넌트에서 사용하는 예시
 */
export function useDamperAssembly(sceneRoot: THREE.Object3D | null) {
    const [service, setService] = React.useState<DamperAssemblyService | null>(null);

    // 초기화
    React.useEffect(() => {
        if (sceneRoot) {
            const damperService = getDamperAssemblyService();
            damperService.initialize(sceneRoot);
            setService(damperService);

            return () => {
                damperService.dispose();
            };
        }
    }, [sceneRoot]);

    // 조립 함수
    const assemble = React.useCallback(async () => {
        if (service) {
            await service.assembleDamperCover({
                duration: 2500,
                liftHeight: 2.0,
                onComplete: () => {
                    console.log('✅ 조립 완료');
                }
            });
        }
    }, [service]);

    // 분해 함수
    const disassemble = React.useCallback(async () => {
        if (service) {
            await service.disassembleDamperCover({
                duration: 1500,
                liftHeight: 1.5,
                onComplete: () => {
                    console.log('✅ 분해 완료');
                }
            });
        }
    }, [service]);

    return {
        service,
        assemble,
        disassemble,
        progress: service?.getProgress() || 0,
        isPlaying: service?.isPlaying() || false
    };
}

// React import (실제 사용 시 제거)
import React from 'react';

/**
 * HTML에서 직접 호출 가능한 전역 함수
 * 브라우저 콘솔에서 테스트 가능
 */
if (typeof window !== 'undefined') {
    (window as any).damperAssembly = {
        assemble: onAssembleDamperCover,
        disassemble: onDisassembleDamperCover,
        getProgress: getAssemblyProgress,
        init: initializeDamperAssembly,
        cleanup: cleanupDamperAssembly
    };
}
