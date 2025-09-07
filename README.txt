Reference prototype for a Bitcoin-native coordination flow for energy trades in AI compute centres. Runs a single local overlay for Order → Commit → Contract (record) → Proof with on-chain DAG linkage and SPV checks.

Prerequisites
• Node 20 or newer
• Git
• MongoDB and MySQL accessible
• Metanet Desktop installed, unlocked, and funded with a small balance
• WhatsOnChain access for SPV lookups

Setup

Get the project code on your machine.

Install dependencies with your package manager.

Ensure your databases are reachable and Metanet Desktop is running.

Run

From the project root, run: npx lars

When prompted, choose: Run locally

Open the frontend URL printed by LARS in your browser

Demo flow

Open the app and sign in with Metanet Desktop

In Orders, create an OrderTX

In a second browser profile, sign in with a different key and post a matching CommitTX

Post a ContractTX record

Post a ProofTX and let the UI fetch SPV and show status

Open History to see the Order → Commit → Contract → Proof DAG

What works
• Known-key login via Metanet Desktop for all routes
• Create and list OrderTX and CommitTX on the overlay
• Post ContractTX as a recorded step
• Post ProofTX with placeholder payload and SPV verification
• History view with DAG lineage and parent linkage checks

Not in this prototype
• Certificate issuance and validation
• sCrypt escrow spend path in active use
• Fallbacks: timeout refund and admin override
• End-to-end encryption of proof payloads
• Multi-overlay discovery, islanding, and rule-driven reflexes
