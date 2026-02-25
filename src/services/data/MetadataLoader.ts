import { getMetadataService } from './MetadataService';
import {
    AssemblyOffsetMetadata,
    AssemblyConfig,
    ScrewAnimationConfig,
    LinearMovementAnimationConfig,
    PanelDrawerAnimationConfig
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

    public getPanelDrawerAnimationConfig(key: string): PanelDrawerAnimationConfig | null {
        return this.service.getPanelDrawerAnimationConfig(key);
    }

    public clearCache(): void {
        this.service.clearCache();
    }

    public isLoaded(): boolean {
        // 실제 로딩 여부 확인 로직
        return true;
    }

    /**
     * 메타데이터 전역 초기화 함수
     * 애플리케이션 시작 시 메타데이터를 한 번만 로드
     * @param metadataPath 메타데이터 파일 경로 (기본값: '/metadata/assembly-offsets.json')
     */
    public async initialize(metadataPath?: string): Promise<void> {
        try {
            // 1. 노드 이름 데이터 로드
            const nodeNameLoader = (await import('./NodeNameLoader')).NodeNameLoader.getInstance();
            if (!nodeNameLoader.isLoadedData()) {
                await nodeNameLoader.loadNodeNames();
            }

            // 2. 어셈블리 메타데이터 경로 설정 및 로드
            if (metadataPath) {
                this.service.setMetadataPath(metadataPath);
            }

            await this.loadMetadata();
            console.log(`메타데이터 전역 초기화 완료 (${metadataPath || 'default'})`);
        } catch (error) {
            console.error('메타데이터 로드 실패:', error);
        }
    }
}

export function getMetadataLoader(): MetadataLoader {
    return MetadataLoader.getInstance();
}

// 타입 재내보내기 (하위 호환성)
export type { AssemblyOffsetMetadata, AssemblyConfig, ScrewAnimationConfig, LinearMovementAnimationConfig, PanelDrawerAnimationConfig };
