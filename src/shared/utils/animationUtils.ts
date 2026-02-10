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
    private targetCenter: THREE.Vector3 = new THREE.Vector3();

    constructor() {
        this.timeline = gsap.timeline({
            paused: true,
            onComplete: () => {
                console.log('🎬 시네마틱 시퀀스 완료');
            }
        });
    }

    /**
     * 카메라 설정 (lookAt 대상 포함)
     */
    setCamera(camera: THREE.PerspectiveCamera, target?: THREE.Vector3): this {
        this.camera = camera;
        if (target) {
            this.targetCenter.copy(target);
        }
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
    }): this {
        if (!this.camera) {
            console.warn('CinematicSequence: 카메라가 설정되지 않았습니다');
            return this;
        }

        const duration = (params.duration || 1500) / 1000;
        const easing = params.easing || 'power3.inOut';
        const target = params.target || this.targetCenter;

        this.timeline.to(this.camera.position, {
            x: params.position.x,
            y: params.position.y,
            z: params.position.z,
            duration,
            ease: easing,
            onUpdate: () => {
                this.camera!.lookAt(target);
            }
        }, '<'); // '<' = 이전 애니메이션과 동시 시작

        return this;
    }

    /**
     * 베지에 곡선 경로로 카메라 이동
     */
    addBezierPath(params: {
        start: THREE.Vector3;
        control: THREE.Vector3;
        end: THREE.Vector3;
        duration?: number;
        easing?: string;
    }): this {
        if (!this.camera) {
            console.warn('CinematicSequence: 카메라가 설정되지 않았습니다');
            return this;
        }

        const duration = (params.duration || 2500) / 1000;

        // 2차 베지에 곡선 생성
        const curve = new THREE.QuadraticBezierCurve3(
            params.start,
            params.control,
            params.end
        );

        this.timeline.to({}, {
            duration,
            ease: params.easing || 'power1.inOut',
            onUpdate: function () {
                // 현재 진행률 (0~1)
                const progress = this.progress();
                const point = curve.getPoint(progress);
                this.camera!.position.copy(point);
                this.camera!.lookAt(this.targetCenter);
            }
        });

        return this;
    }

    /**
     * 줌 인/아웃 효과 추가
     */
    addZoom(params: {
        zoomRatio: number;  // 줌 비율 (1 = 기본, 2 = 확대)
        duration?: number;
        easing?: string;
    }): this {
        if (!this.camera) {
            console.warn('CinematicSequence: 카메라가 설정되지 않았습니다');
            return this;
        }

        const currentPos = this.camera.position.clone();
        const direction = currentPos.clone().sub(this.targetCenter).normalize();
        const currentDistance = currentPos.distanceTo(this.targetCenter);
        const targetDistance = currentDistance / params.zoomRatio;
        const targetPos = this.targetCenter.clone().add(direction.multiplyScalar(targetDistance));

        const duration = (params.duration || 1000) / 1000;

        this.timeline.to(this.camera.position, {
            x: targetPos.x,
            y: targetPos.y,
            z: targetPos.z,
            duration,
            ease: params.easing || 'power2.inOut',
            onUpdate: () => {
                this.camera!.lookAt(this.targetCenter);
            }
        }, '<');

        return this;
    }

    /**
     * 하이라이트 효과 추가
     */
    addHighlight(params: {
        node: THREE.Object3D;
        color?: number;
        duration?: number;
    }): this {
        const duration = (params.duration || 500) / 1000;
        const color = params.color || 0xffff00;

        // Mesh 재질 애니메이션
        params.node.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                const originalMaterial = child.material;

                this.timeline.to((child.material as THREE.MeshStandardMaterial).color, {
                    r: ((color >> 16) & 255) / 255,
                    g: ((color >> 8) & 255) / 255,
                    b: (color & 255) / 255,
                    duration,
                    ease: 'power1.out'
                }, 0);

                // emissive 효과 추가
                if ('emissive' in child.material) {
                    this.timeline.to((child.material as THREE.MeshStandardMaterial).emissive, {
                        r: ((color >> 16) & 255) / 255,
                        g: ((color >> 8) & 255) / 255,
                        b: (color & 255) / 255,
                        duration,
                        ease: 'power1.out'
                    }, 0);
                }
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
 * 용도: 바운딩 박스 기반 카메라 타겟 위치 계산 (장축 인지 자동 뷰포트 정렬)
 * 장점: 대상 객체의 크기와 형상에 따라 최적의 카메라 위치를 자동 계산
 * 재사용 시나리오: 부품 선택시 카메라 포커싱, 자동 뷰포트 정렬
 */
export const calculateCameraTargetPosition = (
    camera: THREE.PerspectiveCamera,
    targetBox: THREE.Box3,
    options: CameraTargetOptions = {}
): THREE.Vector3 => {
    const center = new THREE.Vector3();
    targetBox.getCenter(center);

    const diagonal = targetBox.min.distanceTo(targetBox.max);
    const fov = camera.fov * (Math.PI / 180);

    let cameraDistance = Math.abs(diagonal / 2 / Math.tan(fov / 2));

    // 줌 비율 조절 (객체 크기에 따라 동적 조정)
    let zoomRatio = options.zoomRatio || 1.5;
    if (diagonal < 5) {
        zoomRatio = options.zoomRatio || 2.0;
    } else if (diagonal > 20) {
        zoomRatio = options.zoomRatio || 1.2;
    }
    cameraDistance *= zoomRatio;

    // 방향 결정 (장축 인지 기반 자동 뷰포트 정렬)
    const size = new THREE.Vector3();
    targetBox.getSize(size);

    let direction = options.direction;

    if (!direction) {
        const maxDimension = Math.max(size.x, size.y, size.z);

        if (maxDimension === size.x) {
            direction = new THREE.Vector3(1, 0.2, 0.5).normalize(); // X축 장축 → 우측 상단에서 보기
        } else if (maxDimension === size.z) {
            direction = new THREE.Vector3(0.5, 0.2, 1).normalize(); // Z축 장축 → 전면 상단에서 보기
        } else {
            direction = new THREE.Vector3(0.5, 1, 0.5).normalize(); // Y축 장축 → 위에서 보기
        }
    } else {
        direction = new THREE.Vector3(direction.x, direction.y || 0.2, direction.z).normalize(); // Y축 기본값 0.2로 설정 (약간 아래에서 보기)
    }

    const targetPosition = center.clone().add(direction.multiplyScalar(cameraDistance));
    // Y축 위치 조정: 대상의 중심보다 약간 높게 위치시켜 더 자연스러운 시점 제공
    targetPosition.y = center.y + (size.y * 0.1);

    return targetPosition;
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
