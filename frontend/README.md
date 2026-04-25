# SecurePass Frontend Mock UI

Accessible, component-driven mock website using a `shadcn/ui`-style component structure, navy-first palette, and blur-background deep-link modals.

## Design goals implemented

- **Accessibility-first**: skip link, focus-visible states, semantic headings, high-contrast text, consistent navigation.
- **Nielsen + CRAP**: consistent component patterns, clear hierarchy, predictable routes, strong contrast and alignment.
- **Modern but practical**: navy + beige palette, no gradients, clean cards, compact spacing.
- **Undo-friendly popups**: each popup is a deep-link modal using URL query state (`?modal=...`) so users can close and return context.
- **No backend required for dashboard**: overview and summary data are stored in browser `localStorage`.

## Pages and what each one does

- `/` (`OverviewPage`)  
  Main student dashboard: welcome state, progress stats, module list, and today to-do list.

- `/text-tutor` (`TextTutorPage`)  
  Text tutor concept: native-language input, simplified-English output, citation-first responses, map-aware house lookup concept.

- `/exam-practice` (`ExamPracticePage`)  
  Exam format practice flow with English-only final mock, 80% threshold, and mistake-log review.

- `/roleplay` (`RoleplayPage`)  
  Passive/active scenario training with AI-generated visual scenes and multi-part MCQ sequencing.

- `/adaptive-delivery` (`AdaptiveDeliveryPage`)  
  Summary dashboard with mistake log, weak module priorities, and targeted review actions.

## Deep-link modals

Modals are rendered through one shared component and opened by route query string:

- `?modal=design-rules`
- `?modal=mistake-log`
- `?modal=roleplay-summary`

Examples:

- `/text-tutor?modal=design-rules`
- `/exam-practice?modal=mistake-log`
- `/roleplay?modal=roleplay-summary`

## File map (what to edit)

### Core routing and shell

- `src/App.tsx`  
  Main navbar, route registration, and global deep-link modal mount.

- `src/main.tsx`  
  Browser router setup.

### Page content

- `src/pages/OverviewPage.tsx`
- `src/pages/TextTutorPage.tsx`
- `src/pages/ExamPracticePage.tsx`
- `src/pages/RoleplayPage.tsx`
- `src/pages/AdaptiveDeliveryPage.tsx`

Edit these files to change page-specific copy and card layouts.

### Reusable components

- `src/components/FeatureGrid.tsx`  
  Reusable feature card section used across pages.

- `src/components/DeepLinkModal.tsx`  
  Shared modal logic with URL query support and blur overlay.

### UI primitives (`shadcn/ui` style)

- `src/components/ui/button.tsx`
- `src/components/ui/card.tsx`
- `src/components/ui/badge.tsx`
- `src/components/ui/dialog.tsx`
- `src/lib/utils.ts` (`cn` utility)

Edit these to globally change component behavior or variants.

### Content source

- `src/lib/siteContent.ts`  
  Centralized nav labels, feature highlight cards, and modal data.

Use this as the main file to swap wording quickly without touching layout code.

### Styling

- `src/styles/app.css`  
  Color tokens (navy/beige), spacing, typography, navbar, cards, modal blur, and focus states.

## Run locally

```powershell
cd frontend
npm install
npm run dev
```

## Notes for the next step (prompt generation)

When you ask for the chatbot prompt, we can reference `src/lib/siteContent.ts` and convert each page section into prompt-ready blocks (system style, UX constraints, page goals, and interaction rules).

## Browser storage

- Storage key: `securepass:dashboard`
- File: `src/lib/dashboardStorage.ts`
- On first visit, default dashboard data is written to `localStorage`.
- If no learner name exists, the dashboard asks for a name and saves it locally.
