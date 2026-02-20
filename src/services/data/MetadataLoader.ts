import { getMetadataService } from './MetadataService';
import {
    AssemblyOffsetMetadata,
    AssemblyConfig,
    ScrewAnimationConfig,
    LinearMovementAnimationConfig
} from './MetadataTypes';
import * as THREE from 'three';

/**
 * 메타데이터 로더 (하위 호환성 어댑터)
 */
export class MetadataLoader {
    private static instance: MetadataLoader | null = null;
    private service = getMetadataService();
    // private filePath: string = '/metadata/assembly-offsets.json';

    private constructor() { }

    public static getInstance(): MetadataLoader {
        if (!MetadataLoader.instance) {
            MetadataLoader.instance = new MetadataLoader();
        }
        return MetadataLoader.instance;
    }

    public async loadMetadata(): Promise<AssemblyOffsetMetadata> {
        await this.service.initialize();
        // MetadataService 내부의 repository에서 데이터를 가져옴
        return (this.service as any).repository.getRawMetadata() as AssemblyOffsetMetadata;
    }

    public getAssemblyConfig(assemblyName: string): AssemblyConfig | null {
        return this.service.getAssemblyConfig(assemblyName);
    }

    public async loadAssemblyConfig(assemblyName: string): Promise<AssemblyConfig | null> {
        return await this.service.loadAssemblyConfig(assemblyName);
    }

    public getInsertionOffset(assemblyName: string): THREE.Vector3 | null {
        return this.service.getInsertionOffset(assemblyName);
    }

    public getScrewAnimationConfig(nodeName: string): ScrewAnimationConfig | null {
        return this.service.getScrewAnimationConfig(nodeName);
    }

    public getDamperCaseBodyAnimationConfig(nodeName: string): LinearMovementAnimationConfig | null {
        return this.service.getDamperCaseBodyAnimationConfig(nodeName);
    }

    public getScrewLinearMoveConfig(metadataKey: string): LinearMovementAnimationConfig | null {
        return this.service.getScrewLinearMoveConfig(metadataKey);
    }

    public getCameraSettings(key: string) {
        return this.service.getCameraSettings(key);
    }

    public clearCache(): void {
        this.service.clearCache();
    }

    public isLoaded(): boolean {
        // 실제 로딩 여부 확인 로직
        return true;
    }
}

export function getMetadataLoader(): MetadataLoader {
    return MetadataLoader.getInstance();
}

// 타입 재내보내기 (하위 호환성)
export type { AssemblyOffsetMetadata, AssemblyConfig, ScrewAnimationConfig, LinearMovementAnimationConfig };
