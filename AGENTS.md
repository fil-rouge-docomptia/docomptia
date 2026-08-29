# AGENTS.md

## Project Overview

This project consists of:

* Backend: Java 25 + Spring Boot
* Frontend: React + TypeScript

The project is currently in the MVP phase. Prioritize delivering working solutions quickly while keeping the codebase clean and maintainable.

---

## Core Principles

### Keep It Simple

Prefer the simplest solution that satisfies the requirement.

Avoid:

* Overengineering
* Premature optimization
* Complex abstractions
* Unnecessary design patterns
* Generic frameworks built for hypothetical future needs

When multiple solutions exist, choose the most straightforward and maintainable one.

### Make Minimal, Focused Changes

Only modify what is necessary to satisfy the request.

Avoid:

* Large refactors
* Reorganizing packages or folders
* Renaming files, classes, methods, or APIs without explicit instruction
* Touching unrelated code

### Preserve Existing Behavior

Unless explicitly requested:

* Do not change business logic
* Do not change API contracts
* Do not change database behavior
* Do not introduce breaking changes

---

## Before Making Changes

Always:

1. Read the relevant files.
2. Understand the existing implementation.
3. Follow existing patterns.
4. Keep the change scoped to the user request.
5. Look for similar implementations before creating new ones.

---

## Coding Guidelines

### General

* Prioritize readability over cleverness.
* Prefer explicit code over magic.
* Keep methods reasonably small and focused.
* Keep classes focused on a single responsibility.
* Avoid deep inheritance hierarchies.
* Avoid unnecessary abstraction layers.

### Spring Boot

Prefer existing Spring Boot conventions.

* Use constructor injection.
* Keep controllers thin.
* Put business logic in services.
* Use repositories only for persistence concerns.
* Reuse existing patterns already present in the project.
* Do not introduce new frameworks unless explicitly requested.

Avoid creating:

* Generic base services
* Generic base controllers
* Complex custom frameworks
* Additional architectural layers without a clear need

### React & TypeScript

* Prefer functional components.
* Follow existing component, styling, and file-organization patterns.
* Keep components small and focused.
* Prefer composition over complex component abstractions.
* Use TypeScript types explicitly; avoid `any` unless justified.
* Reuse existing API clients, shared types, and UI components.
* Keep state as local as practical.
* Do not introduce global state management unless clearly necessary.
* Avoid unnecessary custom hooks; extract a hook only when logic is reused or materially improves readability.
* Avoid storing derived values in state.
* Use effects only for synchronization with external systems.
* Handle loading, empty, and error states where relevant.
* Preserve existing component props and API contracts.
* Maintain basic accessibility: semantic HTML, labels, keyboard support, and meaningful button text.
* Add or update focused tests when the project already tests similar behavior.

### Dependencies

Do not introduce new dependencies unless:

* They provide significant value.
* The existing stack cannot reasonably solve the problem.

Always prefer existing project dependencies first.

---

## Documentation & Comments

* Keep comments concise and useful.
* Do not comment obvious code.
* Update documentation only when relevant to the requested change.

---

## MVP Development Mindset

The project is currently in an MVP stage.

Prioritize:

* Simplicity
* Delivery speed
* Maintainability
* Readability

Do not build infrastructure for future requirements that do not yet exist.

Implement only what is required today.

---

## Git Guidelines

* Do not create commits unless explicitly asked.
* Do not rewrite Git history.
* Do not modify unrelated files.
* Keep changes focused and atomic.
* When a Jira ticket explicitly requests commits, use `KAN-XX: Message`, where
  `KAN-XX` is the selected ticket key.
* Never push a branch without explicit user approval.
* Never include Netskope certificates, network workarounds, generated files, or
  unrelated Docker changes in a feature commit.

When work is completed, provide:

1. Summary of changes.
2. Files modified.
3. Important assumptions.
4. Any potential follow-up work.

---

## What Success Looks Like

A good change:

* Solves the requested problem.
* Is easy to understand.
* Matches existing project conventions.
* Minimizes risk.
* Avoids unnecessary complexity.
* Preserves existing behavior.
* Keeps the codebase maintainable.
