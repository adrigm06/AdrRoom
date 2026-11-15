import { motion } from 'framer-motion';
import { Phone, Reveal } from './SceneElements';
import { sceneText, type SceneProps } from '../types';

const domains = ['architecture', 'compose', 'concurrency', 'testing', 'gradle', 'performance', 'security', 'review', 'debugging', 'release'];
const selected = new Set(['architecture', 'compose', 'testing']);

export default function AndroidScene({ study, lang, step, reducedMotion }: SceneProps) {
  const text = (key: string) => sceneText(study, lang, key);
  return (
    <div className="recruiter-scene scene-android" aria-hidden="true">
      <div className={`android-app-preview ${step >= 3 ? 'is-built' : ''}`}>
        <p>{text('app')}</p><div className="app-preview-top"><i /><span /></div>
        <Reveal visible={step >= 2} reducedMotion={reducedMotion}><div className="app-preview-hero"><i /><span /><span /></div></Reveal>
        <Reveal visible={step >= 3} reducedMotion={reducedMotion}><div className="app-preview-rows"><i /><i /><i /></div></Reveal>
        <Reveal visible={step >= 4} reducedMotion={reducedMotion}><div className="app-preview-ready">✓ {text('ready')}</div></Reveal>
      </div>
      <Phone className="android-phone">
        <div className="android-request"><span>→</span>{text('request')}</div>
        <svg className="android-network" viewBox="0 0 300 390">
          {domains.map((domain, index) => {
            const x = index % 2 === 0 ? 69 : 231;
            const y = 123 + Math.floor(index / 2) * 53;
            const active = selected.has(domain) && step >= 2;
            return <g key={domain}>
              <path d={`M150 54 L150 ${y} L${x} ${y}`} className="android-wire" />
              {selected.has(domain) && <motion.path d={`M150 54 L150 ${y} L${x} ${y}`} className="android-wire-active" initial={false} animate={{ pathLength: step >= 2 ? 1 : 0, opacity: step >= 2 ? 1 : 0 }} transition={{ duration: reducedMotion ? 0 : 0.8, delay: reducedMotion ? 0 : index * 0.08 }} />}
              <rect x={x - 57} y={y - 17} width="114" height="34" rx="8" className={`android-node ${active ? 'is-active' : ''}`} />
              <text x={x} y={y + 4} textAnchor="middle" className={`android-node-label ${active ? 'is-active' : ''}`}>{text(domain)}</text>
              {active && <circle cx={x + 48} cy={y - 11} r="3" className="android-node-indicator" />}
            </g>;
          })}
          <rect x="61" y="25" width="178" height="46" rx="12" className={`android-orchestrator ${step >= 1 ? 'is-active' : ''}`} />
          <text x="150" y="53" textAnchor="middle" className="android-orchestrator-label">{text('orchestrator')}</text>
          <motion.circle r="4" className="android-packet" initial={false} animate={{ cx: step >= 3 ? 150 : 69, cy: step >= 3 ? 73 : 123, opacity: step >= 2 && step < 4 ? 1 : 0 }} transition={{ duration: reducedMotion ? 0 : 1 }} />
        </svg>
        <div className="android-legend"><span><i />{text('lead')}: {text('architecture')}</span><span>{text('support')}: Compose + Testing</span></div>
        <div className="android-gates">{['plan', 'validate', 'execute'].map((label, index) => <span className={step >= index + 1 ? 'is-ready' : ''} key={label}>✓ {text(label)}</span>)}</div>
      </Phone>
      <div className="scene-side-label"><span>01 / 10</span><p>{text('lead')}<br />+ {text('support')}</p></div>
    </div>
  );
}
