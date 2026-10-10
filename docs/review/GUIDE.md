# Translation Review Pack Guide

## Purpose

This pack supports ITC test-adaptation guidelines for the five anaBokra career-readiness instruments. A project psychologist reviews every assessment item's Arabic draft, ensures cultural appropriateness, and validates translation quality through independent back-translation.

## Review Process

### 1. Independent Back-Translation Check
- A second bilingual person (who has NOT seen the English items) translates the Arabic draft **back to English**
- Enter this back-translation in the `back_translation` column
- Compare it with the original English: any gaps suggest the Arabic may be imprecise or cultural

### 2. Reconciliation Review
- Assess each item for clarity and cultural fit (scales 1–5)
- Note suggested improvements in `suggested_arabic`
- Add observations to `reviewer_notes` (e.g., "colloquial form better than formal", "item may not resonate in Egyptian context")
- Update `status` (e.g., "approved", "needs revision", "flagged for adaptation")

### 3. Cognitive Interviews
- Conduct 10–15 teen interviews with items rated ≤3 for clarity or cultural fit
- Document feedback and any adaptation needed
- Update `reviewer_notes` and `suggested_arabic` from interview insights

## Column Guide

- **instrument**: Name of the assessment (interests, personality, values, abilities, readiness)
- **item_id**: Unique identifier (e.g., ip_R01, ipip_E01, v_autonomy, ab_verbal_1, rd_01)
- **type**: Row category (item, attention_check, card, self_rating, scale_label, bucket)
- **scale_or_domain**: Which scale/domain the item belongs to (e.g., "R" for Realistic, "verbal" for verbal ability)
- **keyed**: Direction of scoring (1 = positive, -1 = reverse-coded, blank for non-scored)
- **english**: Original English wording
- **arabic_draft**: Current Arabic draft (may be Egyptian colloquial or Modern Standard Arabic)
- **arabic_feminine**: Feminine variant if grammatically gendered (e.g., adjectives, "I am" forms)
- **back_translation**: Re-translation of the Arabic back to English (for validation only)
- **clarity_1to5**: Psychologist's rating: 1=very unclear, 5=very clear to Egyptian teens
- **cultural_fit_1to5**: Psychologist's rating: 1=not appropriate, 5=highly appropriate for Egyptian context
- **suggested_arabic**: Proposed improvement to the Arabic wording
- **reviewer_notes**: Rationale, cognitive interview findings, etc.
- **status**: Approval status (e.g., "approved", "needs revision", "flagged for adaptation")

## Language Variant Decision

**Egyptian Colloquial vs. Modern Standard Arabic (MSA)**

The current drafts use **Egyptian colloquial Arabic** (العاميّة المصريّة), which is more natural for Egyptian teens. If the psychologist prefers MSA or a mixed approach, update the `suggested_arabic` column and note the rationale in `reviewer_notes`.

## Culturally Adapted Items

**ip_A08** ("Perform jazz or tap dance" → "أقدّم عروض استعراضية أو رقص فني")  
The original item references Western dance genres not culturally relevant in Egypt. The Arabic adaptation generalizes to "performance or artistic dance." Confirm this captures the intent (self-expression through movement) without being too vague.

## Gendered Variants

Items marked **arF** have a feminine form. These appear in:
- Personality items: adjectives and first-person descriptors (e.g., "مستعد" → "مستعدة")
- Values card: "بكون مشغول" → "بكون مشغولة"
- Readiness items: gendered forms of agreement responses and opening questions

Verify feminine forms are grammatically and semantically correct. Some items may not need a feminine variant (e.g., "بحبه" is gender-neutral).

## Next Steps

1. Review each row; fill clarity and cultural-fit ratings
2. Enter back-translations from independent bilingual reviewer
3. Note suggested improvements and rationale
4. Conduct cognitive interviews with 10–15 teens (focus on low-clarity items)
5. Update `status` column: mark as "approved" once confirmed
6. Export updated CSV and share findings with the project lead
