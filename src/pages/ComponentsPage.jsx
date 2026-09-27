import { useState } from 'react'
import * as UI from '../ui'
import { Checkbox, DatePicker, DistBar, Delta, Donut, Dropdown, FilePick, FilterCard, Level, LevelLegend, Radar, TrendLine } from '../ui'
import { SOUND_STATES } from '../data/methodology'
import { todayIso } from '../lib/dates'

// Витрина библиотеки: каждый компонент вживую и во всех состояниях. Новые экраны собираются только из этого.
const ICONS = Object.entries(UI).filter(([name]) => name.endsWith('Icon'))

function Spec({ title, note, children }) {
  return (
    <section className="card kit-spec">
      <div className="block-head"><h2>{title}</h2>{note && <code className="kit-code">{note}</code>}</div>
      {children}
    </section>
  )
}

export default function ComponentsPage() {
  const [dd, setDd] = useState('b')
  const [date, setDate] = useState('2020-06-08')
  const [empty, setEmpty] = useState('')
  const [on, setOn] = useState(true)
  const [off, setOff] = useState(false)
  const [file, setFile] = useState(null)
  const [mark, setMark] = useState(1)
  const [sound, setSound] = useState('auto')
  const [tab, setTab] = useState('a')
  const options = [{ value: 'a', label: 'Группа № 5 «Рябинка»' }, { value: 'b', label: 'Группа № 11, логопедическая' }, { value: 'c', label: 'Группа № 7, старшая' }]

  return (
    <div className="kit">
      <p className="subtitle" style={{ marginTop: 0 }}>Импорт одной строкой: <code className="kit-code">{"import { DatePicker, Checkbox, Dropdown } from '../ui'"}</code>. Системные элементы браузера — выбор даты, флажок, выпадающий список, подсказка — в приложении не используются.</p>

      <Spec title="Кнопки" note=".btn-primary · .btn-ghost · .text-action · .icon-btn">
        <div className="kit-row">
          <button type="button" className="btn-primary"><UI.PlusIcon /> Главное действие</button>
          <button type="button" className="btn-ghost"><UI.DownloadIcon /> Второстепенное</button>
          <button type="button" className="btn-ghost" disabled>Недоступно</button>
          <button type="button" className="text-action"><span>действие в строке</span></button>
          <button type="button" className="text-action danger"><span>удалить</span></button>
          <button type="button" className="icon-btn" aria-label="Изменить" data-tip="Изменить"><UI.PencilIcon /></button>
          <button type="button" className="icon-btn danger" aria-label="Удалить" data-tip="Удалить"><UI.TrashIcon /></button>
        </div>
      </Spec>

      <Spec title="Поля ввода" note=".input">
        <div className="kit-grid">
          <label className="field"><span className="field-label">Обычное</span><input className="input" placeholder="Фамилия Имя Отчество" /></label>
          <label className="field"><span className="field-label">Заполненное</span><input className="input" defaultValue="Воронова Мария Викторовна" /></label>
          <label className="field"><span className="field-label">Многострочное</span><textarea className="input" rows={2} placeholder="Заметки специалиста" /></label>
        </div>
      </Spec>

      <Spec title="Выпадающий список" note="<Dropdown variant=&quot;plain | light&quot; />">
        <div className="kit-grid">
          <div className="filters filters--fit" style={{ borderBottom: 0 }}><FilterCard label="Над контентом — plain"><Dropdown value={dd} options={options} onChange={setDd} label="Группа" /></FilterCard></div>
          <div className="field"><span className="field-label">В форме — light</span><Dropdown variant="light" value={dd} options={options} onChange={setDd} label="Группа" /></div>
          <div className="field"><span className="field-label">Пустой</span><Dropdown variant="light" value="" options={options} onChange={setDd} placeholder="выберите" label="Группа" /></div>
        </div>
      </Spec>

      <Spec title="Дата" note="<DatePicker value min max onChange />">
        <div className="kit-grid">
          <div className="field"><span className="field-label">С датой</span><DatePicker label="Дата рождения" value={date} onChange={setDate} max={todayIso()} /></div>
          <div className="field"><span className="field-label">Пустая</span><DatePicker label="Дата" value={empty} onChange={setEmpty} /></div>
          <p className="faint kit-note">Дату можно набрать цифрами — точки встанут сами — или выбрать в календаре. Стрелки двигают день, PageUp / PageDown — месяц, Shift + PageUp / PageDown — год, Enter — выбрать, Esc — закрыть. Выбрано: <span className="num">{date || '—'}</span></p>
        </div>
      </Spec>

      <Spec title="Флажок" note="<Checkbox checked onChange />">
        <div className="kit-row">
          <Checkbox checked={on} onChange={setOn}>Законный представитель</Checkbox>
          <Checkbox checked={off} onChange={setOff}>Не отмечен</Checkbox>
          <Checkbox checked disabled onChange={() => {}}>Недоступен</Checkbox>
        </div>
      </Spec>

      <Spec title="Выбор файла" note="<FilePick accept onFile />">
        <div className="kit-row">
          <FilePick accept=".xls,.xlsx,.json" onFile={setFile}><UI.UploadIcon /> Выбрать или перетащить файл</FilePick>
          <span className="faint">{file ? `Выбран: ${file.name}` : 'Файл не выбран — перетащите его на кнопку'}</span>
        </div>
      </Spec>

      <Spec title="Отметки балла" note=".mark · .mark.lvl-N">
        <div className="kit-row">
          <span className="marks" role="group" aria-label="Балл">
            {[0, 1, 2, 3].map((v) => <button key={v} type="button" className={`mark${mark === v ? ` lvl-${v}` : ''}`} aria-pressed={mark === v} onClick={() => setMark(v)}>{v}</button>)}
          </span>
          <span className="marks" role="group" aria-label="Этап звука">
            {SOUND_STATES.map((o) => <button key={o.value} type="button" data-tip={o.label} className={`mark${sound === o.value ? ` lvl-${o.score}` : ''}`} aria-pressed={sound === o.value} onClick={() => setSound(o.value)}>{o.mark}</button>)}
          </span>
        </div>
      </Spec>

      <Spec title="Уровни и динамика" note="<Level /> · <Delta /> · <DistBar /> · <LevelLegend />">
        <div className="kit-row">
          {[0, 1, 2, 3, null].map((v, i) => <Level key={i} value={v} />)}
          <Delta from={2.1} to={1.4} />
          <Delta from={1.2} to={1.6} />
          <div style={{ width: 240 }}><DistBar dist={[3, 5, 2, 2]} n={12} /></div>
        </div>
        <LevelLegend />
      </Spec>

      <Spec title="Вкладки" note=".subtabs · .type-tabs">
        <div className="subtabs" role="tablist" style={{ marginTop: 0 }}>
          {['a', 'b', 'c'].map((t) => <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>{{ a: 'Профиль', b: 'Программа', c: 'Заключение' }[t]}</button>)}
        </div>
        <div className="type-tabs" role="tablist">
          <button type="button" role="tab" aria-selected="true">Звуки <span className="count">13/25</span></button>
          <button type="button" role="tab" aria-selected="false">Фонетика <span className="count full">13/13</span></button>
        </div>
      </Spec>

      <Spec title="Подсказка" note='data-tip="…"'>
        <div className="kit-row">
          <span className="text-action" tabIndex={0} data-tip="Подсказка появляется при наведении и при фокусе с клавиатуры"><span>наведите на меня</span></span>
          <Level value={2} title="средний балл 1,85" />
        </div>
      </Spec>

      <Spec title="Графики" note="<Radar /> · <Donut /> · <TrendLine /> · <Dumbbell /> · <LevelColumns />">
        <div className="chart-grid">
          <Radar axes={[{ label: 'Звуки', start: 2.4, end: 1.6 }, { label: 'Фонетика', start: 2, end: 1.2 }, { label: 'Лексика', start: 1.8, end: 1 }, { label: 'Грамматика', start: 2.2, end: 1.4 }, { label: 'Связная речь', start: 1.6, end: 0.9 }]} startLabel="НГ" endLabel="КГ" />
          <div>
            <Donut centerValue={12} centerLabel="детей" segments={[{ label: 'норма', value: 3, color: '#3A9466' }, { label: 'улучшение', value: 7, color: '#3F7FB5' }, { label: 'без динамики', value: 2, color: '#D1AE1E' }]} />
            <TrendLine points={[{ label: 'НГ 24/25', value: 2.4 }, { label: 'КГ 24/25', value: 1.8 }, { label: 'НГ 25/26', value: 1.3 }]} />
          </div>
        </div>
      </Spec>

      <Spec title="Иконки" note="<PlusIcon /> …">
        <div className="kit-icons">
          {ICONS.map(([name, Icon]) => <span key={name} className="kit-icon" data-tip={name}><Icon /><span>{name.replace('Icon', '')}</span></span>)}
        </div>
      </Spec>
    </div>
  )
}
