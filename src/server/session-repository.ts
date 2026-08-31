import { SqliteSaver } from '@langchain/langgraph-checkpoint-sqlite'
import Database from 'better-sqlite3'

export interface Session {
  id: string
  thread_id: string
  title: string
  created_at: number
  updated_at: number
}

export interface SessionRecord {
  id: string
  threadId: string
  title: string
  createdAt: number
  updatedAt: number
}

const db = new Database('./data/langgraph.sqlite')

export const checkpointer = new SqliteSaver(db)

function toSessionRecord(row: Session): SessionRecord {
  return {
    id: row.id,
    threadId: row.thread_id,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export function listSessions() {
  const rows = db
    .prepare('SELECT id, thread_id, title, created_at, updated_at FROM session ORDER BY updated_at DESC, created_at DESC')
    .all() as Session[]
  return rows.map(toSessionRecord)
}

export function getSession(sessionId: string) {
  const row = db
    .prepare('SELECT id, thread_id, title, created_at, updated_at FROM session WHERE id = ?')
    .get(sessionId) as Session | undefined
  return row ? toSessionRecord(row) : undefined
}

export function insertSession(id: string, title: string, now: number) {
  db.prepare(
    'INSERT INTO session (id, thread_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
  ).run(id, id, title, now, now)
}

export function updateSessionTitle(sessionId: string, title: string, now: number) {
  db.prepare('UPDATE session SET title = ?, updated_at = ? WHERE id = ?').run(title, now, sessionId)
}

export function touchSession(sessionId: string, title: string | undefined, now: number) {
  if (title) {
    db.prepare("UPDATE session SET title = CASE WHEN title = '新建对话' THEN ? ELSE title END, updated_at = ? WHERE id = ?")
      .run(title, now, sessionId)
    return
  }
  db.prepare('UPDATE session SET updated_at = ? WHERE id = ?').run(now, sessionId)
}

export async function deleteSessionData(sessionId: string) {
  const checkpointTables = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('checkpoints', 'writes')")
    .all() as Array<{ name: string }>
  if (checkpointTables.length === 2) await checkpointer.deleteThread(sessionId)

  const result = db.prepare('DELETE FROM session WHERE id = ?').run(sessionId)
  if (result.changes === 0) throw new Error('会话不存在或已过期，请新建对话')
}
