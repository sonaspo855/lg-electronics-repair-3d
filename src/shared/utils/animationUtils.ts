import gsap from 'gsap';
import * as THREE from 'three';
import { degreesToRadians } from './commonUtils';

// ============================================================================
// GSAP 기반 애니메이션 유틸리티
// ============================================================================

/**
 * 애니메이션 옵션 인터페이스
 */
export interface AnimationOptions {
    duration?: number;      // milliseconds
    easing?: string;        // GSAP easing 이름 (기본값: 'power2.out')
    onProgress?: (progress: number) => void;
    onUpdate?: () => void;
    onComplete?: () => void;
}

/**
 * 카메라 타겟 옵션 인터페이스
 */
export interface CameraTargetOptions {
    zoomRatio?: number;
    direction?: THREE.Vector3;
    distance?: number;
    fov?: number;
}

// ============================================================================
// 시네마틱 시퀀스 빌더 (GSAP Timeline 활용)
// ============================================================================

/**
 * 시네마틱 카메라 시퀀스 빌더
 * 용도: 복잡한 시네마틱 카메라 애니메이션 시퀀스 생성 (GSAP Timeline 기반)
   장점: 카메라 이동, 줌, 하이라이트 등을 타임라인으로 관리 가능
   재사용 시나리오: 제품 소개 영상, 조립/분해 과정의 시네마틱 카메라 워크
 * - GSAP Timeline 기반
 */
export class CinematicSequence {
    private timeline: gsap.core.Timeline;
    private camera: THREE.PerspectiveCamera | null = null;
    private controls: any = null;
    private targetCenter: THREE.Vector3 = new THREE.Vector3();
    private startTarget: THREE.Vector3 = new THREE.Vector3();

    constructor() {
        this.timeline = gsap.timeline({
            paused: true,
            onComplete: () => {
                console.log('🎬 시네마틱 시퀀스 완료');
            }
        });
    }

    /**
     * 카메라 및 컨트롤 설정
     */
    setCamera(camera: THREE.PerspectiveCamera, controls?: any): this {
        this.camera = camera;
        this.controls = controls;
        if (controls && controls.target) {
            this.startTarget.copy(controls.target);
        }
        return this;
    }

    /**
     * 타겟 중심점 설정
     */
    setTarget(target: THREE.Vector3): this {
        this.targetCenter.copy(target);
        return this;
    }

    /**
     * 카메라 이동 추가
     */
    addCameraMove(params: {
        position: THREE.Vector3;
        target?: THREE.Vector3;
        duration?: number;
        easing?: string;
        onUpdate?: (progress: number) => void;
    }): this {
        if (!this.camera) {
            console.warn('CinematicSequence: 카메라가 설정되지 않았습니다');
            return this;
        }

        const duration = (params.duration || 1500) / 1000;
        const easing = params.easing || 'power3.inOut';
        const target = params.target || this.targetCenter;
        const startTarget = this.controls ? this.controls.target.clone() : target.clone();

        this.timeline.to(this.camera.position, {
            x: params.position.x,
            y: params.position.y,
            z: params.position.z,
            duration,
            ease: easing,
            onUpdate: () => {
                const progress = this.timeline.progress();
                if (this.controls) {
                    this.controls.target.lerpVectors(startTarget, target, progress);
                    this.controls.update();
                } else {
                    this.camera!.lookAt(target);
                }
                params.onUpdate?.(progress);
            }
        }, '<');

        return this;
    }

