'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { DraftUi, type DraftUiProps } from './draft-ui';
import type { UpcomingTarget } from '@/lib/targets';

export function DraftUiWithTargets(props: DraftUiProps & { targets: UpcomingTarget[] }) {
  const targetMode = props.started && !props.complete && !props.correcting && !props.onClock;
  const [host, setHost] = useState<Element | null>(null);

  useEffect(() => {
    setHost(targetMode ? document.querySelector('.sideStack') : null);
  }, [targetMode, props.currentOverallPick]);

  return <>
    {targetMode ? <style>{'.recommendationPanel{display:none}'}</style> : null}
    <DraftUi {...props} recs={props.onClock ? props.recs : []} />
    {targetMode && host ? createPortal(<TargetsPanel targets={props.targets} nextPick={props.nextUserPick} />, host) : null}
  </>;
}

function TargetsPanel({ targets, nextPick }: { targets: UpcomingTarget[]; nextPick: number | null }) {
  return <section className="panel targetPanel" style={{ order: -1 }}>
    <div className="panelHeader">
      <div><span className="eyebrow">Draft plan</span><h2>Targets for #{nextPick ?? '—'}</h2></div>
      <span className="countPill">Est. availability</span>
    </div>
    {targets.length ? <div className="recommendationList">{targets.map((target, index) => <article className="recommendation" key={target.player.id}>
      <div className="recommendationTopline">
        <span className="medal">#{index + 1}</span>
        <div><strong>{target.player.name}</strong><small>{target.player.position} • Rank {target.player.overallRank}</small></div>
        <span className="score">{target.availabilityPercent}%</span>
      </div>
      <div className="scoreTrack"><span style={{ width: `${target.availabilityPercent}%` }} /></div>
      <div className="recommendationSignals">
        <span className={`signalChip availability ${target.availabilityLabel === 'LIKELY' ? 'likely' : target.availabilityLabel === 'POSSIBLE' ? 'uncertain' : 'unlikely'}`}>
          {target.availabilityLabel === 'LIKELY' ? `Likely at #${target.targetPick}` : target.availabilityLabel === 'POSSIBLE' ? `Possible at #${target.targetPick}` : `Long shot at #${target.targetPick}`}
        </span>
        {target.player.adp != null ? <span className="signalChip">ADP {Math.round(target.player.adp)}</span> : null}
      </div>
      <ul>{target.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
    </article>)}</div> : <div className="emptyState">No realistic targets yet. This updates as players come off the board.</div>}
  </section>;
}
