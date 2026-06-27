import { useState } from 'react'

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

function ScoreRing({ score }) {
  const cls = score >= 7 ? 'high' : score >= 4 ? 'mid' : 'low'
  return <div className={`score-ring ${cls}`}>{score}</div>
}

function SeverityBadge({ sev }) {
  const s = (sev || 'low').toLowerCase()
  return <span className={`sev-badge ${s}`}>{s}</span>
}

function IssueCard({ item, type }) {
  const sev = item.severity || item.category || 'info'
  const cls = ['high','medium','low'].includes(sev.toLowerCase()) ? sev.toLowerCase() : 'info'
  return (
    <div className={`issue-card ${cls}`}>
      <div className="issue-meta">
        <SeverityBadge sev={sev} />
        {item.line && item.line !== 'N/A' && (
          <span className="line-ref">Line {item.line}</span>
        )}
        {item.category && <span className="line-ref">{item.category}</span>}
      </div>
      <div className="issue-desc">{item.description}</div>
      {item.suggestion && (
        <div className="issue-suggest"><strong>Fix:</strong> {item.suggestion}</div>
      )}
    </div>
  )
}

function ResultPanel({ result, loading, error }) {
  if (loading) {
    return (
      <div className="panel">
        <div className="empty-state">
          <div className="icon">⏳</div>
          <p>Analyzing your code with AI…<br />This usually takes 5–10 seconds.</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="panel">
        <div className="panel-header">📋 Review Results</div>
        <div className="error-box">⚠️ {error}</div>
      </div>
    )
  }

  if (!result) {
    return (
      <div className="panel">
        <div className="empty-state">
          <div className="icon">🔍</div>
          <p>Paste your code on the left and click <strong>Review Code</strong> to get an AI-powered analysis.</p>
        </div>
      </div>
    )
  }

  const totalIssues = result.bugs.length + result.security.length + result.quality.length

  return (
    <div className="panel">
      <div className="panel-header">📋 Review Results — {result.language_detected}</div>

      <div className="score-row">
        <ScoreRing score={result.score} />
        <div>
          <div className="score-summary">
            <strong>Quality Score: {result.score}/10</strong> · {totalIssues} issue{totalIssues !== 1 ? 's' : ''} found
          </div>
          <div className="score-summary" style={{marginTop: 4}}>{result.summary}</div>
        </div>
      </div>

      {result.bugs.length > 0 && (
        <>
          <div className="section-title">
            🐛 Bugs <span className="badge-count">{result.bugs.length}</span>
          </div>
          <div className="issue-list">
            {result.bugs.map((b, i) => <IssueCard key={i} item={b} type="bug" />)}
          </div>
        </>
      )}

      {result.security.length > 0 && (
        <>
          <div className="section-title">
            🔒 Security <span className="badge-count">{result.security.length}</span>
          </div>
          <div className="issue-list">
            {result.security.map((s, i) => <IssueCard key={i} item={s} type="security" />)}
          </div>
        </>
      )}

      {result.quality.length > 0 && (
        <>
          <div className="section-title">
            ✨ Code Quality <span className="badge-count">{result.quality.length}</span>
          </div>
          <div className="issue-list">
            {result.quality.map((q, i) => <IssueCard key={i} item={q} type="quality" />)}
          </div>
        </>
      )}

      {result.positives.length > 0 && (
        <>
          <div className="section-title">👍 Strengths</div>
          <div className="positives-list">
            {result.positives.map((p, i) => (
              <div key={i} className="positive-item">{p}</div>
            ))}
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

      const data = await res.json()
      setResult(data)
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
        <span style={{fontSize:'1.4rem'}}>🔍</span>
        <h1>AI Code Review Assistant</h1>
        <span className="badge">Powered by Claude</span>
      </header>

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
              Load example ({language === 'Auto-detect' ? 'Python' : language === 'JavaScript' ? 'JavaScript' : 'Python'})
            </button>

            <label>Context (optional)</label>
            <textarea
              className="context-input"
              value={context}
              onChange={e => setContext(e.target.value)}
              placeholder="e.g. This is a REST API handler used in production…"
            />

            <button
              className="review-btn"
              onClick={handleReview}
              disabled={loading || !code.trim()}
            >
              {loading ? <><span className="spinner"/>Analyzing…</> : '🚀 Review Code'}
            </button>
          </div>
        </div>

        <ResultPanel result={result} loading={loading} error={error} />
      </div>
    </>
  )
}
