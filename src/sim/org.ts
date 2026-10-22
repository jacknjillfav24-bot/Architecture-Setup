import type { DepartmentId } from "./types";

export interface DepartmentInfo {
  name: string;
  head: string;
  workerTitle: string;
  workers: string[];
}

export const DIRECTOR_NAME = "Morgan";

/** Who works where. Each department has one head and three workers. */
export const DEPARTMENT_INFO: Record<DepartmentId, DepartmentInfo> = {
  research: {
    name: "Research",
    head: "Ava",
    workerTitle: "Researcher",
    workers: ["Noah", "Mia", "Kai"],
  },
  design: {
    name: "Design",
    head: "Leo",
    workerTitle: "Designer",
    workers: ["Zoe", "Eli", "Ivy"],
  },
  engineering: {
    name: "Engineering",
    head: "Priya",
    workerTitle: "Engineer",
    workers: ["Omar", "Lena", "Theo"],
  },
  quality: {
    name: "Quality",
    head: "Sam",
    workerTitle: "Tester",
    workers: ["Ruby", "Finn", "Maya"],
  },
};
