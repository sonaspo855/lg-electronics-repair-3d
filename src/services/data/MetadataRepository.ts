import { AssemblyOffsetMetadata } from './MetadataTypes';

/**
 * 메타데이터 레포지토리 클래스
 * JSON 파일을 로딩하고 원본 데이터를 캐싱
 */
export class MetadataRepository {
    private static instance: MetadataRepository | null = null;
    private metadata: AssemblyOffsetMetadata | null = null;
    private filePath: string = '/metadata/assembly-offsets.json';

    private constructor() { }

    public static getInstance(): MetadataRepository {
        if (!MetadataRepository.instance) {
            MetadataRepository.instance = new MetadataRepository();
        }
        return MetadataRepository.instance;
    }

    /**
     * 메타데이터 파일을 로딩
     */
    public async loadMetadata(): Promise<AssemblyOffsetMetadata> {
        if (this.metadata) {
            return this.metadata;
        }

        try {
            const cacheBuster = `?t=${Date.now()}`;
            const response = await fetch(this.filePath + cacheBuster);
            if (!response.ok) {
                throw new Error(`Failed to load metadata: ${response.statusText}`);
            }

            this.metadata = await response.json() as AssemblyOffsetMetadata;
            return this.metadata;
        } catch (error) {
            console.error('메타데이터 로딩 실패:', error);
            throw error;
        }
    }

    public getRawMetadata(): AssemblyOffsetMetadata | null {
        return this.metadata;
    }

    public clearCache(): void {
        this.metadata = null;
    }
}

export function getMetadataRepository(): MetadataRepository {
    return MetadataRepository.getInstance();
}
