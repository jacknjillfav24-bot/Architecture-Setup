# Agent World

A 2D world where a small company of agents works together. You watch from above
as a Director starts projects, department heads plan the work, and workers walk
to their desks, do the tasks, and report back.

**See it live:** https://jacknjillfav24-bot.github.io/Architecture-Setup/
(works once GitHub Pages is turned on, see [Publishing](#publishing))

## What you'll see

The company has 17 agents in a clear hierarchy:

| Who                                  | Where        | Reports to |
| ------------------------------------ | ------------ | ---------- |
| **Morgan**, the Director             | Headquarters | Nobody     |
| **4 department heads** (gold ring)   | Their dept.  | Morgan     |
| **12 workers**, three per department | Their dept.  | Their head |

Every project moves through the departments in order:

1. **Research** finds out what people need.
2. **Design** shapes how it looks and works.
3. **Engineering** builds it.
4. **Quality** tests it. Sometimes they find bugs and send it back to
   Engineering once.

For each step, the Director sends a message (the flying envelope) to the
department head. The head splits the work into tasks (sticky notes on the
board), workers pick them up, do them and hand them in, and the head walks to
Headquarters to report. Finished projects get a box on the Archive shelf.

In between, agents take coffee breaks in the Lounge and stretch their legs.

**Things to try:** click any agent to follow them, tick _Show who reports to
whom_ to draw the hierarchy, and use 2× or 4× to speed things up.

## The AI brain (optional, free)

By default agents follow built-in rules, which costs nothing and works
everywhere. Press **Turn on AI brain** and they come up with their own project
names, tasks and messages using a real AI model.

- **Free:** the AI runs on your own computer using
  [WebLLM](https://webllm.mlc.ai/). There's no account, no API key and no bill.
- **Private:** what the agents say never leaves your computer.
- **One-time download:** the small model is about 300 MB and the smarter one
  about 700 MB. Your browser keeps it, so later visits start quickly.
- **Needs WebGPU:** a recent Chrome or Edge on a laptop or desktop. Most phones
  can't run it; the world still works there with the rules.
- **Never stalls:** if the AI is slow or fails, agents fall back to the rules
  for that decision.

## Costs and risks

- **Cost: $0.** Hosting on GitHub Pages is free for public repositories, and the
  AI runs on each visitor's own device.
- **No secrets:** there are no API keys or passwords anywhere in this project,
  so there's nothing that could leak and be misused.
- **No personal data:** no accounts, cookies or analytics.
- **This repository is public:** anyone can read the code. Never commit
  anything private to it.

## Publishing

The site is published by the `Deploy to GitHub Pages` workflow every time
`main` changes. It has to be switched on once:

1. On GitHub, open the repository's **Settings → Pages**.
2. Under **Build and deployment → Source**, choose **GitHub Actions**.
3. Open the **Actions** tab, pick **Deploy to GitHub Pages**, and press **Run
   workflow**.

Until then, the workflow skips publishing instead of failing.

## For developers

Requires Node.js 22 or newer (see `.nvmrc`).

```sh
npm install
npm run dev        # open the printed local address in a browser
```

| Command                | What it does                                   |
| ---------------------- | ---------------------------------------------- |
| `npm run dev`          | Run the site locally with live reload          |
| `npm run build`        | Build the site into `dist/`                    |
| `npm run preview`      | Serve the built site locally                   |
| `npm test`             | Run the tests once with Vitest                 |
| `npm run typecheck`    | Check types without building                   |
| `npm run lint`         | Lint with ESLint                               |
| `npm run format`       | Format all files with Prettier                 |
| `npm run format:check` | Check formatting (CI fails if this would fail) |

```
src/
├── main.ts            # Starts the world and wires up the page
├── sim/               # The company: no drawing, fully tested
│   ├── simulation.ts  # Who does what, step by step
│   ├── world.ts       # Rooms, desks and walking routes
│   ├── org.ts         # Departments and names
│   └── thoughts.ts    # What agents are asked, plus rule-based answers
├── brain/             # How agents decide
│   ├── brain.ts       # The Brain interface and the free rules brain
│   ├── aiBrain.ts     # Queues requests to an AI and falls back on failure
│   ├── webllm.ts      # Loads the in-browser AI model
│   └── llm.worker.ts  # Runs the AI in the background
└── ui/                # Canvas drawing, side panel and AI controls
tests/                 # Vitest tests for the simulation and brains
```

Any AI that can answer a chat prompt can be plugged in by implementing
`ChatEngine` in `src/brain/aiBrain.ts`.
