import { Phone, Reveal, Tomato } from './SceneElements';
import { sceneText, type SceneProps } from '../types';

export default function KomeaScene({ study, lang, step, reducedMotion }: SceneProps) {
  const text = (key: string) => sceneText(study, lang, key);
  return (
    <div className="recruiter-scene scene-komea" aria-hidden="true">
      <div className="komea-orbit komea-orbit-one" /><div className="komea-orbit komea-orbit-two" />
      <div className="komea-floating-food"><Tomato /><span>{text('tomato')}</span></div>
      <Phone className="komea-phone">
        <div className="komea-app-header"><span className="komea-wordmark">komea<span>✳</span></span><span>＋</span></div>
        <div className="komea-camera-title">{text('camera')} <span>⌗</span></div>
        <div className={`komea-viewfinder ${step === 1 ? 'is-scanning' : ''}`}><Tomato /><span className="scan-corner corner-tl" /><span className="scan-corner corner-tr" /><span className="scan-corner corner-bl" /><span className="scan-corner corner-br" />{step === 1 && <div className="komea-scan-beam" />}<span className="komea-scan-state">{step >= 2 ? `✓ ${text('tomato')}` : text('scan')}</span></div>
        <Reveal visible={step >= 2} reducedMotion={reducedMotion} className="komea-ingredients"><p>{text('detected')}</p><div><span>● {text('tomato')}</span><span>◒ {text('rice')}</span><span>❧ {text('basil')}</span></div></Reveal>
        <Reveal visible={step >= 3} reducedMotion={reducedMotion} className="komea-recipe"><div className="komea-recipe-kicker">✳ {text('suggestion')}</div><h3>{text('recipe')}</h3><p>{text('recipeDetail')}</p><span className="komea-review">{text('review')} <span>↗</span></span></Reveal>
      </Phone>
      <Reveal visible={step >= 4} reducedMotion={reducedMotion} className="komea-recipe-note"><span>✓</span><p>{text('ready')}</p></Reveal>
    </div>
  );
}
