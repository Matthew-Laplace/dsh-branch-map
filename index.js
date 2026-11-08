import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'

export const name = 'branch-map'
export const inject = ['webServer', 'sessionQuery']

const ROUTE = '/api/branch-map'
const MAX_BODY = 1024 * 1024
const ID_RE = /^[A-Za-z0-9_-]{1,160}$/
const MAX_TURNS = 2000

function dshHome() {
  const fromEnv = process.env.DSH_HOME?.trim()
  return fromEnv || join(homedir(), '.dsh')
}

function storageDir() {
  return join(dshHome(), 'plugins', 'branch-map')
}

function metaPath() {
  return join(storageDir(), 'meta.json')
}

function loadMeta() {
  try {
    const data = JSON.parse(readFileSync(metaPath(), 'utf8'))
    if (!data || typeof data !== 'object') return { version: 1, nodes: {} }
    if (!data.nodes || typeof data.nodes !== 'object') data.nodes = {}
    return data
  } catch {
    return { version: 1, nodes: {} }
  }
}

function saveMeta(data) {
  const dir = storageDir()
  mkdirSync(dir, { recursive: true })
  const tmp = join(dir, `.meta-${process.pid}-${Date.now()}.tmp`)
  writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
  renameSync(tmp, metaPath())
}

let writeChain = Promise.resolve()

function withMeta(mutate) {
  const run = writeChain.then(() => {
    const current = loadMeta()
    const next = mutate(current) ?? current
    next.version = 1
    if (!next.nodes) next.nodes = {}
    saveMeta(next)
    return next
  })
  writeChain = run.catch(() => undefined)
  return run
}

function textOf(blocks) {
  if (!Array.isArray(blocks)) return ''
  return blocks
    .map((block) => (block && block.type === 'text' ? String(block.text ?? '') : ''))
    .filter(Boolean)
    .join('')
}

function clip(text, limit) {
  const value = String(text ?? '').replace(/\s+/g, ' ').trim()
  return value.length > limit ? `${value.slice(0, limit)}…` : value
}

function turnsOf(events, inheritedEventCount = 0) {
  const turns = []
  let current = null
  const list =
    inheritedEventCount > 0
      ? events.filter((event) => typeof event?.seq === 'number' && event.seq >= inheritedEventCount)
      : events
  for (const event of list) {
    if (event?.type === 'user/message') {
      if (current) turns.push(current)
      const text = textOf(event.data?.content)
      current = {
        userSeq: event.seq,
        userText: clip(text, 180),
        assistantSeq: null,
        assistantText: '',
        steps: 0,
      }
      continue
    }
    if (event?.type === 'assistant/message') {
      if (!current) {
        current = { userSeq: null, userText: '', assistantSeq: null, assistantText: '', steps: 0 }
      }
      const text = textOf(event.data?.message?.content)
      if (text) {
        current.assistantText = clip(
          current.assistantText ? `${current.assistantText} ${text}` : text,
          240,
        )
      }
      current.assistantSeq = event.seq
      current.steps += 1
    }
  }
  if (current) turns.push(current)
  return turns.slice(-MAX_TURNS)
}

function collectFamily(trace) {
  const seen = new Set()
  const records = []
  const add = (record) => {
    const id = record?.header?.id
    if (!id || seen.has(id)) return
    seen.add(id)
    records.push(record)
  }
  add(trace.target)
  for (const ancestor of trace.ancestors ?? []) add(ancestor)
  const walk = (nodes) => {
    for (const node of nodes ?? []) {
      add(node.session)
      walk(node.descendants)
    }
  }
  walk(trace.descendants)
  return records.filter((record) => record?.header?.origin !== 'subagent')
}

function titleOf(result) {
  if (!result || result.status !== 'fulfilled') return ''
  const title = result.value?.title?.title
  return typeof title === 'string' ? title : ''
}

