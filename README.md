# iQOO Productivity AI

A phone-first AI productivity assistant that turns real-world information and conversations into actionable work.

Built for the **iQOO Hackathon 2026**.

## Core Idea

**Capture useful information. Understand its context. Turn it into actionable work.**

People often make commitments during everyday conversations or receive useful information through voice, camera, text, and documents. Remembering and manually converting that information into organized tasks can be difficult.

iQOO Productivity AI captures relevant information, uses AI to understand its context, creates a structured task, stores it, and lets the user review and decide whether to proceed, edit, or ignore it.

---

## What Makes It Different

The system does not simply convert a sentence into a generic task.

For example:

> "I'll send Rahul the project report tomorrow."

The system identifies:

- **WHO** → Me
- **WHAT** → Send project report
- **FOR WHOM** → Rahul
- **WHEN** → Tomorrow

This context is converted into a structured commitment that the user can review and act on.

---

## Core Features

### Ambient AI

The user explicitly starts an Ambient AI listening session.

During the active session:

1. Speech is captured from the microphone.
2. An on-device AI filter checks whether the information appears actionable.
3. Irrelevant information is filtered locally.
4. Actionable information is sent to Gemini for deeper understanding.
5. A structured task or commitment is created.
6. The result is stored in SQLite.
7. The user can review and decide what to do next.

### On-Device Relevance Filtering

The first filtering stage runs locally using:

**Xenova/all-MiniLM-L6-v2**

with:

**ONNX Runtime Web / WASM**

For example:

> "The weather is really nice today."

is classified as irrelevant and does not require Gemini processing.

Whereas:

> "I'll send Rahul the report tomorrow."

is identified as actionable and forwarded for AI understanding.

This reduces unnecessary cloud processing and keeps the initial relevance decision on the device.

### Commitment Intelligence

The AI extracts the context behind an actionable commitment, including:

- Owner
- Action
- Person involved
- Deadline
- Execution type
- Draft action

The system then presents the structured result to the user.

**The AI does not silently execute every action.**

The flow is:

**Capture → Understand → Create → Store → Review → Confirm → Execute / Handoff**

---

## Multimodal Input

Actionable information does not always come from conversations.

The application supports:

- Voice
- Camera
- Text
- PDF / Documents

For example, a user can point the camera at an invoice and say:

> "Create a task to pay this invoice before the due date."

The application combines the visual information and voice instruction to create a structured task.

---

## Office Kit

iQOO Productivity AI can continue the workflow across devices through **Office Kit**.

**Phone → Office Kit → Laptop**

Once a task is created, the user can hand it off to a connected laptop and continue the workflow there.

---

## Technology

### Frontend

- React
- TypeScript
- Vite
- Tailwind CSS
- React Router

### AI

- Gemini
- `gemini-flash-lite-latest`
- Xenova/all-MiniLM-L6-v2
- ONNX Runtime Web / WASM

### Backend

- Node.js
- Express
- TypeScript

### Storage

- SQLite

### Device Connectivity

- iQOO Office Kit

---

## Architecture

```text

Voice / Camera / Text / Documents
                ↓
        Local AI Filter
     MiniLM + ONNX Runtime
                ↓
          Actionable?
          ↙         ↘
        NO           YES
        ↓             ↓
      Ignore       Gemini
                     ↓
            Commitment Intelligence
                     ↓
             Structured Task
                     ↓
                   SQLite
                     ↓
               User Review
                     ↓
          Confirm / Edit / Ignore
                     ↓
          Execute / Laptop Handoff
