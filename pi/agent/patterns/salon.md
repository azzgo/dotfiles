---
name: salon
description: Feed materials on one topic, discuss via grill sessions and prototypes, and converge on a written Spec — no code changes. For pre-implementation requirement alignment.
nodes:
  - id: intake
    title: Intake materials & build the evidence base
    type: human
    suggest: [intake, grill-with-docs]
  - id: discuss
    title: Discuss the options
    type: human
    suggest: [grill-with-docs, prototype]
  - id: converge
    title: Write up the Spec
    type: auto
    suggest: [decision-log]
---
## intake
The user dumps whatever raw materials exist on the topic — notes, links, constraints,
half-formed opinions, prior context. Dispatch the intake skill to interrogate the
material and harvest as much structure as possible: what is being decided, known
options, open questions, and gaps. Iterate inside this node until the topic is fully
harvested and the evidence base is complete. The topic boundary itself is defined
before this run starts; intake only consolidates what the user brings.

done-when: the harvested intake record covers the topic's options, constraints, and remaining gaps, and the user confirms nothing important is missing.
## discuss
Debate the harvested options. Mechanics are the user's choice per round: a grill
session against the domain model to stress-test assumptions and terminology, and/or a
throwaway prototype to settle an empirical question. Multiple rounds are fine; loop
inside this node. New information discovered here feeds back into the evidence base.

done-when: the field has narrowed to one preferred direction, with objections either resolved or consciously accepted.
## converge
Turn the discussion outcome into the deliverable: a Spec capturing the
decision, rationale, rejected alternatives, and follow-up implications (design doc,
ADR, CONTEXT.md update, or handoff prompt for implementation). The user reviews and
accepts the write-up; nothing gets implemented inside this workflow.

done-when: the Spec is written, records the decision and rationale, and the user accepts it.