    /**
     * 베지에 곡선 경로로 카메라 이동
     */
    addBezierPath(params: {
        start: THREE.Vector3;
        control: THREE.Vector3;
        end: THREE.Vector3;
        upTransition?: {
            startUp: THREE.Vector3;
            endUp: THREE.Vector3;
            nodeY: THREE.Vector3;
            targetCenter: THREE.Vector3;
        };
        duration?: number;
        easing?: string;
        onUpdate?: (progress: number) => void;
    }): this {
        if (!this.camera) {
            console.warn('CinematicSequence: 카메라가 설정되지 않았습니다');
            return this;
        }

        const duration = (params.duration || 2500) / 1000;
        const curve = new THREE.QuadraticBezierCurve3(params.start, params.control, params.end);
        const startTarget = this.controls ? this.controls.target.clone() : this.targetCenter.clone();

        this.timeline.to({}, {
            duration,
            ease: params.easing || 'power1.inOut',
            onUpdate: () => {
                // @ts-ignore - GSAP callback context
                const progress = this.timeline.progress();
                const point = curve.getPoint(progress);
                this.camera!.position.copy(point);

                // UP 벡터 보간 처리 (로우 앵글 효과 등)
                if (params.upTransition) {
                    const { nodeY, targetCenter, startUp, endUp } = params.upTransition;
                    const lookDir = new THREE.Vector3().subVectors(targetCenter, this.camera!.position).normalize();
                    let calculatedUp = new THREE.Vector3().crossVectors(nodeY, lookDir).normalize();
                    if (calculatedUp.y < 0) calculatedUp.negate();

                    const easeTransition = 1 - Math.pow(1 - progress, 3); // Cubic ease-out
                    const finalUp = startUp.clone().lerp(calculatedUp, easeTransition);
                    this.camera!.up.copy(finalUp);
                }

                if (this.controls) {
                    this.controls.target.lerpVectors(startTarget, this.targetCenter, progress);
                    this.controls.update();
                } else {
                    this.camera!.lookAt(this.targetCenter);
                }

                params.onUpdate?.(progress);
            }
        });

        return this;
    }

    /**
     * 줌 인/아웃 효과 추가
     */
    addZoom(params: {
        zoomRatio: number;
        duration?: number;
        easing?: string;
    }): this {
        if (!this.camera) return this;

        const currentPos = this.camera.position.clone();
        const direction = currentPos.clone().sub(this.targetCenter).normalize();
        const currentDistance = currentPos.distanceTo(this.targetCenter);
        const targetDistance = currentDistance / params.zoomRatio;
        const targetPos = this.targetCenter.clone().add(direction.multiplyScalar(targetDistance));

        return this.addCameraMove({
            position: targetPos,
            duration: params.duration,
            easing: params.easing
        });
    }

    /**
     * 하이라이트 효과 추가 (Emissive 중심)
     */
    addHighlight(params: {
        node: THREE.Object3D;
        color?: number;
        duration?: number;
        intensity?: number;
    }): this {
        const duration = (params.duration || 500) / 1000;
        const color = new THREE.Color(params.color || 0xffff00);
        const intensity = params.intensity || 0.8;

        params.node.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                const materials = Array.isArray(child.material) ? child.material : [child.material];

                materials.forEach(mat => {
                    if ('emissive' in mat) {
                        const m = mat as any;
                        this.timeline.to(m.emissive, {
                            r: color.r,
                            g: color.g,
                            b: color.b,
                            duration,
                            ease: 'power1.out'
                        }, '<');
                        this.timeline.to(m, {
                            emissiveIntensity: intensity,
                            duration,
                            ease: 'power1.out'
                        }, '<');
                    }
                });
            }
        });

        return this;
    }

    /**
     * 지연 시간 추가
     */
    addDelay(duration: number): this {
        this.timeline.to({}, { duration: duration / 1000 });
        return this;
    }

    /**
     * 타임라인에 콜백 추가
     */
    addCallback(callback: () => void, position: number | string = '+=0'): this {
        this.timeline.call(callback, undefined, position);
        return this;
    }

    /**
     * 시퀀스 재생 (Promise 반환)
     */
    play(): Promise<void> {
        return new Promise((resolve) => {
            this.timeline.eventCallback('onComplete', () => {
                resolve();
            });
            this.timeline.play();
        });
    }

    /**
     * 시퀀스 정지
     */
    stop(): this {
        this.timeline.pause();
        return this;
    }

    /**
     * 시퀀스 리셋
     */
    reset(): this {
        this.timeline.restart().pause();
        return this;
    }

    /**
     * 진행률 반환 (0~1)
     */
    get progress(): number {
        return this.timeline.progress();
    }
}

