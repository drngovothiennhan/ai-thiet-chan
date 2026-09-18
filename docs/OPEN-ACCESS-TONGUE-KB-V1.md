# Open-access Thiệt chẩn / tongue-diagnosis knowledge corpus v1

## Scope
Curated from PubMed/PMC and limited to sources with open-access/full-text retrieval permission verified through PubMed/PMC rights metadata.

Runtime corpus:
- 16 open-access academic sources;
- 27 short paraphrased evidence records;
- ontology-aware retrieval;
- no full article bodies, figures, tables or copyrighted PDFs vendored into the repository.

Knowledge version after integration:
`thiet-chan-kb-2026-09-18.5doc+oa16-v1`

## Legal handling
- CC BY / CC BY 3.0: metadata, attribution metadata and short paraphrased evidence are stored; ontology may be derived from the scientific concepts.
- CC BY-NC-ND: repository stores only bibliographic metadata plus short factual/paraphrased evidence. No full article text, adapted figure, translated table or rewritten article body is vendored.
- PubMed records without confirmed full-text retrieval permission were not added to this v1 runtime corpus.
- Condition-specific articles are tagged `condition-association-only`; they may inform discussion of evidence but cannot be used to infer a modern disease diagnosis from a tongue image.

## Core source groups
### Standardization / reliability
- OA01 · PMID 33562368 · TCM diagnosis standardization review.
- OA05 · PMID 32459647 · smartphone tongue-coating classification and inter/intra-rater reliability.
- OA06 · PMID 22924055 · agreement between automated tongue diagnosis and TCM practitioners.
- OA07 · PMID 28050555 · standardized acquisition and ICC color correction.
- OA16 · PMID 41267018 · broad computerized tongue-image analysis taxonomy/review.

### Image-analysis pipeline
- OA02 · PMID 30949431 · automated tongue diagnosis review.
- OA03 · PMID 37724302 · digital tongue-image analysis review.
- OA04 · PMID 37559828 · AI survey for tongue image analysis.
- OA08 · PMID 40356770 · automated system with acquisition, segmentation, color correction and separated feature labels.
- OA09 · PMID 39065853 · coating segmentation.
- OA10 · PMID 40025207 · tongue shape classification.
- OA11 · PMID 40568472 · tooth-mark recognition with active/weak learning.

### Ventral tongue / sublingual veins
- OA12 · PMID 36388160 · quantitative classification of sublingual varices.

### Condition-association evidence only
- OA13 · PMID 36825238 · gastric cancer cohort.
- OA14 · PMID 31083226 · type-2 diabetes association study.
- OA15 · PMID 41626136 · cancer scoping review.

## Ontology v1
Runtime ontology: `aitc-tongue-ontology-v1`.

Primary branches:
- acquisition/QC and color standardization;
- normal anatomy/papillae;
- tongue-body color, shape and motion;
- surface texture, fissure/median sulcus, tooth marks, spots;
- coating color, region, moisture, peeling and biologic basis;
- sublingual veins;
- segmentation / CV pipeline;
- annotation, dataset quality and active learning;
- observer reliability / human-machine agreement / model-evaluation reliability;
- multimodal reasoning (tứ chẩn / Thập vấn);
- evidence limitations;
- condition-association nodes kept separate from diagnostic reasoning.

## Runtime rules
1. Local Vision owns image observation.
2. LLM receives structured observations and retrieves evidence by ontology.
3. OA sources supplement RAG and standardization; they never substitute for verified clinician gold labels.
4. A single disease-association paper cannot become a diagnostic rule.
5. Uncertain or unobserved features remain unknown.
6. Chatbot may show PubMed provenance; analysis/dashboard/history do not expose source internals.

## Next expansion
After v1 stabilizes:
- add open-access oral-medicine sources for normal variants and lesion/red-flag differential;
- add more sublingual-vein and coating reliability papers;
- add open datasets only when license and provenance are explicit;
- merge user-provided teaching materials later as a separate owner-provided corpus, not as open-access provenance.