async function buildGraph(ctx, sessionId) {
  const trace = await ctx.sessionQuery.traceSession(sessionId)
  const meta = loadMeta()
  const metaNodes = meta.nodes ?? {}
  const metaParentOf = (id) => (typeof metaNodes[id]?.parentId === 'string' ? metaNodes[id].parentId : null)
  const metaChildren = new Map()
  for (const [id, node] of Object.entries(metaNodes)) {
    if (!node || typeof node.parentId !== 'string') continue
    if (!metaChildren.has(node.parentId)) metaChildren.set(node.parentId, [])
    metaChildren.get(node.parentId).push(id)
  }

  const records = collectFamily(trace)
  const byId = new Map(records.map((record) => [record.header.id, record]))
  if (!byId.has(sessionId) && trace.target) byId.set(sessionId, trace.target)

  // 插件创建的分支没有 header.parentSession，必须用 meta 关系补全家族。
  const minimalRecord = (id) => ({ header: { id, parentSession: null } })
  let changed = true
  while (changed) {
    changed = false
    for (const id of [...byId.keys()]) {
      const headerParent = byId.get(id)?.header?.parentSession
      const metaParent = metaParentOf(id)
      const parentId = headerParent || metaParent
      if (parentId && !byId.has(parentId)) {
        byId.set(parentId, minimalRecord(parentId))
        changed = true
      }
      for (const childId of metaChildren.get(id) ?? []) {
        if (!byId.has(childId)) {
          byId.set(childId, minimalRecord(childId))
          changed = true
        }
      }
    }
  }

  // 根：沿 header/meta 父链上溯到顶。
  let rootId = sessionId
  let guard = 0
  while (guard < 500) {
    const record = byId.get(rootId)
    const next = record?.header?.parentSession || metaParentOf(rootId)
    if (!next || !byId.has(next)) break
    rootId = next
    guard += 1
  }

  const ids = [...byId.keys()]
  const titleMap = new Map()
  try {
    const titles = await ctx.sessionQuery.readTitleSnapshots(ids)
    for (const result of titles ?? []) {
      if (result?.sessionId) titleMap.set(result.sessionId, titleOf(result))
    }
  } catch {
    // 标题只是显示信息，失败时退回会话 id。
  }

  const sessions = {}
  const order = []
  for (const id of ids) {
    const record = byId.get(id)
    const surface = await ctx.sessionQuery.readSurface(id).catch(() => null)
    if (!surface) continue
    const nodeMeta = metaNodes[id] ?? {}
    const headerParent = record?.header?.parentSession
    const metaParent = metaParentOf(id)
    const parentId =
      headerParent && byId.has(headerParent) ? headerParent : metaParent && byId.has(metaParent) ? metaParent : null
    const derived = Boolean(nodeMeta.derivedFrom)
    sessions[id] = {
      sessionId: id,
      parentId,
      forkSeq: Number.isFinite(nodeMeta.forkSeq) ? nodeMeta.forkSeq : null,
      label: typeof nodeMeta.label === 'string' ? nodeMeta.label : '',
      status: typeof nodeMeta.status === 'string' ? nodeMeta.status : 'open',
      conclusion: typeof nodeMeta.conclusion?.text === 'string' ? nodeMeta.conclusion : null,
      title: titleMap.get(id) || clip(id, 24),
      turns: turnsOf(surface?.events ?? [], derived ? 0 : surface?.inheritedEventCount ?? 0),
      inheritedEventCount: surface?.inheritedEventCount ?? 0,
      derived,
      isCurrent: id === sessionId,
    }
    order.push(id)
  }

  for (const id of order) {
    const session = sessions[id]
    if (session.parentId && !sessions[session.parentId]) session.parentId = null
  }
  if (!sessions[rootId]) {
    rootId = order[0] ?? sessionId
  }

  return { ok: true, current: sessionId, root: rootId, order, sessions }
}

function readNodeMeta(meta, sessionId) {
  meta.nodes ??= {}
  meta.nodes[sessionId] ??= {}
  return meta.nodes[sessionId]
}

function validateId(value, field) {
  if (typeof value !== 'string' || !ID_RE.test(value)) throw new Error(`${field} 无效`)
  return value
}


// ===== PHASE5_DERIVE_V1_START =====
// Phase 5：删除整轮 + 保留后续，Host 侧重建派生会话。
// 规则来源（均已核实）：tree-chat src/host/context.js compilePath（seed 重造参考）、
// dsh-session lib/index.js 的 seed/封套校验、真实 session.v4.jsonl 的字段形状。
// 关键约束：seed 的 seq 必须 0..n-1 连续；只有 surface 事件带 surfaceOp:'append'；
// 其它事件不得带 surfaceOp/sourceEventSeqs；tool/result 的 sourceEventSeqs 必须指向
// 新插入的 tool/call；turn 必须是 turn/start→step/start→…→step/end→turn/end。
const SURFACE_EVENT_TYPES = new Set([
  'system/message',
  'developer/message',
  'user/message',
  'assistant/message',
  'tool/result',
])

const SEED_ENVELOPE_KEYS = new Set([
  'type',
  'seq',
  'time',
  'data',
  'surfaceOp',
  'sourceEventSeqs',
  'ignorable',
])

const MAX_SEED_EVENTS = 120000

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

