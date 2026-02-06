import * as THREE from 'three';
import { getNodeNameLoader } from './NodeNameLoader';

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
}

/**
 * 메타데이터 로더 클래스
 * 조립 오프셋 메타데이터를 로딩하고 캐싱하는 기능을 제공합니다.
 */
export class MetadataLoader {
    private static instance: MetadataLoader | null = null;
    private cache: Map<string, AssemblyConfig> = new Map();
    private metadata: AssemblyOffsetMetadata | null = null;

    private constructor() { }

    /**
     * 싱글톤 인스턴스를 반환합니다.
     */
    public static getInstance(): MetadataLoader {
        if (!MetadataLoader.instance) {
            MetadataLoader.instance = new MetadataLoader();
        }
        return MetadataLoader.instance;
    }

    /**
     * 메타데이터 파일을 로딩합니다.
     * @param filePath 메타데이터 파일 경로 (기본값: '/metadata/assembly-offsets.json')
     */
    public async loadMetadata(filePath: string = '/metadata/assembly-offsets.json'): Promise<AssemblyOffsetMetadata> {
        // 캐시를 무시하고 항상 새로 고침 (개발 중 편의성 및 최신 데이터 보장)
        if (this.metadata) {
            return this.metadata;
        }

        try {
            // 브라우저 캐시 방지를 위해 타임스탬프 추가
            const cacheBuster = `?t=${Date.now()}`;
            const response = await fetch(filePath + cacheBuster);
            if (!response.ok) {
                throw new Error(`Failed to load metadata: ${response.statusText}`);
            }

            const loadedMetadata = await response.json() as AssemblyOffsetMetadata;
            this.metadata = loadedMetadata;

            // 기존 캐시 초기화 (새로운 메타데이터 로딩 시)
            this.cache.clear();

            return loadedMetadata;
        } catch (error) {
            console.error('메타데이터 로딩 실패:', error);
            throw error;
        }
    }

    /**
     * 특정 어셈블리 설정을 반환합니다.
     * @param assemblyName 어셈블리 이름
     * @returns 어셈블리 설정 또는 null
     */
    public getAssemblyConfig(assemblyName: string): AssemblyConfig | null {
        // 캐시 확인
        if (this.cache.has(assemblyName)) {
            return this.cache.get(assemblyName)!;
        }

        // 메타데이터에서 찾기
        if (this.metadata?.assemblies[assemblyName]) {
            const config = this.metadata.assemblies[assemblyName];
            this.cache.set(assemblyName, config);
            return config;
        }

        return null;
    }

    /**
     * 노드 참조를 실제 노드 이름으로 해결합니다.
     * @param nodeValue 노드 값 (예: "ref:fridge.leftDoorDamper.damperAssembly" 또는 직접 노드 이름)
     * @returns 해결된 노드 이름
     */
    private resolveNodeReference(nodeValue: string): string {
        if (nodeValue.startsWith('ref:')) {
            const path = nodeValue.substring(4); // "ref:" 접두사 제거
            const loader = getNodeNameLoader();
            const resolvedName = loader.getNodeName(path);
            if (resolvedName) {
                console.log(`참조 해결: ${nodeValue} → ${resolvedName}`);
                return resolvedName;
            }
            console.warn(`참조를 찾을 수 없습니다: ${nodeValue}`);
            return nodeValue; // 원본 반환
        }
        return nodeValue; // 일반 노드 이름은 그대로 반환
    }

    /**
     * 특정 어셈블리 설정을 로딩하고 변환합니다.
     * @param assemblyName 어셈블리 이름
     * @param metadataPath 메타데이터 파일 경로
     * @returns 어셈블리 설정 또는 null
     */
    public async loadAssemblyConfig(
        assemblyName: string,
        metadataPath: string = '/metadata/assembly-offsets.json'
    ): Promise<AssemblyConfig | null> {
        try {
            await this.loadMetadata(metadataPath);

            if (!this.metadata) {
                console.warn('메타데이터가 로딩되지 않았습니다.');
                return null;
            }

            const config = this.metadata.assemblies[assemblyName];

            if (config) {
                // 노드 참조 해결
                config.targetNode = this.resolveNodeReference(config.targetNode);
                config.partNode = this.resolveNodeReference(config.partNode);

                // Vector3, Euler 변환
                config.grooveDetection.normalFilter = new THREE.Vector3(
                    config.grooveDetection.normalFilter.x,
                    config.grooveDetection.normalFilter.y,
                    config.grooveDetection.normalFilter.z
                );

                config.insertion.offset = new THREE.Vector3(
                    config.insertion.offset.x,
                    config.insertion.offset.y,
                    config.insertion.offset.z
                );

                config.insertion.rotationOffset = new THREE.Euler(
                    config.insertion.rotationOffset.x,
                    config.insertion.rotationOffset.y,
                    config.insertion.rotationOffset.z
                );

                // 캐시에 저장
                this.cache.set(assemblyName, config);
                console.log('어셈블리 설정 로딩 완료:', assemblyName);
                return config;
            }

            console.warn('어셈블리 설정을 찾을 수 없습니다:', assemblyName);
            return null;
        } catch (error) {
            console.error(`어셈블리 설정 로딩 실패: ${assemblyName}`, error);
            return null;
        }
    }

