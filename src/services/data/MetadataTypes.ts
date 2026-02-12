import * as THREE from 'three';

/**
 * 조립 오프셋 메타데이터 인터페이스
 */
export interface AssemblyOffsetMetadata {
    version: string;
    lastUpdated: string;
    assemblies: {
        [key: string]: AssemblyConfig;
    };
    screwAnimations?: {
        [nodeName: string]: ScrewAnimationConfig;
    };
    damperCaseBodyAnimations?: {
        linearMovement: LinearMovementAnimationConfig;
    };
    screwLinearMovements?: {
        [nodeName: string]: LinearMovementAnimationConfig;
    };
    cameraSettings?: {
        [key: string]: {
            duration: number;
            easing: string;
            distance?: number;
            zoomRatio?: number;
        };
    };
}

/**
 * 스크류 애니메이션 설정 인터페이스
 */
export interface ScrewAnimationConfig {
    rotationAxis: 'x' | 'y' | 'z';
    rotationAngle: number;
    extractDirection: [number, number, number];
    extractDistance: number;
    duration: number;
    easing: string;
}

/**
 * 선형 이동 애니메이션 설정 인터페이스
 */
export interface LinearMovementAnimationConfig {
    method?: 'screwPositionBased' | 'fallback';
    targetScrewNode?: string;
    offset?: {
        x: number;
        y: number;
        z: number;
    };
    fallback?: {
        direction: {
            x: number;
            y: number;
            z: number;
        };
        distance: number;
    };
    direction?: {
        x: number;
        y: number;
        z: number;
    };
    distance?: number;
    duration: number;
    easing: string;
    stages: Array<{
        name: string;
        progress: number;
        description: string;
    }>;
}

/**
 * 어셈블리 설정 인터페이스
 */
export interface AssemblyConfig {
    targetNode: string;
    partNode: string;
    grooveDetection: {
        method: 'bounding_box' | 'normal_filter';
        innerBoundRatio?: number;
        normalFilter: THREE.Vector3;
        normalTolerance: number;
        plugSearchDirection?: THREE.Vector3;
        edgeAngleThreshold?: number;
        plugClusteringDistance?: number;
        holeClusteringDistance?: number;
        maxVerticesThreshold?: number;
    };
    insertion: {
        offset: THREE.Vector3;
        depth: number;
        rotationOffset: THREE.Euler;
    };
    animation: {
        duration: number;
        easing: string;
        stages: Array<{
            name: string;
            progress: number;
            description: string;
        }>;
    };
    disassembly?: {
        liftDistance: number;
        slideDistance: number;
        tiltAngle: number;
        liftDuration: number;
        slideDuration: number;
        fadeDuration: number;
    };
}
