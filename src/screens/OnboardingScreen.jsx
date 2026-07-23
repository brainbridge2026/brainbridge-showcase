import { useEffect, useState } from 'react'
import PhoneFrame from '../components/PhoneFrame'
import { styles, COLORS } from '../theme'
import { texts } from '../texts'
import { getAgeTier } from '../utils/ageTier'
import {
  getFamilyMembers,
  addFamilyMember,
  updateOnboarding,
  updateSelfProfile,
} from '../utils/inviteToken'

// [Sprint 17 · C-16] 주양육자 온보딩 4화면 (온보딩설계_v2 §1·§2·§2-A·§4).
//  주양육자만 진입(라우터가 보장). onboarding_step 저장으로 중간 이탈 후 재개(A-4).
//  자녀 추가 시 직접/대리 질문 + tier1 "직접" 비활성(A-5, §2-A).
//  props: token, session, initialStep, onComplete
export default function OnboardingScreen({ token, session, initialStep = 1, onComplete }) {
  const [step, setStep] = useState(Math.min(4, Math.max(1, initialStep)))
  const [busy, setBusy] = useState(false)

  // 1화면 — 본인 프로필
  const [sex, setSex] = useState(null)
  const [diagnosis, setDiagnosis] = useState(null)

  // 2화면 — 구성원
  const [members, setMembers] = useState([])
  const [adding, setAdding] = useState(false)

  // 3화면 — 반복 순간(클라이언트 상태, 홈 개인화용)
  const [moments, setMoments] = useState([])

  useEffect(() => {
    let alive = true
    getFamilyMembers(token).then((r) => { if (alive && r.ok) setMembers(r.data || []) })
    return () => { alive = false }
  }, [token])

  // 다음 단계로 이동하며 진행 상태 저장(A-4 재개 지점).
  const goStep = async (n) => {
    setBusy(true)
    await updateOnboarding(token, 'in_progress', n)
    setBusy(false)
    setStep(n)
  }

  const refreshMembers = async () => {
    const r = await getFamilyMembers(token)
    if (r.ok) setMembers(r.data || [])
  }

  const finish = async () => {
    setBusy(true)
    await updateOnboarding(token, 'completed', 4)
    setBusy(false)
    onComplete?.()
  }

  const t = texts.onboarding

  return (
    <PhoneFrame align="top">
      <div style={{ ...styles.subText, fontSize: '13px', marginBottom: '4px' }}>{t.stepLabel(step)}</div>

      {step === 1 && (
        <Step1
          name={session?.memberName || ''}
          sex={sex} setSex={setSex}
          diagnosis={diagnosis} setDiagnosis={setDiagnosis}
          busy={busy}
          onNext={async () => {
            setBusy(true)
            await updateSelfProfile(token, { sex, receivedDiagnosis: diagnosis })
            setBusy(false)
            goStep(2)
          }}
        />
      )}

      {step === 2 && (
        <Step2
          token={token}
          members={members}
          adding={adding} setAdding={setAdding}
          onAdded={refreshMembers}
          busy={busy}
          onNext={() => goStep(3)}
        />
      )}

      {step === 3 && (
        <Step3 moments={moments} setMoments={setMoments} busy={busy} onNext={() => goStep(4)} />
      )}

      {step === 4 && (
        <Step4 members={members} busy={busy} onDone={finish} />
      )}
    </PhoneFrame>
  )
}

