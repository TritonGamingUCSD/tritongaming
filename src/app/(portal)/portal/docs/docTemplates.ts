// Starter pages offered by "New doc". Plain Markdown, so a template is just text the editor loads. Callouts use the > [!NOTE] / [!TIP] / [!WARNING] form.

export interface DocTemplate { id: string; name: string; blurb: string; icon: string; title: string; tags: string[]; content: string }

export const DOC_TEMPLATES: DocTemplate[] = [
  { id: 'blank', name: 'Blank page', blurb: 'Start from nothing.', icon: '📄', title: '', tags: [], content: '' },
  {
    id: 'howto', name: 'How-to guide', blurb: 'Goal, steps, tips, and who to ask.', icon: '🧭', title: 'How to …', tags: ['guide'],
    content: `## Goal

What this guide helps you get done, in one sentence.

## Before you start

- [ ] Something to have ready
- [ ] Access you need

## Steps

1. First step.
2. Second step.
3. Third step.

> [!TIP]
> A shortcut or common mistake worth knowing.

## Who to ask

Name the person or role to message if you get stuck.
`,
  },
  {
    id: 'runbook', name: 'Event runbook', blurb: 'Timeline, roles, supplies, checklist and recap.', icon: '🎮', title: 'Event runbook: ', tags: ['events'],
    content: `## Overview

**Date and time:**  
**Place:**  
**Lead:**  
**Expected turnout:**  

## Timeline

| Time | What happens | Who |
| --- | --- | --- |
| | Setup starts | |
| | Doors open | |
| | Main activity | |
| | Teardown | |

## Roles

- **Check-in:** 
- **Setup and teardown:** 
- **Social media:** 

## Supplies

- [ ] Consoles and controllers
- [ ] Extension cords and power strips
- [ ] Signs and QR codes

> [!WARNING]
> Book the room and any equipment well before the day.

## Day-of checklist

- [ ] Arrive early and test everything
- [ ] Open check-in
- [ ] Take photos

## Recap (fill in afterwards)

What went well, what to change next time, final turnout.
`,
  },
  {
    id: 'meeting', name: 'Meeting notes', blurb: 'Agenda, decisions and action items with owners.', icon: '📝', title: 'Meeting notes: ', tags: ['meetings'],
    content: `**Date:**  
**Present:**  

## Agenda

1. 
2. 
3. 

## Notes

## Decisions

- 

## Action items

- [ ] Task, **owner**, due date
- [ ] Task, **owner**, due date
`,
  },
  {
    id: 'handbook', name: 'Role handbook', blurb: 'What the role does, a first-week checklist, key links.', icon: '🎓', title: 'Role handbook: ', tags: ['onboarding'],
    content: `## What this role does

A short description of the job and who it works with.

## Your first week

- [ ] Join the team chat and introduce yourself
- [ ] Read the docs linked below
- [ ] Meet the lead you report to
- [ ] Shadow one meeting or event

## Every week

- 

## Key links

- [Name of a doc or tool](https://)

> [!NOTE]
> Ask questions early. Nobody expects you to know everything yet.
`,
  },
];

export const templateById = (id: string) => DOC_TEMPLATES.find((t) => t.id === id) ?? DOC_TEMPLATES[0];
