import * as THREE from 'three';
import gsap from 'gsap';
import { CoordinateTransformUtils } from '../../shared/utils/CoordinateTransformUtils';
import { SnapDetectionUtils } from '../../shared/utils/SnapDetectionUtils';

/**
 * 조립 애니메이션 옵션 인터페이스
 */
export interface AssemblyOptions {
    duration?: number;           // 전체 애니메이션 시간 (ms)
    snapThreshold?: number;      // 스냅 감지 임계값
    easing?: string;             // GSAP easing
    onProgress?: (progress: number) => void;
    onSnap?: () => void;         // 스냅 진입 시 콜백
    onComplete?: () => void;
}

/**
 * 부품 조립 서비스
 * GSAP Timeline을 활용한 정밀한 부품 조립/분해 애니메이션 관리
 */
export class PartAssemblyService {
    private sceneRoot: THREE.Object3D;
    private timeline: gsap.core.Timeline | null = null;
    private isAnimating: boolean = false;
    private originalPositions: Map<string, THREE.Vector3> = new Map();

    constructor(sceneRoot: THREE.Object3D) {
        this.sceneRoot = sceneRoot;
    }

    /**
 * PartAssemblyService.ts 추가/수정 부분
 */

    // 1. 수동 조립 준비 (타임라인만 생성하고 일시정지)
    public prepareManualAssembly(
        sourceNodeName: string,
        targetNodeName: string,
        options: AssemblyOptions = {}
    ): void {
        console.log('ccccccc');
        const sourceNode = this.sceneRoot.getObjectByName(sourceNodeName);
        const targetNode = this.sceneRoot.getObjectByName(targetNodeName);

        console.log('sourceNode>> ', sourceNode);
        console.log('targetNode>> ', targetNode);
        if (!sourceNode || !targetNode) return;

        // 타겟 위치 계산 (기존 로직 활용)
        const targetWorldCenter = CoordinateTransformUtils.getWorldCenter(targetNode);
        const targetLocalPos = sourceNode.parent
            ? CoordinateTransformUtils.worldToLocal(targetWorldCenter, sourceNode.parent)
            : targetWorldCenter;

        // 타임라인 생성 및 즉시 정지(paused: true)
        this.timeline = gsap.timeline({ paused: true });
        this.isAnimating = true;

        this.timeline.to(sourceNode.position, {
            x: targetLocalPos.x,
            y: targetLocalPos.y,
            duration: 1, // progress(0~1) 계산을 쉽게 하기 위해 1초로 설정
            ease: 'none', // 수동 제어 시에는 linear가 가장 직관적임
            onUpdate: () => {
                options.onProgress?.(this.timeline?.progress() || 0);
            }
        });
    }

    // 2. 외부 입력(마우스/슬라이더)에 따른 진행률 업데이트
    public updateManualProgress(progress: number): void {
        if (this.timeline) {
            // 0~1 사이 값으로 클램핑하여 타임라인 위치 이동
            const clampedProgress = Math.min(Math.max(progress, 0), 1);
            this.timeline.progress(clampedProgress);
        }
    }

    /**
     * 부품을 타겟 위치로 조립
     * 
     * @param sourceNodeName 이동할 부품 노드 이름
     * @param targetNodeName 목적지 노드 이름
     * @param options 애니메이션 옵션
     * @returns Promise (애니메이션 완료 시 resolve)
     * 
     * @example
     * await assemblyService.assemblePart(
     *     'LEFT_DOOR_DAMPER_COVER_BODY_NODE',
     *     'LEFT_DOOR_DAMPER_ASSEMBLY_NODE',
     *     { duration: 2000, liftHeight: 2 }
     * );
     */
    public async assemblePart(
        sourceNodeName: string,
        targetNodeName: string,
        options: AssemblyOptions = {}
    ): Promise<void> {
        // 기본값 설정
        const config = {
            duration: options.duration || 2000,
            snapThreshold: options.snapThreshold || 0.15,
            easing: options.easing || 'power3.inOut',
            ...options
        };

        // 노드 찾기
        const sourceNode = this.sceneRoot.getObjectByName(sourceNodeName);
        const targetNode = this.sceneRoot.getObjectByName(targetNodeName);

        if (!sourceNode || !targetNode) {
            console.error('[Assembly] 노드를 찾을 수 없습니다:', {
                source: sourceNodeName,
                target: targetNodeName,
                sourceFound: !!sourceNode,
                targetFound: !!targetNode
            });
            return;
        }

        // 원래 위치 저장 (되돌리기용)
        if (!this.originalPositions.has(sourceNodeName)) {
            this.originalPositions.set(sourceNodeName, sourceNode.position.clone());
        }

        console.log('[Assembly] 조립 시작:', {
            source: sourceNodeName,
            target: targetNodeName,
            config
        });

        // 1. 타겟의 월드 중심점 계산
        const targetWorldCenter = CoordinateTransformUtils.getWorldCenter(targetNode);
        console.log('[Assembly] 타겟 월드 중심점:', targetWorldCenter);

        // 2. source의 부모 기준 로컬 좌표로 변환
        const targetLocalPos = sourceNode.parent
            ? CoordinateTransformUtils.worldToLocal(targetWorldCenter, sourceNode.parent)
            : targetWorldCenter;
        console.log('[Assembly] 타겟 로컬 좌표:', targetLocalPos);

        // 3. GSAP Timeline 생성
        this.timeline = gsap.timeline({
            onComplete: () => {
                this.isAnimating = false;
                console.log('[Assembly] 조립 완료:', sourceNodeName);
                config.onComplete?.();
            }
        });

        this.isAnimating = true;
        // let snapTriggered = false;

        // 단계 1: 타겟 위치로 선형 이동 (메인 애니메이션)
        // const mainDuration = config.duration / 1000;

        console.log('x>> ', targetLocalPos.x, 'y>> ', targetLocalPos.y, 'z>> ', targetLocalPos.z);
        // [수정] 들어올림(Lift) 단계 없이 타겟 위치로 즉시 선형 이동
        // `z:` 속성이 없는 이유는 들어올리지 않고 선형이동만 하게 하기 위해서..
        this.timeline.to(sourceNode.position, {
            x: targetLocalPos.x,
            y: targetLocalPos.y,
            duration: config.duration / 1000,
            ease: config.easing, // 'linear' 또는 'power3.inOut' 등 옵션에 따름
            onUpdate: () => {
                const progress = this.timeline?.progress() || 0;
                config.onProgress?.(progress);
            },
            onStart: () => {
                console.log('[Assembly] 직선 조립 이동 시작');
            }
        });

        // 애니메이션 완료 대기
        return new Promise((resolve) => {
            this.timeline?.eventCallback('onComplete', () => {
                resolve();
            });
        });
    }

