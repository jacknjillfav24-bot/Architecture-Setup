import type { ThoughtRequest } from "../brain/brain";

export interface Vec {
  x: number;
  y: number;
}

/** Departments in the order a project moves through them. */
export const DEPARTMENTS = [
  "research",
  "design",
  "engineering",
  "quality",
] as const;
export type DepartmentId = (typeof DEPARTMENTS)[number];

export type RoomId = "hq" | "lounge" | "archive" | DepartmentId;

export type Role = "director" | "head" | "worker";

export interface Bubble {
  text: string;
  until: number;
}

export interface PendingThought {
  request: ThoughtRequest;
  then: (text: string) => void;
}

export interface Agent {
  id: string;
  name: string;
  role: Role;
  title: string;
  department: DepartmentId | null;
  managerId: string | null;
  color: string;
  /** The agent's seat at their desk. */
  home: Vec;
  pos: Vec;
  /** Remaining waypoints; empty when standing still. */
  path: Vec[];
  speed: number;
  onArrive: (() => void) | null;
  /** True while the agent is part of a task flow; idle wandering is paused. */
  busy: boolean;
  /** What the agent is doing, in plain words, for the inspector. */
  status: string;
  taskId: string | null;
  thinking: boolean;
  thoughtQueue: PendingThought[];
  bubble: Bubble | null;
  /** Most recent things the agent thought or said, newest first. */
  memory: string[];
  nextIdleAt: number;
}

export interface Project {
  id: string;
  name: string;
  /** Index into DEPARTMENTS of the stage being worked on. */
  stage: number;
  status: "active" | "done";
  revisions: number;
  /** Tasks of the current stage that are not delivered yet. */
  openTasks: number;
  /** Every department the project has been sent to, in order. */
  history: DepartmentId[];
  startedAt: number;
  finishedAt: number | null;
}

export interface Task {
  id: string;
  projectId: string;
  department: DepartmentId;
  title: string;
  assigneeId: string | null;
  status: "queued" | "assigned" | "working" | "delivering" | "done";
  progress: number;
  duration: number;
  createdAt: number;
}

/** A message flying between two agents. */
export interface Envelope {
  id: string;
  color: string;
  pos: Vec;
  path: Vec[];
  onArrive: () => void;
}

export interface LogEntry {
  id: number;
  time: number;
  text: string;
  color: string;
}
