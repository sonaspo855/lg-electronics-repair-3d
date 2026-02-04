import * as THREE from 'three';
import gsap from 'gsap';
import { isFastenerNodeName } from '@/shared/utils/isFastener';

/**
 * Screw 회전 애니메이션 옵션 인터페이스
 */
export interface ScrewAnimationOptions {
    duration?: number;           // 전체 애니메이션 시간 (ms)
    rotationAngle?: number;      // 회전 각도 (도, 기본값: 720도 = 2바퀴)
    pullDistance?: number;       // 빼내는 거리 (m, 기본값: 없으면 screwPitch로 계산)
    screwPitch?: number;         // 나사산 간격 (m, 기본값: 0.005m = 0.5cm)
    rotationAxis?: 'x' | 'y' | 'z'; // 회전축 (기본값: 'z')
    onComplete?: () => void;    // 완료 콜백
    onProgress?: (progress: number) => void; // 진행률 콜백
}

/**
 * Screw 회전 애니메이션 서비스
 * Screw를 돌려서 빼는 애니메이션을 담당합니다.
 */
export class ScrewAnimationService {
    private sceneRoot: THREE.Object3D | null = null;
    private timeline: gsap.core.Timeline | null = null;
    private isAnimating: boolean = false;

    /**
     * 서비스를 초기화합니다.
     * @param sceneRoot 씬 루트 객체
     */
    public initialize(sceneRoot: THREE.Object3D): void {
        this.sceneRoot = sceneRoot;
    }

    /**
     * Screw 노드인지 확인합니다.
     * @param nodeName 노드 이름
     * @returns Screw 노드이면 true
     */
    public isScrewNode(nodeName: string): boolean {
        return isFastenerNodeName(nodeName);
    }

    /**
     * Screw 회전+이동 동시 애니메이션을 실행합니다.
     * @param nodeName 대상 노드 이름
     * @param options 애니메이션 옵션
     * @returns Promise (애니메이션 완료 시 resolve)
     */
    public async animateScrewRotation(
        nodeName: string,
        options: ScrewAnimationOptions = {}
    ): Promise<void> {
        if (!this.sceneRoot) {
            console.error('Scene root not initialized.');
            return;
        }

        // 기존 애니메이션 정리 (메모리 누수 방지)
        if (this.timeline) {
            this.timeline.kill();
            this.timeline = null;
        }

        const config = {
            duration: options.duration || 1500,
            rotationAngle: options.rotationAngle || 720,
            screwPitch: options.screwPitch || 0.005,
            rotationAxis: options.rotationAxis || 'z',
            ...options
        };

        const node = this.sceneRoot.getObjectByName(nodeName);
        if (!node) {
            console.error(`[ScrewAnimation] 노드를 찾을 수 없습니다: ${nodeName}`);
            return;
        }

        // pullDistance가 있으면 우선 사용, 없으면 screwPitch 기반으로 계산
        let translationDistance: number;
        if (config.pullDistance !== undefined) {
            translationDistance = config.pullDistance;
        } else {
            translationDistance = (config.rotationAngle / 360) * config.screwPitch;
        }

        // 회전축에 따른 rotation 속성명 결정
        const axis = config.rotationAxis;

        this.timeline = gsap.timeline({
            onStart: () => {
                this.isAnimating = true;
                console.log(`[ScrewAnimation] ${nodeName} 회전 시작`);
            },
            onComplete: () => {
                this.isAnimating = false;
                console.log(`[ScrewAnimation] ${nodeName} 회전 완료`);
                config.onComplete?.();
            },
            onUpdate: () => {
                const progress = this.timeline?.progress() || 0;
                config.onProgress?.(progress);
            }
        });

        this.timeline.to(node.rotation, {
            [axis]: -config.rotationAngle * (Math.PI / 180),
            duration: config.duration / 1000,
            ease: 'power2.inOut'
        }, 0);

        this.timeline.to(node.position, {
            z: node.position.z + translationDistance,
            duration: config.duration / 1000,
            ease: 'power2.inOut'
        }, 0);

        return new Promise((resolve) => {
            this.timeline?.eventCallback('onComplete', () => {
                resolve();
            });
        });
    }

    public isPlaying(): boolean {
        return this.isAnimating;
    }

    public getProgress(): number {
        return this.timeline?.progress() || 0;
    }

    public pause(): void {
        if (this.timeline && this.isAnimating) {
            this.timeline.pause();
            console.log('[ScrewAnimation] 애니메이션 일시정지');
        }
    }

    public resume(): void {
        if (this.timeline) {
            this.timeline.resume();
            console.log('[ScrewAnimation] 애니메이션 재개');
        }
    }

    public async reverse(): Promise<void> {
        if (this.timeline) {
            console.log('[ScrewAnimation] 애니메이션 되돌리기 시작');
            return new Promise((resolve) => {
                this.timeline?.reverse();
                this.timeline?.eventCallback('onReverseComplete', () => {
                    console.log('[ScrewAnimation] 애니메이션 되돌리기 완료');
                    resolve();
                });
            });
        }
    }

    public dispose(): void {
        if (this.timeline) {
            this.timeline.kill();
            this.timeline = null;
        }
        this.sceneRoot = null;
        this.isAnimating = false;
    }
}

let screwAnimationServiceInstance: ScrewAnimationService | null = null;

export function getScrewAnimationService(): ScrewAnimationService {
    if (!screwAnimationServiceInstance) {
        screwAnimationServiceInstance = new ScrewAnimationService();
    }
    return screwAnimationServiceInstance;
}