// ============================================================================
// 카메라 타겟 위치 계산 유틸리티
// ============================================================================

/**
 * 바운딩 박스를 기반으로 카메라 타겟 위치 계산
 */
export const calculateCameraTargetPosition = (
    camera: THREE.PerspectiveCamera,
    targetBox: THREE.Box3,
    options: CameraTargetOptions = {}
): { position: THREE.Vector3 } => {
    const center = new THREE.Vector3();
    targetBox.getCenter(center);

    const size = new THREE.Vector3();
    targetBox.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);

    const fov = (options.fov || camera.fov) * (Math.PI / 180);

    // options.distance가 있으면 우선 사용, 없으면 zoomRatio 기반 계산
    let cameraDistance = options.distance !== undefined
        ? options.distance
        : (maxDim / 2) / Math.tan(fov / 2) * (options.zoomRatio || 1.5);

    // 방향 결정
    let direction = options.direction ? options.direction.clone().normalize() : new THREE.Vector3(0.5, 0.5, 1).normalize();

    const targetPosition = center.clone().add(direction.multiplyScalar(cameraDistance));

    return {
        position: targetPosition,
    };
};


// ============================================================================
/**
 * 애니메이션 결과 인터페이스
 */
export interface AnimationResult {
    timeline: gsap.core.Timeline;
    targetObj: THREE.Object3D;
}

/**
 * 용도: 회전+이동 동시 애니메이션 생성 (GSAP Timeline 기반)
 * 장점: 복잡한 부품 분해/조립 애니메이션을 간편하게 구현
 * 재사용 시나리오: 스크류 분리, 커버 회전 등의 복합 동작 애니메이션
 * 
 * GSAP Timeline을 사용하여 회전+이동 동시 애니메이션을 생성합니다.
 * @param targetObj 대상 THREE.js 객체
 * @param config 애니메이션 설정
 * @param callbacks 콜백 함수들
 * @returns AnimationResult (Timeline과 targetObj 포함)
 */
export function createAnimationTimeline(
    targetObj: THREE.Object3D,
    config: {
        rotationAxis: string;
        rotationAngle: number;
        extractDirection: THREE.Vector3;
        translationDistance: number;
        duration: number;
        easing: string;
    },
    callbacks?: {
        onStart?: () => void;
        onComplete?: () => void;
        onProgress?: (progress: number) => void;
    }
): AnimationResult {
    const axis = config.rotationAxis as 'x' | 'y' | 'z';
    const timeline = gsap.timeline({
        paused: true,
        onStart: callbacks?.onStart,
        onComplete: callbacks?.onComplete,
        onUpdate: () => {
            callbacks?.onProgress?.(timeline.progress() || 0);
        }
    });

    // 회전 애니메이션
    timeline.to(targetObj.rotation, {
        [axis]: -degreesToRadians(config.rotationAngle),
        duration: config.duration / 1000,
        ease: config.easing
    }, 0);


    // 이동 애니메이션 (로컬 좌표계)
    const localExtractDir = config.extractDirection.clone().normalize().multiplyScalar(config.translationDistance);

    timeline.to(targetObj.position, {
        x: targetObj.position.x + localExtractDir.x,
        y: targetObj.position.y + localExtractDir.y,
        z: targetObj.position.z + localExtractDir.z,
        duration: config.duration / 1000,
        ease: config.easing
    }, 0);

    return { timeline, targetObj };
}

// ============================================================================
// GSAP 플러그인 등록 (필요시)
// ============================================================================

// GSAP 플러그인들이 이미 등록되어 있다면 추가 설정 불필요
// motionPathPlugin 등은 별도 import 후 gsap.registerPlugin() 필요