// ── 공용 소품 ────────────────────────────────────────────────
function ChipSelect({ options, value, onPick }) {
  return (
    <div style={styles.chipGroup}>
      {options.map((o) => {
        const selected = value === o.value
        return (
          <button key={o.value} onClick={() => onPick(selected ? null : o.value)}
            style={{ ...styles.chip, ...(selected ? styles.chipSelected : {}) }}>
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

// ── 1화면 ────────────────────────────────────────────────────
function Step1({ name, sex, setSex, diagnosis, setDiagnosis, busy, onNext }) {
  const t = texts.onboarding.step1
  return (
    <div>
      <h1 style={styles.question}>{t.title(name)}</h1>
      <p style={{ ...styles.subText, marginTop: '10px' }}>{t.sub}</p>

      <p style={styles.subQuestion}>{t.sexQ}</p>
      <ChipSelect options={t.sexOptions} value={sex} onPick={setSex} />

      <p style={styles.subQuestion}>{t.diagnosisQ}</p>
      <ChipSelect options={t.diagnosisOptions} value={diagnosis} onPick={setDiagnosis} />
      <p style={{ ...styles.subText, fontSize: '13px', marginTop: '10px' }}>{t.diagnosisNote}</p>

      <div style={styles.footer}>
        <button style={styles.primaryButton} disabled={busy} onClick={onNext}>
          {texts.onboarding.next}
        </button>
      </div>
    </div>
  )
}

// ── 2화면 ────────────────────────────────────────────────────
function Step2({ token, members, adding, setAdding, onAdded, busy, onNext }) {
  const t = texts.onboarding.step2
  return (
    <div>
      <h1 style={styles.question}>{t.title}</h1>
      <p style={{ ...styles.subText, marginTop: '10px' }}>{t.sub}</p>

      {/* 더해진 구성원 목록 */}
      <div style={{ marginTop: '16px' }}>
        {members.length === 0 && !adding && (
          <p style={{ ...styles.subText, fontSize: '14px' }}>{t.empty}</p>
        )}
        {members.map((m) => (
          <div key={m.member_id} style={{ ...styles.infoCard, marginBottom: '10px' }}>
            <div style={styles.memberRow}>
              <span style={styles.memberName}>{m.name}</span>
              <span style={styles.relationChip}>{roleLabel(m.role)}</span>
              {m.invite_ready && (
                <span style={{ ...styles.subText, fontSize: '12px', marginLeft: 'auto', color: COLORS.primary }}>
                  {t.inviteReady}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {adding ? (
        <AddMemberForm token={token} onCancel={() => setAdding(false)}
          onSaved={async () => { await onAdded(); setAdding(false) }} />
      ) : (
        <button style={{ ...styles.choiceButton, marginTop: '12px' }} onClick={() => setAdding(true)}>
          {t.addButton}
        </button>
      )}

      {!adding && (
        <div style={styles.footer}>
          <button style={styles.primaryButton} disabled={busy} onClick={onNext}>
            {texts.onboarding.next}
          </button>
        </div>
      )}
    </div>
  )
}

function roleLabel(role) {
  return role === 'partner' ? '배우자' : role === 'child' ? '자녀' : '주양육자'
}

function AddMemberForm({ token, onCancel, onSaved }) {
  const t = texts.onboarding.step2
  const [name, setName] = useState('')
  const [role, setRole] = useState(null)
  const [age, setAge] = useState('')
  const [childDirectUse, setChildDirectUse] = useState(null)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState(false)

  const isChild = role === 'child'
  const ageNum = Number(age)
  const hasAge = isChild && Number.isFinite(ageNum) && age !== ''
  const tier1 = hasAge && getAgeTier(ageNum) === 'tier1' // 5~7세 → "직접" 비활성

  // 저장 가능: 이름 + 역할 필수. 자녀면 나이 + 직접/대리 선택 필수.
  const canSave =
    name.trim() && role && (!isChild || (hasAge && childDirectUse !== null))

  const save = async () => {
    setSaving(true); setErr(false)
    const r = await addFamilyMember(token, {
      name: name.trim(),
      role,
      age: isChild ? ageNum : null,
      childDirectUse: isChild ? childDirectUse : null,
    })
    setSaving(false)
    if (r.ok) onSaved()
    else setErr(true)
  }

  const childName = name.trim() || '아이'

  return (
    <div style={{ ...styles.infoCard, marginTop: '12px' }}>
      <p style={{ ...styles.infoTitle }}>{t.nameLabel}</p>
      <input style={styles.textInput} value={name} placeholder={t.namePlaceholder}
        onChange={(e) => setName(e.target.value)} />

      <p style={{ ...styles.subQuestion, marginTop: '18px' }}>{t.roleQ}</p>
      <ChipSelect options={t.roleOptions} value={role}
        onPick={(v) => { setRole(v); setChildDirectUse(null) }} />

      {isChild && (
        <>
          <p style={{ ...styles.infoTitle, marginTop: '18px' }}>{t.ageLabel}</p>
          <input style={styles.textInput} value={age} placeholder={t.agePlaceholder}
            inputMode="numeric" onChange={(e) => setAge(e.target.value.replace(/[^0-9]/g, ''))} />

          {hasAge && (
            <>
              <p style={{ ...styles.subQuestion }}>{t.childUseTitle(childName)}</p>
              <p style={{ ...styles.subText, fontSize: '14px', whiteSpace: 'pre-line' }}>
                {t.childUseBody(childName)}
              </p>
              {/* 직접 (tier1이면 비활성) */}
              <button
                disabled={tier1}
                onClick={() => !tier1 && setChildDirectUse(true)}
                style={{
                  ...styles.choiceButton, textAlign: 'left', marginTop: '12px',
                  ...(childDirectUse === true ? styles.choiceButtonSelected : {}),
                  ...(tier1 ? { opacity: 0.5, cursor: 'not-allowed' } : {}),
                }}>
                <div style={{ fontWeight: 700 }}>{t.childDirect.title(childName)}</div>
                <div style={{ ...styles.subText, fontSize: '13px', marginTop: '4px' }}>
                  {tier1 ? t.childDirectDisabledNote : t.childDirect.body(childName)}
                </div>
              </button>
              {/* 대리 */}
              <button
                onClick={() => setChildDirectUse(false)}
                style={{
                  ...styles.choiceButton, textAlign: 'left', marginTop: '10px',
                  ...(childDirectUse === false ? styles.choiceButtonSelected : {}),
                }}>
                <div style={{ fontWeight: 700 }}>{t.childProxy.title}</div>
                <div style={{ ...styles.subText, fontSize: '13px', marginTop: '4px' }}>
                  {t.childProxy.body(childName)}
                </div>
              </button>
              <p style={{ ...styles.subText, fontSize: '12px', marginTop: '10px' }}>
                {t.childUseChangeNote}
              </p>
            </>
          )}
        </>
      )}

      {err && (
        <p style={{ ...styles.subText, fontSize: '13px', color: '#B4651E', marginTop: '10px' }}>
          다시 시도해 주세요.
        </p>
      )}

      <div style={{ ...styles.footer, marginTop: '18px' }}>
        <button style={{ ...styles.primaryButton, ...(canSave ? {} : styles.primaryButtonDisabled) }}
          disabled={!canSave || saving} onClick={save}>
          {t.saveMember}
        </button>
        <button style={styles.textButton} onClick={onCancel}>{t.cancel}</button>
      </div>
    </div>
  )
}

// ── 3화면 ────────────────────────────────────────────────────
function Step3({ moments, setMoments, busy, onNext }) {
  const t = texts.onboarding.step3
  const toggle = (m) =>
    setMoments((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]))
  return (
    <div>
      <h1 style={styles.question}>{t.title}</h1>
      <p style={{ ...styles.subText, marginTop: '10px' }}>{t.sub}</p>
      <div style={styles.chipGroup}>
        {t.options.map((m) => (
          <button key={m} onClick={() => toggle(m)}
            style={{ ...styles.chip, ...(moments.includes(m) ? styles.chipSelected : {}) }}>
            {m}
          </button>
        ))}
      </div>
      <div style={styles.footer}>
        <button style={styles.primaryButton} disabled={busy} onClick={onNext}>
          {texts.onboarding.next}
        </button>
      </div>
    </div>
  )
}

// ── 4화면 ────────────────────────────────────────────────────
function Step4({ members, busy, onDone }) {
  const t = texts.onboarding.step4
  return (
    <div>
      <h1 style={styles.question}>{t.title}</h1>
      <p style={{ ...styles.subText, marginTop: '10px' }}>{t.body}</p>

      <p style={styles.subQuestion}>{t.membersLabel}</p>
      {members.length === 0 ? (
        <p style={{ ...styles.subText, fontSize: '14px' }}>{t.empty}</p>
      ) : (
        members.map((m) => (
          <div key={m.member_id} style={{ ...styles.infoCard, marginBottom: '10px' }}>
            <div style={styles.memberRow}>
              <span style={styles.memberName}>{m.name}</span>
              <span style={styles.relationChip}>{roleLabel(m.role)}</span>
              {m.invite_ready && (
                <span style={{ ...styles.subText, fontSize: '12px', marginLeft: 'auto', color: COLORS.primary }}>
                  {texts.onboarding.step2.inviteReady}
                </span>
              )}
            </div>
          </div>
        ))
      )}

      <div style={styles.footer}>
        <button style={styles.primaryButton} disabled={busy} onClick={onDone}>
          {texts.onboarding.done}
        </button>
      </div>
    </div>
  )
}
