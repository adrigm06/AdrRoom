import { Component, useEffect } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { useProgress } from '@react-three/drei';

type Lang = 'es' | 'en';

interface RoomErrorBoundaryProps {
  children: ReactNode;
  lang: Lang;
  onFailure?: () => void;
}

interface RoomErrorBoundaryState {
  failed: boolean;
}

export function RoomLoadingStatus({ lang }: { lang: Lang }) {
  const { active, progress } = useProgress();
  if (!active) return null;

  return (
    <div className="room-loading-overlay">
      <div className="room-loader" role="status" aria-live="polite">
        <span className="room-loader__mark" aria-hidden="true" />
        <span>{lang === 'es' ? 'Preparando la habitación' : 'Preparing the room'}</span>
        <span className="room-loader__progress">{Math.round(progress)}%</span>
      </div>
    </div>
  );
}

export function RoomCanvasFallback({
  lang,
  onFailure,
}: {
  lang: Lang;
  onFailure: () => void;
}) {
  useEffect(() => onFailure(), [onFailure]);

  const isSpanish = lang === 'es';
  return (
    <div className="room-fallback" role="alert">
      <img
        src="/room-preview.png"
        width="1440"
        height="960"
        alt={isSpanish ? 'Vista previa de la habitación de AdrRoom' : 'AdrRoom room preview'}
      />
      <p>
        {isSpanish
          ? 'Este navegador no puede mostrar la escena 3D.'
          : 'This browser cannot display the 3D room.'}
      </p>
    </div>
  );
}

export class RoomErrorBoundary extends Component<
  RoomErrorBoundaryProps,
  RoomErrorBoundaryState
> {
  state: RoomErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): RoomErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.props.onFailure?.();
    console.error('The room scene could not be loaded.', error, info);
  }

  render() {
    if (this.state.failed) {
      const isSpanish = this.props.lang === 'es';
      return (
        <div className="room-fallback" role="alert">
          <img
            src="/room-preview.png"
            width="1440"
            height="960"
            alt={isSpanish ? 'Vista previa de la habitación de AdrRoom' : 'AdrRoom room preview'}
          />
          <p>
            {isSpanish
              ? 'No se pudo iniciar la escena 3D. La vista previa sigue disponible.'
              : 'The 3D room could not start. The preview is still available.'}
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}