// 一轮 = 一个 turn/start 到对应 turn/end；缺 turn/end 的尾部轮记为 open。
function segmentTurns(events) {
  const turns = []
  let open = null
  for (const event of events) {
    if (event?.type === 'turn/start') {
      open = {
        ordinal: turns.length + 1,
        turn: Number(event.data?.turn ?? turns.length + 1),
        startSeq: event.seq,
        startTime: event.time,
        endSeq: null,
        endTime: null,
        open: true,
      }
      turns.push(open)
    } else if (event?.type === 'turn/end' && open) {
      open.endSeq = event.seq
      open.endTime = event.time
      open.open = false
      open = null
    }
  }
  let lastSeq = -1
  for (const event of events) {
    if (Number.isSafeInteger(event?.seq) && event.seq > lastSeq) lastSeq = event.seq
  }
  for (const turn of turns) {
    if (turn.endSeq === null) turn.endSeq = lastSeq
  }
  return turns
}

// 把 surfaceOp 折叠成当前模型可见顺序，同时保留每个节点对应的原始 seq。
function foldSessionSurface(events) {
  const nodes = []
  const origins = new Map()
  const anomalies = []
  for (const event of events) {
    const op = event?.surfaceOp
    if (op === 'append') {
      nodes.push(event.seq)
      origins.set(event.seq, new Set([event.seq]))
      continue
    }
    if (!isRecord(op)) continue
    const start = nodes.indexOf(op.startSeq)
    const end = nodes.indexOf(op.endSeq)
    if (start < 0 || end < start) {
      anomalies.push(event.seq)
      continue
    }
    const removed = nodes.slice(start, end + 1)
    const inherited = new Set()
    for (const seq of removed) {
      for (const origin of origins.get(seq) ?? []) inherited.add(origin)
      origins.delete(seq)
    }
    if (inherited.size === 0) inherited.add(event.seq)
    origins.set(event.seq, inherited)
    nodes.splice(start, removed.length, event.seq)
  }
  return { nodes, origins, anomalies }
}

