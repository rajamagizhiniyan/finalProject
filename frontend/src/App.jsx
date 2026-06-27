import { useState, useEffect } from 'react'

const LANGUAGES = [
  'Auto-detect', 'Python', 'JavaScript', 'TypeScript', 'Java',
  'C', 'C++', 'C#', 'Go', 'Rust', 'Ruby', 'PHP', 'Swift', 'Kotlin', 'SQL', 'Other'
]

const EXAMPLES = {
  Python: `import sqlite3

def get_user(username, password):
    conn = sqlite3.connect('users.db')
    cur = conn.cursor()
    query = "SELECT * FROM users WHERE username = '" + username + "' AND password = '" + password + "'"
    cur.execute(query)
    user = cur.fetchone()
    conn.close()
    return user

def divide(a, b):
    result = a / b
    return result

passwords = ['secret123', 'hunter2', 'password']
for p in passwords:
    print(p)`,

  JavaScript: `async function fetchUserData(userId) {
  var data = await fetch('https://api.example.com/users/' + userId)
  var json = data.json()

  document.getElementById('user').innerHTML = json.bio

  if (json.role == 'admin') {
    grantAccess()
  }

  var result = []
  for (var i = 0; i < json.items.length; i++) {
    result.push(json.items[i].name)
  }
  return result
}`,
}

const VERDICT_COLOR = {
  excellent: '#3fb950',
  good: '#58a6ff',
  adequate: '#d29922',
  poor: '#f85149',
  unavailable: '#8b949e',
}

function ScoreRing({ score, size = 72, label }) {
  const cls = score >= 7 ? 'high' : score >= 4 ? 'mid' : 'low'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <div className={`score-ring ${cls}`} style={{ width: size, height: size, fontSize: size * 0.35 }}>
        {score}
      </div>
      {label && <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{label}</span>}
    </div>
  )
}

function SeverityBadge({ sev }) {
  const s = (sev || 'low').toLowerCase()
  return <span className={`sev-badge ${['high','medium','low'].includes(s) ? s : 'info'}`}>{s}</span>
}

function IssueCard({ item }) {
  const sev = item.severity || item.category || 'info'
  const cls = ['high','medium','low'].includes(sev.toLowerCase()) ? sev.toLowerCase() : 'info'
  return (
    <div className={`issue-card ${cls}`}>
      <div className="issue-meta">
        <SeverityBadge sev={sev} />
        {item.line && item.line !== 'N/A' && <span className="line-ref">Line {item.line}</span>}
        {item.category && <span className="line-ref">{item.category}</span>}
      </div>
      <div className="issue-desc">{item.description}</div>
      {item.suggestion && <div className="issue-suggest"><strong>Fix:</strong> {item.suggestion}</div>}
    </div>
  )
}

