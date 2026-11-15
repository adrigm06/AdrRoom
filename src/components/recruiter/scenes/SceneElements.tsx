import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

export function Phone({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`recruiter-phone ${className}`}><div className="recruiter-phone-screen"><div className="recruiter-phone-hardware"><span>9:41</span><i /><span>▮▮▮</span></div>{children}<div className="recruiter-home-indicator" /></div></div>;
}

export function Reveal({ visible, reducedMotion, children, className = '' }: { visible: boolean; reducedMotion: boolean; children: ReactNode; className?: string }) {
  return <motion.div className={className} initial={false} animate={{ opacity: visible ? 1 : 0, transform: visible ? 'translateY(0px)' : 'translateY(12px)' }} transition={{ duration: reducedMotion ? 0 : 0.35, ease: [0.22, 1, 0.36, 1] }}>{children}</motion.div>;
}

export function Tomato({ className = '' }: { className?: string }) {
  return <svg className={className} viewBox="0 0 180 160" fill="none"><ellipse cx="90" cy="142" rx="56" ry="8" className="food-shadow" /><path d="M88 41C62 24 20 51 22 91c2 37 34 58 67 52 41 10 70-19 70-55 0-35-36-61-63-46Z" className="food-tomato" /><path d="M84 45 65 27l23 5 8-25 4 27 27-8-18 20 17 12-30-6-25 13Z" className="food-stem" /><path d="M43 83c1-12 7-21 16-26" className="food-shine" strokeWidth="7" strokeLinecap="round" /></svg>;
}
