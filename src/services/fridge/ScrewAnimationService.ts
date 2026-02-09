import * as THREE from 'three';
import gsap from 'gsap';
import { isFastenerNodeName } from '@/shared/utils/isFastener';
import { getMetadataLoader } from '@/shared/utils/MetadataLoader';
import { getNodeNameManager } from '../../shared/utils/NodeNameManager';
import { calculateTranslationDistance } from '../../shared/utils/screwAnimationUtils';
import { createAnimationTimeline } from '../../shared/utils/animationUtils';

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
    easing?: string;             // 이징 함수 (기본값: 메타데이터에서 가져옴)
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
            } catch (error) {
                console.error('Metadata loading failed:', error);
                throw new Error('Failed to load metadata');
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
     * Screw 회전+이동 동시 애니메이션을 실행
     * 메타데이터가 있으면 메타데이터를 우선 사용
     * @param nodeName 대상 노드 이름
     * @param metadataKey 메타데이터 키 (예: 'screw1Customized')
     * @param options 애니메이션 옵션 (메타데이터가 있을 경우 옵션은 덮어씌워짐)
     * @returns Promise (애니메이션 완료 시 resolve, 실제 사용된 설정값 반환)
     */
    public async animateScrewRotation(
        nodePath: string,
        metadataKey: string,
        options: ScrewAnimationOptions = {}
    ): Promise<ScrewAnimationMetadata> {
        if (!this.sceneRoot) {
            console.error('Scene root not initialized.');
            throw new Error('Scene root not initialized.');
        }

        // 기존 애니메이션 정리 (메모리 누수 방지)
        if (this.timeline) {
            this.timeline.kill();
            this.timeline = null;
        }

        // 메타데이터가 로드될 때까지 대기
        await this.loadMetadata();

        // console.log('nodePath>> ', nodePath);
        // console.log('metadataKey>> ', metadataKey);

        // 메타데이터에서 설정 가져오기
        const metadata = this.metadataLoader.getScrewAnimationConfig(metadataKey);
        const hasMetadata = metadata !== null;

        console.log('options333>> ', options.duration);
        console.log('options333>> ', options.rotationAngle);

        // 옵션과 메타데이터 병합 (메타데이터 우선)
        const config = {
            duration: options.duration ?? metadata?.duration ?? 1500,
            rotationAngle: options.rotationAngle ?? metadata?.rotationAngle ?? 720,
            screwPitch: options.screwPitch ?? 0.005,
            rotationAxis: options.rotationAxis ?? metadata?.rotationAxis ?? 'z',
            easing: options.easing ?? metadata?.easing ?? 'power2.inOut',
            extractDirection: options.extractDirection ?? metadata?.extractDirection ?? [0, 0, 1],
            ...options
        };

        const screwNodeName = this.nodeNameManager.getNodeName(nodePath);  // `fridge.leftDoorDamper.screw2Customized` 로 노드 이름 추출
        if (!screwNodeName) {
            console.error(`노드 이름을 찾을 수 없습니다: ${nodePath}`);
            throw new Error(`노드 이름을 찾을 수 없습니다: ${nodePath}`);
        }
        // console.log('screwNodeName>> ', screwNodeName);  // 4J01424B_Screw,Customized_4168029

        const screwNodeObj = this.sceneRoot.getObjectByName(screwNodeName);
        // console.log('screwNodeObj>> ', screwNodeObj);
        if (!screwNodeObj) {
            console.error(`노드를 찾을 수 없습니다: ${screwNodeName}`);
            throw new Error(`노드를 찾을 수 없습니다: ${screwNodeName}`);
        }

        // pullDistance가 있으면 우선 사용, 없으면 메타데이터에서 추출
        const translationDistance = calculateTranslationDistance(
            options,
            metadata,
            config.screwPitch!,
            config.rotationAngle!
        );
        // console.log('translationDistance>> ', translationDistance);  // 10, 50

        // 실제 사용된 설정값 (반환용)
        const usedConfig: ScrewAnimationMetadata = {
            rotationAxis: config.rotationAxis!,
            rotationAngle: config.rotationAngle!,
            extractDirection: config.extractDirection!,
            extractDistance: translationDistance,
            duration: config.duration!,
            easing: config.easing!
        };

        // 회전+이동 동시 애니메이션 생성
        this.timeline = createAnimationTimeline(
            screwNodeObj,
            {
                rotationAxis: config.rotationAxis!,
                rotationAngle: config.rotationAngle!,
                extractDirection: new THREE.Vector3(...config.extractDirection!),
                translationDistance,
                duration: config.duration!,
                easing: config.easing!
            },
            {
                onStart: () => {
                    this.isAnimating = true;
                    console.log(`${screwNodeName} 회전 시작 (메타데이터: ${hasMetadata ? '사용' : '미사용'})`);
                    if (hasMetadata) {
                        console.log(`사용된 설정:`, {
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
                    console.log(`${screwNodeName} 회전 완료`);
                    config.onComplete?.();
                },
                onProgress: (progress) => {
                    config.onProgress?.(progress);
                }
            }
        );

        return new Promise((resolve) => {
            this.timeline?.eventCallback('onComplete', () => {
                resolve(usedConfig);
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
            console.log('애니메이션 일시정지');
        }
    }

    public resume(): void {
        if (this.timeline) {
            this.timeline.resume();
            console.log('애니메이션 재개');
        }
    }

    public async reverse(): Promise<void> {
        if (this.timeline) {
            console.log('애니메이션 되돌리기 시작');
            return new Promise((resolve) => {
                this.timeline?.reverse();
                this.timeline?.eventCallback('onReverseComplete', () => {
                    console.log('애니메이션 되돌리기 완료');
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
