import { describe, expect, it } from "vitest";
import { DEPARTMENTS } from "../src/sim/types";
import {
  CORRIDOR,
  ROOMS,
  headSeat,
  roomAt,
  route,
  workerSeats,
} from "../src/sim/world";

describe("layout", () => {
  it("puts every desk inside its own department room", () => {
    for (const department of DEPARTMENTS) {
      expect(roomAt(headSeat(department))?.id).toBe(department);
      for (const seat of workerSeats(department))
        expect(roomAt(seat)?.id).toBe(department);
    }
  });

  it("treats the hallway as no room", () => {
    expect(roomAt({ x: 500, y: CORRIDOR.y })).toBeNull();
  });
});

describe("route", () => {
  it("walks straight when staying in the same room", () => {
    const seats = workerSeats("design");
    expect(route(seats[0]!, seats[1]!)).toEqual([seats[1]]);
  });

  it("goes out through one door, along the hallway and in through the other", () => {
    const path = route(headSeat("research"), headSeat("quality"));
    const corridorPoints = path.filter((p) => p.y === CORRIDOR.y);
    expect(corridorPoints.map((p) => p.x)).toEqual([
      ROOMS.research.door.x,
      ROOMS.quality.door.x,
    ]);
    expect(path.at(-1)).toEqual(headSeat("quality"));
  });
});
