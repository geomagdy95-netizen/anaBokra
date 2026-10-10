import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';

interface TextField {
  en: string;
  ar: string;
  arF?: string;
}

interface Instrument {
  id: string;
  kind: string;
  responseScale?: { labels: TextField[] };
  selfRatingScale?: { labels: TextField[] };
  scales?: Array<{ id: string; name: TextField }>;
  items?: any[];
  cards?: any[];
  selfRatings?: any[];
  buckets?: any[];
}

interface ReviewRow {
  instrument: string;
  item_id: string;
  type: string;
  scale_or_domain: string;
  keyed: string;
  english: string;
  arabic_draft: string;
  arabic_feminine: string;
  back_translation: string;
  clarity_1to5: string;
  cultural_fit_1to5: string;
  suggested_arabic: string;
  reviewer_notes: string;
  status: string;
}

function escapeCSV(value: string): string {
  if (!value) return '';
  // RFC 4180: escape quotes and wrap in quotes if contains comma, newline, or quote
  if (value.includes(',') || value.includes('\n') || value.includes('"')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function loadInstrument(id: string): Instrument {
  const path = resolve(
    dirname(new URL(import.meta.url).pathname),
    `../instruments/${id}.json`
  );
  return JSON.parse(readFileSync(path, 'utf-8'));
}

async function exportReview() {
  const instrumentIds = ['interests', 'personality', 'values', 'abilities', 'readiness'];
  const rows: ReviewRow[] = [];
  const counts: Record<string, number> = {};

  for (const instrumentId of instrumentIds) {
    const instrument = loadInstrument(instrumentId);
    counts[instrumentId] = 0;

    // For likert instruments, add response scale labels first
    if (instrument.kind === 'likert' && instrument.responseScale) {
      for (const label of instrument.responseScale.labels) {
        rows.push({
          instrument: instrumentId,
          item_id: `${instrumentId}_scale_label`,
          type: 'scale_label',
          scale_or_domain: '',
          keyed: '',
          english: label.en,
          arabic_draft: label.ar,
          arabic_feminine: label.arF || '',
          back_translation: '',
          clarity_1to5: '',
          cultural_fit_1to5: '',
          suggested_arabic: '',
          reviewer_notes: '',
          status: '',
        });
        counts[instrumentId]++;
      }
    }

    // For abilities, add self-rating scale labels first
    if (instrument.kind === 'abilities' && instrument.selfRatingScale) {
      for (const label of instrument.selfRatingScale.labels) {
        rows.push({
          instrument: instrumentId,
          item_id: `${instrumentId}_scale_label`,
          type: 'scale_label',
          scale_or_domain: '',
          keyed: '',
          english: label.en,
          arabic_draft: label.ar,
          arabic_feminine: label.arF || '',
          back_translation: '',
          clarity_1to5: '',
          cultural_fit_1to5: '',
          suggested_arabic: '',
          reviewer_notes: '',
          status: '',
        });
        counts[instrumentId]++;
      }
    }

    // Add bucket labels for cardSort
    if (instrument.kind === 'cardSort' && instrument.buckets) {
      for (const bucket of instrument.buckets) {
        rows.push({
          instrument: instrumentId,
          item_id: bucket.id,
          type: 'bucket',
          scale_or_domain: '',
          keyed: '',
          english: bucket.name.en,
          arabic_draft: bucket.name.ar,
          arabic_feminine: bucket.name.arF || '',
          back_translation: '',
          clarity_1to5: '',
          cultural_fit_1to5: '',
          suggested_arabic: '',
          reviewer_notes: '',
          status: '',
        });
        counts[instrumentId]++;
      }
    }

    // Add likert items
    if (instrument.items) {
      for (const item of instrument.items) {
        if (item.attentionCheck) {
          rows.push({
            instrument: instrumentId,
            item_id: item.id,
            type: 'attention_check',
            scale_or_domain: item.scale || '',
            keyed: '',
            english: item.text.en,
            arabic_draft: item.text.ar,
            arabic_feminine: item.text.arF || '',
            back_translation: '',
            clarity_1to5: '',
            cultural_fit_1to5: '',
            suggested_arabic: '',
            reviewer_notes: '',
            status: '',
          });
        } else {
          rows.push({
            instrument: instrumentId,
            item_id: item.id,
            type: 'item',
            scale_or_domain: item.scale || '',
            keyed: item.keyed ? item.keyed.toString() : '',
            english: item.text.en,
            arabic_draft: item.text.ar,
            arabic_feminine: item.text.arF || '',
            back_translation: '',
            clarity_1to5: '',
            cultural_fit_1to5: '',
            suggested_arabic: '',
            reviewer_notes: '',
            status: '',
          });
        }
        counts[instrumentId]++;
      }
    }

    // Add cards for cardSort
    if (instrument.cards) {
      for (const card of instrument.cards) {
        rows.push({
          instrument: instrumentId,
          item_id: card.id,
          type: 'card',
          scale_or_domain: card.value || '',
          keyed: '',
          english: card.text.en,
          arabic_draft: card.text.ar,
          arabic_feminine: card.text.arF || '',
          back_translation: '',
          clarity_1to5: '',
          cultural_fit_1to5: '',
          suggested_arabic: '',
          reviewer_notes: '',
          status: '',
        });
        counts[instrumentId]++;
      }
    }

    // Add self-ratings for abilities
    if (instrument.selfRatings) {
      for (const rating of instrument.selfRatings) {
        rows.push({
          instrument: instrumentId,
          item_id: rating.id,
          type: 'self_rating',
          scale_or_domain: rating.domain || '',
          keyed: '',
          english: rating.text.en,
          arabic_draft: rating.text.ar,
          arabic_feminine: rating.text.arF || '',
          back_translation: '',
          clarity_1to5: '',
          cultural_fit_1to5: '',
          suggested_arabic: '',
          reviewer_notes: '',
          status: '',
        });
        counts[instrumentId]++;
      }
    }
  }

  // Write CSV with UTF-8 BOM
  const headers = [
    'instrument',
    'item_id',
    'type',
    'scale_or_domain',
    'keyed',
    'english',
    'arabic_draft',
    'arabic_feminine',
    'back_translation',
    'clarity_1to5',
    'cultural_fit_1to5',
    'suggested_arabic',
    'reviewer_notes',
    'status',
  ];

  const csvLines = [headers.map(escapeCSV).join(',')];
  for (const row of rows) {
    const line = [
      escapeCSV(row.instrument),
      escapeCSV(row.item_id),
      escapeCSV(row.type),
      escapeCSV(row.scale_or_domain),
      escapeCSV(row.keyed),
      escapeCSV(row.english),
      escapeCSV(row.arabic_draft),
      escapeCSV(row.arabic_feminine),
      escapeCSV(row.back_translation),
      escapeCSV(row.clarity_1to5),
      escapeCSV(row.cultural_fit_1to5),
      escapeCSV(row.suggested_arabic),
      escapeCSV(row.reviewer_notes),
      escapeCSV(row.status),
    ].join(',');
    csvLines.push(line);
  }

  const csvContent = csvLines.join('\n');

  // Add UTF-8 BOM
  const bom = '﻿';
  const outputDir = resolve(
    dirname(new URL(import.meta.url).pathname),
    '../../../docs/review'
  );
  mkdirSync(outputDir, { recursive: true });
  const outputPath = `${outputDir}/items-review.csv`;
  writeFileSync(outputPath, bom + csvContent, 'utf-8');

  // Print summary
  console.log('\n=== Translation Review Pack Export ===');
  console.log(`\nRow counts by instrument:`);
  let totalRows = 0;
  for (const instrumentId of instrumentIds) {
    const count = counts[instrumentId] ?? 0;
    console.log(`  ${instrumentId}: ${count} rows`);
    totalRows += count;
  }
  console.log(`\nTotal rows (excluding header): ${totalRows}`);
  console.log(`CSV file: ${outputPath}`);
  console.log(`\nCSV ready for review. Columns available for psychologist notes:`);
  console.log(`  - back_translation (back-translation from independent bilingual reviewer)`);
  console.log(`  - clarity_1to5 (scale: 1=very unclear, 5=very clear)`);
  console.log(`  - cultural_fit_1to5 (scale: 1=not appropriate, 5=highly appropriate)`);
  console.log(`  - suggested_arabic (any improvements to the Arabic draft)`);
  console.log(`  - reviewer_notes (additional notes or observations)`);
  console.log(`  - status (e.g., "approved", "needs revision", "flagged for adaptation")`);
}

exportReview().catch(console.error);
