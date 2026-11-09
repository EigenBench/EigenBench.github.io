# EigenBench platform

The public platform at https://eigenbench.github.io/.

- `/` (also `/?view=home`): the default home screen; start or resume the quiz.
- `/?view=quiz`: the saved-response model-match quiz, with live rankings.
- `/evaluate/`: configure and run an evaluation, including login and run history.
- `/run/` and `/transcript/`: inspect evaluation results and transcripts.

Public value leaderboards, comparison pages, methodology, and LAISR information live at https://valuearena.github.io/. Old public-result links on this platform forward there.

## Development

Install dependencies with `bun install --frozen-lockfile`, run `bun run dev`, and build with `bun run build --webpack`. `bun run test` checks the scoring and data utilities. The quiz uses the checked-in `public/model-match.json` file and needs no model API calls. Rebuild its balanced saved-response sample with `node scripts/build-model-match.mjs`.

The quiz comes from saved EigenBench responses already published by ValueArena. The frontend was adapted from ValueArena/ValueArena.github.io (source revision 88c1bbb), including its typography, pixel artwork, themes, and evaluation workspace.

## Deployment

Pushes to `main` deploy through GitHub Actions to GitHub Pages. Configure Pages to use **GitHub Actions**.

The real evaluation workspace uses the existing evaluation API and Supabase project. Set repository Actions variables `NEXT_PUBLIC_EVALUATION_API_URL`, `NEXT_PUBLIC_SUPABASE_URL`, and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. These are public browser configuration, not service-role secrets. The API must allow origin `https://eigenbench.github.io`, and Supabase Auth must allow redirect URL `https://eigenbench.github.io/evaluate/`.

No backend secrets or model-provider keys are stored in this repository. The quiz works independently of the evaluation API.
