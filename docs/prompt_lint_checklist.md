# Prompt Lint Checklist (v1)

Use this checklist before submitting any prompt to Cursor, Copilot, or OpenAI API.

The goal is to prevent authority drift, over-engineering, and architectural violations.

---

## A. Authority Check
- [ ] Does the prompt reference the correct authority files?
- [ ] Am I repeating rules inline that should live in authority instead?
- [ ] If a rule is repeated, is it because this task is high-risk?

---

## B. Scope Control
- [ ] Is the task limited to a single component or file?
- [ ] Does the prompt clearly say what NOT to generate?
- [ ] Is the output surface intentionally small?

---

## C. Layer Discipline
- [ ] Is the target layer explicit? (transport / adapter / service / domain)
- [ ] Are forbidden layers explicitly excluded?
- [ ] Is business logic clearly disallowed if not required?

---

## D. High-Risk Areas
If the task touches any of the following, ensure explicit constraints exist:
- [ ] Time / dates
- [ ] Logging
- [ ] Async context / AsyncLocalStorage
- [ ] Retries / timeouts
- [ ] External I/O

---

## E. Over-Engineering Guard
- [ ] Are retries explicitly forbidden if not required?
- [ ] Is caching explicitly forbidden if not required?
- [ ] Is orchestration explicitly forbidden if not required?

---

## F. Output Control
- [ ] Does the prompt specify “code only” or equivalent?
- [ ] Are tests excluded unless explicitly requested?
- [ ] Are explanations excluded unless explicitly requested?

---

## Final Gate
If any checkbox is “No”, revise the prompt before execution.
