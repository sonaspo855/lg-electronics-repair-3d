import * as THREE from 'three';
import { getMetadataRepository } from './MetadataRepository';
import { getNodeNameLoader } from './NodeNameLoader';
import {
    AssemblyConfig,
    ScrewAnimationConfig,
    LinearMovementAnimationConfig
} from './MetadataTypes';

/**
 * 메타데이터 서비스 클래스
 * 데이터를 가공하고 비즈니스 로직을 처리
 */
export class MetadataService {
    private static instance: MetadataService | null = null;
    private repository = getMetadataRepository();
    private assemblyCache: Map<string, AssemblyConfig> = new Map();

    private constructor() { }

    public static getInstance(): MetadataService {
        if (!MetadataService.instance) {
            MetadataService.instance = new MetadataService();
        }
        return MetadataService.instance;
    }

    public async initialize(): Promise<void> {
        await this.repository.loadMetadata();
    }

    /**
     * 특정 어셈블리 설정을 반환
     */
    public getAssemblyConfig(assemblyName: string): AssemblyConfig | null {
        if (this.assemblyCache.has(assemblyName)) {
            return this.assemblyCache.get(assemblyName)!;
        }

        const metadata = this.repository.getRawMetadata();
        if (metadata?.assemblies[assemblyName]) {
            const config = metadata.assemblies[assemblyName];
            this.assemblyCache.set(assemblyName, config);
            return config;
        }

        return null;
    }

    /**
     * 노드 참조를 해결
     */
    private resolveNodeReference(nodeValue: string): string {
        if (nodeValue.startsWith('ref:')) {
            const path = nodeValue.substring(4);
            const loader = getNodeNameLoader();
            const resolvedName = loader.getNodeName(path);
            return resolvedName || nodeValue;
        }
        return nodeValue;
    }

    /**
     * 어셈블리 설정을 로드하고 Three.js 객체로 변환
     */
    public async loadAssemblyConfig(assemblyName: string): Promise<AssemblyConfig | null> {
        await this.initialize();
        const metadata = this.repository.getRawMetadata();
        const config = metadata?.assemblies[assemblyName];

        if (config) {
            config.targetNode = this.resolveNodeReference(config.targetNode);
            config.partNode = this.resolveNodeReference(config.partNode);

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

            this.assemblyCache.set(assemblyName, config);
            return config;
        }
        return null;
    }

    public getScrewAnimationConfig(nodeName: string): ScrewAnimationConfig | null {
        const metadata = this.repository.getRawMetadata();
        if (!metadata?.screwAnimations) return null;

        if (metadata.screwAnimations[nodeName]) {
            return metadata.screwAnimations[nodeName];
        }

        const shortName = nodeName.toLowerCase();
        for (const [key, config] of Object.entries(metadata.screwAnimations)) {
            const keyLower = key.toLowerCase();
            if (keyLower === shortName || shortName.includes(keyLower) || keyLower.includes(shortName)) {
                return config;
            }
        }
        return null;
    }

    public getDamperCaseBodyAnimationConfig(): LinearMovementAnimationConfig | null {
        const metadata = this.repository.getRawMetadata();
        return metadata?.damperCaseBodyAnimations?.linearMovement || null;
    }

    public getScrewLinearMoveConfig(metadataKey: string): LinearMovementAnimationConfig | null {
        const metadata = this.repository.getRawMetadata();
        if (metadata?.screwLinearMovements?.[metadataKey]) {
            return metadata.screwLinearMovements[metadataKey];
        }
        return metadata?.damperCaseBodyAnimations?.linearMovement || null;
    }

    public getCameraSettings(key: string) {
        const metadata = this.repository.getRawMetadata();
        if (!metadata) {
            console.warn('[MetadataService] 메타데이터가 로드되지 않은 상태에서 getCameraSettings 호출됨');
            return null;
        }
        const settings = metadata.cameraSettings?.[key];
        if (!settings) {
            console.warn(`[MetadataService] '${key}' 키에 해당하는 카메라 설정을 찾을 수 없음`);
            return null;
        }
        return settings;
    }

    public getInsertionOffset(assemblyName: string): THREE.Vector3 | null {
        return this.getAssemblyConfig(assemblyName)?.insertion.offset || null;
    }

    public clearCache(): void {
        this.assemblyCache.clear();
        this.repository.clearCache();
    }
}

export function getMetadataService(): MetadataService {
    return MetadataService.getInstance();
}