function RAGPanel({ docs }) {
  const [open, setOpen] = useState(false)
  if (!docs || docs.length === 0) return null
  return (
    <div className="rag-panel">
      <button className="rag-toggle" onClick={() => setOpen(o => !o)}>
        <span>📚 RAG Context — {docs.length} guideline{docs.length !== 1 ? 's' : ''} retrieved</span>
        <span>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="rag-body">
          {docs.map(d => (
            <div key={d.id} className="rag-doc">
              <span className="rag-title">{d.title}</span>
              <span className={`sev-badge info`} style={{ marginLeft: 8 }}>{d.category}</span>
              <span className="rag-score">relevance: {d.relevance_score}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function EvalPanel({ ev }) {
  if (!ev || ev.verdict === 'unavailable') return null
  const color = VERDICT_COLOR[ev.verdict] || '#8b949e'
  return (
    <div className="eval-panel">
      <div className="section-title">🧪 AI Self-Evaluation</div>
      <div className="eval-body">
        <div className="eval-scores">
          <ScoreRing score={ev.score} size={56} label="Overall" />
          <ScoreRing score={ev.completeness} size={56} label="Complete" />
          <ScoreRing score={ev.accuracy} size={56} label="Accurate" />
          <ScoreRing score={ev.actionability} size={56} label="Actionable" />
        </div>
        <div className="eval-verdict" style={{ borderColor: color, color }}>
          {ev.verdict.toUpperCase()} — {ev.summary}
        </div>
        {ev.missed_issues?.length > 0 && (
          <div className="eval-missed">
            <strong>Possibly missed:</strong> {ev.missed_issues.join(', ')}
          </div>
        )}
      </div>
    </div>
  )
}

function MetricsBar({ metrics }) {
  if (!metrics || metrics.total_reviews === 0) return null
  return (
    <div className="metrics-bar">
      <div className="metric-item">
        <span className="metric-val">{metrics.total_reviews}</span>
        <span className="metric-label">Reviews</span>
      </div>
      <div className="metric-item">
        <span className="metric-val">{metrics.avg_quality_score ?? '—'}</span>
        <span className="metric-label">Avg Score</span>
      </div>
      <div className="metric-item">
        <span className="metric-val">{metrics.avg_latency_ms ? `${(metrics.avg_latency_ms/1000).toFixed(1)}s` : '—'}</span>
        <span className="metric-label">Avg Latency</span>
      </div>
      <div className="metric-item">
        <span className="metric-val">{metrics.avg_bugs_per_review ?? '—'}</span>
        <span className="metric-label">Avg Bugs</span>
      </div>
      {metrics.top_languages?.[0] && (
        <div className="metric-item">
          <span className="metric-val">{metrics.top_languages[0].language}</span>
          <span className="metric-label">Top Language</span>
        </div>
      )}
    </div>
  )
}

function ResultPanel({ result, loading, error }) {
  if (loading) return (
    <div className="panel">
      <div className="empty-state">
        <div className="icon">⏳</div>
        <p>Running review pipeline…<br />RAG retrieval → AI review → Evaluation</p>
      </div>
    </div>
  )

  if (error) return (
    <div className="panel">
      <div className="panel-header">📋 Review Results</div>
      <div className="error-box">⚠️ {error}</div>
    </div>
  )

  if (!result) return (
    <div className="panel">
      <div className="empty-state">
        <div className="icon">🔍</div>
        <p>Paste your code on the left and click <strong>Review Code</strong> to run the full AI pipeline.</p>
      </div>
    </div>
  )

  const totalIssues = result.bugs.length + result.security.length + result.quality.length

  return (
    <div className="panel">
      <div className="panel-header">📋 Review Results — {result.language_detected}
        <span style={{ marginLeft: 'auto', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          {(result.latency_ms / 1000).toFixed(1)}s
        </span>
      </div>

      <div className="score-row">
        <ScoreRing score={result.score} />
        <div>
          <div className="score-summary">
            <strong>Quality Score: {result.score}/10</strong> · {totalIssues} issue{totalIssues !== 1 ? 's' : ''} found
          </div>
          <div className="score-summary" style={{ marginTop: 4 }}>{result.summary}</div>
        </div>
      </div>

      <RAGPanel docs={result.rag_documents} />

      {result.bugs.length > 0 && (
        <>
          <div className="section-title">🐛 Bugs <span className="badge-count">{result.bugs.length}</span></div>
          <div className="issue-list">{result.bugs.map((b, i) => <IssueCard key={i} item={b} />)}</div>
        </>
      )}

      {result.security.length > 0 && (
        <>
          <div className="section-title">🔒 Security <span className="badge-count">{result.security.length}</span></div>
          <div className="issue-list">{result.security.map((s, i) => <IssueCard key={i} item={s} />)}</div>
        </>
      )}

      {result.quality.length > 0 && (
        <>
          <div className="section-title">✨ Code Quality <span className="badge-count">{result.quality.length}</span></div>
          <div className="issue-list">{result.quality.map((q, i) => <IssueCard key={i} item={q} />)}</div>
        </>
      )}

      {result.positives?.length > 0 && (
        <>
          <div className="section-title">👍 Strengths</div>
          <div className="positives-list">
            {result.positives.map((p, i) => <div key={i} className="positive-item">{p}</div>)}
          </div>
        </>
      )}

      {result.refactored_snippet && (
        <>
          <div className="section-title">🔧 Suggested Fix</div>
          <div className="snippet-block">
            <div className="snippet-label">Refactored Snippet</div>
            <pre>{result.refactored_snippet}</pre>
          </div>
        </>
      )}

      <EvalPanel ev={result.evaluation} />
    </div>
  )
}

export default function App() {
  const [code, setCode] = useState('')
  const [language, setLanguage] = useState('Auto-detect')
  const [context, setContext] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [metrics, setMetrics] = useState(null)

  useEffect(() => {
    fetch('/api/metrics').then(r => r.json()).then(setMetrics).catch(() => {})
  }, [result])

  const charCount = code.length
  const charClass = charCount > 13000 ? 'danger' : charCount > 10000 ? 'warn' : ''

  async function handleReview() {
    if (!code.trim()) return
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch('/api/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, language, context }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.detail || `Server error ${res.status}`)
      }
      setResult(await res.json())
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  function loadExample() {
    const lang = language === 'Auto-detect' ? 'Python' : language
    const ex = EXAMPLES[lang] || EXAMPLES['Python']
    setCode(ex)
    if (language === 'Auto-detect') setLanguage('Python')
  }

  return (
    <>
      <header>
        <span style={{ fontSize: '1.4rem' }}>🔍</span>
        <h1>AI Code Review Assistant</h1>
        <span className="badge">Powered by Claude</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          <span title="Retrieval-Augmented Generation">📚 RAG</span>
          <span title="Structured AI output">🧩 Structured Output</span>
          <span title="LLM-as-judge evaluation">🧪 Evaluation</span>
          <span title="Observability logging">📊 Observability</span>
        </div>
      </header>

      <MetricsBar metrics={metrics} />

      <div className="main">
        <div className="panel">
          <div className="panel-header">📝 Your Code</div>
          <div className="panel-body">
            <label>Programming Language</label>
            <select value={language} onChange={e => setLanguage(e.target.value)}>
              {LANGUAGES.map(l => <option key={l}>{l}</option>)}
            </select>

            <label>Code</label>
            <textarea
              value={code}
              onChange={e => setCode(e.target.value)}
              placeholder="Paste your code here…"
              rows={18}
            />
            <div className={`char-count ${charClass}`}>{charCount.toLocaleString()} / 15,000</div>
            <button className="example-btn" onClick={loadExample}>
              Load example ({language === 'JavaScript' ? 'JavaScript' : 'Python'})
            </button>

            <label>Context (optional)</label>
            <textarea
              className="context-input"
              value={context}
              onChange={e => setContext(e.target.value)}
              placeholder="e.g. This is a REST API handler used in production…"
            />

            <button className="review-btn" onClick={handleReview} disabled={loading || !code.trim()}>
              {loading ? <><span className="spinner" />Analyzing…</> : '🚀 Review Code'}
            </button>

            <div className="pipeline-steps">
              <div className="pipeline-step">1. RAG retrieval</div>
              <div className="pipeline-arrow">→</div>
              <div className="pipeline-step">2. AI review</div>
              <div className="pipeline-arrow">→</div>
              <div className="pipeline-step">3. Evaluation</div>
              <div className="pipeline-arrow">→</div>
              <div className="pipeline-step">4. Log metrics</div>
            </div>
          </div>
        </div>

        <ResultPanel result={result} loading={loading} error={error} />
      </div>
    </>
  )
}
