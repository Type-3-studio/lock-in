import { describe, expect, it } from 'vitest';
import { SCHEMA_VERSION, createExport, parseExport, parseExportJson } from './dto.js';
import type { ExportState } from './dto.js';

const state: ExportState = {
  goals: [],
  tasks: [],
  occurrences: [],
  notes: [],
  history: [],
};

describe('createExport', () => {
  it('stamps the schema version and exportedAt', () => {
    const dto = createExport(state, '2026-09-15T00:00:00.000Z');
    expect(dto.schemaVersion).toBe(SCHEMA_VERSION);
    expect(dto.exportedAt).toBe('2026-09-15T00:00:00.000Z');
    expect(dto.goals).toEqual([]);
  });
});

describe('parseExport', () => {
  it('round-trips a created export', () => {
    const dto = createExport(state, '2026-09-15T00:00:00.000Z');
    expect(parseExport(JSON.parse(JSON.stringify(dto)))).toEqual(dto);
  });

  it('rejects non-objects', () => {
    expect(() => parseExport(null)).toThrow(/JSON object/);
    expect(() => parseExport('nope')).toThrow(/JSON object/);
  });

  it('rejects an unsupported schema version', () => {
    const dto = { ...createExport(state, 'x'), schemaVersion: 99 };
    expect(() => parseExport(dto)).toThrow(/schemaVersion/);
  });

  it('rejects missing collections', () => {
    const dto: Record<string, unknown> = { ...createExport(state, 'x') };
    delete dto.notes;
    expect(() => parseExport(dto)).toThrow(/notes/);
  });
});

describe('parseExportJson', () => {
  it('parses valid JSON text', () => {
    const dto = createExport(state, 'x');
    expect(parseExportJson(JSON.stringify(dto))).toEqual(dto);
  });

  it('rejects malformed JSON text', () => {
    expect(() => parseExportJson('{not json')).toThrow(/not valid JSON/);
  });
});