    /**
     * 조립된 부품을 원래 위치로 분해
     * 
     * @param partNodeName 분해할 부품 노드 이름
     * @param options 애니메이션 옵션
     * @returns Promise (애니메이션 완료 시 resolve)
     * 
     * @example
     * await assemblyService.disassemblePart('LEFT_DOOR_DAMPER_COVER_BODY_NODE');
     */
    public async disassemblePart(
        partNodeName: string,
        options: AssemblyOptions = {}
    ): Promise<void> {
        const config = {
            duration: options.duration || 1500,
            easing: options.easing || 'power2.inOut',
            ...options
        };

        const partNode = this.sceneRoot.getObjectByName(partNodeName);
        if (!partNode) {
            console.error('[Disassembly] 노드를 찾을 수 없습니다:', partNodeName);
            return;
        }

        // 원래 위치 가져오기
        const originalPosition = this.originalPositions.get(partNodeName);
        if (!originalPosition) {
            console.warn('[Disassembly] 원래 위치를 찾을 수 없습니다. 현재 위치 사용:', partNodeName);
            return;
        }

        console.log('[Disassembly] 분해 시작:', {
            part: partNodeName,
            originalPosition,
            config
        });

        // Timeline 생성
        this.timeline = gsap.timeline({
            onComplete: () => {
                this.isAnimating = false;
                console.log('[Disassembly] 분해 완료:', partNodeName);
                config.onComplete?.();
            }
        });

        this.isAnimating = true;

        // 단계 1: 원래 위치로 부드럽게 이동
        this.timeline.to(partNode.position, {
            x: originalPosition.x,
            y: originalPosition.y,
            z: originalPosition.z,
            duration: config.duration / 1000,
            ease: config.easing,
            onStart: () => {
                console.log('[Disassembly] 원래 위치로 이동 시작');
            },
            onUpdate: () => {
                // 진행률 콜백
                const progress = this.timeline?.progress() || 0;
                config.onProgress?.(progress);
            },
            onComplete: () => {
                console.log('[Disassembly] 원래 위치로 이동 완료');
            }
        });

        return new Promise((resolve) => {
            this.timeline?.eventCallback('onComplete', () => {
                resolve();
            });
        });
    }

    /**
     * 애니메이션 일시정지
     */
    public pause(): void {
        if (this.timeline && this.isAnimating) {
            this.timeline.pause();
            console.log('[Assembly] 애니메이션 일시정지');
        }
    }

    /**
     * 애니메이션 재개
     */
    public resume(): void {
        if (this.timeline) {
            this.timeline.resume();
            console.log('[Assembly] 애니메이션 재개');
        }
    }

    /**
     * 애니메이션 되돌리기
     * 
     * @returns Promise (되돌리기 완료 시 resolve)
     */
    public async reverse(): Promise<void> {
        if (this.timeline) {
            console.log('[Assembly] 애니메이션 되돌리기 시작');
            return new Promise((resolve) => {
                this.timeline?.reverse();
                this.timeline?.eventCallback('onReverseComplete', () => {
                    console.log('[Assembly] 애니메이션 되돌리기 완료');
                    resolve();
                });
            });
        }
    }

    /**
     * 현재 진행률 가져오기 (0~1)
     * 
     * @returns 진행률
     */
    public getProgress(): number {
        return this.timeline?.progress() || 0;
    }

    /**
     * 애니메이션 중인지 확인
     * 
     * @returns 애니메이션 중이면 true
     */
    public isPlaying(): boolean {
        return this.isAnimating;
    }

    /**
     * 타임라인 정리 (메모리 해제)
     */
    public dispose(): void {
        if (this.timeline) {
            this.timeline.kill();
            this.timeline = null;
        }
        this.originalPositions.clear();
        this.isAnimating = false;
        console.log('[Assembly] 서비스 정리 완료');
    }

    /**
     * 저장된 원래 위치 가져오기
     * 
     * @param nodeName 노드 이름
     * @returns 원래 위치 (없으면 null)
     */
    public getOriginalPosition(nodeName: string): THREE.Vector3 | null {
        return this.originalPositions.get(nodeName) || null;
    }
}
