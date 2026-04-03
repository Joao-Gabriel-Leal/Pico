function IconBase({ children, size = 22, filled = false, className = '' }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill={filled ? 'currentColor' : 'none'}
      height={size}
      viewBox="0 0 24 24"
      width={size}
      xmlns="http://www.w3.org/2000/svg"
    >
      {children}
    </svg>
  )
}

export function PlusIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
    </IconBase>
  )
}

export function BellIcon({ filled = false, ...props }) {
  if (filled) {
    return (
      <IconBase {...props} filled>
        <path d="M12 3a5 5 0 0 0-5 5v2.9c0 .5-.2 1-.5 1.4L5 14.5V16h14v-1.5l-1.5-2.2c-.3-.4-.5-.9-.5-1.4V8a5 5 0 0 0-5-5Zm0 18a2.5 2.5 0 0 1-2.3-1.5h4.6A2.5 2.5 0 0 1 12 21Z" />
      </IconBase>
    )
  }

  return (
    <IconBase {...props}>
      <path
        d="M15 17H9m8-1H7v-1.2l1.1-1.7c.3-.4.4-.8.4-1.3V8a3.5 3.5 0 1 1 7 0v3.8c0 .5.1.9.4 1.3l1.1 1.7V16Zm-3.5 4a1.5 1.5 0 0 1-3 0"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
    </IconBase>
  )
}

export function MapIcon(props) {
  return (
    <IconBase {...props}>
      <path
        d="m3 6 5-2 8 3 5-2v13l-5 2-8-3-5 2V6Zm5-2v13m8-10v13"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
    </IconBase>
  )
}

export function CalendarIcon(props) {
  return (
    <IconBase {...props}>
      <rect
        height="15"
        rx="3"
        stroke="currentColor"
        strokeWidth="1.9"
        width="16"
        x="4"
        y="5"
      />
      <path d="M8 3v4M16 3v4M4 10h16" stroke="currentColor" strokeLinecap="round" strokeWidth="1.9" />
    </IconBase>
  )
}

export function SearchIcon(props) {
  return (
    <IconBase {...props}>
      <circle cx="11" cy="11" r="6" stroke="currentColor" strokeWidth="1.9" />
      <path d="m16 16 4 4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.9" />
    </IconBase>
  )
}

export function MessageIcon(props) {
  return (
    <IconBase {...props}>
      <path
        d="M6 6.5h12a2.5 2.5 0 0 1 2.5 2.5v5A2.5 2.5 0 0 1 18 16.5H10l-4 3v-3H6A2.5 2.5 0 0 1 3.5 14V9A2.5 2.5 0 0 1 6 6.5Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
    </IconBase>
  )
}

export function FeedIcon(props) {
  return (
    <IconBase {...props}>
      <rect
        height="15"
        rx="3"
        stroke="currentColor"
        strokeWidth="1.9"
        width="16"
        x="4"
        y="4.5"
      />
      <path d="m10 9 5 3-5 3V9Z" fill="currentColor" />
    </IconBase>
  )
}

export function ProfileIcon(props) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.9" />
      <path
        d="M5.5 19a6.5 6.5 0 0 1 13 0"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.9"
      />
    </IconBase>
  )
}

export function HeartIcon({ filled = false, ...props }) {
  if (filled) {
    return (
      <IconBase {...props} filled>
        <path d="M12 20.5 4.5 13.3a4.8 4.8 0 1 1 6.8-6.8l.7.8.7-.8a4.8 4.8 0 1 1 6.8 6.8L12 20.5Z" />
      </IconBase>
    )
  }

  return (
    <IconBase {...props}>
      <path
        d="M12 20.5 4.5 13.3a4.8 4.8 0 1 1 6.8-6.8l.7.8.7-.8a4.8 4.8 0 1 1 6.8 6.8L12 20.5Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
    </IconBase>
  )
}

export function CommentIcon(props) {
  return (
    <IconBase {...props}>
      <path
        d="M6 6h12a2.5 2.5 0 0 1 2.5 2.5V14A2.5 2.5 0 0 1 18 16.5H10l-4 3v-3H6A2.5 2.5 0 0 1 3.5 14V8.5A2.5 2.5 0 0 1 6 6Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
    </IconBase>
  )
}

export function SendIcon(props) {
  return (
    <IconBase {...props}>
      <path
        d="m20 4-7.4 16-2.2-6.4L4 11.4 20 4Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
    </IconBase>
  )
}

export function ShareIcon(props) {
  return (
    <IconBase {...props}>
      <path
        d="m14 5 5 5-5 5M19 10H9a4 4 0 0 0-4 4v1"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
    </IconBase>
  )
}

export function MoreIcon(props) {
  return (
    <IconBase {...props}>
      <circle cx="6.5" cy="12" r="1.4" fill="currentColor" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" />
      <circle cx="17.5" cy="12" r="1.4" fill="currentColor" />
    </IconBase>
  )
}
