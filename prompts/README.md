# Prompts

LLM prompt templates used by NirvaAI. Each prompt lives in its own file with a header block describing inputs, outputs, and provider.

## Template format

```markdown
---
id: price_compare_v1
provider: openai | claude
inputs: [item_name, marketplace_listings, historical_pos]
outputs: structured_json
---

<system prompt>

<user prompt template with {{placeholders}}>
```

## Phase 2 prompts to author

- `price_compare_v1` — compare a marketplace listing against historical POs and other marketplaces
- `ocr_invoice_extract_v1` — extract line items from a scanned invoice image
- `pr_classify_v1` — classify a purchase request into category and risk band
- `anomaly_explain_v1` — given an anomaly flag, draft a human-readable explanation

## Phase 3 prompts

- `tor_draft_v1` — draft a government TOR from a structured brief
- `supplier_risk_summary_v1` — synthesize supplier risk signals into a one-paragraph summary
- `contract_review_v1` — flag unusual clauses in a supplier contract (Claude, long context)
