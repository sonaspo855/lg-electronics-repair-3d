import { useState } from "react";
import ProjectsHeader from "./ProjectsHeader";
import ProjectsTable from "./ProjectsTable";
import type { Project } from "./types";

type ProjectsFrameProps = {
  onOpenEditor: (modelPath?: string) => void;
};

const projects: Project[] = [
  {
    id: "dryer",
    name: "Dryer22kg",
    glb: "dryer.gbl",
    guide: "guide01.html",
    bom: "bom.csv",
    date: "2026.01.01",
    modelPath: undefined,
    details: {
      titleA: "",
      itemsA: [
        "제품명 건조기",
        "모델명 3244lg22kg",
        "생성일 2026.01.01",
        "최종수정일 2026.01.01",
        "담당자 000 매니저",
      ],
      titleB: "",
      itemsB: [
        "용량: 39MB",
        "등록일자: 2026.01.01",
        "메쉬: 000개",
        "폴리곤: 000개",
      ],
    },
  },
  {
    id: "washer",
    name: "washing machine",
    glb: "WM_FX_FH25EAE.AKOR.glb",
    guide: "guide01.html",
    bom: "bom.csv",
    date: "2026.01.01",
    modelPath: "/models/WM_FX_FH25EAE.AKOR.glb",
    details: {
      titleA: "",
      itemsA: [
        "제품명 세탁기",
        "모델명 2200lg",
        "생성일 2026.01.01",
        "최종수정일 2026.01.01",
        "담당자 000 매니저",
      ],
      titleB: "",
      itemsB: [
        "용량: 41MB",
        "등록일자: 2026.01.01",
        "메쉬: 000개",
        "폴리곤: 000개",
      ],
    },
  },
  {
    id: "fridge",
    name: "refrigerator",
    glb: "refrigerator.gbl",
    guide: "guide01.xml",
    bom: "bom.csv",
    date: "2026.01.01",
    modelPath: "/models/M-Next3.glb",
    details: {
      titleA: "",
      itemsA: [
        "제품명 냉장고",
        "모델명 1000lg",
        "생성일 2026.01.01",
        "최종수정일 2026.01.01",
        "담당자 000 매니저",
      ],
      titleB: "",
      itemsB: [
        "용량: 45MB",
        "등록일자: 2026.01.01",
        "메쉬: 000개",
        "폴리곤: 000개",
      ],
    },
  },
];

export default function ProjectsFrame({ onOpenEditor }: ProjectsFrameProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleRowToggle = (id: string) => {
    setExpandedId((current) => (current === id ? null : id));
  };

  return (
    <section className="page">
      <ProjectsHeader />
      <ProjectsTable
        projects={projects}
        expandedId={expandedId}
        onToggle={handleRowToggle}
        onOpenEditor={onOpenEditor}
      />
    </section>
  );
}
