/**
 * 노드 이름 관리자
 * 모든 3D 모델 노드 이름을 중앙 집중식으로 관리
 */
import { getNodeNameLoader } from './NodeNameLoader';

export class NodeNameManager {
    private static instance: NodeNameManager;
    private nodeNames: Map<string, string> = new Map();
    private useMetadata: boolean = true; // 기본적으로 메타데이터 모드 활성화

    private constructor() {
        this.initializeNodeNames();
    }

    public static getInstance(): NodeNameManager {
        if (!NodeNameManager.instance) {
            NodeNameManager.instance = new NodeNameManager();
        }
        return NodeNameManager.instance;
    }

    private initializeNodeNames(): void {
        // 메타데이터 모드가 활성화되면 node-names.json에서 노드 이름을 로드합니다.
        // 기본적으로는 빈 맵으로 시작합니다.
    }

    /**
     * 메타데이터 사용 모드 활성화
     */
    public async enableMetadataMode(): Promise<void> {
        const loader = getNodeNameLoader();
        if (!loader.isLoadedData()) {
            await loader.loadNodeNames();
        }
        this.useMetadata = true;
    }

    /**
     * 메타데이터 사용 모드 비활성화
     */
    public disableMetadataMode(): void {
        this.useMetadata = false;
    }

    /**
     * 노드 이름 가져오기
     * @param key 노드 키 (점 표기법 지원: 'fridge.leftDoorDamper.damperCoverBody')
     * @returns 노드 이름 (없으면 null)
     */
    public getNodeName(key: string): string | null {
        // 메타데이터 모드가 활성화된 경우
        if (this.useMetadata) {
            const loader = getNodeNameLoader();
            const metadataName = loader.getNodeName(key);
            if (metadataName) {
                return metadataName;
            }
        }

        // 기본 맵에서 검색
        return this.nodeNames.get(key) || null;
    }

    /**
     * 노드 이름 설정 (런타임 동적 추가)
     * @param key 노드 키
     * @param name 노드 이름
     */
    public setNodeName(key: string, name: string): void {
        this.nodeNames.set(key, name);
    }

    /**
     * 모든 노드 이름 가져오기
     * @returns 노드 이름 맵
     */
    public getAllNodeNames(): Map<string, string> {
        return new Map(this.nodeNames);
    }

    /**
     * 노드 이름 존재 여부 확인
     * @param key 노드 키
     * @returns 존재하면 true
     */
    public hasNodeName(key: string): boolean {
        return this.nodeNames.has(key);
    }

    /**
     * 노드 이름 삭제
     * @param key 노드 키
     */
    public removeNodeName(key: string): void {
        this.nodeNames.delete(key);
    }

    /**
     * 모든 노드 이름 초기화
     */
    public clear(): void {
        this.nodeNames.clear();
    }
}

// 싱글톤 인스턴스 내보내기
export const getNodeNameManager = () => NodeNameManager.getInstance();
