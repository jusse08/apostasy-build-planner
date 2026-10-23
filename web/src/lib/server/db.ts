import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import { newBuildState } from '#lib/rules/engine.ts';
import type { BuildRecord, BuildState, BuildSummary } from '#lib/types.ts';

// Builds live in one SQLite file; in the container it sits on a mounted volume.
const dbPath = process.env.DB_PATH ?? resolve(process.cwd(), 'builds.sqlite');

let db: DatabaseSync | null = null;

function open(): DatabaseSync {
	if (db) return db;
	mkdirSync(dirname(dbPath), { recursive: true });
	db = new DatabaseSync(dbPath);
	db.exec(`
		PRAGMA journal_mode = WAL;
		CREATE TABLE IF NOT EXISTS builds (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			state TEXT NOT NULL,
			data_version TEXT NOT NULL,
			created_at TEXT NOT NULL,
			updated_at TEXT NOT NULL
		);
	`);
	return db;
}

// Short readable ids for links: /b/k3x9p2
function newId(): string {
	const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
	const bytes = randomBytes(6);
	return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

interface Row {
	id: string;
	name: string;
	state: string;
	data_version: string;
	created_at: string;
	updated_at: string;
}

function toRecord(row: Row): BuildRecord {
	return {
		id: row.id,
		name: row.name,
		// Builds saved before a field existed get its default.
		state: { ...newBuildState(), ...JSON.parse(row.state) },
		dataVersion: row.data_version,
		createdAt: row.created_at,
		updatedAt: row.updated_at
	};
}

export function listBuilds(): BuildSummary[] {
	const rows = open().prepare('SELECT * FROM builds ORDER BY updated_at DESC').all() as unknown as Row[];
	return rows.map((r) => {
		const s = JSON.parse(r.state) as BuildState;
		return { id: r.id, name: r.name, race: s.race, class: s.class, targetLevel: s.targetLevel, updatedAt: r.updated_at };
	});
}

export function getBuild(id: string): BuildRecord | null {
	const row = open().prepare('SELECT * FROM builds WHERE id = ?').get(id) as unknown as Row | undefined;
	return row ? toRecord(row) : null;
}

export function createBuild(name: string, state: BuildState, dataVersion: string): BuildRecord {
	const now = new Date().toISOString();
	const id = newId();
	open()
		.prepare('INSERT INTO builds (id, name, state, data_version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
		.run(id, name, JSON.stringify(state), dataVersion, now, now);
	return getBuild(id)!;
}

export function updateBuild(id: string, name: string, state: BuildState, dataVersion: string): BuildRecord | null {
	const now = new Date().toISOString();
	const res = open()
		.prepare('UPDATE builds SET name = ?, state = ?, data_version = ?, updated_at = ? WHERE id = ?')
		.run(name, JSON.stringify(state), dataVersion, now, id);
	return res.changes ? getBuild(id) : null;
}

export function deleteBuild(id: string): boolean {
	return open().prepare('DELETE FROM builds WHERE id = ?').run(id).changes > 0;
}
