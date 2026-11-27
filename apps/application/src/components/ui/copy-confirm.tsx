import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check, Copy } from "lucide-react";

export function CopyConfirm({copied, label}: {copied:boolean; label:string}) {
  const reduce = useReducedMotion();
  return <span className="flex items-center gap-2" aria-hidden>
    <AnimatePresence mode="popLayout" initial={false}><motion.span key={String(copied)} initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>
      {copied ? <Check size={18}/> : <Copy size={18}/>}
    </motion.span></AnimatePresence>
    <span className="relative flex"><AnimatePresence mode="popLayout" initial={false}>{Array.from(label).map((letter,index) =>
      <motion.span key={index + letter} initial={{opacity:0,y:reduce ? 0 : 5}} animate={{opacity:1,y:0}} exit={{opacity:0}}
        transition={{duration:reduce ? 0 : .16,delay:reduce ? 0 : index*.025}}>{letter}</motion.span>)}</AnimatePresence></span>
  </span>;
}