    /**
     * 특정 어셈블리의 삽입 오프셋을 반환합니다.
     * @param assemblyName 어셈블리 이름
     * @returns 삽입 오프셋 벡터 또는 null
     */
    public getInsertionOffset(assemblyName: string): THREE.Vector3 | null {
        const config = this.getAssemblyConfig(assemblyName);
        return config?.insertion.offset || null;
    }

    /**
     * 특정 어셈블리의 애니메이션Duration을 반환합니다.
     * @param assemblyName 어셈블리 이름
     * @returns 애니메이션 Duration (ms) 또는 기본값
     */
    public getAnimationDuration(assemblyName: string): number {
        const config = this.getAssemblyConfig(assemblyName);
        return config?.animation.duration || 1500;
    }

    /**
     * 특정 어셈블리의 이징 함수를 반환합니다.
     * @param assemblyName 어셈블리 이름
     * @returns 이징 함수 이름 또는 기본값
     */
    public getAnimationEasing(assemblyName: string): string {
        const config = this.getAssemblyConfig(assemblyName);
        return config?.animation.easing || 'power2.inOut';
    }

    /**
     * 캐시를 정리합니다.
     */
    public clearCache(): void {
        this.cache.clear();
        this.metadata = null;
    }

    /**
     * 스크류 애니메이션 설정들을 반환합니다.
     * @returns 스크류 애니메이션 설정 객체 또는 null
     */
    public getScrewAnimations(): Record<string, ScrewAnimationConfig> | null {
        if (!this.metadata) {
            console.warn('메타데이터가 로딩되지 않았습니다.');
            return null;
        }
        return this.metadata.screwAnimations || null;
    }

    /**
     * 특정 스크류 애니메이션 설정을 반환합니다.
     * @param nodeName 스크류 노드 이름
     * @returns 스크류 애니메이션 설정 또는 null
     */
    public getScrewAnimationConfig(nodeName: string): ScrewAnimationConfig | null {
        console.log('getScrewAnimationConfig!!!>> ', nodeName);
        console.log('this.metadata>> ', this.metadata);
        if (!this.metadata?.screwAnimations) {
            return null;
        }

        // 직접 일치하는 이름 검색
        if (this.metadata.screwAnimations[nodeName]) {
            return this.metadata.screwAnimations[nodeName];
        }


        // 노드 이름의 일부로 검색 (예: screw1Customized -> screw_1)
        // const shortName = nodeName.replace('Customized', '').toLowerCase();
        const shortName = nodeName;
        console.log('shortName>> ', shortName);
        for (const [key, config] of Object.entries(this.metadata.screwAnimations)) {
            const keyLower = key.toLowerCase();
            console.log('keyLower>> ', keyLower);
            if (keyLower === shortName ||
                shortName.includes(keyLower) ||
                keyLower.includes(shortName)) {
                return config;
            }
        }

        return null;
    }

    /**
     * 댐퍼 케이스 바디 선형 이동 애니메이션 설정을 반환합니다.
     * @param nodeName 댐퍼 케이스 바디 노드 이름
     * @returns 선형 이동 애니메이션 설정 또는 null
     */
    public getDamperCaseBodyAnimationConfig(nodeName: string): LinearMovementAnimationConfig | null {
        console.log('getDamperCaseBodyAnimationConfig!!!>> ', nodeName);
        console.log('this.metadata>> ', this.metadata);
        if (!this.metadata?.damperCaseBodyAnimations) {
            return null;
        }

        // 직접 일치하는 이름 검색
        if (this.metadata.damperCaseBodyAnimations.linearMovement) {
            return this.metadata.damperCaseBodyAnimations.linearMovement;
        }

        return null;
    }

    /**
     * 메타데이터가 로딩되었는지 확인합니다.
     */
    public isLoaded(): boolean {
        return this.metadata !== null;
    }
}

/**
 * 싱글톤 인스턴스 가져오기
 */
export function getMetadataLoader(): MetadataLoader {
    return MetadataLoader.getInstance();
}