// 纯函数：输入原始事件与轮次选择，输出可直接交给 ctx.agents.create 的 seed。
export function buildDeriveSeed(events, options = {}) {
  const errors = []
  const warnings = []
  const turns = segmentTurns(events)
  if (turns.length === 0) errors.push('源会话没有 turn/start，无法分轮')

  // 事件数组不保证 events[seq] 就是 seq 号事件：真实 session 日志首行是没有 seq 的
  // 会话头，调用方也可能把整份 JSONL 直接传进来。统一按 seq 建索引。
  const bySeq = new Map()
  for (const event of events) {
    if (!isRecord(event) || !Number.isSafeInteger(event.seq) || event.seq < 0) continue
    bySeq.set(event.seq, event)
  }
  let maxSeq = -1
  for (const seq of bySeq.keys()) if (seq > maxSeq) maxSeq = seq
  const turnOfSeq = new Int32Array(Math.max(maxSeq + 1, 1))
  for (const turn of turns) {
    const upper = Math.min(turn.endSeq, maxSeq)
    for (let seq = turn.startSeq; seq <= upper; seq += 1) turnOfSeq[seq] = turn.ordinal
  }

  const firstUserByTurn = new Map()
  for (const event of events) {
    const ordinal = turnOfSeq[event.seq] ?? 0
    if (ordinal > 0 && event.type === 'user/message' && !firstUserByTurn.has(ordinal)) {
      firstUserByTurn.set(ordinal, event)
    }
  }

  const { nodes, origins, anomalies } = foldSessionSurface(events)
  if (anomalies.length > 0) {
    warnings.push(`有 ${anomalies.length} 个 surface 替换区间不在当前可见面上，已跳过`)
  }

  const drop = new Set()
  const collect = (values, field) => {
    const result = new Set()
    for (const value of values) {
      if (!Number.isInteger(value) || value < 1 || value > turns.length) {
        errors.push(`${field} 含越界轮次：${String(value)}（共 ${turns.length} 轮）`)
        continue
      }
      result.add(value)
    }
    return result
  }
  if (Array.isArray(options.dropTurns)) {
    for (const ordinal of collect(options.dropTurns, 'dropTurns')) drop.add(ordinal)
  } else if (Array.isArray(options.keepTurns)) {
    const keep = collect(options.keepTurns, 'keepTurns')
    for (const turn of turns) if (!keep.has(turn.ordinal)) drop.add(turn.ordinal)
  } else {
    errors.push('需要 dropTurns 或 keepTurns')
  }

  const openTurns = turns.filter((turn) => turn.open).map((turn) => turn.ordinal)
  if (openTurns.length > 0) {
    warnings.push(`第 ${openTurns.join('、')} 轮还没有 turn/end（进行中），派生时整轮排除`)
  }
  for (const ordinal of drop) {
    if (turns[ordinal - 1]?.open) errors.push(`第 ${ordinal} 轮尚未结束，不能作为派生边界`)
  }
  const keptTurns = turns.filter((turn) => !drop.has(turn.ordinal) && !turn.open)
  if (keptTurns.length === 0) errors.push('保留轮次为空，派生没有意义')

  // 把可见面节点归到原始轮次：跨轮替换（上下文压缩摘要）归入最早保留轮。
  const firstAssistantSeq = events.find((event) => event?.type === 'assistant/message')?.seq ?? Infinity
  const baseline = []
  const grouped = new Map()
  for (const [index, seq] of nodes.entries()) {
    const event = bySeq.get(seq)
    if (!event) continue
    if ((event.type === 'system/message' || event.type === 'developer/message') && seq < firstAssistantSeq) {
      baseline.push({ event, index })
      continue
    }
    const ordinals = new Set()
    for (const origin of origins.get(seq) ?? [seq]) {
      const ordinal = turnOfSeq[origin] ?? 0
      if (ordinal > 0) ordinals.add(ordinal)
    }
    if (ordinals.size === 0) {
      baseline.push({ event, index })
      continue
    }
    const keptOrigins = [...ordinals].filter(
      (ordinal) => !drop.has(ordinal) && !turns[ordinal - 1]?.open,
    )
    if (keptOrigins.length === 0) continue
    if (ordinals.size > 1) {
      if (keptOrigins.length !== ordinals.size) {
        warnings.push(`跨轮摘要 seq ${seq} 覆盖了被删轮次，摘要正文仍含其内容`)
      }
      warnings.push(`跨轮上下文替换 seq ${seq} 归入最早保留轮 ${Math.min(...keptOrigins)}`)
    }
    const ordinal = Math.min(...keptOrigins)
    if (!grouped.has(ordinal)) grouped.set(ordinal, [])
    grouped.get(ordinal).push({ event, index })
  }

  const seed = []
  const append = (type, data, surface, time) => {
    const event = { type, data: structuredClone(data), seq: seed.length, time }
    if (surface) event.surfaceOp = 'append'
    seed.push(event)
    return event.seq
  }

  let turnNumber = 0
  let pending = new Map()
  const advertised = new Set()
  const firstTimed = [...bySeq.values()].find((event) => Number.isSafeInteger(event.time))
  let lastTime = firstTimed?.time ?? Date.now()

  const openTurn = (time) => {
    turnNumber += 1
    lastTime = Number.isSafeInteger(time) ? time : lastTime
    append('turn/start', { turn: turnNumber }, false, lastTime)
    append('step/start', { turn: turnNumber, step: 1 }, false, lastTime)
  }

  const closeTurn = (time) => {
    if (Number.isSafeInteger(time)) lastTime = time
    const unanswered = [...pending.keys()]
    if (unanswered.length > 0) {
      errors.push(`派生轮 ${turnNumber} 有未配对的工具调用：${unanswered.slice(0, 3).join('、')}`)
    }
    pending = new Map()
    append('step/end', { turn: turnNumber, step: 1 }, false, lastTime)
    append('turn/end', { turn: turnNumber, reason: { kind: 'completed' } }, false, lastTime)
  }

  const emitRows = (rows) => {
    for (const row of rows) {
      const event = row.event
      const data = structuredClone(event.data)
      const message = event.type === 'user/message' ? data : data?.message
      if (!isRecord(message) || !SURFACE_EVENT_TYPES.has(event.type)) continue
      if (isRecord(message.source) && Object.hasOwn(message.source, 'replayState')) {
        delete message.source.replayState
      }
      if (event.type !== 'user/message') {
        data.turn = turnNumber
        data.step = 1
      }
      if (event.type === 'developer/message' && data.headerSeq !== undefined) {
        const source = bySeq.get(data.headerSeq)
        if (!source || source.type !== 'request/header') {
          errors.push(`developer/message seq ${event.seq} 的 headerSeq 失效`)
          continue
        }
        data.headerSeq = append('request/header', source.data, false, source.time)
      }
      for (const block of message.content ?? []) {
        if (!isRecord(block) || block.type !== 'tool-call') continue
        if (advertised.has(block.id)) errors.push(`重复的工具调用 id：${String(block.id)}`)
        advertised.add(block.id)
        pending.set(block.id, block)
      }
      let callSeq
      if (message.role === 'tool') {
        const call = pending.get(message.toolCallId)
        if (!call) {
          errors.push(`工具结果 seq ${event.seq} 找不到配对的 tool/call`)
          continue
        }
        if (data.error?.code === 'TOOL_NOT_STARTED') {
          errors.push(`工具结果 seq ${event.seq} 是分叉占位结果，无法派生`)
          continue
        }
        pending.delete(message.toolCallId)
        callSeq = append(
          'tool/call',
          { turn: turnNumber, step: 1, callId: call.id, name: call.name, arguments: call.arguments },
          false,
          event.time,
        )
      }
      const seq = append(event.type, data, true, Number.isSafeInteger(event.time) ? event.time : lastTime)
      if (callSeq !== undefined) seed[seq].sourceEventSeqs = [callSeq]
      lastTime = seed[seq].time
    }
  }

  const headerEvent = [...events].reverse().find((event) => event?.type === 'request/header')
  const firstTurn = keptTurns[0]
  openTurn(firstTurn?.startTime)
  if (headerEvent) append('request/header', headerEvent.data, false, headerEvent.time)
  emitRows(baseline)
  if (firstTurn) {
    emitRows(grouped.get(firstTurn.ordinal) ?? [])
    closeTurn(firstTurn.endTime)
  } else {
    closeTurn(undefined)
  }
  for (const turn of keptTurns.slice(1)) {
    openTurn(turn.startTime)
    emitRows(grouped.get(turn.ordinal) ?? [])
    closeTurn(turn.endTime)
  }

  const keepEvent = (event) => {
    const ordinal = turnOfSeq[event.seq] ?? 0
    return ordinal === 0 || (!drop.has(ordinal) && !turns[ordinal - 1]?.open)
  }
  const stats = {
    totalEvents: events.length,
    keptEvents: events.filter(keepEvent).length,
    droppedEvents: events.filter((event) => !keepEvent(event)).length,
    totalTurns: turns.length,
    droppedTurns: [...drop].sort((a, b) => a - b),
    keptTurns: keptTurns.map((turn) => turn.ordinal),
    openTurns,
    seedEvents: seed.length,
    seedBytes: JSON.stringify(seed).length,
    seedTurns: turnNumber,
    turns: turns.map((turn) => {
      const firstUser = firstUserByTurn.get(turn.ordinal)
      return {
        ordinal: turn.ordinal,
        turn: turn.turn,
        closed: !turn.open,
        startSeq: turn.startSeq,
        endSeq: turn.endSeq,
        events: turn.endSeq - turn.startSeq + 1,
        kept: !drop.has(turn.ordinal) && !turn.open,
        label: firstUser ? clip(textOf(firstUser.data?.content), 80) : '',
      }
    }),
  }
  if (seed.length > MAX_SEED_EVENTS) errors.push(`seed 事件过多：${seed.length}`)
  return { seed, stats, errors, warnings }
}

