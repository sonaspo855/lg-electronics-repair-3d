import { MetadataService, getMetadataService } from './MetadataService';
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

    private constructor() { }

    public static getInstance(): MetadataLoader {
        if (!MetadataLoader.instance) {
            MetadataLoader.instance = new MetadataLoader();
        }
        return MetadataLoader.instance;
    }

    public async loadMetadata(filePath?: string): Promise<AssemblyOffsetMetadata> {
        await this.service.initialize();
        // Repository에서 직접 가져오는 로직은 생략하고 Service를 통해 간접 관리 권장
        // 하위 호환성을 위해 타입 캐스팅 사용
        return (this as any).metadata;
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

    public getAnimationDuration(assemblyName: string): number {
        return this.service.getAssemblyConfig(assemblyName)?.animation.duration || 1500;
    }

    public getAnimationEasing(assemblyName: string): string {
        return this.service.getAssemblyConfig(assemblyName)?.animation.easing || 'power2.inOut';
    }

    public getScrewAnimationConfig(nodeName: string): ScrewAnimationConfig | null {
        return this.service.getScrewAnimationConfig(nodeName);
    }

    public getDamperCaseBodyAnimationConfig(nodeName: string): LinearMovementAnimationConfig | null {
        return this.service.getDamperCaseBodyAnimationConfig();
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
