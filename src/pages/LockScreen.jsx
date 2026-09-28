import { useState } from 'react'
import { storageActions } from '../lib/store'
import { LockIcon, TrashIcon } from '../ui/Icons'

// База зашифрована: без пароля данные не прочитать — показываем только этот экран.
export default function LockScreen() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [forgot, setForgot] = useState(0)

  const submit = async (e) => {
    e.preventDefault()
    if (!password) { setError('Введите пароль'); return }
    setBusy(true)
    setError('')
    try {
      await storageActions.unlock(password)
    } catch (err) {
      setError(err.message || 'Не удалось открыть базу')
      setPassword('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="lock">
      <div className="lock-card">
        <div className="lock-brand"><img src="./logo.png" alt="" width="40" height="40" /><span className="brand-name">Росток</span></div>
        <h1>База защищена паролем</h1>
        <p className="subtitle">Данные о детях хранятся в этом браузере в зашифрованном виде. Введите пароль, чтобы открыть их.</p>
        <form noValidate onSubmit={submit} className="lock-form">
          <label className="field">
            <span className="field-label">Пароль</span>
            <input className={`input${error ? ' is-invalid' : ''}`} type="password" autoComplete="current-password" autoFocus value={password}
              onChange={(e) => { setPassword(e.target.value); setError('') }} aria-invalid={Boolean(error)} aria-describedby={error ? 'lock-error' : undefined} />
          </label>
          {error && <p className="status bad" id="lock-error" role="alert" style={{ margin: 0 }}>{error}</p>}
          <button className="btn-primary" type="submit" disabled={busy}><LockIcon /> {busy ? 'Открываю…' : 'Открыть'}</button>
        </form>

        <div className="lock-forgot">
          {forgot === 0 && <button type="button" className="text-action" onClick={() => setForgot(1)}><span>забыли пароль?</span></button>}
          {forgot >= 1 && (
            <>
              <p className="faint">Пароль нигде не хранится, поэтому восстановить его нельзя. Можно удалить зашифрованную базу и начать заново — затем загрузить резервную копию в «Администрирование → Данные».</p>
              {forgot === 1
                ? <button type="button" className="btn-ghost" onClick={() => setForgot(2)}><TrashIcon /> Удалить базу и начать заново</button>
                : (
                  <div className="toolbar">
                    <button type="button" className="btn-ghost lock-danger" onClick={() => storageActions.destroy()}><TrashIcon /> Да, удалить все данные этого браузера</button>
                    <button type="button" className="btn-ghost" onClick={() => setForgot(0)}>Отмена</button>
                  </div>
                )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
