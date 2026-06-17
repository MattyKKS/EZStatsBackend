/**
 * EZ Stats Backend – DTO Input Validation Tests
 * UTC-01 (CreateTeamDto), UTC-02 (CreatePlayerDto), UTC-03 (UpdateMatchDto)
 *
 * Run:  npx ts-node --project tsconfig.json test/dto-validation.ts
 */

import 'reflect-metadata';
import { validate, ValidationError } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateTeamDto } from '../src/teams/dto/create-team.dto';
import { CreatePlayerDto } from '../src/players/dto/create-player.dto';
import { UpdateMatchDto } from '../src/matches/dto/update-match.dto';

// ── Minimal test runner ────────────────────────────────────────────────────────

interface TestResult {
  id: string;
  description: string;
  status: 'PASS' | 'FAIL';
  actual: string;
}

const results: TestResult[] = [];
let passed = 0;
let failed = 0;

async function test(
  id: string,
  description: string,
  fn: () => Promise<void>,
): Promise<void> {
  try {
    await fn();
    results.push({ id, description, status: 'PASS', actual: 'Validation behaved as expected.' });
    passed++;
  } catch (err: any) {
    results.push({ id, description, status: 'FAIL', actual: err.message });
    failed++;
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function constraintMessages(errors: ValidationError[]): string {
  return errors.flatMap(e => Object.values(e.constraints ?? {})).join('; ');
}

// ── UTC-01: CreateTeamDto ──────────────────────────────────────────────────────

async function runUTC01() {
  await test('UTC-01-TC-01', 'Create team with valid name', async () => {
    const dto = plainToInstance(CreateTeamDto, { name: 'FC Test United' });
    const errors = await validate(dto);
    assert(errors.length === 0, `Expected 0 errors, got: ${constraintMessages(errors)}`);
  });

  await test('UTC-01-TC-02', 'Create team with name and description', async () => {
    const dto = plainToInstance(CreateTeamDto, {
      name: 'FC Test United',
      description: 'Test team for QA',
    });
    const errors = await validate(dto);
    assert(errors.length === 0, `Expected 0 errors, got: ${constraintMessages(errors)}`);
  });

  await test('UTC-01-TC-03', 'Create team with empty name string', async () => {
    const dto = plainToInstance(CreateTeamDto, { name: '' });
    const errors = await validate(dto);
    assert(errors.length > 0, 'Expected validation errors for empty name');
    const hasMinLength = errors.some(
      e => e.property === 'name' && Object.keys(e.constraints ?? {}).includes('minLength'),
    );
    assert(hasMinLength, `Expected minLength constraint on name, got: ${constraintMessages(errors)}`);
  });

  await test('UTC-01-TC-04', 'Create team with missing name field', async () => {
    const dto = plainToInstance(CreateTeamDto, {});
    const errors = await validate(dto);
    assert(errors.length > 0, 'Expected validation errors for missing name');
    const hasNameError = errors.some(e => e.property === 'name');
    assert(hasNameError, `Expected error on 'name' property, got: ${constraintMessages(errors)}`);
  });
}

// ── UTC-02: CreatePlayerDto ────────────────────────────────────────────────────

async function runUTC02() {
  await test('UTC-02-TC-01', 'Create player with name only (minimal valid)', async () => {
    const dto = plainToInstance(CreatePlayerDto, { name: 'John Doe' });
    const errors = await validate(dto);
    assert(errors.length === 0, `Expected 0 errors, got: ${constraintMessages(errors)}`);
  });

  await test('UTC-02-TC-02', 'Create player with all fields', async () => {
    const dto = plainToInstance(CreatePlayerDto, {
      name: 'John Doe',
      jerseyNumber: 9,
      position: 'Forward',
    });
    const errors = await validate(dto);
    assert(errors.length === 0, `Expected 0 errors, got: ${constraintMessages(errors)}`);
  });

  await test('UTC-02-TC-03', 'jerseyNumber=0 — boundary minimum (valid)', async () => {
    const dto = plainToInstance(CreatePlayerDto, { name: 'Goalkeeper', jerseyNumber: 0 });
    const errors = await validate(dto);
    assert(errors.length === 0, `jerseyNumber=0 should be valid (Min=0), got: ${constraintMessages(errors)}`);
  });

  await test('UTC-02-TC-04', 'jerseyNumber=999 — boundary maximum (valid)', async () => {
    const dto = plainToInstance(CreatePlayerDto, { name: 'Test', jerseyNumber: 999 });
    const errors = await validate(dto);
    assert(errors.length === 0, `jerseyNumber=999 should be valid (Max=999), got: ${constraintMessages(errors)}`);
  });

  await test('UTC-02-TC-05', 'jerseyNumber=-1 — negative (invalid)', async () => {
    const dto = plainToInstance(CreatePlayerDto, { name: 'Test', jerseyNumber: -1 });
    const errors = await validate(dto);
    assert(errors.length > 0, 'Expected validation error for jerseyNumber=-1');
    const hasMinError = errors.some(
      e => e.property === 'jerseyNumber' && Object.keys(e.constraints ?? {}).includes('min'),
    );
    assert(hasMinError, `Expected min constraint on jerseyNumber, got: ${constraintMessages(errors)}`);
  });

  await test('UTC-02-TC-06', 'jerseyNumber=1000 — exceeds max (invalid)', async () => {
    const dto = plainToInstance(CreatePlayerDto, { name: 'Test', jerseyNumber: 1000 });
    const errors = await validate(dto);
    assert(errors.length > 0, 'Expected validation error for jerseyNumber=1000');
    const hasMaxError = errors.some(
      e => e.property === 'jerseyNumber' && Object.keys(e.constraints ?? {}).includes('max'),
    );
    assert(hasMaxError, `Expected max constraint on jerseyNumber, got: ${constraintMessages(errors)}`);
  });

  await test('UTC-02-TC-07', 'Missing name field (required)', async () => {
    const dto = plainToInstance(CreatePlayerDto, { jerseyNumber: 9 });
    const errors = await validate(dto);
    assert(errors.length > 0, 'Expected validation error for missing name');
    const hasNameError = errors.some(e => e.property === 'name');
    assert(hasNameError, `Expected error on 'name', got: ${constraintMessages(errors)}`);
  });

  await test('UTC-02-TC-08', 'Position as free text — no enum constraint', async () => {
    const dto = plainToInstance(CreatePlayerDto, {
      name: 'Test',
      position: 'Centre Attacking Midfielder',
    });
    const errors = await validate(dto);
    assert(errors.length === 0, `Free-text position should be valid, got: ${constraintMessages(errors)}`);
  });
}

// ── UTC-03: UpdateMatchDto ─────────────────────────────────────────────────────

async function runUTC03() {
  await test('UTC-03-TC-01', 'Update status to UPLOADED (valid enum value)', async () => {
    const dto = plainToInstance(UpdateMatchDto, { status: 'UPLOADED' });
    const errors = await validate(dto);
    assert(errors.length === 0, `Expected 0 errors, got: ${constraintMessages(errors)}`);
  });

  await test('UTC-03-TC-02', 'Update status to COMPLETED (valid enum value)', async () => {
    const dto = plainToInstance(UpdateMatchDto, { status: 'COMPLETED' });
    const errors = await validate(dto);
    assert(errors.length === 0, `Expected 0 errors, got: ${constraintMessages(errors)}`);
  });

  await test('UTC-03-TC-03', 'Update with invalid status string', async () => {
    const dto = plainToInstance(UpdateMatchDto, { status: 'INVALID_STATUS' });
    const errors = await validate(dto);
    assert(errors.length > 0, 'Expected validation error for invalid status');
    const hasEnumError = errors.some(
      e => e.property === 'status' && Object.keys(e.constraints ?? {}).includes('isEnum'),
    );
    assert(hasEnumError, `Expected isEnum constraint on status, got: ${constraintMessages(errors)}`);
  });

  await test('UTC-03-TC-04', 'Update videoPath field (valid string)', async () => {
    const dto = plainToInstance(UpdateMatchDto, { videoPath: '/uploads/match1.mp4' });
    const errors = await validate(dto);
    assert(errors.length === 0, `Expected 0 errors, got: ${constraintMessages(errors)}`);
  });
}

// ── Run all ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('EZ Stats Backend — DTO Validation Tests\n');
  console.log('── UTC-01: CreateTeamDto ─────────────────');
  await runUTC01();
  console.log('── UTC-02: CreatePlayerDto ───────────────');
  await runUTC02();
  console.log('── UTC-03: UpdateMatchDto ────────────────');
  await runUTC03();

  console.log('\n══════════════════════════════════════════');
  console.log('RESULTS');
  console.log('══════════════════════════════════════════');
  for (const r of results) {
    const mark = r.status === 'PASS' ? '✓' : '✗';
    console.log(`${mark} [${r.status}] ${r.id}: ${r.description}`);
    if (r.status === 'FAIL') console.log(`       Actual: ${r.actual}`);
  }
  console.log(`\nTotal: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);

  if (failed > 0) process.exit(1);
}

main().catch(err => { console.error(err); process.exit(1); });
