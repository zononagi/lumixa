import { type JSX } from 'react'
import { useAppearanceStore } from '@renderer/stores/appearanceStore'

/**
 * Full-screen backdrop rendered behind the app shell. Shows a user-chosen image
 * or looping video ("Background Cover"-style) with a dim overlay for contrast.
 * When translucency/Mica is active the shell surfaces sit on top of this.
 */
export function BackgroundLayer(): JSX.Element | null {
  const { background, dim } = useAppearanceStore()
  if (background.type === 'none') return null

  return (
    <div className="app-bg">
      {background.type === 'image' ? (
        <img src={background.url} alt="" className="app-bg-media" />
      ) : (
        <video
          className="app-bg-media"
          src={background.url}
          autoPlay
          loop
          muted
          playsInline
        />
      )}
      <div className="app-bg-dim" style={{ background: `rgba(0,0,0,${dim})` }} />
    </div>
  )
}
