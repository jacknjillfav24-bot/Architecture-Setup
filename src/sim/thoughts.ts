import type { ThoughtRequest } from "../brain/brain";
import { DEPARTMENT_INFO } from "./org";
import { pick, type Rng } from "./random";
import type { Agent, DepartmentId } from "./types";

// Built-in answers. They are what agents say with the rules brain, and the
// fallback whenever the AI is off, busy or gives an unusable reply.

const PROJECT_NAMES = [
  "Recipe Planner",
  "Bike Share Map",
  "Plant Care Reminder",
  "Study Buddy",
  "Tiny Budget Tracker",
  "Neighborhood Swap Board",
  "Museum Audio Guide",
  "Pet Adoption Finder",
  "Habit Streak Tracker",
  "Library Seat Finder",
  "Rainy Day Ideas",
  "Bus Arrival Alerts",
  "Family Chore Chart",
  "Lost and Found Board",
  "Language Swap Club",
  "Farmers Market Guide",
  "Sleep Diary",
  "Volunteer Matcher",
  "Trail Conditions Live",
  "Book Club Organizer",
];

const TASKS: Record<DepartmentId, string[]> = {
  research: [
    "Interview five possible users",
    "Study similar apps",
    "List the must-have features",
    "Survey people about the idea",
    "Summarise what users need",
  ],
  design: [
    "Sketch the main screens",
    "Build a clickable prototype",
    "Choose colours and fonts",
    "Map the user journey",
    "Design the home screen",
  ],
  engineering: [
    "Build the core features",
    "Set up the database",
    "Connect screens to the data",
    "Write automated tests",
    "Make it work offline",
  ],
  quality: [
    "Test on phones and laptops",
    "Check it is accessible",
    "Hunt for bugs",
    "Check it loads quickly",
    "Try every button twice",
  ],
};

const FIX_TASKS = [
  "Fix the bugs Quality found",
  "Fix the failing checks",
  "Polish the rough edges",
];

const START_LINES = [
  "On it!",
  "Starting now.",
  "This one looks fun.",
  "Let's get this done.",
  "Getting started.",
  "Leave it with me.",
];

function persona(agent: Agent): string {
  return (
    `You are ${agent.name}, the ${agent.title} at Agent World, a small company ` +
    "run by AI agents that builds simple apps. You speak briefly and plainly. " +
    "Never use quotes, lists, hashtags or emojis."
  );
}

export function projectThought(
  agent: Agent,
  rng: Rng,
  used: ReadonlySet<string>,
): ThoughtRequest {
  const fresh = PROJECT_NAMES.filter((name) => !used.has(name));
  const fallback =
    fresh.length > 0
      ? pick(rng, fresh)
      : `${pick(rng, PROJECT_NAMES)} ${used.size + 1}`;
  const recent = [...used].slice(-6);
  const avoid =
    recent.length > 0 ? ` Do not reuse these names: ${recent.join(", ")}.` : "";
  return {
    persona: persona(agent),
    prompt: `Invent a name for a new, simple app your company will build.${avoid} Reply with only the name, 2 to 4 words.`,
    fallback,
    maxChars: 34,
    maxTokens: 16,
  };
}

export function taskThought(
  agent: Agent,
  projectName: string,
  department: DepartmentId,
  slot: number,
  count: number,
  fix: boolean,
): ThoughtRequest {
  const list = fix ? FIX_TASKS : TASKS[department];
  const fallback = list[slot % list.length] ?? "Do the next step";
  const team = DEPARTMENT_INFO[department].name;
  const prompt = fix
    ? `Testers found bugs in the app ${projectName}. Name one task for your ${team} team to fix them. Reply with only the task, under 7 words.`
    : `Your company is building the app ${projectName}. Name task ${(slot % count) + 1} of ${count} for your ${team} team. Reply with only the task, under 7 words.`;
  return {
    persona: persona(agent),
    prompt,
    fallback,
    maxChars: 44,
    maxTokens: 20,
  };
}

export function startThought(
  agent: Agent,
  rng: Rng,
  taskTitle: string,
  projectName: string,
): ThoughtRequest {
  return {
    persona: persona(agent),
    prompt: `You are starting the task ${taskTitle} for the app ${projectName}. Say one short, upbeat sentence to your team, under 10 words.`,
    fallback: pick(rng, START_LINES),
    maxChars: 56,
    maxTokens: 24,
    optional: true,
  };
}

export function reportThought(
  agent: Agent,
  rng: Rng,
  projectName: string,
  department: DepartmentId,
  fix: boolean,
): ThoughtRequest {
  const team = DEPARTMENT_INFO[department].name;
  const fallback = fix
    ? pick(rng, [
        `We found bugs in ${projectName}. It needs fixing.`,
        `${projectName} isn't ready yet: Engineering must fix some bugs.`,
      ])
    : pick(rng, [
        `${team} work on ${projectName} is done.`,
        `Our part of ${projectName} is finished.`,
        `${projectName} is ready for the next team.`,
      ]);
  const prompt = fix
    ? `You tested the app ${projectName} and found bugs that Engineering must fix. Tell the Director in one short sentence, under 14 words.`
    : `Your ${team} team just finished its work on the app ${projectName}. Tell the Director in one short sentence, under 14 words.`;
  return {
    persona: persona(agent),
    prompt,
    fallback,
    maxChars: 76,
    maxTokens: 32,
  };
}
