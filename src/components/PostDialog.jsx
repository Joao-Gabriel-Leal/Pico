import SocialPostCard from './SocialPostCard'

export default function PostDialog({ item, token, currentUser, onClose, onUpdated, onDeleted }) {
  if (!item) return null

  return (
    <div className="sheet-backdrop post-dialog-backdrop" onClick={onClose}>
      <div className="post-dialog" onClick={(event) => event.stopPropagation()}>
        <div className="sheet-header">
          <strong>Publicacao</strong>
          <button className="icon-button" type="button" onClick={onClose}>
            x
          </button>
        </div>

        <SocialPostCard
          item={item}
          token={token}
          currentUser={currentUser}
          onUpdated={onUpdated}
          onDeleted={onDeleted}
        />
      </div>
    </div>
  )
}