// 本地镜像 dsh-session 的 seed 校验，供 dryRun 在真正创建前报告问题。
function validateDerivedSeed(seed) {
  const errors = []
  const calls = new Map()
  const results = new Set()
  const check = (condition, message) => {
    if (!condition) errors.push(message)
  }
  for (const [index, event] of seed.entries()) {
    if (!isRecord(event)) {
      errors.push(`seed[${index}] 不是对象`)
      continue
    }
    for (const key of Object.keys(event)) {
      check(SEED_ENVELOPE_KEYS.has(key), `seed[${index}] 含非法信封字段 ${key}`)
    }
    check(event.seq === index, `seed[${index}] seq 不连续（实际 ${String(event.seq)}）`)
    check(
      typeof event.type === 'string' && event.type.length > 0,
      `seed[${index}] 缺少事件类型`,
    )
    check(Number.isSafeInteger(event.time), `seed[${index}] time 不是整数`)
    check(event.data !== undefined, `seed[${index}] 缺少 data`)
    check(
      event.ignorable === undefined || event.ignorable === true,
      `seed[${index}] ignorable 只能是 true`,
    )
    const surface = SURFACE_EVENT_TYPES.has(event.type)
    if (surface) {
      check(event.surfaceOp === 'append', `seed[${index}] ${event.type} 必须带 surfaceOp:'append'`)
      const message = event.type === 'user/message' ? event.data : event.data?.message
      if (!isRecord(message)) {
        errors.push(`seed[${index}] ${event.type} 缺少 message`)
        continue
      }
      check(typeof message.id === 'string' && message.id !== '', `seed[${index}] message.id 无效`)
      check(Array.isArray(message.content), `seed[${index}] message.content 必须是数组`)
      check(
        isRecord(message.source) && typeof message.source.kind === 'string' && message.source.kind !== '',
        `seed[${index}] message.source 无效`,
      )
      const role = { 'system/message': 'system', 'developer/message': 'developer', 'user/message': 'user', 'assistant/message': 'assistant', 'tool/result': 'tool' }[event.type]
      check(message.role === role, `seed[${index}] ${event.type} 的 role 必须是 ${role}`)
      if (event.type === 'system/message') {
        check(message.source?.kind === 'system-prompt', `seed[${index}] system 消息来源必须是 system-prompt`)
      }
      if (event.type === 'assistant/message') {
        check(
          message.source?.kind === 'model' && typeof message.source.provider === 'string' && typeof message.source.model === 'string',
          `seed[${index}] assistant 消息必须是 model 来源`,
        )
        check(Number.isSafeInteger(event.data?.turn) && event.data.turn >= 0, `seed[${index}] assistant turn 无效`)
        check(Number.isSafeInteger(event.data?.step) && event.data.step >= 0, `seed[${index}] assistant step 无效`)
        check(Array.isArray(event.data?.stream), `seed[${index}] assistant stream 必须是数组`)
      }
      if (event.type === 'tool/result') {
        check(
          message.source?.kind === 'tool' && typeof message.source.callId === 'string' && message.source.callId !== '',
          `seed[${index}] tool/result 来源无效`,
        )
        check(message.toolCallId === message.source?.callId, `seed[${index}] tool/result callId 不一致`)
        check(
          event.data?.error === undefined || message.isError === true,
          `seed[${index}] tool/result 的 error 需要 isError:true`,
        )
        const refs = event.sourceEventSeqs
        check(Array.isArray(refs) && refs.length === 1, `seed[${index}] tool/result 需要一条 sourceEventSeqs`)
        if (Array.isArray(refs) && refs.length === 1) {
          const target = seed[refs[0]]
          check(
            target?.type === 'tool/call' && target.data?.callId === message.toolCallId,
            `seed[${index}] sourceEventSeqs 没有指向配对的 tool/call`,
          )
        }
        results.add(message.toolCallId)
      }
    } else {
      check(event.surfaceOp === undefined, `seed[${index}] ${event.type} 不得带 surfaceOp`)
      check(event.sourceEventSeqs === undefined, `seed[${index}] ${event.type} 不得带 sourceEventSeqs`)
    }
    if (event.type === 'tool/call') {
      check(typeof event.data?.callId === 'string' && event.data.callId !== '', `seed[${index}] tool/call 缺少 callId`)
      check(typeof event.data?.name === 'string' && event.data.name !== '', `seed[${index}] tool/call 缺少 name`)
      calls.set(event.data?.callId, index)
    }
    if (event.type === 'request/header') {
      const header = event.data?.header
      const config = header?.config
      check(isRecord(header) && isRecord(config), `seed[${index}] request/header 结构无效`)
      check(typeof config?.provider === 'string' && config.provider !== '', `seed[${index}] request/header 缺少 provider`)
      check(typeof config?.model === 'string' && config.model !== '', `seed[${index}] request/header 缺少 model`)
      check(header?.system === undefined, `seed[${index}] request/header 不得带 header.system`)
      check(!Array.isArray(header?.tools) || header.tools.length > 0, `seed[${index}] request/header 不得带空 tools`)
      check(
        !isRecord(header?.adapterDefaults) || Object.keys(header.adapterDefaults).length > 0,
        `seed[${index}] request/header 不得带空 adapterDefaults`,
      )
      check(
        ['initial', 'resume', 'change', 'series'].includes(event.data?.reason),
        `seed[${index}] request/header reason 无效`,
      )
    }
    if (event.type === 'developer/message') {
      const additions = (event.data?.message?.content ?? []).some(
        (block) => isRecord(block) && block.type === 'tool-addition',
      )
      if (additions) {
        const target = seed[event.data?.headerSeq]
        check(
          Number.isSafeInteger(event.data?.headerSeq) && target?.type === 'request/header',
          `seed[${index}] tool-addition 需要指向更早 request/header 的 headerSeq`,
        )
      } else {
        check(event.data?.headerSeq === undefined, `seed[${index}] 无 tool-addition 时不得带 headerSeq`)
      }
    }
  }
  for (const [callId, index] of calls) {
    check(results.has(callId), `tool/call seed[${index}] 没有配对结果`)
  }
  return errors
}

