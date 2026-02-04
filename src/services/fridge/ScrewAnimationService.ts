import * as THREE from 'three';
import gsap from 'gsap';
import { isFastenerNodeName } from '@/shared/utils/isFastener';
import { getMetadataLoader } from '@/shared/utils/MetadataLoader';
import { getNodeNameManager } from '../../shared/utils/NodeNameManager';

/**
 * Screw 회전 애니메이션 옵션 인터페이스
 */
export interface ScrewAnimationOptions {
    duration?: number;           // 전체 애니메이션 시간 (ms)
    rotationAngle?: number;      // 회전 각도 (도, 기본값: 720도 = 2바퀴)
    pullDistance?: number;       // 빼내는 거리 (m, 기본값: 없으면 screwPitch로 계산)
    screwPitch?: number;         // 나사산 간격 (m, 기본값: 0.005m = 0.5cm)
    rotationAxis?: 'x' | 'y' | 'z'; // 회전축 (기본값: 'z')
    extractDirection?: [number, number, number]; // 빼내는 방향 (로컬 좌표계, 기본값: [0, 0, 1])
    onComplete?: () => void;    // 완료 콜백
    onProgress?: (progress: number) => void; // 진행률 콜백
}

/**
 * Screw 애니메이션 메타데이터 인터페이스
 */
export interface ScrewAnimationMetadata {
    rotationAxis: 'x' | 'y' | 'z';
    rotationAngle: number;
    extractDirection: [number, number, number];
    extractDistance: number;
    duration: number;
    easing: string;
}

/**
 * Screw 회전 애니메이션 서비스
 * Screw를 돌려서 빼는 애니메이션을 담당합니다.
 */
export class ScrewAnimationService {
    private sceneRoot: THREE.Object3D | null = null;
    private timeline: gsap.core.Timeline | null = null;
    private isAnimating: boolean = false;
    private metadataLoader = getMetadataLoader();
    private nodeNameManager = getNodeNameManager();

    /**
     * 서비스를 초기화합니다.
     * @param sceneRoot 씬 루트 객체
     */
    public initialize(sceneRoot: THREE.Object3D): void {
        this.sceneRoot = sceneRoot;

        // 메타데이터 미리 로드
        this.loadMetadata();
    }

    /**
     * 메타데이터를 로드합니다.
     */
    private async loadMetadata(): Promise<void> {
        if (!this.metadataLoader.isLoaded()) {
            try {
                await this.metadataLoader.loadMetadata('/metadata/assembly-offsets.json');
                console.log('[ScrewAnimation] 메타데이터 로드 완료');
            } catch (error) {
                console.error('[ScrewAnimation] 메타데이터 로드 실패:', error);
            }
        }
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
     * 메타데이터가 있으면 메타데이터를 우선 사용합니다.
     * @param nodeName 대상 노드 이름
     * @param metadataKey 메타데이터 키 (예: 'screw1Customized')
     * @param options 애니메이션 옵션 (메타데이터가 있을 경우 옵션은 덮어씌워짐)
     * @returns Promise (애니메이션 완료 시 resolve)
     */
    public async animateScrewRotation(
        nodePath: string,
        metadataKey: string,
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

        // 메타데이터가 로드될 때까지 대기
        await this.loadMetadata();

        console.log('nodePath>> ', nodePath);
        console.log('metadataKey>> ', metadataKey);

        // 메타데이터에서 설정 가져오기
        const metadata = this.metadataLoader.getScrewAnimationConfig(metadataKey);
        console.log('metadata>> ', metadata);
        const hasMetadata = metadata !== null;

        // 옵션과 메타데이터 병합 (메타데이터 우선)
        const config = {
            duration: options.duration ?? metadata?.duration ?? 1500,
            rotationAngle: options.rotationAngle ?? metadata?.rotationAngle ?? 720,
            screwPitch: options.screwPitch ?? 0.005,
            rotationAxis: options.rotationAxis ?? metadata?.rotationAxis ?? 'z',
            easing: metadata?.easing ?? 'power2.inOut',
            extractDirection: options.extractDirection ?? metadata?.extractDirection ?? [0, 0, 1],
            ...options
        };
        console.log('config>>> ', config);

        const screwNodeName = this.nodeNameManager.getNodeName(nodePath);
        if (!screwNodeName) {
            console.error(`[ScrewAnimation] 노드 이름을 찾을 수 없습니다: ${nodePath}`);
            return;
        }
        console.log('screwNodeName>> ', screwNodeName);  // 4J01424B_Screw,Customized_4168029

        const screwNodeObj = this.sceneRoot.getObjectByName(screwNodeName);
        console.log('screwNodeObj>> ', screwNodeObj);
        if (!screwNodeObj) {
            console.error(`[ScrewAnimation] 노드를 찾을 수 없습니다: ${screwNodeName}`);
            return;
        }

        // pullDistance가 있으면 우선 사용, 없으면 메타데이터에서 추출
        let translationDistance: number;
        if (options.pullDistance !== undefined) {
            translationDistance = options.pullDistance;
        } else if (metadata?.extractDistance !== undefined) {
            translationDistance = metadata.extractDistance;
        } else {
            translationDistance = (config.rotationAngle! / 360) * config.screwPitch!;
        }

        // 회전축에 따른 rotation 속성명 결정
        const axis = config.rotationAxis;

        this.timeline = gsap.timeline({
            onStart: () => {
                this.isAnimating = true;
                console.log(`[ScrewAnimation] ${screwNodeName} 회전 시작 (메타데이터: ${hasMetadata ? '사용' : '미사용'})`);
                if (hasMetadata) {
                    console.log(`[ScrewAnimation] 사용된 설정:`, {
                        rotationAxis: config.rotationAxis,
                        rotationAngle: config.rotationAngle,
                        extractDirection: config.extractDirection,
                        extractDistance: translationDistance,
                        duration: config.duration,
                        easing: config.easing
                    });
                }
            },
            onComplete: () => {
                this.isAnimating = false;
                console.log(`[ScrewAnimation] ${screwNodeName} 회전 완료`);
                config.onComplete?.();
            },
            onUpdate: () => {
                const progress = this.timeline?.progress() || 0;
                config.onProgress?.(progress);
            }
        });

        // 회전 애니메이션
        this.timeline.to(screwNodeObj.rotation, {
            [axis]: -config.rotationAngle! * (Math.PI / 180),
            duration: config.duration! / 1000,
            ease: config.easing
        }, 0);

        // 빼내는 방향을 로컬 좌표계로 유지한 채 이동 (z축 방향으로 빼내기)
        const localExtractDir = new THREE.Vector3(...config.extractDirection!);
        localExtractDir.normalize().multiplyScalar(translationDistance);
        console.log('localExtractDir>> ', localExtractDir);
        console.log('screwNodeObj.position>> ', screwNodeObj.position);
        // 이동 애니메이션 (로컬 좌표계 기준)
        this.timeline.to(screwNodeObj.position, {
            x: screwNodeObj.position.x + localExtractDir.x,
            y: screwNodeObj.position.y + localExtractDir.y,
            z: screwNodeObj.position.z + localExtractDir.z,
            duration: config.duration! / 1000,
            ease: config.easing
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
