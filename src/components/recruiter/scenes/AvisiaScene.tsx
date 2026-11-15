import { Phone, Reveal } from './SceneElements';
import { sceneText, type SceneProps } from '../types';

function Check() {
  return <svg width="17" height="12" viewBox="0 0 17 12" fill="none"><path d="m1 6 4 4 8-8M7 8l2 2 7-8" stroke="currentColor" strokeWidth="1.5" /></svg>;
}

/** Adapted from the client-only Avisia landing mockup; never sends a message. */
export default function AvisiaScene({ study, lang, step, reducedMotion }: SceneProps) {
  const text = (key: string) => sceneText(study, lang, key);
  return (
    <div className="recruiter-scene scene-avisia" aria-hidden="true">
      <div className="avisia-minute-ring"><svg viewBox="0 0 400 400"><circle cx="200" cy="200" r="185" /><circle cx="200" cy="200" r="185" className={step >= 4 ? 'is-ready' : ''} /></svg><span>avisia<span>↗</span></span></div>
      <Phone className="avisia-phone">
        <div className="avisia-chat-header"><span className="avisia-avatar">a</span><div><strong>{text('agency')}</strong><small>{step === 1 ? text('typing') : text('answered')}</small></div></div>
        <div className="avisia-chat-body">
          <div className="avisia-notification"><span>id</span><div><strong>{text('portal')}</strong><p>{text('property')}</p></div><small>23:47</small></div>
          {step === 1 && <div className="avisia-typing"><i /><i /><i /></div>}
          <Reveal visible={step >= 2} reducedMotion={reducedMotion} className="avisia-bubble avisia-reply"><p>{text('reply')}</p><span>23:47 <Check /></span></Reveal>
          <Reveal visible={step >= 3} reducedMotion={reducedMotion} className="avisia-bubble avisia-answer"><p>{text('answer')}</p><span>23:48</span></Reveal>
          <Reveal visible={step >= 4} reducedMotion={reducedMotion} className="avisia-summary"><div className="avisia-summary-icon">✓</div><div><strong>{text('summary')}</strong><p>{text('summaryDetail')}</p></div></Reveal>
          <p className="avisia-channel">{text('channel')}</p>
        </div>
      </Phone>
      <div className="scene-side-label"><span>↗</span><p>{text('ready')}</p></div>
    </div>
  );
}