// 选一条可用的模型路由：最后一个 model/selection → 最后一个 request/header → 部署默认。
function deriveSelection(events, ctx) {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index]
    if (event?.type !== 'model/selection') continue
    const data = event.data
    if (isRecord(data) && typeof data.provider === 'string' && typeof data.model === 'string') {
      return {
        provider: data.provider,
        model: data.model,
        ...(typeof data.reasoningEffort === 'string' ? { reasoningEffort: data.reasoningEffort } : {}),
      }
    }
  }
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index]
    if (event?.type !== 'request/header') continue
    const config = event.data?.header?.config
    if (isRecord(config) && typeof config.provider === 'string' && typeof config.model === 'string') {
      return { provider: config.provider, model: config.model }
    }
  }
  try {
    const fallback = ctx.get?.('agentDefaultModel')?.currentSelection?.()
    if (isRecord(fallback) && typeof fallback.provider === 'string' && typeof fallback.model === 'string') {
      return { provider: fallback.provider, model: fallback.model }
    }
  } catch {
    // 没有默认模型服务时留给调用方报错。
  }
  return null
}

function turnOrdinalsForSeqs(events, wantedSeqs) {
  const ordinals = new Set()
  let ordinal = 0
  for (const event of events) {
    if (event?.type === 'turn/start') ordinal += 1
    if (ordinal > 0 && wantedSeqs.has(event?.seq)) ordinals.add(ordinal)
  }
  return [...ordinals].sort((a, b) => a - b)
}

