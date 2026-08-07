import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const migrationPath = fileURLToPath(
  new URL('../db/migrations/001_initial.sql', import.meta.url),
)
const migration = readFileSync(migrationPath, 'utf8')

const expectedTables = [
  'organizations',
  'campuses',
  'users',
  'sessions',
  'classes',
  'parent_students',
  'class_students',
  'courses',
  'schedules',
  'attendance',
  'leave_requests',
  'stored_files',
  'courseware',
  'courseware_attachments',
  'assignments',
  'assignment_attachments',
  'submissions',
  'submission_attachments',
  'student_feedback',
  'feedback_work_orders',
  'schedule_changes',
  'notifications',
  'audit_logs',
]

test('初始迁移包含公共实体', () => {
  for (const table of expectedTables) {
    assert.match(
      migration,
      new RegExp(`CREATE TABLE IF NOT EXISTS ${table} \\(`),
      `缺少数据表：${table}`,
    )
  }
})

test('跨端状态使用已确认的公共代码值', () => {
  assert.match(migration, /'PARENT',[\s\S]*'SYSTEM_ADMIN'/)
  assert.match(migration, /'SUBMITTED', 'GRADED', 'REVISION_REQUIRED'/)
  assert.match(migration, /'PENDING_PARENT', 'CONFIRMED', 'DISPUTED'/)
  assert.match(migration, /'OPEN', 'PROCESSING', 'CLOSED'/)
  assert.match(
    migration,
    /'PENDING',[\s\S]*'SUBSTITUTE_ASSIGNED',[\s\S]*'COMPLETED'/,
  )
})

test('作业附件和订正提交保留独立记录', () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS assignment_attachments/)
  assert.match(migration, /CREATE TABLE IF NOT EXISTS submission_attachments/)
  assert.match(migration, /attempt INTEGER NOT NULL DEFAULT 1/)
  assert.match(migration, /UNIQUE \(assignment_id, student_id, attempt\)/)
})

test('调课审批和代课使用一条流程记录', () => {
  assert.doesNotMatch(migration, /CREATE TABLE IF NOT EXISTS approvals/)
  assert.doesNotMatch(migration, /CREATE TABLE IF NOT EXISTS substitutes/)
  assert.match(migration, /reviewed_by INTEGER REFERENCES users\(id\)/)
  assert.match(migration, /substitute_teacher_id INTEGER REFERENCES users\(id\)/)
})

test('反馈与工单使用不同状态并保持一对一关联', () => {
  assert.match(
    migration,
    /feedback_id INTEGER NOT NULL UNIQUE REFERENCES student_feedback\(id\)/,
  )
  assert.match(migration, /parent_response TEXT NOT NULL DEFAULT ''/)
  assert.match(
    migration,
    /status <> 'CLOSED' OR \(result <> '' AND closed_at IS NOT NULL\)/,
  )
})
