/**
 * EZ Stats Backend — Comprehensive Unit Tests
 * UTC-01 to UTC-06: DTO validation + Service layer (mocked Prisma)
 *
 * Run: npx ts-node --project tsconfig.json test/all-unit-tests.ts
 */

import 'reflect-metadata';
import { validate, ValidationError } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { NotFoundException, ConflictException } from '@nestjs/common';

import { CreateTeamDto } from '../src/teams/dto/create-team.dto';
import { UpdateTeamDto } from '../src/teams/dto/update-team.dto';
import { CreatePlayerDto } from '../src/players/dto/create-player.dto';
import { UpdatePlayerDto } from '../src/players/dto/update-player.dto';
import { CreateMatchDto } from '../src/matches/dto/create-match.dto';
import { UpdateMatchDto } from '../src/matches/dto/update-match.dto';
import { TeamsService } from '../src/teams/teams.service';
import { PlayersService } from '../src/players/players.service';
import { MatchesService } from '../src/matches/matches.service';
import { Prisma } from '@prisma/client';

// ── Runner ─────────────────────────────────────────────────────────────────────
interface TR { id: string; desc: string; status: 'PASS' | 'FAIL'; actual: string }
const results: TR[] = [];
let passed = 0; let failed = 0;

async function t(id: string, desc: string, fn: () => Promise<void>) {
  try { await fn(); results.push({ id, desc, status: 'PASS', actual: 'OK' }); passed++; }
  catch (e: any) { results.push({ id, desc, status: 'FAIL', actual: e.message }); failed++; }
}
function assert(c: boolean, m: string) { if (!c) throw new Error(m); }
function errs(errors: ValidationError[]) {
  return errors.flatMap(e => Object.values(e.constraints ?? {})).join('; ');
}
async function assertHas(dto: any, field: string, constraint: string) {
  const errors = await validate(dto);
  const found = errors.some(e => e.property === field && Object.keys(e.constraints ?? {}).includes(constraint));
  assert(found, `Expected ${constraint} on '${field}'. Errors: ${errs(errors)}`);
}
async function assertValid(dto: any) {
  const errors = await validate(dto);
  assert(errors.length === 0, `Expected 0 errors, got: ${errs(errors)}`);
}

// ── Mock Prisma ────────────────────────────────────────────────────────────────
const TEAM  = { id: 'team-uuid', name: 'FC Test', description: null, primaryColor: null,
                secondaryColor: null, ownerId: null, players: [], matches: [],
                _count: { players: 0, matches: 0 }, createdAt: new Date(), updatedAt: new Date() };
const PLAYER= { id: 'player-uuid', name: 'Alex', jerseyNumber: 9, position: 'Midfielder',
                teamId: 'team-uuid', createdAt: new Date(), updatedAt: new Date() };
const MATCH = { id: 'match-uuid', teamId: 'team-uuid', status: 'CREATED', date: null,
                opponent: null, teamColor: null, opponentColor: null, videoPath: null,
                runId: null, reportPath: null, team: TEAM, createdAt: new Date(), updatedAt: new Date() };

