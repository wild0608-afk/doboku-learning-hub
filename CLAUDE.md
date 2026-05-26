# CLAUDE.md - Takken Learning Hub

## Role
You are the implementation agent for Takken Learning Hub.
Do not act as the project manager.
The user and THINK decide scope and architecture.

## Core Rules
- Edit only the files explicitly requested.
- Do not rewrite unrelated files.
- Do not refactor unless explicitly instructed.
- Do not install packages unless explicitly instructed.
- Preserve existing quiz behavior and mobile usability.

## Question Data Rules
- IDs must be unique.
- Categories must remain balanced.
- Each question must have question, choices, answer, explanation, and category.
- When adding questions, append only to the designated data file.
- After editing question data, run `verify-questions.ps1`.

## Workflow
1. Confirm target files.
2. Make the smallest necessary change.
3. Run validation.
4. Report changed files and validation result.
5. Stop.
