/**
 * 노드 이름 로더
 * JSON 파일에서 노드 이름을 로드하여 관리
 */
export class NodeNameLoader {
    private static instance: NodeNameLoader;
    private nodeNames: any = null;
    private isLoaded: boolean = false;

    private constructor() { }

    public static getInstance(): NodeNameLoader {
        if (!NodeNameLoader.instance) {
            NodeNameLoader.instance = new NodeNameLoader();
        }
        return NodeNameLoader.instance;
    }

    /**
     * 노드 이름 메타데이터 로드
     * @param path 메타데이터 파일 경로
     */
    public async loadNodeNames(path: string = '/metadata/node-names.json'): Promise<void> {
        try {
            const response = await fetch(path);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            this.nodeNames = await response.json();
            this.isLoaded = true;
        } catch (error) {
            console.error('노드 이름 로드 실패:', error);
            throw error;
        }
    }

    /**
     * 노드 이름 가져오기 (점 표기법 지원)
     * @param path 노드 경로 (예: 'fridge.leftDoorDamper.damperCoverBody')
     * @returns 노드 이름
     */
    public getNodeName(path: string): string | null {
        if (!this.isLoaded || !this.nodeNames) {
            console.warn('노드 이름이 로드되지 않았습니다.');
            return null;
        }

        const keys = path.split('.');
        let current: any = this.nodeNames;

        for (const key of keys) {
            if (current[key] === undefined) {
                console.warn(`노드 경로를 찾을 수 없습니다: ${path}`);
                return null;
            }
            current = current[key];
        }

        return current as string;
    }

    /**
     * 로드 여부 확인
     */
    public isLoadedData(): boolean {
        return this.isLoaded;
    }

    /**
     * 전체 메타데이터 가져오기
     */
    public getAllMetadata(): any {
        return this.nodeNames;
    }
}

export const getNodeNameLoader = () => NodeNameLoader.getInstance();
