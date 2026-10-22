import { between, type Rng } from "./random";
import type { DepartmentId, RoomId, Vec } from "./types";

export const WORLD_WIDTH = 1000;
export const WORLD_HEIGHT = 660;

/** The hallway that connects every room. Agents walk along `y`. */
export const CORRIDOR = { top: 190, bottom: 250, y: 220 };

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Room {
  id: RoomId;
  name: string;
  subtitle: string;
  color: string;
  rect: Rect;
  /** Middle of the doorway, on the wall facing the corridor. */
  door: Vec;
}

function topRoom(
  id: RoomId,
  name: string,
  subtitle: string,
  color: string,
  x: number,
  w: number,
): Room {
  const rect = { x, y: 20, w, h: CORRIDOR.top - 20 };
  return {
    id,
    name,
    subtitle,
    color,
    rect,
    door: { x: x + w / 2, y: CORRIDOR.top },
  };
}

function bottomRoom(
  id: RoomId,
  name: string,
  subtitle: string,
  color: string,
  x: number,
  w: number,
): Room {
  const rect = {
    x,
    y: CORRIDOR.bottom,
    w,
    h: WORLD_HEIGHT - 20 - CORRIDOR.bottom,
  };
  return {
    id,
    name,
    subtitle,
    color,
    rect,
    door: { x: x + w / 2, y: CORRIDOR.bottom },
  };
}

export const ROOMS: Record<RoomId, Room> = {
  lounge: topRoom("lounge", "Lounge", "Coffee and breaks", "#a0845c", 20, 300),
  hq: topRoom(
    "hq",
    "Headquarters",
    "The Director runs the company",
    "#7a5fb5",
    340,
    320,
  ),
  archive: topRoom(
    "archive",
    "Archive",
    "Finished projects",
    "#6f7b87",
    680,
    300,
  ),
  research: bottomRoom(
    "research",
    "Research",
    "Finds out what people need",
    "#2f80c4",
    20,
    225,
  ),
  design: bottomRoom(
    "design",
    "Design",
    "Shapes how it looks and works",
    "#c9508f",
    265,
    225,
  ),
  engineering: bottomRoom(
    "engineering",
    "Engineering",
    "Builds it",
    "#d9822b",
    510,
    225,
  ),
  quality: bottomRoom(
    "quality",
    "Quality",
    "Tests it before release",
    "#2c9a69",
    755,
    225,
  ),
};

export const ROOM_LIST: Room[] = Object.values(ROOMS);

function center(room: Room): number {
  return room.rect.x + room.rect.w / 2;
}

export const DIRECTOR_SEAT: Vec = { x: center(ROOMS.hq), y: 112 };

export function headSeat(department: DepartmentId): Vec {
  const room = ROOMS[department];
  return { x: center(room), y: room.rect.y + 92 };
}

/** Up to three worker desks per department. */
export function workerSeats(department: DepartmentId): Vec[] {
  const room = ROOMS[department];
  const x = center(room);
  const y = room.rect.y;
  return [
    { x: x - 55, y: y + 212 },
    { x: x + 55, y: y + 212 },
    { x, y: y + 322 },
  ];
}

/** Where a department head stands when reporting to the Director. */
export function reportSpot(department: DepartmentId): Vec {
  const order: DepartmentId[] = [
    "research",
    "design",
    "engineering",
    "quality",
  ];
  const index = order.indexOf(department);
  return { x: DIRECTOR_SEAT.x - 75 + index * 50, y: DIRECTOR_SEAT.y + 46 };
}

function contains(rect: Rect, p: Vec): boolean {
  return (
    p.x >= rect.x &&
    p.x <= rect.x + rect.w &&
    p.y >= rect.y &&
    p.y <= rect.y + rect.h
  );
}

/** The room a point is in, or null when it is in the corridor. */
export function roomAt(p: Vec): Room | null {
  return ROOM_LIST.find((room) => contains(room.rect, p)) ?? null;
}

function insideDoor(room: Room): Vec {
  const inward = room.door.y === CORRIDOR.top ? -16 : 16;
  return { x: room.door.x, y: room.door.y + inward };
}

function outsideDoor(room: Room): Vec {
  return { x: room.door.x, y: CORRIDOR.y };
}

/** Waypoints from one point to another, going through doors and the corridor. */
export function route(from: Vec, to: Vec): Vec[] {
  const start = roomAt(from);
  const end = roomAt(to);
  if (start && start === end) return [{ ...to }];
  const points: Vec[] = [];
  if (start) points.push(insideDoor(start), outsideDoor(start));
  if (end) points.push(outsideDoor(end), insideDoor(end));
  points.push({ ...to });
  return points;
}

export function randomPointIn(room: Room, rng: Rng, inset = 34): Vec {
  const { x, y, w, h } = room.rect;
  return {
    x: between(rng, x + inset, x + w - inset),
    y: between(rng, y + inset + 14, y + h - inset),
  };
}

export function distance(a: Vec, b: Vec): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
