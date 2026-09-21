# Accessibility — Public site

Use axe, Lighthouse, or keyboard-only. Target WCAG 2.2 AA unless you set a lower bar for the demo.

- **A11Y-PUB-01** Home, Search, Book detail, Cart, Sign in, Sign up: no critical axe violations on a11y-standard run.
- **A11Y-PUB-02** Skip or first focus is not trapped; heading order is logical (one h1 per page).
- **A11Y-PUB-03** Images (covers, avatars) have alt (or empty alt if decorative).
- **A11Y-PUB-04** Sign in/up: labels associated with inputs; captcha widget is keyboard reachable in interactive mode when Altcha is on.
- **A11Y-PUB-05** Search submit and filters operable by keyboard; results announced or focus moves.
- **A11Y-PUB-06** Contrast of text/buttons on default Tailwind theme meets AA.
- **A11Y-PUB-07** Auth errors and checkout errors are in text (not color-only).
- **A11Y-PUB-08** Modals/dialogs (if any) have focus trap and Escape.
- **A11Y-PUB-09** Reduced-motion: no essential info only in animation.
