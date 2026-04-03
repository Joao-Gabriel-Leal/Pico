export default function SportPicker({ sports, selectedIds, onToggle, helperText }) {
  const selectedCount = selectedIds.length

  return (
    <div className="sport-picker">
      <div className="sport-picker-header">
        <strong>
          {selectedCount} {selectedCount === 1 ? 'esporte selecionado' : 'esportes selecionados'}
        </strong>
        <span>Toque para adicionar ou remover quantos quiser.</span>
      </div>

      <div className="sport-grid">
        {sports.map((sport) => {
          const isActive = selectedIds.includes(sport.id)

          return (
            <button
              key={sport.id}
              type="button"
              className={isActive ? 'sport-card active' : 'sport-card'}
              onClick={() => onToggle(sport.id)}
              aria-pressed={isActive}
            >
              <span className={isActive ? 'sport-card-check active' : 'sport-card-check'}>
                {isActive ? 'Selecionado' : 'Disponivel'}
              </span>
              <span className="sport-card-name">{sport.name}</span>
              <strong>{isActive ? 'Toque para remover' : 'Toque para adicionar'}</strong>
            </button>
          )
        })}
      </div>

      {helperText ? <p className="helper-text">{helperText}</p> : null}
    </div>
  )
}
