---
name: bem-naming
description: CSS class naming conventions following Block-Element-Modifier (BEM) methodology.
---

# BEM (Block-Element-Modifier) Naming Guidelines

This skill enforces BEM conventions for naming CSS classes in frontend components.

## Core Structure
`block-name__element-name--modifier-name`

1. **Block** (`.block-name`)
   A standalone entity that is meaningful on its own.
   * e.g., `.strategy-card`, `.ops-table`, `.switch`

2. **Element** (`.block-name__element-name`)
   A part of a block that has no standalone meaning and is semantically tied to its block.
   * e.g., `.strategy-card__header`, `.ops-table__row`, `.switch__slider`

3. **Modifier** (`.block-name--modifier-name` or `.block-name__element-name--modifier-name`)
   A flag on a block or element. Use it to change appearance, state or behavior.
   * e.g., `.strategy-card--disabled`, `.ops-table__row--active`, `.switch__slider--checked`

## Rules
* **No Nested Element Names:** Never use names like `.block__elem1__elem2`. All elements are direct children of the block in naming space.
  * **Good:** `.strategy-card__input-suffix`
  * **Bad:** `.strategy-card__form__input__suffix`
* **Avoid Raw Selectors:** Keep styling scoped using BEM classes. Do not write raw `div`, `span`, or `input` selectors inside global or component stylesheets without a class.