async function deriveSession(ctx, input) {
  const sessionId = validateId(input.sessionId, 'sessionId')
  const dryRun = input.dryRun !== false
  const dropTurns = Array.isArray(input.dropTurns) ? input.dropTurns.map(Number) : undefined
  const keepTurns = Array.isArray(input.keepTurns) ? input.keepTurns.map(Number) : undefined
  const dropSeqs = Array.isArray(input.dropSeqs) ? input.dropSeqs.map(Number) : undefined
  if (dropTurns && keepTurns) throw new Error('dropTurns 与 keepTurns 只能给一个')
  if (!dropTurns && !keepTurns && !(dropSeqs && dropSeqs.length)) throw new Error('需要 dropTurns、keepTurns 或 dropSeqs')

  const data = await ctx.sessionQuery.readSession(sessionId)
  const events = Array.isArray(data?.events) ? data.events : []
  const header = isRecord(data?.session) ? data.session : {}
  let effectiveDropTurns = dropTurns
  if (!effectiveDropTurns && !keepTurns && dropSeqs && dropSeqs.length) {
    effectiveDropTurns = turnOrdinalsForSeqs(events, new Set(dropSeqs.filter(Number.isFinite)))
    if (effectiveDropTurns.length === 0) throw new Error('dropSeqs 没有匹配到任何轮次')
  }
  const built = buildDeriveSeed(events, { dropTurns: effectiveDropTurns, keepTurns })
  const errors = [...built.errors, ...validateDerivedSeed(built.seed)]
  const warnings = [...built.warnings]
  const selection = deriveSelection(events, ctx)
  const agents = ctx.get?.('agents')
  const presets = ctx.get?.('agentPresets')
  const canCreate = typeof agents?.create === 'function'
  const presetId = typeof header.agentPreset === 'string' ? header.agentPreset : null

  let preset = null
  if (presetId && typeof presets?.resolve === 'function') {
    try {
      const resolved = await presets.resolve(presetId)
      if (resolved?.broken === undefined) preset = resolved
      else warnings.push(`预设 ${presetId} 的声明不完整，派生会话不挂载预设`)
    } catch {
      warnings.push(`预设 ${presetId} 无法解析，派生会话不挂载预设`)
    }
  }

  const envelope = {
    ok: errors.length === 0,
    creatable: errors.length === 0 && canCreate && Boolean(selection),
    action: 'derive-session',
    dryRun,
    sessionId: null,
    sourceSessionId: sessionId,
    stats: built.stats,
    validation: { ok: errors.length === 0, errors, warnings },
    selection,
    agentPreset: preset ? preset.id : null,
    capabilities: {
      agents: canCreate,
      agentPresets: typeof presets?.mount === 'function',
      sessionPersistence: Boolean(ctx.get?.('sessionPersistence')),
    },
  }
  if (dryRun) {
    envelope.plan = {
      seedEvents: built.seed.length,
      inheritedEventCount: built.seed.length,
      meta: {
        parentSession: sessionId,
        isSeeded: true,
        ...(typeof header.cwd === 'string' ? { cwd: header.cwd } : {}),
        ...(preset ? { agentPreset: preset.id } : {}),
      },
    }
    return envelope
  }
  if (errors.length > 0) throw new Error(`派生校验失败：${errors.slice(0, 3).join('；')}`)
  if (!canCreate) throw new Error('派生会话需要 agents 服务（dsh-agent + dsh-agent-loop），当前 profile 没有提供')
  if (!selection) throw new Error('无法确定派生会话的模型路由：源会话没有 model/selection 或 request/header')

  const newId = `session-${randomUUID()}`
  const title = clip(String(input.label ?? '').trim() || `派生：${clip(sessionId, 32)}`, 80)
  const firstUserSeq = built.seed.findIndex((event) => event.type === 'user/message')
  const agentOptions = {
    provider: selection.provider,
    model: selection.model,
    ...(selection.reasoningEffort ? { reasoningEffort: selection.reasoningEffort } : {}),
  }
  let handle
  try {
    handle = await agents.create({
      sessionId: newId,
      seed: built.seed,
      inheritedEventCount: built.seed.length,
      meta: {
        parentSession: sessionId,
        isSeeded: true,
        ...(typeof header.cwd === 'string' ? { cwd: header.cwd } : {}),
        ...(preset ? { agentPreset: preset.id } : {}),
      },
      agentOptions,
      setup: async (agentCtx, agent) => {
        if (preset && typeof presets?.mount === 'function') await presets.mount(agentCtx, preset.id)
        agent.session.append('model/selection', agentOptions)
        agent.session.append('session/title', {
          title,
          messageSeqs: firstUserSeq >= 0 ? [firstUserSeq] : [],
          source: { kind: 'user' },
        })
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`派生会话创建失败：${message}`)
  }

  await withMeta((meta) => {
    const node = readNodeMeta(meta, newId)
    node.parentId = sessionId
    node.label = title
    node.status = 'open'
    node.derivedFrom = { sessionId, droppedTurns: built.stats.droppedTurns, at: Date.now() }
    node.updatedAt = Date.now()
    return meta
  })

  return {
    ...envelope,
    ok: true,
    sessionId: newId,
    inheritedEventCount: handle?.agent?.session?.inheritedEventCount ?? built.seed.length,
    seedEvents: built.seed.length,
  }
}
// ===== PHASE5_DERIVE_V1_END =====

async function handleAction(ctx, input) {
  const action = String(input?.action ?? '')
  if (action === 'health') {
    return {
      ok: true,
      host: 'branch-map',
      build: 4,
      canReadMetaBranches: true,
      canDeriveSession: true,
    }
  }
  if (action === 'graph') {
    return buildGraph(ctx, validateId(input.sessionId, 'sessionId'))
  }
  if (action === 'set-meta') {
    const sessionId = validateId(input.sessionId, 'sessionId')
    const parentId = input.parentId == null ? null : validateId(input.parentId, 'parentId')
    const forkSeq = input.forkSeq == null ? null : Number(input.forkSeq)
    if (forkSeq !== null && !Number.isFinite(forkSeq)) throw new Error('forkSeq 无效')
    const label = String(input.label ?? '').slice(0, 80)
    await withMeta((meta) => {
      const node = readNodeMeta(meta, sessionId)
      node.parentId = parentId
      node.forkSeq = forkSeq
      node.label = label
      node.updatedAt = Date.now()
      return meta
    })
    return { ok: true, sessionId }
  }
  if (action === 'save-conclusion') {
    const sessionId = validateId(input.sessionId, 'sessionId')
    const text = String(input.text ?? '').slice(0, 8000)
    if (!text.trim()) throw new Error('结论不能为空')
    await withMeta((meta) => {
      const node = readNodeMeta(meta, sessionId)
      node.status = 'concluded'
      node.conclusion = { text, at: Date.now() }
      node.updatedAt = Date.now()
      return meta
    })
    return { ok: true, sessionId }
  }
  if (action === 'mark-returned') {
    const sessionId = validateId(input.sessionId, 'sessionId')
    await withMeta((meta) => {
      const node = readNodeMeta(meta, sessionId)
      node.status = 'returned'
      node.returnedAt = Date.now()
      node.updatedAt = Date.now()
      return meta
    })
    return { ok: true, sessionId }
  }
  if (action === 'clear-conclusion') {
    const sessionId = validateId(input.sessionId, 'sessionId')
    await withMeta((meta) => {
      const node = readNodeMeta(meta, sessionId)
      delete node.conclusion
      node.status = 'open'
      node.updatedAt = Date.now()
      return meta
    })
    return { ok: true, sessionId }
  }
  if (action === 'derive-session') {
    return deriveSession(ctx, input)
  }
  throw new Error(`未知操作：${action || '(空)'}`)
}

function readJsonBody(req) {
  return new Promise((resolvePromise, rejectPromise) => {
    const chunks = []
    let size = 0
    let tooLarge = false
    req.on('data', (chunk) => {
      if (tooLarge) return
      size += chunk.length
      if (size > MAX_BODY) {
        tooLarge = true
        chunks.length = 0
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      if (tooLarge) {
        rejectPromise(Object.assign(new Error('请求体过大'), { status: 413 }))
        return
      }
      try {
        const raw = Buffer.concat(chunks).toString('utf8')
        resolvePromise(raw.trim() ? JSON.parse(raw) : {})
      } catch {
        rejectPromise(Object.assign(new Error('请求不是合法 JSON'), { status: 400 }))
      }
    })
    req.on('error', () => rejectPromise(new Error('读取请求失败')))
  })
}

export function apply(ctx) {
  const handler = async (req, res) => {
    try {
      if (req.method !== 'POST') {
        res.writeHead(405, { 'content-type': 'application/json; charset=utf-8' })
        res.end(JSON.stringify({ error: '只接受 POST' }))
        return
      }
      const input = await readJsonBody(req)
      const result = await handleAction(ctx, input)
      res.writeHead(200, {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
      })
      res.end(JSON.stringify(result))
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (ctx.logger?.warn) ctx.logger.warn(`branch-map: ${message}`)
      const status = Number.isInteger(error?.status) ? error.status : 400
      res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
      res.end(JSON.stringify({ error: message }))
    }
  }

  ctx.effect(() =>
    ctx.webServer.register({
      kind: 'prefix',
      path: ROUTE,
      handler,
    }),
  )
}