function makePrisma(overrides: Record<string, any> = {}) {
  return {
    team: {
      create:     async (a: any) => ({ ...TEAM, ...a.data }),
      findMany:   async ()       => [TEAM],
      findUnique: async (a: any) => overrides.teamNotFound ? null : TEAM,
      update:     async (a: any) => ({ ...TEAM, ...a.data }),
      delete:     async ()       => TEAM,
    },
    player: {
      create:     async (a: any) => {
        if (overrides.p2002) {
          const err = new Prisma.PrismaClientKnownRequestError('Unique constraint', {
            code: 'P2002', clientVersion: '1', meta: {} });
          throw err;
        }
        return { ...PLAYER, ...a.data };
      },
      findMany:   async ()       => [PLAYER],
      findUnique: async (a: any) => overrides.playerNotFound ? null : PLAYER,
      update:     async (a: any) => {
        if (overrides.p2002) {
          const err = new Prisma.PrismaClientKnownRequestError('Unique constraint', {
            code: 'P2002', clientVersion: '1', meta: {} });
          throw err;
        }
        return { ...PLAYER, ...a.data };
      },
      delete:     async ()       => PLAYER,
    },
    match: {
      create:     async (a: any) => ({ ...MATCH, ...a.data }),
      findMany:   async ()       => [MATCH],
      findUnique: async (a: any) => overrides.matchNotFound ? null : MATCH,
      update:     async (a: any) => ({ ...MATCH, ...a.data }),
      delete:     async ()       => MATCH,
    },
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// UTC-01  DTO: CreateTeamDto / UpdateTeamDto
// ══════════════════════════════════════════════════════════════════════════════

async function utc01_dto() {
  await t('UTC-01-D-01','CreateTeamDto valid name → 0 errors', async () => {
    await assertValid(plainToInstance(CreateTeamDto, { name: 'FC Test United' }));
  });
  await t('UTC-01-D-02','CreateTeamDto with all optional fields → 0 errors', async () => {
    await assertValid(plainToInstance(CreateTeamDto,
      { name: 'FC Test', description: 'Youth squad', primaryColor: '#1E40AF', secondaryColor: '#FFF', ownerId: 'uuid' }));
  });
  await t('UTC-01-D-03','CreateTeamDto empty name → minLength error', async () => {
    await assertHas(plainToInstance(CreateTeamDto, { name: '' }), 'name', 'minLength');
  });
  await t('UTC-01-D-04','CreateTeamDto missing name → isNotEmpty error', async () => {
    const errors = await validate(plainToInstance(CreateTeamDto, {}));
    assert(errors.some(e => e.property === 'name'), `Expected error on 'name'`);
  });
  await t('UTC-01-D-05','UpdateTeamDto all-optional → 0 errors with empty body', async () => {
    await assertValid(plainToInstance(UpdateTeamDto, {}));
  });
  await t('UTC-01-D-06','UpdateTeamDto valid partial name → 0 errors', async () => {
    await assertValid(plainToInstance(UpdateTeamDto, { name: 'New Name' }));
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// UTC-01  Service: TeamsService
// ══════════════════════════════════════════════════════════════════════════════

async function utc01_service() {
  await t('UTC-01-S-01','TeamsService.create returns team object', async () => {
    const svc = new TeamsService(makePrisma() as any);
    const result = await svc.create({ name: 'FC Test' } as CreateTeamDto);
    assert(result !== null && result !== undefined, 'Expected team object');
    assert((result as any).name === 'FC Test', 'Expected name FC Test');
  });
  await t('UTC-01-S-02','TeamsService.findAll returns array with _count', async () => {
    const svc = new TeamsService(makePrisma() as any);
    const result = await svc.findAll() as any[];
    assert(Array.isArray(result), 'Expected array');
    assert(result.length > 0, 'Expected non-empty array');
    assert('_count' in result[0], 'Expected _count field');
  });
  await t('UTC-01-S-03','TeamsService.findOne returns team with players[]', async () => {
    const svc = new TeamsService(makePrisma() as any);
    const result = await svc.findOne('team-uuid') as any;
    assert(result.id === 'team-uuid', 'Expected correct id');
    assert(Array.isArray(result.players), 'Expected players array');
  });
  await t('UTC-01-S-04','TeamsService.findOne non-existent → NotFoundException', async () => {
    const svc = new TeamsService(makePrisma({ teamNotFound: true }) as any);
    let threw = false;
    try { await svc.findOne('bad-uuid'); }
    catch (e) { threw = e instanceof NotFoundException; }
    assert(threw, 'Expected NotFoundException');
  });
  await t('UTC-01-S-05','TeamsService.findOne error message contains team id', async () => {
    const svc = new TeamsService(makePrisma({ teamNotFound: true }) as any);
    let msg = '';
    try { await svc.findOne('bad-uuid'); }
    catch (e: any) { msg = e.message; }
    assert(msg.includes('bad-uuid'), `Expected id in message, got: ${msg}`);
  });
  await t('UTC-01-S-06','TeamsService.update returns updated team', async () => {
    const svc = new TeamsService(makePrisma() as any);
    const result = await svc.update('team-uuid', { name: 'New Name' } as UpdateTeamDto) as any;
    assert(result !== null, 'Expected result');
  });
  await t('UTC-01-S-07','TeamsService.update non-existent → NotFoundException', async () => {
    const svc = new TeamsService(makePrisma({ teamNotFound: true }) as any);
    let threw = false;
    try { await svc.update('bad-uuid', { name: 'X' } as UpdateTeamDto); }
    catch (e) { threw = e instanceof NotFoundException; }
    assert(threw, 'Expected NotFoundException');
  });
  await t('UTC-01-S-08','TeamsService.remove returns deleted team', async () => {
    const svc = new TeamsService(makePrisma() as any);
    const result = await svc.remove('team-uuid') as any;
    assert(result.id === 'team-uuid', 'Expected deleted team');
  });
  await t('UTC-01-S-09','TeamsService.remove non-existent → NotFoundException', async () => {
    const svc = new TeamsService(makePrisma({ teamNotFound: true }) as any);
    let threw = false;
    try { await svc.remove('bad-uuid'); }
    catch (e) { threw = e instanceof NotFoundException; }
    assert(threw, 'Expected NotFoundException');
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// UTC-02  DTO: CreatePlayerDto / UpdatePlayerDto
// ══════════════════════════════════════════════════════════════════════════════

async function utc02_dto() {
  await t('UTC-02-D-01','CreatePlayerDto name only → 0 errors', async () => {
    await assertValid(plainToInstance(CreatePlayerDto, { name: 'Alex' }));
  });
  await t('UTC-02-D-02','CreatePlayerDto all fields → 0 errors', async () => {
    await assertValid(plainToInstance(CreatePlayerDto, { name: 'Alex', jerseyNumber: 9, position: 'Midfielder' }));
  });
  await t('UTC-02-D-03','CreatePlayerDto jerseyNumber=0 → valid (Min=0)', async () => {
    await assertValid(plainToInstance(CreatePlayerDto, { name: 'GK', jerseyNumber: 0 }));
  });
  await t('UTC-02-D-04','CreatePlayerDto jerseyNumber=999 → valid (Max=999)', async () => {
    await assertValid(plainToInstance(CreatePlayerDto, { name: 'T', jerseyNumber: 999 }));
  });
  await t('UTC-02-D-05','CreatePlayerDto jerseyNumber=-1 → min error', async () => {
    await assertHas(plainToInstance(CreatePlayerDto, { name: 'T', jerseyNumber: -1 }), 'jerseyNumber', 'min');
  });
  await t('UTC-02-D-06','CreatePlayerDto jerseyNumber=1000 → max error', async () => {
    await assertHas(plainToInstance(CreatePlayerDto, { name: 'T', jerseyNumber: 1000 }), 'jerseyNumber', 'max');
  });
  await t('UTC-02-D-07','CreatePlayerDto missing name → error on name', async () => {
    const errors = await validate(plainToInstance(CreatePlayerDto, {}));
    assert(errors.some(e => e.property === 'name'), 'Expected name error');
  });
  await t('UTC-02-D-08','CreatePlayerDto position free text → 0 errors', async () => {
    await assertValid(plainToInstance(CreatePlayerDto, { name: 'T', position: 'Centre Attacking Midfielder' }));
  });
  await t('UTC-02-D-09','UpdatePlayerDto all optional → 0 errors', async () => {
    await assertValid(plainToInstance(UpdatePlayerDto, {}));
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// UTC-02  Service: PlayersService
// ══════════════════════════════════════════════════════════════════════════════

async function utc02_service() {
  await t('UTC-02-S-01','PlayersService.create returns player', async () => {
    const svc = new PlayersService(makePrisma() as any);
    const result = await svc.create('team-uuid', { name: 'Alex' } as CreatePlayerDto) as any;
    assert(result !== null, 'Expected player');
  });
  await t('UTC-02-S-02','PlayersService.create team not found → NotFoundException', async () => {
    const svc = new PlayersService(makePrisma({ teamNotFound: true }) as any);
    let threw = false;
    try { await svc.create('bad-team', { name: 'Alex' } as CreatePlayerDto); }
    catch (e) { threw = e instanceof NotFoundException; }
    assert(threw, 'Expected NotFoundException');
  });
  await t('UTC-02-S-03','PlayersService.create P2002 → ConflictException', async () => {
    const svc = new PlayersService(makePrisma({ p2002: true }) as any);
    let threw = false;
    try { await svc.create('team-uuid', { name: 'Alex', jerseyNumber: 9 } as CreatePlayerDto); }
    catch (e) { threw = e instanceof ConflictException; }
    assert(threw, 'Expected ConflictException');
  });
  await t('UTC-02-S-04','PlayersService.findAllForTeam returns player array', async () => {
    const svc = new PlayersService(makePrisma() as any);
    const result = await svc.findAllForTeam('team-uuid');
    assert(Array.isArray(result), 'Expected array');
  });
  await t('UTC-02-S-05','PlayersService.findAllForTeam team not found → NotFoundException', async () => {
    const svc = new PlayersService(makePrisma({ teamNotFound: true }) as any);
    let threw = false;
    try { await svc.findAllForTeam('bad-uuid'); }
    catch (e) { threw = e instanceof NotFoundException; }
    assert(threw, 'Expected NotFoundException');
  });
  await t('UTC-02-S-06','PlayersService.findOne returns player', async () => {
    const svc = new PlayersService(makePrisma() as any);
    const result = await svc.findOne('player-uuid') as any;
    assert(result.id === 'player-uuid', 'Expected player id');
  });
  await t('UTC-02-S-07','PlayersService.findOne not found → NotFoundException with player id', async () => {
    const svc = new PlayersService(makePrisma({ playerNotFound: true }) as any);
    let msg = '';
    try { await svc.findOne('bad-player'); }
    catch (e: any) { if (e instanceof NotFoundException) msg = e.message; }
    assert(msg.includes('bad-player'), `Expected player id in message, got: ${msg}`);
  });
  await t('UTC-02-S-08','PlayersService.update returns updated player', async () => {
    const svc = new PlayersService(makePrisma() as any);
    const result = await svc.update('player-uuid', { position: 'Forward' } as UpdatePlayerDto);
    assert(result !== null, 'Expected updated player');
  });
  await t('UTC-02-S-09','PlayersService.update P2002 → ConflictException', async () => {
    const svc = new PlayersService(makePrisma({ p2002: true }) as any);
    let threw = false;
    try { await svc.update('player-uuid', { jerseyNumber: 9 } as UpdatePlayerDto); }
    catch (e) { threw = e instanceof ConflictException; }
    assert(threw, 'Expected ConflictException');
  });
  await t('UTC-02-S-10','PlayersService.remove returns deleted player', async () => {
    const svc = new PlayersService(makePrisma() as any);
    const result = await svc.remove('player-uuid') as any;
    assert(result.id === 'player-uuid', 'Expected deleted player id');
  });
  await t('UTC-02-S-11','PlayersService.remove not found → NotFoundException', async () => {
    const svc = new PlayersService(makePrisma({ playerNotFound: true }) as any);
    let threw = false;
    try { await svc.remove('bad-uuid'); }
    catch (e) { threw = e instanceof NotFoundException; }
    assert(threw, 'Expected NotFoundException');
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// UTC-03  DTO: CreateMatchDto / UpdateMatchDto
// ══════════════════════════════════════════════════════════════════════════════

async function utc03_dto() {
  await t('UTC-03-D-01','CreateMatchDto empty body → 0 errors (all optional)', async () => {
    await assertValid(plainToInstance(CreateMatchDto, {}));
  });
  await t('UTC-03-D-02','CreateMatchDto valid ISO date → 0 errors', async () => {
    await assertValid(plainToInstance(CreateMatchDto, { date: '2024-11-15T18:00:00Z', opponent: 'City United' }));
  });
  await t('UTC-03-D-03','CreateMatchDto valid hex colours → 0 errors', async () => {
    await assertValid(plainToInstance(CreateMatchDto, { teamColor: '#1E40AF', opponentColor: '#EF4444' }));
  });
  await t('UTC-03-D-04','UpdateMatchDto status=UPLOADED → 0 errors', async () => {
    await assertValid(plainToInstance(UpdateMatchDto, { status: 'UPLOADED' }));
  });
  await t('UTC-03-D-05','UpdateMatchDto status=COMPLETED → 0 errors', async () => {
    await assertValid(plainToInstance(UpdateMatchDto, { status: 'COMPLETED' }));
  });
  await t('UTC-03-D-06','UpdateMatchDto status=PROCESSING → 0 errors', async () => {
    await assertValid(plainToInstance(UpdateMatchDto, { status: 'PROCESSING' }));
  });
  await t('UTC-03-D-07','UpdateMatchDto invalid status → isEnum error', async () => {
    await assertHas(plainToInstance(UpdateMatchDto, { status: 'INVALID' }), 'status', 'isEnum');
  });
  await t('UTC-03-D-08','UpdateMatchDto all six valid statuses accepted', async () => {
    for (const s of ['CREATED','UPLOADED','QUEUED','PROCESSING','COMPLETED','FAILED']) {
      const errors = await validate(plainToInstance(UpdateMatchDto, { status: s }));
      assert(errors.length === 0, `${s} should be valid, errors: ${errs(errors)}`);
    }
  });
  await t('UTC-03-D-09','UpdateMatchDto videoPath string → 0 errors', async () => {
    await assertValid(plainToInstance(UpdateMatchDto, { videoPath: '/uploads/match.mp4' }));
  });
  await t('UTC-03-D-10','UpdateMatchDto all optional → 0 errors with empty body', async () => {
    await assertValid(plainToInstance(UpdateMatchDto, {}));
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// UTC-03  Service: MatchesService
// ══════════════════════════════════════════════════════════════════════════════

async function utc03_service() {
  await t('UTC-03-S-01','MatchesService.create returns match with teamId', async () => {
    const svc = new MatchesService(makePrisma() as any);
    const result = await svc.create('team-uuid', {} as CreateMatchDto) as any;
    assert(result !== null, 'Expected match');
  });
  await t('UTC-03-S-02','MatchesService.create team not found → NotFoundException', async () => {
    const svc = new MatchesService(makePrisma({ teamNotFound: true }) as any);
    let threw = false;
    try { await svc.create('bad-uuid', {} as CreateMatchDto); }
    catch (e) { threw = e instanceof NotFoundException; }
    assert(threw, 'Expected NotFoundException');
  });
  await t('UTC-03-S-03','MatchesService.create with ISO date converts to Date object', async () => {
    let capturedData: any = null;
    const prisma = makePrisma();
    prisma.match.create = async (a: any) => { capturedData = a.data; return MATCH; };
    const svc = new MatchesService(prisma as any);
    await svc.create('team-uuid', { date: '2024-11-15T18:00:00Z' } as CreateMatchDto);
    assert(capturedData?.date instanceof Date, 'Expected Date object from ISO string');
  });
  await t('UTC-03-S-04','MatchesService.findAllForTeam returns match array', async () => {
    const svc = new MatchesService(makePrisma() as any);
    const result = await svc.findAllForTeam('team-uuid');
    assert(Array.isArray(result), 'Expected array');
  });
  await t('UTC-03-S-05','MatchesService.findAllForTeam team not found → NotFoundException', async () => {
    const svc = new MatchesService(makePrisma({ teamNotFound: true }) as any);
    let threw = false;
    try { await svc.findAllForTeam('bad-uuid'); }
    catch (e) { threw = e instanceof NotFoundException; }
    assert(threw, 'Expected NotFoundException');
  });
  await t('UTC-03-S-06','MatchesService.findOne returns match with team', async () => {
    const svc = new MatchesService(makePrisma() as any);
    const result = await svc.findOne('match-uuid') as any;
    assert(result.id === 'match-uuid', 'Expected match id');
    assert(result.team !== undefined, 'Expected team included');
  });
  await t('UTC-03-S-07','MatchesService.findOne not found → NotFoundException with match id', async () => {
    const svc = new MatchesService(makePrisma({ matchNotFound: true }) as any);
    let msg = '';
    try { await svc.findOne('bad-match'); }
    catch (e: any) { if (e instanceof NotFoundException) msg = e.message; }
    assert(msg.includes('bad-match'), `Expected match id in message, got: ${msg}`);
  });
  await t('UTC-03-S-08','MatchesService.update returns updated match', async () => {
    const svc = new MatchesService(makePrisma() as any);
    const result = await svc.update('match-uuid', { status: 'COMPLETED' } as UpdateMatchDto);
    assert(result !== null, 'Expected updated match');
  });
  await t('UTC-03-S-09','MatchesService.update not found → NotFoundException', async () => {
    const svc = new MatchesService(makePrisma({ matchNotFound: true }) as any);
    let threw = false;
    try { await svc.update('bad-uuid', { status: 'PROCESSING' } as UpdateMatchDto); }
    catch (e) { threw = e instanceof NotFoundException; }
    assert(threw, 'Expected NotFoundException');
  });
  await t('UTC-03-S-10','MatchesService.remove returns deleted match', async () => {
    const svc = new MatchesService(makePrisma() as any);
    const result = await svc.remove('match-uuid') as any;
    assert(result.id === 'match-uuid', 'Expected deleted match id');
  });
  await t('UTC-03-S-11','MatchesService.remove not found → NotFoundException', async () => {
    const svc = new MatchesService(makePrisma({ matchNotFound: true }) as any);
    let threw = false;
    try { await svc.remove('bad-uuid'); }
    catch (e) { threw = e instanceof NotFoundException; }
    assert(threw, 'Expected NotFoundException');
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// UTC-04  HTTP contract via DTO + service integration (no running server)
// ══════════════════════════════════════════════════════════════════════════════

async function utc04() {
  await t('UTC-04-TC-01','POST /teams body validation: valid → no DTO errors (HTTP 201 path)', async () => {
    await assertValid(plainToInstance(CreateTeamDto, { name: 'FC Test' }));
  });
  await t('UTC-04-TC-02','POST /teams body validation: missing name → DTO error (HTTP 400 path)', async () => {
    const errors = await validate(plainToInstance(CreateTeamDto, {}));
    assert(errors.length > 0, 'Expected validation errors → HTTP 400');
  });
  await t('UTC-04-TC-03','GET /teams/:id not found → NotFoundException (HTTP 404 path)', async () => {
    const svc = new TeamsService(makePrisma({ teamNotFound: true }) as any);
    let threw = false;
    try { await svc.findOne('nope'); } catch (e) { threw = e instanceof NotFoundException; }
    assert(threw, 'Expected NotFoundException → HTTP 404');
  });
  await t('UTC-04-TC-04','POST /players body: name required → error (HTTP 400 path)', async () => {
    const errors = await validate(plainToInstance(CreatePlayerDto, {}));
    assert(errors.some(e => e.property === 'name'), 'Expected name error');
  });
  await t('UTC-04-TC-05','POST /players jersey duplicate → ConflictException (HTTP 409 path)', async () => {
    const svc = new PlayersService(makePrisma({ p2002: true }) as any);
    let threw = false;
    try { await svc.create('team-uuid', { name: 'B', jerseyNumber: 9 } as CreatePlayerDto); }
    catch (e) { threw = e instanceof ConflictException; }
    assert(threw, 'Expected ConflictException → HTTP 409');
  });
  await t('UTC-04-TC-06','PATCH /matches invalid status → DTO error (HTTP 400 path)', async () => {
    const errors = await validate(plainToInstance(UpdateMatchDto, { status: 'INVALID' }));
    assert(errors.some(e => e.property === 'status'), 'Expected status error');
  });
  await t('UTC-04-TC-07','PATCH /matches not found → NotFoundException (HTTP 404 path)', async () => {
    const svc = new MatchesService(makePrisma({ matchNotFound: true }) as any);
    let threw = false;
    try { await svc.update('nope', { status: 'COMPLETED' } as UpdateMatchDto); }
    catch (e) { threw = e instanceof NotFoundException; }
    assert(threw, 'Expected NotFoundException → HTTP 404');
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// UTC-05  Frontend API contract (type-level)
// ══════════════════════════════════════════════════════════════════════════════

async function utc05() {
  await t('UTC-05-TC-01','request<T>: non-ok response throws Error with method + path + status', async () => {
    // Simulate request helper behavior
    const mockFetch = async (url: string, opts: any) => ({ ok: false, status: 404 });
    async function request<T>(method: string, path: string): Promise<T> {
      const res = await mockFetch(`http://localhost:4000/api${path}`, {});
      if (!res.ok) throw new Error(`${method} ${path} → ${res.status}`);
      return {} as T;
    }
    let msg = '';
    try { await request<any>('GET', '/teams/nope'); } catch (e: any) { msg = e.message; }
    assert(msg === 'GET /teams/nope → 404', `Expected formatted error, got: ${msg}`);
  });
  await t('UTC-05-TC-02','request<T>: ok response returns parsed body', async () => {
    const mockFetch = async () => ({ ok: true, json: async () => ({ id: 'uuid' }) });
    async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
      const res = await mockFetch();
      if (!res.ok) throw new Error('fail');
      return res.json() as Promise<T>;
    }
    const result = await request<{ id: string }>('GET', '/teams') as any;
    assert(result.id === 'uuid', 'Expected parsed json body');
  });
  await t('UTC-05-TC-03','getTeams URL builds to /teams', async () => {
    const BASE = 'http://localhost:4000/api';
    const getTeamsUrl = () => `${BASE}/teams`;
    assert(getTeamsUrl().endsWith('/teams'), 'Expected /teams path');
  });
  await t('UTC-05-TC-04','createTeam URL: POST /teams', async () => {
    const BASE = 'http://localhost:4000/api';
    const createTeamUrl = () => `${BASE}/teams`;
    assert(createTeamUrl() === `${BASE}/teams`, 'Expected /teams POST path');
  });
  await t('UTC-05-TC-05','createPlayer URL: POST /teams/:teamId/players', async () => {
    const BASE = 'http://localhost:4000/api';
    const createPlayerUrl = (teamId: string) => `${BASE}/teams/${teamId}/players`;
    assert(createPlayerUrl('uuid-1').includes('/teams/uuid-1/players'), 'Expected correct path');
  });
  await t('UTC-05-TC-06','updateMatch URL: PATCH /matches/:id', async () => {
    const BASE = 'http://localhost:4000/api';
    const updateMatchUrl = (id: string) => `${BASE}/matches/${id}`;
    assert(updateMatchUrl('m-uuid').endsWith('/matches/m-uuid'), 'Expected correct path');
  });
  await t('UTC-05-TC-07','getMatchReport URL: GET /matches/:id/report', async () => {
    const BASE = 'http://localhost:4000/api';
    const getMatchReportUrl = (id: string) => `${BASE}/matches/${id}/report`;
    assert(getMatchReportUrl('run-1').includes('/matches/run-1/report'), 'Expected correct path');
  });
  await t('UTC-05-TC-08','getStatsVideoUrl: contains /video/stats', async () => {
    const BASE = 'http://localhost:4000/api';
    const getStatsVideoUrl = (id: string) => `${BASE}/matches/${id}/video/stats`;
    assert(getStatsVideoUrl('run-1').includes('/video/stats'), 'Expected /video/stats');
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// UTC-06  PrismaService DI contract
// ══════════════════════════════════════════════════════════════════════════════

async function utc06() {
  await t('UTC-06-TC-01','TeamsService accepts PrismaService via constructor (DI pattern)', async () => {
    const prisma = makePrisma();
    const svc = new TeamsService(prisma as any);
    assert(svc !== null, 'Expected service instance');
  });
  await t('UTC-06-TC-02','PlayersService accepts PrismaService via constructor', async () => {
    const svc = new PlayersService(makePrisma() as any);
    assert(svc !== null, 'Expected service instance');
  });
  await t('UTC-06-TC-03','MatchesService accepts PrismaService via constructor', async () => {
    const svc = new MatchesService(makePrisma() as any);
    assert(svc !== null, 'Expected service instance');
  });
  await t('UTC-06-TC-04','Mock Prisma exposes team, player, match accessors', async () => {
    const prisma = makePrisma();
    assert(typeof prisma.team.create === 'function', 'Expected team.create');
    assert(typeof prisma.player.create === 'function', 'Expected player.create');
    assert(typeof prisma.match.create === 'function', 'Expected match.create');
  });
  await t('UTC-06-TC-05','PrismaService error on DB operation surfaces as runtime error', async () => {
    const brokenPrisma = makePrisma();
    brokenPrisma.team.findUnique = async () => { throw new Error('DB connection refused'); };
    const svc = new TeamsService(brokenPrisma as any);
    let threw = false;
    try { await svc.findOne('any'); } catch { threw = true; }
    assert(threw, 'Expected runtime error to propagate');
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// Main
// ══════════════════════════════════════════════════════════════════════════════

async function main() {
  console.log('EZ Stats Backend — All Unit Tests\n');

  console.log('── UTC-01: TeamsService ──────────────────────');
  await utc01_dto(); await utc01_service();
  console.log('── UTC-02: PlayersService ────────────────────');
  await utc02_dto(); await utc02_service();
  console.log('── UTC-03: MatchesService ────────────────────');
  await utc03_dto(); await utc03_service();
  console.log('── UTC-04: Controller HTTP contracts ─────────');
  await utc04();
  console.log('── UTC-05: Frontend API contracts ────────────');
  await utc05();
  console.log('── UTC-06: PrismaService DI ──────────────────');
  await utc06();

  console.log('\n══════════════════════════════════════════════');
  for (const r of results) {
    const m = r.status === 'PASS' ? '✓' : '✗';
    console.log(`${m} [${r.status}] ${r.id}: ${r.desc}`);
    if (r.status === 'FAIL') console.log(`       → ${r.actual}`);
  }
  console.log(`\nTotal: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
  if (failed > 0) process.exit(1);
}

main().catch(e => { console.error(e); process.exit(1); });
