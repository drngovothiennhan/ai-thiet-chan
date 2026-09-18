# Cloud Run migration branch

Branch: `infra/cloud-run-migration-20260917`

Base source: `main` at `07ec84ddaa677c6695a2f1112b44baf37bbf9668`.

## Scope

This branch changes deployment infrastructure only. It does not intentionally alter application UI, clinical/YHCT logic, AI prompts, rate limits, database behavior, or user flows.

## Runtime contract

- Node.js 24
- Express
- Container listens on `0.0.0.0:$PORT`
- Cloud Run port: 8080
- Health endpoint: `/api/health`

## Verification

Pushes to this branch run `Cloud Run Container Smoke`:

1. Build the Docker image.
2. Run the existing `npm run check` suite inside the image.
3. Start the container on port 8080.
4. Verify `/api/health` and the app root.

## Deployment

The `Cloud Run Deploy` workflow is manual-only. It deploys this exact branch from source using the Dockerfile and refuses to proceed until the GitHub environment `cloud-run-migration` has these variables:

- `GCP_PROJECT_ID`
- `GCP_WORKLOAD_IDENTITY_PROVIDER`
- `GCP_SERVICE_ACCOUNT`
- `GCP_GEMINI_SECRET` — Secret Manager secret ID containing the Gemini API key.

The workflow uses Workload Identity Federation; no long-lived Google service-account key is stored in the repository.

The deploy defaults to service `ai-thiet-chan-migration` in `asia-southeast1`, min instances 0 and max instances 2. These are workflow inputs and can be changed without modifying application code.

After deployment, the workflow verifies that `/api/health` returns the expected app identity and that `providerConfigured=true`.

## Cutover rule

Do not switch the production domain or remove the current Vercel deployment until Cloud Run passes container smoke, live health, real-device image flow, consultation flow, persistence, and rollback checks.
